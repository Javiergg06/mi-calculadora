/* ===========================================================
   SERVICE WORKER — Permite usar la app sin conexión
   Cachea los archivos necesarios (HTML, CSS, JS)
   Los datos (gastos, saldo) viven en localStorage
   =========================================================== */

const CACHE_NAME = 'calculadora-gastos-v1';

const urlsToCache = [
  '/',
  '/index.html',
  '/app.js',
  '/styles.css',
  '/manifest.json',
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
  // Solo cachear GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Si está en cache, devolverlo
      if (response) {
        return response;
      }

      // Si no está en cache, intentar traerlo de internet
      return fetch(event.request).then((response) => {
        // No cachear si la respuesta es un error
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        // Cachear la respuesta exitosa
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(() => {
        // Si falla internet, devolver la versión en cache (ya debería estar)
        return caches.match(event.request);
      });
    })
  );
});
