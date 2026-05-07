const CACHE_NAME = 'appuntamenti-v2.6';
const ASSETS = [
  'index.html',
  'manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
});

self.addEventListener('fetch', e => {
  // Ignora le chiamate API (Supabase, ecc) e i metodi non GET
  if (e.request.method !== 'GET' || e.request.url.includes('supabase.co')) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
