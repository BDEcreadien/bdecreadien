/* BDE Admin — module « Paramètres du BDE »
   Identité, couleurs, contact, légal, modules actifs. Stockés dans la table bde_parametres
   (lisible par tous, modifiable par les admins) et repris automatiquement par les pages publiques
   (js/bde-config.js) et les mails. */

const BDE_PARAM_SCHEMA = [
  { titre: 'Identité', champs: [
    { cle: 'nom',          label: 'Nom complet du BDE',        ph: 'BDE CREAD Lyon' },
    { cle: 'nom_court',    label: 'Nom court',                 ph: 'CREAD' },
    { cle: 'logo_ligne1',  label: 'Logo texte — ligne 1',      ph: 'BDE LYON' },
    { cle: 'logo_ligne2',  label: 'Logo texte — ligne 2',      ph: 'CREAD' },
    { cle: 'ecole',        label: 'École',                     ph: 'CREAD Lyon' },
    { cle: 'ville',        label: 'Ville',                     ph: 'Lyon' },
    { cle: 'slogan',       label: 'Phrase de présentation',    ph: 'Le bureau des étudiants de…', type: 'textarea' },
    { cle: 'logo_url',     label: 'Logo',                      type: 'image' },
  ]},
  { titre: 'Couleurs', champs: [
    { cle: 'couleur_principale', label: 'Couleur principale (boutons, menus, titres)',  type: 'color', def: '#2563eb' },
    { cle: 'couleur_secondaire', label: 'Couleur secondaire (dégradés)',  type: 'color', def: '#1d4ed8' },
    { cle: 'couleur_accent',     label: 'Couleur d\'accent (mises en avant)',   type: 'color', def: '#FF741F', theme: true },
  ]},
  { titre: 'Contact & réseaux', champs: [
    { cle: 'email_contact',    label: 'E-mail de contact',      ph: 'contact@…', type: 'email' },
    { cle: 'telephone',        label: 'Téléphone',              ph: '06 00 00 00 00' },
    { cle: 'adresse',          label: 'Adresse',                ph: 'Rue, code postal, ville' },
    { cle: 'instagram_handle', label: 'Instagram (sans @)',     ph: 'bdecreadien' },
    { cle: 'instagram_url',    label: 'Lien Instagram',         ph: 'https://www.instagram.com/…', type: 'url' },
  ]},
  { titre: 'Site & e-mails', champs: [
    { cle: 'site_url',        label: 'Adresse du site',         ph: 'https://monbde.fr', type: 'url' },
    { cle: 'mail_expediteur', label: 'Adresse d\'envoi des mails automatiques', ph: 'noreply@monbde.fr', type: 'email' },
    { cle: 'nom_expediteur',  label: 'Nom affiché dans les mails', ph: 'BDE CREAD Lyon' },
  ]},
  { titre: 'Association (mentions légales, factures)', champs: [
    { cle: 'asso_nom_legal',   label: 'Nom légal de l\'association' },
    { cle: 'asso_siret',       label: 'SIRET' },
    { cle: 'asso_rna',         label: 'N° RNA' },
    { cle: 'asso_adresse',     label: 'Adresse du siège' },
    { cle: 'asso_responsable', label: 'Responsable de publication' },
  ]},
];

const BDE_MODULES = [
  { id: 'contenu',     label: 'Contenu du site (agenda, annonces, médias…)' },
  { id: 'boutique',    label: 'Merchandising' },
  { id: 'billetterie', label: 'Billetterie' },
  { id: 'finances',    label: 'Finances' },
  { id: 'facturation', label: 'Facturation' },
  { id: 'planning',    label: 'Organisation / planning bureau' },
  { id: 'newsletter',  label: 'Newsletter' },
  { id: 'fidelite',    label: 'Cartes de fidélité' },
  { id: 'liens',       label: 'Liens (page /menu)' },
  { id: 'qr',          label: 'QR code dynamique' },
  { id: 'stats',       label: 'Statistiques' },
];

let _bdeParams = {};

function bdeParamEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

