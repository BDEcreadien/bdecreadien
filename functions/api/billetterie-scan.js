// POST { action, billetterie_id, inscription_id? }
// actions : 'info' | 'lookup' | 'validate'

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Env manquant' }, 500);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }

  const { action, billetterie_id, inscription_id } = body;
  if (!billetterie_id) return json({ error: 'billetterie_id manquant' }, 400);

  const SB  = env.SUPABASE_URL;
  const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  const h   = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

  // ── info : nom de l'event + compteurs ───────────────────────────────────
  if (action === 'info') {
    const [eventRes, totalRes, scannedRes] = await Promise.all([
      fetch(`${SB}/rest/v1/billetteries?id=eq.${encodeURIComponent(billetterie_id)}&select=titre`, { headers: h }).then(r => r.json()),
      fetch(`${SB}/rest/v1/billetterie_inscriptions?billetterie_id=eq.${encodeURIComponent(billetterie_id)}&select=id`, { headers: { ...h, Prefer: 'count=exact' } }),
      fetch(`${SB}/rest/v1/billetterie_inscriptions?billetterie_id=eq.${encodeURIComponent(billetterie_id)}&scanne=eq.true&select=id`, { headers: { ...h, Prefer: 'count=exact' } }),
    ]);
    const titre = eventRes?.[0]?.titre || '—';
    const total   = parseInt(totalRes.headers.get('content-range')?.split('/')[1] ?? '0', 10);
    const scanned = parseInt(scannedRes.headers.get('content-range')?.split('/')[1] ?? '0', 10);
    return json({ ok: true, titre, total, scanned });
  }

  // ── lookup : chercher une inscription par son UUID ───────────────────────
  if (action === 'lookup') {
    if (!inscription_id) return json({ error: 'inscription_id manquant' }, 400);
    const rows = await fetch(
      `${SB}/rest/v1/billetterie_inscriptions?id=eq.${encodeURIComponent(inscription_id)}&billetterie_id=eq.${encodeURIComponent(billetterie_id)}&select=id,prenom,nom,tarif_nom,quantite,scanne,scanne_at`,
      { headers: h }
    ).then(r => r.json());
    if (!rows?.length) return json({ error: 'Inscription introuvable pour cet événement' }, 404);
    return json({ ok: true, inscription: rows[0] });
  }

  // ── validate : marquer comme scanné ────────────────────────────────────
  if (action === 'validate') {
    if (!inscription_id) return json({ error: 'inscription_id manquant' }, 400);
    await fetch(
      `${SB}/rest/v1/billetterie_inscriptions?id=eq.${encodeURIComponent(inscription_id)}&billetterie_id=eq.${encodeURIComponent(billetterie_id)}`,
      { method: 'PATCH', headers: h, body: JSON.stringify({ scanne: true, scanne_at: new Date().toISOString() }) }
    );
    return json({ ok: true });
  }

  return json({ error: 'Action inconnue' }, 400);
}
