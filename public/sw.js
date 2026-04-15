const CACHE_NAME = 'verdictcouncil-pwa-v1'
const API_CACHE_NAME = 'verdictcouncil-api-cache-v1'
const OFFLINE_URL = '/index.html'

// Core assets to cache on install
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/pwa-192.png',
  '/pwa-512.png',
]

// API endpoints that should be network-first
const API_ENDPOINTS = ['/api/v1/']

// Request queue for offline operations
let requestQueue = []

/**
 * Install Event - Cache core assets
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting()),
  )
})

/**
 * Activate Event - Clean up old caches and claim clients
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== API_CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

/**
 * Fetch Event - Serve cached or fetch from network
 */
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return
  }

  const requestUrl = new URL(event.request.url)

  // Vite dev server assets (never cache / intercept)
  // Helps avoid HMR breakage if a SW is accidentally registered in development.
  if (
    requestUrl.pathname.startsWith('/@vite/') ||
    requestUrl.pathname.startsWith('/@id/') ||
    requestUrl.pathname.startsWith('/@fs/') ||
    requestUrl.pathname.startsWith('/__vite_ping') ||
    requestUrl.pathname.startsWith('/src/') ||
    requestUrl.pathname.startsWith('/node_modules/')
  ) {
    return
  }

  // Navigation requests (HTML pages)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache successful HTML responses
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
        .catch(() => {
          // Return offline page on navigation failure
          return caches.match(OFFLINE_URL)
        }),
    )
    return
  }

  // Cross-origin requests
  if (requestUrl.origin !== self.location.origin) {
    return
  }

  // API calls - Network-first strategy with fallback to cache
  if (API_ENDPOINTS.some((endpoint) => requestUrl.pathname.startsWith(endpoint))) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache successful API responses
          if (response.ok && response.status === 200) {
            const clone = response.clone()
            caches.open(API_CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
        .catch(() => {
          // Fallback to cached API response if available
          return caches.match(event.request)
        }),
    )
    return
  }

  // Static assets - Cache-first strategy
  event.respondWith(
    caches
      .match(event.request)
      .then((cached) => {
        if (cached) {
          return cached
        }

        return fetch(event.request).then((response) => {
          // Cache successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response
          }

          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          return response
        })
      })
      .catch(() => {
        // Fallback for image assets
        if (event.request.destination === 'image') {
          return new Response(null, { status: 404 })
        }
        throw new Error('Offline and no cache available')
      }),
  )
})

/**
 * Message Event - Handle messages from clients
 * Queue offline requests and sync on reconnection
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }

  if (event.data && event.data.type === 'QUEUE_REQUEST') {
    // Queue a request for offline processing
    requestQueue.push(event.data.request)
  }

  if (event.data && event.data.type === 'SYNC_QUEUE') {
    // Process queued requests when connection is restored
    syncRequestQueue()
  }
})

/**
 * Background Sync - Sync queued requests when online
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-requests') {
    event.waitUntil(syncRequestQueue())
  }
})

/**
 * Process queued offline requests
 */
async function syncRequestQueue() {
  const queue = [...requestQueue]
  requestQueue = [] // Clear the queue

  for (const req of queue) {
    try {
      const response = await fetch(new Request(req.url, req.options))
      // Notify client of successful sync
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SYNC_SUCCESS',
            url: req.url,
            response: response.ok,
          })
        })
      })
    } catch (error) {
      // Re-queue failed requests
      requestQueue.push(req)
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SYNC_FAILURE',
            url: req.url,
            error: error.message,
          })
        })
      })
    }
  }
}

