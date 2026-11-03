/* Tearsheet service worker: app shell only. Caches the HTML shell and hashed assets so the installed app opens offline;
   never touches /api (model calls) or /samples. Bricks live in localStorage, not here. */
const SHELL = 'tearsheet-shell-v1'
self.addEventListener('install', e => { e.waitUntil(caches.open(SHELL).then(c => c.add('/')).then(() => self.skipWaiting())) })
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim())) })
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin) return
  if (url.pathname.startsWith('/api/')) return
  if (e.request.mode === 'navigate') {
    // network first so a new deploy wins; the cached shell only when offline
    e.respondWith(fetch(e.request).then(r => { caches.open(SHELL).then(c => c.put('/', r.clone())); return r }).catch(() => caches.match('/')))
    return
  }
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest') {
    // hashed assets: cache first
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { caches.open(SHELL).then(c => c.put(e.request, r.clone())); return r })))
  }
})
