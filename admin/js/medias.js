// ============================================================
// MÉDIAS
// ============================================================
function onMediaSelected() {
  const files = Array.from(document.getElementById('vi-file').files);
  if (!files.length) return;
  const warn = document.getElementById('vi-size-warn');
  const MAX = 25 * 1024 * 1024;
  const tooBig = files.filter(f => f.size > MAX);
  if (tooBig.length) {
    const names = tooBig.map(f => `${f.name} (${(f.size/1024/1024).toFixed(1)} Mo)`).join(', ');
    if (warn) warn.innerHTML = `⚠️ Fichier(s) trop lourd(s) : ${names}. Vidéos MP4 max 25 Mo.`;
    document.getElementById('vi-file').value = '';
    return;
  }
  if (warn) warn.innerHTML = '';
  const wrap = document.getElementById('vi-preview-wrap');
  wrap.innerHTML = '';
  wrap.style.display = 'flex';
  files.forEach(file => {
    const url = URL.createObjectURL(file);
    if (file.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = url;
      img.style.cssText = 'width:80px;height:60px;object-fit:cover;border-radius:6px;';
      wrap.appendChild(img);
    } else {
      const vid = document.createElement('video');
      vid.src = url; vid.muted = true; vid.preload = 'metadata';
      vid.style.cssText = 'width:80px;height:60px;object-fit:cover;border-radius:6px;';
      wrap.appendChild(vid);
    }
  });
}

// Crée un blob GitHub et retourne son sha + path (sans commit)
async function createBlob(file) {
  const type = file.type.startsWith('image/') ? 'photo' : 'video';
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2,6)}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
  const path = `assets/uploads/${filename}`;
  const base64 = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res(e.target.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const blobRes = await fetch(`https://api.github.com/repos/${REPO}/git/blobs`, {
    method: 'POST', headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: base64, encoding: 'base64' })
  });
  if (!blobRes.ok) { const b = await blobRes.json(); throw new Error(`Blob : ${b.message}`); }
  const { sha: blobSha } = await blobRes.json();
  return { path, blobSha, type, url: `/${path}` };
}

// Commit une liste d'entrées { path, blobSha } en un seul commit avec retry
async function commitEntries(entries, message) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const refRes = await fetch(`https://api.github.com/repos/${REPO}/git/ref/heads/${BRANCH}`, { headers: { Authorization: `token ${token}` } });
    if (!refRes.ok) throw new Error('Impossible de lire la branche');
    const { object: { sha: commitSha } } = await refRes.json();
    const commitRes = await fetch(`https://api.github.com/repos/${REPO}/git/commits/${commitSha}`, { headers: { Authorization: `token ${token}` } });
    if (!commitRes.ok) throw new Error('Impossible de lire le commit');
    const { tree: { sha: treeSha } } = await commitRes.json();
    const treeRes = await fetch(`https://api.github.com/repos/${REPO}/git/trees`, {
      method: 'POST', headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_tree: treeSha, tree: entries.map(e => ({ path: e.path, mode: '100644', type: 'blob', sha: e.blobSha })) })
    });
    if (!treeRes.ok) throw new Error('Impossible de créer le tree');
    const { sha: newTreeSha } = await treeRes.json();
    const newCommitRes = await fetch(`https://api.github.com/repos/${REPO}/git/commits`, {
      method: 'POST', headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, tree: newTreeSha, parents: [commitSha] })
    });
    if (!newCommitRes.ok) throw new Error('Impossible de créer le commit');
    const { sha: newCommitSha } = await newCommitRes.json();
    const patchRes = await fetch(`https://api.github.com/repos/${REPO}/git/refs/heads/${BRANCH}`, {
      method: 'PATCH', headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha: newCommitSha })
    });
    if (patchRes.ok) return;
    const patchBody = await patchRes.json();
    if (patchRes.status === 422 && attempt < 2) { await new Promise(r => setTimeout(r, 800)); continue; }
    throw new Error(`Échec mise à jour branche : ${patchBody.message}`);
  }
}

// Upload un seul fichier (compatibilité descendante pour couvertures d'événements etc.)
async function uploadMedia(file, suffix = '') {
  if (file.size > 25 * 1024 * 1024) throw new Error('Fichier trop lourd (max 25 Mo). Convertis la vidéo en MP4 compressé.');
  showProgress('Lecture du fichier…');
  const entry = await createBlob(file);
  setProgress(50, 'Envoi du fichier…');
  await commitEntries([entry], `Média : ${entry.path.split('/').pop()}`);
  setProgress(100, 'Terminé !');
  await new Promise(r => setTimeout(r, 400));
  hideProgress();
  return { url: entry.url, type: entry.type };
}

