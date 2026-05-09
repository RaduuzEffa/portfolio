const CACHE_NAME = 'raduuz-effa-v4';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './admin.html',
  './style.css',
  './app.js',
  './admin.js',
  './data.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest',
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;800&family=Outfit:wght@200;400;700&family=Fira+Code:wght@400;600&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

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

self.addEventListener('fetch', (event) => {
  // Ignorujeme POST a další non-GET požadavky
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Pro data.js zkusíme vždy nejprve síť a až pak cache (network-first pro aktuálnost dat)
        if (event.request.url.includes('data.js') || event.request.url.includes('uploads/')) {
          return fetch(event.request).then((fetchRes) => {
             return caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, fetchRes.clone());
                return fetchRes;
             });
          }).catch(() => response);
        }

        // Pro ostatní stale-while-revalidate nebo cache-first
        return response || fetch(event.request).then((fetchRes) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, fetchRes.clone());
            return fetchRes;
          });
        });
      })
  );
});
