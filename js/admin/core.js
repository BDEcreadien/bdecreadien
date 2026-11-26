/* BDE Admin — module core
   Extrait tel quel de admin.html (scripts classiques, portée globale partagée). */
const REPO = 'BDEcreadien/bdecreadien';
const BRANCH = 'main';
const FSQ_KEY = '5IXV1B22BJ4NNZTLB0B4BWEZYIFO50AZ5A12K3NHSWHWSFJA';
let token = '';
let uploadSecret = '';
let data = { evenements: [], annonces: [], videos: [], equipe: [], config: null, galerie: [], partenaires: [], 'annonces-categories': [] };
let editIndex = { evenement: -1, annonce: -1, video: -1, membre: -1, archive: -1, galerie: -1, partenaire: -1 };
let navStack = []; // ['pages'] | ['pages','sections','accueil'] | ['pages','editor','evenements']

// ============================================================
// AUTH
// ============================================================
async function login() {
  const t = document.getElementById('token-input').value.trim();
  if (!t) return showToast('Entre un token', 'error');
  // Enregistrement côté Supabase pour partager le token avec tous les membres BDE
  const user = await Auth.getUser();
  const { error } = await Auth.sb.from('bde_config').upsert({
    id: 'github_token', value: t, updated_at: new Date().toISOString(), updated_by: user.id
  });
  if (error) return showToast('Erreur : ' + error.message, 'error');
  sessionStorage.setItem('bde_admin_token', t); // cache session (non persistant)
  token = t;
  document.getElementById('screen-login').style.display = 'none';
  init();
}
function logout() {
  sessionStorage.removeItem('bde_admin_token');
  if (window.Auth && Auth.logout) Auth.logout();
  else window.location.href = '/';
}

// ============================================================
// HERO PAR PAGE
// ============================================================
function adminRenderHero(containerId, { icon, title, sub, chips, actions } = {}) {
  const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
  if (!container) return;
  const existing = container.querySelector('.admin-page-hero');
  if (existing) existing.remove();
  const chipsHtml = chips && chips.length
    ? `<div class="aph-chips">${chips.map(c => `<span class="aph-chip">${c}</span>`).join('')}</div>` : '';
  const actionsHtml = actions && actions.length
    ? `<div class="aph-actions">${actions.map(a =>
        `<button class="aph-btn${a.primary ? ' aph-btn-primary' : ''}" onclick="${a.onclick}">${a.label}</button>`
      ).join('')}</div>` : '';
  const div = document.createElement('div');
  div.className = 'admin-page-hero';
  div.innerHTML = `<div class="aph-icon">${icon || ''}</div><div class="aph-body"><div class="aph-title">${title || ''}</div>${sub ? `<div class="aph-sub">${sub}</div>` : ''}${chipsHtml}</div>${actionsHtml}`;
  container.prepend(div);
}

function adminShowGitHubSetup() {
  const notice = document.getElementById('admin-github-notice');
  if (notice) notice.style.display = 'none';
  document.getElementById('screen-app').style.display = 'none';
  const loginEl = document.getElementById('screen-login');
  if (loginEl) loginEl.style.display = 'flex';
}

async function init() {
  document.getElementById('screen-login').style.display = 'none';
  document.getElementById('screen-app').style.display = 'block';
  // btn-logout removed

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
  const urlPage = new URLSearchParams(location.search).get('page');
  if (urlPage) {
    selectPage(urlPage);
  } else {
    showStep('pages');
  }
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
  const nlEl = document.getElementById('step-newsletter');
  if (nlEl) nlEl.style.display = 'none';
  const finEl = document.getElementById('step-finances');
  if (finEl) finEl.style.display = 'none';
  const plnEl = document.getElementById('step-planning');
  if (plnEl) plnEl.style.display = 'none';
  const lnkEl = document.getElementById('step-liens');
  if (lnkEl) lnkEl.style.display = 'none';
  const facEl = document.getElementById('step-factures');
  if (facEl) facEl.style.display = 'none';
  const bilEl = document.getElementById('step-billetterie');
  if (bilEl) bilEl.style.display = 'none';
  const qrEl = document.getElementById('step-qr');
  if (qrEl) qrEl.style.display = 'none';
  const bdeEl = document.getElementById('step-bde');
  if (bdeEl) bdeEl.style.display = 'none';
  const btqaEl = document.getElementById('step-boutique');
  if (btqaEl) btqaEl.style.display = 'none';
  // Les steps hors #screen-app (planning, liens, factures, billetterie, qr, bde, boutique)
  // doivent masquer #screen-app pour éviter le bandeau blanc (padding vide)
  const outsideSteps = ['planning', 'planning-semaine', 'liens', 'factures', 'billetterie', 'qr', 'bde', 'boutique'];
  const screenApp = document.getElementById('screen-app');
  if (screenApp) screenApp.style.display = outsideSteps.includes(step) ? 'none' : 'block';
  document.getElementById('step-' + step).style.display = 'block';
  if (step === 'pages') { window._adminPage = 'home'; if (typeof adminSyncSidebar === 'function') adminSyncSidebar(); if (typeof dashRender === 'function') dashRender(); }
  document.getElementById('btn-back').style.display = step === 'sections' || step === 'editor' ? 'inline-block' : 'none';
  // Sync URL : /admin sans param quand on est sur les cartes de choix,
  // /admin?page=X sinon (permet un refresh cohérent avec ce qu'on voit)
  try {
    if (step === 'pages') {
      if (location.search) history.replaceState({}, '', location.pathname);
    } else if (['fidelite', 'newsletter', 'finances', 'stats', 'planning', 'liens', 'factures', 'billetterie', 'qr', 'boutique', 'bde'].includes(step)) {
      const wanted = '?page=' + step;
      if (location.search !== wanted) history.replaceState({}, '', location.pathname + wanted);
    }
  } catch (_) {}
}

