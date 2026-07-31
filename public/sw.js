/* Drzewo Potrykus — shell offline. Never use Response.error() (causes ERR_FAILED). */
const CACHE = "potrykus-v2";
/** Avoid "/" — it 307-redirects and Cache.addAll fails on redirects. */
const PRECACHE = ["/drzewo", "/lista", "/manifest.webmanifest"];

function offlinePage() {
  return new Response(
    `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Offline — Drzewo Potrykus</title><style>body{font-family:system-ui,sans-serif;margin:2rem;color:#1a2e24;background:#e7efe8}a{color:#0f6b5c}</style></head><body><h1>Jesteś offline</h1><p>Nie udało się wczytać strony. Sprawdź połączenie i odśwież.</p><p><a href="/drzewo">Wróć do drzewa</a></p></body></html>`,
    {
      status: 503,
      statusText: "Service Unavailable",
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      for (const path of PRECACHE) {
        try {
          const res = await fetch(path, { cache: "reload" });
          if (res.ok) await cache.put(path, res.clone());
        } catch {
          /* skip single failure — don't abort whole install */
        }
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first, never ERR_FAILED
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(async () => {
          const cached =
            (await caches.match(req)) ||
            (await caches.match("/drzewo")) ||
            (await caches.match("/lista"));
          return cached || offlinePage();
        }),
    );
    return;
  }

  // Family API: network-first, offline fallback without Response.error()
  if (url.pathname.startsWith("/api/family")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          return (
            cached ||
            new Response(JSON.stringify({ error: "Offline" }), {
              status: 503,
              headers: { "Content-Type": "application/json" },
            })
          );
        }),
    );
    return;
  }

  // Other APIs / POSTs: leave to network (no respondWith)
  if (url.pathname.startsWith("/api/")) return;

  // Static assets: stale-while-revalidate style
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetched = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached || offlinePage());
      return cached || fetched;
    }),
  );
});
