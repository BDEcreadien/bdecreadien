/* BDE Admin — module contenu
   Extrait tel quel de admin.html (scripts classiques, portée globale partagée). */
// ============================================================
// BUILDER ÉDITEURS
// ============================================================


function buildAnCategoriesPanel() {
  const cats = data['annonces-categories'] || [];
  const rows = cats.map((c, i) => `
    <div class="item-card" id="an-cat-row-${i}" style="padding:10px 14px;gap:10px;">
      <div class="item-card-info" id="an-cat-label-wrap-${i}" style="flex:1;">
        <span id="an-cat-label-${i}" style="font-weight:600;font-size:14px;">${c.label}</span>
        <span style="font-size:11px;color:var(--gris-texte);margin-left:6px;">(${c.key})</span>
      </div>
      <div id="an-cat-edit-wrap-${i}" style="display:none;flex:1;gap:6px;align-items:center;">
        <input id="an-cat-input-${i}" type="text" value="${c.label}" style="flex:1;font-size:13px;padding:4px 8px;border:1px solid var(--gris-border);border-radius:6px;">
        <button onclick="saveAnCat(${i})" style="background:var(--violet);color:white;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px;">OK</button>
        <button onclick="cancelAnCatEdit(${i})" style="background:none;border:1px solid var(--gris-border);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px;">✕</button>
      </div>
      <div class="item-card-actions">
        <div style="display:flex;flex-direction:column;gap:2px;margin-right:4px;">
          <button onclick="moveAnCat(${i},'up')" style="background:none;border:1px solid var(--gris-border);border-radius:4px;padding:1px 5px;cursor:pointer;font-size:11px;color:var(--gris-texte);" title="Monter" ${i===0?'disabled':''}>↑</button>
          <button onclick="moveAnCat(${i},'down')" style="background:none;border:1px solid var(--gris-border);border-radius:4px;padding:1px 5px;cursor:pointer;font-size:11px;color:var(--gris-texte);" title="Descendre" ${i===cats.length-1?'disabled':''}>↓</button>
        </div>
        <button class="btn-edit" onclick="startAnCatEdit(${i})">Renommer</button>
        <button class="btn-delete" onclick="deleteAnCat(${i})" ${cats.length <= 1 ? 'disabled title="Gardez au moins une catégorie"' : ''}>Supprimer</button>
      </div>
    </div>`).join('');

  return `<div class="form-card visible" style="margin-bottom:1.5rem;">
    <h3 style="margin-bottom:1rem;font-size:15px;">Catégories</h3>
    <div id="an-cats-list" style="display:flex;flex-direction:column;gap:6px;margin-bottom:1rem;">${rows || '<p style="color:var(--gris-texte);font-size:13px;">Aucune catégorie.</p>'}</div>
    <div style="display:flex;gap:8px;align-items:center;">
      <input id="an-cat-new-input" type="text" placeholder="Nom de la nouvelle catégorie…" style="flex:1;font-size:13px;padding:6px 10px;border:1px solid var(--gris-border);border-radius:6px;" onkeydown="if(event.key==='Enter')addAnCat()">
      <button onclick="addAnCat()" style="background:var(--gradient);color:white;border:none;border-radius:8px;padding:6px 14px;cursor:pointer;font-size:13px;font-weight:600;white-space:nowrap;">+ Ajouter</button>
    </div>
  </div>`;
}