function goBack() {
  navStack.pop();
  const prev = navStack[navStack.length - 1];
  if (!prev || prev === 'pages') { navStack = ['pages']; showStep('pages'); }
  else if (prev === 'stats') showStep('stats');
  else if (prev === 'fidelite') { showStep('fidelite'); initFidelite(); }
  else if (prev === 'newsletter') { showStep('newsletter'); initNewsletter(); }
  else if (prev === 'finances') { showStep('finances'); initFinances(); }
  else if (prev === 'planning') { showStep('planning'); initPlanning(); }
  else if (prev === 'liens') { showStep('liens'); initLiens(); }
  else if (prev === 'factures') { showStep('factures'); if (typeof initFactures === 'function') initFactures(); }
  else if (prev === 'billetterie') { showStep('billetterie'); if (typeof initBilletterie === 'function') initBilletterie(); }
  else if (prev === 'qr') { showStep('qr'); initQrPage(); }
  else if (prev === 'bde') { showStep('bde'); initParametresBde(); }
  else if (prev === 'boutique') { showStep('boutique'); initBoutiqueAdmin(); }
  else if (prev.startsWith('sections:')) showStep('sections');
  else if (prev.startsWith('editor:')) {
    const type = prev.split(':')[1];
    openEditor(type, false);
  }
}

