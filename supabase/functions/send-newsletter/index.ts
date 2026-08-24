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
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY manquante côté serveur' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Vérifie le token de l'appelant et son rôle admin
  const authHeader = req.headers.get('Authorization') || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
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
  const userEmail = userData.user.email;

  const { data: profil } = await sbAdmin.from('profils').select('role').eq('id', userId).maybeSingle();
  if (!profil || profil.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Réservé aux admins' }), {
      status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json();
  const { sujet, contenu_html, test_only } = body;
  if (!sujet || !contenu_html) {
    return new Response(JSON.stringify({ error: 'Sujet et contenu requis' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
  if (String(sujet).length > 200 || String(contenu_html).length > 100000) {
    return new Response(JSON.stringify({ error: 'Contenu trop long' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Récupère les destinataires
  let recipients: { email: string; unsubscribe_token: string }[];
  if (test_only) {
    recipients = [{ email: userEmail!, unsubscribe_token: '00000000-0000-0000-0000-000000000000' }];
  } else {
    const { data, error } = await sbAdmin
      .from('newsletter_subscribers')
      .select('email, unsubscribe_token')
      .eq('status', 'active');
    if (error) {
      return new Response(JSON.stringify({ error: 'Impossible de charger les abonnés : ' + error.message }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    recipients = data || [];
  }

  if (!recipients.length) {
    return new Response(JSON.stringify({ error: 'Aucun destinataire' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Envoi séquentiel avec Resend (1 email par destinataire pour perso unsubscribe_url)
  let sent = 0;
  let errors = 0;
  for (const r of recipients) {
    const unsubUrl = `https://bdecreadien.fr/newsletter-desinscription.html?token=${r.unsubscribe_token}`;
    const html = String(contenu_html).replace(/\{\{UNSUBSCRIBE_URL\}\}/g, unsubUrl);
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'BDE CREAD Lyon <contact@bdecreadien.fr>',
          to: [r.email],
          subject: sujet,
          html,
          headers: {
            'List-Unsubscribe': `<${unsubUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        }),
      });
      if (res.ok) sent++; else errors++;
    } catch (_) {
      errors++;
    }
  }

  // Journalisation (sauf si test)
  if (!test_only) {
    await sbAdmin.from('newsletter_envois').insert({
      sujet,
      contenu_html,
      envoye_par: userId,
      nb_destinataires: sent,
      nb_erreurs: errors,
    });
  }

  return new Response(JSON.stringify({ success: true, sent, errors }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
