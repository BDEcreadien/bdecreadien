import { sendEmail } from '../_lib/mail.js'
// Relance manuelle des commandes en_attente — appelé depuis l'admin BDE
// Authentification : JWT Supabase de l'admin (Bearer token)

const RESEND_FROM = 'BDE CREAD Lyon <noreply@bdecreadien.fr>';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' } });
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.BREVO_API_KEY) {
    return json({ error: 'Env manquant' }, 500);
  }

  // Vérifier que l'appelant est bien un admin connecté
  const authHeader = request.headers.get('Authorization') || '';
  const userJwt = authHeader.replace('Bearer ', '').trim();
  if (!userJwt) return json({ error: 'Non autorisé' }, 401);

  const SB  = env.SUPABASE_URL;
  const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  const h   = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

  // Vérifier le JWT (appel /auth/v1/user avec le token utilisateur)
  const userRes = await fetch(`${SB}/auth/v1/user`, {
    headers: { apikey: KEY, Authorization: `Bearer ${userJwt}` },
  });
  if (!userRes.ok) return json({ error: 'Non autorisé' }, 401);

  // Récupérer TOUTES les commandes en_attente avec un email
  const cmdsRes = await fetch(
    `${SB}/rest/v1/boutique_commandes?statut=eq.en_attente&email_acheteur=not.is.null&select=id,numero,nom_acheteur,email_acheteur,total_centimes`,
    { headers: h }
  );
  const commandes = await cmdsRes.json();

  if (!Array.isArray(commandes) || !commandes.length) {
    return json({ ok: true, sent: 0, total: 0, message: 'Aucune commande en attente' });
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
    <p style="margin:0 0 8px">Hello <strong>${escHtml(cmd.nom_acheteur || '')}</strong>,</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#444">
      Ta commande <strong style="color:#460186">${escHtml(cmd.numero)}</strong> est toujours en attente de paiement — ${total} sont réservés pour toi.
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#666;line-height:1.6">
      Ne laisse pas passer ta commande, elle sera annulée si le paiement n'est pas effectué prochainement.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">
      <tr>
        <td style="padding-right:6px">
          <a href="${payUrl}"
            style="display:block;padding:13px 10px;background:linear-gradient(135deg,#460186,#D2396D,#FF741F);color:white;text-decoration:none;border-radius:12px;font-family:sans-serif;font-weight:700;font-size:15px;text-align:center">
            💳 Payer ma commande
          </a>
        </td>
        <td style="padding-left:6px">
          <a href="${payUrl}"
            style="display:block;padding:13px 10px;background:white;color:#460186;text-decoration:none;border-radius:12px;font-family:sans-serif;font-weight:700;font-size:15px;text-align:center;border:2px solid #d0c4ff">
            🛒 Voir mon panier
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#bbb;border-top:1px solid #f0e8ff;padding-top:14px">
      Une question ? <a href="mailto:bdecreadien@gmail.com" style="color:#D2396D;text-decoration:none">bdecreadien@gmail.com</a>
      &nbsp;·&nbsp; <a href="https://bdecreadien.fr" style="color:#D2396D;text-decoration:none">bdecreadien.fr</a>
    </p>
  </div>
</div>
</body></html>`;

    const r = await sendEmail(KEY, {
        from:    RESEND_FROM,
        to:      [cmd.email_acheteur],
        subject: `Finalise ta commande ${cmd.numero} — BDE CREAD`,
        html,
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
