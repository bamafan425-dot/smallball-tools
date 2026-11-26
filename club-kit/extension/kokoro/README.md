# SmallBall Radio · Kokoro voices (optional)

An opt-in, on-device neural voice engine for SmallBall Radio (`../radio.js`). The browser's own
speech (`speechSynthesis`) stays the default and stays the fallback. Kokoro is only loaded after the person
picks **Voices → Kokoro (neural)** in ⚙ Booth settings and then turns the radio on (or presses *download now*).

No accounts, keys, installs or paid services. All code ships in the kit; only the model's data files are
downloaded, once, from Hugging Face. Nothing about the game or the person is sent anywhere.

## How it fits together

```
play.smallball.com page
 └─ radio.js (content script)            commentary engine, queue, priorities, shelf lives, captions,
     │                                    volume, organ — unchanged; Kokoro is one more way to speak a line
     │  MessageChannel (private port)
     └─ <iframe hidden> kokoro/engine.html   extension origin; created only when Kokoro is wanted
         ├─ engine.js                         port handling, clip cache (IndexedDB), "clear downloads"
         └─ Worker: worker.js (module)        kokoro-js + ONNX Runtime Web; picks WebGPU or WASM
```

* **Why an iframe at the extension's origin?** It is the one design that works the same in Chrome, Edge,
  Brave and Firefox under Manifest V3: it can run WebAssembly (`'wasm-unsafe-eval'` in the extension CSP,
  which the page's own CSP can't block), start a module Worker, and keep its storage in the extension's
  origin instead of the site's. A Chrome offscreen document would need a service worker and the `offscreen`
  permission and doesn't exist in Firefox; Firefox's event page doesn't exist in Chrome.
* **Why a Worker?** Inference never runs on the page's thread. In testing the game page's frame times
  didn't move while Kokoro was generating (p95 16.7 ms, the same as with the radio off).
* **Audio** comes back to the content script as raw PCM and plays through the radio's own `AudioContext`
  (the one the organ already uses), so the radio's volume applies and stopping is instant.
* The worker makes **one line at a time**, and `radio.js` decides what's next: the line on deck, then the
  queue in order, skipping any line that can't be ready before its shelf life (`maxAge`) runs out. With
  nothing queued it pre-makes the stock pitch calls (below).

## The cast

| Character | Kokoro voice | Speed |
|---|---|---|
| Mack Ramsey (play-by-play) | `am_michael` (US) | 1.10 |
| Dewey Seeds (color) | `bm_george` (UK) | 0.95 |
| Chet Lambert (guest) | `am_puck` (US) | 1.05 |
| Brock Callahan (guest) | `am_fenrir` (US) | 1.00 |
| Gary Plainfield (guest) | `bm_fable` (UK) | 0.92 |

Fixed per character (`KV` / `KSP` in `radio.js`), so a character always sounds the same and his clips can be
reused. Kokoro has no pitch control, so the browser engine's per-character `pitch` doesn't apply; Mack's
"talks faster when he's behind" is left out in Kokoro mode so his stock calls stay cacheable.

## Processing: WebGPU or WASM

`Runs on: Automatic` asks for a WebGPU adapter in the worker. A real adapter → WebGPU with the fp32 model
(~326 MB). No adapter, a software ("fallback") adapter, or WebGPU failing to load/warm up → WASM with the
q8 model (~92 MB). *Graphics card* and *Processor* force one or the other.

Measured in headless Chromium on a 4-vCPU 2.1 GHz Xeon VM (a slow CPU), real Kokoro v1.0 weights,
`am_michael`. "RTF" is time to make a line ÷ length of the line; under 1 keeps up with the game.

| Setup | RTF |
|---|---|
| WASM, q8, 1 thread (what the iframe gets) | 2.0–2.7 |
| WASM, fp32, 1 thread | 2.3–2.9 |
| WASM, q8, 2 threads (cross-origin isolated page) | 2.0–2.4 |
| WASM, fp32, 2 threads (cross-origin isolated page) | 1.3 |

* Multi-threaded WASM needs `SharedArrayBuffer`, i.e. a cross-origin isolated context. An iframe inside
  play.smallball.com can't be one, so the CPU path is single-threaded, where q8 is as fast as fp32 and a
  third of the download. That's why the CPU path uses q8.
* The WebGPU path was exercised end to end on SwiftShader (a software GPU, test-only override) to prove it
  loads and speaks inside the extension frame; real GPU speed has to be measured on real hardware.
* Expect WebGPU on Chrome/Edge for Windows, macOS and ChromeOS, including integrated graphics (most machines
  "without a dedicated GPU" still have one WebGPU can use). Firefox ships WebGPU on Windows from 141; elsewhere
  Firefox uses WASM.

### Keeping up with the game

* Every line keeps its shelf life. A line that can't be made in time is skipped (counted as "skipped as too
  late" in the settings), and a line that finishes after its moment has passed is never played.
* **Stock calls:** the ball/strike/contact calls are a fixed set of about 45 lines and the most time-critical.
  Kokoro makes them in Mack's voice whenever it's idle and keeps them, so after the first game they play
  instantly. A pitch call with an extra ("Ball one. 92 on the gun.") is split into the stock call, played right
  away, and the rest, made while the call plays.
