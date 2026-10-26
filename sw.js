// Première vente : cache pour un chargement instantané au retour et un accès hors ligne.
// La page s'affiche depuis le cache, la nouvelle version est téléchargée en arrière-plan ; si elle a changé, la page propose de recharger.
const CACHE = 'pv-v1';
const SHELL = ['/'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
const sig = r => r ? (r.headers.get('etag') || '') + '|' + (r.headers.get('last-modified') || '') + '|' + (r.headers.get('content-length') || '') : '';
async function notify() { const cs = await self.clients.matchAll({ type: 'window' }); cs.forEach(c => c.postMessage({ type: 'pv-update' })); }
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (url.pathname.startsWith('/api/') || url.pathname === '/sw.js') return;
    if (req.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
      e.respondWith((async () => {
        const c = await caches.open(CACHE); const hit = await c.match('/');
        const net = fetch(new Request(location.origin + '/', { cache: 'no-cache', credentials: 'same-origin' })).then(async r => {
          if (r.ok && r.type === 'basic' && !r.redirected) { const old = await c.match('/'); await c.put('/', r.clone()); if (old && sig(old) !== sig(r)) notify(); }
          return r;
        }).catch(() => null);
        if (hit) { e.waitUntil(net); return hit; }
        return (await net) || new Response('Hors ligne', { status: 503 });
      })());
      return;
    }
    if (url.pathname.startsWith('/kit/')) {
      e.respondWith(caches.open(CACHE).then(async c => { const hit = await c.match(req); const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit); return hit || net; }));
    }
    return;
  }
  // bibliothèques et polices aux versions fixées : servies depuis le cache
  if (url.host === 'cdn.jsdelivr.net' || url.host === 'cdnjs.cloudflare.com' || url.host === 'fonts.gstatic.com' || url.host === 'fonts.googleapis.com') {
    e.respondWith(caches.open(CACHE).then(async c => { const hit = await c.match(req); if (hit) return hit; const r = await fetch(req); if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }));
  }
});
