// SmallBall Club Kit: 📻 SmallBall Radio in the site's own game player.
// Mack Ramsey and Dewey Seeds (plus a guest) call the game you're watching out loud, in step with the picture.
// They only talk about what the player has already shown, so nothing is spoiled. Speech is the browser's own;
// nothing is sent anywhere. Read-only: it never plays, trains or saves anything.
// The booth itself is the same engine as the SmallBall Broadcast Kit's radio (copied in at build time).
(() => {
  if (window.top !== window) return;                         // not inside the Broadcast Kit's tiles
  if (document.getElementById("sbx-radio-launch")) return;
  let FEAT = {}; try { FEAT = JSON.parse(localStorage.getItem("sbx-features") || "{}"); } catch (_) {}
  if (FEAT.radio === false) return;
  if (typeof SBX_MOBILE !== "undefined" && SBX_MOBILE) return;

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  async function getJSON(url) { const r = await fetch(url, { credentials: "include" }); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }
  const KIND = { big: "BigLeague", pro: "ProLeague", exhibition: "Exhibition" };
  const nm = (s) => String(s || "").trim();
  const label = (m) => m ? `${esc(nm(m.away))} at ${esc(nm(m.home))}` : "Game";
  // The Broadcast Kit's state, cut down to one game: the one in the player on this page.
  const S = { meta: {}, layout: "single", air: [], main: 0 };
  let live = true;
  const tvCard = () => {}, tvCap = () => {}, tvSpoilClubs = () => new Set(), paintBooth = () => {};

  // The window: a floating panel. It stays in the page while closed, so the booth keeps talking.
  const css = document.createElement("style");
  css.textContent = `
    #sbx-radio-launch { position: fixed; left: 16px; bottom: 16px; z-index: 2147482999; display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 999px; border: 0; background: linear-gradient(135deg,#1e293b,#475569); color: #fff; font: 800 14px/1 system-ui, sans-serif; cursor: pointer; box-shadow: 0 6px 20px rgba(0,0,0,.35); }
    #sbx-radio-launch.on { background: linear-gradient(135deg,#991b1b,#ef4444); }
    #sbx-radio-launch.on::after { content: "ON AIR"; font-size: 10px; background: #fff; color: #b91c1c; border-radius: 999px; padding: 2px 6px; }
    #sbx-radio { position: fixed; left: 16px; z-index: 2147483001; width: 380px; max-height: calc(100vh - 90px); overflow: auto; background: #0b1220; color: #e5e7eb; border: 1px solid #334155; border-radius: 14px; padding: 12px 14px 14px; font: 13px/1.45 system-ui, -apple-system, Segoe UI, sans-serif; box-shadow: 0 16px 44px rgba(0,0,0,.55); }
    #sbx-radio:not(.open) { display: none; }
    #sbx-radio { color-scheme: dark; }   /* native parts (the open list of a select, scrollbars) drawn for a dark panel */
    #sbx-radio .hd { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; } #sbx-radio .hd b { font-size: 15px; } #sbx-radio .hd .x { margin-left: auto; background: none; border: 0; color: #94a3b8; font-size: 16px; cursor: pointer; }
    #sbx-radio .big { width: 100%; padding: 9px; border-radius: 10px; border: 1px solid #334155; background: #1e293b; color: #fff; font: 800 14px system-ui, sans-serif; cursor: pointer; }
    #sbx-radio .big.on { background: #b91c1c; border-color: #ef4444; }
    #sbx-radio .big:disabled { cursor: default; opacity: 1; background: #172033; }
    #sbx-radio .spin { display: inline-block; animation: sbx-radio-spin 1.6s linear infinite; }
    @keyframes sbx-radio-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { #sbx-radio .spin { animation-duration: 4s; } }
    #sbx-radio .rcap { min-height: 2.9em; margin: 8px 0 10px; padding: 7px 9px; border-radius: 8px; background: #111a2e; font-size: 13px; } #sbx-radio .rcap b { color: #fca5a5; }
    #sbx-radio .rrow { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; margin: 0 0 9px; }
    #sbx-radio .lbl { width: 84px; font-size: 12px; opacity: .7; }
    #sbx-radio select { flex: 1; min-width: 0; background: #0f172a; color: #fff; border: 1px solid #334155; border-radius: 8px; padding: 5px 6px; font: inherit; font-size: 12.5px; }
    #sbx-radio select:focus-visible { outline: 2px solid #3b82f6; outline-offset: 1px; }
    /* Every state of an option keeps light text on a dark fill, so the picked or highlighted voice stays readable */
    #sbx-radio select option, #sbx-radio select optgroup { background-color: #0f172a; color: #e5e7eb; }
    #sbx-radio select option:checked { background-color: #1d4ed8; color: #fff; }
    #sbx-radio select option:hover, #sbx-radio select option:focus { background-color: #1e40af; color: #fff; }
    #sbx-radio select option:disabled { color: #64748b; }
    #sbx-radio input[type=range] { flex: 1; }
    #sbx-radio .seg { display: inline-flex; border: 1px solid #334155; border-radius: 999px; overflow: hidden; }
    #sbx-radio .seg button { background: transparent; color: #cbd5e1; border: 0; padding: 5px 10px; font-weight: 700; font-size: 12px; cursor: pointer; }
    #sbx-radio .seg button.on { background: #1d4ed8; color: #fff; }
    #sbx-radio .seg button:disabled { opacity: .45; cursor: not-allowed; }
    #sbx-radio .mini { background: #1e293b; color: #fff; border: 1px solid #334155; border-radius: 8px; padding: 5px 10px; font-weight: 700; font-size: 12.5px; cursor: pointer; }
    #sbx-radio .sw { display: inline-flex; align-items: center; gap: 4px; font-size: 12.5px; }
    #sbx-radio .note { font-size: 12px; opacity: .6; margin: 6px 0 0; }
    #sbx-radio .rhow ol { padding-left: 18px; margin: 4px 0 8px; opacity: .85; } #sbx-radio .rhow li { margin: 0 0 4px; }
    #sbx-radio details summary { cursor: pointer; font-weight: 700; margin: 2px 0 8px; opacity: .85; }
    #sbx-radio .kbox { margin: -2px 0 10px; padding: 8px 9px; border: 1px solid #334155; border-radius: 10px; background: #0f172a; }
    #sbx-radio .kbox .kstat { margin: 0 0 8px; }
    #sbx-radio .kbox > b { display: block; margin: 0 0 6px; font-size: 12.5px; }
    #sbx-radio details.kbox > summary { margin: 0; font-size: 12.5px; }
    #sbx-radio details.kbox[open] > summary { margin-bottom: 8px; }
    #sbx-radio .kbox .rrow:last-child { margin-bottom: 0; }
    #sbx-radio .kbar { height: 6px; margin-top: 6px; border-radius: 999px; background: #1e293b; overflow: hidden; } #sbx-radio .kbar i { display: block; height: 100%; background: #22c55e; }`;
  document.documentElement.appendChild(css);
  const ov = document.createElement("div"); ov.id = "sbx-radio"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", "SmallBall Radio");
  ov.innerHTML = `<div class="hd"><b>📻 SmallBall Radio</b><span class="note" data-k="game" style="margin:0"></span><button type="button" class="x" aria-label="Close">✕</button></div>
    <button type="button" class="big" data-act="radio">📻 Turn the radio on</button>
    <div class="rcap" aria-live="polite"></div>
    <details><summary>⚙ Booth settings</summary><div class="rpanel"></div></details>`;
  const isOpen = () => ov.isConnected;
  const launch = document.createElement("button"); launch.id = "sbx-radio-launch"; launch.type = "button"; launch.textContent = "📻 Radio";
  launch.title = "SmallBall Radio: Mack and Dewey call the game you're watching, out loud. No spoilers.";
  function paintStage() {
    launch.classList.toggle("on", !!R.on);
    const b = ov.querySelector('[data-act="radio"]');
    if (b) {   // while the Enhanced voices get ready, the button is a status, not a control
      b.classList.toggle("on", !!R.on); b.disabled = prep === "radio";
      if (prep === "radio") { if (!b.querySelector(".spin")) b.innerHTML = `<span class="spin" aria-hidden="true">⏳</span> Tuning in the station…`; }
      else b.textContent = R.on ? "📻 On the air · click to turn off" : "📻 Turn the radio on";
    }
    if (!prep && !R.on) { const cap = ov.querySelector(".rcap"); if (cap && cap.querySelector('[data-act="prepskip"]')) cap.textContent = ""; }
    const id = S.air[0], g = ov.querySelector('[data-k="game"]'); if (g) g.innerHTML = id ? label(S.meta[id]) : "";
  }

  // ---------- Broadcast booth: the play-by-play each tile's player writes, gathered as it's shown ----------
  // SmallBall's player keeps a #playlog (newest first, each line tagged T1/B1…) and a #highlights list with
  // how rare a play is. The booth only records what the tiles have already shown: no spoilers.
  const LOG = {};            // game id → [{h, t, hl, at}] in the order they happened
  const TAGC = ["#ef4444", "#3b82f6", "#22c55e", "#eab308"];
  const halfName = (h) => { const m = /^([TB])(\d+)/.exec(h || ""); if (!m) return h || ""; const n = +m[2], sfx = n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"; return `${m[1] === "T" ? "Top" : "Bottom"} ${n}${sfx}`; };
  function attachLog(f, id) {
    let tries = 0;
    const go = () => {
      let d; try { d = f.contentDocument; } catch (_) { return; }
      const pl = d && d.getElementById("playlog"), hl = d && d.getElementById("highlights");
      if (!pl) { if (++tries < 60) setTimeout(go, 500); return; }
      watchBoard(f, id);                // the live scoreboard: pitch-by-pitch calls for the radio
      const L = LOG[id] || (LOG[id] = []);
      let prev = L.map((e) => e.k), primed = false;   // the log as last seen, oldest first ("T3|Strikeout" repeats, so order matters)
      const read = () => {
        const rare = {}; if (hl) for (const x of hl.querySelectorAll(".hl")) { const hh = (x.querySelector(".half") || {}).textContent || "", ii = (x.querySelector("i") || {}).textContent || ""; const t = x.textContent.replace(hh, "").replace(ii, "").trim(); rare[hh + "|" + t] = ii.trim() || "highlight"; }
        // #playlog is newest first. Line it up with what we had: the longest run at the end of the old list
        // that matches the start of the new one is already kept; everything after it is new.
        const cur = Array.from(pl.querySelectorAll(".ev")).reverse().map((ev) => { const h = ((ev.querySelector("span") || {}).textContent || "").trim(); return { h, t: ev.textContent.slice(h.length).trim() }; }).filter((x) => x.t);
        const keys = cur.map((x) => x.h + "|" + x.t);
        let j = Math.min(prev.length, keys.length);
        for (; j > 0; j--) { let ok = true; for (let q = 0; q < j; q++) if (prev[prev.length - j + q] !== keys[q]) { ok = false; break; } if (ok) break; }
        if (j === 0 && prev.length && keys.length >= prev.length && keys.slice(0, prev.length).join("\n") === prev.join("\n")) j = prev.length;
        const fresh = cur.slice(j);
        const added = [];
        for (const x of fresh) { const star = x.t.startsWith("*"); const t = star ? x.t.replace(/^\*\s*/, "") : x.t; const e = { k: x.h + "|" + x.t, h: x.h, t, hl: star ? "first time" : rare[x.h + "|" + t] || "", at: Date.now() }; L.push(e); added.push(e); }
        prev = keys;
        if (primed && added.length) radioFeed(id, added);   // the radio talks about new plays only, never the backlog
        primed = true;
        if (fresh.length) paintBooth();
      };
      read();
      new MutationObserver(read).observe(pl, { childList: true, subtree: true });
      if (hl) new MutationObserver(read).observe(hl, { childList: true, subtree: true });
    };
    go();
  }


  // ---------- 📻 Radio: a booth calls one tile's game out loud, in step with the picture ----------
  // Mack Ramsey (play-by-play, a shameless homer for the home team) and Dewey Seeds (color), plus a rotating
  // guest. Two feeds, both already on screen, so nothing is ever spoiled:
  //   • the player's own scoreboard (count, outs, pitch counter, batter, pitch speed, score): live, every pitch
  //   • the player's play log: what each play was, posted once the ball is dead
  // Every line has a shelf life. A stale line is skipped, and a big play cuts a joke off, so the booth stays
  // with the pitch instead of drifting behind it. Speech is the browser's own; nothing is sent anywhere.
  const RKEY = "tk-radio-v1";
  // Voices: "standard" (the browser's own speech) or "enhanced" (Kokoro, below). Standard voices: pbp, color (both
  // shared with the Broadcast Kit, which reads the same settings) and gv, one per guest. Enhanced voices: ev, a Kokoro
  // voice per character, "" for none (that character uses his Standard voice).
  const RDEF = { on: false, style: "pbp", quips: "some", updates: "half", air: "nonstop", sit: "some", lean: "fair", pbp: "", color: "", guestVoice: "", vol: 1, organ: true, game: 0, pitches: "all", guests: { quiz: true, qb: true, obvious: true }, engine: "standard", ksetup: null, kgpu: null };
  let R; try { R = Object.assign({}, RDEF, JSON.parse(localStorage.getItem(RKEY) || "{}")); } catch (_) { R = Object.assign({}, RDEF); }
  R.guests = Object.assign({}, RDEF.guests, R.guests || {});
  // The Enhanced cast: one Kokoro voice per character by default. (Kokoro has no pitch control; the voices differ instead.)
  const KV = { p: "am_michael", c: "bm_george", quiz: "am_puck", qb: "am_fenrir", obvious: "bm_fable" };
  const KSP = { p: 1.1, c: 0.95, quiz: 1.05, qb: 1.0, obvious: 0.92 };
  // Settings saved by the first Kokoro version: Voices was "browser" or "kokoro", and the Mack/Dewey/Guest pickers could hold a Kokoro
  // voice ("kokoro:am_michael") or, in Kokoro mode, a browser voice to mix the two. Carry each choice over.
  if (!R.ev || typeof R.ev !== "object") {
    const ev = Object.assign({}, KV), was = R.engine === "kokoro";
    const from = (val, chs) => { if (typeof val !== "string" || !val) return; if (val.startsWith("kokoro:")) chs.forEach((c) => { ev[c] = val.slice(7); }); else if (was) chs.forEach((c) => { ev[c] = ""; }); };
    from(R.pbp, ["p"]); from(R.color, ["c"]); from(R.guestVoice, ["quiz", "qb", "obvious"]);
    R.ev = ev;
  }
  R.ev = Object.assign({}, KV, R.ev);
  for (const k of ["pbp", "color", "guestVoice"]) if (typeof R[k] === "string" && R[k].startsWith("kokoro:")) R[k] = "";
  if (!R.gv || typeof R.gv !== "object") R.gv = { quiz: R.guestVoice || "", qb: R.guestVoice || "", obvious: R.guestVoice || "" };
  R.gv = Object.assign({ quiz: "", qb: "", obvious: "" }, R.gv);
  R.engine = R.engine === "kokoro" || R.engine === "enhanced" ? "enhanced" : "standard";
  delete R.kdev;
  if (R.pitches === "auto") R.pitches = "some";            // 0.8: the booth is a show now; the old Auto becomes Some
  const SHOW = () => R.style !== "pbp";
  R.on = false;                                   // speech needs a click to start, so it always starts off
  const rsave = () => { try { localStorage.setItem(RKEY, JSON.stringify(Object.assign({}, R, { on: false }))); } catch (_) {} };
  const TTS = typeof speechSynthesis !== "undefined";
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const lastPick = {};
  function pickFresh(cat, a) { if (a.length < 2) return a[0]; const seen = lastPick[cat] || (lastPick[cat] = []), keep = Math.min(a.length - 1, Math.max(1, Math.floor(a.length * 0.7))); let s, n = 0; do { s = pick(a); } while (seen.includes(s) && ++n < 12); seen.push(s); while (seen.length > keep) seen.shift(); return s; }
  const fill = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => (o[k] != null ? o[k] : ""));
  const say1 = (n) => ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][n] || String(n);
  const capF = (s) => s.replace(/^./, (c) => c.toUpperCase());
  const ord = (n) => ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth"][n] || n + "th";
  const spk = (s) => nm(s).replace(/\s*-[^-\s][^-]*-\s*$/, "").replace(/[*_#~`|<>\[\]{}]/g, "").replace(/\s+/g, " ").trim() || "the visitors";
  const POS = { P: "the pitcher", C: "the catcher", "1B": "first", "2B": "second", "3B": "third", SS: "short", LF: "left", CF: "center", RF: "right" };
  const POSN = { P: "the pitcher", C: "the catcher", "1B": "the first baseman", "2B": "the second baseman", "3B": "the third baseman", SS: "the shortstop", LF: "the left fielder", CF: "the center fielder", RF: "the right fielder" };
  const POSP = { P: "pitching", C: "the catcher", "1B": "playing first", "2B": "playing second", "3B": "playing third", SS: "at shortstop", LF: "out in left", CF: "in center", RF: "out in right", DH: "the designated hitter" };

  // What a play-log line says, in a shape the booth can talk about.
  function parsePlay(raw) {
    const first = /^\*\s*FIRST:/i.test(raw);
    const t = raw.replace(/^\*\s*(FIRST:)?\s*/i, "").trim(); let m;
    const nmClean = (s) => s.replace(/\*+/g, "").trim();
    if ((m = /^—\s*end of (top|bottom) (\d+)\s*—$/i.exec(t))) return { k: "end", half: m[1].toLowerCase(), inn: +m[2] };
    if ((m = /put up (\d+) in the (top|bottom) of the (\d+)/i.exec(t))) return { k: "bigfirst", runs: +m[1], first };
    if (/double play/i.test(t)) return { k: "dp", t, first };
    if (first && (m = /^(\d+)\s+(.+?)\s+—\s+(.+)$/.exec(t))) return { k: "milestone", name: nmClean(m[2]), what: m[3], t };
    if ((m = /^(\d+)\s+(.+?):\s*(.+?)(?:,\s*(\d+)\s+scored)?$/i.exec(t))) {
      const what = m[3].toLowerCase(), sc = +(m[4] || 0), name = nmClean(m[2]);
      const k = /grand slam|home run|homer/.test(what) ? "hr" : /triple/.test(what) ? "3b" : /double/.test(what) ? "2b" : /base hit|single|bunt hit|infield hit/.test(what) ? "1b" : "other";
      return { k, name, what, scored: sc, num: +m[1], first };
    }
    if ((m = /^(\d+)\s+(.+?)\s+(strikes out|walks|called out|is hit by(?: a)? pitch|hit by pitch)(?:,\s*(\d+)\s+scored)?/i.exec(t))) {
      const w = m[3].toLowerCase();
      return { k: /strikes/.test(w) ? "k" : /called/.test(w) ? "kc" : /walk/.test(w) ? "bb" : "hbp", name: nmClean(m[2]), scored: +(m[4] || 0), first };
    }
    if ((m = /^(1B|2B|3B|SS|LF|CF|RF|P|C)\s+—\s+(.+)$/.exec(t))) {
      const how = m[2].toLowerCase();
      return { k: "out", pos: m[1], how: /fly/.test(how) ? "fly" : /line/.test(how) ? "line" : /ground/.test(how) ? "ground" : /pop/.test(how) ? "pop" : how, raw: m[2], first };
    }
    if (/^foul/i.test(t)) return { k: "foul" };
    if (/off the bag|error|bobble|drops|boot/i.test(t)) return { k: "miscue", t, first };
    if ((m = /^(.+?):\s*(forced at|out at|thrown out at|caught stealing|steals|picked off)\s*(\w+)?/i.exec(t))) return { k: "runner", name: nmClean(m[1]), what: m[2].toLowerCase(), base: (m[3] || "").toLowerCase(), first };
    return { k: first ? "milestone" : "raw", t, first };
  }

  // ---- What the booth says ----
  const L_PBP = {
    "1b": ["Base hit, {n}.", "{n} pokes one through. Single.", "{n} finds a hole, and he's aboard.", "Bouncer up the middle, base hit for {n}."],
    "2b": ["Into the gap! {n} into second with a double.", "Off the wall! Stand-up double for {n}.", "Two-bagger for {n}!", "Down the line, fair ball! {n} cruises into second."],
    "3b": ["He's going for three... and he's in! Triple, {n}!", "Triple! {n} is flying around the bases!", "Rattling around the corner, {n} into third standing up!"],
    hr: ["Gone! {n} with a home run!", "Way back... and outta here! {n}!", "Get up, baseball... it's gone! Home run, {n}!"],
    k: ["{n} strikes out.", "Struck him out! {n} goes down swinging.", "Strike three, and {n} sits down."],
    kc: ["{n} caught looking.", "Called strike three on {n}. He's not happy about it.", "Paint! {n} watches strike three go by."],
    bb: ["{n} draws a walk.", "Ball four. {n} takes his base.", "{n} works the walk."],
    hbp: ["Oh, it got him! {n} takes his base, and maybe some ice."],
    fly: ["Caught in {p}. Out.", "And it's caught. One more out.", "Settles under it in {p}. Out."],
    line: ["Lined right at {pn}. Out.", "Snared by {pn}!", "Right at {pn}. Out."],
    ground: ["Grounder to {pn}, throw on time. Out.", "Chopper to {pn}, and he's out.", "{pn} handles it. Out."],
    pop: ["Popped up. {pn} squeezes it.", "Infield pop, {pn} has it. Out."],
    out: ["{raw}, {pn}."],
    foul: ["Fouled away.", "Foul ball.", "Fouled back."],
    runner: ["{n}, {what} {base}."],
    miscue: ["Oh! The throw pulls him off the bag! Everybody's safe!", "And it's mishandled! Runners are moving!"],
    dp: ["Double play! Two outs on one swing!", "Around the horn, double play!"],
    milestone: ["Mark it down, folks: {t}. That's a first!"],
    contact: ["Swung on, and hit...", "Here's the swing... and contact!", "There's a drive...", "Swung on..."],
  };
  const L_COL = {
    hr: ["Tell that baseball to send us a postcard!", "Somebody in the parking lot just lost a windshield.", "That ball's got frequent flier miles now, Mack.", "He didn't just hit it. He evicted it.", "I'd like to apologize to that baseball on behalf of all of us."],
    "3b": ["Triples are the most fun thing in baseball, and I will not be taking questions.", "{n}'s running like the buffet's about to close.", "I haven't moved that fast since the ice cream truck in nineteen eighty-seven."],
    "2b": ["Right in the gap. That's where hits go to be happy.", "{n} is seeing it like a beach ball today.", "Doubles win ballgames, Mack. So do triples. And runs. I've said too much."],
    "1b": ["A single's a single. Doesn't have to be pretty, just has to be on first.", "Seeing-eye single. That ball had GPS.", "Duck snort! My favorite kind of hit. Don't ask me why."],
    multi: ["That's {h} hits for {n} today. Somebody check that bat for a permit.", "{n} is locked in. He could hit a pea with a pool noodle right now."],
    k: ["Sit down, son. The bench has snacks.", "He swung at that like it owed him money.", "That pitch had more moves than my uncle at a wedding."],
    kstreak: ["That's {s} strikeouts in a row. The fans are fanning themselves.", "{s} straight punchouts. Somebody tell the hitters the ball is round."],
    kc: ["Caught looking. That's the baseball version of watching the bus pull away.", "He'll be thinking about that one in the shower tonight."],
    bb: ["A walk's as good as a hit, unless you're trying to impress somebody.", "That pitch was somewhere in the next zip code.", "Free pass. Like the mints at the front desk."],
    fly: ["Can of corn.", "Hung up there long enough to file taxes."],
    line: ["Hit it hard, right at somebody. Cruel game, Mack.", "Atom ball. Nothing you can do."],
    ground: ["Rolled over that one.", "Routine as a Tuesday."],
    pop: ["That's a souvenir for nobody."],
    score2: ["Here they come! Run, run, run!", "Crooked number! I love a crooked number.", "Rally caps, everybody!"],
    miscue: ["Whoa! The glove went one way and the throw went the other.", "That'll be an awkward film session tomorrow."],
    dp: ["Twin killing! A pitcher's best friend.", "Two for the price of one. Very economical."],
    clean: ["Quick inning. I couldn't even finish my hot dog.", "In and out. Like me at the dentist."],
    big: ["The {team} are batting around like it's batting practice!", "Somebody get the bullpen on the phone. Landline, cell phone, carrier pigeon, anything."],
    stranded: ["Runners left aboard. You hate to see it.", "All dressed up and nowhere to go."],
    milestone: ["That's a first, Mack! Somebody grab that ball for the trophy case.", "Firsts are special. Ask me about my first mustache. Actually, don't."],
    slow: ["{mph} miles an hour. My mailman throws harder than that.", "{mph}. You could read the stitches on that one. You could read a novel.", "{mph} on the gun. That's not a fastball, that's a suggestion."],
    fast: ["{mph}! That's gas!", "{mph}. You hear that pop? That's a grown man's fastball."],
    full: ["Full count. This is where legends are made. Or not. Usually not.", "Payoff pitch coming. I can't look. I'm looking."],
    idle: ["Beautiful day for a ballgame, Mack.", "You can smell the popcorn from up here, Mack. Somebody's burning it, but you can smell it.", "I brought binoculars today. Wrong prescription. Everybody looks like a hot dog.",
      "Fun fact, Mack: nobody in this ballpark has ever caught a foul ball in the booth. I'd like to be the first. Throw it up here.", "The wave's trying to start in section twelve. It's not going to make it. It never makes it.",
      "My doctor told me to cut back on ballpark nachos. So I switched to ballpark nachos with extra cheese. That's a different food.", "Somewhere out there a kid's listening to this on the radio, Mack. Hi, kid. Do your homework.",
      "I tried to keep score with a pencil today. I'm on my third pencil and it's the second inning.", "You know what I love about baseball? There's no clock. You know what I hate about baseball? There's no clock.",
      "The grounds crew mowed a checkerboard into the outfield. I lost at checkers to it.", "I've got a lucky charm in my pocket, Mack. It's a peanut. I'm going to eat it in the ninth.",
      "Mack, if you could have any superpower in baseball, what would it be? Mine's being able to find my car after the game.", "The pitcher's taking his time. I respect that. I take my time with everything. Ask my wife about the deck.",
      "There's a guy in the third row with a sign that just says 'HI MOM'. Hi, mom. Not his mom. Mine. She listens.", "No bullpen, no DH drama, no replay review. SmallBall, Mack. Just ball.",
      "Every one of these players is one of a kind, Mack. Genetically. The game says so. Some of them are one of a kind in the wrong way.", "The organist here only knows three songs, and I'm pretty sure they're all the same song.", "If you're just joining us, pull up a chair. Not mine. Mine's taken.", "I've been doing this thirty years, Mack, and I still don't know the infield fly rule.", "I've seen a lot of baseball, Mack. Most of it from this exact seat. The seat has a dent now."],
    banter: [
      [["c", "Mack, settle something for me. Hot dog: a sandwich?"], ["p", "Dewey, we are calling a baseball game."], ["c", "That's not a no."]],
      [["p", "Dewey, what's the first thing you'd do as Commissioner?"], ["c", "Free hot dog Fridays. Then I'd fix football."], ["p", "There's no football."], ["c", "That's how bad it was."]],
      [["c", "I tried training my own club once, Mack."], ["p", "How'd that go?"], ["c", "I put the whole pie into running. Then I found out about the running bug."]],
      [["p", "Our producer says we've got listeners in fourteen states tonight."], ["c", "Fourteen! Say hi to the other thirty-six for me."]],
      [["c", "You ever notice the umpire never gets a mood face, Mack?"], ["p", "He doesn't have moods, Dewey. He has rules."], ["c", "Sounds like my landlord."]],
      [["p", "Dewey, rank the ballparks. Go."], ["c", "Ocean Park, for the sand. Then anywhere with a short line at the concession stand."], ["p", "That's every park in the seventh inning."]],
      [["c", "Mack, if this game had a theme song, what would it be?"], ["p", "Whatever the organist knows. So, one of four songs."]],
      [["p", "Quick reminder, folks: we're SmallBall Radio, and we have no sponsors."], ["c", "If you'd like to sponsor us, we accept hot dogs."]],
    ],
    sit: ["{inn}, {outs}. {score}", "{outs} here in the {inn}. {score}", "We're in the {inn} with {outs}. {score}", "Here in the {inn}, {outs}. {score}"],
    starLow: ["{s} stars. I've had Yelp reviews with more stars than that.", "{s} stars, Mack. He's here for the snacks.", "A {s} star hitter. Somebody's cousin needed a job."],
    starHigh: ["{s} stars. That's a grown man, Mack.", "{s} stars. Pitchers have nightmares about this guy.", "{s} stars. Pitch around him. Pitch around the whole zip code."],
    errors: ["That's {e} errors for the {team} today. Somebody check those gloves for holes.", "Error number {e} for the {team}. The infield has turned into a slip and slide."],
    pitches100: ["That's a hundred pitches in this one, Mack. My arm hurts just watching.", "Pitch number one hundred. Somebody bring that man a bucket of ice."],
    hrCount: ["That's {n} homers in this one. Somebody tell the grounds crew to check the fences.", "Homer number {n} today. Lock up your windshields."],
    // SmallBall lore, from the Home Plate News archive (2002–2009, 2026) and the SmallBall Library, in the booth's own words
    lore: [
      "SmallBall's been at this since 1999, Mack. First season opened February eighteenth, two thousand one.",
      "Season four eighty-three ended in the summer of 2019, then the lights went out for seven years. Welcome back, everybody.",
      "Busiest year ever was 2002. A hundred and twenty thousand sign-ups. Half of 'em named a guy R2-D2.",
      "In 2003 the game minted sixty-nine thousand four hundred twenty new clubs. I'm told that number is a coincidence.",
      "Somewhere in the vault there's still a HAL 9000 playing the field. Hasn't missed a ground ball. Hasn't been trained since the Bush administration.",
      "One of the last box scores to survive from 2019: skins forty-two, Comic Book Villains nothing. Somebody had a day.",
      "Remember the trainer wars, Mack? ST versus DT. Families were torn apart.",
      "Free DT Fridays. Best day of the week in two thousand four.",
      "Back in the day, a Zz next to a club meant free win. Still does, mostly.",
      "Sunday night spawner attacks. Guys making no-name clubs just to beat 'em up. Dark times, Dewey.",
      "Frogging. Three computers, three games at once. Some men chose violence.",
      "The Commish always said there are no slumps in SmallBall. I'd like him to come explain this lineup.",
      "The Commish still owns the New York 9. Club number one. Some things never change. Like all sales being final.",
      "Fourth League, Mack. The paper called it a crime against humanity back in oh-four. They weren't wrong.",
      "The oh-four day in the life of a SmallBaller: up at five, train four clubs, lambaste the Commish, fall asleep on the keyboard. Nailed it.",
      "SmallBall stickers used to come out of Half Moon Bay, California. Send a self-addressed stamped envelope. I'm still waiting on mine.",
      "These physics came straight out of the 1999 Java game. That ball's been flying the same way for twenty-seven years.",
      "Every man in this league is genetically unique, Mack. Some of 'em uniquely bad.",
      "Retired clubs sleep with their skills frozen. Rip Van Winkle with a glove.",
      "Back in the day you'd hear the umpire yell out from your boss's office and know he was sneaking a game in.",
      "When the forums went down on Fat Tuesday oh-four, grown men wrote poetry about it. I was one of them.",
      "Kids on dial-up found this game on RealArcade in 2001. Some of 'em are still training the same club.",
      "Fix football. Fix football. Fix football. The three pillars of every Commish wishlist ever written.",
      "Honor rating, Mack. Beat good clubs and it climbs. Beat the Zz's and you're just a spawner with extra steps.",
      "Plug and play guys. Brag on the forums, then challenge everybody. You know the type.",
      "Owners used to post hit lists. Clubs they were coming for. Very mafia.",
      "Legends of the First League: Ryes Crew, Retry, Dark Elf's Destroyers. For Elf, winning First League was like getting the morning paper.",
      "Season thirteen to eighty-two, only thirty-eight different clubs won First League. Out of a hundred ninety thousand. Good luck, everybody.",
      "Whole pie training. Spend the entire pie on one skill and pray. That's how I raised my kids.",
      "Herbert Hoover quotes used to show up in Home Plate News for no reason at all. Honestly, a better sports page than most.",
      "Back in 2002 the paper ran a piece on training monkeys. Verdict: a monkey training your team isn't cheating, as long as you tell the monkey where to spend the pie.",
      "There was a whole season in the early days where nobody could hit a home run. One-nothing games, twenty-three innings. Then they fixed it, and the next season everything was thirty to twenty-nine.",
      "The Factcat TP leak. Found on a Saturday night, fixed by Sunday. Legend says a club touched ten stars for a few minutes. A few glorious minutes.",
      "Remember the running bug? Train running and your whole pie vanished. So nobody trained running, and nobody could beat out a throw from right field.",
      "Pies used to refill every twelve hours, Mack. If you had a job, you had a problem.",
      "Monster Park's original name was Fox Stadium. To catch a fox, you need speed, a glove and an arm. Power alone won't cut it.",
      "Letterbox Park got discontinued back in January oh-four. And yet here it is. Nothing in SmallBall ever really dies.",
      "The 900 Club, 2002. Ninety-nine limited-edition clubs, numbered nine hundred to nine ninety-nine, sixty-five bucks apiece. And the paper told everybody else to go stomp 'em.",
      "They only ever made a hundred forty-four official SmallBall caps. The rest of us wore regular hats like animals.",
      "The SmallBall Mall once listed an official SmallBall Bug. A car. Twenty-seven thousand dollars. It did not exist, but they said they'd build you one.",
      "Knuckle dusted, Mack. That's when a club wins First League and then vanishes the very next season. Like a magician. A really good magician.",
      "U.F.O.: Unconfirmed Fraudulent Opponent. You can't prove he's cheating, but you know. You just know.",
      "DT envy. Those who don't have the Deluxe Trainer wish they did. Official glossary term, two thousand two.",
      "Back in 2002 SmallBall had sixty-five thousand owners in over thirty countries. Greece had two clubs, and one of 'em won First League.",
      "Ryes Crew won First League four seasons in a row. The champion right after said matching that was impossible. Nobody's argued.",
      "SmallBall Radio, the original, had season reports in 2002 and an open phone line to Northern California. We're the revival, Dewey. Show some respect.",
      "The original SmallBall Radio had a frog. Johnny Bosco. Management was terrified of what he'd say. He mostly said ribbit.",
      "There was a 2002 contest for the fictional origin of SmallBall. The winner: a kid breaks a window, mom says no baseball in the house, so he makes it small. SmallBall.",
      "Life in the SmallBall Lane: Seventh League is a highway rest stop. You stop to stretch, take a nap, and three seasons later you're still there.",
      "There's a legend of a strange old man in Sixth League preaching the evils of the tenth star. Ten-star club. Stuck in Sixth for four seasons. Make of that what you will.",
      "The Commissioner will never ask for your password. If he does, he's a fake. Words to live by since two thousand three.",
      "Two-day pies, 2002. Solipsta explained it with a jelly bean jar: same beans every day, bigger jar. Still the best explanation anyone's ever given.",
      "In the old days the Pro Leagues had a mercy rule. Imagine getting mercy-ruled in a league game by a four-star club.",
      "Somebody once took Easter off from training and lost a whole star. Family time is expensive in SmallBall.",
      "Pi shows up in Home Plate News over and over. Three point one four one five nine, on down the line. Twenty-four years, nobody's explained it. The Commish likes pie.",
      "The 600 Club came with a quote ticket. Your own message right on the scoreboard. Imagine what people put up there.",
      "The old paper said it best: the best clubs in SmallBall don't always have the best skills. They have the best managers.",
      "The Wildcat PL Push. Ask any old-timer about it. SmallBall at its peak, Mack.",
      "Christmas 2004. SmallStarz goes crazy. Tickets raining down on the moderators like confetti. Best holiday in SmallBall history.",
      "Dial-up days, Dewey. Ten, fifteen minutes on Net Zero just to load your team page. Then you'd find out you lost.",
      "Some owners ran thirteen clubs at once back in the day. Frustrating? Yes. Glorious? Also yes.",
      "The Official SmallBall Chat. Opened New Year's Eve 2003, shut down October 2006. Some owners didn't visit. They lived there. Slip'N'Sliders lived there.",
      "Sunday nights in the chat, everybody up late waiting on the First League guys to play their games. Appointment television, but it's a chat room.",
      "Hammer Wars. I wasn't there. Nobody who was there will talk about it.",
      "Freerolls, wake-up calls, late night chat. The old-timers say the community was the real game. The baseball was just the excuse.",
      "SmallBall used to be run by a company called AndNow. Owners had opinions about AndNow. Strong ones.",
      "The old forums had a thread called The Search for Commish. Two hundred eighty-six replies. The man vanished and the whole league turned detective.",
      "One owner wrote it plain back in 2006: PL4 was a breeze, PL3 is the devil. Five seasons in Third League. Still the truest thing ever posted.",
      "Old-timers used to hand out free Deluxe Trainer clubs to new owners on the forums. That's SmallBall. Somebody always hands you a glove.",
    ],
    park: {
      "Jurassic Park": ["Jurassic Park, folks. Teams have been known to lose their nerve when the dinosaur shows up.", "No homers over those cliffs, Mack. Everything stays in the yard. Fielders, earn your money."],
      "World Park": ["World Park. Deep fences. Home run hitters come here to cry. Speed and contact clubs love it.", "World Park, where one dropped flag can turn a whole ballgame. Ask the old poets."],
      "Monster Park": ["Monster Park. That wall in left has eaten more fly balls than I've eaten hot dogs.", "Monster Park. Bring speed, bring contact, leave the long ball at home.", "Monster Park. Back in oh-two they called it Fox Stadium. To catch a fox, you need legs, a glove and an arm."],
      "Ocean Park": ["Ocean Park! Scoreboard's gonna light up like a pinball machine.", "Ocean Park. Players have been known to lose focus and wander off to play in the sand."],
      "Alice's Park": ["Alice's Park. A lefty's paradise. And the players get distracted flirting with Alice.", "Alice's Park, built for the lefties. Righties, keep your eyes on the ball. And off Alice."],
      "Field of Dreams": ["Field of Dreams. Plays honest, all facets of the game. Somebody always wanders off into the corn.", "Field of Dreams. A fair park. Just don't hit it into the corn, you'll never see it again."],
      "BrickYard": ["The BrickYard. Right-handed power goes to die here.", "BrickYard. Old-school park. Righty sluggers, good luck.", "The BrickYard. Catch one off those bricks and it's not an out. Lefties love it here."],
      "Homerun stadium": ["Homerun stadium. Pinball scores, folks. Pitchers, bring a helmet.", "Homerun stadium. The name is not a suggestion.", "Homerun stadium, opened back in oh-three. Owners bought it on purpose. Think about that."],
      "Centennial Field": ["Centennial Field. Built to celebrate season one hundred. Five bucks a ticket back then. All sales final.", "Centennial Field, the season one hundred park. Some history in these seats."],
      "League field": ["League field, the park every club gets. Home of everybody who hasn't bought a stadium ticket.", "Good old League field. No frills, no excuses."],
      "Home field": ["Home field. The practice grounds, where every rep teaches somebody something.", "Home field. Nice and cozy."],
      "Letterbox Park": ["Letterbox Park. Wide and short. Like me.", "Letterbox Park. Bring your reading glasses.", "Letterbox Park! They discontinued this place in oh-four. Nothing in SmallBall ever really dies."],
    },
    exhibition: ["It's an exhibition, folks. Counts for nothing on the record, but with Passive Training on, every strikeout is a batting rep. Somebody's here to study.", "Exhibition game. No standings on the line, just pride. And reps."],
    pro: ["ProLeague game. The ladder, Mack. Nine rungs from Junior to First, one up or one down every season.", "ProLeague! The organ plays the home club's anthem before these. I stood. I always stand."],
    good: ["And it's a good match: two clubs at the same star rating. This one counts for the Junior League climb.", "Good match today. Same stars, no excuses."],
    blowout: ["This is getting out of hand. We're approaching skins forty-two, Comic Book Villains zero territory.", "Somebody call the Commish. This needs a mercy rule, and SmallBall doesn't have one."],
    tired: ["No bullpen in SmallBall, Mack. One man, one game. He's losing about a percent a pitch, so by now he's throwing on fumes.", "Seventh inning, and there's no bullpen to save him. Whatever he's got left, that's the menu."],
    errLib: ["Low-star clubs make more errors. That's not me talking, that's the SmallBall Library.", "The ball never teleports in this game, Mack. It just goes wherever the glove isn't."],
    final: ["All sales final, folks. Some things never change.", "Drive home safe, everybody. Tip your hot dog guy.", "That's a wrap. I'm going to go find my car. I parked it somewhere."],
    intro: ["Mack, I've got a good feeling about this one. Then again, I had a good feeling about the gas station sushi.", "I stretched, I hydrated, and I'm wearing my lucky socks. Both of them.", "Somebody parked in my spot again, Mack, so you know I'm fired up."],
  };
  // Mack bleeds home-team colors and has no time for the visitors.
  const NEEDLE = {
    visBatter: ["Here's {n}. His batting average is more of a rumor, really.", "{n} steps in. Folks, great time to grab a hot dog.", "Here comes {n}. Keep your expectations low and you'll never be disappointed."],
    homeBatter: ["Here's {n}. Let's go, {team}!", "{n} to the plate. This guy rakes, Dewey.", "{n} steps in, and the home crowd is on its feet. Well, some of it."],
    visOut: ["Sit down, {n}. And stay down.", "That swing was ugly as hell, and I say that with love. I don't.", "Shocking. Truly nobody saw that coming."],
    visClean: ["And the {team} go down in order. Drive safe, fellas. Watch for potholes on the way out.", "One, two, three for the {team}. Somebody check if their bus is still running."],
    visHit: ["Even a broken clock, Dewey.", "Fine. Good for him, I guess.", "Lucky. That's all that was."],
    homeHit: ["That's how we do it around here!", "Oh, the {team} smell blood now!", "Yes sir! Put it on the fridge!"],
  };
  // Guests drop by the booth. Original characters; any resemblance is the booth's problem.
  const GUESTS = {
    quiz: { name: "Chet Lambert", pitch: 1.18, rate: 1.0,
      intro: ["p", "Joining us in the booth, the host of television's longest running quiz show, Chet Lambert."], hello: "Thank you, Mack. And remember, folks: please phrase your cheers in the form of a question.",
      lines: { hr: ["Ballparks for one thousand. What is... gone?", "The answer: four hundred feet and a souvenir. The question: what is a home run?"], k: ["The answer: three strikes. The question: what is, sit down?", "Ooh, I'm sorry. We were looking for 'make contact.'"], bb: ["Four balls. What is a walk? Correct, and you control the board."], dp: ["It's a Daily Double! Two outs on one play!"], out: ["What is a can of corn? Correct, for two hundred.", "The category is Routine Outs. Nobody buzzed in."], any: ["Let's check the scores. Mack, you're doing well. Dewey, you're in the negatives.", "Fun fact about our next batter: he once ate a sandwich.", "SmallBall History for five hundred: this man still owns club number one. Who is the Commish?", "Glossary for three hundred: a club marked Zz. What is... asleep, and probably an easy win?", "Old Trainers for two hundred: the trainer that was free on Fridays. What is the DT?", "Potent Potables... I'm sorry, Potent Pies. What is Training Potential?", "SmallBall Slang for four hundred: wins First League, vanishes the next season. What is knuckle dusted?", "Defunct Ballparks for six hundred: discontinued in oh-four, and yet here we are. What is Letterbox Park?", "SmallBall Merchandise for one thousand: twenty-seven thousand dollars, does not exist. What is the SmallBall Bug?"] },
      roast: [["c", "Chet, nobody asked you a question."], ["p", "Chet, it's a ballgame. Put down the little cards."], ["c", "He's been doing that all night, Mack. I asked him where the bathroom was and he said, what is down the hall."], ["p", "Chet, the scoreboard is not a game board. Stop buzzing in."]] },
    qb: { name: "Brock Callahan", pitch: 0.88, rate: 1.04,
      intro: ["p", "Also with us, a man with more championship rings than fingers, quarterback Brock Callahan."], hello: "Happy to be here, guys. I've been hydrating since Tuesday.",
      lines: { hr: ["That's what I call hip rotation. You know what else rotates? Crops. Think about it.", "When I see a ball go out like that, I think: championship DNA. I had mine tested. It's mostly championship."], "3b": ["In football, we'd call that a quarterback sneak. It's not. But it's the same energy."], k: ["See, he's in his own head. I sleep in a pressurized egg, so I'm never in my own head. I'm in the egg."], out: ["He made a great play there. And when you make a great play, that's a great play."], bb: ["Four balls? In my day you got one ball and you were grateful."], any: ["I haven't eaten a strawberry since two thousand nine. Too many seeds. Seeds slow you down.", "You know what wins ballgames, Mack? Winning. I've done a lot of it.", "I like this pitcher's footwork. Reminds me of me. Everything reminds me of me.", "In my day we trained on the ST. Uphill. Both ways. In the snow.", "I quick trained once. Whole pie, one skill. Felt incredible. Couldn't feel my legs for a week.", "I had a trainer monkey once. Great work ethic. Terrible with the pie.", "I own a SmallBall Bug. The car. Twenty-seven grand. They said it didn't exist. They built it for me. That's championship energy."] },
      roast: [["c", "Brock, you said the hot dog vendor had championship DNA."], ["p", "Thank you, Brock. Riveting, as always."], ["c", "Brock just asked me if the infield dirt is gluten free."], ["p", "Brock, that's a bat. You can't throw it."]] },
    obvious: { name: "Gary Plainfield", pitch: 1.0, rate: 0.95,
      intro: ["p", "And in the booth, the analyst's analyst, Gary Plainfield."], hello: "Thanks, Mack. Today's key to the game: whoever scores more runs, wins.",
      lines: { hr: ["When the ball goes over the fence like that, that's a home run. That's just baseball."], k: ["Three strikes there, Mack. That's an out. I've studied this."], out: ["That's a big out. Because it's an out."], any: ["If they want to win this game, they'll need to score more runs than the other team.", "You can see he's a batter, Mack. He's holding a bat.", "The team that's ahead right now is winning.", "If a club has a Zz next to it, Mack, it's probably asleep. I've studied this.", "There's no bullpen in this game, so the pitcher who starts... is the pitcher. That's just facts.", "Seventh League is in between Eighth League and Sixth League, Mack. I've studied the map."] },
      roast: [["c", "Groundbreaking, Gary."], ["p", "Gary, they pay you for this."], ["c", "Somebody write that down. Actually, don't."]] },
  };

  // Per-game memory, built only from what's on screen.
  const GS = {};
  const gstate = (id) => GS[id] || (GS[id] = { hits: {}, kRun: 0, half: "", halfRuns: 0, on: 0, said: {}, last: Date.now(), guest: null, guestIn: false });
  const shortName = (g, full) => { const parts = full.split(/\s+/); const short = parts.length > 1 ? parts[parts.length - 1] : full; if (g.said[full]) return short; g.said[full] = 1; return full; };
  function radioGame() {
    const max = S.layout === "single" ? 1 : 4, ids = S.air.slice(0, max);
    if (R.game && ids.includes(R.game)) return R.game;
    return S.layout === "main3" ? ids[S.main] || ids[0] : ids[0];
  }
  const quipOdds = () => (R.quips === "off" ? 0 : SHOW() ? (R.quips === "lots" ? 0.85 : 0.55) : R.quips === "lots" ? 0.72 : 0.36);
  const teams = (id, half) => { const m = S.meta[id] || {}; const away = spk(m.away), home = spk(m.home); const top = /^T|top/i.test(half || ""); return { bat: top ? away : home, fld: top ? home : away, away, home, visBat: top }; };

  // ---- The live scoreboard feed: every pitch, the batter, the gun, the score ----
  const BS = {};
  const PARK_NAMES = ["League field", "Home field", "Homerun stadium", "World Park", "Monster Park", "BrickYard", "Alice's Park", "Field of Dreams", "Letterbox Park", "Jurassic Park", "Ocean Park", "Centennial Field"];
  // Which clubs in a game are the viewer's own (the site's profile says "mine"). Skill numbers on the batter
  // card are only talked about for your own clubs; stars are public, so those are fair game for everyone.
  const MINE = {};
  async function loadMine(id) {
    if (MINE[id]) return; MINE[id] = new Set(); const m = S.meta[id] || {};
    for (const tid of [m.aid, m.hid].filter(Boolean)) { try { const pr = await getJSON(`/teams/${tid}/profile`); if (pr && pr.mine) MINE[id].add(tid === m.aid ? "away" : "home"); } catch (_) {} }
  }
  const starWords = (x) => String(x).replace(/\.0$/, "");
  function scoreLine(id, b, final, plain) {
    const t = teams(id), [a, h] = b.score;
    if (a === h) return final ? `${capF(say1(a))} all.` : `We're tied at ${say1(a)}.`;
    const homeUp = h > a, hi = Math.max(a, h), lo = Math.min(a, h), lead = homeUp ? t.home : t.away, trail = homeUp ? t.away : t.home;
    if (homeUp && !final && !plain && R.lean !== "fair" && Math.random() < 0.4) return `The good guys are up, ${say1(hi)} to ${say1(lo)}!`;
    return `${lead} ${say1(hi)}, ${trail} ${say1(lo)}.`;
  }
  function innWords(txt) {
    const n = +((/(\d+)/.exec(txt || "") || [])[1] || 0); if (!n) return "";
    return `${/▼|bot/i.test(txt) ? "bottom" : "top"} of the ${ord(n)}`;
  }
  const outWords = (o) => { const n = +String(o || "").replace(/\D/g, "") || 0; return n === 0 ? "nobody out" : n === 1 ? "one out" : "two outs"; };
  function sitLine(id) {
    const b = BS[id]; if (!b || !b.score || !b.innTxt || /final/i.test(b.innTxt)) return "";
    const inn = innWords(b.innTxt); if (!inn) return "";
    return capF(fill(pickFresh("sit", L_COL.sit), { inn, outs: outWords(b.outs), score: scoreLine(id, b, false, true) }).replace(/\s+/g, " ").trim());
  }
  const countWords = (b, s) => (b === 3 && s === 2 ? "full count" : `${b ? say1(b) : "oh"} and ${s ? say1(s) : "oh"}`);
  function pitchMode(b) {
    if (R.pitches === "off") return "off"; if (R.pitches === "all") return "all";
    if (R.pitches === "some" || SHOW()) return "some";        // the show: a pitch now and then, and every full count
    const iv = b.iv.slice(-4).sort((x, y) => x - y); const med = iv.length ? iv[Math.floor(iv.length / 2)] : 5000;
    return med < 2200 ? "off" : med < 3800 ? "key" : "all";       // 4× → results only, 2× → the big counts, 1× → every pitch
  }
  function watchBoard(f, id) {
    const b = BS[id] = { pitches: -1, cnt: [0, 0], pending: null, iv: [], lastPitch: 0, batter: "", score: null, final: false, hr: 0, err: [0, 0], fast: 0, dueSaid: "", opened: false };
    loadMine(id);
    const iv = setInterval(() => {
      if (!f.isConnected) { clearInterval(iv); return; }
      if (!R.on || id !== radioGame()) { b.pitches = -1; b.score = null; b.batter = ""; return; }   // re-sync when it comes back on
      let d; try { d = f.contentDocument; } catch (_) { return; } if (!d) return;
      const tx = (sel) => ((d.querySelector(sel) || {}).textContent || "").trim();
      const now = Date.now(), g = gstate(id);
      const pm = /(\d+)\s+pitch/.exec(tx("#stats")), np = pm ? +pm[1] : -1;
      const cm = /(\d+)\s*-\s*(\d+)/.exec(tx("#count")), cnt = cm ? [+cm[1], +cm[2]] : b.cnt;
      const score = [Number(tx("#score-a")) || 0, Number(tx("#score-b")) || 0];
      const inn = tx("#inning"), mph = +((/(\d+)\s*MPH/i.exec(tx(".sb-mph")) || [])[1] || 0);
      const outsTxt = tx("#outs");
      const msg = tx(".sb-msg"), bm = /Now batting:\s*#\d+\s+(?:\d+\s+)?(.+?),\s*(1B|2B|3B|SS|LF|CF|RF|P|C|DH)\b/.exec(msg);
      const stats = tx("#stats"), hrN = +((/(\d+)\s*HR/.exec(stats) || [])[1] || 0);
      const errs = [...d.querySelectorAll(".sb-line .e")].map((e) => Number(e.textContent.trim())).filter((x) => !isNaN(x));
      const fastest = +((/fastest today\s*(\d+)/i.exec(tx(".sb-mph")) || [])[1] || 0);
      const innPrev = b.innTxt; b.innTxt = inn; b.outs = outsTxt;
      if (b.pitches < 0) { b.pitches = np; b.cnt = cnt; b.score = score; b.batter = bm ? bm[1] : ""; b.final = /final/i.test(inn); b.hr = hrN; b.err = errs.slice(-2); b.fast = Math.max(fastest, mph); return; }
      const q0 = quipOdds();
      // the opening: where we are, who's pitching (both on the player's opening banner)
      if (!b.opened) {
        const take = tx(".sb-take-txt") + " " + tx("#poster"), sp = /starting pitchers\s+(?:\d+\s+)?(.+?)\s+and\s+(?:\d+\s+)?(.+?)(?:\s*$|\s{2})/i.exec(tx(".sb-take-txt"));
        const park = PARK_NAMES.find((p) => take.includes(p));
        if (park || sp) {
          b.opened = true; const t = teams(id, "top");
          say("p", `${park ? `We're coming to you from ${park}. ` : ""}${sp ? `On the mound, ${sp[1].replace(/\*+/g, "")} for the ${t.away}, and ${sp[2].replace(/\*+/g, "")} for the ${t.home}.` : ""}`, 2, { maxAge: 25000 });
          if (q0 && park && L_COL.park[park] && Math.random() < 0.85) say("c", pick(L_COL.park[park]), 1, { maxAge: 25000 });
          const mk = S.meta[id] || {};
          if (q0 && Math.random() < 0.6) { const kl = mk.kind === "exhibition" ? L_COL.exhibition : mk.kind === "pro" ? L_COL.pro : mk.good ? L_COL.good : null; if (kl) say(mk.kind === "pro" ? "p" : "c", pick(kl), 1, { maxAge: 25000 }); }
        } else if (np > 0) b.opened = true;
      }
      // between halves: who's due up
      if (/^Due up for/i.test(msg)) {
        const clean = msg.replace(/\d+\s*MPH.*$/i, "");
        const names = [...clean.matchAll(/(?:^|[^\d])(\d{1,2})\s+([A-Z][^·\d]*?)\s*(?=·|$)/g)].map((x) => x[2].replace(/\*+/g, "").trim().split(/\s+/).pop()).filter(Boolean).slice(0, 3);
        const key = names.join("|");
        if (names.length && key !== b.dueSaid) {
          b.dueSaid = key;
          const list = names.length > 1 ? names.slice(0, -1).join(", ") + " and " + names[names.length - 1] : names[0];
          say("p", pickFresh("due", [`Due up: ${list}.`, `Coming up this half: ${list}.`, `${list}, due up.`]), 2, { maxAge: 10000 });
        }
      }
      // errors on the line score
      if (errs.length >= 2) {
        const e2 = errs.slice(-2);
        [0, 1].forEach((i) => { if (e2[i] > (b.err[i] || 0)) { const t = teams(id); const team = i === 0 ? t.away : t.home; if (q0 && e2[i] >= 2) say("c", fill(pickFresh("err", L_COL.errors), { e: say1(e2[i]), team }), 1, { maxAge: 9000 }); else { say("p", `And that'll be an error on the ${team}.`, 1, { maxAge: 9000 }); if (q0 && Math.random() < 0.35) say("c", pick(L_COL.errLib), 1, { maxAge: 9000 }); } } });
        b.err = e2;
      }
      // home run count for the game
      if (hrN > b.hr) { b.hr = hrN; if (hrN >= 2 && q0) say("c", fill(pickFresh("hrc", L_COL.hrCount), { n: say1(hrN) }), 1, { maxAge: 10000 }); }
      // the inning changed on the scoreboard: the score, every half (or every full inning), whatever the play log says
      if (innPrev && inn && innPrev !== inn && !/final/i.test(inn) && R.updates !== "off") {
        const n0 = +((/(\d+)/.exec(innPrev) || [])[1] || 0), wasBot = /▼|bot/i.test(innPrev), key = (wasBot ? "B" : "T") + n0;
        if (n0 && !(g.halfSaid && g.halfSaid[key]) && (R.updates === "half" || wasBot)) {
          (g.halfSaid || (g.halfSaid = {}))[key] = Date.now();
          const lead = wasBot ? pickFresh("endinn", [`After ${say1(n0)}, `, `Through ${say1(n0)}, `, `${capF(say1(n0))} in the books: `]) : pickFresh("midinn", [`Middle of the ${ord(n0)}: `, `Halfway through the ${ord(n0)}, `, `At the break in the ${ord(n0)}, `]);
          say("p", lead + scoreLine(id, Object.assign({}, b, { score }), false, true), 3, { maxAge: 20000 });
          if (b.score) b.scoreSaid = true;
        }
      }
      // the batter
      if (bm && bm[1] !== b.batter) {
        b.batter = bm[1];
        const t = teams(id, /▲/.test(inn) ? "top" : "bottom"), n = shortName(g, bm[1].replace(/\*+/g, "").trim());
        const q = quipOdds();
        // the batter card: stars and hits today are public; skills only for your own clubs
        const card = d.querySelector(".sb-card"), ct = card ? card.textContent : "", last = bm[1].trim().split(/\s+/).pop();
        const okCard = ct.includes(last), stars = okCard ? parseFloat((/([\d.]+)\s*★/.exec(ct) || [])[1]) : NaN, hToday = okCard ? +((/·\s*(\d+)\s*H\b/.exec(ct) || [])[1] || 0) : 0;
        const sk = okCard && MINE[id] && MINE[id].has(t.visBat ? "away" : "home") ? { pow: +((/POW\s*(\d+)/.exec(ct) || [])[1] || 0), con: +((/CON\s*(\d+)/.exec(ct) || [])[1] || 0), run: +((/RUN\s*(\d+)/.exec(ct) || [])[1] || 0) } : null;
        let line;
        if (SHOW() && (RQ.length || speaking || Math.random() > 0.4)) { /* the show skips most intros */ }
        else if (q && R.lean !== "fair" && Math.random() < q * 0.5) line = fill(pickFresh(t.visBat ? "nvb" : "nhb", t.visBat ? NEEDLE.visBatter : NEEDLE.homeBatter), { n, team: t.bat });
        else if (!isNaN(stars) && Math.random() < 0.35) line = `Now batting, ${n}, a ${starWords(stars)} star hitter, ${POSP[bm[2]] || ""}.`;
        else line = pickFresh("bat", [`Now batting, ${n}, ${POSP[bm[2]] || ""}.`, `${n} steps in.`, `Here's ${n}.`]);
        if (line && hToday >= 2) line += ` He's already got ${say1(hToday)} hits today.`;
        else if (!line && hToday >= 2 && Math.random() < 0.6) line = `${n} again. He's already got ${say1(hToday)} hits today.`;
        if (R.sit === "every" || (R.sit !== "off" && Math.random() < 0.22)) { const sl = sitLine(id); if (sl) say("p", sl, 1, { maxAge: 5000 }); }
        if (line) say("p", line, 1, { maxAge: 4000 });
        if (q && !isNaN(stars) && stars < 2 && Math.random() < q * 0.7) say("c", fill(pickFresh("slo", L_COL.starLow), { s: starWords(stars) }), 1, { maxAge: 5000 });
        else if (q && !isNaN(stars) && stars >= 6 && Math.random() < q * 0.45) say("c", fill(pickFresh("shi", L_COL.starHigh), { s: starWords(stars) }), 1, { maxAge: 5000 });
        else if (q && sk && Math.random() < q * 0.6) {
          const traits = [sk.pow >= 85 && "light-tower power", sk.con >= 90 && "a bat that finds everything", sk.run >= 90 && "wheels"].filter(Boolean);
          if (traits.length) say("c", `This guy's got ${traits.join(", and ")}. Our guy, Mack.`, 1, { maxAge: 5000 });
        }
      }
      // a pitch
      if (np > b.pitches) {
        if (b.lastPitch) b.iv.push(now - b.lastPitch); b.lastPitch = now; g.last = now;
        const newHigh = mph > b.fast && b.fast > 0 && mph >= 85; if (mph > b.fast) b.fast = mph;
        b.pending = { at: now, before: b.cnt.slice(), mph, newHigh }; b.pitches = np;
        if (q0 && (np === 100 || np === 150)) say("c", pickFresh("p100", L_COL.pitches100).replace("one hundred", np === 150 ? "one fifty" : "one hundred").replace("a hundred", np === 150 ? "a hundred and fifty" : "a hundred"), 1, { maxAge: 6000 });
      }
      if (cnt[0] !== b.cnt[0] || cnt[1] !== b.cnt[1]) {
        const p = b.pending, mode = pitchMode(b);
        if (p && mode !== "off") {
          const [b0, s0] = p.before, [b1, s1] = cnt; let line = "";
          if (b1 === b0 + 1 && s1 === s0) line = s1 === 0 && b1 < 3 ? pickFresh("ball", [`Ball ${say1(b1)}.`, `Outside, ball ${say1(b1)}.`, `Low. Ball ${say1(b1)}.`]) : b1 === 3 && s1 === 2 ? "Ball three. Full count!" : pickFresh("ball2", [`Ball. ${capF(countWords(b1, s1))}.`, `Misses. ${capF(countWords(b1, s1))}.`]);
          else if (s1 === s0 + 1 && b1 === b0) line = b1 === 0 && s1 < 2 ? pickFresh("strike", [`Strike ${say1(s1)}.`, `Strike ${say1(s1)}, on the corner.`]) : b1 === 3 && s1 === 2 ? "Strike two. Full count!" : pickFresh("strike2", [`Strike. ${capF(countWords(b1, s1))}.`, `Gets him. ${capF(countWords(b1, s1))}.`]);
          const key = (b1 === 3 && s1 === 2) || (b1 === 0 && s1 === 2) || (b1 === 3 && s1 === 0);
          const some = mode === "some" && !RQ.length && !speaking && ((b1 === 3 && s1 === 2 && Math.random() < 0.7) || Math.random() < 0.12);
          if (line && (mode === "all" || (mode === "key" && key) || some)) {
            if (p.newHigh) line += ` ${p.mph} on the gun. That's the fastest pitch of the day!`;
            else if (p.mph && Math.random() < 0.14) line += ` ${say1(p.mph)} on the gun.`;
            say("p", line, 1, { maxAge: 1800 });
            const q = quipOdds();
            if (q && p.mph && p.mph <= 70 && Math.random() < q * 0.35) say("c", fill(pickFresh("slow", L_COL.slow), { mph: p.mph }), 1, { maxAge: 3500 });
            else if (q && p.mph >= 93 && Math.random() < q * 0.5) say("c", fill(pickFresh("fast", L_COL.fast), { mph: p.mph }), 1, { maxAge: 3500 });
            else if (q && b1 === 3 && s1 === 2 && Math.random() < q * 0.5) say("c", pickFresh("full", L_COL.full), 1, { maxAge: 3000 });
          }
        }
        b.pending = null; b.cnt = cnt;
      }
      // contact: a pitch, and the count didn't move. The ball's in play (or fouled off with two strikes).
      if (b.pending && now - b.pending.at > 750) {
        const pmode = pitchMode(b);
        if (pmode === "all" || pmode === "key" || (pmode === "some" && b.pending.before[1] < 2 && !RQ.length && Math.random() < 0.25)) say("p", pickFresh("contact", L_PBP.contact), 2, { maxAge: 1500, cut: true });
        b.pending = null;
      }
      // the score, as soon as the scoreboard changes
      if (score[0] !== b.score[0] || score[1] !== b.score[1]) {
        b.score = score; b.scoreAt = now; b.scoreSaid = false;
        if (q0 && Math.abs(score[0] - score[1]) >= 10 && !b.blowSaid) { b.blowSaid = true; setTimeout(() => say("c", pick(L_COL.blowout), 1, { maxAge: 8000 }), 2500); }
      }
      if (b.scoreAt && !b.scoreSaid && now - b.scoreAt > 1500) { b.scoreSaid = true; say("p", scoreLine(id, b), 2, { maxAge: 12000 }); }
      // the final out
      if (/final/i.test(inn) && !b.final) {
        b.final = true; organ(2);
        say("p", `And that's the ballgame! Final score: ${scoreLine(id, b, true)}`, 3, { maxAge: 30000, cut: true });
        if (quipOdds()) say("c", pickFresh("final", L_COL.final), 3, { maxAge: 30000 });
      }
    }, 150);
  }


  // ---- The show: segments for the breaks between half-innings ----
  // Stories are little two-man bits, from the Home Plate News archive and the old forums (see LORE.md).
  const STORIES = [
    [["p", "Dewey, tell the folks about the season nobody could hit a home run."], ["c", "Early days, Mack. Not one homer all season. Games went one-nothing, twenty-three innings, an hour and a half."], ["p", "And the next season?"], ["c", "They fixed it. Too well. Every game was thirty to twenty-nine. Three homers a game per hitter. Pitchers wept."]],
    [["c", "You know what the Factcat leak was, Mack?"], ["p", "Enlighten me."], ["c", "A bug that handed out free training. Found on a Saturday night, fixed by Sunday morning. Legend says a club touched ten stars for a few minutes."], ["p", "Ten stars. For a few minutes. Like Cinderella, if Cinderella was a shortstop."]],
    [["p", "Back in 2002 the SmallBall Mall sold an official cap. They made a hundred forty-four of them."], ["c", "And the SmallBall Bug, Mack. Don't forget the Bug."], ["p", "A car. Twenty-seven thousand dollars. It did not exist."], ["c", "But they said they'd build you one! That's customer service."]],
    [["c", "Mack, Monster Park didn't always have that name."], ["p", "No?"], ["c", "Fox Stadium. 2002. The paper said to catch a fox you need legs, a glove and an arm. Power alone won't cut it."], ["p", "So it's a fox hunt. With bats. Got it."]],
    [["p", "Ryes Crew won First League four seasons in a row, Dewey."], ["c", "And the next champion, a twenty-year-old from a Greek village of two thousand people, said matching that was impossible."], ["p", "She learned baseball watching CNN and won First League anyway."], ["c", "I learned baseball watching CNN and I'm in the booth. We all have our paths."]],
    [["c", "In 2002 the paper asked: if a monkey trained your team for you, would you be a cheater?"], ["p", "And?"], ["c", "Verdict: no. As long as you tell the monkey where to spend the pie. The monkey's a tool. You're still the manager."], ["p", "I've worked for that monkey."]],
    [["p", "Fat Tuesday, two thousand four. The forums went down."], ["c", "Grown men wrote poetry about it, Mack. Rhyming poetry. In the newspaper."], ["p", "Did the forums come back?"], ["c", "They did. The poetry did not improve."]],
    [["c", "Remember the Official SmallBall Chat?"], ["p", "New Year's Eve 2003 to October 2006."], ["c", "Some owners visited. Some owners lived there. Slip'N'Sliders lived there. They had to evict him."], ["p", "He's still looking for a new chat, Dewey. Somewhere, somehow, someway."]],
    [["p", "The original SmallBall Radio, Dewey. Two thousand two. Season reports and an open phone line to Northern California."], ["c", "And a frog. Johnny Bosco. Management was terrified of what he'd say."], ["p", "What did he say?"], ["c", "Ribbit. Mostly ribbit. We're carrying on his legacy."]],
    [["c", "The 900 Club, Mack. 2002. Ninety-nine limited edition clubs, numbered nine hundred to nine ninety-nine."], ["p", "What did they cost?"], ["c", "Sixty-five bucks. And the paper told everybody else to go stomp them when they showed up."], ["p", "Pay sixty-five dollars to get stomped. That's SmallBall."]],
    [["p", "In 2006 the Commish went quiet, and the forums started a thread called The Search for Commish."], ["c", "Two hundred eighty-six replies, Mack. Somebody spotted his name online one day and the whole league lost its mind."], ["p", "Did they find him?"], ["c", "He came back in 2026 with a new game. Took the long way."]],
    [["c", "Life in the SmallBall Lane, Mack. Old Home Plate News column."], ["p", "Go on."], ["c", "Seventh League is a highway rest stop. You pull in to stretch, maybe nap, and three seasons later you're friends with the vending machine guy."], ["p", "And Sixth League?"], ["c", "There's an old man in a tent preaching the evils of the tenth star. Ten-star club. Stuck in Sixth for four seasons."]],
    [["p", "Dial-up days, Dewey."], ["c", "Ten, fifteen minutes on Net Zero just to load your team page."], ["p", "And then?"], ["c", "And then you find out you lost to a club named Comic Book Villains. Character building."]],
    [["c", "A kid wrote the official fictional origin of SmallBall in 2002."], ["p", "Let's hear it."], ["c", "Kid breaks a window playing ball in the house. Mom says no baseball in the house. So he makes it small."], ["p", "SmallBall. Honestly that's better than most real origin stories."]],
  ];
  const TRIVIA = [
    ["What year did the first SmallBall season open?", "Two thousand one. February eighteenth."],
    ["Which club number does the Commish own?", "Number one. The New York 9."],
    ["What was Monster Park called back in 2002?", "Fox Stadium."],
    ["How many official SmallBall caps were ever made?", "One hundred forty-four."],
    ["What did the SmallBall Mall want for the SmallBall Bug?", "Twenty-seven thousand dollars. For a car that did not exist."],
    ["What does a Zz next to a club mean?", "Asleep. And probably an easy win."],
    ["What do you call a club that wins First League and vanishes the next season?", "Knuckle dusted."],
    ["What does U.F.O. stand for in SmallBall slang?", "Unconfirmed Fraudulent Opponent."],
    ["How many clubs were born in 2003, the biggest crop ever?", "Sixty-nine thousand four hundred twenty."],
    ["Which ballpark was discontinued in January 2004?", "Letterbox Park. And yet, here it is."],
    ["How many First League titles in a row did Ryes Crew win?", "Four."],
    ["What did a 900 Club team cost in 2002?", "Sixty-five dollars."],
    ["Before 2002, how often did your TP pie refill?", "Every twelve hours."],
    ["What was the name of the frog on the original SmallBall Radio?", "Johnny Bosco."],
    ["Which season did Centennial Park celebrate?", "Season one hundred."],
    ["How many clubs came back for the 2026 relaunch?", "Two hundred forty-two thousand, one hundred ninety-one."],
    ["How many levels are on the ProLeague ladder?", "Nine. Junior up to First."],
    ["How fast can a ten-star arm throw in this game?", "A hundred and one."],
    ["In old SmallBall slang, what's frogging?", "Starting games from several computers at once."],
    ["Which trainer was free every Friday?", "The Deluxe Trainer. Free DT Fridays."],
    ["What season number did the relaunch open with?", "Four eighty-four."],
    ["Where did the free SmallBall stickers ship from?", "Half Moon Bay, California."],
    ["How long is a SmallBall season?", "Two weeks."],
    ["How many bullpen pitchers does a SmallBall club carry?", "None. One man, one game."],
  ];
  // Fixed lines from the break segments and elsewhere, kept here so Enhanced voices can pre-record them.
  const TRIV_OPEN = ["It's time for SmallBall Trivia!", "SmallBall Trivia time, folks. Play along at home.", "Trivia break! Brought to you by nobody. We have no sponsors."];
  const STRETCH_OPEN = "It's the seventh inning stretch! Everybody up.";
  const STRETCH_C = ["I'm up. I'm stretching. Something popped.", "The organist is giving it everything she's got. She's got about four notes.", "Stretch it out, folks. The pitcher sure can't. No bullpen."];
  const BIGQ = ["Those clubs play more games than I eat hot dogs, and Mack, I eat a lot of hot dogs.", "The BigLeague: anybody can play anybody. It's democracy with bats.", "I'm told the standings are updated live. Unlike me."];
  const FIRST_NOTE = "And that's a first, by the way. Write it down.";
  const BACK_ON_AIR = "SmallBall Radio, back on the air. First time since the frog. Somebody check on Johnny Bosco.";
  // The booth test: one line from each of the five.
  const TEST_LINES = [["p", "Testing, one two. Mack Ramsey here. Two and one... swung on, and that ball is outta here!"], ["c", "And I'm Dewey Seeds. They've asked me to stop eating the microphone foam."],
    ["quiz", "Chet Lambert here. What is... a microphone check?"], ["qb", "Brock Callahan. I've been hydrating for this mic check since Tuesday."], ["obvious", "Gary Plainfield. If you can hear this, the microphone is working. I've studied this."]];
  const WRONG = ["Is it... Herbert Hoover?", "I'm going to say forty-two.", "Pass. I panicked.", "Whatever the Commish says, I'm saying that.", "Can I phone a friend? Johnny Bosco?", "Is the answer pie? It's usually pie."];
  function storySeg() {
    const st = pickFresh("story", STORIES);
    st.forEach(([w, t], i) => say(w, t, 2, { maxAge: 90000, seg: true, on: i === 0 ? () => tvCard({ k: "From the archives", h: "Tales from the Dugout", p: "Mack and Dewey dig into SmallBall history." }, 9000 * st.length) : null }));
  }
  function triviaSeg(g) {
    const [qq, a] = pickFresh("trivia", TRIVIA), host = g.guestIn && g.guest === "quiz" ? "g" : "p";
    say("p", pickFresh("trivh", TRIV_OPEN), 2, { maxAge: 90000, seg: true, on: () => tvCard({ k: "SmallBall Trivia", h: qq, p: "Answer in chat before the booth does." }, 60000) });
    say(host, qq, 2, { maxAge: 90000, seg: true });
    say("pause", "🤔 Think about it…", 2, { maxAge: 90000, seg: true, ms: 6000, on: () => tvCard({ k: "SmallBall Trivia", h: qq, p: "Answer in chat before the booth does.", clock: 6 }, 60000) });
    if (Math.random() < 0.6) say("c", pick(WRONG), 2, { maxAge: 90000, seg: true });
    say(host, (host === "g" ? "The correct question was... " : "The answer: ") + a, 2, { maxAge: 90000, seg: true, on: () => tvCard({ k: "SmallBall Trivia · Answer", h: a, p: qq }, 12000) });
  }
  async function leagueSeg(id) {
    try {
      const s = await getJSON("/season"); const big = (s.big || []).slice().sort((a, b) => a.rank - b.rank).slice(0, 3);
      if (!big.length) return storySeg();
      const nm = (x) => spk(x.name);
      let line = `Around the BigLeague. Leading the way, the ${nm(big[0])}, with ${big[0].wins} wins.`;
      if (big[1]) line += ` Then the ${nm(big[1])}${big[2] ? `, and the ${nm(big[2])}` : ""}.`;
      const hidden = tvSpoilClubs();
      say("p", line, 2, { maxAge: 90000, seg: true, on: () => tvCard({ k: "Around the BigLeague", h: "The Top Three", list: big.map((x) => `${spk(x.name)}${hidden.has(String(x.team_id)) ? "" : ` · ${x.wins}-${x.losses}`}`) }, 25000) });
      const first = s.pro && (s.pro[1] || s.pro["1"]); const top = Array.isArray(first) && first[0];
      const days = s.season && s.season.closes_at ? Math.ceil((Date.parse(s.season.closes_at) - Date.parse(s.season.server_time || new Date().toISOString())) / 864e5) : 0;
      if (top && top.name) say("p", `Up in First League, the ${spk(top.name)} sit on top.${days > 0 ? ` ${capF(say1(days))} day${days === 1 ? "" : "s"} left in ${s.season.name || "the season"}.` : ""}`, 2, { maxAge: 90000, seg: true });
      else if (days > 0) say("p", `${capF(say1(days))} day${days === 1 ? "" : "s"} left in ${s.season.name || "the season"}.`, 2, { maxAge: 90000, seg: true });
      const ours = (s.big || []).find((x) => S.meta[id] && (x.team_id === S.meta[id].hid || x.team_id === S.meta[id].aid));
      if (ours) say("c", `And hey, the ${spk(ours.name)} are on that board too. Number ${ours.rank}. Somebody's been playing.`, 2, { maxAge: 90000, seg: true });
      else say("c", pickFresh("bigq", BIGQ), 2, { maxAge: 90000, seg: true });
    } catch (_) { storySeg(); }
  }
  function stretchSeg() {
    say("p", STRETCH_OPEN, 2, { maxAge: 90000, seg: true, on: () => tvCard({ k: "Seventh inning stretch", h: "Everybody up!", p: "♪ Take Me Out to the Ball Game ♪" }, 16000) });
    setTimeout(() => melody(), 2500);
    say("pause", "🎵 …", 2, { maxAge: 90000, seg: true, ms: 7000 });
    say("c", pickFresh("stretch", STRETCH_C), 2, { maxAge: 90000, seg: true });
  }
  // The opening of "Take Me Out to the Ball Game" (1908, public domain) on the booth organ.
  function melody() {
    if (!R.organ || !talking()) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      const N = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, G4: 392 };
      const tune = [["C5", 2], ["C6", 1], ["A5", 1], ["G5", 1], ["E5", 1], ["G5", 3], ["D5", 3], ["C5", 2], ["C6", 1], ["A5", 1], ["G5", 1], ["E5", 1], ["G5", 4]];
      let t = AC.currentTime + 0.05; const beat = 0.28;
      for (const [n, d] of tune) {
        for (const [mul, gain] of [[1, 0.11], [2, 0.04], [0.5, 0.05]]) {
          const o = AC.createOscillator(), gn = AC.createGain(); o.type = "sine"; o.frequency.value = N[n] * mul; const len = d * beat;
          gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(gain * R.vol, t + 0.02); gn.gain.setValueAtTime(gain * R.vol, t + len - 0.05); gn.gain.linearRampToValueAtTime(0, t + len);
          o.connect(gn).connect(AC.destination); o.start(t); o.stop(t + len + 0.02);
        }
        t += d * beat;
      }
    } catch (_) {}
  }
  // Which break gets which segment. Everything else gets a one-liner, most of the time.
  function segment(id, g, p, e) {
    const k = (p.half === "top" ? "T" : "B") + p.inn;
    g.segs = g.segs || {};
    if (g.segs[k]) return; g.segs[k] = 1;
    if (k === "B2" || k === "B4" || k === "B8") return storySeg();
    if (k === "B3" || k === "B6") return triviaSeg(g);
    if (k === "T5") { leagueSeg(id); return; }
    if (k === "T7") return stretchSeg();
    if (Math.random() < 0.6) say(Math.random() < 0.3 ? "p" : "c", pickFresh("lore", L_COL.lore), 1, { maxAge: 20000, ev: e });
  }

  // ---- The play log feed: what each play was ----
  function guestChime(g, cat, force) {
    const G = g.guest && GUESTS[g.guest]; if (!G || !g.guestIn) return;
    const q = quipOdds(); if (!q || (!force && Math.random() > q * 0.4)) return;
    const arr = G.lines[cat] || (Math.random() < 0.35 ? G.lines.any : null); if (!arr) return;
    say("g", pickFresh("g" + g.guest + cat, arr), 1, { maxAge: 5000 });
    if (Math.random() < 0.55) { const [w, s] = pick(G.roast); say(w, s, 1, { maxAge: 6000 }); }
  }
  function radioFeed(id, events) {
    if (!R.on || (!TTS && !kEff()) || id !== radioGame()) return;
    const g = gstate(id), b = BS[id] || {};
    for (const e of events) {
      g.last = Date.now();
      const p = parsePlay(e.t ? (e.hl === "first time" ? "* FIRST: " + e.t.replace(/^FIRST:\s*/i, "") : e.t) : "");
      const t = teams(id, e.h);
      if (g.half !== e.h && p.k !== "end") { g.half = e.h; g.halfRuns = 0; g.on = 0; g.kRun = 0; }
      const q = quipOdds();
      const R2 = { maxAge: 9000, cut: true };
      const col = (cat, o, boost = 0) => { if (q && Math.random() < Math.min(0.95, q + boost)) say("c", fill(pickFresh("c" + cat, L_COL[cat]), o), 1, { maxAge: 5000, ev: e }); };
      const mack = (cat, o, odds) => { if (R.lean === "fair") return; if (q && Math.random() < odds * (q / 0.36)) say("p", fill(pickFresh("n" + cat, NEEDLE[cat]), o), 1, { maxAge: 5000, ev: e }); };
      const n = p.name ? shortName(g, p.name) : "";
      if (["1b", "2b", "3b", "hr"].includes(p.k)) {
        g.hits[p.name] = (g.hits[p.name] || 0) + 1; g.on++; g.kRun = 0;
        let s = fill(pickFresh(p.k, L_PBP[p.k]), { n });
        g.halfRuns += p.k === "hr" && !p.scored ? 1 : p.scored;
        if (p.scored && p.k !== "hr") s += p.scored === 1 ? " A run scores." : ` ${capF(say1(p.scored))} runs score!`;
        if (p.k === "hr" && p.scored > 1) s += ` That's ${say1(p.scored)} runs!`;
        say("p", s, 3, Object.assign({ ev: e, front: true }, R2));
        if (p.k === "hr" || p.k === "3b" || p.scored >= 2) organ(p.k === "hr" ? 2 : 1);
        const h = g.hits[p.name];
        if (t.visBat) mack("visHit", {}, 0.22); else mack("homeHit", { team: t.bat }, 0.25);
        if (h >= 2 && Math.random() < 0.6) col("multi", { n: shortName(g, p.name), h: say1(h) }, 0.3);
        else if (p.scored >= 2 && Math.random() < 0.5) col("score2", {}, 0.3);
        else col(p.k, { n }, p.k === "hr" ? 0.5 : p.k === "3b" ? 0.4 : 0);
        guestChime(g, p.k);
      } else if (p.k === "k" || p.k === "kc") {
        g.kRun++;
        if (!SHOW() || g.kRun >= 2 || Math.random() < 0.55) say("p", fill(pickFresh(p.k, L_PBP[p.k]), { n }), 2, Object.assign({ ev: e }, R2));
        if (t.visBat) mack("visOut", { n }, 0.25);
        if (g.kRun >= 2) col("kstreak", { s: say1(g.kRun) }, 0.25); else col(p.k, { n });
        guestChime(g, "k");
      } else if (p.k === "bb" || p.k === "hbp") {
        g.on++; g.kRun = 0; g.halfRuns += p.scored || 0;
        if (!SHOW() || p.scored || Math.random() < 0.45) say("p", fill(pickFresh(p.k, L_PBP[p.k]), { n }) + (p.scored ? " And that forces in a run!" : ""), p.scored ? 3 : 2, Object.assign({ ev: e, front: !!p.scored }, R2));
        if (p.k === "bb") { col("bb", {}); guestChime(g, "bb"); }
      } else if (p.k === "out") {
        g.kRun = 0;
        if (!SHOW() || (!RQ.length && Math.random() < 0.25)) say("p", fill(pickFresh(p.how, L_PBP[p.how] || L_PBP.out), { p: POS[p.pos] || p.pos, pn: POSN[p.pos] || p.pos, raw: p.raw }), 1, { maxAge: 6000, ev: e });
        if (L_COL[p.how]) col(p.how, {}, -0.2);
        guestChime(g, "out");
      } else if (p.k === "foul") {
        if (!SHOW() && pitchMode(b.iv ? b : { iv: [] }) === "all" && Math.random() < 0.5) say("p", pickFresh("foul", L_PBP.foul), 1, { maxAge: 1500 });
      } else if (p.k === "runner") {
        say("p", fill(L_PBP.runner[0], { n, what: p.what, base: p.base }), 1, { maxAge: 5000, ev: e });
      } else if (p.k === "miscue") {
        say("p", pickFresh("miscue", L_PBP.miscue), 2, Object.assign({ ev: e }, R2)); col("miscue", {}, 0.3);
      } else if (p.k === "dp") {
        say("p", pickFresh("dp", L_PBP.dp), 2, Object.assign({ ev: e }, R2)); col("dp", {}, 0.3); guestChime(g, "dp");
      } else if (p.k === "end") {
        const tm = p.half === "top" ? t.away : t.home, visHalf = p.half === "top";
        let s = `That'll do it for the ${p.half} of the ${ord(p.inn)}.`;
        const hk = (p.half === "top" ? "T" : "B") + p.inn, already = g.halfSaid && g.halfSaid[hk];
        if (!already && R.updates !== "off" && (R.updates === "half" || p.half === "bottom")) (g.halfSaid || (g.halfSaid = {}))[hk] = Date.now();
        if (b.score && !already && R.updates !== "off" && (R.updates === "half" || p.half === "bottom")) s += ` ${p.half === "bottom" ? `After ${say1(p.inn)}, ` : ""}${scoreLine(id, b, false, true)}`;
        say("p", s, 3, { maxAge: 15000, ev: e });
        if (b.score) b.scoreSaid = true;
        if (p.inn === 6 && p.half === "bottom" && q && !g.tiredSaid && Math.random() < 0.8) { g.tiredSaid = true; say("c", pick(L_COL.tired), 1, { maxAge: 12000, ev: e }); }
        if (g.halfRuns >= 3) { col("big", { team: tm }, 0.4); g.bigAt = Date.now(); }
        else if (g.on === 0) { if (visHalf && q && R.lean !== "fair" && Math.random() < 0.6) say("p", fill(pickFresh("nvc", NEEDLE.visClean), { team: tm }), 1, { maxAge: 6000, ev: e }); else col("clean", {}, 0.2); }
        else if (g.halfRuns === 0 && g.on >= 2) col("stranded", {}, 0.2);
        // the guest walks in after the first half
        if (!g.guestIn && g.guest && q) { const G = GUESTS[g.guest]; g.guestIn = true; say(G.intro[0], G.intro[1], 2, { maxAge: 20000 }); say("g", G.hello, 2, { maxAge: 20000 }); if (Math.random() < 0.7) { const [w, s2] = pick(G.roast); say(w, s2, 1, { maxAge: 20000 }); } }
        // between halves is the show: stories, trivia, the BigLeague, the stretch
        if (SHOW() && q) segment(id, g, p, e);
        else if (q && (g.guestIn || p.inn > 1) && Math.random() < 0.5) say(Math.random() < 0.3 ? "p" : "c", pickFresh("lore", L_COL.lore), 1, { maxAge: 15000, ev: e });
        g.half = ""; g.halfRuns = 0; g.on = 0; g.kRun = 0;
      } else if (p.k === "bigfirst") {
        if (Date.now() - (g.bigAt || 0) > 15000) { col("big", { team: t.bat }, 0.5); g.bigAt = Date.now(); }
      } else if (p.k === "milestone") {
        say("p", p.name && p.what ? `Mark it down, folks: that ${p.what.toLowerCase()} is a first for ${shortName(g, p.name)}!` : fill(L_PBP.milestone[0], { t: p.t.replace(/^\d+\s+/, "").replace(/\*+/g, "") }), 2, { maxAge: 9000, ev: e });
        col("milestone", {}, 0.4);
      }
      if (p.first && !["milestone", "bigfirst"].includes(p.k) && q && Math.random() < 0.5) say("c", FIRST_NOTE, 1, { maxAge: 6000, ev: e });
    }
  }

  // ---- Speech: one line at a time, freshest first ----
  // Each line has a shelf life (maxAge). Lines that went stale waiting are skipped; a big play (cut) stops a
  // joke mid-sentence. That's what keeps the call on the pitch instead of drifting behind it.
  const RQ = []; let speaking = null, rT = 0, cutAt = 0;
  // Chrome's speech engine is fragile: speaking right after cancel() can be dropped, an utterance can be
  // garbage-collected mid-line, and a network voice can fail without a word. So: keep a reference to every
  // line, wait a beat after a cancel, nudge the engine with resume(), and if a line never starts, reset the
  // engine and retry it once on a voice that lives on this computer.
  const KEEP = [], BADV = new Set(); let lastErr = "", heard = 0, fails = 0, speechDown = false;
  function say(who, text, pri, o = {}) {
    // Enhanced voices: a stock pitch call with more after it ("Ball one. 92 on the gun.") goes out as the stock call,
    // which is already recorded, plus the rest as its own line, so the call itself never waits.
    const st = who === "p" && kLive({ who }) ? kStockText(text) : "";
    if (st) { say(who, st, pri, Object.assign({}, o, { cap: text })); return say(who, text.slice(st.length).trim(), pri, { maxAge: o.maxAge, cont: true, test: o.test }); }
    // a guest's line remembers which guest says it (each has his own voice)
    const g = who === "g" ? o.g || (GS[radioGame()] || {}).guest || Object.keys(GUESTS).find((x) => R.guests[x]) || "quiz" : "";
    const it = { who, g, text, pri, at: Date.now(), maxAge: o.maxAge || 6000, ev: o.ev, seg: !!o.seg, ms: o.ms || 0, on: o.on, cap: o.cap, cont: !!o.cont, test: !!o.test };
    if (o.front) { let i = 0; while (i < RQ.length && RQ[i].pri >= pri && !RQ[i].seg) i++; RQ.splice(i, 0, it); } else RQ.push(it);
    while (RQ.length > 12 || RQ.filter((x) => !x.seg).length > 5) { let i = RQ.findIndex((x) => x.pri === 0 && !x.seg); if (i < 0) i = RQ.findIndex((x) => x.pri === 1 && !x.seg); if (i < 0) i = RQ.findIndex((x) => !x.seg); if (i < 0) i = RQ.length - 1; RQ.splice(i, 1); }
    if (o.cut) for (let i = RQ.length - 1; i >= 0; i--) if (RQ[i] !== it && RQ[i].pri < 2 && !RQ[i].seg) RQ.splice(i, 1);   // a big play clears the jokes waiting in line (no mid-sentence cancel: it can crash ChromeOS speech)
    pump();
    kTick();   // Enhanced voices: fetch or start making the next line while this one plays
  }
  let VO = [];
  function loadVoices() { VO = TTS ? speechSynthesis.getVoices() : []; if (isOpen()) paintRadio(); }
  if (TTS) { loadVoices(); speechSynthesis.addEventListener?.("voiceschanged", loadVoices); }
  function voiceFor(who, localOnly, gk) {   // the Standard voice for Mack ("p"), Dewey ("c") or a guest ("g", gk = which one)
    const en = VO.filter((v) => /^en/i.test(v.lang) && !BADV.has(v.name) && (!localOnly || v.localService)); const want = who === "c" ? R.color : who === "g" ? R.gv[gk] || "" : R.pbp;
    const byName = en.find((v) => v.name === want); if (byName) return byName;
    const taken = who === "p" ? [] : who === "c" ? [(voiceFor("p", localOnly) || {}).name] : [(voiceFor("p", localOnly) || {}).name, (voiceFor("c", localOnly) || {}).name];
    const pref = who === "c" ? [/UK English Male/i, /Daniel/i, /Fred/i, /Guy|Ryan|George/i, /Male/i] : who === "g" ? [/UK English Female/i, /Australia|Karen|Moira|Tessa/i, /Samantha|Victoria/i, /Female/i] : [/US English/i, /Alex/i, /Samantha/i, /Aria|Jenny|Mark/i];
    for (const re of pref) { const v = en.find((x) => re.test(x.name) && !taken.includes(x.name)); if (v) return v; }
    return en.find((x) => !taken.includes(x.name)) || en[0] || null;
  }
  const who2name = (w, gk) => (w === "p" ? "Mack" : w === "c" ? "Dewey" : (GUESTS[gk] || {}).name || "Guest");
  function pump() {
    if (speaking || !RQ.length || !talking()) return;
    if (Date.now() - cutAt < 120) { setTimeout(pump, 130); return; }
    const it = RQ.shift();
    if (Date.now() - it.at > it.maxAge) return pump();
    if (it.on && !(kLive(it) && !it.kbad)) { try { it.on(); } catch (_) {} }   // Stream Mode cards go up the moment their line is spoken
    if (it.who === "pause") {           // a beat of silence (trivia thinking time)
      speaking = it; const cap = isOpen() && ov.querySelector(".rcap"); if (cap) cap.innerHTML = it.text ? esc(it.text) : "🤔 …"; tvCap("", "");
      setTimeout(() => { if (speaking === it) { speaking = null; pump(); } }, it.ms || 5000); return;
    }
    if (kLive(it) && !it.kbad) return kSpeak(it);    // Enhanced voices (it fires it.on when the line actually starts)
    if (speechDown || !TTS) { const nm0 = who2name(it.who, it.g); const cap = isOpen() && ov.querySelector(".rcap"); if (cap) cap.innerHTML = `🔇 <b>${esc(nm0)}:</b> ${esc(it.text)}`; tvCap(nm0, it.text); if (it.ev) (it.ev.radio || (it.ev.radio = [])).push(`${nm0}: ${it.text}`); speaking = it; setTimeout(() => { if (speaking === it) { speaking = null; pump(); } }, 900 + it.text.length * 45); return; }
    const synth = speechSynthesis;
    const G = it.who === "g" ? GUESTS[it.g] : null;
    const u = new SpeechSynthesisUtterance(it.text), v = voiceFor(it.who, it.retry, it.g);
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "en-US";
    u.rate = it.who === "c" ? 1.0 : it.who === "g" ? (G ? G.rate : 1) : RQ.length > 2 ? 1.2 : 1.1;   // Mack talks faster when he's behind
    u.pitch = it.who === "c" ? 0.8 : it.who === "g" ? (G ? G.pitch : 1) : 1.05; u.volume = Math.max(0.05, R.vol);
    speaking = it; KEEP.push(u); if (KEEP.length > 30) KEEP.shift();
    let started = false;
    const done = () => { if (speaking !== it) return; speaking = null; clearTimeout(rT); setTimeout(pump, it.who === "p" ? 120 : 280); };
    u.onstart = () => { started = true; heard++; lastSpoke = Date.now(); lastErr = ""; fails = 0; };
    u.onend = () => { lastSpoke = Date.now(); done(); };
    u.onerror = (e) => { const er = (e && e.error) || "error"; if (er !== "interrupted" && er !== "canceled") { lastErr = er; if (v) BADV.add(v.name); if (++fails >= 4) speechDown = true; else if (!it.retry) { it.retry = 1; RQ.unshift(it); } } done(); paintDiag(); };
    clearTimeout(rT); rT = setTimeout(done, 3000 + it.text.length * 95);   // Chrome sometimes never fires onend
    // a line that hasn't started after 2 seconds: the engine is stuck. Reset it and retry once on a local voice.
    setTimeout(() => {
      if (started || speaking !== it) return;
      if (v) BADV.add(v.name);
      lastErr = lastErr || "no sound from " + (v ? v.name : "the default voice");
      if (++fails >= 4) speechDown = true;
      try { synth.cancel(); } catch (_) {}   // a line that never started: clear the stuck queue once
      speaking = null; clearTimeout(rT); cutAt = Date.now();
      if (!it.retry) { it.retry = 1; it.at = Date.now(); RQ.unshift(it); }
      setTimeout(pump, 150); paintDiag();
    }, 2000);
    try { if (synth.paused) synth.resume(); } catch (_) {}
    synth.speak(u);
    const nmw = who2name(it.who, it.g);
    if (it.ev) (it.ev.radio || (it.ev.radio = [])).push(`${nmw}: ${it.text}`);   // transcripts keep what was actually said
    const cap = isOpen() && ov.querySelector(".rcap"); if (cap) cap.innerHTML = `<b>${esc(nmw)}:</b> ${esc(it.text)}`;
    tvCap(nmw, it.text);
  }
  function paintDiag() {
    const el = isOpen() && ov.querySelector(".rdiag"); if (!el) return;
    if (speechDown) { el.innerHTML = `<b>This computer's text-to-speech isn't working</b> (${esc(lastErr || "no sound")}), so the booth is showing captions only. Every voice failed, so it's not the kit. Fix: restart Chrome (on a Chromebook, restart the Chromebook), then check the voice speaks in your system's text-to-speech settings. Then press Test the booth.`; return; }
    el.textContent = lastErr ? `Speech trouble: ${lastErr}. ${BADV.size ? `Skipping ${[...BADV].join(", ")}; using voices on this computer.` : ""}` : heard ? `Speech OK (${heard} lines heard).` : "";
  }
  function hush() {
    if (speaking && speaking.kT) clearTimeout(speaking.kT);
    RQ.length = 0; speaking = null; clearTimeout(rT); cutAt = Date.now(); try { speechSynthesis.cancel(); } catch (_) {}
    if (K.src) { try { K.src.onended = null; K.src.stop(); } catch (_) {} K.src = null; }   // Enhanced voices: stop the line mid-word
  }

  // A short original organ sting for the big moments.
  let AC = null;
  function organ(level) {
    if (!R.organ || !talking()) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      const notes = level >= 2 ? [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5] : [392, 523.25, 659.25, 783.99];
      const t0 = AC.currentTime + 0.02, step = 0.14;
      notes.forEach((f, i) => {
        for (const [mul, gain] of [[1, 0.12], [2, 0.05], [0.5, 0.06]]) {
          const o = AC.createOscillator(), gn = AC.createGain(); o.type = "sine"; o.frequency.value = f * mul;
          const s = t0 + i * step, len = i === notes.length - 1 ? 0.5 : step * 0.9;
          gn.gain.setValueAtTime(0, s); gn.gain.linearRampToValueAtTime(gain * R.vol, s + 0.02); gn.gain.setValueAtTime(gain * R.vol, s + len - 0.04); gn.gain.linearRampToValueAtTime(0, s + len);
          o.connect(gn).connect(AC.destination); o.start(s); o.stop(s + len + 0.02);
        }
      });
    } catch (_) {}
  }

  // ---------- 🧠 Enhanced voices (Kokoro; optional, Standard is the browser's own speech) ----------
  // A neural voice for each member of the booth, made on this computer by Kokoro-82M (Apache-2.0). The kit ships
  // the code (kokoro/); the model and voice files download once, from Hugging Face, during the one-time setup, and
  // stay in the browser. Nothing about the game ever leaves the computer.
  // Enhanced voices need a graphics card the browser can compute on (WebGPU; built-in graphics count). That's
  // checked before anything is downloaded, and Enhanced can't be picked without it. On the processor Kokoro is
  // several times slower than speech, far too slow for a live game, so there's no processor option.
  // The engine (kokoro/engine.html, a hidden frame at the extension's own origin, with the model in a worker) is
  // only loaded while it's needed: setup, the radio on the air, or the booth test. Setup pre-records the fixed
  // commentary (pitch calls, fielding calls, color, banter, lore, stories, trivia, the guests) in each character's
  // voice, so most of a broadcast plays from saved clips; lines with live game details are made on the spot.
  // Each line keeps its shelf life: a line is only made if it can be ready in time, and a late line is skipped.
  // A character with no Enhanced voice, or any line while the engine isn't ready, uses the Standard voices.
  const XAPI = (() => { try { const b = globalThis.browser; if (b && b.runtime && b.runtime.getURL) return b; const c = globalThis.chrome; if (c && c.runtime && c.runtime.getURL && c.runtime.id) return c; } catch (_) {} return null; })();
  const K_OK = !!XAPI && typeof MessageChannel !== "undefined" && typeof WebAssembly !== "undefined" && !!(window.AudioContext || window.webkitAudioContext);
  // Kokoro v1.0's English voices (US "a", UK "b"), best-rated first.
  const KALL = [["am_michael", "Michael (US man)"], ["am_fenrir", "Fenrir (US man)"], ["am_puck", "Puck (US man)"], ["am_echo", "Echo (US man)"], ["am_eric", "Eric (US man)"], ["am_liam", "Liam (US man)"], ["am_onyx", "Onyx (US man)"], ["am_adam", "Adam (US man)"], ["am_santa", "Santa (US man)"],
    ["bm_george", "George (UK man)"], ["bm_fable", "Fable (UK man)"], ["bm_lewis", "Lewis (UK man)"], ["bm_daniel", "Daniel (UK man)"],
    ["af_heart", "Heart (US woman)"], ["af_bella", "Bella (US woman)"], ["af_nicole", "Nicole (US woman)"], ["af_aoede", "Aoede (US woman)"], ["af_kore", "Kore (US woman)"], ["af_sarah", "Sarah (US woman)"], ["af_nova", "Nova (US woman)"], ["af_sky", "Sky (US woman)"], ["af_alloy", "Alloy (US woman)"], ["af_jessica", "Jessica (US woman)"], ["af_river", "River (US woman)"],
    ["bf_emma", "Emma (UK woman)"], ["bf_isabella", "Isabella (UK woman)"], ["bf_alice", "Alice (UK woman)"], ["bf_lily", "Lily (UK woman)"]];
  const KCHAR = [["p", "Mack Ramsey"], ["c", "Dewey Seeds"], ["quiz", "Chet Lambert"], ["qb", "Brock Callahan"], ["obvious", "Gary Plainfield"]];
  const K = { st: "off", want: false, op: "", frame: null, port: null, dev: "", dtype: "", phase: "", loaded: 0, total: 0, err: "", note: "", busy: null, seq: 0, mem: new Map(), memBytes: 0, gens: [], fails: 0, rtf: 1, slow: false, late: 0, made: 0, hits: 0, disk: new Set(), getting: new Set(), fixed: new Set(), pre: null, src: null, usage: null, helloT: 0, after: null, vT: 0 };
  const UA = navigator.userAgent;
  const kGpu = () => (R.kgpu && R.kgpu.ua === UA ? R.kgpu : null);              // the last graphics-card check, in this browser version
  const kAvail = () => K_OK && !(kGpu() && !kGpu().ok);                          // Enhanced can be picked (not known to be unable)
  const kEff = () => kAvail() && R.engine === "enhanced";                        // Enhanced is picked and can run here
  const kSetUp = () => !!(R.ksetup && R.ksetup.done);
  const kChar = (it) => (it.who === "p" || it.who === "c" ? it.who : it.who === "g" ? it.g || "quiz" : "");
  let stdOnly = false;   // "Start with Standard voices": this broadcast (or test) skips Enhanced; the setting stays
  const kVoice = (it) => { const ch = kChar(it); return ch && kEff() && !stdOnly ? R.ev[ch] || "" : ""; };   // "" = this character uses Standard
  const kLive = (it) => K.st === "ready" && !(K.slow && TTS) && !!kVoice(it);
  const kKey = (v, sp, text) => `fp32|${v}|${sp}|${text}`;   // model, voice, speed, words: a clip is only reused for exactly that
  function kJob(it) {
    const v = kVoice(it), sp = KSP[kChar(it)] || 1;
    if (it.kkey && it.kv === v) return it;
    it.kv = v; it.ksp = sp; it.kkey = kKey(v, sp, it.text); return it;
  }
  const kEst = (text) => K.rtf * (800 + 68 * text.length);              // how long a line takes to make here: speed (learned as it goes) × how long it runs
  function kAC() { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === "suspended") AC.resume().catch(() => {}); return AC; } catch (_) { return null; } }
  function kMemGet(k) { const c = K.mem.get(k); if (c) { K.mem.delete(k); K.mem.set(k, c); } return c; }
  function kMemPut(k, c) {
    if (K.mem.has(k)) return; K.mem.set(k, c); K.memBytes += c.pcm.byteLength;
    while (K.memBytes > 24e6 && K.mem.size > 1) { const [k0, c0] = K.mem.entries().next().value; K.mem.delete(k0); K.memBytes -= c0.pcm.byteLength; }   // ~4 minutes of speech in memory
  }

  // ---- The fixed commentary: every line the booth can say that has no live game details in it ----
  // These mirror the ball/strike/contact calls in watchBoard().
  function kStockTexts() {
    if (K.stockTx) return K.stockTx;
    const a = [...L_PBP.contact], add = (s) => { if (!a.includes(s)) a.push(s); };
    [1, 2].forEach((n) => { add(`Strike ${say1(1)}.`); add(`Ball ${say1(n)}.`); add(`Strike ${say1(1)}, on the corner.`); add(`Outside, ball ${say1(n)}.`); add(`Low. Ball ${say1(n)}.`); });
    add("Ball three. Full count!"); add("Strike two. Full count!");
    for (let b1 = 0; b1 <= 3; b1++) for (let s1 = 0; s1 <= 2; s1++) {
      if (b1 === 3 && s1 === 2) continue;
      const cw = capF(countWords(b1, s1));
      if (b1 >= 1 && !(s1 === 0 && b1 < 3)) { add(`Ball. ${cw}.`); add(`Misses. ${cw}.`); }
      if (s1 >= 1 && !(b1 === 0 && s1 < 2)) { add(`Strike. ${cw}.`); add(`Gets him. ${cw}.`); }
    }
    K.stockLong = a.slice().sort((x, y) => y.length - x.length);
    return (K.stockTx = a);
  }
  function kStockText(text) {   // the stock call a line starts with ("Ball one." in "Ball one. 92 on the gun."), if it's saved
    if (!R.ev.p) return "";
    kStockTexts();
    const s = K.stockLong.find((x) => text.length > x.length && text.startsWith(x + " "));
    if (!s) return "";
    const k = kKey(R.ev.p, KSP.p, s);
    return K.mem.has(k) || K.disk.has(k) ? s : "";
  }
  // [character, words], most useful first: the time-critical calls, the booth test, the play-by-play, then color,
  // banter, the guests who are on, the break segments, and the long stories and lore last.
  function kLines() {
    const out = [], add = (ch, t) => { if (t && !/[{}]/.test(t)) out.push([ch, t]); };
    kStockTexts().forEach((t) => add("p", t));
    TEST_LINES.forEach(([ch, t]) => add(ch, t));
    for (const arr of Object.values(L_PBP)) for (const t of arr) {
      const ph = [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      if (ph.length && ph.every((x) => x === "p" || x === "pn")) for (const pos of Object.keys(POS)) add("p", fill(t, { p: POS[pos], pn: POSN[pos] }));   // fielding calls, every position
      else add("p", t);
    }
    for (const arr of Object.values(NEEDLE)) arr.forEach((t) => add("p", t));
    for (const [k, v] of Object.entries(L_COL)) {
      if (k === "lore" || k === "banter") continue;
      if (k === "park") Object.values(v).forEach((a) => a.forEach((t) => add("c", t)));
      else if (k === "pitches100") v.forEach((t) => { add("c", t); add("c", t.replace("one hundred", "one fifty").replace("a hundred", "a hundred and fifty")); });
      else if (Array.isArray(v)) v.forEach((t) => add(k === "pro" ? "p" : "c", t));
    }
    add("c", FIRST_NOTE); add("c", BACK_ON_AIR);
    L_COL.banter.forEach((bit) => bit.forEach(([w, t]) => add(w, t)));
    for (const [gk, G] of Object.entries(GUESTS)) {
      if (!R.guests[gk]) continue;
      add(G.intro[0], G.intro[1]); add(gk, G.hello);
      Object.values(G.lines).forEach((a) => a.forEach((t) => add(gk, t)));
      G.roast.forEach(([w, t]) => add(w, t));
    }
    TRIV_OPEN.forEach((t) => add("p", t)); WRONG.forEach((t) => add("c", t));
    add("p", STRETCH_OPEN); STRETCH_C.forEach((t) => add("c", t)); BIGQ.forEach((t) => add("c", t));
    TRIVIA.forEach(([q, a]) => { add("p", q); add("p", "The answer: " + a); if (R.guests.quiz) { add("quiz", q); add("quiz", "The correct question was... " + a); } });
    STORIES.forEach((st) => st.forEach(([w, t]) => add(w, t)));
    L_COL.lore.forEach((t) => { add("c", t); add("p", t); });   // lore comes from either of them
    return out;
  }
  // The lines to pre-record for the current Enhanced voices (characters without one are skipped), one per clip.
  function kFixedJobs() {
    const seen = new Set(), jobs = [];
    for (const [ch, text] of kLines()) {
      const v = R.ev[ch]; if (!v) continue;
      const sp = KSP[ch] || 1, key = kKey(v, sp, text);
      if (seen.has(key)) continue; seen.add(key);
      jobs.push({ key, text, v, sp });
    }
    K.fixed = seen;
    return jobs;
  }

  // ---- The engine frame ----
  function kSend(m, tr) { try { K.port && K.port.postMessage(m, tr || []); } catch (_) {} }
  const kCastVoices = () => [...new Set(KCHAR.map(([ch]) => R.ev[ch]).filter(Boolean))].concat(Object.values(R.ev).some(Boolean) ? [] : [KV.p]);
  function kFrame() {   // open the engine frame (no model yet: that's "init")
    if (K.frame) return;
    let url; try { url = XAPI.runtime.getURL("kokoro/engine.html"); } catch (_) { kFail("the extension was reloaded; refresh the page"); return; }
    const f = document.createElement("iframe");
    f.src = url; f.setAttribute("aria-hidden", "true"); f.tabIndex = -1; f.title = "SmallBall Radio voice engine";
    f.style.cssText = "display:none!important";
    K.frame = f;
    f.addEventListener("load", () => {
      if (K.frame !== f) return;
      const ch = new MessageChannel(); K.port = ch.port1;
      ch.port1.onmessage = (e) => kMsg(e.data || {});
      try { f.contentWindow.postMessage({ t: "sbx-kokoro-hello" }, new URL(url).origin, [ch.port2]); } catch (e) { kFail("couldn't reach the voice engine (" + e.message + ")"); }
    });
    K.helloT = setTimeout(() => { if (K.frame === f && !K.port) kFail("the voice engine didn't open"); }, 20000);
    (document.body || document.documentElement).appendChild(f);
  }
  // Load the model (after checking the graphics card, if this browser hasn't been checked yet).
  function kStart() {
    if (!kEff()) return;
    if (K.st === "ready" || (K.st === "loading" && K.want)) return;
    K.want = true; K.st = "loading"; K.phase = "start"; K.err = ""; K.act = Date.now();
    if (K.port) kBoot(); else kFrame();
    kPaint(); paintStage();
  }
  function kBoot() {
    if (!(kGpu() && kGpu().ok)) { K.phase = "probe"; kSend({ t: "probe" }); }
    else kSend({ t: "init", voices: kCastVoices() });
    kPaint();
  }
  function kProbe() { if (!K_OK || K.op) return; K.op = "probe"; if (K.port) kSend({ t: "probe" }); else kFrame(); }
  function kStop() {   // unload the engine and free its memory (the downloads and saved clips stay)
    clearTimeout(K.helloT);
    if (K.src) { try { K.src.onended = null; K.src.stop(); } catch (_) {} K.src = null; }
    if (speaking && speaking.kw) { clearTimeout(speaking.kT); speaking = null; setTimeout(pump, 50); }   // free the line it was on, so the booth carries on
    try { K.port && K.port.close(); } catch (_) {}
    if (K.frame) K.frame.remove();
    Object.assign(K, { frame: null, port: null, st: K.st === "failed" ? "failed" : "off", want: false, op: "", busy: null, phase: "", after: null, pre: null, mem: new Map(), memBytes: 0 });
    K.getting.clear();
    kPaint(); paintStage();
  }
  function kFail(why, gpu) {
    if (gpu) { R.kgpu = { ok: false, why, ua: UA, at: Date.now() }; rsave(); }
    K.st = "failed"; K.err = why; K.busy = null; K.want = false; K.pre = null; K.op = "";
    if (speaking && speaking.kw) { clearTimeout(speaking.kT); speaking = null; setTimeout(pump, 50); }
    if (prep) prepDone();   // go on the air (or run the test) with the Standard voices
    paintRadio(); paintDiag();
  }
  // Is the engine needed right now? If not, the housekeeping below unloads it.
  const testActive = () => Date.now() - testing < 120000 && (RQ.some((x) => x.test) || !!(speaking && speaking.test));
  const kNeed = () => kEff() && K.st !== "failed" && ((!stdOnly && (R.on || !!prep || testActive())) || !!(K.pre && K.pre.explicit));
  function kHouse() {
    // never leave the radio stuck getting ready: if the engine stopped loading, or went quiet for two minutes, go on with Standard
    if (prep && K.st !== "loading") prepDone();
    else if (prep && Date.now() - (K.act || 0) > 120000) kFail("the voices took too long to start");
    if (K.frame && !K.op && !K.after && !kNeed()) kStop();
  }
  setInterval(kHouse, 1000);

  // ---- Pre-recording: during setup, and whenever the voices change ----
  function kPreStart(kind) {
    if (!kEff()) return;
    K.pre = { kind, explicit: true, jobs: null, i: 0, made: 0, total: 0, have: 0, genMs: 0, n: 0 };
    if (K.st === "ready") kPreCheck(); else kStart();
    kPaint();
  }
  function kPreCheck() {   // which pre-recorded lines are missing for the current voices? (asks the engine's clip store)
    const jobs = kFixedJobs();
    K.preWant = jobs;
    kSend({ t: "has", id: "pre", keys: jobs.map((j) => j.key) });
  }
  function kPreHave(have) {
    const jobs = K.preWant || []; K.preWant = null;
    have.forEach((k) => K.disk.add(k));
    kSend({ t: "pin", keys: jobs.map((j) => j.key) });   // these stay; live lines can't push them out
    const miss = jobs.filter((j) => !K.disk.has(j.key));
    if (!miss.length) { if (K.pre || !kSetUp()) kPreDone(); return; }
    // missing lines: during setup or after a voice change, make them now; otherwise (the radio found a gap, say the
    // browser cleared some storage) fill them in quietly while the booth is idle
    if (!K.pre) K.pre = { kind: kSetUp() ? "update" : "setup", explicit: false, i: 0, made: 0, genMs: 0, n: 0 };
    Object.assign(K.pre, { jobs: miss, i: 0, total: miss.length, have: jobs.length - miss.length });
    kPaint(); kTick();
  }
  function kPreDone() {
    const p = K.pre; K.pre = null;
    const first = !kSetUp();
    R.ksetup = { done: true, at: Date.now() }; rsave();
    if (p && p.total) K.note = first ? `Setup is done: ${p.total + p.have} lines are prepared. Enhanced voices start by themselves when the radio goes on or you test the booth.` : `The new voice is ready: ${p.total} lines prepared${p.have ? `, ${p.have} reused` : ""}.`;
    else if (first) K.note = "Setup is done. Enhanced voices start by themselves when the radio goes on or you test the booth.";
    else if (p && p.explicit) K.note = "The new voice is ready: its commentary was already prepared, so it was reused.";
    kSend({ t: "usage" });
    paintRadio();
  }
  // A voice or guest changed: pre-record what's missing for the new voices, a moment after the last change.
  function kVoicesChanged() {
    clearTimeout(K.vT);
    K.vPend = kEff() && (kSetUp() || !!K.pre); kPaint();
    K.vT = setTimeout(() => {
      K.vPend = false;
      if (!kEff() || (!kSetUp() && !K.pre)) return kPaint();
      if (K.st === "ready") { K.pre = K.pre || { kind: kSetUp() ? "update" : "setup", explicit: true, i: 0, made: 0, genMs: 0, n: 0 }; K.pre.explicit = true; K.pre.jobs = null; kPreCheck(); }
      else kPreStart(kSetUp() ? "update" : "setup");
    }, 2500);
  }

  function kMsg(m) {
    K.act = Date.now();   // the engine is alive
    if (m.t === "hello") {
      clearTimeout(K.helloT);
      kSend({ t: "keys" }); kSend({ t: "usage" });   // every clip this browser has saved, so saved lines are never remade or skipped
      if (K.want) kBoot(); else if (K.op === "probe") kSend({ t: "probe" });
      if (K.after) { const a = K.after; K.after = null; a(); }
    }
    else if (m.t === "probe") {
      R.kgpu = { ok: !!m.ok, why: m.why || "", gpu: m.gpu || "", ua: UA, at: Date.now() }; rsave();
      if (K.op === "probe") K.op = "";
      if (K.want && K.st === "loading" && K.phase === "probe") { if (m.ok) { K.phase = "start"; kSend({ t: "init", voices: kCastVoices() }); } else return kFail(m.why, true); }
      paintRadio();
    }
    else if (m.t === "progress") { K.phase = m.phase; if (m.phase === "download") { K.loaded = m.loaded; K.total = m.total; } kPaint(); }
    else if (m.t === "note") { K.note = m.text; kPaint(); }
    else if (m.t === "keys") { (m.keys || []).forEach((k) => K.disk.add(k)); kTick(); }
    else if (m.t === "ready") {
      K.st = "ready"; K.dev = m.device; K.dtype = m.dtype; K.phase = ""; K.err = "";
      if (m.rtf > 0) K.rtf = m.rtf;   // the warm-up line is the first measure of speed
      kPreCheck(); kSend({ t: "usage" });
      if (prep) prepDone();
      kPaint(); paintDiag(); kTick();
    }
    else if (m.t === "error") { if (K.st === "loading" || K.want) kFail(m.error || "the voices couldn't start", m.gpu); else { K.err = m.error || ""; kPaint(); } }
    else if (m.t === "has") { if (m.id === "pre") kPreHave(m.keys || []); else (m.keys || []).forEach((k) => K.disk.add(k)); }
    else if (m.t === "usage" || m.t === "cleared") {
      K.usage = m;
      if (m.t === "cleared") { K.disk.clear(); K.op = ""; K.note = "Enhanced voice downloads and saved clips are cleared."; kStop(); paintRadio(); }
      kPaint();
    }
    else if (m.t === "made") {   // a pre-recorded line, saved
      if (K.busy && K.busy.id === m.id) K.busy = null;
      K.disk.add(m.key);
      if (K.pre && !m.cached) { K.pre.made++; K.pre.genMs += m.gen; if (m.dur > 0) { const r = m.gen / m.dur; K.rtf = K.rtf * 0.8 + r * 0.2; } }
      kPaint(); kTick();
    }
    else if (m.t === "audio" || m.t === "fail") {
      const job = K.busy && K.busy.id === m.id ? K.busy : null; if (job) K.busy = null;
      const got = K.getting.delete(m.key);
      if (m.t === "audio") {
        let pcm; try { pcm = new Float32Array(m.pcm); } catch (_) { pcm = Float32Array.from(m.pcm || []); }
        const clip = { sr: m.sr || 24000, pcm };
        kMemPut(m.key, clip);
        K.fails = 0;
        if (m.cached) { K.hits++; K.disk.add(m.key); }
        else if (m.gen > 0) {
          K.made++; if (job && job.keep) K.disk.add(m.key);
          const dur = (pcm.length / clip.sr) * 1000, r = m.gen / Math.max(1, dur);
          K.rtf = K.rtf * 0.6 + r * 0.4;
          K.gens.push(r); if (K.gens.length > 8) K.gens.shift();
          // Can this computer keep up? If making a line takes longer than saying it, the booth falls behind the game.
          if (K.gens.length >= 6 && TTS) { const s = K.gens.slice().sort((a, b) => a - b), med = s[Math.floor(s.length / 2)]; if (med > 1) { K.slow = true; K.note = `Enhanced voices are too slow on this computer (making a line takes ${med.toFixed(1)}× as long as saying it), so the booth is back on the Standard voices.`; paintDiag(); } }
        }
        if (speaking && speaking.kw && speaking.kkey === m.key && !speaking.kSrc) kPlay(speaking, clip);
      } else if (m.error === "miss") { if (got) K.disk.delete(m.key); }   // no longer saved (the browser cleared it): make it instead
      else {
        // Kokoro couldn't make this line: say it with the Standard voice instead, and stop using Enhanced after a few
        K.err = m.error; if (++K.fails >= 3) return kFail(m.error || "it kept failing");
        if (speaking && speaking.kw && speaking.kkey === m.key) { clearTimeout(speaking.kT); const it = speaking; speaking = null; it.kw = false; it.kbad = true; RQ.unshift(it); setTimeout(pump, 0); }
      }
      kPaint(); kTick();
    }
  }
  // What to do next. Saved lines in the queue are read from the clip store at once (no model needed). Then make the
  // line on deck, then the queue in order, skipping any line that can't be ready before it goes stale. With the
  // booth quiet, carry on pre-recording.
  function kGet(key) { K.getting.add(key); kSend({ t: "get", id: "g" + ++K.seq, key }); }
  function kTick() {
    if (!K.port) return;
    const on = talking(), live = on ? (speaking && speaking.kw ? [speaking] : []).concat(RQ.filter((x) => x.who !== "pause" && !x.kbad && kVoice(x))) : [];
    for (const it of live) { kJob(it); if (!K.mem.has(it.kkey) && K.disk.has(it.kkey) && !K.getting.has(it.kkey)) kGet(it.kkey); }
    if (K.st !== "ready" || K.busy) return;
    const now = Date.now();
    for (const it of live) {
      if (K.mem.has(it.kkey) || K.disk.has(it.kkey) || K.getting.has(it.kkey)) continue;
      if (now + kEst(it.text) > it.at + it.maxAge) continue;
      return kReq(it.kkey, it.text, it.kv, it.ksp, it.text.length <= 240 ? (K.fixed.has(it.kkey) ? "fixed" : "dyn") : false);
    }
    if (on && (speaking || RQ.length)) return;   // pre-recording waits for a quiet booth
    const p = K.pre; if (!p || !p.jobs) return;
    if (!p.explicit && !on) return;
    while (p.i < p.jobs.length && K.disk.has(p.jobs[p.i].key)) { p.i++; p.n++; }
    const j = p.jobs[p.i];
    if (j) { p.i++; p.n++; return kReq(j.key, j.text, j.v, j.sp, "fixed", true); }
    kPreDone();
  }
  function kReq(key, text, voice, speed, keep, quiet) { K.busy = { id: "j" + ++K.seq, key, text, keep }; kSend({ t: "say", id: K.busy.id, key, text, voice, speed, keep, quiet: !!quiet }); }
  // Speak a line with Enhanced voices: right away if it's made or saved, otherwise wait for it, but never past its shelf life.
  function kSpeak(it) {
    kJob(it); speaking = it; it.kw = true;
    const hit = kMemGet(it.kkey); if (hit) return kPlay(it, hit);
    const left = it.at + it.maxAge - Date.now();
    const coming = K.disk.has(it.kkey) || K.getting.has(it.kkey) || (K.busy && K.busy.key === it.kkey);
    if (!coming && kEst(it.text) > left) { speaking = null; it.kw = false; K.late++; return pump(); }
    it.kT = setTimeout(() => { if (speaking === it && !it.kSrc) { speaking = null; it.kw = false; K.late++; pump(); } }, Math.max(0, left));
    kTick();
  }
  function kPlay(it, clip) {
    clearTimeout(it.kT);
    if (Date.now() - it.at > it.maxAge) { speaking = null; it.kw = false; K.late++; return pump(); }   // made, but too late: the moment's gone
    const ac = kAC(); if (!ac) { speaking = null; it.kw = false; it.kbad = true; RQ.unshift(it); return pump(); }
    try {
      const buf = ac.createBuffer(1, clip.pcm.length, clip.sr); buf.getChannelData(0).set(clip.pcm);
      const src = ac.createBufferSource(), gn = ac.createGain(); src.buffer = buf; gn.gain.value = Math.max(0.05, R.vol);
      src.connect(gn).connect(ac.destination);
      it.kSrc = src; K.src = src;
      src.onended = () => { if (K.src === src) K.src = null; lastSpoke = Date.now(); if (speaking !== it) return; speaking = null; setTimeout(pump, it.who === "p" ? 120 : 280); };
      if (it.on) { try { it.on(); } catch (_) {} }
      src.start(); heard++; lastSpoke = Date.now();
    } catch (e) { speaking = null; it.kw = false; it.kbad = true; RQ.unshift(it); K.err = String(e.message || e); return pump(); }
    const nmw = who2name(it.who, it.g), said = it.cap || it.text;
    if (!it.cont) {   // the second half of a split line is already on the caption
      if (it.ev) (it.ev.radio || (it.ev.radio = [])).push(`${nmw}: ${said}`);
      const cap = isOpen() && ov.querySelector(".rcap"); if (cap) cap.innerHTML = `<b>${esc(nmw)}:</b> ${esc(said)}`;
      tvCap(nmw, said);
    }
    kTick();
  }

  // ---- Status ----
  const mb = (n) => (n >= 1e6 ? Math.round(n / 1e6) + " MB" : Math.max(1, Math.round(n / 1e3)) + " KB");
  const mins = (ms) => (ms < 90000 ? "about a minute" : `about ${Math.round(ms / 60000)} minutes`);
  function kPhase() {
    if (K.phase === "probe") return "Checking the graphics card…";
    if (K.phase === "download" && K.total) { const p = Math.min(100, Math.round((K.loaded / K.total) * 100)); return `Loading the voices (downloaded the first time, from storage after that): ${p}%, ${mb(K.loaded)} of ${mb(K.total)}.<div class="kbar"><i style="width:${p}%"></i></div>`; }
    if (K.phase === "warmup") return "Starting the voices and checking they sound right…";
    return "Starting the Enhanced voices…";
  }
  function kPreText() {
    const p = K.pre; if (!p || !p.jobs) return "Checking which lines are already prepared…";
    const pc = p.total ? Math.min(100, Math.round((p.n / p.total) * 100)) : 0, left = p.made ? (p.genMs / p.made) * Math.max(0, p.total - p.n) : 0;
    return `${p.kind === "setup" ? "Preparing the booth's commentary" : "Preparing commentary for the new voice"}: ${p.n} of ${p.total}${left ? `, ${mins(left)} left` : ""}.${p.explicit ? "" : " (Only while the booth is quiet.)"}<div class="kbar"><i style="width:${pc}%"></i></div>`;
  }
  function kStatus() {
    if (K.st === "failed") return `⚠️ Enhanced voices couldn't start: ${esc(K.err)}. The booth is using the Standard voices. <button class="mini" data-act="kretry">Try again</button>`;
    if (K.vPend) return "⏳ Voice changed: preparing its commentary in a moment…";
    if (K.st === "loading") return `⏳ ${!K.pre ? "" : K.pre.kind === "setup" ? "Setting up Enhanced voices. " : "Preparing commentary for the new voice. "}${kPhase()}${K.pre && K.pre.explicit ? ` <button class="mini" data-act="kcancel">${K.pre.kind === "setup" ? "Stop setup" : "Stop"}</button>` : ""}`;
    if (K.st === "ready") {
      if (K.slow && TTS) return `🐢 ${esc(K.note)} <button class="mini" data-act="kretry">Try Enhanced again</button>`;
      const pre = K.pre && K.pre.jobs && (K.pre.explicit || R.on) ? `<br>⏺ ${kPreText()}${K.pre.explicit ? ` <button class="mini" data-act="kcancel">Stop</button>` : ""}` : K.pre ? `<br>⏺ ${kPreText()}` : "";
      return `✅ Enhanced voices are running on the graphics card${K.made + K.hits ? `: ${K.made + K.hits} lines so far, ${K.hits} from saved clips${K.late ? `, ${K.late} skipped as too late` : ""}` : ""}.${pre}`;
    }
    if (!kSetUp()) return `One-time setup: checks the graphics card, downloads the voices (about 330 MB), checks they sound right and prepares the booth's regular commentary, then unloads until it's needed. <button class="mini" data-act="kset">${R.ksetup ? "Continue setup" : "Set up Enhanced voices"}</button>`;
    return "✅ Set up. The engine loads by itself when the radio goes on or you test the booth, and unloads when neither needs it.";
  }
  function kPaint() {
    if (!isOpen()) return;
    const el = ov.querySelector(".kstat"); if (el) el.innerHTML = kStatus() + (K.note && !(K.slow && K.st === "ready") ? ` <span class="note">${esc(K.note)}</span>` : "");
    const u = ov.querySelector(".kuse"); if (u) u.textContent = K.usage ? `Stored in this browser: ${mb(K.usage.total || 0)}${K.usage.clips ? ` (saved lines: ${mb(K.usage.clips)})` : ""}.` : "";
    if (prep) { const cap = ov.querySelector(".rcap"); if (cap && !cap.querySelector('[data-act="prepskip"]')) cap.innerHTML = `${prep === "test" ? "Preparing Enhanced voices for the booth test." : "Preparing Enhanced voices for your broadcast."}<div class="rrow" style="margin:6px 0 0"><button class="mini" data-act="prepskip">${prep === "test" ? "Test with Standard voices" : "Start with Standard voices"}</button></div>`; }
  }
  function kClear() {
    const go = () => kSend({ t: "clear" });
    R.engine = "standard"; R.ksetup = null; rsave();
    if (prep) prepDone();
    if (K.src) { try { K.src.stop(); } catch (_) {} }
    K.pre = null; K.want = false; K.op = "clear"; if (K.st !== "failed") K.st = "off";
    if (K.port) go(); else { K.after = go; kFrame(); }
    paintRadio();
  }
  // Going on the air (or testing) with Enhanced voices waits for the engine to be ready.
  let prep = "";   // "radio" or "test" while waiting
  function prepDone() { const p = prep; prep = ""; if (p === "radio") radioGo(); else if (p === "test") testGo(); paintStage(); }

  function radioIntro() {
    if (!R.on) return;
    const id = radioGame(); if (!id) return;
    const g = gstate(id), pool = Object.keys(GUESTS).filter((k) => R.guests[k]);
    g.guest = pool.length ? pick(pool) : null; g.guestIn = false;
    const t = teams(id, "top");
    say("p", `Hello again, everybody. Mack Ramsey here with Dewey Seeds, and welcome to SmallBall Radio. It's the ${t.away} visiting your ${t.home}.`, 3, { maxAge: 30000 });
    if (R.quips !== "off") say("c", Math.random() < 0.3 ? BACK_ON_AIR : pickFresh("intro", L_COL.intro), 3, { maxAge: 30000 });
  }
  // Fill the dead air now and then.
  setInterval(() => {
    if (!R.on || !isOpen() || !live || speaking || RQ.length || R.quips === "off") return;
    const id = radioGame(); if (!id) return; const g = gstate(id);
    const A = AIR[R.air] || AIR.steady, quietFor = Date.now() - Math.max(g.last, lastSpoke);
    if (quietFor > A.gap && Date.now() - (g.idle || 0) > A.every) { g.idle = Date.now(); filler(id, g); }
  }, 1000);
  // How chatty the booth is between plays: how long a silence it allows, and how often it fills one.
  const AIR = { quiet: { gap: 20000, every: 40000 }, steady: { gap: 5000, every: 9000 }, nonstop: { gap: 2000, every: 3500 } };
  let lastSpoke = 0;
  function filler(id, g) {
    const b = BS[id] || {}, roll = Math.random(), hitter = Object.entries(g.hits).sort((x, y) => y[1] - x[1])[0];
    if (R.updates !== "off" && roll < 0.22) { const sl = sitLine(id); if (sl) return say("p", sl, 0, { maxAge: 5000 }); }
    if (roll < 0.32 && hitter && hitter[1] >= 2) return say("p", `${hitter[0].split(/\s+/).pop()} has ${say1(hitter[1])} hits today. He's the one to watch.`, 0, { maxAge: 5000 });
    if (roll < 0.38 && b.pitches > 30) return say("p", `Pitch count's up to ${b.pitches}${b.pitches > 90 ? ", and there's no bullpen coming" : ""}.`, 0, { maxAge: 5000 });
    if (roll < 0.43 && b.fast >= 80) return say("c", `Fastest pitch so far today: ${b.fast} on the gun.`, 0, { maxAge: 5000 });
    if (g.guestIn && roll < 0.55) return guestChime(g, "any", true);
    if (roll < 0.66 && !RQ.length) { const bit = pickFresh("banter", L_COL.banter); bit.forEach(([w, t], i) => say(w, t, 0, { maxAge: 8000 + i * 6000 })); return; }
    if (roll < 0.82) return say(Math.random() < 0.3 ? "p" : "c", pickFresh("lore", L_COL.lore), 0, { maxAge: 5000 });
    say("c", pickFresh("idle", L_COL.idle), 0, { maxAge: 4000 });
  }

  function paintRadio() {
    if (!isOpen()) return;
    paintStage();
    const box = ov.querySelector(".rpanel"); if (!box || box.hidden) return;
    const en = VO.filter((v) => /^en/i.test(v.lang));
    const seg = (key, vals) => `<span class="seg" data-seg="${key}">${vals.map(([v, l]) => `<button data-v="${v}" class="${R[key] === v ? "on" : ""}">${l}</button>`).join("")}</span>`;
    // Standard voices (the browser's) and Enhanced voices (Kokoro) are set separately, five characters each.
    const sv = (ch) => (ch === "p" ? R.pbp : ch === "c" ? R.color : R.gv[ch] || "");
    const sOpts = (cur, who, gk) => { const a = (voiceFor(who, false, gk) || {}).name || ""; return `<option value="">Automatic${a ? ` (${esc(a)})` : ""}</option>` + en.map((v) => `<option${v.name === cur ? " selected" : ""}>${esc(v.name)}</option>`).join(""); };
    const eOpts = (cur) => `<option value=""${cur ? "" : " selected"}>Not set — use Standard</option>` + KALL.map(([id, n]) => `<option value="${id}"${cur === id ? " selected" : ""}>${esc(n)}</option>`).join("");
    const first = (n) => esc(n.split(" ")[0]);
    const sRows = TTS ? KCHAR.map(([ch, n]) => `<div class="rrow"><span class="lbl">${first(n)}</span><select data-sv="${ch}" aria-label="${esc(n)}: Standard voice">${sOpts(sv(ch), ch === "p" || ch === "c" ? ch : "g", ch)}</select></div>`).join("") : `<p class="note">This browser has no speech voices.</p>`;
    const eRows = KCHAR.map(([ch, n]) => `<div class="rrow"><span class="lbl">${first(n)}</span><select data-ev="${ch}" aria-label="${esc(n)}: Enhanced voice">${eOpts(R.ev[ch])}</select></div>`).join("");
    const gpu = kGpu(), checking = K_OK && !gpu, on = kEff();
    const why = !K_OK ? "this browser is missing something they need (WebAssembly or Web Audio in an extension)" : gpu && !gpu.ok ? gpu.why : "";
    box.innerHTML = `
      <div class="rrow"><b>📻 SmallBall Radio</b><span class="note">Mack calls it, Dewey colors it, a guest drops by.</span></div>
      ${TTS ? "" : `<p class="note">This browser has no speech voices${on ? ", so the radio needs the Enhanced voices below to talk here" : ", so the radio can't talk here"}.</p>`}
      <div class="rrow"><span class="lbl">Voices</span><span class="seg" data-seg="engine"><button data-v="standard" class="${on ? "" : "on"}">Standard</button><button data-v="enhanced" class="${on ? "on" : ""}"${kAvail() && !checking ? "" : " disabled"}>Enhanced${checking ? " (checking…)" : ""}</button></span></div>
      ${why ? `<p class="note">Enhanced voices aren't available here: ${esc(why)}.${R.engine === "enhanced" ? " The Standard voices are on." : ""} They need a graphics card the browser can use through WebGPU; most computers' built-in graphics qualify, in a recent Chrome or Edge (Firefox on Windows from version 141). ${K_OK ? `<button class="mini" data-act="kcheck">Check again</button>` : ""}</p>` : checking ? `<p class="note">Checking whether this computer's graphics card can run the Enhanced voices (nothing is downloaded)…</p>` : ""}
      ${on ? `<div class="kbox"><b>Enhanced voices · made on this computer</b>
        <p class="note kstat" style="opacity:.9"></p>
        ${eRows}
        <p class="note">"Not set" uses that character's Standard voice. Setup, or changing a voice, can take a few minutes while the booth's commentary is prepared in the new voice; commentary already prepared is reused. Turning the radio on can take up to a minute while the voices start. Nothing about the game is sent anywhere.${gpu && gpu.ok && gpu.gpu ? ` Graphics card: ${esc(gpu.gpu)}.` : ""}</p>
        <div class="rrow"><button class="mini" data-act="kclear">Clear Enhanced downloads</button><span class="note kuse"></span></div>
      </div>
      <details class="kbox"><summary>Standard voices · the backup, and for anyone not set above</summary>${sRows}</details>` : `<div class="kbox"><b>Standard voices · your browser's own</b>${sRows}
        ${R.ksetup && K_OK ? `<div class="rrow"><span class="note">Enhanced voices are set up in this browser.</span><button class="mini" data-act="kclear">Clear Enhanced downloads</button></div>` : ""}</div>`}
      <div class="rrow"><span class="lbl">Guests</span>${Object.entries(GUESTS).map(([k, G]) => `<label class="sw"><input type="checkbox" data-g="${k}"${R.guests[k] ? " checked" : ""}> ${esc(G.name.split(" ")[0])}</label>`).join("")}</div>
      <div class="rrow"><span class="lbl">Booth style</span>${seg("style", [["show", "The show"], ["pbp", "Play-by-play"]])}</div>
      <div class="rrow"><span class="lbl">Quips</span>${seg("quips", [["off", "Off"], ["some", "Some"], ["lots", "Lots"]])}</div>
      <div class="rrow"><span class="lbl">Pitch calls</span>${seg("pitches", [["some", "Now and then"], ["all", "Every pitch"], ["off", "Off"]])}</div>
      <div class="rrow"><span class="lbl">Score updates</span>${seg("updates", [["half", "Every half"], ["inning", "Every inning"], ["off", "Off"]])}</div>
      <div class="rrow"><span class="lbl">Situation</span>${seg("sit", [["some", "Now and then"], ["every", "Every batter"], ["off", "Off"]])}</div>
      <div class="rrow"><span class="lbl">Dead air</span>${seg("air", [["quiet", "Some quiet"], ["steady", "Steady"], ["nonstop", "Nonstop"]])}</div>
      <div class="rrow"><span class="lbl">Mack</span>${seg("lean", [["homer", "Home-team homer"], ["fair", "Down the middle"]])}</div>
      <div class="rrow"><span class="lbl">Volume</span><input type="range" min="0" max="1" step="0.05" value="${R.vol}" data-r="vol"><label class="sw"><input type="checkbox" data-r="organ"${R.organ ? " checked" : ""}> Organ</label></div>
      <p class="note rdiag"></p>
      <div class="rrow"><button class="mini" data-act="rtest">Test the booth</button><span class="note">On air: ${radioGame() ? label(S.meta[radioGame()]) : "no game yet"}.</span></div>
      <p class="note">If you see the words but hear nothing: press Test the booth, and if a voice is flagged, pick a different one above (voices without "Google" in the name live on your computer and are the most reliable).</p>
      <details class="rhow"><summary>📋 How the show goes</summary><ol class="note">
        <li><b>Pregame:</b> Mack and Dewey welcome you, name the park and both starting pitchers. Exhibitions, ProLeague games and good matches get a word.</li>
        <li><b>Every batter:</b> who's up and where he plays, his stars, and his hits today. With Situation on, Mack gives the inning, outs and score first (every batter, or now and then).</li>
        <li><b>Pitches:</b> balls and strikes now and then (every full count), or every pitch, plus the gun on the fast ones and the slow ones.</li>
        <li><b>Plays:</b> every hit, walk, strikeout and run, the moment the player shows it, with Dewey's color. The organ plays for homers and big hits.</li>
        <li><b>Score updates:</b> at every change of half-inning (or after each full inning), straight off the scoreboard, plus every time a run scores.</li>
        <li><b>The breaks:</b> a story after the 2nd, 4th and 8th, SmallBall Trivia after the 3rd and 6th, Around the BigLeague mid-5th, the seventh-inning stretch.</li>
        <li><b>The guest:</b> Chet the quiz-show host, Brock the retired quarterback or Gary the analyst walks in after the first half. One per game.</li>
        <li><b>No dead air:</b> when it goes quiet, the booth fills it: the situation, who's hot, the pitch count, the fastest pitch, booth banter, SmallBall lore. Dead air sets how often (Steady talks every few seconds; Nonstop never stops).</li>
        <li><b>Final:</b> the final score and a sign-off.</li>
        <li><b>Play-by-play style</b> calls more of the game and talks less. <b>Mack</b> is a shameless home-team homer, or play it down the middle.</li>
      </ol></details>
      <p class="note">The players' crowd noise is the Crowd button inside the player.</p>`;
    paintDiag(); kPaint();
    if (K_OK && !kGpu() && !K.op && !K.want && ov.classList.contains("open")) kProbe();   // is Enhanced possible here? (a tiny check when the panel opens; nothing downloaded)
  }
  function radioToggle() {
    if (prep === "radio") { prep = ""; paintRadio(); paintStage(); return; }   // stop getting ready: the radio stays off
    if (R.on) { R.on = false; stdOnly = false; hush(); kHouse(); paintRadio(); paintStage(); return; }   // off: silence now, and the engine unloads
    stdOnly = false;
    if (!TTS && !kEff()) return;
    if (kEff() && K.st !== "ready") {   // Enhanced: get the engine ready first, then go on the air by itself
      prep = "radio"; kAC(); if (K.st === "failed") K.st = "off"; kStart();
      const box = ov.querySelector(".rpanel"); if (box) box.hidden = false;
      paintRadio(); paintStage(); return;
    }
    radioGo();
  }
  function radioGo() {
    R.on = true; loadVoices(); if (live) radioIntro();
    const box = ov.querySelector(".rpanel"); if (box) box.hidden = false;
    paintRadio(); paintStage(); kTick();
  }
  let testing = 0;
  const talking = () => !document.getElementById("tk-ov") && (R.on || testActive());
  // Test the booth: one line from each of the five, in their voices. With Enhanced voices the engine starts first
  // (if it isn't running) and unloads after the test unless the radio's on.
  function radioTest() {
    hush(); speechDown = false; fails = 0; BADV.clear(); lastErr = "";
    if (!R.on) stdOnly = false;
    if (kEff()) { K.slow = false; K.gens = []; kAC(); }
    if (kEff() && !stdOnly && K.st !== "ready") { if (!prep) prep = "test"; if (K.st === "failed") K.st = "off"; kStart(); paintRadio(); paintStage(); return; }
    testGo();
  }
  function testGo() {
    testing = Date.now();
    TEST_LINES.forEach(([ch, t], i) => { const g = ch === "p" || ch === "c" ? "" : ch; say(g ? "g" : ch, t, 3, { maxAge: 60000, test: true, g }); if (!i) organ(2); });
  }



  // ---------- Wiring: find the game in the player, and follow it ----------
  let cur = null;   // { key, id, f }
  const nameOf = (sel) => ((document.querySelector(sel) || {}).textContent || "").trim();
  async function follow() {
    const pl = document.getElementById("playlog"); if (!pl) { if (cur) drop(); return; }
    const wid = Number(new URLSearchParams(location.search).get("watch")) || 0;
    const a = nameOf("#name-a"), h = nameOf("#name-b");
    const key = wid ? "g" + wid : a && h ? "n" + a + "|" + h : "";
    if (!key || (cur && cur.key === key)) return;
    if (cur) drop();
    const id = wid || -(Math.abs([...key].reduce((x, c) => (x * 31 + c.charCodeAt(0)) | 0, 7)) % 1e9 + 1);
    if (!S.meta[id]) {
      S.meta[id] = { id, kind: "", home: h || "the home team", away: a || "the visitors" };
      if (wid) try {   // what the game is, never how it ended: no runs are read
        const g = await getJSON(`/games/${wid}`);
        S.meta[id] = { id, kind: g.kind || "", good: !!g.good_match, home: g.home_name || h || "the home team", away: g.away_name || a || "the visitors", hid: g.home_team_id, aid: g.away_team_id };
      } catch (_) {}
    }
    const me = { key, id }; me.f = { get contentDocument() { return document; }, get isConnected() { return cur === me; } };
    cur = me; S.air = [id];
    attachLog(me.f, id);
    if (R.on) { hush(); radioIntro(); }
    paintStage();
  }
  function drop() { hush(); delete LOG[cur.id]; delete GS[cur.id]; delete BS[cur.id]; cur = null; S.air = []; paintStage(); }
  setInterval(follow, 1500); follow();

  // The launcher shows only where there's a game player, stacked above the kits' other buttons.
  const place = () => {
    const show = !!document.getElementById("playlog");
    if (!show) { launch.remove(); ov.classList.remove("open"); return; }
    if (!launch.isConnected) document.body.appendChild(launch);
    if (!ov.parentNode) document.body.appendChild(ov);
    const tops = ["sbx-skin-launch", "tk-launch", "tt-launch"].map((x) => document.getElementById(x)).filter(Boolean).map((e) => e.getBoundingClientRect().top).filter((t) => t > 0);
    const bottom = tops.length ? Math.round(window.innerHeight - Math.min(...tops) + 10) : 16;
    launch.style.bottom = bottom + "px"; ov.style.bottom = bottom + 50 + "px";
  };
  place(); setInterval(place, 2000);

  launch.addEventListener("click", () => { ov.classList.toggle("open"); if (ov.classList.contains("open")) { place(); paintRadio(); paintStage(); } });
  ov.addEventListener("click", (e) => {
    if (e.target.closest(".x")) { ov.classList.remove("open"); return; }
    const b = e.target.closest("button"); if (!b) return;
    const seg = b.closest(".seg");
    if (seg && seg.dataset.seg === "engine") {
      const was = kEff(); R.engine = b.dataset.v === "enhanced" && kAvail() ? "enhanced" : "standard"; rsave();
      if (kEff() && !was) {   // picking Enhanced: the one-time setup if it isn't done, else start it if the radio's on
        if (!kSetUp()) { kAC(); kPreStart("setup"); } else if (R.on) { kAC(); kStart(); }
      } else if (!kEff() && was) { K.pre = null; if (prep) prepDone(); if (K.st === "failed") K.st = "off"; kStop(); }   // Standard: unload now
      paintRadio(); return;
    }
    if (seg && ["quips", "pitches", "style", "updates", "sit", "air", "lean"].includes(seg.dataset.seg)) { R[seg.dataset.seg] = b.dataset.v; rsave(); paintRadio(); return; }
    const act = b.dataset.act;
    if (act === "kset") { kAC(); if (K.st === "failed") K.st = "off"; kPreStart("setup"); return; }
    if (act === "kcancel") { if (K.pre) K.pre.explicit = false; if (!R.on && !prep && !testActive()) kStop(); else kPaint(); return; }
    if (act === "kretry") { K.slow = false; K.gens = []; K.note = ""; if (K.st === "failed") { K.st = "off"; K.err = ""; if (!kSetUp()) { kAC(); kPreStart("setup"); } else if (R.on) { kAC(); kStart(); } } paintRadio(); return; }
    if (act === "kcheck") { R.kgpu = null; rsave(); if (K.st === "failed") { K.st = "off"; K.err = ""; } kProbe(); paintRadio(); return; }
    if (act === "kclear") { kClear(); return; }
    if (act === "prepskip") { stdOnly = true; prepDone(); kHouse(); return; }   // this broadcast (or test) on Standard voices; the setting stays Enhanced
    if (act === "radio") radioToggle();
    else if (act === "rtest") radioTest();
  });
  ov.addEventListener("input", (e) => {
    const d = e.target.dataset || {};
    if (d.g) { R.guests[d.g] = e.target.checked; rsave(); kVoicesChanged(); return; }
    if (d.sv) { const v = e.target.value; if (d.sv === "p") R.pbp = v; else if (d.sv === "c") R.color = v; else R.gv[d.sv] = v; rsave(); paintRadio(); return; }
    if (d.ev) { R.ev[d.ev] = e.target.value; rsave(); kVoicesChanged(); paintRadio(); return; }
    const k = d.r; if (!k) return;
    R[k] = e.target.type === "checkbox" ? e.target.checked : e.target.type === "range" ? Number(e.target.value) : e.target.value; rsave();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") ov.classList.remove("open"); });
  paintStage();
})();
