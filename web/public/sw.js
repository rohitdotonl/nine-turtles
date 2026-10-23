// slowfeed's service worker (SPEC section 20, ENGINEERING.md → "Installable
// on phones"). With the web app manifest, it lets slowfeed be added to the
// home screen. It keeps a copy of the app itself, never of your articles:
//
// - Opening slowfeed always asks the server first, so you get the newest
//   version. Without a connection, the kept copy opens instead and says
//   plainly that slowfeed can't be reached.
// - The app's code and styles (in /assets/, whose names change with every
//   version) are kept and used from the copy. Copies no version uses any
//   more are removed when slowfeed is next opened.
// - Everything else, including all of /api/, goes straight to the server.
//
// Nothing here swaps the app while it's open: a new version starts the next
// time slowfeed is opened or reloaded.

const KEPT = "slowfeed-app-1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) if (name !== KEPT) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  // Downloads such as the OPML export are /api/ addresses: never the kept page.
  if (url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") event.respondWith(openApp(request));
  else if (url.pathname.startsWith("/assets/")) event.respondWith(appFile(request));
});

/** The page itself: from the server, or the kept copy when there's no connection. */
async function openApp(request) {
  const kept = await caches.open(KEPT);
  try {
    const response = await fetch(request);
    if (response.ok && (response.headers.get("content-type") ?? "").startsWith("text/html")) {
      const page = await response.clone().text();
      await kept.put("/", response.clone());
      await tidy(kept, page);
    }
    return response;
  } catch (problem) {
    const copy = await kept.match("/");
    if (copy) return copy;
    throw problem;
  }
}

/** The app's code and styles: their names change with their content, so a kept copy is always right. */
async function appFile(request) {
  const kept = await caches.open(KEPT);
  const copy = await kept.match(request);
  if (copy) return copy;
  const response = await fetch(request);
  if (response.ok) await kept.put(request, response.clone());
  return response;
}

/** Removes kept code and styles the current page no longer uses. */
async function tidy(kept, page) {
  const used = new Set(page.match(/\/assets\/[^"'\s)]+/g) ?? []);
  for (const request of await kept.keys()) {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/assets/") && !used.has(path)) await kept.delete(request);
  }
}
