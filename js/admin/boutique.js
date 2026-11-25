/* BDE Admin — module boutique
   Extrait tel quel de admin.html (scripts classiques, portée globale partagée). */
/* ============================================================
   ADMIN BOUTIQUE GOODIES
   ============================================================ */

let _btqaCommandes  = [];   // commandes chargées
let _btqaProduits      = [];   // catalogue
let _btqaPhysItems     = [];   // lignes vente physique
let _btqaPhysAdhesion  = null; // { remise_centimes, produit_id, label } si l'acheteur est adhérent

// ── Init ────────────────────────────────────────────────────
async function initBoutiqueAdmin() {
  const sb = window.Auth?.sb;
  if (!sb) return;
  adminRenderHero('step-boutique', {
    icon: '<svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>',
    title: 'Merchandising',
    sub: 'Commandes, stock, remises et ventes physiques'
  });
  const profil = await window.Auth.getProfil();
  const autorise = profil && (profil.role === 'membre' || profil.role === 'admin') && profil.bureau === true;
  if (!autorise) {
    document.getElementById('screen-boutique').innerHTML = '<p style="padding:40px;text-align:center;color:#991b1b;font-size:15px;">Accès réservé aux membres du bureau.</p>';
    return;
  }

  // Charger commandes (tout sauf paniers)
  const { data: cmds } = await sb
    .from('boutique_commandes')
    .select('*, boutique_items(*)')
    .or('statut.neq.panier,numero.not.is.null')
    .order('created_at', { ascending: false });
  _btqaCommandes = cmds || [];

  // Charger produits pour la vente physique + config
  const { data: prods } = await sb.from('boutique_produits').select('*').eq('actif', true).order('ordre');
  _btqaProduits = prods || [];

  btqaRenderStats();
  btqaUpdateBulkBar();
  btqaRenderTable(_btqaCommandes);
  btqaRenderConfigProduits();
}

// ── Onglets ──────────────────────────────────────────────────
function btqaSwitchTab(tab) {
  document.querySelectorAll('.btqa-tab').forEach((b, i) => {
    b.classList.toggle('active', ['commandes','physique','remise','recap','config','analytiques'][i] === tab);
  });
  document.querySelectorAll('.btqa-pane').forEach(p => p.classList.remove('active'));
  document.getElementById('btqa-pane-' + tab).classList.add('active');
  if (tab === 'physique') {
    // Recharger le catalogue depuis Supabase pour avoir les produits à jour
    const sb = window.Auth?.sb;
    if (sb) {
      sb.from('boutique_produits').select('*').eq('actif', true).order('ordre').then(({ data }) => {
        if (data) _btqaProduits = data;
        btqaRenderPhysiqueCatalog();
      });
    } else {
      btqaRenderPhysiqueCatalog();
    }
    btqaRenderPhysItems();
    btqaLoadMembres();
  }
  if (tab === 'recap') { btqaRenderRecap(); }
  if (tab === 'analytiques') { btqaLoadAnalytics(); }
}

// ── Analytiques ──────────────────────────────────────────────
let _anPeriod = 7;
async function btqaLoadAnalytics(days) {
  if (days) _anPeriod = days;
  const wrap = document.getElementById('btqa-analytics-content');
  wrap.innerHTML = '<div style="text-align:center;padding:2rem;color:#999">Chargement…</div>';
  const sb = window.Auth.sb;
  const since = new Date(Date.now() - _anPeriod * 86400000).toISOString();

  const { data, error } = await sb.rpc('get_analytics_summary', { since_ts: since });
  if (error || !data) { wrap.innerHTML = '<div style="text-align:center;padding:2rem;color:#c00">Erreur de chargement</div>'; return; }

  const pageViews  = data.page_views  || 0;
  const prodViews  = data.prod_views  || 0;
  const addCarts   = data.add_carts   || 0;
  const helpClicks = data.help_clicks || 0;
  const mobile     = data.mobile_views || 0;
  const convCart   = prodViews ? Math.round(addCarts / prodViews * 100) : 0;
  const pctMobile  = pageViews ? Math.round(mobile / pageViews * 100) : 0;

  const topProds = (data.top_products || []).map(p => [p.nom || '?', p.count || 0]);
  const maxProd  = topProds[0]?.[1] || 1;

  const topTime = (data.avg_time || []).map(p => [p.nom || '?', p.avg_s || 0]);

  // Visites par jour
  const serverDaily = data.daily || {};
  const dayMap = {};
  for (let i=0;i<_anPeriod;i++) {
    const d = new Date(Date.now()-i*86400000);
    const key = d.toLocaleDateString('fr-CA'); // YYYY-MM-DD in local time
    dayMap[key] = serverDaily[key] || 0;
  }
  const days7 = Object.entries(dayMap).sort((a,b)=>a[0]>b[0]?1:-1);
  const maxDay = Math.max(...days7.map(d=>d[1]),1);

  const periodBtns = [7,14,30].map(d=>
    `<button class="btqa-an-period${_anPeriod===d?' active':''}" onclick="btqaLoadAnalytics(${d})">${d} jours</button>`).join('');

  wrap.innerHTML = `
    <div class="btqa-an-period">${periodBtns}</div>
    <div class="btqa-an-kpis">
      <div class="btqa-an-kpi"><div class="val">${pageViews}</div><div class="lbl">Visites boutique</div></div>
      <div class="btqa-an-kpi"><div class="val">${prodViews}</div><div class="lbl">Produits vus</div></div>
      <div class="btqa-an-kpi"><div class="val">${addCarts}</div><div class="lbl">Ajouts panier</div></div>
      <div class="btqa-an-kpi"><div class="val">${convCart}%</div><div class="lbl">Taux panier</div></div>
      <div class="btqa-an-kpi"><div class="val">${pctMobile}%</div><div class="lbl">Visites mobile</div></div>
      <div class="btqa-an-kpi" style="border-color:${helpClicks>0?'#f0c0c0':'#eef2f7'}"><div class="val" style="color:${helpClicks>0?'#c00':'#2563eb'}">${helpClicks}</div><div class="lbl">Clics aide</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="btqa-an-section">
        <h4>Produits les plus vus</h4>
        ${topProds.length ? topProds.map(([n,c])=>`
          <div class="btqa-an-bar-row">
            <div class="btqa-an-bar-label" title="${n}">${n}</div>
            <div class="btqa-an-bar-track"><div class="btqa-an-bar-fill" style="width:${Math.round(c/maxProd*100)}%"></div></div>
            <div class="btqa-an-bar-count">${c}</div>
          </div>`).join('') : '<div style="color:#aaa;font-size:13px">Aucune donnée</div>'}
      </div>
      <div class="btqa-an-section">
        <h4>Visites par jour</h4>
        <div class="btqa-an-day-row">
          ${days7.map(([d,c])=>`
            <div class="btqa-an-day-col">
              <div class="btqa-an-day-bar" style="height:${Math.round(c/maxDay*68)+2}px" title="${c} visite(s)"></div>
              <div class="btqa-an-day-label">${d.slice(5)}</div>
            </div>`).join('')}
        </div>
      </div>
      <div class="btqa-an-section">
        <h4>Temps moyen par produit</h4>
        ${topTime.length ? topTime.map(([n,s])=>`
          <div class="btqa-an-bar-row">
            <div class="btqa-an-bar-label" title="${n}">${n}</div>
            <div class="btqa-an-bar-track"><div class="btqa-an-bar-fill" style="width:${Math.round(s/Math.max(...topTime.map(x=>x[1]),1)*100)}%"></div></div>
            <div class="btqa-an-bar-count">${s}s</div>
          </div>`).join('') : '<div style="color:#aaa;font-size:13px">Aucune donnée</div>'}
      </div>
      <div class="btqa-an-section">
        <h4>Entonnoir conversion</h4>
        <div class="btqa-an-funnel">
          <div class="btqa-an-funnel-step">
            <div class="fval">${pageViews}</div><div class="flbl">Visites</div>
          </div>
          <div class="btqa-an-funnel-step">
            <div class="fval">${prodViews}</div><div class="flbl">Produits vus</div>
            <div class="fpct">${pageViews?Math.round(prodViews/pageViews*100):0}%</div>
          </div>
          <div class="btqa-an-funnel-step">
            <div class="fval">${addCarts}</div><div class="flbl">Paniers</div>
            <div class="fpct">${prodViews?Math.round(addCarts/prodViews*100):0}%</div>
          </div>
        </div>
      </div>
    </div>`;
}

// ── Stats ────────────────────────────────────────────────────
function btqaDateFilteredCommandes() {
  const now = new Date();
  const startOfDay  = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfDay.getDate() - ((startOfDay.getDay() + 6) % 7));
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const statutsPaies = ['payee','production','livraison','confirmee','remise','physique'];
  return _btqaCommandes.filter(c => {
    if (_btqaDateFilter === 'all') return true;
    const d = new Date((statutsPaies.includes(c.statut) && c.updated_at) ? c.updated_at : c.created_at);
    if (_btqaDateFilter === 'today') return d >= startOfDay;
    if (_btqaDateFilter === 'week')  return d >= startOfWeek;
    if (_btqaDateFilter === 'month') return d >= startOfMonth;
    return true;
  });
}

function btqaRenderStats() {
  const all        = btqaDateFilteredCommandes();
  const statutsPaies = ['payee','production','livraison','confirmee','remise','physique'];
  const attn       = all.filter(c => c.statut === 'en_attente').length;
  const conf       = all.filter(c => c.statut === 'payee').length;
  const remis      = all.filter(c => c.statut === 'remise').length;
  const totalAttn  = all.filter(c => c.statut === 'en_attente')
                        .reduce((s, c) => s + (c.total_centimes || 0), 0);
  const totalPaye  = all.filter(c => statutsPaies.includes(c.statut))
                        .reduce((s, c) => s + (c.total_centimes || 0), 0);
  document.getElementById('btqa-stats').innerHTML = `
    <div class="btqa-stat"><div class="btqa-stat-val">${all.length}</div><div class="btqa-stat-lbl">Commandes</div></div>
    <div class="btqa-stat"><div class="btqa-stat-val">${attn}</div><div class="btqa-stat-lbl">En attente</div></div>
    <div class="btqa-stat"><div class="btqa-stat-val">${conf}</div><div class="btqa-stat-lbl">Payées</div></div>
    <div class="btqa-stat"><div class="btqa-stat-val">${remis}</div><div class="btqa-stat-lbl">Remises</div></div>
    <div class="btqa-stat"><div class="btqa-stat-val" style="font-size:20px">${btqaFmt(totalAttn)}</div><div class="btqa-stat-lbl">Total en attente</div></div>
    <div class="btqa-stat" onclick="btqaShowDetailStats()" style="cursor:pointer" title="Voir le détail">
      <div class="btqa-stat-val" style="font-size:20px">${btqaFmt(totalPaye)}</div>
      <div class="btqa-stat-lbl">Total encaissé ↗</div>
    </div>
  `;
}

function btqaShowDetailStats() {
  const all = btqaDateFilteredCommandes();
  const statutsPaies = ['payee','production','livraison','confirmee','remise','physique'];
  const payees = all.filter(c => statutsPaies.includes(c.statut));

  // Total en ligne vs physique
  const totalLigne    = payees.filter(c => c.type !== 'physique').reduce((s,c) => s + (c.total_centimes||0), 0);
  const totalPhysique = payees.filter(c => c.type === 'physique').reduce((s,c) => s + (c.total_centimes||0), 0);

  // Prix moyen du panier (commandes payées uniquement)
  const prixMoyen = payees.length ? Math.round(payees.reduce((s,c) => s + (c.total_centimes||0), 0) / payees.length) : 0;

  // Produit le plus vendu
  const qteProduit = {};
  all.forEach(c => (c.boutique_items||[]).filter(i => !i.est_offert || i.prix_unitaire_centimes >= 0).forEach(i => {
    const k = i.produit_nom || 'Inconnu';
    qteProduit[k] = (qteProduit[k] || 0) + (i.quantite || 1);
  }));
  const topProduit = Object.entries(qteProduit).sort((a,b) => b[1]-a[1])[0];

  // Taux de conversion : payées / (toutes sauf panier sans nom)
  const avecNom = all.filter(c => c.nom_acheteur);
  const tauxConv = avecNom.length ? Math.round(payees.length / avecNom.length * 100) : 0;

  // Coût d'achat (uniquement commandes payées, articles non-offerts)
  const prixAchatMap = [
    { keys: ['fitness'],                           prix: 9.756  },
    { keys: ['sweat à capuche','sweat a capuche'],  prix: 19.992 },
    { keys: ['sweat col rond','col rond'],          prix: 16.416 },
    { keys: ['tshirt','t-shirt','t shirt'],         prix: 9.24   },
  ];
  function getPrixAchat(nomProduit) {
    const n = (nomProduit || '').toLowerCase();
    for (const r of prixAchatMap) if (r.keys.some(k => n.includes(k))) return r.prix;
    return null;
  }
  let coutAchatCentimes = 0;
  payees.forEach(c => (c.boutique_items||[]).forEach(it => {
    if (it.est_offert) return;
    const pa = getPrixAchat(it.produit_nom);
    if (pa !== null) coutAchatCentimes += Math.round(pa * 100) * (it.quantite || 1);
  }));
  const totalEncaisse = totalLigne + totalPhysique;

  // Frais SumUp 1,75% sur les ventes physiques payées en SumUp
  const totalSumUp = payees.filter(c => c.type === 'physique' && c.moyen_paiement === 'sumup').reduce((s,c) => s + (c.total_centimes||0), 0);
  const tauxSumUp = (parseFloat(String((window.BDE && BDE.get('sumup_frais_pct', '1.75')) || '1.75').replace(',', '.')) || 1.75) / 100;   // réglable dans Paramètres > Intégrations
  const fraisSumUp = Math.round(totalSumUp * tauxSumUp);

  const margeBrute = totalEncaisse - coutAchatCentimes;
  const margeNette = margeBrute - fraisSumUp;
  const tauxMarge = totalEncaisse > 0 ? Math.round(margeBrute / totalEncaisse * 100) : 0;
  const tauxMargeNette = totalEncaisse > 0 ? Math.round(margeNette / totalEncaisse * 100) : 0;

  const rows = [
    ['Total en ligne',    btqaFmt(totalLigne)],
    ['Total en physique', btqaFmt(totalPhysique)],
    ...(totalSumUp > 0 ? [['↳ dont SumUp', btqaFmt(totalSumUp)]] : []),
    ['Prix moyen panier', btqaFmt(prixMoyen)],
    ['Produit + vendu',   topProduit ? `${topProduit[0]} (×${topProduit[1]})` : '—'],
    ['Taux de conversion',`${tauxConv}%`],
    null,
    ['Coût d\'achat',     btqaFmt(coutAchatCentimes)],
    ...(fraisSumUp > 0 ? [[`Frais SumUp (${(tauxSumUp * 100).toFixed(2).replace(/\.?0+$/, '').replace('.', ',')}%)`, `<span style="color:#dc2626">−${btqaFmt(fraisSumUp)}</span>`]] : []),
    ['Marge brute',       `<span style="color:${margeBrute>=0?'#166534':'#dc2626'};font-weight:800">${btqaFmt(margeBrute)} (${tauxMarge}%)</span>`],
    ...(fraisSumUp > 0 ? [['Marge nette', `<span style="color:${margeNette>=0?'#166534':'#dc2626'};font-weight:800">${btqaFmt(margeNette)} (${tauxMargeNette}%)</span>`]] : []),
  ];

  const existing = document.getElementById('btqa-detail-stats-modal');
  if (existing) { existing.remove(); return; }

  const modal = document.createElement('div');
  modal.id = 'btqa-detail-stats-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45)';
  modal.onclick = e => { if (e.target === modal) modal.remove(); };
  modal.innerHTML = `
    <div style="background:white;border-radius:16px;padding:28px;min-width:400px;max-width:560px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.2)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h3 style="margin:0;color:var(--accent);font-size:18px">Détail encaissements</h3>
        <button onclick="document.getElementById('btqa-detail-stats-modal').remove()"
          style="border:none;background:#f3f4f6;border-radius:50%;width:32px;height:32px;cursor:pointer;font-size:18px;color:#666">✕</button>
      </div>
      ${rows.map(r => r === null
        ? `<div style="border-top:2px solid #e2e8f0;margin:8px 0"></div>`
        : `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #eef2f7;gap:16px">
          <span style="font-size:14px;color:#666;white-space:nowrap">${r[0]}</span>
          <span style="font-size:15px;font-weight:700;color:#0f172a;text-align:right">${r[1]}</span>
        </div>`).join('')}
    </div>`;
  document.body.appendChild(modal);
}

// ── Récap & stock ────────────────────────────────────────────
function btqaRecapStatuts() {
  return ['payee', 'production', 'livraison', 'confirmee', 'remise', 'physique'];
}
// ── Récap stock : clic sur une quantité = liste des acheteurs ──
let _btqaWho = [];
function btqaWhoRef(f) { _btqaWho.push(f); return _btqaWho.length - 1; }
function btqaWhoEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function btqaWhoShow(i) {
  const f = _btqaWho[i]; if (!f) return;
  const statuts = btqaRecapStatuts();
  const rows = [];
  _btqaCommandes.filter(c => statuts.includes(c.statut)).forEach(c => (c.boutique_items || []).forEach(it => {
    const nom = it.produit_nom || '';
    const sep = nom.indexOf(' - ');
    const collection = sep > -1 ? nom.slice(0, sep) : 'Autre';
    const modele     = sep > -1 ? nom.slice(sep + 3) : nom;
    if (f.beart && !collection.toLowerCase().includes('be art')) return;
    if (f.collection !== undefined && collection !== f.collection) return;
    if (f.modele !== undefined && modele !== f.modele) return;
    if ((it.design_nom || 'Sans design') !== f.design) return;
    if ((it.couleur || '-') !== f.couleur) return;
    if (f.taille != null && (it.taille || '-').toUpperCase() !== String(f.taille).toUpperCase()) return;
    rows.push({ c, it, modele });
  }));
  rows.sort((a, b) => (a.c.numero || '').localeCompare(b.c.numero || ''));
  const total = rows.reduce((s, r) => s + (r.it.quantite || 1), 0);
  const emails = [...new Set(rows.map(r => r.c.email_acheteur).filter(Boolean))];
  const titre = [f.design, f.couleur !== '-' ? f.couleur : '', f.taille != null ? f.taille : ''].filter(Boolean).join(' · ');
  const lignes = rows.map(r => `
    <tr style="border-top:1px solid #eef2f7">
      <td style="padding:8px 10px;font-weight:800;color:var(--accent);white-space:nowrap">${btqaWhoEsc(r.c.numero)}</td>
      <td style="padding:8px 10px;font-weight:600">${btqaWhoEsc(r.c.nom_acheteur || '-')}</td>
      <td style="padding:8px 10px;color:#666;font-size:12px">${btqaWhoEsc(r.c.email_acheteur || '')}</td>
      <td style="padding:8px 10px;color:#555;font-size:12px;white-space:nowrap">${f.beart ? btqaWhoEsc(r.modele) + ' · ' : ''}${btqaWhoEsc(r.it.taille || '-')}</td>
      <td style="padding:8px 10px;text-align:center;font-weight:800">×${r.it.quantite || 1}${r.it.est_offert ? ' <span style="color:#16a34a;font-size:10px">OFFERT</span>' : ''}</td>
      <td style="padding:8px 10px"><span class="btqa-badge ${r.c.statut}" style="font-size:11px">${btqaStatutLabel(r.c.statut)}</span></td>
    </tr>`).join('');
  let m = document.getElementById('btqa-who-modal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'btqa-who-modal';
    m.className = 'btqa-detail-modal';
    m.onclick = e => { if (e.target === m) m.style.display = 'none'; };
    document.body.appendChild(m);
  }
  m.innerHTML = `<div style="background:white;border-radius:16px;max-width:760px;width:100%;max-height:85vh;overflow:auto;padding:20px">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
      <div style="flex:1"><div style="font-size:17px;font-weight:900;color:var(--accent)">${btqaWhoEsc(titre)}</div>
      <div style="font-size:12px;color:#888">${total} pièce${total > 1 ? 's' : ''} · ${rows.length} commande${rows.length > 1 ? 's' : ''}</div></div>
      ${emails.length ? `<button style="font-size:12px;font-weight:700;padding:6px 12px;border:1.5px solid var(--accent);background:white;color:var(--accent);border-radius:8px;cursor:pointer" onclick="navigator.clipboard.writeText(${btqaWhoEsc(JSON.stringify(emails.join(', ')))}).then(()=>{this.textContent='Copié !'})">Copier les ${emails.length} e-mail${emails.length > 1 ? 's' : ''}</button>` : ''}
      <button style="font-size:12px;font-weight:700;padding:6px 12px;border:1.5px solid var(--accent);background:white;color:var(--accent);border-radius:8px;cursor:pointer" onclick="document.getElementById('btqa-who-modal').style.display='none'">Fermer</button>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">${lignes || '<tr><td style="padding:20px;color:#aaa;text-align:center">Aucune commande</td></tr>'}</table>
  </div>`;
  m.style.display = 'flex';
}

