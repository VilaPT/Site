self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const clientsList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = clientsList.find((client) => client.url.includes('/Site/fazja/'));
    if (existing) {
      await existing.focus();
      return;
    }
    await clients.openWindow('./');
  })());
});
