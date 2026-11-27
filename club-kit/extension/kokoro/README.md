# SmallBall Radio · Enhanced voices (Kokoro)

An opt-in, on-device neural voice engine for SmallBall Radio (`../radio.js`). In ⚙ Booth settings, **Voices** is
**Standard** (the browser's own `speechSynthesis`, the default and always the fallback) or **Enhanced** (Kokoro-82M,
made on this computer). User-facing text says "Enhanced"; Kokoro is named in the informational lines and here.

No accounts, keys, installs or paid services. All code ships in the kit; only the model's data files are
downloaded, once, from Hugging Face. Nothing about the game or the person is sent anywhere.

## How it fits together

```
play.smallball.com page
 └─ radio.js (content script)            commentary engine, queue, priorities, shelf lives, captions,
     │                                    volume, organ (unchanged); Enhanced is one more way to speak a line
     │  MessageChannel (private port)
     └─ <iframe hidden> kokoro/engine.html   extension origin; only while the engine is needed
         ├─ engine.js                         port handling, clip store (IndexedDB, Opus), "clear downloads"
         └─ Worker: worker.js (module)        GPU check; kokoro-js + ONNX Runtime Web on WebGPU
```

* **Why an iframe at the extension's origin?** It works the same in Chrome, Edge, Brave and Firefox under
  Manifest V3: it can run WebAssembly (`'wasm-unsafe-eval'` in the extension CSP, which the page's own CSP can't
  block), start a module Worker, and keep its storage in the extension's origin instead of the site's.
* **Why a Worker?** Inference never runs on the page's thread.
* **Audio** comes back to the content script as PCM and plays through the radio's own `AudioContext` (the one
  the organ uses), so the radio's volume applies and stopping is instant.

## Settings

Stored in `localStorage["tk-radio-v1"]` on play.smallball.com, which the Broadcast Kit also reads.

| Key | Meaning |
|---|---|
| `engine` | `"standard"` or `"enhanced"` (the picked engine, separate from whether the engine is loaded) |
| `pbp`, `color` | Standard voice for Mack and Dewey (browser voice names; shared with the Broadcast Kit) |
| `gv.quiz`, `gv.qb`, `gv.obvious` | Standard voice for Chet, Brock and Gary, each his own |
| `ev.p`, `ev.c`, `ev.quiz`, `ev.qb`, `ev.obvious` | Enhanced (Kokoro) voice per character; `""` = Not set, use Standard |
| `ksetup` | `{ done, at }` once the one-time setup has finished |
| `kgpu` | the last graphics-card check: `{ ok, why, gpu, ua }`, re-run when the browser version changes |

**Carried over from 1.26 settings:** `engine: "browser"/"kokoro"` → `"standard"/"enhanced"`. A picker that held a
Kokoro voice (`"kokoro:am_fenrir"`) becomes that character's Enhanced voice and his Standard voice goes back to
Automatic. In Kokoro mode a picker that held a browser voice meant "this character on the browser voice", so it
stays his Standard voice and his Enhanced voice becomes Not set. The old shared Guest voice becomes each guest's
Standard voice. `kdev` (Graphics card / Processor) is dropped. `guestVoice` itself is left alone for the
Broadcast Kit.

## The cast (Enhanced defaults)

| Character | Kokoro voice | Speed |
|---|---|---|
| Mack Ramsey (play-by-play) | `am_michael` (US) | 1.10 |
| Dewey Seeds (color) | `bm_george` (UK) | 0.95 |
| Chet Lambert (guest) | `am_puck` (US) | 1.05 |
| Brock Callahan (guest) | `am_fenrir` (US) | 1.00 |
| Gary Plainfield (guest) | `bm_fable` (UK) | 0.92 |

`KV` / `KSP` in `radio.js`. Each picker in the Enhanced box lists *Not set — use Standard* and the 28 English Kokoro
voices; the Standard box lists only browser voices. Kokoro has no pitch control, so the Standard engine's
per-character `pitch` doesn't apply, and Mack's "talks faster when he's behind" is Standard only.

## Graphics card required

