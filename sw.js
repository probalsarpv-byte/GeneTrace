// sw.js - Service Worker for GeneTrace PWA (Production v1.0.0)
const CACHE_NAME = 'genetrace-v1.0.0';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './css/core.css',
    './css/workspace.css',
    './css/components.css',
    './css/themes.css',
    './css/responsive.css',
    './js/version.js',
    './js/app.js',
    './js/router.js',
    './js/core/fasta-parser.js',
    './js/core/sequence-validator.js',
    './js/core/sequence-stats.js',
    './js/core/sequence-type.js',
    './js/nucleotide/reverse-complement.js',
    './js/nucleotide/translation.js',
    './js/nucleotide/orf.js',
    './js/nucleotide/gc-profile.js',
    './js/nucleotide/motif.js',
    './js/nucleotide/mutation.js',
    './js/nucleotide/primer.js',
    './js/nucleotide/restriction.js',
    './js/alignment/identity.js',
    './js/alignment/alignment-viewer.js',
    './js/phylogeny/newick.js',
    './js/phylogeny/tree-viewer.js',
    './js/identification/batch.js',
    './js/identification/sixteen-s.js',
    './js/external/blast.js',
    './js/reports/report.js',
    './js/storage/indexeddb.js',
    './js/storage/projects.js',
    './js/ui/sequence-viewer.js',
    './js/ui/charts.js',
    './data/restriction-enzymes.json',
    './manifest.json',
    './assets/icon-192.svg',
    './assets/icon-512.svg'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async cache => {
            for (const asset of ASSETS_TO_CACHE) {
                try {
                    await cache.add(asset);
                } catch (e) {
                    // Non-critical if optional asset fails during initial caching
                }
            }
        })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('SW: Removing outdated cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    // Only handle GET requests
    if (event.request.method !== 'GET') return;

    const requestUrl = new URL(event.request.url);

    // Rule: Do not cache external scientific services (NCBI, EBI, etc.)
    if (requestUrl.origin !== self.location.origin) {
        event.respondWith(
            fetch(event.request).catch(err => {
                // Do not cache or fabricate results for failed external queries
                return new Response(JSON.stringify({ error: 'External service unavailable' }), {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' }
                });
            })
        );
        return;
    }

    // Local assets: serve from cache if present, fallback to network
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;

            return fetch(event.request).then(networkResponse => {
                // Do not cache non-200 or error responses
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }
                return networkResponse;
            }).catch(() => {
                // Fallback to cached index.html for navigation requests
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});

self.addEventListener('message', event => {
    if (event.data && event.data.action === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
