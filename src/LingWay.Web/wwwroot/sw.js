const CACHE = "lingway-dotnet-v8-learning";
const ASSETS = [
  "/",
  "/index.html",
  "/razor-templates.js",
  "/styles.css",
  "/functional.js",
  "/account.js",
  "/account.css",
  "/learning.js",
  "/assessment-policy.js",
  "/learning.css",
  "/learning_visuals.js",
  "/speech.js",
  "/offline.js",
  "/progress.js",
  "/learning-quality.js",
  "/manifest.webmanifest",
  "/icon.svg",
  "/lingway-logo-light.svg",
  "/lingway-logo-dark.svg",
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith("lingway-dotnet-") && k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("message", (e) => {
  if(e.data?.type==="SIZE")e.waitUntil((async()=>{
    try {
      const cache=await caches.open(CACHE);let bytes=0;
      for(const url of ASSETS){const response=await cache.match(url)||await fetch(url);if(!response.ok)throw new Error();bytes+=(await response.arrayBuffer()).byteLength;}
      e.ports[0]?.postMessage({ok:true,bytes});
    } catch { e.ports[0]?.postMessage({ok:false,error:"Не удалось определить размер оболочки"}); }
  })());
  if (e.data?.type === "CACHE")
    e.waitUntil(
      caches
        .open(CACHE)
        .then((c) => c.addAll(ASSETS))
        .then(() => e.ports[0]?.postMessage({ ok: true }))
        .catch(() =>
          e.ports[0]?.postMessage({
            ok: false,
            error: "Не удалось загрузить все файлы",
          }),
        ),
    );
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if(e.request.method==="GET"&&url.origin===self.location.origin&&/^\/offline-assets\/[a-f0-9]{64}\.(json|wav|svg|js)$/.test(url.pathname)) {
    e.respondWith(caches.open("lingway-content-v1").then(async cache=>{
      const response=await cache.match(url.pathname)||await fetch(e.request);
      const range=e.request.headers.get("Range");
      if(!range||response.status!==200)return response;
      const bytes=await response.arrayBuffer(), match=/^bytes=(\d+)-(\d*)$/.exec(range);
      if(!match)return new Response(null,{status:416});
      const start=Number(match[1]),end=match[2]?Math.min(Number(match[2]),bytes.byteLength-1):bytes.byteLength-1;
      if(start>end)return new Response(null,{status:416});
      return new Response(bytes.slice(start,end+1),{status:206,headers:{"Content-Type":response.headers.get("Content-Type"),"Content-Range":`bytes ${start}-${end}/${bytes.byteLength}`,"Content-Length":String(end-start+1),"Accept-Ranges":"bytes"}});
    }));return;
  }
  if (
    e.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  )
    return;
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        if (response.ok && ASSETS.includes(url.pathname)) {
          const copy = response.clone();
          caches.open(CACHE).then((c) => c.put(url.pathname, copy));
        }
        return response;
      })
      .catch(() => caches.match(url.pathname)),
  );
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data?.url || "/#dashboard"));
});
self.addEventListener("push", (e) => {
  let message;
  try {
    message = e.data.json();
  } catch {
    message = { body: "Время повторить английский" };
  }
  e.waitUntil(
    self.registration.showNotification(message.title || "LingWay", {
      body: message.body,
      icon: "/icon.svg",
      tag: "learning-reminder",
      data: { url: "/#dashboard" },
    }),
  );
});
