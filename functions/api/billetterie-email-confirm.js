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

  // Config billetterie (titre + whatsapp_url)
  let titre = 'Évènement BDE';
  let whatsappUrl = null;
  if (billetterie_slug) {
    const [cfg] = await fetch(`${SB}/rest/v1/billetteries?slug=eq.${encodeURIComponent(billetterie_slug)}&select=titre,whatsapp_url`, { headers: h }).then(r => r.json());
    if (cfg) { titre = cfg.titre || titre; whatsappUrl = cfg.whatsapp_url || null; }
  }

  const prenom    = vente.acheteur_prenom || '';
  const nom       = vente.acheteur_nom || '';
  const montant   = formatEur(vente.montant_total_centimes);
  const meta      = vente.raw_payload?.metadata || {};
  const tarifNom  = meta.tarif_nom || null;
  const quantite  = Number(meta.quantite) || 1;

  const whatsappBlock = whatsappUrl ? `
    <div style="margin:24px 0;text-align:center;">
      <p style="margin:0 0 12px;font-size:14px;color:#444;line-height:1.5">
        Pour rejoindre le groupe et rester informé(e) des activités :
      </p>
      <a href="${whatsappUrl}" style="display:inline-block;padding:14px 32px;background:#25D366;color:white;border-radius:12px;font-size:15px;font-weight:700;text-decoration:none;">
        📱 Rejoindre le groupe WhatsApp
      </a>
    </div>` : '';

  const html = `<!DOCTYPE html><html><head><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0;padding:16px;background:white;font-family:sans-serif;color-scheme:light">
<div style="max-width:560px;margin:0 auto;border:1px solid #ebe6f5;border-radius:16px;overflow:hidden;color:#1a0030">
  <div style="background:linear-gradient(135deg,#460186 0%,#D2396D 50%,#FF741F 100%);padding:14px 24px;text-align:center">
    <p style="margin:0 0 2px;color:rgba(255,255,255,.6);font-size:9px;letter-spacing:4px;text-transform:uppercase">BDE CREAD LYON</p>
    <p style="margin:0;color:white;font-size:32px;font-weight:900;letter-spacing:2px;font-family:Impact,'Arial Narrow',Arial,sans-serif">${titre.toUpperCase()}</p>
  </div>
  <div style="background:white;padding:24px 28px">
    <p style="margin:0 0 8px;font-size:15px">Bonjour <strong>${prenom} ${nom}</strong>,</p>
    <p style="margin:0 0 20px;font-size:17px;font-weight:700;color:#16a34a">✅ Ton inscription est confirmée !</p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#444">
      Ton paiement pour <strong>${titre}</strong> a bien été reçu et validé.
      ${tarifNom ? `Tu es inscrit(e) en tant que <strong>${tarifNom}</strong>.` : ''}
      Bienvenue !
    </p>
    <div style="background:#f9f5ff;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
      ${tarifNom ? `<p style="margin:0 0 4px;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.5px">Tarif</p>
      <p style="margin:0 0 14px;font-size:15px;font-weight:700;color:#460186">${tarifNom}${quantite > 1 ? ` × ${quantite}` : ''}</p>` : ''}
      <p style="margin:0 0 4px;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.5px">Montant payé</p>
      <p style="margin:0;font-size:26px;font-weight:800;color:#460186">${montant}</p>
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

  return json({ ok: true });
}

function formatEur(centimes) {
  return (centimes / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
