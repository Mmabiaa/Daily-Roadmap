// Service worker with a freshness-first strategy.
// Bump CACHE whenever the caching behaviour changes so old caches are purged.
const CACHE = 'daily-roadmap-v2'
const OFFLINE_ASSETS = ['/', '/manifest.webmanifest', '/icon-light-32x32.png', '/apple-icon.png']

// Take over as soon as possible so a new deploy is used immediately.
self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(OFFLINE_ASSETS)).catch(() => {})
  )
})

// Delete every cache that isn't the current version, then control open pages.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Only handle same-origin requests; let the network handle the rest.
  if (url.origin !== self.location.origin) return

  // Never cache API/data requests — always go to the network.
  if (url.pathname.startsWith('/api/')) return

  // Navigations (the HTML document): network-first so the latest version wins,
  // falling back to the cached copy only when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request)
          if (fresh && fresh.ok && !fresh.redirected) {
            const cache = await caches.open(CACHE)
            cache.put(request, fresh.clone())
          }
          return fresh
        } catch {
          const cached = await caches.match(request)
          return cached || (await caches.match('/')) || Response.error()
        }
      })()
    )
    return
  }

  // Next.js build output is content-hashed and immutable, so cache-first is safe.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request)
        if (cached) return cached
        const fresh = await fetch(request)
        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE)
          cache.put(request, fresh.clone())
        }
        return fresh
      })()
    )
    return
  }

  // Other assets (icons, manifest, etc.): network-first with cache fallback.
  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(request)
        if (fresh && fresh.ok && !fresh.redirected) {
          const cache = await caches.open(CACHE)
          cache.put(request, fresh.clone())
        }
        return fresh
      } catch {
        const cached = await caches.match(request)
        return cached || Response.error()
      }
    })()
  )
})
