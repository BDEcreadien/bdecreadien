const RESEND_FROM = 'BDE CREAD Lyon <noreply@bdecreadien.fr>';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!env.RESEND_API_KEY || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: true });

  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }

  const { vente_id, billetterie_slug } = body;
  if (!vente_id) return json({ error: 'vente_id manquant' }, 400);

  const SB  = env.SUPABASE_URL;
  const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  const h   = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

  const [vente] = await fetch(`${SB}/rest/v1/billetterie_ventes?id=eq.${vente_id}&select=*`, { headers: h }).then(r => r.json());
  if (!vente) return json({ error: 'Vente introuvable' }, 404);

  const email = vente.acheteur_email;
  if (!email) return json({ ok: true });

  // Config billetterie (titre + whatsapp_url + description + date + lieu)
  let titre = 'Évènement BDE';
  let whatsappUrl = null;
  let description = null, dateAffiche = null, lieuAffiche = null;
  if (billetterie_slug) {
    const [cfg] = await fetch(`${SB}/rest/v1/billetteries?slug=eq.${encodeURIComponent(billetterie_slug)}&select=titre,whatsapp_url,description,date_affiche,lieu_affiche`, { headers: h }).then(r => r.json());
    if (cfg) { titre = cfg.titre || titre; whatsappUrl = cfg.whatsapp_url || null; description = cfg.description || null; dateAffiche = cfg.date_affiche || null; lieuAffiche = cfg.lieu_affiche || null; }
  }

  // Chercher l'inscription pour le QR code
  let inscriptionId = null;
  if (billetterie_slug) {
    const inscArr = await fetch(`${SB}/rest/v1/billetterie_inscriptions?email=eq.${encodeURIComponent(email)}&billetterie_slug=eq.${encodeURIComponent(billetterie_slug)}&select=id&order=created_at.desc&limit=1`, { headers: h }).then(r => r.json()).catch(() => []);
    inscriptionId = inscArr?.[0]?.id || null;
  }

  const prenom    = vente.acheteur_prenom || '';
  const nom       = vente.acheteur_nom || '';
  const montant   = formatEur(vente.montant_total_centimes);
  const meta      = vente.raw_payload?.metadata || {};
  const tarifNom  = meta.tarif_nom || null;
  const quantite  = Number(meta.quantite) || 1;

  const whatsappBlock = whatsappUrl ? `
    <div style="margin:24px 0;text-align:center;">
      <a href="${whatsappUrl}" style="display:inline-block;padding:14px 28px;background:#25D366;color:white;border-radius:12px;font-size:14px;font-weight:700;text-decoration:none;font-family:Arial,sans-serif;">Rejoindre le groupe WhatsApp</a>
    </div>` : '';

  const qrUrl = inscriptionId
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(inscriptionId)}&margin=12`
    : null;

  const eventInfoBlock = (dateAffiche || lieuAffiche) ? `
    <div style="background:#f9f5ff;border-radius:12px;padding:14px 18px;margin-bottom:20px;display:flex;gap:0;flex-wrap:wrap;">
      ${dateAffiche ? `<div style="flex:1;min-width:130px;padding-right:18px;${lieuAffiche ? 'border-right:2px solid #e9d5ff;margin-right:18px;' : ''}"><span style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Date</span><span style="font-size:14px;font-weight:700;color:#460186">${dateAffiche}</span></div>` : ''}
      ${lieuAffiche ? `<div style="flex:1;min-width:130px;"><span style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Lieu</span><span style="font-size:14px;font-weight:700;color:#460186">${lieuAffiche}</span></div>` : ''}
    </div>
    <div style="background:#f9f5ff;border-radius:12px;padding:14px 18px;margin-bottom:20px;display:flex;gap:0;flex-wrap:wrap;">
      ${tarifNom ? `<div style="flex:1;min-width:130px;padding-right:18px;border-right:2px solid #e9d5ff;margin-right:18px;"><span style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Tarif</span><span style="font-size:14px;font-weight:700;color:#460186">${tarifNom}${quantite > 1 ? ` × ${quantite}` : ''}</span></div>` : ''}
      <div style="flex:1;min-width:130px;"><span style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Montant payé</span><span style="font-size:14px;font-weight:700;color:#460186">${montant}</span></div>
    </div>` : `
    <div style="background:#f9f5ff;border-radius:12px;padding:14px 18px;margin-bottom:20px;display:flex;gap:0;flex-wrap:wrap;">
      ${tarifNom ? `<div style="flex:1;min-width:130px;padding-right:18px;border-right:2px solid #e9d5ff;margin-right:18px;"><span style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Tarif</span><span style="font-size:14px;font-weight:700;color:#460186">${tarifNom}${quantite > 1 ? ` × ${quantite}` : ''}</span></div>` : ''}
      <div style="flex:1;min-width:130px;"><span style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px">Montant payé</span><span style="font-size:22px;font-weight:800;color:#460186">${montant}</span></div>
    </div>`;

  const qrBlock = qrUrl ? `
    <div style="background:#faf5ff;border:1.5px solid #ede5ff;border-radius:16px;padding:24px;margin-top:24px;text-align:center;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1.5px">Ton billet numérique</p>
      <p style="margin:0 0 16px;font-size:13px;color:#666">Présente ce QR code à l'entrée le jour de l'événement</p>
      <img src="${qrUrl}" width="180" height="180" alt="QR code billet" style="display:block;margin:0 auto;border-radius:8px;">
    </div>` : '';

  const html = `<!DOCTYPE html><html><head><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0;padding:16px;background:#f5f0ff;font-family:Arial,Helvetica,sans-serif;color-scheme:light">
<div style="max-width:560px;margin:0 auto;border:1px solid #ebe6f5;border-radius:20px;overflow:hidden;color:#1a0030;background:white;box-shadow:0 4px 24px rgba(70,1,134,.08)">
  <div style="background:linear-gradient(135deg,#460186 0%,#D2396D 50%,#FF741F 100%);padding:20px 28px;text-align:center">
    <p style="margin:0 0 4px;color:rgba(255,255,255,.65);font-size:9px;letter-spacing:5px;text-transform:uppercase">BDE CREAD LYON</p>
    <p style="margin:0;color:white;font-size:30px;font-weight:900;letter-spacing:1px;font-family:Impact,'Arial Narrow',Arial,sans-serif">${titre.toUpperCase()}</p>
  </div>
  <div style="padding:28px 32px">
    <p style="margin:0 0 6px;font-size:17px;font-weight:800;color:#1a0030">Hello ${prenom} !</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#444">
      Merci pour ton inscription à <strong>${titre}</strong> —
      on a hâte que l'événement arrive, ce sera une première à ne pas manquer !
    </p>
    ${eventInfoBlock}
    ${description ? `<p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#555;border-left:3px solid #c4b0f0;padding-left:14px;">${description}</p>` : ''}
    ${whatsappBlock}
    ${qrBlock}
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
      subject: `Ton inscription à ${titre} est confirmée !`,
      html,
    }),
  }).catch(() => {});

  return json({ ok: true });
}

function formatEur(centimes) {
  return (centimes / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