function selectPage(page) {
  if (window._adminInterdits && window._adminInterdits.has(page)) return;   // module masqué ou non autorisé
  window._adminPage = page;
  if (typeof adminSyncSidebar === 'function') adminSyncSidebar();
  navStack = ['pages'];
  if (page === 'agenda') {
    openEditor('evenements', true, 'Agenda', 'Événements');
    if (window.Auth?.sb) plnSyncJsonEvents().catch(() => {});
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
  } else if (page === 'newsletter') {
    navStack.push('newsletter');
    showStep('newsletter');
    initNewsletter();
  } else if (page === 'finances') {
    navStack.push('finances');
    showStep('finances');
    initFinances();
  } else if (page === 'planning') {
    navStack.push('planning');
    showStep('planning');
    initPlanning();
  } else if (page === 'liens') {
    navStack.push('liens');
    showStep('liens');
    initLiens();
  } else if (page === 'factures') {
    navStack.push('factures');
    showStep('factures');
    if (typeof initFactures === 'function') initFactures();
  } else if (page === 'billetterie') {
    navStack.push('billetterie');
    showStep('billetterie');
    if (typeof initBilletterie === 'function') initBilletterie();
  } else if (page === 'parametres') {
    navStack = ['pages'];
    document.getElementById('editor-title').textContent = 'Page Contact';
    document.getElementById('editor-badge').textContent = 'Site';
    Auth.sb.from('bde_config').select('value').eq('id', 'qr_destination').maybeSingle()
      .then(({ data: row }) => { if (row?.value) data._qrDestination = row.value; })
      .finally(() => {
        document.getElementById('editor-content').innerHTML = buildParametresEditor();
        showStep('editor');
      });
  } else if (page === 'bde') {
    navStack.push('bde');
    showStep('bde');
    document.title = 'Paramètres du BDE - Admin';
    initParametresBde();
  } else if (page === 'qr') {
    navStack.push('qr');
    showStep('qr');
    initQrPage();
  } else if (page === 'boutique') {
    navStack.push('boutique');
    showStep('boutique');
    document.title = 'Merchandising - Admin BDE';
    initBoutiqueAdmin();
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
// GITHUB API
// ============================================================
async function getFile(path) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}?t=${Date.now()}`, {
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
  });
  if (!res.ok) throw new Error('Fichier introuvable');
  return res.json();
}
async function saveFile(path, content, sha, message) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2)))), sha, branch: BRANCH })
  });
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(`${res.status} - ${b.message || ''}`); }
}
function showAuthError() {
  const app = document.getElementById('screen-app');
  const existing = document.getElementById('auth-error-banner');
  if (existing) return;
  const banner = document.createElement('div');
  banner.id = 'auth-error-banner';
  banner.style.cssText = 'background:#c0392b;color:#fff;padding:1.2rem 1.5rem;border-radius:10px;margin:1.5rem;text-align:center;font-size:14px;';
  banner.innerHTML = `<strong>Token GitHub invalide ou expiré.</strong> Reconnecte-toi pour continuer.<br><br>
    <button onclick="document.getElementById('auth-error-banner').remove();localStorage.removeItem('bde_gh_token');token=null;document.getElementById('screen-login').style.display='flex';document.getElementById('screen-app').style.display='none';document.getElementById('btn-logout').style.display='none';" style="margin-top:0.5rem;padding:8px 20px;background:#fff;color:#c0392b;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;">Se reconnecter</button>`;
  app.prepend(banner);
}
async function loadData(type) {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/contents/_data/${type}.json?t=${Date.now()}`, {
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
    });
    if (res.status === 401 || res.status === 403) {
      showAuthError();
      data[type] = type === 'config' ? null : [];
      return;
    }
    if (res.status === 404) {
      data[type] = type === 'config' ? null : [];
      return;
    }
    if (!res.ok) {
      console.warn(`Erreur réseau (${res.status}) pour ${type}`);
      data[type] = type === 'config' ? null : [];
      return;
    }
    const file = await res.json();
    const bytes = Uint8Array.from(atob(file.content.replace(/\n/g, '')), c => c.charCodeAt(0));
    const raw = JSON.parse(new TextDecoder().decode(bytes));
    data[type] = type === 'config' ? raw : (Array.isArray(raw) ? raw : (raw[type] || []));
  } catch(e) { data[type] = type === 'config' ? null : []; }
}
async function persistData(type, message) {
  // Toujours récupérer le SHA le plus récent ; si 409, on réessaie une fois avec le SHA actuel
  const path = `_data/${type}.json`;
  const file = await getFile(path);
  try {
    await saveFile(path, data[type], file.sha, message);
  } catch(e) {
    if (e.message.startsWith('409')) {
      const file2 = await getFile(path);
      await saveFile(path, data[type], file2.sha, message);
    } else { throw e; }
  }
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


// ============================================================


// ============================================================
// SIDEBAR (générée depuis les cartes visibles : un seul endroit à maintenir,
// elle respecte donc automatiquement les rôles et les modules activés)
// ============================================================
function adminBuildSidebar() {
  const nav = document.getElementById('sb-nav');
  if (!nav) return;
  let html = `<button class="sb-item" data-page="home" onclick="adminGoHome()"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>Vue d'ensemble</button>`;
  document.querySelectorAll('#step-pages .admin-group-title').forEach(title => {
    const grid = title.nextElementSibling;
    if (!grid || !grid.classList.contains('pages-grid')) return;
    const cards = [...grid.querySelectorAll('.page-card')].filter(c => c.style.display !== 'none');
    if (!cards.length) return;
    html += `<div class="sb-section-label">${title.textContent.trim()}</div>`;
    cards.forEach(c => {
      const m = (c.getAttribute('onclick') || '').match(/selectPage\('([^']+)'\)/);
      if (!m) return;
      const svg = c.querySelector('.page-card-icon svg');
      const nom = c.querySelector('.page-card-name').textContent.trim();
      html += `<button class="sb-item" data-page="${m[1]}" onclick="selectPage('${m[1]}');adminToggleSidebar(false)">${svg ? svg.outerHTML : ''}<span>${nom}</span></button>`;
    });
  });
  nav.innerHTML = html;
  document.body.classList.add('admin-ready');
  adminSyncSidebar();
}

function adminSyncSidebar() {
  const cur = window._adminPage || 'home';
  let label = '';
  document.querySelectorAll('#sb-nav .sb-item').forEach(b => {
    const on = b.dataset.page === cur;
    b.classList.toggle('active', on);
    if (on) label = b.textContent.trim();
  });
  const t = document.getElementById('tb-title');
  if (t) t.textContent = cur === 'home' ? '' : label;
}

function adminGoHome() {
  navStack = ['pages'];
  showStep('pages');
  adminToggleSidebar(false);
}

function adminToggleSidebar(force) {
  const open = typeof force === 'boolean' ? force : !document.body.classList.contains('sb-open');
  document.body.classList.toggle('sb-open', open);
}