* **Watchdog:** if the median RTF of the last lines is over 1 (this computer can't keep up), the booth goes
  back to the browser's voices and says so, with a *Try Kokoro again* button. (If the browser has no voices at
  all, Kokoro keeps going, since it's the only voice there is.)
* Until Kokoro is ready (first download, warm-up), the browser's voices fill in.

## Storage

Investigated rather than assuming `localStorage`:

| Option | Verdict |
|---|---|
| `localStorage` (where the radio keeps its settings) | ~5 MB of strings, synchronous, the site's origin. Not for 90–330 MB of binary. |
| `chrome.storage.local` | JSON values; 10 MB without `unlimitedStorage`. Wrong shape for model weights. |
| **Cache API** (extension origin) | What transformers.js / kokoro-js already use (`transformers-cache`, `kokoro-voices`). Persists across sessions. **Used for the model and voices.** |
| **IndexedDB** (extension origin) | Binary values, indexes. **Used for generated clips** (16-bit PCM, LRU-trimmed at 40 MB). |
| OPFS | Fine in Chrome, but transformers.js doesn't use it and it adds nothing here. |

The engine frame is an extension page, so its storage belongs to the extension, not to play.smallball.com
(clearing the site's data doesn't remove it; removing the extension does). Browsers partition storage for
embedded frames by top-level site; the frame is only ever embedded on play.smallball.com, so it always sees the
same storage. Storage is "best effort": under disk pressure the browser may evict it, and Kokoro then just
downloads again. `unlimitedStorage` would prevent that, but Firefox shows it as a new permission, so it's left out.

**Clear Kokoro downloads** (in the Kokoro box) deletes both caches and the clip database, unloads the model
and switches Voices back to Browser.

Verified in Chromium: second browser launch made **zero** model requests (all from cache); clips made in one
session played from IndexedDB in the next.

## Resources

* Nothing Kokoro-related loads unless Voices is Kokoro: no iframe, no worker, no download.
* Radio off: playback stops at once, nothing new is generated (the one line already in the worker finishes;
  ONNX Runtime can't abort a run), and 90 s later the frame and model are unloaded to free memory.
* Changing *Runs on* restarts the engine on the new processor.

## Dependencies (vendored, unmodified)

| File | From | License |
|---|---|---|
| `vendor/kokoro.web.js` | npm `kokoro-js@1.2.1` `dist/kokoro.web.js` (bundles `@huggingface/transformers@3.5.1` and `phonemizer@1.2.1`) | Apache-2.0 (see note) |
| `vendor/ort-wasm-simd-threaded.jsep.mjs` | npm `onnxruntime-web@1.22.0-dev.20250409-89f8206ba4` `dist/` (the ORT build transformers 3.5.1 bundles) | MIT |
| `vendor/ort-wasm-simd-threaded.jsep.wasm` | same | MIT |

sha256 hashes are in `vendor/SOURCES.txt`. Model data (downloaded at run time, not shipped):
`onnx-community/Kokoro-82M-v1.0-ONNX` on Hugging Face (Apache-2.0): `onnx/model_quantized.onnx` (q8) or
`onnx/model.onnx` (fp32), `config.json`, `tokenizer*.json`, and the five `voices/*.bin`.

**License note:** `phonemizer` is published as Apache-2.0 but contains a WebAssembly build of eSpeak NG, which is
GPL-3.0. The kit has no license file of its own; the maintainer should decide whether distributing it this way is
acceptable (the alternatives are a different phonemizer or dropping Kokoro). See `vendor/NOTICE.txt`.

## Extension store notes

* **Remote code:** none. Every script and the `.wasm` ship in the package; `wasmPaths` points ONNX Runtime at
  `vendor/` instead of its default CDN. Only model weights and voice tensors (data) are downloaded. This is the
  same pattern other store-listed transformers.js extensions use, but it's worth stating in the listing.
* **Manifest:** adds `content_security_policy.extension_pages` = `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'`
  and one `web_accessible_resources` entry (`kokoro/engine.html`, only for play.smallball.com). No new
  permissions, so no new install warnings.
* **Firefox / AMO:** the vendored files are unmodified release files, listed above with their npm versions,
  so reviewers can diff them. `kokoro.web.js` is 2.1 MB (under AMO's 4 MB parse limit); the `.wasm` is 21.6 MB.
  `data_collection_permissions: none` still holds: downloading public model files isn't data collection, but the
  listing should mention the one-time download from huggingface.co.
* **Size:** the kit grows by ~24 MB unpacked (~5.5 MB zipped), almost all the ONNX Runtime `.wasm`.

## Known limitations

* CPU-only machines need roughly 2× a modern desktop core to keep up single-threaded; slower machines get the
  watchdog fallback. A Chrome-only offscreen document with cross-origin isolation could run ONNX Runtime
  multi-threaded (2 threads measured ~2× faster with fp32), at the cost of a second code path; not done here.
* Mixed voices on a slow machine: while Kokoro is loading or after the watchdog trips, lines use browser voices.
* Kokoro reads numbers and names through its own text normalizer, so unusual club or player names can come out
  differently than in browser speech.
* Not ported to the Broadcast Kit's copy of the booth (`broadcast-kit/tk.js`), and not in the phone/iPad
  userscripts (no extension origin there; the Kokoro option simply doesn't show).
