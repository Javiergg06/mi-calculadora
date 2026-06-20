/* ===========================================================
   SERVICE WORKER — Permite usar la app sin conexión
   Cachea los archivos necesarios (HTML, CSS, JS)
   Los datos (gastos, saldo) viven en localStorage
   =========================================================== */

const CACHE_NAME = 'flux-v3';

const urlsToCache = [
  '/',
  '/index.html',
  '/app.js',
  '/styles.css',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
];

// Instalar el service worker y cachear archivos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// Activar y limpiar caches viejos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Interceptar requests
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  // No interceptar la API (chat IA) — siempre debe ir a la red
  if (url.pathname.startsWith('/api/')) return;

  const isSameOrigin = url.origin === self.location.origin;

  // ── App propia (HTML/CSS/JS): NETWORK-FIRST ──
  // Así los cambios se ven al instante; la cache es solo fallback offline.
  if (isSameOrigin) {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response && response.status === 200 && response.type !== 'error') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => caches.match(event.request).then(r => r || caches.match('/index.html')))
    );
    return;
  }

  // ── Recursos externos (fuentes, CDN): CACHE-FIRST ──
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
