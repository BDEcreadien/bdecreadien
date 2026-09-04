// Import OneSignal SW code pour recevoir les push notifications
// (un seul SW peut être enregistré au scope /, donc on fusionne les deux)
try { importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js'); } catch (_) {}

const CACHE = 'bde-cread-v7';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(['/assets/Logo.png', '/assets/icon-192.png']))
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

  // Ne jamais intercepter : cross-origin (Supabase, CDN...), non-GET, auth, données
  if (url.origin !== self.location.origin) return;
  if (e.request.method !== 'GET') return;
  if (url.pathname.startsWith('/_data/') || url.pathname.startsWith('/admin')) return;

  // Cache-first uniquement pour les images statiques
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico)$/)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          // Clone AVANT toute lecture — put() consomme le body du clone, on retourne l'original
          if (res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
          }
          return res;
        });
      })
    );
  }
  // Pour tout le reste (HTML, JS, CSS) : réseau normal, pas d'interception
});
