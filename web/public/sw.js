// nine turtles' service worker (SPEC section 20, ENGINEERING.md → "Installable
// on phones"). With the web app manifest, it lets nine turtles be added to the
// home screen. It keeps a copy of the app itself and its fonts. (Articles kept
// for reading offline are the app's own, in its database, SPEC section 32.)
//
// - Opening nine turtles always asks the server first, so you get the newest
//   version. Without a connection, the kept copy opens instead and says
//   plainly that nine turtles can't be reached.
// - The app's code and styles (in /assets/, whose names change with every
//   version) are kept and used from the copy, the pages it loads later in
//   files of their own too. Copies no version uses any more are removed when
//   nine turtles is next opened.
// - The fonts (in /fonts/) come from the copy at once, so text never waits
//   for them or changes face as they arrive; the server is asked quietly
//   behind it ("unchanged?", a few bytes), so a new font is used from the
//   next opening. The first time, they come from the server.
// - Everything else, including all of /api/, goes straight to the server.
//
// Nothing here swaps the app while it's open: a new version starts the next
// time nine turtles is opened or reloaded.

const KEPT = "nine-turtles-app-1";

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
  // Downloads such as Download everything are /api/ addresses: never the kept page.
  if (url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") event.respondWith(openApp(request));
  else if (url.pathname.startsWith("/assets/")) event.respondWith(appFile(request));
  else if (url.pathname.startsWith("/fonts/")) event.respondWith(font(event));
});

/** A font: the kept copy at once, brought up to date behind it; the server's when there's no copy yet. */
async function font(event) {
  const request = event.request;
  const kept = await caches.open(KEPT);
  const fresh = fetch(request).then(async (response) => {
    if (response.ok) await kept.put(request, response.clone());
    return response;
  });
  const copy = await kept.match(request);
  if (!copy) return fresh;
  // Without a connection the quiet check fails; the copy is already on its way.
  event.waitUntil(fresh.catch(() => undefined));
  return copy;
}

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

/** Removes kept code and styles the current page no longer uses, nor its code loads later (its pages in files of their own). */
async function tidy(kept, page) {
  const used = new Set(page.match(/\/assets\/[^"'\s)]+/g) ?? []);
  for (const path of [...used]) {
    if (!path.endsWith(".js")) continue;
    const code = await (await kept.match(path))?.text();
    for (const named of code?.match(/assets\/[^"'\s)`]+/g) ?? []) used.add(`/${named}`);
  }
  for (const request of await kept.keys()) {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/assets/") && !used.has(path)) await kept.delete(request);
  }
}
