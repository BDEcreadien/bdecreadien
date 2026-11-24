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

  // Card Liens visible pour tous les membres
  const lnkCard = document.getElementById('page-card-liens');
  if (lnkCard) lnkCard.style.display = '';

  // Cards bureau-only (Finances + Organisation soirée + Planning semaine)
  if (profil && (profil.role === 'membre' || profil.role === 'admin') && profil.bureau === true) {
    const finCard = document.getElementById('page-card-finances');
    if (finCard) finCard.style.display = '';
    const plnCard = document.getElementById('page-card-planning');
    if (plnCard) plnCard.style.display = '';
    const facCard = document.getElementById('page-card-factures');
    if (facCard) facCard.style.display = '';
    const bilCard = document.getElementById('page-card-billetterie');
    if (bilCard) bilCard.style.display = '';
    const btqCard = document.getElementById('page-card-boutique');
    if (btqCard) btqCard.style.display = '';
  }
  if (profil && profil.role === 'admin') {
    const bdeCard = document.getElementById('page-card-bde');
    if (bdeCard) bdeCard.style.display = '';
  }
  // Modules désactivés dans « Paramètres du BDE » : on masque leurs cartes
  try {
    const { data: modRow } = await Auth.sb.from('bde_parametres').select('valeur').eq('cle', 'modules_actifs').maybeSingle();
    if (modRow && modRow.valeur) {
      const actifs = modRow.valeur.split(',').map(x => x.trim());
      const PAGES_PAR_MODULE = {
        contenu: ['agenda', 'annonces', 'accueil', 'communication', 'archives', 'galerie', 'partenaires', 'parametres'],
        boutique: ['boutique'], billetterie: ['billetterie'], finances: ['finances'], facturation: ['factures'],
        planning: ['planning'], newsletter: ['newsletter'], fidelite: ['fidelite'], liens: ['liens'], qr: ['qr'], stats: ['stats'],
      };
      Object.keys(PAGES_PAR_MODULE).forEach(m => {
        if (actifs.includes(m)) return;
        PAGES_PAR_MODULE[m].forEach(pg => document.querySelectorAll(`.page-card[onclick="selectPage('${pg}')"]`).forEach(c => { c.style.display = 'none'; }));
      });
    }
  } catch (_) {}
  try {
    document.getElementById('sb-name').textContent = ((profil && profil.prenom) || '') + ' ' + ((profil && profil.nom) || '');
    document.getElementById('sb-avatar').textContent = ((profil && profil.prenom) || '?')[0].toUpperCase();
    document.getElementById('sb-role').textContent = profil && profil.role === 'admin' ? 'Administrateur' : (profil && profil.bureau ? 'Bureau BDE' : 'Membre BDE');
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

