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
const RESEND_FROM = 'BDE CREAD Lyon <noreply@bdecreadien.fr>'

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
  if (!token || secret !== token) return json({ error: 'Non autorisé' }, 401)

  const SB  = Deno.env.get('SUPABASE_URL') || ''
  const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
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
      `${SB}/rest/v1/boutique_commandes?statut=in.(en_attente,panier)&email_acheteur=not.is.null&created_at=gte.${since}&select=id,numero,statut,nom_acheteur,email_acheteur,total_centimes`,
      { headers: sbHeaders }
    )
    const commandes: any[] = await cmdRes.json()
    if (!commandes.length) return json({ ok: true, synced: 0, message: 'Aucune commande en attente' })

    // 2. Token HelloAsso
    const haToken = await getHAToken()

    // 3. Récupérer les paiements HelloAsso des 7 derniers jours
    const fromDate = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
    const paymentsRes = await fetch(
      `${HA_BASE}/v5/organizations/${HA_ORG}/payments?from=${fromDate}&pageSize=100`,
      { headers: { ...HA_HEADERS, Authorization: `Bearer ${haToken}` } }
    )
    if (!paymentsRes.ok) {
      return json({ error: `HelloAsso payments: ${paymentsRes.status}` }, 500)
    }
    const paymentsData = await paymentsRes.json()
    const payments: any[] = paymentsData.data || []

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

      // Vérifier si un montant correspond (tolérance ±1 centime)
      const montantCmd = cmd.total_centimes || 0
      const match = paidByEmail[email].find(m => Math.abs(m - montantCmd) <= 1)
      if (!match) continue

      // Mettre à jour en payee
      const upRes = await fetch(
        `${SB}/rest/v1/boutique_commandes?id=eq.${cmd.id}`,
        {
          method: 'PATCH',
          headers: sbHeaders,
          body: JSON.stringify({ statut: 'payee', updated_at: new Date().toISOString() }),
        }
      )
      if (!upRes.ok) { errors.push(cmd.numero); continue }

      // Envoyer l'email de confirmation
      if (Deno.env.get('RESEND_API_KEY') && cmd.email_acheteur) {
        const total = formatEur(montantCmd)
        const html = `<!DOCTYPE html><html><head><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:16px;background:white;font-family:sans-serif">
<div style="max-width:560px;margin:0 auto;border:1px solid #ebe6f5;border-radius:16px;overflow:hidden;color:#1a0030">
  <div style="background:linear-gradient(135deg,#460186 0%,#D2396D 50%,#FF741F 100%);padding:14px 24px;text-align:center">
    <p style="margin:0 0 2px;color:rgba(255,255,255,.6);font-size:9px;letter-spacing:4px;text-transform:uppercase">BDE CREAD LYON</p>
    <p style="margin:0;color:white;font-size:36px;font-weight:900;letter-spacing:2px;font-family:Impact,'Arial Narrow',Arial,sans-serif">BOUTIQUE MERCH</p>
  </div>
  <div style="background:white;padding:24px">
    <p style="margin:0 0 8px">Bonjour <strong>${escHtml(cmd.nom_acheteur || '')}</strong>,</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6">
      Ton paiement pour la commande <strong style="color:#460186">${escHtml(cmd.numero)}</strong> a bien été reçu (${total}). ✓
    </p>
    <p style="margin:0 0 20px;font-size:14px;color:#666;line-height:1.6">
      Ta commande est maintenant en cours de préparation. Tu recevras un email dès qu'elle sera prête à être récupérée.
    </p>
    <p style="margin:16px 0 0;font-size:12px;color:#bbb;border-top:1px solid #f0e8ff;padding-top:14px">
      Une question ? <a href="mailto:bdecreadien@gmail.com" style="color:#D2396D;text-decoration:none">bdecreadien@gmail.com</a>
    </p>
  </div>
</div>
</body></html>`

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
          },
          body: JSON.stringify({
            from:    RESEND_FROM,
            to:      [cmd.email_acheteur],
            subject: `Paiement confirmé — Commande ${cmd.numero}`,
            html,
          }),
        }).catch(() => {})
      }

      synced++
    }

    return json({ ok: true, synced, checked: commandes.length, errors })
  } catch (e) {
    console.error('[helloasso-sync]', e)
    return json({ error: (e as Error).message }, 500)
  }
})

function escHtml(s: string) {
  return String(s ?? '').replace(/[&<>"']/g, (c: string) =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c))
}

function formatEur(centimes: number) {
  return (centimes / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}
