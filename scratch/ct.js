(async()=>{
const esc=(s)=>String(s).replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));const on=()=>true;const bs_boxOpen=()=>{};
const getJSON=async(u)=>{ if(u.startsWith("/games/4242")) return {kind:"big",away_team_id:1008,home_team_id:3249,away_name:"Teton Sliders",home_name:"Alabama Tide Pride"}; return {rows:[{game_id:4000,finished_at:"x",home_team_id:1008,away_team_id:3249,home_runs:5,away_runs:2},{game_id:4100,finished_at:"x",home_team_id:3249,away_team_id:1008,home_runs:1,away_runs:3}]}; };
document.querySelectorAll("#sbx-fake").forEach(e=>e.remove());
const fk=document.createElement("div"); fk.id="sbx-fake"; fk.innerHTML='<div class="wrap"><div class="main"><div class="stage-wrap" style="position:relative;width:1100px;height:520px;background:#2d5a27"><div class="sb" style="position:absolute;left:300px;top:20px;width:260px;height:110px;background:#000;color:#fff">OLD BOARD</div></div></div></div><i id="name-a">Teton Sliders</i><b id="score-a">0</b><i id="name-b">Alabama Tide Pride</i><b id="score-b">0</b><b id="inning">▲ 1</b><b id="count">1 - 2</b><b id="outs">1</b><div id="stats">23 pitches</div><div class="sb-mph">88 MPH fastest today 91</div><div class="sb-msg">Now batting: #12 Smith, CF</div><div class="sb-line"><span class="e">0</span></div><div class="sb-line"><span class="e">1</span></div><div id="playlog"></div>';
document.body.prepend(fk);
const addEv=(h,t)=>{const d=document.createElement("div");d.className="ev";d.innerHTML="<span>"+h+"</span> "+t;document.getElementById("playlog").prepend(d);};
  // ───────── 📡 SmallCast: a game cast under the player when you watch a game ─────────
  // Everything it shows is read off the player as it plays (the scoreboard and the play-by-play), so it
  // never runs ahead of the picture: no spoilers. "Coming in" uses only games played before this one.
  const onWatch = () => true;
  const CAST_FOLD = "sbx-tt-fold", CAST_TAB = "sbx-tt-tab", CAST_PLACE = "sbx-tt-place", CAST_POS = "sbx-tt-pos";
  const castPlace = () => { try { return localStorage.getItem(CAST_PLACE) || "below"; } catch (_) { return "below"; } };
  let CAST = null;
  const castNew = (gid) => ({ gid, ev: [], keys: [], primed: false, half: {}, order: [], score: [0, 0], batter: "", prevBatter: "", batAt: 0, meta: null, coming: null, sig: "" });
  const castHalfKey = (inn) => { const m = /([▲▼])\s*(\d+)/.exec(inn || ""); return m ? (m[1] === "▲" ? "T" : "B") + m[2] : ""; };
  const castHalfName = (h) => { const m = /^([TB])(\d+)/.exec(h || ""); return m ? (m[1] === "T" ? "▲" : "▼") + m[2] : h || ""; };
  // One line of the play-by-play: who, what, and how many scored. Same reading as the 📻 Radio's.
  function castParse(raw) {
    const t = String(raw || "").replace(/^\*\s*(FIRST:)?\s*/i, "").trim(); let m;
    const nm = (s) => s.replace(/\*+/g, "").trim();
    if (/^—\s*end of/i.test(t)) return { k: "end" };
    if ((m = /^(\d+)\s+(.+?):\s*(.+?)(?:,\s*(\d+)\s+scored)?$/i.exec(t)) && !/—/.test(m[2])) {
      const w = m[3].toLowerCase();
      const k = /grand slam|home run|homer/.test(w) ? "hr" : /triple/.test(w) ? "3b" : /double play/.test(w) ? "dp" : /double/.test(w) ? "2b" : /base hit|single|bunt hit|infield hit/.test(w) ? "1b" : "other";
      return { k, num: +m[1], name: nm(m[2]), what: m[3], scored: +(m[4] || 0) };
    }
    if ((m = /^(\d+)\s+(.+?)\s+(strikes out|walks|called out|is hit by(?: a)? pitch|hit by pitch)(?:,\s*(\d+)\s+scored)?/i.exec(t))) {
      const w = m[3].toLowerCase();
      return { k: /strikes|called/.test(w) ? "k" : /walk/.test(w) ? "bb" : "hbp", num: +m[1], name: nm(m[2]), scored: +(m[4] || 0) };
    }
    if ((m = /^(1B|2B|3B|SS|LF|CF|RF|P|C)\s+—\s+(.+)$/.exec(t))) return { k: "out", pos: m[1], how: m[2], scored: +((/(\d+)\s+scored/i.exec(m[2]) || [])[1] || 0) };
    return { k: "raw", scored: +((/(\d+)\s+scored/i.exec(t) || [])[1] || 0) };
  }
  const CAST_ABBR = { "1b": "1B", "2b": "2B", "3b": "3B", hr: "HR", k: "K", bb: "BB", hbp: "HBP", dp: "DP" };
  const castShort = (e) => CAST_ABBR[e.p.k] || (e.p.k === "out" ? (/fly/i.test(e.p.how) ? "F" : /line/i.test(e.p.how) ? "L" : /pop/i.test(e.p.how) ? "P" : /ground/i.test(e.p.how) ? "G" : "out") + e.p.pos : "out");
  function castTick() {
    if (!on("cast") || !onWatch()) { if (CAST) { document.getElementById("sbx-cast")?.remove(); CAST = null; } return; }
    const pl = document.getElementById("playlog"); if (!pl) return;
    const gid = Number("4242" || new URLSearchParams(location.search).get("game") || 0);
    if (!CAST || CAST.gid !== gid) { CAST = castNew(gid); castMeta(gid); }
    const C = CAST, tx = (s) => ((document.querySelector(s) || {}).textContent || "").trim();
    const score = [Number(tx("#score-a")) || 0, Number(tx("#score-b")) || 0], inn = tx("#inning");
    C.score = score; C.inn = inn; C.final = /final/i.test(inn);
    // Runs by half: a team's runs in a half are its score when its next half starts, less its score when this one did.
    const hk = castHalfKey(inn);
    if (hk && !C.half[hk]) { C.half[hk] = { start: score[hk[0] === "T" ? 0 : 1], live: true }; C.order.push(hk); }
    for (const k of C.order) { const h = C.half[k]; if (!h.done) h.end = score[k[0] === "T" ? 0 : 1]; }
    for (const k of C.order) { const side = k[0], n = +k.slice(1), nx = side + (n + 1); if (C.half[nx] && !C.half[k].done) { C.half[k].end = C.half[nx].start; C.half[k].done = true; } }
    // The batter up now (the player's message line), and who just batted, for the outs that don't name him.
    const bm = /Now batting:\s*#?(\d+)\s+(?:\d+\s+)?(.+?),\s*(1B|2B|3B|SS|LF|CF|RF|P|C|DH)\b/.exec(tx(".sb-msg"));
    if (bm) { const b = bm[2].replace(/\*+/g, "").trim(); if (b !== C.batter) { C.prevBatter = C.batter; C.batter = b; C.batNum = +bm[1]; C.batPos = bm[3]; C.batAt = Date.now(); } }
    C.pitches = +((/(\d+)\s+pitch/.exec(tx("#stats")) || [])[1] || 0);
    C.mph = +((/(\d+)\s*MPH/i.exec(tx(".sb-mph")) || [])[1] || 0); C.fast = Math.max(C.fast || 0, +((/fastest today\s*(\d+)/i.exec(tx(".sb-mph")) || [])[1] || 0), C.mph);
    C.errs = [...document.querySelectorAll(".sb-line .e")].map((e) => Number(e.textContent.trim())).filter((x) => !isNaN(x)).slice(-2);
    C.outs = tx("#outs"); C.count = tx("#count");
    // The play-by-play, oldest first, lined up with what we already have (lines repeat, so order matters).
    const cur = Array.from(pl.querySelectorAll(".ev")).reverse().map((ev) => { const h = ((ev.querySelector("span") || {}).textContent || "").trim(); return { h, t: ev.textContent.slice(h.length).trim() }; }).filter((x) => x.t);
    const keys = cur.map((x) => x.h + "|" + x.t), prev = C.keys;
    let j = Math.min(prev.length, keys.length);
    for (; j > 0; j--) { let ok = true; for (let q = 0; q < j; q++) if (prev[prev.length - j + q] !== keys[q]) { ok = false; break; } if (ok) break; }
    if (keys.length < prev.length && j === 0) { const m = C.meta, co = C.coming; Object.assign(C, castNew(gid), { meta: m, coming: co }); }   // the player restarted the game
    for (const x of cur.slice(j)) {
      const p = castParse(x.t), e = { h: x.h, t: x.t.replace(/^\*\s*/, ""), p, live: C.primed };
      if (p.k === "out" && C.primed) e.who = Date.now() - C.batAt < 3000 && C.prevBatter ? C.prevBatter : C.batter;
      C.ev.push(e);
      if (C.primed) castJumbo(e);
    }
    // Tuning in mid-half: the runs already scored this half are in the play-by-play, not in our snapshot.
    if (!C.primed && hk && C.half[hk]) { const pre = C.ev.filter((e) => e.h === hk).reduce((x, e) => x + (e.p.scored || (e.p.k === "hr" ? 1 : 0)), 0); C.half[hk].start = Math.max(0, C.half[hk].start - pre); }
    C.keys = keys; C.primed = true;
    castPaint();
  }
  // 📺 The jumbotron: a big play gets the video-board treatment for a few seconds.
  const JUMBO = {
    hr: ["💥 HOME RUN! 💥", "🚀 GOODBYE BASEBALL 🚀", "🎆 IT'S OUTTA HERE 🎆"], "3b": ["🏃💨 TRIPLE! 🏃💨"], "2b": ["⚡ TWO-BAGGER ⚡", "📐 IN THE GAP 📐"],
    k: ["🔥 K 🔥", "🌀 STRUCK HIM OUT 🌀", "🔥 SIT DOWN 🔥"], dp: ["✌️ DOUBLE PLAY ✌️", "🔁 TWO FOR ONE 🔁"], run: ["🙌 RUN SCORES 🙌", "📣 CROSSING THE PLATE 📣"],
    filler: ["🎶 MAKE SOME NOISE 🎶", "👏 👏 CLAP 👏 👏", "🌊 DO THE WAVE 🌊", "🌭 DOLLAR DOG NIGHT 🌭", "📸 SMILE, YOU'RE ON SMALLCAM 📸", "🧢 RALLY CAPS ON 🧢", "💃 DANCE CAM 💃", "🎵 TAKE ME OUT TO THE BALLGAME 🎵"],
  };
  function castJumbo(e) {
    const C = CAST; if (!C) return;
    const k = e.p.k === "hr" ? "hr" : e.p.k === "dp" ? "dp" : e.p.k === "k" ? "k" : e.p.scored ? "run" : e.p.k === "3b" ? "3b" : e.p.k === "2b" ? "2b" : e.p.k === "end" && Math.random() < 0.6 ? "filler" : "";
    if (!k) return;
    const ms = k === "hr" ? 7000 : 4500;
    C.jumbo = { txt: JUMBO[k][Math.floor(Math.random() * JUMBO[k].length)], k, until: Date.now() + ms };
    C.sig = ""; setTimeout(() => { if (CAST === C && C.jumbo && Date.now() >= C.jumbo.until) { C.jumbo = null; C.sig = ""; castPaint(); } }, ms + 50);
  }
  async function castMeta(gid) {
    if (!gid) return;
    try {
      const g = await getJSON(`/games/${gid}`, true);   // who's playing and where, never the score
      if (!CAST || CAST.gid !== gid) return;
      CAST.meta = { kind: g.kind || "", aid: g.away_team_id, hid: g.home_team_id, away: g.away_name || "", home: g.home_name || "" };
      // Coming in: each club's last 10 and the season series, from games played before this one.
      const rec = async (tid) => { const d = await getJSON(`/games/all?club=${tid}`, true); return (d.rows || []).filter((r) => r.game_id < gid && r.finished_at && (r.home_team_id === tid || r.away_team_id === tid)).sort((a, b) => b.game_id - a.game_id); };
      const [ra, rh] = await Promise.all([rec(CAST.meta.aid).catch(() => []), rec(CAST.meta.hid).catch(() => [])]);
      if (!CAST || CAST.gid !== gid) return;
      const wl = (rows, tid) => { let w = 0, l = 0; for (const r of rows) { const me = r.home_team_id === tid ? r.home_runs : r.away_runs, op = r.home_team_id === tid ? r.away_runs : r.home_runs; if (me > op) w++; else if (op > me) l++; } return [w, l]; };
      const streak = (rows, tid) => { let s = "", n = 0; for (const r of rows) { const me = r.home_team_id === tid ? r.home_runs : r.away_runs, op = r.home_team_id === tid ? r.away_runs : r.home_runs, x = me > op ? "W" : "L"; if (!s) s = x; if (x !== s) break; n++; } return s ? s + n : ""; };
      const h2h = ra.filter((r) => r.home_team_id === CAST.meta.hid || r.away_team_id === CAST.meta.hid);
      CAST.coming = { a: { l10: wl(ra.slice(0, 10), CAST.meta.aid), st: streak(ra, CAST.meta.aid) }, h: { l10: wl(rh.slice(0, 10), CAST.meta.hid), st: streak(rh, CAST.meta.hid) }, h2h: wl(h2h, CAST.meta.aid), h2hN: h2h.length };
      CAST.sig = ""; castPaint();
    } catch (_) {}
  }
  function castStyle() {
    if (document.getElementById("sbx-cast-css")) return;
    const s = document.createElement("style"); s.id = "sbx-cast-css";
    s.textContent = `
#sbx-cast{margin:14px auto 28px;max-width:1200px;background:#0b1220;color:#e5e7eb;border:1px solid #1e293b;border-radius:16px;padding:12px 16px 14px;font:13px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.35)}
#sbx-cast .ch{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
#sbx-cast .ch .t{font-size:16px;font-weight:900;letter-spacing:.02em}
#sbx-cast .ch .t i{font-style:normal;color:#f87171;font-size:10px;font-weight:800;border:1px solid #f87171;border-radius:999px;padding:1px 6px;margin-left:6px;vertical-align:2px}
#sbx-cast .ch .sub{opacity:.65;flex:1;min-width:120px}
#sbx-cast .ch button{border:0;border-radius:999px;padding:6px 12px;background:#1e293b;color:#e5e7eb;font:700 12px system-ui,sans-serif;cursor:pointer}
#sbx-cast .ch button:hover{background:#334155}
#sbx-cast .tabs{display:flex;gap:4px;margin:10px 0 8px}
#sbx-cast .tabs button{border:0;border-radius:8px;padding:6px 12px;background:transparent;color:#94a3b8;font:800 12px system-ui,sans-serif;cursor:pointer}
#sbx-cast .tabs button.on{background:#1e293b;color:#fff}
#sbx-cast .grid{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:14px}
@media (max-width:820px){#sbx-cast .grid{grid-template-columns:1fr}}
#sbx-cast .box{background:#111a2e;border-radius:12px;padding:10px 12px}
#sbx-cast h4{margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8}
#sbx-cast table.ls{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}
#sbx-cast table.ls th,#sbx-cast table.ls td{padding:4px 5px;text-align:center;border-bottom:1px solid #1e293b}
#sbx-cast table.ls td:first-child,#sbx-cast table.ls th:first-child{text-align:left;max-width:170px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#sbx-cast table.ls .rhe{font-weight:900;color:#fde68a}
#sbx-cast table.ls .now{background:#1e3a5f;border-radius:4px}
#sbx-cast table.ls .est{opacity:.6}
#sbx-cast .situ{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-top:10px}
#sbx-cast .situ b{font-size:15px}
#sbx-cast .pill{display:inline-block;border-radius:999px;background:#1e293b;padding:2px 8px;margin:0 3px 3px 0;font-size:12px;font-weight:700}
#sbx-cast .pill.g{background:#14532d;color:#bbf7d0}#sbx-cast .pill.r{background:#4c1d1d;color:#fecaca}#sbx-cast .pill.y{background:#713f12;color:#fde68a}
#sbx-cast .feed{max-height:300px;overflow:auto}
#sbx-cast .feed div{padding:4px 0;border-bottom:1px solid #16213a}
#sbx-cast .feed .h{display:inline-block;min-width:34px;font-weight:800;color:#94a3b8}
#sbx-cast .feed .sc{color:#fde68a;font-weight:700}
#sbx-cast .muted{opacity:.6}
#sbx-cast table.bat{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}
#sbx-cast table.bat td{padding:3px 4px;border-bottom:1px solid #16213a;vertical-align:top}
#sbx-cast table.bat td.n{white-space:nowrap;font-weight:700}
#sbx-cast.fold .body{display:none}
#sbx-cast .cpl{display:inline-flex;background:#111a2e;border-radius:999px;padding:2px}
#sbx-cast .cpl button{background:transparent;padding:5px 9px;font-size:11px;color:#94a3b8}
#sbx-cast .cpl button.on{background:#334155;color:#fff}
#sbx-cast.float{position:fixed;right:16px;top:90px;z-index:2147482990;width:400px;max-width:calc(100vw - 32px);max-height:calc(100vh - 110px);overflow:auto;margin:0;padding:10px 12px 12px;box-shadow:0 18px 50px rgba(0,0,0,.6)}
#sbx-cast.float .ch{cursor:move;user-select:none}
#sbx-cast.onboard{position:absolute;z-index:6;margin:0;padding:6px 9px 7px;max-width:none;opacity:.94;border-radius:8px;border:2px solid #2b3340;background:linear-gradient(#10161f,#070a10);box-shadow:0 4px 14px rgba(0,0,0,.55);font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;color:#f4f1e6;overflow:hidden}
#sbx-cast.onboard .ob-top{display:flex;align-items:center;gap:6px;margin-bottom:3px}
#sbx-cast.onboard .ob-top b{flex:1;color:#ffc23d;font:900 11px system-ui,sans-serif;letter-spacing:.04em}
#sbx-cast.onboard .cpl button{border:0;background:transparent;color:#94a3b8;padding:1px 4px;font-size:11px;cursor:pointer;border-radius:999px}
#sbx-cast.onboard .cpl button.on{background:#334155;color:#fff}
#sbx-cast.onboard table.ls th,#sbx-cast.onboard table.ls td{padding:1px 3px;font-size:11px;border-bottom:1px solid #1f2733}
#sbx-cast.onboard table.ls td:first-child{max-width:95px;color:#ffc23d}
#sbx-cast.onboard table.ls .rhe{color:#ffc23d}
#sbx-cast.onboard .ob-bat{margin:2px 0 3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#sbx-cast.onboard .ob-more{border:0;background:#1f2733;color:#e5e7eb;border-radius:999px;padding:0 7px;cursor:pointer;font-size:11px}
#sbx-cast.onboard .ob-log div{padding:1px 0;border-top:1px solid #1f2733;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#sbx-cast.onboard .ob-log div:first-child{color:#fff}
#sbx-cast.onboard .ob-log span{color:#94a3b8;display:inline-block;min-width:24px}
#sbx-cast.onboard .ob-log em{font-style:normal;color:#ffc23d;font-weight:700}
#sbx-cast.onboard .ob-k{margin-top:3px;opacity:.7}
#sbx-cast.jumbo{position:absolute;z-index:6;margin:0;padding:0;max-width:none;display:grid;gap:0;background:transparent;border:0;box-shadow:none;pointer-events:none;font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;color:#f4f1e6}
#sbx-cast.jumbo>div:nth-child(2){pointer-events:none}
#sbx-cast.jumbo .jt-wing{pointer-events:auto;overflow:hidden;background:linear-gradient(rgba(16,22,31,.78),rgba(7,10,16,.78));box-shadow:0 0 0 2px rgba(43,51,64,.9),0 4px 10px rgba(0,0,0,.4);padding:5px 9px}
#sbx-cast.jumbo .jt-l{border-radius:5px 0 0 5px;display:flex;align-items:center;justify-content:center;text-align:center}
#sbx-cast.jumbo .jt-r{border-radius:0 5px 5px 0}
#sbx-cast.jumbo .jt-lbl{color:#ffc23d;font:900 10px system-ui,sans-serif;letter-spacing:.12em}
#sbx-cast.jumbo .jt-bat b{display:block;font-size:13px;margin:2px 0}
#sbx-cast.jumbo .jt-k{opacity:.7;font-size:10px}
#sbx-cast.jumbo .jt-top{display:flex;align-items:center;gap:6px;margin-bottom:2px}
#sbx-cast.jumbo .jt-top .jt-lbl{flex:1}
#sbx-cast.jumbo .cpl{background:transparent}
#sbx-cast.jumbo .cpl button{border:0;background:transparent;color:#94a3b8;padding:0 3px;font-size:10px;cursor:pointer;border-radius:999px}
#sbx-cast.jumbo .cpl button.on{background:#334155;color:#fff}
#sbx-cast.jumbo .jt-ev{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:1px 0;border-top:1px solid rgba(255,255,255,.08)}
#sbx-cast.jumbo .jt-ev:nth-child(2){color:#fff}
#sbx-cast.jumbo .jt-ev span{color:#94a3b8;display:inline-block;min-width:24px}
#sbx-cast.jumbo .jt-ev em{font-style:normal;color:#ffc23d;font-weight:700}
#sbx-cast.jumbo .pill{padding:0 5px;font-size:10px;margin:0 2px 0 0}
#sbx-cast.jumbo .jt-show{font:900 clamp(14px,2.2vw,26px)/1.1 system-ui,sans-serif;letter-spacing:.04em;color:#fff;text-shadow:0 0 10px currentColor;animation:jtPulse .6s ease-in-out infinite alternate}
#sbx-cast.jumbo .jt-show.jt-hr{animation:jtRainbow 1s linear infinite, jtPulse .45s ease-in-out infinite alternate}
#sbx-cast.jumbo .jt-show.jt-k{color:#f87171}
#sbx-cast.jumbo .jt-show.jt-run,#sbx-cast.jumbo .jt-show.jt-dp{color:#fde68a}
#sbx-cast.jumbo .jt-show.jt-filler{color:#93c5fd;animation:jtScroll 4.5s linear}
@keyframes jtPulse{from{transform:scale(1)}to{transform:scale(1.08)}}
@keyframes jtRainbow{0%{color:#f87171}25%{color:#fde68a}50%{color:#86efac}75%{color:#93c5fd}100%{color:#f0abfc}}
@keyframes jtScroll{from{transform:translateX(60%)}to{transform:translateX(-60%)}}
#sbx-cast.onboard .pill{padding:0 5px;font-size:10px;margin:0 2px 0 0}
#sbx-cast.float .ch .sub{flex-basis:100%;order:5}
#sbx-cast.float .grid{grid-template-columns:1fr !important;gap:10px}
#sbx-cast.float .feed{max-height:220px}
#sbx-cast.float table.ls th,#sbx-cast.float table.ls td{padding:3px 3px;font-size:12px}
#sbx-cast.float table.ls td:first-child{max-width:110px}`;
    document.head.appendChild(s);
  }
  function castPaint() {
    const C = CAST; if (!C) return;
    const wrap = document.querySelector(".wrap"), main = wrap && wrap.querySelector(".main"); if (!main) return;
    castStyle();
    let el = document.getElementById("sbx-cast");
    if (!el) {
      el = document.createElement("div"); el.id = "sbx-cast";
      el.addEventListener("click", (e) => {
        const b = e.target.closest("button"); if (!b) return;
        if (b.dataset.cfold != null) { const f = !el.classList.contains("fold"); try { localStorage.setItem(CAST_FOLD, f ? "1" : "0"); } catch (_) {} CAST.sig = ""; castPaint(); }
        else if (b.dataset.ctab) { try { localStorage.setItem(CAST_TAB, b.dataset.ctab); } catch (_) {} CAST.sig = ""; castPaint(); }
        else if (b.dataset.cradio != null) document.getElementById("sbx-radio-launch")?.click();
        else if (b.dataset.cbc != null) document.getElementById("tk-launch")?.click();
        else if (b.dataset.cbox) bs_boxOpen(Number(b.dataset.cbox));
        else if (b.dataset.cplace) { try { localStorage.setItem(CAST_PLACE, b.dataset.cplace); } catch (_) {} CAST.sig = ""; castPaint(); }
      });
      // Floating: drag it by its title bar; it remembers where you left it.
      el.addEventListener("pointerdown", (e) => {
        if (!el.classList.contains("float") || !e.target.closest(".ch") || e.target.closest("button")) return;
        const r = el.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
        const mv = (ev) => { const x = Math.max(0, Math.min(innerWidth - 120, ev.clientX - dx)), y = Math.max(0, Math.min(innerHeight - 60, ev.clientY - dy)); el.style.left = x + "px"; el.style.top = y + "px"; el.style.right = "auto"; };
        const up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); try { localStorage.setItem(CAST_POS, JSON.stringify({ x: parseInt(el.style.left), y: parseInt(el.style.top) })); } catch (_) {} };
        addEventListener("pointermove", mv); addEventListener("pointerup", up); e.preventDefault();
      });
    }
    // "With the board": hung under the stadium scoreboard in the picture (or over it when the board sits low),
    // adding what the board doesn't show. Falls back to floating if this park has no board showing.
    const board = document.querySelector(".stage-wrap .sb"), hasBoard = !!(board && board.offsetWidth > 20), sw0 = hasBoard && (board.offsetParent || board.parentNode);
    // the jumbotron needs room on both sides of the board; when the player's small, it hangs under the board instead
    const wingRoom = hasBoard ? Math.min(board.offsetLeft, sw0.clientWidth - board.offsetLeft - board.offsetWidth) : 0;
    let place = castPlace(); if ((place === "board" || place === "jumbo") && !hasBoard) place = "float"; else if (place === "jumbo" && wingRoom < 140) place = "board";
    el.classList.toggle("float", place === "float"); el.classList.toggle("onboard", place === "board"); el.classList.toggle("jumbo", place === "jumbo");
    if (place === "jumbo") {
      const sw = sw0; if (el.parentNode !== sw) sw.appendChild(el);
      const st = `left:6px;right:6px;top:${board.offsetTop}px;height:${board.offsetHeight}px;grid-template-columns:minmax(0,1fr) ${board.offsetWidth + 12}px minmax(0,1fr)`;
      if (el.dataset.bst !== st) { el.dataset.bst = st; el.style.cssText = st; }
    }
    else if (place === "board") {
      const sw = board.offsetParent || board.parentNode;
      if (el.parentNode !== sw) sw.appendChild(el);
      const w = Math.max(board.offsetWidth, 300), x = Math.max(0, Math.min(board.offsetLeft - (w - board.offsetWidth) / 2, sw.clientWidth - w));
      const below = board.offsetTop + board.offsetHeight + 6, roomBelow = sw.clientHeight - below > 150;
      const st = `left:${Math.round(x)}px;width:${Math.round(w)}px;` + (roomBelow ? `top:${Math.round(below)}px` : `bottom:${Math.round(sw.clientHeight - board.offsetTop + 6)}px`);
      if (el.dataset.bst !== st) { el.dataset.bst = st; el.style.cssText = st; }
    } else if (el.dataset.bst) { el.dataset.bst = ""; el.style.cssText = ""; }
    if (place === "board" || place === "jumbo") {} else if (place === "float") {
      if (el.parentNode !== document.body) { document.body.appendChild(el); let P = null; try { P = JSON.parse(localStorage.getItem(CAST_POS) || "null"); } catch (_) {} if (P && P.x < innerWidth - 120 && P.y < innerHeight - 60) { el.style.left = P.x + "px"; el.style.top = P.y + "px"; el.style.right = "auto"; } else { el.style.left = ""; el.style.top = ""; el.style.right = ""; } }
    } else {
      el.style.left = el.style.top = el.style.right = "";
      if (place === "above") { if (el.nextElementSibling !== main) main.insertAdjacentElement("beforebegin", el); }
      else if (el.previousElementSibling !== main) main.insertAdjacentElement("afterend", el);
    }
    let fold = false, tab = "game"; try { fold = localStorage.getItem(CAST_FOLD) === "1"; tab = localStorage.getItem(CAST_TAB) || "game"; } catch (_) {}
    const sig = [place, el.dataset.bst || "", C.jumbo ? C.jumbo.txt : "", fold, tab, C.ev.length, C.score, C.inn, C.outs, C.count, C.batter, C.pitches, C.mph, C.errs, !!C.coming, !!C.meta, !!document.getElementById("sbx-radio-launch"), !!document.getElementById("tk-launch")].join("|");
    if (sig === C.sig) return; C.sig = sig;
    el.classList.toggle("fold", fold);
    const M = C.meta || {}, A = M.away || ((document.querySelector("#name-a") || {}).textContent || "Away").trim(), H = M.home || ((document.querySelector("#name-b") || {}).textContent || "Home").trim();
    const kind = { big: "BigLeague", pro: "ProLeague", exhibition: "Exhibition" }[M.kind] || "";
    const head = `<div class="ch"><span class="t">📡 SmallCast${C.final ? "" : "<i>LIVE</i>"}</span><span class="sub">${esc(A)} at ${esc(H)}${kind ? " · " + kind : ""}</span>` +
      (document.getElementById("sbx-radio-launch") ? '<button type="button" data-cradio title="Mack and Dewey call this game out loud">📻 Radio</button>' : "") +
      (document.getElementById("tk-launch") ? '<button type="button" data-cbc title="Open the Broadcast Kit">📺 Broadcast</button>' : "") +
      (C.final && C.gid ? `<button type="button" data-cbox="${C.gid}">📰 Box score</button>` : "") +
      `<span class="cpl" title="Where SmallCast sits">${[["above", "⬆ Above"], ["below", "⬇ Below"], ["float", "🪟 Float"], ["board", "🏟 With the board"], ["jumbo", "📺 Jumbotron"]].map(([k, l]) => `<button type="button" data-cplace="${k}" class="${place === k ? "on" : ""}">${l}</button>`).join("")}</span>` +
      `<button type="button" data-cfold title="${fold ? "Show" : "Hide"} SmallCast">${fold ? "▾ Show" : "▴ Hide"}</button></div>`;
    if (fold && place !== "board" && place !== "jumbo") { el.innerHTML = head; return; }
    // Line score: the halves we've seen, plus any played before you tuned in (read from the play-by-play).
    const runsIn = {}, hits = [0, 0], ks = [0, 0];
    for (const e of C.ev) {
      const side = e.h[0] === "B" ? 1 : 0;
      if (["1b", "2b", "3b", "hr"].includes(e.p.k)) hits[side]++;
      if (e.p.k === "k") ks[side]++;
      if (!C.half[e.h]) { const r = e.p.scored || (e.p.k === "hr" ? 1 : 0); runsIn[e.h] = (runsIn[e.h] || 0) + r; }
    }
    const runs = {}, est = {};
    for (const [k, r] of Object.entries(runsIn)) { runs[k] = r; est[k] = true; }
    for (const k of C.order) { const h = C.half[k]; runs[k] = Math.max(0, (h.end || 0) - (h.start || 0)); }
    // The halves read off the play-by-play are a best reading: line them up with the scoreboard's total.
    for (const s of [0, 1]) {
      const pre = Object.keys(est).filter((k) => (k[0] === "T") === (s === 0)).sort((a, b) => +a.slice(1) - +b.slice(1));
      if (!pre.length) continue;
      const firstLive = C.order.find((k) => (k[0] === "T") === (s === 0)), before = firstLive ? C.half[firstLive].start : C.score[s];
      const got = pre.reduce((x, k) => x + runs[k], 0); if (got !== before) runs[pre[pre.length - 1]] = Math.max(0, runs[pre[pre.length - 1]] + before - got);
    }
    let maxInn = 9; for (const k of Object.keys(runs)) maxInn = Math.max(maxInn, +k.slice(1)); const hk = castHalfKey(C.inn);
    const row = (s, name) => { let h = `<tr><td>${esc(name)}</td>`; for (let n = 1; n <= maxInn; n++) { const k = (s ? "B" : "T") + n; h += `<td class="${k === hk && !C.final ? "now" : ""}${est[k] ? " est" : ""}">${k in runs ? runs[k] : ""}</td>`; } return h + `<td class="rhe">${C.score[s]}</td><td class="rhe">${hits[s]}</td><td class="rhe">${C.errs.length === 2 ? C.errs[s] : ""}</td></tr>`; };
    let ls = `<table class="ls"><tr><th></th>`; for (let n = 1; n <= maxInn; n++) ls += `<th>${n}</th>`; ls += `<th>R</th><th>H</th><th>E</th></tr>${row(0, A)}${row(1, H)}</table>`;
    // At bat now: the batter, his day so far, and the pitch count.
    const day = {}; for (const e of C.ev) { const who = e.p.name || e.who; if (!who) continue; (day[who] = day[who] || []).push(castShort(e)); }
    const pillOf = (x) => `<span class="pill ${/^(1B|2B|3B|HR)$/.test(x) ? "g" : /^(K)$/.test(x) ? "r" : /^(BB|HBP)$/.test(x) ? "y" : ""}">${x}</span>`;
    const situ = C.final ? `<div class="situ"><b>Final</b><span class="muted">${esc(A)} ${C.score[0]}, ${esc(H)} ${C.score[1]}</span></div>`
      : `<div class="situ"><b>${esc(C.inn)}</b><span>Outs <b>${esc(C.outs || "0")}</b></span><span>Count <b>${esc(C.count || "0 - 0")}</b></span>${C.pitches ? `<span>Pitches <b>${C.pitches}</b></span>` : ""}${C.mph ? `<span>Last <b>${C.mph}</b> mph</span>` : ""}${C.fast ? `<span class="muted">fastest today ${C.fast}</span>` : ""}</div>` +
        (C.batter ? `<div class="situ"><span>At bat: <b>${C.batNum ? "#" + C.batNum + " " : ""}${esc(C.batter)}</b> <span class="muted">${esc(C.batPos || "")}</span></span><span>${(day[C.batter] || []).map(pillOf).join("") || '<span class="muted">first time up today</span>'}</span></div>` : "");
    // Coming in, and the strikeouts each staff has so far.
    const CI = C.coming, cin = CI ? `<div class="box" style="margin-top:10px"><h4>Coming in</h4><div>${esc(A)}: <b>${CI.a.l10[0]}-${CI.a.l10[1]}</b> last 10${CI.a.st ? ` · ${CI.a.st}` : ""}</div><div>${esc(H)}: <b>${CI.h.l10[0]}-${CI.h.l10[1]}</b> last 10${CI.h.st ? ` · ${CI.h.st}` : ""}</div><div class="muted">${CI.h2hN ? `Head to head: ${esc(A)} ${CI.h2h[0]}-${CI.h2h[1]} in ${CI.h2hN}` : "First meeting"}</div></div>` : "";
    const staff = `<div class="muted" style="margin-top:6px">Strikeouts: ${esc(H)} pitchers ${ks[0]} · ${esc(A)} pitchers ${ks[1]}</div>`;
    // Tabs: the play-by-play, scoring plays only, or each lineup's day.
    const tabs = `<div class="tabs">${[["game", "Play by play"], ["score", "Scoring"], ["bat", "Batters"]].map(([k, l]) => `<button type="button" data-ctab="${k}" class="${tab === k ? "on" : ""}">${l}</button>`).join("")}</div>`;
    let pane = "";
    const evs = C.ev.filter((e) => e.p.k !== "end" && !/^foul/i.test(e.t));
    if (tab === "game") pane = `<div class="feed">${evs.slice().reverse().slice(0, 120).map((e) => `<div><span class="h">${castHalfName(e.h)}</span>${esc(e.t)}${e.p.scored ? ` <span class="sc">+${e.p.scored}</span>` : e.p.k === "hr" ? ' <span class="sc">+1</span>' : ""}</div>`).join("") || '<div class="muted">The first pitch is on its way.</div>'}</div>`;
    else if (tab === "score") { const sc = evs.filter((e) => e.p.scored || e.p.k === "hr"); pane = `<div class="feed">${sc.map((e) => `<div><span class="h">${castHalfName(e.h)}</span>${esc(e.t)}</div>`).join("") || '<div class="muted">No runs yet.</div>'}</div>`; }
    else {
      const sides = [[], []]; for (const e of C.ev) { const who = e.p.name || e.who; if (!who) continue; const s = e.h[0] === "B" ? 1 : 0; if (!sides[s].includes(who)) sides[s].push(who); }
      const tbl = (s, name) => `<h4>${esc(name)}</h4><table class="bat">${sides[s].map((w) => `<tr><td class="n">${esc(w)}</td><td>${(day[w] || []).map(pillOf).join("")}</td></tr>`).join("") || '<tr><td class="muted">Nobody up yet.</td></tr>'}</table>`;
      pane = `<div class="grid" style="grid-template-columns:1fr 1fr">${`<div>${tbl(0, A)}</div><div>${tbl(1, H)}</div>`}</div><div class="muted" style="margin-top:6px">Outs are credited from the moment you tuned in; plays from before then show only hits, walks and strikeouts.</div>`;
    }
    const plBtns = `<span class="cpl">${[["below", "⬇"], ["float", "🪟"], ["board", "🏟"], ["jumbo", "📺"]].map(([k, l]) => `<button type="button" data-cplace="${k}" class="${place === k ? "on" : ""}" title="${{ below: "Below the player", float: "Float beside it", board: "Under the scoreboard", jumbo: "Jumbotron: both sides of the scoreboard" }[k]}">${l}</button>`).join("")}</span>`;
    if (place === "jumbo") {
      // Left wing: the video board (big plays, crowd prompts) or who's up; right wing: the last few plays.
      const cur = C.batter ? `${C.batNum ? "#" + C.batNum + " " : ""}${esc(C.batter)} ${(day[C.batter] || []).map(pillOf).join("")}` : "";
      const J = C.jumbo && Date.now() < C.jumbo.until ? C.jumbo : null, n = Math.max(2, Math.floor((board.offsetHeight - 24) / 17));
      const left = J ? `<div class="jt-show jt-${J.k}">${esc(J.txt)}</div>`
        : `<div class="jt-bat">${C.final ? `<div class="jt-lbl">FINAL</div><b>${esc(A)} ${C.score[0]} · ${esc(H)} ${C.score[1]}</b>` : cur ? `<div class="jt-lbl">NOW BATTING</div><b>${cur}</b>` : `<div class="jt-lbl">📡 SMALLCAST</div><b>${esc(A)} at ${esc(H)}</b>`}<div class="jt-k">K: ${esc(A)} ${ks[1]} · ${esc(H)} ${ks[0]}${C.fast ? ` · ⚡${C.fast} mph` : ""}</div></div>`;
      el.innerHTML = `<div class="jt-wing jt-l">${left}</div><div></div><div class="jt-wing jt-r"><div class="jt-top"><span class="jt-lbl">PLAY BY PLAY</span>${plBtns}</div>${evs.slice(-n).reverse().map((e) => `<div class="jt-ev"><span>${castHalfName(e.h)}</span> ${esc(e.t)}${e.p.scored ? ` <em>+${e.p.scored}</em>` : e.p.k === "hr" ? " <em>+1</em>" : ""}</div>`).join("") || '<div class="jt-ev">First pitch coming up.</div>'}</div>`;
      return;
    }
    if (place === "board") {
      const last = evs[evs.length - 1], cur = C.batter ? `${C.batNum ? "#" + C.batNum + " " : ""}${esc(C.batter)} ${(day[C.batter] || []).map(pillOf).join("")}` : "";
      // What the board leaves out: who's up and how his day's gone, the last few plays, the strikeouts.
      const more = fold, recent = evs.slice(-(more ? 12 : 4)).reverse();
      el.innerHTML = `<div class="ob-top"><b>📡 SmallCast</b><span class="cpl">${plBtns.replace(/^<span class="cpl">|<\/span>$/g, "")}</span><button type="button" class="ob-more" data-cfold title="${more ? "Fewer plays" : "More plays"}">${more ? "▴" : "▾"}</button></div>` +
        (cur && !C.final ? `<div class="ob-bat">At bat: ${cur}</div>` : "") +
        `<div class="ob-log">${recent.map((e) => `<div><span>${castHalfName(e.h)}</span> ${esc(e.t)}${e.p.scored ? ` <em>+${e.p.scored}</em>` : e.p.k === "hr" ? " <em>+1</em>" : ""}</div>`).join("") || '<div class="muted">First pitch coming up.</div>'}</div>` +
        `<div class="ob-k">Strikeouts pitched: ${esc(A)} ${ks[1]} · ${esc(H)} ${ks[0]}${C.fast ? ` · fastest ${C.fast} mph` : ""}</div>`;
      return;
    }
    el.innerHTML = head + `<div class="body"><div class="grid"><div><div class="box">${ls}${situ}${staff}</div>${cin}</div><div class="box">${tabs}${pane}</div></div></div>`;
  }
localStorage.setItem("sbx-tt-place","jumbo");
addEv("T1","4 Lee strikes out"); castTick();
addEv("T1","9 Ray: base hit"); castTick();
document.getElementById("score-a").textContent="2"; addEv("T1","7 Jones: home run, 2 scored"); castTick();
addEv("T1","SS — ground out"); addEv("T1","— end of top 1 —"); document.getElementById("inning").textContent="▼ 1"; document.querySelector(".sb-msg").textContent="Now batting: #3 Kim, SS"; castTick();
document.getElementById("score-b").textContent="1"; addEv("B1","3 Kim: double, 1 scored"); castTick();
await new Promise(r=>setTimeout(r,300)); CAST.sig=""; castPaint(); window.__cp=castPaint;
document.querySelector(".stage-wrap").scrollIntoView(); window.__cast=CAST; return document.getElementById("sbx-cast").innerText.slice(0,900);
})()