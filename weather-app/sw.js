
const CACHE = 'sky-note-v1';

const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './images/sunny.svg',
    './images/cloudy.svg',
    './images/rainy.svg',
    './images/night.svg'
];

// Install
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(ASSETS))
    );

    self.skipWaiting();
});

// Activate
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(k => k !== CACHE)
                    .map(k => caches.delete(k))
            )
        )
    );

    self.clients.claim();
});

// Fetch
self.addEventListener('fetch', e => {
    if (
        e.request.method !== 'GET' ||
        new URL(e.request.url).origin !== self.location.origin
    ) {
        return;
    }

    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});