async function initParametresBde() {
  const root = document.getElementById('bde-param-body');
  root.innerHTML = '<p style="color:#888;padding:20px">Chargement…</p>';
  const { data, error } = await Auth.sb.from('bde_parametres').select('cle,valeur');
  if (error) { root.innerHTML = '<p style="color:#c0392b;padding:20px">Erreur : ' + bdeParamEsc(error.message) +
    '<br><small>La migration 070_bde_parametres.sql a-t-elle été appliquée ?</small></p>'; return; }
  _bdeParams = {};
  (data || []).forEach(r => { _bdeParams[r.cle] = r.valeur; });
  bdeParamRender();
}

function bdeParamRender() {
  const actifs = _bdeParams.modules_actifs ? _bdeParams.modules_actifs.split(',').map(s => s.trim()) : BDE_MODULES.map(m => m.id);
  const palette = (() => { try { const l = JSON.parse(_bdeParams.palette || '[]'); return Array.isArray(l) ? l : []; } catch (_) { return []; } })();
  const paletteHtml = `<div class="params-card" style="margin-bottom:1rem">
      <h3>Palette complémentaire</h3>
      <p style="font-size:13px;color:var(--gris-texte);margin:0 0 .75rem">Autres couleurs de ton BDE (ex. couleur d'un pôle, d'un événement). Elles sont disponibles pour tout le site. Ajoute ou supprime-les librement.</p>
      <div id="bdep-palette">${palette.map(c => bdeParamPaletteRow(c.nom, c.hex)).join('')}</div>
      <button type="button" onclick="bdeParamAddCouleur()" style="margin-top:8px;padding:8px 14px;border:1.5px dashed var(--border2,#cbd5e1);background:none;border-radius:8px;cursor:pointer;font-weight:600;color:var(--text2,#64748b);font-family:inherit">+ Ajouter une couleur</button>
    </div>`;
  let html = BDE_PARAM_SCHEMA.map(sec => `
    <div class="params-card" style="margin-bottom:1rem">
      <h3>${sec.titre}</h3>
      ${sec.champs.map(c => {
        const v = _bdeParams[c.cle] != null && _bdeParams[c.cle] !== '' ? _bdeParams[c.cle] : (c.def || '');
        const id = 'bdep-' + c.cle;
        if (c.type === 'textarea') return `<div class="form-row"><label>${c.label}</label><textarea id="${id}" rows="3" placeholder="${bdeParamEsc(c.ph || '')}">${bdeParamEsc(v)}</textarea></div>`;
        if (c.type === 'color') return `<div class="form-row"><label>${c.label}</label><div style="display:flex;gap:10px;align-items:center"><input type="color" id="${id}" value="${bdeParamEsc(v)}" style="width:56px;height:38px;padding:2px"><code style="font-size:12px;color:#888" id="${id}-hex">${bdeParamEsc(v)}</code></div></div>`;
        if (c.type === 'image') return `<div class="form-row"><label>${c.label}</label>
          <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
            <img id="${id}-preview" src="${bdeParamEsc(v)}" alt="" style="width:64px;height:64px;border-radius:50%;object-fit:cover;background:var(--accent-lt);border:1px solid #e2e8f0">
            <div style="flex:1;min-width:220px"><input type="text" id="${id}" value="${bdeParamEsc(v)}" placeholder="https://… ou /assets/logo.png" oninput="document.getElementById('${id}-preview').src=this.value">
            <label style="display:inline-block;margin-top:8px;padding:7px 14px;border:1.5px solid var(--accent);color:var(--accent);border-radius:8px;font-weight:700;font-size:13px;cursor:pointer">📷 Envoyer une image<input type="file" accept="image/*" style="display:none" onchange="bdeParamUploadLogo(this)"></label></div>
          </div></div>`;
        return `<div class="form-row"><label>${c.label}</label><input type="${c.type || 'text'}" id="${id}" value="${bdeParamEsc(v)}" placeholder="${bdeParamEsc(c.ph || '')}"></div>`;
      }).join('')}
    </div>${sec.titre === 'Couleurs' ? paletteHtml : ''}`).join('');
  html += `<div class="params-card" style="margin-bottom:1rem"><h3>Modules activés</h3>
    <p style="font-size:13px;color:var(--gris-texte);margin:0 0 .75rem">Décoche ce que ce BDE n'utilise pas : les cartes correspondantes disparaissent de l'admin.</p>
    ${BDE_MODULES.map(m => `<label style="display:flex;gap:10px;align-items:center;padding:6px 0;font-size:14px;cursor:pointer"><input type="checkbox" class="bdep-mod" value="${m.id}" ${actifs.includes(m.id) ? 'checked' : ''} style="width:auto"> ${m.label}</label>`).join('')}
  </div>
  <div style="display:flex;justify-content:flex-end;gap:10px;position:sticky;bottom:0;padding:12px 0;background:var(--bg,#f1f5f9)">
    <button class="btn-primary" onclick="bdeParamSave(this)" style="padding:11px 26px;border:none;border-radius:10px;background:linear-gradient(135deg,var(--accent),var(--accent-h));color:#fff;font-weight:800;cursor:pointer">Enregistrer</button>
  </div>`;
  document.getElementById('bde-param-body').innerHTML = html;
  document.querySelectorAll('#bde-param-body input[type=color]').forEach(i =>
    i.addEventListener('input', () => {
      const hex = document.getElementById(i.id + '-hex');
      if (hex) hex.textContent = i.value;
      if (i.id === 'bdep-couleur_principale') document.documentElement.style.setProperty('--accent', i.value); // aperçu immédiat
    }));
}

