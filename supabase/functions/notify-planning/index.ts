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
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
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
  if ((recentCount || 0) >= 50) {
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

  // Récupère TOUS les membres BDE pour envoyer push ET email en parallèle
  const { data: membres, error: bErr } = await sbAdmin.from('profils')
    .select('id, onesignal_id, email, prenom, notif_push, email_bde_enabled, role')
    .in('role', ['membre', 'admin']);
  if (bErr) {
    return new Response(JSON.stringify({ error: 'Impossible de charger les membres BDE : ' + bErr.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
  const includeSelf = !!body.include_self;
  const targets = (membres || []).filter(b => includeSelf ? true : b.id !== userData.user.id);
  const playerIds = targets
    .filter(b => b.notif_push !== false && b.onesignal_id)
    .map(b => b.onesignal_id) as string[];
  const emails = targets
    .filter(b => b.email_bde_enabled !== false && b.email)
    .map(b => ({ email: b.email, prenom: b.prenom || '' }));

  // 1) OneSignal push (si des player_ids existent)
  let pushSent = 0, pushRecipients = null, pushError = null;
  if (playerIds.length) {
    try {
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
      if (osRes.ok && (!osBody.errors || !osBody.errors.length)) {
        pushSent = playerIds.length;
        pushRecipients = osBody.recipients ?? null;
      } else {
        pushError = osBody.errors || osBody;
      }
    } catch (e) { pushError = String(e); }
  }

  // 2) Email fallback via Resend (envoyé à TOUS les membres BDE qui n'ont pas désactivé)
  let emailSent = 0, emailErrors = 0;
  if (RESEND_API_KEY && emails.length) {
    const escHtml = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#F0EFF8;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0EFF8;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(70,58,144,0.12);">
        <tr><td style="background:linear-gradient(135deg,#460186 0%,#8B1A6B 50%,#E85100 100%);padding:32px 40px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:4px;text-transform:uppercase;color:rgba(255,255,255,0.6);">BDE CREAD LYON &bull; PLANNING</p>
          <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">${escHtml(title)}</h1>
        </td></tr>
        <tr><td style="background:#fff;padding:32px 40px;">
          <p style="margin:0 0 20px;font-size:15px;color:#1A1A2E;line-height:1.6;">${escHtml(message || 'Un nouveau planning est disponible.')}</p>
          <p style="margin:0;text-align:center;"><a href="${url}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#460186 0%,#8B1A6B 50%,#E85100 100%);color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px;">Voir le planning</a></p>
        </td></tr>
        <tr><td style="background:#F5F4FF;padding:16px 40px;text-align:center;font-size:11px;color:#888;">
          BDE CREAD Lyon &bull; <a href="https://bdecreadien.fr" style="color:#460186;text-decoration:none;">bdecreadien.fr</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
    for (const e of emails) {
      try {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'BDE CREAD Lyon <contact@bdecreadien.fr>',
            to: [e.email],
            subject: `[BDE] ${title}`,
            html,
          }),
        });
        if (r.ok) emailSent++; else emailErrors++;
      } catch { emailErrors++; }
    }
  }

  return new Response(JSON.stringify({
    success: true,
    push: { sent: pushSent, recipients: pushRecipients, error: pushError },
    email: { sent: emailSent, errors: emailErrors },
    totalTargets: targets.length,
  }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
