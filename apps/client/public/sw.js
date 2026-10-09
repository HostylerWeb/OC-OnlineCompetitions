let cachingEnabled = false;

self.addEventListener("message", (event) => {
  if (event.data?.type === "CONFIG") {
    cachingEnabled = event.data.cachingEnabled;
  }
});

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};

  const title = data.title ?? "Online Competitions";
  const options = {
    body: data.body ?? "",
    icon: data.icon ?? "/icons/icon-192x192.svg",
    badge: data.badge ?? "/icons/icon-192x192.svg",
    data: { url: data.url ?? "/", ...data.data },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url ?? "/";
  const action = event.action;

  event.waitUntil(
    (async () => {
      if (action === "close") return;

      const clientList = await clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        if (client.url === url && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })()
  );
});

self.addEventListener("notificationclose", () => {
});
