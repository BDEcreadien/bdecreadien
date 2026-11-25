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
    appliquerTheme();
  }

  // Couleurs du BDE -> variables CSS utilisées par tout le site (public + admin)
  var DEFAUT = { p: '#460186', s: '#d2396d', a: '#ff741f' };
  function slug(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function palette() { try { var l = JSON.parse(params.palette || '[]'); return Array.isArray(l) ? l : []; } catch (_) { return []; } }
  // Liste des couleurs du BDE (JSON ["#hex", ...]). Repli : anciens paramètres principale/secondaire/accent.
  function couleurs() {
    try { var l = JSON.parse(params.couleurs || 'null'); if (Array.isArray(l) && l.length) return l; } catch (_) {}
    return null;
  }
  // 1 couleur = aplat ; 2 ou plus = dégradé dans l'ordre de la liste
  function degrade(l, angle) {
    if (l.length === 1) return 'linear-gradient(' + angle + ',' + l[0] + ',' + l[0] + ')';
    return 'linear-gradient(' + angle + ',' + l.join(',') + ')';
  }
  function appliquerTheme() {
    var st = document.documentElement.style;
    var L = couleurs();
    if (L) {
      st.setProperty('--accent', L[0]); st.setProperty('--violet', L[0]); st.setProperty('--bde-principale', L[0]);
      st.setProperty('--bde-secondaire', L[1] || L[0]);
      st.setProperty('--orange', L[L.length - 1]); st.setProperty('--bde-accent', L[L.length - 1]);
      st.setProperty('--gradient', degrade(L, '135deg'));
      st.setProperty('--gradient-h', degrade(L, '90deg'));
    } else {
      var P = params.couleur_principale, S = params.couleur_secondaire, A = params.couleur_accent;
      if (P) { st.setProperty('--accent', P); st.setProperty('--violet', P); st.setProperty('--bde-principale', P); }
      if (S) st.setProperty('--bde-secondaire', S);
      if (A) { st.setProperty('--orange', A); st.setProperty('--bde-accent', A); }
      // Dégradé de marque : recalculé seulement si les couleurs diffèrent de celles d'origine
      if (P && S && A && !(P.toLowerCase() === DEFAUT.p && S.toLowerCase() === DEFAUT.s && A.toLowerCase() === DEFAUT.a)) {
        var mix = function (c1, c2, n) { return 'color-mix(in srgb,' + c1 + ' ' + n + '%,' + c2 + ')'; };
        var stops = mix(P, '#000', 80) + ' 0%,' + P + ' 18%,' + mix(P, S, 50) + ' 38%,' + S + ' 60%,' + mix(S, A, 50) + ' 80%,' + A + ' 100%';
        st.setProperty('--gradient', 'linear-gradient(135deg,' + stops + ')');
        st.setProperty('--gradient-h', 'linear-gradient(90deg,' + stops + ')');
      }
    }
    palette().forEach(function (c) { if (c && c.hex) st.setProperty('--bde-c-' + (slug(c.nom) || 'couleur'), c.hex); });
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
    palette: palette,
    couleurs: couleurs,
    degrade: degrade,
    appliquerTheme: appliquerTheme,
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
