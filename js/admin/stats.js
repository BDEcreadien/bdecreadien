/* BDE Admin — module stats
   Extrait tel quel de admin.html (scripts classiques, portée globale partagée). */
// STATS DASHBOARD
// ============================================================

function initStatsPage() {
  loadSbStats();
}

let _statsRangeDays = 30;

async function loadSbStats(days) {
  if (days) _statsRangeDays = days;
  const body = document.getElementById('stats-body');
  body.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--gris-texte);">Chargement…</p>';
  try {
    const sb = window.Auth.sb;
    const [rpc, evJson, traficRpc] = await Promise.all([
      sb.rpc('bde_stats'),
      fetch('/_data/evenements.json').then(r => r.json()).catch(() => ({ evenements: [] })),
      sb.rpc('analytics_stats', { p_days: _statsRangeDays }),
    ]);
    if (rpc.error) throw rpc.error;
    const s = rpc.data || {};
    const t = (traficRpc && !traficRpc.error) ? (traficRpc.data || {}) : null;
    const allEv = Array.isArray(evJson) ? evJson : (evJson.evenements || []);
    const evUpcoming = allEv.filter(e => !e.date || new Date(e.date) >= new Date()).length;

    const tile = (label, val, sub, color) =>
      `<div style="background:white;border-radius:14px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.05);">
        <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${color||'var(--violet)'};margin-bottom:6px;">${label}</div>
        <div style="font-size:32px;font-weight:800;color:var(--noir);line-height:1;">${val}</div>
        ${sub ? `<div style="font-size:12px;color:var(--gris-texte);margin-top:6px;">${sub}</div>` : ''}
      </div>`;

    body.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:1.5rem;">
        ${tile('Membres inscrits', s.profils_total || 0, `+${s.profils_7j||0} en 7j · +${s.profils_30j||0} en 30j`)}
        ${tile('Étudiants', s.profils_etudiant || 0, `${s.profils_membre||0} membres BDE · ${s.profils_admin||0} admin`, '#D2396D')}
        ${tile('Événements à venir', evUpcoming, '', '#FF741F')}
        ${tile('Newsletter', s.newsletter_active || 0, 'abonnés actifs', '#D2396D')}
      </div>

      <h3 style="font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--gris-texte);margin:1.5rem 0 0.75rem;">Annonces</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;">
        ${tile('En attente', s.annonces_pending || 0, 'à modérer', '#FF741F')}
        ${tile('Publiées', s.annonces_published || 0)}
        ${tile('Vendues', s.annonces_sold || 0, '', '#22c55e')}
      </div>

      <h3 style="font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--gris-texte);margin:1.5rem 0 0.75rem;">Cartes fidélité</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;">
        ${tile('Cartes actives', s.cartes_total || 0)}
        ${tile('Tampons distribués', s.cartes_tampons || 0)}
        ${tile('Récompenses débloquées', s.cartes_completes || 0, '10/10 atteint', '#22c55e')}
      </div>

      <h3 style="font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--gris-texte);margin:1.5rem 0 0.75rem;">À traiter</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;">
        ${tile('Feedbacks en attente', s.feedbacks_pending || 0, '', '#FF741F')}
        ${tile("Demandes d'adhésion", s.demandes_pending || 0, 'à valider', '#FF741F')}
        ${tile('Inscriptions événements', s.inscriptions_total || 0, 'total')}
      </div>

      ${t ? `
        <h3 style="font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--gris-texte);margin:1.5rem 0 0.75rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
          <span>Trafic (${_statsRangeDays} derniers jours)</span>
          <span style="display:inline-flex;gap:6px;">
            <button onclick="loadSbStats(7)" class="stats-ext-btn" style="${_statsRangeDays===7?'background:var(--violet);color:white;':''}">7j</button>
            <button onclick="loadSbStats(30)" class="stats-ext-btn" style="${_statsRangeDays===30?'background:var(--violet);color:white;':''}">30j</button>
            <button onclick="loadSbStats(90)" class="stats-ext-btn" style="${_statsRangeDays===90?'background:var(--violet);color:white;':''}">90j</button>
            <button onclick="resetAnalytics()" class="stats-ext-btn" style="border-color:#C0392B;color:#C0392B;">🗑 Reset</button>
          </span>
        </h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;">
          ${tile('Visiteurs uniques', t.unique_visitors || 0, `sur ${_statsRangeDays}j`)}
          ${tile('Pages vues', t.pageviews_total || 0)}
          ${tile('Clics trackés', t.clicks_total || 0, 'boutons importants')}
          ${tile('Pages / session', t.avg_session_pages || 0, 'moyenne')}
          ${tile('Durée session', fmtDuration(t.avg_session_seconds || 0), 'moyenne', '#D2396D')}
        </div>
        ${(t.top_pages && t.top_pages.length) ? `
          <h4 style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--gris-texte);margin:1.25rem 0 0.5rem;">Top pages</h4>
          <div style="background:white;border-radius:12px;padding:14px 18px;box-shadow:0 2px 12px rgba(0,0,0,0.05);">
            ${t.top_pages.map(p => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--gris-clair);font-size:13px;"><span style="color:var(--noir);font-weight:500;">${escapeHtmlNl(p.path)}</span><span style="color:var(--violet);font-weight:700;">${p.nb}</span></div>`).join('')}
          </div>
        ` : ''}
        ${(t.top_clicks && t.top_clicks.length) ? `
          <h4 style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--gris-texte);margin:1.25rem 0 0.5rem;">Top clics</h4>
          <div style="background:white;border-radius:12px;padding:14px 18px;box-shadow:0 2px 12px rgba(0,0,0,0.05);">
            ${t.top_clicks.map(c => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--gris-clair);font-size:13px;"><span style="color:var(--noir);font-weight:500;">${escapeHtmlNl(c.label)}</span><span style="color:var(--violet);font-weight:700;">${c.nb}</span></div>`).join('')}
          </div>
        ` : ''}
      ` : '<p style="text-align:center;font-size:12px;color:var(--gris-texte);margin-top:1.5rem;padding:1rem;background:#FFF3E0;border-radius:8px;">⚠️ Migration analytics non exécutée - colle et exécute <code>017_analytics.sql</code> dans le SQL Editor Supabase pour activer les stats de trafic.</p>'}

      <h3 style="font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--gris-texte);margin:1.5rem 0 0.75rem;">Stockage global du site</h3>
      <div id="stats-storage-body" style="background:white;border-radius:12px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.05);">
        <p style="font-size:13px;color:var(--gris-texte);margin:0;">Chargement…</p>
      </div>

      <p style="text-align:right;font-size:11px;color:var(--gris-texte);margin-top:1rem;">Données Supabase - temps réel · uniquement les visiteurs ayant accepté les cookies sont comptés</p>
    `;
    loadStorageStats();
  } catch (e) {
    body.innerHTML = '<p style="text-align:center;padding:2rem;color:#c0392b;">Erreur : ' + (e.message || e) + '</p>';
  }
}

function fmtBytes(bytes) {
  const b = parseInt(bytes) || 0;
  if (b < 1024) return b + ' o';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' Ko';
  if (b < 1024 * 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + ' Mo';
  return (b / 1024 / 1024 / 1024).toFixed(2) + ' Go';
}

async function loadStorageStats() {
  const el = document.getElementById('stats-storage-body');
  if (!el) return;
  const SB_QUOTA = 1024 * 1024 * 1024; // 1 Go Supabase Free
  const GH_QUOTA = 1024 * 1024 * 1024; // 1 Go GitHub repo recommandé
  try {
    const sb = window.Auth.sb;

    // === SUPABASE ===
    const buckets = ['annonces', 'avatars'];
    const sbRows = await Promise.all(buckets.map(async (bucket) => {
      let totalSize = 0, totalFiles = 0;
      const walk = async (prefix = '') => {
        const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 1000 });
        if (error || !data) return;
        for (const f of data) {
          if (f.id === null) {
            await walk((prefix ? prefix + '/' : '') + f.name);
          } else {
            totalSize += (f.metadata && f.metadata.size) ? f.metadata.size : 0;
            totalFiles++;
          }
        }
      };
      await walk();
      return { bucket, totalSize, totalFiles };
    }));
    const sbTotal = sbRows.reduce((s, r) => s + r.totalSize, 0);

    // === GITHUB ===
    let ghSize = 0, ghErr = null;
    try {
      const ghResp = await fetch('https://api.github.com/repos/BDEcreadien/bdecreadien');
      if (ghResp.ok) {
        const info = await ghResp.json();
        ghSize = (info.size || 0) * 1024; // GitHub API renvoie en Ko
      } else ghErr = 'API GitHub inaccessible';
    } catch (_) { ghErr = 'API GitHub inaccessible'; }

    const grandTotal = sbTotal + ghSize;

    const bar = (used, quota, color) => `
      <div style="height:6px;background:var(--gris-clair);border-radius:99px;overflow:hidden;">
        <div style="height:100%;width:${Math.min((used/quota)*100, 100)}%;background:${color};"></div>
      </div>
    `;

    const sbPct = (sbTotal / SB_QUOTA) * 100;
    const ghPct = (ghSize / GH_QUOTA) * 100;
    const sbColor = sbPct > 80 ? '#C0392B' : sbPct > 50 ? '#FF741F' : '#22c55e';
    const ghColor = ghPct > 80 ? '#C0392B' : ghPct > 50 ? '#FF741F' : '#22c55e';

    el.innerHTML = `
      <div style="text-align:center;margin-bottom:1.5rem;padding-bottom:1.25rem;border-bottom:1px solid var(--gris-clair);">
        <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gris-texte);margin-bottom:6px;">Total tous services</div>
        <div style="font-size:32px;font-weight:800;color:var(--violet);line-height:1;">${fmtBytes(grandTotal)}</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">

        <!-- SUPABASE -->
        <div>
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
            <div style="font-size:13px;font-weight:700;color:var(--noir);">☁️ Supabase</div>
            <div style="font-size:11px;color:var(--gris-texte);">${sbPct.toFixed(1)}% / 1 Go</div>
          </div>
          ${bar(sbTotal, SB_QUOTA, sbColor)}
          <div style="font-size:18px;font-weight:800;color:var(--noir);margin-top:6px;">${fmtBytes(sbTotal)}</div>
          <div style="font-size:11px;color:var(--gris-texte);margin:2px 0 10px;">Uploads utilisateurs (annonces + avatars)</div>
          ${sbRows.map(r => `
            <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:var(--gris-texte);">
              <span>📦 ${r.bucket}</span>
              <span>${r.totalFiles} · <strong style="color:var(--noir);">${fmtBytes(r.totalSize)}</strong></span>
            </div>
          `).join('')}
        </div>

        <!-- GITHUB -->
        <div>
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
            <div style="font-size:13px;font-weight:700;color:var(--noir);">🐙 GitHub</div>
            <div style="font-size:11px;color:var(--gris-texte);">${ghErr ? '-' : ghPct.toFixed(1) + '% / 1 Go'}</div>
          </div>
          ${ghErr ? '<p style="font-size:12px;color:var(--gris-texte);margin:8px 0;">' + ghErr + '</p>' : bar(ghSize, GH_QUOTA, ghColor)}
          <div style="font-size:18px;font-weight:800;color:var(--noir);margin-top:6px;">${fmtBytes(ghSize)}</div>
          <div style="font-size:11px;color:var(--gris-texte);margin:2px 0 10px;">Code source + assets/ + _data/ (events, catégories…)</div>
          <div style="font-size:12px;color:var(--gris-texte);padding:5px 0;">📄 Repo bdecreadien/bdecreadien</div>
        </div>
      </div>

      <p style="font-size:11px;color:var(--gris-texte);margin:16px 0 0;padding-top:12px;border-top:1px solid var(--gris-clair);text-align:center;">
        Vidéos (YouTube/Vimeo) = 0 Ko sur le site (juste des embeds).
        Cloudflare Pages = pas de limite pertinente pour ce site.
      </p>
    `;
  } catch (e) {
    el.innerHTML = '<p style="font-size:13px;color:#c0392b;margin:0;">Erreur : ' + (e.message || e) + '</p>';
  }
}

function fmtDuration(secs) {
  const s = parseInt(secs) || 0;
  if (s < 60) return s + 's';
  if (s < 3600) return Math.floor(s / 60) + 'm' + String(s % 60).padStart(2, '0') + 's';
  return Math.floor(s / 3600) + 'h' + String(Math.floor((s % 3600) / 60)).padStart(2, '0');
}

async function resetAnalytics() {
  if (!confirm('Effacer TOUS les événements de trafic (visites, clics) ?\n\nCette action est irréversible.')) return;
  const typed = prompt('Pour confirmer, tape RESET en majuscules :');
  if (typed !== 'RESET') { showToast('Reset annulé', 'error'); return; }
  const { data, error } = await window.Auth.sb.rpc('analytics_reset');
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  showToast((data || 0) + ' événements supprimés', 'success');
  loadSbStats();
}

// ============================================================
