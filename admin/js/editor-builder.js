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
  data['annonces-categories'][i].label = newLabel;
  data['annonces-categories'][i].key = newLabel.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
  await persistData('annonces-categories', `Renommage catégorie : ${newLabel}`);
  openEditor('annonces', false, 'Annonces', 'Annonces');
  showToast('Catégorie mise à jour !', 'success');
}
async function addAnCat() {
  const label = document.getElementById('an-cat-new-input').value.trim();
  if (!label) return showToast('Saisis un nom de catégorie', 'error');
  const key = label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
  if (data['annonces-categories'].some(c => c.key === key)) return showToast('Cette catégorie existe déjà', 'error');
  data['annonces-categories'].push({ key, label });
  await persistData('annonces-categories', `Nouvelle catégorie : ${label}`);
  openEditor('annonces', false, 'Annonces', 'Annonces');
  showToast('Catégorie ajoutée !', 'success');
}
async function deleteAnCat(i) {
  const cat = data['annonces-categories'][i];
  const used = (data.annonces || []).some(a => a.categorie === cat.key);
  if (used) return showToast(`"${cat.label}" est utilisée par des annonces existantes`, 'error');
  if (!confirm(`Supprimer la catégorie "${cat.label}" ?`)) return;
  data['annonces-categories'].splice(i, 1);
  await persistData('annonces-categories', `Suppression catégorie : ${cat.label}`);
  openEditor('annonces', false, 'Annonces', 'Annonces');
  showToast('Catégorie supprimée', 'success');
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
        ? `<img src="${photoUrl}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;flex-shrink:0;">`
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

function buildParametresEditor() {
  const cfg = data.config || { chiffres: [{number:'',label:''},{number:'',label:''},{number:'',label:''},{number:'',label:''}], contact: { email:'', instagram:'' }, canaux: [] };
  const chiffresHtml = (cfg.chiffres || []).map((c, i) => `
    <div class="form-grid" style="margin-bottom:0.75rem;">
      <div class="form-row"><label>Nombre ${i+1}</label><input type="text" id="cfg-num-${i}" value="${c.number || ''}" placeholder="Ex: 350+"></div>
      <div class="form-row"><label>Libellé ${i+1}</label><input type="text" id="cfg-lbl-${i}" value="${c.label || ''}" placeholder="Ex: Étudiants CREAD"></div>
    </div>`).join('');
  const PICTO_LIST = [
    { key:'instagram', label:'Instagram' },
    { key:'whatsapp', label:'WhatsApp' },
    { key:'email', label:'Email' },
    { key:'discord', label:'Discord' },
    { key:'facebook', label:'Facebook' },
    { key:'linkedin', label:'LinkedIn' },
    { key:'tiktok', label:'TikTok' },
    { key:'youtube', label:'YouTube' },
    { key:'telephone', label:'Téléphone' },
    { key:'site', label:'Site web' },
    { key:'teams', label:'Teams' },
    { key:'autre', label:'Autre' },
  ];
  const PICTO_SVG = {
    instagram:`<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>`,
    whatsapp:`<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`,
    email:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
    discord:`<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>`,
    facebook:`<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
    linkedin:`<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`,
    tiktok:`<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>`,
    youtube:`<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>`,
    telephone:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .84h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>`,
    site:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>`,
    teams:`<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19.5 3.5L18 2l-1.5 1.5L15 2l-1.5 1.5L12 2l-1.5 1.5L9 2 7.5 3.5 6 2 4.5 3.5 3 2v20l1.5-1.5L6 22l1.5-1.5L9 22l1.5-1.5L12 22l1.5-1.5L15 22l1.5-1.5L18 22l1.5-1.5L21 22V2l-1.5 1.5zm-1.5 15H6V5.5h12V18.5zM8 13h8v1.5H8zm0-3h8v1.5H8zm0-3h8v1.5H8z"/></svg>`,
    autre:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>`,
  };
  const canauxHtml = (cfg.canaux || []).map((c, i) => {
    const selected = c.picto || c.type || 'autre';
    const pickerHtml = PICTO_LIST.map(p => `
      <button type="button" onclick="selectPicto(${i},'${p.key}')" id="picto-btn-${i}-${p.key}"
        title="${p.label}"
        style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 10px;border-radius:8px;border:2px solid ${selected===p.key?'var(--violet)':'var(--gris-border)'};background:${selected===p.key?'#f3eeff':'white'};cursor:pointer;color:${selected===p.key?'var(--violet)':'var(--gris-texte)'};transition:all .15s;">
        ${PICTO_SVG[p.key]}
        <span style="font-size:10px;font-weight:500;">${p.label}</span>
      </button>`).join('');
    return `
    <div style="border:1px solid var(--gris-border);border-radius:10px;padding:1rem;margin-bottom:0.75rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
        <strong style="font-size:13px;">Canal ${i+1}</strong>
        <button type="button" onclick="removeCanalRow(${i})" style="background:none;border:none;cursor:pointer;color:var(--rouge,#c0392b);font-size:12px;">Supprimer</button>
      </div>
      <div class="form-row"><label>Nom</label><input type="text" id="cn-nom-${i}" value="${c.nom || ''}" placeholder="Ex: Instagram"></div>
      <div class="form-row" style="flex-direction:column;align-items:flex-start;">
        <label>Icône</label>
        <input type="hidden" id="cn-picto-${i}" value="${selected}">
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">${pickerHtml}</div>
      </div>
      <div class="form-row"><label>Description</label><input type="text" id="cn-desc-${i}" value="${c.description || ''}" placeholder="Ex: Notre canal principal"></div>
      <div class="form-grid">
        <div class="form-row"><label>Lien <span style="font-weight:400;color:var(--gris-texte);font-size:11px;">(URL ou mailto:)</span></label><input type="text" id="cn-lien-${i}" value="${c.lien || ''}" placeholder="https://... ou mailto:..."></div>
        <div class="form-row"><label>Label du lien</label><input type="text" id="cn-label-${i}" value="${c.lienLabel || ''}" placeholder="Ex: @bdecreadien"></div>
      </div>
      <div class="form-row" style="flex-direction:row;align-items:center;gap:0.5rem;">
        <input type="checkbox" id="cn-bientot-${i}" ${c.bientot?'checked':''} style="width:auto;">
        <label for="cn-bientot-${i}" style="margin:0;font-weight:400;">Afficher comme "Bientôt" (pas encore actif)</label>
      </div>
    </div>`;
  }).join('');
  return `
    <div class="params-card">
      <h3>Chiffres clés <span style="font-size:12px;font-weight:400;color:var(--gris-texte);">(affichés sur la page d'accueil)</span></h3>
      ${chiffresHtml}
    </div>
    <div class="params-card">
      <h3>Contact & réseaux</h3>
      <div class="form-row"><label>Email de contact</label><input type="email" id="cfg-email" value="${cfg.contact?.email || ''}" placeholder="bdecreadien@gmail.com"></div>
      <div class="form-row"><label>Instagram <span style="font-weight:400;color:var(--gris-texte);font-size:12px;">(sans le @)</span></label><input type="text" id="cfg-insta" value="${cfg.contact?.instagram || ''}" placeholder="bdecreadien"></div>
    </div>
    <div class="params-card" id="canaux-editor">
      <h3>Canaux de communication <span style="font-size:12px;font-weight:400;color:var(--gris-texte);">(page Communication)</span></h3>
      <div id="canaux-rows">${canauxHtml}</div>
      <button type="button" class="btn-add" onclick="addCanalRow()" style="margin-top:0.5rem;">+ Ajouter un canal</button>
    </div>
    <div class="form-actions" style="justify-content:flex-end;">
      <button class="btn-save" onclick="saveParametres()">Enregistrer les paramètres</button>
    </div>`;
}

function selectPicto(i, key) {
  document.getElementById(`cn-picto-${i}`).value = key;
  document.querySelectorAll(`[id^="picto-btn-${i}-"]`).forEach(btn => {
    const isSelected = btn.id === `picto-btn-${i}-${key}`;
    btn.style.borderColor = isSelected ? 'var(--violet)' : 'var(--gris-border)';
    btn.style.background = isSelected ? '#f3eeff' : 'white';
    btn.style.color = isSelected ? 'var(--violet)' : 'var(--gris-texte)';
  });
}

function addCanalRow() {
  const cfg = data.config || {};
  cfg.canaux = cfg.canaux || [];
  cfg.canaux.push({ nom:'', type:'autre', description:'', lien:'', lienLabel:'', bientot:false });
  data.config = cfg;
  document.getElementById('editor-content').innerHTML = buildParametresEditor();
}

function removeCanalRow(i) {
  if (!data.config?.canaux) return;
  data.config.canaux.splice(i, 1);
  document.getElementById('editor-content').innerHTML = buildParametresEditor();
}

async function saveParametres() {
  const chiffres = [0,1,2,3].map(i => ({
    number: document.getElementById(`cfg-num-${i}`)?.value.trim() || '',
    label: document.getElementById(`cfg-lbl-${i}`)?.value.trim() || ''
  }));
  const email = document.getElementById('cfg-email').value.trim();
  const instagram = document.getElementById('cfg-insta').value.trim();
  const nbCanaux = (data.config?.canaux || []).length;
  const canaux = Array.from({length: nbCanaux}, (_, i) => ({
    nom: document.getElementById(`cn-nom-${i}`)?.value.trim() || '',
    picto: document.getElementById(`cn-picto-${i}`)?.value || 'autre',
    type: document.getElementById(`cn-picto-${i}`)?.value || 'autre',
    description: document.getElementById(`cn-desc-${i}`)?.value.trim() || '',
    lien: document.getElementById(`cn-lien-${i}`)?.value.trim() || '',
    lienLabel: document.getElementById(`cn-label-${i}`)?.value.trim() || '',
    bientot: document.getElementById(`cn-bientot-${i}`)?.checked || false
  }));
  const poles = data.config?.poles || [];
  data.config = { chiffres, contact: { email, instagram }, canaux, poles };
  try {
    await persistData('config', 'Mise à jour paramètres site');
    showToast('Paramètres enregistrés !', 'success');
  } catch(e) { showToast('Erreur : ' + e.message, 'error'); }
}

async function addPole() {
  const label = document.getElementById('new-pole-label').value.trim();
  const key = document.getElementById('new-pole-key').value.trim().toLowerCase().replace(/\s+/g, '-');
  if (!label || !key) return showToast('Nom et clé requis', 'error');
  if (!data.config) data.config = {};
  if (!data.config.poles) data.config.poles = [];
  if (data.config.poles.find(p => p.key === key)) return showToast('Cette clé existe déjà', 'error');
  data.config.poles.push({ key, label });
  try {
    await persistData('config', 'Ajout pôle : ' + label);
    showToast('Pôle ajouté !', 'success');
    document.getElementById('editor-content').innerHTML = buildEquipeEditor();
  } catch(e) { showToast('Erreur : ' + e.message, 'error'); }
}

async function removePole(i) {
  const poles = data.config?.poles || [];
  const pole = poles[i];
  if (!pole) return;
  if (data.equipe.some(m => m.pole === pole.key)) return showToast('Impossible : des membres sont dans ce pôle', 'error');
  poles.splice(i, 1);
  data.config.poles = poles;
  try {
    await persistData('config', 'Suppression pôle : ' + pole.label);
    showToast('Pôle supprimé', 'success');
    document.getElementById('editor-content').innerHTML = buildEquipeEditor();
  } catch(e) { showToast('Erreur : ' + e.message, 'error'); }
}

async function moveEquipe(i, dir) {
  const pole = data.equipe[i].pole;
  const poleMembers = data.equipe.map((m, idx) => ({ m, idx })).filter(({ m }) => m.pole === pole);
  const posInPole = poleMembers.findIndex(({ idx }) => idx === i);
  const swapPos = dir === 'up' ? posInPole - 1 : posInPole + 1;
  if (swapPos < 0 || swapPos >= poleMembers.length) return;
  const j = poleMembers[swapPos].idx;
  [data.equipe[i], data.equipe[j]] = [data.equipe[j], data.equipe[i]];
  try {
    await persistData('equipe', 'Réorganisation équipe');
    openEditor('equipe', false, 'Communication', 'Équipe BDE');
  } catch(e) { showToast('Erreur : ' + e.message, 'error'); }
}

function buildGalerieEditor() {
  const items = data.galerie || [];
  const cards = items.length ? items.map((item, i) => {
    const rawUrl = item.url.startsWith('/') ? `https://raw.githubusercontent.com/${REPO}/main${item.url}` : item.url;
    return `<div class="galerie-admin-card" id="gl-card-${i}">
      <img src="${rawUrl}" alt="${item.titre || ''}" loading="lazy">
      <div class="galerie-admin-card-body">
        <textarea class="galerie-admin-caption" rows="2" placeholder="Légende (optionnelle)…" onchange="galerieCaption(${i},this.value)">${item.titre || ''}</textarea>
      </div>
      <div class="galerie-admin-card-footer">
        <button class="galerie-move-btn" onclick="galerieMove(${i},'left')" title="Déplacer à gauche" ${i===0?'disabled':''}">◀</button>
        <button class="galerie-move-btn" onclick="galerieMove(${i},'right')" title="Déplacer à droite" ${i===items.length-1?'disabled':''}">▶</button>
        <button class="galerie-del-btn" onclick="galerieDelete(${i})" title="Supprimer">✕</button>
      </div>
    </div>`;
  }).join('') : '';

  return `
    <div class="galerie-admin-header">
      <div>
        <span class="galerie-admin-count">${items.length} photo${items.length>1?'s':''}</span>
      </div>
      <div class="galerie-admin-actions">
        <button class="galerie-save-btn" onclick="galerieSaveAll()">Enregistrer les légendes</button>
        <button class="galerie-upload-btn" onclick="document.getElementById('gl-upload-input').click()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Ajouter des photos
        </button>
        <input type="file" id="gl-upload-input" accept="image/*" multiple style="display:none" onchange="galerieUploadFiles(this.files)">
      </div>
    </div>
    <div class="galerie-admin-grid" id="galerie-admin-grid">
      ${cards}
      <div class="galerie-admin-drop" id="galerie-drop-zone" onclick="document.getElementById('gl-upload-input').click()" ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')" ondrop="event.preventDefault();this.classList.remove('drag-over');galerieUploadFiles(event.dataTransfer.files)">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 0.75rem;display:block;opacity:0.4"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        <p style="font-weight:600;margin-bottom:0.25rem;">Glisse tes photos ici</p>
        <p style="font-size:12px;opacity:0.7;">ou clique pour sélectionner</p>
      </div>
    </div>`;
}

function buildEditor(type) {
  if (type === 'equipe') return buildEquipeEditor();
  if (type === 'galerie') return buildGalerieEditor();
  if (type === 'videos') return buildVideosEditor();

  const items = data[type] || [];
  const listHtml = items.length
    ? items.map((item, i) => {
        let title = '', sub = '';
        if (type === 'evenements') { title = item.titre; sub = `${item.dateAffichage} — ${item.lieu}${item.inscrits ? ` · ${item.inscrits} inscrits` : ''}`; }
        if (type === 'annonces') { title = item.titre; sub = `${item.prix} · ${item.auteur}`; }
        if (type === 'archives') { title = item.titre; sub = `${item.day} ${item.month} — ${item.lieu}`; }
        if (type === 'partenaires') { title = item.nom; sub = item.description || item.lien || ''; }

        // Galerie : carte photo
        if (type === 'galerie') {
          const rawUrl = item.url.startsWith('/') ? `https://raw.githubusercontent.com/${REPO}/main${item.url}` : item.url;
          return `<div class="item-card">
            <img src="${rawUrl}" style="width:80px;height:60px;object-fit:cover;border-radius:8px;flex-shrink:0;">
            <div class="item-card-info"><div class="item-card-title">${item.titre || '(sans titre)'}</div><div class="item-card-sub" style="display:flex;align-items:center;gap:4px;"><svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Photo</div></div>
            <div class="item-card-actions">
              <button class="btn-edit" onclick="editItem('galerie',${i})">Modifier</button>
              <button class="btn-delete" onclick="deleteItem('galerie',${i})">Supprimer</button>
            </div></div>`;
        }

        // Médias : carte avec prévisualisation
        if (type === 'videos') {
          const rawUrl = item.url.startsWith('/') ? `https://raw.githubusercontent.com/${REPO}/main${item.url}` : item.url;
          const thumb = item.type === 'photo'
            ? `<img src="${rawUrl}" style="width:80px;height:60px;object-fit:cover;border-radius:8px;flex-shrink:0;">`
            : `<video src="${rawUrl}" style="width:80px;height:60px;object-fit:cover;border-radius:8px;flex-shrink:0;" preload="metadata" muted></video>`;
          return `<div class="item-card">
            ${thumb}
            <div class="item-card-info"><div class="item-card-title">${item.titre || '(sans titre)'}</div><div class="item-card-sub" style="display:flex;align-items:center;gap:4px;">${item.type === 'photo' ? `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Photo` : `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg> Vidéo`}</div></div>
            <div class="item-card-actions">
              <button class="btn-edit" onclick="editItem('${type}',${i})">Modifier</button>
              <button class="btn-delete" onclick="deleteItem('${type}',${i})">Supprimer</button>
            </div></div>`;
        }

        // Équipe : géré séparément par buildEquipeEditor()
        if (type === 'equipe') return '';

        const archiveBtn = type === 'evenements' ? `<button class="btn-edit" onclick="archiveEvenement(${i})" style="background:#f5f0ff;color:var(--violet);border-color:#d4c4f5;" title="Déplacer en archives">Archiver</button>` : '';
        return `<div class="item-card">
          <div class="item-card-info"><div class="item-card-title">${title}</div><div class="item-card-sub">${sub}</div></div>
          <div class="item-card-actions">
            <div style="display:flex;flex-direction:column;gap:2px;margin-right:4px;">
              <button onclick="moveItem('${type}',${i},'up')" style="background:none;border:1px solid var(--gris-border);border-radius:4px;padding:1px 5px;cursor:pointer;font-size:11px;color:var(--gris-texte);" title="Monter">↑</button>
              <button onclick="moveItem('${type}',${i},'down')" style="background:none;border:1px solid var(--gris-border);border-radius:4px;padding:1px 5px;cursor:pointer;font-size:11px;color:var(--gris-texte);" title="Descendre">↓</button>
            </div>
            ${archiveBtn}
            <button class="btn-edit" onclick="editItem('${type}',${i})">Modifier</button>
            <button class="btn-delete" onclick="deleteItem('${type}',${i})">Supprimer</button>
          </div></div>`;
      }).join('')
    : '<div class="empty-state">Aucun élément pour l\'instant.</div>';

  const formHtml = type === 'evenements' ? formEvenement()
    : type === 'annonces' ? formAnnonce()
    : type === 'equipe' ? formMembre()
    : type === 'archives' ? formArchive()
    : type === 'galerie' ? formGalerie()
    : type === 'partenaires' ? formPartenaire()
    : formMedia();

  const addLabel = type === 'evenements' ? 'Ajouter un événement'
    : type === 'annonces' ? 'Ajouter une annonce'
    : type === 'equipe' ? 'Ajouter un membre'
    : type === 'archives' ? 'Ajouter un événement passé'
    : type === 'galerie' ? 'Ajouter une photo'
    : type === 'partenaires' ? 'Ajouter un partenaire'
    : 'Ajouter un média';

  const categoriesPanel = type === 'annonces' ? buildAnCategoriesPanel() : '';

  return `
    ${categoriesPanel}
    <div class="items-list" id="items-list">${listHtml}</div>
    ${formHtml}
    <button class="btn-add" id="btn-add" onclick="showForm()">+ ${addLabel}</button>`;
}

function buildVideosEditor() {
  const items = data.videos || [];
  const cards = items.map((item, i) => {
    const rawUrl = item.url.startsWith('/') ? `https://raw.githubusercontent.com/${REPO}/main${item.url}` : item.url;
    const media = item.type === 'photo'
      ? `<img src="${rawUrl}" alt="${item.titre || ''}" loading="lazy">`
      : `<video src="${rawUrl}" preload="metadata" muted playsinline style="width:100%;aspect-ratio:4/3;object-fit:cover;display:block;" onclick="this.paused?this.play():this.pause()"></video>`;
    const typeIcon = item.type === 'photo'
      ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Photo`
      : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg> Vidéo`;
    return `<div class="galerie-admin-card" id="vid-card-${i}">
      <div style="position:relative;">${media}<span style="position:absolute;top:8px;left:8px;background:rgba(0,0,0,0.55);color:white;border-radius:6px;padding:3px 8px;font-size:11px;display:flex;align-items:center;gap:4px;">${typeIcon}</span></div>
      <div class="galerie-admin-card-body">
        <div style="font-weight:600;font-size:13px;color:var(--noir);line-height:1.3;">${item.titre || '(sans titre)'}</div>
      </div>
      <div class="galerie-admin-card-footer">
        <button class="galerie-move-btn" onclick="moveItem('videos',${i},'up')" title="Monter" ${i===0?'disabled':''}>◀</button>
        <button class="galerie-move-btn" onclick="moveItem('videos',${i},'down')" title="Descendre" ${i===items.length-1?'disabled':''}>▶</button>
        <div style="display:flex;gap:6px;margin-left:auto;">
          <button class="btn-edit" style="font-size:12px;padding:5px 10px;" onclick="editItem('videos',${i})">Modifier</button>
          <button class="btn-delete" style="font-size:12px;padding:5px 10px;" onclick="deleteItem('videos',${i})">✕</button>
        </div>
      </div>
    </div>`;
  }).join('');

  return `
    <div class="galerie-admin-header">
      <span class="galerie-admin-count">${items.length} média${items.length>1?'s':''}</span>
      <button class="galerie-upload-btn" onclick="document.getElementById('btn-add').click()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Ajouter un média
      </button>
    </div>
    <div class="galerie-admin-grid" id="videos-grid">
      ${cards || '<div class="galerie-admin-drop" style="grid-column:1/-1;pointer-events:none;opacity:0.5;"><p style="font-weight:600;">Aucun média pour l\'instant</p></div>'}
    </div>
    ${formMedia()}
    <button class="btn-add" id="btn-add" onclick="showForm()" style="margin-top:0.5rem;">+ Ajouter un média</button>
    `;
}

function buildStorageEditor() {
  return `<div class="storage-grid" id="storage-grid"></div>
    <div id="storage-empty" class="empty-state" style="display:none;">Aucun fichier dans le stockage.</div>`;
}
