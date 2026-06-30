// ============================================================
// STATS — Google Analytics 4 Data API
// ============================================================
let statsRange = 7;
let gaAccessToken = null;
let gaTokenExpiry = 0;
let gaTokenClient = null;
let gaScriptLoaded = false;

function initStatsPage() {
  const propId = localStorage.getItem('bde_ga_property_id');
  const clientId = localStorage.getItem('bde_ga_client_id');
  if (!propId || !clientId) {
    statsSetupMode();
  } else {
    document.getElementById('stats-property-id').value = propId;
    document.getElementById('stats-client-id').value = clientId;
    document.getElementById('stats-setup').style.display = 'none';
    document.getElementById('stats-dashboard').style.display = 'block';
    loadGaScript(clientId).then(() => {
      if (gaAccessToken && Date.now() < gaTokenExpiry) {
        loadStats(statsRange);
      } else {
        renderStatsConnectPrompt();
      }
    });
  }
}

function statsSetupMode() {
  document.getElementById('stats-setup').style.display = 'block';
  document.getElementById('stats-dashboard').style.display = 'none';
  const propId = localStorage.getItem('bde_ga_property_id') || '';
  const clientId = localStorage.getItem('bde_ga_client_id') || '';
  document.getElementById('stats-property-id').value = propId;
  document.getElementById('stats-client-id').value = clientId;
}

function saveStatsConfig() {
  const propId = document.getElementById('stats-property-id').value.trim();
  const clientId = document.getElementById('stats-client-id').value.trim();
  if (!propId || !clientId) { showToast('Remplis les deux champs', 'error'); return; }
  localStorage.setItem('bde_ga_property_id', propId);
  localStorage.setItem('bde_ga_client_id', clientId);
  showToast('Configuration enregistrée', 'success');
  document.getElementById('stats-setup').style.display = 'none';
  document.getElementById('stats-dashboard').style.display = 'block';
  loadGaScript(clientId).then(() => connectGA4());
}

function loadGaScript(clientId) {
  return new Promise(resolve => {
    if (gaScriptLoaded) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = () => {
      gaScriptLoaded = true;
      gaTokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/analytics.readonly',
        callback: (resp) => {
          if (resp.error) { showToast('Erreur connexion Google: ' + resp.error, 'error'); return; }
          gaAccessToken = resp.access_token;
          gaTokenExpiry = Date.now() + (resp.expires_in - 60) * 1000;
          const btn = document.getElementById('stats-connect-btn');
          if (btn) { btn.textContent = '✓ Connecté à Google'; btn.classList.add('connected'); }
          loadStats(statsRange);
        }
      });
      resolve();
    };
    document.head.appendChild(s);
  });
}

function connectGA4() {
  const clientId = localStorage.getItem('bde_ga_client_id');
  if (!clientId) { statsSetupMode(); return; }
  loadGaScript(clientId).then(() => {
    if (gaTokenClient) gaTokenClient.requestAccessToken({ prompt: '' });
    else showToast('Script Google non chargé, réessaie', 'error');
  });
}