function btqaSubTab(sub) {
  document.getElementById('btqr-view-recap').style.display  = sub === 'recap'  ? '' : 'none';
  document.getElementById('btqr-view-detail').style.display = sub === 'detail' ? '' : 'none';
  document.getElementById('btqr-view-design').style.display = sub === 'design' ? '' : 'none';
  const active   = 'font-weight:800;font-size:13px;color:var(--accent);border-bottom:3px solid var(--accent);margin-bottom:-2px;cursor:pointer;padding:8px 20px;border:none;background:none';
  const inactive = 'font-weight:600;font-size:13px;color:#888;border-bottom:3px solid transparent;margin-bottom:-2px;cursor:pointer;padding:8px 20px;border:none;background:none';
  document.getElementById('btqr-sub-recap').style.cssText   = sub === 'recap'  ? active : inactive;
  document.getElementById('btqr-sub-detail').style.cssText  = sub === 'detail' ? active : inactive;
  document.getElementById('btqr-sub-design').style.cssText  = sub === 'design' ? active : inactive;
  if (sub === 'design') { try { btqaRenderDesignFournisseur(); } catch(e) { document.getElementById('btqr-design-body').innerHTML = '<p style="color:red;padding:20px">Erreur JS : ' + e.message + '</p>'; } }
}
function btqaRenderDesignFournisseur() {
  const statuts = btqaRecapStatuts();
  const cmds = _btqaCommandes.filter(c => statuts.includes(c.statut));
  const tailleOrder = ['XS','S','M','L','XL','XXL','2XL','3XL'];

  // Agrège par design+couleur sur TOUS les modèles de "Be Art"
  // Clé : design||couleur  → { design, couleur, tailles: { XS:0, S:0, ... }, total: 0 }
  const map = {};
  cmds.forEach(c => {
    (c.boutique_items || []).forEach(it => {
      const nom = it.produit_nom || '';
      const sep = nom.indexOf(' - ');
      const collection = sep > -1 ? nom.slice(0, sep) : 'Autre';
      if (!collection.toLowerCase().includes('be art')) return;

      const design  = it.design_nom || 'Sans design';
      const couleur = it.couleur || '-';
      const taille  = it.taille  || '-';
      const qty     = it.quantite || 1;
      const key     = design + '||' + couleur;

      if (!map[key]) map[key] = { design, couleur, tailles: {}, total: 0 };
      map[key].tailles[taille] = (map[key].tailles[taille] || 0) + qty;
      map[key].total += qty;
    });
  });

  // Ordre des couleurs = celui de la config produit (Blanc, Noir, Bleu...), pas alphabétique
  const cOrdre = [];
  (_btqaProduits || []).filter(p => (p.nom || '').toLowerCase().includes('be art'))
    .forEach(p => (p.couleurs_disponibles || []).forEach(c => { if (!cOrdre.includes(c)) cOrdre.push(c); }));
  const cIdx = c => { const i = cOrdre.indexOf(c); return i === -1 ? 9999 : i; };
  const rows = Object.values(map).sort((a, b) => {
    if (a.design !== b.design) return a.design.localeCompare(b.design, 'fr');
    return cIdx(a.couleur) - cIdx(b.couleur) || a.couleur.localeCompare(b.couleur, 'fr');
  });

  if (!rows.length) {
    document.getElementById('btqr-design-body').innerHTML = '<p style="color:#aaa;text-align:center;padding:32px">Aucun article Be Art</p>';
    return;
  }

  // Trouver toutes les tailles présentes
  const taillesPresentes = [...new Set(rows.flatMap(r => Object.keys(r.tailles)))]
    .sort((a, b) => {
      const ia = tailleOrder.indexOf(a.toUpperCase());
      const ib = tailleOrder.indexOf(b.toUpperCase());
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

  const totalGeneral = rows.reduce((s, r) => s + r.total, 0);

  // En-tête couleur design → couleur en badge coloré
  const couleurBadge = (c) => {
    const lc = c.toLowerCase();
    const bg = lc.includes('noir') ? '#1a1a1a' : lc.includes('blanc') ? '#e8e8e8' : lc.includes('rose') ? '#f472b6' : lc.includes('rouge') ? '#ef4444' : lc.includes('bleu') ? '#3b82f6' : lc.includes('vert') ? '#22c55e' : lc.includes('gris') ? '#9ca3af' : lc.includes('orange') ? '#f97316' : lc.includes('violet') ? '#7c3aed' : lc.includes('marron') || lc.includes('brun') ? '#92400e' : lc.includes('jaune') ? '#eab308' : lc.includes('beige') || lc.includes('crème') || lc.includes('creme') ? '#d4b896' : '#d1d5db';
    const fg = (lc.includes('blanc') || lc.includes('gris') || lc.includes('beige') || lc.includes('crème') || lc.includes('creme') || lc.includes('jaune')) ? '#333' : 'white';
    return `<span style="display:inline-block;background:${bg};color:${fg};border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700;vertical-align:middle">${c}</span>`;
  };

  let html = `<div style="margin-bottom:28px">
    <div style="background:linear-gradient(135deg,var(--accent),var(--accent-h));color:white;border-radius:14px 14px 0 0;padding:12px 20px;display:flex;align-items:center;justify-content:space-between">
      <span style="font-size:16px;font-weight:900;letter-spacing:.5px">Collection Be Art — Par design &amp; couleur</span>
      <span style="background:rgba(255,255,255,.2);border-radius:20px;padding:3px 14px;font-size:13px;font-weight:700">${totalGeneral} pièces</span>
    </div>
    <div style="border:1.5px solid #e2e8f0;border-top:none;overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:var(--accent-lt)">
            <th style="padding:9px 16px;text-align:left;font-weight:700;color:var(--accent);white-space:nowrap">Design</th>
            <th style="padding:9px 12px;text-align:left;font-weight:700;color:var(--accent);white-space:nowrap">Couleur</th>
            <th style="padding:9px 10px;text-align:center;font-weight:700;color:var(--accent);white-space:nowrap">Total</th>
            ${taillesPresentes.map(t => `<th style="padding:9px 8px;text-align:center;font-size:11px;color:#888;white-space:nowrap">${t}</th>`).join('')}
          </tr>
        </thead>
        <tbody>`;

  let prevDesign = null;
  rows.forEach((r, i) => {
    const isNewDesign = r.design !== prevDesign;
    const borderStyle = isNewDesign && i > 0 ? 'border-top:2px solid #e2e8f0' : 'border-top:1px solid #eef2f7';
    html += `<tr style="${borderStyle}">
      <td style="padding:8px 16px;font-weight:700;color:#333;white-space:nowrap">${isNewDesign ? r.design : ''}</td>
      <td style="padding:7px 12px;white-space:nowrap">${couleurBadge(r.couleur)}</td>
      <td style="padding:7px 10px;text-align:center;font-weight:800;font-size:15px;color:#0f172a;cursor:pointer;text-decoration:underline dotted" title="Voir qui" onclick="btqaWhoShow(${btqaWhoRef({beart:true,design:r.design,couleur:r.couleur})})">${r.total}</td>
      ${taillesPresentes.map(t => {
        const q = r.tailles[t] || 0;
        return q ? `<td style="padding:7px 8px;text-align:center;font-weight:700;color:var(--accent);cursor:pointer;text-decoration:underline dotted" title="Voir qui" onclick="btqaWhoShow(${btqaWhoRef({beart:true,design:r.design,couleur:r.couleur,taille:t})})">${q}</td>`
                 : `<td style="padding:7px 8px;text-align:center;color:#ddd">—</td>`;
      }).join('')}
    </tr>`;
    prevDesign = r.design;
  });

  html += `</tbody>
      <tfoot>
        <tr style="border-top:2px solid var(--accent);background:#f8fafc">
          <td style="padding:9px 16px;font-weight:800;color:var(--accent)">TOTAL</td>
          <td></td>
          <td style="padding:9px 10px;text-align:center;font-weight:900;font-size:16px;color:var(--accent)">${totalGeneral}</td>
          ${taillesPresentes.map(t => {
            const s = rows.reduce((acc, r) => acc + (r.tailles[t] || 0), 0);
            return s ? `<td style="padding:9px 8px;text-align:center;font-weight:800;color:var(--accent)">${s}</td>`
                     : `<td style="padding:9px 8px;text-align:center;color:#ddd">—</td>`;
          }).join('')}
        </tr>
      </tfoot>
    </table>
    </div>
  </div>`;

  document.getElementById('btqr-design-body').innerHTML = html;
}

// Ordre des designs d'un modèle : celui de la config produit (puis alphabétique pour les inconnus)
function btqaSortDesigns(collection, modele, noms) {
  const prod = (_btqaProduits || []).find(p => p.nom === collection + ' - ' + modele || p.nom === modele);
  const ordre = ((prod && prod.designs) || []).map(d => d.nom);
  const idx = n => { const i = ordre.indexOf(n); return i === -1 ? 9999 : i; };
  return noms.slice().sort((a, b) => idx(a) - idx(b) || a.localeCompare(b, 'fr'));
}
function btqaRenderRecap() {
  const statuts = btqaRecapStatuts();
  const cmds = _btqaCommandes.filter(c => statuts.includes(c.statut));

  // ── Construction de l'arbre Collection > Modèle > Design > Couleur > Taille
  // produit_nom = "Collection Be Art - Sweat à capuche" ou "Sweat à capuche" (sans collection)
  const tree = {}; // { collection: { modele: { design: { couleur_taille: { qty, offert } } } } }
  cmds.forEach(c => {
    (c.boutique_items || []).forEach(it => {
      const nom = it.produit_nom || '';
      const sep = nom.indexOf(' - ');
      const collection = sep > -1 ? nom.slice(0, sep) : 'Autre';
      const modele     = sep > -1 ? nom.slice(sep + 3) : nom;
      const design     = it.design_nom || 'Sans design';
      const couleur    = it.couleur || '-';
      const taille     = it.taille  || '-';
      const qty        = it.quantite || 1;

      if (!tree[collection]) tree[collection] = {};
      if (!tree[collection][modele]) tree[collection][modele] = {};
      if (!tree[collection][modele][design]) tree[collection][modele][design] = {};
      const ck = couleur + '||' + taille;
      if (!tree[collection][modele][design][ck]) tree[collection][modele][design][ck] = { couleur, taille, qty: 0, offert: 0 };
      tree[collection][modele][design][ck].qty += qty;
      if (it.est_offert) tree[collection][modele][design][ck].offert += qty;
    });
  });

  // Ordre tailles
  const tailleOrder = ['XS','S','M','L','XL','XXL','2XL','3XL'];
  const sortTaille = (a, b) => {
    const ia = tailleOrder.indexOf(a.taille.toUpperCase());
    const ib = tailleOrder.indexOf(b.taille.toUpperCase());
    if (ia === -1 && ib === -1) return a.taille.localeCompare(b.taille);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  };

  if (!Object.keys(tree).length) {
    document.getElementById('btqr-recap-body').innerHTML = '<p style="color:#aaa;text-align:center;padding:32px">Aucun article</p>';
    return;
  }

  const colOrder = ['Collection Red','Collection Be Art','Collection Fitness','Autre'];
  const sortedCollections = Object.keys(tree).sort((a, b) => {
    const ia = colOrder.findIndex(c => a.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(a.toLowerCase()) || a === c);
    const ib = colOrder.findIndex(c => b.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(b.toLowerCase()) || b === c);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  let html = '';
  for (const collection of sortedCollections) {
    const modeles = tree[collection];
    // Total collection
    let totalCol = 0;
    for (const m of Object.values(modeles)) for (const d of Object.values(m)) for (const v of Object.values(d)) totalCol += v.qty;

    html += `<div style="margin-bottom:28px">
      <div style="background:linear-gradient(135deg,var(--accent),var(--accent-h));color:white;border-radius:14px 14px 0 0;padding:12px 20px;display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:16px;font-weight:900;letter-spacing:.5px">${collection}</span>
        <span style="background:rgba(255,255,255,.2);border-radius:20px;padding:3px 14px;font-size:13px;font-weight:700">${totalCol} pièces</span>
      </div>`;

    const modeleKeys = Object.keys(modeles).sort();
    for (let mi = 0; mi < modeleKeys.length; mi++) {
      const modele = modeleKeys[mi];
      const designs = modeles[modele];
      let totalMod = 0;
      for (const d of Object.values(designs)) for (const v of Object.values(d)) totalMod += v.qty;

      // Détecter si ce modèle a des tailles (au moins une taille != '-')
      const hasTailles = Object.values(designs).some(d => Object.values(d).some(v => v.taille && v.taille !== '-'));

      const sepStyle = mi > 0 ? 'margin-top:12px;border-top:1.5px solid #e2e8f0' : 'border-top:none';
      html += `<div style="border:1.5px solid #e2e8f0;${sepStyle};overflow-x:auto">
        <div style="background:#f8fafc;padding:10px 20px;display:flex;align-items:center;gap:12px;border-bottom:1px solid #e2e8f0">
          <span style="font-weight:800;font-size:14px;color:var(--accent)">${modele}</span>
          <span style="color:#888;font-size:12px">${totalMod} pièces</span>
        </div>`;

      if (!hasTailles) {
        // Tableau simplifié sans tailles : Design | Total | Achetés | Offerts
        html += `<table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="background:var(--accent-lt)">
            <th style="padding:8px 16px;text-align:left;font-weight:700;color:var(--accent)">Produit</th>
            <th style="padding:8px 16px;text-align:center;font-weight:700;color:var(--accent)">Total</th>
            <th style="padding:8px 16px;text-align:center;font-weight:700;color:var(--accent)">Achetés</th>
            <th style="padding:8px 16px;text-align:center;font-weight:700;color:#FF741F">Offerts</th>
          </tr></thead><tbody>`;
        for (const design of btqaSortDesigns(collection, modele, Object.keys(designs))) {
          for (const v of Object.values(designs[design])) {
            const achetes = v.qty - v.offert;
            html += `<tr style="border-top:1px solid #eef2f7">
              <td style="padding:9px 16px;font-weight:600;color:#333">${design === 'Sans design' ? modele : design}</td>
              <td style="padding:9px 16px;text-align:center;font-weight:800;font-size:16px;color:#0f172a;cursor:pointer;text-decoration:underline dotted" title="Voir qui" onclick="btqaWhoShow(${btqaWhoRef({collection,modele,design,couleur:v.couleur})})">${v.qty}</td>
              <td style="padding:9px 16px;text-align:center;font-weight:700;color:var(--accent)">${achetes}</td>
              <td style="padding:9px 16px;text-align:center;font-weight:700;color:#FF741F">${v.offert || '—'}</td>
            </tr>`;
          }
        }
        html += `</tbody></table></div>`;
        continue;
      }

      html += `<table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:var(--accent-lt)">
              <th style="padding:8px 16px;text-align:left;font-weight:700;color:var(--accent);white-space:nowrap">Design</th>
              <th style="padding:8px 10px;text-align:left;font-weight:700;color:var(--accent);white-space:nowrap">Couleur</th>
              <th style="padding:8px 8px;text-align:center;font-weight:700;color:var(--accent);white-space:nowrap">Total</th>
              <th style="padding:8px 8px;text-align:center;font-size:11px;color:#888;white-space:nowrap">XS</th>
              <th style="padding:8px 8px;text-align:center;font-size:11px;color:#888;white-space:nowrap">S</th>
              <th style="padding:8px 8px;text-align:center;font-size:11px;color:#888;white-space:nowrap">M</th>
              <th style="padding:8px 8px;text-align:center;font-size:11px;color:#888;white-space:nowrap">L</th>
              <th style="padding:8px 8px;text-align:center;font-size:11px;color:#888;white-space:nowrap">XL</th>
              <th style="padding:8px 8px;text-align:center;font-size:11px;color:#888;white-space:nowrap">2XL</th>
            </tr>
          </thead>
          <tbody>`;

      let prevDesign = null;
      for (const design of btqaSortDesigns(collection, modele, Object.keys(designs))) {
        const variants = Object.values(designs[design]).sort(sortTaille);
        const byCouleur = {};
        variants.forEach(v => {
          if (!byCouleur[v.couleur]) byCouleur[v.couleur] = [];
          byCouleur[v.couleur].push(v);
        });

        let firstRow = true;
        const designRowCount = Object.keys(byCouleur).length;

        for (const couleur of Object.keys(byCouleur).sort()) {
          const vList = byCouleur[couleur];
          const totalRow = vList.reduce((s, v) => s + v.qty, 0);

          const qtyFor = (t) => {
            const v = vList.find(x => x.taille.toUpperCase() === t.toUpperCase());
            if (!v) return '<td style="padding:6px 8px;text-align:center;color:#ddd">—</td>';
            const off = v.offert ? `<span style="font-size:10px;color:#FF741F;display:block">(+${v.offert})</span>` : '';
            return `<td style="padding:6px 8px;text-align:center;font-weight:700;color:var(--accent);cursor:pointer;text-decoration:underline dotted" title="Voir qui" onclick="btqaWhoShow(${btqaWhoRef({collection,modele,design,couleur,taille:t})})">${v.qty}${off}</td>`;
          };
          const autresTailles = vList.filter(v => !tailleOrder.includes(v.taille.toUpperCase()) && v.taille !== '-');
          const autresCell = autresTailles.length
            ? `<td style="padding:6px 8px;text-align:center;font-size:11px;color:#555">${autresTailles.map(v => `${v.taille}×${v.qty}`).join(' ')}</td>`
            : '<td style="padding:6px 8px;text-align:center;color:#ddd">—</td>';

          const borderTop = (prevDesign !== null && firstRow) ? 'border-top:2px solid #e2e8f0' : 'border-top:1px solid #eef2f7';

          html += `<tr style="${borderTop}">
            ${firstRow ? `<td rowspan="${designRowCount}" style="padding:8px 16px;font-weight:700;color:#333;vertical-align:top;border-right:1px solid #eef2f7">${design}</td>` : ''}
            <td style="padding:6px 10px;color:#555;white-space:nowrap">${couleur}</td>
            <td style="padding:6px 8px;text-align:center;font-weight:800;font-size:15px;color:#0f172a;cursor:pointer;text-decoration:underline dotted" title="Voir qui" onclick="btqaWhoShow(${btqaWhoRef({collection,modele,design,couleur})})">${totalRow}</td>
            ${qtyFor('XS')}${qtyFor('S')}${qtyFor('M')}${qtyFor('L')}${qtyFor('XL')}${qtyFor('2XL')}
          </tr>`;

          firstRow = false;
        }
        prevDesign = design;
      }

      html += `</tbody></table></div>`;
    }
    html += `</div>`;
  }

  document.getElementById('btqr-recap-body').innerHTML = html;

  // ── Détail groupé par commande
  const el = document.getElementById('btqr-detail-body');
  if (!cmds.length) { el.innerHTML = '<p style="color:#aaa;text-align:center;padding:20px">Aucune commande</p>'; return; }
  el.innerHTML = cmds.map(c => {
    const items = c.boutique_items || [];
    const itemsHtml = items.map(it => `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid #eef2f7;font-size:13px">
        <span style="flex:2;font-weight:${it.est_offert ? '700' : '500'};color:${it.est_offert ? '#166534' : 'var(--noir)'}">
          ${it.produit_nom}${it.est_offert ? ' <span style="background:#bbf7d0;color:#166534;font-size:10px;padding:1px 6px;border-radius:10px;font-weight:800">OFFERT</span>' : ''}
        </span>
        <span style="flex:1;color:#888">${it.design_nom || '-'}</span>
        <span style="flex:1;color:#888">${it.couleur || '-'}</span>
        <span style="flex:0 0 48px;color:#888;text-align:center">${it.taille || '-'}</span>
        <span style="flex:0 0 28px;font-weight:700;text-align:center">×${it.quantite || 1}</span>
        <span style="flex:0 0 72px;text-align:right;font-weight:700;color:${it.est_offert ? '#16a34a' : '#2563eb'}">${it.est_offert ? 'OFFERT' : btqaFmt((it.prix_unitaire_centimes||0)*(it.quantite||1))}</span>
      </div>`).join('');
    return `
      <div style="border:1.5px solid #e2e8f0;border-radius:12px;margin-bottom:12px;overflow:hidden">
        <div style="display:flex;align-items:center;gap:12px;padding:10px 16px;background:#f8fafc;flex-wrap:wrap">
          <span style="font-weight:800;color:var(--accent);font-size:14px">${c.numero}</span>
          <span style="font-weight:600;font-size:13px">${c.nom_acheteur || '-'}</span>
          <span style="font-size:12px;color:#888">${c.email_acheteur || ''}</span>
          <span class="btqa-badge ${c.statut}" style="font-size:11px">${btqaStatutLabel(c.statut)}</span>
          <span style="font-size:11px;color:#aaa">${(() => { const _statutsPaies = ['payee','production','livraison','confirmee','remise','physique']; const _d = new Date((_statutsPaies.includes(c.statut) && c.updated_at) ? c.updated_at : c.created_at); return _d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'2-digit'}) + ' ' + _d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}); })()}</span>
          <span style="margin-left:auto;font-weight:800;color:var(--accent)">${btqaFmt(c.total_centimes)}</span>
        </div>
        <div style="padding:4px 16px 10px">${itemsHtml || '<p style="color:#aaa;font-size:13px;margin:8px 0">Aucun article</p>'}</div>
      </div>`;
  }).join('');
}
function btqaExportPDFAuto() {
  const isDesign = document.getElementById('btqr-view-design').style.display !== 'none';
  if (isDesign) btqaExportDesignPDF();
  else btqaExportRecapPDF();
}

function btqaExportDesignPDF() {
  function doExport() {
    const date = new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
    const btn = document.getElementById('btqr-export-btn');
    btn.textContent = '⏳ Génération…';
    btn.disabled = true;

    const statuts = btqaRecapStatuts();
    const cmds = _btqaCommandes.filter(c => statuts.includes(c.statut));
    const tailleOrder = ['XS','S','M','L','XL','2XL'];
    const map = {};
    cmds.forEach(c => {
      (c.boutique_items || []).forEach(it => {
        const nom = it.produit_nom || '';
        const sep = nom.indexOf(' - ');
        const collection = sep > -1 ? nom.slice(0, sep) : 'Autre';
        if (!collection.toLowerCase().includes('be art')) return;
        const design = it.design_nom || 'Sans design';
        const couleur = it.couleur || '-';
        const taille  = it.taille  || '-';
        const qty     = it.quantite || 1;
        const key = design + '||' + couleur;
        if (!map[key]) map[key] = { design, couleur, tailles: {}, total: 0 };
        map[key].tailles[taille] = (map[key].tailles[taille] || 0) + qty;
        map[key].total += qty;
      });
    });
    const cOrdre = [];
    (_btqaProduits || []).filter(p => (p.nom || '').toLowerCase().includes('be art'))
      .forEach(p => (p.couleurs_disponibles || []).forEach(c => { if (!cOrdre.includes(c)) cOrdre.push(c); }));
    const cIdx = c => { const i = cOrdre.indexOf(c); return i === -1 ? 9999 : i; };
    const rows = Object.values(map).sort((a,b) => a.design !== b.design ? a.design.localeCompare(b.design,'fr') : (cIdx(a.couleur) - cIdx(b.couleur) || a.couleur.localeCompare(b.couleur,'fr')));
    const taillesPresentes = tailleOrder.filter(t => rows.some(r => r.tailles[t]));
    const totalGeneral = rows.reduce((s,r) => s + r.total, 0);

    const th  = 'padding:6px 8px;text-align:center;background:#f2f2f2;color:#111;font-size:10px;font-weight:700;border:1px solid #ccc';
    const thL = 'padding:6px 12px;text-align:left;background:#f2f2f2;color:#111;font-size:10px;font-weight:700;border:1px solid #ccc';
    const totauxTaille = {};
    let tbody = '';
    let prevDesign = null;
    rows.forEach((r, i) => {
      const isNew = r.design !== prevDesign;
      const bg = i % 2 === 0 ? '#fafafa' : 'white';
      const borderTop = isNew && i > 0 ? 'border-top:2px solid #aaa' : 'border-top:1px solid #ddd';
      tbody += `<tr style="background:${bg};${borderTop}">
        <td style="padding:6px 12px;font-weight:${isNew?'700':'400'};font-size:11px;color:#111;border:1px solid #ddd">${isNew ? r.design : ''}</td>
        <td style="padding:6px 10px;font-size:11px;color:#333;border:1px solid #ddd">${r.couleur}</td>
        <td style="padding:6px 8px;text-align:center;font-weight:700;font-size:12px;color:#111;border:1px solid #ddd">${r.total}</td>
        ${taillesPresentes.map(t => {
          const q = r.tailles[t] || 0;
          if (q) totauxTaille[t] = (totauxTaille[t]||0) + q;
          return q
            ? `<td style="padding:6px 8px;text-align:center;font-weight:600;font-size:11px;color:#111;border:1px solid #ddd">${q}</td>`
            : `<td style="padding:6px 8px;text-align:center;font-size:11px;color:#bbb;border:1px solid #ddd">—</td>`;
        }).join('')}
      </tr>`;
      prevDesign = r.design;
    });
    tbody += `<tr style="border-top:2px solid #333;background:#ebebeb">
      <td style="padding:7px 12px;font-weight:700;font-size:10px;color:#111;border:1px solid #aaa;letter-spacing:.5px">TOTAL</td>
      <td style="border:1px solid #aaa"></td>
      <td style="padding:7px 8px;text-align:center;font-weight:800;font-size:14px;color:#111;border:1px solid #aaa">${totalGeneral}</td>
      ${taillesPresentes.map(t => {
        const s = totauxTaille[t]||0;
        return s
          ? `<td style="padding:7px 8px;text-align:center;font-weight:700;font-size:11px;color:#111;border:1px solid #aaa">${s}</td>`
          : `<td style="padding:7px 8px;text-align:center;font-size:11px;color:#bbb;border:1px solid #aaa">—</td>`;
      }).join('')}
    </tr>`;

    const tableHtml = `
      <div style="border-bottom:2px solid #111;padding-bottom:6px;margin-bottom:0;display:flex;align-items:baseline;justify-content:space-between">
        <span style="font-size:18px;font-weight:700;color:#111">Collection Be Art — Par design &amp; couleur</span>
        <span style="font-size:11px;color:#444;font-weight:600">${totalGeneral} pièces</span>
      </div>
      <table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;margin-top:0">
        <thead><tr>
          <th style="${thL}">Design</th>
          <th style="${thL}">Couleur</th>
          <th style="${th}">Total</th>
          ${taillesPresentes.map(t => `<th style="${th}">${t}</th>`).join('')}
        </tr></thead>
        <tbody>${tbody}</tbody>
      </table>`;

    const el = document.createElement('div');
    el.style.cssText = 'width:190mm;margin:0 auto;background:white;padding:2mm 6mm 6mm;font-family:Arial,sans-serif';
    el.innerHTML = tableHtml;
    document.body.appendChild(el);

    const filename = `be-art-par-design-${new Date().toISOString().slice(0,10)}.pdf`;
    html2pdf().set({
      margin: [14, 5, 8, 5],
      filename,
      html2canvas: { scale: 4, useCORS: true, logging: false, scrollX: 0, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css','legacy'], avoid: ['tr'] },
    }).from(el).toPdf().get('pdf').then(pdf => {
      const totalPages = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(30, 30, 30);
        pdf.text('BDE CREAD Lyon — Récap commandes', 5, 8);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(130, 130, 130);
        pdf.text(`Généré le ${date}`, 5, 12.5);
        pdf.setFontSize(9);
        pdf.setTextColor(100, 100, 100);
        pdf.text(`${i} / ${totalPages}`, 205, 8, { align: 'right' });
        pdf.setDrawColor(180, 180, 180);
        pdf.setLineWidth(0.3);
        pdf.line(5, 13.5, 205, 13.5);
      }
    }).save().then(() => {
      document.body.removeChild(el);
      btn.textContent = '⬇ Export PDF récap';
      btn.disabled = false;
    });
  }

  if (window.html2pdf) { doExport(); return; }
  const s = document.createElement('script');
  s.src = '/html2pdf.bundle.min.js';
  s.onload = doExport;
  s.onerror = () => alert('Erreur chargement librairie PDF.');
  document.head.appendChild(s);
}

function btqaExportRecapPDF() {
  function doExport() {
    const date = new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
    const btn = document.getElementById('btqr-export-btn');
    btn.textContent = '⏳ Génération…';
    btn.disabled = true;

    const statuts = btqaRecapStatuts();
    const cmds = _btqaCommandes.filter(c => statuts.includes(c.statut));
    const tailleOrder = ['XS','S','M','L','XL','2XL'];

    // Construire l'arbre Collection > Modèle > Design > Couleur+Taille (sans écocup)
    const tree = {};
    cmds.forEach(c => {
      (c.boutique_items || []).forEach(it => {
        const nom = it.produit_nom || '';
        if (nom.toLowerCase().includes('écocup') || nom.toLowerCase().includes('ecocup')) return;
        const sep = nom.indexOf(' - ');
        const collection = sep > -1 ? nom.slice(0, sep) : 'Autre';
        const modele     = sep > -1 ? nom.slice(sep + 3) : nom;
        const design  = it.design_nom || 'Sans design';
        const couleur = it.couleur || '-';
        const taille  = it.taille  || '-';
        const qty     = it.quantite || 1;
        if (!tree[collection]) tree[collection] = {};
        if (!tree[collection][modele]) tree[collection][modele] = {};
        if (!tree[collection][modele][design]) tree[collection][modele][design] = {};
        const ck = couleur + '||' + taille;
        if (!tree[collection][modele][design][ck]) tree[collection][modele][design][ck] = { couleur, taille, qty: 0 };
        tree[collection][modele][design][ck].qty += qty;
      });
    });

    const colOrder = ['Collection Red','Collection Be Art','Collection Fitness','Autre'];
    const sortedCollections = Object.keys(tree).sort((a,b) => {
      const ia = colOrder.findIndex(c => a.includes(c) || c.includes(a));
      const ib = colOrder.findIndex(c => b.includes(c) || c.includes(b));
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    const tdH = 'padding:6px 10px;text-align:center;background:#f2f2f2;color:#111;font-size:10px;font-weight:700;border:1px solid #ccc';
    const tdHL = 'padding:6px 12px;text-align:left;background:#f2f2f2;color:#111;font-size:10px;font-weight:700;border:1px solid #ccc';

    let pages = [];

    for (const collection of sortedCollections) {
      for (const modele of Object.keys(tree[collection]).sort()) {
        const designs = tree[collection][modele];
        const taillesPresentes = tailleOrder.filter(t =>
          Object.values(designs).some(d => Object.values(d).some(v => v.taille.toUpperCase() === t))
        );
        const hasTailles = taillesPresentes.length > 0;

        let tbody = '';
        let totalGeneral = 0;
        const totauxTaille = {};
        let rowIdx = 0;

        const sortedDesigns = btqaSortDesigns(collection, modele, Object.keys(designs));
        let prevDesign = null;
        for (const design of sortedDesigns) {
          const variants = Object.values(designs[design]);
          const byCouleur = {};
          variants.forEach(v => {
            if (!byCouleur[v.couleur]) byCouleur[v.couleur] = [];
            byCouleur[v.couleur].push(v);
          });
          const couleurs = Object.keys(byCouleur).sort();

          couleurs.forEach((couleur, ci) => {
            const vList = byCouleur[couleur];
            const totalRow = vList.reduce((s,v) => s+v.qty, 0);
            totalGeneral += totalRow;
            const isNewDesign = design !== prevDesign && ci === 0;
            const bg = rowIdx % 2 === 0 ? '#fafafa' : 'white';
            const borderTop = isNewDesign && rowIdx > 0 ? 'border-top:2px solid #aaa' : 'border-top:1px solid #ddd';

            const qtyFor = (t) => {
              const v = vList.find(x => x.taille.toUpperCase() === t);
              const q = v ? v.qty : 0;
              if (q) totauxTaille[t] = (totauxTaille[t]||0) + q;
              return q
                ? `<td style="padding:6px 8px;text-align:center;font-weight:600;font-size:11px;color:#111;border:1px solid #ddd">${q}</td>`
                : `<td style="padding:6px 8px;text-align:center;font-size:11px;color:#bbb;border:1px solid #ddd">—</td>`;
            };

            tbody += `<tr style="background:${bg};${borderTop}">
              <td style="padding:6px 12px;font-size:11px;font-weight:${isNewDesign?'700':'400'};color:#111;border:1px solid #ddd">${isNewDesign ? design : ''}</td>
              <td style="padding:6px 10px;font-size:11px;color:#333;border:1px solid #ddd">${couleur}</td>
              <td style="padding:6px 8px;text-align:center;font-weight:700;font-size:12px;color:#111;border:1px solid #ddd">${totalRow}</td>
              ${hasTailles ? taillesPresentes.map(t => qtyFor(t)).join('') : ''}
            </tr>`;
            prevDesign = design;
            rowIdx++;
          });
        }

        tbody += `<tr style="border-top:2px solid #333;background:#ebebeb">
          <td style="padding:7px 12px;font-weight:700;font-size:10px;color:#111;border:1px solid #aaa;letter-spacing:.5px">TOTAL</td>
          <td style="border:1px solid #aaa"></td>
          <td style="padding:7px 8px;text-align:center;font-weight:800;font-size:14px;color:#111;border:1px solid #aaa">${totalGeneral}</td>
          ${hasTailles ? taillesPresentes.map(t => {
            const s = totauxTaille[t]||0;
            return s
              ? `<td style="padding:7px 8px;text-align:center;font-weight:700;font-size:11px;color:#111;border:1px solid #aaa">${s}</td>`
              : `<td style="padding:7px 8px;text-align:center;font-size:11px;color:#bbb;border:1px solid #aaa">—</td>`;
          }).join('') : ''}
        </tr>`;

        const pageHtml = `
          <div style="margin-bottom:8mm">
            <div style="border-bottom:2px solid #111;padding-bottom:6px;margin-bottom:0;display:flex;align-items:baseline;justify-content:space-between">
              <div>
                <span style="font-size:9px;color:#666;text-transform:uppercase;letter-spacing:.5px;margin-right:8px">${collection}</span>
                <span style="font-size:18px;font-weight:700;color:#111">${modele}</span>
              </div>
              <span style="font-size:11px;color:#444;font-weight:600">${totalGeneral} pièces</span>
            </div>
            <table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif">
              <thead><tr>
                <th style="${tdHL}">Design</th>
                <th style="${tdHL}">Couleur</th>
                <th style="${tdH}">Total</th>
                ${hasTailles ? taillesPresentes.map(t => `<th style="${tdH}">${t}</th>`).join('') : ''}
              </tr></thead>
              <tbody>${tbody}</tbody>
            </table>
          </div>`;

        pages.push(pageHtml);
      }
    }

    if (!pages.length) {
      btn.textContent = '⬇ Export PDF récap';
      btn.disabled = false;
      alert('Aucun article à exporter.');
      return;
    }

    // Assembler avec sauts de page entre chaque bloc produit
    const fullHtml = pages.map((p, i) =>
      i < pages.length - 1 ? `<div style="page-break-after:always">${p}</div>` : p
    ).join('');

    const el = document.createElement('div');
    el.style.cssText = 'width:190mm;margin:0 auto;background:white;padding:2mm 6mm 6mm;font-family:Arial,sans-serif';
    el.innerHTML = fullHtml;
    document.body.appendChild(el);

    const filename = `recap-stock-BDE-${new Date().toISOString().slice(0,10)}.pdf`;
    html2pdf().set({
      margin: [14, 5, 8, 5],
      filename,
      html2canvas: { scale: 4, useCORS: true, logging: false, scrollX: 0, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css','legacy'], avoid: ['tr'] },
    }).from(el).toPdf().get('pdf').then(pdf => {
      const totalPages = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(70, 1, 134);
        pdf.text('BDE CREAD Lyon — Récap commandes', 5, 8);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`Généré le ${date}`, 5, 12.5);
        pdf.setFontSize(9);
        pdf.setTextColor(100, 100, 100);
        pdf.text(`${i} / ${totalPages}`, 205, 8, { align: 'right' });
        pdf.setDrawColor(200, 190, 230);
        pdf.setLineWidth(0.3);
        pdf.line(5, 13.5, 205, 13.5);
      }
    }).save().then(() => {
      document.body.removeChild(el);
      btn.textContent = '⬇ Export PDF récap';
      btn.disabled = false;
    });
  }

  if (window.html2pdf) { doExport(); return; }
  const s = document.createElement('script');
  s.src = '/html2pdf.bundle.min.js';
  s.onload = doExport;
  s.onerror = () => alert('Erreur chargement librairie PDF.');
  document.head.appendChild(s);
}

function btqaExportRecapCSV() {
  const statuts = btqaRecapStatuts();
  const cmds = _btqaCommandes.filter(c => statuts.includes(c.statut));
  const rows = [['Collection','Modèle','Design','Couleur','Taille','Quantité totale','dont offerts']];
  const recap = {};
  cmds.forEach(c => {
    (c.boutique_items || []).forEach(it => {
      const nom = it.produit_nom || '';
      const sep = nom.indexOf(' - ');
      const collection = sep > -1 ? nom.slice(0, sep) : 'Autre';
      const modele     = sep > -1 ? nom.slice(sep + 3) : nom;
      const key = [collection, modele, it.design_nom||'', it.couleur||'', it.taille||''].join('||');
      if (!recap[key]) recap[key] = { collection, modele, design: it.design_nom||'', couleur: it.couleur||'', taille: it.taille||'', qty: 0, offert: 0 };
      recap[key].qty += it.quantite || 1;
      if (it.est_offert) recap[key].offert += it.quantite || 1;
    });
  });
  Object.values(recap).sort((a,b) => a.collection.localeCompare(b.collection) || a.modele.localeCompare(b.modele) || a.design.localeCompare(b.design)).forEach(r => {
    rows.push([r.collection, r.modele, r.design, r.couleur, r.taille, r.qty, r.offert || 0]);
  });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + csv);
  a.download = `recap-stock-BDE-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

// ── Table commandes ──────────────────────────────────────────
function btqaRenderTable(list) {
  const tbody   = document.getElementById('btqa-tbody');
  const mList   = document.getElementById('btqa-mobile-list');
  const emptyEl = document.getElementById('btqa-empty');
  if (!list.length) {
    tbody.innerHTML = ''; if (mList) mList.innerHTML = '';
    emptyEl.style.display = 'block'; return;
  }
  emptyEl.style.display = 'none';
  const mobile = window.innerWidth <= 640;
  if (mobile && mList) {
    mList.style.display = '';
    mList.innerHTML = list.map(c => {
      const d = new Date(c.created_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit' });
      const actions = [];
      const _spMobile = ['payee','production','livraison','confirmee','remise','physique'].includes(c.statut) && !(c.boutique_items?.length);
      if (c.statut === 'en_attente') actions.push(`<button class="btqa-act-btn confirm" onclick="btqaEtape('${c.id}','payee')">Payée</button>`);
      if (c.statut === 'payee')      actions.push(`<button class="btqa-act-btn confirm" onclick="btqaEtapeProd('${c.id}')">Production</button>`);
      if (c.statut === 'production') actions.push(`<button class="btqa-act-btn confirm" onclick="btqaEtape('${c.id}','livraison')">Livraison</button>`);
      if (c.statut === 'livraison')  actions.push(`<button class="btqa-act-btn confirm" onclick="btqaEtape('${c.id}','confirmee')">Récupérable</button>`);
      if (c.statut === 'confirmee')  actions.push(`<button class="btqa-act-btn remise"  onclick="btqaRemettre('${c.id}')">Remettre</button>`);
      if (c.statut === 'annulee')    actions.push(`<button class="btqa-act-btn confirm" onclick="btqaEtape('${c.id}','payee')">Restaurer</button>`);
      if (['en_attente','payee','production','livraison','confirmee'].includes(c.statut)) actions.push(`<button class="btqa-act-btn cancel" onclick="btqaCancel('${c.id}')">Annuler</button>`);
      if (c.statut === 'panier') actions.push(`<button class="btqa-act-btn cancel" onclick="btqaDeletePanier('${c.id}')">Supprimer</button>`);
    actions.push(`<button class="btqa-act-btn detail" onclick="btqaShowDetail('${c.id}')">Détail</button>`);
      return `<div style="background:${_spMobile ? '#fff5f5' : 'white'};border-top:1.5px solid #eef2f7;border-bottom:1.5px solid #eef2f7;margin-bottom:8px;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:11px 16px;background:#f8fafc;border-bottom:1px solid #eef2f7">
          <span style="font-weight:800;font-size:14px;color:var(--violet)">${c.numero || '-'}</span>
          <span class="btqa-badge ${c.statut}" style="font-size:10px">${btqaStatutLabel(c.statut)}</span>
        </div>
        <div style="padding:10px 16px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
            <span style="font-weight:700;font-size:14px">${c.nom_acheteur || '-'}</span>
            <span style="font-weight:800;font-size:15px;color:var(--violet)">${btqaFmt(c.total_centimes || 0)}</span>
          </div>
          <div style="margin-bottom:10px;font-size:11px;color:#aaa">${d}${c.type === 'physique' ? ' · <span class="btqa-badge physique" style="font-size:9px">Physique</span>' : ''}</div>
          <div style="display:flex;gap:6px">${actions.map(a => a.replace('class="btqa-act-btn', 'class="btqa-act-btn" style="flex:1;padding:9px 4px;text-align:center;font-size:12px')).join('')}</div>
        </div>
      </div>`;
    }).join('');
    return;
  }
  if (mList) mList.style.display = 'none';
  tbody.innerHTML = list.map(c => {
    const _statutsPaies = ['payee','production','livraison','confirmee','remise','physique'];
    const _dtSrc = (_statutsPaies.includes(c.statut) && c.updated_at) ? c.updated_at : c.created_at;
    const _dt = new Date(_dtSrc);
    const d = _dt.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'2-digit' });
    const h = _dt.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
    const typeLabel = c.type === 'physique'
      ? '<span class="btqa-badge physique">Physique</span>'
      : '<span style="font-size:11px;color:#999">En ligne</span>';
    const sansProduits = _statutsPaies.includes(c.statut) && !(c.boutique_items?.length);
    const actions = [];
    if (c.statut === 'en_attente') actions.push(`<button class="btqa-act-btn confirm" onclick="btqaEtape('${c.id}','payee')">Payée</button>`);
    if (c.statut === 'payee')      actions.push(`<button class="btqa-act-btn confirm" onclick="btqaEtapeProd('${c.id}')">Production</button>`);
    if (c.statut === 'production') actions.push(`<button class="btqa-act-btn confirm" onclick="btqaEtape('${c.id}','livraison')">Livraison</button>`);
    if (c.statut === 'livraison')  actions.push(`<button class="btqa-act-btn confirm" onclick="btqaEtape('${c.id}','confirmee')">Récupérable</button>`);
    if (c.statut === 'confirmee')  actions.push(`<button class="btqa-act-btn remise"  onclick="btqaRemettre('${c.id}')">Remettre</button>`);
    if (c.statut === 'annulee')    actions.push(`<button class="btqa-act-btn confirm" onclick="btqaEtape('${c.id}','payee')">Restaurer</button>`);
    if (['en_attente','payee','production','livraison','confirmee'].includes(c.statut)) actions.push(`<button class="btqa-act-btn cancel" onclick="btqaCancel('${c.id}')">Annuler</button>`);
    if (c.statut === 'panier') actions.push(`<button class="btqa-act-btn cancel" onclick="btqaDeletePanier('${c.id}')">Supprimer</button>`);
    actions.push(`<button class="btqa-act-btn detail" onclick="btqaShowDetail('${c.id}')">Détail</button>`);
    return `<tr${sansProduits ? ' style="background:#fff5f5"' : ''}>
      <td style="font-weight:700;color:var(--violet);font-size:12px">${c.numero || '-'}${sansProduits ? ' <span title="Commande payée sans articles" style="color:#dc2626;font-size:14px">⚠️</span>' : ''}</td>
      <td>${c.nom_acheteur || '-'}</td>
      <td style="font-size:12px;color:#666">${c.email_acheteur || '-'}</td>
      <td style="font-size:12px;color:#999">${d}<br><span style="font-size:11px;color:#bbb">${h}</span></td>
      <td style="font-weight:700">${btqaFmt(c.total_centimes || 0)}</td>
      <td>${typeLabel}</td>
      <td><span class="btqa-badge ${c.statut}">${btqaStatutLabel(c.statut)}</span>${sansProduits ? '<br><span style="font-size:10px;color:#dc2626;font-weight:700">Sans articles</span>' : ''}</td>
      <td style="white-space:nowrap">${actions.join(' ')}</td>
    </tr>`;
  }).join('');
}

let _btqaDateFilter = 'all';

function btqaSetDateFilter(period) {
  _btqaDateFilter = period;
  ['all','today','week','month'].forEach(p => {
    const btn = document.getElementById(`btqa-df-${p}`);
    if (btn) btn.classList.toggle('btqa-df-active', p === period);
  });
  btqaRenderStats();
  btqaFilterTable();
}

let _btqaSort = { col: 'date', dir: 'desc' };
function btqaSortBy(col) {
  if (_btqaSort.col === col) {
    _btqaSort.dir = _btqaSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    _btqaSort = { col, dir: col === 'total' ? 'desc' : 'asc' };
  }
  ['numero','nom','date','total','type','statut'].forEach(c => {
    const el = document.getElementById(`btqa-sort-${c}`);
    if (el) el.textContent = _btqaSort.col === c ? (_btqaSort.dir === 'asc' ? '↑' : '↓') : '';
  });
  btqaFilterTable();
}
function btqaFilterTable() {
  const q  = document.getElementById('btqa-search').value.toLowerCase();
  const st = document.getElementById('btqa-filter-statut').value;
  const ty = document.getElementById('btqa-filter-type').value;
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfDay.getDate() - ((startOfDay.getDay() + 6) % 7)); // lundi
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const _statutsPaies = ['payee','production','livraison','confirmee','remise','physique'];
  const btqaDateRef = c => new Date((_statutsPaies.includes(c.statut) && c.updated_at) ? c.updated_at : c.created_at);

  let filtered = _btqaCommandes.filter(c => {
    const matchQ  = !q || (c.numero||'').toLowerCase().includes(q) || (c.nom_acheteur||'').toLowerCase().includes(q) || (c.email_acheteur||'').toLowerCase().includes(q);
    const matchSt = !st || c.statut === st;
    const matchTy = !ty || (ty === 'physique' ? c.type === 'physique' : c.type !== 'physique');
    let matchDate = true;
    if (_btqaDateFilter !== 'all') {
      const d = btqaDateRef(c);
      if (_btqaDateFilter === 'today') matchDate = d >= startOfDay;
      else if (_btqaDateFilter === 'week') matchDate = d >= startOfWeek;
      else if (_btqaDateFilter === 'month') matchDate = d >= startOfMonth;
    }
    return matchQ && matchSt && matchTy && matchDate;
  });

  const { col, dir } = _btqaSort;
  const asc = dir === 'asc' ? 1 : -1;
  filtered = [...filtered].sort((a, b) => {
    if (col === 'date')   return asc * (btqaDateRef(a) - btqaDateRef(b));
    if (col === 'total')  return asc * ((a.total_centimes||0) - (b.total_centimes||0));
    if (col === 'numero') return asc * (a.numero||'').localeCompare(b.numero||'');
    if (col === 'nom')    return asc * (a.nom_acheteur||'').localeCompare(b.nom_acheteur||'');
    if (col === 'statut') return asc * (a.statut||'').localeCompare(b.statut||'');
    if (col === 'type')   return asc * (a.type||'').localeCompare(b.type||'');
    return 0;
  });

  btqaRenderTable(filtered);
}

// ── Détail commande ──────────────────────────────────────────
function btqaShowDetail(id) {
  const c = _btqaCommandes.find(x => x.id === id);
  if (!c) return;
  const items = c.boutique_items || [];
  items.forEach(i => { _btqaEditItems[i.id] = { ...i, _cmdId: c.id, _origin: 'detail' }; });
  const card = document.getElementById('btqa-detail-card');
  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h3 style="margin:0;color:var(--violet)">${c.numero || 'Panier'}</h3>
      <button onclick="document.getElementById('btqa-detail-modal').style.display='none'"
        style="border:none;background:#f3f4f6;border-radius:50%;width:32px;height:32px;cursor:pointer;font-size:18px;color:#666">✕</button>
    </div>
    <p style="margin:0 0 4px;font-weight:700">${c.nom_acheteur}</p>
    <p style="margin:0 0 12px;font-size:13px;color:#666">${c.email_acheteur}</p>
    <p style="margin:0 0 4px;font-size:12px;color:#999">
      ${new Date(c.created_at).toLocaleString('fr-FR')} · ${c.type === 'physique' ? 'Vente physique' : 'En ligne'} · ${btqaStatutLabel(c.statut)}
    </p>
    ${c.notes ? `<p style="margin:8px 0;font-size:13px;color:#666;background:#f1f5f9;padding:8px 12px;border-radius:8px">${c.notes}</p>` : ''}
    <hr style="border:none;border-top:1px solid #eef2f7;margin:16px 0">
    ${items.map(i => `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:14px;gap:8px">
        <span style="flex:1;min-width:0">${i.produit_nom}${i.design_nom ? ` - ${i.design_nom}` : ''}${i.couleur ? ` - ${i.couleur}` : ''}${i.taille ? ` (${i.taille})` : ''} ×${i.quantite}${i.est_offert ? ' <span style="color:#FF741F;font-size:11px;font-weight:700">OFFERT</span>' : ''}</span>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          <span style="font-weight:700;color:var(--violet)">${i.est_offert ? '-' : btqaFmt(i.prix_unitaire_centimes * i.quantite)}</span>
          <button onclick="btqaOpenEditModal('${i.id}')" style="border:none;background:#f1f5f9;border-radius:7px;padding:3px 9px;font-size:11px;font-weight:700;color:var(--accent);cursor:pointer">Modifier</button>
        </div>
      </div>`).join('')}
    <hr style="border:none;border-top:1px solid #eef2f7;margin:12px 0">
    <div style="display:flex;justify-content:space-between;font-weight:700;font-size:16px">
      <span>Total</span><span style="color:var(--violet)">${btqaFmt(c.total_centimes || 0)}</span>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px;min-height:24px">
      <p style="margin:0;font-size:12px;color:#888">Paiement : <strong style="color:#555">${c.moyen_paiement || '—'}</strong>${c.notes ? ` · ${c.notes}` : ''}</p>
      <button onclick="btqaToggleDetailEdit('${c.id}')" style="border:none;background:#f1f5f9;border-radius:7px;padding:3px 10px;font-size:11px;font-weight:700;color:var(--accent);cursor:pointer;flex-shrink:0;margin-left:8px">Modifier</button>
    </div>
    <div id="btqa-detail-edit-${c.id}" hidden style="margin-top:12px;padding:14px;background:#f8fafc;border-radius:14px;border:1.5px solid #e8eef6">
      <p style="margin:0 0 10px;font-size:11px;font-weight:800;color:#888;text-transform:uppercase;letter-spacing:1.5px">Modifier la commande</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <div>
          <p style="margin:0 0 5px;font-size:11px;font-weight:700;color:var(--accent)">Moyen de paiement</p>
          <select id="btqa-detail-paiement-${c.id}" style="width:100%;padding:9px 10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;background:white;outline:none">
            <option value="">— Non renseigné —</option>
            <option value="especes" ${c.moyen_paiement==='especes'?'selected':''}>Especes</option>
            <option value="sumup" ${c.moyen_paiement==='sumup'?'selected':''}>SumUp</option>
            <option value="virement" ${c.moyen_paiement==='virement'?'selected':''}>Virement</option>
            <option value="en_ligne" ${c.moyen_paiement==='en_ligne'?'selected':''}>En ligne</option>
            <option value="cheque" ${c.moyen_paiement==='cheque'?'selected':''}>Cheque</option>
            <option value="autre" ${c.moyen_paiement==='autre'?'selected':''}>Autre</option>
          </select>
        </div>
        <div>
          <p style="margin:0 0 5px;font-size:11px;font-weight:700;color:var(--accent)">Notes</p>
          <input id="btqa-detail-notes-${c.id}" type="text" value="${(c.notes||'').replace(/"/g,'&quot;')}" placeholder="Note libre…" style="width:100%;padding:9px 10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;box-sizing:border-box;outline:none">
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="btqaSaveDetailEdit('${c.id}')" style="flex:1;padding:10px;background:linear-gradient(135deg,var(--accent),var(--accent-h));color:white;border:none;border-radius:11px;font-size:13px;font-weight:800;cursor:pointer">Enregistrer</button>
        <button onclick="document.getElementById('btqa-detail-edit-${c.id}').hidden=true" style="padding:10px 16px;background:white;color:#666;border:1.5px solid #e2e8f0;border-radius:11px;font-size:13px;font-weight:600;cursor:pointer">Annuler</button>
      </div>
    </div>
    <div style="margin-top:14px">${btqaMailBlock(c)}</div>
    <div style="display:flex;gap:8px;margin-top:20px;flex-wrap:wrap">
      ${c.statut === 'en_attente' ? `<button class="btqa-act-btn confirm" onclick="btqaEtape('${c.id}','payee');document.getElementById('btqa-detail-modal').style.display='none'">Paiement confirme</button>` : ''}
      ${c.statut === 'payee'      ? `<button class="btqa-act-btn confirm" onclick="btqaEtape('${c.id}','production');document.getElementById('btqa-detail-modal').style.display='none'">Lancer production</button>` : ''}
      ${c.statut === 'production' ? `<button class="btqa-act-btn confirm" onclick="btqaEtape('${c.id}','livraison');document.getElementById('btqa-detail-modal').style.display='none'">En livraison</button>` : ''}
      ${c.statut === 'livraison'  ? `<button class="btqa-act-btn confirm" onclick="btqaEtape('${c.id}','confirmee');document.getElementById('btqa-detail-modal').style.display='none'">Recuperable a l'ecole</button>` : ''}
      ${c.statut === 'confirmee'  ? `<button class="btqa-act-btn remise"  onclick="btqaRemettre('${c.id}');document.getElementById('btqa-detail-modal').style.display='none'">Marquer remis</button>` : ''}
    </div>`;
  document.getElementById('btqa-detail-modal').style.display = 'flex';
}

function btqaToggleDetailEdit(id) {
  const el = document.getElementById('btqa-detail-edit-' + id);
  if (el) el.hidden = !el.hidden;
}
async function btqaSaveDetailEdit(id) {
  const paiement = document.getElementById('btqa-detail-paiement-' + id)?.value || null;
  const notes = document.getElementById('btqa-detail-notes-' + id)?.value.trim() || null;
  const sb = window.Auth.sb;
  const { error } = await sb.from('boutique_commandes').update({ moyen_paiement: paiement || null, notes: notes || null }).eq('id', id);
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  const c = _btqaCommandes.find(x => x.id === id);
  if (c) { c.moyen_paiement = paiement; c.notes = notes; }
  document.getElementById('btqa-detail-modal').style.display = 'none';
  showToast('Commande mise a jour', 'success');
  btqaFilterTable();
}

// ── Actions statut ───────────────────────────────────────────
const _btqaEtapeLabels = { payee:'Paiement confirmé', production:'Production lancée', livraison:'En livraison', confirmee:'Récupérable à l\'école' };

async function btqaEtape(id, etape) {
  const label = _btqaEtapeLabels[etape] || etape;
  if (!confirm(`Passer la commande en "${label}" ? Un e-mail sera envoyé au client.`)) return;
  await window.Auth.sb.from('boutique_commandes').update({ statut: etape }).eq('id', id);
  const c = _btqaCommandes.find(x => x.id === id);
  if (c) c.statut = etape;
  btqaRenderStats();
  btqaUpdateBulkBar();
  btqaFilterTable();
  showToast(`Statut mis à jour : ${label}`);
  fetch('/api/boutique-email-etape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commande_id: id, etape }),
  }).catch(() => {});
}
async function btqaRemettre(id) {
  if (!confirm('Marquer cette commande comme remise au client ?')) return;
  const sb = window.Auth.sb;
  await sb.from('boutique_commandes').update({ statut: 'remise' }).eq('id', id);
  await sb.from('boutique_remises').insert({ commande_id: id, remis_par: window._monProfilId });
  const c = _btqaCommandes.find(x => x.id === id);
  if (c) c.statut = 'remise';
  btqaRenderStats();
  btqaUpdateBulkBar();
  btqaFilterTable();
  showToast('Commande marquée comme remise');
}
async function btqaDeletePanier(id) {
  const c = _btqaCommandes.find(x => x.id === id);
  if (!c || c.statut !== 'panier') return;
  const nb = (c.boutique_items || []).length;
  if (!confirm(`Supprimer définitivement le panier ${c.numero || ''} de ${c.nom_acheteur || 'ce client'} (${nb} article${nb > 1 ? 's' : ''}) ?\nCette action est irréversible.`)) return;
  const { data, error } = await window.Auth.sb.from('boutique_commandes').delete().eq('id', id).eq('statut', 'panier').select('id');
  if (error || !data?.length) { alert('Suppression impossible : ' + (error?.message || 'panier introuvable ou déjà validé')); return; }
  _btqaCommandes = _btqaCommandes.filter(x => x.id !== id);
  btqaRenderStats();
  btqaUpdateBulkBar();
  btqaFilterTable();
  showToast('Panier supprimé');
}
async function btqaCancel(id) {
  if (!confirm('Annuler cette commande ? Cette action est définitive.')) return;
  await window.Auth.sb.from('boutique_commandes').update({ statut: 'annulee' }).eq('id', id);
  const c = _btqaCommandes.find(x => x.id === id);
  if (c) c.statut = 'annulee';
  btqaRenderStats();
  btqaUpdateBulkBar();
  btqaFilterTable();
  showToast('Commande annulée');
}

// ── Actions groupées ─────────────────────────────────────────
// Bouton de la fiche Remise : renvoie le mail "Paiement confirmé" (avec QR code)
function btqaMailBlock(data) {
  if (!['payee','production','livraison','confirmee','remise'].includes(data.statut) || !data.email_acheteur) return '';
  const sent = data.email_confirmation_sent_at ? `Dernier envoi : ${new Date(data.email_confirmation_sent_at).toLocaleString('fr-FR')}` : 'Aucun envoi enregistré';
  return `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:14px;padding:10px 12px;background:#f8fafc;border:1.5px solid #e8eef6;border-radius:12px">
    <span style="font-size:12px;color:#666">Mail de confirmation de paiement<br><span style="color:#999">${sent}</span></span>
    <button onclick="btqaRenvoyerMailFiche('${data.id}', this)" style="padding:8px 14px;background:white;color:var(--accent);border:1.5px solid color-mix(in srgb,var(--accent) 28%,white);border-radius:10px;font-size:12px;font-weight:700;cursor:pointer">✉ Renvoyer le mail</button>
  </div>`;
}
async function btqaRenvoyerMailFiche(id, btn) {
  if (!confirm('Renvoyer au client le mail de confirmation de paiement (avec QR code) ?')) return;
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = 'Envoi…';
  try {
    const r = await fetch('/api/boutique-email-etape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commande_id: id, etape: 'payee', force: true }),
    });
    if (!r.ok) throw new Error();
    showToast('Mail envoyé', 'success');
    const c = (_btqaCommandes || []).find(x => x.id === id);
    if (c) c.email_confirmation_sent_at = new Date().toISOString();
    const detail = document.getElementById('btqa-detail-modal');
    if (c && detail && detail.style.display !== 'none' && detail.contains(btn)) btqaShowDetail(id);
    else await btqaLookupById(id);
  } catch {
    btn.disabled = false; btn.textContent = label;
    showToast('Envoi impossible (quota Resend ?)', 'error');
  }
}
function btqaUpdateBulkBar() {
  const counts = { payee: 0, production: 0, livraison: 0 };
  (_btqaCommandes || []).forEach(c => { if (counts[c.statut] !== undefined) counts[c.statut]++; });
  const map = { production: 'payee', livraison: 'production', confirmee: 'livraison' };
  for (const [target, source] of Object.entries(map)) {
    const btn = document.getElementById(`btqa-bulk-${target}`);
    const cnt = document.getElementById(`btqa-bulk-count-${target}`);
    if (!btn) continue;
    if (counts[source] > 0) {
      btn.style.display = '';
      if (cnt) cnt.textContent = `(${counts[source]})`;
    } else {
      btn.style.display = 'none';
    }
  }
}
async function btqaBulk(from, to) {
  const targets = (_btqaCommandes || []).filter(c => c.statut === from);
  if (!targets.length) return;
  const label = _btqaEtapeLabels[to] || to;
  if (!confirm(`Passer ${targets.length} commande(s) en "${label}" ? Un e-mail sera envoyé à chaque client.`)) return;
  const ids = targets.map(c => c.id);
  await window.Auth.sb.from('boutique_commandes').update({ statut: to }).in('id', ids);
  targets.forEach(c => c.statut = to);
  btqaRenderStats();
  btqaUpdateBulkBar();
  btqaFilterTable();
  showToast(`${targets.length} commande(s) passées en "${label}"`);
}

// ── Export CSV ───────────────────────────────────────────────
function btqaRelanceCommandes() {
  const total = c => (c.boutique_items || []).filter(i => !i.est_offert || i.prix_unitaire_centimes < 0)
    .reduce((t, i) => t + i.prix_unitaire_centimes * i.quantite, 0);
  const cibles = (_btqaCommandes || [])
    .filter(c => (c.statut === 'en_attente' || c.statut === 'panier') && c.email_acheteur && c.numero)
    .sort((a, b) => (a.statut === b.statut ? 0 : a.statut === 'en_attente' ? -1 : 1) || (b.numero || '').localeCompare(a.numero || ''));
  if (!cibles.length) { alert('Aucune commande en attente ou panier avec un email.'); return; }
  const esc = btqaWhoEsc;
  let m = document.getElementById('btqa-relance-modal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'btqa-relance-modal';
    m.className = 'btqa-detail-modal';
    m.onclick = e => { if (e.target === m) m.style.display = 'none'; };
    document.body.appendChild(m);
  }
  const lignes = cibles.map(c => {
    const t = total(c);
    return `<label style="display:flex;align-items:center;gap:10px;padding:8px 6px;border-top:1px solid #eef2f7;cursor:pointer;font-size:13px">
      <input type="checkbox" class="btqa-relance-cb" value="${esc(c.id)}" ${t > 0 ? 'checked' : 'disabled'} onchange="btqaRelanceCount()">
      <span style="font-weight:800;color:var(--accent);white-space:nowrap">${esc(c.numero)}</span>
      <span style="flex:1;min-width:0"><b style="font-weight:600">${esc(c.nom_acheteur || '-')}</b> <span style="color:#888;font-size:12px">${esc(c.email_acheteur)}</span></span>
      <span style="font-weight:700;white-space:nowrap">${t > 0 ? btqaFmt(t) : '<span style="color:#dc2626">Vide</span>'}</span>
      <span class="btqa-badge ${c.statut}" style="font-size:11px">${btqaStatutLabel(c.statut)}</span>
    </label>`;
  }).join('');
  m.innerHTML = `<div style="background:white;border-radius:16px;max-width:720px;width:100%;max-height:85vh;overflow:auto;padding:20px">
    <div style="font-size:17px;font-weight:900;color:var(--accent);margin-bottom:4px">Relancer des commandes</div>
    <div style="font-size:12px;color:#888;margin-bottom:10px">Décoche celles à ne pas relancer. Les commandes vides (0 €) ne peuvent pas être relancées.</div>
    <div style="display:flex;gap:8px;margin-bottom:8px">
      <button style="font-size:12px;font-weight:700;padding:5px 10px;border:1.5px solid color-mix(in srgb,var(--accent) 28%,white);background:white;color:var(--accent);border-radius:8px;cursor:pointer" onclick="document.querySelectorAll('.btqa-relance-cb:not(:disabled)').forEach(x=>x.checked=true);btqaRelanceCount()">Tout cocher</button>
      <button style="font-size:12px;font-weight:700;padding:5px 10px;border:1.5px solid color-mix(in srgb,var(--accent) 28%,white);background:white;color:var(--accent);border-radius:8px;cursor:pointer" onclick="document.querySelectorAll('.btqa-relance-cb').forEach(x=>x.checked=false);btqaRelanceCount()">Tout décocher</button>
    </div>
    ${lignes}
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px">
      <button style="font-size:13px;font-weight:700;padding:8px 16px;border:1.5px solid var(--accent);background:white;color:var(--accent);border-radius:8px;cursor:pointer" onclick="document.getElementById('btqa-relance-modal').style.display='none'">Annuler</button>
      <button id="btqa-relance-send" style="font-size:13px;font-weight:800;padding:8px 18px;border:none;background:linear-gradient(135deg,var(--accent),var(--accent-h));color:white;border-radius:8px;cursor:pointer" onclick="btqaRelanceEnvoyer(this)">Envoyer</button>
    </div>
  </div>`;
  m.style.display = 'flex';
  btqaRelanceCount();
}
function btqaRelanceCount() {
  const n = document.querySelectorAll('.btqa-relance-cb:checked').length;
  const b = document.getElementById('btqa-relance-send');
  if (b) { b.textContent = n ? `Envoyer à ${n} personne${n > 1 ? 's' : ''}` : 'Envoyer'; b.disabled = !n; b.style.opacity = n ? 1 : .5; }
}
async function btqaRelanceEnvoyer(btn) {
  const ids = [...document.querySelectorAll('.btqa-relance-cb:checked')].map(x => x.value);
  if (!ids.length) return;
  if (!confirm(`Envoyer un mail de relance à ${ids.length} personne(s) ?`)) return;
  btn.disabled = true; btn.textContent = 'Envoi en cours…';
  try {
    const { data: { session } } = await Auth.sb.auth.getSession();
    const res = await fetch('/api/boutique-relance-manuelle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ ids }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur');
    document.getElementById('btqa-relance-modal').style.display = 'none';
    alert(`Relance envoyée : ${data.sent} mail(s) sur ${data.total} commande(s).${data.skipped?.length ? `\n${data.skipped.length} ignorée(s) car vide(s) : ${data.skipped.join(', ')}` : ''}${data.errors?.length ? `\n${data.errors.length} échec(s).` : ''}`);
  } catch (e) {
    alert('Erreur : ' + e.message);
    btn.disabled = false; btqaRelanceCount();
  }
}

function btqaExportCSV() {
  const rows = [['Numéro','Nom','Email','Date','Total €','Type','Statut','Paiement','Notes']];
  _btqaCommandes.forEach(c => {
    const items = (c.boutique_items || []).filter(i => !i.est_offert)
      .map(i => `${i.produit_nom}${i.design_nom ? ` - ${i.design_nom}` : ''}${i.couleur ? ` - ${i.couleur}` : ''}${i.taille ? ` (${i.taille})` : ''} ×${i.quantite}`).join(' | ');
    rows.push([
      c.numero || '',
      c.nom_acheteur || '',
      c.email_acheteur || '',
      new Date(c.created_at).toLocaleDateString('fr-FR'),
      ((c.total_centimes || 0) / 100).toFixed(2),
      c.type,
      btqaStatutLabel(c.statut),
      c.moyen_paiement || '',
      c.notes || '',
    ]);
  });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `commandes-boutique-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

// ── Vente physique ───────────────────────────────────────────
const _COULEUR_HEX_ADMIN = { Blanc:'#FFFFFF', Noir:'#1a1a1a', Bleu:'#3B82F6', Rose:'#EC4899', Vert:'#10B981', Bordeaux:'#9B1C1C', Gris:'#6B7280', Jaune:'#F59E0B' };
let _btqaPM = { prod: null, design: null, couleur: null, taille: null, qty: 1 };
let _btqaPMCouleurExplicite = false;

function btqaRenderPhysiqueCatalog() {
  const el = document.getElementById('btqa-phys-catalog');
  if (!el) return;
  if (!_btqaProduits.length) { el.innerHTML = '<p style="color:#bbb;font-size:13px">Aucun produit actif.</p>'; return; }
  el.innerHTML = `<div class="btqa-mini-grid">${_btqaProduits.map(p => {
    const imgEl = p.image_url
      ? `<img class="btqa-mini-card-img" src="${p.image_url}" alt="" loading="lazy">`
      : `<div class="btqa-mini-card-icon">🛍️</div>`;
    return `<div class="btqa-mini-card" onclick="btqaOpenProdModal('${p.id}')">
      ${imgEl}
      <div class="btqa-mini-card-body">
        <p class="btqa-mini-card-name">${p.nom}</p>
        <p class="btqa-mini-card-price">${btqaFmt(p.prix_centimes)}</p>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function btqaOpenProdModal(prodId) {
  const p = _btqaProduits.find(x => x.id === prodId);
  if (!p) return;
  _btqaPM = { prod: p, design: null, couleur: null, taille: null, qty: 1 };
  _btqaPMCouleurExplicite = false;
  document.getElementById('btqa-pm-nom').textContent   = p.nom;
  document.getElementById('btqa-pm-price').textContent = btqaFmt(p.prix_centimes);
  document.getElementById('btqa-pm-qty').textContent   = 1;

  const designs  = (p.designs || []).filter(d => d.actif !== false);
  const couleurs = p.couleurs_disponibles || [];
  const tailles  = p.tailles_disponibles || [];

  const dw = document.getElementById('btqa-pm-design-wrap');
  dw.style.display = designs.length ? '' : 'none';
  document.getElementById('btqa-pm-designs').innerHTML = designs.map(d =>
    `<button class="btqa-psel-btn" onclick="btqaPMSelect('design','${d.nom}',this)">${d.nom}</button>`
  ).join('');
  if (designs.length === 1) {
    _btqaPM.design = designs[0].nom;
    setTimeout(() => document.querySelectorAll('#btqa-pm-designs button')[0]?.classList.add('selected'), 0);
  } else if (designs.length > 1) {
    _btqaPM.design = designs[0].nom;
    setTimeout(() => document.querySelectorAll('#btqa-pm-designs button')[0]?.classList.add('selected'), 0);
  }

  // Couleurs filtrées selon le design sélectionné
  const designActif = designs.find(d => d.nom === _btqaPM.design);
  const couleursDesign = designActif?.images ? Object.keys(designActif.images).filter(c => designActif.images[c]?.front || designActif.images[c]?.dos) : [];
  const indispoInit = designActif?.couleurs_indispo || [];
  const couleursFiltrees = (couleursDesign.length ? couleurs.filter(c => couleursDesign.includes(c)) : couleurs).filter(c => !indispoInit.includes(c));

  const cw = document.getElementById('btqa-pm-couleur-wrap');
  cw.style.display = couleursFiltrees.length ? '' : 'none';
  document.getElementById('btqa-pm-couleurs').innerHTML = couleursFiltrees.map(c => {
    const hex = _COULEUR_HEX_ADMIN[c] || '#888';
    const border = c === 'Blanc' ? 'border:1px solid #ccc;' : '';
    return `<button class="btqa-psel-color" onclick="btqaPMSelect('couleur','${c}',this)">
      <span class="btqa-psel-dot" style="background:${hex};${border}"></span>${c}
    </button>`;
  }).join('');
  if (couleursFiltrees.length === 1) {
    _btqaPM.couleur = couleursFiltrees[0];
    _btqaPMCouleurExplicite = true;
    document.querySelectorAll('#btqa-pm-couleurs button')[0]?.classList.add('selected');
  } else if (couleursFiltrees.length > 1) {
    _btqaPM.couleur = couleursFiltrees.includes('Blanc') ? 'Blanc' : couleursFiltrees[0];
    _btqaPMCouleurExplicite = false;
    const pref = _btqaPM.couleur;
    setTimeout(() => document.querySelectorAll('#btqa-pm-couleurs button').forEach(b => {
      b.classList.toggle('selected', b.textContent.trim() === pref);
    }), 0);
  }

  const tw = document.getElementById('btqa-pm-taille-wrap');
  tw.style.display = tailles.length ? '' : 'none';
  document.getElementById('btqa-pm-tailles').innerHTML = tailles.map(t =>
    `<button class="btqa-psel-btn" onclick="btqaPMSelect('taille','${t}',this)">${t}</button>`
  ).join('');
  if (tailles.length === 1) {
    _btqaPM.taille = tailles[0];
    setTimeout(() => document.querySelectorAll('#btqa-pm-tailles button')[0]?.classList.add('selected'), 0);
  }

  const options = p.options_payantes || [];
  const ow = document.getElementById('btqa-pm-options-wrap');
  ow.style.display = options.length ? '' : 'none';
  document.getElementById('btqa-pm-options').innerHTML = options.map((opt, oi) => `
    <label style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1.5px solid color-mix(in srgb,var(--accent) 16%,white);border-radius:8px;cursor:pointer;font-size:13px">
      <input type="checkbox" data-oi="${oi}" data-remise="${opt.remise_produit_centimes||0}"
        onchange="btqaPMRecalc()" style="accent-color:var(--accent);cursor:pointer">
      <span style="flex:1">${opt.nom}</span>
      <span style="font-weight:700;color:var(--accent)">+${btqaFmt(opt.prix_centimes)}${opt.remise_produit_centimes ? ` <span style="color:#10b981;font-size:11px">(−${btqaFmt(opt.remise_produit_centimes)})</span>` : ''}</span>
    </label>`).join('');

  // Guide des tailles
  const guideUrl = (p.images || []).find(i => i.type === 'guide_taille')?.url || null;
  const guideBtn = document.getElementById('btqa-pm-guide-btn');
  if (guideBtn) guideBtn.style.display = guideUrl ? '' : 'none';

  btqaPMUpdateImg();
  document.getElementById('btqa-prod-modal-overlay').classList.add('open');
}
function btqaPMOpenGuide() {
  const p = _btqaPM?.prod;
  const url = (p?.images || []).find(i => i.type === 'guide_taille')?.url;
  if (!url) return;
  document.getElementById('btqa-guide-img').src = url;
  const overlay = document.getElementById('btqa-guide-overlay');
  document.body.appendChild(overlay); // sortir du stacking context du modal
  overlay.style.display = 'flex';
}
function btqaPMCloseGuide() {
  document.getElementById('btqa-guide-overlay').style.display = 'none';
}
function btqaPMRecalc() {
  const p = _btqaPM.prod;
  if (!p) return;
  let remise = 0;
  document.querySelectorAll('#btqa-pm-options input:checked').forEach(cb => {
    remise += parseInt(cb.dataset.remise || '0');
  });
  const prix = Math.max(0, p.prix_centimes - remise);
  const el = document.getElementById('btqa-pm-price');
  if (el) el.innerHTML = remise > 0
    ? `<span style="text-decoration:line-through;opacity:.5">${btqaFmt(p.prix_centimes)}</span> ${btqaFmt(prix)}`
    : btqaFmt(p.prix_centimes);
}
function btqaCloseProdModal() {
  document.getElementById('btqa-prod-modal-overlay').classList.remove('open');
}
function btqaPMSelect(type, val, el) {
  _btqaPM[type] = val;
  if (type === 'couleur') _btqaPMCouleurExplicite = true;
  const container = el.parentElement;
  container.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  if (type === 'design') btqaPMRefreshCouleurs();
  btqaPMUpdateImg();
}

function btqaPMRefreshCouleurs() {
  const p = _btqaPM.prod;
  if (!p) return;
  const design = (p.designs || []).find(d => d.nom === _btqaPM.design);
  // Couleurs dispo pour ce design = celles qui ont une image configurée, sinon toutes
  const couleursDesign = design?.images ? Object.keys(design.images).filter(c => design.images[c]?.front || design.images[c]?.dos) : [];
  const indispo = design?.couleurs_indispo || [];
  const couleurs = (couleursDesign.length ? (p.couleurs_disponibles || []).filter(c => couleursDesign.includes(c)) : (p.couleurs_disponibles || [])).filter(c => !indispo.includes(c));

  const cw = document.getElementById('btqa-pm-couleur-wrap');
  cw.style.display = couleurs.length ? '' : 'none';
  document.getElementById('btqa-pm-couleurs').innerHTML = couleurs.map(c => {
    const hex = _COULEUR_HEX_ADMIN[c] || '#888';
    const border = c === 'Blanc' ? 'border:1px solid #ccc;' : '';
    return `<button class="btqa-psel-color" onclick="btqaPMSelect('couleur','${c}',this)">
      <span class="btqa-psel-dot" style="background:${hex};${border}"></span>${c}
    </button>`;
  }).join('');
  if (couleurs.length === 1) {
    _btqaPM.couleur = couleurs[0];
    _btqaPMCouleurExplicite = true;
    document.querySelectorAll('#btqa-pm-couleurs button')[0]?.classList.add('selected');
  } else if (couleurs.length > 1) {
    const pref = couleurs.includes('Blanc') ? 'Blanc' : couleurs[0];
    _btqaPM.couleur = pref;
    _btqaPMCouleurExplicite = false;
    document.querySelectorAll('#btqa-pm-couleurs button').forEach(b => {
      b.classList.toggle('selected', b.textContent.trim() === pref);
    });
  }
}
function btqaPMUpdateImg() {
  const p = _btqaPM?.prod;
  const thumbsEl = document.getElementById('btqa-pm-thumbs');
  const mainEl   = document.getElementById('btqa-pm-img-main');
  if (!thumbsEl || !mainEl) return;

  let front = '', dos = '';
  if (p) {
    const design = (p.designs || []).find(d => d.nom === _btqaPM.design) || (p.designs || [])[0];
    if (design?.images && _btqaPM.couleur) {
      const ci = design.images[_btqaPM.couleur] || {};
      front = ci.front || '';
      dos   = ci.dos   || '';
    }
    if (!front && !dos) {
      front = design?.image_url || p.image_url || '';
    }
  }

  // Construire les vignettes (dos en premier, comme la boutique)
  const thumbs = [];
  if (dos)   thumbs.push({ side:'dos',   img:dos,   lbl:'DOS'    });
  if (front) thumbs.push({ side:'front', img:front, lbl:'DEVANT' });

  if (thumbs.length) {
    thumbsEl.innerHTML = thumbs.map((t, i) => `
      <div class="btqa-pm-thumb${i===0?' active':''}" onclick="btqaPMThumb('${t.side}','${t.img}',this)">
        <img src="${t.img}" alt="${t.lbl}">
        ${thumbs.length > 1 ? `<span class="btqa-pm-thumb-lbl">${t.lbl}</span>` : ''}
      </div>`).join('');
    mainEl.innerHTML = `<img src="${thumbs[0].img}" alt="" id="btqa-pm-main-img">`;
  } else {
    thumbsEl.innerHTML = '';
    mainEl.innerHTML   = `<span style="font-size:60px">🛍️</span>`;
  }
}
function btqaPMThumb(side, img, el) {
  document.querySelectorAll('.btqa-pm-thumb').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const main = document.getElementById('btqa-pm-main-img');
  if (main) main.src = img;
}
function btqaPMQty(delta) {
  const qmax = _btqaPM.prod?.quantite_max || _btqaPM.prod?.max_par_commande || 10;
  _btqaPM.qty = Math.max(1, Math.min(qmax, _btqaPM.qty + delta));
  document.getElementById('btqa-pm-qty').textContent = _btqaPM.qty;
}
function btqaConfirmProdModal() {
  const { prod, design, couleur, taille, qty } = _btqaPM;
  if (!prod) return;
  if ((prod.designs || []).length && !design) return showToast('Choisis un design', 'error');
  if ((prod.couleurs_disponibles || []).length > 1 && !_btqaPMCouleurExplicite) return showToast('Choisis une couleur', 'error');
  if ((prod.tailles_disponibles || []).length && !taille) return showToast('Choisis une taille', 'error');
  const qmax = prod.quantite_max || prod.max_par_commande || 10;
  const qtyInCart = _btqaPhysItems.filter(i => i.produit_id === prod.id && !i.est_offert).reduce((s, i) => s + (i.quantite || 1), 0);
  if (qtyInCart + qty > qmax) return showToast(`Max ${qmax} par article`, 'error');

  // Calcul remise des options cochées
  let remise = 0;
  document.querySelectorAll('#btqa-pm-options input:checked').forEach(cb => {
    remise += parseInt(cb.dataset.remise || '0');
  });
  // Remise adhésion club de sport si ce produit est éligible
  const adhesionRemise = (_btqaPhysAdhesion?.produit_id === prod.id) ? (_btqaPhysAdhesion.remise_centimes || 0) : 0;
  const prixProd = Math.max(0, prod.prix_centimes - remise - adhesionRemise);
  _btqaPhysItems.push({ produit_id: prod.id, design_nom: design, couleur, taille, quantite: qty, prix_unitaire_centimes: prixProd });

  // Ajouter les options cochées comme articles séparés
  document.querySelectorAll('#btqa-pm-options input:checked').forEach(cb => {
    const oi = parseInt(cb.dataset.oi);
    const opt = (prod.options_payantes || [])[oi];
    if (opt) _btqaPhysItems.push({ produit_id: prod.id, produit_nom_override: opt.nom, design_nom: null, couleur: null, taille: null, quantite: qty, prix_unitaire_centimes: opt.prix_centimes });
  });

  btqaRefreshPhysCart();
  btqaCloseProdModal();
  showToast(`${prod.nom} ajouté`);
}
function btqaAddPhysItem() {
  _btqaPhysItems.push({ produit_id: '', taille: '', quantite: 1 });
  btqaRefreshPhysCart();
}
function btqaRefreshPhysCart() {
  _btqaPhysItems = _btqaPhysItems.filter(i => !i.est_offert);
  const pack = btqaGetPhysPack();
  if (pack) {
    const multiplier = btqaGetPhysPackMultiplier(pack);
    if (multiplier > 0) {
      const offreEntry = (pack.conditions || []).find(c => c.type === 'offre');
      const offreProdIds = offreEntry?.produit_ids?.length ? offreEntry.produit_ids : [pack.offre_produit_id].filter(Boolean);
      const offreProd = _btqaProduits.find(p => p.id === offreProdIds[0]);
      if (offreProd) _btqaPhysItems.push({ produit_id: offreProd.id, design_nom: null, couleur: null, taille: null, quantite: multiplier * (pack.offre_qty || 1), est_offert: true });
    }
  }
  btqaRenderPhysItems();
}
function btqaPhysItemImg(item, prod) {
  if (!prod) return '';
  let url = '';
  const design = (prod.designs || []).find(d => d.nom === item.design_nom) || (prod.designs || [])[0];
  if (design?.images && item.couleur) {
    const ci = design.images[item.couleur] || {};
    url = ci.dos || ci.front || '';
  }
  if (!url) url = design?.image_url || prod.image_url || '';
  if (!url) return `<div style="width:44px;height:44px;border-radius:8px;background:#eef2f7;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px">🛍️</div>`;
  return `<img src="${url}" alt="" style="width:44px;height:44px;object-fit:contain;border-radius:8px;border:1px solid #eef2f7;flex-shrink:0;background:white">`;
}
function btqaRenderPhysItems() {
  const el = document.getElementById('btqa-p-items-list');
  el.innerHTML = _btqaPhysItems.map((item, i) => {
    const prod = _btqaProduits.find(p => p.id === item.produit_id);
    const details = [item.design_nom, item.couleur, item.taille].filter(Boolean).join(' · ') || 'Taille unique';
    const qmax = prod?.quantite_max || prod?.max_par_commande || 10;
    if (item.est_offert) {
      return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#f0fdf4;border-radius:10px;margin-bottom:8px;border:1.5px solid #86efac">
        ${btqaPhysItemImg(item, prod)}
        <div style="flex:1;min-width:0">
          <p style="margin:0;font-weight:700;font-size:13px;color:#166534">${prod?.nom || '-'}${item.quantite > 1 ? ` ×${item.quantite}` : ''} <span style="background:#bbf7d0;color:#166534;font-size:10px;padding:2px 7px;border-radius:20px;font-weight:800;letter-spacing:.5px">OFFERT</span></p>
          <p style="margin:0;font-size:11px;color:#4ade80">${details}</p>
        </div>
        <span style="font-weight:700;font-size:13px;color:#16a34a">0,00 €</span>
      </div>`;
    }
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#f8fafc;border-radius:10px;margin-bottom:8px;border:1.5px solid #eef2f7">
        ${btqaPhysItemImg(item, prod)}
        <div style="flex:1;min-width:0">
          <p style="margin:0;font-weight:700;font-size:13px;color:var(--noir)">${item.produit_nom_override || prod?.nom || '-'}</p>
          <p style="margin:0;font-size:11px;color:#888">${details}</p>
        </div>
        ${item.quantite > 1 ? `<span style="font-size:12px;color:#888;font-weight:600">×${item.quantite}</span>` : ''}
        <span style="font-weight:700;font-size:13px;color:var(--accent);min-width:52px;text-align:right">${btqaFmt((item.prix_unitaire_centimes ?? prod?.prix_centimes ?? 0)*item.quantite)}</span>
        <button onclick="_btqaPhysItems.splice(${i},1);btqaRefreshPhysCart()" style="border:none;background:#fee2e2;color:#dc2626;border-radius:8px;cursor:pointer;width:28px;height:28px;font-size:16px;flex-shrink:0">✕</button>
      </div>`;
  }).join('');
  btqaUpdatePhysTotal();
}
function btqaUpdatePhysTotal() {
  const total = _btqaPhysItems.reduce((s, item) => {
    if (item.est_offert) return s;
    const p = _btqaProduits.find(x => x.id === item.produit_id);
    const prix = item.prix_unitaire_centimes ?? p?.prix_centimes ?? 0;
    return s + prix * (item.quantite || 1);
  }, 0);
  document.getElementById('btqa-p-total').textContent = btqaFmt(total);
  btqaCheckPhysPackBanner();
}
function btqaGetPhysPack() {
  const packs = window._btqaAllPacks || [];
  const qtyMap = {};
  _btqaPhysItems.filter(i => !i.est_offert).forEach(i => {
    if (i.produit_id) qtyMap[i.produit_id] = (qtyMap[i.produit_id] || 0) + (i.quantite || 1);
  });
  for (const pack of packs) {
    if (!pack.actif) continue;
    const conds = (pack.conditions || []).filter(c => c.type === 'achat' || (!c.type && (c.produit_id || c.produit_ids)));
    if (!conds.length) continue;
    const met = conds.every(c => {
      const ids = c.produit_ids || (c.produit_id ? [c.produit_id] : []);
      return ids.reduce((s, id) => s + (qtyMap[id] || 0), 0) >= (c.min_qty || 1);
    });
    if (met) return pack;
  }
  return null;
}
function btqaGetPhysPackMultiplier(pack) {
  const qtyMap = {};
  _btqaPhysItems.filter(i => !i.est_offert).forEach(i => {
    if (i.produit_id) qtyMap[i.produit_id] = (qtyMap[i.produit_id] || 0) + (i.quantite || 1);
  });
  const conds = (pack.conditions || []).filter(c => c.type === 'achat' || (!c.type && (c.produit_id || c.produit_ids)));
  if (!conds.length) return 0;
  return Math.min(...conds.map(c => {
    const ids = c.produit_ids || (c.produit_id ? [c.produit_id] : []);
    const total = ids.reduce((s, id) => s + (qtyMap[id] || 0), 0);
    return Math.floor(total / (c.min_qty || 1));
  }));
}
function btqaCheckPhysPackBanner() {
  const banner = document.getElementById('btqa-p-pack-banner');
  if (!banner) return;
  const hasOffert = _btqaPhysItems.some(i => i.est_offert);
  if (!hasOffert) { banner.style.display = 'none'; return; }
  const pack = btqaGetPhysPack();
  if (!pack) { banner.style.display = 'none'; return; }
  banner.style.display = 'flex';
  banner.textContent = `🎁 Pack "${pack.nom}" appliqué`;
}

// ── Modal emails campagne ────────────────────────────────────
function btqaOpenEmailModal() {
  const ALL_STATUTS = ['panier', 'en_attente', 'payee', 'production', 'livraison', 'confirmee', 'remise', 'physique', 'annulee'];
  const count = (_btqaCommandes || []).filter(c => ALL_STATUTS.includes(c.statut) && c.email_acheteur).length;
  const el = document.getElementById('btqa-em-count');
  if (el) el.textContent = `${count} acheteur${count > 1 ? 's' : ''} — tous statuts confondus`;
  document.getElementById('btqa-email-modal-overlay').classList.add('open');
}
function btqaCloseEmailModal() {
  document.getElementById('btqa-email-modal-overlay').classList.remove('open');
}
const _btqaTemplates = {
  production: {
    sujet: 'Production lancée - Boutique Merch BDE CREAD',
    body: `Salut {{prenom}} !

Bonne nouvelle : la production de ta commande {{numero}} vient d'être lancée !

On te recontacte dès que tes articles arrivent à l'école. En attendant, si tu as la moindre question n'hésite pas à nous contacter sur Instagram ou sur bdecreadien.fr.

À très bientôt,
Le BDE CREAD Lyon`,
  },
  livraison: {
    sujet: 'Ta commande est en route - Boutique Merch BDE CREAD',
    body: `Salut {{prenom}} !

Ta commande {{numero}} est en cours de livraison vers l'école.

Tu recevras un nouvel email dès qu'elle sera disponible pour le retrait. On y est presque !

À très bientôt,
Le BDE CREAD Lyon`,
  },
  confirmee: {
    sujet: 'Ta commande est disponible à l\'école - Boutique Merch BDE CREAD',
    body: `Salut {{prenom}} !

Tes articles sont arrivés ! Ta commande {{numero}} est prête à être retirée à l'école.

Passe nous voir avec le QR code de ta commande (reçu par email lors de la confirmation de paiement) et on te remettra tes articles.

À très bientôt,
Le BDE CREAD Lyon`,
  },
  vide: { sujet: '', body: '' },
};
function btqaLoadTemplate(key) {
  const t = _btqaTemplates[key];
  if (!t) return;
  document.getElementById('btqa-em-sujet').value = t.sujet;
  document.getElementById('btqa-em-body').value  = t.body;
}
async function btqaSendEmailCampagne(btn) {
  const sujet = document.getElementById('btqa-em-sujet').value.trim();
  const body  = document.getElementById('btqa-em-body').value.trim();
  if (!sujet) return showToast('Entre un sujet', 'error');
  if (!body)  return showToast('Entre un message', 'error');

  const ALL_STATUTS = ['panier', 'en_attente', 'payee', 'production', 'livraison', 'confirmee', 'remise', 'physique', 'annulee'];
  const destinataires = (_btqaCommandes || []).filter(c => ALL_STATUTS.includes(c.statut) && c.email_acheteur);
  if (!destinataires.length) return showToast('Aucun destinataire', 'error');

  if (!confirm(`Envoyer à ${destinataires.length} acheteur${destinataires.length > 1 ? 's' : ''} (tous statuts) ?`)) return;

  btn.disabled = true; btn.textContent = 'Envoi en cours…';
  try {
    const session = await window.Auth.sb.auth.getSession();
    const token   = session?.data?.session?.access_token;
    const r = await fetch('/api/boutique-email-campagne', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ statuts: ALL_STATUTS, sujet, body }),
    });
    const data = await r.json();
    console.log('[email-campagne] response', r.status, data);
    if (data.errors?.length) console.warn('[email-campagne] errors', data.errors);
    if (!r.ok) throw new Error(data.error || `Erreur serveur (${r.status})`);
    if (data.message) return showToast(data.message, 'info');
    showToast(`${data.sent} email${data.sent > 1 ? 's' : ''} envoyé${data.sent > 1 ? 's' : ''}${data.failed ? ` · ${data.failed} échec${data.failed > 1 ? 's' : ''}` : ''}`);
    if (data.sent > 0) btqaCloseEmailModal();
  } catch (e) {
    showToast('Erreur : ' + e.message, 'error');
  }
  btn.disabled = false; btn.textContent = 'Envoyer à tous les acheteurs →';
}

let _btqaMembres = [];
async function btqaLoadMembres() {
  if (_btqaMembres.length) return;
  const { data } = await window.Auth.sb.from('profils').select('id, prenom, nom, email').order('nom');
  _btqaMembres = data || [];
}

function btqaNomAutocomplete(q) {
  const drop = document.getElementById('btqa-p-nom-drop');
  if (!q || q.length < 2) { drop.style.display = 'none'; return; }
  const low = q.toLowerCase();
  const matches = _btqaMembres.filter(m =>
    (m.prenom + ' ' + m.nom).toLowerCase().includes(low) ||
    (m.nom + ' ' + m.prenom).toLowerCase().includes(low)
  ).slice(0, 8);
  if (!matches.length) { drop.style.display = 'none'; return; }
  drop.innerHTML = matches.map(m => `
    <div onclick="btqaSelectMembre('${m.id}')"
      style="padding:10px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid #eef2f7;display:flex;justify-content:space-between;align-items:center"
      onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='white'">
      <span style="font-weight:600">${m.prenom} ${m.nom}</span>
      <span style="color:#888;font-size:11px">${m.email}</span>
    </div>`).join('');
  drop.style.display = 'block';
}

async function btqaSelectMembre(id) {
  const m = _btqaMembres.find(x => x.id === id);
  if (!m) return;
  document.getElementById('btqa-p-nom').value   = m.prenom + ' ' + m.nom;
  document.getElementById('btqa-p-email').value  = m.email;
  document.getElementById('btqa-p-nom-drop').style.display = 'none';

  // Vérifier l'adhésion club de sport pour remise boutique
  _btqaPhysAdhesion = null;
  btqaRenderAdhesionBadge();
  try {
    const sb = window.Auth.sb;
    const { data: inscriptions } = await sb
      .from('billetterie_inscriptions')
      .select('billetterie_id')
      .eq('profil_id', id)
      .eq('statut', 'confirme');
    if (inscriptions?.length) {
      const bilIds = [...new Set(inscriptions.map(a => a.billetterie_id).filter(Boolean))];
      if (bilIds.length) {
        const { data: bils } = await sb
          .from('billetteries')
          .select('id, titre, remise_boutique_centimes, remise_produit_id')
          .in('id', bilIds)
          .gt('remise_boutique_centimes', 0);
        if (bils?.length) {
          _btqaPhysAdhesion = {
            remise_centimes: bils.reduce((s, b) => s + b.remise_boutique_centimes, 0),
            produit_id: bils[0].remise_produit_id || null,
            label: bils.map(b => b.titre).join(', '),
          };
          btqaRenderAdhesionBadge();
        }
      }
    }
  } catch (e) { console.error('[admin] adhesion check error:', e); }
}

function btqaRenderAdhesionBadge() {
  let badge = document.getElementById('btqa-adhesion-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'btqa-adhesion-badge';
    const emailEl = document.getElementById('btqa-p-email');
    emailEl?.parentNode?.insertBefore(badge, emailEl.nextSibling);
  }
  if (!_btqaPhysAdhesion) { badge.innerHTML = ''; return; }
  const prodNom = _btqaProduits.find(p => p.id === _btqaPhysAdhesion.produit_id)?.nom || 'article éligible';
  badge.innerHTML = `<div style="margin-top:8px;padding:8px 12px;background:#f0fdf4;border:1.5px solid #86efac;border-radius:8px;font-size:13px;color:#065f46">
    Adhérent ${_btqaPhysAdhesion.label} — remise de ${btqaFmt(_btqaPhysAdhesion.remise_centimes)} sur ${prodNom}
  </div>`;
}

let _btqaPhysOrderMode = 'en_attente';
function btqaConfirmPhysOrder(mode = 'en_attente') {
  _btqaPhysOrderMode = mode;
  const nom   = document.getElementById('btqa-p-nom').value.trim();
  const email = document.getElementById('btqa-p-email').value.trim();
  if (!nom)   return showToast('Entre le nom de l\'acheteur', 'error');
  if (!email) return showToast('Entre un e-mail', 'error');
  const validItems = _btqaPhysItems.filter(i => i.produit_id && !i.est_offert);
  if (!validItems.length) return showToast('Ajoute au moins un article', 'error');

  const total = _btqaPhysItems.filter(i => !i.est_offert).reduce((s, item) => {
    const p = _btqaProduits.find(x => x.id === item.produit_id);
    return s + (p ? p.prix_centimes * (item.quantite || 1) : 0);
  }, 0);

  const lignes = _btqaPhysItems.map(item => {
    const p = _btqaProduits.find(x => x.id === item.produit_id);
    const detail = [item.design_nom, item.couleur, item.taille].filter(Boolean).join(' · ');
    const prix = item.est_offert ? '<span style="color:#ff741f;font-weight:700">OFFERT</span>'
      : `<strong>${((p?.prix_centimes || 0) * item.quantite / 100).toLocaleString('fr-FR', {minimumFractionDigits:2}) + ' €'}</strong>`;
    return `<div style="display:flex;justify-content:space-between;gap:8px">
      <span>${p?.nom || '-'}${detail ? ` <span style="color:#aaa">(${detail})</span>` : ''} ×${item.quantite}</span>
      ${prix}
    </div>`;
  }).join('');

  document.getElementById('btqa-phys-confirm-recap').innerHTML = `
    <div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #eef2f7">
      <strong>${nom}</strong> - ${email}
    </div>
    <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:10px">${lignes}</div>
    <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid #eef2f7">
      <strong>Total</strong>
      <strong style="color:var(--accent)">${(total/100).toLocaleString('fr-FR',{minimumFractionDigits:2})} €</strong>
    </div>`;

  const overlay = document.getElementById('btqa-phys-confirm-overlay');
  document.body.appendChild(overlay); // sortir du parent pour que position:fixed fonctionne
  overlay.style.display = 'flex';
}

function btqaClosePhysConfirm() {
  document.getElementById('btqa-phys-confirm-overlay').style.display = 'none';
}

async function btqaCreatePhysOrder() {
  btqaClosePhysConfirm();
  const nom   = document.getElementById('btqa-p-nom').value.trim();
  const email = document.getElementById('btqa-p-email').value.trim();
  if (!nom)   return showToast('Entre le nom de l\'acheteur', 'error');
  if (!email) return showToast('Entre un e-mail', 'error');
  const validItems = _btqaPhysItems.filter(i => i.produit_id && !i.est_offert);
  if (!validItems.length) return showToast('Ajoute au moins un article', 'error');

  const sb = window.Auth.sb;
  const moyen = document.getElementById('btqa-p-paiement').value;
  const notes = document.getElementById('btqa-p-notes').value.trim();
  const total = _btqaPhysItems.filter(i => !i.est_offert).reduce((s, item) => {
    const p = _btqaProduits.find(x => x.id === item.produit_id);
    return s + (p ? p.prix_centimes * (item.quantite || 1) : 0);
  }, 0);

  // Chercher si l'email correspond à un compte
  const { data: profil } = await sb.from('profils').select('id').eq('email', email).maybeSingle();
  const membre_id = profil?.id || null;

  const statut = _btqaPhysOrderMode === 'payee' ? 'payee' : 'en_attente';
  const { data: cmd } = await sb.from('boutique_commandes').insert({
    type: 'physique', statut,
    membre_id, nom_acheteur: nom, email_acheteur: email,
    total_centimes: total, moyen_paiement: moyen,
    cree_par: window._monProfilId, notes,
  }).select('id,numero').single();

  if (!cmd) return showToast('Erreur lors de la création', 'error');

  const offertItems = _btqaPhysItems.filter(i => i.produit_id && i.est_offert);
  const itemsToInsert = [
    ...validItems.map(item => {
      const p = _btqaProduits.find(x => x.id === item.produit_id);
      return {
        commande_id: cmd.id, produit_id: item.produit_id, produit_nom: p.nom,
        design_nom: item.design_nom || null, couleur: item.couleur || null,
        taille: item.taille || null, quantite: item.quantite || 1,
        prix_unitaire_centimes: item.prix_unitaire_centimes ?? p.prix_centimes, est_offert: false,
      };
    }),
    ...offertItems.map(item => {
      const p = _btqaProduits.find(x => x.id === item.produit_id);
      return {
        commande_id: cmd.id, produit_id: item.produit_id, produit_nom: p?.nom || '',
        design_nom: null, couleur: null, taille: null, quantite: item.quantite || 1,
        prix_unitaire_centimes: 0, est_offert: true,
      };
    }),
  ];
  await sb.from('boutique_items').insert(itemsToInsert);

  if (statut === 'payee') {
    // Envoyer directement le QR code de retrait
    fetch('/api/boutique-email-etape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commande_id: cmd.id, etape: 'payee' }),
    }).catch(() => {});
  } else {
    // Envoyer l'e-mail de confirmation avec lien de paiement HelloAsso
    fetch('/api/boutique-commande', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commande_id: cmd.id, nom_acheteur: nom, email_acheteur: email }),
    }).catch(() => {});
  }

  showToast(`Commande ${cmd.numero} créée !`);
  _btqaPhysItems = [];
  _btqaPhysAdhesion = null;
  document.getElementById('btqa-p-nom').value   = '';
  document.getElementById('btqa-p-email').value  = '';
  document.getElementById('btqa-p-notes').value  = '';
  btqaRenderAdhesionBadge();
  btqaRenderPhysItems();
  await initBoutiqueAdmin();
}

