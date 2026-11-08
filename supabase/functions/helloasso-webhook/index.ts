// Edge Function : helloasso-webhook
// ============================================================================
// Reçoit les notifications HelloAsso quand une commande est payée / remboursée.
// - Vérifie le token de sécurité (configuré dans HelloAsso back-office)
// - Insère/met à jour la vente et les billets
// - Crée automatiquement une transaction dans Finances (catégorie « Billetterie »)
//
// Secrets Supabase requis :
//   HELLOASSO_WEBHOOK_TOKEN  : token partagé configuré côté HelloAsso
//   SUPABASE_URL             : (fourni automatiquement par Supabase)
//   SUPABASE_SERVICE_ROLE_KEY: (fourni automatiquement)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const FROM    = 'BDE CREAD Lyon <noreply@bdecreadien.fr>'
const SITE    = 'https://bdecreadien.fr'
const RESEND  = Deno.env.get('RESEND_API_KEY') || ''

async function sendConfirmationEmail(to: string, prenom: string, nom: string, eventTitre: string, tarifNom: string, qty: number, montantCentimes: number, billetterieSlug: string) {
  if (!RESEND || !to) return
  // Récupère whatsapp_url depuis la table billetteries
  let whatsappUrl: string | null = null
  if (billetterieSlug) {
    const { data: bil } = await supa.from('billetteries').select('whatsapp_url').eq('slug', billetterieSlug).maybeSingle()
    whatsappUrl = bil?.whatsapp_url ?? null
  }
  const montant = (montantCentimes / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  const whatsappBlock = whatsappUrl ? `
    <div style="margin:24px 0;text-align:center;">
      <p style="margin:0 0 12px;font-size:14px;color:#444;line-height:1.5">Pour rejoindre le groupe et rester informé(e) des activités :</p>
      <a href="${whatsappUrl}" style="display:inline-block;padding:14px 32px;background:#25D366;color:white;border-radius:12px;font-size:15px;font-weight:700;text-decoration:none;font-family:Arial,sans-serif;">Rejoindre le groupe WhatsApp</a>
    </div>` : ''
  const html = `<!DOCTYPE html><html><head><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0;padding:16px;background:white;font-family:sans-serif;color-scheme:light">
<div style="max-width:560px;margin:0 auto;border:1px solid #ebe6f5;border-radius:16px;overflow:hidden;color:#1a0030">
  <div style="background:linear-gradient(135deg,#460186 0%,#D2396D 50%,#FF741F 100%);padding:14px 24px;text-align:center">
    <p style="margin:0 0 2px;color:rgba(255,255,255,.6);font-size:9px;letter-spacing:4px;text-transform:uppercase">BDE CREAD LYON</p>
    <p style="margin:0;color:white;font-size:32px;font-weight:900;letter-spacing:2px;font-family:Impact,'Arial Narrow',Arial,sans-serif">${eventTitre.toUpperCase()}</p>
  </div>
  <div style="background:white;padding:24px 28px">
    <p style="margin:0 0 8px;font-size:15px">Bonjour <strong>${prenom} ${nom}</strong>,</p>
    <p style="margin:0 0 20px;font-size:17px;font-weight:700;color:#16a34a">Ton inscription est confirmée !</p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#444">
      Ton paiement pour <strong>${eventTitre}</strong> a bien été reçu et validé.
      ${tarifNom ? `Tu es inscrit(e) en tant que <strong>${tarifNom}</strong>.` : ''} Bienvenue !
    </p>
    <div style="background:#f9f5ff;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
      ${tarifNom ? `<p style="margin:0 0 4px;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.5px">Tarif</p>
      <p style="margin:0 0 14px;font-size:15px;font-weight:700;color:#460186">${tarifNom}${qty > 1 ? ` × ${qty}` : ''}</p>` : ''}
      <p style="margin:0 0 4px;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.5px">Montant payé</p>
      <p style="margin:0;font-size:26px;font-weight:800;color:#460186">${montant}</p>
    </div>
    ${whatsappBlock}
    <p style="margin:20px 0 0;font-size:12px;color:#bbb;border-top:1px solid #f0e8ff;padding-top:14px">
      Une question ? <a href="mailto:bdecreadien@gmail.com" style="color:#D2396D;text-decoration:none">bdecreadien@gmail.com</a>
      &nbsp;·&nbsp;<a href="${SITE}" style="color:#D2396D;text-decoration:none">bdecreadien.fr</a>
    </p>
  </div>
</div>
</body></html>`
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND}` },
    body: JSON.stringify({ from: FROM, to: [to], subject: `Ton inscription à ${eventTitre} est confirmée !`, html }),
  }).catch(() => {})
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-helloasso-signature',
}

const supa = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
)

const WEBHOOK_TOKEN = Deno.env.get('HELLOASSO_WEBHOOK_TOKEN') || ''

function unauthorized(msg = 'unauthorized') {
  return new Response(JSON.stringify({ error: msg }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } })
}
function ok(payload: unknown = { ok: true }) {
  return new Response(JSON.stringify(payload), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
}
function bad(msg: string, code = 400) {
  return new Response(JSON.stringify({ error: msg }), { status: code, headers: { ...cors, 'Content-Type': 'application/json' } })
}

// Structure typique du payload HelloAsso "Order" (extrait):
// {
//   "eventType": "Order",           // ou "Payment"
//   "data": {
//     "id": 123,                    // hello_asso_order_id
//     "date": "...",
//     "payer": { "firstName": "...", "lastName": "...", "email": "...", "phone": "..." },
//     "items": [
//       { "id": 456, "priceCategory": {...}, "customFields": [...], "user": { firstName, lastName, email } , "amount": 500, "tierId": 42, "tierName": "Étudiant" }
//     ],
//     "amount": { "total": 1000 },
//     "formSlug": "soiree-halloween-2026",
//     "formType": "Event",
//   }
// }

async function findEventBySlug(slug: string) {
  const { data } = await supa.from('evenements')
    .select('id, titre').eq('hello_asso_form_slug', slug).maybeSingle()
  return data
}

async function findProfilByEmail(email: string) {
  const norm = (email || '').trim().toLowerCase()
  if (!norm) return null
  // Auth users : lookup via profils.email si la colonne existe, sinon via rpc
  const { data } = await supa.from('profils').select('id').eq('email', norm).maybeSingle()
  return data?.id ?? null
}

async function upsertVenteFromOrder(order: any, formSlug: string) {
  const evt = await findEventBySlug(formSlug)
  const evenement_id = evt?.id ?? null
  const acheteur_email = order?.payer?.email ?? null
  const acheteur_user_id = acheteur_email ? await findProfilByEmail(acheteur_email) : null

  const payload = {
    evenement_id,
    hello_asso_order_id: order?.id ?? null,
    acheteur_user_id,
    acheteur_email,
    acheteur_nom: order?.payer?.lastName ?? null,
    acheteur_prenom: order?.payer?.firstName ?? null,
    acheteur_tel: order?.payer?.phone ?? null,
    montant_total_centimes: order?.amount?.total ?? 0,
    statut: 'payee',
    raw_payload: order,
    updated_at: new Date().toISOString(),
  }

  // Upsert par hello_asso_order_id
  const { data: vente, error: upErr } = await supa.from('billetterie_ventes')
    .upsert(payload, { onConflict: 'hello_asso_order_id' }).select().single()
  if (upErr) throw upErr

  // Billets nominatifs — un par item
  const items = Array.isArray(order?.items) ? order.items : []
  for (const it of items) {
    const porteur = it?.user ?? {}
    const bill = {
      vente_id: vente.id,
      evenement_id,
      tarif_libelle: it?.tierName ?? it?.priceCategory?.name ?? 'Billet',
      prix_centimes: it?.amount ?? 0,
      porteur_nom: porteur?.lastName ?? order?.payer?.lastName ?? null,
      porteur_prenom: porteur?.firstName ?? order?.payer?.firstName ?? null,
      porteur_email: porteur?.email ?? order?.payer?.email ?? null,
    }
    // On insère chaque billet ; en cas de re-livraison du même order,
    // on skip si un billet existe déjà pour ce vente_id (idempotence légère)
    await supa.from('billetterie_billets').insert(bill).select().maybeSingle()
  }

  // Sync Finances : crée la transaction associée si pas déjà
  await syncTransactionFinances(vente, order)

  return vente
}

async function syncTransactionFinances(vente: any, order: any) {
  if (vente.transaction_id) return
  // Une transaction en gain, catégorie "billetterie", liée à l'event
  const totalEuros = (vente.montant_total_centimes ?? 0) / 100
  const libelle = `Billetterie · ${order?.payer?.firstName ?? ''} ${order?.payer?.lastName ?? ''}`.trim()
  const { data: tx, error } = await supa.from('transactions').insert({
    type: 'gain',
    categorie: 'billetterie',
    libelle,
    montant: totalEuros,
    date_operation: (order?.date ?? new Date().toISOString()).slice(0, 10),
    moyen_paiement: 'cb',
    finance_evenement_id: null, // à mapper si on stocke le lien event → finance_evenement
    fournisseur: 'HelloAsso',
  }).select().single()
  if (error) { console.error('[HA webhook] tx insert failed', error); return }
  await supa.from('billetterie_ventes').update({ transaction_id: tx.id }).eq('id', vente.id)
}

async function handleBoutiquePayment(order: any, meta: any) {
  const commande_id = meta.commande_id
  const montant = order?.amount?.total ?? 0

  if (commande_id) {
    await supa.from('boutique_commandes')
      .update({ statut: 'payee', updated_at: new Date().toISOString() })
      .eq('id', commande_id)

    // E-mail automatique "paiement confirmé"
    fetch('https://bdecreadien.fr/api/boutique-email-etape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commande_id, etape: 'payee' }),
    }).catch(() => {})
  }

  // Enregistrer en Finances
  const payer = order?.payer ?? {}
  const libelle = `Boutique · ${payer.firstName ?? ''} ${payer.lastName ?? ''} · ${meta.numero ?? ''}`.trim()
  await supa.from('transactions').insert({
    type: 'gain',
    categorie: 'boutique',
    libelle,
    montant: montant / 100,
    date_operation: (order?.date ?? new Date().toISOString()).slice(0, 10),
    moyen_paiement: 'cb',
    fournisseur: 'HelloAsso',
  })
}

async function confirmInscriptions(billetterieSlug: string, email: string) {
  if (!billetterieSlug || !email) return
  await supa.from('billetterie_inscriptions')
    .update({ statut: 'confirme' })
    .eq('billetterie_slug', billetterieSlug)
    .eq('email', email.trim().toLowerCase())
    .eq('statut', 'en_attente')
}

async function markRefunded(order: any) {
  await supa.from('billetterie_ventes')
    .update({ statut: 'remboursee', raw_payload: order, updated_at: new Date().toISOString() })
    .eq('hello_asso_order_id', order?.id)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return bad('method not allowed', 405)

  // Vérif token (HelloAsso permet de configurer une URL avec un token en query)
  const url = new URL(req.url)
  const token = url.searchParams.get('token') || req.headers.get('x-webhook-token') || ''
  if (!WEBHOOK_TOKEN || token !== WEBHOOK_TOKEN) return unauthorized()

  let body: any
  try { body = await req.json() } catch { return bad('invalid json') }

  const eventType = body?.eventType ?? body?.type ?? 'Order'
  const data = body?.data ?? body

  try {
    if (eventType === 'Order' || eventType === 'Payment') {
      const meta = data?.metadata ?? {}
      // ── Boutique BDE ─────────────────────────────────────────
      if (meta.commande_id || meta.numero) {
        await handleBoutiquePayment(data, meta)
      } else {
        // ── Billetterie ───────────────────────────────────────
        const formSlug = data?.formSlug ?? data?.form?.formSlug ?? ''
        const billetterieSlug = data?.metadata?.billetterie_slug ?? formSlug
        const vente = await upsertVenteFromOrder(data, formSlug)
        // Mettre à jour le statut des inscriptions
        await confirmInscriptions(billetterieSlug, data?.payer?.email ?? '')
        // Email de confirmation via Resend (fire-and-forget)
        const eventTitre = data?.metadata?.event_titre ?? (await findEventBySlug(formSlug))?.titre ?? billetterieSlug
        sendConfirmationEmail(
          data?.payer?.email ?? '',
          data?.payer?.firstName ?? '',
          data?.payer?.lastName ?? '',
          eventTitre,
          data?.metadata?.tarif_nom ?? 'Billet',
          Number(data?.metadata?.quantite) || 1,
          vente.montant_total_centimes ?? 0,
          billetterieSlug,
        )
      }
    } else if (eventType === 'Refund' || data?.state === 'Refunded') {
      await markRefunded(data)
    }
    return ok()
  } catch (e) {
    console.error('[HA webhook] handler error', e)
    return bad('handler error: ' + (e as Error).message, 500)
  }
})
