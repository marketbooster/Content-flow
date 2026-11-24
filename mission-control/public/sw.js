// Minimale service worker: maakt de app installeerbaar. Pushmeldingen ("Je vlucht staat klaar") volgen in sprint 5.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
