self.addEventListener("sync", (event) => {
  if (event.tag === "offline-mutations-sync") {
    event.waitUntil(
      self.clients.matchAll({ type: "window" }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: "TRIGGER_SYNC" });
        });
      })
    );
  }
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  event.waitUntil((async () => {
    let payload = {};
    try {
      payload = event.data.json();
    } catch {
      payload = { title: "TradeWorkDesk", body: event.data.text() };
    }

    const title = payload.title || "TradeWorkDesk";
    const body = payload.body || "You have a new update.";
    const url = payload.url || "/";

    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

    clients.forEach((client) => {
      client.postMessage({
        type: "PUSH_IN_APP",
        payload: {
          title,
          body,
          url,
          data: payload.data || {},
        },
      });
    });

    await self.registration.showNotification(title, {
      body,
      tag: payload.tag || "twd-push",
      icon: "icon-192.png",
      badge: "icon-192.png",
      data: {
        url,
        ...(payload.data || {}),
      },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const rawUrl = event.notification?.data?.url || "/";
  const targetUrl = (() => {
    try {
      return new URL(rawUrl, self.location.origin).toString();
    } catch {
      return new URL("/", self.location.origin).toString();
    }
  })();

  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

    for (const client of clientList) {
      try {
        if ("navigate" in client && targetUrl.startsWith(self.location.origin)) {
          await client.navigate(targetUrl);
        }
        if ("focus" in client) {
          await client.focus();
        }
        client.postMessage({ type: "PUSH_NAVIGATE", payload: { url: targetUrl } });
        return;
      } catch (error) {
        console.warn("[sw] failed to focus/navigate notification client:", error);
      }
    }

    if (self.clients.openWindow) {
      await self.clients.openWindow(targetUrl);
    }
  })());
});
