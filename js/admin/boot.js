/* BDE Admin — module boot
   Extrait tel quel de admin.html (scripts classiques, portée globale partagée). */
// ============================================================
// AUTO-LOGOUT sur inactivité (sécurité)
// - 30 min sans activité → déconnexion
// - 4h max même en cas d'activité continue → re-login forcé
// ============================================================
(function () {
  const INACTIVITY_MS = 4 * 60 * 60 * 1000;  // 4h
  const HARD_CAP_MS   = 24 * 60 * 60 * 1000; // 24h
  let inactivityTimer, hardCapTimer;
  const sessionStart = Date.now();

  function doLogout(reason) {
    console.log('[admin] auto-logout:', reason);
    try { sessionStorage.removeItem('bde_admin_token'); } catch (_) {}
    if (window.Auth && Auth.logout) Auth.logout();
    else window.location.href = '/connexion.html?next=/admin-v2&expired=1';
  }

  function resetInactivity() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => doLogout('inactivité 30 min'), INACTIVITY_MS);
    // Vérif hard cap à chaque activité
    if (Date.now() - sessionStart > HARD_CAP_MS) doLogout('session > 4h');
  }

  ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(ev => {
    document.addEventListener(ev, resetInactivity, { passive: true });
  });
  resetInactivity();
  hardCapTimer = setTimeout(() => doLogout('session > 4h (timer)'), HARD_CAP_MS);
})();

window.addEventListener('DOMContentLoaded', async () => {
  // btn-logout removed

  // 1. Auth Supabase - role >= membre
  const profil0 = await Auth.getProfil();
  if (profil0 && profil0.role === 'etudiant') {
    document.getElementById('screen-auth-check').innerHTML = '<p style="padding:60px 24px;text-align:center;font-size:16px;color:#666;">403 — Tu n\'es pas autorisé à accéder à cette page.</p>';
    return;
  }
  const ok = await Auth.requireRole('membre');
  if (!ok) return; // redirect vers /connexion.html?next=/admin-v2

  const profil = await Auth.getProfil();
  document.getElementById('screen-auth-check').style.display = 'none';

  // Accès aux modules : niveau de l'utilisateur (1 membre, 2 bureau, 3 admin) comparé au niveau requis,
  // lu dans bde_acces (réglé dans « Paramètres du BDE > Équipe & accès »). Modules désactivés masqués.
  // Le rôle vient de la table profils, protégée côté serveur : ce code ne fait qu'afficher le menu.
  const niveau = profil && profil.role === 'admin' ? 3 : (profil && profil.bureau === true ? 2 : 1);
  const NIV = { membre: 1, bureau: 2, admin: 3 };
  const MIN_DEFAUT = { contenu: 'membre', newsletter: 'membre', fidelite: 'membre', stats: 'membre', liens: 'membre', qr: 'membre',
                       boutique: 'bureau', billetterie: 'bureau', finances: 'bureau', facturation: 'bureau', planning: 'bureau' };
  const PAGES_PAR_MODULE = {
    contenu: ['agenda', 'annonces', 'accueil', 'communication', 'archives', 'galerie', 'partenaires', 'parametres'],
    boutique: ['boutique'], billetterie: ['billetterie'], finances: ['finances'], facturation: ['factures'],
    planning: ['planning'], newsletter: ['newsletter'], fidelite: ['fidelite'], liens: ['liens'], qr: ['qr'], stats: ['stats'],
  };
  let actifs = null; const acces = {};
  try {
    const [m, a] = await Promise.all([
      Auth.sb.from('bde_parametres').select('valeur').eq('cle', 'modules_actifs').maybeSingle(),
      Auth.sb.from('bde_acces').select('module,niveau'),
    ]);
    if (m.data && m.data.valeur) actifs = m.data.valeur.split(',').map(x => x.trim());
    (a.data || []).forEach(r => { acces[r.module] = r.niveau; });
  } catch (_) {}
  window._adminInterdits = new Set();
  Object.keys(PAGES_PAR_MODULE).forEach(mod => {
    const requis = NIV[acces[mod] || MIN_DEFAUT[mod]] || 3;
    const ok = (!actifs || actifs.includes(mod)) && niveau >= requis;
    PAGES_PAR_MODULE[mod].forEach(pg => {
      if (!ok) window._adminInterdits.add(pg);
      document.querySelectorAll(`.page-card[onclick="selectPage('${pg}')"]`).forEach(c => { c.style.display = ok ? '' : 'none'; });
    });
  });
  if (niveau === 3) {
    const bdeCard = document.getElementById('page-card-bde');
    if (bdeCard) bdeCard.style.display = '';
  }
  try {
    document.getElementById('sb-name').textContent = ((profil && profil.prenom) || '') + ' ' + ((profil && profil.nom) || '');
    document.getElementById('sb-avatar').textContent = ((profil && profil.prenom) || '?')[0].toUpperCase();
    document.getElementById('sb-role').textContent = niveau === 3 ? 'Administrateur' : (niveau === 2 ? 'Bureau BDE' : 'Membre BDE');
  } catch (_) {}
  adminBuildSidebar();
  window._monProfilId = profil ? profil.id : null;

  // 2. Charger le token GitHub et l'upload secret depuis Supabase
  const [{ data: cfg }, { data: cfgSecret }] = await Promise.all([
    Auth.sb.from('bde_config').select('value').eq('id', 'github_token').maybeSingle(),
    Auth.sb.from('bde_config').select('value').eq('id', 'upload_secret').maybeSingle(),
  ]);

  if (cfgSecret && cfgSecret.value) uploadSecret = cfgSecret.value;

  if (cfg && cfg.value) {
    token = cfg.value;
    sessionStorage.setItem('bde_admin_token', token);
    init();
    return;
  }

  // 3. Fallback : token dans sessionStorage (compat avec l'ancien flow)
  token = sessionStorage.getItem('bde_admin_token') || '';
  if (token) {
    // Si admin, migrer le token vers Supabase pour le partager
    if (profil.role === 'admin') {
      await Auth.sb.from('bde_config').upsert({
        id: 'github_token', value: token, updated_at: new Date().toISOString(), updated_by: profil.id
      });
    }
    init();
    return;
  }

  // 4. Aucun token - admin voit le setup, membre voit l'écran d'attente
  if (profil.role === 'admin') {
    document.getElementById('screen-login').style.display = 'flex';
  } else {
    document.getElementById('screen-wait-admin').style.display = 'flex';
  }
});

