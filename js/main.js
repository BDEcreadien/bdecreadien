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
// MENU HAMBURGER MOBILE
// ===================================

const burger = document.getElementById('nav-burger');
const mobileOverlay = document.getElementById('nav-mobile-overlay');

if (burger && mobileOverlay) {
  function closeMobileMenu() {
    burger.classList.remove('open');
    mobileOverlay.classList.remove('open');
    document.body.style.overflow = '';
    burger.setAttribute('aria-expanded', 'false');
    mobileOverlay.setAttribute('aria-hidden', 'true');
  }

  burger.addEventListener('click', () => {
    const isOpen = burger.classList.toggle('open');
    mobileOverlay.classList.toggle('open', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
    burger.setAttribute('aria-expanded', String(isOpen));
    mobileOverlay.setAttribute('aria-hidden', String(!isOpen));
  });

  mobileOverlay.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeMobileMenu);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && burger.classList.contains('open')) closeMobileMenu();
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
// ÉVÉNEMENTS — Données & Rendu
// ===================================

const evenementsData = [
  {
    id: 1,
    titre: 'Soirée de fin d\'année',
    date: '2026-07-04',
    dateAffichage: 'Vendredi 4 juillet 2026',
    lieu: 'Ninkasi Gerland, Lyon',
    description: 'La grande soirée de fin d\'année du BDE CREAD. Ne ratez pas ça !',
    prix: '10€',
    lien: null,          // ex: 'https://shotgun.live/fr/events/...'
    typeLien: null,      // 'shotgun' | 'helloasso' | null
  },
  {
    id: 2,
    titre: 'Afterwork BDE',
    date: '2026-06-27',
    dateAffichage: 'Vendredi 27 juin 2026',
    lieu: 'À définir',
    description: 'Un verre entre créadiens pour fêter la fin du semestre.',
    prix: 'Gratuit',
    lien: null,
    typeLien: null,
  }
];

const labelLien = { shotgun: '🎟 Prendre sa place', helloasso: '✅ S\'inscrire' };
const couleurLien = { shotgun: 'var(--orange)', helloasso: '#00A078' };

function renderEvenements() {
  const container = document.getElementById('evenements-list');
  if (!container || evenementsData.length === 0) return;

  container.innerHTML = evenementsData.map(ev => `
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
  renderEvenements();
}

// ===================================
// ANNONCES — Données & Filtres
// ===================================

const SHEET_ID = 'VOTRE_GOOGLE_SHEET_ID';
const annoncesData = [
  {
    id: 1,
    categorie: 'materiel',
    titre: 'Table à dessin A1 Rotring',
    description: 'Table à dessin professionnelle en très bon état, utilisée 2 ans. Idéale pour les L1/L2.',
    prix: '80 €',
    auteur: 'Léa M.',
    date: '18 juin 2026',
    contact: 'lea.m@cread.fr'
  },
  {
    id: 2,
    categorie: 'place',
    titre: 'Place concert — Bon Entendeur',
    description: 'Une place pour le concert de Bon Entendeur au Ninkasi le 28 juin. Plus disponible pour y aller.',
    prix: '25 €',
    auteur: 'Hugo D.',
    date: '17 juin 2026',
    contact: 'hugo.d@cread.fr'
  },
  {
    id: 3,
    categorie: 'logement',
    titre: 'Sous-location studio Presqu\'île — Août',
    description: 'Studio 18m² entièrement meublé, proche tram, disponible tout le mois d\'août. Loyer charges comprises.',
    prix: '520 €/mois',
    auteur: 'Emma R.',
    date: '15 juin 2026',
    contact: 'emma.r@cread.fr'
  },
  {
    id: 4,
    categorie: 'materiel',
    titre: 'Maquettes + matériaux divers',
    description: 'Lot de matériaux pour maquettes : balsa, carton plume, colle, pinces. Fin d\'année, je vide mon atelier.',
    prix: 'À débattre',
    auteur: 'Nathan P.',
    date: '14 juin 2026',
    contact: 'nathan.p@cread.fr'
  },
  {
    id: 5,
    categorie: 'autre',
    titre: 'Covoiturage Lyon → Paris',
    description: 'Covoiturage tous les vendredis soir vers Paris, retour dimanche. 2 places disponibles.',
    prix: '30 €/trajet',
    auteur: 'Chloé B.',
    date: '12 juin 2026',
    contact: 'chloe.b@cread.fr'
  }
];

const badgeLabels = {
  materiel: 'Matériel',
  place: 'Places',
  logement: 'Logement',
  autre: 'Autre'
};

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
  renderAnnonces();
}
