(() => {
  const { createClient } = supabase;
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON);
  window._sb = sb;

  const RANG   = { etudiant: 1, membre: 2, responsable: 3, admin: 4 };
  const LABELS = { etudiant: 'Étudiant', membre: 'Membre BDE', responsable: 'Responsable', admin: 'Admin' };

  let _profil = null;

  async function getUser() {
    const { data: { user } } = await sb.auth.getUser();
    return user;
  }

  async function getProfil(forceRefresh = false) {
    if (_profil && !forceRefresh) return _profil;
    const user = await getUser();
    if (!user) { _profil = null; return null; }
    const { data } = await sb.from('profils').select('*').eq('id', user.id).maybeSingle();
    if (!data) {
      // Session orpheline : l'auth user existe mais pas le profil — on déconnecte
      await sb.auth.signOut();
      _profil = null;
      return null;
    }
    _profil = data;
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
    window.location.href = '/connexion.html';
  }

  async function initNavChip() {
    const navLinks = document.querySelector('.nav-links');
    if (!navLinks) return;

    const li = document.createElement('li');
    const profil = await getProfil();

    if (!profil) {
      li.innerHTML = '<a href="/connexion.html" class="nav-auth-link">Connexion</a>';
    } else {
      li.className = 'nav-auth-li';
      li.innerHTML = `
        <div class="nav-auth-chip">
          <span class="nav-auth-avatar">${profil.prenom[0].toUpperCase()}</span>
          <span class="nav-auth-name">${profil.prenom}</span>
          <button class="nav-auth-logout" onclick="Auth.logout()" title="Déconnexion">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      `;
    }

    navLinks.appendChild(li);
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
