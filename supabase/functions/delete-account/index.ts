import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = ['https://bdecreadien.fr', 'https://www.bdecreadien.fr'];

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const CORS = corsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return new Response(JSON.stringify({ error: 'Origin non autorisé' }), {
      status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) {
    return new Response(JSON.stringify({ error: 'Non authentifié' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const sbAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userErr } = await sbAdmin.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: 'Session invalide' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
  const userId = userData.user.id;

  // Sécurité : empêche un admin de se supprimer lui-même par erreur
  const { data: profil } = await sbAdmin.from('profils').select('role').eq('id', userId).maybeSingle();
  if (profil?.role === 'admin') {
    return new Response(JSON.stringify({ error: 'Un admin ne peut pas se supprimer via cette route. Retire d\'abord ton rôle admin ou demande à un autre admin.' }), {
      status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Purge des fichiers storage de l'utilisateur (avatars + annonces)
  // Les paths ont le pattern USER_ID/... on liste et supprime
  try {
    for (const bucket of ['avatars', 'annonces']) {
      const { data: files } = await sbAdmin.storage.from(bucket).list(userId, { limit: 1000 });
      if (files && files.length) {
        const paths = files.map((f: { name: string }) => `${userId}/${f.name}`);
        await sbAdmin.storage.from(bucket).remove(paths);
      }
    }
  } catch (_) { /* best-effort */ }

  // Suppression du profil (cascade sur cartes_fidelite, annonces, etc.)
  await sbAdmin.from('profils').delete().eq('id', userId);
  // Suppression du user auth
  const { error: delErr } = await sbAdmin.auth.admin.deleteUser(userId);
  if (delErr) {
    return new Response(JSON.stringify({ error: 'Erreur suppression : ' + delErr.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
