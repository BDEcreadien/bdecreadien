// Bandeau consentement cookies — conforme RGPD/CNIL
(function () {
  var GA_ID = 'G-C8REVEGYYL';
  var KEY = 'cookie_consent'; // 'accepted' | 'refused'

  function loadGA() {
    if (window.__gaLoaded) return;
    window.__gaLoaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, { anonymize_ip: true });
  }

  function hideBanner() {
    var b = document.getElementById('cookie-banner');
    if (b) b.remove();
  }

  function showBanner() {
    if (document.getElementById('cookie-banner')) return;
    var css = '#cookie-banner{position:fixed;bottom:16px;left:16px;right:16px;max-width:640px;margin:0 auto;background:#1A1A2E;color:#fff;border-radius:14px;padding:16px 20px;box-shadow:0 8px 40px rgba(0,0,0,0.35);z-index:99998;font-family:Barlow,Arial,sans-serif;font-size:13px;line-height:1.55;display:flex;flex-wrap:wrap;gap:12px;align-items:center;}'
      + '#cookie-banner p{margin:0;flex:1 1 260px;color:rgba(255,255,255,0.85);}'
      + '#cookie-banner a{color:#fff;text-decoration:underline;}'
      + '#cookie-banner .cb-actions{display:flex;gap:8px;flex-wrap:wrap;}'
      + '#cookie-banner button{border:none;padding:9px 16px;border-radius:8px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;letter-spacing:0.3px;}'
      + '#cookie-banner .cb-refuse{background:transparent;color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.2);}'
      + '#cookie-banner .cb-accept{background:linear-gradient(135deg,#463A90,#E85100);color:#fff;}'
      + '@media(max-width:480px){#cookie-banner{bottom:8px;left:8px;right:8px;padding:14px 16px;}#cookie-banner .cb-actions{width:100%;}#cookie-banner button{flex:1;}}';
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
    var div = document.createElement('div');
    div.id = 'cookie-banner';
    div.setAttribute('role', 'dialog');
    div.setAttribute('aria-label', 'Consentement cookies');
    div.innerHTML = '<p>Nous utilisons Google Analytics pour mesurer l\'audience du site. Aucune donnée n\'est utilisée à des fins publicitaires. <a href="/mentions-legales.html">En savoir plus</a></p>'
      + '<div class="cb-actions">'
      + '<button type="button" class="cb-refuse" id="cb-refuse">Refuser</button>'
      + '<button type="button" class="cb-accept" id="cb-accept">Accepter</button>'
      + '</div>';
    document.body.appendChild(div);
    document.getElementById('cb-accept').addEventListener('click', function () {
      try { localStorage.setItem(KEY, 'accepted'); } catch (_) {}
      hideBanner();
      loadGA();
    });
    document.getElementById('cb-refuse').addEventListener('click', function () {
      try { localStorage.setItem(KEY, 'refused'); } catch (_) {}
      hideBanner();
    });
  }

  var choice = null;
  try { choice = localStorage.getItem(KEY); } catch (_) {}
  if (choice === 'accepted') {
    loadGA();
  } else if (choice !== 'refused') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showBanner);
    } else {
      showBanner();
    }
  }

  // Permet à l'utilisateur de rouvrir depuis les mentions légales
  window.openCookieSettings = function () {
    try { localStorage.removeItem(KEY); } catch (_) {}
    showBanner();
  };
})();