function startAnCatEdit(i) {
  document.getElementById(`an-cat-label-wrap-${i}`).style.display = 'none';
  document.getElementById(`an-cat-edit-wrap-${i}`).style.display = 'flex';
  document.getElementById(`an-cat-input-${i}`).focus();
}
function cancelAnCatEdit(i) {
  document.getElementById(`an-cat-label-wrap-${i}`).style.display = '';
  document.getElementById(`an-cat-edit-wrap-${i}`).style.display = 'none';
}
async function saveAnCat(i) {
  const newLabel = document.getElementById(`an-cat-input-${i}`).value.trim();
  if (!newLabel) return;
  const newKey = newLabel.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
  if (data['annonces-categories'].some((c, j) => j !== i && c.key === newKey)) {
    return showToast('Ce nom existe déjà (clé identique)', 'error');
  }
  const snapshot = JSON.parse(JSON.stringify(data['annonces-categories']));
  data['annonces-categories'][i].label = newLabel;
  data['annonces-categories'][i].key = newKey;
  openEditor('annonces', false, 'Annonces', 'Annonces');
  showToast('Catégorie mise à jour !', 'success');
  try { await persistData('annonces-categories', `Renommage catégorie : ${newLabel}`); }
  catch(e) { data['annonces-categories'] = snapshot; openEditor('annonces', false, 'Annonces', 'Annonces'); showToast('Échec de la sauvegarde', 'error'); }
}
async function moveAnCat(i, dir) {
  const arr = data['annonces-categories'];
  const j = i + (dir === 'up' ? -1 : 1);
  if (j < 0 || j >= arr.length) return;
  const snapshot = JSON.parse(JSON.stringify(arr));
  [arr[i], arr[j]] = [arr[j], arr[i]];
  openEditor('annonces', false, 'Annonces', 'Annonces');
  try { await persistData('annonces-categories', `Réordonnancement catégories`); }
  catch(e) { data['annonces-categories'] = snapshot; openEditor('annonces', false, 'Annonces', 'Annonces'); showToast('Échec de la sauvegarde', 'error'); }
}
async function addAnCat() {
  const label = document.getElementById('an-cat-new-input').value.trim();
  if (!label) return showToast('Saisis un nom de catégorie', 'error');
  const key = label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
  if (data['annonces-categories'].some(c => c.key === key)) return showToast('Cette catégorie existe déjà', 'error');
  const snapshot = JSON.parse(JSON.stringify(data['annonces-categories']));
  data['annonces-categories'].push({ key, label });
  openEditor('annonces', false, 'Annonces', 'Annonces');
  showToast('Catégorie ajoutée !', 'success');
  try { await persistData('annonces-categories', `Nouvelle catégorie : ${label}`); }
  catch(e) { data['annonces-categories'] = snapshot; openEditor('annonces', false, 'Annonces', 'Annonces'); showToast('Échec de la sauvegarde', 'error'); }
}
async function deleteAnCat(i) {
  const cat = data['annonces-categories'][i];
  const used = (data.annonces || []).some(a => a.categorie === cat.key);
  if (used) return showToast(`"${cat.label}" est utilisée par des annonces existantes`, 'error');
  if (!confirm(`Supprimer la catégorie "${cat.label}" ?`)) return;
  const snapshot = JSON.parse(JSON.stringify(data['annonces-categories']));
  data['annonces-categories'].splice(i, 1);
  openEditor('annonces', false, 'Annonces', 'Annonces');
  showToast('Catégorie supprimée', 'success');
  try { await persistData('annonces-categories', `Suppression catégorie : ${cat.label}`); }
  catch(e) { data['annonces-categories'] = snapshot; openEditor('annonces', false, 'Annonces', 'Annonces'); showToast('Échec de la sauvegarde', 'error'); }
}

