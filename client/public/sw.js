/* BabyShaneAdventures service worker
 * - .glb, tessdata, fonts and icons are cache-first: heavy binaries load once.
 * - Hashed /assets are stale-while-revalidate.
 * - Navigations are network-first with the cached shell as offline fallback.
 * - API and Socket.IO traffic is never cached.
 */
const VERSION = 'bsa-v1'
const SHELL_CACHE = `${VERSION}-shell`
const ASSET_CACHE = `${VERSION}-assets`
const BINARY_CACHE = `${VERSION}-binaries`

const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/fonts/baloo2.woff2',
  '/fonts/nunito.woff2',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('bsa-') && !key.startsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

function isBinary(url) {
  return (
    url.pathname.endsWith('.glb') ||
    url.pathname.includes('/models/') ||
    url.pathname.includes('/tessdata/') ||
    url.pathname.endsWith('.traineddata.gz') ||
    url.pathname.includes('/fonts/') ||
    url.pathname.includes('/icons/') ||
    url.pathname.endsWith('.wasm') ||
    url.pathname.endsWith('.woff2')
  )
}

function isHashedAsset(url) {
  return url.pathname.startsWith('/assets/')
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response && (response.ok || response.type === 'opaque')) {
    cache.put(request, response.clone()).catch(() => {})
  }
  return response
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSET_CACHE)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone()).catch(() => {})
      return response
    })
    .catch(() => cached)
  return cached || network
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(SHELL_CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put('/index.html', response.clone()).catch(() => {})
    return response
  } catch {
    const cached = (await cache.match('/index.html')) || (await cache.match('/'))
    if (cached) return cached
    return new Response(
      '<!doctype html><meta name="viewport" content="width=device-width"><title>Offline</title><body style="font-family:system-ui;background:#ffe9ef;color:#6b4250;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center"><div style="font-size:48px">🍄</div><h1>Offline</h1><p>Reconnect to open the island.</p></div>',
      { headers: { 'content-type': 'text/html; charset=utf-8' } },
    )
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request))
    return
  }

  if (isBinary(url)) {
    event.respondWith(cacheFirst(request, BINARY_CACHE).catch(() => fetch(request)))
    return
  }

  if (isHashedAsset(url)) {
    event.respondWith(staleWhileRevalidate(request))
    return
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request)),
    )
  }
})
