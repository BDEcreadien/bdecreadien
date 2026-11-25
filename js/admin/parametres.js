/* BDE Admin — module « Paramètres du BDE »
   Identité, apparence, contact, site & e-mails, association, modules actifs.
   Stockés dans la table bde_parametres (lisible par tous, modifiable par les admins) et repris
   automatiquement par les pages publiques (js/bde-config.js), l'admin et les mails.
   Les secrets (jetons, clés) ne vont JAMAIS ici : ils restent dans bde_config. */

const BDE_PARAM_ONGLETS = [
  { id: 'identite',  label: 'Identité' },
  { id: 'apparence', label: 'Apparence' },
  { id: 'contact',   label: 'Contact & réseaux' },
  { id: 'site',      label: 'Site & e-mails' },
  { id: 'asso',      label: 'Association' },
  { id: 'modules',   label: 'Modules' },
  { id: 'acces',     label: 'Équipe & accès' },
];

// type : text (défaut) | textarea | email | url | color | image
// requis : bloque l'enregistrement si vide
const BDE_PARAM_SCHEMA = [
  { onglet: 'identite', titre: 'Identité du BDE', champs: [
    { cle: 'nom',         label: 'Nom complet',              ph: 'BDE de mon école', requis: true, aide: 'Affiché dans le menu, les mails et les documents.' },
    { cle: 'nom_court',   label: 'Nom court',                ph: 'MonÉcole' },
    { cle: 'ecole',       label: 'École',                    ph: 'Nom de l\'école' },
    { cle: 'ville',       label: 'Ville',                    ph: 'Ville' },
    { cle: 'slogan',      label: 'Phrase de présentation',   ph: 'Une phrase qui présente le BDE', type: 'textarea', aide: 'Reprise en pied de page.' },
  ]},
  { onglet: 'identite', titre: 'Logo', champs: [
    { cle: 'logo_url',    label: 'Image du logo',            type: 'image', aide: 'Format carré conseillé (min. 200 × 200 px).' },
    { cle: 'logo_ligne1', label: 'Texte à côté du logo, ligne 1', ph: 'BDE' },
    { cle: 'logo_ligne2', label: 'Texte à côté du logo, ligne 2', ph: 'MonÉcole' },
  ]},
  { onglet: 'contact', titre: 'Contact', champs: [
    { cle: 'email_contact', label: 'E-mail de contact', ph: 'contact@monbde.fr', type: 'email' },
    { cle: 'telephone',     label: 'Téléphone',         ph: '06 00 00 00 00' },
    { cle: 'adresse',       label: 'Adresse',           ph: 'Rue, code postal, ville' },
  ]},
  { onglet: 'contact', titre: 'Réseaux sociaux', champs: [
    { cle: 'instagram_handle', label: 'Instagram (sans @)', ph: 'monbde' },
    { cle: 'instagram_url',    label: 'Lien Instagram',     ph: 'https://www.instagram.com/monbde', type: 'url' },
  ]},
  { onglet: 'site', titre: 'Site', champs: [
    { cle: 'site_url', label: 'Adresse du site', ph: 'https://monbde.fr', type: 'url', aide: 'Utilisée dans les liens des mails et des QR codes.' },
  ]},
  { onglet: 'site', titre: 'E-mails automatiques', champs: [
    { cle: 'nom_expediteur',  label: 'Nom affiché de l\'expéditeur', ph: 'BDE de mon école' },
    { cle: 'mail_expediteur', label: 'Adresse d\'envoi',             ph: 'noreply@monbde.fr', type: 'email', aide: 'Le domaine doit être vérifié chez ton service d\'envoi de mails.' },
  ]},
  { onglet: 'asso', titre: 'Association', champs: [
    { cle: 'asso_nom_legal',   label: 'Nom légal',               aide: 'Mentions légales, factures, reçus.' },
    { cle: 'asso_siret',       label: 'SIRET' },
    { cle: 'asso_rna',         label: 'N° RNA' },
    { cle: 'asso_adresse',     label: 'Adresse du siège' },
    { cle: 'asso_responsable', label: 'Responsable de publication' },
  ]},
];

