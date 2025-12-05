/// <reference lib="webworker" />

const CACHE_NAME = 'notebook-scraper-v1'
const RUNTIME_CACHE = 'runtime-cache-v1'

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
]

// API paths to cache with network-first strategy
const API_CACHE_PATHS = [
  '/api/v1/listings',
  '/api/v1/stats',
  '/api/v1/keywords',
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching static assets')
      return cache.addAll(STATIC_ASSETS)
    })
  )
  // Activate immediately
  self.skipWaiting()
})

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => {
            console.log('Service Worker: Deleting old cache:', name)
            return caches.delete(name)
          })
      )
    })
  )
  // Take control of all pages immediately
  self.clients.claim()
})

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Skip SSE endpoints
  if (url.pathname.includes('/progress')) return

  // API requests - Network first, fallback to cache
  if (API_CACHE_PATHS.some((path) => url.pathname.startsWith(path))) {
    event.respondWith(networkFirst(request))
    return
  }

  // Static assets and pages - Cache first, fallback to network
  if (
    request.destination === 'document' ||
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font'
  ) {
    event.respondWith(cacheFirst(request))
    return
  }

  // Default: Network only
  event.respondWith(fetch(request))
})

/**
 * Cache-first strategy: Try cache, fallback to network
 */
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request)
  if (cachedResponse) {
    // Return cached response and update cache in background
    updateCache(request)
    return cachedResponse
  }
  
  try {
    const networkResponse = await fetch(request)
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE)
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    // Return offline fallback for document requests
    if (request.destination === 'document') {
      return caches.match('/index.html')
    }
    throw error
  }
}

/**
 * Network-first strategy: Try network, fallback to cache
 */
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request)
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE)
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    throw error
  }
}

/**
 * Update cache in background (stale-while-revalidate)
 */
async function updateCache(request) {
  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE)
      cache.put(request, networkResponse.clone())
    }
  } catch (error) {
    // Silently fail - using cached version
  }
}

// Handle messages from main thread
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting()
  }
})
