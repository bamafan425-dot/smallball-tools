(async()=>{ clearInterval(window.__cxi); document.getElementById("sbx-cx")?.remove(); document.getElementById("sbx-cx-css")?.remove(); document.getElementById("sbx-kx")?.remove();
const esc=(s)=>String(s).replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));const on=()=>true;const bs_boxOpen=()=>{};
const getJSON=async(u)=>{const r=await fetch(u,{credentials:"include"}); return r.json();};
 const hide=document.createElement("style"); hide.textContent="#sbx-cast,#sbx-kk{display:none!important}"; document.head.appendChild(hide);
  // ───────── 📡 SmallCast: a game cast under the player when you watch a game ─────────
  // Everything it shows is read off the player as it plays (the scoreboard and the play-by-play), so it
  // never runs ahead of the picture: no spoilers. "Coming in" uses only games played before this one.
  const onWatch = () => location.pathname === "/training" && /[?&](watch|game)=\d+/.test(location.search);
  const CAST_FOLD = "sbx-tt2-fold", CAST_TAB = "sbx-tt2-tab", CAST_PLACE = "sbx-tt2-place", CAST_POS = "sbx-tt2-pos";
  const castPlace = () => { try { return localStorage.getItem(CAST_PLACE) || "jumbo"; } catch (_) { return "jumbo"; } };
  // The SmallCast mark: a ball sending out a signal, and the name in two colors.
  const CAST_MARK = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M23 6.5a12 12 0 0 1 0 19" fill="none" stroke="#ffc23d" stroke-width="2.4" stroke-linecap="round" opacity=".55"/><path d="M20 10a7.5 7.5 0 0 1 0 12" fill="none" stroke="#ffc23d" stroke-width="2.4" stroke-linecap="round"/><circle cx="11" cy="16" r="8" fill="#fff"/><path d="M6 10.5c2.2 3 2.2 8 0 11M16 10.5c-2.2 3-2.2 8 0 11" fill="none" stroke="#e11d48" stroke-width="1.4" stroke-dasharray="1.6 1.4"/></svg>';
  const castLogo = (cls) => `<span class="sc-logo ${cls || ""}">${CAST_MARK}<b>SMALL</b><i>CAST</i></span>`;
  let CAST = null;
  const castNew = (gid) => ({ gid, ev: [], keys: [], primed: false, half: {}, order: [], score: [0, 0], batter: "", prevBatter: "", batAt: 0, meta: null, coming: null, sig: "" });
  const castHalfKey = (inn) => { const m = /([▲▼])\s*(\d+)/.exec(inn || ""); return m ? (m[1] === "▲" ? "T" : "B") + m[2] : ""; };
  const castHalfName = (h) => { const m = /^([TB])(\d+)/.exec(h || ""); return m ? (m[1] === "T" ? "▲" : "▼") + m[2] : h || ""; };
  // One line of the play-by-play: who, what, and how many scored. Same reading as the 📻 Radio's.
  function castParse(raw) {
    const t = String(raw || "").replace(/^\*\s*(FIRST:)?\s*/i, "").trim(); let m;
    const nm = (s) => s.replace(/\*+/g, "").trim();
    if (/^—\s*end of/i.test(t)) return { k: "end" };
    if ((m = /^(?:(\d+)\s+)?([^:—]+?):\s*(.+?)(?:,\s*(\d+)\s+scored)?$/i.exec(t)) && !/—/.test(m[2])) {
      const w = m[3].toLowerCase();
      const k = /grand slam|home run|homer/.test(w) ? "hr" : /triple/.test(w) ? "3b" : /double play/.test(w) ? "dp" : /double/.test(w) ? "2b" : /base hit|single|bunt hit|infield hit/.test(w) ? "1b" : "other";
      if (k === "other" && /^(forced at|out at|thrown out|caught stealing|steals|picked off|advances|scores)/i.test(m[3])) return { k: "raw", scored: +(m[4] || 0) };   // a runner, not a batter
      return { k, num: +(m[1] || 0), name: nm(m[2]), what: m[3], scored: +(m[4] || 0) };
    }
    if ((m = /^(?:(\d+)\s+)?(.+?)\s+(strikes out|walks|called out|is hit by(?: a)? pitch|hit by pitch)(?:,\s*(\d+)\s+scored)?/i.exec(t))) {
      const w = m[3].toLowerCase();
      return { k: /strikes|called/.test(w) ? "k" : /walk/.test(w) ? "bb" : "hbp", look: /called/.test(w), num: +(m[1] || 0), name: nm(m[2]), scored: +(m[4] || 0) };
    }
    if ((m = /^(1B|2B|3B|SS|LF|CF|RF|P|C)\s+—\s+(.+)$/.exec(t))) return { k: "out", pos: m[1], how: m[2], scored: +((/(\d+)\s+scored/i.exec(m[2]) || [])[1] || 0) };
    return { k: "raw", scored: +((/(\d+)\s+scored/i.exec(t) || [])[1] || 0) };
  }
  const CAST_ABBR = { "1b": "1B", "2b": "2B", "3b": "3B", hr: "HR", k: "K", bb: "BB", hbp: "HBP", dp: "DP" };
  const castShort = (e) => CAST_ABBR[e.p.k] || (e.p.k === "out" ? (/fly/i.test(e.p.how) ? "F" : /line/i.test(e.p.how) ? "L" : /pop/i.test(e.p.how) ? "P" : /ground/i.test(e.p.how) ? "G" : "out") + e.p.pos : "out");
  function castTick() {
    if (!on("cast") || !onWatch()) { if (CAST) { document.getElementById("sbx-cx")?.remove(); document.getElementById("sbx-kx")?.remove(); CAST = null; } return; }
    const pl = document.getElementById("playlog"); if (!pl) return;
    const gid = Number(new URLSearchParams(location.search).get("watch") || new URLSearchParams(location.search).get("game") || 0);
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
    const bm = /Now batting:\s*#?(\d+)\s+(?:\d+\s+)?(.+?),\s*(1B|2B|3B|SS|LF|CF|RF|DH|P|C)(?![A-Z0-9])/.exec(tx(".sb-msg b") || tx(".sb-msg"));
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
  // 🅺 The K Korner: a card hung on the stadium for every strikeout by the home club's pitchers (a backwards K
  // for a called third strike), the way the fans do it. Under the scoreboard, or above it when SmallCast hangs there.
  function castKs(B, sw, place) {
    let el = document.getElementById("sbx-kx");
    const C = CAST, ks = C && on("kcards") && B ? C.ev.filter((e) => e.h[0] === "T" && e.p.k === "k") : [];
    if (!ks.length) { el?.remove(); return; }
    if (!el) { el = document.createElement("div"); el.id = "sbx-kx"; }
    if (el.parentNode !== sw) sw.appendChild(el);
    const sz = Math.max(12, Math.min(22, Math.round(B.h / 6))), shown = ks.slice(0, 15), wide = shown.length * (sz + 4) + (ks.length > 15 ? 30 : 0);
    const top = place === "board" ? B.y - sz * 1.45 - 8 : B.y + B.h + 6;
    const st = `left:${Math.round(Math.max(4, B.x + B.w / 2 - wide / 2))}px;top:${Math.round(Math.max(2, top))}px;--k:${sz}px`;
    if (el.dataset.st !== st) { el.dataset.st = st; el.style.cssText = st; }
    const sig = ks.map((e) => (e.p.look ? "L" : "K")).join("");
    if (el.dataset.sig === sig) return; el.dataset.sig = sig;
    el.title = `${ks.length} strikeout${ks.length === 1 ? "" : "s"} for the home pitchers`;
    el.innerHTML = shown.map((e, i) => `<i class="${e.p.look ? "lk" : ""}${i === shown.length - 1 && e.live ? " new" : ""}" style="--r:${(i * 37) % 7 - 3}deg">K</i>`).join("") + (ks.length > 15 ? `<b>+${ks.length - 15}</b>` : "");
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
    if (document.getElementById("sbx-cx-css")) return;
    const s = document.createElement("style"); s.id = "sbx-cx-css";
    s.textContent = `
#sbx-cx{margin:14px auto 28px;max-width:1200px;background:#0b1220;color:#e5e7eb;border:1px solid #1e293b;border-radius:16px;padding:12px 16px 14px;font:13px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.35)}
#sbx-cx .ch{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
#sbx-cx .ch .t{font-size:16px;font-weight:900;letter-spacing:.02em}
#sbx-cx .ch .t i{font-style:normal;color:#f87171;font-size:10px;font-weight:800;border:1px solid #f87171;border-radius:999px;padding:1px 6px;margin-left:6px;vertical-align:2px}
#sbx-cx .ch .sub{opacity:.65;flex:1;min-width:120px}
#sbx-cx .ch button{border:0;border-radius:999px;padding:6px 12px;background:#1e293b;color:#e5e7eb;font:700 12px system-ui,sans-serif;cursor:pointer}
#sbx-cx .ch button:hover{background:#334155}
#sbx-cx .tabs{display:flex;gap:4px;margin:10px 0 8px}
#sbx-cx .tabs button{border:0;border-radius:8px;padding:6px 12px;background:transparent;color:#94a3b8;font:800 12px system-ui,sans-serif;cursor:pointer}
#sbx-cx .tabs button.on{background:#1e293b;color:#fff}
#sbx-cx .grid{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:14px}
@media (max-width:820px){#sbx-cx .grid{grid-template-columns:1fr}}
#sbx-cx .box{background:#111a2e;border-radius:12px;padding:10px 12px}
#sbx-cx h4{margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8}
#sbx-cx table.ls{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}
#sbx-cx table.ls th,#sbx-cx table.ls td{padding:4px 5px;text-align:center;border-bottom:1px solid #1e293b}
#sbx-cx table.ls td:first-child,#sbx-cx table.ls th:first-child{text-align:left;max-width:170px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#sbx-cx table.ls .rhe{font-weight:900;color:#fde68a}
#sbx-cx table.ls .now{background:#1e3a5f;border-radius:4px}
#sbx-cx table.ls .est{opacity:.6}
#sbx-cx .situ{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-top:10px}
#sbx-cx .situ b{font-size:15px}
#sbx-cx .pill{display:inline-block;border-radius:999px;background:#1e293b;padding:2px 8px;margin:0 3px 3px 0;font-size:12px;font-weight:700}
#sbx-cx .pill.g{background:#14532d;color:#bbf7d0}#sbx-cx .pill.r{background:#4c1d1d;color:#fecaca}#sbx-cx .pill.y{background:#713f12;color:#fde68a}
#sbx-cx .feed{max-height:300px;overflow:auto}
#sbx-cx .feed div{padding:4px 0;border-bottom:1px solid #16213a}
#sbx-cx .feed .h{display:inline-block;min-width:34px;font-weight:800;color:#94a3b8}
#sbx-cx .feed .sc{color:#fde68a;font-weight:700}
#sbx-cx .muted{opacity:.6}
#sbx-cx table.bat{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}
#sbx-cx table.bat td{padding:3px 4px;border-bottom:1px solid #16213a;vertical-align:top}
#sbx-cx table.bat td.n{white-space:nowrap;font-weight:700}
#sbx-cx.fold .body{display:none}
.sc-logo{display:inline-flex;align-items:center;gap:3px;font:900 15px/1 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.06em;vertical-align:middle}
.sc-logo svg{width:1.45em;height:1.45em;margin-right:2px;filter:drop-shadow(0 0 4px rgba(255,194,61,.45))}
.sc-logo b{color:#fff;font-weight:900}.sc-logo i{font-style:normal;color:#ffc23d;font-weight:900}
.sc-logo.sm{font-size:11px}.sc-logo.big{font-size:clamp(16px,2.3vw,28px);text-shadow:0 0 12px rgba(255,194,61,.35)}
#sbx-cx.jumbo .jt-brand{display:flex;flex-direction:column;align-items:center;gap:4px;animation:jtIn .5s ease-out}
#sbx-cx.jumbo .jt-tag{font:800 9px system-ui,sans-serif;letter-spacing:.2em;color:#94a3b8}
#sbx-cx.jumbo .jt-top .sc-logo{margin-right:4px}
@keyframes jtIn{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}}
#sbx-kx{position:absolute;z-index:6;display:flex;gap:4px;pointer-events:auto}
#sbx-kx i{display:inline-flex;align-items:center;justify-content:center;width:var(--k);height:calc(var(--k)*1.45);background:#fff;color:#c1121f;font:900 calc(var(--k)*1.05)/1 Georgia,"Times New Roman",serif;font-style:normal;border-radius:2px;box-shadow:0 2px 4px rgba(0,0,0,.45);transform:rotate(var(--r));transform-origin:top center}
#sbx-kx i.lk{transform:rotate(var(--r)) scaleX(-1)}
#sbx-kx i.new{animation:kkHang .9s cubic-bezier(.3,1.6,.5,1)}
#sbx-kx i.lk.new{animation:kkHangL .9s cubic-bezier(.3,1.6,.5,1)}
#sbx-kx b{align-self:center;color:#fff;font:800 12px system-ui,sans-serif;text-shadow:0 1px 3px #000}
@keyframes kkHang{from{transform:translateY(-140%) rotate(-20deg);opacity:0}to{transform:rotate(var(--r));opacity:1}}
@keyframes kkHangL{from{transform:translateY(-140%) rotate(-20deg) scaleX(-1);opacity:0}to{transform:rotate(var(--r)) scaleX(-1);opacity:1}}
#sbx-cx .cpl{display:inline-flex;background:#111a2e;border-radius:999px;padding:2px}
#sbx-cx .cpl button{background:transparent;padding:5px 9px;font-size:11px;color:#94a3b8}
#sbx-cx .cpl button.on{background:#334155;color:#fff}
#sbx-cx.float{position:fixed;right:16px;top:90px;z-index:2147482990;width:400px;max-width:calc(100vw - 32px);max-height:calc(100vh - 110px);overflow:auto;margin:0;padding:10px 12px 12px;box-shadow:0 18px 50px rgba(0,0,0,.6)}
#sbx-cx.float .ch{cursor:move;user-select:none}
#sbx-cx.onboard{position:absolute;z-index:6;margin:0;padding:6px 9px 7px;max-width:none;opacity:.94;border-radius:8px;border:2px solid #2b3340;background:linear-gradient(#10161f,#070a10);box-shadow:0 4px 14px rgba(0,0,0,.55);font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;color:#f4f1e6;overflow:hidden}
#sbx-cx.onboard .ob-top{display:flex;align-items:center;gap:6px;margin-bottom:3px}
#sbx-cx.onboard .ob-top b{flex:1;color:#ffc23d;font:900 11px system-ui,sans-serif;letter-spacing:.04em}
#sbx-cx.onboard .cpl button{border:0;background:transparent;color:#94a3b8;padding:1px 4px;font-size:11px;cursor:pointer;border-radius:999px}
#sbx-cx.onboard .cpl button.on{background:#334155;color:#fff}
#sbx-cx.onboard table.ls th,#sbx-cx.onboard table.ls td{padding:1px 3px;font-size:11px;border-bottom:1px solid #1f2733}
#sbx-cx.onboard table.ls td:first-child{max-width:95px;color:#ffc23d}
#sbx-cx.onboard table.ls .rhe{color:#ffc23d}
#sbx-cx.onboard .ob-bat{margin:2px 0 3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#sbx-cx.onboard .ob-more{border:0;background:#1f2733;color:#e5e7eb;border-radius:999px;padding:0 7px;cursor:pointer;font-size:11px}
#sbx-cx.onboard .ob-log div{padding:1px 0;border-top:1px solid #1f2733;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#sbx-cx.onboard .ob-log div:first-child{color:#fff}
#sbx-cx.onboard .ob-log span{color:#94a3b8;display:inline-block;min-width:24px}
#sbx-cx.onboard .ob-log em{font-style:normal;color:#ffc23d;font-weight:700}
#sbx-cx.onboard .ob-k{margin-top:3px;opacity:.7}
#sbx-cx.jumbo{position:absolute;z-index:6;margin:0;padding:0;max-width:none;display:grid;gap:0;background:transparent;border:0;box-shadow:none;pointer-events:none;font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;color:#f4f1e6}
#sbx-cx.jumbo>div:empty{pointer-events:none}
#sbx-cx.jumbo.jt-one .jt-l{margin-right:4px}
#sbx-cx.jumbo .jt-wing.jt-l{padding-top:calc(5px + var(--pl,0px))}
#sbx-cx.jumbo .jt-wing.jt-r{padding-top:calc(5px + var(--pr,0px))}
#sbx-cx.jumbo .jt-wing{pointer-events:auto;overflow:hidden;background:linear-gradient(rgba(16,22,31,.78),rgba(7,10,16,.78));box-shadow:0 0 0 2px rgba(43,51,64,.9),0 4px 10px rgba(0,0,0,.4);padding:5px 9px}
#sbx-cx.jumbo .jt-l{border-radius:5px 0 0 5px;display:flex;align-items:center;justify-content:center;text-align:center}
#sbx-cx.jumbo .jt-r{border-radius:0 5px 5px 0}
#sbx-cx.jumbo .jt-lbl{color:#ffc23d;font:900 10px system-ui,sans-serif;letter-spacing:.12em}
#sbx-cx.jumbo .jt-bat{min-width:0;max-width:100%}
#sbx-cx.jumbo .jt-bat b{display:block;font-size:13px;margin:2px 0;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
#sbx-cx.jumbo .jt-k{opacity:.7;font-size:10px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical}
#sbx-cx.jumbo .jt-top{display:flex;align-items:center;gap:6px;margin-bottom:2px}
#sbx-cx.jumbo .jt-top .jt-lbl{flex:1}
#sbx-cx.jumbo .cpl{background:transparent}
#sbx-cx.jumbo .cpl button{border:0;background:transparent;color:#94a3b8;padding:0 3px;font-size:10px;cursor:pointer;border-radius:999px}
#sbx-cx.jumbo .cpl button.on{background:#334155;color:#fff}
#sbx-cx.jumbo .jt-ev{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:1px 0;border-top:1px solid rgba(255,255,255,.08)}
#sbx-cx.jumbo .jt-ev:nth-child(2){color:#fff}
#sbx-cx.jumbo .jt-ev span{color:#94a3b8;display:inline-block;min-width:24px}
#sbx-cx.jumbo .jt-ev em{font-style:normal;color:#ffc23d;font-weight:700}
#sbx-cx.jumbo .pill{padding:0 5px;font-size:10px;margin:0 2px 0 0}
#sbx-cx.jumbo .jt-show{font:900 clamp(14px,2.2vw,26px)/1.1 system-ui,sans-serif;letter-spacing:.04em;color:#fff;text-shadow:0 0 10px currentColor;animation:jtPulse .6s ease-in-out infinite alternate}
#sbx-cx.jumbo .jt-show.jt-hr{animation:jtRainbow 1s linear infinite, jtPulse .45s ease-in-out infinite alternate}
#sbx-cx.jumbo .jt-show.jt-k{color:#f87171}
#sbx-cx.jumbo .jt-show.jt-run,#sbx-cx.jumbo .jt-show.jt-dp{color:#fde68a}
#sbx-cx.jumbo .jt-show.jt-filler{color:#93c5fd;animation:jtScroll 4.5s linear}
@keyframes jtPulse{from{transform:scale(1)}to{transform:scale(1.08)}}
@keyframes jtRainbow{0%{color:#f87171}25%{color:#fde68a}50%{color:#86efac}75%{color:#93c5fd}100%{color:#f0abfc}}
@keyframes jtScroll{from{transform:translateX(60%)}to{transform:translateX(-60%)}}
#sbx-cx.onboard .pill{padding:0 5px;font-size:10px;margin:0 2px 0 0}
#sbx-cx.float .ch .sub{flex-basis:100%;order:5}
#sbx-cx.float .grid{grid-template-columns:1fr !important;gap:10px}
#sbx-cx.float .feed{max-height:220px}
#sbx-cx.float table.ls th,#sbx-cx.float table.ls td{padding:3px 3px;font-size:12px}
#sbx-cx.float table.ls td:first-child{max-width:110px}`;
    document.head.appendChild(s);
  }
  function castPaint() {
    const C = CAST; if (!C) return;
    const wrap = document.querySelector(".wrap"), main = wrap && wrap.querySelector(".main"); if (!main) return;
    castStyle();
    let el = document.getElementById("sbx-cx");
    if (!el) {
      el = document.createElement("div"); el.id = "sbx-cx";
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
    // Where the stadium board is, measured on screen against the whole picture (.stage-wrap), so it doesn't matter
    // what the board sits inside or whether the player is scaled.
    const board = document.querySelector(".stage-wrap .sb"), sw0 = board && board.closest(".stage-wrap");
    let B = null;
    if (board && sw0) {
      const br = board.getBoundingClientRect(), sr = sw0.getBoundingClientRect(), k = sw0.offsetWidth ? sr.width / sw0.offsetWidth : 1;
      if (br.width > 20) B = { x: (br.left - sr.left) / k, y: (br.top - sr.top) / k, w: br.width / k, h: br.height / k, W: sw0.clientWidth, H: sw0.clientHeight, pl: 0, pr: 0 };
      // SmallBall's own LIVE badge and "Share this game" button sit in the board's row at some parks: the wing
      // beside one starts below it, so neither covers the other.
      if (B) for (const id of ["live-badge", "rv-share", "replay-check"]) {
        const o = document.getElementById(id), r = o && o.getBoundingClientRect(); if (!r || r.width < 2 || r.height < 2) continue;
        const y0 = (r.top - sr.top) / k, y1 = (r.bottom - sr.top) / k, cx = (r.left + r.width / 2 - sr.left) / k;
        if (y0 >= B.y + B.h || y1 <= B.y) continue;
        if (cx < B.x) B.pl = Math.max(B.pl, y1 - B.y + 4); else if (cx > B.x + B.w) B.pr = Math.max(B.pr, y1 - B.y + 4);
      }
      if (B && getComputedStyle(sw0).position === "static") sw0.style.position = "relative";
    }
    const hasBoard = !!B;
    // the jumbotron needs room on both sides of the board; when the player's small, it hangs under the board instead
    // Wings go on both sides when there's room; a board near one edge of the park gets both wings on its open side.
    const roomL = hasBoard ? B.x - 12 : 0, roomR = hasBoard ? B.W - B.x - B.w - 12 : 0;
    const jl = roomL >= 110 && roomR >= 110 ? "both" : roomR >= 260 ? "right" : roomL >= 260 ? "left" : "";
    let place = castPlace(); if ((place === "board" || place === "jumbo") && !hasBoard) place = "float"; else if (place === "jumbo" && !jl) place = "board";
    el.classList.toggle("float", place === "float"); el.classList.toggle("onboard", place === "board"); el.classList.toggle("jumbo", place === "jumbo");
    if (place === "jumbo") {
      const sw = sw0; if (el.parentNode !== sw) sw.appendChild(el);
      const cols = jl === "both" ? `${Math.round(roomL)}px ${Math.round(B.w + 12)}px minmax(0,1fr)` : jl === "right" ? `${Math.round(B.x + B.w)}px minmax(0,.8fr) minmax(0,1fr)` : `minmax(0,.8fr) minmax(0,1fr) ${Math.round(B.W - B.x - 12)}px`;
      const st = `left:6px;right:6px;top:${Math.round(B.y)}px;height:${Math.round(B.h)}px;grid-template-columns:${cols};--pl:${Math.round(jl === "right" ? B.pr : B.pl)}px;--pr:${Math.round(jl === "left" ? B.pl : B.pr)}px`;
      el.dataset.jl = jl;
      if (el.dataset.bst !== st) { el.dataset.bst = st; el.style.cssText = st; }
    }
    else if (place === "board") {
      const sw = sw0;
      if (el.parentNode !== sw) sw.appendChild(el);
      const w = Math.max(B.w, 300), x = Math.max(0, Math.min(B.x - (w - B.w) / 2, B.W - w));
      const below = B.y + B.h + 6, roomBelow = B.H - below > 150;
      const st = `left:${Math.round(x)}px;width:${Math.round(w)}px;` + (roomBelow ? `top:${Math.round(below)}px` : `bottom:${Math.round(B.H - B.y + 6)}px`);
      if (el.dataset.bst !== st) { el.dataset.bst = st; el.style.cssText = st; }
    } else if (el.dataset.bst) { el.dataset.bst = ""; el.style.cssText = ""; }
    castKs(B, sw0, place);
    if (place === "board" || place === "jumbo") {} else if (place === "float") {
      if (el.parentNode !== document.body) { document.body.appendChild(el); let P = null; try { P = JSON.parse(localStorage.getItem(CAST_POS) || "null"); } catch (_) {} if (P && P.x < innerWidth - 120 && P.y < innerHeight - 60) { el.style.left = P.x + "px"; el.style.top = P.y + "px"; el.style.right = "auto"; } else { el.style.left = ""; el.style.top = ""; el.style.right = ""; } }
    } else {
      el.style.left = el.style.top = el.style.right = "";
      if (place === "above") { if (el.nextElementSibling !== main) main.insertAdjacentElement("beforebegin", el); }
      else if (el.previousElementSibling !== main) main.insertAdjacentElement("afterend", el);
    }
    let fold = false, tab = "game"; try { fold = localStorage.getItem(CAST_FOLD) === "1"; tab = localStorage.getItem(CAST_TAB) || "game"; } catch (_) {}
    const sig = [place, el.dataset.bst || "", C.jumbo ? C.jumbo.txt : "", place === "jumbo" && Math.floor(Date.now() / 1000) % 30 < 5, fold, tab, C.ev.length, C.score, C.inn, C.outs, C.count, C.batter, C.pitches, C.mph, C.errs, !!C.coming, !!C.meta, !!document.getElementById("sbx-radio-launch"), !!document.getElementById("tk-launch")].join("|");
    if (sig === C.sig) return; C.sig = sig;
    el.classList.toggle("fold", fold);
    const M = C.meta || {}, A = M.away || ((document.querySelector("#name-a") || {}).textContent || "Away").trim(), H = M.home || ((document.querySelector("#name-b") || {}).textContent || "Home").trim();
    const kind = { big: "BigLeague", pro: "ProLeague", exhibition: "Exhibition" }[M.kind] || "";
    const head = `<div class="ch"><span class="t">${castLogo()}${C.final ? "" : "<i>LIVE</i>"}</span><span class="sub">${esc(A)} at ${esc(H)}${kind ? " · " + kind : ""}</span>` +
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
      const J = C.jumbo && Date.now() < C.jumbo.until ? C.jumbo : null, n = Math.max(2, Math.floor((B.h - 24 - (el.dataset.jl === "left" ? B.pl : B.pr)) / 17));
      const brand = !J && Math.floor(Date.now() / 1000) % 30 < 5;   // every 30 seconds the video board shows the SmallCast card
      const left = J ? `<div class="jt-show jt-${J.k}">${esc(J.txt)}</div>` : brand ? `<div class="jt-brand">${castLogo("big")}<div class="jt-tag">EVERY PITCH · NO SPOILERS</div></div>`
        : `<div class="jt-bat">${C.final ? `<div class="jt-lbl">FINAL</div><b>${esc(A)} ${C.score[0]} · ${esc(H)} ${C.score[1]}</b>` : cur ? `<div class="jt-lbl">NOW BATTING</div><b>${cur}</b>` : `<div class="jt-lbl">📡 SMALLCAST</div><b>${esc(A)} at ${esc(H)}</b>`}<div class="jt-k">K: ${esc(A)} ${ks[1]} · ${esc(H)} ${ks[0]}${C.fast ? ` · ⚡${C.fast} mph` : ""}</div></div>`;
      const jl = el.dataset.jl || "both", wl = `<div class="jt-wing jt-l">${left}</div>`;
      el.innerHTML = (jl === "right" ? `<div></div>${wl}` : jl === "left" ? wl : `${wl}<div></div>`) + `<div class="jt-wing jt-r"><div class="jt-top">${castLogo("sm")}<span class="jt-lbl">PLAY BY PLAY</span>${plBtns}</div>${evs.slice(-n).reverse().map((e) => `<div class="jt-ev"><span>${castHalfName(e.h)}</span> ${esc(e.t)}${e.p.scored ? ` <em>+${e.p.scored}</em>` : e.p.k === "hr" ? " <em>+1</em>" : ""}</div>`).join("") || '<div class="jt-ev">First pitch coming up.</div>'}</div>` + (jl === "left" ? "<div></div>" : "");
      el.classList.toggle("jt-one", jl !== "both");
      return;
    }
    if (place === "board") {
      const last = evs[evs.length - 1], cur = C.batter ? `${C.batNum ? "#" + C.batNum + " " : ""}${esc(C.batter)} ${(day[C.batter] || []).map(pillOf).join("")}` : "";
      // What the board leaves out: who's up and how his day's gone, the last few plays, the strikeouts.
      const more = fold, recent = evs.slice(-(more ? 12 : 4)).reverse();
      el.innerHTML = `<div class="ob-top"><b>${castLogo("sm")}</b><span class="cpl">${plBtns.replace(/^<span class="cpl">|<\/span>$/g, "")}</span><button type="button" class="ob-more" data-cfold title="${more ? "Fewer plays" : "More plays"}">${more ? "▴" : "▾"}</button></div>` +
        (cur && !C.final ? `<div class="ob-bat">At bat: ${cur}</div>` : "") +
        `<div class="ob-log">${recent.map((e) => `<div><span>${castHalfName(e.h)}</span> ${esc(e.t)}${e.p.scored ? ` <em>+${e.p.scored}</em>` : e.p.k === "hr" ? " <em>+1</em>" : ""}</div>`).join("") || '<div class="muted">First pitch coming up.</div>'}</div>` +
        `<div class="ob-k">Strikeouts pitched: ${esc(A)} ${ks[1]} · ${esc(H)} ${ks[0]}${C.fast ? ` · fastest ${C.fast} mph` : ""}</div>`;
      return;
    }
    el.innerHTML = head + `<div class="body"><div class="grid"><div><div class="box">${ls}${situ}${staff}</div>${cin}</div><div class="box">${tabs}${pane}</div></div></div>`;
  }
window.__cxi=setInterval(()=>{try{castTick();}catch(e){console.log("cx",e);}},1000); castTick(); await new Promise(r=>setTimeout(r,1500)); const el=document.getElementById("sbx-cx"); return [el&&el.className, el&&el.style.cssText];
})()