// LetsGo Push Notification Service Worker

self.addEventListener("push", function (event) {
  if (!event.data) return;

  try {
    var data = event.data.json();
    var title = data.title || "LetsGo";
    var options = {
      body: data.body || "",
      icon: "/lg-logo.png",
      badge: "/lg-logo.png",
      tag: data.type || "general",
      data: {
        type: data.type,
        metadata: data.metadata || {},
      },
      vibrate: [100, 50, 100],
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error("[sw] Push parse error:", err);
  }
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  var typeToPath = {
    receipt_approved: "/profile",
    receipt_rejected: "/profile",
    payout_processed: "/profile",
    tier_level_up: "/profile",
    new_message: "/profile",
    friend_request: "/profile",
    friend_accepted: "/profile",
    game_invite: "/5v3v1",
    game_advanced: "/5v3v1",
    game_complete: "/5v3v1",
    group_round_ended: "/group",
    datenight_ready: "/datenight",
    new_event: "/events",
    media_approved: "/experiences",
    media_rejected: "/experiences",
    receipt_submitted: "/businessprofile-v2",
  };

  var notifType = event.notification.data && event.notification.data.type;
  var metadata = (event.notification.data && event.notification.data.metadata) || {};
  var path = typeToPath[notifType] || "/";

  // Append game code if available
  if (notifType === "game_invite" && metadata.gameCode) {
    path = "/5v3v1?code=" + metadata.gameCode;
  }

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        for (var i = 0; i < clientList.length; i++) {
          var client = clientList[i];
          if (client.url.indexOf(self.location.origin) !== -1 && "focus" in client) {
            client.navigate(path);
            return client.focus();
          }
        }
        return clients.openWindow(path);
      })
  );
});
