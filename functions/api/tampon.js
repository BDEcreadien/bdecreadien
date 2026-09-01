// Cloudflare Pages Function — POST /api/tampon
// Variables d'environnement à configurer dans Cloudflare Pages dashboard :
//   SCAN_PIN                  : code court choisi par l'admin (ex: "BDE25")
//   GITHUB_PAT                : token GitHub avec accès en écriture (pour anciennes cartes JSON)
//   SUPABASE_URL              : URL du projet Supabase
//   SUPABASE_SERVICE_ROLE_KEY : clé service_role Supabase (bypass RLS côté serveur)

const REPO = 'BDEcreadien/bdecreadien';
const BRANCH = 'main';
const DATA_FILE = '_data/fidelite.json';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// UUID v4 = format des user_id Supabase
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { carteId, uid, validateur, event, pin } = body;

    if (!pin || pin !== env.SCAN_PIN) return json({ error: 'Code incorrect' }, 401);

    // Priorité 1 : carte Supabase (uid explicite ou carteId au format UUID)
    const supabaseUid = uid || (UUID_RE.test(carteId || '') ? carteId : null);
    if (supabaseUid) {
      return await handleSupabase(supabaseUid, validateur, event, env);
    }

    // Priorité 2 : ancienne carte JSON
    if (!carteId) return json({ error: 'ID de carte manquant' }, 400);
    return await handleJson(carteId, validateur, event, env);

  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function handleSupabase(uid, validateur, event, env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Supabase non configuré côté serveur' }, 500);
  }
  const base = `${env.SUPABASE_URL}/rest/v1`;
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };

  // Lire la carte + le profil
  const getRes = await fetch(`${base}/cartes_fidelite?user_id=eq.${uid}&select=tampons,total,historique,profils(prenom,nom,email)`, { headers });
  if (!getRes.ok) return json({ error: 'Lecture Supabase échouée' }, 502);
  const rows = await getRes.json();
  if (!rows.length) return json({ error: 'Carte introuvable' }, 404);
  const row = rows[0];
  const carte = {
    id: uid,
    prenom: row.profils?.prenom || '',
    nom: row.profils?.nom || '',
    email: row.profils?.email || '',
    tampons: row.tampons,
    total: row.total,
    historique: Array.isArray(row.historique) ? row.historique : [],
  };

  if (!validateur || !event) return json({ carte });

  if (carte.tampons >= carte.total) return json({ error: 'Carte déjà complète', carte }, 200);

  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' });
  const heureStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
  const newTampons = carte.tampons + 1;
  const newHistorique = [...carte.historique, { date: dateStr, heure: heureStr, validateur, event }];

  const patchRes = await fetch(`${base}/cartes_fidelite?user_id=eq.${uid}`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({ tampons: newTampons, historique: newHistorique }),
  });
  if (!patchRes.ok) {
    const err = await patchRes.text().catch(() => '');
    return json({ error: 'Écriture Supabase échouée: ' + err }, 502);
  }
  carte.tampons = newTampons;
  carte.historique = newHistorique;

  // Si la carte est maintenant pleine, envoyer un email de récompense
  if (newTampons >= carte.total && carte.email && env.RESEND_API_KEY) {
    // Fire-and-forget : on n'attend pas la réponse pour ne pas ralentir le scan
    sendRewardEmail(carte, env).catch(err => console.error('Reward email failed:', err));
  }

  return json({ ok: true, carte });
}

async function sendRewardEmail(carte, env) {
  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>Carte fidélité complète</title></head>
<body style="margin:0;padding:0;background:#F0EFF8;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0EFF8;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(70,1,134,0.12);">
        <tr>
          <td style="background:linear-gradient(135deg,#460186 0%,#D2396D 50%,#FF741F 100%);padding:44px 40px;text-align:center;">
            <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:4px;text-transform:uppercase;color:rgba(255,255,255,0.6);">BDE CREAD LYON</p>
            <h1 style="margin:0;font-size:32px;font-weight:700;color:#fff;letter-spacing:1px;">Carte fidélité complète 🎉</h1>
          </td>
        </tr>
        <tr>
          <td style="background:#fff;padding:40px;">
            <p style="margin:0 0 20px;font-size:17px;color:#1A1A2E;">Salut ${escapeHtml(carte.prenom)},</p>
            <p style="margin:0 0 20px;font-size:15px;color:#333;line-height:1.7;">Bravo, tu as rempli ta carte fidélité BDE CREAD ! 🎊<br>Ta récompense t'attend :</p>
            <div style="background:linear-gradient(135deg,#460186,#FF741F);border-radius:14px;padding:24px;text-align:center;color:#fff;margin:20px 0;">
              <p style="margin:0 0 6px;font-size:22px;font-weight:700;">-10% sur une soirée BDE</p>
              <p style="margin:0 0 8px;font-size:14px;opacity:0.85;">ou</p>
              <p style="margin:0;font-size:22px;font-weight:700;">Un repas offert 🍽️</p>
            </div>
            <p style="margin:20px 0;font-size:14px;color:#4A4560;line-height:1.7;">Pour en profiter, montre simplement ta carte fidélité au BDE lors du prochain événement.</p>
            <div style="text-align:center;margin-top:28px;">
              <a href="https://bdecreadien.fr/carte.html?uid=${carte.id}" style="display:inline-block;background:linear-gradient(135deg,#460186,#FF741F);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:14px;font-weight:700;letter-spacing:0.5px;">Voir ma carte</a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#F5F4FF;padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#888;">BDE CREAD Lyon &bull; <a href="https://bdecreadien.fr" style="color:#460186;text-decoration:none;">bdecreadien.fr</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'BDE CREAD Lyon <contact@bdecreadien.fr>',
      to: [carte.email],
      bcc: ['bdecreadien@gmail.com'],
      subject: '🎉 Ta carte fidélité BDE est complète !',
      html
    })
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

async function handleJson(carteId, validateur, event, env) {
  const pat = env.GITHUB_PAT;
  if (!pat) return json({ error: 'GITHUB_PAT non configuré' }, 500);
  const apiBase = `https://api.github.com/repos/${REPO}/contents/${DATA_FILE}`;
  const headers = {
    Authorization: `token ${pat}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'BDE-CREAD-scan',
  };

  const getRes = await fetch(`${apiBase}?t=${Date.now()}`, { headers });
  if (!getRes.ok) return json({ error: 'Lecture GitHub échouée' }, 502);
  const { content, sha } = await getRes.json();
  const fidelite = JSON.parse(atob(content.replace(/\n/g, '')));

  const idx = fidelite.cartes.findIndex(c => c.id === carteId);
  if (idx === -1) return json({ error: 'Carte introuvable' }, 404);
  const carte = fidelite.cartes[idx];

  if (!validateur || !event) return json({ carte });
  if (carte.tampons >= (carte.total || 10)) return json({ error: 'Carte déjà complète', carte }, 200);

  carte.tampons++;
  if (!Array.isArray(carte.historique)) carte.historique = [];
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const heureStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  carte.historique.push({ date: dateStr, heure: heureStr, validateur, event });

  const newContent = btoa(unescape(encodeURIComponent(JSON.stringify(fidelite, null, 2))));
  const putRes = await fetch(apiBase, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Fidélité : tampon #${carte.tampons} — ${carte.prenom} ${carte.nom} (${event})`,
      content: newContent,
      sha,
      branch: BRANCH,
    }),
  });
  if (!putRes.ok) {
    const err = await putRes.json().catch(() => ({}));
    return json({ error: err.message || 'Écriture GitHub échouée' }, 502);
  }

  return json({ ok: true, carte });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
