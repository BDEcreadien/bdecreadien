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
    window.location.href = '/';
  }

  async function initNavChip() {
    const li = document.getElementById('nav-auth-li');
    if (!li) return;

    const profil = await getProfil();

    if (!profil) {
      li.innerHTML = '<a href="/connexion.html" class="nav-auth-link">Connexion</a>';
    } else {
      li.className = 'nav-auth-li';
      li.innerHTML = `<a href="/mon-espace.html" class="nav-auth-name">${profil.prenom}</a>`;
    }
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

  window.Auth = { getUser, getProfil, getRole, hasRole, requireRole, logout, sb };

  document.addEventListener('DOMContentLoaded', () => {
    initNavChip();
    syncOneSignalId();
  });
})();