function buildEquipeEditor() {
  const poles = (data.config?.poles || [
    { key: 'bureau', label: 'Bureau exécutif' },
    { key: 'evenements', label: 'Pôle Événements' },
    { key: 'communication', label: 'Pôle Communication' }
  ]);
  const poleLabels = Object.fromEntries(poles.map(p => [p.key, p.label]));

  const groupHtml = poles.map(pole => {
    const membres = data.equipe
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => m.pole === pole.key);
    if (!membres.length) return `<div class="pole-group"><p class="pole-group-label">${pole.label}</p><p style="color:var(--gris-texte);font-size:13px;padding:0.5rem 0;">Aucun membre</p></div>`;

    const cards = membres.map(({ m, i }, posInPole) => {
      const photoUrl = m.photo?.startsWith('/') ? `https://raw.githubusercontent.com/${REPO}/main${m.photo}` : m.photo;
      const avatar = photoUrl
        ? `<img loading="lazy" decoding="async" src="${photoUrl}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;flex-shrink:0;">`
        : `<div style="width:44px;height:44px;border-radius:50%;background:var(--gradient);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:15px;flex-shrink:0;">${m.initiales || '?'}</div>`;
      const isFirst = posInPole === 0;
      const isLast = posInPole === membres.length - 1;
      return `<div class="item-card">
        ${avatar}
        <div class="item-card-info"><div class="item-card-title">${m.nom}</div><div class="item-card-sub">${m.role}</div></div>
        <div style="display:flex;flex-direction:column;gap:2px;margin-right:4px;">
          <button onclick="moveEquipe(${i},'up')" style="background:none;border:1px solid var(--gris-border);border-radius:6px;width:28px;height:28px;cursor:pointer;font-size:14px;line-height:1;color:var(--gris-texte);${isFirst?'opacity:0.3;pointer-events:none;':''}" ${isFirst?'disabled':''}>↑</button>
          <button onclick="moveEquipe(${i},'down')" style="background:none;border:1px solid var(--gris-border);border-radius:6px;width:28px;height:28px;cursor:pointer;font-size:14px;line-height:1;color:var(--gris-texte);${isLast?'opacity:0.3;pointer-events:none;':''}" ${isLast?'disabled':''}>↓</button>
        </div>
        <div class="item-card-actions">
          <button class="btn-edit" onclick="editItem('equipe',${i})">Modifier</button>
          <button class="btn-delete" onclick="deleteItem('equipe',${i})">Supprimer</button>
        </div></div>`;
    }).join('');

    return `<div class="pole-group"><p class="pole-group-label">${pole.label}</p>${cards}</div>`;
  }).join('');

  const polesHtml = poles.map((p, i) => `
    <div class="item-card" style="padding:0.75rem 1rem;">
      <div class="item-card-info"><div class="item-card-title">${p.label}</div><div class="item-card-sub">clé : ${p.key}</div></div>
      <div class="item-card-actions">
        <button class="btn-delete" onclick="removePole(${i})">Supprimer</button>
      </div>
    </div>`).join('');

  return `
    <div class="params-card" style="margin-bottom:1rem;">
      <h3>Pôles <span style="font-size:12px;font-weight:400;color:var(--gris-texte);">Gérer les pôles de l'équipe</span></h3>
      <div id="poles-list" style="display:flex;flex-direction:column;gap:0.5rem;margin-bottom:1rem;">${polesHtml}</div>
      <div style="display:flex;gap:0.5rem;align-items:flex-end;flex-wrap:wrap;">
        <div class="form-row" style="margin:0;flex:1;min-width:140px;"><label>Nom du pôle *</label><input type="text" id="new-pole-label" placeholder="Ex: Pôle Sport"></div>
        <div class="form-row" style="margin:0;flex:1;min-width:120px;"><label>Clé (sans accent, minuscule) *</label><input type="text" id="new-pole-key" placeholder="Ex: sport"></div>
        <button class="btn-save" style="margin-bottom:0;height:40px;" onclick="addPole()">+ Ajouter</button>
      </div>
    </div>
    <div class="items-list" id="items-list">${groupHtml}</div>
    ${formMembre()}
    <button class="btn-add" id="btn-add" onclick="showForm()">+ Ajouter un membre</button>`;
}

