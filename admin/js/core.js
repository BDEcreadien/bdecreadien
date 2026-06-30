const REPO = 'BDEcreadien/bdecreadien';
const BRANCH = 'main';
const FSQ_KEY = '5IXV1B22BJ4NNZTLB0B4BWEZYIFO50AZ5A12K3NHSWHWSFJA';
let token = '';
let data = { evenements: [], annonces: [], videos: [], equipe: [], config: null, galerie: [], partenaires: [], 'annonces-categories': [] };
let editIndex = { evenement: -1, annonce: -1, video: -1, membre: -1, archive: -1, galerie: -1, partenaire: -1 };
let navStack = []; // ['pages'] | ['pages','sections','accueil'] | ['pages','editor','evenements']

// ============================================================
// AUTH
// ============================================================
function login() {
  const t = document.getElementById('token-input').value.trim();
  if (!t) return showToast('Entre un token', 'error');
  localStorage.setItem('bde_admin_token', t);
  token = t;
  init();
}
function logout() {
  localStorage.removeItem('bde_admin_token');
  document.getElementById('screen-login').style.display = 'flex';
  document.getElementById('screen-app').style.display = 'none';
  document.getElementById('btn-logout').style.display = 'none';
}
async function init() {
  document.getElementById('screen-login').style.display = 'none';
  document.getElementById('screen-app').style.display = 'block';
  document.getElementById('btn-logout').style.display = 'block';

  // Affiche un loader le temps de charger les données depuis GitHub
  document.getElementById('step-pages').style.display = 'none';
  document.getElementById('step-sections').style.display = 'none';
  document.getElementById('step-editor').style.display = 'none';
  document.getElementById('btn-back').style.display = 'none';
  const loader = document.createElement('div');
  loader.id = 'init-loader';
  loader.innerHTML = '<p style="text-align:center;padding:4rem 2rem;color:var(--gris-texte);font-size:15px;">Chargement des données…</p>';
  document.getElementById('screen-app').prepend(loader);

  await Promise.all([loadData('evenements'), loadData('annonces'), loadData('videos'), loadData('equipe'), loadData('archives'), loadData('config'), loadData('galerie'), loadData('partenaires'), loadData('annonces-categories')]);
  if (!data['annonces-categories'] || data['annonces-categories'].length === 0) {
    data['annonces-categories'] = [
      { key: 'materiel', label: 'Matériel' },
      { key: 'place', label: 'Places' },
      { key: 'logement', label: 'Logement' },
      { key: 'autre', label: 'Autre' }
    ];
  }

  loader.remove();
  showStep('pages');
}

// ============================================================
// NAVIGATION
// ============================================================
function showStep(step, opts = {}) {
  document.getElementById('step-pages').style.display = 'none';
  document.getElementById('step-sections').style.display = 'none';
  document.getElementById('step-editor').style.display = 'none';
  document.getElementById('step-stats').style.display = 'none';
  document.getElementById('step-fidelite').style.display = 'none';
  document.getElementById('step-' + step).style.display = 'block';
  document.getElementById('btn-back').style.display = step === 'pages' ? 'none' : 'block';
}

function goBack() {
  navStack.pop();
  const prev = navStack[navStack.length - 1];
  if (!prev || prev === 'pages') { navStack = ['pages']; showStep('pages'); }
  else if (prev === 'stats') showStep('stats');
  else if (prev === 'fidelite') { showStep('fidelite'); initFidelite(); }
  else if (prev.startsWith('sections:')) showStep('sections');
  else if (prev.startsWith('editor:')) {
    const type = prev.split(':')[1];
    openEditor(type, false);
  }
}

function selectPage(page) {
  navStack = ['pages'];
  if (page === 'agenda') {
    openEditor('evenements', true, 'Agenda', 'Événements');
  } else if (page === 'annonces') {
    openEditor('annonces', true, 'Annonces', 'Annonces');
  } else if (page === 'accueil') {
    openEditor('videos', true, 'Accueil', 'Médias (photos & vidéos)');
  } else if (page === 'communication') {
    openEditor('equipe', true, 'Communication', 'Équipe BDE');
  } else if (page === 'archives') {
    openEditor('archives', true, 'Archives', 'Événements passés');
  } else if (page === 'galerie') {
    openEditor('galerie', true, 'Galerie', 'Photos galerie');
  } else if (page === 'partenaires') {
    openEditor('partenaires', true, 'Partenaires', 'Sponsors & partenaires');
  } else if (page === 'stats') {
    navStack.push('stats');
    document.getElementById('editor-title').textContent = '';
    showStep('stats');
    initStatsPage();
  } else if (page === 'fidelite') {
    navStack.push('fidelite');
    showStep('fidelite');
    initFidelite();
  } else if (page === 'parametres') {
    navStack = ['pages'];
    document.getElementById('editor-title').textContent = 'Paramètres du site';
    document.getElementById('editor-badge').textContent = 'Site';
    document.getElementById('editor-content').innerHTML = buildParametresEditor();
    showStep('editor');
  }
}

function openEditor(type, push = true, pageName = '', sectionName = '') {
  if (push) navStack.push(`editor:${type}`);
  document.getElementById('editor-title').textContent = sectionName || type;
  document.getElementById('editor-badge').textContent = pageName || '';
  document.getElementById('editor-content').innerHTML = buildEditor(type);
  showStep('editor');
  initEditorEvents(type);
}

function openEditorStockage(pageName, sectionName) {
  document.getElementById('editor-title').textContent = sectionName;
  document.getElementById('editor-badge').textContent = pageName;
  document.getElementById('editor-content').innerHTML = buildStorageEditor();
  showStep('editor');
  loadStorage();
}

// ============================================================
// TOAST & BOOT
// ============================================================
function showProgress(label = 'Envoi en cours…') {
  document.getElementById('upload-label').textContent = label;
  setProgress(0);
  document.getElementById('upload-progress').style.display = 'flex';
}
function setProgress(pct, label) {
  document.getElementById('upload-bar').style.width = pct + '%';
  document.getElementById('upload-pct').textContent = pct + '%';
  if (label) document.getElementById('upload-label').textContent = label;
}
function hideProgress() {
  document.getElementById('upload-progress').style.display = 'none';
}

function showConfirm(title, subtitle = '') {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:white;border-radius:16px;padding:2rem;max-width:380px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
        <div style="width:48px;height:48px;background:rgba(220,50,50,0.1);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c0392b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </div>
        <p style="font-size:16px;font-weight:700;margin-bottom:0.4rem;">${title}</p>
        ${subtitle ? `<p style="font-size:13px;color:#6b6b7b;margin-bottom:1.5rem;">${subtitle}</p>` : '<div style="margin-bottom:1.5rem;"></div>'}
        <div style="display:flex;gap:0.75rem;">
          <button id="confirm-cancel" style="flex:1;padding:10px;border-radius:10px;border:1.5px solid #e0e0e5;background:white;font-size:14px;font-weight:600;cursor:pointer;">Annuler</button>
          <button id="confirm-ok" style="flex:1;padding:10px;border-radius:10px;border:none;background:#c0392b;color:white;font-size:14px;font-weight:600;cursor:pointer;">Supprimer</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#confirm-cancel').onclick = () => { overlay.remove(); resolve(false); };
    overlay.querySelector('#confirm-ok').onclick = () => { overlay.remove(); resolve(true); };
  });
}

