function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: true });

  let body;
  try { body = await request.json(); } catch { return json({ ok: true }); }

  const { promo_id } = body;
  if (!promo_id) return json({ ok: true });

  const SB  = env.SUPABASE_URL;
  const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  const h   = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

  await fetch(`${SB}/rest/v1/rpc/increment_promo_usage`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({ p_id: promo_id }),
  }).catch(() => {});

  return json({ ok: true });
}
