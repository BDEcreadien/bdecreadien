// Appelé quand l'utilisateur revient de HelloAsso via ?paye=NUMERO
// IMPORTANT : cette route ne valide JAMAIS une commande d'elle-même (n'importe qui peut l'appeler).
// Elle demande à la synchro HelloAsso de vérifier les vrais paiements, puis renvoie l'état réel.
// Le mail de confirmation est envoyé par la synchro (une seule fois par commande).

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Env manquant' }, 500);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }

  const { numero } = body;
  if (!numero || typeof numero !== 'string') return json({ error: 'numero manquant' }, 400);

  const SB  = env.SUPABASE_URL;
  const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

  const lire = async () => {
    const r = await fetch(
      `${SB}/rest/v1/boutique_commandes?numero=eq.${encodeURIComponent(numero)}&select=id,numero,statut`,
      { headers }
    );
    const [c] = await r.json().catch(() => []);
    return c;
  };

  let cmd = await lire();
  if (!cmd) return json({ error: 'Commande introuvable' }, 404);

  const estPayee = c => !['panier', 'en_attente'].includes(c.statut);
  if (estPayee(cmd)) return json({ ok: true, numero: cmd.numero, paid: true });

  // Vérification réelle auprès de HelloAsso (la synchro valide + envoie le mail si un paiement correspond)
  await fetch(`${SB}/functions/v1/helloasso-sync`, {
    method: 'POST',
    headers,
    body: '{}',
  }).catch(() => {});

  cmd = (await lire()) || cmd;
  return json({ ok: true, numero: cmd.numero, paid: estPayee(cmd) });
}
