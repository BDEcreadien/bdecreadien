/* Paramètres du BDE — chargés une fois, appliqués sur toutes les pages publiques.
 *
 * Dans le HTML :
 *   <span data-bde="nom"></span>                      remplace le texte
 *   <img data-bde-src="logo_url">                     remplace src
 *   <a data-bde-href="mailto:{email_contact}">        remplace href ({cle} = valeur du paramètre)
 *   <a data-bde-href="{instagram_url}">
 * Les valeurs par défaut restent dans le HTML : si le chargement échoue, la page s'affiche telle quelle.
 *
 * En JS : BDE.ready.then(p => ...)   ·   BDE.get('nom', 'défaut')   ·   BDE.moduleActif('boutique')
 */
(function () {
  var CACHE_KEY = 'bde_parametres_v1', TTL = 10 * 60 * 1000;
  var params = {};
  var listeners = [];

  function lireCache() {
    try {
      var c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (c && c.t && Date.now() - c.t < TTL) return c.p;
    } catch (_) {}
    return null;
  }
  function ecrireCache(p) { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), p: p })); } catch (_) {} }

  function tpl(s) {
    return String(s).replace(/\{([a-z0-9_]+)\}/g, function (_, k) { return params[k] != null ? params[k] : ''; });
  }

  function appliquer(root) {
    root = root || document;
    root.querySelectorAll('[data-bde]').forEach(function (el) {
      var v = params[el.getAttribute('data-bde')];
      if (v) el.textContent = v;
    });
    root.querySelectorAll('[data-bde-src]').forEach(function (el) {
      var v = params[el.getAttribute('data-bde-src')];
      if (v) el.setAttribute('src', v);
    });
    root.querySelectorAll('[data-bde-href]').forEach(function (el) {
      var t = el.getAttribute('data-bde-href'), m = t.match(/\{([a-z0-9_]+)\}/);
      if (m && !params[m[1]]) return;
      el.setAttribute('href', tpl(t));
    });
    root.querySelectorAll('[data-bde-alt]').forEach(function (el) {
      el.setAttribute('alt', tpl(el.getAttribute('data-bde-alt')));
    });
    var st = document.documentElement.style;
    if (params.couleur_principale) st.setProperty('--bde-principale', params.couleur_principale);
    if (params.couleur_secondaire) st.setProperty('--bde-secondaire', params.couleur_secondaire);
    if (params.couleur_accent)     st.setProperty('--bde-accent', params.couleur_accent);
  }

  function charger() {
    var cache = lireCache();
    if (cache) return Promise.resolve(cache);
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON) return Promise.resolve({});
    return fetch(window.SUPABASE_URL + '/rest/v1/bde_parametres?select=cle,valeur', {
      headers: { apikey: window.SUPABASE_ANON, Authorization: 'Bearer ' + window.SUPABASE_ANON }
    }).then(function (r) { return r.ok ? r.json() : []; }).then(function (rows) {
      var p = {}; rows.forEach(function (r) { p[r.cle] = r.valeur; });
      if (rows.length) ecrireCache(p);
      return p;
    }).catch(function () { return {}; });
  }

  window.BDE = {
    get: function (k, def) { return params[k] != null && params[k] !== '' ? params[k] : def; },
    all: function () { return params; },
    appliquer: appliquer,
    vider: function () { try { localStorage.removeItem(CACHE_KEY); } catch (_) {} },
    moduleActif: function (m) {
      var l = params.modules_actifs;
      return !l || l.split(',').map(function (s) { return s.trim(); }).indexOf(m) !== -1;
    },
    ready: null
  };

  window.BDE.ready = new Promise(function (resolve) {
    function go() {
      charger().then(function (p) { params = p || {}; appliquer(document); resolve(params); });
    }
    // supabase-config.js peut être chargé après : on attend la fin du parsing
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  });
})();