// ============================================================
// FORMULAIRES HTML
// ============================================================
function formEvenement() {
  return `<div class="form-card" id="the-form">
    <h3 id="form-title">Nouvel événement</h3>
    <div class="form-row"><label>Titre *</label><input type="text" id="ev-titre" placeholder="Ex: Soirée"></div>
    <div class="form-grid">
      <div class="form-row"><label>Date *</label><input type="date" id="ev-date" oninput="autoDateAffichage()"></div>
      <div class="form-row"><label>Date affichée</label><input type="text" id="ev-dateAffichage" readonly style="background:#f5f5f7;color:var(--gris-texte);"></div>
    </div>
    <div class="form-grid">
      <div class="form-row">
        <label>Horaire</label>
        <div style="display:flex;align-items:center;gap:0.5rem;">
          <input type="time" id="ev-horaire-debut" style="flex:1;">
          <span style="color:var(--gris-texte);font-size:13px;">→</span>
          <input type="time" id="ev-horaire-fin" style="flex:1;">
        </div>
      </div>
      <div class="form-row">
        <label>Prix</label>
        <div style="position:relative;">
          <input type="text" id="ev-prix" placeholder="Ex: 7,50" inputmode="decimal" style="padding-right:32px;">
          <span style="position:absolute;right:12px;top:50%;transform:translateY(-50%);color:var(--gris-texte);font-weight:600;pointer-events:none;">€</span>
        </div>
      </div>
    </div>
    <div class="form-row">
      <label>Lieu <span style="font-weight:400;color:var(--gris-texte);font-size:12px;">(nom affiché librement - ex: Six Brotteaux)</span></label>
      <input type="text" id="ev-lieu" placeholder="Ex: Six Brotteaux">
    </div>
    <div class="form-row">
      <label>Adresse <span style="font-weight:400;color:var(--gris-texte);font-size:12px;">(tape la rue pour chercher)</span></label>
      <div class="autocomplete-wrap">
        <input type="text" id="ev-adresse" placeholder="Ex: Rue Juliette Récamier Lyon…" autocomplete="off">
        <div class="autocomplete-list" id="lieu-suggestions" style="display:none;"></div>
      </div>
    </div>
    <div class="form-row"><label>Description</label><textarea id="ev-description" placeholder="Décris l'événement…"></textarea></div>
    <div class="form-grid">
      <div class="form-row">
        <label>Catégorie</label>
        <select id="ev-categorie">
          <option value="soiree">Soirée</option>
          <option value="sortie">Sortie</option>
          <option value="atelier">Atelier</option>
          <option value="autre">Autre</option>
        </select>
      </div>
      <div class="form-row">
        <label style="display:flex;align-items:center;gap:0.6rem;cursor:pointer;margin-top:1.5rem;">
          <input type="checkbox" id="ev-phare" style="width:18px;height:18px;accent-color:var(--orange);cursor:pointer;">
          <span style="display:flex;align-items:center;gap:0.4rem;"><svg viewBox="0 0 24 24" width="16" height="16" stroke="var(--orange)" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Événement phare</span>
        </label>
      </div>
    </div>
    <div class="form-row">
      <label>Photo de couverture <span style="font-weight:400;color:var(--gris-texte);font-size:12px;">(optionnel - s'affiche sur la carte phare de l'accueil)</span></label>
      <input type="file" id="ev-cover" accept="image/*" onchange="previewEvCover(this)">
      <div id="ev-cover-preview-wrap" style="display:none;margin-top:8px;">
        <img loading="lazy" decoding="async" id="ev-cover-preview-img" src="" alt="Aperçu" style="max-width:100%;max-height:140px;border-radius:8px;object-fit:cover;">
        <button type="button" onclick="removeEvCover()" style="display:block;margin-top:6px;font-size:12px;color:var(--rouge,#c0392b);background:none;border:none;cursor:pointer;">Supprimer la photo</button>
      </div>
    </div>
    <div class="form-grid">
      <div class="form-row"><label>Lien billetterie (optionnel)</label><input type="text" id="ev-lien" placeholder="https://shotgun.live/… (ou colle une URL, le https:// sera ajouté auto)"></div>
      <div class="form-row">
        <label>Type de lien</label>
        <select id="ev-typeLien">
          <option value="">Aucun</option>
          <option value="shotgun">Shotgun</option>
          <option value="helloasso">HelloAsso</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <label>Nombre d'inscrits (optionnel)</label>
      <input type="number" id="ev-inscrits" placeholder="Ex: 42" min="0">
    </div>
    <div class="form-actions">
      <button class="btn-cancel" onclick="cancelForm()">Annuler</button>
      <button class="btn-save" onclick="saveEvenement()">Publier</button>
    </div>
  </div>`;
}

