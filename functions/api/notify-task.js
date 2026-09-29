const ONESIGNAL_APP_ID = '8c4f2a28-64eb-4417-85c9-20bda4365e45';

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!env.ONESIGNAL_REST_API_KEY) return json({ error: 'ONESIGNAL_REST_API_KEY manquant' }, 500);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Supabase env manquant' }, 500);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }

  const { titre, type, jour, memberIds } = body;
  if (!titre || !Array.isArray(memberIds) || !memberIds.length) return json({ error: 'Paramètres manquants' }, 400);

  // Récupère les onesignal_id des membres assignés
  const sbRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/profils?select=onesignal_id&id=in.(${memberIds.map(id => `"${id}"`).join(',')})`,
    { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } }
  );
  const profils = await sbRes.json();
  const playerIds = (profils || []).map(p => p.onesignal_id).filter(Boolean);

  if (!playerIds.length) return json({ ok: true, sent: 0, reason: 'Aucun abonné parmi les assignés' });

  const jourLabel = jour ? ` — ${new Date(jour).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}` : '';
  const heading = type === 'add' ? 'Nouvelle tâche' : 'Tâche modifiée';
  const content = titre + jourLabel;

  const osRes = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${env.ONESIGNAL_REST_API_KEY}` },
    body: JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      include_player_ids: playerIds,
      headings: { fr: heading, en: heading },
      contents: { fr: content, en: content },
    })
  });
  const osData = await osRes.json();
  return json({ ok: true, sent: playerIds.length, onesignal: osData });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
