self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('orbit-ledger-shell-v1').then((cache) =>
      cache.addAll(['/dashboard', '/login', '/branding/orbit-ledger-logo-transparent.png'])
    )
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