// ── Remise ───────────────────────────────────────────────────
async function btqaLookup() {
  let raw = document.getElementById('btqa-r-numero').value.trim();
  if (!raw) return showToast('Entre un numéro de commande ou scanne une carte', 'error');
  // Auto-complétion : si l'utilisateur tape seulement des chiffres → BDE-YYYY-XXXX
  if (/^\d+$/.test(raw)) {
    raw = `BDE-${new Date().getFullYear()}-${raw.padStart(4, '0')}`;
    document.getElementById('btqa-r-numero').value = raw;
  }
  const sb = window.Auth.sb;
  const res = document.getElementById('btqa-r-result');
  res.innerHTML = '<p style="color:#888;font-size:13px;padding:20px;text-align:center">Recherche…</p>';

  // Détecter si c'est une URL de carte de fidélité (uid= ou id=)
  let data = null;
  let memberName = null;
  try {
    const url = new URL(raw);
    const uid = url.searchParams.get('uid');
    if (uid) {
      // Chercher toutes les commandes actives de ce membre
      const { data: profil } = await sb.from('profils').select('prenom, nom, email').eq('id', uid).maybeSingle();
      memberName = profil ? `${profil.prenom} ${profil.nom} (${profil.email})` : `Membre ${uid.slice(0,8)}…`;
      const { data: cmds } = await sb.from('boutique_commandes')
        .select('*, boutique_items(*)')
        .eq('membre_id', uid)
        .in('statut', ['en_attente', 'payee', 'confirmee', 'remise'])
        .order('created_at', { ascending: false });
      if (!cmds?.length) {
        res.innerHTML = `<p style="font-weight:600;margin:0 0 4px">${memberName}</p><p style="color:#888;font-size:13px">Aucune commande boutique en cours pour ce membre.</p>`;
        return;
      }
      if (cmds.length === 1) {
        data = cmds[0];
      } else {
        // Plusieurs commandes : afficher la liste pour choisir
        res.innerHTML = `
          <div style="background:#f8fafc;border-radius:8px;padding:8px 12px;margin-bottom:14px;font-size:12px;color:#6d28d9;font-weight:600">🪪 Carte : ${memberName}</div>
          <p style="font-size:13px;font-weight:700;margin:0 0 10px">${cmds.length} commandes trouvées - choisis :</p>
          ${cmds.map((c,i) => { _btqaListMemberNames = _btqaListMemberNames || {}; _btqaListMemberNames[c.id] = memberName; return `
            <button onclick="btqaLookupById('${c.id}')" style="width:100%;text-align:left;background:white;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px 14px;margin-bottom:8px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:10px">
              <span style="font-weight:700;color:var(--accent)">${c.numero}</span>
              <span class="btqa-badge ${c.statut}">${btqaStatutLabel(c.statut)}</span>
            </button>`;}).join('')}`;
        return;
      }
    }
  } catch {}

  // Sinon chercher par numéro de commande
  if (!data) {
    const num = raw.toUpperCase();
    const { data: found } = await sb.from('boutique_commandes')
      .select('*, boutique_items(*)')
      .eq('numero', num)
      .maybeSingle();
    data = found;
    if (!data) {
      res.innerHTML = `<p style="color:#dc2626;font-weight:600">Commande introuvable : ${num}</p>`;
      return;
    }
  }

  const items = data.boutique_items || [];
  items.forEach(i => { _btqaEditItems[i.id] = { ...i, _cmdId: data.id }; });
  const statutColors = { confirmee:'#d1fae5;color:#065f46', remise:'#e0e7ff;color:#3730a3', en_attente:'#fef3c7;color:#92400e', annulee:'#fee2e2;color:#991b1b' };
  const sc = statutColors[data.statut] || '#f3f4f6;color:#666';
  res.innerHTML = `
    ${memberName ? `<div style="background:#f8fafc;border-radius:8px;padding:8px 12px;margin-bottom:14px;font-size:12px;color:#6d28d9;font-weight:600">🪪 Carte : ${memberName}</div>` : ''}
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap">
      <span style="font-weight:800;font-size:20px;color:var(--violet)">${data.numero}</span>
      <span class="btqa-badge ${data.statut}">${btqaStatutLabel(data.statut)}</span>
    </div>
    <p style="margin:0 0 16px;font-size:14px;font-weight:600">${data.nom_acheteur}</p>
    <p style="margin:-12px 0 16px;font-size:12px;color:#888">${data.email_acheteur}</p>
    <div style="border-top:1.5px solid #eef2f7;padding-top:14px;margin-bottom:14px">
      ${items.map(i => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:#f8fafc;border-radius:10px;margin-bottom:6px;gap:8px">
        <div style="flex:1;min-width:0">
          <span style="font-weight:700;font-size:13px">${i.produit_nom}</span>
          <span style="font-size:12px;color:#888"> ${[i.design_nom,i.couleur,i.taille].filter(Boolean).join(' · ')}</span>
          <span style="font-size:12px;color:#555"> ×${i.quantite}</span>
          ${i.est_offert ? '<span style="background:#bbf7d0;color:#166534;font-size:10px;padding:1px 6px;border-radius:99px;font-weight:800;margin-left:4px">OFFERT</span>' : ''}
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          <span style="font-weight:700;font-size:13px;color:${i.est_offert ? '#16a34a' : '#2563eb'};white-space:nowrap">${i.est_offert ? '0,00 €' : btqaFmt(i.prix_unitaire_centimes * i.quantite)}</span>
          <button onclick="btqaOpenEditModal('${i.id}')" style="border:none;background:#f1f5f9;border-radius:7px;padding:4px 9px;cursor:pointer;font-size:11px;font-weight:700;color:var(--accent);flex-shrink:0">Modifier</button>
        </div>
      </div>`).join('')}
    </div>
    ${btqaAddItemBlock(data.id)}
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:linear-gradient(135deg,#f8fafc,var(--accent-lt));border-radius:12px;border:1px solid #eef2f7;margin-bottom:14px">
      <span style="font-weight:700;font-size:15px">Total</span>
      <span style="font-weight:800;font-size:20px;background:linear-gradient(135deg,var(--accent),var(--accent-h));-webkit-background-clip:text;background-clip:text;color:transparent">${btqaFmt(data.total_centimes)}</span>
    </div>
    ${btqaMailBlock(data)}
    ${['confirmee','payee'].includes(data.statut) ? `<button class="btn-save" style="width:100%;font-size:15px;padding:14px" onclick="btqaRemettreNum('${data.id}')">Confirmer la remise</button>` : ''}
    ${data.statut === 'remise' ? '<div style="text-align:center;padding:10px;background:#e0e7ff;border-radius:10px;color:#3730a3;font-weight:700;font-size:14px">Commande deja remise</div>' : ''}
    ${data.statut === 'en_attente' ? '<div style="text-align:center;padding:10px;background:#fef3c7;border-radius:10px;color:#92400e;font-weight:700;font-size:14px">Paiement pas encore confirme</div>' : ''}
  `;
}

// ── Ajouter un article à une commande existante (fiche Remise) ──
function btqaAddItemBlock(cmdId) {
  const inp = 'width:100%;padding:8px 10px;border:1.5px solid #e2e8f0;border-radius:9px;font-size:13px;box-sizing:border-box;background:white';
  const opts = (_btqaProduits || []).map(p => `<option value="${p.id}">${p.nom}</option>`).join('');
  return `
    <div style="margin-bottom:14px">
      <button onclick="document.getElementById('btqa-add-${cmdId}').hidden=!document.getElementById('btqa-add-${cmdId}').hidden" style="width:100%;padding:9px;border:1.5px dashed color-mix(in srgb,var(--accent) 28%,white);background:#f8fafc;border-radius:10px;font-size:13px;font-weight:700;color:var(--accent);cursor:pointer">+ Ajouter un article</button>
      <div id="btqa-add-${cmdId}" hidden style="margin-top:8px;padding:12px;background:#f8fafc;border:1.5px solid #e8eef6;border-radius:12px">
        <select id="btqa-add-prod-${cmdId}" onchange="btqaAddItemProdChange('${cmdId}')" style="${inp};margin-bottom:8px"><option value="">Choisir un produit…</option>${opts}</select>
        <input type="hidden" id="btqa-add-design-${cmdId}"><input type="hidden" id="btqa-add-couleur-${cmdId}"><input type="hidden" id="btqa-add-taille-${cmdId}">
        <div id="btqa-add-chips-${cmdId}"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          <input id="btqa-add-qte-${cmdId}" type="number" min="1" value="1" placeholder="Quantité" style="${inp}">
          <input id="btqa-add-prix-${cmdId}" type="number" min="0" step="0.01" placeholder="Prix € (selon produit)" style="${inp}">
        </div>
        <button onclick="btqaAddItemSave('${cmdId}')" style="width:100%;padding:10px;background:linear-gradient(135deg,var(--accent),var(--accent-h));color:white;border:none;border-radius:10px;font-size:13px;font-weight:800;cursor:pointer">Ajouter à la commande</button>
      </div>
    </div>`;
}
function btqaAddItemProdChange(cmdId) {
  const p = (_btqaProduits || []).find(x => x.id === document.getElementById('btqa-add-prod-' + cmdId).value);
  document.getElementById('btqa-add-prix-' + cmdId).value = p ? (p.prix_centimes / 100).toFixed(2) : '';
  ['design', 'couleur', 'taille'].forEach(k => { document.getElementById(`btqa-add-${k}-${cmdId}`).value = ''; });
  const wrap = document.getElementById('btqa-add-chips-' + cmdId);
  if (!p) { wrap.innerHTML = ''; return; }
  const esc = v => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const groups = [
    ['design', 'Design', (p.designs || []).map(d => d.nom)],
    ['couleur', 'Couleur', p.couleurs_disponibles || []],
    ['taille', 'Taille', p.tailles_disponibles || []],
  ];
  wrap.innerHTML = groups.filter(g => g[2].length).map(([k, label, vals]) => `
    <p style="margin:0 0 5px;font-size:11px;font-weight:800;color:#888;text-transform:uppercase;letter-spacing:1px">${label}</p>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">${vals.map(v =>
      `<button type="button" class="btqa-psel-btn" data-v="${esc(v)}" onclick="btqaAddPick('${cmdId}','${k}',this)">${esc(v)}</button>`).join('')}</div>`).join('');
  groups.forEach(([k, , vals]) => { if (vals.length === 1) wrap.querySelector(`[onclick*="'${k}'"]`)?.click(); });
}
function btqaAddPick(cmdId, k, btn) {
  document.getElementById(`btqa-add-${k}-${cmdId}`).value = btn.dataset.v;
  btn.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('selected', b === btn));
}
async function btqaAddItemSave(cmdId) {
  const g = k => document.getElementById(`btqa-add-${k}-${cmdId}`).value.trim();
  const p = (_btqaProduits || []).find(x => x.id === g('prod'));
  if (!p) return showToast('Choisis un produit', 'error');
  const qte = parseInt(g('qte')) || 1;
  const prix = Math.round(parseFloat(g('prix').replace(',', '.')) * 100);
  if (isNaN(prix) || prix < 0) return showToast('Prix invalide', 'error');
  const sb = window.Auth.sb;
  const { error } = await sb.from('boutique_items').insert({
    commande_id: cmdId, produit_id: p.id, produit_nom: p.nom,
    design_nom: g('design') || null, couleur: g('couleur') || null, taille: g('taille') || null,
    quantite: qte, prix_unitaire_centimes: prix, est_offert: false,
  });
  if (error) return showToast('Erreur : ' + error.message, 'error');
  // Recalcul du total à partir des articles (même règle que la boutique)
  const { data: items } = await sb.from('boutique_items').select('*').eq('commande_id', cmdId);
  const total = (items || []).filter(i => !i.est_offert || i.prix_unitaire_centimes < 0)
    .reduce((s, i) => s + i.prix_unitaire_centimes * i.quantite, 0);
  await sb.from('boutique_commandes').update({ total_centimes: total }).eq('id', cmdId);
  const c = _btqaCommandes?.find(x => x.id === cmdId);
  if (c) { c.boutique_items = items || []; c.total_centimes = total; }
  showToast('Article ajouté', 'success');
  await btqaLookupById(cmdId);
}

let _btqaListBackHTML = null;
let _btqaListMemberNames = {};
let _btqaEditItems = {};
let _btqaEditCurrent = { itemId: null, cmdId: null, origin: null };

function btqaSelectTaille(val) {
  document.getElementById('btqa-edit-item-taille').value = val;
  document.querySelectorAll('#btqa-edit-taille-btns button').forEach(b => {
    const active = b.dataset.taille === val;
    b.style.background = active ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : 'white';
    b.style.color = active ? 'white' : (b.dataset.taille === '' ? '#888' : '#333');
    b.style.borderColor = active ? 'transparent' : '#e2e8f0';
  });
}
function btqaSelectCouleur(val) {
  document.getElementById('btqa-edit-item-couleur').value = val;
  document.querySelectorAll('#btqa-edit-couleur-btns button').forEach(b => {
    const active = b.dataset.couleur === val;
    b.style.background = active ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : 'white';
    b.style.color = active ? 'white' : (b.dataset.couleur === '' ? '#888' : '#333');
    b.style.borderColor = active ? 'transparent' : '#e2e8f0';
  });
}
function btqaToggleCouleurIndispo(btn) {
  const block = btn.closest('.bp-design-couleur-block');
  const indispo = block.dataset.indispo !== 'true';
  block.dataset.indispo = indispo;
  block.style.background = indispo ? '#f9f9f9' : '#f1f5f9';
  block.style.border = `1px solid ${indispo ? '#e5e5e5' : '#e2e8f0'}`;
  block.style.opacity = indispo ? '0.5' : '1';
  btn.textContent = indispo ? 'Indispo' : 'Dispo';
  btn.style.background = indispo ? '#fef3c7' : '#d1fae5';
  btn.style.color = indispo ? '#92400e' : '#065f46';
  btn.style.borderColor = indispo ? '#fcd34d' : '#6ee7b7';
  const label = block.querySelector('span');
  if (label) label.style.color = indispo ? '#999' : '#2563eb';
}
function btqaToggleDesignActif(btn) {
  const row = btn.closest('.bp-design-row');
  const actif = row.dataset.actif !== 'false';
  const newActif = !actif;
  row.dataset.actif = newActif;
  btn.textContent = newActif ? 'Dispo' : 'Indispo';
  btn.style.background = newActif ? '#d1fae5' : '#fef3c7';
  btn.style.color = newActif ? '#065f46' : '#92400e';
  btn.style.borderColor = newActif ? '#6ee7b7' : '#fcd34d';
  row.style.opacity = newActif ? '1' : '0.55';
}
function btqaToggleProduitEdit() {
  const fields = document.getElementById('btqa-edit-produit-fields');
  const btn = document.getElementById('btqa-edit-produit-toggle-btn');
  const hidden = fields.hidden;
  if (hidden) {
    // Rendre la liste des produits
    const list = document.getElementById('btqa-edit-prod-list');
    list.innerHTML = (_btqaProduits || []).map(p =>
      `<button onclick="btqaEditSelectProduit('${p.id}')" data-prod-id="${p.id}"
        style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-radius:10px;border:1.5px solid #e2e8f0;background:white;font-size:13px;font-weight:600;cursor:pointer;color:#333;text-align:left;width:100%;transition:all .15s">
        <span>${p.nom}</span>
        <span style="color:var(--accent);font-weight:700">${btqaFmt(p.prix_centimes)}</span>
      </button>`
    ).join('');
    document.getElementById('btqa-edit-prod-step2').hidden = true;
    document.getElementById('btqa-edit-prod-prix-row').hidden = true;
    document.getElementById('btqa-edit-item-produit-nom').value = '';
    document.getElementById('btqa-edit-item-design-nom').value = '';
    document.getElementById('btqa-edit-item-prix').value = '';
  }
  fields.hidden = !hidden;
  btn.textContent = hidden ? 'Annuler' : 'Changer';
  btn.style.background = hidden ? '#fee2e2' : '#e8eef6';
  btn.style.color = hidden ? '#991b1b' : '#2563eb';
}
function btqaEditSelectProduit(prodId) {
  const p = (_btqaProduits || []).find(x => x.id === prodId);
  if (!p) return;
  document.querySelectorAll('#btqa-edit-prod-list button').forEach(b => {
    const active = b.dataset.prodId === prodId;
    b.style.background = active ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : 'white';
    b.style.color = active ? 'white' : '#333';
    b.style.borderColor = active ? 'transparent' : '#e2e8f0';
  });
  document.getElementById('btqa-edit-item-produit-nom').value = p.nom;
  document.getElementById('btqa-edit-item-prix').value = p.prix_centimes;
  document.getElementById('btqa-edit-item-design-nom').value = '';
  const designs = (p.designs || []).filter(d => d.actif !== false);
  const step2 = document.getElementById('btqa-edit-prod-step2');
  if (designs.length > 0) {
    document.getElementById('btqa-edit-design-list').innerHTML = designs.map(d =>
      `<button onclick="btqaEditSelectDesign('${d.nom.replace(/'/g,"\\'")}',${p.prix_centimes})" data-design-nom="${d.nom}"
        style="padding:7px 14px;border-radius:10px;border:1.5px solid #e2e8f0;background:white;font-size:12px;font-weight:700;cursor:pointer;color:#333;transition:all .15s">
        ${d.nom}
      </button>`
    ).join('');
    step2.hidden = false;
    btqaEditSelectDesign(designs[0].nom, p.prix_centimes);
  } else {
    step2.hidden = true;
    btqaEditShowPrixRow(p.nom, null, p.prix_centimes);
  }
}
function btqaEditSelectDesign(designNom, prix) {
  document.querySelectorAll('#btqa-edit-design-list button').forEach(b => {
    const active = b.dataset.designNom === designNom;
    b.style.background = active ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : 'white';
    b.style.color = active ? 'white' : '#333';
    b.style.borderColor = active ? 'transparent' : '#e2e8f0';
  });
  document.getElementById('btqa-edit-item-design-nom').value = designNom;
  const prodNom = document.getElementById('btqa-edit-item-produit-nom').value;
  const p = parseInt(prix || document.getElementById('btqa-edit-item-prix').value);
  btqaEditShowPrixRow(prodNom, designNom, p);
}
function btqaEditShowPrixRow(prodNom, designNom, prix) {
  const row = document.getElementById('btqa-edit-prod-prix-row');
  row.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#f8fafc;border-radius:10px;border:1px solid #e8eef6;margin-top:4px">
    <span style="font-size:12px;font-weight:700;color:var(--accent)">${prodNom}${designNom ? ' — ' + designNom : ''}</span>
    <span style="font-size:14px;font-weight:800;color:var(--accent-h)">${btqaFmt(prix)}</span>
  </div>`;
  row.hidden = false;
}
function btqaOpenEditModal(itemId) {
  const item = _btqaEditItems[itemId];
  if (!item) return;
  _btqaEditCurrent = { itemId, cmdId: item._cmdId, origin: item._origin || 'remise' };
  document.getElementById('btqa-edit-item-nom').textContent = item.produit_nom + (item.design_nom ? ' - ' + item.design_nom : '');
  document.getElementById('btqa-edit-produit-fields').hidden = true;
  document.getElementById('btqa-edit-produit-toggle-btn').textContent = 'Changer';
  document.getElementById('btqa-edit-produit-toggle-btn').style.background = '#e8eef6';
  document.getElementById('btqa-edit-produit-toggle-btn').style.color = '#2563eb';
  document.getElementById('btqa-edit-item-produit-nom').value = '';
  document.getElementById('btqa-edit-item-design-nom').value = '';
  document.getElementById('btqa-edit-item-prix').value = '';
  btqaSelectTaille(item.taille || '');
  btqaSelectCouleur(item.couleur || '');
  document.getElementById('btqa-edit-item-qty').value = item.quantite || 1;
  document.getElementById('btqa-edit-confirm-step').hidden = true;
  document.getElementById('btqa-edit-action-step').hidden = false;
  document.getElementById('btqa-edit-confirm-btns').hidden = true;
  document.getElementById('btqa-edit-item-modal').classList.add('open');
}
function btqaCloseEditModal() {
  document.getElementById('btqa-edit-item-modal').classList.remove('open');
}
function btqaAskConfirmEdit() {
  const taille = document.getElementById('btqa-edit-item-taille').value;
  const couleur = document.getElementById('btqa-edit-item-couleur').value.trim();
  const qty = parseInt(document.getElementById('btqa-edit-item-qty').value) || 1;
  const parts = [];
  parts.push(taille ? `Taille : ${taille}` : 'Taille : —');
  if (couleur) parts.push(`Couleur : ${couleur}`);
  parts.push(`Qte : ${qty}`);
  document.getElementById('btqa-edit-confirm-text').textContent = parts.join(' · ');
  document.getElementById('btqa-edit-confirm-step').hidden = false;
  document.getElementById('btqa-edit-action-step').hidden = true;
  document.getElementById('btqa-edit-confirm-btns').hidden = false;
}
function btqaBackToEdit() {
  document.getElementById('btqa-edit-confirm-step').hidden = true;
  document.getElementById('btqa-edit-action-step').hidden = false;
  document.getElementById('btqa-edit-confirm-btns').hidden = true;
}
async function btqaDoSaveEdit() {
  const { itemId, cmdId, origin } = _btqaEditCurrent;
  const taille = document.getElementById('btqa-edit-item-taille').value || null;
  const couleur = document.getElementById('btqa-edit-item-couleur').value.trim() || null;
  const quantite = parseInt(document.getElementById('btqa-edit-item-qty').value) || 1;
  const produitEdite = !document.getElementById('btqa-edit-produit-fields').hidden;
  const updatePayload = { taille, couleur, quantite };
  if (produitEdite) {
    const produit_nom = document.getElementById('btqa-edit-item-produit-nom').value;
    const design_nom = document.getElementById('btqa-edit-item-design-nom').value || null;
    const prix_unitaire_centimes = parseInt(document.getElementById('btqa-edit-item-prix').value) || null;
    if (!produit_nom || !prix_unitaire_centimes) { showToast('Sélectionne un produit', 'error'); return; }
    updatePayload.produit_nom = produit_nom;
    updatePayload.design_nom = design_nom;
    updatePayload.prix_unitaire_centimes = prix_unitaire_centimes;
  }
  const sb = window.Auth.sb;
  const { error } = await sb.from('boutique_items').update(updatePayload).eq('id', itemId);
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  if (produitEdite) {
    const { data: items } = await sb.from('boutique_items').select('*').eq('commande_id', cmdId);
    const total = (items || []).filter(i => !i.est_offert || i.prix_unitaire_centimes < 0)
      .reduce((s, i) => s + i.prix_unitaire_centimes * i.quantite, 0);
    await sb.from('boutique_commandes').update({ total_centimes: total }).eq('id', cmdId);
    const c = _btqaCommandes?.find(x => x.id === cmdId);
    if (c) { c.boutique_items = items || []; c.total_centimes = total; }
  } else {
    // Mettre à jour le cache local
    const c = _btqaCommandes?.find(x => x.id === cmdId);
    if (c?.boutique_items) {
      const it = c.boutique_items.find(x => x.id === itemId);
      if (it) { it.taille = taille; it.couleur = couleur; it.quantite = quantite; }
    }
  }
  btqaCloseEditModal();
  showToast('Article modifie avec succes', 'success');
  if (origin === 'detail') {
    btqaShowDetail(cmdId);
  } else {
    await btqaLookupById(cmdId);
  }
}
async function btqaLookupById(id) {
  const memberName = _btqaListMemberNames?.[id] || null;
  const sb = window.Auth.sb;
  const res = document.getElementById('btqa-r-result');
  // Sauvegarder la liste pour pouvoir y revenir
  _btqaListBackHTML = res.innerHTML;
  res.innerHTML = '<p style="color:#888;font-size:13px;padding:20px;text-align:center">Chargement…</p>';
  const { data } = await sb.from('boutique_commandes').select('*, boutique_items(*)').eq('id', id).maybeSingle();
  if (!data) return showToast('Commande introuvable', 'error');
  document.getElementById('btqa-r-numero').value = data.numero;
  // Réutiliser le rendu de btqaLookup en injectant directement
  const items = data.boutique_items || [];
  items.forEach(i => { _btqaEditItems[i.id] = { ...i, _cmdId: id }; });
  res.innerHTML = `
    ${memberName ? `<div style="background:#f8fafc;border-radius:8px;padding:8px 12px;margin-bottom:14px;font-size:12px;color:#6d28d9;font-weight:600">🪪 Carte : ${memberName}</div>` : ''}
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap">
      <span style="font-weight:800;font-size:20px;color:var(--violet)">${data.numero}</span>
      <span class="btqa-badge ${data.statut}">${btqaStatutLabel(data.statut)}</span>
    </div>
    <p style="margin:0 0 16px;font-size:14px;font-weight:600">${data.nom_acheteur}</p>
    <p style="margin:-12px 0 16px;font-size:12px;color:#888">${data.email_acheteur || ''}</p>
    <div style="border-top:1.5px solid #eef2f7;padding-top:14px;margin-bottom:14px">
      ${items.map(i => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:#f8fafc;border-radius:10px;margin-bottom:6px;gap:8px">
        <div style="flex:1;min-width:0">
          <span style="font-weight:700;font-size:13px">${i.produit_nom}</span>
          <span style="font-size:12px;color:#888"> ${[i.design_nom,i.couleur,i.taille].filter(Boolean).join(' · ')}</span>
          <span style="font-size:12px;color:#555"> ×${i.quantite}</span>
          ${i.est_offert ? '<span style="background:#bbf7d0;color:#166534;font-size:10px;padding:1px 6px;border-radius:99px;font-weight:800;margin-left:4px">OFFERT</span>' : ''}
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          <span style="font-weight:700;font-size:13px;color:${i.est_offert ? '#16a34a' : '#2563eb'};white-space:nowrap">${i.est_offert ? '0,00 €' : btqaFmt(i.prix_unitaire_centimes * i.quantite)}</span>
          <button onclick="btqaOpenEditModal('${i.id}')" style="border:none;background:#f1f5f9;border-radius:7px;padding:4px 9px;cursor:pointer;font-size:11px;font-weight:700;color:var(--accent);flex-shrink:0">Modifier</button>
        </div>
      </div>`).join('')}
    </div>
    ${btqaAddItemBlock(data.id)}
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:linear-gradient(135deg,#f8fafc,var(--accent-lt));border-radius:12px;border:1px solid #eef2f7;margin-bottom:14px">
      <span style="font-weight:700;font-size:15px">Total</span>
      <span style="font-weight:800;font-size:20px;background:linear-gradient(135deg,var(--accent),var(--accent-h));-webkit-background-clip:text;background-clip:text;color:transparent">${btqaFmt(data.total_centimes)}</span>
    </div>
    ${btqaMailBlock(data)}
    ${['confirmee','payee'].includes(data.statut) ? `<button class="btn-save" style="width:100%;font-size:15px;padding:14px" onclick="btqaRemettreNum('${data.id}')">Confirmer la remise</button>` : ''}
    ${data.statut === 'remise' ? '<div style="text-align:center;padding:10px;background:#e0e7ff;border-radius:10px;color:#3730a3;font-weight:700;font-size:14px">Commande deja remise</div>' : ''}
    ${data.statut === 'en_attente' ? '<div style="text-align:center;padding:10px;background:#fef3c7;border-radius:10px;color:#92400e;font-weight:700;font-size:14px">Paiement pas encore confirme</div>' : ''}
    <button onclick="if(_btqaListBackHTML){document.getElementById('btqa-r-result').innerHTML=_btqaListBackHTML;_btqaListBackHTML=null}" style="margin-top:12px;width:100%;padding:10px;background:white;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;font-weight:600;color:#666;cursor:pointer">← Retour à la liste</button>
  `;
}
async function btqaRemettreNum(id) {
  await btqaRemettre(id);
  document.getElementById('btqa-r-numero').value = '';
  document.getElementById('btqa-r-result').innerHTML = `
    <div style="text-align:center;padding:48px 20px">
      <div style="font-size:52px;margin-bottom:12px">✅</div>
      <p style="font-weight:800;font-size:18px;color:#065f46;margin:0 0 6px">Remise confirmée !</p>
      <p style="font-size:13px;color:#888;margin:0">La commande a bien été marquée comme remise.</p>
    </div>`;
}

// ── Config produits ──────────────────────────────────────────
async function btqaRenderConfigProduits() {
  const sb = window.Auth.sb;
  const [{ data: prods }, { data: packs, error: packsErr }] = await Promise.all([
    sb.from('boutique_produits').select('*').order('ordre'),
    sb.from('boutique_packs').select('*')
  ]);
  _btqaProduits = prods || [];
  if (packsErr) console.warn('[boutique_packs] fetch error:', packsErr);
  window._btqaAllPacks = packs || [];

  // ── Produits grid ──
  const el = document.getElementById('btqa-config-produits');
  if (!prods?.length) { el.innerHTML = '<p style="color:#bbb">Aucun produit configuré.</p>'; }
  else {
    el.innerHTML = `<div class="btqa-prod-grid" id="btqa-prod-grid-inner">${prods.map(p => {
      const icon = {T:'👕','Pull sans capuche':'🧥','Pull à capuche':'🧣','T-shirt Club de Sport':'👕',Chaussettes:'🧦',Tasse:'☕','Porte-clef':'🔑'}[p.nom] || (p.categorie==='vetement'?'👕':'🎁');
      const meta = [p.a_designs?`${(p.designs||[]).length} designs`:null, p.couleurs_disponibles?.length?`${p.couleurs_disponibles.length} couleurs`:null, p.a_tailles?'Tailles':null, p.actif?null:'Inactif'].filter(Boolean).join(' · ');
      return `<div class="btqa-prod-card" draggable="true" data-id="${p.id}">
        <div class="btqa-prod-card-img">
          <span class="btqa-prod-drag-handle">⠿</span>
          ${p.image_url ? `<img src="${btqaToRawGhUrl(p.image_url)}" alt="${p.nom}">` : `<span class="btqa-prod-card-icon">${icon}</span>`}
          <div class="btqa-prod-card-status" style="background:${p.actif?'#10b981':'#ef4444'}"></div>
          <div class="btqa-prod-card-price-badge">${btqaFmt(p.prix_centimes)}</div>
        </div>
        <div class="btqa-prod-card-body">
          <div class="btqa-prod-card-name">${p.nom}</div>
          <div class="btqa-prod-card-meta">${meta||'Accessoire'}</div>
          <div class="btqa-prod-card-actions">
            <button class="btqa-prod-card-btn edit" onclick="btqaOpenProduit('${p.id}')">Modifier</button>
            <button class="btqa-prod-card-btn" onclick="btqaToggleActifProduit('${p.id}',${!!p.actif})" style="background:${p.actif?'#fef3c7':'#d1fae5'};color:${p.actif?'#92400e':'#065f46'};border:1.5px solid ${p.actif?'#fcd34d':'#6ee7b7'}">${p.actif?'Désactiver':'Activer'}</button>
            <button class="btqa-prod-card-btn toggle-off" onclick="btqaDeleteProduit('${p.id}')">Supprimer</button>
          </div>
        </div>
      </div>`;
    }).join('')}</div>`;
    btqaInitDrag();
  }

  // ── Packs cards ──
  const pel = document.getElementById('btqa-config-packs');
  if (!pel) return;
  if (!packs?.length) { pel.innerHTML = '<p style="color:#bbb">Aucun pack configuré.</p>'; return; }
  pel.innerHTML = `<div class="btqa-pack-grid">${packs.map(pk => {
    const conds = Array.isArray(pk.conditions) ? pk.conditions : [];
    const achatConds = conds.filter(c => c.type === 'achat' || (!c.type && (c.produit_id || c.produit_ids)));
    const offreEntry = conds.find(c => c.type === 'offre');
    const remiseEntry = conds.find(c => c.type === 'remise');
    const offreIds   = offreEntry?.produit_ids || (pk.offre_produit_id ? [pk.offre_produit_id] : []);
    const offreNoms  = offreIds.map(id => (_btqaProduits||[]).find(p=>p.id===id)?.nom || '?').join(' ou ');
    const condText = achatConds.map(c => {
      const ids = c.produit_ids || (c.produit_id ? [c.produit_id] : []);
      const noms = ids.map(id => (_btqaProduits||[]).find(p=>p.id===id)?.nom || '?').join(' ou ');
      return noms + (c.min_qty>1 ? ` x${c.min_qty}` : '');
    }).join(' + ');
    return `<div class="btqa-pack-card">
      <span class="btqa-pack-badge">${pk.actif?'ACTIF':'INACTIF'}</span>
      <div class="btqa-pack-card-title">${pk.nom}</div>
      <div class="btqa-pack-card-desc">${pk.description||''}</div>
      <div style="font-size:12px;color:#555;margin-bottom:10px">
        <strong>Requis :</strong> ${condText||'-'}
      </div>
      <div class="btqa-pack-offer">
        ${remiseEntry
          ? `🏷️ <span style="color:#d97706;font-weight:700">−${remiseEntry.unite==='pct' ? `${remiseEntry.valeur}%` : btqaFmt(remiseEntry.montant_centimes)}${remiseEntry.produit_ids?.length ? ` sur ${remiseEntry.produit_ids.map(id=>(_btqaProduits||[]).find(p=>p.id===id)?.nom||'?').join(', ')}` : ' sur la commande'}</span>`
          : `🎁 <span>${pk.offre_qty||1}x ${offreNoms||'?'} offert</span>`}
      </div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btqa-act-btn detail" onclick="btqaOpenPack('${pk.id}')">Modifier</button>
        <button class="btqa-act-btn ${pk.actif?'cancel':'confirm'}" onclick="btqaTogglePack('${pk.id}',${!pk.actif})">${pk.actif?'Désactiver':'Activer'}</button>
      </div>
    </div>`;
  }).join('')}</div>`;
}

// ── Helpers designs inline ───────────────────────────────────
function btqaToRawGhUrl(url) {
  if (!url) return url;
  if (url.includes('bdecreadien.fr/images/')) return url.replace('https://bdecreadien.fr/', `https://raw.githubusercontent.com/${REPO}/main/`);
  return url;
}
function btqaImgPickerHtml(idx, cKey, colorName, side, url, label) {
  const id = `dp-${idx}-${cKey}-${side}`;
  const previewUrl = btqaToRawGhUrl(url);
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:3px">
    <div style="font-size:10px;color:#666;font-weight:600">${label}</div>
    <div class="btqa-img-picker">
      <div class="btqa-img-preview-wrap" id="${id}-w" style="${url ? '' : 'display:none'}">
        <img src="${previewUrl}" id="${id}-img" class="btqa-img-preview-img" onerror="if(this.src.includes('raw.githubusercontent'))this.src='${url}'">
        <button type="button" class="btqa-img-clear" onclick="btqaClearImg('${id}-v','${id}-w')">✕</button>
      </div>
      <input type="hidden" id="${id}-v" value="${url}" data-color-name="${colorName.replace(/"/g,'&quot;')}" data-side="${side}">
      <label class="btqa-img-btn" for="${id}-file" id="${id}-lbl" style="padding:5px 8px;font-size:10px">${url ? '📷 Changer' : '📷 Photo'}</label>
      <input type="file" id="${id}-file" accept="image/*" style="display:none"
             onchange="btqaUploadImg(this,'${id}-v','${id}-img','${id}-w','${id}-lbl')">
    </div>
  </div>`;
}

function btqaDesignRowHtml(idx, nom, designImages, couleurs, actif, couleursIndispo) {
  // designImages = { "Blanc": { front: url, dos: url }, ... }  (new structure)
  // couleurs = ["Blanc", "Noir", ...] - if empty, show no image fields (added later when colors are set)
  // couleursIndispo = ["Bleu", ...] - couleurs désactivées pour ce design
  const indispo = Array.isArray(couleursIndispo) ? couleursIndispo : [];
  const colorsHtml = (couleurs || []).map(c => {
    const cKey = c.replace(/[^a-zA-Z0-9]/g, '_');
    const existing = (designImages || {})[c] || {};
    const cIndispo = indispo.includes(c);
    return `<div class="bp-design-couleur-block" data-couleur="${c}" data-indispo="${cIndispo}" style="margin-top:8px;padding:8px 10px;border-radius:8px;background:${cIndispo?'#f9f9f9':'#f1f5f9'};border:1px solid ${cIndispo?'#e5e5e5':'#e2e8f0'};opacity:${cIndispo?'0.5':'1'}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:11px;font-weight:700;color:${cIndispo?'#999':'#2563eb'};text-transform:uppercase;letter-spacing:.4px">${c}</span>
        <button type="button" onclick="btqaToggleCouleurIndispo(this)" data-couleur="${c}"
          style="padding:2px 8px;border-radius:20px;border:1.5px solid ${cIndispo?'#fcd34d':'#6ee7b7'};background:${cIndispo?'#fef3c7':'#d1fae5'};color:${cIndispo?'#92400e':'#065f46'};cursor:pointer;font-size:10px;font-weight:700;white-space:nowrap">${cIndispo?'Indispo':'Dispo'}</button>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        ${btqaImgPickerHtml(idx, cKey, c, 'front', existing.front || '', 'Devant')}
        ${btqaImgPickerHtml(idx, cKey, c, 'dos', existing.dos || '', 'Dos')}
      </div>
    </div>`;
  }).join('');

  const isActif = actif !== false;
  return `<div class="bp-design-row" data-idx="${idx}" data-actif="${isActif}" style="padding:12px;border-radius:12px;border:1.5px solid #eee;background:#fafafa;opacity:${isActif?'1':'0.55'}">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:${(couleurs||[]).length ? '4px' : '0'}">
      <input type="text" class="bp-design-nom" placeholder="Nom du design (ex: Design 1)" value="${nom}"
        style="flex:1;padding:8px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;outline:none">
      <button type="button" class="bp-design-toggle-btn" onclick="btqaToggleDesignActif(this)"
        style="flex-shrink:0;padding:4px 10px;border-radius:20px;border:1.5px solid ${isActif?'#6ee7b7':'#fcd34d'};background:${isActif?'#d1fae5':'#fef3c7'};color:${isActif?'#065f46':'#92400e'};cursor:pointer;font-size:11px;font-weight:700;white-space:nowrap">${isActif?'Dispo':'Indispo'}</button>
      <button type="button" onclick="this.closest('.bp-design-row').remove()"
        style="flex-shrink:0;width:28px;height:28px;border-radius:50%;border:none;background:#fee2e2;color:#ef4444;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center">✕</button>
    </div>
    ${colorsHtml}
  </div>`;
}

function btqaAddDesignRow() {
  const list = document.getElementById('bp-designs-list');
  if (!list) return;
  const idx = Date.now();
  const couleurs = document.getElementById('bp-couleurs')?.value.split(',').map(s => s.trim()).filter(Boolean) || [];
  const div = document.createElement('div');
  div.innerHTML = btqaDesignRowHtml(idx, '', {}, couleurs);
  list.appendChild(div.firstElementChild);
}

function btqaGalleryRowHtml(idx, imageUrl) {
  const previewUrl = btqaToRawGhUrl(imageUrl);
  return `<div class="bp-gallery-row" data-idx="${idx}" style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:12px;border:1.5px solid #eee;background:#fafafa">
    <div class="btqa-img-picker" style="flex-shrink:0">
      <div class="btqa-img-preview-wrap" id="gp-w-${idx}" style="${imageUrl ? '' : 'display:none'}">
        <img src="${previewUrl}" id="gp-img-${idx}" class="btqa-img-preview-img" onerror="if(this.src.includes('raw.githubusercontent'))this.src='${imageUrl}'">
        <button type="button" class="btqa-img-clear" onclick="btqaClearImg('bp-gimg-${idx}','gp-w-${idx}')">✕</button>
      </div>
      <input type="hidden" id="bp-gimg-${idx}" value="${imageUrl}">
      <label class="btqa-img-btn" for="gp-file-${idx}" id="gp-lbl-${idx}" style="padding:6px 10px;font-size:11px">${imageUrl ? '📷 Changer' : '📷 Ajouter une photo'}</label>
      <input type="file" id="gp-file-${idx}" accept="image/*" style="display:none"
             onchange="btqaUploadImg(this,'bp-gimg-${idx}','gp-img-${idx}','gp-w-${idx}','gp-lbl-${idx}')">
    </div>
    <span style="flex:1;font-size:13px;color:#888">${imageUrl ? 'Photo ajoutée' : 'Aucune photo'}</span>
    <button type="button" onclick="this.closest('.bp-gallery-row').remove()"
      style="flex-shrink:0;width:28px;height:28px;border-radius:50%;border:none;background:#fee2e2;color:#ef4444;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center">✕</button>
  </div>`;
}

function btqaOptionRowHtml(idx, nom, prix_centimes, remise_centimes) {
  return `<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px;background:#f8fafc;border-radius:10px;border:1px solid color-mix(in srgb,var(--accent) 16%,white)" data-opt-idx="${idx}">
    <input class="bp-opt-nom" placeholder="Nom (ex: Adhésion club de sport)" value="${nom || ''}"
      style="flex:2;min-width:160px;padding:8px 10px;border:1.5px solid color-mix(in srgb,var(--accent) 16%,white);border-radius:8px;font-size:13px">
    <div style="display:flex;align-items:center;gap:6px">
      <span style="font-size:11px;color:#888;white-space:nowrap">Prix +</span>
      <input class="bp-opt-prix" type="number" step="0.01" min="0" placeholder="0.00" value="${prix_centimes ? (prix_centimes/100).toFixed(2) : ''}"
        style="width:75px;padding:8px 10px;border:1.5px solid color-mix(in srgb,var(--accent) 16%,white);border-radius:8px;font-size:13px">
      <span style="font-size:11px;color:#888">€</span>
    </div>
    <div style="display:flex;align-items:center;gap:6px">
      <span style="font-size:11px;color:#888;white-space:nowrap">Remise −</span>
      <input class="bp-opt-remise" type="number" step="0.01" min="0" placeholder="0.00" value="${remise_centimes ? (remise_centimes/100).toFixed(2) : ''}"
        style="width:75px;padding:8px 10px;border:1.5px solid color-mix(in srgb,var(--accent) 16%,white);border-radius:8px;font-size:13px">
      <span style="font-size:11px;color:#888">€</span>
    </div>
    <button type="button" onclick="this.closest('[data-opt-idx]').remove()"
      style="border:none;background:#fef2f2;color:#ef4444;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:14px">✕</button>
  </div>`;
}

function btqaAddOptionRow() {
  const list = document.getElementById('bp-options-list');
  if (!list) return;
  const idx = Date.now();
  const div = document.createElement('div');
  div.innerHTML = btqaOptionRowHtml(idx, '', 0);
  list.appendChild(div.firstElementChild);
}

function btqaAddGalleryRow() {
  const list = document.getElementById('bp-gallery-list');
  if (!list) return;
  const idx = Date.now();
  const div = document.createElement('div');
  div.innerHTML = btqaGalleryRowHtml(idx, '');
  list.appendChild(div.firstElementChild);
}

// ── Upload image vers Cloudflare R2 via Pages Function ──
async function btqaUploadImg(inputEl, hiddenId, previewImgId, previewWrapId, lblId) {
  const file = inputEl.files?.[0];
  if (!file) return;
  const lbl = document.getElementById(lblId);
  if (lbl) { lbl.textContent = '⏳ Upload…'; lbl.classList.add('btqa-img-uploading'); }
  try {
    const webp = window.imageToWebp ? await window.imageToWebp(file, { maxWidth: 1200, quality: 0.85 }) : file;
    const ext  = webp.type === 'image/webp' ? 'webp' : (file.name.split('.').pop() || 'jpg').toLowerCase();
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2,7)}.${ext}`;

    // Preview instantanée via data URL
    const dataUrl = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = e => res(e.target.result);
      r.onerror = rej;
      r.readAsDataURL(webp);
    });
    const imgEl = document.getElementById(previewImgId);
    imgEl.src = dataUrl;
    document.getElementById(previewWrapId).style.display = '';

    // Upload vers R2
    const form = new FormData();
    form.append('file', webp, filename);
    form.append('filename', filename);
    const res = await fetch('/api/upload-image', {
      method: 'POST',
      headers: { 'x-upload-secret': uploadSecret },
      body: form,
    });
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || `HTTP ${res.status}`); }
    const { url } = await res.json();
    document.getElementById(hiddenId).value = url;
    showToast('Photo uploadée !', 'success');
  } catch(e) {
    showToast('Erreur upload : ' + e.message, 'error');
  } finally {
    if (lbl) { lbl.textContent = '📷 Changer'; lbl.classList.remove('btqa-img-uploading'); }
    inputEl.value = '';
  }
}