const BDE_MODULES = [
  { id: 'contenu', min: 'membre',     label: 'Contenu du site',         desc: 'Agenda, annonces, médias, équipe, partenaires' },
  { id: 'boutique', min: 'bureau',    label: 'Merchandising',           desc: 'Commandes, stock, vente sur place' },
  { id: 'billetterie', min: 'bureau', label: 'Billetterie',             desc: 'Pages de vente et inscriptions aux événements' },
  { id: 'finances', min: 'bureau',    label: 'Finances',                desc: 'Trésorerie, budget, rapports' },
  { id: 'facturation', min: 'bureau', label: 'Facturation',             desc: 'Factures PDF' },
  { id: 'planning', min: 'bureau',    label: 'Organisation du bureau',  desc: 'Qui aide sur quel événement' },
  { id: 'newsletter', min: 'membre',  label: 'Newsletter',              desc: 'Abonnés et envois' },
  { id: 'fidelite', min: 'membre',    label: 'Cartes de fidélité',      desc: 'Cartes étudiants et tampons' },
  { id: 'liens', min: 'membre',       label: 'Liens',                   desc: 'Page de liens type « linktree »' },
  { id: 'qr', min: 'membre',          label: 'QR code dynamique',       desc: 'Redirection modifiable sans réimpression' },
  { id: 'stats', min: 'membre',       label: 'Statistiques',            desc: 'Fréquentation du site' },
];

// Niveaux d'accès : 1 membre, 2 bureau, 3 admin. `min` = plancher imposé par la base (RLS) : on ne peut pas ouvrir un module en dessous.
const BDE_NIVEAUX = [{ id: 'membre', label: 'Tous les membres du BDE', n: 1 }, { id: 'bureau', label: 'Bureau', n: 2 }, { id: 'admin', label: 'Administrateurs', n: 3 }];

let _bdeAcces = {};        // module -> niveau
let _bdeEquipe = [];
let _bdeParams = {};       // valeurs enregistrées
let _bdeParamDirty = false;
let _bdeParamOnglet = 'identite';

function bdeParamEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

async function initParametresBde() {
  const root = document.getElementById('bde-param-body');
  root.innerHTML = '<p style="color:#888;padding:20px">Chargement…</p>';
  const { data, error } = await Auth.sb.from('bde_parametres').select('cle,valeur');
  if (error) {
    root.innerHTML = '<p style="color:#c0392b;padding:20px">Erreur : ' + bdeParamEsc(error.message) +
      '<br><small>La migration 070_bde_parametres.sql a-t-elle été appliquée ? Seul un administrateur peut modifier ces paramètres.</small></p>';
    return;
  }
  _bdeParams = {};
  (data || []).forEach(r => { _bdeParams[r.cle] = r.valeur; });
  _bdeAcces = {};
  const acc = await Auth.sb.from('bde_acces').select('module,niveau');
  (acc.data || []).forEach(r => { _bdeAcces[r.module] = r.niveau; });
  _bdeParamDirty = false;
  window.onbeforeunload = null;
  bdeParamRender();
}

function bdeParamVal(c) {
  const v = _bdeParams[c.cle];
  return v != null && v !== '' ? v : (c.def || '');
}

function bdeParamChampHtml(c) {
  const v = bdeParamVal(c), id = 'bdep-' + c.cle;
  const aide = c.aide ? `<small class="bdep-aide">${c.aide}</small>` : '';
  const lab = `<label for="${id}">${c.label}${c.requis ? ' <span style="color:#dc2626">*</span>' : ''}</label>`;
  let ctrl;
  if (c.type === 'textarea') ctrl = `<textarea id="${id}" rows="3" placeholder="${bdeParamEsc(c.ph || '')}">${bdeParamEsc(v)}</textarea>`;
  else if (c.type === 'color') ctrl = `<div style="display:flex;gap:10px;align-items:center"><input type="color" id="${id}" value="${bdeParamEsc(v)}" style="width:56px;height:38px;padding:2px"><code id="${id}-hex" style="font-size:12px;color:#64748b">${bdeParamEsc(v)}</code></div>`;
  else if (c.type === 'image') ctrl = `<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
      <img id="${id}-preview" src="${bdeParamEsc(v)}" alt="" style="width:64px;height:64px;border-radius:50%;object-fit:cover;background:#f1f5f9;border:1px solid #e2e8f0">
      <div style="flex:1;min-width:220px"><input type="text" id="${id}" value="${bdeParamEsc(v)}" placeholder="https://… ou /assets/logo.png">
      <label class="bdep-btn" style="margin-top:8px">📷 Envoyer une image<input type="file" accept="image/*" style="display:none" onchange="bdeParamUploadLogo(this)"></label></div></div>`;
  else ctrl = `<input type="${c.type || 'text'}" id="${id}" value="${bdeParamEsc(v)}" placeholder="${bdeParamEsc(c.ph || '')}">`;
  return `<div class="form-row">${lab}${ctrl}${aide}<small class="bdep-err" id="${id}-err"></small></div>`;
}

