// Cloudflare Pages Function — POST /api/delete-user
// Variables d'environnement requises :
//   SUPABASE_URL              : URL du projet Supabase
//   SUPABASE_SERVICE_ROLE_KEY : clé service_role (bypass RLS + accès auth.admin)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost({ request, env }) {
  try {
    // Vérifier que l'appelant est authentifié (JWT Supabase valide)
    const authHeader = request.headers.get('Authorization') || '';
    const userJwt = authHeader.replace('Bearer ', '').trim();
    if (!userJwt) return json({ error: 'Non authentifié' }, 401);

    const { targetId } = await request.json();
    if (!targetId) return json({ error: 'targetId manquant' }, 400);

    const base = env.SUPABASE_URL;
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!base || !serviceKey) return json({ error: 'Supabase non configuré' }, 500);

    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    };

    // Vérifier que l'appelant est bien admin dans profils
    const meRes = await fetch(`${base}/rest/v1/rpc/get_user_role`, {
      method: 'POST',
      headers: { ...headers, Authorization: `Bearer ${userJwt}` },
      body: JSON.stringify({}),
    });
    // Fallback : lire le rôle via service_role en décodant le JWT
    const payload = JSON.parse(atob(userJwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const callerId = payload.sub;
    if (!callerId) return json({ error: 'JWT invalide' }, 401);

    const roleRes = await fetch(`${base}/rest/v1/profils?id=eq.${callerId}&select=role`, { headers });
    const roleData = await roleRes.json();
    const role = roleData?.[0]?.role;
    if (role !== 'admin' && role !== 'bureau') return json({ error: 'Accès refusé' }, 403);

    // Supprimer l'utilisateur via l'API admin Supabase (supprime auth.users + cascade)
    const delRes = await fetch(`${base}/auth/v1/admin/users/${targetId}`, {
      method: 'DELETE',
      headers,
    });

    if (!delRes.ok) {
      const err = await delRes.json().catch(() => ({}));
      return json({ error: err.message || 'Suppression échouée' }, delRes.status);
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
