/* A Menza · Zárás – service worker
   Az app héja (HTML, ikonok, betűk, könyvtárak) gyorsítótárból azonnal betölt.
   A Firebase adat- és belépési kérései NEM mennek a gyorsítótárba. */
const CACHE = "menza-zaras-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];
const RUNTIME_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com", "www.gstatic.com", "cdn.jsdelivr.net"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Oldal: előbb hálózat (mindig a friss verzió), net nélkül a mentett példány
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put("./index.html", copy));
      return res;
    }).catch(() => caches.match("./index.html")));
    return;
  }
  // Saját fájlok, betűk, Firebase SDK, xlsx: gyorsítótár, háttérben frissítve
  const same = url.origin === self.location.origin;
  const isFirebaseSdk = url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/");
  if (same || (RUNTIME_HOSTS.includes(url.hostname) && (url.hostname !== "www.gstatic.com" || isFirebaseSdk))) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => { if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
  // Minden más (Firebase adatbázis, belépés) a hálózaton megy, változatlanul
});
