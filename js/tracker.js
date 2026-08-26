// Tracker analytics maison — RGPD-friendly
// Envoie un event 'pageview' à chaque chargement + 'click' sur [data-track]
// Session_id anonyme stocké en sessionStorage (pas de cookie)

(function () {
  // Attendre le consentement cookies (même règle que GA4)
  const consent = localStorage.getItem('cookie-consent');
  if (consent !== 'accepted') return;

  // Ne pas tracker les pages admin
  const path = location.pathname;
  if (/^\/(admin|scan)/.test(path)) return;

  const SUPABASE_URL = window.SUPABASE_URL;
  const SUPABASE_ANON = window.SUPABASE_ANON;
  if (!SUPABASE_URL || !SUPABASE_ANON) return;

  // Session ID anonyme (persiste tant que l'onglet reste ouvert)
  let sid = sessionStorage.getItem('_an_sid');
  if (!sid) {
    sid = (Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
    sessionStorage.setItem('_an_sid', sid);
  }

  function send(payload) {
    const body = JSON.stringify(payload);
    const url = `${SUPABASE_URL}/rest/v1/analytics_events`;
    const headers = {
      'apikey': SUPABASE_ANON,
      'Authorization': `Bearer ${SUPABASE_ANON}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    };
    // Utilise sendBeacon si dispo (survit à la fermeture d'onglet)
    if (navigator.sendBeacon && event === undefined) {
      try { navigator.sendBeacon(url, new Blob([body], { type: 'application/json' })); return; } catch (_) {}
    }
    fetch(url, { method: 'POST', headers, body, keepalive: true }).catch(() => {});
  }

  // Pageview immédiat
  send({
    event_type: 'pageview',
    path: path.slice(0, 500),
    session_id: sid,
    referer: (document.referrer || '').slice(0, 500) || null
  });

  // Click tracking pour les éléments avec data-track="label"
  document.addEventListener('click', function (e) {
    const el = e.target.closest('[data-track]');
    if (!el) return;
    const label = (el.getAttribute('data-track') || '').slice(0, 200);
    if (!label) return;
    send({
      event_type: 'click',
      path: path.slice(0, 500),
      session_id: sid,
      label
    });
  }, true);
})();
