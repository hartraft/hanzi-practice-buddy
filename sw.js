const CACHE_NAME = 'hanzi-quiz-v3';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(response => {
        if (response) return response;

        return fetch(event.request).then(networkResponse => {
          // Cache hanzi stroke JSON files
          if (event.request.url.includes('/data/')) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        });
      })
    )
  );
});

