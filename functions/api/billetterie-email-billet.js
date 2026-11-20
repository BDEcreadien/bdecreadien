import { sendEmail } from '../_lib/mail.js'
const FROM = 'BDE CREAD Lyon <noreply@bdecreadien.fr>';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!env.BREVO_API_KEY || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Env manquant' }, 500);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }

  const { inscription_id } = body;
  if (!inscription_id) return json({ error: 'inscription_id manquant' }, 400);

  const SB  = env.SUPABASE_URL;
  const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  const h   = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

  const [insc] = await fetch(`${SB}/rest/v1/billetterie_inscriptions?id=eq.${inscription_id}&select=*`, { headers: h }).then(r => r.json()).catch(() => []);
  if (!insc) return json({ error: 'Inscription introuvable' }, 404);

  const email = insc.email;
  if (!email) return json({ ok: true });

  // Config billetterie
  let titre = 'Évènement BDE', whatsappUrl = null, description = null, dateAffiche = null, lieuAffiche = null;
  if (insc.billetterie_slug) {
    const [cfg] = await fetch(`${SB}/rest/v1/billetteries?slug=eq.${encodeURIComponent(insc.billetterie_slug)}&select=titre,whatsapp_url,description,date_affiche,lieu_affiche`, { headers: h }).then(r => r.json()).catch(() => []);
    if (cfg) { titre = cfg.titre || titre; whatsappUrl = cfg.whatsapp_url || null; description = cfg.description || null; dateAffiche = cfg.date_affiche || null; lieuAffiche = cfg.lieu_affiche || null; }
  }

  const prenom   = insc.prenom || '';
  const tarifNom = insc.tarif_nom || null;
  const quantite = Number(insc.quantite) || 1;
  const qrUrl    = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(inscription_id)}&margin=12`;

  const whatsappBlock = whatsappUrl ? `<div style="margin:24px 0;text-align:center;"><a href="${whatsappUrl}" style="display:inline-block;padding:14px 28px;background:#25D366;color:white;border-radius:12px;font-size:14px;font-weight:700;text-decoration:none;font-family:Arial,sans-serif;">Rejoindre le groupe WhatsApp</a></div>` : '';

  const infoBlock = `
    <div style="background:#f9f5ff;border-radius:12px;padding:14px 18px;margin-bottom:20px;display:flex;gap:0;flex-wrap:wrap;">
      ${dateAffiche ? `<div style="flex:1;min-width:130px;padding-right:18px;border-right:2px solid #e9d5ff;margin-right:18px;"><span style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Date</span><span style="font-size:14px;font-weight:700;color:#460186">${dateAffiche}</span></div>` : ''}
      ${lieuAffiche ? `<div style="flex:1;min-width:130px;"><span style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Lieu</span><span style="font-size:14px;font-weight:700;color:#460186">${lieuAffiche}</span></div>` : ''}
    </div>
    ${tarifNom ? `<div style="background:#f9f5ff;border-radius:12px;padding:14px 18px;margin-bottom:20px;"><span style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Tarif</span><span style="font-size:14px;font-weight:700;color:#460186">${tarifNom}${quantite > 1 ? ` × ${quantite}` : ''}</span></div>` : ''}`;

  const html = `<!DOCTYPE html><html><head><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0;padding:16px;background:#f5f0ff;font-family:Arial,Helvetica,sans-serif;color-scheme:light">
<div style="max-width:560px;margin:0 auto;border:1px solid #ebe6f5;border-radius:20px;overflow:hidden;color:#1a0030;background:white;box-shadow:0 4px 24px rgba(70,1,134,.08)">
  <div style="background:linear-gradient(135deg,#460186 0%,#D2396D 50%,#FF741F 100%);padding:20px 28px;text-align:center">
    <p style="margin:0 0 4px;color:rgba(255,255,255,.65);font-size:9px;letter-spacing:5px;text-transform:uppercase">BDE CREAD LYON</p>
    <p style="margin:0;color:white;font-size:30px;font-weight:900;letter-spacing:1px;font-family:Impact,'Arial Narrow',Arial,sans-serif">${titre.toUpperCase()}</p>
  </div>
  <div style="padding:28px 32px">
    <p style="margin:0 0 6px;font-size:17px;font-weight:800;color:#1a0030">Hello ${prenom} !</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#444">Merci pour ton inscription à <strong>${titre}</strong> — on a hâte que l'événement arrive, c'est à ne pas rater !!</p>
    ${infoBlock}
    <div style="background:#faf5ff;border:1.5px solid #ede5ff;border-radius:16px;padding:24px;margin-top:24px;text-align:center;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1.5px">Ton billet numérique</p>
      <p style="margin:0 0 16px;font-size:13px;color:#666">Présente ce QR code à l'entrée le jour de l'événement</p>
      <img src="${qrUrl}" width="180" height="180" alt="QR code billet" style="display:block;margin:0 auto;border-radius:8px;">
    </div>
    ${description ? `<p style="margin:20px 0;font-size:14px;line-height:1.65;color:#555;border-left:3px solid #c4b0f0;padding-left:14px;">${description}</p>` : ''}
    ${whatsappBlock}
    <p style="margin:28px 0 0;font-size:12px;color:#bbb;border-top:1px solid #f0e8ff;padding-top:16px">
      Une question ? <a href="mailto:bdecreadien@gmail.com" style="color:#D2396D;text-decoration:none">bdecreadien@gmail.com</a>
      &nbsp;·&nbsp;<a href="https://bdecreadien.fr" style="color:#D2396D;text-decoration:none">bdecreadien.fr</a>
    </p>
  </div>
</div>
</body></html>`;

  const r = await sendEmail(env.BREVO_API_KEY, { from: FROM, to: [email], subject: `🎟️ Ton billet pour ${titre} — inscription confirmée !`, html });

  if (!r.ok) {
    const err = await r.text().catch(() => '');
    return json({ error: err }, 500);
  }

  // Marquer l'email comme envoyé pour le cron de rattrapage
  await fetch(`${SB}/rest/v1/billetterie_inscriptions?id=eq.${inscription_id}`, {
    method: 'PATCH',
    headers: h,
    body: JSON.stringify({ billet_email_sent_at: new Date().toISOString() }),
  }).catch(() => {});

  return json({ ok: true });
}
