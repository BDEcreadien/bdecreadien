// ============================================================
// GITHUB API
// ============================================================
async function getFile(path) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}?t=${Date.now()}`, {
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
  });
  if (!res.ok) throw new Error('Fichier introuvable');
  return res.json();
}
async function saveFile(path, content, sha, message) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2)))), sha, branch: BRANCH })
  });
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(`${res.status} — ${b.message || ''}`); }
}
function showAuthError() {
  const app = document.getElementById('screen-app');
  const existing = document.getElementById('auth-error-banner');
  if (existing) return;
  const banner = document.createElement('div');
  banner.id = 'auth-error-banner';
  banner.style.cssText = 'background:#c0392b;color:#fff;padding:1.2rem 1.5rem;border-radius:10px;margin:1.5rem;text-align:center;font-size:14px;';
  banner.innerHTML = `<strong>Token GitHub invalide ou expiré.</strong> Reconnecte-toi pour continuer.<br><br>
    <button onclick="document.getElementById('auth-error-banner').remove();localStorage.removeItem('bde_gh_token');token=null;document.getElementById('screen-login').style.display='flex';document.getElementById('screen-app').style.display='none';document.getElementById('btn-logout').style.display='none';" style="margin-top:0.5rem;padding:8px 20px;background:#fff;color:#c0392b;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;">Se reconnecter</button>`;
  app.prepend(banner);
}
async function loadData(type) {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/contents/_data/${type}.json?t=${Date.now()}`, {
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
    });
    if (res.status === 401 || res.status === 403) {
      showAuthError();
      data[type] = type === 'config' ? null : [];
      return;
    }
    if (res.status === 404) {
      data[type] = type === 'config' ? null : [];
      return;
    }
    if (!res.ok) {
      console.warn(`Erreur réseau (${res.status}) pour ${type}`);
      data[type] = type === 'config' ? null : [];
      return;
    }
    const file = await res.json();
    const bytes = Uint8Array.from(atob(file.content.replace(/\n/g, '')), c => c.charCodeAt(0));
    const raw = JSON.parse(new TextDecoder().decode(bytes));
    data[type] = type === 'config' ? raw : (Array.isArray(raw) ? raw : (raw[type] || []));
  } catch(e) { data[type] = type === 'config' ? null : []; }
}
async function persistData(type, message) {
  // Toujours récupérer le SHA le plus récent ; si 409, on réessaie une fois avec le SHA actuel
  const path = `_data/${type}.json`;
  const file = await getFile(path);
  try {
    await saveFile(path, data[type], file.sha, message);
  } catch(e) {
    if (e.message.startsWith('409')) {
      const file2 = await getFile(path);
      await saveFile(path, data[type], file2.sha, message);
    } else { throw e; }
  }
}
