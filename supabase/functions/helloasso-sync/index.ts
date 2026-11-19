// Edge Function : helloasso-sync
// Appelée par cron-job.org toutes les heures
// Compare les paiements HelloAsso récents avec les commandes en_attente/panier
// et met à jour le statut en "payee" + envoie l'email de confirmation
//
// Secrets requis : HELLOASSO_CLIENT_ID, HELLOASSO_CLIENT_SECRET,
//                  RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY
// Protection : header Authorization: Bearer <HELLOASSO_WEBHOOK_TOKEN>

const HA_BASE    = 'https://api.helloasso.com'
const HA_ORG     = Deno.env.get('HELLOASSO_ORG_SLUG') || 'bde-creadien'

const HA_HEADERS = {
  'User-Agent': 'BDECreadien/1.0 (contact@bdecreadien.fr)',
  'Accept': 'application/json',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function getHAToken(): Promise<string> {
  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     Deno.env.get('HELLOASSO_CLIENT_ID') || '',
    client_secret: Deno.env.get('HELLOASSO_CLIENT_SECRET') || '',
  })
  const res = await fetch(`${HA_BASE}/oauth2/token`, {
    method: 'POST',
    headers: { ...HA_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error(`HelloAsso OAuth: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.access_token
}

Deno.serve(async (req) => {
  // Protection cron
  const auth   = req.headers.get('Authorization') || ''
  const secret = auth.replace('Bearer ', '').trim()
  const token  = Deno.env.get('HELLOASSO_WEBHOOK_TOKEN') || ''
  const SB  = Deno.env.get('SUPABASE_URL') || ''
  const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  // Accepté : le jeton du cron, ou la clé service (appel serveur depuis /api/boutique-paye)
  const autorise = !!secret && ((token && secret === token) || (KEY && secret === KEY))
  if (!autorise) return json({ error: 'Non autorisé' }, 401)
  if (!SB || !KEY) return json({ error: 'Env manquant' }, 500)

  const sbHeaders = {
    apikey:        KEY,
    Authorization: `Bearer ${KEY}`,
    'Content-Type': 'application/json',
    Prefer:        'return=representation',
  }

  try {
    // 1. Récupérer les commandes en_attente ou panier avec email (créées < 7 jours)
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
    const cmdRes = await fetch(
      `${SB}/rest/v1/boutique_commandes?statut=in.(en_attente,panier)&email_acheteur=not.is.null&numero=not.is.null&created_at=gte.${since}&select=id,numero,statut,nom_acheteur,email_acheteur,total_centimes,boutique_items(est_offert,prix_unitaire_centimes,quantite)`,
      { headers: sbHeaders }
    )
    const commandes: any[] = await cmdRes.json()
    if (!commandes.length) return json({ ok: true, synced: 0, message: 'Aucune commande en attente' })

    // 2. Token HelloAsso
    const haToken = await getHAToken()

    // 3. Récupérer les paiements HelloAsso des 7 derniers jours
    const fromDate = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
    // Plusieurs pages (jusqu'à 10 x 100). Dédoublonnage par identifiant de paiement :
    // si l'API ignorait le numéro de page, on s'arrête dès qu'une page n'apporte rien de nouveau.
    const payments: any[] = []
    const seen = new Set<string>()
    for (let page = 1; page <= 10; page++) {
      const paymentsRes = await fetch(
        `${HA_BASE}/v5/organizations/${HA_ORG}/payments?from=${fromDate}&pageSize=100&pageIndex=${page}`,
        { headers: { ...HA_HEADERS, Authorization: `Bearer ${haToken}` } }
      )
      if (!paymentsRes.ok) {
        if (page === 1) return json({ error: `HelloAsso payments: ${paymentsRes.status}` }, 500)
        break
      }
      const pageData: any[] = (await paymentsRes.json()).data || []
      let nouveaux = 0
      for (const p of pageData) {
        const id = String(p.id ?? '')
        if (id && seen.has(id)) continue
        if (id) seen.add(id)
        payments.push(p)
        nouveaux++
      }
      if (nouveaux === 0 || pageData.length < 100) break
    }

    // 4. Construire un index email → montant payé (en centimes)
    // On garde uniquement les paiements "Authorized" (réussis)
    const paidByEmail: Record<string, number[]> = {}
    for (const p of payments) {
      if (p.state !== 'Authorized') continue
      const email = p.payer?.email?.toLowerCase()
      if (!email) continue
      const montant = p.amount || 0
      if (!paidByEmail[email]) paidByEmail[email] = []
      paidByEmail[email].push(montant)
    }

    // 5. Pour chaque commande en attente, vérifier si le paiement existe
    let synced = 0
    const errors: string[] = []

    for (const cmd of commandes) {
      const email = cmd.email_acheteur?.toLowerCase()
      if (!email || !paidByEmail[email]) continue

      // Total attendu recalculé depuis les articles (total_centimes peut être faux ou périmé)
      const itemsTotal = (cmd.boutique_items || [])
        .filter((i: any) => !i.est_offert || i.prix_unitaire_centimes < 0)
        .reduce((s: number, i: any) => s + i.prix_unitaire_centimes * i.quantite, 0)
      const montantCmd = itemsTotal > 0 ? itemsTotal : (cmd.total_centimes || 0)
      if (montantCmd <= 0) continue

      // Vérifier si un montant correspond (tolérance ±1 centime)
      const matchIdx = paidByEmail[email].findIndex(m => Math.abs(m - montantCmd) <= 1)
      if (matchIdx === -1) continue
      paidByEmail[email].splice(matchIdx, 1) // un paiement ne valide qu'une commande

      // Mettre à jour en payee + corriger le total
      const upRes = await fetch(
        `${SB}/rest/v1/boutique_commandes?id=eq.${cmd.id}`,
        {
          method: 'PATCH',
          headers: sbHeaders,
          body: JSON.stringify({ statut: 'payee', total_centimes: montantCmd, updated_at: new Date().toISOString() }),
        }
      )
      if (!upRes.ok) { errors.push(cmd.numero); continue }

      // Email de confirmation (même modèle que l'étape "payee" de l'admin, avec QR code)
      await fetch('https://bdecreadien.fr/api/boutique-email-etape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commande_id: cmd.id, etape: 'payee' }),
      }).catch(() => {})

      synced++
    }

    return json({ ok: true, synced, checked: commandes.length, errors })
  } catch (e) {
    console.error('[helloasso-sync]', e)
    return json({ error: (e as Error).message }, 500)
  }
})
