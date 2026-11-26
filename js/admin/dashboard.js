/* BDE Admin — module dashboard (vue d'ensemble) */
let _dashData = null;
let _dashAt = 0;
const DASH_TTL = 60000;

const DASH_IC = {
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  users: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>',
  ticket: '<path d="M2 9V7a2 2 0 012-2h16a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2a2 2 0 000-4z"/><path d="M13 5v14"/>',
  bag: '<path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 01-8 0"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  pin: '<path d="M12 2a7 7 0 017 7c0 5-7 13-7 13S5 14 5 9a7 7 0 017-7z"/><circle cx="12" cy="9" r="2.5"/>',
  qr: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3z"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
};

function dashIcon(n) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${DASH_IC[n]}</svg>`;
}
function dashEsc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function dashPeut(page) {
  return !(window._adminInterdits && window._adminInterdits.has(page));
}
function dashNb(n) {
  return Number(n || 0).toLocaleString('fr-FR');
}
function dashJour(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function dashDate(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}
function dashDans(iso) {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((dashDate(iso) - t) / 86400000);
}
function dashDansTxt(n) {
  return n <= 0 ? "Aujourd'hui" : n === 1 ? 'Demain' : 'Dans ' + n + ' jours';
}

async function dashCharger() {
  const sb = Auth.sb;
  // Une requête en échec ne doit pas vider tout le tableau de bord
  const lire = async (q) => {
    try { const r = await q; return r.error ? null : r.data; } catch (_) { return null; }
  };
  const [stats, trafic, evs, billets, commandes] = await Promise.all([
    lire(sb.rpc('bde_stats')),
    dashPeut('stats') ? lire(sb.rpc('analytics_stats', { p_days: 30 })) : null,
    lire(sb.from('evenements').select('titre,date,lieu,horaire,bureau_only').gte('date', dashJour(new Date())).order('date', { ascending: true }).limit(4)),
    dashPeut('billetterie') ? lire(sb.from('billetterie_inscriptions').select('quantite,created_at').eq('statut', 'confirme')) : null,
    dashPeut('boutique') ? lire(sb.from('boutique_commandes').select('statut,total_centimes').in('statut', ['en_attente', 'payee', 'production', 'livraison', 'confirmee'])) : null,
  ]);
  return { stats, trafic, evs, billets, commandes };
}

function dashSerie(trafic) {
  const parJour = {};
  ((trafic && trafic.daily_visitors) || []).forEach(r => { parJour[r.day] = r; });
  const out = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const r = parJour[dashJour(d)];
    out.push({ d, v: r ? Number(r.visitors) : 0, p: r ? Number(r.pageviews) : 0 });
  }
  return out;
}

function dashCourbe(vals, w, h, pad) {
  const max = Math.max(1, ...vals);
  const pts = vals.map((v, i) => [i * w / (vals.length - 1), h - pad - (v / max) * (h - pad * 2)]);
  let d = 'M' + pts[0].join(',');
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], mx = (x0 + x1) / 2;
    d += ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`;
  }
  return d;
}

function dashKpis(D) {
  const s = D.stats || {};
  const k = [];
  if (D.trafic) k.push({ page: 'stats', ic: 'eye', val: D.trafic.unique_visitors, lab: 'Visiteurs', sub: dashNb(D.trafic.pageviews_total) + ' pages vues · 30 j', spark: dashSerie(D.trafic).map(x => x.v) });
  if (D.billets) k.push({ page: 'billetterie', ic: 'ticket', val: D.billets.reduce((a, r) => a + (r.quantite || 1), 0), lab: 'Billets confirmés', sub: 'toutes billetteries' });
  if (D.commandes) {
    const total = D.commandes.reduce((a, c) => a + (c.total_centimes || 0), 0) / 100;
    k.push({ page: 'boutique', ic: 'bag', val: D.commandes.length, lab: 'Commandes en cours', sub: total.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) + ' au total' });
  }
  if (D.stats && dashPeut('newsletter')) k.push({ page: 'newsletter', ic: 'mail', val: s.newsletter_active, lab: 'Abonnés newsletter', sub: 'abonnés actifs' });
  if (D.stats) k.push({ page: dashPeut('stats') ? 'stats' : '', ic: 'users', val: s.profils_total, lab: 'Comptes étudiants', sub: '+' + dashNb(s.profils_7j) + ' sur 7 jours' });
  if (D.stats && dashPeut('fidelite')) k.push({ page: 'fidelite', ic: 'card', val: s.cartes_total, lab: 'Cartes fidélité', sub: dashNb(s.cartes_tampons) + ' tampons distribués' });
  return k.slice(0, 4);
}

