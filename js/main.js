// ===================================
// BDE CREAD — Script principal
// ===================================

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

  grid.innerHTML = data.map(v => `
    <div class="video-item reveal">
      <div class="video-wrapper">
        <iframe src="${getEmbedUrl(v.url)}" title="${v.titre || 'Vidéo BDE'}" frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen loading="lazy"></iframe>
      </div>
      ${v.titre ? `<p class="video-titre">${v.titre}</p>` : ''}
    </div>
  `).join('');

  grid.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
}

if (document.getElementById('videos-grid')) {
  fetch('/_data/videos.json')
    .then(r => r.json())
    .then(data => renderVideos(data))
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

const labelLien = { shotgun: 'Prendre sa place', helloasso: "S'inscrire" };
const couleurLien = { shotgun: 'var(--orange)', helloasso: '#00A078' };

function renderEvenements(data) {
  const container = document.getElementById('evenements-list');
  if (!container || !data.length) return;

  container.innerHTML = data.map(ev => `
    <div class="actu-item reveal" style="padding:1.5rem; border-radius:16px; border:1px solid rgba(70,58,144,0.1); background:white; align-items:flex-start; gap:1.5rem;">
      <div class="actu-item-date">
        <span class="day">${new Date(ev.date).getDate().toString().padStart(2,'0')}</span>
        <span class="month">${new Date(ev.date).toLocaleString('fr-FR',{month:'short'})}</span>
      </div>
      <div style="flex:1;">
        <h3 style="font-family:'Barlow Condensed',sans-serif; font-size:19px; font-weight:700; color:var(--noir);">${ev.titre}</h3>
        <p style="font-size:13px; color:var(--gris-texte); margin-top:4px;">📍 ${ev.lieu}</p>
        <p style="font-size:14px; font-weight:300; color:var(--gris-texte); margin-top:8px; line-height:1.5;">${ev.description}</p>
        <div style="display:flex; align-items:center; justify-content:space-between; margin-top:1rem; flex-wrap:wrap; gap:0.75rem;">
          <span style="font-family:'Bebas Neue',sans-serif; font-size:20px; background:var(--gradient); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;">${ev.prix}</span>
          ${ev.lien ? `<a href="${ev.lien}" target="_blank" rel="noopener noreferrer" class="btn" style="background:${couleurLien[ev.typeLien]}; color:white; width:auto; font-size:12px; padding:10px 20px; box-shadow:none;">${labelLien[ev.typeLien]}</a>` : '<span style="font-size:12px; color:var(--gris-moyen); font-style:italic;">Lien d\'inscription bientôt disponible</span>'}
        </div>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
}

if (document.getElementById('evenements-list')) {
  fetch('/_data/evenements.json')
    .then(r => r.json())
    .then(data => renderEvenements(data))
    .catch(() => renderEvenements([]));
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
    .then(data => { annoncesData = data; renderAnnonces(); })
    .catch(() => renderAnnonces());
}
