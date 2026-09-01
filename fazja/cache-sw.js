const FRESH_DESTINATIONS = new Set(['script','style','worker']);

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const freshAsset = FRESH_DESTINATIONS.has(request.destination)
    || url.pathname.endsWith('/fazja-preview/index.html')
    || url.pathname.endsWith('/fazja/version.json');

  if (!freshAsset) return;

  event.respondWith(
    fetch(request, { cache: 'no-store' }).catch(() => fetch(request))
  );
});
