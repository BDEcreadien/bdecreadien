// Appelé quand l'utilisateur revient de HelloAsso via ?paye=NUMERO
// Utilise la clé service role (pas de RLS) → fiable même si non connecté

const RESEND_FROM = 'BDE CREAD Lyon <noreply@bdecreadien.fr>';

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
  if (!already_paid) {
    // Recalculer le total depuis les items pour corriger un éventuel total_centimes périmé
    const itemsRes = await fetch(
      `${SB}/rest/v1/boutique_items?commande_id=eq.${cmd.id}&select=est_offert,prix_unitaire_centimes,quantite`,
      { headers }
    );
    const items = await itemsRes.json().catch(() => []);
    const totalCalc = (items || [])
      .filter(i => !i.est_offert || i.prix_unitaire_centimes < 0)
      .reduce((s, i) => s + i.prix_unitaire_centimes * i.quantite, 0);
    const patch = { statut: 'payee', updated_at: new Date().toISOString() };
    if (totalCalc >= 100 && totalCalc !== cmd.total_centimes) patch.total_centimes = totalCalc;
    await fetch(`${SB}/rest/v1/boutique_commandes?id=eq.${cmd.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(patch),
    });
  }

  // 3. Envoyer l'email de confirmation de paiement
  if (env.RESEND_API_KEY && cmd.email_acheteur) {
    const total = formatEur((already_paid ? cmd.total_centimes : (typeof totalCalc !== 'undefined' && totalCalc >= 100 ? totalCalc : cmd.total_centimes)) || 0);
    const html = `<!DOCTYPE html><html><head><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0;padding:16px;background:white;font-family:sans-serif;color-scheme:light">
<div style="max-width:560px;margin:0 auto;border:1px solid #ebe6f5;border-radius:16px;overflow:hidden;color:#1a0030">
  <div style="background:linear-gradient(135deg,#460186 0%,#D2396D 50%,#FF741F 100%);padding:14px 24px;text-align:center">
    <p style="margin:0 0 2px;color:rgba(255,255,255,.6);font-size:9px;letter-spacing:4px;text-transform:uppercase">BDE CREAD LYON</p>
    <p style="margin:0;color:white;font-size:36px;font-weight:900;letter-spacing:2px;font-family:Impact,'Arial Narrow',Arial,sans-serif">BOUTIQUE MERCH</p>
  </div>
  <div style="background:white;padding:24px">
    <p style="margin:0 0 8px">Hello <strong>${escHtml(cmd.nom_acheteur || '')}</strong>,</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6">
      Ton paiement pour la commande <strong style="color:#460186">${escHtml(cmd.numero)}</strong> a bien été reçu (${total}). ✓
    </p>
    <p style="margin:0 0 20px;font-size:14px;color:#666;line-height:1.6">
      Ta commande est maintenant en cours de préparation. Tu recevras un email dès qu'elle sera prête à être récupérée.
    </p>
    <p style="margin:16px 0 0;font-size:12px;color:#bbb;border-top:1px solid #f0e8ff;padding-top:14px">
      Une question ? <a href="mailto:bdecreadien@gmail.com" style="color:#D2396D;text-decoration:none">bdecreadien@gmail.com</a>
      &nbsp;·&nbsp; <a href="https://bdecreadien.fr" style="color:#D2396D;text-decoration:none">bdecreadien.fr</a>
    </p>
  </div>
</div>
</body></html>`;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [cmd.email_acheteur],
        subject: `Paiement confirmé — Commande ${cmd.numero}`,
        html,
      }),
    }).catch(() => {});
  }

  return json({ ok: true, numero: cmd.numero, already_paid, email_sent: !!cmd.email_acheteur });
}

function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function formatEur(centimes) {
  return (centimes / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