function formAnnonce() {
  return `<div class="form-card" id="the-form">
    <h3 id="form-title">Nouvelle annonce</h3>
    <div class="form-row"><label>Titre *</label><input type="text" id="an-titre" placeholder="Ex: Table à dessin A1"></div>
    <div class="form-grid">
      <div class="form-row">
        <label>Catégorie *</label>
        <select id="an-categorie">
          ${(data['annonces-categories'] || [{ key:'materiel', label:'Matériel' }, { key:'place', label:'Places' }, { key:'logement', label:'Logement' }, { key:'autre', label:'Autre' }]).map(c => `<option value="${c.key}">${c.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-row"><label>Prix *</label><input type="text" id="an-prix" placeholder="Ex: 80€ ou Gratuit"></div>
    </div>
    <div class="form-row"><label>Description *</label><textarea id="an-description" placeholder="Décris ce que tu vends ou proposes…"></textarea></div>
    <div class="form-row">
      <label>Photo <span style="font-weight:400;color:var(--gris-texte);font-size:12px;">(optionnel)</span></label>
      <input type="file" id="an-photo" accept="image/*" onchange="previewAnPhoto(this)">
      <div id="an-preview-wrap" style="display:none;margin-top:8px;">
        <img loading="lazy" decoding="async" id="an-preview-img" src="" alt="Aperçu" style="max-width:100%;max-height:180px;border-radius:8px;object-fit:cover;">
        <button type="button" onclick="removeAnPhoto()" style="display:block;margin-top:6px;font-size:12px;color:var(--rouge,#c0392b);background:none;border:none;cursor:pointer;">Supprimer la photo</button>
      </div>
    </div>
    <div class="form-grid">
      <div class="form-row"><label>Ton prénom + initiale *</label><input type="text" id="an-auteur" placeholder="Ex: Léa M."></div>
      <div class="form-row"><label>Ton email de contact *</label><input type="email" id="an-contact" placeholder="prenom@cread.fr"></div>
    </div>
    <div class="form-actions">
      <button class="btn-cancel" onclick="cancelForm()">Annuler</button>
      <button class="btn-save" id="btn-save-annonce" onclick="saveAnnonce()">Publier</button>
    </div>
  </div>`;
}

function formMembre() {
  return `<div class="form-card" id="the-form">
    <h3 id="form-title">Nouveau membre</h3>
    <div class="form-grid">
      <div class="form-row"><label>Nom complet *</label><input type="text" id="mb-nom" placeholder="Ex: Léa Martin"></div>
      <div class="form-row"><label>Initiales *</label><input type="text" id="mb-initiales" placeholder="Ex: LM" maxlength="3"></div>
    </div>
    <div class="form-grid">
      <div class="form-row"><label>Rôle *</label><input type="text" id="mb-role" placeholder="Ex: Responsable comm."></div>
      <div class="form-row">
        <label>Pôle *</label>
        <select id="mb-pole">
          ${(data.config?.poles || [{key:'bureau',label:'Bureau exécutif'},{key:'evenements',label:'Pôle Événements'},{key:'communication',label:'Pôle Communication'}]).map(p => `<option value="${p.key}">${p.label}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <label>Photo (depuis l'ordi)</label>
      <input type="file" id="mb-photo" accept="image/*" onchange="onMembrePhotoSelected()">
    </div>
    <div class="media-preview-wrap" id="mb-preview-wrap">
      <img loading="lazy" decoding="async" id="mb-preview-img" style="width:80px;height:80px;border-radius:50%;object-fit:cover;">
    </div>
    <div class="form-actions">
      <button class="btn-cancel" onclick="cancelForm()">Annuler</button>
      <button class="btn-save" id="btn-save-membre" onclick="saveMembre()">Publier</button>
    </div>
  </div>`;
}

function formArchive() {
  return `<div class="form-card" id="the-form">
    <h3 id="form-title">Nouvel événement passé</h3>
    <div class="form-row"><label>Titre *</label><input type="text" id="ar-titre" placeholder="Ex: Soirée Intégration L1"></div>
    <div class="form-grid">
      <div class="form-row"><label>Jour *</label><input type="text" id="ar-day" placeholder="Ex: 15" maxlength="2"></div>
      <div class="form-row"><label>Mois *</label><input type="text" id="ar-month" placeholder="Ex: Mar"></div>
    </div>
    <div class="form-row"><label>Lieu / description</label><input type="text" id="ar-lieu" placeholder="Ex: Ninkasi Gerland · ~120 participants"></div>
    <div class="form-row">
      <label>Catégorie *</label>
      <select id="ar-tag">
        <option value="Soirée">Soirée</option>
        <option value="Afterwork">Afterwork</option>
        <option value="Culturel">Culturel</option>
        <option value="BDE">BDE</option>
        <option value="Sport">Sport</option>
        <option value="Autre">Autre</option>
      </select>
    </div>
    <div class="form-actions">
      <button class="btn-cancel" onclick="cancelForm()">Annuler</button>
      <button class="btn-save" onclick="saveArchive()">Publier</button>
    </div>
  </div>`;
}

function formGalerie() {
  return `<div class="form-card" id="the-form">
    <h3 id="form-title">Nouvelle photo</h3>
    <div class="form-row">
      <label>Photo(s) * - sélectionne-en plusieurs d'un coup</label>
      <input type="file" id="gl-file" accept="image/*" multiple onchange="onGalerieSelected()">
    </div>
    <div id="gl-preview-wrap" style="display:none;display:flex;flex-wrap:wrap;gap:8px;margin-top:0.75rem;"></div>
    <div class="form-row" style="margin-top:0.75rem;" id="gl-titre-row">
      <label>Légende commune (optionnelle)</label>
      <input type="text" id="gl-titre" placeholder="Ex: Soirée de rentrée 2025">
    </div>
    <div class="form-actions">
      <button class="btn-cancel" onclick="cancelForm()">Annuler</button>
      <button class="btn-save" id="btn-save-galerie" onclick="saveGalerie()">Ajouter</button>
    </div>
  </div>`;
}

function formPartenaire() {
  return `<div class="form-card" id="the-form">
    <h3 id="form-title">Nouveau partenaire</h3>
    <div class="form-row"><label>Nom *</label><input type="text" id="pt-nom" placeholder="Ex: Ninkasi"></div>
    <div class="form-row"><label>Description courte (carte)</label><input type="text" id="pt-desc" placeholder="Ex: -15% sur tout le magasin"></div>
    <div class="form-row"><label>Description longue (modale)</label><textarea id="pt-desc-long" rows="4" placeholder="Ex: Ninkasi est un incontournable de la vie étudiante à Lyon. Grâce à notre partenariat, tous les étudiants CREAD bénéficient d'une réduction de 15% sur les boissons et la restauration, tous les jours de la semaine…" style="width:100%;padding:8px 10px;border:1px solid var(--gris-border,#e5e7eb);border-radius:8px;font-family:inherit;font-size:14px;resize:vertical;"></textarea></div>
    <div class="form-row">
      <label>Code promo (optionnel)</label>
      <input type="text" id="pt-code-promo" placeholder="Ex: CREAD15" style="text-transform:uppercase;letter-spacing:1px;">
    </div>
    <div class="form-row">
      <label>Lien du site</label>
      <input type="url" id="pt-lien" placeholder="https://…">
    </div>
    <div class="form-row">
      <label>Lien direct promotion (optionnel - sinon on utilise le lien du site)</label>
      <input type="url" id="pt-lien-promo" placeholder="https://…/promo-cread">
    </div>
    <div class="form-row">
      <label>Logo (optionnel)</label>
      <input type="file" id="pt-logo" accept="image/*" onchange="onPartenaireLogoSelected()">
    </div>
    <div class="media-preview-wrap" id="pt-preview-wrap">
      <img loading="lazy" decoding="async" id="pt-preview-img" style="display:none;max-height:80px;object-fit:contain;">
    </div>
    <div class="form-actions">
      <button class="btn-cancel" onclick="cancelForm()">Annuler</button>
      <button class="btn-save" id="btn-save-partenaire" onclick="savePartenaire()">Ajouter</button>
    </div>
  </div>`;
}

function formMedia() {
  return `<div class="form-card" id="the-form">
    <h3 id="form-title">Nouveau média</h3>
    <div class="form-row">
      <label>Fichier(s) * - sélectionne-en plusieurs d'un coup</label>
      <input type="file" id="vi-file" accept="image/*,video/*" multiple onchange="onMediaSelected()">
      <p id="vi-size-warn" style="margin-top:0.5rem;font-size:12px;color:#c0392b;line-height:1.5;"></p>
      <p style="margin-top:0.4rem;font-size:11px;color:var(--gris-texte);">Photos OK · Vidéos MP4 max 25 Mo.</p>
    </div>
    <div id="vi-preview-wrap" style="display:none;flex-wrap:wrap;gap:8px;margin-top:0.75rem;"></div>
    <div class="form-row" style="margin-top:0.75rem;">
      <label>Titre commun (optionnel)</label>
      <input type="text" id="vi-titre" placeholder="Ex: Soirée de rentrée 2025">
    </div>
    <div class="form-actions">
      <button class="btn-cancel" onclick="cancelForm()">Annuler</button>
      <button class="btn-save" id="btn-save-media" onclick="saveMedia()">Ajouter</button>
    </div>
  </div>`;
}

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

// Regénère les <option> d'un select depuis une liste {key,label}, en préservant la valeur si possible
function rebuildSelectOptions(selectId, items, fallback) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const list = (items && items.length) ? items : (fallback || []);
  const prev = sel.value;
  sel.innerHTML = list.map(o => `<option value="${o.key}">${o.label}</option>`).join('');
  if (list.some(o => o.key === prev)) sel.value = prev;
}
function refreshAnCategorieSelect() {
  rebuildSelectOptions('an-categorie', data['annonces-categories'], [
    { key:'materiel', label:'Matériel' }, { key:'place', label:'Places' },
    { key:'logement', label:'Logement' }, { key:'autre', label:'Autre' }
  ]);
}
function refreshMbPoleSelect() {
  rebuildSelectOptions('mb-pole', data.config?.poles, [
    { key:'bureau', label:'Bureau exécutif' },
    { key:'evenements', label:'Pôle Événements' },
    { key:'communication', label:'Pôle Communication' }
  ]);
}

function showForm() {
  if (currentType === 'annonces') refreshAnCategorieSelect();
  if (currentType === 'equipe') refreshMbPoleSelect();
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
    ['pt-nom','pt-desc','pt-desc-long','pt-code-promo','pt-lien','pt-lien-promo'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
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
    const [hD, hF] = (ev.horaire || '').split(/\s*[–\-]\s*/);
    document.getElementById('ev-horaire-debut').value = hD ? hD.replace('h',':') : '';
    document.getElementById('ev-horaire-fin').value = hF ? hF.replace('h',':') : '';
    document.getElementById('ev-prix').value = (ev.prix || '').replace(/€/g, '').trim();
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
    refreshAnCategorieSelect();
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
    refreshMbPoleSelect();
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
        ? `<img loading="lazy" decoding="async" src="${rawUrl}" style="width:80px;height:60px;object-fit:cover;border-radius:6px;">`
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
    document.getElementById('pt-desc-long').value = pt.description_longue || '';
    document.getElementById('pt-code-promo').value = pt.code_promo || '';
    document.getElementById('pt-lien').value = pt.lien || '';
    document.getElementById('pt-lien-promo').value = pt.lien_promo || '';
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
    // Suppression de l'event dans Supabase si c'est un événement agenda
    if (type === 'evenements' && item.titre && window.Auth?.sb) {
      try {
        const key = `${item.titre.toLowerCase().trim()}|${item.date || ''}`;
        const { data: sbEvs } = await window.Auth.sb.from('evenements').select('id, titre, date');
        const match = (sbEvs || []).find(e => `${(e.titre||'').toLowerCase().trim()}|${e.date||''}` === key);
        if (match) await window.Auth.sb.from('evenements').delete().eq('id', match.id);
      } catch(e) { /* pas bloquant */ }
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
  const rawPrix = document.getElementById('ev-prix').value.trim().replace(/€/g, '').replace(',', '.').trim();
  const prix = rawPrix ? (rawPrix.replace('.', ',') + '€') : '';
  const description = document.getElementById('ev-description').value.trim();
  if (!titre || !date) return showToast('Titre et date obligatoires', 'error');
  const horaire = debut && fin ? debut.replace(':','h') + ' – ' + fin.replace(':','h') : (debut ? debut.replace(':','h') : '');
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
  let lienNorm = document.getElementById('ev-lien').value.trim();
  if (lienNorm && !/^https?:\/\//i.test(lienNorm) && !/^mailto:/i.test(lienNorm)) {
    lienNorm = 'https://' + lienNorm.replace(/^\/+/, '');
  }
  const ev = { titre, date, dateAffichage, horaire, lieu, adresse: document.getElementById('ev-adresse').value.trim(), description, prix, categorie, imageUrl, lien: lienNorm, typeLien: document.getElementById('ev-typeLien').value, phare, ...(inscrits > 0 ? { inscrits } : {}) };
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
// SYNC GOOGLE AGENDA
// ============================================================
async function syncGcal() {
  const btn = document.getElementById('btn-gcal-sync');
  if (btn) { btn.disabled = true; btn.textContent = 'Synchronisation…'; }
  try {
    const res = await fetch('/api/gcal-events');
    if (!res.ok) throw new Error('Erreur réseau ' + res.status);
    const gcalEvents = await res.json();
    if (!Array.isArray(gcalEvents)) throw new Error(gcalEvents.error || 'Réponse invalide');

    const existing = data.evenements || [];
    const keyOf = e => `${(e.titre||'').toLowerCase().trim()}|${e.date||''}`;
    const existingKeys = new Set(existing.map(keyOf));

    const toAdd = gcalEvents.filter(e => !existingKeys.has(keyOf(e)));
    if (!toAdd.length) { showToast('Déjà à jour - aucun nouvel événement', 'success'); return; }

    for (const e of toAdd) {
      data.evenements.push({
        titre: e.titre,
        date: e.date,
        dateAffichage: e.date ? new Date(e.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) : '',
        horaire: e.horaire || '',
        horaireDebut: e.horaireDebut || '',
        horaireFin: e.horaireFin || '',
        lieu: e.lieu || '',
        adresse: '',
        description: e.description || '',
        prix: '',
        categorie: 'soiree',
        imageUrl: '',
        lien: '',
        typeLien: 'billetterie',
        phare: false,
      });
    }
    // Trier par date
    data.evenements.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    await persistData('evenements', `Sync Google Agenda : +${toAdd.length} event${toAdd.length > 1 ? 's' : ''}`);
    openEditor('evenements', false, 'Agenda', 'Événements');
    showToast(`${toAdd.length} événement${toAdd.length > 1 ? 's' : ''} importé${toAdd.length > 1 ? 's' : ''} depuis Google Agenda !`, 'success');
  } catch(e) {
    showToast('Erreur sync : ' + e.message, 'error');
  } finally {
    const b = document.getElementById('btn-gcal-sync');
    if (b) { b.disabled = false; b.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> Sync Google Agenda'; }
  }
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

// File d'attente globale : un seul commit GitHub à la fois pour éviter les force-push concurrents
let _commitQueue = Promise.resolve();

// Commit une liste d'entrées { path, blobSha } en un seul commit avec retry
async function commitEntries(entries, message) {
  const result = _commitQueue.then(() => _doCommitEntries(entries, message));
  _commitQueue = result.catch(() => {});
  return result;
}
async function _doCommitEntries(entries, message) {
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
      body: JSON.stringify({ sha: newCommitSha, force: true })
    });
    if (patchRes.ok) return;
    const patchBody = await patchRes.json();
    if (attempt < 2) { await new Promise(r => setTimeout(r, 800)); continue; }
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

async function togglePartenaireActif(idx) {
  const pt = data.partenaires[idx];
  if (!pt) return;
  const newActif = !(pt.actif !== false);
  pt.actif = newActif;
  // Re-render immédiat (optimiste) pour feedback visuel instantané
  openEditor('partenaires', false, 'Partenaires', 'Sponsors & partenaires');
  showToast(newActif ? 'Partenaire activé…' : 'Partenaire désactivé…', 'info');
  try {
    await persistData('partenaires', `${newActif ? 'Activation' : 'Désactivation'} partenaire : ${pt.nom}`);
    showToast(newActif ? 'Partenaire activé ✓' : 'Partenaire désactivé ✓', 'success');
  } catch (e) {
    pt.actif = !newActif;
    openEditor('partenaires', false, 'Partenaires', 'Sponsors & partenaires');
    showToast('Erreur : ' + e.message, 'error');
  }
}

async function savePartenaire() {
  const nom = document.getElementById('pt-nom').value.trim();
  if (!nom) return showToast('Le nom est obligatoire', 'error');
  const description = document.getElementById('pt-desc').value.trim();
  const description_longue = document.getElementById('pt-desc-long').value.trim();
  const code_promo = document.getElementById('pt-code-promo').value.trim().toUpperCase();
  const lien = document.getElementById('pt-lien').value.trim();
  const lien_promo = document.getElementById('pt-lien-promo').value.trim();
  const file = document.getElementById('pt-logo')?.files[0];
  const idx = editIndex.partenaire;
  const btn = document.getElementById('btn-save-partenaire');
  btn.textContent = 'Envoi…'; btn.disabled = true;
  try {
    let logo = idx >= 0 ? (data.partenaires[idx].logo || '') : '';
    if (file) { const up = await uploadMedia(file); logo = up.url; }
    const actif = idx >= 0 ? (data.partenaires[idx].actif !== false) : true;
    const pt = { nom, description, description_longue, code_promo, lien, lien_promo, logo, actif };
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

// ============================================================
// AUTOCOMPLETE LIEU
// ============================================================
let nominatimTimer = null;
function initLieuAutocomplete() {
  const input = document.getElementById('ev-adresse');
  const list = document.getElementById('lieu-suggestions');
  if (!input) return;
  input.addEventListener('input', () => {
    clearTimeout(nominatimTimer);
    const q = input.value.trim();
    if (q.length < 3) { list.style.display = 'none'; return; }
    nominatimTimer = setTimeout(() => searchLieu(q), 350);
  });
  document.addEventListener('click', e => { if (!e.target.closest('.autocomplete-wrap')) list.style.display = 'none'; });
}
async function searchLieu(q) {
  const list = document.getElementById('lieu-suggestions');
  try {
    const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=6&autocomplete=1`);
    const json = await res.json();
    const results = json.features || [];
    if (!results.length) { list.innerHTML = '<div class="autocomplete-item" style="color:var(--gris-texte);cursor:default;">Aucun résultat</div>'; list.style.display = 'block'; return; }
    list.innerHTML = results.map((r, i) => {
      const p = r.properties;
      return `<div class="autocomplete-item" onclick="selectLieu(${i})"><strong>${p.label}</strong></div>`;
    }).join('');
    list._results = results;
    list.style.display = 'block';
  } catch(e) { list.style.display = 'none'; }
}
function selectLieu(i) {
  const list = document.getElementById('lieu-suggestions');
  const p = list._results[i].properties;
  document.getElementById('ev-adresse').value = p.label;
  list.style.display = 'none';
}

