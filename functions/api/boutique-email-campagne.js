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
      <div style="max-width:560px;margin:0 auto;font-family:sans-serif;color:#1a0030">
        <div style="background:linear-gradient(135deg,#460186,#D2396D,#FF741F);padding:24px 32px;border-radius:16px 16px 0 0">
          <p style="margin:0;color:rgba(255,255,255,.7);font-size:11px;letter-spacing:3px;text-transform:uppercase">BDE CREAD LYON</p>
          <h1 style="margin:6px 0 0;color:white;font-size:28px;letter-spacing:-.5px">Boutique Goodies</h1>
        </div>
        <div style="background:white;padding:32px;border-radius:0 0 16px 16px;box-shadow:0 4px 24px rgba(70,1,134,.1)">
          ${renderHtml(templateBody, c)}
          <hr style="border:none;border-top:1px solid #f0e8ff;margin:24px 0">
          <p style="font-size:12px;color:#999;margin:0">BDE CREAD Lyon — bdecreadien.fr</p>
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
