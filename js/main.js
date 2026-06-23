// ===================================
// BDE CREAD — Script principal
// ===================================

const labelLien = { shotgun: 'Prendre sa place', helloasso: "S'inscrire" };
const couleurLien = { shotgun: 'var(--orange)', helloasso: '#00A078' };

// Transitions entre pages — overlay dégradé BDE (exclu sur admin)
(function () {
  if (window.location.pathname.includes('admin')) return;
  const overlay = document.createElement('div');
  overlay.id = 'page-transition-overlay';
  overlay.innerHTML = `<img src="assets/Logo.png" alt="BDE CREAD" width="72" height="72" style="border-radius:50%;object-fit:cover;box-shadow:0 4px 24px rgba(0,0,0,0.25);">`;
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:99999;
    background:linear-gradient(135deg,#7B2FBE 0%,#C4391C 100%);
    display:flex;align-items:center;justify-content:center;
    opacity:1;transition:opacity 0.18s ease;pointer-events:all;
  `;
  document.documentElement.appendChild(overlay);

  // Fade out au chargement
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      overlay.style.opacity = '0';
      setTimeout(() => { overlay.style.pointerEvents = 'none'; }, 180);
    });
  });

  // Fade in au clic sur un lien interne
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('http') || a.target === '_blank') return;
      a.addEventListener('click', e => {
        e.preventDefault();
        overlay.style.pointerEvents = 'all';
        overlay.style.opacity = '1';
        setTimeout(() => { window.location.href = href; }, 180);
      });
    });
  });
})();

// Navigation scroll
const nav = document.querySelector('nav');
if (nav) {
  const handleScroll = () => {
    if (window.scrollY > 40) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  };
  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();
}

// Révélation au scroll
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ===================================
// ACCUEIL — Événements dynamiques
// ===================================

function renderActu(data) {
  const featured = document.getElementById('actu-featured');
  const list = document.getElementById('actu-list');
  if (!featured || !list) return;

  if (!data.length) {
    featured.innerHTML = '<span class="actu-featured-tag">Événement phare</span><h3 class="actu-featured-title">Aucun événement</h3>';
    return;
  }

  const phareIdx = data.findIndex(e => e.phare);
  const first = phareIdx >= 0 ? data[phareIdx] : data[0];
  const rest = data.filter((_, i) => i !== (phareIdx >= 0 ? phareIdx : 0));

  // Compte à rebours
  let countdownHtml = '';
  if (first.date) {
    const eventDate = new Date(first.date);
    const now = new Date();
    const diff = eventDate - now;
    if (diff > 0) {
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      if (days === 0) countdownHtml = `<span class="actu-countdown">Aujourd'hui !</span>`;
      else if (days === 1) countdownHtml = `<span class="actu-countdown">Demain</span>`;
      else countdownHtml = `<span class="actu-countdown">Dans ${days} jour${days > 1 ? 's' : ''}</span>`;
    } else if (diff > -86400000) {
      countdownHtml = `<span class="actu-countdown" style="background:rgba(232,81,0,0.15);color:var(--orange);">C'est aujourd'hui !</span>`;
    }
  }

  // Photo de couverture
  const imgUrl = typeof first.imageUrl === 'object' ? first.imageUrl?.url : first.imageUrl;
  if (imgUrl) {
    const coverUrl = imgUrl.startsWith('/') ? `https://raw.githubusercontent.com/BDEcreadien/bdecreadien/main${imgUrl}` : imgUrl;
    featured.style.backgroundImage = `url('${coverUrl}')`;
    featured.style.backgroundSize = 'cover';
    featured.style.backgroundPosition = 'center';
  } else {
    featured.style.backgroundImage = '';
  }

  featured.innerHTML = `
    <span class="actu-featured-tag">Événement phare</span>
    ${countdownHtml}
    <h3 class="actu-featured-title">${first.titre}</h3>
    <p class="actu-featured-desc">${first.lieu}${first.horaire ? ' · ' + first.horaire : ''}${first.prix ? ' · ' + first.prix : ''}</p>
    <div style="display:flex;gap:0.75rem;margin-top:1rem;flex-wrap:wrap;align-items:center;">
      ${first.lien ? `<a href="${first.lien}" target="_blank" rel="noopener noreferrer" class="btn" style="width:auto;display:inline-block;">${labelLien[first.typeLien] || 'Billetterie'}</a>` : ''}
      <button class="btn-share btn-share-featured" aria-label="Partager cet événement">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        Partager
      </button>
    </div>
  `;
  featured.querySelector('.btn-share-featured')?.addEventListener('click', () => partagerEvenement(first.titre, first.date || ''));

  const delays = ['reveal-delay-2', 'reveal-delay-3', 'reveal-delay-4'];
  list.innerHTML = rest.slice(0, 3).map((ev, i) => {
    const d = new Date(ev.date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = d.toLocaleString('fr-FR', { month: 'short' });
    return `<div class="actu-item reveal ${delays[i] || ''}">
      <div class="actu-item-date"><span class="day">${day}</span><span class="month">${month}</span></div>
      <div class="actu-item-content"><h3>${ev.titre}</h3><p>${ev.lieu}${ev.horaire ? ' · ' + ev.horaire : ''}</p></div>
      ${ev.lien ? `<a href="${ev.lien}" target="_blank" rel="noopener noreferrer" class="actu-item-link" style="flex-shrink:0; font-size:11px; font-weight:700; color:var(--violet); text-decoration:none; white-space:nowrap;">Billetterie</a>` : ''}
    </div>`;
  }).join('');

  list.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
}

function partagerEvenement(titre, date) {
  const url = window.location.origin + '/agenda.html';
  const text = `🗓 ${titre}${date ? ' — ' + new Date(date).toLocaleDateString('fr-FR', {day:'numeric',month:'long'}) : ''} · BDE CREAD Lyon`;
  if (navigator.share) {
    navigator.share({ title: titre, text, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(`${text}\n${url}`).then(() => {
      const btn = document.querySelector('.btn-share');
      if (btn) { btn.textContent = '✓ Copié !'; setTimeout(() => { btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> Partager'; }, 2000); }
    });
  }
}

if (document.getElementById('actu-featured')) {
  fetch('/_data/evenements.json')
    .then(r => r.json())
    .then(data => renderActu(Array.isArray(data) ? data : (data.evenements || [])))
    .catch(() => {});
}

// ===================================
// VIDÉOS — Chargement & Rendu
// ===================================

function getEmbedUrl(url) {
  if (!url) return null;
  // YouTube
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  // Vimeo
  const vi = url.match(/vimeo\.com\/(\d+)/);
  if (vi) return `https://player.vimeo.com/video/${vi[1]}`;
  return url;
}

function renderVideos(data) {
  const grid = document.getElementById('videos-grid');
  if (!grid) return;
  if (!data.length) return;

  grid.innerHTML = data.map(v => {
    let media;
    if (v.type === 'photo') {
      media = `<div class="video-wrapper"><img src="${v.url}" alt="${v.titre || 'Photo BDE'}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" loading="lazy"></div>`;
    } else if (v.type === 'video') {
      media = `<div class="video-wrapper video-wrapper--native"><video src="${v.url}" muted loop playsinline controls style="width:100%;height:100%;display:block;border-radius:14px;" preload="auto"></video></div>`;
    } else {
      media = `<div class="video-wrapper"><iframe src="${getEmbedUrl(v.url)}" title="${v.titre || 'Vidéo BDE'}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
    }
    return `<div class="video-item reveal">${media}${v.titre ? `<p class="video-titre">${v.titre}</p>` : ''}</div>`;
  }).join('');

  grid.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  const videoObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const vid = entry.target;
      if (entry.isIntersecting) { vid.play().catch(() => {}); }
      else { vid.pause(); }
    });
  }, { threshold: 0.3 });

  grid.querySelectorAll('video').forEach(vid => videoObserver.observe(vid));
}

if (document.getElementById('videos-grid')) {
  fetch('/_data/videos.json')
    .then(r => r.json())
    .then(data => renderVideos(Array.isArray(data) ? data : (data.videos || [])))
    .catch(() => {});
}

// ===================================
// MENU HAMBURGER MOBILE
// ===================================

const burger = document.getElementById('nav-burger');
const navLinks = document.querySelector('.nav-links');

if (burger && navLinks) {
  function closeMobileMenu() {
    burger.classList.remove('open');
    navLinks.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
  }

  burger.addEventListener('click', () => {
    const isOpen = burger.classList.toggle('open');
    navLinks.classList.toggle('open', isOpen);
    burger.setAttribute('aria-expanded', String(isOpen));
  });

  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeMobileMenu);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMobileMenu();
  });
}

// ===================================
// MODAL EXPORT CALENDRIER
// ===================================

const ICAL_URL = 'https://calendar.google.com/calendar/ical/4ecec32ec639d124f22369adfff74b9d7d91ef12bb10ef4751686bb166a9d49b%40group.calendar.google.com/public/basic.ics';

function openModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) {
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
}

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => {
      closeModal(m.id);
    });
  }
});

// Tabs modal
document.querySelectorAll('.modal-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const group = tab.closest('.modal-tabs').dataset.group;
    document.querySelectorAll(`.modal-tab[data-group="${group}"]`).forEach(t => t.classList.remove('active'));
    document.querySelectorAll(`.modal-tab-content[data-group="${group}"]`).forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    const target = document.getElementById(tab.dataset.target);
    if (target) target.classList.add('active');
  });
});

// Copier lien iCal
function copyIcal() {
  navigator.clipboard.writeText(ICAL_URL).then(() => {
    const btn = document.getElementById('copy-ical-btn');
    if (btn) {
      btn.textContent = 'Copié !';
      setTimeout(() => { btn.textContent = 'Copier le lien'; }, 2000);
    }
  });
}

// ===================================
// ÉVÉNEMENTS — Chargement & Rendu
// ===================================

const CAT_LABELS = { soiree: 'Soirée', sortie: 'Sortie', atelier: 'Atelier', autre: 'Autre' };

function renderEvenements(allData) {
  const container = document.getElementById('evenements-list');
  if (!container) return;

  if (!allData.length) { container.innerHTML = '<p style="color:var(--gris-texte);font-size:13px;text-align:center;padding:1rem;">Aucun événement à venir.</p>'; return; }

  // Injecter barre de recherche + filtres au-dessus de la liste
  const controlsId = 'agenda-search-controls';
  if (!document.getElementById(controlsId)) {
    const ctrl = document.createElement('div');
    ctrl.id = controlsId;
    ctrl.style.cssText = 'margin-bottom:1rem;';
    container.parentNode.insertBefore(ctrl, container);
  }

  const cats = ['tous', ...new Set(allData.map(e => e.categorie).filter(Boolean))];
  document.getElementById(controlsId).innerHTML = `
    <input id="agenda-search" type="search" placeholder="Rechercher un événement…"
      style="width:100%;padding:9px 12px;border:1.5px solid var(--gris-border);border-radius:10px;font-size:13px;margin-bottom:0.6rem;outline:none;">
    <div style="display:flex;flex-wrap:wrap;gap:6px;">
      ${cats.map(c => `<button class="agenda-filter-btn ${c==='tous'?'active':''}" data-cat="${c}"
        style="padding:5px 12px;border-radius:20px;border:1.5px solid ${c==='tous'?'var(--violet)':'var(--gris-border)'};background:${c==='tous'?'var(--violet)':'white'};color:${c==='tous'?'white':'var(--gris-texte)'};font-size:12px;font-weight:600;cursor:pointer;">
        ${c==='tous'?'Tout voir':CAT_LABELS[c]||c}
      </button>`).join('')}
    </div>`;

  let currentCat = 'tous';
  let currentSearch = '';

  function applyFilter() {
    const filtered = allData.filter(ev => {
      const matchCat = currentCat === 'tous' || ev.categorie === currentCat;
      const matchSearch = !currentSearch || ev.titre.toLowerCase().includes(currentSearch) || (ev.lieu||'').toLowerCase().includes(currentSearch);
      return matchCat && matchSearch;
    });
    drawList(filtered);
  }

  document.getElementById('agenda-search').addEventListener('input', e => { currentSearch = e.target.value.toLowerCase().trim(); applyFilter(); });
  document.getElementById(controlsId).querySelectorAll('.agenda-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentCat = btn.dataset.cat;
      document.getElementById(controlsId).querySelectorAll('.agenda-filter-btn').forEach(b => {
        const on = b.dataset.cat === currentCat;
        b.style.background = on ? 'var(--violet)' : 'white';
        b.style.borderColor = on ? 'var(--violet)' : 'var(--gris-border)';
        b.style.color = on ? 'white' : 'var(--gris-texte)';
      });
      applyFilter();
    });
  });

  function drawList(data) {
  container.innerHTML = data.length ? data.map(ev => {
    const d = new Date(ev.date);
    const day = d.getDate().toString().padStart(2,'0');
    const month = d.toLocaleString('fr-FR', { month: 'short' });
    return `<div class="actu-item reveal" style="padding:1rem; border-radius:12px; border:1px solid var(--gris-border); background:white; gap:1rem;">
      <div class="actu-item-date" style="min-width:46px;">
        <span class="day">${day}</span>
        <span class="month">${month}</span>
      </div>
      <div style="flex:1; min-width:0;">
        <h4 style="font-family:'Barlow Condensed',sans-serif; font-size:15px; font-weight:700; color:var(--noir); line-height:1.2;">${ev.titre}</h4>
        <p style="font-size:12px; color:var(--gris-texte); margin-top:3px;">${ev.lieu}</p>
        ${ev.horaire ? `<p style="font-size:12px; color:var(--gris-texte); margin-top:1px;">${ev.horaire}</p>` : ''}
        <div style="display:flex; align-items:center; justify-content:space-between; margin-top:6px; flex-wrap:wrap; gap:6px;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="font-family:'Bebas Neue',sans-serif; font-size:16px; background:var(--gradient); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;">${ev.prix}</span>
            ${ev.inscrits ? `<span class="ev-inscrits"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>${ev.inscrits} inscrits</span>` : ''}
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            ${ev.lien ? `<a href="${ev.lien}" target="_blank" rel="noopener noreferrer" class="btn" style="background:${couleurLien[ev.typeLien] || 'var(--violet)'}; color:white; width:auto; font-size:11px; padding:6px 14px; box-shadow:none;">${labelLien[ev.typeLien] || 'Billetterie'}</a>` : ''}
            <button class="btn-ics" data-titre="${ev.titre.replace(/"/g,'&quot;')}" data-date="${ev.date||''}" data-horaire="${(ev.horaire||'').replace(/"/g,'&quot;')}" data-lieu="${(ev.lieu||'').replace(/"/g,'&quot;')}" data-desc="${(ev.description||'').replace(/"/g,'&quot;')}" aria-label="Ajouter au calendrier">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            </button>
            <button class="btn-share" data-titre="${ev.titre.replace(/"/g,'&quot;')}" data-date="${ev.date || ''}" style="font-size:11px;padding:5px 10px;" aria-label="Partager">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('') : '<p style="color:var(--gris-texte);font-size:13px;text-align:center;padding:1rem;">Aucun résultat.</p>';
  container.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
  container.querySelectorAll('.btn-share[data-titre]').forEach(btn => {
    btn.addEventListener('click', () => partagerEvenement(btn.dataset.titre, btn.dataset.date));
  });
  }  // end drawList

  applyFilter();
}

if (document.getElementById('evenements-list')) {
  fetch('/_data/evenements.json')
    .then(r => r.json())
    .then(data => renderEvenements(Array.isArray(data) ? data : (data.evenements || [])))
    .catch(() => renderEvenements([]));
}

// ===================================
// ARCHIVES — Chargement & Rendu
// ===================================

function renderArchives(data) {
  const grid = document.getElementById('archives-grid');
  if (!grid) return;
  if (!data.length) { grid.innerHTML = '<p style="color:var(--gris-texte);text-align:center;padding:2rem;">Aucun événement passé pour le moment.</p>'; return; }
  const delays = ['reveal-delay-1','reveal-delay-2','reveal-delay-3','reveal-delay-4','','reveal-delay-1'];
  grid.innerHTML = data.map((a, i) => `
    <div class="archive-card reveal ${delays[i % delays.length]}">
      <div class="archive-card-date">
        <span class="day">${a.day}</span>
        <span class="month">${a.month}</span>
      </div>
      <div class="archive-card-content">
        <h3>${a.titre}</h3>
        <p>${a.lieu}</p>
        <span class="archive-tag">${a.tag}</span>
      </div>
    </div>
  `).join('');
  grid.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
}

if (document.getElementById('archives-grid')) {
  fetch('/_data/archives.json')
    .then(r => r.json())
    .then(data => renderArchives(Array.isArray(data) ? data : []))
    .catch(() => renderArchives([]));
}

// ===================================
// CONFIG — Chiffres clés & Contact
// ===================================

const CANAL_ICONS = {
  instagram: `<svg width="28" height="28" viewBox="0 0 24 24" fill="var(--violet)"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>`,
  email: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
  whatsapp: `<svg width="28" height="28" viewBox="0 0 24 24" fill="var(--violet)"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`,
  discord: `<svg width="28" height="28" viewBox="0 0 24 24" fill="var(--violet)"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>`,
  facebook: `<svg width="28" height="28" viewBox="0 0 24 24" fill="var(--violet)"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
  linkedin: `<svg width="28" height="28" viewBox="0 0 24 24" fill="var(--violet)"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`,
  tiktok: `<svg width="28" height="28" viewBox="0 0 24 24" fill="var(--violet)"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>`,
  youtube: `<svg width="28" height="28" viewBox="0 0 24 24" fill="var(--violet)"><path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>`,
  telephone: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .84h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>`,
  site: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>`,
  teams: `<svg width="28" height="28" viewBox="0 0 24 24" fill="var(--gris-moyen)"><path d="M19.5 3.5L18 2l-1.5 1.5L15 2l-1.5 1.5L12 2l-1.5 1.5L9 2 7.5 3.5 6 2 4.5 3.5 3 2v20l1.5-1.5L6 22l1.5-1.5L9 22l1.5-1.5L12 22l1.5-1.5L15 22l1.5-1.5L18 22l1.5-1.5L21 22V2l-1.5 1.5zm-1.5 15H6V5.5h12V18.5zM8 13h8v1.5H8zm0-3h8v1.5H8zm0-3h8v1.5H8z"/></svg>`,
  autre: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>`
};

fetch(`/_data/config.json?t=${Date.now()}`)
  .then(r => r.json())
  .then(cfg => {
    // Chiffres
    const grid = document.getElementById('chiffres-grid');
    if (grid && cfg.chiffres?.length) {
      const delays = ['', 'reveal-delay-1', 'reveal-delay-2', 'reveal-delay-3'];
      grid.innerHTML = cfg.chiffres.map((c, i) => `
        <div class="chiffre-item reveal ${delays[i] || ''}">
          <p class="chiffre-number" data-target="${c.number}">${c.number}</p>
          <p class="chiffre-label">${c.label}</p>
        </div>`).join('');

      const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const el = entry.target.querySelector('.chiffre-number');
          if (!el || el.dataset.animated) return;
          el.dataset.animated = '1';
          const raw = el.dataset.target;
          const suffix = raw.replace(/[\d]/g, '');
          const target = parseInt(raw.replace(/\D/g, ''), 10);
          if (isNaN(target)) return;
          const duration = 1200;
          const start = performance.now();
          const update = (now) => {
            const p = Math.min((now - start) / duration, 1);
            const ease = 1 - Math.pow(1 - p, 3);
            el.textContent = Math.round(target * ease) + suffix;
            if (p < 1) requestAnimationFrame(update);
          };
          requestAnimationFrame(update);
          counterObserver.unobserve(entry.target);
        });
      }, { threshold: 0.5 });

      grid.querySelectorAll('.chiffre-item').forEach(el => {
        revealObserver.observe(el);
        counterObserver.observe(el);
      });
    }
    // Canaux de communication
    const canauxGrid = document.getElementById('canaux-grid');
    if (canauxGrid && cfg.canaux?.length) {
      canauxGrid.innerHTML = cfg.canaux.map(c => {
        const gris = c.bientot ? 'color:var(--gris-moyen);' : '';
        const icon = (CANAL_ICONS[c.picto || c.type] || CANAL_ICONS.autre).replace(
          /var\(--violet\)/g, c.bientot ? 'var(--gris-moyen)' : 'var(--violet)'
        );
        const inner = `
          ${c.bientot ? '<span class="badge-bientot">Bientôt</span>' : ''}
          <div class="comm-card-icon" aria-hidden="true">${icon}</div>
          <div>
            <p class="comm-card-title" style="${gris}">${c.nom}</p>
            <p class="comm-card-desc" style="${gris}">${c.description}</p>
          </div>
          <p class="comm-card-link" style="${gris}" aria-hidden="true">${c.lienLabel}</p>`;
        if (c.bientot || !c.lien) {
          return `<div class="comm-card">${inner}</div>`;
        }
        const isEmail = c.lien.startsWith('mailto:');
        return `<a href="${c.lien}" ${isEmail ? '' : 'target="_blank" rel="noopener noreferrer"'} class="comm-card">${inner}</a>`;
      }).join('');
    }
  })
  .catch(() => {});

// ===================================
// ÉQUIPE — Chargement & Rendu
// ===================================

function renderEquipe(data) {
  const container = document.getElementById('equipe-container');
  if (!container) return;
  if (!data.length) { container.innerHTML = '<p style="color:var(--gris-texte);text-align:center;padding:2rem;">Aucun membre pour le moment.</p>'; return; }

  const poles = [
    { key: 'bureau', label: 'Bureau exécutif' },
    { key: 'evenements', label: 'Pôle Événements' },
    { key: 'communication', label: 'Pôle Communication' }
  ];
  const delays = ['reveal-delay-1','reveal-delay-2','reveal-delay-3','reveal-delay-4'];

  container.innerHTML = poles.map(pole => {
    const membres = data.filter(m => m.pole === pole.key);
    if (!membres.length) return '';
    return `<div class="pole-section reveal">
      <p class="pole-label">${pole.label}</p>
      <ul class="equipe-grid" role="list">
        ${membres.map((m, i) => {
          const photoUrl = m.photo?.startsWith('/') ? `https://raw.githubusercontent.com/BDEcreadien/bdecreadien/main${m.photo}` : (m.photo || '');
          return `<li class="equipe-card reveal ${delays[i] || ''}">
            <div class="equipe-avatar">
              ${photoUrl ? `<img src="${photoUrl}" alt="Photo de ${m.nom}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
              <span class="equipe-avatar-fallback" aria-hidden="true" style="${photoUrl ? '' : 'display:flex'}">${m.initiales || ''}</span>
            </div>
            <h3>${m.nom}</h3>
            <p class="role">${m.role}</p>
          </li>`;
        }).join('')}
      </ul>
    </div>`;
  }).join('');

  container.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
}

if (document.getElementById('equipe-container')) {
  fetch('/_data/equipe.json')
    .then(r => r.json())
    .then(data => renderEquipe(Array.isArray(data) ? data : []))
    .catch(() => renderEquipe([]));
}

// ===================================
// GALERIE PHOTOS — Communication
// ===================================
if (document.getElementById('galerie-grid')) {
  fetch(`/_data/galerie.json?t=${Date.now()}`)
    .then(r => r.json())
    .then(items => {
      const photos = Array.isArray(items) ? items : [];
      const grid = document.getElementById('galerie-grid');
      if (!photos.length) { document.getElementById('galerie-section')?.style.setProperty('display','none'); return; }
      grid.innerHTML = photos.map(p => {
        const url = p.url.startsWith('/') ? `https://raw.githubusercontent.com/BDEcreadien/bdecreadien/main${p.url}` : p.url;
        return `<div class="galerie-item reveal">
          <img src="${url}" alt="${p.titre || 'Photo BDE'}" loading="lazy" onerror="this.parentElement.style.display='none'">
          ${p.titre ? `<span class="galerie-caption">${p.titre}</span>` : ''}
        </div>`;
      }).join('');
      grid.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
    })
    .catch(() => {});
}

// ===================================
// ANNONCES — Chargement & Filtres
// ===================================

const badgeLabels = {
  materiel: 'Matériel',
  place: 'Places',
  logement: 'Logement',
  autre: 'Autre'
};

let annoncesData = [];

function renderAnnonces(filtre = 'tous') {
  const grid = document.getElementById('annonces-grid');
  const empty = document.getElementById('annonces-empty');
  if (!grid) return;

  const filtered = filtre === 'tous'
    ? annoncesData
    : annoncesData.filter(a => a.categorie === filtre);

  if (filtered.length === 0) {
    grid.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  grid.innerHTML = filtered.map(a => `
    <div class="annonce-card reveal">
      ${a.photo ? `<img class="annonce-photo" src="${a.photo.startsWith('/') ? 'https://raw.githubusercontent.com/BDEcreadien/bdecreadien/main' + a.photo : a.photo}" alt="${a.titre}" loading="lazy">` : ''}
      <div class="annonce-header">
        <span class="annonce-badge badge-${a.categorie}">${badgeLabels[a.categorie]}</span>
        <span class="annonce-prix">${a.prix}</span>
      </div>
      <h3 class="annonce-title">${a.titre}</h3>
      <p class="annonce-desc">${a.description}</p>
      <div class="annonce-footer">
        <div class="annonce-meta">
          <span class="annonce-auteur">${a.auteur}</span>
          <span class="annonce-date">${a.date}</span>
        </div>
        <a href="mailto:${a.contact}" class="annonce-contact">Contacter</a>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
}

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
    renderAnnonces(btn.dataset.filter);
  });
});

if (document.getElementById('annonces-grid')) {
  fetch('/_data/annonces.json')
    .then(r => r.json())
    .then(data => {
      annoncesData = Array.isArray(data) ? data : (data.annonces || []);
      // Mettre à jour les compteurs sur les filtres
      document.querySelectorAll('.filter-btn').forEach(btn => {
        const f = btn.dataset.filter;
        const count = f === 'tous' ? annoncesData.length : annoncesData.filter(a => a.categorie === f).length;
        const badge = count > 0 ? ` <span style="background:rgba(255,255,255,0.3);border-radius:99px;padding:1px 7px;font-size:11px;">${count}</span>` : '';
        btn.innerHTML = btn.textContent.trim() + badge;
      });
      renderAnnonces();
    })
    .catch(() => renderAnnonces());
}

// ===================================
// ICS — Télécharger événement
// ===================================
function downloadICS(titre, date, horaire, lieu, description) {
  if (!date) return;
  // Parse date et heure de début
  const d = new Date(date);
  const [hDebut, hFin] = (horaire || '').split(/\s*[–—-]\s*/);
  function parseHeure(h) {
    if (!h) return null;
    const clean = h.trim().replace('h', ':').replace('H', ':');
    const [hh, mm] = clean.split(':');
    return { h: parseInt(hh) || 0, m: parseInt(mm) || 0 };
  }
  function toICSDate(dateObj, heure) {
    const y = dateObj.getFullYear();
    const mo = String(dateObj.getMonth() + 1).padStart(2, '0');
    const da = String(dateObj.getDate()).padStart(2, '0');
    if (!heure) return `${y}${mo}${da}`;
    const hh = String(heure.h).padStart(2, '0');
    const mm = String(heure.m).padStart(2, '0');
    return `${y}${mo}${da}T${hh}${mm}00`;
  }
  const debut = parseHeure(hDebut);
  const fin = parseHeure(hFin);
  const dtstart = debut ? toICSDate(d, debut) : toICSDate(d, null);
  const dtend = fin ? toICSDate(d, fin) : (debut ? toICSDate(d, { h: debut.h + 2, m: debut.m }) : toICSDate(d, null));
  const allDay = !debut;
  const dtProp = allDay ? `DTSTART;VALUE=DATE:${dtstart}\nDTEND;VALUE=DATE:${dtend}` : `DTSTART:${dtstart}\nDTEND:${dtend}`;
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BDE CREAD Lyon//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@bdecreadien.fr`,
    dtProp,
    `SUMMARY:${titre}`,
    lieu ? `LOCATION:${lieu}` : '',
    description ? `DESCRIPTION:${description.replace(/\n/g, '\\n')}` : '',
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean).join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${titre.replace(/[^a-zA-Z0-9À-ž ]/g, '').trim().replace(/\s+/g, '_')}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Délégation d'événement pour boutons .ics
document.addEventListener('click', e => {
  const btn = e.target.closest('.btn-ics');
  if (!btn) return;
  downloadICS(
    btn.dataset.titre || '',
    btn.dataset.date || '',
    btn.dataset.horaire || '',
    btn.dataset.lieu || '',
    btn.dataset.desc || ''
  );
});

// ===================================
// GALERIE — Lightbox avec swipe
// ===================================
let galeriePhotos = [];
let lightboxIndex = 0;

function openLightbox(index) {
  lightboxIndex = index;
  const overlay = document.getElementById('lightbox-overlay');
  if (!overlay) return;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  renderLightbox();
}

function closeLightbox() {
  const overlay = document.getElementById('lightbox-overlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function lightboxNav(dir) {
  const next = lightboxIndex + dir;
  if (next < 0 || next >= galeriePhotos.length) return;
  lightboxIndex = next;
  renderLightbox();
}

function renderLightbox() {
  const p = galeriePhotos[lightboxIndex];
  if (!p) return;
  const rawUrl = p.url.startsWith('/') ? `https://raw.githubusercontent.com/BDEcreadien/bdecreadien/main${p.url}` : p.url;
  document.getElementById('lightbox-img').src = rawUrl;
  document.getElementById('lightbox-caption').textContent = p.titre || '';
  document.getElementById('lightbox-counter').textContent = `${lightboxIndex + 1} / ${galeriePhotos.length}`;
  document.getElementById('lightbox-prev').disabled = lightboxIndex === 0;
  document.getElementById('lightbox-next').disabled = lightboxIndex === galeriePhotos.length - 1;
}

// Injection du DOM lightbox
if (document.getElementById('galerie-grid')) {
  const lb = document.createElement('div');
  lb.id = 'lightbox-overlay';
  lb.className = 'lightbox-overlay';
  lb.innerHTML = `
    <button class="lightbox-close" onclick="closeLightbox()" aria-label="Fermer">✕</button>
    <button class="lightbox-nav lightbox-prev" id="lightbox-prev" onclick="lightboxNav(-1)" aria-label="Précédent">‹</button>
    <button class="lightbox-nav lightbox-next" id="lightbox-next" onclick="lightboxNav(1)" aria-label="Suivant">›</button>
    <div class="lightbox-inner">
      <div class="lightbox-counter" id="lightbox-counter"></div>
      <img class="lightbox-img" id="lightbox-img" alt="Photo BDE CREAD">
      <p class="lightbox-caption" id="lightbox-caption"></p>
    </div>`;
  document.body.appendChild(lb);

  // Fermer en cliquant sur l'overlay
  lb.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });

  // Clavier
  document.addEventListener('keydown', e => {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'ArrowLeft') lightboxNav(-1);
    if (e.key === 'ArrowRight') lightboxNav(1);
    if (e.key === 'Escape') closeLightbox();
  });

  // Touch swipe
  let touchStartX = 0;
  lb.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) lightboxNav(dx < 0 ? 1 : -1);
  });
}

