// SmallBall Radio · Kokoro voices: the speech model, in a worker so it never blocks the page.
// Runs inside the kit's own engine frame (engine.html), at the extension's origin. Everything it runs ships
// with the kit (kokoro-js, ONNX Runtime Web); only the model's data files are downloaded, from Hugging Face,
// and only after the person turns Kokoro on. Nothing about the game or the person is sent anywhere.
const MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";
const VENDOR = new URL("./vendor/", import.meta.url).href;
const FILES_DB = "sbx-radio-kokoro-files";

// Downloads are kept with the Cache API, which is what transformers.js and kokoro-js use. Where it isn't there or
// refuses (some private windows, some extension frames), stand in a small IndexedDB-backed one before the library
// loads, so the model still survives a browser restart instead of downloading every time.
async function cachesWork() {
  try { if (typeof caches === "undefined") return false; const c = await caches.open("sbx-probe"); await c.match("https://probe.invalid/"); await caches.delete("sbx-probe"); return true; } catch (_) { return false; }
}
function idbCaches() {
  const db = () => new Promise((res, rej) => { const r = indexedDB.open(FILES_DB, 1); r.onupgradeneeded = () => r.result.createObjectStore("f"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const run = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction("f", mode), rq = fn(t.objectStore("f")); t.oncomplete = () => { d.close(); res(rq && rq.result); }; t.onerror = t.onabort = () => { d.close(); rej(t.error); }; }); };
  const key = (name, u) => name + "|" + String((u && u.url) || u);
  return {
    async open(name) {
      return {
        async match(u) { const v = await run("readonly", (st) => st.get(key(name, u))); return v ? new Response(v.blob, { headers: v.headers }) : undefined; },
        async put(u, resp) { const blob = await resp.blob(); await run("readwrite", (st) => st.put({ blob, headers: { "content-type": resp.headers.get("content-type") || "application/octet-stream", "content-length": String(blob.size) } }, key(name, u))); },
      };
    },
    async delete() { await new Promise((res) => { const r = indexedDB.deleteDatabase(FILES_DB); r.onsuccess = r.onerror = r.onblocked = () => res(); }); return true; },
  };
}
let KokoroTTS = null;
async function lib() {
  if (KokoroTTS) return;
  if (!(await cachesWork()) && typeof indexedDB !== "undefined") { try { Object.defineProperty(self, "caches", { value: idbCaches(), configurable: true }); } catch (_) {} }
  const m = await import("./vendor/kokoro.bundle.js");
  // ONNX Runtime's .wasm/.mjs come from the kit itself, never from a CDN (extension stores forbid remote code).
  // (transformers.js already skips local /models lookups in a worker.)
  m.env.wasmPaths = VENDOR;
  KokoroTTS = m.KokoroTTS;
}

let tts = null, device = "", dtype = "", busy = false, warmRtf = 0;
const post = (m, t) => self.postMessage(m, t || []);

async function gpuOk() {
  try {
    if (!self.navigator || !navigator.gpu) return false;
    const a = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!a) return false;
    const info = a.info || {};
    // A software (fallback) adapter is slower than WASM; skip it.
    if (a.isFallbackAdapter || info.isFallbackAdapter) return false;
    return true;
  } catch (_) { return false; }
}

async function load(dev) {
  // Downloads: a running total across the model's files, for the progress bar.
  const files = {};
  const progress = (p) => {
    if (!p || !p.file) return;
    if (p.status === "progress" || p.status === "done") {
      const f = files[p.file] || (files[p.file] = { loaded: 0, total: 0 });
      if (p.total) f.total = p.total; if (p.loaded != null) f.loaded = p.loaded; if (p.status === "done" && f.total) f.loaded = f.total;
      let loaded = 0, total = 0; for (const k in files) { loaded += files[k].loaded; total += files[k].total; }
      post({ t: "progress", phase: "download", loaded, total, file: p.file });
    } else if (p.status === "initiate") { files[p.file] = files[p.file] || { loaded: 0, total: 0 }; }
  };
  dtype = dev === "webgpu" ? "fp32" : "q8";   // q8 is the CPU model (~92 MB); WebGPU wants fp32 (~326 MB)
  device = dev;
  tts = await KokoroTTS.from_pretrained(MODEL, { dtype, device: dev, progress_callback: progress });
}

