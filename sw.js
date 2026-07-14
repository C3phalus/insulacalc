const CACHE = 'insulacalc-v28';
const FILES = ['./', './index.html', './manifest.json', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
    await checkPendingNotifications();
  })());
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

self.addEventListener('periodicsync', e => {
  if (e.tag === 'check-notifs') e.waitUntil(checkPendingNotifications());
});

self.addEventListener('message', async e => {
  if (!e.data) return;
  if (e.data.type === 'SCHEDULE_NOTIFICATION') {
    const { id, meal, fireAt } = e.data;
    try { const db = await openDB(); await putPending(db, { id, meal, fireAt }); }
    catch(err) { console.warn('Schedule failed', err); }
  }
  if (e.data.type === 'CANCEL_NOTIFICATION') {
    try {
      const db = await openDB(); await deletePending(db, e.data.id);
      const ns = await self.registration.getNotifications({ tag: 'post-meal-' + e.data.id });
      ns.forEach(n => n.close());
    } catch(err) {}
  }
  if (e.data.type === 'CHECK_NOTIFICATIONS') {
    await checkPendingNotifications();
  }
});

async function checkPendingNotifications() {
  try {
    const db = await openDB();
    const pending = await getAllPending(db);
    const now = Date.now();
    for (const item of pending) {
      if (now >= item.fireAt) {
        await self.registration.showNotification('InsuCalc — Post-meal check', {
          body: `About 2 hours since your ${item.meal}. Time to log your post-meal glucose.`,
          icon: './icon.svg',
          badge: './icon.svg',
          tag: 'post-meal-' + item.id,
          renotify: true,
          vibrate: [200, 100, 200],
          data: { id: item.id }
        });
        await deletePending(db, item.id);
      }
    }
  } catch(e) { console.warn('Notification check failed', e); }
}

function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('insulacalc-notifs', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('pending', { keyPath: 'id' });
    req.onsuccess = e => res(e.target.result);
    req.onerror = e => rej(e);
  });
}
function getAllPending(db) {
  return new Promise((res, rej) => {
    const tx = db.transaction('pending', 'readonly');
    const req = tx.objectStore('pending').getAll();
    req.onsuccess = e => res(e.target.result);
    req.onerror = e => rej(e);
  });
}
function putPending(db, item) {
  return new Promise((res, rej) => {
    const tx = db.transaction('pending', 'readwrite');
    tx.objectStore('pending').put(item);
    tx.oncomplete = () => res();
    tx.onerror = e => rej(e);
  });
}
function deletePending(db, id) {
  return new Promise((res, rej) => {
    const tx = db.transaction('pending', 'readwrite');
    tx.objectStore('pending').delete(id);
    tx.oncomplete = () => res();
    tx.onerror = e => rej(e);
  });
}
