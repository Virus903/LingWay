"use strict";

// Large course snapshots live in IndexedDB, not the small synchronous localStorage quota.
const offlineDatabase = new Promise((resolve, reject) => {
  const request = indexedDB.open("LingWay.Offline", 1);
  request.onupgradeneeded = () => request.result.createObjectStore("state");
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
async function offlineGet(key) {
  const db = await offlineDatabase;
  return new Promise((resolve, reject) => {
    const request = db.transaction("state").objectStore("state").get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function offlineSet(key, value) {
  const db = await offlineDatabase;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("state", "readwrite");
    tx.objectStore("state").put(value, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
async function offlineDelete(key) {
  const db = await offlineDatabase;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("state", "readwrite");
    tx.objectStore("state").delete(key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
refresh = async function () {
  data = await api("bootstrap");
  if (!data.user) { localStorage.removeItem("tt-last-user"); return; }
  try { await syncLessonProgress(); } catch { /* Local checkpoints remain available. */ }
  const key = "snapshot-" + data.user.id;
  try {
    const previous = await offlineGet(key),
      snapshot = {
        ...data,
        csrf: "",
        users: [],
        audit: [],
        groups: [], members: [], assignments: [], lesson_progress: (data.lesson_progress||[]).filter(p=>p.user_id===data.user.id),
        attempts: data.attempts.filter(a => a.user_id === data.user.id),
        durations: Object.fromEntries(data.attempts.filter(a=>a.user_id===data.user.id).map(a=>[a.id,data.durations?.[a.id]||0])),
        lessons: data.lessons.filter(l => l.published),
      };
    if (previous?.package_id)
      Object.assign(snapshot, {
        package_id: previous.package_id,
        modules: previous.modules,
        lessons: previous.lessons,
        phrases: previous.phrases,
        offline_audio: previous.offline_audio,
        package_revision: previous.package_revision,
      });
    await offlineSet(key, snapshot);
    data.offline_audio=previous?.offline_audio||{};
    try {
      const manifest=await api("offline-manifest");
      if(data.packages?.[0])data.packages[0].bytes=manifest.bytes;
    } catch { /* Package metadata is optional for the online dashboard. */ }
    localStorage.setItem("tt-last-user", String(data.user.id));
    localStorage.removeItem("tt-snapshot-" + data.user.id);
  } catch {
    notice("Не удалось обновить автономную копию. Онлайн-режим доступен.");
  }
};
downloadOffline = async function () {
  await action(async () => {
    const uid = data.user.id;
    const pkg = await api("offline-manifest");
    if (!("serviceWorker" in navigator))
      throw new Error("Браузер не поддерживает автономное обучение");
    const reg = await navigator.serviceWorker.ready;
    const shellBytes=await new Promise((resolve,reject)=>{
      const channel=new MessageChannel(),timeout=setTimeout(()=>reject(new Error("Не удалось определить размер оболочки")),20000);
      channel.port1.onmessage=e=>{clearTimeout(timeout);e.data.ok?resolve(e.data.bytes):reject(new Error(e.data.error));};
      (reg.active||navigator.serviceWorker.controller).postMessage({type:"SIZE"},[channel.port2]);
    });
    if(!confirm(`Пакет ${pkg.id}: ${((pkg.bytes+shellBytes)/1048576).toFixed(2)} МБ вместе с оболочкой, аудио и изображениями (размер данных без служебных накладных расходов браузера). Неизменённые файлы используются повторно. Загрузить?`))return;
    await new Promise((resolve, reject) => {
      const channel = new MessageChannel(),
        timeout = setTimeout(
          () => reject(new Error("Не удалось сохранить оболочку сайта")),
          20000,
        );
      channel.port1.onmessage = (e) => {
        clearTimeout(timeout);
        e.data.ok ? resolve() : reject(new Error(e.data.error));
      };
      (reg.active || navigator.serviceWorker.controller).postMessage(
        {
          type: "CACHE",
        },
        [channel.port2],
      );
    });
    const cache = await caches.open("lingway-content-v1");
    const hash = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), x=>x.toString(16).padStart(2,"0")).join("");
    for(const asset of pkg.assets) {
      if(!/^\/offline-assets\/[a-f0-9]{64}\.(json|wav|svg|js)$/.test(asset.url)) throw new Error("Недопустимый адрес файла");
      let response = await cache.match(asset.url);
      if(response && await hash(await response.clone().arrayBuffer()) !== asset.sha256) response=null;
      if(!response) {
        response=await fetch(asset.url,{cache:"no-store"});
        if(!response.ok)throw new Error("Не удалось загрузить файл пакета");
        const bytes=await response.arrayBuffer();
        if(bytes.byteLength!==asset.bytes || await hash(bytes)!==asset.sha256)throw new Error("Контрольная сумма пакета не совпала. Предыдущая версия сохранена.");
        await cache.put(asset.url,new Response(bytes,{headers:{"Content-Type":asset.type}}));
      }
    }
    const content={};
    for(const [field,urls] of Object.entries(pkg.parts))content[field]=await Promise.all(urls.map(async url=>{
      const response=await cache.match(url);if(!response)throw new Error("Неполный пакет");return response.json();
    }));
    if(data.user?.id!==uid)throw new Error("Аккаунт изменился. Загрузка не активирована.");
    const previous=await offlineGet("snapshot-"+uid);
    await offlineSet("snapshot-" + uid, {
      ...previous,
      ...content,
      package_id: pkg.id,
      package_revision: pkg.revision,
      offline_audio: pkg.audio,
      csrf: "",
      users: [],
      audit: [],
    });
    data.offline_audio=pkg.audio;
    localStorage.setItem(
      "lw-package",
      JSON.stringify({
        id: pkg.id,
        created: pkg.created,
        bytes: pkg.bytes,
      }),
    );
    localStorage.setItem("tt-offline", new Date().toISOString());
    render();
    notice(
      "Пакет версии " +
        pkg.id +
        " сохранён. Уроки и разговорник доступны без сети.",
    );
  });
};
nextStep = async function () {
  if (typeof stopLearningAudio === "function") stopLearningAudio();
  const target = nextLearningStep();
  if (target < currentLesson().steps.length) {
    training.index = target;
    Object.assign(training, {
      draft: "",
      hint: false,
      hintLevel: 0,
      feedback: null,
      tokens: [],
      alternatives: false,
      tries: 1,
    });
    persistTraining();
    render();
    return;
  }
  await action(async () => {
    persistTraining();
    const uid = data.user.id,
      attempt = {
        owner_id: uid,
        id: training.id,
        lesson_id: training.lesson_id,
        version: training.version,
        answers: training.answers,
        duration: Math.round(training.duration || 0),
      };
    try {
      const result = await api("attempt", attempt);
      sessionStorage.setItem("tt-result-" + uid, JSON.stringify(result));
      await refresh();
    } catch (e) {
      if (e.status) throw e;
      const db=await offlineDatabase;
      await new Promise((resolve,reject)=>{
        const tx=db.transaction("state","readwrite"),store=tx.objectStore("state"),request=store.get("queue-"+uid);
        request.onsuccess=()=>{
          const queue=request.result||JSON.parse(localStorage.getItem("tt-queue-"+uid)||"[]");
          if(!queue.some(a=>a.id===attempt.id))queue.push(attempt);
          store.put(queue,"queue-"+uid);
          localStorage.setItem("tt-queue-"+uid,JSON.stringify(queue));
        };
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
      });
      sessionStorage.setItem(
        "tt-result-" + uid,
        JSON.stringify({
          pending: true,
        }),
      );
    }
    completeLessonDraft(attempt.lesson_id, attempt.id);
    sessionStorage.removeItem("tt-training-" + uid);
    localStorage.removeItem("tt-training-" + uid);
    training = null;
    go("lesson-result");
    offerNotifications();
  });
};
let queueSync = null;
async function synchronizeOfflineQueue() {
  if (!data.user || !navigator.onLine) return;
  const uid = data.user.id,
    queue =
      (await offlineGet("queue-" + uid)) ||
      JSON.parse(localStorage.getItem("tt-queue-" + uid) || "[]"),
    accepted = new Set();
  for(let offset=0;offset<queue.length;offset+=50) {
    if(data.user?.id!==uid) return;
    const result=await api("attempts/batch",{owner_id:uid,attempts:queue.slice(offset,offset+50)});
    if(result.owner_id!==uid)throw new Error("Получен результат другого аккаунта");
    for(const item of result.results) {
      if(item.status===200)accepted.add(item.id);
      else notice("Результат сохранён в очереди: "+item.error);
    }
  }
  // Re-read in one write transaction: preserve attempts appended while the request was running.
  const db=await offlineDatabase;
  await new Promise((resolve,reject)=>{
    const tx=db.transaction("state","readwrite"), store=tx.objectStore("state"), request=store.get("queue-"+uid);
    request.onsuccess=()=>{
      const left=(request.result||queue).filter(a=>!accepted.has(a.id));
      store.put(left,"queue-"+uid);
      localStorage.setItem("tt-queue-"+uid,JSON.stringify(left));
    };
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });
  if (accepted.size && data.user?.id===uid) {
    await refresh();
    render();
    notice("Результаты синхронизированы");
  }
}
syncQueue = () =>
  queueSync ||
  (queueSync = synchronizeOfflineQueue().finally(() => {
    queueSync = null;
  }));
const dotnetLogout = logout;
logout = async function () {
  const uid = data.user?.id;
  const queued=uid&&await offlineGet("queue-"+uid);
  if(queued?.length&&!confirm("Есть несинхронизированные результаты. Они останутся на этом устройстве до следующего входа в этот же аккаунт. Выйти?"))return;
  await dotnetLogout();
  if (!data.user && uid) {
    await offlineDelete("snapshot-" + uid);
  }
};
const clearLegacyAccountCache = clearAccountCache;
clearAccountCache = async function (uid) {
  clearLegacyAccountCache(uid);
  await offlineDelete("snapshot-" + uid);
  await offlineDelete("queue-" + uid);
};
boot = async function () {
  try {
    await refresh();
  } catch (e) {
    const uid = localStorage.getItem("tt-last-user");
    let snapshot;
    try {
      snapshot = uid && (await offlineGet("snapshot-" + uid));
    } catch {}
    if (snapshot) {
      data = snapshot;
      notice(
        "Нет сети · открыта сохранённая версия. Управление требует подключения.",
      );
    } else notice("Сервер недоступен. Запустите LingWay.Web в Visual Studio.");
  }
  render();
  if ("serviceWorker" in navigator)
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  try {
    await syncQueue();
  } catch {}
};
const systemSpeak=speak;
speak=function(value,slow=false){
  const source=data.offline_audio?.[String(value).trim()];
  if(source){const audio=new Audio(source);audio.playbackRate=slow?0.65:1;audio.play().catch(()=>notice("Не удалось проиграть аудио. Обновите пакет."));return;}
  return systemSpeak(value,slow);
};
window.addEventListener("online",()=>syncQueue().catch(()=>{}));
setInterval(()=>syncQueue().catch(()=>{}),60000);
sendCode = async function (purpose) {
  await action(async () => {
    const email = data.user?.email || $("#f-email").value;
    const result = await api("code", {
      email,
      purpose,
    });
    notice(result.message);
  });
};
views.verify = verify;
views.reset = reset;
boot();
