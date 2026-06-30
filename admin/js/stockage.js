// ============================================================
// STOCKAGE
// ============================================================
async function loadStorage() {
  const grid = document.getElementById('storage-grid');
  const empty = document.getElementById('storage-empty');
  grid.innerHTML = '<p style="color:var(--gris-texte);font-size:13px;">Chargement…</p>';
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/contents/assets/uploads?t=${Date.now()}`, { headers: { Authorization: `token ${token}` } });
    if (!res.ok) { grid.innerHTML = ''; empty.style.display = 'block'; return; }
    const files = await res.json();
    const medias = files.filter(f => /\.(jpg|jpeg|png|gif|webp|mp4|mov|webm)$/i.test(f.name));
    if (!medias.length) { grid.innerHTML = ''; empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    grid.innerHTML = medias.map(f => {
      const isVideo = /\.(mp4|mov|webm)$/i.test(f.name);
      const preview = isVideo
        ? `<video src="${f.download_url}" style="width:100%;height:110px;object-fit:cover;" preload="none"></video>`
        : `<img src="${f.download_url}" alt="${f.name}" loading="lazy">`;
      return `<div class="storage-item">${preview}<div class="storage-item-info">${f.name}</div><button class="storage-item-del" onclick="deleteStorageFile('${f.path}','${f.sha}')" title="Supprimer">✕</button></div>`;
    }).join('');
  } catch(e) { grid.innerHTML = `<p style="color:#c0392b;font-size:13px;">Erreur : ${e.message}</p>`; }
}
async function deleteStorageFile(path, sha) {
  if (!confirm('Supprimer ce fichier définitivement ?')) return;
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
      method: 'DELETE', headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `Suppression : ${path}`, sha, branch: BRANCH })
    });
    if (!res.ok) { const b = await res.json(); throw new Error(b.message); }
    showToast('Fichier supprimé !', 'success');
    loadStorage();
  } catch(e) { showToast('Erreur : ' + e.message, 'error'); }
}