const RE_HEX = /^#[0-9a-f]{6}$/i;
function bdeParamHexNorm(v) {
  v = String(v || '').trim(); if (v && v[0] !== '#') v = '#' + v;
  if (/^#[0-9a-f]{3}$/i.test(v)) v = '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
  return RE_HEX.test(v) ? v.toLowerCase() : null;
}
// Liste des couleurs enregistrée ; repli sur les trois anciens paramètres
function bdeParamCouleurs() {
  try { const l = JSON.parse(_bdeParams.couleurs || 'null'); if (Array.isArray(l) && l.length) return l; } catch (_) {}
  const l = [_bdeParams.couleur_principale, _bdeParams.couleur_secondaire, _bdeParams.couleur_accent].filter(c => bdeParamHexNorm(c));
  return l.length ? l : ['#2563eb'];
}
function bdeParamCouleurRow(hex) {
  return `<div class="bdep-col-row">
    <input type="color" class="cp" value="${bdeParamEsc(hex)}" aria-label="Choisir la couleur">
    <input type="text" class="hx" value="${bdeParamEsc(hex)}" maxlength="7" placeholder="#2563eb" spellcheck="false" aria-label="Valeur hexadécimale">
    <button type="button" class="bdep-x" title="Supprimer cette couleur" onclick="bdeParamDelCouleur(this)">×</button>
  </div>`;
}
function bdeParamLireCouleurs() {
  return [...document.querySelectorAll('#bdep-couleurs .bdep-col-row')].map(r => bdeParamHexNorm(r.querySelector('.hx').value)).filter(Boolean);
}
// Aperçu en direct : 1 couleur = aplat, plusieurs = dégradé dans l'ordre
function bdeParamPreviewCouleurs() {
  const L = bdeParamLireCouleurs(); if (!L.length) return;
  const g = window.BDE ? BDE.degrade(L, '90deg') : `linear-gradient(90deg,${L.join(',')})`;
  const bar = document.getElementById('bdep-grad-bar'); if (bar) bar.style.background = g;
  const st = document.documentElement.style;
  st.setProperty('--accent', L[0]); st.setProperty('--violet', L[0]);
  st.setProperty('--gradient', window.BDE ? BDE.degrade(L, '135deg') : g);
  const n = document.getElementById('bdep-col-info');
  if (n) n.textContent = L.length === 1 ? 'Une seule couleur : le site utilise cette couleur partout.' : L.length + ' couleurs : le site utilise un dégradé dans cet ordre.';
}
function bdeParamAddCouleur() {
  const rows = document.querySelectorAll('#bdep-couleurs .bdep-col-row');
  if (rows.length >= 6) return showToast('6 couleurs maximum', 'error');
  document.getElementById('bdep-couleurs').insertAdjacentHTML('beforeend', bdeParamCouleurRow('#7c3aed'));
  bdeParamPreviewCouleurs(); bdeParamMarkDirty();
}
function bdeParamDelCouleur(btn) {
  if (document.querySelectorAll('#bdep-couleurs .bdep-col-row').length <= 1) return showToast('Garde au moins une couleur', 'error');
  btn.closest('.bdep-col-row').remove();
  bdeParamPreviewCouleurs(); bdeParamMarkDirty();
}

function bdeParamRender() {
  const couleurs = bdeParamCouleurs();
  const actifs = _bdeParams.modules_actifs ? _bdeParams.modules_actifs.split(',').map(s => s.trim()) : BDE_MODULES.map(m => m.id);

  const style = `<style>
    .bdep-aide{display:block;color:#64748b;font-size:12px;margin-top:4px}
    .bdep-err{display:block;color:#dc2626;font-size:12px;margin-top:4px;min-height:0}
    .bdep-btn{display:inline-block;padding:7px 14px;border:1.5px solid var(--accent);color:var(--accent);border-radius:8px;font-weight:700;font-size:13px;cursor:pointer}
    .bdep-tabs{display:flex;gap:4px;border-bottom:1px solid var(--border,#e2e8f0);margin-bottom:1rem;overflow-x:auto;-webkit-overflow-scrolling:touch}
    .bdep-tab{padding:10px 14px;border:0;background:none;font:inherit;font-weight:500;color:var(--text2,#64748b);cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap}
    .bdep-tab.on{color:var(--accent);border-bottom-color:var(--accent);font-weight:600}
    .bdep-col-row{display:flex;gap:10px;align-items:center;margin-bottom:8px}
    .bdep-col-row .cp{width:48px;height:38px;padding:2px;flex-shrink:0}
    .bdep-col-row .hx{width:130px;font-family:ui-monospace,Menlo,monospace;text-transform:lowercase}
    .bdep-x{border:1px solid var(--border,#e2e8f0);background:#fff;border-radius:8px;width:34px;height:34px;cursor:pointer;color:#dc2626;font-size:16px;flex-shrink:0}
    .bdep-add{margin-top:6px;padding:8px 14px;border:1.5px dashed #cbd5e1;background:none;border-radius:8px;cursor:pointer;font-weight:600;color:#64748b;font-family:inherit}
    .bdep-grad{height:14px;border-radius:7px;margin:14px 0 6px;background:var(--gradient,var(--accent))}
    .bdep-panneau{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:16px;align-items:start}
    .bdep-panneau[hidden]{display:none}
    .bdep-panneau .params-card{margin:0}
    .bdep-panneau.pleine{display:block}
    .bdep-eq{display:flex;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--border,#e2e8f0)}
    .bdep-eq:last-child{border-bottom:0}
    .bdep-eq .qui{flex:1;min-width:0}
    .bdep-eq .qui b{display:block;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .bdep-eq .qui small{color:#64748b;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block}
    .bdep-eq select,.bdep-acc select{width:auto;min-width:150px;max-width:100%}
    .bdep-acc{display:flex;gap:12px;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border,#e2e8f0);flex-wrap:wrap}
    .bdep-acc:last-child{border-bottom:0}
    .bdep-res{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:8px 10px;border:1px solid var(--border,#e2e8f0);border-radius:8px;margin-top:6px;font-size:13px}
    .bdep-mod{display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--border,#e2e8f0);cursor:pointer}
    .bdep-mod:last-child{border-bottom:0}
    .bdep-mod input{width:auto;margin-top:3px}
    .bdep-preview{background:var(--surface,#fff);border:1px solid var(--border,#e2e8f0);border-radius:12px;padding:14px 16px;margin-bottom:1rem;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
    .bdep-preview .pv-brand{display:flex;align-items:center;gap:10px;font-weight:700}
    .bdep-preview img{width:40px;height:40px;border-radius:50%;object-fit:cover;background:#f1f5f9}
    .bdep-preview .pv-l2{font-weight:800;color:var(--accent);margin-left:4px}
    .bdep-preview .pv-btn{margin-left:auto;padding:8px 16px;border-radius:9px;color:#fff;font-weight:700;font-size:13px;background:var(--gradient,var(--accent))}
    .bdep-bar{position:sticky;bottom:0;margin-top:1rem;display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 16px;background:var(--surface,#fff);border:1px solid var(--border,#e2e8f0);border-radius:12px;box-shadow:0 -4px 16px rgba(15,23,42,.06);flex-wrap:wrap;z-index:5}
    #step-bde{padding:1.5rem 2rem!important}
    @media(max-width:700px){#step-bde{padding:1rem!important}.bdep-eq{flex-wrap:wrap}.bdep-eq select{width:100%}}
    .bdep-dirty{font-size:13px;color:#b45309;font-weight:600}
    @media(max-width:600px){.bdep-preview .pv-btn{margin-left:0}}
  </style>`;

  const preview = `<div class="bdep-preview" id="bdep-preview">
      <div class="pv-brand"><img id="bdep-pv-logo" src="${bdeParamEsc(_bdeParams.logo_url || '')}" alt="">
        <span><span id="bdep-pv-l1">${bdeParamEsc(_bdeParams.logo_ligne1 || '')}</span><span class="pv-l2" id="bdep-pv-l2">${bdeParamEsc(_bdeParams.logo_ligne2 || '')}</span></span></div>
      <span style="color:#64748b;font-size:13px" id="bdep-pv-nom">${bdeParamEsc(_bdeParams.nom || '')}</span>
      <span class="pv-btn">Aperçu bouton</span>
    </div>`;

  const tabs = `<div class="bdep-tabs">${BDE_PARAM_ONGLETS.map(o => `<button type="button" class="bdep-tab${o.id === _bdeParamOnglet ? ' on' : ''}" data-onglet="${o.id}" onclick="bdeParamOnglet('${o.id}')">${o.label}</button>`).join('')}</div>`;

  const panneaux = BDE_PARAM_ONGLETS.map(o => {
    let inner = BDE_PARAM_SCHEMA.filter(s => s.onglet === o.id).map(s =>
      `<div class="params-card"><h3>${s.titre}</h3>${s.champs.map(bdeParamChampHtml).join('')}</div>`).join('');
    if (o.id === 'apparence') inner += `<div class="params-card"><h3>Couleurs du BDE</h3>
        <p style="font-size:13px;color:#64748b;margin:0 0 .75rem">Une seule couleur : tout le site l'utilise. Plusieurs couleurs : le site utilise un dégradé dans l'ordre de la liste. La première est la couleur principale (boutons, menus, titres).</p>
        <div id="bdep-couleurs">${couleurs.map(bdeParamCouleurRow).join('')}</div>
        <button type="button" onclick="bdeParamAddCouleur()" class="bdep-add">+ Ajouter une couleur</button>
        <div id="bdep-grad-bar" class="bdep-grad"></div>
        <small class="bdep-aide" id="bdep-col-info"></small></div>`;
    if (o.id === 'modules') inner = `<div class="params-card"><h3>Modules activés</h3>
        <p style="font-size:13px;color:#64748b;margin:0 0 .5rem">Décoche ce que ton BDE n'utilise pas : le module disparaît du menu de l'admin.</p>
        ${BDE_MODULES.map(m => `<label class="bdep-mod"><input type="checkbox" class="bdep-modchk" value="${m.id}" ${actifs.includes(m.id) ? 'checked' : ''}><span><strong style="font-size:14px">${m.label}</strong><br><span style="font-size:12px;color:#64748b">${m.desc}</span></span></label>`).join('')}</div>`;
    if (o.id === 'acces') inner = bdeParamAccesHtml();
    return `<div class="bdep-panneau" data-onglet="${o.id}" ${o.id === _bdeParamOnglet ? '' : 'hidden'}>${inner}</div>`;
  }).join('');

  const barre = `<div class="bdep-bar"><span class="bdep-dirty" id="bdep-dirty" hidden>● Modifications non enregistrées</span>
      <span style="margin-left:auto;display:flex;gap:8px">
        <button type="button" id="bdep-reset" onclick="bdeParamReset()" hidden style="padding:11px 18px;border:1px solid var(--border,#e2e8f0);border-radius:10px;background:#fff;font-weight:600;cursor:pointer;font-family:inherit">Annuler</button>
        <button type="button" id="bdep-save" onclick="bdeParamSave(this)" disabled style="padding:11px 26px;border:none;border-radius:10px;background:var(--accent);color:#fff;font-weight:700;cursor:pointer;font-family:inherit;opacity:.5">Enregistrer</button>
      </span></div>`;

  const root = document.getElementById('bde-param-body');
  root.innerHTML = style + preview + tabs + panneaux + barre;

  root.oninput = bdeParamOnInput;
  root.onchange = bdeParamOnInput;
  bdeParamPreviewCouleurs();
  if (_bdeParamOnglet === 'acces') bdeEquipeCharger();
}

function bdeParamOnglet(id) {
  _bdeParamOnglet = id;
  document.querySelectorAll('.bdep-tab').forEach(b => b.classList.toggle('on', b.dataset.onglet === id));
  document.querySelectorAll('.bdep-panneau').forEach(p => { p.hidden = p.dataset.onglet !== id; });
  if (id === 'acces') bdeEquipeCharger();
}

function bdeParamOnInput(e) {
  const el = e.target;
  if (el.closest && (el.closest('.bdep-eq') || el.id === 'bdep-eq-q')) return;   // équipe : enregistré tout de suite, pas via la barre
  if (el.closest && el.closest('.bdep-col-row')) {
    const row = el.closest('.bdep-col-row'), cp = row.querySelector('.cp'), hx = row.querySelector('.hx');
    if (el === cp) hx.value = cp.value;
    else { const h = bdeParamHexNorm(hx.value); if (h) cp.value = h; hx.style.borderColor = h || hx.value === '' ? '' : '#dc2626'; }
    bdeParamPreviewCouleurs();
  }
  if (el.id === 'bdep-logo_url') { const i = document.getElementById('bdep-logo_url-preview'); if (i) i.src = el.value; }
  const pv = { 'bdep-logo_url': ['bdep-pv-logo', 'src'], 'bdep-logo_ligne1': ['bdep-pv-l1'], 'bdep-logo_ligne2': ['bdep-pv-l2'], 'bdep-nom': ['bdep-pv-nom'] }[el.id];
  if (pv) { const t = document.getElementById(pv[0]); if (t) { if (pv[1]) t.src = el.value; else t.textContent = el.value; } }
  bdeParamMarkDirty();
}

function bdeParamMarkDirty() {
  _bdeParamDirty = true;
  window.onbeforeunload = () => 'Modifications non enregistrées';
  const d = document.getElementById('bdep-dirty'); if (d) d.hidden = false;
  const r = document.getElementById('bdep-reset'); if (r) r.hidden = false;
  const s = document.getElementById('bdep-save'); if (s) { s.disabled = false; s.style.opacity = '1'; }
}

function bdeParamReset() {
  document.documentElement.style.removeProperty('--gradient');   // annule l'aperçu des couleurs
  if (window.BDE) BDE.appliquer();
  initParametresBde();
}

async function bdeParamUploadLogo(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  try {
    const webp = window.imageToWebp ? await window.imageToWebp(file, { maxWidth: 600, quality: 0.9 }) : file;
    const ext = webp.type === 'image/webp' ? 'webp' : (file.name.split('.').pop() || 'png').toLowerCase();
    const filename = `logo-${Date.now()}.${ext}`;
    const form = new FormData();
    form.append('file', webp, filename);
    form.append('filename', filename);
    const res = await fetch('/api/upload-image', { method: 'POST', headers: { 'x-upload-secret': uploadSecret }, body: form });
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || 'HTTP ' + res.status); }
    const { url } = await res.json();
    const inp = document.getElementById('bdep-logo_url');
    inp.value = url;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    showToast('Logo envoyé : pense à enregistrer', 'success');
  } catch (e) { showToast('Erreur upload : ' + e.message, 'error'); }
  input.value = '';
}

