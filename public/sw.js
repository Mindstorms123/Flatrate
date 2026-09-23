/* Flatrate service worker: offline ticket view + wallet-file hand-off. */
const CACHE = "flatrate-v1";
const SHARED = "flatrate-shared-pass";
const SHELL = ["/", "/tickets", "/trip"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        SHELL.map(async (url) => {
          try {
            const res = await fetch(url, { cache: "reload" });
            if (res.ok) await cache.put(url, res.clone());
          } catch {
            /* offline during install is fine */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE && k !== SHARED).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

/** Stores a shared/downloaded .pkpass so the page can pick it up. */
async function storeSharedPass(request) {
  try {
    const form = await request.formData();
    const file = form.get("ticket") || form.get("file");
    if (file && typeof file !== "string") {
      const cache = await caches.open(SHARED);
      await cache.put(
        "/__shared-pass",
        new Response(file, {
          headers: {
            "content-type": "application/vnd.apple.pkpass",
            "x-file-name": encodeURIComponent(file.name || "ticket.pkpass"),
          },
        }),
      );
      return Response.redirect("/tickets?shared=1", 303);
    }
  } catch {
    /* fall through */
  }
  return Response.redirect("/tickets?shared=failed", 303);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method === "POST" && url.pathname === "/share-pass") {
    event.respondWith(storeSharedPass(request));
    return;
  }

  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_serverFn/") || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          if (fresh.ok) {
            const cache = await caches.open(CACHE);
            await cache.put(new Request(url.pathname), fresh.clone());
          }
          return fresh;
        } catch {
          const cache = await caches.open(CACHE);
          return (
            (await cache.match(new Request(url.pathname))) ??
            (await cache.match("/tickets")) ??
            (await cache.match("/")) ??
            new Response("Offline", { status: 503 })
          );
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(request);
      if (hit) {
        void fetch(request)
          .then((res) => (res.ok ? cache.put(request, res.clone()) : undefined))
          .catch(() => undefined);
        return hit;
      }
      try {
        const res = await fetch(request);
        if (res.ok) await cache.put(request, res.clone());
        return res;
      } catch {
        return new Response("Offline", { status: 503 });
      }
    })(),
  );
});
