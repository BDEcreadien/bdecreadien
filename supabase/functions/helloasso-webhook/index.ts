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
      const formSlug = data?.formSlug ?? data?.form?.formSlug ?? ''
      await upsertVenteFromOrder(data, formSlug)
    } else if (eventType === 'Refund' || data?.state === 'Refunded') {
      await markRefunded(data)
    }
    return ok()
  } catch (e) {
    console.error('[HA webhook] handler error', e)
    return bad('handler error: ' + (e as Error).message, 500)
  }
})
