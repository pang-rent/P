// 장성_차량현황판 서비스워커
// - 목적: 오프라인/네트워크 불안정 시에도 앱 껍데기(화면)는 뜨게 하기 위함
// - Firebase 실시간 데이터는 절대 캐싱하지 않음 (항상 최신 데이터가 우선)
//
// ⚠️ 파일을 수정해서 다시 배포할 때는 아래 CACHE_NAME 버전을 올려주세요.
// 버전을 안 올리면 예전에 캐싱된 화면이 계속 뜰 수 있습니다.
const CACHE_NAME = 'jangsung-board-v1';

// 앱이 켜질 때 최소한으로 필요한 껍데기 파일들만 미리 캐싱합니다.
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // GET 요청이 아니거나, 이 사이트(같은 origin)가 아닌 요청(Firebase, Firestore, gstatic 등)은
  // 서비스워커가 손대지 않고 그대로 네트워크로 보냅니다. → 실시간 데이터는 항상 최신 유지
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  // 화면 이동(HTML) 요청: 네트워크를 우선 시도해서 항상 최신 버전을 받아오고,
  // 오프라인일 때만 캐시된 화면을 보여줍니다.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 그 외 정적 파일(아이콘 등): 캐시에 있으면 캐시를 먼저 보여주고,
  // 뒤에서 조용히 네트워크로 최신 버전을 받아 캐시를 갱신합니다.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
