// Recrée un checkout HelloAsso pour une commande en_attente existante
// POST { commande_id } + Authorization: Bearer <supabase-access-token>

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = request.headers.get('Authorization') || '';
  const userToken  = authHeader.replace('Bearer ', '').trim();
  if (!userToken) return json({ error: 'Non authentifié' }, 401);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }

  const { commande_id } = body;
  if (!commande_id) return json({ error: 'commande_id manquant' }, 400);

  const SB  = env.SUPABASE_URL;
  const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

  // Vérifier l'identité de l'utilisateur via son token
  const meRes = await fetch(`${SB}/auth/v1/user`, {
    headers: { apikey: KEY, Authorization: `Bearer ${userToken}` },
  });
  if (!meRes.ok) return json({ error: 'Token invalide' }, 401);
  const me = await meRes.json();
  const user_id = me.id;

  // Récupérer la commande (doit appartenir à cet user et être en_attente)
  const cmdRes = await fetch(
    `${SB}/rest/v1/boutique_commandes?id=eq.${commande_id}&select=*`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }
  );
  const [cmd] = await cmdRes.json();
  if (!cmd)                  return json({ error: 'Commande introuvable' }, 404);
  if (cmd.user_id !== user_id) return json({ error: 'Accès refusé' }, 403);
  if (cmd.statut !== 'en_attente') return json({ error: 'Commande déjà payée ou annulée' }, 409);

  // Créer un nouveau checkout HelloAsso pour le même montant
  const SITE = 'https://bdecreadien.fr';
  const parts = (cmd.nom_acheteur || '').trim().split(/\s+/);
  const firstName = parts[0] || 'Client';
  const lastName  = parts.slice(1).join(' ') || parts[0] || 'BDE';

  const haRes = await fetch(
    `${SB}/functions/v1/helloasso-checkout`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${KEY}`,
      },
      body: JSON.stringify({
        totalAmountCents: cmd.total_centimes,
        itemName: `Commande ${cmd.numero} — BDE CREAD Boutique`,
        backUrl:   `${SITE}/boutique.html?annule=1`,
        errorUrl:  `${SITE}/boutique.html?erreur=1`,
        returnUrl: `${SITE}/boutique.html?paye=${encodeURIComponent(cmd.numero)}`,
        payer: { firstName, lastName, email: cmd.email_acheteur },
        metadata: { commande_id, numero: cmd.numero },
      }),
    }
  );
  const haData = await haRes.json();
  if (!haData.redirectUrl) return json({ error: 'Impossible de créer le checkout', details: haData }, 500);

  return json({ ok: true, redirectUrl: haData.redirectUrl, numero: cmd.numero, total: cmd.total_centimes });
}