function setStatsRange(days) {
  statsRange = days;
  document.querySelectorAll('.stats-range-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('stats-btn-' + days);
  if (btn) btn.classList.add('active');
  if (gaAccessToken && Date.now() < gaTokenExpiry) loadStats(days);
  else renderStatsConnectPrompt();
}

function refreshStats() {
  if (gaAccessToken && Date.now() < gaTokenExpiry) loadStats(statsRange);
  else connectGA4();
}

function renderStatsConnectPrompt() {
  document.getElementById('stats-body').innerHTML = `
    <div class="stats-empty">
      <div style="font-size:36px;margin-bottom:1rem;">📊</div>
      <p style="font-weight:700;font-size:15px;margin-bottom:0.5rem;">Connecte Google Analytics</p>
      <p style="font-size:13px;margin-bottom:1.5rem;">Clique sur "Se connecter avec Google" en haut pour afficher les statistiques.</p>
      <button class="stats-connect-btn" onclick="connectGA4()">Se connecter avec Google</button>
    </div>`;
}

async function loadStats(days) {
  const propId = localStorage.getItem('bde_ga_property_id');
  if (!propId || !gaAccessToken) { renderStatsConnectPrompt(); return; }
  document.getElementById('stats-body').innerHTML = '<div class="stats-loading">Chargement des statistiques…</div>';

  const startDate = days + 'daysAgo';
  const headers = { 'Authorization': 'Bearer ' + gaAccessToken, 'Content-Type': 'application/json' };
  const base = `https://analyticsdata.googleapis.com/v1beta/properties/${propId}:runReport`;

  const makeReq = (body) => fetch(base, { method: 'POST', headers, body: JSON.stringify({ dateRanges: [{ startDate, endDate: 'today' }], ...body }) }).then(r => r.json());

  try {
    const [overview, pages, devices, countries, sources, browsers] = await Promise.all([
      makeReq({ metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }, { name: 'sessions' }, { name: 'averageSessionDuration' }, { name: 'bounceRate' }, { name: 'newUsers' }] }),
      makeReq({ dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }], orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 7 }),
      makeReq({ dimensions: [{ name: 'deviceCategory' }], metrics: [{ name: 'sessions' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }] }),
      makeReq({ dimensions: [{ name: 'country' }], metrics: [{ name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }], limit: 7 }),
      makeReq({ dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: [{ name: 'sessions' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 6 }),
      makeReq({ dimensions: [{ name: 'browser' }], metrics: [{ name: 'sessions' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 5 })
    ]);

    if (overview.error) {
      document.getElementById('stats-body').innerHTML = `<div class="stats-error">Erreur GA4 : ${overview.error.message || 'Vérfie l\'ID de propriété et les permissions.'}</div>`;
      return;
    }

    renderStats({ overview, pages, devices, countries, sources, browsers }, days);
  } catch(e) {
    document.getElementById('stats-body').innerHTML = `<div class="stats-error">Erreur réseau. Réessaie.</div>`;
  }
}

function fmt(n) {
  n = parseFloat(n) || 0;
  if (n >= 1000) return (n/1000).toFixed(1) + 'k';
  return Math.round(n).toString();
}
function fmtDur(secs) {
  secs = Math.round(parseFloat(secs) || 0);
  const m = Math.floor(secs / 60), s = secs % 60;
  return m + 'min ' + s + 's';
}
function fmtPct(v) { return (parseFloat(v)*100).toFixed(1) + '%'; }

function barRows(rows, labelFn, valFn) {
  if (!rows || !rows.length) return '<p style="font-size:13px;color:var(--gris-texte);">Aucune donnée</p>';
  const maxVal = Math.max(...rows.map(r => parseFloat(valFn(r))));
  return rows.map(r => {
    const val = parseFloat(valFn(r));
    const pct = maxVal ? (val / maxVal * 100) : 0;
    return `<div class="stats-bar-row">
      <span class="stats-bar-label" title="${labelFn(r)}">${labelFn(r)}</span>
      <div class="stats-bar-track"><div class="stats-bar-fill" style="width:${pct}%"></div></div>
      <span class="stats-bar-val">${fmt(val)}</span>
    </div>`;
  }).join('');
}

function deviceIcon(d) {
  if (!d) return '📱';
  d = d.toLowerCase();
  if (d.includes('desktop') || d.includes('ordinateur')) return '💻';
  if (d.includes('tablet')) return '📱';
  return '📱';
}
function sourceIcon(s) {
  if (!s) return '🔗';
  s = s.toLowerCase();
  if (s.includes('organic') || s.includes('search')) return '🔍';
  if (s.includes('social')) return '📲';
  if (s.includes('direct')) return '🔗';
  if (s.includes('email')) return '✉️';
  if (s.includes('referral')) return '↗️';
  return '🔗';
}

function renderStats(d, days) {
  const ov = d.overview.rows ? d.overview.rows[0] : null;
  const mv = ov ? ov.metricValues : null;

  const pageViews = mv ? mv[0].value : '0';
  const activeUsers = mv ? mv[1].value : '0';
  const sessions = mv ? mv[2].value : '0';
  const avgDur = mv ? mv[3].value : '0';
  const bounceRate = mv ? mv[4].value : '0';
  const newUsers = mv ? mv[5].value : '0';
  const newPct = activeUsers > 0 ? (parseFloat(newUsers) / parseFloat(activeUsers) * 100).toFixed(0) : 0;

  const kpis = [
    { icon: '👁', label: 'Pages vues', value: fmt(pageViews), sub: 'en ' + days + ' jours' },
    { icon: '👤', label: 'Visiteurs uniques', value: fmt(activeUsers), sub: 'utilisateurs actifs' },
    { icon: '📊', label: 'Sessions', value: fmt(sessions), sub: 'visites totales' },
    { icon: '⏱', label: 'Durée moy. session', value: fmtDur(avgDur), sub: 'par visite' },
    { icon: '↩️', label: 'Taux de rebond', value: fmtPct(bounceRate), sub: '1 page puis départ' },
    { icon: '✨', label: 'Nouveaux visiteurs', value: newPct + '%', sub: 'des visiteurs' },
  ];

  const pagesRows = (d.pages.rows || []).map(r => ({ label: r.dimensionValues[0].value, val: r.metricValues[0].value }));
  const deviceRows = (d.devices.rows || []).map(r => ({ label: deviceIcon(r.dimensionValues[0].value) + ' ' + r.dimensionValues[0].value, val: r.metricValues[0].value }));
  const countryRows = (d.countries.rows || []).map(r => ({ label: r.dimensionValues[0].value, val: r.metricValues[0].value }));
  const sourceRows = (d.sources.rows || []).map(r => ({ label: sourceIcon(r.dimensionValues[0].value) + ' ' + r.dimensionValues[0].value, val: r.metricValues[0].value }));
  const browserRows = (d.browsers.rows || []).map(r => ({ label: r.dimensionValues[0].value, val: r.metricValues[0].value }));

  document.getElementById('stats-body').innerHTML = `
    <div class="stats-kpi-grid">
      ${kpis.map(k => `<div class="stats-kpi">
        <div class="stats-kpi-icon">${k.icon}</div>
        <div class="stats-kpi-label">${k.label}</div>
        <div class="stats-kpi-value">${k.value}</div>
        <div class="stats-kpi-sub">${k.sub}</div>
      </div>`).join('')}
    </div>
    <div class="stats-tables">
      <div class="stats-table-card">
        <div class="stats-table-title"><span>📄</span> Pages les plus vues</div>
        ${barRows(pagesRows, r => r.label, r => r.val)}
      </div>
      <div class="stats-table-card">
        <div class="stats-table-title"><span>🌍</span> Top pays</div>
        ${barRows(countryRows, r => r.label, r => r.val)}
      </div>
      <div class="stats-table-card">
        <div class="stats-table-title"><span>📲</span> Sources de trafic</div>
        ${barRows(sourceRows, r => r.label, r => r.val)}
      </div>
      <div class="stats-table-card">
        <div class="stats-table-title"><span>💻</span> Appareils</div>
        ${barRows(deviceRows, r => r.label, r => r.val)}
      </div>
      <div class="stats-table-card">
        <div class="stats-table-title"><span>🌐</span> Navigateurs</div>
        ${barRows(browserRows, r => r.label, r => r.val)}
      </div>
    </div>`;
}
