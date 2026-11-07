// Import OneSignal SW code pour recevoir les push notifications
// (un seul SW peut être enregistré au scope /, donc on fusionne les deux)
try { importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js'); } catch (_) {}

const CACHE = 'bde-cread-v12';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(['/assets/Logo.png', '/assets/icon-192.png?v=4']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Ne jamais intercepter : cross-origin (Supabase, CDN...), non-GET
  if (url.origin !== self.location.origin) return;
  if (e.request.method !== 'GET') return;

  // HTML et racine : toujours réseau frais, bypass total du cache HTTP
  if (url.pathname === '/' || url.pathname.endsWith('.html')) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }));
    return;
  }

  // Données dynamiques : bypass cache
  if (url.pathname.startsWith('/_data/')) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }));
    return;
  }

  // Cache-first uniquement pour les images statiques
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico)$/)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
          }
          return res;
        });
      })
    );
    return;
  }
  // Pour tout le reste (JS, CSS, fonts) : réseau normal, pas d'interception
});
