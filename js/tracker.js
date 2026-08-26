// Tracker analytics maison — RGPD-friendly
// Envoie un event 'pageview' à chaque chargement + 'click' sur [data-track]
// Session_id anonyme stocké en sessionStorage (pas de cookie persistant)

(function () {
  const path = location.pathname;
  // Ne pas tracker les pages admin/scan
  if (/^\/(admin|scan)/.test(path)) return;

  const SUPABASE_URL = window.SUPABASE_URL;
  const SUPABASE_ANON = window.SUPABASE_ANON;
  if (!SUPABASE_URL || !SUPABASE_ANON) return;

  let started = false;

  function startTracking() {
    if (started) return;
    if (localStorage.getItem('cookie_consent') !== 'accepted') return;
    started = true;

    // Session ID anonyme (persiste tant que l'onglet reste ouvert)
    let sid = sessionStorage.getItem('_an_sid');
    if (!sid) {
      sid = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem('_an_sid', sid);
    }

    const URL_REST = `${SUPABASE_URL}/rest/v1/analytics_events`;
    const HEADERS = {
      'apikey': SUPABASE_ANON,
      'Authorization': `Bearer ${SUPABASE_ANON}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    };

    function send(payload) {
      // Supabase REST exige les headers apikey + Authorization,
      // sendBeacon ne peut pas les définir → fetch keepalive
      fetch(URL_REST, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(() => {});
    }

    // Pageview immédiat
    send({
      event_type: 'pageview',
      path: path.slice(0, 500),
      session_id: sid,
      referer: (document.referrer || '').slice(0, 500) || null
    });

    // Click tracking sur les éléments avec data-track="label"
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
  }

  // Démarre tout de suite si déjà consenti, sinon attend l'événement du bandeau
  startTracking();
  window.addEventListener('cookie-accepted', startTracking);
})();
