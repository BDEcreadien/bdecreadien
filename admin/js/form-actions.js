// ============================================================
// FORM ACTIONS
// ============================================================
let currentType = '';

function initEditorEvents(type) {
  currentType = type;
  if (type === 'evenements') initLieuAutocomplete();
}

function onMembrePhotoSelected() {
  const file = document.getElementById('mb-photo').files[0];
  if (!file) return;
  const img = document.getElementById('mb-preview-img');
  img.src = URL.createObjectURL(file);
  document.getElementById('mb-preview-wrap').style.display = 'block';
}

function showForm() {
  document.getElementById('the-form').classList.add('visible');
  document.getElementById('btn-add').style.display = 'none';
  editIndex[currentType === 'evenements' ? 'evenement' : currentType === 'annonces' ? 'annonce' : currentType === 'equipe' ? 'membre' : currentType === 'archives' ? 'archive' : currentType === 'galerie' ? 'galerie' : currentType === 'partenaires' ? 'partenaire' : 'video'] = -1;
}

function cancelForm() {
  document.getElementById('the-form').classList.remove('visible');
  document.getElementById('btn-add').style.display = 'flex';
  resetForm();
}

function resetForm() {
  if (currentType === 'evenements') {
    ['ev-titre','ev-date','ev-dateAffichage','ev-horaire-debut','ev-horaire-fin','ev-lieu','ev-adresse','ev-prix','ev-description','ev-lien','ev-inscrits'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    const ph = document.getElementById('ev-phare'); if(ph) ph.checked = false;
    const sel = document.getElementById('ev-prix-select'); if(sel) sel.value = '';
    const autre = document.getElementById('ev-prix-autre'); if(autre) autre.style.display = 'none';
    const sugg = document.getElementById('lieu-suggestions'); if(sugg) sugg.style.display = 'none';
    document.getElementById('form-title').textContent = 'Nouvel événement';
  }
  if (currentType === 'annonces') {
    ['an-titre','an-prix','an-description','an-auteur','an-contact'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    const cat = document.getElementById('an-categorie');
    if (cat) cat.value = data['annonces-categories']?.[0]?.key || 'materiel';
    const fi = document.getElementById('an-photo'); if(fi) fi.value = '';
    const pw = document.getElementById('an-preview-wrap'); if(pw) pw.style.display = 'none';
    document.getElementById('form-title').textContent = 'Nouvelle annonce';
  }
  if (currentType === 'videos') {
    const fi = document.getElementById('vi-file'); if(fi) fi.value = '';
    const ti = document.getElementById('vi-titre'); if(ti) ti.value = '';
    const pw = document.getElementById('vi-preview-wrap'); if(pw) { pw.innerHTML = ''; pw.style.display = 'none'; }
    document.getElementById('form-title').textContent = 'Nouveau média';
  }
  if (currentType === 'galerie') {
    const fi = document.getElementById('gl-file'); if(fi) fi.value = '';
    const ti = document.getElementById('gl-titre'); if(ti) ti.value = '';
    const pw = document.getElementById('gl-preview-wrap'); if(pw) { pw.innerHTML = ''; pw.style.display = 'none'; }
    document.getElementById('form-title').textContent = 'Nouvelle photo';
  }
  if (currentType === 'partenaires') {
    ['pt-nom','pt-desc','pt-lien'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    const fi = document.getElementById('pt-logo'); if(fi) fi.value = '';
    const pw = document.getElementById('pt-preview-wrap'); if(pw) pw.style.display = 'none';
    const img = document.getElementById('pt-preview-img'); if(img) { img.src=''; img.style.display='none'; }
    document.getElementById('form-title').textContent = 'Nouveau partenaire';
  }
  if (currentType === 'equipe') {
    ['mb-nom','mb-initiales','mb-role'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    const pole = document.getElementById('mb-pole'); if(pole) pole.value = 'bureau';
    const pw = document.getElementById('mb-preview-wrap'); if(pw) pw.style.display = 'none';
    document.getElementById('form-title').textContent = 'Nouveau membre';
  }
  if (currentType === 'archives') {
    ['ar-titre','ar-day','ar-month','ar-lieu'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    const tag = document.getElementById('ar-tag'); if(tag) tag.value = 'Soirée';
    document.getElementById('form-title').textContent = 'Nouvel événement passé';
  }
}

function editItem(type, i) {
  const map = { evenements: 'evenement', annonces: 'annonce', videos: 'video', equipe: 'membre', archives: 'archive', galerie: 'galerie', partenaires: 'partenaire' };
  editIndex[map[type]] = i;
  document.getElementById('the-form').classList.add('visible');
  document.getElementById('btn-add').style.display = 'none';

  if (type === 'evenements') {
    const ev = data.evenements[i];
    document.getElementById('ev-titre').value = ev.titre || '';
    document.getElementById('ev-date').value = ev.date || '';
    document.getElementById('ev-dateAffichage').value = ev.dateAffichage || '';
    const [hD, hF] = (ev.horaire || '').split(/\s*[–—-]\s*/);
    document.getElementById('ev-horaire-debut').value = hD ? hD.replace('h',':') : '';
    document.getElementById('ev-horaire-fin').value = hF ? hF.replace('h',':') : '';
    const prixOpts = ['Gratuit','5€','8€','10€','12€','15€','20€'];
    if (prixOpts.includes(ev.prix)) { document.getElementById('ev-prix-select').value = ev.prix; }
    else if (ev.prix) { document.getElementById('ev-prix-select').value = 'autre'; document.getElementById('ev-prix-autre').value = ev.prix; document.getElementById('ev-prix-autre').style.display = 'block'; }
    document.getElementById('ev-prix').value = ev.prix || '';
    document.getElementById('ev-lieu').value = ev.lieu || '';
    document.getElementById('ev-adresse').value = ev.adresse || '';
    document.getElementById('ev-description').value = ev.description || '';
    document.getElementById('ev-lien').value = ev.lien || '';
    document.getElementById('ev-typeLien').value = ev.typeLien || '';
    document.getElementById('ev-phare').checked = !!ev.phare;
    document.getElementById('ev-inscrits').value = ev.inscrits || '';
    document.getElementById('ev-categorie').value = ev.categorie || 'soiree';
    const coverWrap = document.getElementById('ev-cover-preview-wrap');
    const coverImg = document.getElementById('ev-cover-preview-img');
    const evImgUrl = typeof ev.imageUrl === 'object' ? ev.imageUrl?.url : ev.imageUrl;
    if (evImgUrl) {
      const coverUrl = evImgUrl.startsWith('/') ? `https://raw.githubusercontent.com/${REPO}/main${evImgUrl}` : evImgUrl;
      coverImg.src = coverUrl;
      coverWrap.style.display = 'block';
    } else { coverWrap.style.display = 'none'; }
    document.getElementById('form-title').textContent = 'Modifier l\'événement';
  }
  if (type === 'annonces') {
    const an = data.annonces[i];
    document.getElementById('an-titre').value = an.titre || '';
    document.getElementById('an-categorie').value = an.categorie || (data['annonces-categories']?.[0]?.key || 'materiel');
    document.getElementById('an-prix').value = an.prix || '';
    document.getElementById('an-description').value = an.description || '';
    document.getElementById('an-auteur').value = an.auteur || '';
    document.getElementById('an-contact').value = an.contact || '';
    if (an.photo) {
      const photoUrl = an.photo.startsWith('/') ? `https://raw.githubusercontent.com/BDEcreadien/bdecreadien/main${an.photo}` : an.photo;
      document.getElementById('an-preview-img').src = photoUrl;
      document.getElementById('an-preview-wrap').style.display = 'block';
    } else {
      document.getElementById('an-preview-wrap').style.display = 'none';
    }
    document.getElementById('form-title').textContent = 'Modifier l\'annonce';
  }
  if (type === 'equipe') {
    const mb = data.equipe[i];
    document.getElementById('mb-nom').value = mb.nom || '';
    document.getElementById('mb-initiales').value = mb.initiales || '';
    document.getElementById('mb-role').value = mb.role || '';
    document.getElementById('mb-pole').value = mb.pole || 'bureau';
    if (mb.photo) {
      document.getElementById('mb-preview-img').src = mb.photo;
      document.getElementById('mb-preview-wrap').style.display = 'block';
    }
    document.getElementById('form-title').textContent = 'Modifier le membre';
  }
  if (type === 'videos') {
    const vi = data.videos[i];
    document.getElementById('vi-titre').value = vi.titre || '';
    if (vi.url) {
      const wrap = document.getElementById('vi-preview-wrap');
      const rawUrl = vi.url.startsWith('/') ? `https://raw.githubusercontent.com/${REPO}/main${vi.url}` : vi.url;
      wrap.innerHTML = vi.type === 'photo'
        ? `<img src="${rawUrl}" style="width:80px;height:60px;object-fit:cover;border-radius:6px;">`
        : `<video src="${rawUrl}" muted preload="metadata" style="width:80px;height:60px;object-fit:cover;border-radius:6px;"></video>`;
      wrap.style.display = 'flex';
    }
    document.getElementById('form-title').textContent = 'Modifier le média';
  }
  if (type === 'archives') {
    const ar = data.archives[i];
    document.getElementById('ar-titre').value = ar.titre || '';
    document.getElementById('ar-day').value = ar.day || '';
    document.getElementById('ar-month').value = ar.month || '';
    document.getElementById('ar-lieu').value = ar.lieu || '';
    document.getElementById('ar-tag').value = ar.tag || 'Soirée';
    document.getElementById('form-title').textContent = 'Modifier l\'événement passé';
  }
  if (type === 'galerie') {
    const gl = data.galerie[i];
    document.getElementById('gl-titre').value = gl.titre || '';
    if (gl.url) {
      const rawUrl = gl.url.startsWith('/') ? `https://raw.githubusercontent.com/${REPO}/main${gl.url}` : gl.url;
      const img = document.getElementById('gl-preview-img');
      img.src = rawUrl; img.style.display = 'block';
      document.getElementById('gl-preview-wrap').style.display = 'block';
    }
    document.getElementById('form-title').textContent = 'Modifier la photo';
  }
  if (type === 'partenaires') {
    const pt = data.partenaires[i];
    document.getElementById('pt-nom').value = pt.nom || '';
    document.getElementById('pt-desc').value = pt.description || '';
    document.getElementById('pt-lien').value = pt.lien || '';
    if (pt.logo) {
      const rawUrl = pt.logo.startsWith('/') ? `https://raw.githubusercontent.com/${REPO}/main${pt.logo}` : pt.logo;
      const img = document.getElementById('pt-preview-img');
      img.src = rawUrl; img.style.display = 'block';
      document.getElementById('pt-preview-wrap').style.display = 'block';
    }
    document.getElementById('form-title').textContent = 'Modifier le partenaire';
  }
}

async function saveArchive() {
  const titre = document.getElementById('ar-titre').value.trim();
  const day = document.getElementById('ar-day').value.trim();
  const month = document.getElementById('ar-month').value.trim();
  const lieu = document.getElementById('ar-lieu').value.trim();
  const tag = document.getElementById('ar-tag').value;
  if (!titre || !day || !month) return showToast('Remplis le titre, le jour et le mois', 'error');
  const ar = { titre, day, month, lieu, tag };
  const idx = editIndex.archive;
  if (idx >= 0) data.archives[idx] = ar; else data.archives.push(ar);
  try {
    await persistData('archives', idx >= 0 ? `Modification archive : ${titre}` : `Nouvelle archive : ${titre}`);
    openEditor('archives', false, 'Archives', 'Événements passés');
    cancelForm();
    showToast('Événement passé publié !', 'success');
  } catch(e) { showToast('Erreur : ' + e.message, 'error'); }
}

async function deleteItem(type, i) {
  const item = data[type][i];
  const label = item.titre || item.nom || item.name || 'cet élément';
  const confirmed = await showConfirm(`Supprimer "${label}" ?`, 'Cette action est irréversible.');
  if (!confirmed) return;
  data[type].splice(i, 1);
  try {
    await persistData(type, `Suppression dans ${type}`);
    // Si c'est un média local (photo/vidéo uploadée), supprimer aussi le fichier
    if (type === 'galerie' && item.url?.startsWith('/')) {
      const path = item.url.replace(/^\//, '');
      try {
        const file = await getFile(path);
        await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
          method: 'DELETE',
          headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: `Suppression galerie : ${path}`, sha: file.sha, branch: BRANCH })
        });
      } catch(e) { /* pas bloquant */ }
    }
    if (type === 'videos' && item.url?.startsWith('/')) {
      const path = item.url.replace(/^\//, '');
      try {
        const file = await getFile(path);
        await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
          method: 'DELETE',
          headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: `Suppression média : ${path}`, sha: file.sha, branch: BRANCH })
        });
      } catch(e) { /* fichier déjà absent, pas bloquant */ }
    }
    // Suppression des fichiers uploadés associés
    const fileFields = {
      equipe: ['photo'],
      evenements: ['cover'],
      archives: ['cover'],
      annonces: ['photo'],
      partenaires: ['logo'],
    };
    for (const field of (fileFields[type] || [])) {
      const filePath = item[field];
      if (filePath?.startsWith('/')) {
        const path = filePath.replace(/^\//, '');
        try {
          const f = await getFile(path);
          await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
            method: 'DELETE',
            headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: `Suppression fichier : ${path}`, sha: f.sha, branch: BRANCH })
          });
        } catch(e) { /* fichier déjà absent, pas bloquant */ }
      }
    }
    refreshList(type);
    showToast('Supprimé !', 'success');
  } catch(e) { showToast('Erreur : ' + e.message, 'error'); }
}

