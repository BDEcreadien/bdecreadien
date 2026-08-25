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

  async function getProfil(forceRefresh = false) {
    if (_profil && !forceRefresh) return _profil;
    // Cache sessionStorage pour éviter un aller-retour Supabase entre pages
    if (!forceRefresh) {
      try {
        const cached = sessionStorage.getItem('_bde_profil');
        if (cached) { _profil = JSON.parse(cached); return _profil; }
      } catch (_) {}
    }
    const user = await getUser();
    if (!user) { _profil = null; sessionStorage.removeItem('_bde_profil'); return null; }
    const { data } = await sb.from('profils').select('*').eq('id', user.id).maybeSingle();
    if (!data) {
      // Session orpheline : l'auth user existe mais pas le profil — on déconnecte
      await sb.auth.signOut();
      _profil = null;
      sessionStorage.removeItem('_bde_profil');
      return null;
    }
    _profil = data;
    try { sessionStorage.setItem('_bde_profil', JSON.stringify(data)); } catch (_) {}
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
    sessionStorage.removeItem('_bde_profil');
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
    if (!window.OneSignalDeferred) return;
    const user = await getUser();
    if (!user) return;
    OneSignalDeferred.push(async (OS) => {
      const playerId = await OS.User.PushSubscription.id;
      if (!playerId) return;
      await sb.from('profils').update({ onesignal_id: playerId }).eq('id', user.id);
    });
  }

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

  window.Auth = { getUser, getProfil, getRole, hasRole, requireRole, logout, sb, notifyBde };

  // Purge le cache profil quand la session change (logout, expiration, autre onglet)
  sb.auth.onAuthStateChange((event, session) => {
    if (!session || event === 'SIGNED_OUT') {
      _profil = null;
      try { sessionStorage.removeItem('_bde_profil'); } catch (_) {}
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    initNavChip();
    syncOneSignalId();
  });
})();
