// SmallBall Radio · Enhanced voices (Kokoro): the speech model, in a worker so it never blocks the page.
// Runs inside the kit's own engine frame (engine.html), at the extension's origin. Everything it runs ships
// with the kit (kokoro-js, ONNX Runtime Web); only the model's data files are downloaded, from Hugging Face,
// and only after the person sets up Enhanced voices. Nothing about the game or the person is sent anywhere.
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

// Is there a graphics card this browser can really compute on? Checked before anything is downloaded: an adapter
// that isn't a software stand-in, a device, and a tiny compute job whose answer is read back and checked.
async function probe() {
  try {
    if (!self.navigator || !navigator.gpu) return { ok: false, why: "this browser doesn't offer WebGPU here" };
    const a = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!a) return { ok: false, why: "the browser found no graphics card it can use (WebGPU is turned off or blocked for this one)" };
    const info = a.info || {};
    if (a.isFallbackAdapter || info.isFallbackAdapter) return { ok: false, why: "only a software stand-in for a graphics card is available, which is far too slow" };
    const name = [info.vendor, info.architecture, info.description].filter(Boolean).join(" ").trim();
    const dev = await a.requestDevice();
    try {
      const N = 256, mod = dev.createShaderModule({ code: "@group(0) @binding(0) var<storage, read_write> d: array<f32>; @compute @workgroup_size(64) fn main(@builtin(global_invocation_id) i: vec3<u32>) { d[i.x] = d[i.x] * 2.0 + 1.0; }" });
      const pipe = dev.createComputePipeline({ layout: "auto", compute: { module: mod, entryPoint: "main" } });
      const buf = dev.createBuffer({ size: N * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
      const rd = dev.createBuffer({ size: N * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
      const src = new Float32Array(N).map((_, i) => i); dev.queue.writeBuffer(buf, 0, src);
      const bg = dev.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: buf } }] });
      const enc = dev.createCommandEncoder(), pass = enc.beginComputePass(); pass.setPipeline(pipe); pass.setBindGroup(0, bg); pass.dispatchWorkgroups(N / 64); pass.end();
      enc.copyBufferToBuffer(buf, 0, rd, 0, N * 4); dev.queue.submit([enc.finish()]);
      await rd.mapAsync(GPUMapMode.READ); const out = new Float32Array(rd.getMappedRange().slice(0)); rd.unmap();
      for (let i = 0; i < N; i++) if (out[i] !== i * 2 + 1) return { ok: false, why: "the graphics card gave wrong answers in a quick test" };
    } finally { try { dev.destroy(); } catch (_) {} }
    return { ok: true, gpu: name };
  } catch (e) { return { ok: false, why: "the graphics card couldn't be started (" + String((e && e.message) || e).slice(0, 120) + ")" }; }
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
  dtype = dev === "webgpu" ? "fp32" : "q8";   // the graphics card runs the full fp32 model (~326 MB)
  device = dev;
  tts = await KokoroTTS.from_pretrained(MODEL, { dtype, device: dev, progress_callback: progress });
}

// Enhanced voices run on the graphics card only: on the processor Kokoro is several times slower than speech on
// most computers, far too slow for a live game.
const DEVICE = "webgpu";
async function init(voices) {
  const t0 = performance.now();
  const p = await probe();
  if (!p.ok) throw Object.assign(new Error(p.why), { gpu: true });
  await lib();
  try {
    await load(DEVICE);
    post({ t: "progress", phase: "warmup" });
    await warm(voices);
  } catch (e) {
    tts = null;
    // garbled voices mean this graphics card can't do it; anything else (a download cut off) is worth another try
    throw Object.assign(new Error((e && e.garbled ? "" : "the voices couldn't start on the graphics card: ") + String((e && e.message) || e).slice(0, 140)), { gpu: !!(e && e.garbled) });
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
  // On a graphics card, check every voice in the cast once: a card that garbles them can't run Enhanced voices.
  if (device === "webgpu") for (const v of vs) { const a = await tts.generate("Ball one.", { voice: v, speed: 1 }); if (garbled(a.audio)) throw Object.assign(new Error("the graphics card garbled the " + v + " voice in testing"), { garbled: true }); }
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
    if (m.t === "probe") post(Object.assign({ t: "probe" }, await probe()));
    else if (m.t === "init") { if (!tts) await init(m.voices); else post({ t: "ready", device, dtype, ms: 0 }); }
    else if (m.t === "say") {
      if (!tts) throw new Error("not ready");
      if (busy) throw new Error("busy");
      busy = true; try { await speak(m); } finally { busy = false; }
    }
  } catch (err) {
    post({ t: m.t === "say" ? "fail" : "error", id: m.id, key: m.key, gpu: !!(err && err.gpu), error: String((err && err.message) || err).slice(0, 300) });
  }
};
