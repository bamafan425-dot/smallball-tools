// SmallBall Radio · Enhanced voices (Kokoro): the engine frame. The radio (radio.js, a content script on
// play.smallball.com) puts this page in a hidden iframe only while Enhanced voices are needed (setup, the radio on
// the air, the booth test) and talks to it over a private MessageChannel. This page runs at the extension's own
// origin, so the model, the voice files and the clip cache live in the extension's storage, not the site's, and
// survive browser restarts.
//   • the model + voices: transformers.js / kokoro-js keep them in the Cache API ("transformers-cache",
//     "kokoro-voices") the first time they're downloaded
//   • made lines ("clips"): IndexedDB. Pre-recorded lines (the fixed commentary in the cast's voices) are pinned and
//     never pushed out by live lines; live lines share a bounded space, oldest-used dropped first. Clips are
//     stored as Opus (WebCodecs) where the browser can encode it, about a twelfth the size of 16-bit PCM.
// The model itself only loads in the worker (worker.js) when the radio asks for it; reading saved clips, checking
// the graphics card and clearing storage don't load it.
const SITE = "https://play.smallball.com";
const DB = "sbx-radio-kokoro";
const DYN_LIMIT = 30 * 1024 * 1024;     // live (one-off) lines: 30 MB, oldest-used dropped first
const FIXED_LIMIT = 250 * 1024 * 1024;  // pre-recorded lines: only reached if Opus isn't available (16-bit PCM)
const CLIP_MAX_S = 30;                  // no clip over 30 s
let port = null, worker = null, db = null, dynBytes = 0, fixedBytes = 0;
const waiting = new Map();   // job id → the say message, while the worker makes it

addEventListener("message", (e) => {
  if (port || e.source !== parent || e.origin !== SITE || !e.data || e.data.t !== "sbx-kokoro-hello" || !e.ports[0]) return;
  port = e.ports[0];
  port.onmessage = (ev) => handle(ev.data || {}).catch((err) => send({ t: "error", error: String((err && err.message) || err) }));
  send({ t: "hello" });
});
const send = (m, tr) => port && port.postMessage(m, tr || []);