function refreshList(type) {
  document.getElementById('items-list').innerHTML = buildEditor(type).split('items-list"')[1].split('</div>')[0] + '</div>';
  openEditor(type, false, document.getElementById('editor-badge').textContent, document.getElementById('editor-title').textContent);
}

// ============================================================
// SAVE ÉVÉNEMENT
// ============================================================
function onPrixChange() {
  const sel = document.getElementById('ev-prix-select').value;
  const autre = document.getElementById('ev-prix-autre');
  if (sel === 'autre') { autre.style.display = 'block'; document.getElementById('ev-prix').value = ''; autre.oninput = () => document.getElementById('ev-prix').value = autre.value; }
  else { autre.style.display = 'none'; document.getElementById('ev-prix').value = sel; }
}
function autoDateAffichage() {
  const val = document.getElementById('ev-date').value;
  if (!val) return;
  const d = new Date(val + 'T12:00:00');
  const s = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('ev-dateAffichage').value = s.charAt(0).toUpperCase() + s.slice(1);
}
function previewEvCover(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('ev-cover-preview-img').src = e.target.result;
    document.getElementById('ev-cover-preview-wrap').style.display = 'block';
  };
  reader.readAsDataURL(file);
}
function removeEvCover() {
  document.getElementById('ev-cover').value = '';
  document.getElementById('ev-cover-preview-wrap').style.display = 'none';
  if (editIndex.evenement >= 0) data.evenements[editIndex.evenement]._removeCover = true;
}

