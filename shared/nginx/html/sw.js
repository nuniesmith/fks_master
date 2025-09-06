// sw.js - Service Worker for 7Gram Dashboard PWA
// Provides offline support and caching

const CACHE_NAME = '7gram-dashboard-v2.1.0';
const STATIC_CACHE_NAME = '7gram-static-v2.1.0';
const API_CACHE_NAME = '7gram-api-v2.1.0';

// Files to cache for offline support - only existing files
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/css/main.css',
  '/assets/css/components.css',
  '/assets/css/themes/default.css',
  '/assets/css/themes/dark.css',
  '/assets/css/themes/compact.css',
  '/assets/css/themes/high-contrast.css',
  '/assets/js/main.js',
  '/assets/js/modules/serviceLoader.js',
  '/assets/js/modules/searchManager.js',
  '/assets/js/modules/themeManager.js',
  '/assets/js/modules/componentLoader.js',
  '/components/header.html',
  '/components/footer.html',
  'config/dashboard.json ',
  'config/services.json',
  'config/themes.json',
  '/manifest.json'
];

// Cache-first strategy for these file types
const CACHE_FIRST_PATTERNS = [
  /\.(?:png|jpg|jpeg|gif|svg|webp|ico)$/,
  /\.(?:css|js)$/,
  /\.(?:woff|woff2|ttf|eot)$/
];

// Network-first strategy for API calls
const NETWORK_FIRST_PATTERNS = [
  /\/api\//,
  /\/health/,
  /\.json$/
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('🔧 Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then(cache => {
        console.log('📦 Caching static assets...');
        // Cache assets one by one to avoid failures stopping the whole process
        return Promise.allSettled(
          STATIC_ASSETS.map(asset => 
            cache.add(asset).catch(error => {
              console.warn(`⚠️ Failed to cache ${asset}:`, error.message);
            })
          )
        );
      })
      .then(() => {
        console.log('✅ Service Worker: Installation complete');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ Service Worker installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker: Activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && 
                cacheName !== STATIC_CACHE_NAME && 
                cacheName !== API_CACHE_NAME) {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Take control of all clients
      self.clients.claim()
    ]).then(() => {
      console.log('✅ Service Worker: Activation complete');
    })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip Chrome extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Skip external requests (only cache same-origin)
  if (url.origin !== location.origin) {
    return;
  }
  
  event.respondWith(handleFetch(request));
});

async function handleFetch(request) {
  const url = new URL(request.url);
  
  try {
    // API requests - network first with cache fallback
    if (NETWORK_FIRST_PATTERNS.some(pattern => pattern.test(url.pathname))) {
      return await networkFirstStrategy(request);
    }
    
    // Static assets - cache first
    if (CACHE_FIRST_PATTERNS.some(pattern => pattern.test(url.pathname))) {
      return await cacheFirstStrategy(request);
    }
    
    // HTML pages - stale while revalidate
    if (request.headers.get('accept')?.includes('text/html')) {
      return await staleWhileRevalidateStrategy(request);
    }
    
    // Default to network first
    return await networkFirstStrategy(request);
    
  } catch (error) {
    console.warn('⚠️ Fetch error for', request.url, ':', error.message);
    return await handleFetchError(request);
  }
}

// Cache-first strategy for static assets
async function cacheFirstStrategy(request) {
  try {
    const cache = await caches.open(STATIC_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      // Serve from cache, update in background
      fetchAndCache(request, cache);
      return cachedResponse;
    }
    
    // Not in cache, fetch from network
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    console.warn('⚠️ Cache-first strategy failed:', error);
    throw error;
  }
}

// Network-first strategy for API calls
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful API responses
      if (request.url.includes('/config/') || request.url.includes('/api/')) {
        const cache = await caches.open(API_CACHE_NAME);
        await cache.put(request, networkResponse.clone());
      }
    }
    
    return networkResponse;
    
  } catch (error) {
    // Network failed, try cache
    const cache = await caches.open(API_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('📦 Network failed, serving from cache:', request.url);
      return cachedResponse;
    }
    
    throw error;
  }
}

// Stale while revalidate for HTML pages
async function staleWhileRevalidateStrategy(request) {
  const cache = await caches.open(STATIC_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  // Start fetch in background (don't await)
  const fetchPromise = fetch(request)
    .then(networkResponse => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(error => {
      console.warn('⚠️ Background fetch failed:', error);
    });
  
  // Return cached version immediately if available
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Wait for network if no cache
  return await fetchPromise;
}

// Background fetch and cache update
async function fetchAndCache(request, cache) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
  } catch (error) {
    // Silent fail for background updates
  }
}