function btqaClearImg(hiddenId, wrapId) {
  document.getElementById(hiddenId).value = '';
  document.getElementById(wrapId).style.display = 'none';
}

async function btqaToggleProduit(id, actif) {
  await window.Auth.sb.from('boutique_produits').update({ actif }).eq('id', id);
  btqaRenderConfigProduits();
  showToast(actif ? 'Produit activé' : 'Produit désactivé');
}

async function btqaToggleActifProduit(id, actuel) {
  const sb = window.Auth.sb;
  const { error } = await sb.from('boutique_produits').update({ actif: !actuel }).eq('id', id);
  if (error) return showToast('Erreur : ' + error.message, 'error');
  showToast(actuel ? 'Produit désactivé — grisé sur la boutique' : 'Produit activé', 'success');
  btqaRenderConfigProduits();
}
async function btqaDeleteProduit(id) {
  if (!confirm('Supprimer ce produit ? Cette action est irréversible.')) return;
  const sb = window.Auth.sb;
  // Récupérer les URLs d'images avant suppression
  const { data: prod } = await sb.from('boutique_produits').select('image_url,images,designs').eq('id', id).single();
  // Refuser si le produit figure dans une commande déjà validée (sinon ses lignes disparaissent)
  const { data: lies } = await sb.from('boutique_items')
    .select('id, boutique_commandes!inner(statut)')
    .eq('produit_id', id)
    .neq('boutique_commandes.statut', 'panier')
    .limit(1);
  if (lies && lies.length) {
    showToast('Impossible : ce produit est dans des commandes validées. Désactive-le plutôt.', 'error');
    return;
  }
  // Supprimer les items de paniers liés (FK)
  await sb.from('boutique_items').delete().eq('produit_id', id);
  const { error } = await sb.from('boutique_produits').delete().eq('id', id);
  if (error) { showToast('Erreur : ' + error.message, 'error'); console.error(error); return; }
  // Supprimer les fichiers Storage et GitHub associés
  if (prod) {
    const urls = [];
    if (prod.image_url) urls.push(prod.image_url);
    (prod.images || []).forEach(i => i.url && urls.push(i.url));
    Object.values(prod.designs || []).forEach(d => Object.values(d.images || {}).forEach(side => Object.values(side || {}).forEach(u => u && urls.push(u))));
    // Supabase Storage
    const sbPaths = urls.map(u => { try { const p = new URL(u).pathname; const m = p.match(/\/object\/public\/annonces\/(.+)/); return m?.[1] || null; } catch { return null; } }).filter(Boolean);
    if (sbPaths.length) sb.storage.from('annonces').remove(sbPaths).catch(() => {});
    // GitHub (images/boutique/)
    urls.filter(u => u && u.includes('bdecreadien.fr/images/')).forEach(u => btqaDeleteGhImage(u).catch(() => {}));
  }
  btqaRenderConfigProduits();
  showToast('Produit supprimé');
}

