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
  const getRes = await fetch(`${base}/cartes_fidelite?user_id=eq.${uid}&select=tampons,total,profils(prenom,nom)`, { headers });
  if (!getRes.ok) return json({ error: 'Lecture Supabase échouée' }, 502);
  const rows = await getRes.json();
  if (!rows.length) return json({ error: 'Carte introuvable' }, 404);
  const row = rows[0];
  const carte = {
    id: uid,
    prenom: row.profils?.prenom || '',
    nom: row.profils?.nom || '',
    tampons: row.tampons,
    total: row.total,
  };

  if (!validateur || !event) return json({ carte });

  if (carte.tampons >= carte.total) return json({ error: 'Carte déjà complète', carte }, 200);

  const newTampons = carte.tampons + 1;
  const patchRes = await fetch(`${base}/cartes_fidelite?user_id=eq.${uid}`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({ tampons: newTampons }),
  });
  if (!patchRes.ok) {
    const err = await patchRes.text().catch(() => '');
    return json({ error: 'Écriture Supabase échouée: ' + err }, 502);
  }
  carte.tampons = newTampons;
  return json({ ok: true, carte });
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
