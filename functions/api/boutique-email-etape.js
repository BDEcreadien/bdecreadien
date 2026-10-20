const RESEND_FROM = 'BDE CREAD Lyon <noreply@bdecreadien.fr>';

const ETAPES = {
  payee: {
    subject: c => `Paiement confirmé — Commande ${c.numero}`,
    titre:   'Paiement confirmé !',
    message: c => `Ton paiement pour la commande <strong>${c.numero}</strong> a bien été reçu et validé. Nous allons maintenant lancer la production de tes articles.`,
    couleur: '#16a34a',
  },
  production: {
    subject: c => `Commande ${c.numero} — Production lancée`,
    titre:   'Production lancée !',
    message: c => `Ta commande <strong>${c.numero}</strong> est en cours de production. On te recontacte dès que tes articles arrivent à l'école.`,
    couleur: '#7c3aed',
  },
  livraison: {
    subject: c => `Commande ${c.numero} — En route !`,
    titre:   'Ta commande est en route !',
    message: c => `Les articles de ta commande <strong>${c.numero}</strong> sont en cours de livraison vers l'école. Tu recevras bientôt un e-mail dès qu'ils seront disponibles.`,
    couleur: '#0284c7',
  },
  confirmee: {
    subject: c => `Commande ${c.numero} — Disponible à l'école !`,
    titre:   'Ta commande est disponible !',
    message: c => `Tes articles sont arrivés et ta commande <strong>${c.numero}</strong> est prête à être retirée à l'école. Présente le QR code ci-dessous lors du retrait.`,
    couleur: '#ff5500',
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!env.RESEND_API_KEY || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: true });

  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400); }

  const { commande_id, etape } = body;
  if (!commande_id || !etape || !ETAPES[etape]) return json({ error: 'Paramètres invalides' }, 400);

  const SB  = env.SUPABASE_URL;
  const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

  const [cmd] = await fetch(`${SB}/rest/v1/boutique_commandes?id=eq.${commande_id}&select=*`, { headers }).then(r => r.json());
  if (!cmd) return json({ error: 'Commande introuvable' }, 404);

  const items = await fetch(`${SB}/rest/v1/boutique_items?commande_id=eq.${commande_id}&select=*`, { headers }).then(r => r.json());
  const total = (items || []).filter(i => !i.est_offert).reduce((s, i) => s + i.prix_unitaire_centimes * i.quantite, 0);

  const lignes = (items || []).map(i => {
    const detail = [i.design_nom, i.couleur, i.taille].filter(Boolean).join(' · ');
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

  const e = ETAPES[etape];
  const showQr = etape === 'confirmee';

  const html = `<!DOCTYPE html><html><head><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0;padding:16px;background:white;font-family:sans-serif;color-scheme:light">
<div style="max-width:560px;margin:0 auto;border:1px solid #ebe6f5;border-radius:16px;overflow:hidden;color:#1a0030">
  <div style="background:linear-gradient(135deg,#460186 0%,#D2396D 50%,#FF741F 100%);padding:14px 24px;text-align:center">
    <p style="margin:0 0 2px;color:rgba(255,255,255,.6);font-size:9px;letter-spacing:4px;text-transform:uppercase">BDE CREAD LYON</p>
    <p style="margin:0;color:white;font-size:32px;font-weight:800;letter-spacing:1px">Boutique Merch</p>
  </div>
  <div style="background:white;padding:24px">
    <p style="margin:0 0 8px">Bonjour <strong>${cmd.nom_acheteur}</strong>,</p>
    <p style="margin:0 0 20px;font-size:16px;font-weight:700;color:${e.couleur}">${e.titre}</p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#444">${e.message(cmd)}</p>
    <p style="margin:0 0 6px;font-size:12px;color:#aaa;letter-spacing:1px;text-transform:uppercase">Numéro de commande</p>
    <p style="margin:0 0 20px;font-size:24px;font-weight:800;color:#460186;letter-spacing:1px">${cmd.numero}</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:14px">
      ${lignes}
      <tr><td style="padding:10px 0 0;font-weight:700">Total</td><td style="padding:10px 0 0;text-align:right;font-weight:700;color:#460186">${formatEur(total)}</td></tr>
    </table>
    ${showQr ? `
    <div style="border-left:3px solid #D2396D;border-radius:0 8px 8px 0;padding:12px 16px;margin:16px 0;background:#fdf9ff;font-size:13px;color:#555">
      <strong>Où retirer ?</strong><br>Hall de l'école &nbsp;·&nbsp; Midi de 12h30 à 14h
    </div>
    <div style="text-align:center;margin:20px 0;padding:16px;border:1px solid #f0e8ff;border-radius:12px">
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#460186">Présente ce QR code lors du retrait</p>
      <img src="https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(cmd.numero)}&size=180x180&margin=8&color=460186" alt="${cmd.numero}" style="width:180px;height:180px">
      <p style="margin:8px 0 0;font-size:14px;font-weight:700;color:#460186;letter-spacing:2px">${cmd.numero}</p>
    </div>` : ''}
    <p style="margin:16px 0 0;font-size:12px;color:#bbb;border-top:1px solid #f0e8ff;padding-top:14px">Conserve cet e-mail pour le retrait. Une question ? <a href="mailto:bdecreadien@gmail.com" style="color:#D2396D;text-decoration:none">bdecreadien@gmail.com</a> &nbsp;·&nbsp; <a href="https://bdecreadien.fr" style="color:#D2396D;text-decoration:none">bdecreadien.fr</a></p>
  </div>
</div>
</body></html>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from:    RESEND_FROM,
      to:      [cmd.email_acheteur],
      subject: e.subject(cmd),
      html,
    }),
  }).catch(() => {});

  return json({ ok: true });
}

function formatEur(centimes) {
  return (centimes / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