// ---- Opus, through WebCodecs, when this browser has it (Chrome/Edge 94+, Firefox 130+) ----
const SR = 24000, OPUS = { codec: "opus", sampleRate: SR, numberOfChannels: 1, bitrate: 32000 };
let opusP = null;
function opusOk() {   // can this browser encode and decode Opus here? Checked once, with a real round trip.
  return opusP || (opusP = (async () => {
    try {
      if (typeof AudioEncoder === "undefined" || typeof AudioDecoder === "undefined") return false;
      if (!(await AudioEncoder.isConfigSupported(OPUS)).supported) return false;
      if (!(await AudioDecoder.isConfigSupported({ codec: "opus", sampleRate: SR, numberOfChannels: 1 })).supported) return false;
      const t = new Float32Array(SR / 2); for (let i = 0; i < t.length; i++) t[i] = 0.3 * Math.sin(i * 0.11);
      const back = await opusDec(await opusEnc(t));
      return back.pcm.length / back.sr > (t.length / SR) * 0.9;
    } catch (_) { return false; }
  })());
}
async function opusEnc(f32) {
  const out = [];
  let err = null;
  const enc = new AudioEncoder({ output: (c) => { const b = new Uint8Array(c.byteLength); c.copyTo(b); out.push(b); }, error: (e) => { err = e; } });
  enc.configure(OPUS);
  enc.encode(new AudioData({ format: "f32", sampleRate: SR, numberOfFrames: f32.length, numberOfChannels: 1, timestamp: 0, data: f32 }));
  await enc.flush(); enc.close();
  if (err) throw err;
  let n = 0; for (const b of out) n += 2 + b.length;
  const buf = new Uint8Array(n); let o = 0;   // packets, each with a 2-byte length in front
  for (const b of out) { buf[o] = b.length & 255; buf[o + 1] = b.length >> 8; buf.set(b, o + 2); o += 2 + b.length; }
  return buf.buffer;
}
async function opusDec(ab) {
  const parts = []; let err = null, sr = SR;
  // (decoders may hand Opus back at 48 kHz whatever it was made at, so the clip keeps the rate it comes out at)
  const dec = new AudioDecoder({ output: (d) => { const f = new Float32Array(d.numberOfFrames); d.copyTo(f, { planeIndex: 0, format: "f32-planar" }); sr = d.sampleRate || sr; parts.push(f); d.close(); }, error: (e) => { err = e; } });
  dec.configure({ codec: "opus", sampleRate: SR, numberOfChannels: 1 });
  const u = new Uint8Array(ab); let o = 0, ts = 0;
  while (o + 2 <= u.length) { const n = u[o] | (u[o + 1] << 8); dec.decode(new EncodedAudioChunk({ type: "key", timestamp: ts, data: u.subarray(o + 2, o + 2 + n) })); ts += 20000; o += 2 + n; }
  await dec.flush(); dec.close();
  if (err) throw err;
  let len = 0; for (const p of parts) len += p.length;
  const f = new Float32Array(len); let i = 0; for (const p of parts) { f.set(p, i); i += p.length; }
  return { pcm: f, sr };
}

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
const each = (t, fn) => new Promise((res) => { const c = t.objectStore("meta").openCursor(); c.onsuccess = () => { const cur = c.result; if (!cur) return res(); fn(cur); cur.continue(); }; c.onerror = () => res(); });
async function tally() { dynBytes = 0; fixedBytes = 0; await tx(["meta"], "readonly", (t) => each(t, (cur) => { if (cur.value.fixed) fixedBytes += cur.value.n || 0; else dynBytes += cur.value.n || 0; })); }
async function getClip(k) {
  try {
    const hit = await tx(["pcm"], "readonly", (t) => req(t.objectStore("pcm").get(k)));
    if (!hit) return null;
    tx(["meta"], "readwrite", (t) => { const st = t.objectStore("meta"); req(st.get(k)).then((m) => { if (m) { m.used = Date.now(); st.put(m); } }); }).catch(() => {});
    if (hit.codec === "opus") return await opusDec(hit.data);
    const i16 = new Int16Array(hit.data || hit.pcm), f = new Float32Array(i16.length);   // 16-bit (and clips saved before Opus)
    for (let i = 0; i < i16.length; i++) f[i] = i16[i] / 32767;
    return { sr: hit.sr, pcm: f };
  } catch (_) { return null; }
}
async function putClip(k, sr, f32, fixed) {
  if (f32.length > CLIP_MAX_S * sr) return;
  let data, codec;
  if (sr === SR && (await opusOk())) { try { data = await opusEnc(f32); codec = "opus"; } catch (_) {} }
  if (!data) { const i16 = new Int16Array(f32.length); for (let i = 0; i < f32.length; i++) { const v = Math.max(-1, Math.min(1, f32[i])); i16[i] = Math.round(v * 32767); } data = i16.buffer; codec = "pcm16"; }
  try {
    await tx(["meta", "pcm"], "readwrite", (t) => { t.objectStore("pcm").put({ k, sr, codec, data }); t.objectStore("meta").put({ k, n: data.byteLength, used: Date.now(), fixed: fixed ? 1 : 0 }); });
    if (fixed) fixedBytes += data.byteLength; else dynBytes += data.byteLength;
    if (dynBytes > DYN_LIMIT || fixedBytes > FIXED_LIMIT) await trim();
  } catch (_) {}
}
async function trim() {   // drop the least recently used live lines until they're back under 80% of their space (pinned lines stay)
  await tally();
  const goalD = DYN_LIMIT * 0.8, goalF = FIXED_LIMIT * 0.9;
  if (dynBytes <= goalD && fixedBytes <= goalF) return;
  await tx(["meta", "pcm"], "readwrite", (t) => new Promise((res) => {
    const c = t.objectStore("meta").index("used").openCursor();
    c.onsuccess = () => {
      const cur = c.result; if (!cur || (dynBytes <= goalD && fixedBytes <= goalF)) return res();
      const v = cur.value, drop = v.fixed ? fixedBytes > goalF : dynBytes > goalD;
      if (drop) { if (v.fixed) fixedBytes -= v.n || 0; else dynBytes -= v.n || 0; t.objectStore("pcm").delete(v.k); cur.delete(); }
      cur.continue();
    };
    c.onerror = () => res();
  }));
}
async function haveKeys(keys) {
  try { return await tx(["meta"], "readonly", (t) => Promise.all(keys.map((k) => req(t.objectStore("meta").getKey(k)).then((v) => (v != null ? k : null))))).then((a) => a.filter(Boolean)); } catch (_) { return []; }
}
async function allKeys() { try { return await tx(["meta"], "readonly", (t) => req(t.objectStore("meta").getAllKeys())); } catch (_) { return []; } }
// Pin exactly these clips (the pre-recorded lines for the current voices). Lines pinned before but not in the list
// (a character's voice changed) become ordinary clips: kept while there's room, so switching back is free.
async function pin(keys) {
  const want = new Set(keys);
  try { await tx(["meta"], "readwrite", (t) => each(t, (cur) => { const v = cur.value, f = want.has(v.k) ? 1 : 0; if ((v.fixed ? 1 : 0) !== f) { v.fixed = f; cur.update(v); } })); } catch (_) {}
  await trim().catch(() => {});
}

