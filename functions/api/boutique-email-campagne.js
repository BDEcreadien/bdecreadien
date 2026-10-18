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
    const html = `<!DOCTYPE html><html><head><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0;padding:16px;background:white;font-family:sans-serif;color-scheme:light">
<div style="max-width:560px;margin:0 auto;border:1px solid #ebe6f5;border-radius:16px;overflow:hidden">
  <div style="background:linear-gradient(145deg,#1a0045,#6b0070,#c8006e,#ff5500,#ff8c00);padding:28px 28px 24px">
    <p style="margin:0 0 2px;color:rgba(255,255,255,.6);font-size:10px;letter-spacing:4px;text-transform:uppercase">BDE CREAD LYON</p>
    <p style="margin:0;color:white;font-size:28px;font-weight:800;letter-spacing:-1px">Boutique Merch</p>
  </div>
  <div style="background:white;padding:28px;color:#1a0030;font-size:15px;line-height:1.7">
    ${renderHtml(templateBody, c)}
    <p style="margin:24px 0 0;font-size:11px;color:#bbb;border-top:1px solid #f0e8ff;padding-top:16px">BDE CREAD Lyon — bdecreadien.fr</p>
  </div>
</div>
</body></html>`;

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