async function init(want, voices) {
  const t0 = performance.now();
  await lib();
  // Kokoro keeps up with a ballgame on a graphics card. On the processor it's several times slower than
  // speech on most computers, so the processor is only used when the person picks it.
  const dev = want === "wasm" ? "wasm" : "webgpu";
  if (dev === "webgpu" && !(await gpuOk())) throw new Error("no graphics card this browser can use for it (WebGPU)");
  try {
    await load(dev);
    post({ t: "progress", phase: "warmup" });
    await warm(voices);
  } catch (e) {
    tts = null;
    throw dev === "webgpu" ? new Error("the graphics card couldn't run it: " + String((e && e.message) || e).slice(0, 140)) : e;
  }
  post({ t: "ready", device, dtype, ms: Math.round(performance.now() - t0), rtf: +warmRtf.toFixed(3) });
}

// The first run compiles the graph (and the GPU shaders), so make one short line now. The cast's voice files
// (~0.5 MB each) are fetched into the same cache kokoro-js reads them from, so the game never waits on them.
// Garbled output (seen on some graphics cards) sounds like crackling. Speech crosses zero rarely (a few % of
// samples, even with an "s" in it); noise or crackle crosses on about half. Bad numbers are garbled too.
function garbled(pcm) {
  let act = 0, flips = 0, prev = 0;
  for (let i = 0; i < pcm.length; i++) {
    const v = pcm[i]; if (!Number.isFinite(v) || v > 4 || v < -4) return true;
    if (v > 0.01 || v < -0.01) { const sg = v > 0 ? 1 : -1; if (prev && sg !== prev) flips++; prev = sg; act++; }
  }
  return act > 200 && flips / act > 0.25;
}
async function warm(voices) {
  const vs = voices || [];
  let cache = null; try { cache = typeof caches !== "undefined" ? await caches.open("kokoro-voices") : null; } catch (_) {}
  for (const v of vs) {
    const url = `https://huggingface.co/${MODEL}/resolve/main/voices/${v}.bin`;
    try { if (cache && !(await cache.match(url))) { const r = await fetch(url); if (r.ok) await cache.put(url, r); } } catch (_) {}
  }
  if (!vs.length) return;
  await tts.generate("Play ball.", { voice: vs[0], speed: 1 });            // compiles; slow the first time
  // On a graphics card, check every voice in the cast once: a card that garbles them goes back to the CPU.
  if (device === "webgpu") for (const v of vs) { const a = await tts.generate("Ball one.", { voice: v, speed: 1 }); if (garbled(a.audio)) throw new Error("the graphics card garbled the " + v + " voice"); }
  const t0 = performance.now(), a = await tts.generate("Ball one.", { voice: vs[0], speed: 1 });
  warmRtf = (performance.now() - t0) / Math.max(1, (a.audio.length / (a.sampling_rate || 24000)) * 1000);   // how long making a line takes, per second of speech
}

async function speak(m) {
  const t0 = performance.now();
  const a = await tts.generate(m.text, { voice: m.voice, speed: m.speed || 1 });
  const pcm = a.audio instanceof Float32Array ? a.audio : new Float32Array(a.audio);
  const ms = performance.now() - t0;
  if (garbled(pcm)) throw new Error("garbled audio from " + m.voice + " on " + device);
  post({ t: "audio", id: m.id, key: m.key, sr: a.sampling_rate || 24000, pcm: pcm.buffer, gen: Math.round(ms) }, [pcm.buffer]);
}

// One job at a time; the radio decides what's next, so there's no queue to cancel here.
self.onmessage = async (e) => {
  const m = e.data || {};
  try {
    if (m.t === "init") { if (!tts) await init(m.device, m.voices); else post({ t: "ready", device, dtype, ms: 0 }); }
    else if (m.t === "say") {
      if (!tts) throw new Error("not ready");
      if (busy) throw new Error("busy");
      busy = true; try { await speak(m); } finally { busy = false; }
    }
  } catch (err) {
    post({ t: m.t === "say" ? "fail" : "error", id: m.id, key: m.key, error: String((err && err.message) || err).slice(0, 300) });
  }
};