// ── Validation ───────────────────────────────────────────────
function bdeParamValider() {
  const RE_MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const RE_URL = /^(https?:\/\/|\/)\S+$/i;
  let premiereErreur = null;
  BDE_PARAM_SCHEMA.forEach(s => s.champs.forEach(c => {
    const el = document.getElementById('bdep-' + c.cle), err = document.getElementById('bdep-' + c.cle + '-err');
    if (!el || !err) return;
    const v = el.value.trim();
    let msg = '';
    if (c.requis && !v) msg = 'Champ obligatoire.';
    else if (v && c.type === 'email' && !RE_MAIL.test(v)) msg = 'Adresse e-mail invalide.';
    else if (v && (c.type === 'url' || c.type === 'image') && !RE_URL.test(v)) msg = 'Lien invalide (doit commencer par https://).';
    err.textContent = msg;
    if (msg && !premiereErreur) premiereErreur = { c, el };
  }));
  if (!premiereErreur) {
    const bad = [...document.querySelectorAll('#bdep-couleurs .hx')].find(h => !bdeParamHexNorm(h.value));
    if (bad) {
      bdeParamOnglet('apparence'); bad.focus(); bad.style.borderColor = '#dc2626';
      showToast('Couleur invalide : format #rrggbb', 'error'); return false;
    }
  }
  if (premiereErreur) {
    const onglet = BDE_PARAM_SCHEMA.find(s => s.champs.includes(premiereErreur.c)).onglet;
    bdeParamOnglet(onglet);
    premiereErreur.el.focus();
    return false;
  }
  return true;
}