async function moveItem(type, i, dir) {
  const arr = data[type];
  const j = dir === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  try {
    await persistData(type, `Réorganisation ${type}`);
    openEditor(type, false);
  } catch(e) { showToast('Erreur : ' + e.message, 'error'); }
}

async function archiveEvenement(i) {
  const ev = data.evenements[i];
  const confirmed = await showConfirm(`Archiver "${ev.titre}" ?`, 'L\'événement sera déplacé dans les archives.');
  if (!confirmed) return;
  const d = new Date(ev.date);
  const archived = {
    titre: ev.titre,
    day: d.getDate().toString().padStart(2, '0'),
    month: d.toLocaleString('fr-FR', { month: 'short' }).toUpperCase(),
    lieu: ev.lieu,
    tag: ev.categorie ? ({ soiree:'Soirée', sortie:'Sortie', atelier:'Atelier', autre:'Autre' }[ev.categorie] || 'Soirée') : 'Soirée',
    description: ev.description || ''
  };
  data.evenements.splice(i, 1);
  if (!data.archives) data.archives = [];
  data.archives.unshift(archived);
  try {
    await persistData('evenements', `Archive : ${ev.titre}`);
    await persistData('archives', `Archive : ${ev.titre}`);
    openEditor('evenements', false, 'Agenda', 'Événements');
    showToast('Événement archivé !', 'success');
  } catch(e) { showToast('Erreur : ' + e.message, 'error'); }
}