// Upload plusieurs fichiers en parallèle puis un seul commit
async function uploadMediaBatch(files) {
  showProgress(`Lecture de ${files.length} fichier(s)…`);
  const entries = await Promise.all(files.map(f => createBlob(f)));
  setProgress(50, `Envoi de ${files.length} fichier(s)…`);
  await commitEntries(entries, `Ajout de ${files.length} média(s)`);
  setProgress(100, 'Terminé !');
  await new Promise(r => setTimeout(r, 400));
  hideProgress();
  return entries;
}

async function saveMedia() {
  const titre = document.getElementById('vi-titre').value.trim();
  const files = Array.from(document.getElementById('vi-file')?.files || []);
  const idx = editIndex.video;
  if (!files.length && idx < 0) return showToast('Sélectionne un fichier', 'error');
  const btn = document.getElementById('btn-save-media');
  btn.textContent = 'Envoi…'; btn.disabled = true;
  try {
    if (idx >= 0) {
      // Modification : un seul fichier
      let url = data.videos[idx].url;
      let type = data.videos[idx].type;
      if (files.length) ({ url, type } = await uploadMedia(files[0]));
      data.videos[idx] = { type, url, titre };
    } else if (files.length === 1) {
      const { url, type } = await uploadMedia(files[0]);
      data.videos.push({ type, url, titre });
    } else {
      const entries = await uploadMediaBatch(files);
      entries.forEach(e => data.videos.push({ type: e.type, url: e.url, titre }));
    }
  } catch(e) { btn.textContent = 'Ajouter'; btn.disabled = false; return showToast('Erreur upload : ' + e.message, 'error'); }
  btn.textContent = 'Ajouter'; btn.disabled = false;
  try {
    await persistData('videos', idx >= 0 ? 'Modification média' : `Ajout de ${files.length} média(s)`);
    openEditor('videos', false, 'Accueil', 'Médias (photos & vidéos)');
    cancelForm();
    showToast(files.length > 1 ? `${files.length} médias ajoutés !` : 'Média ajouté !', 'success');
  } catch(e) { showToast('Erreur : ' + e.message, 'error'); }
}

// ============================================================
// GALERIE ADMIN (nouveau UI visuel)
// ============================================================
function galerieCaption(i, val) {
  if (data.galerie[i]) data.galerie[i].titre = val;
}

function galerieMove(i, dir) {
  const arr = data.galerie;
  const j = dir === 'left' ? i - 1 : i + 1;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  openEditor('galerie', false, 'Galerie', 'Photos galerie');
  galerieSaveAll(true);
}

async function galerieDelete(i) {
  const item = data.galerie[i];
  const confirmed = await showConfirm('Supprimer cette photo ?', 'Cette action est irréversible.');
  if (!confirmed) return;
  data.galerie.splice(i, 1);
  if (item.url?.startsWith('/')) {
    const path = item.url.replace(/^\//, '');
    try { const f = await getFile(path); await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, { method:'DELETE', headers:{ Authorization:`token ${token}`, 'Content-Type':'application/json' }, body:JSON.stringify({ message:`Suppression galerie`, sha:f.sha, branch:BRANCH }) }); } catch(e) {}
  }
  try {
    await persistData('galerie', 'Suppression photo galerie');
    openEditor('galerie', false, 'Galerie', 'Photos galerie');
    showToast('Photo supprimée !', 'success');
  } catch(e) { showToast('Erreur : ' + e.message, 'error'); }
}

async function galerieSaveAll(silent = false) {
  try {
    await persistData('galerie', 'Mise à jour galerie');
    if (!silent) showToast('Galerie enregistrée !', 'success');
  } catch(e) { showToast('Erreur : ' + e.message, 'error'); }
}

