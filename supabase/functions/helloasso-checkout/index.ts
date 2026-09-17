// Edge Function : helloasso-checkout
// ============================================================================
// Crée un "Checkout Intent" chez HelloAsso pour un panier billetterie.
// Le site appelle cette fonction avec les infos de la commande, on renvoie
// l'URL vers laquelle rediriger l'acheteur pour finaliser le paiement CB.
//
// Secrets Supabase requis :
//   HELLOASSO_CLIENT_ID
//   HELLOASSO_CLIENT_SECRET
//   HELLOASSO_ORG_SLUG (optionnel, défaut = bde-creadien)

const HA_BASE = 'https://api.helloasso.com'
const HA_ORG_SLUG = Deno.env.get('HELLOASSO_ORG_SLUG') || 'bde-creadien'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

let _cachedToken: { access_token: string, expires_at: number } | null = null

async function getAccessToken(): Promise<string> {
  const now = Date.now()
  if (_cachedToken && _cachedToken.expires_at > now + 60_000) return _cachedToken.access_token
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: Deno.env.get('HELLOASSO_CLIENT_ID') || '',
    client_secret: Deno.env.get('HELLOASSO_CLIENT_SECRET') || '',
  })
  const res = await fetch(`${HA_BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error(`HelloAsso OAuth failed: ${res.status} ${await res.text()}`)
  const data = await res.json()
  _cachedToken = { access_token: data.access_token, expires_at: now + (data.expires_in * 1000) }
  return data.access_token
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  let body: any
  try { body = await req.json() } catch { return json({ error: 'invalid json' }, 400) }

  const {
    totalAmountCents,
    itemName,
    backUrl,
    errorUrl,
    returnUrl,
    payer,
    metadata,
  } = body

  if (!totalAmountCents || totalAmountCents < 100) {
    return json({ error: 'totalAmountCents doit être ≥ 100 (1€ mini)' }, 400)
  }
  if (!itemName || !backUrl || !errorUrl || !returnUrl) {
    return json({ error: 'itemName, backUrl, errorUrl, returnUrl requis' }, 400)
  }
  if (!payer?.email || !payer?.firstName || !payer?.lastName) {
    return json({ error: 'payer.firstName / lastName / email requis' }, 400)
  }

  try {
    const token = await getAccessToken()
    const payload = {
      totalAmount: totalAmountCents,
      initialAmount: totalAmountCents,
      itemName,
      backUrl,
      errorUrl,
      returnUrl,
      containsDonation: false,
      payer: {
        firstName: payer.firstName,
        lastName: payer.lastName,
        email: payer.email,
        ...(payer.dateOfBirth ? { dateOfBirth: payer.dateOfBirth } : {}),
        ...(payer.address ? { address: payer.address } : {}),
        ...(payer.city ? { city: payer.city } : {}),
        ...(payer.zipCode ? { zipCode: payer.zipCode } : {}),
        ...(payer.country ? { country: payer.country } : { country: 'FRA' }),
      },
      metadata: metadata || {},
    }

    const res = await fetch(`${HA_BASE}/v5/organizations/${HA_ORG_SLUG}/checkout-intents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const errText = await res.text()
      console.error('[HA checkout] API error', res.status, errText)
      return json({ error: `HelloAsso API error: ${res.status}`, details: errText }, 500)
    }
    const intent = await res.json()
    return json({ id: intent.id, redirectUrl: intent.redirectUrl, code: intent.code })
  } catch (e) {
    console.error('[HA checkout] exception', e)
    return json({ error: (e as Error).message }, 500)
  }
})
