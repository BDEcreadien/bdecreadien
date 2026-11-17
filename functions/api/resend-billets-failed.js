// Cron de rattrapage : renvoie les billets non envoyés (billet_email_sent_at IS NULL)
// Appelé automatiquement par GitHub Actions à 00h05 UTC chaque nuit
// Protégé par CRON_SECRET (variable d'env Cloudflare + secret GitHub Actions)

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' } });
  }

  // Auth par CRON_SECRET
  const auth = request.headers.get('Authorization') || '';
  const secret = auth.replace('Bearer ', '').trim();
  if (!env.CRON_SECRET || secret !== env.CRON_SECRET) {
    return json({ error: 'Unauthorized' }, 401);
  }

  if (!env.RESEND_API_KEY || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Env manquant' }, 500);
  }

  const SB  = env.SUPABASE_URL;
  const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  const h   = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

  // Inscriptions des 48h passées sans email envoyé, hors en_attente/annulee
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const inscs = await fetch(
    `${SB}/rest/v1/billetterie_inscriptions?billet_email_sent_at=is.null&created_at=gte.${since}&statut=not.in.(en_attente,annulee)&select=id&limit=80`,
    { headers: h }
  ).then(r => r.json()).catch(() => []);

  if (!inscs?.length) return json({ ok: true, sent: 0, message: 'Aucun billet en attente' });

  let sent = 0, failed = 0;
  for (const insc of inscs) {
    try {
      const res = await fetch(`${new URL(request.url).origin}/api/billetterie-email-billet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
        body: JSON.stringify({ inscription_id: insc.id }),
      });
      res.ok ? sent++ : failed++;
    } catch { failed++; }
    // Pause 300ms pour éviter de dépasser le rate limit Resend
    await new Promise(r => setTimeout(r, 300));
  }

  return json({ ok: true, sent, failed, total: inscs.length });
}
