(() => {
  const { createClient } = supabase;
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON);
  window._sb = sb;

  const RANG   = { etudiant: 1, membre: 2, admin: 3 };
  const LABELS = { etudiant: 'Étudiant', membre: 'Membre BDE', admin: 'Admin' };

  let _profil = null;

  async function getUser() {
    const { data: { user } } = await sb.auth.getUser();
    return user;
  }

  // Cache local persistant (survit à la fermeture de l'onglet)
  function _getCachedProfil() {
    try {
      const s = sessionStorage.getItem('_bde_profil');
      if (s) return JSON.parse(s);
      const l = localStorage.getItem('_bde_profil');
      if (l) return JSON.parse(l);
    } catch (_) {}
    return null;
  }
  function _setCachedProfil(data) {
    try {
      const s = JSON.stringify(data);
      sessionStorage.setItem('_bde_profil', s);
      localStorage.setItem('_bde_profil', s);
    } catch (_) {}
  }
  function _clearCachedProfil() {
    try {
      sessionStorage.removeItem('_bde_profil');
      localStorage.removeItem('_bde_profil');
    } catch (_) {}
  }

  // Version cache-only (synchrone) : retourne le dernier profil connu sans réseau. Sert au first-paint.
  function getProfilCached() {
    if (_profil) return _profil;
    const c = _getCachedProfil();
    if (c) _profil = c;
    return _profil;
  }

  async function getProfil(forceRefresh = false) {
    if (_profil && !forceRefresh) return _profil;
    if (!forceRefresh) {
      const cached = _getCachedProfil();
      if (cached) { _profil = cached; return _profil; }
    }
    const user = await getUser();
    if (!user) { _profil = null; _clearCachedProfil(); return null; }
    const { data } = await sb.from('profils').select('*').eq('id', user.id).maybeSingle();
    if (!data) {
      // Session orpheline : l'auth user existe mais pas le profil — on déconnecte
      await sb.auth.signOut();
      _profil = null;
      _clearCachedProfil();
      return null;
    }
    _profil = data;
    _setCachedProfil(data);
    return _profil;
  }

  async function getRole() {
    const p = await getProfil();
    return p?.role ?? null;
  }

  function hasRole(role, min) {
    return (RANG[role] ?? 0) >= (RANG[min] ?? 0);
  }

  async function requireRole(min) {
    const role = await getRole();
    if (!role || !hasRole(role, min)) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = '/connexion.html?next=' + next;
      return false;
    }
    return true;
  }

  async function logout() {
    await sb.auth.signOut();
    _profil = null;
    _clearCachedProfil();
    window.location.href = '/';
  }

  function escapeText(s) {
    return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  async function initNavChip() {
    const li = document.getElementById('nav-auth-li');
    if (!li) return;

    const profil = await getProfil();

    if (!profil) {
      li.innerHTML = '<a href="/connexion.html" class="nav-auth-link">Connexion</a>';
      return;
    }

    li.className = 'nav-auth-li';
    li.innerHTML = `
      <button type="button" class="nav-auth-name" aria-haspopup="true" aria-expanded="false" id="nav-auth-btn">${escapeText(profil.prenom)} <span aria-hidden="true" style="font-size:10px;opacity:0.6;">▾</span></button>
      <div class="nav-auth-menu" id="nav-auth-menu" role="menu" hidden>
        <a href="/mon-espace.html" role="menuitem">Mon espace</a>
        <a href="/carte.html?uid=${encodeURIComponent(profil.id)}" role="menuitem">Ma carte fidélité</a>
        <button type="button" role="menuitem" id="nav-logout-btn">Se déconnecter</button>
      </div>
    `;

    const btn = document.getElementById('nav-auth-btn');
    const menu = document.getElementById('nav-auth-menu');
    const logoutBtn = document.getElementById('nav-logout-btn');

    function closeMenu() {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !menu.hidden;
      if (isOpen) closeMenu();
      else { menu.hidden = false; btn.setAttribute('aria-expanded', 'true'); }
    });
    document.addEventListener('click', (e) => {
      if (!li.contains(e.target)) closeMenu();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
    logoutBtn.addEventListener('click', () => logout());
  }

  async function syncOneSignalId() {
    const user = await getUser();
    if (!user) return;
    // Attend que la SDK OneSignal soit chargée (retry pendant 15s)
    const start = Date.now();
    const tryOnce = () => new Promise((resolve) => {
      if (!window.OneSignalDeferred) { resolve(false); return; }
      OneSignalDeferred.push(async (OS) => {
        try {
          const playerId = await OS.User.PushSubscription.id;
          if (!playerId) { resolve(false); return; }
          await sb.from('profils').update({ onesignal_id: playerId }).eq('id', user.id);
          resolve(true);
        } catch { resolve(false); }
      });
    });
    // 1re tentative immédiate
    if (await tryOnce()) return;
    // Puis retries toutes les 2s pendant 15s
    while (Date.now() - start < 15000) {
      await new Promise(r => setTimeout(r, 2000));
      if (await tryOnce()) return;
    }
  }
  // Exposé pour re-sync depuis d'autres pages après activation manuelle
  window.syncOneSignalId = syncOneSignalId;

  // Notifie les membres BDE d'un nouvel événement (feedback / annonce / adhésion)
  // Fire-and-forget : n'attend pas la réponse pour ne pas bloquer l'UI.
  async function notifyBde(type, sujet, message) {
    try {
      const { data: sessionData } = await sb.auth.getSession();
      const token = sessionData.session && sessionData.session.access_token;
      if (!token) return;
      await fetch(`${SUPABASE_URL}/functions/v1/notify-bde`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON,
        },
        body: JSON.stringify({ type, sujet: sujet || '', message: message || '' }),
      });
    } catch (_) {}
  }

  window.Auth = { getUser, getProfil, getProfilCached, getRole, hasRole, requireRole, logout, sb, notifyBde };

  // Purge le cache profil quand la session change (logout, expiration, autre onglet)
  // + redirige si expiration détectée sur une page protégée
  const PROTECTED_PAGES = ['/admin', '/admin.html', '/mon-espace', '/mon-espace.html', '/annonces-nouvelle', '/annonces-nouvelle.html', '/scan.html', '/carte.html', '/profil.html'];
  function isOnProtected() {
    return PROTECTED_PAGES.some(p => location.pathname.startsWith(p));
  }
  sb.auth.onAuthStateChange((event, session) => {
    if (!session || event === 'SIGNED_OUT') {
      _profil = null;
      _clearCachedProfil();
      // Si l'utilisateur était sur une page protégée et que la session expire,
      // redirection propre vers connexion avec message
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT') {
        if (isOnProtected() && !document.hidden) {
          const next = encodeURIComponent(location.pathname + location.search);
          location.href = '/connexion.html?next=' + next + '&expired=1';
        }
      }
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    initNavChip();
    syncOneSignalId();
  });
})();