Enhanced voices run on WebGPU with the fp32 model (~326 MB). The processor (WASM) path is gone from the UI: single
threaded in an extension frame it ran 2–3× slower than speech (RTF 2.0–2.9 here, 2.7 on a tester's desktop).

* **Before anything downloads**, the worker checks: `navigator.gpu` exists, a non-fallback adapter is returned,
  a device can be created, and a 256-element compute shader returns the right answers. This runs when the panel
  is first opened (and before setup), loads only the small engine frame and worker (not the model), and the result
  is kept per browser version.
* If the check fails, **Enhanced is greyed out** with the reason and a *Check again* button. Integrated graphics
  pass when the browser exposes them through WebGPU; no dedicated GPU is assumed.
* Setup's warm-up then makes a line in every assigned voice and rejects garbled output (bad numbers, or zero
  crossings on more than a quarter of active samples; speech is a few percent). A card that garbles is recorded as
  not compatible. A download or start-up error isn't (it's worth retrying).
* At run time a garbled line is spoken with the Standard voice; after three failures Enhanced stops for the session.
  If the median make-time of recent lines is longer than the lines themselves, the booth goes back to Standard and
  says so (*Try Enhanced again*).

## One-time setup

Picking **Enhanced** starts setup (also *Set up Enhanced voices* / *Continue setup* in the box):

1. Check the graphics card (above).
2. Download the model, config, tokenizer and assigned voices, with a progress bar.
3. Start the engine and validate every assigned voice.
4. Pre-record the fixed commentary in the assigned voices (progress: *n of N, about M minutes left*).
5. Keep the downloads (Cache API) and the recordings (IndexedDB), pinned so live lines can't push them out.
6. Mark setup done and unload the engine.

*Stop setup* pauses it; the downloaded files and finished recordings are kept, and *Continue setup* picks up the
missing lines only. If the radio is turned on before setup finishes, the engine loads, the broadcast starts, and the
remaining lines are recorded while the booth is quiet.

## Engine lifecycle

The selected engine (`engine`) and the runtime state (`K.st`: off, loading, ready, failed) are separate. A
once-a-second check unloads the engine (removes the frame, which ends the worker and frees the GPU) whenever none of
these need it: the radio on the air, getting ready to go on the air, the booth test, or an explicit setup/update.

* **Turn the radio on** (Enhanced): the button reads *Getting the voices ready · click to cancel*, the caption shows
  the phase and progress (with *Start now with Standard voices*), and the broadcast starts by itself when the engine
  is ready. If it fails, the broadcast starts on Standard voices with the reason in the box.
* **Turn the radio off:** speech stops at once, the queue is cleared, a line still being made can't play (nothing is
  speaking to receive it), and the engine is unloaded immediately (measured: frame gone within the same second).
  An explicit setup or update in progress keeps running.
* **Test the booth:** one line from each of the five characters, in their assigned voices (Enhanced where set,
  Standard otherwise). The engine starts first if needed and unloads when the test finishes unless the radio's on.
* **Switching to Standard** unloads the engine at once and pauses any setup. **Switching to Enhanced** runs setup
  if it isn't done, or starts the engine if the radio is on (Standard voices fill in while it loads).
* **Changing an Enhanced voice or a guest checkbox** re-pins the recordings for the new assignments and, 2.5 s after
  the last change, loads the engine to record what's missing, then unloads again.

## Saved clips and the cache lookup fix

Every clip is keyed `fp32|voice|speed|text`, so a clip is only ever reused for exactly that voice, speed and words;
a changed assignment never plays an old voice.