// Supprime une image GitHub depuis son URL bdecreadien.fr ou raw.githubusercontent.com
async function btqaDeleteGhImage(url) {
  if (!url || (!url.includes('bdecreadien.fr/images/') && !url.includes('raw.githubusercontent.com'))) return;
  try {
    let path;
    if (url.includes('raw.githubusercontent.com')) {
      // https://raw.githubusercontent.com/BDEcreadien/bdecreadien/main/images/boutique/xxx.webp
      const m = url.match(/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\/(.+)/);
      if (!m) return;
      path = m[1];
    } else {
      path = new URL(url).pathname.slice(1); // ex: images/boutique/xxx.webp
    }
    const fileRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, { headers: { Authorization: `token ${token}` } });
    if (!fileRes.ok) return;
    const { sha } = await fileRes.json();
    await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
      method: 'DELETE', headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `suppression image : ${path.split('/').pop()}`, sha, branch: BRANCH })
    });
  } catch (_) {}
}

async function btqaCleanOrphanImages() {
  const sb = window.Auth.sb;
  showToast('Analyse en cours…', 'info');
  try {
    // 1. Récupérer toutes les URLs référencées en base
    const [{ data: prods }, { data: designs }, { data: liens }] = await Promise.all([
      sb.from('boutique_produits').select('image_url,images,designs'),
      sb.from('boutique_designs').select('image_url'),
      sb.from('liens').select('image_url'),
    ]);
    const usedUrls = new Set();
    const addUrl = u => { if (u && typeof u === 'string' && u.includes('annonces')) usedUrls.add(u); };
    (prods || []).forEach(p => {
      addUrl(p.image_url);
      (p.images || []).forEach(i => addUrl(i.url));
      (p.designs || []).forEach(d => Object.values(d.images || {}).forEach(side => Object.values(side || {}).forEach(addUrl)));
    });
    (designs || []).forEach(d => addUrl(d.image_url));
    (liens || []).forEach(l => addUrl(l.image_url));

    // 2. Lister tous les fichiers du bucket annonces (récursif sur dossiers utilisateurs)
    const { data: { user } } = await sb.auth.getUser();
    const allPaths = [];
    const listFolder = async (prefix) => {
      const { data: files } = await sb.storage.from('annonces').list(prefix, { limit: 1000 });
      for (const f of (files || [])) {
        if (f.id === null) { await listFolder(prefix ? prefix + '/' + f.name : f.name); }
        else { allPaths.push(prefix ? prefix + '/' + f.name : f.name); }
      }
    };
    await listFolder('');

    // 3. Identifier les orphelins : fichiers Storage dont l'URL complète n'est dans aucune table
    const baseUrl = sb.storageUrl || sb.supabaseUrl + '/storage/v1';
    const orphans = allPaths.filter(path => {
      const fullUrl = `${baseUrl}/object/public/annonces/${path}`;
      return !usedUrls.has(fullUrl);
    });

    if (!orphans.length) { showToast('Aucun fichier orphelin — tout est propre ✓', 'success'); return; }
    if (!confirm(`${orphans.length} fichier(s) orphelin(s) trouvé(s) (non utilisés en base).\n\nSupprimer définitivement ?`)) return;

    // 4. Supprimer par lots de 100
    let deleted = 0;
    for (let i = 0; i < orphans.length; i += 100) {
      const batch = orphans.slice(i, i + 100);
      const { error } = await sb.storage.from('annonces').remove(batch);
      if (!error) deleted += batch.length;
    }
    showToast(`${deleted} fichier(s) orphelin(s) supprimé(s) ✓`, 'success');
  } catch(e) {
    showToast('Erreur : ' + e.message, 'error');
    console.error(e);
  }
}