// Patch renderGalerie pour ouvrir la lightbox au clic
const _origGalerieBlock = document.getElementById('galerie-grid');
if (_origGalerieBlock) {
  // On surcharge le fetch galerie pour stocker les photos ET attacher les clics
  fetch(`/_data/galerie.json?t=${Date.now()}`)
    .then(r => r.json())
    .then(items => {
      galeriePhotos = Array.isArray(items) ? items : [];
      const grid = document.getElementById('galerie-grid');
      if (!galeriePhotos.length) { document.getElementById('galerie-section')?.style.setProperty('display','none'); return; }
      grid.innerHTML = galeriePhotos.map((p, i) => {
        const url = p.url.startsWith('/') ? `https://raw.githubusercontent.com/BDEcreadien/bdecreadien/main${p.url}` : p.url;
        return `<div class="galerie-item reveal" data-index="${i}" onclick="openLightbox(${i})" role="button" tabindex="0" aria-label="Voir la photo${p.titre ? ' : ' + p.titre : ''}">
          <img src="${url}" alt="${p.titre || 'Photo BDE'}" loading="lazy" onerror="this.parentElement.style.display='none'">
          ${p.titre ? `<span class="galerie-caption">${p.titre}</span>` : ''}
        </div>`;
      }).join('');
      grid.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
      grid.querySelectorAll('.galerie-item').forEach(el => {
        el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openLightbox(parseInt(el.dataset.index)); });
      });
    })
    .catch(() => {});
}

