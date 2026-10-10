// sw.js - Service Worker for GeneTrace PWA (Production v1.1.0)
const CACHE_NAME = 'genetrace-v1.1.0';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './assets/icon-192.svg',
    './assets/icon-512.svg',
    './data/restriction-enzymes.json',
    './css/core.css',
    './css/workspace.css',
    './css/components.css',
    './css/themes.css',
    './css/responsive.css',
    './css/premium.css',
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
    './js/phylogeny/tree-renderer.js',
    './js/identification/batch.js',
    './js/identification/sixteen-s.js',
    './js/identification/its.js',
    './js/identification/eighteen-s.js',
    './js/identification/virus.js',
    './js/identification/unknown.js',
    './js/smart-router/smart-router.js',
    './js/evidence/evidence-engine.js',
    './js/rawlab/ab1-parser.js',
    './js/rawlab/ab1-qc.js',
    './js/rawlab/chromatogram-viewer.js',
    './js/rawlab/fastq-parser.js',
    './js/rawlab/fastq-qc.js',
    './js/rawlab/fastq-filter.js',
    './js/rawlab/format-converter.js',
    './js/rawlab/rawlab-ui.js',
    './js/visualization/organism-3d.js',
    './js/visualization/taxonomy-tree.js',
    './js/firebase/firebase-config.js',
    './js/firebase/auth.js',
    './js/firebase/firestore.js',
    './js/firebase/feature-manager.js',
    './js/firebase/firestore-rules.js',
    './js/auth/auth-ui.js',
    './js/admin/admin.js',
    './js/admin/admin-feature-manager.js',
    './js/admin/admin-users.js',
    './js/admin/admin-analytics.js',
    './js/dashboard/user-dashboard.js',
    './js/storage/indexeddb.js',
    './js/storage/projects.js',
    './js/ui/sequence-viewer.js',
    './js/ui/charts.js',
    './js/reports/report.js',
    './js/external/blast.js'
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
    if (event.request.method !== 'GET') return;

    const requestUrl = new URL(event.request.url);

    // Rule: Do not cache external scientific services or CDNs unless necessary
    if (requestUrl.origin !== self.location.origin) {
        event.respondWith(
            fetch(event.request).catch(err => {
                return new Response(JSON.stringify({ error: 'External service unavailable offline' }), {
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
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                });
                return networkResponse;
            });
        }).catch(() => {
            if (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) {
                return caches.match('./index.html');
            }
        })
    );
});

self.addEventListener('message', event => {
    if (event.data && event.data.action === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
