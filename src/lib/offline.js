/**
 * Offline Support Utilities
 * Handles offline queueing, sync, and state management
 */

/**
 * Queue a request for offline processing
 * @param {string} url - Request URL
 * @param {object} options - Fetch options
 */
export async function queueOfflineRequest(url, options) {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers not supported');
  }

  const registration = await navigator.serviceWorker.ready;
  if (!registration.controller) {
    throw new Error('Service worker not active');
  }

  registration.controller.postMessage({
    type: 'QUEUE_REQUEST',
    request: {
      url,
      options,
    },
  });
}

/**
 * Trigger sync of queued offline requests
 */
export async function syncOfflineQueue() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  if (!registration.controller) {
    return;
  }

  // Try to use Background Sync API
  if ('sync' in registration) {
    try {
      await registration.sync.register('sync-requests');
      return;
    } catch (err) {
      console.warn('Background Sync not supported:', err);
    }
  }

  // Fallback: manually sync via postMessage
  registration.controller.postMessage({
    type: 'SYNC_QUEUE',
  });
}

/**
 * Listen for offline sync events
 * @param {function} callback - Called with {type, url, response?, error?}
 */
export function onOfflineSyncEvent(callback) {
  if (!('serviceWorker' in navigator)) {
    return () => {};
  }

  const handleMessage = (event) => {
    if (event.data && (event.data.type === 'SYNC_SUCCESS' || event.data.type === 'SYNC_FAILURE')) {
      callback(event.data);
    }
  };

  navigator.serviceWorker.addEventListener('message', handleMessage);

  // Cleanup function
  return () => {
    navigator.serviceWorker.removeEventListener('message', handleMessage);
  };
}

/**
 * Cache a response manually
 * @param {string} cacheName - Cache name
 * @param {string} url - Request URL
 * @param {Response} response - Response to cache
 */
export async function cacheResponse(cacheName, url, response) {
  if (!('caches' in window)) {
    return;
  }

  try {
    const cache = await caches.open(cacheName);
    await cache.put(url, response.clone());
  } catch (err) {
    console.warn('Failed to cache response:', err);
  }
}

/**
 * Get cached response
 * @param {string} url - Request URL
 */
export async function getCachedResponse(url) {
  if (!('caches' in window)) {
    return null;
  }

  try {
    const response = await caches.match(url);
    return response;
  } catch (err) {
    console.warn('Failed to get cached response:', err);
    return null;
  }
}

/**
 * Clear all caches
 */
export async function clearAllCaches() {
  if (!('caches' in window)) {
    return;
  }

  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
  } catch (err) {
    console.warn('Failed to clear caches:', err);
  }
}

/**
 * Clear specific cache
 * @param {string} cacheName - Cache name to clear
 */
export async function clearCache(cacheName) {
  if (!('caches' in window)) {
    return;
  }

  try {
    await caches.delete(cacheName);
  } catch (err) {
    console.warn(`Failed to clear cache ${cacheName}:`, err);
  }
}

/**
 * Get cache size (approximate)
 */
export async function estimateCacheSize() {
  if (!('caches' in window)) {
    return 0;
  }

  try {
    const cacheNames = await caches.keys();
    let totalSize = 0;

    for (const name of cacheNames) {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      for (const request of keys) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          totalSize += blob.size;
        }
      }
    }

    return totalSize;
  } catch (err) {
    console.warn('Failed to estimate cache size:', err);
    return 0;
  }
}