// ===================================
// PARTENAIRES — Chargement & Rendu
// ===================================
function renderPartenaires(items) {
  const grid = document.getElementById('partenaires-grid');
  const empty = document.getElementById('partenaires-empty');
  if (!grid) return;
  if (!items.length) {
    grid.style.display = 'none';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  grid.innerHTML = items.map((p, i) => {
    const logoHtml = p.logo
      ? `<img class="partenaire-logo" src="${p.logo.startsWith('/') ? 'https://raw.githubusercontent.com/BDEcreadien/bdecreadien/main' + p.logo : p.logo}" alt="Logo ${p.nom}" loading="lazy">`
      : `<div class="partenaire-logo-placeholder">${(p.nom || '?').slice(0, 2).toUpperCase()}</div>`;
    const inner = `${logoHtml}
      <p class="partenaire-nom">${p.nom}</p>
      ${p.description ? `<p class="partenaire-desc">${p.description}</p>` : ''}
      ${p.lien ? `<span class="partenaire-lien">Voir le site →</span>` : ''}`;
    return p.lien
      ? `<a href="${p.lien}" target="_blank" rel="noopener noreferrer" class="partenaire-card reveal">${inner}</a>`
      : `<div class="partenaire-card reveal">${inner}</div>`;
  }).join('');
  grid.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
}

if (document.getElementById('partenaires-grid')) {
  fetch('/_data/partenaires.json')
    .then(r => r.json())
    .then(data => renderPartenaires(Array.isArray(data) ? data : []))
    .catch(() => renderPartenaires([]));
}
