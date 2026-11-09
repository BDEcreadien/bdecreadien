// Cloudflare Pages Function — inscription gratuite (tarif 0€)
// Crée la ligne billetterie_inscriptions et envoie l'email de confirmation
// sans passer par HelloAsso.

const RESEND_FROM = 'BDE CREAD Lyon <noreply@bdecreadien.fr>';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Env manquant' }, 500);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }

  const { slug, billetterie_id, prenom, nom, email, tel, classe, suggestions,
          custom_answers, tarif_id, tarif_nom, quantite, profil_id, event_titre } = body;

  if (!slug || !prenom || !nom || !email) return json({ error: 'Champs obligatoires manquants' }, 400);

  const SB  = env.SUPABASE_URL;
  const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  const h   = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };

  // Récupérer config billetterie pour le titre et whatsapp_url
  let titre = event_titre || slug;
  let whatsappUrl = null;
  const cfgRes = await fetch(`${SB}/rest/v1/billetteries?slug=eq.${encodeURIComponent(slug)}&select=titre,whatsapp_url`, { headers: h });
  const cfgArr = await cfgRes.json();
  if (cfgArr?.[0]) { titre = cfgArr[0].titre || titre; whatsappUrl = cfgArr[0].whatsapp_url || null; }

  // Insérer l'inscription avec statut confirmee
  const inscRes = await fetch(`${SB}/rest/v1/billetterie_inscriptions`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({
      billetterie_id:   billetterie_id || null,
      billetterie_slug: slug,
      prenom, nom, email,
      tel:          tel || null,
      classe:       classe || null,
      suggestions:  suggestions || null,
      tarif_id:     tarif_id || null,
      tarif_nom:    tarif_nom || null,
      quantite:     quantite || 1,
      statut:       'confirmee',
      custom_answers: custom_answers && Object.keys(custom_answers).length ? custom_answers : null,
      profil_id:    profil_id || null,
    }),
  });
  if (!inscRes.ok) {
    const err = await inscRes.json().catch(() => ({}));
    return json({ error: err.message || 'Erreur insertion' }, 500);
  }

  // Envoyer email de confirmation
  if (env.RESEND_API_KEY) {
    const whatsappBlock = whatsappUrl ? `
    <div style="margin:24px 0;text-align:center;">
      <p style="margin:0 0 12px;font-size:14px;color:#444;line-height:1.5">
        Pour rejoindre le groupe et rester informé(e) des activités :
      </p>
      <a href="${whatsappUrl}" style="display:inline-block;padding:14px 32px;background:#25D366;color:white;border-radius:12px;font-size:15px;font-weight:700;text-decoration:none;font-family:Arial,sans-serif;">Rejoindre le groupe WhatsApp</a>
    </div>` : '';

    const tarifBlock = tarif_nom ? `
      <p style="margin:0 0 4px;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.5px">Tarif</p>
      <p style="margin:0 0 14px;font-size:15px;font-weight:700;color:#460186">${esc(tarif_nom)}${quantite > 1 ? ` × ${quantite}` : ''}</p>` : '';

    const html = `<!DOCTYPE html><html><head><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0;padding:16px;background:white;font-family:sans-serif;color-scheme:light">
<div style="max-width:560px;margin:0 auto;border:1px solid #ebe6f5;border-radius:16px;overflow:hidden;color:#1a0030">
  <div style="background:linear-gradient(135deg,#460186 0%,#D2396D 50%,#FF741F 100%);padding:14px 24px;text-align:center">
    <p style="margin:0 0 2px;color:rgba(255,255,255,.6);font-size:9px;letter-spacing:4px;text-transform:uppercase">BDE CREAD LYON</p>
    <p style="margin:0;color:white;font-size:32px;font-weight:900;letter-spacing:2px;font-family:Impact,'Arial Narrow',Arial,sans-serif">${esc(titre).toUpperCase()}</p>
  </div>
  <div style="background:white;padding:24px 28px">
    <p style="margin:0 0 8px;font-size:15px">Bonjour <strong>${esc(prenom)} ${esc(nom)}</strong>,</p>
    <p style="margin:0 0 20px;font-size:17px;font-weight:700;color:#16a34a">Ton inscription est confirmée !</p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#444">
      Tu es bien inscrit(e) à <strong>${esc(titre)}</strong>. Bienvenue !
    </p>
    <div style="background:#f9f5ff;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
      ${tarifBlock}
      <p style="margin:0 0 4px;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.5px">Montant</p>
      <p style="margin:0;font-size:26px;font-weight:800;color:#16a34a">Gratuit</p>
    </div>
    ${whatsappBlock}
    <p style="margin:20px 0 0;font-size:12px;color:#bbb;border-top:1px solid #f0e8ff;padding-top:14px">
      Une question ? <a href="mailto:bdecreadien@gmail.com" style="color:#D2396D;text-decoration:none">bdecreadien@gmail.com</a>
      &nbsp;·&nbsp;
      <a href="https://bdecreadien.fr" style="color:#D2396D;text-decoration:none">bdecreadien.fr</a>
    </p>
  </div>
</div>
</body></html>`;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from:    RESEND_FROM,
        to:      [email],
        subject: `Ton inscription à ${titre} est confirmée !`,
        html,
      }),
    }).catch(() => {});
  }

  return json({ ok: true });
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}
