// Envoie (ou renvoie) l'email "paiement reçu" avec QR code de retrait pour une commande payée,
// et mémorise l'envoi dans boutique_commandes.email_confirmation_sent_at

const RESEND_FROM = 'BDE CREAD Lyon <noreply@bdecreadien.fr>';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}

function eur(c) {
  return (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!env.RESEND_API_KEY || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Env manquant' }, 500);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }
  const { commande_id } = body;
  if (!commande_id) return json({ error: 'commande_id manquant' }, 400);

  const SB = env.SUPABASE_URL;
  const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

  const [cmd] = await fetch(`${SB}/rest/v1/boutique_commandes?id=eq.${commande_id}&select=id,numero,statut,nom_acheteur,email_acheteur,total_centimes`, { headers: h }).then(r => r.json()).catch(() => []);
  if (!cmd) return json({ error: 'Commande introuvable' }, 404);
  if (!cmd.email_acheteur) return json({ error: 'Pas d\'email' }, 400);
  if (['panier', 'en_attente', 'annulee'].includes(cmd.statut)) return json({ error: 'Commande non payée' }, 409);

  const items = await fetch(`${SB}/rest/v1/boutique_items?commande_id=eq.${commande_id}&select=produit_nom,design_nom,couleur,taille,quantite,prix_unitaire_centimes,est_offert`, { headers: h }).then(r => r.json()).catch(() => []);

  const calc = (items || []).filter(i => !i.est_offert || i.prix_unitaire_centimes < 0).reduce((s, i) => s + i.prix_unitaire_centimes * i.quantite, 0);
  const total = calc > 0 ? calc : (cmd.total_centimes || 0);

  const lignes = (items || []).filter(i => !(i.est_offert && i.prix_unitaire_centimes < 0)).map(i => {
    const detail = [i.design_nom, i.couleur, i.taille].filter(Boolean).join(' · ');
    const prix = i.est_offert ? 'OFFERT' : eur(i.prix_unitaire_centimes * i.quantite);
    return `<tr><td style="padding:8px 0;border-bottom:1px solid #f0e8ff">${esc(i.produit_nom)}${detail ? ` <span style="color:#999;font-size:12px">(${esc(detail)})</span>` : ''} ×${i.quantite}</td><td style="padding:8px 0;border-bottom:1px solid #f0e8ff;text-align:right;font-weight:700;color:#460186">${prix}</td></tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0;padding:16px;background:white;font-family:sans-serif;color-scheme:light">
<div style="max-width:560px;margin:0 auto;border:1px solid #ebe6f5;border-radius:16px;overflow:hidden;color:#1a0030">
  <div style="background:linear-gradient(135deg,#460186 0%,#D2396D 50%,#FF741F 100%);padding:14px 24px;text-align:center">
    <p style="margin:0 0 2px;color:rgba(255,255,255,.6);font-size:9px;letter-spacing:4px;text-transform:uppercase">BDE CREAD LYON</p>
    <p style="margin:0;color:white;font-size:36px;font-weight:900;letter-spacing:2px;font-family:Impact,'Arial Narrow',Arial,sans-serif">BOUTIQUE MERCH</p>
  </div>
  <div style="background:white;padding:24px">
    <p style="margin:0 0 8px">Hello <strong>${esc(cmd.nom_acheteur || '')}</strong>,</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6">Ton paiement pour la commande <strong style="color:#460186">${esc(cmd.numero)}</strong> a bien été reçu (${eur(total)}). ✓</p>
    ${lignes ? `<table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:14px">${lignes}<tr><td style="padding:10px 0 0;font-weight:700">Total</td><td style="padding:10px 0 0;text-align:right;font-weight:700;color:#460186">${eur(total)}</td></tr></table>` : ''}
    <p style="margin:0 0 20px;font-size:14px;color:#666;line-height:1.6">Ta commande est maintenant en cours de préparation. Tu recevras un email dès qu'elle sera prête à être récupérée.</p>
    <div style="text-align:center;margin:20px 0;padding:16px;border:1px solid #f0e8ff;border-radius:12px">
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#460186">Ton QR code de retrait</p>
      <img src="https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(cmd.numero)}&size=180x180&margin=8&color=460186" alt="${esc(cmd.numero)}" style="width:180px;height:180px">
      <p style="margin:8px 0 0;font-size:14px;font-weight:700;color:#460186;letter-spacing:2px">${esc(cmd.numero)}</p>
    </div>
    <p style="margin:16px 0 0;font-size:12px;color:#bbb;border-top:1px solid #f0e8ff;padding-top:14px">
      Conserve cet e-mail pour le retrait. Une question ? <a href="mailto:bdecreadien@gmail.com" style="color:#D2396D;text-decoration:none">bdecreadien@gmail.com</a>
      &nbsp;·&nbsp; <a href="https://bdecreadien.fr" style="color:#D2396D;text-decoration:none">bdecreadien.fr</a>
    </p>
  </div>
</div>
</body></html>`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RESEND_API_KEY}` },
    body: JSON.stringify({ from: RESEND_FROM, to: [cmd.email_acheteur], subject: `Paiement confirmé — Commande ${cmd.numero}`, html }),
  });
  if (!r.ok) return json({ error: await r.text().catch(() => 'Resend') }, 502);

  await fetch(`${SB}/rest/v1/boutique_commandes?id=eq.${commande_id}`, {
    method: 'PATCH',
    headers: h,
    body: JSON.stringify({ email_confirmation_sent_at: new Date().toISOString() }),
  }).catch(() => {});

  return json({ ok: true });
}
