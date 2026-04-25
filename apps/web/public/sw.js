self.skipWaiting();

const SHELL_CACHE = 'orbit-ledger-shell-v4';
const SHELL_ASSETS = [
  '/branding/orbit-ledger-logo-transparent.png',
  '/favicon.ico',
  '/icons/favicon-16.png',
  '/icons/favicon-32.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('orbit-ledger-shell-') && key !== SHELL_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(event.request.url);

  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request));
    return;
  }

  if (
    requestUrl.origin !== self.location.origin ||
    (!requestUrl.pathname.startsWith('/branding/') &&
      !requestUrl.pathname.startsWith('/icons/') &&
      !requestUrl.pathname.endsWith('.png'))
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'opaqueredirect') {
          return response;
        }

        const cloned = response.clone();
        void caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, cloned));
        return response;
      });
    })
  );
});
