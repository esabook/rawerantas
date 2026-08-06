/// <reference types="@sveltejs/kit" />
import { build, files, version } from "$service-worker";

declare let self: ServiceWorkerGlobalScope;

const CACHE = `rawe-${version}`;
const ASSETS = [...build, ...files].filter((f) => !/\.map$/.test(f));

const isDynamic = (url: URL): boolean =>
	url.pathname.startsWith("/api/") || url.pathname.startsWith("/rest/");

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(ASSETS))
			.then(() => self.skipWaiting()),
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
				),
			)
			.then(() => self.clients.claim()),
	);
});

self.addEventListener("fetch", (event) => {
	const { request } = event;
	if (request.method !== "GET") {
		return;
	}
	const url = new URL(request.url);
	if (url.origin !== location.origin) {
		return;
	}
	if (isDynamic(url)) {
		return;
	}

	event.respondWith(
		(async () => {
			const cached = await caches.match(request);
			if (cached) {
				return cached;
			}
			if (request.mode === "navigate") {
				const index = await caches.match("/");
				if (index) {
					return index;
				}
			}
			const response = await fetch(request);
			if (response.ok) {
				const cache = await caches.open(CACHE);
				cache.put(request, response.clone());
			}
			return response;
		})(),
	);
});
