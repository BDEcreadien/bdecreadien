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

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const LABELS: Record<string, { title: string; badge: string; color: string; url: string }> = {
  adhesion: { title: 'Nouvelle demande d\'adhésion', badge: 'ADHÉSION', color: '#463A90', url: '/mon-espace.html#bde-demandes' },
  feedback: { title: 'Nouveau feedback reçu', badge: 'FEEDBACK', color: '#8B1A6B', url: '/mon-espace.html#bde-feedbacks' },
  annonce:  { title: 'Nouvelle annonce à modérer', badge: 'ANNONCE', color: '#E85100', url: '/mon-espace.html#bde-annonces' },
};

function buildHtml(type: string, auteur: string, sujet: string, message: string): string {
  const cfg = LABELS[type];
  const messageHtml = esc(message).replace(/\n/g, '<br>');
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(cfg.title)}</title></head>
<body style="margin:0;padding:0;background:#F0EFF8;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0EFF8;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(70,58,144,0.12);">
        <tr><td style="background:linear-gradient(135deg,#463A90 0%,#8B1A6B 50%,#E85100 100%);padding:32px 40px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:4px;text-transform:uppercase;color:rgba(255,255,255,0.6);">BDE CREAD LYON &bull; ${cfg.badge}</p>
          <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">${esc(cfg.title)}</h1>
        </td></tr>
        <tr><td style="background:#fff;padding:32px 40px;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${cfg.color};">De la part de</p>
          <p style="margin:0 0 20px;font-size:16px;font-weight:700;color:#1A1A2E;">${esc(auteur)}</p>
          ${sujet ? `<p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${cfg.color};">Sujet</p>
          <p style="margin:0 0 20px;font-size:15px;color:#1A1A2E;">${esc(sujet)}</p>` : ''}
          ${message ? `<div style="background:#F8F8FF;border-left:3px solid ${cfg.color};border-radius:0 12px 12px 0;padding:16px 20px;font-size:14px;color:#333;line-height:1.7;">${messageHtml}</div>` : ''}
          <p style="margin:24px 0 0;text-align:center;">
            <a href="https://bdecreadien.fr${cfg.url}" style="display:inline-block;background:linear-gradient(135deg,#463A90,#E85100);color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:700;font-size:14px;">Voir dans l'admin</a>
          </p>
        </td></tr>
        <tr><td style="background:#F5F4FF;padding:16px 40px;text-align:center;font-size:11px;color:#888;">
          BDE CREAD Lyon &bull; <a href="https://bdecreadien.fr" style="color:#463A90;text-decoration:none;">bdecreadien.fr</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
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
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY manquante' }), {
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

  let body: any;
  try { body = await req.json(); } catch { body = {}; }
  const type = String(body.type || '');
  const sujet = String(body.sujet || '').slice(0, 200);
  const message = String(body.message || '').slice(0, 3000);
  if (!LABELS[type]) {
    return new Response(JSON.stringify({ error: 'Type invalide' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Récupère infos de l'appelant (prénom, nom, email)
  const { data: profil } = await sbAdmin.from('profils').select('prenom, nom, email').eq('id', userData.user.id).maybeSingle();
  const auteur = profil ? `${profil.prenom || ''} ${profil.nom || ''}`.trim() + (profil.email ? ` (${profil.email})` : '') : (userData.user.email || 'Utilisateur');

  // Récupère la liste des membres BDE + admins
  const { data: membres, error: mErr } = await sbAdmin
    .from('profils').select('email').in('role', ['membre', 'admin']);
  if (mErr) {
    return new Response(JSON.stringify({ error: 'Impossible de charger les membres BDE : ' + mErr.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
  const recipients = (membres || []).map(m => m.email).filter(Boolean) as string[];
  if (!recipients.length) {
    return new Response(JSON.stringify({ success: true, sent: 0, note: 'Aucun membre BDE à notifier' }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const html = buildHtml(type, auteur, sujet, message);
  const cfg = LABELS[type];

  // Envoi 1 email par destinataire (Resend n'aime pas les BCC massifs)
  let sent = 0, errors = 0;
  for (const email of recipients) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'BDE CREAD Lyon <contact@bdecreadien.fr>',
          to: [email],
          subject: `[BDE] ${cfg.badge} — ${sujet || 'Nouvelle notification'}`,
          html,
        }),
      });
      if (res.ok) sent++; else errors++;
    } catch { errors++; }
  }

  return new Response(JSON.stringify({ success: true, sent, errors }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
