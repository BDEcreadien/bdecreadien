// ===================================
// BDE CREAD — Script principal
// ===================================

const labelLien = { shotgun: 'Prendre sa place', helloasso: "S'inscrire" };
const couleurLien = { shotgun: 'var(--orange)', helloasso: '#00A078' };

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
  featured.innerHTML = `
    <span class="actu-featured-tag">Événement phare</span>
    <h3 class="actu-featured-title">${first.titre}</h3>
    <p class="actu-featured-desc">${first.lieu}${first.horaire ? ' · ' + first.horaire : ''}${first.prix ? ' · ' + first.prix : ''}</p>
    ${first.lien ? `<a href="${first.lien}" target="_blank" rel="noopener noreferrer" class="btn" style="margin-top:1rem; width:auto; display:inline-block;">${labelLien[first.typeLien] || 'Billetterie'}</a>` : ''}
  `;

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
      media = `<div class="video-wrapper video-wrapper--native"><video src="${v.url}" autoplay muted loop playsinline controls style="width:100%;height:100%;display:block;border-radius:14px;" preload="auto"></video></div>`;
    } else {
      media = `<div class="video-wrapper"><iframe src="${getEmbedUrl(v.url)}" title="${v.titre || 'Vidéo BDE'}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
    }
    return `<div class="video-item reveal">${media}${v.titre ? `<p class="video-titre">${v.titre}</p>` : ''}</div>`;
  }).join('');

  grid.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
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

function renderEvenements(data) {
  const container = document.getElementById('evenements-list');
  if (!container || !data.length) return;

  container.innerHTML = data.map(ev => {
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
          <span style="font-family:'Bebas Neue',sans-serif; font-size:16px; background:var(--gradient); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;">${ev.prix}</span>
          ${ev.lien ? `<a href="${ev.lien}" target="_blank" rel="noopener noreferrer" class="btn" style="background:${couleurLien[ev.typeLien] || 'var(--violet)'}; color:white; width:auto; font-size:11px; padding:6px 14px; box-shadow:none;">${labelLien[ev.typeLien] || 'Billetterie'}</a>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');

  container.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
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
          <p class="chiffre-number">${c.number}</p>
          <p class="chiffre-label">${c.label}</p>
        </div>`).join('');
      grid.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
    }
    // Canaux de communication
    const canauxGrid = document.getElementById('canaux-grid');
    if (canauxGrid && cfg.canaux?.length) {
      canauxGrid.innerHTML = cfg.canaux.map(c => {
        const gris = c.bientot ? 'color:var(--gris-moyen);' : '';
        const icon = (CANAL_ICONS[c.type] || CANAL_ICONS.autre).replace(
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
    .then(data => { annoncesData = Array.isArray(data) ? data : (data.annonces || []); renderAnnonces(); })
    .catch(() => renderAnnonces());
}
