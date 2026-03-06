self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();
  
  const options = {
    body: data.body,
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    image: data.image || undefined,
    tag: data.tag || undefined,
    renotify: data.renotify !== undefined ? data.renotify : true,
    silent: data.silent || false,
    requireInteraction: data.requireInteraction || false,
    vibrate: [200, 100, 200],
    timestamp: data.data?.timestamp || Date.now(),
    data: {
      url: data.url || data.data?.url || "/",
      category: data.data?.category || "general",
      rideId: data.data?.rideId,
      status: data.data?.status,
      type: data.data?.type,
      driverName: data.data?.driverName,
      vehicleInfo: data.data?.vehicleInfo,
      fare: data.data?.fare,
    },
    actions: data.actions && data.actions.length > 0
      ? data.actions.slice(0, 2)
      : [
          { action: "open", title: "View" },
          { action: "close", title: "Dismiss" },
        ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Carehub", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "close" || event.action === "dismiss") return;

  const data = event.notification.data || {};
  let urlToOpen = data.url || "/";

  if (event.action === "track" && data.rideId) {
    urlToOpen = `/my-rides?ride=${data.rideId}`;
  } else if (event.action === "contact" && data.rideId) {
    urlToOpen = `/my-rides?ride=${data.rideId}&chat=true`;
  } else if (event.action === "rate" && data.rideId) {
    urlToOpen = `/my-rides?ride=${data.rideId}&rate=true`;
  } else if (event.action === "receipt" && data.rideId) {
    urlToOpen = `/my-rides?ride=${data.rideId}`;
  } else if (event.action === "rebook") {
    urlToOpen = "/book-ride";
  } else if (event.action === "view" && data.rideId) {
    urlToOpen = data.type === "ride_request" 
      ? `/driver?ride=${data.rideId}` 
      : `/my-rides?ride=${data.rideId}`;
  }

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      return clients.openWindow(urlToOpen);
    })
  );
});

const CACHE_NAME = "carehub-v2";
const STATIC_ASSETS = [
  "/",
  "/favicon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.log("Cache addAll failed:", err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
  );
  event.waitUntil(clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.url.includes("/api/")) return;
  
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
