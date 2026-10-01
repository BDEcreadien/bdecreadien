const RESEND_FROM = 'BDE CREAD Lyon <noreply@bdecreadien.fr>';
const HELLO_ASSO_BASE = 'https://www.helloasso.com/associations/bde-cread-lyon';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Supabase env manquant' }, 500);
  }

  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }

  const { commande_id, nom_acheteur, email_acheteur } = body;
  if (!commande_id || !nom_acheteur || !email_acheteur) {
    return json({ error: 'Paramètres manquants' }, 400);
  }

  const SB  = env.SUPABASE_URL;
  const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

  const headers = {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  // ── 1. Récupérer la commande ─────────────────────────────
  const cmdRes = await fetch(
    `${SB}/rest/v1/boutique_commandes?id=eq.${commande_id}&select=*`,
    { headers }
  );
  const [cmd] = await cmdRes.json();
  if (!cmd) return json({ error: 'Commande introuvable' }, 404);
  if (cmd.statut !== 'panier') return json({ error: 'Commande déjà validée' }, 409);

  // ── 2. Récupérer les articles ────────────────────────────
  const itemsRes = await fetch(
    `${SB}/rest/v1/boutique_items?commande_id=eq.${commande_id}&select=*`,
    { headers }
  );
  const items = await itemsRes.json();
  if (!items?.length) return json({ error: 'Panier vide' }, 400);

  const total = items
    .filter(i => !i.est_offert)
    .reduce((s, i) => s + i.prix_unitaire_centimes * i.quantite, 0);

  // ── 3. Passer en en_attente (trigger génère le numéro) ───
  const upRes = await fetch(
    `${SB}/rest/v1/boutique_commandes?id=eq.${commande_id}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        statut:         'en_attente',
        nom_acheteur,
        email_acheteur,
        total_centimes: total,
      }),
    }
  );
  const [updated] = await upRes.json();
  if (!updated?.numero) return json({ error: 'Erreur lors de la validation' }, 500);

  const numero = updated.numero;

  // ── 4. URL HelloAsso (slug configurable dans bde_config) ─
  let helloassoSlug = env.HELLOASSO_BOUTIQUE_SLUG || '';
  if (!helloassoSlug) {
    // Essayer de récupérer depuis bde_config
    try {
      const cfgRes = await fetch(
        `${SB}/rest/v1/bde_config?cle=eq.helloasso_boutique_slug&select=valeur`,
        { headers }
      );
      const [cfg] = await cfgRes.json();
      helloassoSlug = cfg?.valeur || '';
    } catch (_) { /* ignore */ }
  }

  const helloassoUrl = helloassoSlug
    ? `${HELLO_ASSO_BASE}/evenements/${helloassoSlug}/paiement-rapide`
    : null;

  // ── 5. E-mail de confirmation ────────────────────────────
  if (env.RESEND_API_KEY) {
    const lignes = items.map(i => {
      const detail = [i.design_nom, i.taille].filter(Boolean).join(' · ');
      const prixStr = i.est_offert ? 'OFFERT' : formatEur(i.prix_unitaire_centimes * i.quantite);
      return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #f0e8ff">
          ${i.produit_nom}${detail ? ` <span style="color:#999;font-size:12px">(${detail})</span>` : ''} ×${i.quantite}
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #f0e8ff;text-align:right;font-weight:700;color:${i.est_offert ? '#FF741F' : '#460186'}">
          ${prixStr}
        </td>
      </tr>`;
    }).join('');

    const payBtn = helloassoUrl
      ? `<p style="margin:24px 0 0">
          <a href="${helloassoUrl}" style="display:inline-block;padding:14px 32px;
            background:linear-gradient(135deg,#460186,#D2396D);
            color:white;text-decoration:none;border-radius:12px;
            font-family:sans-serif;font-weight:700;font-size:16px">
            Payer ${formatEur(total)} sur HelloAsso
          </a>
        </p>`
      : '';

    const html = `
      <div style="max-width:560px;margin:0 auto;font-family:sans-serif;color:#1a0030">
        <div style="background:linear-gradient(135deg,#460186,#D2396D,#FF741F);padding:32px;text-align:center;border-radius:16px 16px 0 0">
          <p style="margin:0;color:rgba(255,255,255,.7);font-size:12px;letter-spacing:3px;text-transform:uppercase">BDE CREAD LYON</p>
          <h1 style="margin:8px 0 0;color:white;font-size:36px;letter-spacing:-1px">Boutique Goodies</h1>
        </div>
        <div style="background:white;padding:32px;border-radius:0 0 16px 16px;box-shadow:0 4px 24px rgba(70,1,134,.1)">
          <p>Bonjour <strong>${nom_acheteur}</strong>,</p>
          <p>Votre commande a bien été enregistrée. Voici votre numéro de commande :</p>
          <p style="font-size:28px;font-weight:700;color:#FF741F;margin:16px 0">${numero}</p>
          <table style="width:100%;border-collapse:collapse;margin:20px 0">
            ${lignes}
            <tr>
              <td style="padding:12px 0 0;font-weight:700;font-size:16px">Total</td>
              <td style="padding:12px 0 0;text-align:right;font-weight:700;font-size:18px;color:#460186">${formatEur(total)}</td>
            </tr>
          </table>
          ${payBtn}
          <hr style="border:none;border-top:1px solid #f0e8ff;margin:28px 0">
          <p style="font-size:13px;color:#999;margin:0">
            La livraison se fait sur place une fois que nous avons reçu tous les articles.
            Conserve ce numéro de commande pour le retrait.
          </p>
          <p style="font-size:13px;color:#999;margin:8px 0 0">
            Une question ? Contacte-nous sur bdecreadien.fr
          </p>
        </div>
      </div>`;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from:    RESEND_FROM,
        to:      [email_acheteur],
        subject: `🎁 Commande ${numero} — BDE CREAD Boutique`,
        html,
      }),
    }).catch(() => {}); // non-bloquant
  }

  return json({ ok: true, numero, helloasso_url: helloassoUrl });
}

function formatEur(centimes) {
  return (centimes / 100).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' €';
}
