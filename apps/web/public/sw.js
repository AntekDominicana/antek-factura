const CACHE_NAME = 'antek-factura-pwa-v1';
const STATIC_ASSETS = [
  '/',
  '/app/dashboard',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
];

// Instalación del Service Worker: precacheo del shell básico
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[PWA SW] Precache error:', err);
      });
    })
  );
});

// Activación: limpieza de cachés antiguas para actualizaciones automáticas sin intervención
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

// Estrategia de peticiones:
// - Para API /v1/*: Network-Only / Network-First (datos en vivo DGII estrictos)
// - Para assets estáticos e imágenes: Stale-While-Revalidate
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Evitar interceptar endpoints de la API o webhooks para no servir datos fiscales desactualizados
  if (url.pathname.startsWith('/v1/') || url.pathname.startsWith('/api/')) {
    return;
  }

  // Peticiones no GET pasan directo
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Si offline, retorna el cachedResponse si existe
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
