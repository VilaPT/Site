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

  const needsFreshResponse = ['script', 'style', 'worker'].includes(request.destination)
    || url.pathname.endsWith('/chamaopro-preview/index.html')
    || url.pathname.endsWith('/chamaopro/version.json');

  if (!needsFreshResponse) return;

  event.respondWith(
    fetch(request, { cache: 'no-store' }).catch(() => fetch(request)),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const clientsList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = clientsList.find((client) => client.url.includes('/Site/chamaopro/'));
    if (existing) {
      await existing.focus();
      return;
    }
    await clients.openWindow('./');
  })());
});
