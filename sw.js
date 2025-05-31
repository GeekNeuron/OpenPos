// sw.js

const CACHE_NAME = 'openpos-cache-v2'; // به‌روز شده
const DATA_CACHE_NAME = 'openpos-data-cache-v1';
// !!! مهم: این آدرس را با دامنه واقعی API خودتان جایگزین کنید !!!
const API_URL_ORIGIN = 'https://api.example.com'; // مثال
// یا اگر API روی همان دامنه است اما مسیر خاصی دارد:
// const API_PATH_PATTERN = '/api/v1/positions';

const urlsToCache = [
    './',
    './index.html',
    './manifest.json',
    './css/style.css',
    './js/app.js',
    './js/api.js',
    './js/ui.js',
    './js/i18n.js',
    './js/theme.js',
    './js/validator.js',
    './locales/en.json',
    './locales/fa.json',
    './assets/images/icons/icon-192x192.png', // آیکون اصلی PWA
    './assets/images/icons/icon-512x512.png', // آیکون بزرگتر PWA
    './assets/images/moon.svg',
    './assets/images/sun.svg',
    './assets/images/translate.svg'
];

self.addEventListener('install', event => {
    console.log(`Service Worker (${CACHE_NAME}): Installing...`);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log(`Service Worker (${CACHE_NAME}): Caching app shell...`);
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log(`Service Worker (${CACHE_NAME}): App shell cached successfully. Calling skipWaiting().`);
                return self.skipWaiting();
            })
            .catch(error => {
                console.error(`Service Worker (${CACHE_NAME}): Failed to cache app shell:`, error);
            })
    );
});

self.addEventListener('activate', event => {
    console.log(`Service Worker (${CACHE_NAME}): Activating...`);
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME && cache !== DATA_CACHE_NAME) {
                        console.log(`Service Worker (${CACHE_NAME}): Clearing old static cache:`, cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => {
            console.log(`Service Worker (${CACHE_NAME}): Active and claimed clients!`);
            return self.clients.claim();
        })
    );
});

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log(`Service Worker (${CACHE_NAME}): Received SKIP_WAITING message. Activating new SW.`);
        self.skipWaiting();
    }
});

self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);

    // استراتژی برای درخواست‌های API
    // !!! مهم: این شرط را برای شناسایی صحیح درخواست‌های API خودتان تنظیم کنید !!!
    // مثال: اگر API_URL شما در app.js مثلاً 'https://my-api.com/data' است،
    // می‌توانید از requestUrl.origin === 'https://my-api.com' استفاده کنید.
    // یا اگر API_URL در app.js یک مسیر نسبی روی همین دامنه است (مثلاً '/api/data')
    // می‌توانید از requestUrl.pathname.startsWith('/api/') استفاده کنید.
    const isApiRequest = requestUrl.origin === API_URL_ORIGIN || requestUrl.href.includes("YOUR_ACTUAL_API_ENDPOINT_PATH_PATTERN_HERE");


    if (isApiRequest && event.request.method === 'GET') { // فقط درخواست‌های GET مربوط به API را با این استراتژی کش کن
        event.respondWith(
            caches.open(DATA_CACHE_NAME).then(cache => {
                return fetch(event.request)
                    .then(networkResponse => {
                        if (networkResponse.ok) {
                            console.log(`Service Worker (${CACHE_NAME}): Caching API response for: ${event.request.url}`);
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        console.log(`Service Worker (${CACHE_NAME}): Network failed, serving API from cache: ${event.request.url}`);
                        return cache.match(event.request).then(response => {
                            return response || Promise.reject('No cache match for API and network failed.');
                        });
                    });
            })
        );
        return;
    }

    // استراتژی برای فایل‌های استاتیک برنامه (Cache first, then network)
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request).then(
                    networkResponse => {
                        // فقط پاسخ‌های موفق و از نوع basic (همان دامنه) را کش کن
                        if (!networkResponse || !networkResponse.ok || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        return networkResponse;
                    }
                ).catch(error => {
                    console.error(`Service Worker (${CACHE_NAME}): Error fetching static asset ${event.request.url}:`, error);
                    // می‌توانید یک صفحه آفلاین عمومی برگردانید
                    // if (event.request.mode === 'navigate') {
                    //     return caches.match('./offline.html'); // نیازمند فایل offline.html و کش شدن آن
                    // }
                });
            })
    );
});
