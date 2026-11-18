// Appelé quand l'utilisateur revient de HelloAsso via ?paye=NUMERO
// Utilise la clé service role (pas de RLS) → fiable même si non connecté

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
  const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };

  // 1. Récupérer la commande par numéro (service role, pas de RLS)
  const cmdRes = await fetch(
    `${SB}/rest/v1/boutique_commandes?numero=eq.${encodeURIComponent(numero)}&select=id,numero,statut,nom_acheteur,email_acheteur,total_centimes`,
    { headers }
  );
  const [cmd] = await cmdRes.json();
  if (!cmd) return json({ error: 'Commande introuvable' }, 404);

  // 2. Mettre à jour le statut si pas encore payée
  const already_paid = !['panier', 'en_attente'].includes(cmd.statut);
  let effectiveTotal = cmd.total_centimes;
  if (!already_paid) {
    // Recalculer le total depuis les items pour corriger un éventuel total_centimes périmé
    const itemsRes = await fetch(
      `${SB}/rest/v1/boutique_items?commande_id=eq.${cmd.id}&select=est_offert,prix_unitaire_centimes,quantite`,
      { headers }
    );
    const items = await itemsRes.json().catch(() => []);
    // Même règle que boutique-commande.js (articles payants + remises négatives)
    const calc = (items || [])
      .filter(i => !i.est_offert || i.prix_unitaire_centimes < 0)
      .reduce((s, i) => s + i.prix_unitaire_centimes * i.quantite, 0);
    // Repli : si tout est marqué offert par erreur, on prend les articles à prix positif
    const totalCalc = calc > 0 ? calc : (items || [])
      .filter(i => i.prix_unitaire_centimes > 0)
      .reduce((s, i) => s + i.prix_unitaire_centimes * i.quantite, 0);
    if (totalCalc > 0) effectiveTotal = totalCalc;
    const patch = { statut: 'payee', updated_at: new Date().toISOString() };
    if (totalCalc > 0 && totalCalc !== cmd.total_centimes) patch.total_centimes = totalCalc;
    const patchRes = await fetch(`${SB}/rest/v1/boutique_commandes?id=eq.${cmd.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(patch),
    });
    if (!patchRes.ok) return json({ error: 'Mise à jour impossible' }, 500);
  }

  // 3. Email de confirmation de paiement (même modèle que l'étape "payee" de l'admin, avec QR code)
  if (env.RESEND_API_KEY && cmd.email_acheteur) {
    await fetch(`${new URL(request.url).origin}/api/boutique-email-etape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commande_id: cmd.id, etape: 'payee' }),
    }).catch(() => {});
  }

  return json({ ok: true, numero: cmd.numero, already_paid, email_sent: !!cmd.email_acheteur });
}