async function bdeParamSave(btn) {
  if (!bdeParamValider()) return showToast('Corrige les champs en rouge', 'error');
  const user = await Auth.getUser();
  const now = new Date().toISOString();
  const rows = [];
  BDE_PARAM_SCHEMA.forEach(sec => sec.champs.forEach(c => {
    const el = document.getElementById('bdep-' + c.cle);
    if (el) rows.push({ cle: c.cle, valeur: el.value.trim(), updated_at: now, updated_by: user.id });
  }));
  const L = bdeParamLireCouleurs();
  rows.push({ cle: 'couleurs', valeur: JSON.stringify(L), updated_at: now, updated_by: user.id });
  // anciens paramètres gardés synchronisés (lus par des pages pas encore migrées)
  rows.push({ cle: 'couleur_principale', valeur: L[0], updated_at: now, updated_by: user.id });
  rows.push({ cle: 'couleur_secondaire', valeur: L[1] || L[0], updated_at: now, updated_by: user.id });
  rows.push({ cle: 'couleur_accent', valeur: L[L.length - 1], updated_at: now, updated_by: user.id });
  const mods = [...document.querySelectorAll('.bdep-modchk:checked')].map(i => i.value).join(',');
  rows.push({ cle: 'modules_actifs', valeur: mods, updated_at: now, updated_by: user.id });

  const modsAvant = _bdeParams.modules_actifs;
  btn.disabled = true; btn.textContent = 'Enregistrement…';
  const acces = [...document.querySelectorAll('.bdep-acc select')].map(se => ({ module: se.dataset.module, niveau: se.value, updated_at: now, updated_by: user.id }));
  const accesChange = acces.some(a => (_bdeAcces[a.module] || (BDE_MODULES.find(m => m.id === a.module) || {}).min) !== a.niveau);
  let { error } = await Auth.sb.from('bde_parametres').upsert(rows);
  if (!error && acces.length) ({ error } = await Auth.sb.from('bde_acces').upsert(acces));
  btn.textContent = 'Enregistrer';
  if (error) { btn.disabled = false; return showToast('Erreur : ' + error.message, 'error'); }
  rows.forEach(r => { _bdeParams[r.cle] = r.valeur; });
  acces.forEach(a => { _bdeAcces[a.module] = a.niveau; });
  _bdeParamDirty = false; window.onbeforeunload = null;
  btn.disabled = true; btn.style.opacity = '.5';
  document.getElementById('bdep-dirty').hidden = true;
  document.getElementById('bdep-reset').hidden = true;
  if (window.BDE) { BDE.vider(); Object.assign(BDE.all(), _bdeParams); BDE.appliquer(); }
  const modsChanges = (modsAvant || '') !== mods || accesChange;
  showToast(modsChanges ? 'Paramètres enregistrés, rechargement…' : 'Paramètres enregistrés', 'success');
  if (modsChanges) setTimeout(() => location.reload(), 900);   // les modules désactivés disparaissent du menu
}