// ---- the model worker ----
function startWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("worker.js", import.meta.url), { type: "module" });
  worker.onmessage = (e) => {
    const m = e.data || {};
    if (m.t === "audio") {
      const job = waiting.get(m.id); waiting.delete(m.id);
      const f = new Float32Array(m.pcm), keep = job && job.keep;
      const saved = keep ? putClip(m.key, m.sr, f.slice(), keep === "fixed") : Promise.resolve();
      if (job && job.quiet) { saved.then(() => send({ t: "made", id: m.id, key: m.key, gen: m.gen, dur: Math.round((f.length / m.sr) * 1000) })); return; }   // pre-recording: saved, not played
      send({ t: "audio", id: m.id, key: m.key, sr: m.sr, pcm: f.buffer, gen: m.gen, cached: false }, [f.buffer]);
    } else if (m.t === "fail") { waiting.delete(m.id); send(m); }
    else send(m);
  };
  worker.onerror = (e) => { send({ t: "error", error: "The voice worker couldn't start: " + ((e && e.message) || "unknown error") }); try { worker.terminate(); } catch (_) {} worker = null; };
  return worker;
}

async function usage() {
  let total = 0; try { total = (await navigator.storage.estimate()).usage || 0; } catch (_) {}
  try { await tally(); } catch (_) {}
  return { t: "usage", total, clips: dynBytes + fixedBytes, fixed: fixedBytes, opus: await opusOk() };
}

async function handle(m) {
  if (m.t === "probe") startWorker().postMessage({ t: "probe" });
  else if (m.t === "init") startWorker().postMessage({ t: "init", voices: m.voices });
  else if (m.t === "get") {   // a saved line, no model needed
    const hit = await getClip(m.key);
    if (hit) send({ t: "audio", id: m.id, key: m.key, sr: hit.sr, pcm: hit.pcm.buffer, gen: 0, cached: true }, [hit.pcm.buffer]);
    else send({ t: "fail", id: m.id, key: m.key, error: "miss" });
  }
  else if (m.t === "say") {
    const hit = await getClip(m.key);
    if (hit) {
      if (m.quiet) send({ t: "made", id: m.id, key: m.key, gen: 0, dur: Math.round((hit.pcm.length / hit.sr) * 1000), cached: true });
      else send({ t: "audio", id: m.id, key: m.key, sr: hit.sr, pcm: hit.pcm.buffer, gen: 0, cached: true }, [hit.pcm.buffer]);
      return;
    }
    waiting.set(m.id, m);
    startWorker().postMessage({ t: "say", id: m.id, key: m.key, text: m.text, voice: m.voice, speed: m.speed });
  }
  else if (m.t === "has") send({ t: "has", id: m.id, keys: await haveKeys(m.keys || []) });
  else if (m.t === "keys") send({ t: "keys", keys: await allKeys() });
  else if (m.t === "pin") { await pin(m.keys || []); send(await usage()); }
  else if (m.t === "usage") send(await usage());
  else if (m.t === "clear") {
    // Everything the Enhanced voices ever stored: the model, the voices, the clips.
    if (worker) { try { worker.terminate(); } catch (_) {} worker = null; }
    waiting.clear();
    if (db) { try { db.close(); } catch (_) {} db = null; }
    const errs = [];
    if (typeof caches !== "undefined") for (const n of ["transformers-cache", "kokoro-voices"]) { try { await caches.delete(n); } catch (e) { errs.push(String(e)); } }
    for (const name of [DB, "sbx-radio-kokoro-files"]) await new Promise((res) => { try { const r = indexedDB.deleteDatabase(name); r.onsuccess = r.onerror = r.onblocked = () => res(); } catch (_) { res(); } });   // clips; downloads kept in IndexedDB where the Cache API wasn't available
    dynBytes = 0; fixedBytes = 0;
    send(Object.assign(await usage(), { t: "cleared", errors: errs }));
  }
}
