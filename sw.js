const CACHE = 'insulacalc-v1';
const FILES = ['./', './index.html', './manifest.json', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    if (cs.length) return cs[0].focus();
    return clients.openWindow('./');
  }));
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE_NOTIFICATION') {
    const { id, meal, delayMs } = e.data;
    setTimeout(() => {
      self.registration.showNotification('InsuCalc — Post-meal check', {
        body: `About 2 hours since your ${meal}. Time to log your post-meal glucose.`,
        icon: './icon.svg',
        badge: './icon.svg',
        tag: 'post-meal-' + id,
        renotify: true,
        data: { id }
      });
    }, delayMs);
  }
  if (e.data && e.data.type === 'CANCEL_NOTIFICATION') {
    self.registration.getNotifications({ tag: 'post-meal-' + e.data.id })
      .then(ns => ns.forEach(n => n.close()));
  }
});
