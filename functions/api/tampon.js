// Cloudflare Pages Function — POST /api/tampon
// Variables d'environnement à configurer dans Cloudflare Pages dashboard :
//   SCAN_PIN   : code court choisi par l'admin (ex: "BDE25")
//   GITHUB_PAT : token GitHub avec accès en écriture au repo

const REPO = 'BDEcreadien/bdecreadien';
const BRANCH = 'main';
const DATA_FILE = '_data/fidelite.json';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost({ request, env }) {
  try {
    const { carteId, validateur, event, pin } = await request.json();

    // Vérification du code
    if (!pin || pin !== env.SCAN_PIN) {
      return json({ error: 'Code incorrect' }, 401);
    }
    if (!carteId) {
      return json({ error: 'ID de carte manquant' }, 400);
    }

    const pat = env.GITHUB_PAT;
    const apiBase = `https://api.github.com/repos/${REPO}/contents/${DATA_FILE}`;
    const headers = {
      Authorization: `token ${pat}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'BDE-CREAD-scan',
    };

    // Lire le fichier actuel
    const getRes = await fetch(`${apiBase}?t=${Date.now()}`, { headers });
    if (!getRes.ok) return json({ error: 'Lecture GitHub échouée' }, 502);
    const { content, sha } = await getRes.json();
    const fidelite = JSON.parse(atob(content.replace(/\n/g, '')));

    // Trouver la carte
    const idx = fidelite.cartes.findIndex(c => c.id === carteId);
    if (idx === -1) return json({ error: 'Carte introuvable' }, 404);
    const carte = fidelite.cartes[idx];

    // Si pas de validateur/event → lecture seule, on renvoie juste la carte
    if (!validateur || !event) {
      return json({ carte });
    }

    // Carte déjà complète
    if (carte.tampons >= (carte.total || 10)) {
      return json({ error: 'Carte déjà complète', carte }, 200);
    }

    // Ajouter le tampon
    carte.tampons++;
    if (!Array.isArray(carte.historique)) carte.historique = [];
    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const heureStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    carte.historique.push({ date: dateStr, heure: heureStr, validateur, event });

    // Sauvegarder
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
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
