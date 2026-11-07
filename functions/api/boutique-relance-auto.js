// Endpoint appelé par un cron externe (cron-job.org) une fois par jour
// Envoie une relance aux commandes en_attente créées entre 48h et 96h
// Protection : header Authorization: Bearer <CRON_SECRET>

const RESEND_FROM = 'BDE CREAD Lyon <noreply@bdecreadien.fr>';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST' && request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  // Vérification clé secrète
  const auth = request.headers.get('Authorization') || '';
  const secret = auth.replace('Bearer ', '').trim();
  if (!env.CRON_SECRET || secret !== env.CRON_SECRET) {
    return json({ error: 'Non autorisé' }, 401);
  }

  if (!env.RESEND_API_KEY || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Env manquant' }, 500);
  }

  const SB  = env.SUPABASE_URL;
  const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

  // Fenêtre : créées entre 48h et 96h (garantit un seul envoi si cron quotidien)
  const now  = new Date();
  const h48  = new Date(now - 48 * 3600 * 1000).toISOString();
  const h96  = new Date(now - 96 * 3600 * 1000).toISOString();

  const url = `${SB}/rest/v1/boutique_commandes?statut=eq.en_attente&created_at=lte.${h48}&created_at=gte.${h96}&email_acheteur=not.is.null&select=id,numero,nom_acheteur,email_acheteur,total_centimes`;

  const cmdsRes = await fetch(url, { headers });
  const commandes = await cmdsRes.json();

  if (!Array.isArray(commandes) || !commandes.length) {
    return json({ ok: true, sent: 0, message: 'Aucune commande en attente dans la fenêtre 48-96h' });
  }

  let sent = 0;
  const errors = [];

  for (const cmd of commandes) {
    if (!cmd.email_acheteur) continue;

    const payUrl = `https://bdecreadien.fr/boutique.html?commande=${encodeURIComponent(cmd.id)}`;
    const total  = formatEur(cmd.total_centimes || 0);

    const html = `<!DOCTYPE html><html><head><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0;padding:16px;background:white;font-family:sans-serif;color-scheme:light">
<div style="max-width:560px;margin:0 auto;border:1px solid #ebe6f5;border-radius:16px;overflow:hidden;color:#1a0030">
  <div style="background:linear-gradient(135deg,#460186 0%,#D2396D 50%,#FF741F 100%);padding:14px 24px;text-align:center">
    <p style="margin:0 0 2px;color:rgba(255,255,255,.6);font-size:9px;letter-spacing:4px;text-transform:uppercase">BDE CREAD LYON</p>
    <p style="margin:0;color:white;font-size:36px;font-weight:900;letter-spacing:2px;font-family:Impact,'Arial Narrow',Arial,sans-serif">BOUTIQUE MERCH</p>
  </div>
  <div style="background:white;padding:24px">
    <p style="margin:0 0 8px">Bonjour <strong>${escHtml(cmd.nom_acheteur || '')}</strong>,</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#444">
      Ta commande <strong style="color:#460186">${escHtml(cmd.numero)}</strong> est toujours en attente de paiement (${total}).
    </p>
    <p style="margin:0 0 20px;font-size:14px;color:#666;line-height:1.6">
      Elle sera automatiquement annulée si le paiement n'est pas effectué prochainement.<br>
      Clique sur le bouton ci-dessous pour finaliser ta commande.
    </p>
    <p style="margin:24px 0;text-align:center">
      <a href="${payUrl}"
        style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#460186,#D2396D);color:white;text-decoration:none;border-radius:12px;font-family:sans-serif;font-weight:700;font-size:16px">
        Finaliser ma commande
      </a>
    </p>
    <p style="margin:16px 0 0;font-size:12px;color:#bbb;border-top:1px solid #f0e8ff;padding-top:14px">
      Une question ? <a href="mailto:bdecreadien@gmail.com" style="color:#D2396D;text-decoration:none">bdecreadien@gmail.com</a>
      &nbsp;·&nbsp; <a href="https://bdecreadien.fr" style="color:#D2396D;text-decoration:none">bdecreadien.fr</a>
    </p>
  </div>
</div>
</body></html>`;

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from:    RESEND_FROM,
        to:      [cmd.email_acheteur],
        subject: `Ta commande ${cmd.numero} est en attente de paiement`,
        html,
      }),
    });

    if (r.ok) sent++;
    else {
      const err = await r.text().catch(() => '');
      errors.push({ commande: cmd.numero, error: err });
    }
  }

  return json({ ok: true, sent, total: commandes.length, errors });
}

function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function formatEur(centimes) {
  return (centimes / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
