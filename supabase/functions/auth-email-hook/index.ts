// Auth Hook — Send Email
// Intercepte tous les emails d'auth Supabase (inscription, reset, magic link)
// et les envoie via Resend pour contourner la limite du plan gratuit.
//
// Secrets requis : RESEND_API_KEY

const FROM = 'BDE CREAD Lyon <noreply@bdecreadien.fr>'
const SITE = 'https://bdecreadien.fr'

Deno.serve(async (req) => {
  // Supabase envoie un POST avec le payload du hook
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 })
  }

  let payload: any
  try {
    payload = await req.json()
  } catch {
    return new Response('invalid json', { status: 400 })
  }

  const user       = payload?.user ?? {}
  const emailData  = payload?.email_data ?? {}
  const actionType = emailData?.email_action_type ?? ''
  const token      = emailData?.token ?? ''
  const tokenHash  = emailData?.token_hash ?? ''
  const redirectTo = emailData?.redirect_to ?? SITE

  const to = user?.email
  if (!to) return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } })

  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } })

  let subject = ''
  let html    = ''

  // Supabase fournit confirmation_url directement, sinon on construit l'URL verify
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? `https://zgscyfpqwbmwemzqtvpx.supabase.co`
  const confirmUrl = emailData?.confirmation_url
    ?? `${supabaseUrl}/auth/v1/verify?token=${tokenHash}&type=${actionType}&redirect_to=${encodeURIComponent(redirectTo)}`

  if (actionType === 'signup' || actionType === 'email_change_new' || actionType === 'email_change_current') {
    subject = 'Confirme ton adresse email — BDE CREAD Lyon'
    html = buildEmail(
      'Confirme ton adresse email',
      `Bienvenue sur l'espace BDE CREAD Lyon ! Clique sur le bouton ci-dessous pour confirmer ton adresse email et activer ton compte.`,
      'Confirmer mon email',
      confirmUrl
    )
  } else if (actionType === 'recovery') {
    subject = 'Réinitialise ton mot de passe — BDE CREAD Lyon'
    html = buildEmail(
      'Réinitialisation du mot de passe',
      `Tu as demandé à réinitialiser ton mot de passe. Clique sur le bouton ci-dessous. Ce lien expire dans 24h.`,
      'Réinitialiser mon mot de passe',
      confirmUrl
    )
  } else if (actionType === 'magic_link') {
    subject = 'Ton lien de connexion — BDE CREAD Lyon'
    html = buildEmail(
      'Connexion sans mot de passe',
      `Clique sur le bouton ci-dessous pour te connecter. Ce lien est valable une seule fois.`,
      'Me connecter',
      confirmUrl
    )
  } else if (actionType === 'invite') {
    subject = 'Tu es invité(e) sur BDE CREAD Lyon'
    html = buildEmail(
      'Invitation BDE CREAD Lyon',
      `Tu as été invité(e) à rejoindre l'espace BDE CREAD Lyon. Clique sur le bouton pour créer ton compte.`,
      'Accepter l\'invitation',
      confirmUrl
    )
  } else {
    // Type inconnu : on laisse Supabase gérer
    return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  })

  if (!resendRes.ok) {
    const errBody = await resendRes.text().catch(() => '(no body)')
    console.error(`[auth-email-hook] Resend error ${resendRes.status} for ${actionType} → ${to}: ${errBody}`)
  } else {
    console.log(`[auth-email-hook] Email sent OK: ${actionType} → ${to}`)
  }

  return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } })
})

function buildEmail(title: string, body: string, btnLabel: string, btnUrl: string): string {
  return `<!DOCTYPE html><html><head><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0;padding:16px;background:white;font-family:sans-serif;color-scheme:light">
<div style="max-width:520px;margin:0 auto;border:1px solid #ebe6f5;border-radius:16px;overflow:hidden;color:#1a0030">
  <div style="background:linear-gradient(135deg,#460186 0%,#D2396D 50%,#FF741F 100%);padding:14px 24px;text-align:center">
    <p style="margin:0 0 2px;color:rgba(255,255,255,.6);font-size:9px;letter-spacing:4px;text-transform:uppercase">BDE CREAD LYON</p>
    <p style="margin:0;color:white;font-size:26px;font-weight:900;letter-spacing:2px;font-family:Impact,'Arial Narrow',Arial,sans-serif">${title.toUpperCase()}</p>
  </div>
  <div style="background:white;padding:28px 28px 24px">
    <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#444">${body}</p>
    <div style="text-align:center;margin-bottom:24px">
      <a href="${btnUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#460186,#D2396D);color:white;border-radius:12px;font-size:15px;font-weight:700;text-decoration:none;font-family:Arial,sans-serif">${btnLabel}</a>
    </div>
    <p style="margin:0;font-size:11px;color:#bbb">Bouton qui ne fonctionne pas ? <a href="${btnUrl}" style="color:#D2396D;text-decoration:underline">Clique ici</a></p>
    <p style="margin:16px 0 0;font-size:12px;color:#bbb;border-top:1px solid #f0e8ff;padding-top:14px">
      <a href="mailto:bdecreadien@gmail.com" style="color:#D2396D;text-decoration:none">bdecreadien@gmail.com</a>
      &nbsp;·&nbsp;
      <a href="${SITE}" style="color:#D2396D;text-decoration:none">bdecreadien.fr</a>
    </p>
  </div>
</div>
</body></html>`
}
