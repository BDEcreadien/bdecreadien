// POST { statuts[], sujet, body } + Authorization: Bearer <supabase-access-token>
// Envoie un email personnalisé à toutes les commandes des statuts donnés

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderHtml(templateBody, c) {
  const prenom = (c.nom_acheteur || '').split(' ')[0] || 'toi';
  const nom    = (c.nom_acheteur || '').split(' ').slice(1).join(' ') || '';
  const total  = c.total_centimes
    ? (c.total_centimes / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €'
    : '';
  return templateBody
    .replace(/\{\{prenom\}\}/g, prenom)
    .replace(/\{\{nom\}\}/g,    nom)
    .replace(/\{\{numero\}\}/g, c.numero || '')
    .replace(/\{\{total\}\}/g,  total)
    .replace(/\n/g, '<br>');
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = request.headers.get('Authorization') || '';
  const userToken  = authHeader.replace('Bearer ', '').trim();
  if (!userToken) return json({ error: 'Non authentifié' }, 401);

  const SB  = env.SUPABASE_URL;
  const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

  // Vérifier que le token est valide
  const meRes = await fetch(`${SB}/auth/v1/user`, {
    headers: { apikey: KEY, Authorization: `Bearer ${userToken}` },
  });
  if (!meRes.ok) return json({ error: 'Token invalide' }, 401);
  const me = await meRes.json();
  if (!me?.id) return json({ error: 'Token invalide' }, 401);

  // Vérifier role admin
  const profRes = await fetch(`${SB}/rest/v1/profils?id=eq.${me.id}&select=role,bureau`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json' },
  });
  const profData = await profRes.json();
  const prof = Array.isArray(profData) ? profData[0] : profData;
  if (!prof || (prof.role !== 'admin' && !(prof.role === 'membre' && prof.bureau))) {
    return json({ error: 'Accès réservé aux admins' }, 403);
  }

  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }

  const { statuts, sujet, body: templateBody } = body;
  if (!statuts?.length || !sujet || !templateBody) return json({ error: 'Paramètres manquants' }, 400);

  // Récupérer les commandes
  const statutsParam = statuts.map(s => `"${s}"`).join(',');
  const cmdsRes = await fetch(
    `${SB}/rest/v1/boutique_commandes?statut=in.(${statutsParam})&select=id,numero,nom_acheteur,email_acheteur,total_centimes,statut`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }
  );
  const commandes = await cmdsRes.json();
  if (!commandes?.length) return json({ ok: true, sent: 0, failed: 0, message: 'Aucun destinataire' });

  let sent = 0, failed = 0;
  const errors = [];
  for (const c of commandes) {
    if (!c.email_acheteur) {
      errors.push(`commande ${c.numero || c.id}: email_acheteur manquant`);
      failed++;
      continue;
    }
    const html = `
      <div style="background:#f4f0ff;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <div style="max-width:560px;margin:0 auto;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(70,1,134,.18)">
        <div style="background:linear-gradient(145deg,#1a0045 0%,#6b0070 30%,#c8006e 60%,#ff5500 85%,#ff8c00 100%);padding:36px 36px 32px">
          <p style="margin:0 0 4px;color:rgba(255,255,255,.6);font-size:10px;letter-spacing:4px;text-transform:uppercase;font-weight:600">BDE CREAD LYON</p>
          <h1 style="margin:0;color:white;font-size:32px;font-weight:800;letter-spacing:-1px;line-height:1.1">Boutique Goodies</h1>
        </div>
        <div style="background:white;padding:36px">
          <div style="font-size:15px;line-height:1.7;color:#1a0030">${renderHtml(templateBody, c)}</div>
          <hr style="border:none;border-top:1.5px solid #f0e8ff;margin:28px 0">
          <p style="font-size:12px;color:#bbb;margin:0;text-align:center">BDE CREAD Lyon &mdash; <a href="https://bdecreadien.fr" style="color:#bbb">bdecreadien.fr</a></p>
        </div>
      </div>
      </div>`;

    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RESEND_API_KEY}` },
        body: JSON.stringify({
          from:    'BDE CREAD Lyon <noreply@bdecreadien.fr>',
          to:      [c.email_acheteur],
          subject: sujet,
          html,
        }),
      });
      if (r.ok) {
        sent++;
      } else {
        const errBody = await r.json().catch(() => ({}));
        errors.push(`${c.email_acheteur}: ${errBody.message || errBody.name || r.status}`);
        failed++;
      }
    } catch (e) {
      errors.push(`${c.email_acheteur}: ${e.message}`);
      failed++;
    }
  }

  return json({ ok: true, sent, failed, total: commandes.length, errors });
}
