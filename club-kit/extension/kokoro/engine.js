// SmallBall Radio · Kokoro voices: the engine frame. The radio (radio.js, a content script on
// play.smallball.com) puts this page in a hidden iframe only after the person turns Kokoro on, and talks to it
// over a private MessageChannel. This page runs at the extension's own origin, so the model, the voice files
// and the clip cache live in the extension's storage, not the site's, and survive browser restarts.
//   • the model + voices: transformers.js / kokoro-js keep them in the Cache API ("transformers-cache",
//     "kokoro-voices") the first time they're downloaded
//   • generated clips: IndexedDB, bounded (oldest-used dropped first), so stock calls like "Ball one." are
//     instant the next game
const SITE = "https://play.smallball.com";
const DB = "sbx-radio-kokoro", CLIP_LIMIT = 40 * 1024 * 1024, CLIP_MAX = 20 * 24000 * 2;   // 40 MB in all; no clip over 20 s
let port = null, worker = null, db = null, clipBytes = 0;
const waiting = new Map();   // job id → the say message, while the worker makes it

addEventListener("message", (e) => {
  if (port || e.source !== parent || e.origin !== SITE || !e.data || e.data.t !== "sbx-kokoro-hello" || !e.ports[0]) return;
  port = e.ports[0];
  port.onmessage = (ev) => handle(ev.data || {}).catch((err) => send({ t: "error", error: String((err && err.message) || err) }));
  send({ t: "hello" });
});
const send = (m, tr) => port && port.postMessage(m, tr || []);

// ---- the clip cache ----
function idb() {
  if (db) return Promise.resolve(db);
  return new Promise((res, rej) => {
    let rq; try { rq = indexedDB.open(DB, 1); } catch (e) { rej(e); return; }
    rq.onupgradeneeded = () => { const d = rq.result; d.createObjectStore("meta", { keyPath: "k" }).createIndex("used", "used"); d.createObjectStore("pcm", { keyPath: "k" }); };
    rq.onsuccess = () => { db = rq.result; db.onversionchange = () => { db.close(); db = null; }; res(db); };
    rq.onerror = () => rej(rq.error);
  });
}
const tx = (stores, mode, fn) => idb().then((d) => new Promise((res, rej) => { const t = d.transaction(stores, mode); let out; Promise.resolve(fn(t)).then((v) => { out = v; }); t.oncomplete = () => res(out); t.onerror = t.onabort = () => rej(t.error); }));
const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function tally() { clipBytes = 0; await tx(["meta"], "readonly", (t) => new Promise((res) => { const c = t.objectStore("meta").openCursor(); c.onsuccess = () => { const cur = c.result; if (!cur) return res(); clipBytes += cur.value.n || 0; cur.continue(); }; })); }
async function getClip(k) {
  try {
    const hit = await tx(["pcm"], "readonly", (t) => req(t.objectStore("pcm").get(k)));
    if (!hit) return null;
    tx(["meta"], "readwrite", (t) => { t.objectStore("meta").put({ k, n: hit.pcm.byteLength, used: Date.now() }); }).catch(() => {});
    const i16 = new Int16Array(hit.pcm), f = new Float32Array(i16.length);
    for (let i = 0; i < i16.length; i++) f[i] = i16[i] / 32767;
    return { sr: hit.sr, pcm: f };
  } catch (_) { return null; }
}
async function putClip(k, sr, f32) {
  const i16 = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) { const v = Math.max(-1, Math.min(1, f32[i])); i16[i] = Math.round(v * 32767); }
  if (i16.byteLength > CLIP_MAX) return;
  try {
    await tx(["meta", "pcm"], "readwrite", (t) => { t.objectStore("pcm").put({ k, sr, pcm: i16.buffer }); t.objectStore("meta").put({ k, n: i16.byteLength, used: Date.now() }); });
    clipBytes += i16.byteLength;
    if (clipBytes > CLIP_LIMIT) await trim();
  } catch (_) {}
}
async function trim() {   // drop the least recently used clips until the cache is back under 80% of its limit
  await tally();
  const goal = CLIP_LIMIT * 0.8;
  if (clipBytes <= goal) return;
  await tx(["meta", "pcm"], "readwrite", (t) => new Promise((res) => {
    const c = t.objectStore("meta").index("used").openCursor();
    c.onsuccess = () => { const cur = c.result; if (!cur || clipBytes <= goal) return res(); clipBytes -= cur.value.n || 0; t.objectStore("pcm").delete(cur.value.k); cur.delete(); cur.continue(); };
  }));
}
async function haveKeys(keys) {
  try { return await tx(["meta"], "readonly", (t) => Promise.all(keys.map((k) => req(t.objectStore("meta").getKey(k)).then((v) => (v != null ? k : null))))).then((a) => a.filter(Boolean)); } catch (_) { return []; }
}

// ---- the model worker ----
function startWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("worker.js", import.meta.url), { type: "module" });
  worker.onmessage = (e) => {
    const m = e.data || {};
    if (m.t === "audio") {
      const job = waiting.get(m.id); waiting.delete(m.id);
      const f = new Float32Array(m.pcm);
      if (job && job.keep) putClip(m.key, m.sr, f);   // stored as 16-bit, half the size
      send({ t: "audio", id: m.id, key: m.key, sr: m.sr, pcm: f.buffer, gen: m.gen, cached: false }, [f.buffer]);
    } else if (m.t === "fail") { waiting.delete(m.id); send(m); }
    else send(m);
  };
  worker.onerror = (e) => { send({ t: "error", error: "The Kokoro worker couldn't start: " + ((e && e.message) || "unknown error") }); try { worker.terminate(); } catch (_) {} worker = null; };
  return worker;
}

async function usage() {
  let total = 0; try { total = (await navigator.storage.estimate()).usage || 0; } catch (_) {}
  try { await tally(); } catch (_) {}
  return { t: "usage", total, clips: clipBytes };
}

async function handle(m) {
  if (m.t === "init") { startWorker().postMessage({ t: "init", device: m.device, voices: m.voices }); }
  else if (m.t === "say") {
    const hit = await getClip(m.key);
    if (hit) { send({ t: "audio", id: m.id, key: m.key, sr: hit.sr, pcm: hit.pcm.buffer, gen: 0, cached: true }, [hit.pcm.buffer]); return; }
    if (m.cacheOnly) { send({ t: "fail", id: m.id, key: m.key, error: "miss" }); return; }
    waiting.set(m.id, m);
    startWorker().postMessage({ t: "say", id: m.id, key: m.key, text: m.text, voice: m.voice, speed: m.speed });
  }
  else if (m.t === "has") send({ t: "has", id: m.id, keys: await haveKeys(m.keys || []) });
  else if (m.t === "usage") send(await usage());
  else if (m.t === "clear") {
    // Everything Kokoro ever stored: the model, the voices, the clips.
    if (worker) { try { worker.terminate(); } catch (_) {} worker = null; }
    waiting.clear();
    if (db) { try { db.close(); } catch (_) {} db = null; }
    const errs = [];
    if (typeof caches !== "undefined") for (const n of ["transformers-cache", "kokoro-voices"]) { try { await caches.delete(n); } catch (e) { errs.push(String(e)); } }
    for (const name of [DB, "sbx-radio-kokoro-files"]) await new Promise((res) => { try { const r = indexedDB.deleteDatabase(name); r.onsuccess = r.onerror = r.onblocked = () => res(); } catch (_) { res(); } });   // clips; downloads kept in IndexedDB where the Cache API wasn't available
    clipBytes = 0;
    send(Object.assign(await usage(), { t: "cleared", errors: errs }));
  }
}
