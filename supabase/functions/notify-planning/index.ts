// Edge function : envoi push OneSignal aux membres bureau
// Auth : appelant doit être bureau (RLS bypass via service key)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = ['https://bdecreadien.fr', 'https://www.bdecreadien.fr'];
const ONESIGNAL_APP_ID = '8c4f2a28-64eb-4417-85c9-20bda4365e45';

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
  const ONESIGNAL_REST_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY');
  if (!ONESIGNAL_REST_KEY) {
    return new Response(JSON.stringify({ error: 'ONESIGNAL_REST_API_KEY manquante' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) {
    return new Response(JSON.stringify({ error: 'Non authentifié' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const sbAdmin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: userData, error: userErr } = await sbAdmin.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: 'Session invalide' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Appelant doit être membre BDE ou admin
  const { data: caller } = await sbAdmin.from('profils')
    .select('role').eq('id', userData.user.id).maybeSingle();
  if (!caller || !['membre', 'admin'].includes(caller.role)) {
    return new Response(JSON.stringify({ error: 'Réservé aux membres BDE' }), {
      status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Rate limit : max 10 envois / heure / utilisateur (évite spam)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentCount } = await sbAdmin.from('analytics_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', 'click')
    .eq('label', `notify-planning:${userData.user.id}`)
    .gte('created_at', oneHourAgo);
  if ((recentCount || 0) >= 10) {
    return new Response(JSON.stringify({ error: 'Trop d\'envois récents. Réessaie plus tard.' }), {
      status: 429, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
  sbAdmin.from('analytics_events').insert({
    event_type: 'click', path: '/notify-planning',
    session_id: userData.user.id.slice(0, 32),
    label: `notify-planning:${userData.user.id}`,
  }).then(() => {}, () => {});

  let body: any;
  try { body = await req.json(); } catch { body = {}; }
  const title = String(body.title || 'Nouveau planning').slice(0, 80);
  const message = String(body.message || '').slice(0, 200);
  const url = String(body.url || 'https://bdecreadien.fr/mon-espace.html#bde-planning').slice(0, 300);

  // Récupère les OneSignal IDs des membres BDE (membre + admin) qui n'ont pas désactivé les notifs push
  const { data: membres, error: bErr } = await sbAdmin.from('profils')
    .select('id, onesignal_id, role')
    .in('role', ['membre', 'admin'])
    .neq('notif_push', false)
    .not('onesignal_id', 'is', null);
  if (bErr) {
    return new Response(JSON.stringify({ error: 'Impossible de charger les membres BDE : ' + bErr.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
  const includeSelf = !!body.include_self;
  const playerIds = (membres || [])
    .filter(b => includeSelf ? true : b.id !== userData.user.id)
    .map(b => b.onesignal_id).filter(Boolean) as string[];

  if (!playerIds.length) {
    return new Response(JSON.stringify({ success: true, sent: 0, note: 'Aucun membre BDE abonné aux notifs push (onesignal_id manquant ou notif_push désactivé)' }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Appel OneSignal REST API
  const osRes = await fetch('https://api.onesignal.com/notifications', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${ONESIGNAL_REST_KEY}`,
      'Content-Type': 'application/json',
      'accept': 'application/json',
    },
    body: JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      include_player_ids: playerIds,
      headings: { fr: title, en: title },
      contents: { fr: message || title, en: message || title },
      url,
    }),
  });
  const osBody = await osRes.json().catch(() => ({}));
  if (!osRes.ok) {
    return new Response(JSON.stringify({ error: 'OneSignal error', details: osBody }), {
      status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true, sent: playerIds.length, recipients: osBody.recipients ?? null }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
