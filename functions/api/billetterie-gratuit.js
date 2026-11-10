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

  const inscArr = await inscRes.json();
  const inscriptionId = inscArr?.[0]?.id;

  // Envoyer email de confirmation
  if (env.RESEND_API_KEY) {
    // description, date, lieu de l'événement
    let description = null, dateAffiche = null, lieuAffiche = null;
    const cfgFull = await fetch(`${SB}/rest/v1/billetteries?slug=eq.${encodeURIComponent(slug)}&select=description,date_affiche,lieu_affiche`, { headers: h }).then(r => r.json()).catch(() => []);
    if (cfgFull?.[0]) { description = cfgFull[0].description; dateAffiche = cfgFull[0].date_affiche; lieuAffiche = cfgFull[0].lieu_affiche; }

    const qrUrl = inscriptionId
      ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(inscriptionId)}&margin=12`
      : null;

    const whatsappBlock = whatsappUrl ? `
    <div style="margin:24px 0;text-align:center;">
      <a href="${whatsappUrl}" style="display:inline-block;padding:14px 28px;background:#25D366;color:white;border-radius:12px;font-size:14px;font-weight:700;text-decoration:none;font-family:Arial,sans-serif;">Rejoindre le groupe WhatsApp</a>
    </div>` : '';

    const eventInfoBlock = (dateAffiche || lieuAffiche) ? `
      <div style="background:#f9f5ff;border-radius:12px;padding:14px 18px;margin-bottom:20px;display:flex;gap:0;flex-wrap:wrap;">
        ${dateAffiche ? `<div style="flex:1;min-width:130px;padding-right:18px;${lieuAffiche ? 'border-right:2px solid #e9d5ff;margin-right:18px;' : ''}"><span style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Date</span><span style="font-size:14px;font-weight:700;color:#460186">${esc(dateAffiche)}</span></div>` : ''}
        ${lieuAffiche ? `<div style="flex:1;min-width:130px;"><span style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Lieu</span><span style="font-size:14px;font-weight:700;color:#460186">${esc(lieuAffiche)}</span></div>` : ''}
      </div>` : '';

    const qrBlock = qrUrl ? `
      <div style="background:#faf5ff;border:1.5px solid #ede5ff;border-radius:16px;padding:24px;margin-bottom:20px;text-align:center;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1.5px">Ton billet numérique</p>
        <p style="margin:0 0 16px;font-size:13px;color:#666">Présente ce QR code à l'entrée le jour de l'événement</p>
        <img src="${qrUrl}" width="180" height="180" alt="QR code billet" style="display:block;margin:0 auto;border-radius:8px;">
      </div>` : '';

    const html = `<!DOCTYPE html><html><head><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0;padding:16px;background:#f5f0ff;font-family:Arial,Helvetica,sans-serif;color-scheme:light">
<div style="max-width:560px;margin:0 auto;border:1px solid #ebe6f5;border-radius:20px;overflow:hidden;color:#1a0030;background:white;box-shadow:0 4px 24px rgba(70,1,134,.08)">
  <div style="background:linear-gradient(135deg,#460186 0%,#D2396D 50%,#FF741F 100%);padding:20px 28px;text-align:center">
    <p style="margin:0 0 4px;color:rgba(255,255,255,.65);font-size:9px;letter-spacing:5px;text-transform:uppercase">BDE CREAD LYON</p>
    <p style="margin:0;color:white;font-size:30px;font-weight:900;letter-spacing:1px;font-family:Impact,'Arial Narrow',Arial,sans-serif">${esc(titre).toUpperCase()}</p>
  </div>
  <div style="padding:28px 32px">
    <p style="margin:0 0 6px;font-size:17px;font-weight:800;color:#1a0030">Hello ${esc(prenom)} !</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#444">
      Merci pour ton inscription à <strong>${esc(titre)}</strong> —
      on a hâte que l'événement arrive, c'est à ne pas rater !!
    </p>
    ${eventInfoBlock}
    ${qrBlock}
    ${description ? `<p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#555;border-left:3px solid #c4b0f0;padding-left:14px;">${esc(description)}</p>` : ''}
    ${whatsappBlock}
    <p style="margin:28px 0 0;font-size:12px;color:#bbb;border-top:1px solid #f0e8ff;padding-top:16px">
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
        subject: `🎟️ Ton billet pour ${titre} — inscription confirmée !`,
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