function dashATraiter(D) {
  const s = D.stats || {};
  const l = [];
  const cmd = st => (D.commandes || []).filter(c => c.statut === st).length;
  const add = (n, un, plusieurs, action) => { if (n > 0) l.push({ n, txt: n > 1 ? plusieurs : un, action }); };
  add(cmd('en_attente'), 'commande en attente de paiement', 'commandes en attente de paiement', "selectPage('boutique')");
  add(cmd('payee'), 'commande payée à lancer', 'commandes payées à lancer', "selectPage('boutique')");
  add(cmd('confirmee'), 'commande à remettre', 'commandes à remettre', "selectPage('boutique')");
  add(s.annonces_pending, 'annonce à modérer', 'annonces à modérer', "location.href='/admin-annonces.html'");
  add(s.demandes_pending, "demande d'adhésion à valider", "demandes d'adhésion à valider", "location.href='/mon-espace.html'");
  add(s.feedbacks_pending, 'retour à lire', 'retours à lire', "selectPage('stats')");
  return l;
}

function dashHero(D) {
  const p = window._adminProfil || {};
  const bde = k => (window.BDE ? window.BDE.get(k, '') : '');
  const nom = bde('nom');
  const logo = bde('logo_url');
  const h = new Date().getHours();
  const salut = h >= 18 || h < 5 ? 'Bonsoir' : 'Bonjour';
  const mots = (salut + (p.prenom ? ' ' + p.prenom : '')).split(' ')
    .map((m, i) => `<span class="w" style="animation-delay:${.15 + i * .1}s">${dashEsc(m)}</span>`).join(' ');
  const date = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const ev = D && D.evs && D.evs[0];
  let carte = '';
  if (ev) {
    const n = dashDans(ev.date);
    carte = `<div class="dash-next">
      <small>Prochain événement</small>
      <div class="dash-count">${n <= 0 ? 'Jour J' : 'J-' + n}</div>
      <strong>${dashEsc(ev.titre)}</strong>
      <span>${dashEsc(dashDate(ev.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }))}${ev.lieu ? ' · ' + dashEsc(ev.lieu) : ''}</span>
    </div>`;
  }
  return `<section class="dash-hero">
    <span class="orb o1"></span><span class="orb o2"></span><span class="orb o3"></span>
    <div class="dash-hero-in">
      ${logo ? `<img class="dash-logo" src="${dashEsc(logo)}" alt="">` : ''}
      <div class="dash-tx">
        <div class="dash-eyebrow">${dashEsc(date)}</div>
        <h1>${mots}</h1>
        <p>${nom ? 'Voici ce qui se passe chez ' + dashEsc(nom) + '.' : 'Voici ce qui se passe au BDE.'}</p>
        <div class="dash-hero-btns">
          ${dashPeut('agenda') ? `<button class="dash-hbtn plein" onclick="selectPage('agenda')">${dashIcon('cal')}Gérer l'agenda</button>` : ''}
          <a class="dash-hbtn" href="/" target="_blank" rel="noopener">Voir le site ↗</a>
        </div>
      </div>
      ${carte}
    </div>
  </section>`;
}

function dashCorps(D) {
  if (!D) {
    return `<div class="dash-kpis">${'<div class="dash-card dash-skel"></div>'.repeat(4)}</div>
      <div class="dash-row"><div class="dash-card dash-skel haut"></div><div class="dash-card dash-skel haut"></div></div>`;
  }
  const kpis = dashKpis(D).map((k, i) => `
    <button class="dash-card dash-kpi" style="--i:${i}" ${k.page ? `onclick="selectPage('${k.page}')"` : ''}>
      <span class="dash-kic">${dashIcon(k.ic)}</span>
      <span class="dash-klab">${k.lab}</span>
      <span class="dash-kval" data-n="${Number(k.val || 0)}">0</span>
      <span class="dash-ksub">${dashEsc(k.sub)}</span>
      ${k.spark ? `<svg class="dash-spark" viewBox="0 0 100 32" preserveAspectRatio="none"><path d="${dashCourbe(k.spark, 100, 32, 3)}"/></svg>` : ''}
    </button>`).join('');

  let graphe = '';
  if (D.trafic) {
    const serie = dashSerie(D.trafic), vals = serie.map(x => x.v), d = dashCourbe(vals, 600, 180, 12);
    const court = x => x.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    graphe = `<div class="dash-card dash-graphe" style="--i:4">
      <div class="dash-titre"><h3>Fréquentation du site</h3><span>Visiteurs par jour · pic à ${dashNb(Math.max(...vals))}</span></div>
      <div class="dash-plot" id="dash-plot">
        <svg viewBox="0 0 600 180" preserveAspectRatio="none">
          <defs><linearGradient id="dash-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--accent);stop-opacity:.28"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></linearGradient></defs>
          <path class="aire" d="${d} L600,180 L0,180 Z" fill="url(#dash-fill)"/>
          <path class="ligne" d="${d}" pathLength="1"/>
        </svg>
        <i class="dash-curseur"></i><div class="dash-bulle"></div>
      </div>
      <div class="dash-axe"><span>${court(serie[0].d)}</span><span>${court(serie[14].d)}</span><span>Aujourd'hui</span></div>
    </div>`;
  }

  const todo = dashATraiter(D);
  const aTraiter = `<div class="dash-card" style="--i:5">
    <div class="dash-titre"><h3>À traiter</h3>${todo.length ? `<span class="dash-badge">${todo.reduce((a, t) => a + t.n, 0)}</span>` : ''}</div>
    ${todo.length ? todo.map(t => `<button class="dash-todo" onclick="${t.action}"><b>${t.n}</b><span>${t.txt}</span>${dashIcon('arrow')}</button>`).join('')
      : `<div class="dash-vide"><span class="dash-ok">${dashIcon('check')}</span><strong>Tout est à jour</strong>Rien à traiter pour le moment.</div>`}
  </div>`;

  const evs = D.evs || [];
  const agenda = `<div class="dash-card" style="--i:6">
    <div class="dash-titre"><h3>Prochains événements</h3>${dashPeut('planning') ? `<button class="dash-lien" onclick="selectPage('planning')">Organisation</button>` : ''}</div>
    ${evs.length ? evs.map(e => {
      const dt = dashDate(e.date);
      return `<div class="dash-ev"><div class="dash-jour"><b>${dt.getDate()}</b><span>${dt.toLocaleDateString('fr-FR', { month: 'short' })}</span></div>
        <div class="dash-ev-tx"><strong>${dashEsc(e.titre)}</strong><span>${[e.lieu, e.horaire, e.bureau_only ? 'Bureau uniquement' : ''].filter(Boolean).map(dashEsc).join(' · ')}</span></div>
        <em>${dashDansTxt(dashDans(e.date))}</em></div>`;
    }).join('') : `<div class="dash-vide"><strong>Aucun événement à venir</strong>Ajoute le prochain dans l'agenda.</div>`}
  </div>`;

  const raccourcis = [
    ['agenda', 'cal', 'Événement'], ['annonces', 'pin', 'Annonces'], ['newsletter', 'mail', 'Newsletter'],
    ['billetterie', 'ticket', 'Billetterie'], ['boutique', 'bag', 'Boutique'], ['qr', 'qr', 'QR code'],
  ].filter(r => dashPeut(r[0]));
  const actions = `<div class="dash-card" style="--i:7">
    <div class="dash-titre"><h3>Raccourcis</h3></div>
    <div class="dash-actions">${raccourcis.map(([pg, ic, lab]) => `<button onclick="selectPage('${pg}')"><span>${dashIcon(ic)}</span>${lab}</button>`).join('')}</div>
  </div>`;

  return `<div class="dash-kpis">${kpis}</div>
    <div class="dash-row${graphe ? '' : ' seul'}">${graphe}${aTraiter}</div>
    <div class="dash-row">${agenda}${actions}</div>`;
}

function dashAnimer(root, D) {
  const calme = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.querySelectorAll('.dash-kval').forEach(el => {
    const fin = Number(el.dataset.n), t0 = performance.now();
    if (calme || document.hidden) { el.textContent = dashNb(fin); return; }
    (function pas(t) {
      const p = Math.min(1, Math.max(0, (t - t0) / 900));
      el.textContent = dashNb(Math.round(fin * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(pas);
    })(t0);
  });
  const plot = root.querySelector('#dash-plot');
  if (!plot) return;
  const serie = dashSerie(D.trafic), max = Math.max(1, ...serie.map(x => x.v));
  const cur = plot.querySelector('.dash-curseur'), bulle = plot.querySelector('.dash-bulle');
  plot.addEventListener('pointermove', e => {
    const r = plot.getBoundingClientRect();
    const i = Math.max(0, Math.min(29, Math.round((e.clientX - r.left) / r.width * 29)));
    const x = i / 29 * r.width, y = (180 - 12 - serie[i].v / max * 156) / 180 * r.height;
    cur.style.transform = `translate(${x}px,${y}px)`;
    bulle.innerHTML = `<b>${dashNb(serie[i].v)}</b> visiteurs<br>${serie[i].d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
    bulle.style.left = Math.max(60, Math.min(r.width - 60, x)) + 'px';
    plot.classList.add('on');
  });
  plot.addEventListener('pointerleave', () => plot.classList.remove('on'));
}

