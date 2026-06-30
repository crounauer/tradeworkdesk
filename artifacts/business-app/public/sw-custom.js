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
    const hasVisibleClient = clients.some((client) => client.visibilityState === "visible");

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

    if (hasVisibleClient) return;

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
  const targetUrl = event.notification?.data?.url || "/";

  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

    for (const client of clientList) {
      if ("focus" in client) {
        if ("navigate" in client) {
          await client.navigate(targetUrl);
        }
        client.postMessage({ type: "PUSH_NAVIGATE", payload: { url: targetUrl } });
        await client.focus();
        return;
      }
    }

    if (self.clients.openWindow) {
      await self.clients.openWindow(targetUrl);
    }
  })());
});
