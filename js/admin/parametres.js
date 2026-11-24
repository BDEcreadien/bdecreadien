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
  { onglet: 'apparence', titre: 'Couleurs', champs: [
    { cle: 'couleur_principale', label: 'Couleur principale',  type: 'color', def: '#2563eb', aide: 'Boutons, menus, titres, admin.' },
    { cle: 'couleur_secondaire', label: 'Couleur secondaire',  type: 'color', def: '#7c3aed', aide: 'Deuxième teinte des dégradés.' },
    { cle: 'couleur_accent',     label: 'Couleur d\'accent',   type: 'color', def: '#f97316', aide: 'Mises en avant, étiquettes.' },
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
  { id: 'contenu',     label: 'Contenu du site',         desc: 'Agenda, annonces, médias, équipe, partenaires' },
  { id: 'boutique',    label: 'Merchandising',           desc: 'Commandes, stock, vente sur place' },
  { id: 'billetterie', label: 'Billetterie',             desc: 'Pages de vente et inscriptions aux événements' },
  { id: 'finances',    label: 'Finances',                desc: 'Trésorerie, budget, rapports' },
  { id: 'facturation', label: 'Facturation',             desc: 'Factures PDF' },
  { id: 'planning',    label: 'Organisation du bureau',  desc: 'Qui aide sur quel événement' },
  { id: 'newsletter',  label: 'Newsletter',              desc: 'Abonnés et envois' },
  { id: 'fidelite',    label: 'Cartes de fidélité',      desc: 'Cartes étudiants et tampons' },
  { id: 'liens',       label: 'Liens',                   desc: 'Page de liens type « linktree »' },
  { id: 'qr',          label: 'QR code dynamique',       desc: 'Redirection modifiable sans réimpression' },
  { id: 'stats',       label: 'Statistiques',            desc: 'Fréquentation du site' },
];

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

function bdeParamPaletteRow(nom, hex) {
  return `<div class="bdep-pal-row">
    <input type="color" value="${bdeParamEsc(hex || '#64748b')}" style="width:48px;height:36px;padding:2px;flex-shrink:0">
    <input type="text" value="${bdeParamEsc(nom || '')}" placeholder="Nom de la couleur" style="flex:1;min-width:0">
    <button type="button" onclick="this.closest('.bdep-pal-row').remove();bdeParamMarkDirty()" title="Supprimer" class="bdep-x">×</button>
  </div>`;
}

function bdeParamRender() {
  const palette = (() => { try { const l = JSON.parse(_bdeParams.palette || '[]'); return Array.isArray(l) ? l : []; } catch (_) { return []; } })();
  const actifs = _bdeParams.modules_actifs ? _bdeParams.modules_actifs.split(',').map(s => s.trim()) : BDE_MODULES.map(m => m.id);

  const style = `<style>
    .bdep-aide{display:block;color:#64748b;font-size:12px;margin-top:4px}
    .bdep-err{display:block;color:#dc2626;font-size:12px;margin-top:4px;min-height:0}
    .bdep-btn{display:inline-block;padding:7px 14px;border:1.5px solid var(--accent);color:var(--accent);border-radius:8px;font-weight:700;font-size:13px;cursor:pointer}
    .bdep-tabs{display:flex;gap:4px;border-bottom:1px solid var(--border,#e2e8f0);margin-bottom:1rem;overflow-x:auto;-webkit-overflow-scrolling:touch}
    .bdep-tab{padding:10px 14px;border:0;background:none;font:inherit;font-weight:500;color:var(--text2,#64748b);cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap}
    .bdep-tab.on{color:var(--accent);border-bottom-color:var(--accent);font-weight:600}
    .bdep-pal-row{display:flex;gap:10px;align-items:center;margin-bottom:8px}
    .bdep-x{border:1px solid var(--border,#e2e8f0);background:#fff;border-radius:8px;width:34px;height:34px;cursor:pointer;color:#dc2626;font-size:16px;flex-shrink:0}
    .bdep-mod{display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--border,#e2e8f0);cursor:pointer}
    .bdep-mod:last-child{border-bottom:0}
    .bdep-mod input{width:auto;margin-top:3px}
    .bdep-preview{background:var(--surface,#fff);border:1px solid var(--border,#e2e8f0);border-radius:12px;padding:14px 16px;margin-bottom:1rem;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
    .bdep-preview .pv-brand{display:flex;align-items:center;gap:10px;font-weight:700}
    .bdep-preview img{width:40px;height:40px;border-radius:50%;object-fit:cover;background:#f1f5f9}
    .bdep-preview .pv-l2{font-weight:800;color:var(--accent);margin-left:4px}
    .bdep-preview .pv-btn{margin-left:auto;padding:8px 16px;border-radius:9px;color:#fff;font-weight:700;font-size:13px;background:var(--gradient,var(--accent))}
    .bdep-bar{position:sticky;bottom:0;display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 0;background:var(--bg,#f1f5f9);flex-wrap:wrap}
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
    if (o.id === 'apparence') inner += `<div class="params-card"><h3>Palette complémentaire</h3>
        <p style="font-size:13px;color:#64748b;margin:0 0 .75rem">Autres couleurs de ton BDE (couleur d'un pôle, d'un événement…). Elles sont utilisables partout sur le site. Ajoute ou supprime-les librement.</p>
        <div id="bdep-palette">${palette.map(c => bdeParamPaletteRow(c.nom, c.hex)).join('')}</div>
        <button type="button" onclick="bdeParamAddCouleur()" style="margin-top:6px;padding:8px 14px;border:1.5px dashed #cbd5e1;background:none;border-radius:8px;cursor:pointer;font-weight:600;color:#64748b;font-family:inherit">+ Ajouter une couleur</button></div>`;
    if (o.id === 'modules') inner = `<div class="params-card"><h3>Modules activés</h3>
        <p style="font-size:13px;color:#64748b;margin:0 0 .5rem">Décoche ce que ton BDE n'utilise pas : le module disparaît du menu de l'admin.</p>
        ${BDE_MODULES.map(m => `<label class="bdep-mod"><input type="checkbox" class="bdep-modchk" value="${m.id}" ${actifs.includes(m.id) ? 'checked' : ''}><span><strong style="font-size:14px">${m.label}</strong><br><span style="font-size:12px;color:#64748b">${m.desc}</span></span></label>`).join('')}</div>`;
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
}

function bdeParamOnglet(id) {
  _bdeParamOnglet = id;
  document.querySelectorAll('.bdep-tab').forEach(b => b.classList.toggle('on', b.dataset.onglet === id));
  document.querySelectorAll('.bdep-panneau').forEach(p => { p.hidden = p.dataset.onglet !== id; });
}

function bdeParamOnInput(e) {
  const el = e.target;
  if (el.type === 'color' && el.id) {
    const hex = document.getElementById(el.id + '-hex'); if (hex) hex.textContent = el.value;
    if (el.id === 'bdep-couleur_principale') document.documentElement.style.setProperty('--accent', el.value);   // aperçu direct
    if (el.id === 'bdep-couleur_secondaire' || el.id === 'bdep-couleur_accent') bdeParamPreviewGradient();
  }
  if (el.id === 'bdep-logo_url') { const i = document.getElementById('bdep-logo_url-preview'); if (i) i.src = el.value; }
  const pv = { 'bdep-logo_url': ['bdep-pv-logo', 'src'], 'bdep-logo_ligne1': ['bdep-pv-l1'], 'bdep-logo_ligne2': ['bdep-pv-l2'], 'bdep-nom': ['bdep-pv-nom'] }[el.id];
  if (pv) { const t = document.getElementById(pv[0]); if (t) { if (pv[1]) t.src = el.value; else t.textContent = el.value; } }
  bdeParamMarkDirty();
}

function bdeParamPreviewGradient() {
  const g = id => (document.getElementById(id) || {}).value;
  const P = g('bdep-couleur_principale'), S = g('bdep-couleur_secondaire'), A = g('bdep-couleur_accent');
  if (P && S && A) document.documentElement.style.setProperty('--gradient', `linear-gradient(135deg,${P},${S},${A})`);
}

function bdeParamMarkDirty() {
  _bdeParamDirty = true;
  window.onbeforeunload = () => 'Modifications non enregistrées';
  const d = document.getElementById('bdep-dirty'); if (d) d.hidden = false;
  const r = document.getElementById('bdep-reset'); if (r) r.hidden = false;
  const s = document.getElementById('bdep-save'); if (s) { s.disabled = false; s.style.opacity = '1'; }
}

function bdeParamAddCouleur() {
  document.getElementById('bdep-palette').insertAdjacentHTML('beforeend', bdeParamPaletteRow('', '#64748b'));
  bdeParamMarkDirty();
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
  const pal = [...document.querySelectorAll('#bdep-palette .bdep-pal-row')].map(r => ({
    hex: r.querySelector('input[type=color]').value, nom: r.querySelector('input[type=text]').value.trim()
  })).filter(c => c.nom);
  rows.push({ cle: 'palette', valeur: JSON.stringify(pal), updated_at: now, updated_by: user.id });
  const mods = [...document.querySelectorAll('.bdep-modchk:checked')].map(i => i.value).join(',');
  rows.push({ cle: 'modules_actifs', valeur: mods, updated_at: now, updated_by: user.id });

  const modsAvant = _bdeParams.modules_actifs;
  btn.disabled = true; btn.textContent = 'Enregistrement…';
  const { error } = await Auth.sb.from('bde_parametres').upsert(rows);
  btn.textContent = 'Enregistrer';
  if (error) { btn.disabled = false; return showToast('Erreur : ' + error.message, 'error'); }
  rows.forEach(r => { _bdeParams[r.cle] = r.valeur; });
  _bdeParamDirty = false; window.onbeforeunload = null;
  btn.disabled = true; btn.style.opacity = '.5';
  document.getElementById('bdep-dirty').hidden = true;
  document.getElementById('bdep-reset').hidden = true;
  if (window.BDE) { BDE.vider(); Object.assign(BDE.all(), _bdeParams); BDE.appliquer(); }
  const modsChanges = (modsAvant || '') !== mods;
  showToast(modsChanges ? 'Paramètres enregistrés, rechargement…' : 'Paramètres enregistrés', 'success');
  if (modsChanges) setTimeout(() => location.reload(), 900);   // les modules désactivés disparaissent du menu
}
