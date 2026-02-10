import { createPartialResponse } from "workbox-range-requests";
import { registerRoute } from "workbox-routing";

const DOWNLOADS_CACHE = "downloads-v1";

registerRoute(
  ({ url, request }) =>
    request.method === "GET" && url.origin === self.location.origin && url.pathname === "/api/offline-media",
  async ({ request }) => {
    const cache = await caches.open(DOWNLOADS_CACHE);
    const cached = await cache.match(request, { ignoreVary: true });
    if (cached) {
      const range = request.headers.get("range");
      if (range) {
        try {
          return await createPartialResponse(request, cached);
        } catch {
          return cached;
        }
      }
      return cached;
    }

    return fetch(request);
  }
);