function dashPeindre(D) {
  const root = document.getElementById('dash');
  if (!root) return;
  root.innerHTML = dashHero(D) + dashCorps(D);
  if (D) dashAnimer(root, D);
}

async function dashRender() {
  if (!document.getElementById('dash-css')) document.head.insertAdjacentHTML('beforeend', DASH_CSS);
  const notice = document.getElementById('admin-github-notice');
  if (notice) notice.style.display = window._adminNoGitHub ? 'flex' : 'none';
  if (window.BDE && window.BDE.ready) await window.BDE.ready;
  const frais = _dashData && Date.now() - _dashAt < DASH_TTL;
  dashPeindre(_dashData);
  if (frais) return;
  const D = await dashCharger();
  _dashData = D; _dashAt = Date.now();
  dashPeindre(D);
}

const DASH_CSS = `<style id="dash-css">
  #dash{margin-bottom:8px}
  #dash svg{fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
  .dash-hero{position:relative;overflow:hidden;margin:-1.75rem -2rem 0;padding:40px 32px 78px;border-radius:0 0 28px 28px;color:#fff;
    background:var(--gradient,linear-gradient(135deg,var(--accent),var(--accent-h)));background-size:180% 180%;animation:dashFond 14s ease-in-out infinite}
  .dash-hero::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.14),rgba(0,0,0,.38));pointer-events:none}
  .dash-hero .orb{position:absolute;border-radius:50%;background:#fff;filter:blur(46px);opacity:.28;animation:dashOrb 9s ease-in-out infinite;pointer-events:none}
  .dash-hero .o1{width:260px;height:260px;right:-70px;top:-110px}
  .dash-hero .o2{width:190px;height:190px;left:34%;bottom:-120px;animation-delay:-3s}
  .dash-hero .o3{width:110px;height:110px;left:-40px;top:-30px;animation-delay:-6s}
  .dash-hero-in{position:relative;display:flex;align-items:center;gap:26px;flex-wrap:wrap}
  .dash-logo{width:96px;height:96px;border-radius:50%;object-fit:cover;background:#fff;border:4px solid rgba(255,255,255,.55);box-shadow:0 10px 30px rgba(0,0,0,.3);animation:dashPop .7s cubic-bezier(.2,.9,.3,1.3) both}
  .dash-tx{flex:1;min-width:240px}
  .dash-eyebrow{font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;opacity:.85;animation:dashUp .6s both}
  #dash .dash-hero h1{margin:6px 0;font-size:clamp(30px,4.6vw,48px);line-height:1.05;font-weight:800;letter-spacing:-.025em;color:#fff;text-shadow:0 2px 18px rgba(0,0,0,.25)}
  .dash-hero h1 .w{display:inline-block;animation:dashUp .7s cubic-bezier(.2,.9,.3,1) both}
  .dash-tx p{margin:0;font-size:15px;opacity:.92;animation:dashUp .6s .45s both}
  .dash-hero-btns{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px;animation:dashUp .6s .6s both}
  .dash-hbtn{display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border-radius:999px;border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.16);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);color:#fff;font:inherit;font-size:13.5px;font-weight:700;text-decoration:none;cursor:pointer;transition:transform .2s,background .2s,box-shadow .2s}
  .dash-hbtn:hover{transform:translateY(-2px);background:rgba(255,255,255,.28)}
  .dash-hbtn.plein{background:#fff;border-color:#fff;color:var(--accent)}
  .dash-hbtn.plein:hover{box-shadow:0 8px 22px rgba(0,0,0,.25)}
  .dash-hbtn svg{width:16px;height:16px}
  .dash-next{display:flex;flex-direction:column;gap:2px;width:250px;padding:18px 20px;border-radius:20px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.3);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 14px 40px rgba(0,0,0,.2);animation:dashPop .7s .35s cubic-bezier(.2,.9,.3,1.2) both}
  .dash-next small{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.8}
  .dash-count{font-size:44px;font-weight:800;letter-spacing:-.03em;line-height:1.1;font-variant-numeric:tabular-nums}
  .dash-next strong{font-size:15px;line-height:1.3}
  .dash-next span{font-size:12.5px;opacity:.85}

  .dash-card{min-width:0;background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:20px;box-shadow:0 1px 2px rgba(15,23,42,.04);text-align:left;animation:dashUp .55s both;animation-delay:calc(var(--i,0)*70ms)}
  .dash-kpis{position:relative;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin:-48px 0 16px}
  .dash-kpi{position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:flex-start;gap:3px;font:inherit;color:var(--text);box-shadow:0 12px 30px rgba(15,23,42,.1);cursor:pointer;transition:transform .22s,box-shadow .22s,border-color .22s;animation-fill-mode:backwards}
  .dash-kpi:hover{transform:translateY(-4px);border-color:var(--accent);box-shadow:0 18px 36px color-mix(in srgb,var(--accent) 18%,transparent)}
  .dash-kic{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:var(--gradient,var(--accent));color:#fff;margin-bottom:10px}
  .dash-kic svg{width:20px;height:20px}
  .dash-klab{font-size:12.5px;font-weight:600;color:var(--text2)}
  .dash-kval{font-size:34px;font-weight:800;letter-spacing:-.03em;line-height:1.1;font-variant-numeric:tabular-nums}
  .dash-ksub{font-size:12px;color:var(--text2)}
  #dash .dash-spark{position:absolute;right:16px;top:22px;width:44%;height:34px;stroke:var(--accent);stroke-width:2}
  .dash-spark path{vector-effect:non-scaling-stroke}

  .dash-row{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(0,1fr);gap:16px;margin-bottom:16px;align-items:stretch}
  .dash-row.seul{grid-template-columns:1fr}
  .dash-titre{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:14px}
  #dash .dash-titre h3{margin:0;font-size:16px;font-weight:800;letter-spacing:-.01em;color:var(--text)}
  .dash-titre>span{font-size:12px;color:var(--text2)}
  .dash-titre>.dash-badge{min-width:24px;padding:2px 8px;border-radius:999px;background:var(--gradient,var(--accent));color:#fff;font-weight:800;text-align:center}
  .dash-lien{border:0;background:none;padding:0;font:inherit;font-size:12.5px;font-weight:700;color:var(--accent);cursor:pointer}
  .dash-graphe{display:flex;flex-direction:column}
  .dash-plot{position:relative;flex:1;min-height:180px;touch-action:pan-y}
  .dash-plot>svg{position:absolute;inset:0;width:100%;height:100%}
  #dash .dash-plot .aire{stroke:none;fill:url(#dash-fill);animation:dashFondu 1.2s .6s both}
  #dash .dash-plot .ligne{stroke:var(--accent);stroke-width:2.5;vector-effect:non-scaling-stroke}
  .dash-curseur{position:absolute;left:-6px;top:-6px;width:12px;height:12px;border-radius:50%;background:var(--accent);border:3px solid #fff;box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 22%,transparent);opacity:0;pointer-events:none;box-sizing:border-box}
  .dash-bulle{position:absolute;top:0;transform:translateX(-50%);padding:6px 11px;border-radius:10px;background:#0f172a;color:#fff;font-size:11.5px;line-height:1.4;white-space:nowrap;opacity:0;pointer-events:none}
  .dash-plot.on .dash-curseur,.dash-plot.on .dash-bulle{opacity:1}
  .dash-axe{display:flex;justify-content:space-between;margin-top:8px;font-size:11px;color:var(--text2)}
  .dash-todo{display:flex;align-items:center;gap:12px;width:100%;padding:11px 12px;margin-bottom:8px;border:1px solid var(--border);border-radius:12px;background:none;font:inherit;font-size:13.5px;color:var(--text);text-align:left;cursor:pointer;transition:transform .18s,border-color .18s,background .18s}
  .dash-todo:hover{transform:translateX(4px);border-color:var(--accent);background:var(--accent-lt)}
  .dash-todo b{display:grid;place-items:center;min-width:32px;height:32px;border-radius:10px;background:var(--accent-lt);color:var(--accent);font-size:15px}
  .dash-todo span{flex:1}
  .dash-todo svg{width:16px;height:16px;color:var(--text2);flex-shrink:0}
  .dash-vide{display:flex;flex-direction:column;align-items:center;gap:4px;padding:26px 10px;text-align:center;font-size:13px;color:var(--text2)}
  .dash-vide strong{font-size:14.5px;color:var(--text)}
  .dash-ok{display:grid;place-items:center;width:52px;height:52px;margin-bottom:8px;border-radius:50%;background:#dcfce7;color:#16a34a;animation:dashPop .6s .5s cubic-bezier(.2,.9,.3,1.4) both}
  .dash-ok svg{width:26px;height:26px}
  .dash-ev{display:flex;align-items:center;gap:14px;padding:10px 0;border-bottom:1px solid var(--border)}
  .dash-ev:last-child{border-bottom:0}
  .dash-jour{display:flex;flex-direction:column;align-items:center;justify-content:center;width:50px;height:50px;flex-shrink:0;border-radius:14px;background:var(--gradient,var(--accent));color:#fff;line-height:1.05}
  .dash-jour b{font-size:19px}
  .dash-jour span{font-size:10px;font-weight:700;text-transform:uppercase}
  .dash-ev-tx{display:flex;flex-direction:column;flex:1;min-width:0}
  .dash-ev-tx strong{font-size:14px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .dash-ev-tx span{font-size:12px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .dash-ev em{font-style:normal;font-size:11.5px;font-weight:700;padding:4px 10px;border-radius:999px;background:var(--accent-lt);color:var(--accent);white-space:nowrap}
  .dash-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
  .dash-actions button{display:flex;flex-direction:column;align-items:center;gap:8px;padding:14px 6px;border:1px solid var(--border);border-radius:14px;background:none;font:inherit;font-size:12px;font-weight:700;color:var(--text);cursor:pointer;transition:transform .2s,border-color .2s,box-shadow .2s}
  .dash-actions button:hover{transform:translateY(-3px);border-color:var(--accent);box-shadow:0 10px 22px color-mix(in srgb,var(--accent) 14%,transparent)}
  .dash-actions button span{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:var(--accent-lt);color:var(--accent);transition:background .2s,color .2s}
  .dash-actions button:hover span{background:var(--gradient,var(--accent));color:#fff}
  .dash-actions svg{width:19px;height:19px}
  .dash-skel{height:150px;animation:dashSkel 1.2s ease-in-out infinite alternate}
  .dash-skel.haut{height:260px}

  @keyframes dashUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
  @keyframes dashPop{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:none}}
  @keyframes dashFondu{from{opacity:0}to{opacity:1}}
  @keyframes dashOrb{50%{transform:translate(-24px,18px) scale(1.15)}}
  @keyframes dashFond{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
  @keyframes dashSkel{from{opacity:.45}to{opacity:1}}

  @media (max-width:1100px){.dash-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.dash-row{grid-template-columns:1fr}}
  @media (max-width:900px){
    .dash-hero{margin:-1.1rem -1rem 0;padding:28px 18px 66px;border-radius:0 0 22px 22px}
    .dash-logo{width:68px;height:68px}
    .dash-next{width:100%;box-sizing:border-box}
    .dash-kpis{gap:10px}
    .dash-card{padding:16px}
    .dash-kval{font-size:28px}
    #dash .dash-spark{display:none}
  }
  @media (prefers-reduced-motion:reduce){#dash *{animation:none!important;transition:none!important}}
</style>`;