// ── Équipe & accès ───────────────────────────────────────────
// Les rôles vivent dans la table `profils` côté serveur : seul un administrateur peut les modifier
// (verrou en base, migration 071). Cette page ne fait que les afficher et les piloter.
function bdeNiveauDe(p) { return p.role === 'admin' ? 'admin' : (p.bureau ? 'bureau' : (p.role === 'etudiant' ? 'aucun' : 'membre')); }
const BDE_ROLE_VERS = {
  admin:  { role: 'admin',    bureau: true },
  bureau: { role: 'membre',   bureau: true },
  membre: { role: 'membre',   bureau: false },
  aucun:  { role: 'etudiant', bureau: false },
};

function bdeParamAccesHtml() {
  const lignes = BDE_MODULES.map(m => {
    const cur = _bdeAcces[m.id] || m.min;
    const minN = BDE_NIVEAUX.find(n => n.id === m.min).n;
    return `<div class="bdep-acc"><span><strong style="font-size:14px">${m.label}</strong></span>
      <select data-module="${m.id}">${BDE_NIVEAUX.map(n => `<option value="${n.id}" ${n.id === cur ? 'selected' : ''} ${n.n < minN ? 'disabled' : ''}>${n.label}</option>`).join('')}</select></div>`;
  }).join('');
  return `<div class="params-card" style="grid-column:1/-1"><h3>Équipe du BDE</h3>
      <p style="font-size:13px;color:#64748b;margin:0 0 .75rem">Qui fait partie du BDE, du bureau, et qui administre. Les changements sont appliqués immédiatement et vérifiés côté serveur : un rôle ne peut pas être modifié depuis le navigateur par quelqu'un qui n'est pas administrateur.</p>
      <div id="bdep-equipe"><p style="color:#888">Chargement…</p></div>
      <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border,#e2e8f0)">
        <label style="font-size:13px;font-weight:600">Ajouter quelqu'un au BDE</label>
        <div style="display:flex;gap:8px;margin-top:6px"><input type="text" id="bdep-eq-q" placeholder="Nom, prénom ou e-mail d'un compte existant" style="flex:1" onkeydown="if(event.key==='Enter'){event.preventDefault();bdeEquipeChercher()}">
        <button type="button" class="bdep-btn" onclick="bdeEquipeChercher()">Chercher</button></div>
        <div id="bdep-eq-res"></div></div></div>
    <div class="params-card" style="grid-column:1/-1"><h3>Accès aux pages de l'admin</h3>
      <p style="font-size:13px;color:#64748b;margin:0 0 .75rem">Choisis qui voit chaque module. Les administrateurs voient tout. Certains modules restent réservés au bureau au minimum, car leurs données sont protégées côté serveur.</p>
      ${lignes}</div>`;
}

