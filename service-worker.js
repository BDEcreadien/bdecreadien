const CACHE = 'bde-cread-v1';
const PRECACHE = [
  '/',
  '/index.html',
  '/agenda.html',
  '/annonces.html',
  '/communication.html',
  '/partenaires.html',
  '/contact.html',
  '/css/style.css',
  '/js/main.js',
  '/assets/Logo.png',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first pour les données JSON, cache-first pour les assets statiques
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Toujours réseau pour les données et l'admin
  if (url.pathname.startsWith('/_data/') || url.pathname.startsWith('/admin')) {
    return;
  }

  // Cache-first pour CSS/JS/images
  if (url.pathname.match(/\.(css|js|png|jpg|jpeg|svg|webp|woff2?)$/)) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }))
    );
    return;
  }

  // Network-first pour les pages HTML
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// Push notifications (OneSignal gère ça, mais on garde le handler de base)
self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'BDE CREAD Lyon', {
      body: data.body || 'Nouvelle publication sur le site du BDE.',
      icon: '/assets/icon-192.png',
      badge: '/assets/icon-192.png',
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data?.url || '/'));
});