**Fix:** previously the radio only knew about saved clips it had made this session or Mack's stock calls, so a line
saved in an earlier session could be judged too slow to make and skipped. Now the engine sends the key of **every**
saved clip when it opens (`keys`). Any queued line whose clip is saved is read from IndexedDB at once (`get`, no model
needed, in parallel with generation) and is never skipped for being slow to make; it is still skipped if it's played
past its shelf life. Measured: a dynamic line (Mack's intro with the team names) made in one browser session played
from disk in the next at the moment the radio came on (cold: 20 s to make on the CPU stand-in).

## Pre-recording

`kLines()` in `radio.js` lists every line that has no live game details:

* pitch and contact calls (the stock ball/strike/count calls), and the booth test lines
* play-by-play calls with no names, and the fielding calls expanded for all nine positions
* Mack's needles without names; Dewey's color, idle lines, ballpark lines, exhibition/ProLeague/good-match, blowout,
  tired arm, errors, final, intro, 100/150 pitches
* booth banter, the guests' intros, hellos, lines and roasts (guests that are switched on)
* trivia openers, wrong answers, questions and answers (Mack, and Chet when he's on), seventh-inning stretch,
  BigLeague asides, the archive stories, and the lore (in both Mack's and Dewey's voices, since either says it)

With the default cast and all guests on that's **648 clips, 42,700 characters, about 48 minutes of speech**
(Mack 313, Dewey 242, Chet 67, Brock 15, Gary 11). Lines with names, scores, counts with the gun reading,
standings or player stats are made on demand. A stock call with an extra ("Ball one. 92 on the gun.") plays the
recorded call at once and makes the rest while it plays.

Setup time depends on the graphics card: it's ~48 minutes of speech × the card's RTF (about 5 minutes at RTF 0.1,
15 at 0.3). Lines are recorded most-useful first (pitch calls, test lines, play-by-play, color…, lore last), so a
partial setup already covers the time-critical calls.

## Storage

| What | Where | Size |
|---|---|---|
| Model (fp32), config, tokenizer | Cache API `transformers-cache` (IndexedDB `sbx-radio-kokoro-files` where the Cache API refuses) | ~326 MB |
| Voice files | Cache API `kokoro-voices` | ~0.5 MB each |
| Pre-recorded lines (pinned) | IndexedDB `sbx-radio-kokoro` | ~11.5 MB as Opus for the default cast (~140 MB if stored as 16-bit PCM) |
| Live lines | same database, not pinned | up to 30 MB, least recently used dropped first |

* Clips are stored as **Opus at 32 kbit/s** through WebCodecs (`AudioEncoder`/`AudioDecoder`; Chrome/Edge 94+,
  Firefox 130+), checked once with a real round trip; where that isn't available they're stored as 16-bit PCM.
  Measured: 50 pre-recorded lines (85 s of speech) took 340 KB, about 12× smaller than PCM. Decoders return Opus at
  48 kHz; the clip plays at the rate it comes back at.
* The old cache was one 40 MB LRU shared by everything, about 14 minutes of 16-bit speech: too small for the
  pre-recorded set, and live lines would have pushed it out. Now pinned clips are never evicted by live lines (a
  250 MB safety cap applies only to the PCM fallback). When a voice changes, the old voice's pinned clips become
  ordinary clips: kept while there's room, so switching back is free, and dropped first when space is needed.
* The engine frame is an extension page, so storage belongs to the extension, not to play.smallball.com. Browsers
  partition embedded-frame storage by top-level site; the frame is only embedded on play.smallball.com, so it always
  sees the same storage. Storage is best-effort; if the browser evicts it, the radio notices the missing clips the
  next time the engine starts and records them again while the booth is quiet.
* **Clear Enhanced downloads** (in the Enhanced box, and in the Standard box once set up) deletes both caches and
  both databases, unloads the engine, resets setup and switches Voices to Standard.

## Testing (headless Chromium in a Linux VM, no GPU)

Run against a local mock of play.smallball.com (a scripted game: a pitch every 2.2 s, counts, contact, play-log
lines) and of Hugging Face serving the real Kokoro v1.0 files.

* **No compatible GPU (shipping code):** the check reported "the browser found no graphics card it can use";
  Enhanced was greyed out with the reason and *Check again*; the engine frame was gone 2.5 s after the check; the
  radio and the booth test (all five characters) ran on Standard. Old 1.26 settings were carried over as described.
* **Everything else** needs a GPU this VM doesn't have, so it ran on a test copy whose GPU check returns OK and whose
  model runs on WASM (q8) instead, with pre-recording cut to the first 50 lines. Results:
  * Setup: check, download progress, warm-up, 50 lines pre-recorded (each saved as Opus), setup marked done, engine
    unloaded.
  * Booth test: engine loaded by itself, all five characters played from saved clips in their own voices, engine
    unloaded when the test ended.
  * Radio on: *Getting the voices ready*, then on the air by itself; radio off: engine frame gone the same second.
  * Across browser restarts: zero Hugging Face bytes; pitch calls and the previous session's dynamic intro played
    from disk.
  * Opus round trip: the same line fresh vs from disk ran 1,200 vs 1,220 ms, 2,125 vs 2,140 ms (Opus frame padding).
  * Voice change (Mack → Puck, Dewey → Not set, Chet → Echo, Gary → Not set): 2.5 s later the engine loaded by
    itself, recorded the 47 missing lines, pinned them, demoted the old voice's clips and unloaded. The booth test
    then played Mack (Puck), Chet (Echo) and Brock (Lewis) from saved clips and Dewey and Gary on Standard.
  * Clear: storage back to ~1 MB, engine unloaded, Voices back to Standard, setup reset.
  * First download: the model was fetched once (95.6 MB sent for the 92 MB q8 model plus config and voices;
    transformers.js opens a second request for the model and drops it after the first bytes).
  * Broadcast, 90 s of the scripted game at the CPU stand-in's RTF 2.3 (a real GPU should be far faster):
    **warm** (after setup) 14 lines on Enhanced, 13–14 of them from saved clips, 0–3 skipped as late, the intro
    from disk at once; **cold** (no setup) the engine was ready in 10 s but 26 lines were skipped as too late and
    the intro took 20 s to make. This is why setup pre-records.
* **Select options:** computed styles checked (dark fill, light text, blue for the selected option,
  `color-scheme: dark`). The open drop-down list is drawn by the browser and can't be captured headless, so it still
  needs a look on Windows/macOS Chrome and Firefox.
* **Not tested here:** real-GPU speed and audio (WebGPU on real hardware), Firefox (not installable in this VM),
  full-length setup time.

## Dependencies (vendored, unmodified)

| File | From | License |
|---|---|---|
| `vendor/kokoro.bundle.js` | Built by `build/` (esbuild, pinned lockfile) from npm `kokoro-js@1.2.1` + `@huggingface/transformers@4.3.2` + `phonemizer@1.2.1` | Apache-2.0 (see note) |
| `vendor/ort-wasm-simd-threaded.asyncify.mjs` / `.wasm` | npm `onnxruntime-web@1.31.0-dev.20260914-8d85527a0` `dist/` (the ORT that transformers 4.3.2 uses), unmodified | MIT |

kokoro-js 1.2.1's own `kokoro.web.js` bundles transformers 3.5.1 with ONNX Runtime 1.22-dev, whose WebGPU path
garbled most voices on a real graphics card in testing. The bundle is rebuilt on transformers 4.3.2 / ONNX Runtime
1.31 instead; `cd build && npm ci && npm run build` reproduces it byte for byte. ONNX Runtime's WebGPU backend still
loads its `.wasm`, so that file stays.

sha256 hashes are in `vendor/SOURCES.txt`. Model data (downloaded at run time, not shipped):
`onnx-community/Kokoro-82M-v1.0-ONNX` on Hugging Face (Apache-2.0): `onnx/model.onnx` (fp32), `config.json`,
`tokenizer*.json`, and the assigned `voices/*.bin`.

**License note:** `phonemizer` is published as Apache-2.0 but contains a WebAssembly build of eSpeak NG, which is
GPL-3.0. The kit has no license file of its own; the maintainer should decide whether distributing it this way is
acceptable (the alternatives are a different phonemizer or dropping Kokoro). See `vendor/NOTICE.txt`.

## Extension store notes

* **Remote code:** none. Every script and the `.wasm` ship in the package; `wasmPaths` points ONNX Runtime at
  `vendor/` instead of its default CDN. Only model weights and voice tensors (data) are downloaded.
* **Manifest:** `content_security_policy.extension_pages` = `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'`
  and one `web_accessible_resources` entry (`kokoro/engine.html`, only for play.smallball.com). No new permissions.
* **Firefox / AMO:** the vendored files are unmodified release files, and the bundle is reproducible from `build/`
  (submit that as the source code). `kokoro.bundle.js` is 1.9 MB (under AMO's 4 MB parse limit); the `.wasm` is
  26.9 MB. `data_collection_permissions: none` still holds; the listing should mention the one-time download from
  huggingface.co.
* **Size:** the kit grows by ~24 MB unpacked (~5.5 MB zipped), almost all the ONNX Runtime `.wasm`.

## Known limitations

* No Enhanced voices without a WebGPU-capable graphics card (by design). Firefox has WebGPU on Windows from 141;
  elsewhere Firefox users get Standard voices.
* The first full setup takes several minutes on a fast card and longer on modest integrated graphics; it can be
  stopped and continued, and the broadcast doesn't wait for it.
* Changing a voice re-records that character's fixed lines (Mack's are about half the set).
* Kokoro reads numbers and names through its own text normalizer, so unusual club or player names can come out
  differently than in browser speech.
* Club Kit only: not in the Broadcast Kit's copy of the booth (`broadcast-kit/tk.js`), and not in the phone/iPad
  userscripts (no extension origin there).
