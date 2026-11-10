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

  const { code, slug } = body;
  if (!code) return json({ valid: false, message: 'Code manquant' });

  const SB  = env.SUPABASE_URL;
  const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  const h   = { apikey: KEY, Authorization: `Bearer ${KEY}` };

  // Chercher le code (insensible à la casse) : d'abord spécifique à l'event, sinon global
  const rows = await fetch(
    `${SB}/rest/v1/billetterie_codes_promo?code=ilike.${encodeURIComponent(code)}&actif=eq.true&select=*`,
    { headers: h }
  ).then(r => r.json()).catch(() => []);

  // Priorité : code lié à cet event > code global (billetterie_slug null)
  const promo = rows.find(r => r.billetterie_slug === slug)
             || rows.find(r => !r.billetterie_slug);

  if (!promo) return json({ valid: false, message: 'Code invalide ou expiré.' });

  if (promo.max_utilisations !== null && promo.nb_utilisations >= promo.max_utilisations) {
    return json({ valid: false, message: 'Ce code a atteint son nombre maximum d\'utilisations.' });
  }

  return json({
    valid: true,
    id:    promo.id,
    type:  promo.type,
    valeur: promo.valeur,
    message: promo.type === 'percent'
      ? `-${promo.valeur}%`
      : `-${(promo.valeur / 100).toFixed(2).replace('.', ',')} €`,
  });
}