async function saveEvenement() {
  const titre = document.getElementById('ev-titre').value.trim();
  const date = document.getElementById('ev-date').value;
  const dateAffichage = document.getElementById('ev-dateAffichage').value;
  const debut = document.getElementById('ev-horaire-debut').value;
  const fin = document.getElementById('ev-horaire-fin').value;
  const lieu = document.getElementById('ev-lieu').value.trim();
  const prix = document.getElementById('ev-prix').value;
  const description = document.getElementById('ev-description').value.trim();
  if (!titre || !date || !debut || !fin || !lieu || !prix || !description) return showToast('Remplis tous les champs obligatoires', 'error');
  const horaire = debut.replace(':','h') + ' – ' + fin.replace(':','h');
  const phare = document.getElementById('ev-phare').checked;
  const categorie = document.getElementById('ev-categorie').value;
  const idx = editIndex.evenement;

  // Upload cover photo if selected
  const coverFile = document.getElementById('ev-cover').files[0];
  let imageUrl = idx >= 0 ? (data.evenements[idx].imageUrl || '') : '';
  if (idx >= 0 && data.evenements[idx]._removeCover) imageUrl = '';
  if (coverFile) {
    try {
      imageUrl = (await uploadMedia(coverFile, 'cover')).url;
    } catch(e) { return showToast('Erreur upload couverture : ' + e.message, 'error'); }
  }

  const inscrits = parseInt(document.getElementById('ev-inscrits').value) || 0;
  const ev = { titre, date, dateAffichage, horaire, lieu, adresse: document.getElementById('ev-adresse').value.trim(), description, prix, categorie, imageUrl, lien: document.getElementById('ev-lien').value.trim(), typeLien: document.getElementById('ev-typeLien').value, phare, ...(inscrits > 0 ? { inscrits } : {}) };
  if (phare) data.evenements.forEach((e, i) => { if (i !== idx) e.phare = false; });
  if (idx >= 0) data.evenements[idx] = ev; else data.evenements.push(ev);
  try {
    await persistData('evenements', idx >= 0 ? `Modification : ${titre}` : `Nouvel événement : ${titre}`);
    openEditor('evenements', false, 'Agenda', 'Événements');
    cancelForm();
    showToast('Événement publié !', 'success');
  } catch(e) { showToast('Erreur : ' + e.message, 'error'); }
}