async function bdeEquipeCharger() {
  const box = document.getElementById('bdep-equipe'); if (!box) return;
  const { data, error } = await Auth.sb.from('profils').select('id,prenom,nom,email,role,bureau')
    .or('role.in.(membre,responsable,admin),bureau.eq.true').order('nom');
  if (error) { box.innerHTML = '<p style="color:#c0392b">' + bdeParamEsc(error.message) + '</p>'; return; }
  _bdeEquipe = data || [];
  const moi = await Auth.getUser();
  box.innerHTML = _bdeEquipe.map(p => {
    const niv = bdeNiveauDe(p), soi = moi && p.id === moi.id;
    const opts = [['admin', 'Administrateur'], ['bureau', 'Bureau'], ['membre', 'Membre'], ['aucun', 'Retirer du BDE']];
    return `<div class="bdep-eq"><div class="qui"><b>${bdeParamEsc((p.prenom || '') + ' ' + (p.nom || ''))}${soi ? ' (toi)' : ''}</b><small>${bdeParamEsc(p.email || '')}</small></div>
      <select ${soi ? 'disabled title="Tu ne peux pas modifier ton propre rôle"' : ''} onchange="bdeEquipeSet('${p.id}',this)" data-avant="${niv}">${opts.map(o => `<option value="${o[0]}" ${o[0] === niv ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div>`;
  }).join('') || '<p style="color:#888">Personne pour l\'instant.</p>';
}

async function bdeEquipeSet(id, sel) {
  const niv = sel.value, avant = sel.dataset.avant;
  const p = _bdeEquipe.find(x => x.id === id) || {};
  const nom = ((p.prenom || '') + ' ' + (p.nom || '')).trim() || 'cette personne';
  const msg = niv === 'admin' ? `Donner les droits d'administrateur à ${nom} ? Elle pourra tout modifier, y compris les rôles.`
            : niv === 'aucun' ? `Retirer ${nom} du BDE ? Elle n'aura plus accès à l'admin.` : '';
  if (msg && !confirm(msg)) { sel.value = avant; return; }
  const { error } = await Auth.sb.from('profils').update(BDE_ROLE_VERS[niv]).eq('id', id);
  if (error) { sel.value = avant; return showToast('Refusé : ' + error.message, 'error'); }
  sel.dataset.avant = niv;
  if (p) { p.role = BDE_ROLE_VERS[niv].role; p.bureau = BDE_ROLE_VERS[niv].bureau; }
  showToast('Rôle mis à jour', 'success');
  if (niv === 'aucun') bdeEquipeCharger();
}

async function bdeEquipeChercher() {
  const q = (document.getElementById('bdep-eq-q').value || '').replace(/[,()%*]/g, ' ').trim();
  const res = document.getElementById('bdep-eq-res');
  if (q.length < 2) { res.innerHTML = '<small class="bdep-aide">Tape au moins 2 caractères.</small>'; return; }
  const { data, error } = await Auth.sb.from('profils').select('id,prenom,nom,email,role,bureau')
    .or(`nom.ilike.%${q}%,prenom.ilike.%${q}%,email.ilike.%${q}%`).limit(8);
  if (error) { res.innerHTML = '<small class="bdep-err">' + bdeParamEsc(error.message) + '</small>'; return; }
  const dejaDans = new Set(_bdeEquipe.map(x => x.id));
  const l = (data || []).filter(p => !dejaDans.has(p.id));
  res.innerHTML = l.map(p => `<div class="bdep-res"><span>${bdeParamEsc((p.prenom || '') + ' ' + (p.nom || ''))} <small style="color:#64748b">${bdeParamEsc(p.email || '')}</small></span>
    <button type="button" class="bdep-btn" style="padding:5px 12px" onclick="bdeEquipeAjouter('${p.id}')">Ajouter</button></div>`).join('')
    || '<small class="bdep-aide">Aucun compte trouvé. La personne doit d\'abord créer son compte sur le site.</small>';
}

async function bdeEquipeAjouter(id) {
  const { error } = await Auth.sb.from('profils').update(BDE_ROLE_VERS.membre).eq('id', id);
  if (error) return showToast('Refusé : ' + error.message, 'error');
  showToast('Ajouté comme membre du BDE', 'success');
  document.getElementById('bdep-eq-res').innerHTML = '';
  document.getElementById('bdep-eq-q').value = '';
  bdeEquipeCharger();
}
