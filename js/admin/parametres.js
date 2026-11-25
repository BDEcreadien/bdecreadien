/* BDE Admin — module « Paramètres du BDE »
   Page complète : bandeau d'accueil animé, progression, navigation par sections, aperçu en direct,
   enregistrement automatique (pas de bouton « Enregistrer »).
   Valeurs stockées dans bde_parametres (lisible par tous, modifiable par les admins) et reprises par
   les pages publiques (js/bde-config.js), l'admin et les mails.
   Les secrets (jetons, clés) ne vont JAMAIS ici : ils restent côté serveur. */

const BDE_PARAM_ONGLETS = [
  { id: 'identite',     label: 'Identité',         ico: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>' },
  { id: 'apparence',    label: 'Apparence',        ico: '<circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1.2"/><circle cx="12" cy="7" r="1.2"/><circle cx="16" cy="10" r="1.2"/>' },
  { id: 'contact',      label: 'Contact & réseaux', ico: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>' },
  { id: 'site',         label: 'Site & e-mails',   ico: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>' },
  { id: 'asso',         label: 'Association',      ico: '<path d="M4 21V8l8-5 8 5v13M9 21v-6h6v6"/>' },
  { id: 'integrations', label: 'Intégrations',     ico: '<path d="M9 3v5M15 3v5M6 8h12v4a6 6 0 01-12 0zM12 18v3"/>' },
  { id: 'modules',      label: 'Modules',          ico: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>' },
  { id: 'acces',        label: 'Équipe & accès',   ico: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>' },
];

// type : text (défaut) | textarea | email | url | image | number | switch
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
  { onglet: 'integrations', titre: 'Google Agenda', champs: [
    { cle: 'gcal_ics_url', label: 'Lien iCal public de l\'agenda', ph: 'https://calendar.google.com/calendar/ical/…/public/basic.ics', type: 'url',
      aide: 'Google Agenda > Paramètres de l\'agenda > « Adresse publique au format iCal ». Les événements apparaissent dans l\'agenda du site.' },
  ]},
  { onglet: 'integrations', titre: 'SumUp (encaissement sur place)', champs: [
    { cle: 'sumup_actif',     label: 'Mon BDE encaisse avec SumUp', type: 'switch', aide: 'Active le moyen de paiement SumUp dans la vente sur place.' },
    { cle: 'sumup_frais_pct', label: 'Frais par transaction (%)', ph: '1.75', type: 'number', def: '1.75', aide: 'Utilisés pour calculer la marge nette dans le récap boutique.' },
  ]},
];

// Niveaux d'accès : 1 membre, 2 bureau, 3 admin. `min` = plancher imposé par la base (RLS) : on ne peut pas ouvrir un module en dessous.
const BDE_NIVEAUX = [{ id: 'membre', label: 'Tous les membres du BDE', n: 1 }, { id: 'bureau', label: 'Bureau', n: 2 }, { id: 'admin', label: 'Administrateurs', n: 3 }];

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

// Éléments qui comptent dans la barre de progression du profil
const BDE_PARAM_ETAPES = [
  { id: 'nom', label: 'Nom du BDE', onglet: 'identite', ok: v => !!v.nom },
  { id: 'logo', label: 'Logo', onglet: 'identite', ok: v => !!v.logo_url },
  { id: 'ecole', label: 'École et ville', onglet: 'identite', ok: v => !!(v.ecole && v.ville) },
  { id: 'couleurs', label: 'Couleurs', onglet: 'apparence', ok: v => v.couleurs },
  { id: 'contact', label: 'E-mail de contact', onglet: 'contact', ok: v => !!v.email_contact },
  { id: 'site', label: 'Adresse du site', onglet: 'site', ok: v => !!v.site_url },
  { id: 'mails', label: 'Expéditeur des mails', onglet: 'site', ok: v => !!(v.nom_expediteur && v.mail_expediteur) },
  { id: 'asso', label: 'Infos légales', onglet: 'asso', ok: v => !!v.asso_nom_legal },
];

let _bdeAcces = {};        // module -> niveau
let _bdeEquipe = [];
let _bdeParams = {};       // valeurs enregistrées
let _bdeParamOnglet = 'identite';
let _bdeSaveTimer = null, _bdeSaving = false, _bdeSaveAgain = false;

function bdeParamEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

async function initParametresBde() {
  const root = document.getElementById('bde-param-body');
  root.innerHTML = '<p style="color:#888;padding:20px">Chargement…</p>';
  const { data, error } = await Auth.sb.from('bde_parametres').select('cle,valeur');
  if (error) {
    root.innerHTML = '<p style="color:#c0392b;padding:20px">Erreur : ' + bdeParamEsc(error.message) +
      '<br><small>Seul un administrateur peut modifier ces paramètres.</small></p>';
    return;
  }
  _bdeParams = {};
  (data || []).forEach(r => { _bdeParams[r.cle] = r.valeur; });
  _bdeAcces = {};
  const acc = await Auth.sb.from('bde_acces').select('module,niveau');
  (acc.data || []).forEach(r => { _bdeAcces[r.module] = r.niveau; });
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
  if (c.type === 'switch') {
    return `<div class="bdep-sw-row"><div><strong>${c.label}</strong>${aide}</div>
      <label class="bdep-sw"><input type="checkbox" id="${id}" ${v === 'true' ? 'checked' : ''}><span class="bdep-sw-t"></span></label></div>`;
  }
  const lab = `<label for="${id}">${c.label}${c.requis ? ' <span style="color:#dc2626">*</span>' : ''}</label>`;
  let ctrl;
  if (c.type === 'textarea') ctrl = `<textarea id="${id}" rows="3" placeholder="${bdeParamEsc(c.ph || '')}">${bdeParamEsc(v)}</textarea>`;
  else if (c.type === 'image') ctrl = `<div class="bdep-logo-in">
      <img id="${id}-preview" src="${bdeParamEsc(v)}" alt="">
      <div style="flex:1;min-width:200px"><input type="text" id="${id}" value="${bdeParamEsc(v)}" placeholder="https://… ou /assets/logo.png">
      <label class="bdep-btn" style="margin-top:8px">Envoyer une image<input type="file" accept="image/*" style="display:none" onchange="bdeParamUploadLogo(this)"></label></div></div>`;
  else ctrl = `<input type="${c.type === 'number' ? 'text' : (c.type || 'text')}" ${c.type === 'number' ? 'inputmode="decimal"' : ''} id="${id}" value="${bdeParamEsc(v)}" placeholder="${bdeParamEsc(c.ph || '')}">`;
  return `<div class="form-row">${lab}${ctrl}${aide}<small class="bdep-err" id="${id}-err"></small></div>`;
}

// ── Couleurs ─────────────────────────────────────────────────
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
  bdeParamPreviewCouleurs(); bdeParamMajVivant(); bdeParamMarkDirty();
}
function bdeParamDelCouleur(btn) {
  if (document.querySelectorAll('#bdep-couleurs .bdep-col-row').length <= 1) return showToast('Garde au moins une couleur', 'error');
  btn.closest('.bdep-col-row').remove();
  bdeParamPreviewCouleurs(); bdeParamMajVivant(); bdeParamMarkDirty();
}

// ── Rendu ────────────────────────────────────────────────────
const BDE_PARAM_CSS = `<style>
  #step-bde{padding:0!important;max-width:1280px!important}
  .bdep{--r:16px;padding:0 0 3rem}
  @keyframes bdepGrad{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
  @keyframes bdepUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
  @keyframes bdepPop{0%{opacity:0;transform:scale(.5) rotate(-12deg)}70%{transform:scale(1.08) rotate(2deg)}100%{opacity:1;transform:none}}
  @keyframes bdepFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
  @keyframes bdepWord{from{opacity:0;transform:translateY(60%) rotate(3deg);filter:blur(6px)}to{opacity:1;transform:none;filter:none}}
  @keyframes bdepOrb{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(30px,-20px) scale(1.15)}}
  @keyframes bdepCheck{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.25)}100%{transform:scale(1);opacity:1}}
  .bdep-hero{position:relative;overflow:hidden;border-radius:0 0 28px 28px;color:#fff;padding:36px 32px 32px;margin:-1.75rem 0 24px;
    background:var(--gradient,var(--accent));background-size:220% 220%;animation:bdepGrad 14s ease-in-out infinite}
  .bdep-hero::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.18),rgba(0,0,0,.42));pointer-events:none}
  .bdep-hero .orb{position:absolute;border-radius:50%;filter:blur(40px);opacity:.35;background:#fff;animation:bdepOrb 9s ease-in-out infinite;pointer-events:none}
  .bdep-hero .o1{width:240px;height:240px;right:-60px;top:-80px}
  .bdep-hero .o2{width:180px;height:180px;left:30%;bottom:-90px;animation-delay:-4s}
  .bdep-hero-in{position:relative;display:flex;align-items:center;gap:26px;flex-wrap:wrap}
  .bdep-hero .lg{width:96px;height:96px;border-radius:50%;background:rgba(255,255,255,.95);border:4px solid rgba(255,255,255,.55);object-fit:cover;box-shadow:0 10px 30px rgba(0,0,0,.3);
    animation:bdepPop .8s cubic-bezier(.2,1.2,.3,1) both,bdepFloat 5s ease-in-out 1s infinite;flex-shrink:0}
  .bdep-hero .tx{flex:1;min-width:240px}
  .bdep-hero .eyebrow{font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;opacity:.85;animation:bdepUp .6s .15s both}
  .bdep-hero h1{margin:6px 0 6px;font-size:clamp(28px,4.4vw,46px);line-height:1.05;font-weight:800;letter-spacing:-.02em;text-shadow:0 2px 18px rgba(0,0,0,.25);color:#fff}
  .bdep-hero h1 .w{display:inline-block;animation:bdepWord .7s cubic-bezier(.2,.9,.3,1) both}
  .bdep-hero .sub{font-size:15px;opacity:.92;animation:bdepUp .6s .5s both}
  .bdep-chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;animation:bdepUp .6s .65s both}
  .bdep-chip{background:rgba(255,255,255,.18);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.28);border-radius:999px;padding:5px 12px;font-size:12.5px;font-weight:600}
  .bdep-prog{position:relative;display:flex;align-items:center;gap:14px;animation:bdepUp .7s .4s both}
  .bdep-ring{width:92px;height:92px;position:relative;flex-shrink:0}
  .bdep-ring svg{width:100%;height:100%;transform:rotate(-90deg)}
  .bdep-ring .bg{stroke:rgba(255,255,255,.25)}
  .bdep-ring .fg{stroke:#fff;stroke-linecap:round;transition:stroke-dashoffset 1s cubic-bezier(.3,.8,.2,1)}
  .bdep-ring b{position:absolute;inset:0;display:grid;place-items:center;font-size:22px;font-weight:800}
  .bdep-prog small{display:block;font-size:12px;opacity:.9;max-width:150px;line-height:1.35}
  .bdep-pill{display:inline-flex;align-items:center;gap:6px;margin-top:8px;padding:4px 11px;border-radius:999px;font-size:12px;font-weight:700;background:rgba(255,255,255,.2);transition:background .3s,transform .3s}
  .bdep-pill.ok svg{animation:bdepCheck .45s both}
  .bdep-pill.err{background:#dc2626}
  .bdep-pill svg{width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}
  .bdep-layout{display:grid;grid-template-columns:230px minmax(0,1fr);gap:24px;padding:0 32px;align-items:start}
  .bdep-nav{position:sticky;top:12px;display:flex;flex-direction:column;gap:4px;animation:bdepUp .6s .3s both}
  .bdep-tab{position:relative;display:flex;align-items:center;gap:11px;padding:11px 14px;border:0;background:none;border-radius:12px;font:inherit;font-weight:600;font-size:14px;color:var(--text2,#64748b);cursor:pointer;text-align:left;transition:background .2s,color .2s,transform .2s}
  .bdep-tab svg{width:19px;height:19px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0;transition:transform .3s}
  .bdep-tab:hover{background:color-mix(in srgb,var(--accent) 7%,transparent);color:var(--text,#0f172a)}
  .bdep-tab:hover svg{transform:scale(1.12) rotate(-4deg)}
  .bdep-tab.on{background:color-mix(in srgb,var(--accent) 12%,#fff);color:var(--accent)}
  .bdep-tab.on::before{content:"";position:absolute;left:0;top:22%;bottom:22%;width:3px;border-radius:3px;background:var(--accent);animation:bdepUp .3s both}
  .bdep-tab .dot{margin-left:auto;width:8px;height:8px;border-radius:50%;background:#f59e0b}
  .bdep-main{min-width:0}
  .bdep-preview{background:var(--surface,#fff);border:1px solid var(--border,#e2e8f0);border-radius:var(--r);overflow:hidden;margin-bottom:16px;animation:bdepUp .6s .35s both;box-shadow:0 1px 2px rgba(15,23,42,.04)}
  .bdep-preview .bar{display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border,#e2e8f0)}
  .bdep-preview .bar img{width:30px;height:30px;border-radius:50%;object-fit:cover;background:#f1f5f9}
  .bdep-preview .bar .nm{font-weight:700;font-size:14px}
  .bdep-preview .bar .bt{margin-left:auto;padding:7px 14px;border-radius:9px;color:#fff;font-weight:700;font-size:12.5px;background:var(--gradient,var(--accent))}
  .bdep-preview .body{display:grid;grid-template-columns:1fr 1fr;gap:0}
  .bdep-preview .col{padding:14px 16px;font-size:12.5px;color:#475569;line-height:1.5}
  .bdep-preview .col+.col{border-left:1px solid var(--border,#e2e8f0)}
  .bdep-preview .lbl{font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;color:#94a3b8;margin-bottom:6px}
  .bdep-preview .mail b{color:#0f172a}
  .bdep-panneau{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,400px),1fr));gap:16px;align-items:start}
  .bdep-panneau[hidden]{display:none}
  .bdep-card{background:var(--surface,#fff);border:1px solid var(--border,#e2e8f0);border-radius:var(--r);padding:22px;box-shadow:0 1px 2px rgba(15,23,42,.04);animation:bdepUp .5s both;animation-delay:calc(var(--i,0)*70ms);transition:box-shadow .25s,transform .25s}
  .bdep-card:hover{box-shadow:0 10px 30px rgba(15,23,42,.08);transform:translateY(-2px)}
  .bdep-card.full{grid-column:1/-1}
  .bdep-card h3{margin:0 0 14px;font-size:16px;font-weight:700}
  .bdep-card .form-row{margin-bottom:14px}
  .bdep-aide{display:block;color:#64748b;font-size:12px;margin-top:4px;line-height:1.4}
  .bdep-err{display:block;color:#dc2626;font-size:12px;margin-top:4px}
  .bdep-btn{display:inline-block;padding:7px 14px;border:1.5px solid var(--accent);color:var(--accent);border-radius:9px;font-weight:700;font-size:13px;cursor:pointer;background:none;font-family:inherit;transition:background .2s,color .2s,transform .15s}
  .bdep-btn:hover{background:var(--accent);color:#fff}.bdep-btn:active{transform:scale(.96)}
  .bdep-logo-in{display:flex;gap:14px;align-items:center;flex-wrap:wrap}
  .bdep-logo-in img{width:64px;height:64px;border-radius:50%;object-fit:cover;background:#f1f5f9;border:1px solid #e2e8f0}
  .bdep-col-row{display:flex;gap:10px;align-items:center;margin-bottom:8px;animation:bdepUp .35s both}
  .bdep-col-row .cp{width:48px;height:38px;padding:2px;flex-shrink:0}
  .bdep-col-row .hx{width:130px;font-family:ui-monospace,Menlo,monospace;text-transform:lowercase}
  .bdep-x{border:1px solid var(--border,#e2e8f0);background:#fff;border-radius:8px;width:34px;height:34px;cursor:pointer;color:#dc2626;font-size:16px;flex-shrink:0;transition:background .2s}
  .bdep-x:hover{background:#fef2f2}
  .bdep-add{margin-top:6px;padding:8px 14px;border:1.5px dashed #cbd5e1;background:none;border-radius:9px;cursor:pointer;font-weight:600;color:#64748b;font-family:inherit;transition:border-color .2s,color .2s}
  .bdep-add:hover{border-color:var(--accent);color:var(--accent)}
  .bdep-grad{height:16px;border-radius:8px;margin:16px 0 6px;background:var(--gradient,var(--accent));transition:background .3s}
  .bdep-sw-row{display:flex;gap:16px;align-items:flex-start;justify-content:space-between;padding:4px 0 14px}
  .bdep-sw{position:relative;flex-shrink:0;width:46px;height:26px;cursor:pointer;display:inline-block}
  .bdep-sw input{position:absolute;opacity:0;inset:0;width:100%;height:100%;margin:0;cursor:pointer;z-index:2}
  .bdep-sw-t{position:absolute;inset:0;border-radius:999px;background:#cbd5e1;transition:background .25s}
  .bdep-sw-t::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.25);transition:transform .3s cubic-bezier(.3,1.4,.5,1)}
  .bdep-sw input:checked+.bdep-sw-t{background:var(--accent)}
  .bdep-sw input:checked+.bdep-sw-t::after{transform:translateX(20px)}
  .bdep-sw input:focus-visible+.bdep-sw-t{outline:2px solid var(--accent);outline-offset:2px}
  .bdep-mods{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr));gap:12px}
  .bdep-mod{display:flex;gap:12px;align-items:center;justify-content:space-between;padding:14px 16px;border:1px solid var(--border,#e2e8f0);border-radius:14px;background:var(--surface,#fff);transition:border-color .2s,box-shadow .2s,transform .2s;animation:bdepUp .45s both;animation-delay:calc(var(--i,0)*40ms)}
  .bdep-mod:hover{border-color:color-mix(in srgb,var(--accent) 45%,#e2e8f0);transform:translateY(-2px);box-shadow:0 8px 20px rgba(15,23,42,.07)}
  .bdep-mod strong{font-size:14px;display:block}.bdep-mod span.d{font-size:12px;color:#64748b}
  .bdep-eq{display:flex;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--border,#e2e8f0)}
  .bdep-eq:last-child{border-bottom:0}
  .bdep-av{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:14px;color:#fff;background:var(--gradient,var(--accent));flex-shrink:0}
  .bdep-eq .qui{flex:1;min-width:0}
  .bdep-eq .qui b{display:block;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .bdep-eq .qui small{color:#64748b;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block}
  .bdep-eq select,.bdep-acc select{width:auto;min-width:150px;max-width:100%}
  .bdep-acc{display:flex;gap:12px;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border,#e2e8f0);flex-wrap:wrap}
  .bdep-acc:last-child{border-bottom:0}
  .bdep-liste{max-height:340px;overflow:auto}
  .bdep-note{font-size:13px;color:#64748b;margin:-6px 0 14px;line-height:1.5}
  @media(max-width:900px){
    .bdep-layout{grid-template-columns:1fr;padding:0 16px;gap:14px}
    .bdep-nav{position:static;flex-direction:row;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px;scrollbar-width:none}
    .bdep-nav::-webkit-scrollbar{display:none}
    .bdep-tab{white-space:nowrap;padding:9px 12px;flex-shrink:0;border:1px solid var(--border,#e2e8f0);background:var(--surface,#fff)}
    .bdep-tab.on::before{display:none}
    .bdep-hero{padding:26px 18px 24px;border-radius:0 0 22px 22px;margin-top:-1.1rem}
    .bdep-hero .lg{width:72px;height:72px}
    .bdep-preview .body{grid-template-columns:1fr}.bdep-preview .col+.col{border-left:0;border-top:1px solid var(--border,#e2e8f0)}
    .bdep-eq{flex-wrap:wrap}.bdep-eq select{width:100%}
  }
  @media(prefers-reduced-motion:reduce){.bdep *,.bdep{animation:none!important;transition:none!important}}
</style>`;

function bdeParamAccesHtml() {
  const lignes = BDE_MODULES.map(m => {
    const cur = _bdeAcces[m.id] || m.min;
    const minN = BDE_NIVEAUX.find(n => n.id === m.min).n;
    return `<div class="bdep-acc"><strong style="font-size:14px">${m.label}</strong>
      <select data-module="${m.id}">${BDE_NIVEAUX.map(n => `<option value="${n.id}" ${n.id === cur ? 'selected' : ''} ${n.n < minN ? 'disabled' : ''}>${n.label}</option>`).join('')}</select></div>`;
  }).join('');
  return `<div class="bdep-card full"><h3>Équipe du BDE</h3>
      <p class="bdep-note">Qui fait partie du BDE, du bureau, et qui administre. Les changements sont appliqués immédiatement et vérifiés côté serveur : seul un administrateur peut modifier un rôle.</p>
      <div id="bdep-equipe" class="bdep-liste"><p style="color:#888">Chargement…</p></div></div>
    <div class="bdep-card full"><h3>Comptes créés sur le site</h3>
      <p class="bdep-note">Les personnes qui se sont inscrites sur le site et ne sont pas encore dans le BDE. Ajoute-les en un clic.</p>
      <input type="text" id="bdep-eq-q" placeholder="Filtrer par nom, prénom ou e-mail" oninput="bdeCandidatsDebounce()" style="margin-bottom:10px">
      <div id="bdep-eq-res" class="bdep-liste"></div></div>
    <div class="bdep-card full"><h3>Accès aux pages de l'admin</h3>
      <p class="bdep-note">Choisis qui voit chaque module. Les administrateurs voient tout. Certains modules restent réservés au bureau au minimum, car leurs données sont protégées côté serveur.</p>
      ${lignes}</div>`;
}

function bdeParamRender() {
  const couleurs = bdeParamCouleurs();
  const actifs = _bdeParams.modules_actifs ? _bdeParams.modules_actifs.split(',').map(s => s.trim()) : BDE_MODULES.map(m => m.id);

  const hero = `<section class="bdep-hero"><span class="orb o1"></span><span class="orb o2"></span>
    <div class="bdep-hero-in">
      <img class="lg" id="bdep-h-logo" src="${bdeParamEsc(_bdeParams.logo_url || '')}" alt="" onerror="this.style.visibility='hidden'" onload="this.style.visibility='visible'">
      <div class="tx"><div class="eyebrow">Paramètres du BDE</div>
        <h1 id="bdep-h-nom"></h1>
        <div class="sub" id="bdep-h-sub"></div>
        <div class="bdep-chips" id="bdep-h-chips"></div></div>
      <div class="bdep-prog"><div class="bdep-ring"><svg viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="42" fill="none" stroke-width="8"/><circle class="fg" id="bdep-ring" cx="50" cy="50" r="42" fill="none" stroke-width="8" stroke-dasharray="263.9" stroke-dashoffset="263.9"/></svg><b id="bdep-pct">0%</b></div>
        <div><small id="bdep-prog-t">Profil du BDE</small><span class="bdep-pill" id="bdep-pill"></span></div></div>
    </div></section>`;

  const nav = `<nav class="bdep-nav" aria-label="Sections">${BDE_PARAM_ONGLETS.map(o =>
    `<button type="button" class="bdep-tab${o.id === _bdeParamOnglet ? ' on' : ''}" data-onglet="${o.id}" onclick="bdeParamOnglet('${o.id}')"><svg viewBox="0 0 24 24">${o.ico}</svg>${o.label}<i class="dot" hidden></i></button>`).join('')}</nav>`;

  const preview = `<div class="bdep-preview"><div class="bar"><img id="bdep-pv-logo" src="${bdeParamEsc(_bdeParams.logo_url || '')}" alt=""><span class="nm" id="bdep-pv-nom"></span><span class="bt">Rejoindre</span></div>
    <div class="body"><div class="col"><div class="lbl">Aperçu du site</div><span id="bdep-pv-slogan"></span></div>
    <div class="col mail"><div class="lbl">Aperçu d'un e-mail</div><b id="bdep-pv-exp"></b><br>Salut Prénom, ton inscription est confirmée.</div></div></div>`;

  const panneaux = BDE_PARAM_ONGLETS.map(o => {
    let inner = BDE_PARAM_SCHEMA.filter(s => s.onglet === o.id).map(s =>
      `<div class="bdep-card"><h3>${s.titre}</h3>${s.champs.map(bdeParamChampHtml).join('')}</div>`).join('');
    if (o.id === 'apparence') inner = `<div class="bdep-card full"><h3>Couleurs du BDE</h3>
        <p class="bdep-note">Une seule couleur : tout le site l'utilise. Plusieurs couleurs : le site utilise un dégradé dans l'ordre de la liste. La première est la couleur principale (boutons, menus, titres).</p>
        <div id="bdep-couleurs">${couleurs.map(bdeParamCouleurRow).join('')}</div>
        <button type="button" onclick="bdeParamAddCouleur()" class="bdep-add">+ Ajouter une couleur</button>
        <div id="bdep-grad-bar" class="bdep-grad"></div>
        <small class="bdep-aide" id="bdep-col-info"></small></div>`;
    if (o.id === 'modules') inner = `<div class="bdep-card full"><h3>Modules activés</h3>
        <p class="bdep-note">Désactive ce que ton BDE n'utilise pas : le module disparaît du menu de l'admin.</p>
        <div class="bdep-mods">${BDE_MODULES.map((m, i) => `<div class="bdep-mod" style="--i:${i}"><div><strong>${m.label}</strong><span class="d">${m.desc}</span></div>
          <label class="bdep-sw"><input type="checkbox" class="bdep-modchk" value="${m.id}" ${actifs.includes(m.id) ? 'checked' : ''} aria-label="${m.label}"><span class="bdep-sw-t"></span></label></div>`).join('')}</div></div>`;
    if (o.id === 'acces') inner = bdeParamAccesHtml();
    return `<div class="bdep-panneau" data-onglet="${o.id}" ${o.id === _bdeParamOnglet ? '' : 'hidden'}>${inner}</div>`;
  }).join('');

  const root = document.getElementById('bde-param-body');
  root.innerHTML = BDE_PARAM_CSS + `<div class="bdep">${hero}<div class="bdep-layout">${nav}<div class="bdep-main">${preview}${panneaux}</div></div></div>`;
  root.oninput = bdeParamOnInput;
  root.onchange = bdeParamOnInput;
  bdeParamPreviewCouleurs();
  _bdePctAffiche = 0;
  bdeParamMajVivant(true);
  bdeParamPill('ok', 'Tout est enregistré');
  if (_bdeParamOnglet === 'acces') bdeEquipeCharger();
}

// Texte du bandeau, aperçu et progression : mis à jour pendant la saisie
function bdeParamValeursLive() {
  const v = {};
  BDE_PARAM_SCHEMA.forEach(s => s.champs.forEach(c => { const el = document.getElementById('bdep-' + c.cle); if (el && c.type !== 'switch') v[c.cle] = el.value.trim(); }));
  v.couleurs = bdeParamLireCouleurs().length > 0 && !!(_bdeParams.couleurs || _bdeParams.couleur_principale);
  return v;
}
let _bdePctAffiche = 0;
function bdeParamMajVivant(premier) {
  const v = bdeParamValeursLive();
  const nom = v.nom || 'Ton BDE';
  const h = document.getElementById('bdep-h-nom');
  if (h && h.dataset.v !== nom) {
    h.dataset.v = nom;
    h.innerHTML = nom.split(' ').map((w, i) => `<span class="w" style="animation-delay:${(premier ? 0.25 : 0) + i * 0.08}s">${bdeParamEsc(w)}</span>`).join(' ');
  }
  const set = (id, t) => { const e = document.getElementById(id); if (e) e.textContent = t; };
  const meta = [v.ecole, v.ville].filter(Boolean).join(' · ');
  set('bdep-h-sub', v.slogan || meta || 'Configure l\'identité de ton BDE : tout le site s\'adapte.');
  const chips = document.getElementById('bdep-h-chips');
  if (chips) chips.innerHTML = [v.ecole, v.ville, (v.site_url || '').replace(/^https?:\/\//, '')].filter(Boolean).map(t => `<span class="bdep-chip">${bdeParamEsc(t)}</span>`).join('');
  set('bdep-pv-nom', v.nom_court || v.nom || '');
  set('bdep-pv-slogan', v.slogan || 'Ta phrase de présentation apparaîtra ici.');
  set('bdep-pv-exp', (v.nom_expediteur || v.nom || '') + (v.mail_expediteur ? ' <' + v.mail_expediteur + '>' : ''));
  ['bdep-h-logo', 'bdep-pv-logo'].forEach(id => { const i = document.getElementById(id); if (i && v.logo_url && i.getAttribute('src') !== v.logo_url) i.src = v.logo_url; });
  // progression
  const faits = BDE_PARAM_ETAPES.filter(e => e.ok(v));
  const pct = Math.round(faits.length / BDE_PARAM_ETAPES.length * 100);
  const ring = document.getElementById('bdep-ring'); if (ring) ring.style.strokeDashoffset = 263.9 * (1 - pct / 100);
  const el = document.getElementById('bdep-pct');
  if (el && pct !== _bdePctAffiche) {
    const from = _bdePctAffiche, t0 = performance.now(), dur = 900;
    _bdePctAffiche = pct;
    (function tick(t) { const k = Math.min(1, (t - t0) / dur); el.textContent = Math.round(from + (pct - from) * (1 - Math.pow(1 - k, 3))) + '%'; if (k < 1) requestAnimationFrame(tick); })(t0);
  }
  const manque = BDE_PARAM_ETAPES.filter(e => !e.ok(v));
  set('bdep-prog-t', manque.length ? 'À compléter : ' + manque.slice(0, 2).map(e => e.label).join(', ') + (manque.length > 2 ? '…' : '') : 'Profil complet');
  document.querySelectorAll('.bdep-tab').forEach(b => { const d = b.querySelector('.dot'); if (d) d.hidden = !manque.some(e => e.onglet === b.dataset.onglet); });
}

function bdeParamOnglet(id) {
  _bdeParamOnglet = id;
  document.querySelectorAll('.bdep-tab').forEach(b => b.classList.toggle('on', b.dataset.onglet === id));
  document.querySelectorAll('.bdep-panneau').forEach(p => {
    const actif = p.dataset.onglet === id;
    p.hidden = !actif;
    if (actif) p.querySelectorAll('.bdep-card').forEach((c, i) => { c.style.setProperty('--i', i); c.style.animation = 'none'; void c.offsetWidth; c.style.animation = ''; });
  });
  if (id === 'acces') bdeEquipeCharger();
}

function bdeParamOnInput(e) {
  const el = e.target;
  if (el.closest && (el.closest('.bdep-eq') || el.id === 'bdep-eq-q')) return;   // équipe : enregistré tout de suite
  if (el.closest && el.closest('.bdep-col-row')) {
    const row = el.closest('.bdep-col-row'), cp = row.querySelector('.cp'), hx = row.querySelector('.hx');
    if (el === cp) hx.value = cp.value;
    else { const h = bdeParamHexNorm(hx.value); if (h) cp.value = h; hx.style.borderColor = h || hx.value === '' ? '' : '#dc2626'; }
    bdeParamPreviewCouleurs();
  }
  if (el.id === 'bdep-logo_url') { const i = document.getElementById('bdep-logo_url-preview'); if (i) i.src = el.value; }
  bdeParamMajVivant();
  bdeParamMarkDirty();
}

// ── Enregistrement automatique ───────────────────────────────
const BDE_PILL_ICO = { ok: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg>', wait: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke-dasharray="14 40"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur=".8s" repeatCount="indefinite"/></circle></svg>', err: '<svg viewBox="0 0 24 24"><path d="M12 7v6M12 17h.01"/></svg>' };
function bdeParamPill(etat, txt) {
  const p = document.getElementById('bdep-pill'); if (!p) return;
  p.className = 'bdep-pill ' + etat;
  p.innerHTML = BDE_PILL_ICO[etat] + '<span>' + txt + '</span>';
}

function bdeParamMarkDirty() {
  window.onbeforeunload = () => 'Enregistrement en cours';
  bdeParamPill('wait', 'Modification…');
  clearTimeout(_bdeSaveTimer);
  _bdeSaveTimer = setTimeout(bdeParamSave, 900);
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
    showToast('Logo envoyé', 'success');
  } catch (e) { showToast('Erreur upload : ' + e.message, 'error'); }
  input.value = '';
}

// ── Validation (silencieuse : ne déplace pas le focus pendant la saisie) ──
function bdeParamValider() {
  const RE_MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const RE_URL = /^(https?:\/\/|\/)\S+$/i;
  let erreurs = 0;
  BDE_PARAM_SCHEMA.forEach(s => s.champs.forEach(c => {
    const el = document.getElementById('bdep-' + c.cle), err = document.getElementById('bdep-' + c.cle + '-err');
    if (!el || !err) return;
    const v = el.value.trim();
    let msg = '';
    if (c.requis && !v) msg = 'Champ obligatoire.';
    else if (v && c.type === 'email' && !RE_MAIL.test(v)) msg = 'Adresse e-mail invalide.';
    else if (v && (c.type === 'url' || c.type === 'image') && !RE_URL.test(v)) msg = 'Lien invalide (doit commencer par https://).';
    else if (v && c.type === 'number' && !/^\d+([.,]\d+)?$/.test(v)) msg = 'Nombre invalide.';
    err.textContent = msg;
    if (msg) erreurs++;
  }));
  const mauvaise = [...document.querySelectorAll('#bdep-couleurs .hx')].find(h => !bdeParamHexNorm(h.value));
  if (mauvaise) erreurs++;
  return erreurs === 0;
}

async function bdeParamSave() {
  clearTimeout(_bdeSaveTimer);
  if (_bdeSaving) { _bdeSaveAgain = true; return; }
  if (!bdeParamValider()) { bdeParamPill('err', 'Corrige les champs en rouge'); return; }
  _bdeSaving = true;
  bdeParamPill('wait', 'Enregistrement…');
  try {
    const user = await Auth.getUser();
    const now = new Date().toISOString();
    const rows = [];
    BDE_PARAM_SCHEMA.forEach(sec => sec.champs.forEach(c => {
      const el = document.getElementById('bdep-' + c.cle);
      if (!el) return;
      let valeur = c.type === 'switch' ? (el.checked ? 'true' : 'false') : el.value.trim();
      if (c.type === 'number') valeur = valeur.replace(',', '.');
      rows.push({ cle: c.cle, valeur, updated_at: now, updated_by: user.id });
    }));
    const L = bdeParamLireCouleurs();
    rows.push({ cle: 'couleurs', valeur: JSON.stringify(L), updated_at: now, updated_by: user.id });
    // anciens paramètres gardés synchronisés (lus par des pages pas encore migrées)
    rows.push({ cle: 'couleur_principale', valeur: L[0], updated_at: now, updated_by: user.id });
    rows.push({ cle: 'couleur_secondaire', valeur: L[1] || L[0], updated_at: now, updated_by: user.id });
    rows.push({ cle: 'couleur_accent', valeur: L[L.length - 1], updated_at: now, updated_by: user.id });
    const mods = [...document.querySelectorAll('.bdep-modchk:checked')].map(i => i.value).join(',');
    rows.push({ cle: 'modules_actifs', valeur: mods, updated_at: now, updated_by: user.id });
    const acces = [...document.querySelectorAll('.bdep-acc select')].map(se => ({ module: se.dataset.module, niveau: se.value, updated_at: now, updated_by: user.id }));
    const accesChange = acces.some(a => (_bdeAcces[a.module] || (BDE_MODULES.find(m => m.id === a.module) || {}).min) !== a.niveau);
    const modsChange = (_bdeParams.modules_actifs || '') !== mods;

    let { error } = await Auth.sb.from('bde_parametres').upsert(rows);
    if (!error && acces.length) ({ error } = await Auth.sb.from('bde_acces').upsert(acces));
    if (error) throw error;

    rows.forEach(r => { _bdeParams[r.cle] = r.valeur; });
    acces.forEach(a => { _bdeAcces[a.module] = a.niveau; });
    if (window.BDE) { BDE.vider(); Object.assign(BDE.all(), _bdeParams); BDE.appliquer(); }
    if ((modsChange || accesChange) && typeof adminAppliquerAcces === 'function') adminAppliquerAcces();
    bdeParamMajVivant();
    if (!_bdeSaveAgain) {
      window.onbeforeunload = null;
      bdeParamPill('ok', 'Enregistré');
      setTimeout(() => { const p = document.getElementById('bdep-pill'); if (p && p.classList.contains('ok') && !_bdeSaving) p.lastChild.textContent = 'Tout est enregistré'; }, 2200);
    }
  } catch (e) {
    bdeParamPill('err', 'Échec : ' + (e.message || 'erreur'));
  } finally {
    _bdeSaving = false;
    if (_bdeSaveAgain) { _bdeSaveAgain = false; bdeParamSave(); }
  }
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
const bdeCollator = new Intl.Collator('fr', { sensitivity: 'base' });
function bdeInitiale(p) { return ((p.prenom || p.nom || '?')[0] || '?').toUpperCase(); }

async function bdeEquipeCharger() {
  const box = document.getElementById('bdep-equipe'); if (!box) return;
  const { data, error } = await Auth.sb.from('profils').select('id,prenom,nom,email,role,bureau')
    .or('role.in.(membre,responsable,admin),bureau.eq.true');
  if (error) { box.innerHTML = '<p style="color:#c0392b">' + bdeParamEsc(error.message) + '</p>'; return; }
  // ordre alphabétique des prénoms (puis des noms)
  _bdeEquipe = (data || []).sort((a, b) => bdeCollator.compare(a.prenom || '', b.prenom || '') || bdeCollator.compare(a.nom || '', b.nom || ''));
  const moi = await Auth.getUser();
  box.innerHTML = _bdeEquipe.map(p => {
    const niv = bdeNiveauDe(p), soi = moi && p.id === moi.id;
    const opts = [['admin', 'Administrateur'], ['bureau', 'Bureau'], ['membre', 'Membre'], ['aucun', 'Retirer du BDE']];
    return `<div class="bdep-eq"><span class="bdep-av">${bdeParamEsc(bdeInitiale(p))}</span><div class="qui"><b>${bdeParamEsc((p.prenom || '') + ' ' + (p.nom || ''))}${soi ? ' (toi)' : ''}</b><small>${bdeParamEsc(p.email || '')}</small></div>
      <select ${soi ? 'disabled title="Tu ne peux pas modifier ton propre rôle"' : ''} onchange="bdeEquipeSet('${p.id}',this)" data-avant="${niv}">${opts.map(o => `<option value="${o[0]}" ${o[0] === niv ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div>`;
  }).join('') || '<p style="color:#888">Personne pour l\'instant.</p>';
  bdeCandidatsCharger();
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
  p.role = BDE_ROLE_VERS[niv].role; p.bureau = BDE_ROLE_VERS[niv].bureau;
  showToast('Rôle mis à jour', 'success');
  if (niv === 'aucun') bdeEquipeCharger();
}

// Comptes créés sur le site (rôle « etudiant »), les plus récents d'abord ; filtrables
let _bdeCandTimer = null;
function bdeCandidatsDebounce() { clearTimeout(_bdeCandTimer); _bdeCandTimer = setTimeout(bdeCandidatsCharger, 300); }
async function bdeCandidatsCharger() {
  const res = document.getElementById('bdep-eq-res'); if (!res) return;
  const q = ((document.getElementById('bdep-eq-q') || {}).value || '').replace(/[,()%*]/g, ' ').trim();
  let req = Auth.sb.from('profils').select('id,prenom,nom,email,role,bureau,created_at').eq('role', 'etudiant').order('created_at', { ascending: false }).limit(40);
  if (q.length >= 2) req = req.or(`nom.ilike.%${q}%,prenom.ilike.%${q}%,email.ilike.%${q}%`);
  const { data, error } = await req;
  if (error) { res.innerHTML = '<small class="bdep-err">' + bdeParamEsc(error.message) + '</small>'; return; }
  const l = (data || []).filter(p => !p.bureau);
  res.innerHTML = l.map(p => `<div class="bdep-eq"><span class="bdep-av" style="background:#94a3b8">${bdeParamEsc(bdeInitiale(p))}</span>
    <div class="qui"><b>${bdeParamEsc((p.prenom || '') + ' ' + (p.nom || ''))}</b><small>${bdeParamEsc(p.email || '')}${p.created_at ? ' · inscrit le ' + new Date(p.created_at).toLocaleDateString('fr-FR') : ''}</small></div>
    <button type="button" class="bdep-btn" onclick="bdeEquipeAjouter('${p.id}')">Ajouter au BDE</button></div>`).join('')
    || '<p style="color:#888;font-size:13px">' + (q ? 'Aucun compte ne correspond.' : 'Aucun compte en attente : tout le monde est déjà dans le BDE.') + '</p>';
}

async function bdeEquipeAjouter(id) {
  const { error } = await Auth.sb.from('profils').update(BDE_ROLE_VERS.membre).eq('id', id);
  if (error) return showToast('Refusé : ' + error.message, 'error');
  showToast('Ajouté comme membre du BDE', 'success');
  bdeEquipeCharger();
}