async function btqaTogglePack(id, actif) {
  await window.Auth.sb.from('boutique_packs').update({ actif }).eq('id', id);
  btqaRenderConfigProduits();
  showToast(actif ? 'Pack activé' : 'Pack désactivé');
}

let _btqaEditPackId = null;
// _btqaPackConditions : [{produit_ids:[...], min_qty:1}]
// _btqaPackOffreIds   : [...]
let _btqaPackConditions = [];
let _btqaPackOffreIds   = [];

function btqaOpenPack(id) {
  _btqaEditPackId = id;
  const pk = id ? (window._btqaAllPacks||[]).find(p=>p.id===id) : null;

  document.getElementById('btqa-pack-modal-title').textContent = pk ? 'Modifier le pack' : 'Nouveau pack promo';
  document.getElementById('btqa-pk-nom').value  = pk?.nom || '';
  document.getElementById('btqa-pk-desc').value = pk?.description || '';
  document.getElementById('btqa-pk-offre-qty').value = pk?.offre_qty || 1;
  document.getElementById('btqa-pk-delete').style.display = pk ? '' : 'none';

  // Conditions (support both old format {produit_id} and new {produit_ids})
  const rawConds = pk?.conditions ? JSON.parse(JSON.stringify(pk.conditions)) : [];
  _btqaPackConditions = rawConds
    .filter(c => c.type !== 'offre')
    .map(c => ({
      produit_ids: c.produit_ids || (c.produit_id ? [c.produit_id] : []),
      min_qty: c.min_qty || 1
    }));
  if (!_btqaPackConditions.length) _btqaPackConditions.push({ produit_ids:[], min_qty:1 });

  // Offre IDs - stored as {type:'offre',produit_ids:[...]} in conditions, OR from offre_produit_id
  const offreEntry = rawConds.find(c => c.type === 'offre');
  _btqaPackOffreIds = offreEntry?.produit_ids || (pk?.offre_produit_id ? [pk.offre_produit_id] : []);

  const remiseEntry2 = rawConds.find(c => c.type === 'remise');
  _btqaPackRemiseProdIds = remiseEntry2?.produit_ids || [];
  const savedUnit = remiseEntry2?.unite || 'euro';
  _btqaPackRemiseUnit = savedUnit;
  btqaSetPackType(remiseEntry2 ? 'remise' : 'offre');
  btqaSetRemiseUnit(savedUnit);
  if (remiseEntry2) {
    const val = savedUnit === 'pct'
      ? (remiseEntry2.valeur ?? '')
      : (remiseEntry2.montant_centimes ? (remiseEntry2.montant_centimes / 100).toFixed(2) : '');
    document.getElementById('btqa-pk-remise-montant').value = val;
  } else {
    document.getElementById('btqa-pk-remise-montant').value = '';
  }

  btqaRenderPackConditions();
  btqaRenderPackOffreProduits();
  document.getElementById('btqa-pack-modal').style.display = 'flex';
}