async function galerieUploadFiles(fileList) {
  const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
  if (!files.length) return showToast('Aucune image valide', 'error');
  const btn = document.querySelector('.galerie-upload-btn');
  if (btn) { btn.textContent = `Envoi de ${files.length} photo(s)…`; btn.disabled = true; }
  try {
    let entries;
    if (files.length === 1) {
      const result = await uploadMedia(files[0]);
      entries = [{ url: result.url }];
    } else {
      const raw = await uploadMediaBatch(files);
      entries = raw.map(e => ({ url: e.url }));
    }
    entries.forEach(e => data.galerie.push({ url: e.url, titre: '' }));
    await persistData('galerie', `Ajout de ${files.length} photo(s) à la galerie`);
    openEditor('galerie', false, 'Galerie', 'Photos galerie');
    showToast(`${files.length} photo${files.length>1?'s':''} ajoutée${files.length>1?'s':''} !`, 'success');
  } catch(e) {
    if (btn) { btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Ajouter des photos'; btn.disabled = false; }
    showToast('Erreur upload : ' + e.message, 'error');
  }
}

function onGalerieSelected() {
  const files = Array.from(document.getElementById('gl-file').files);
  if (!files.length) return;
  const wrap = document.getElementById('gl-preview-wrap');
  wrap.innerHTML = '';
  wrap.style.display = 'flex';
  files.forEach(file => {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.style.cssText = 'width:80px;height:60px;object-fit:cover;border-radius:6px;';
    wrap.appendChild(img);
  });
}

async function saveGalerie() {
  const titre = document.getElementById('gl-titre').value.trim();
  const files = Array.from(document.getElementById('gl-file')?.files || []);
  const idx = editIndex.galerie;
  if (!files.length && idx < 0) return showToast('Sélectionne une photo', 'error');
  const btn = document.getElementById('btn-save-galerie');
  btn.textContent = 'Envoi…'; btn.disabled = true;
  try {
    if (idx >= 0) {
      let url = data.galerie[idx].url;
      if (files.length) { const uploaded = await uploadMedia(files[0]); url = uploaded.url; }
      data.galerie[idx] = { url, titre };
    } else if (files.length === 1) {
      const { url } = await uploadMedia(files[0]);
      data.galerie.push({ url, titre });
    } else {
      const entries = await uploadMediaBatch(files);
      entries.forEach(e => data.galerie.push({ url: e.url, titre }));
    }
  } catch(e) { btn.textContent = 'Ajouter'; btn.disabled = false; return showToast('Erreur upload : ' + e.message, 'error'); }
  btn.textContent = 'Ajouter'; btn.disabled = false;
  try {
    await persistData('galerie', idx >= 0 ? 'Modification photo galerie' : `Ajout de ${files.length} photo(s)`);
    openEditor('galerie', false, 'Galerie', 'Photos galerie');
    cancelForm();
    showToast(files.length > 1 ? `${files.length} photos ajoutées !` : 'Photo ajoutée !', 'success');
  } catch(e) { showToast('Erreur : ' + e.message, 'error'); }
}

function onPartenaireLogoSelected() {
  const file = document.getElementById('pt-logo').files[0];
  if (!file) return;
  const img = document.getElementById('pt-preview-img');
  img.src = URL.createObjectURL(file);
  img.style.display = 'block';
  document.getElementById('pt-preview-wrap').style.display = 'block';
}

async function savePartenaire() {
  const nom = document.getElementById('pt-nom').value.trim();
  if (!nom) return showToast('Le nom est obligatoire', 'error');
  const description = document.getElementById('pt-desc').value.trim();
  const lien = document.getElementById('pt-lien').value.trim();
  const file = document.getElementById('pt-logo')?.files[0];
  const idx = editIndex.partenaire;
  const btn = document.getElementById('btn-save-partenaire');
  btn.textContent = 'Envoi…'; btn.disabled = true;
  try {
    let logo = idx >= 0 ? (data.partenaires[idx].logo || '') : '';
    if (file) { const up = await uploadMedia(file); logo = up.url; }
    const pt = { nom, description, lien, logo };
    if (idx >= 0) data.partenaires[idx] = pt; else data.partenaires.push(pt);
  } catch(e) { btn.textContent = 'Ajouter'; btn.disabled = false; return showToast('Erreur upload : ' + e.message, 'error'); }
  btn.textContent = 'Ajouter'; btn.disabled = false;
  try {
    await persistData('partenaires', idx >= 0 ? `Modification partenaire : ${nom}` : `Nouveau partenaire : ${nom}`);
    openEditor('partenaires', false, 'Partenaires', 'Sponsors & partenaires');
    cancelForm();
    showToast('Partenaire enregistré !', 'success');
  } catch(e) { showToast('Erreur : ' + e.message, 'error'); }
}
