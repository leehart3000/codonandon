import { self } from '$app/service-worker';
import { version } from '$app/env';
import { immutable, assets, prerendered } from '$app/manifest';

// A new cache name for every deploy, so old files are never served by mistake.
const CACHE = `cache-${version}`;

// Turn a path relative to the app's base into a full pathname, e.g. "/_app/immutable/x.js".
const toPathname = (path: string) => new URL(path, self.registration.scope).pathname;

// Everything needed to run the game offline: app code, static files and prerendered pages.
const ASSETS: string[] = [
	...immutable.map((file) => toPathname(file.path)),
	...assets.map((file) => toPathname(file.path)),
	...prerendered.map((page) => toPathname(page.path))
];

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll(ASSETS);
		})()
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== CACHE) await caches.delete(key);
			}
		})()
	);
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);

	// Only handle our own files. Leave other sites (analytics, error reporting) alone.
	if (url.origin !== self.location.origin) return;

	// Never cache API calls, such as high scores. They must always be live.
	if (url.pathname.startsWith('/api/')) return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);

			// Game files are always served from the saved copy.
			if (ASSETS.includes(url.pathname)) {
				const cached = await cache.match(url.pathname);
				if (cached) return cached;
			}

			// Anything else: try the network first, fall back to a saved copy if offline.
			try {
				const response = await fetch(event.request);
				const noStore = response.headers.get('cache-control')?.includes('no-store');
				if (response.status === 200 && !noStore) {
					void cache.put(event.request, response.clone());
				}
				return response;
			} catch (error) {
				const cached = await cache.match(event.request);
				if (cached) return cached;
				throw error;
			}
		})()
	);
});

// When the page asks (after the user taps "Reload"), stop waiting and take over now.
self.addEventListener('message', (event) => {
	if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});
