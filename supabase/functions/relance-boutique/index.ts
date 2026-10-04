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

function esc(s: string) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function fmt(centimes: number) {
  return (centimes / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

function buildEmail(cmd: any): string {
  const prenom = esc(cmd.nom_acheteur?.split(' ')[0] || 'toi');
  const total  = fmt(cmd.total_centimes || 0);
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head><body style="margin:0;background:#0d0d1a;font-family:sans-serif">
<div style="max-width:560px;margin:40px auto;background:#1a1a2e;border-radius:16px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#460186,#D2396D,#FF741F);padding:28px 32px">
    <p style="margin:0;color:rgba(255,255,255,.7);font-size:13px;text-transform:uppercase;letter-spacing:2px">BDE CREAD Lyon</p>
    <h1 style="margin:8px 0 0;color:white;font-size:26px">Ta commande t'attend !</h1>
  </div>
  <div style="padding:28px 32px;color:#ccc">
    <p>Salut <strong style="color:white">${prenom}</strong> 👋</p>
    <p>Ta commande <strong style="color:white">${esc(cmd.numero)}</strong> (${total}) est en attente de paiement.</p>
    <p>Si tu veux finaliser ta commande, c'est encore temps !</p>
    <div style="text-align:center;margin:28px 0">
      <a href="https://bdecreadien.fr/boutique" style="background:linear-gradient(135deg,#460186,#D2396D);color:white;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:16px;letter-spacing:1px">
        Finaliser ma commande
      </a>
    </div>
    <p style="font-size:12px;color:#666">Si tu ne souhaites plus cette commande, tu peux l'annuler directement depuis la boutique.</p>
  </div>
</div>
</body></html>`;
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const CORS = corsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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

  const sbAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Vérifier que c'est un admin
  const { data: userData, error: userErr } = await sbAdmin.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: 'Session invalide' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
  const { data: profil } = await sbAdmin.from('profils').select('role').eq('id', userData.user.id).single();
  if (profil?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Non autorisé' }), {
      status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Récupérer les commandes en attente avec email
  const { data: cmds, error: cmdsErr } = await sbAdmin
    .from('boutique_commandes')
    .select('id, numero, total_centimes, nom_acheteur, email_acheteur')
    .eq('statut', 'en_attente')
    .not('email_acheteur', 'is', null)
    .neq('email_acheteur', '');

  if (cmdsErr) {
    return new Response(JSON.stringify({ error: cmdsErr.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  let sent = 0; let failed = 0;
  for (const cmd of (cmds || [])) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'BDE CREAD Lyon <contact@bdecreadien.fr>',
        to: [cmd.email_acheteur],
        subject: `Ta commande ${cmd.numero} attend ton paiement`,
        html: buildEmail(cmd),
      }),
    });
    if (res.ok) sent++; else failed++;
  }

  return new Response(JSON.stringify({ ok: true, sent, failed, total: (cmds||[]).length }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
