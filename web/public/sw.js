const SHELL_CACHE = 'still-shell-v1'
const ASSET_CACHE = 'still-assets-v2'
const SHELL_URLS = [
  '/',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/assets/still-app-icon.png',
  '/assets/still-app-icon-192.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('still-') && ![SHELL_CACHE, ASSET_CACHE].includes(key))
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  if (/^\/(api|auth|rest|storage)(\/|$)/.test(url.pathname)) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match('/')) || Response.error()),
    )
    return
  }

  if (!['script', 'style', 'image', 'font'].includes(request.destination)) return

  event.respondWith(
    caches.open(ASSET_CACHE).then(async (cache) => {
      const cached = await cache.match(request)
      if (cached) return cached

      const response = await fetch(request)
      const isImage = response.headers.get('content-type')?.startsWith('image/')
      if (response.ok && response.type === 'basic' && (request.destination !== 'image' || isImage)) {
        await cache.put(request, response.clone())
      }
      return response
    }),
  )
})