function btqaRenderPackConditions() {
  document.getElementById('btqa-pk-conditions').innerHTML = _btqaPackConditions.map((c,i) => {
    const chips = _btqaProduits.map(p => {
      const sel = c.produit_ids.includes(p.id);
      return `<button type="button"
        onclick="btqaTogglePackCond(${i},'${p.id}')"
        style="padding:5px 12px;border-radius:99px;font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid ${sel?'#2563eb':'#e2e8f0'};background:${sel?'#2563eb':'white'};color:${sel?'white':'#555'};transition:all .12s">
        ${p.nom}
      </button>`;
    }).join('');
    return `<div style="background:#f8fafc;border-radius:12px;padding:12px 14px;margin-bottom:10px;border:1.5px solid #eef2f7">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:12px;font-weight:700;color:var(--accent)">Groupe ${i+1} <span style="font-weight:400;color:#888">- au moins un de ces produits</span></span>
        <button onclick="_btqaPackConditions.splice(${i},1);btqaRenderPackConditions()"
          style="border:none;background:#fee2e2;color:#dc2626;border-radius:6px;cursor:pointer;padding:2px 8px;font-size:12px;font-weight:700">Supprimer</button>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">${chips}</div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
        <span style="font-size:12px;color:#888">Quantité min :</span>
        <input type="number" min="1" max="10" value="${c.min_qty}"
          onchange="_btqaPackConditions[${i}].min_qty=+this.value"
          style="width:60px;padding:5px 8px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;text-align:center;outline:none">
      </div>
    </div>`;
  }).join('');
}

