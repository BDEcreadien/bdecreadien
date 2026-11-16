// POST { slug, email?, profil_id? }
// Confirme l'inscription en_attente après retour HelloAsso
// Utilise le service role pour bypasser les RLS

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

  const { slug, email, profil_id } = body;
  if (!slug || (!email && !profil_id)) return json({ error: 'Paramètres manquants' }, 400);

  const SB  = env.SUPABASE_URL;
  const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  const h   = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

  // Chercher l'inscription en_attente la plus récente
  let url = `${SB}/rest/v1/billetterie_inscriptions?billetterie_slug=eq.${encodeURIComponent(slug)}&statut=eq.en_attente&select=id,profil_id,billetterie_id&order=created_at.desc&limit=1`;
  if (profil_id) url += `&profil_id=eq.${encodeURIComponent(profil_id)}`;
  else url += `&email=eq.${encodeURIComponent(email)}`;

  const rows = await fetch(url, { headers: h }).then(r => r.json()).catch(() => []);
  const row = rows?.[0];
  if (!row) return json({ ok: true, found: false });

  // Mettre à jour le statut
  const updateData = { statut: 'payee' };
  if (profil_id && !row.profil_id) updateData.profil_id = profil_id;

  await fetch(
    `${SB}/rest/v1/billetterie_inscriptions?id=eq.${row.id}`,
    { method: 'PATCH', headers: h, body: JSON.stringify(updateData) }
  );

  // Vérifier remise boutique
  let remise = null;
  if (row.billetterie_id) {
    const bil = await fetch(
      `${SB}/rest/v1/billetteries?id=eq.${row.billetterie_id}&select=remise_boutique_centimes`,
      { headers: h }
    ).then(r => r.json()).catch(() => []);
    remise = bil?.[0]?.remise_boutique_centimes || null;
  }

  return json({ ok: true, found: true, inscription_id: row.id, remise_boutique_centimes: remise });
}