// ============================================================
// SAVE ANNONCE
// ============================================================
function previewAnPhoto(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('an-preview-img').src = e.target.result;
    document.getElementById('an-preview-wrap').style.display = 'block';
  };
  reader.readAsDataURL(file);
}
function removeAnPhoto() {
  document.getElementById('an-photo').value = '';
  document.getElementById('an-preview-wrap').style.display = 'none';
  if (editIndex.annonce >= 0) data.annonces[editIndex.annonce]._removePhoto = true;
}

async function saveAnnonce() {
  const titre = document.getElementById('an-titre').value.trim();
  const prix = document.getElementById('an-prix').value.trim();
  const description = document.getElementById('an-description').value.trim();
  const auteur = document.getElementById('an-auteur').value.trim();
  const contact = document.getElementById('an-contact').value.trim();
  if (!titre || !prix || !description || !auteur || !contact) return showToast('Remplis tous les champs obligatoires', 'error');

  const btn = document.getElementById('btn-save-annonce');
  btn.textContent = 'Envoi…'; btn.disabled = true;

  const file = document.getElementById('an-photo').files[0];
  const idx = editIndex.annonce;
  let photo = idx >= 0 ? (data.annonces[idx].photo || '') : '';
  if (idx >= 0 && data.annonces[idx]._removePhoto) photo = '';

  if (file) {
    try {
      const result = await uploadMedia(file);
      photo = result.url;
    } catch(e) {
      btn.textContent = 'Publier'; btn.disabled = false;
      return showToast('Erreur upload photo : ' + e.message, 'error');
    }
  }

  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const categorie = document.getElementById('an-categorie').value;
  const an = { titre, categorie, prix, description, auteur, contact, date: today };
  if (photo) an.photo = photo;

  if (idx >= 0) data.annonces[idx] = an; else data.annonces.push(an);
  try {
    await persistData('annonces', idx >= 0 ? `Modification : ${titre}` : `Nouvelle annonce : ${titre}`);
    openEditor('annonces', false, 'Annonces', 'Annonces');
    cancelForm();
    showToast('Annonce publiée !', 'success');
  } catch(e) {
    btn.textContent = 'Publier'; btn.disabled = false;
    showToast('Erreur : ' + e.message, 'error');
  }
}

// ============================================================
// SAVE MEMBRE ÉQUIPE
// ============================================================
async function saveMembre() {
  const nom = document.getElementById('mb-nom').value.trim();
  const initiales = document.getElementById('mb-initiales').value.trim();
  const role = document.getElementById('mb-role').value.trim();
  const pole = document.getElementById('mb-pole').value;
  if (!nom || !initiales || !role) return showToast('Remplis tous les champs obligatoires', 'error');

  const file = document.getElementById('mb-photo').files[0];
  const btn = document.getElementById('btn-save-membre');
  btn.textContent = 'Envoi…'; btn.disabled = true;

  let photo = editIndex.membre >= 0 ? (data.equipe[editIndex.membre].photo || '') : '';
  if (file) {
    try {
      const result = await uploadMedia(file);
      photo = result.url;
    } catch(e) {
      btn.textContent = 'Publier'; btn.disabled = false;
      return showToast('Erreur photo : ' + e.message, 'error');
    }
  }
  btn.textContent = 'Publier'; btn.disabled = false;

  const mb = { nom, role, pole, initiales, photo };
  const idx = editIndex.membre;
  if (idx >= 0) data.equipe[idx] = mb; else data.equipe.push(mb);
  try {
    await persistData('equipe', idx >= 0 ? `Modification : ${nom}` : `Nouveau membre : ${nom}`);
    openEditor('equipe', false, 'Communication', 'Équipe BDE');
    cancelForm();
    showToast('Membre publié !', 'success');
  } catch(e) { showToast('Erreur : ' + e.message, 'error'); }
}
