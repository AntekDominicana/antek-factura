const CACHE_NAME = 'antek-factura-pwa-v4';
const STATIC_ASSETS = [
  '/manifest.json',
  '/favicon.png',
  '/brand/icon-a.png',
  '/brand/logo-dark.png',
  '/icons/icon-192.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[PWA SW] Precache warning:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Nunca interceptar navegaciones HTML, redirecciones de Next.js, RSC ni endpoints API
  if (
    req.mode === 'navigate' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/v1/') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/') ||
    url.searchParams.has('_rsc')
  ) {
    return;
  }

  // Solo cachear imágenes estáticas / íconos / manifest
  const isStaticAsset =
    url.pathname.startsWith('/brand/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/favicon.png' ||
    url.pathname === '/manifest.json';

  if (!isStaticAsset) return;

  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse || Response.error());

      return cachedResponse || fetchPromise;
    })
  );
});
