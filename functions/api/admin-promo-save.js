function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Env manquant' }, 500);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }

  const { action, slug, promos } = body;
  if (!slug || !promos) return json({ error: 'Paramètres manquants' }, 400);

  const SB  = env.SUPABASE_URL;
  const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  const h   = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' };

  for (const p of promos) {
    if (!p.code) continue;
    const valeurDb = p.type === 'fixed' ? Math.round(p.valeur * 100) : Math.round(p.valeur);

    if (p._deleted && p.id) {
      await fetch(`${SB}/rest/v1/billetterie_codes_promo?id=eq.${p.id}`, { method: 'DELETE', headers: h }).catch(() => {});
    } else if (p._new) {
      await fetch(`${SB}/rest/v1/billetterie_codes_promo`, {
        method: 'POST', headers: h,
        body: JSON.stringify({ code: p.code.toUpperCase(), billetterie_slug: slug, type: p.type, valeur: valeurDb, max_utilisations: p.max_utilisations || null, actif: true }),
      }).catch(() => {});
    } else if (p.id) {
      await fetch(`${SB}/rest/v1/billetterie_codes_promo?id=eq.${p.id}`, {
        method: 'PATCH', headers: h,
        body: JSON.stringify({ code: p.code.toUpperCase(), type: p.type, valeur: valeurDb, max_utilisations: p.max_utilisations || null }),
      }).catch(() => {});
    }
  }

  return json({ ok: true });
}
