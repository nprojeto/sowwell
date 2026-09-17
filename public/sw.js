// Trabalhador de segundo plano do Sow Well.
//
// Sempre busca na rede primeiro. Guardar telas em cache economizaria
// dados, mas faria a pessoa ver versões antigas depois de uma correção
// — e num sistema de dinheiro isso é pior que carregar de novo.
//
// O cache serve só para dizer algo quando falta internet.

const CAIXA = 'sowwell-v1';
const OFFLINE = '/sowwell/';

self.addEventListener('install', (ev) => {
  self.skipWaiting();
  ev.waitUntil(caches.open(CAIXA).then((c) => c.addAll([OFFLINE])).catch(() => {}));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(
        nomes.filter((n) => n !== CAIXA).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;

  // dados nunca são guardados: só a rede tem a verdade
  const url = new URL(req.url);
  if (url.hostname.includes('supabase.co')) return;

  ev.respondWith(
    fetch(req)
      .then((resp) => {
        if (resp.ok && url.origin === self.location.origin) {
          const copia = resp.clone();
          caches.open(CAIXA).then((c) => c.put(req, copia)).catch(() => {});
        }
        return resp;
      })
      .catch(() => caches.match(req).then((c) => c || caches.match(OFFLINE)))
  );
});
