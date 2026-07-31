/* Kill-switch for broken potrykus-v1 SW that caused ERR_FAILED on first visit.
 * Cleares caches, unregisters itself, and does not intercept fetches. */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clients) {
        if ("navigate" in client) {
          try {
            await client.navigate(client.url);
          } catch {
            /* ignore */
          }
        }
      }
    })(),
  );
});

/* Do not call respondWith — let the browser talk to the network. */
