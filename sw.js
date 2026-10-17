/* El Galpón · service worker: abre rápido y muestra el catálogo aunque haya poca señal */
const VERSION = 'galpon-2026.10.17';
const CORE = ['/', '/index.html', '/app.js', '/styles.css', '/firebase-config.js', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION && k !== 'galpon-img').map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
async function networkFirst(req, fallbackUrl) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(fallbackUrl || req, res.clone());
    return res;
  } catch (err) {
    return (await cache.match(fallbackUrl || req)) || (await cache.match('/')) || Response.error();
  }
}
async function cacheFirst(req, name, max) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) {
      cache.put(req, res.clone());
      cache.keys().then((ks) => { if (ks.length > max) ks.slice(0, ks.length - max).forEach((k) => cache.delete(k)); });
    }
    return res;
  } catch (err) { return hit || Response.error(); }
}
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/') || url.hostname.endsWith('googleapis.com') && !url.hostname.startsWith('firebasestorage')) return; // datos en vivo: siempre a la red
  if (req.mode === 'navigate') { e.respondWith(networkFirst(req, '/')); return; }
  if (url.origin === location.origin && /\.(js|css|webmanifest|json)$/.test(url.pathname)) { e.respondWith(networkFirst(req)); return; }
  if (/\.(png|jpe?g|webp|gif|svg)$/i.test(url.pathname) || url.hostname.startsWith('firebasestorage')) { e.respondWith(cacheFirst(req, 'galpon-img', 300)); return; }
  if (url.hostname === 'www.gstatic.com' || url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com') { e.respondWith(cacheFirst(req, VERSION, 200)); }
});