// Handle fetch errors with fallbacks
async function handleFetchError(request) {
  const url = new URL(request.url);
  
  // Try to serve from any cache
  const cacheNames = [STATIC_CACHE_NAME, API_CACHE_NAME, CACHE_NAME];
  
  for (const cacheName of cacheNames) {
    try {
      const cache = await caches.open(cacheName);
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
    } catch (error) {
      // Continue to next cache
    }
  }
  
  // Return offline page for navigation requests
  if (request.mode === 'navigate') {
    return createOfflinePage();
  }
  
  // Return error response
  return new Response('Service Unavailable', { 
    status: 503, 
    statusText: 'Service Unavailable' 
  });
}

// Create offline fallback page
function createOfflinePage() {
  return new Response(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>7Gram Dashboard - Offline</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem;
          }
          
          .container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 20px;
            padding: 3rem 2rem;
            text-align: center;
            max-width: 500px;
            width: 100%;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          }
          
          h1 { 
            font-size: 2.5rem; 
            margin-bottom: 0.5rem;
            font-weight: 700;
          }
          
          h2 { 
            font-size: 1.5rem; 
            margin-bottom: 1.5rem;
            opacity: 0.9;
          }
          
          p { 
            font-size: 1.1rem; 
            line-height: 1.6;
            margin-bottom: 1rem;
            opacity: 0.8;
          }
          
          .button {
            display: inline-block;
            background: rgba(255, 255, 255, 0.2);
            border: 2px solid rgba(255, 255, 255, 0.3);
            color: white;
            padding: 1rem 2rem;
            border-radius: 50px;
            text-decoration: none;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            margin: 0.5rem;
          }
          
          .button:hover {
            background: rgba(255, 255, 255, 0.3);
            border-color: rgba(255, 255, 255, 0.5);
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
          }
          
          .status {
            margin-top: 2rem;
            padding: 1rem;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 10px;
            font-size: 0.9rem;
          }
          
          .online { color: #4ade80; }
          .offline { color: #f87171; }
          
          @media (max-width: 480px) {
            .container { padding: 2rem 1.5rem; }
            h1 { font-size: 2rem; }
            h2 { font-size: 1.25rem; }
            p { font-size: 1rem; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🏠 7Gram Dashboard</h1>
          <h2>📡 You're Offline</h2>
          <p>It looks like you're not connected to the internet. Some features may not be available until your connection is restored.</p>
          <p>Cached content will continue to work offline.</p>
          
          <div>
            <button class="button" onclick="location.reload()">🔄 Try Again</button>
            <a href="/" class="button">🏠 Go Home</a>
          </div>
          
          <div class="status">
            <div id="connection-status">
              <span class="offline">🔴 Offline</span>
            </div>
          </div>
        </div>
        
        <script>
          function updateConnectionStatus() {
            const status = document.getElementById('connection-status');
            if (navigator.onLine) {
              status.innerHTML = '<span class="online">🟢 Online - Reconnected!</span>';
              setTimeout(() => location.reload(), 1000);
            } else {
              status.innerHTML = '<span class="offline">🔴 Offline</span>';
            }
          }
          
          window.addEventListener('online', updateConnectionStatus);
          window.addEventListener('offline', updateConnectionStatus);
          
          // Check connection status on load
          updateConnectionStatus();
          
          // Periodic retry
          setInterval(() => {
            if (navigator.onLine) {
              fetch('/', { method: 'HEAD', cache: 'no-cache' })
                .then(() => location.reload())
                .catch(() => {});
            }
          }, 30000); // Check every 30 seconds
        </script>
      </body>
    </html>
  `, {
    headers: { 
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache'
    }
  });
}

// Message handling for cache management
self.addEventListener('message', event => {
  if (event.data && event.data.type) {
    switch (event.data.type) {
      case 'SKIP_WAITING':
        self.skipWaiting();
        break;
        
      case 'GET_VERSION':
        event.ports[0].postMessage({
          version: CACHE_NAME,
          caches: [STATIC_CACHE_NAME, API_CACHE_NAME]
        });
        break;
        
      case 'CLEAR_CACHE':
        event.waitUntil(clearAllCaches());
        break;
        
      default:
        console.warn('⚠️ Unknown message type:', event.data.type);
    }
  }
});

// Clear all caches
async function clearAllCaches() {
  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log('🗑️ All caches cleared');
  } catch (error) {
    console.error('❌ Failed to clear caches:', error);
  }
}

console.log('🚀 7Gram Dashboard Service Worker loaded');
console.log('📦 Cache version:', CACHE_NAME);
console.log('🔧 Features: Offline support, Asset caching, Smart fallbacks');