function bdeParamPaletteRow(nom, hex) {
  return `<div class="bdep-pal-row" style="display:flex;gap:10px;align-items:center;margin-bottom:8px">
    <input type="color" value="${bdeParamEsc(hex || '#64748b')}" style="width:48px;height:36px;padding:2px;flex-shrink:0">
    <input type="text" value="${bdeParamEsc(nom || '')}" placeholder="Nom de la couleur" style="flex:1;min-width:0">
    <button type="button" onclick="this.closest('.bdep-pal-row').remove()" title="Supprimer" style="border:1px solid var(--border,#e2e8f0);background:#fff;border-radius:8px;width:34px;height:34px;cursor:pointer;color:#dc2626;font-size:16px;flex-shrink:0">×</button>
  </div>`;
}
function bdeParamAddCouleur() {
  document.getElementById('bdep-palette').insertAdjacentHTML('beforeend', bdeParamPaletteRow('', '#64748b'));
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
    document.getElementById('bdep-logo_url').value = url;
    document.getElementById('bdep-logo_url-preview').src = url;
    showToast('Logo envoyé, pense à enregistrer', 'success');
  } catch (e) { showToast('Erreur upload : ' + e.message, 'error'); }
  input.value = '';
}

async function bdeParamSave(btn) {
  const user = await Auth.getUser();
  const rows = [];
  BDE_PARAM_SCHEMA.forEach(sec => sec.champs.forEach(c => {
    const el = document.getElementById('bdep-' + c.cle);
    if (el) rows.push({ cle: c.cle, valeur: el.value.trim(), updated_at: new Date().toISOString(), updated_by: user.id });
  }));
  const pal = [...document.querySelectorAll('#bdep-palette .bdep-pal-row')].map(r => ({
    hex: r.querySelector('input[type=color]').value, nom: r.querySelector('input[type=text]').value.trim()
  })).filter(c => c.nom);
  rows.push({ cle: 'palette', valeur: JSON.stringify(pal), updated_at: new Date().toISOString(), updated_by: user.id });
  const mods = [...document.querySelectorAll('.bdep-mod:checked')].map(i => i.value).join(',');
  rows.push({ cle: 'modules_actifs', valeur: mods, updated_at: new Date().toISOString(), updated_by: user.id });
  btn.disabled = true; btn.textContent = 'Enregistrement…';
  const { error } = await Auth.sb.from('bde_parametres').upsert(rows);
  btn.disabled = false; btn.textContent = 'Enregistrer';
  if (error) return showToast('Erreur : ' + error.message, 'error');
  rows.forEach(r => { _bdeParams[r.cle] = r.valeur; });
  if (window.BDE) { BDE.vider(); Object.assign(BDE.all(), _bdeParams); BDE.appliquer(); }
  showToast('Paramètres enregistrés', 'success');
}