function btqaTogglePackCond(groupIdx, prodId) {
  const ids = _btqaPackConditions[groupIdx].produit_ids;
  const i = ids.indexOf(prodId);
  if (i === -1) ids.push(prodId); else ids.splice(i,1);
  btqaRenderPackConditions();
}

function btqaAddPackCondition() {
  _btqaPackConditions.push({ produit_ids:[], min_qty:1 });
  btqaRenderPackConditions();
}

function btqaRenderPackOffreProduits() {
  document.getElementById('btqa-pk-offre-produits').innerHTML = _btqaProduits.map(p => {
    const sel = _btqaPackOffreIds.includes(p.id);
    return `<button type="button"
      onclick="btqaTogglePackOffre('${p.id}')"
      style="padding:5px 12px;border-radius:99px;font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid ${sel?'#1d4ed8':'#e2e8f0'};background:${sel?'#1d4ed8':'white'};color:${sel?'white':'#555'};transition:all .12s">
      ${p.nom}
    </button>`;
  }).join('');
}

function btqaTogglePackOffre(prodId) {
  const i = _btqaPackOffreIds.indexOf(prodId);
  if (i === -1) _btqaPackOffreIds.push(prodId); else _btqaPackOffreIds.splice(i,1);
  btqaRenderPackOffreProduits();
}

let _btqaPackType = 'offre';
let _btqaPackRemiseProdIds = [];
let _btqaPackRemiseUnit = 'euro'; // 'euro' | 'pct'

function btqaSetRemiseUnit(unit) {
  _btqaPackRemiseUnit = unit;
  const isEuro = unit === 'euro';
  const be = document.getElementById('btqa-pk-remise-euro');
  const bp = document.getElementById('btqa-pk-remise-pct');
  if (be) { be.style.background = isEuro ? '#2563eb' : 'white'; be.style.color = isEuro ? 'white' : '#888'; }
  if (bp) { bp.style.background = !isEuro ? '#2563eb' : 'white'; bp.style.color = !isEuro ? 'white' : '#888'; }
}

function btqaRenderPackRemiseProduits() {
  const el = document.getElementById('btqa-pk-remise-produits');
  if (!el) return;
  el.innerHTML = _btqaProduits.map(p => {
    const sel = _btqaPackRemiseProdIds.includes(p.id);
    return `<button type="button" onclick="btqaTogglePackRemise('${p.id}')"
      style="padding:5px 12px;border-radius:99px;font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid ${sel?'#d97706':'#e2e8f0'};background:${sel?'#d97706':'white'};color:${sel?'white':'#555'};transition:all .12s">
      ${p.nom}
    </button>`;
  }).join('');
}

function btqaTogglePackRemise(prodId) {
  const i = _btqaPackRemiseProdIds.indexOf(prodId);
  if (i === -1) _btqaPackRemiseProdIds.push(prodId); else _btqaPackRemiseProdIds.splice(i, 1);
  btqaRenderPackRemiseProduits();
}

function btqaSetPackType(type) {
  _btqaPackType = type;
  const isOffre = type === 'offre';
  const btnOffre = document.getElementById('btqa-pk-type-offre');
  const btnRemise = document.getElementById('btqa-pk-type-remise');
  if (btnOffre) { btnOffre.style.background = isOffre ? '#2563eb' : 'white'; btnOffre.style.color = isOffre ? 'white' : '#888'; btnOffre.style.borderColor = isOffre ? '#2563eb' : '#e2e8f0'; }
  if (btnRemise) { btnRemise.style.background = !isOffre ? '#d97706' : 'white'; btnRemise.style.color = !isOffre ? 'white' : '#888'; btnRemise.style.borderColor = !isOffre ? '#d97706' : '#e2e8f0'; }
  document.getElementById('btqa-pk-offre-section').style.display = isOffre ? '' : 'none';
  document.getElementById('btqa-pk-remise-section').style.display = isOffre ? 'none' : '';
  if (!isOffre) btqaRenderPackRemiseProduits();
}

function btqaInitDrag() {
  const grid = document.getElementById('btqa-prod-grid-inner');
  if (!grid) return;
  let dragSrcEl = null;
  grid.querySelectorAll('.btqa-prod-card').forEach(card => {
    card.addEventListener('dragstart', e => {
      dragSrcEl = card;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => card.classList.add('dragging'), 0);
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      grid.querySelectorAll('.btqa-prod-card').forEach(c => c.classList.remove('drag-over'));
    });
    card.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (card !== dragSrcEl) {
        grid.querySelectorAll('.btqa-prod-card').forEach(c => c.classList.remove('drag-over'));
        card.classList.add('drag-over');
      }
    });
    card.addEventListener('drop', async e => {
      e.preventDefault();
      card.classList.remove('drag-over');
      if (!dragSrcEl || dragSrcEl === card) return;
      const cards = [...grid.querySelectorAll('.btqa-prod-card')];
      const fromIdx = cards.indexOf(dragSrcEl);
      const toIdx   = cards.indexOf(card);
      if (fromIdx < toIdx) grid.insertBefore(dragSrcEl, card.nextSibling);
      else grid.insertBefore(dragSrcEl, card);
      await btqaSaveProduitsOrdre();
    });
  });
}

async function btqaSaveProduitsOrdre() {
  const grid = document.getElementById('btqa-prod-grid-inner');
  if (!grid) return;
  const sb = window.Auth.sb;
  const cards = [...grid.querySelectorAll('.btqa-prod-card')];
  for (let i = 0; i < cards.length; i++) {
    await sb.from('boutique_produits').update({ ordre: i }).eq('id', cards[i].dataset.id);
  }
  showToast('Ordre sauvegardé');
}

async function btqaSavePack() {
  const nom = document.getElementById('btqa-pk-nom').value.trim();
  if (!nom) return showToast('Entre un nom pour le pack', 'error');
  const validConds = _btqaPackConditions.filter(c=>c.produit_ids.length);
  if (!validConds.length) return showToast('Ajoute au moins un groupe de produits requis', 'error');

  let conditions, payload;
  if (_btqaPackType === 'remise') {
    const rawVal = parseFloat(document.getElementById('btqa-pk-remise-montant').value || '0');
    if (!rawVal) return showToast('Entre un montant de remise', 'error');
    const remiseCond = { type: 'remise', unite: _btqaPackRemiseUnit, produit_ids: _btqaPackRemiseProdIds };
    if (_btqaPackRemiseUnit === 'pct') {
      remiseCond.valeur = rawVal; // ex: 10 pour 10%
    } else {
      remiseCond.montant_centimes = Math.round(rawVal * 100);
    }
    conditions = [
      ...validConds.map(c=>({ type:'achat', produit_ids:c.produit_ids, min_qty:c.min_qty })),
      remiseCond
    ];
    payload = { nom, description: document.getElementById('btqa-pk-desc').value.trim() || null, conditions, offre_produit_id: null, offre_qty: 0 };
  } else {
    if (!_btqaPackOffreIds.length) return showToast('Coche au moins un produit offert', 'error');
    conditions = [
      ...validConds.map(c=>({ type:'achat', produit_ids:c.produit_ids, min_qty:c.min_qty })),
      { type:'offre', produit_ids:_btqaPackOffreIds }
    ];
    payload = { nom, description: document.getElementById('btqa-pk-desc').value.trim() || null, conditions, offre_produit_id: _btqaPackOffreIds[0], offre_qty: +document.getElementById('btqa-pk-offre-qty').value || 1 };
  }

  const sb = window.Auth.sb;
  try {
    let res;
    if (_btqaEditPackId) {
      res = await sb.from('boutique_packs').update(payload).eq('id', _btqaEditPackId);
    } else {
      res = await sb.from('boutique_packs').insert({ ...payload, actif: true });
    }
    if (res.error) return showToast('Erreur : ' + (res.error.message || res.error.details || 'inconnue'), 'error');
  } catch(e) {
    return showToast('Erreur : ' + e.message, 'error');
  }
  document.getElementById('btqa-pack-modal').style.display = 'none';
  showToast('Pack enregistré !');
  await btqaRenderConfigProduits();
}

async function btqaDeletePack() {
  if (!_btqaEditPackId) return;
  if (!confirm('Supprimer ce pack définitivement ?')) return;
  await window.Auth.sb.from('boutique_packs').delete().eq('id', _btqaEditPackId);
  document.getElementById('btqa-pack-modal').style.display = 'none';
  showToast('Pack supprimé');
  await btqaRenderConfigProduits();
}

async function btqaOpenProduit(id) {
  const sb = window.Auth.sb;
  const prod = id ? _btqaProduits.find(p => p.id === id) : null;
  // Designs inline depuis la colonne JSONB du produit
  const existingDesigns = Array.isArray(prod?.designs) ? prod.designs : [];

  const card = document.getElementById('btqa-prod-card');
  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <h3 style="margin:0">${prod ? 'Modifier' : 'Nouveau'} produit</h3>
      <button onclick="document.getElementById('btqa-prod-modal').style.display='none'"
        style="border:none;background:#f3f4f6;border-radius:50%;width:32px;height:32px;cursor:pointer;font-size:18px;color:#666">✕</button>
    </div>

    <div class="btqa-form-row"><label>Nom</label><input id="bp-nom" value="${prod?.nom || ''}"></div>
    <div class="btqa-form-row"><label>Description (optionnel)</label><input id="bp-desc" value="${prod?.description || ''}" placeholder="Ex: Accès à tous les clubs de sport de l'école"></div>
    <div class="btqa-form-row"><label>Prix (en euros)</label><input id="bp-prix" type="number" step="0.01" min="0" value="${((prod?.prix_centimes ?? 0) / 100).toFixed(2)}"></div>
    <div class="btqa-form-row"><label>Quantité max par commande <span style="font-weight:400;color:#aaa">(0 = illimité)</span></label><input id="bp-qmax" type="number" min="0" value="${prod?.quantite_max || 0}" placeholder="0"></div>
    <div class="btqa-form-row"><label>Catégorie</label>
      <select id="bp-cat">
        <option value="vetement" ${prod?.categorie === 'vetement' ? 'selected' : ''}>Vêtement</option>
        <option value="accessoire" ${prod?.categorie === 'accessoire' ? 'selected' : ''}>Accessoire</option>
      </select>
    </div>
    <div class="btqa-form-row"><label>Tailles (séparées par des virgules)</label>
      <input id="bp-tailles" value="${(prod?.tailles_disponibles || []).join(', ')}" placeholder="S, M, L, XL">
    </div>
    <div class="btqa-form-row"><label>Guide des tailles (optionnel)</label>
      <div class="btqa-img-picker">
        ${ (function(){ const gt = (prod?.images||[]).find(i=>i.type==='guide_taille')?.url||''; const gtPrev = btqaToRawGhUrl(gt); return `
        <div class="btqa-img-preview-wrap" id="bp-gt-w" style="${gt ? '' : 'display:none'}">
          <img src="${gtPrev}" id="bp-gt-img" class="btqa-img-preview-img" onerror="if(this.src.includes('raw.githubusercontent'))this.src='${gt}'">
          <button type="button" class="btqa-img-clear" onclick="btqaClearImg('bp-gt-v','bp-gt-w')">✕</button>
        </div>
        <input type="hidden" id="bp-gt-v" value="${gt}">
        <label class="btqa-img-btn" for="bp-gt-file" id="bp-gt-lbl" style="padding:5px 8px;font-size:10px">${gt ? '📷 Changer' : '📷 Photo'}</label>`; })() }
        <input type="file" id="bp-gt-file" accept="image/*" style="display:none"
               onchange="btqaUploadImg(this,'bp-gt-v','bp-gt-img','bp-gt-w','bp-gt-lbl')">
      </div>
    </div>
    <div class="btqa-form-row"><label>Couleurs (séparées par des virgules)</label>
      <input id="bp-couleurs" value="${(prod?.couleurs_disponibles || []).join(', ')}" placeholder="Blanc, Noir, Bleu, Rose, Vert">
    </div>
    <div class="btqa-form-row" style="display:flex;gap:16px;margin-bottom:4px">
      <label style="display:flex;align-items:center;gap:6px;font-size:14px;font-weight:normal;text-transform:none;letter-spacing:0">
        <input type="checkbox" id="bp-actif" ${prod?.actif !== false ? 'checked' : ''}> Actif
      </label>
    </div>

    <div style="margin-top:16px;padding-top:16px;border-top:1px solid #eef2f7">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#888">Options payantes</div>
        <button type="button" onclick="btqaAddOptionRow()" style="padding:4px 12px;border-radius:8px;border:1.5px solid var(--accent);background:white;color:var(--accent);font-size:12px;font-weight:700;cursor:pointer">+ Ajouter</button>
      </div>
      <div id="bp-options-list" style="display:flex;flex-direction:column;gap:8px">
        ${(prod?.options_payantes || []).map((opt, idx) => btqaOptionRowHtml(idx, opt.nom, opt.prix_centimes, opt.remise_produit_centimes)).join('')}
      </div>
    </div>

    <div style="margin-top:16px;padding-top:16px;border-top:1px solid #eef2f7">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#888">Photos du produit</div>
        <button type="button" onclick="btqaAddGalleryRow()" style="padding:4px 12px;border-radius:8px;border:1.5px solid var(--accent);background:white;color:var(--accent);font-size:12px;font-weight:700;cursor:pointer">+ Ajouter</button>
      </div>
      <div id="bp-gallery-list" style="display:flex;flex-direction:column;gap:10px">
        ${(function() {
          const galleryImgs = (prod?.images || []).filter(img => img.type !== 'guide_taille');
          if (!galleryImgs.length && prod?.image_url) galleryImgs.push({ url: prod.image_url });
          return galleryImgs.map((img, idx) => btqaGalleryRowHtml(idx, img.url || '')).join('');
        })()}
      </div>
    </div>

    <div style="margin-top:16px;padding-top:16px;border-top:1px solid #eef2f7">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#888">Designs de ce produit</div>
        <button type="button" onclick="btqaAddDesignRow()" style="padding:4px 12px;border-radius:8px;border:1.5px solid var(--accent);background:white;color:var(--accent);font-size:12px;font-weight:700;cursor:pointer">+ Ajouter</button>
      </div>
      <div id="bp-designs-list" style="display:flex;flex-direction:column;gap:10px">
        ${existingDesigns.map((d, idx) => btqaDesignRowHtml(idx, d.nom, d.images || {}, prod?.couleurs_disponibles || [], d.actif, d.couleurs_indispo)).join('')}
      </div>
    </div>

    <button class="btn-save" style="width:100%;margin-top:16px" onclick="btqaSaveProduit('${id || ''}')">
      ${prod ? 'Enregistrer' : 'Créer le produit'}
    </button>`;

  // Mettre à jour le style au changement de checkbox
  card.querySelectorAll('.bp-design-linked').forEach(cb => {
    cb.addEventListener('change', () => {
      const row = cb.closest('div[style*="align-items:center"]');
      if (row) {
        row.style.borderColor = cb.checked ? '#2563eb' : '#eee';
        row.style.background  = cb.checked ? '#f8fafc' : '#fafafa';
      }
    });
  });

  document.getElementById('btqa-prod-modal').style.display = 'flex';
}

async function btqaSaveProduit(id) {
  const nom     = document.getElementById('bp-nom').value.trim();
  const prixRaw = parseFloat(document.getElementById('bp-prix').value);
  const prix    = isNaN(prixRaw) ? 0 : Math.round(prixRaw * 100);
  const cat     = document.getElementById('bp-cat').value;
  const tailles  = document.getElementById('bp-tailles').value.split(',').map(s => s.trim()).filter(Boolean);
  const couleurs = document.getElementById('bp-couleurs').value.split(',').map(s => s.trim()).filter(Boolean);
  const actif   = document.getElementById('bp-actif').checked;
  if (!nom) return showToast('Entre un nom', 'error');

  const sb = window.Auth.sb;

  // Lire la galerie de photos
  const images = [];
  document.querySelectorAll('.bp-gallery-row').forEach(row => {
    const url = row.querySelector('input[type="hidden"]')?.value.trim();
    if (url) images.push({ url });
  });
  // Ajouter le guide des tailles dans images (type: 'guide_taille'), après avoir dédupliqué
  const gtUrl = document.getElementById('bp-gt-v')?.value.trim();
  if (gtUrl) images.push({ url: gtUrl, type: 'guide_taille' });
  // imageUrl = première photo galerie (pas le guide)


  // Lire les designs inline
  const designs = [];
  document.querySelectorAll('.bp-design-row').forEach(row => {
    const nomInput = row.querySelector('.bp-design-nom');
    const n = nomInput?.value.trim();
    if (!n) return;
    const images = {};
    row.querySelectorAll('input[type="hidden"][data-side]').forEach(inp => {
      const colorName = inp.dataset.colorName;
      const side = inp.dataset.side;
      const url = inp.value.trim();
      if (url && colorName) {
        if (!images[colorName]) images[colorName] = {};
        images[colorName][side] = url;
      }
    });
    const couleurs_indispo = [];
    row.querySelectorAll('.bp-design-couleur-block').forEach(block => {
      if (block.dataset.indispo === 'true') couleurs_indispo.push(block.dataset.couleur);
    });
    designs.push({ nom: n, images, actif: row.dataset.actif !== 'false', couleurs_indispo });
  });

  // image_url = première photo de la galerie hors guide_taille (préserver l'existante si galerie vide)
  const existingProd = id ? (_btqaProduits || []).find(p => p.id === id) : null;
  const imageUrl = images.find(i => i.type !== 'guide_taille')?.url || null;

  // Lire les options payantes
  const options_payantes = [];
  document.querySelectorAll('#bp-options-list [data-opt-idx]').forEach(row => {
    const nom = row.querySelector('.bp-opt-nom')?.value.trim();
    const prixVal = parseFloat(row.querySelector('.bp-opt-prix')?.value || '0');
    const remiseVal = parseFloat(row.querySelector('.bp-opt-remise')?.value || '0');
    if (nom && prixVal > 0) {
      const opt = { nom, prix_centimes: Math.round(prixVal * 100) };
      if (remiseVal > 0) opt.remise_produit_centimes = Math.round(remiseVal * 100);
      options_payantes.push(opt);
    }
  });

  const description = document.getElementById('bp-desc')?.value.trim() || null;
  const quantite_max = parseInt(document.getElementById('bp-qmax')?.value || '0') || null;

  const payload = {
    nom, description, prix_centimes: prix, categorie: cat,
    tailles_disponibles: tailles, couleurs_disponibles: couleurs,
    a_designs: designs.length > 0, a_tailles: tailles.length > 0,
    actif, image_url: imageUrl,
    images, designs, options_payantes, quantite_max,
  };

  let prodId = id;
  if (id) {
    const { error } = await sb.from('boutique_produits').update(payload).eq('id', id);
    if (error) { showToast('Erreur sauvegarde : ' + error.message, 'error'); console.error('[btqaSaveProduit]', error); return; }
  } else {
    const { data: ins, error } = await sb.from('boutique_produits').insert(payload).select().single();
    if (error) { showToast('Erreur création : ' + error.message, 'error'); console.error('[btqaSaveProduit]', error); return; }
    prodId = ins?.id;
  }

  document.getElementById('btqa-prod-modal').style.display = 'none';
  await btqaRenderConfigProduits();
  showToast(id ? 'Produit modifié' : 'Produit créé');
}

function btqaOpenDesign(id) {
  const card = document.getElementById('btqa-prod-card');
  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <h3 style="margin:0">${id ? 'Modifier' : 'Nouveau'} design</h3>
      <button onclick="document.getElementById('btqa-prod-modal').style.display='none'"
        style="border:none;background:#f3f4f6;border-radius:50%;width:32px;height:32px;cursor:pointer;font-size:18px;color:#666">✕</button>
    </div>
    <div class="btqa-form-row"><label>Nom du design</label><input id="bd-nom" value=""></div>
    <div class="btqa-form-row"><label>Visuel du design</label>
      <div class="btqa-img-picker">
        <div class="btqa-img-preview-wrap" id="bd-img-prev-wrap" style="display:none">
          <img src="" id="bd-img-prev-img" class="btqa-img-preview-img">
          <button class="btqa-img-clear" onclick="btqaClearImg('bd-img','bd-img-prev-wrap')">✕</button>
        </div>
        <input type="hidden" id="bd-img" value="">
        <label class="btqa-img-btn" for="bd-img-file" id="bd-img-lbl">📷 Choisir une photo</label>
        <input type="file" id="bd-img-file" accept="image/*" style="display:none"
               onchange="btqaUploadImg(this,'bd-img','bd-img-prev-img','bd-img-prev-wrap','bd-img-lbl')">
      </div>
    </div>
    <button class="btn-save" style="width:100%;margin-top:8px" onclick="btqaSaveDesign('${id || ''}')">
      ${id ? 'Enregistrer' : 'Créer le design'}
    </button>`;
  // Préremplir si modif
  if (id) {
    window.Auth.sb.from('boutique_designs').select('*').eq('id', id).single()
      .then(({ data: d }) => {
        if (!d) return;
        document.getElementById('bd-nom').value = d.nom;
        if (d.image_url) {
          document.getElementById('bd-img').value = d.image_url;
          document.getElementById('bd-img-prev-img').src = d.image_url;
          document.getElementById('bd-img-prev-wrap').style.display = '';
          document.getElementById('bd-img-lbl').textContent = '📷 Changer';
        }
      });
  }
  document.getElementById('btqa-prod-modal').style.display = 'flex';
}

async function btqaSaveDesign(id) {
  const nom = document.getElementById('bd-nom').value.trim();
  const img = document.getElementById('bd-img').value.trim();
  if (!nom) return showToast('Entre un nom', 'error');
  const sb = window.Auth.sb;
  if (id) { await sb.from('boutique_designs').update({ nom, image_url: img }).eq('id', id); }
  else    { await sb.from('boutique_designs').insert({ nom, image_url: img }); }
  document.getElementById('btqa-prod-modal').style.display = 'none';
  btqaRenderConfigProduits();
  showToast(id ? 'Design modifié' : 'Design créé');
}

// ── Scanner QR ───────────────────────────────────────────────
let _btqaHtml5QrCode = null;

async function btqaToggleScanner() {
  const wrap = document.getElementById('btqa-scanner-wrap');
  const btn  = document.getElementById('btqa-scan-toggle');
  if (wrap.style.display !== 'none') { btqaStopScanner(); return; }

  const origText = btn.innerHTML;
  btn.innerHTML  = 'Chargement caméra…';
  btn.style.opacity = '.7';
  btn.disabled = true;

  try {
    if (!window.Html5Qrcode) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
        s.onload = res; s.onerror = () => rej(new Error('Impossible de charger le scanner'));
        document.head.appendChild(s);
      });
    }
    wrap.style.display = 'block';
    btn.innerHTML = '⏹ Arrêter le scanner';
    btn.style.opacity = '1';
    btn.disabled = false;
    btn.style.background = '#fef3c7';
    btn.style.color = '#92400e';
    btn.style.borderColor = '#f59e0b';

    _btqaHtml5QrCode = new Html5Qrcode('btqa-qr-reader');
    await _btqaHtml5QrCode.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      decoded => {
        document.getElementById('btqa-r-numero').value = decoded.trim();
        btqaStopScanner();
        btqaLookup();
      },
      () => {}
    );
  } catch(err) {
    showToast('Caméra inaccessible : ' + (err?.message || err), 'error');
    btn.innerHTML  = origText;
    btn.style.opacity = '1';
    btn.disabled = false;
    btn.style.background = '';
    btn.style.color = '';
    btn.style.borderColor = '';
    wrap.style.display = 'none';
    if (_btqaHtml5QrCode) { _btqaHtml5QrCode.stop().catch(()=>{}); _btqaHtml5QrCode = null; }
  }
}

function btqaStopScanner() {
  if (_btqaHtml5QrCode) { _btqaHtml5QrCode.stop().catch(() => {}); _btqaHtml5QrCode = null; }
  const wrap = document.getElementById('btqa-scanner-wrap');
  if (wrap) wrap.style.display = 'none';
  const btn = document.getElementById('btqa-scan-toggle');
  if (btn) {
    btn.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h.01M14 17h.01M17 14h.01M17 17h.01M20 14h.01M20 17h.01M20 20h.01M17 20h.01M14 20h.01"/></svg> Scanner une carte / QR code`;
    btn.style.background = 'white'; btn.style.color = 'var(--violet)'; btn.style.borderColor = 'var(--violet)';
    btn.style.opacity = '1'; btn.disabled = false;
  }
}

// ── Helpers ──────────────────────────────────────────────────
function btqaFmt(c) {
  return (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
function btqaStatutLabel(s) {
  const m = { panier:'Panier',en_attente:'En attente',payee:'Payée',production:'Production',livraison:'Livraison',confirmee:'Récupérable',remise:'Remise',annulee:'Annulée',expiree:'Expirée' };
  return m[s] || s;
}
