// ==UserScript==
// @name         SmallBall Club Kit (iPad)
// @namespace    slipnsliders.smallball.ipad
// @version      1.36.2
// @description  The full SmallBall Club Kit for iPad Safari: dashboard, stadium records, season games, squad views, box scores, your Hold the Hill card, tournament cards and Rotate Bench. Read-only: it never plays, trains or saves for you. Updates itself.
// @match        https://play.smallball.com/*
// @run-at       document-idle
// @inject-into  page
// @grant        none
// @noframes
// @updateURL    https://raw.githubusercontent.com/slipnsliders/smallball-tools/main/downloads/SmallBall-Club-Kit-iPad.user.js
// @downloadURL  https://raw.githubusercontent.com/slipnsliders/smallball-tools/main/downloads/SmallBall-Club-Kit-iPad.user.js
// ==/UserScript==
// First built for rgbartley and The Usual Suspects (TUS). Round 'em up.
// SmallBall Club Kit: freeze records and stats until a game's report airs (⚙ → "Freeze records and stats…").
// Timed games: a game is simulated in a moment but airs for about 20 minutes, and SmallBall adds its result
// to the club's record and its players' career stats right away. With this on, while a game is still on the
// air its result is taken back out of what pages show: the club's W-L and runs, its players' career lines,
// and the BigLeague / Pro League tables. When the report airs, the real numbers come back.
// Runs twice: in SmallBall's own page (MAIN world), where it adjusts the site's own data as it arrives, and
// alongside the Club Kit, which uses the same code for its own cards. Read-only: nothing is sent anywhere.
(() => {
  if (window.__sbxFreeze) return;
  const MAIN = !(typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id);
  const STORE = "sbx-airing";
  const enabled = () => { try { return (JSON.parse(localStorage.getItem("sbx-features") || "{}") || {}).freeze === true; } catch (_) { return false; } };
  const origFetch = window.fetch.bind(window);
  const now = () => Date.now();
  const load = () => { try { return JSON.parse(localStorage.getItem(STORE) || "{}") || {}; } catch (_) { return {}; } };
  const save = (s) => { try { for (const k of Object.keys(s)) if (s[k].until && s[k].until < now() - 60e3) delete s[k]; localStorage.setItem(STORE, JSON.stringify(s)); } catch (_) {} };
  const pending = {};
  // What we need about one game: when it airs, who played, the score, and each player's line.
  async function info(gid) {
    // Careers aren't credited until later (box_credited false while airing): re-read such a game every 90
    // seconds while it airs, so if SmallBall credits it mid-air, the players' lines get taken back out too.
    const s = load(), c = s[gid]; if (c && (c.cr || !(c.until > now()) || now() - (c.at || 0) < 90e3)) return c;
    if (pending[gid]) return pending[gid];
    return (pending[gid] = (async () => {
      try {
        const r = await origFetch(`/games/${gid}`, { credentials: "include" }); if (!r.ok) return null;
        const g = await r.json();
        const it = { until: Date.parse(g.live_until || "") || 0, kind: g.kind, league: g.league_id == null ? 0 : g.league_id, hid: g.home_team_id, aid: g.away_team_id,
          hr: Number(g.home_runs) || 0, ar: Number(g.away_runs) || 0, cr: !!g.box_credited, p: (g.result && g.result.players) || {},
          at: now(), hp: (g.rosters && g.rosters.home && g.rosters.home.player_ids) || [], ap: (g.rosters && g.rosters.away && g.rosters.away.player_ids) || [] };
        const all = load(); all[gid] = it; save(all); return it;
      } catch (_) { return null; } finally { delete pending[gid]; }
    })());
  }
  const airing = (it) => it && it.until > now();
  const recent = (row) => { const t = Date.parse(row.first_pitch_at || row.finished_at || ""); return t && now() - t < 50 * 60e3; };
  // Is a game-list row still on the air? (Fetches its details once if it's recent.)
  async function rowAiring(row) { if (!recent(row)) return false; return airing(await info(row.game_id)); }
  // Take one airing game back out of a standings / record row for one club.
  function unRow(o, it, team) {
    if (!o || o.__sbxF || (it.kind !== "big" && it.kind !== "pro")) return;
    const home = team === it.hid, us = home ? it.hr : it.ar, them = home ? it.ar : it.hr;
    if (typeof o.played === "number") o.played = Math.max(0, o.played - 1);
    if (us > them && typeof o.wins === "number") o.wins = Math.max(0, o.wins - 1);
    if (us < them && typeof o.losses === "number") o.losses = Math.max(0, o.losses - 1);
    if (typeof o.runs_for === "number") o.runs_for -= us;
    if (typeof o.runs_against === "number") o.runs_against -= them;
    o.__sbxF = 1;
  }
  const MAP = { ab: "at_bats", h: "hits", hr: "home_runs", b2: "doubles", b3: "triples", bb: "walks", k: "strikeouts", rbi: "rbi", po: "putouts", a: "assists", e: "errors", dp: "double_plays", ip: "innings_pitched" };
  function unCareer(c, L) {
    if (!c || !L) return;
    for (const [k, f] of Object.entries(MAP)) if (typeof c[f] === "number" && L[k]) c[f] -= L[k];
    if (typeof c.singles === "number") c.singles -= Math.max(0, (L.h || 0) - (L.b2 || 0) - (L.b3 || 0) - (L.hr || 0));
    if (typeof c.games === "number") c.games = Math.max(0, c.games - 1);
    if (typeof c.batting_avg === "number" && typeof c.hits === "number" && typeof c.at_bats === "number") c.batting_avg = c.at_bats > 0 ? Math.round((c.hits / c.at_bats) * 1000) / 1000 : 0;
  }
  async function profile(p) {
    if (!p || !Array.isArray(p.games) || p.__sbxF) return p;
    const team = p.team_id;
    for (const row of p.games) {
      if (!(await rowAiring(row))) continue;
      const it = await info(row.game_id); if (!it) continue;
      const home = team === it.hid, us = home ? it.hr : it.ar, them = home ? it.ar : it.hr;
      for (const r of p.record || []) if ((r.league_id == null ? 0 : r.league_id) === it.league) { delete r.__sbxF; unRow(r, it, team); }
      if (it.kind === "big" || it.kind === "pro") {
        if (typeof p.career_games === "number") p.career_games = Math.max(0, p.career_games - 1);
        if (us > them && typeof p.career_wins === "number") p.career_wins = Math.max(0, p.career_wins - 1);
      }
      if (it.cr) for (const pl of p.roster || []) { const L = it.p[pl.player_id]; if (L && (home ? it.hp : it.ap).includes(pl.player_id)) unCareer(pl.career, L); }
    }
    for (const r of p.record || []) delete r.__sbxF;
    p.__sbxF = 1; return p;
  }
  // BigLeague and Pro League tables: take out every airing game we know about (from your clubs and the
  // club pages you've opened).
  function season(s) {
    if (!s || s.__sbxF) return s;
    const st = load();
    for (const it of Object.values(st)) {
      if (!airing(it)) continue;
      const rows = it.kind === "big" ? s.big || [] : it.kind === "pro" && s.pro ? s.pro[it.league] || s.pro[String(it.league)] || [] : [];
      for (const team of [it.hid, it.aid]) { const o = rows.find((x) => x.team_id === team); if (o) { delete o.__sbxF; unRow(o, it, team); delete o.__sbxF; } }
    }
    s.__sbxF = 1; return s;
  }
  async function apply(kind, d) { try { return kind === "profile" ? await profile(d) : kind === "season" ? season(d) : d; } catch (_) { return d; } }
  const kindOf = (path) => (/^\/teams\/\d+\/profile$/.test(path) ? "profile" : path === "/season" ? "season" : null);
  window.__sbxFreeze = { enabled, apply, kindOf, rowAiring, info, wraps: MAIN };
  if (!MAIN) return;
  // SmallBall's own page: adjust its data on the way in.
  window.fetch = async function (input, init) {
    const res = await origFetch(input, init);
    try {
      if (!enabled() || !res.ok) return res;
      const url = new URL(typeof input === "string" ? input : input.url, location.href);
      if (url.origin !== location.origin) return res;
      const kind = kindOf(url.pathname); if (!kind) return res;
      const out = await apply(kind, await res.clone().json());
      return new Response(JSON.stringify(out), { status: res.status, statusText: res.statusText, headers: res.headers });
    } catch (_) { return res; }
  };
})();
const SBX_TABLET = true;
// SmallBall Club Kit: quick club tabs, a readable club selector, club logos, a club dashboard, stadium records
// and a foldable games list.
// Read-only: it only reads your own clubs' pages and never plays, trains or saves anything.
(() => {
  "use strict";

  // Which clubs get tabs and dashboard cards. Empty means "your first four clubs";
  // pick your own with the ⚙ button next to the tabs.
  const DEFAULT_CLUBS = []; // e.g. [3249, 1008, 8897]; empty = your first four clubs
  let PICKED = [];
  const MAX_DEFAULT = 4;
  function clubList() {
    const sel = document.getElementById("who-team");
    const own = sel ? Array.from(sel.options).map((o) => Number(o.value)) : [];
    const byId = own.slice().sort((a, b) => a - b);
    const chosen = PICKED.filter((id) => own.includes(id));
    if (chosen.length) return chosen;
    const dflt = DEFAULT_CLUBS.filter((id) => own.includes(id));
    if (dflt.length) return dflt;
    return own.length ? byId.slice(0, MAX_DEFAULT) : PICKED;
  }

  // The game player's big view per park; a skin is stretched to this size, so painting at it keeps proportions true.
  const SKIN_SIZE = { 3: [671, 561], 4: [700, 600], 10: [800, 450], 11: [714, 600] };
  const PARKS = {
    2: "League field", 3: "Home field", 4: "Homerun stadium", 5: "World Park", 6: "Monster Park",
    7: "BrickYard", 8: "Alice's Park", 9: "Field of Dreams", 10: "Letterbox Park", 11: "Jurassic Park",
    12: "Ocean Park", 13: "Centennial Field"
  };
  // One colour per club star level (0–10), from wood and bronze up to fire and gold. Edit freely.
  const TIER_COLORS = ["#6b7280", "#a16207", "#cbd5e1", "#a3e635", "#16a34a", "#06b6d4", "#2563eb", "#8b5cf6", "#ec4899", "#dc2626", "#facc15"];
  const tierColor = (n) => TIER_COLORS[Math.max(0, Math.min(10, n | 0))];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let PRIVATE_PASSIVE = null; // set only in the private build
  // Features you can switch on and off from the ⚙ menu. Everything starts on.
  const FEATURES = [
    ["tabs", "Quick tabs"], ["selector", "Club selector: readable, recent first"], ["logos", "Club logos"],
    ["dash", "Club dashboard"], ["season", "Season clock"], ["tier", "Tier watch"], ["train", "Train times"],
    ["alert", "Tab title alert when ready to train"], ["parks", "Stadium records"], ["hillcard", "⛰️ Hold the Hill card (bottom right): your ladder spot, who you can charge, your Brawl Bucks"], ["achtidy", "Tidy the Achievements section: medals on your stadium cards, Country tour shows where you've played, Earned badges first"], ["games", "Season games views"],
    ["opps", "Most played opponents"], ["squadtp", "TP column in the squad"], ["squadview", "Squad: Skills / Stats views"], ["mood", "Mood faces"], ["pitching", "Pitching stats"], ["compare", "Compare two date ranges"], ["recap", "Training Effectiveness (your clubs)"], ["notes", "Team notes"], ["livebar", "Live games bar: stack, row or hide"], ["grades", "Player grade colors"],
    ["cd", "Game countdown: when each club can play again"], ["cdding", "Chime when a club can play again (off to start)"], ["cdhide", "Hide scores of games still on the air behind their countdown (click to reveal) (off to start)"],
    ["freeze", "Freeze records and stats until a game's report airs (off to start)"], ["skinbtn", "🏟 Skins button (stadium skins in their own window)"], ["radio", "📻 Radio button in the game player (Mack and Dewey call the game out loud)"], ["optimizer", "🧪 PlayerOptimizer III by Jon2s (AUTO-OPTIMIZE next to Save)"], ["rotate", "🔁 Rotate Bench for Passive Training (next to Save)"], ["builder", "🧩 Lineup Builder: drag-and-drop lineup and your own optimizer (above the lineup editor)"],
    ["box", "📰 Box scores after each game, with an alert when one's ready"], ["hill", "⛰️ Report to Hold the Hill button on BigLeague games"], ["charge", "🥊 Challenge links: shows which club you're playing as, with a one-click switch"], ["live", "🏆 Tournaments button, with a card for each tournament you're in (your match, deadline, Start button)"], ["boxding", "Chime when a box score is ready (off to start)"], ["boxnote", "Desktop notification when a box score is ready (off to start)"]
  ];
  let FEAT = {}; try { FEAT = JSON.parse(localStorage.getItem("sbx-features") || "{}"); } catch (_) {}
  // Phone edition: the big picture only. Club cards, quick tabs and a Play button; none of the box-score
  // tools, so it stays light on a phone and on the site.
  const MOBILE = typeof SBX_MOBILE !== "undefined" && !!SBX_MOBILE;
  const MOBILE_KEEP = ["hillcard", "achtidy", "charge", "live", "tabs", "selector", "logos", "dash", "season", "tier", "train", "alert", "livebar", "cd", "cdding", "cdhide", "freeze", "box", "boxding", "hill"];
  const OFF_TO_START = ["cdding", "cdhide", "freeze", "boxding", "boxnote"];   // the few features that start off
  // iPad edition (a Safari userscript): the full kit, minus what a userscript can't do there.
  const TABLET = typeof SBX_TABLET !== "undefined" && !!SBX_TABLET;
  const TABLET_OFF = ["skinbtn", "radio", "optimizer"];
  const on = (f) => (TABLET && TABLET_OFF.includes(f) ? false : MOBILE && !MOBILE_KEEP.includes(f) ? false : OFF_TO_START.includes(f) ? FEAT[f] === true : FEAT[f] !== false);
  if (MOBILE) document.documentElement.classList.add("sbx-m");
  // One switch for every tool: count good matches only (games between clubs with the same star rating).
  const GOOD_KEY = "sbx-good-only";
  const goodOnly = () => { try { return localStorage.getItem(GOOD_KEY) === "1"; } catch (_) { return false; } };
  const goodToggle = () => `<label class="sbx-good" title="Count only good matches (same star rating) in the dashboard, summaries, stadium records, Pitching and Compare"><input type="checkbox" ${goodOnly() ? "checked" : ""}> Good matches only</label>`;
  const keepGame = (g) => !goodOnly() || g.good_match === true;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  async function getJSON(url, raw) {
    const r = await fetch(url, { credentials: "include" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    let d = await r.json();
    const pm = /^\/teams\/(\d+)\/profile/.exec(url);
    if (pm && d && d.mine) { try { tpLog(Number(pm[1]), d); } catch (_) {} }
    if (!raw) d = await frozen(url, d);
    return d;
  }
  // Freeze (off to start, freeze.js): while a game is still on the air, the kit's own cards and views leave
  // it out, and club records and career lines read as they did before first pitch. The countdown and the
  // score hider read the raw lists (they need to see the airing game).
  const FZ = () => (typeof window.__sbxFreeze !== "undefined" ? window.__sbxFreeze : null);
  async function frozen(url, d) {
    const F = FZ(); if (!F || !on("freeze") || !d) return d;
    try {
      const path = url.split("?")[0];
      if (path === "/games/all" && Array.isArray(d.rows)) {
        const keep = []; for (const row of d.rows) if (!(await F.rowAiring(row))) keep.push(row);
        return Object.assign({}, d, { rows: keep });
      }
      const k = F.kindOf(path); if (k && !F.wraps) return await F.apply(k, d);
    } catch (_) {}
    return d;
  }

  // TP log, your own clubs only. The site doesn't record how much TP a training used, so every time
  // the kit reads one of your clubs it notes each man's TP. TP only refills between sessions (starters
  // fill in 48 hours, the bench in 24), so a drop below where the refill says he should be is TP spent.
  // Quick Trains don't move "last trained", but they do drain TP, so they're caught the same way.
  const TPLOG_KEY = "sbx-tplog-v1";
  const tpLogAll = () => { try { return JSON.parse(localStorage.getItem(TPLOG_KEY) || "{}"); } catch (_) { return {}; } };
  function tpManRates(d) {
    const roster = d.roster || [], max = (d.team_tp_max || 100 * roster.length) / Math.max(1, roster.length);
    const start = new Set((d.field_pos || []).map(Number)), R = {};
    roster.forEach((m, i) => { R[m.player_id] = max / ((start.has(m.slot ?? i) ? 48 : 24) * 36e5); });
    return { R, max };
  }
  function tpLog(team, d) {
    const now = Date.parse(d.server_time || "") || Date.now(), all = tpLogAll(), L = all[team] || { sessions: [] };
    const { R, max } = tpManRates(d), tp = {}, sk = {};
    for (const m of d.roster || []) {
      tp[m.player_id] = +m.tp || 0;
      sk[m.player_id] = [m.pitch_skill, m.catch_skill, m.pass_power, m.run_speed, m.swing_skill, m.swing_power, m.contact_odds].map((v) => Math.round(+v || 0));
    }
    const prev = L.snap;
    if (prev && now - prev.at > 6e4) {
      // Who sits below his refill line? A man drained to (near) zero tells us when: now minus TP over his rate.
      const spent = {}; let total = 0, at = 0, n = 0;
      for (const id of Object.keys(tp)) {
        const r = R[id], was = prev.tp[id]; if (!r || was == null) continue;
        const expect = Math.min(max, was + r * (now - prev.at));
        if (expect - tp[id] < 3) continue;
        const t = Math.max(prev.at, now - tp[id] / r);           // when he was drained, assuming he went to 0
        const before = Math.min(max, was + r * (t - prev.at));
        const s = Math.max(0, before - Math.max(0, tp[id] - r * (now - t)));
        spent[id] = Math.round(s); total += s; at += t; n++;
      }
      const rose = prev.sk ? Object.keys(sk).some((id) => prev.sk[id] && sk[id].some((v, i) => v - prev.sk[id][i] >= 4)) : false;
      if (n || rose) {
        const trained = d.trained && typeof d.trained === "object" ? d.trained : null;
        L.sessions.push({ at: n ? Math.round(at / n) : now, from: prev.at, to: now, spent, total: Math.round(total), trained, gapH: Math.round((now - prev.at) / 36e5), before: prev.sk || null, after: sk });
        L.sessions = L.sessions.slice(-40);
      }
    }
    L.snap = { at: now, tp, sk };
    // "Last trained" as seen at each read. The site's trainer moves it; a Quick Train doesn't. That's how
    // the kit tells the two apart (one reading every 20 minutes at most, plus every change, last 300).
    const lt = Date.parse(d.last_trained_at || 0) || 0, O = L.lto || (L.lto = []), lo = O[O.length - 1];
    if (!lo || lo[1] !== lt || now - lo[0] > 20 * 6e4) { O.push([now, lt]); if (O.length > 300) O.splice(0, O.length - 300); }
    // Club average of each skill over time, for the progress charts (one point every 3 hours at most,
    // plus one whenever skills change).
    const ids = Object.keys(sk), avg = SK.map((_, i) => ids.length ? Math.round(ids.reduce((a, id) => a + sk[id][i], 0) / ids.length * 10) / 10 : 0);
    // Each man's skills over the last week, for the Skill board's 24-hour change.
    const K = L.skh || (L.skh = []), lk = K[K.length - 1];
    if (!lk || now - lk.at > 3 * 36e5 || Object.keys(sk).some((id) => !lk.sk[id] || sk[id].some((v, i) => v !== lk.sk[id][i]))) K.push({ at: now, sk });
    while (K.length > 2 && K[1].at < now - 7 * 864e5) K.shift();
    if (K.length > 80) K.splice(0, K.length - 80);
    const H = L.hist || (L.hist = []), last = H[H.length - 1];
    if (!last || now - last.at > 3 * 36e5 || last.v.some((v, i) => Math.abs(v - avg[i]) >= 0.5)) { H.push({ at: now, v: avg }); if (H.length > 400) H.splice(0, H.length - 400); }
    all[team] = L;
    try { localStorage.setItem(TPLOG_KEY, JSON.stringify(all)); } catch (_) {}
  }

  // Club logos: uploaded on your own club page, scaled to one standard square, kept in the extension's storage.
  const LOGO_PX = 256;
  let LOGOS = {};
  let logoVer = 0;
  const hasChromeStorage = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  // Without extension storage (the userscript edition on phones), logos and club picks live in localStorage.
  const LS_STORE = "sbx-store";
  const lsGet = () => { try { return JSON.parse(localStorage.getItem(LS_STORE) || "{}"); } catch (_) { return {}; } };
  const lsSet = (o) => { try { localStorage.setItem(LS_STORE, JSON.stringify({ ...lsGet(), ...o })); } catch (_) {} };
  function loadLogos() {
    if (!hasChromeStorage) {
      const r = lsGet();
      LOGOS = r.sbxLogos || {};
      PICKED = Array.isArray(r.sbxClubs) ? r.sbxClubs.map(Number) : [];
      logoVer++; setTimeout(onLogosChanged, 0);
      return;
    }
    chrome.storage.local.get(["sbxLogos", "sbxClubs"], (r) => {
      LOGOS = (r && r.sbxLogos) || {};
      PICKED = (r && Array.isArray(r.sbxClubs)) ? r.sbxClubs.map(Number) : [];
      logoVer++; onLogosChanged();
    });
  }
  if (hasChromeStorage) {
    chrome.storage.onChanged.addListener((ch, area) => { if (area === "local" && ch.sbxLogos) { LOGOS = ch.sbxLogos.newValue || {}; logoVer++; onLogosChanged(); } });
  }
  function saveLogo(id, dataUrl) {
    const next = { ...LOGOS };
    if (dataUrl) next[id] = dataUrl; else delete next[id];
    if (hasChromeStorage) chrome.storage.local.set({ sbxLogos: next }); else lsSet({ sbxLogos: next });
    LOGOS = next; logoVer++; onLogosChanged();
  }
  const logoImg = (id, cls) => on("logos") && LOGOS[id] ? `<img class="sbx-logo ${cls}" src="${LOGOS[id]}" alt="" aria-hidden="true">` : "";
  // If a logo sits on a plain white (or near-white) background, make that background transparent.
  // Only pixels connected to the outer edge are cleared, so white inside the artwork stays.
  function clearEdgeBackground(g, n, x0, y0, w, h) {
    const im = g.getImageData(0, 0, n, n), d = im.data;
    const isBg = (i) => d[i + 3] > 0 && d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235;
    const seen = new Uint8Array(n * n), stack = [];
    let edge = 0, edgeWhite = 0;
    const x1 = Math.min(n - 1, x0 + w - 1), y1 = Math.min(n - 1, y0 + h - 1);
    const border = [];
    for (let x = x0; x <= x1; x++) border.push([x, y0], [x, y1]);
    for (let y = y0; y <= y1; y++) border.push([x0, y], [x1, y]);
    for (const [x, y] of border) {
      const p = y * n + x, i = p * 4;
      if (d[i + 3] === 0) continue;
      edge++;
      if (isBg(i)) { edgeWhite++; stack.push(p); }
    }
    if (!edge || edgeWhite / edge < 0.6) return; // the background isn't plain white: leave the image alone
    while (stack.length) {
      const p = stack.pop();
      if (seen[p]) continue;
      seen[p] = 1;
      const i = p * 4;
      if (!isBg(i)) continue;
      d[i + 3] = 0;
      const x = p % n, y = (p - x) / n;
      if (x > 0) stack.push(p - 1); if (x < n - 1) stack.push(p + 1);
      if (y > 0) stack.push(p - n); if (y < n - 1) stack.push(p + n);
    }
    // Soften the leftover light fringe along the cut edge.
    for (let p = 0; p < n * n; p++) {
      const i = p * 4;
      if (d[i + 3] === 0 || seen[p]) continue;
      const x = p % n, y = (p - x) / n;
      const nb = [p - 1, p + 1, p - n, p + n].filter((q, j) => (j === 0 ? x > 0 : j === 1 ? x < n - 1 : j === 2 ? y > 0 : y < n - 1));
      if (nb.some((q) => d[q * 4 + 3] === 0) && d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200) d[i + 3] = 90;
    }
    g.putImageData(im, 0, 0);
  }
  // Fit any image inside a transparent square, centred, without stretching it.
  function standardize(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = c.height = LOGO_PX;
        const g = c.getContext("2d");
        const pad = Math.round(LOGO_PX * 0.04), box = LOGO_PX - 2 * pad;
        const k = Math.min(box / img.naturalWidth, box / img.naturalHeight);
        const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
        g.imageSmoothingQuality = "high";
        const x0 = Math.round((LOGO_PX - w) / 2), y0 = Math.round((LOGO_PX - h) / 2);
        g.drawImage(img, x0, y0, w, h);
        clearEdgeBackground(g, LOGO_PX, x0, y0, w, h);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/png"));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("could not read that image")); };
      img.src = url;
    });
  }
  function onLogosChanged() {
    document.querySelectorAll("img.sbx-logo-head").forEach((el) => el.remove());
    const bar = document.getElementById("sbx-tabs"); if (bar) bar.dataset.key = "";
    dashState.at = 0;
    try { sessionStorage.removeItem("sbx-dash-cache"); } catch (_) {}
    if (document.getElementById("sbx-dash") && !document.getElementById("sbx-dash-wrap")?.classList.contains("collapsed")) buildDash(true);
    setTimeout(tick, 0);
  }

  // 1. Readable club selector: give dropdown lists the system's own background and text colours,
  //    which follow the page's light or dark theme, so the list is never white text on white.
  if (!document.getElementById("sbx-style")) {
    const st = document.createElement("style");
    st.id = "sbx-style";
    st.textContent = `
      .sbx-sel #who-team option, .sbx-sel #who-team optgroup, .sbx-sel select.sel option { background-color: Canvas; color: CanvasText; }
      #sbx-tabs { display: inline-flex; gap: 8px; margin: 6px 0 6px 10px; vertical-align: middle; flex-wrap: wrap; }
      /* The site's club row doesn't wrap, so let the tabs shrink and stack onto more rows instead of running off screen. */
      #who { min-width: 0; max-width: 100%; } #who #sbx-tabs { flex: 1 1 0; min-width: 0; }
      /* On a computer: three tabs to a row, the ⚙ to the right of them. */
      @media (min-width: 701px) {
        #who #sbx-tabs { display: grid; grid-template-columns: repeat(3, max-content) auto; justify-content: start; align-items: start; flex: 0 1 auto; }
        #who #sbx-tabs .gear { grid-column: 4; grid-row: 1; align-self: start; }
        #who #sbx-tabs button:not(.gear) { justify-content: space-between; }
      }
      #sbx-tabs button { font: inherit; font-size: 14px; font-weight: 800; padding: 8px 16px; border-radius: 999px; cursor: pointer;
        border: 2px solid rgba(127,127,127,.5); background: transparent; color: inherit; white-space: nowrap; line-height: 1.2; }
      #sbx-tabs button.gear { padding: 8px 12px; font-size: 15px; }
      #sbx-pick { position: fixed; z-index: 1000; padding: 12px 14px; border-radius: 10px; border: 1px solid rgba(127,127,127,.45);
        background: Canvas; color: CanvasText; font-size: 13px; box-shadow: 0 8px 24px rgba(0,0,0,.35); width: min(460px, calc(100vw - 16px)); box-sizing: border-box; }
      #sbx-pick label { display: block; padding: 3px 0; cursor: pointer; }
      #sbx-pick .muted { opacity: .65; font-size: 12px; margin-bottom: 6px; }
      #sbx-pick .btns { display: flex; gap: 8px; margin-top: 8px; }
      #sbx-pick .btns button { font: inherit; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 999px; border: 1px solid rgba(127,127,127,.45); background: transparent; color: inherit; cursor: pointer; }
      #sbx-pick .btns button[data-a="save"] { background: #1d4ed8; border-color: #1d4ed8; color: #fff; }
      #sbx-tabs button:hover { border-color: #1d4ed8; }
      #sbx-tabs button .id { font-size: 12px; font-weight: 700; opacity: .7; margin-left: 6px; font-variant-numeric: tabular-nums; }
      #sbx-tabs button[aria-pressed="true"] { background: #1d4ed8; border-color: #1d4ed8; color: #fff; }
      #sbx-tabs button[aria-pressed="true"] .id { opacity: .85; }
      #sbx-tabs button .mk { font-size: 11px; font-weight: 800; margin-left: 6px; opacity: .8; }
      #sbx-tabs button .mk.rd { color: #facc15; opacity: 1; } #sbx-tabs button .mk.wn { color: #f59e0b; opacity: 1; }
      #sbx-tabs button .mk.sbx-cd { opacity: 1; font-variant-numeric: tabular-nums; color: #fca5a5; font-weight: 800; }
      #sbx-tabs button .mk.sbx-cd.air { color: #93c5fd; } #sbx-tabs button .mk.sbx-cd.go { color: #4ade80; }
      .sbx-hid { font-size: 0 !important; } .sbx-hid > :not(.sbx-cdh) { display: none !important; }
      .sbx-cdh { font-size: 12.5px; display: inline-block; padding: 1px 8px; border-radius: 999px; background: rgba(239,68,68,.16); color: #fecaca; font-weight: 700; font-variant-numeric: tabular-nums; cursor: pointer; white-space: nowrap; }
      .sbx-cdh:hover { background: rgba(239,68,68,.3); }
      .sbx-cdc:empty { display: none; }
      .sbx-cdc { margin: 6px 0 2px; padding: 4px 9px; border-radius: 8px; font-size: 12.5px; font-variant-numeric: tabular-nums; background: rgba(96,165,250,.12); color: #bfdbfe; }
      .sbx-cdc.wait { background: rgba(239,68,68,.14); color: #fecaca; } .sbx-cdc.go { background: rgba(34,197,94,.15); color: #bbf7d0; }
      #sbx-tabs button.open { box-shadow: 0 0 0 2px #60a5fa inset; }
      #sbx-tabs button.open::after { content: "▾"; font-size: 10px; margin-left: 5px; opacity: .8; }
      :is(#sbx-dash, .sbx-tabbody) .card.sbx-min { display: none; }
      #sbx-dash-wrap.allmin { display: none; }
      #sbx-pick .linkish { font: inherit; font-size: 12.5px; font-weight: 700; background: transparent; border: 0; color: #60a5fa; cursor: pointer; padding: 0 2px; text-decoration: underline; }
      #sbx-skin-launch { position: fixed; left: 16px; bottom: 16px; z-index: 2147482999; display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 999px; border: 0; background: linear-gradient(135deg,#166534,#22c55e); color: #fff; font: 800 14px/1 system-ui, sans-serif; cursor: pointer; box-shadow: 0 6px 20px rgba(0,0,0,.35); }
      #sbx-skins { position: fixed; inset: 0; z-index: 2147483002; background: rgba(2,6,15,.72); display: grid; place-items: center; padding: 20px; }
      #sbx-skins .win { width: min(1040px, 100%); max-height: calc(100vh - 40px); overflow: auto; background: #0b1220; color: #e5e7eb; border: 1px solid #334155; border-radius: 16px; padding: 18px 20px 20px; font: 14px/1.45 system-ui, -apple-system, Segoe UI, sans-serif; box-shadow: 0 20px 60px rgba(0,0,0,.5); }
      #sbx-skins .hd { display: flex; align-items: center; justify-content: space-between; font-size: 19px; margin-bottom: 4px; }
      #sbx-skins .x { background: #1f2937; color: #fff; border: 0; border-radius: 999px; width: 34px; height: 34px; font-size: 15px; cursor: pointer; }
      #sbx-skins .muted { opacity: .75; margin: 4px 0 8px; } #sbx-skins a { color: #86efac; }
      #sbx-skins .skon { display: flex; gap: 8px; align-items: center; font-weight: 700; margin: 4px 0 14px; }
      #sbx-skins .skins { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
      #sbx-skins .skrow { display: grid; grid-template-columns: 1fr auto; gap: 4px 8px; align-items: center; background: #0f172a; border: 1px solid #1f2937; border-radius: 12px; padding: 8px; }
      #sbx-skins .thumb { grid-column: 1 / -1; aspect-ratio: 4 / 3; border-radius: 8px; overflow: hidden; background: repeating-linear-gradient(45deg, #111827 0 10px, #0b1220 10px 20px); display: grid; place-items: center; }
      #sbx-skins .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
      #sbx-skins .none { font-size: 12px; opacity: .55; }
      #sbx-skins .nm { font-weight: 800; } #sbx-skins .sz { font-size: 12px; opacity: .6; justify-self: end; }
      #sbx-skins .acts { grid-column: 1 / -1; display: flex; gap: 6px; }
      #sbx-skins .pick, #sbx-skins .acts button { font: inherit; font-size: 12.5px; font-weight: 700; padding: 5px 11px; border-radius: 8px; border: 1px solid #334155; background: #1e293b; color: #fff; cursor: pointer; white-space: nowrap; }
      #sbx-skins .skmsg { grid-column: 1 / -1; margin: 0; }
      html:not(.sbx-m) #sbx-dash { display: none; }
      #sbx-tabs.sbx-full { display: grid !important; grid-template-columns: repeat(3, minmax(0, 1fr)) auto; gap: 8px 10px; align-items: start;
        flex: 1 1 100%; width: 100%; box-sizing: border-box; margin: 8px 0 6px !important; }
      #sbx-tabs.sbx-full .gear { grid-column: 4; grid-row: 1; align-self: start; }
      #sbx-tabs.sbx-full .sbx-tabc > button { justify-content: center; }
      @media (max-width: 760px) { #sbx-tabs.sbx-full { grid-template-columns: repeat(2, minmax(0, 1fr)) auto; } #sbx-tabs.sbx-full .gear { grid-column: 3; } }
      #sbx-tabs .sbx-tabc { display: flex; flex-direction: column; align-items: stretch; min-width: 0; }
      #sbx-tabs .sbx-tabc > button { width: 100%; }
      #sbx-tabs .sbx-tabc.open > button { border-bottom-left-radius: 0; border-bottom-right-radius: 0; border-color: #60a5fa; box-shadow: none; }
      #sbx-tabs .sbx-tabc.open > button::after { content: "▴"; }
      #sbx-tabs .sbx-tabbody:empty { display: none; }
      #sbx-tabs .sbx-tabbody .card { width: 100%; box-sizing: border-box; margin-top: -1px; border-top-left-radius: 0; border-top-right-radius: 0; border-color: #60a5fa; text-align: left; font-weight: 400; white-space: normal; }
      #sbx-tabs .sbx-tabbody .card > h3 { display: none; }
      #sbx-lb-ctl { display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin: 4px 0 4px; font-size: 12px; }
      #sbx-lb-ctl .lbl { display: inline-flex; align-items: center; gap: 5px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; opacity: .75; }
      #sbx-lb-ctl i { width: 8px; height: 8px; border-radius: 50%; background: #ef4444; display: inline-block; }
      #sbx-lb-ctl .seg { display: inline-flex; border: 1px solid rgba(127,127,127,.4); border-radius: 999px; overflow: hidden; }
      #sbx-lb-ctl .seg button { font: inherit; font-weight: 700; padding: 3px 10px; background: transparent; color: inherit; border: 0; cursor: pointer; }
      #sbx-lb-ctl .seg button.on { background: #1d4ed8; color: #fff; }
      #sbx-lb-ctl .pill { font: inherit; font-weight: 800; display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 999px; border: 1px solid rgba(239,68,68,.6); background: rgba(239,68,68,.12); color: inherit; cursor: pointer; }
      #livebar.sbx-lb-hide { display: none !important; }
      #livebar.sbx-lb-row { flex-direction: row !important; flex-wrap: nowrap !important; overflow-x: auto; gap: 8px; scrollbar-width: thin; padding-bottom: 4px; }
      #livebar.sbx-lb-row .lb-row { flex: 0 0 auto !important; width: auto !important; max-width: 440px; gap: 8px; }
      #livebar.sbx-lb-row .lb-row .lb-game { white-space: nowrap; display: inline-flex; align-items: baseline; gap: 6px; min-width: 0; font-size: 15px; }
      #livebar.sbx-lb-row .lb-row .lb-game b { display: inline-block; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      #livebar.sbx-lb-row .lb-row .lb-sc { flex: 0 0 auto; }
      #livebar.sbx-lb-row .lb-row .lb-inn { font-size: 11px; white-space: nowrap; }
      #livebar.sbx-lb-row .lb-row .lb-go { display: none; }
      #sbx-dash { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 14px 0 18px; }
      @media (max-width: 980px) { #sbx-dash { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      :is(#sbx-dash, .sbx-tabbody) .card { position: relative; overflow: hidden; border: 1px solid rgba(127,127,127,.35); border-radius: 14px; padding: 16px 14px 12px; font-size: 13px;
        background:
          radial-gradient(120% 70% at 0% 0%, color-mix(in srgb, var(--tier, #1d4ed8) 22%, transparent), transparent 60%),
          repeating-linear-gradient(135deg, rgba(127,127,127,.07) 0 1px, transparent 1px 9px),
          linear-gradient(180deg, rgba(127,127,127,.06), transparent 40%);
        box-shadow: inset 0 1px 0 rgba(255,255,255,.06), 0 4px 14px rgba(0,0,0,.18); }
      :is(#sbx-dash, .sbx-tabbody) .card::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 5px;
        background: repeating-linear-gradient(90deg, #c8102e 0 7px, transparent 7px 12px), linear-gradient(90deg, rgba(200,16,46,.25), rgba(200,16,46,.25));
        background-size: 100% 2px, 100% 5px; background-repeat: no-repeat; background-position: 0 2px, 0 0; }
      :is(#sbx-dash, .sbx-tabbody) .card > * { position: relative; }
      :is(#sbx-dash, .sbx-tabbody) .stars { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 8px; margin: 4px 0 2px; }
      :is(#sbx-dash, .sbx-tabbody) .stars .srow { display: inline-flex; gap: 1px; font-size: 19px; line-height: 1; letter-spacing: 0; }
      :is(#sbx-dash, .sbx-tabbody) .stars .srow i { font-style: normal; color: rgba(127,127,127,.35); }
      :is(#sbx-dash, .sbx-tabbody) .stars .srow i.on { color: var(--tier, #f5b301); text-shadow: 0 0 7px color-mix(in srgb, var(--tier, #f5b301) 55%, transparent); }
      :is(#sbx-dash, .sbx-tabbody) .stars .num { font-size: 20px; font-weight: 900; color: var(--tier, #f5b301); font-variant-numeric: tabular-nums; }
      :is(#sbx-dash, .sbx-tabbody) .card { border-color: color-mix(in srgb, var(--tier, #7f7f7f) 45%, rgba(127,127,127,.35)); }
      :is(#sbx-dash, .sbx-tabbody) .stars .num small { font-size: 14px; margin-left: 1px; }
      :is(#sbx-dash, .sbx-tabbody) .stars .avg { font-size: 11px; opacity: .65; }
      h2 .sbx-seg { display: inline-flex; margin-left: 10px; vertical-align: middle; border: 1px solid rgba(127,127,127,.45); border-radius: 999px; overflow: hidden; }
      h2 .sbx-seg button { font: inherit; font-size: 12px; font-weight: 700; padding: 3px 11px; border: 0; background: transparent; color: inherit; cursor: pointer;
        text-transform: none; letter-spacing: 0; opacity: .7; }
      h2 .sbx-seg button + button { border-left: 1px solid rgba(127,127,127,.35); }
      h2 .sbx-seg button.on { background: #2563eb; color: #fff; opacity: 1; }
      .sbx-opps { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; width: 100%; padding-top: 8px; margin-top: 2px; border-top: 1px solid rgba(127,127,127,.2); }
      .sbx-opps .k { opacity: .65; margin-right: 4px; }
      .sbx-opps .op { text-decoration: none; color: inherit; display: inline-flex; gap: 6px; align-items: baseline; padding: 2px 9px; border-radius: 999px; background: rgba(127,127,127,.13); white-space: nowrap; }
      .sbx-opps .op .n { opacity: .65; font-size: 12px; }
      .sbx-opps .op .gm { color: #16a34a; font-size: 11px; }
      .sbx-gsum { display: flex; flex-wrap: wrap; gap: 6px 16px; align-items: center; padding: 10px 12px; margin: 4px 0 12px;
        border: 1px solid rgba(127,127,127,.3); border-radius: 10px; font-size: 13px; font-variant-numeric: tabular-nums; }
      .sbx-gsum .it .k { opacity: .65; margin-right: 6px; }
      .sbx-gsum.muted { opacity: .7; }
      .sbx-gsum .chips, .sbx-gsum .chips i { display: inline-flex; }
      .sbx-gsum .chips { gap: 3px; }
      .sbx-gsum .chips i { font-style: normal; font-size: 11px; font-weight: 800; width: 19px; height: 19px; border-radius: 5px; align-items: center; justify-content: center; }
      .sbx-gsum .chips i.w { background: rgba(22,163,74,.22); color: #16a34a; }
      .sbx-gsum .chips i.l { background: rgba(220,38,38,.18); color: #dc2626; }
      .sbx-gsum .chips i.t { background: rgba(127,127,127,.2); }
      .sbx-hide { display: none !important; }
      .sbx-suspects { position: relative; }
      .sbx-suspects::after { content: ""; position: absolute; pointer-events: none; left: 0; top: var(--sus-top, 0px); bottom: 0; width: var(--sus-w, 44px); mix-blend-mode: multiply; background-image: repeating-linear-gradient(180deg, transparent 0 calc(var(--sus-rh, 40px) / 4 - 1px), rgba(20,20,20,.55) calc(var(--sus-rh, 40px) / 4 - 1px) calc(var(--sus-rh, 40px) / 4)), repeating-linear-gradient(180deg, transparent 0 calc(var(--sus-rh, 40px) - 2px), rgba(0,0,0,.85) calc(var(--sus-rh, 40px) - 2px) var(--sus-rh, 40px)); }
      #sbx-sus { margin: 10px 0 14px; padding: 14px 16px; border-radius: 12px; color: #f4efe2; background: repeating-linear-gradient(0deg, rgba(255,255,255,.035) 0 1px, transparent 1px 4px), linear-gradient(135deg, #17130d, #2a2116 60%, #17130d); border: 1px solid rgba(250,204,21,.35); box-shadow: 0 6px 20px rgba(0,0,0,.35); font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
      #sbx-sus .sus-top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      #sbx-sus .sus-file { font: 800 11px/1 ui-monospace, monospace; letter-spacing: .18em; color: #facc15; text-transform: uppercase; }
      #sbx-sus .sus-q { flex: 1 1 360px; min-height: 2.6em; transition: opacity .6s; }
      #sbx-sus .sus-q q { display: block; font: italic 600 19px/1.3 Georgia, "Times New Roman", serif; quotes: "“" "”"; }
      #sbx-sus .sus-q small { display: block; margin-top: 4px; font-size: 12px; opacity: .7; letter-spacing: .05em; }
      #sbx-sus .sus-go { flex: none; border: 0; border-radius: 999px; padding: 9px 16px; font: 800 14px/1 system-ui, sans-serif; background: #facc15; color: #1b1300; cursor: pointer; box-shadow: 0 3px 10px rgba(250,204,21,.25); }
      #sbx-sus .sus-go:hover { filter: brightness(1.08); }
      #sbx-sus .sus-game { margin-top: 12px; border-top: 1px dashed rgba(250,204,21,.35); padding-top: 12px; }
      #sbx-sus .sus-help { font-size: 13px; opacity: .9; margin-bottom: 10px; }
      #sbx-sus .sus-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 8px; }
      #sbx-sus .sus-man { position: relative; border: 1px solid rgba(255,255,255,.18); border-radius: 10px; padding: 8px 4px 6px; text-align: center; cursor: pointer; color: inherit; font: inherit; background: repeating-linear-gradient(180deg, transparent 0 9px, rgba(0,0,0,.35) 9px 10px), #cfc8b4; color: #1b1300; transition: transform .15s; }
      #sbx-sus .sus-man:hover:not(:disabled) { transform: translateY(-3px); }
      #sbx-sus .sus-man:disabled { cursor: default; }
      #sbx-sus .sus-man b { position: absolute; top: 4px; left: 6px; font: 800 12px/1 ui-monospace, monospace; }
      #sbx-sus .sus-man img { width: 44px; height: 52px; object-fit: contain; display: block; margin: 0 auto 4px; }
      #sbx-sus .sus-man span { display: block; font-size: 12px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      #sbx-sus .sus-man em { display: block; font-size: 10px; font-style: normal; opacity: .7; }
      #sbx-sus .sus-man.is-soze { outline: 3px solid #ef4444; background: repeating-linear-gradient(180deg, transparent 0 9px, rgba(0,0,0,.35) 9px 10px), #fca5a5; }
      #sbx-sus .sus-man.is-pick { box-shadow: 0 0 0 3px #facc15; }
      #sbx-sus .sus-man.is-out { opacity: .4; }
      #sbx-sus .sus-res { margin-top: 12px; font-size: 15px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
      #sbx-sus .sus-res b { font-size: 17px; }
      .sbx-medal { margin-top: 6px; font-size: 12px; line-height: 1.35; opacity: .92; }
      .sbx-medal .bar { height: 4px; border-radius: 2px; background: rgba(127,127,127,.25); margin-top: 3px; overflow: hidden; }
      .sbx-medal .bar i { display: block; height: 100%; background: #e0a04a; }
      .sbx-tour { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; margin: 2px 0 10px; font-size: 13px; }
      .sbx-tour button { font: inherit; font-size: 12px; padding: 3px 10px; border-radius: 999px; border: 1px solid rgba(127,127,127,.45); background: transparent; color: inherit; cursor: pointer; }
      .sbx-movednote { font-size: 12px; opacity: .7; margin: 2px 0 12px; }
      .sbx-park-list { margin: 10px 0 14px; padding: 10px 12px; border: 1px solid rgba(127,127,127,.3); border-radius: 10px; font-size: 13px; }
      .sbx-park-list .hd { font-weight: 800; margin-bottom: 4px; }
      .sbx-park-list .ln { display: flex; justify-content: space-between; gap: 12px; padding: 3px 0; border-bottom: 1px solid rgba(127,127,127,.18); font-variant-numeric: tabular-nums; }
      .sbx-park-list .ln span { opacity: .85; }
      .sbx-prec { margin: 6px 0 8px; font-size: 12px; }
      .sbx-prec .big { display: flex; align-items: baseline; gap: 8px; font-size: 15px; font-variant-numeric: tabular-nums; }
      .sbx-prec .big span { opacity: .75; font-size: 13px; }
      .sbx-prec .muted, #sbx-prec-ctl .muted { opacity: .7; }
      .park.sbx-visited { opacity: .92; }
      .park.sbx-visited .pk-art { filter: grayscale(.55); }
      #sbx-prec-ctl { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin: 4px 0 10px; font-size: 13px; }
      :is(#sbx-dash, .sbx-tabbody) .tp { margin: 2px 0 8px; }
      :is(#sbx-dash, .sbx-tabbody) .tpbar { height: 10px; border-radius: 999px; background: rgba(127,127,127,.22); overflow: hidden; }
      :is(#sbx-dash, .sbx-tabbody) .tpbar div { height: 100%; border-radius: 999px; }
      :is(#sbx-dash, .sbx-tabbody) .tptxt.rate { opacity: .6; font-size: 11px; }
      :is(#sbx-dash, .sbx-tabbody) .tptxt.next { opacity: 1; color: #60a5fa; }
      :is(#sbx-dash, .sbx-tabbody) .tptxt { display: flex; justify-content: space-between; font-size: 12px; margin-top: 3px; opacity: .85; font-variant-numeric: tabular-nums; }
      #sbx-dash-wrap.collapsed #sbx-dash { display: none; }
      :is(#sbx-dash, .sbx-tabbody) .acts { display: flex; gap: 8px; margin-top: 10px; }
      :is(#sbx-dash, .sbx-tabbody) .acts .play, :is(#sbx-dash, .sbx-tabbody) .acts .trn { flex: 1; display: inline-flex; align-items: center; justify-content: center; min-height: 36px; border-radius: 10px; font: inherit; font-size: 13px; font-weight: 800; cursor: pointer; text-decoration: none; }
      :is(#sbx-dash, .sbx-tabbody) .acts .play { background: #16a34a; color: #fff; border: 0; }
      :is(#sbx-dash, .sbx-tabbody) .acts .bxb { flex: none; min-width: 44px; min-height: 36px; border-radius: 10px; background: transparent; color: inherit; border: 1px solid rgba(127,127,127,.45); cursor: pointer; font-size: 16px; }
      #sbx-box { position: fixed; inset: 0; z-index: 2147483002; background: rgba(2,6,15,.72); display: grid; place-items: center; padding: 16px; }
      #sbx-box .win { width: min(900px, 100%); max-height: calc(100vh - 32px); overflow: auto; background: #0b1220; color: #e5e7eb; border: 1px solid #334155; border-radius: 16px; padding: 16px 18px 18px; font: 13.5px/1.45 system-ui, -apple-system, Segoe UI, sans-serif; box-shadow: 0 20px 60px rgba(0,0,0,.5); }
      #sbx-box .hd { display: flex; align-items: center; gap: 10px; font-size: 18px; margin-bottom: 4px; } #sbx-box .hd b { flex: 1; }
      #sbx-box button { font: inherit; cursor: pointer; } #sbx-box .x { background: #1f2937; color: #fff; border: 0; border-radius: 999px; width: 34px; height: 34px; }
      #sbx-box .mini { background: #1e293b; color: #fff; border: 1px solid #334155; border-radius: 8px; padding: 5px 10px; font-weight: 700; font-size: 12.5px; }
      #sbx-box .sub { opacity: .7; margin: 0 0 12px; }
      #sbx-box table { border-collapse: collapse; width: 100%; margin: 0 0 14px; font-variant-numeric: tabular-nums; }
      #sbx-box th, #sbx-box td { padding: 4px 6px; text-align: center; border-bottom: 1px solid #1f2937; white-space: nowrap; }
      #sbx-box th { font-size: 11.5px; opacity: .65; font-weight: 700; } #sbx-box td.l, #sbx-box th.l { text-align: left; }
      #sbx-box .ls td.t { font-weight: 800; } #sbx-box .ls .rhe { font-weight: 800; background: rgba(148,163,184,.08); }
      #sbx-box h4 { margin: 10px 0 4px; font-size: 13px; text-transform: uppercase; letter-spacing: .06em; opacity: .8; }
      #sbx-box .wrap { overflow-x: auto; } #sbx-box ul { margin: 0; padding-left: 18px; }
      #sbx-box .row { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border: 1px solid #1f2937; border-radius: 10px; margin: 6px 0; background: #0f172a; }
      #sbx-box .row .t { flex: 1; font-weight: 700; } #sbx-box .row .m { font-size: 12px; opacity: .7; }
      #sbx-box .row.wait { opacity: .75; }
      .sbx-gid { font-size: 11.5px; opacity: .55; margin-right: 8px; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .sbx-bxcell { margin-left: 6px; } .sbx-bxl { cursor: pointer; white-space: nowrap; }
      #sbx-boxtoast { position: fixed; right: 16px; bottom: calc(16px + var(--sbx-live-h, 0px)); z-index: 2147483003; display: flex; flex-direction: column; gap: 8px; }
      #sbx-boxtoast button { display: flex; align-items: center; gap: 10px; max-width: 360px; text-align: left; padding: 12px 14px; border-radius: 12px; border: 1px solid #334155; background: #0b1220; color: #e5e7eb; font: 600 13.5px/1.35 system-ui, sans-serif; box-shadow: 0 10px 30px rgba(0,0,0,.45); cursor: pointer; }
      #sbx-boxtoast button b { color: #fde68a; }
      :is(#sbx-dash, .sbx-tabbody) .acts .trn { background: transparent; color: inherit; border: 1px solid rgba(127,127,127,.45); }
      html.sbx-m :is(#sbx-dash, .sbx-tabbody) .lite { display: none; }
      html.sbx-m :is(#sbx-dash, .sbx-tabbody) .acts .play, html.sbx-m :is(#sbx-dash, .sbx-tabbody) .acts .trn { min-height: 46px; font-size: 15px; }
      html.sbx-m :is(#sbx-dash, .sbx-tabbody) .card { padding: 14px; }
      #sbx-dash-head .tog { cursor: pointer; user-select: none; }
      :is(#sbx-dash, .sbx-tabbody) .card.on { cursor: pointer; }
      :is(#sbx-dash, .sbx-tabbody) h3 { margin: 0 0 2px; font-size: 16px; display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
      :is(#sbx-dash, .sbx-tabbody) h3 .id { font-size: 12px; opacity: .65; font-weight: 700; }
      :is(#sbx-dash, .sbx-tabbody) .sub { opacity: .7; font-size: 12px; margin-bottom: 8px; }
      :is(#sbx-dash, .sbx-tabbody) .badge { display: inline-block; font-size: 12px; font-weight: 800; padding: 2px 9px; border-radius: 999px; margin-bottom: 8px; }
      :is(#sbx-dash, .sbx-tabbody) .badge.ok { background: rgba(22,163,74,.18); color: #16a34a; }
      :is(#sbx-dash, .sbx-tabbody) .badge.no { background: rgba(220,38,38,.15); color: #dc2626; }
      :is(#sbx-dash, .sbx-tabbody) .badge.pas { background: rgba(124,58,237,.2); color: #a78bfa; margin-left: 4px; }
      :is(#sbx-dash, .sbx-tabbody) button.badge.pas { border: 0; font: inherit; font-size: 12px; font-weight: 800; cursor: pointer; }
      :is(#sbx-dash, .sbx-tabbody) button.badge.pas:hover { outline: 1px solid currentColor; }
      :is(#sbx-dash, .sbx-tabbody) .badge.pas.off { background: rgba(127,127,127,.18); color: inherit; opacity: .75; }
      .sbx-flash { outline: 3px solid #a78bfa; outline-offset: 6px; border-radius: 10px; animation: sbxFlash 1s ease-in-out 3; }
      @keyframes sbxFlash { 50% { outline-color: transparent; } }
      :is(#sbx-dash, .sbx-tabbody) .pnote { font-size: 11.5px; color: #a78bfa; margin: 2px 0 4px; line-height: 1.35; }
      :is(#sbx-dash, .sbx-tabbody) .row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid rgba(127,127,127,.18); font-variant-numeric: tabular-nums; }
      :is(#sbx-dash, .sbx-tabbody) .row span:first-child { opacity: .75; }
      :is(#sbx-dash, .sbx-tabbody) .chips { display: flex; gap: 3px; margin-top: 8px; flex-wrap: wrap; }
      :is(#sbx-dash, .sbx-tabbody) .chips i { font-style: normal; font-size: 11px; font-weight: 800; width: 20px; height: 20px; border-radius: 5px; display: inline-flex; align-items: center; justify-content: center; }
      :is(#sbx-dash, .sbx-tabbody) .chips i.w { background: rgba(22,163,74,.22); color: #16a34a; }
      :is(#sbx-dash, .sbx-tabbody) .chips i.l { background: rgba(220,38,38,.18); color: #dc2626; }
      :is(#sbx-dash, .sbx-tabbody) .chips i.t { background: rgba(127,127,127,.2); }
      #sbx-dash-head { display: flex; justify-content: space-between; align-items: baseline; margin-top: 10px; gap: 12px; }
      #sbx-dash-head .right { display: inline-flex; align-items: baseline; gap: 12px; }
      #sbx-season { font-size: 12px; opacity: .85; font-variant-numeric: tabular-nums; }
      #sbx-season .end { opacity: .65; }
      :is(#sbx-dash, .sbx-tabbody) .tier { font-size: 11px; opacity: .7; margin: 0 0 2px; }
      :is(#sbx-dash, .sbx-tabbody) .pwarn { font-size: 12px; font-weight: 700; color: #fbbf24; background: rgba(245,158,11,.14); border: 1px solid rgba(245,158,11,.45); border-radius: 8px; padding: 5px 8px; margin: 4px 0; line-height: 1.35; }
      :is(#sbx-dash, .sbx-tabbody) .tier.warn { opacity: 1; color: #f59e0b; font-weight: 700; }
      :is(#sbx-dash, .sbx-tabbody) .ready { color: #16a34a; font-weight: 800; }
      th.sbx-tpth { text-align: left; }
      .sbx-grade { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 20px; padding: 0 4px; margin-right: 6px;
        border-radius: 6px; font-size: 12px; font-weight: 900; color: #0b1120; background: var(--g); vertical-align: middle; }
      .sbx-grade small { font-size: 10px; margin-left: 1px; }
      table.squad.sbx-v-skills [data-sbxcol="stat"], table.squad.sbx-v-stats [data-sbxcol="skill"] { display: none; }
      .sbx-mood { white-space: nowrap; }
      #sbx-pitch, #sbx-cmp, #sbx-recap { margin: 6px 0 18px; }
      #sbx-gs-note { font-size: 12px; color: #16a34a; font-weight: 600; margin: 4px 2px 6px; }
      table.squad td[data-sbx-gs] { color: #16a34a; }
      #sbx-recap .sbx-muted { opacity: .65; font-size: 12px; margin: 6px 2px; }
      #sbx-recap .rc-card { border: 1px solid rgba(127,127,127,.3); border-radius: 14px; padding: 14px 16px; margin: 10px 0 14px; background: rgba(127,127,127,.06); }
      #sbx-recap .rc-card header { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 12px; font-size: 14px; margin-bottom: 6px; }
      #sbx-recap .rc-card .tag { background: #16a34a; color: #fff; font-weight: 800; font-size: 12px; padding: 3px 9px; border-radius: 999px; }
      #sbx-recap .rc-card .when { margin-left: auto; opacity: .65; font-size: 12px; }
      #sbx-recap svg.rc-bars { width: 100%; max-width: 720px; height: auto; display: block; margin: 6px 0; }
      #sbx-recap svg .lb { font-size: 12px; fill: currentColor; }
      #sbx-recap svg .vl { font-size: 11.5px; fill: currentColor; opacity: .8; font-variant-numeric: tabular-nums; }
      #sbx-recap svg .vl .g { fill: #16a34a; font-weight: 700; }
      #sbx-recap svg .track { fill: rgba(127,127,127,.15); }
      #sbx-recap svg .was, #sbx-recap .legend i.was { fill: #64748b; background: #64748b; }
      #sbx-recap svg .gain, #sbx-recap .legend i.gain { fill: #16a34a; background: #16a34a; }
      #sbx-recap svg .lost, #sbx-recap .legend i.lost { fill: #f59e0b; background: #f59e0b; opacity: .85; }
      #sbx-recap .legend { font-size: 11.5px; opacity: .75; display: flex; gap: 12px; align-items: center; margin: 2px 0 8px; }
      #sbx-recap .legend i { display: inline-block; width: 14px; height: 8px; border-radius: 4px; margin-right: 4px; }
      #sbx-recap .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; margin-top: 6px; }
      #sbx-recap .tile { border: 1px solid rgba(127,127,127,.25); border-radius: 10px; padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; font-variant-numeric: tabular-nums; }
      #sbx-recap .tile .k { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; opacity: .65; }
      #sbx-recap .tile .v { font-size: 16px; } #sbx-recap .tile .a { opacity: .55; }
      #sbx-recap .tile .d { font-size: 12px; font-weight: 700; }
      #sbx-recap .up { color: #16a34a; } #sbx-recap .down { color: #dc2626; }
      #sbx-notes { margin: 10px 0 14px; border: 1px solid rgba(127,127,127,.3); border-radius: 12px; padding: 8px 12px; background: rgba(127,127,127,.05); }
      #sbx-notes summary { cursor: pointer; font-weight: 800; font-size: 14px; }
      #sbx-notes .nt-n { background: #2563eb; color: #fff; border-radius: 999px; font-size: 11px; padding: 1px 7px; margin-left: 4px; }
      #sbx-notes .nt-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 8px 0; }
      #sbx-notes .nt-bar .sbx-muted { font-size: 12px; opacity: .65; }
      #sbx-notes .nt-bar button { font: inherit; font-size: 12.5px; font-weight: 700; padding: 4px 10px; border-radius: 8px; border: 1px solid rgba(127,127,127,.4); background: transparent; color: inherit; cursor: pointer; }
      #sbx-notes .nt-board { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
      #sbx-notes .sbx-note { background: var(--nc); color: #1f2937; border-radius: 10px; padding: 8px; box-shadow: 0 1px 3px rgba(0,0,0,.18); display: flex; flex-direction: column; }
      #sbx-notes textarea { width: 100%; box-sizing: border-box; border: 0; background: transparent; color: inherit; font: inherit; font-size: 13.5px; line-height: 1.4; resize: none; outline: none; min-height: 90px; }
      #sbx-notes .nt-foot { display: flex; gap: 4px; align-items: center; font-size: 11px; opacity: .75; }
      #sbx-notes .nt-at { margin-right: auto; }
      #sbx-notes .nt-foot button { border: 0; background: transparent; cursor: pointer; font-size: 12px; padding: 2px 4px; color: inherit; }
      #sbx-recap .sb-card { border: 1px solid rgba(127,127,127,.3); border-radius: 14px; padding: 12px 14px; margin: 10px 0 14px; background: rgba(127,127,127,.06); }
      #sbx-recap .sb-card h4 { margin: 0 0 8px; font-size: 14px; }
      #sbx-recap table.sb-grid { border-collapse: separate; border-spacing: 2px; font-variant-numeric: tabular-nums; font-size: 12.5px; }
      #sbx-recap .sb-grid th { text-align: right; padding: 2px 8px 2px 0; font-weight: 600; white-space: nowrap; }
      #sbx-recap .sb-grid thead th { text-align: center; font-size: 11px; opacity: .7; padding: 0 0 2px; }
      #sbx-recap .sb-grid td.sb-c { width: 52px; height: 24px; text-align: center; border-radius: 5px; }
      #sbx-recap .sb-grid sup { font-size: 9.5px; font-weight: 800; margin-left: 2px; vertical-align: 4px; }
      #sbx-recap .sb-grid sup.up, #sbx-recap .sb-card .up { color: #22c55e; } #sbx-recap .sb-grid sup.dn, #sbx-recap .sb-card .dn { color: #f59e0b; }
      #sbx-recap .sb-grid td.sb-c[style*="color:#fff"] sup.up { color: #bbf7d0; } #sbx-recap .sb-grid td.sb-c[style*="color:#fff"] sup.dn { color: #fde68a; }
      #sbx-recap .sb-grid td.sb-c.hit { outline: 2px solid #facc15; outline-offset: -2px; font-weight: 800; }
      #sbx-recap .sb-grid td.sb-pos { font-size: 11px; opacity: .65; padding-right: 6px; text-align: left; }
      #sbx-recap .sb-grid td.sb-tp { padding-left: 8px; font-size: 11.5px; opacity: .85; white-space: nowrap; }
      #sbx-recap .sb-tpbar { display: inline-block; width: 46px; height: 7px; border-radius: 4px; background: rgba(127,127,127,.2); margin-right: 6px; vertical-align: middle; overflow: hidden; }
      #sbx-recap .sb-tpbar i { display: block; height: 100%; background: #16a34a; }
      #sbx-recap .sb-grid tr.sb-avg td, #sbx-recap .sb-grid tr.sb-avg th { font-weight: 800; text-align: center; padding-top: 4px; border-top: 1px solid rgba(127,127,127,.3); }
      #sbx-recap .sb-grid tr.sb-avg th { text-align: right; }
      #sbx-recap .sb-key { display: flex; align-items: center; gap: 6px; font-size: 11px; opacity: .65; margin-top: 6px; }
      #sbx-recap .sb-key i { width: 120px; height: 8px; border-radius: 4px; background: linear-gradient(90deg, rgba(37,99,235,.08), rgba(37,99,235,.9)); }
      #sbx-recap .sp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
      #sbx-recap .sp-tile { border: 1px solid rgba(127,127,127,.25); border-radius: 10px; padding: 6px 10px; display: flex; flex-direction: column; gap: 2px; }
      #sbx-recap .sp-tile .k { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; opacity: .65; }
      #sbx-recap .sp-tile .v { font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; }
      #sbx-recap .sp-tile .v span { font-size: 12px; }
      #sbx-recap .sp-tile svg { width: 100%; height: 40px; }
      #sbx-recap .pz h4 .pz-on { background: #7c3aed; color: #fff; border-radius: 999px; padding: 1px 8px; font-size: 11px; }
      #sbx-recap .pz h4 .pz-off { border: 1px solid rgba(127,127,127,.5); border-radius: 999px; padding: 0 8px; font-size: 11px; opacity: .7; }
      #sbx-recap .pz-sum { font-size: 13.5px; margin: 2px 0 6px; }
      #sbx-recap .pz-gain { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 8px; } #sbx-recap .pz-gain span { border: 1px solid; border-radius: 999px; padding: 1px 9px; font-size: 12px; }
      #sbx-recap .pz-leg { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 11.5px; opacity: .8; margin: 4px 0 6px; } #sbx-recap .pz-leg i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 4px; vertical-align: -1px; }
      #sbx-recap table.pz-t { border-collapse: collapse; width: 100%; font-size: 12.5px; font-variant-numeric: tabular-nums; }
      #sbx-recap .pz-t th { text-align: left; font-size: 11px; opacity: .65; font-weight: 700; padding: 4px 6px; border-bottom: 1px solid rgba(127,127,127,.3); white-space: nowrap; }
      #sbx-recap .pz-t td { padding: 5px 6px; border-bottom: 1px solid rgba(127,127,127,.12); vertical-align: middle; }
      #sbx-recap .pz-t td.n { text-align: right; } #sbx-recap .pz-t td.w { white-space: nowrap; } #sbx-recap .pz-t .small { font-size: 11.5px; }
      #sbx-recap .pz-bar { display: flex; width: 180px; height: 12px; border-radius: 6px; overflow: hidden; gap: 1px; background: rgba(127,127,127,.15); }
      #sbx-recap .pz-bar i { display: block; height: 100%; }
      #sbx-recap h3.rc-title { font-size: 15px; margin: 4px 2px 2px; }
      #sbx-recap .rc-head { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; font-size: 14px; margin: 2px 0 8px; }
      #sbx-recap .pay { font-size: 12px; font-weight: 800; padding: 3px 9px; border-radius: 999px; border: 1px solid currentColor; }
      #sbx-recap .pay.yes { color: #16a34a; } #sbx-recap .pay.lean { color: #65a30d; } #sbx-recap .pay.no { color: #dc2626; } #sbx-recap .pay.early { opacity: .65; }
      #sbx-recap .fx-sec { border-top: 1px dashed rgba(127,127,127,.3); padding-top: 8px; margin-top: 8px; }
      #sbx-recap .fx-sec h4 { margin: 0 0 2px; font-size: 13px; } #sbx-recap .fx-sec h4 .g { color: #16a34a; }
      #sbx-recap .fx-why { font-size: 12.5px; margin: 4px 2px 6px; }
      #sbx-recap .fx { display: grid; gap: 4px; max-width: 780px; }
      #sbx-recap .fx-row { display: grid; grid-template-columns: minmax(150px, 1.4fr) minmax(130px, 1fr) 110px minmax(120px, auto); gap: 10px; align-items: center; font-size: 12.5px; font-variant-numeric: tabular-nums; padding: 3px 0; }
      #sbx-recap .fx-v .a { opacity: .6; }
      #sbx-recap .fx-m { position: relative; height: 8px; border-radius: 4px; background: rgba(127,127,127,.15); }
      #sbx-recap .fx-m .mid { position: absolute; left: 50%; top: -2px; width: 2px; height: 12px; background: rgba(127,127,127,.6); }
      #sbx-recap .fx-m .bar { position: absolute; top: 0; height: 8px; border-radius: 4px; background: #94a3b8; }
      #sbx-recap .fx-m .bar.up { background: #16a34a; } #sbx-recap .fx-m .bar.down { background: #dc2626; }
      #sbx-recap .fx-c { font-weight: 700; font-size: 12px; white-space: nowrap; }
      #sbx-recap .fx-c.yes { color: #16a34a; } #sbx-recap .fx-c.lean { color: #65a30d; } #sbx-recap .fx-c.no { color: #dc2626; } #sbx-recap .fx-c.leanno { color: #ea580c; }
      #sbx-recap .fx-c.flat, #sbx-recap .fx-c.early, #sbx-recap .fx-c.none { opacity: .6; }
      @media (max-width: 700px) { #sbx-recap .fx-row { grid-template-columns: 1fr auto; row-gap: 4px; padding: 5px 0; border-bottom: 1px solid rgba(127,127,127,.15); } }
      .sbx-good { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; margin-left: 10px; vertical-align: middle; cursor: pointer; text-transform: none; letter-spacing: 0; white-space: nowrap; }
      .sbx-good input { margin: 0; accent-color: #16a34a; }
      h2 .sbx-good { font-family: inherit; }
      .sbx-gsum .gonly { color: #16a34a; font-weight: 700; }
      #sbx-cmp .sbx-muted { opacity: .65; font-size: 12px; margin: 6px 2px; }
      #sbx-cmp .cmp-head { display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center; margin: 4px 0 10px; font-size: 13px; }
      #sbx-cmp select, #sbx-cmp input[type=date] { font: inherit; font-size: 13px; padding: 4px 6px; border-radius: 8px; border: 1px solid rgba(127,127,127,.45); background: Canvas; color: CanvasText; margin-left: 6px; }
      #sbx-cmp .cmp-sum { display: flex; flex-wrap: wrap; gap: 6px 22px; font-size: 13px; margin: 4px 2px 8px; }
      #sbx-cmp .cmp-ev { list-style: none; margin: 0 0 10px; padding: 8px 12px; border-radius: 10px; background: rgba(22,163,74,.1); font-size: 13px; }
      #sbx-cmp .cmp-ev li { margin: 2px 0; }
      #sbx-cmp table.cmp { margin-bottom: 12px; }
      #sbx-cmp table.cmp td .a { opacity: .55; }
      #sbx-cmp table.cmp td .arr { opacity: .4; margin: 0 4px; }
      #sbx-cmp table.cmp td .dl { margin-left: 6px; font-size: 11px; font-weight: 700; opacity: .8; }
      #sbx-cmp .up { color: #16a34a; } #sbx-cmp .down { color: #dc2626; }
      #sbx-cmp td.sk { text-align: left; font-size: 12px; } #sbx-cmp td.sk span { margin-right: 6px; font-weight: 700; }
      #sbx-pitch .sbx-muted { opacity: .65; font-size: 12px; margin: 6px 2px; }
      #sbx-pitch .sbx-pitch-scroll { overflow-x: auto; }
      table.sbx-ptab { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
      table.sbx-ptab th { text-align: right; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; opacity: .7; padding: 8px 10px; border-bottom: 1px solid rgba(127,127,127,.3); white-space: nowrap; cursor: help; }
      table.sbx-ptab td { text-align: right; padding: 8px 10px; border-bottom: 1px solid rgba(127,127,127,.15); white-space: nowrap; }
      table.sbx-ptab th:first-child, table.sbx-ptab td:first-child { text-align: left; }
      #sbx-pick .prow { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      #sbx-pick .prow .num { display: inline-block; min-width: 18px; text-align: center; border-radius: 6px; background: #2563eb; color: #fff; font-size: 11px; padding: 0 4px; }
      #sbx-pick .prow .mv { display: inline-flex; gap: 4px; }
      #sbx-pick .prow .mv button { font: inherit; font-size: 10px; line-height: 1; padding: 3px 6px; border-radius: 6px; border: 1px solid rgba(127,127,127,.45); background: transparent; color: inherit; cursor: pointer; }
      #sbx-pick .prow .mv button:disabled { opacity: .3; cursor: default; }
      #sbx-pick .sec { margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(127,127,127,.3); }
      #sbx-pick .feats { display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px; }
      /* Phones */
      @media (max-width: 700px) {
        #sbx-tabs { display: flex; flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; margin: 6px 0; padding-bottom: 4px; max-width: 100%; scrollbar-width: none; }
        #sbx-tabs::-webkit-scrollbar { display: none; }
        #sbx-tabs button { flex: 0 0 auto; padding: 8px 12px; }
        #sbx-dash { grid-template-columns: 1fr; gap: 10px; }
        #sbx-dash-head { flex-wrap: wrap; row-gap: 4px; }
        #sbx-dash-head .right { width: 100%; justify-content: space-between; }
        #sbx-pick { left: 8px !important; right: 8px; width: auto; max-height: 80vh; }
        #sbx-pick .feats { grid-template-columns: 1fr; }
        #sbx-pick label { padding: 6px 0; }
        h2 .sbx-seg { display: flex; width: max-content; margin: 8px 0 0; }
        h2 .sbx-seg button { padding: 6px 14px; }
        .sbx-opps .op { font-size: 12px; }
        main table.squad, main .scroll { -webkit-overflow-scrolling: touch; }
        .scroll:has(table.squad) { overflow-x: auto; }
        td.sbx-tp { min-width: 74px; }
      }
      td.sbx-tp { min-width: 84px; font-size: 11px; white-space: nowrap; font-variant-numeric: tabular-nums; }
      .sbx-tpcell { display: flex; align-items: center; gap: 6px; }
      .sbx-tpcell .bar { width: 44px; height: 6px; border-radius: 3px; background: rgba(127,127,127,.25); overflow: hidden; display: inline-block; }
      .sbx-tpcell .bar i { display: block; height: 100%; background: #ca8a04; }
      .sbx-tpcell.full .bar i { background: #16a34a; }
      .sbx-tpcell .v { font-weight: 700; }
      .sbx-tpwhen { opacity: .7; margin-top: 2px; }
      .sbx-tpcell.full + .sbx-tpwhen { color: #16a34a; opacity: 1; font-weight: 800; }
      #sbx-dash-head b { font-size: 15px; }
      #sbx-dash-head button { font: inherit; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 999px; border: 1px solid rgba(127,127,127,.45); background: transparent; color: inherit; cursor: pointer; }
      img.sbx-logo { display: inline-block; object-fit: contain; vertical-align: middle; flex: none; }
      img.sbx-logo-tab { width: 22px; height: 22px; margin: -3px 7px -3px -4px; }
      img.sbx-logo-card { width: 40px; height: 40px; margin-right: 10px; }
      img.sbx-logo-head { width: 64px; height: 64px; margin-right: 14px; vertical-align: middle; }
      :is(#sbx-dash, .sbx-tabbody) h3 .nm { display: inline-flex; align-items: center; }
      #sbx-logo-ctl { display: inline-flex; gap: 6px; margin-left: 10px; vertical-align: middle; }
      #sbx-logo-ctl button { font: inherit; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; border: 1px solid rgba(127,127,127,.45); background: transparent; color: inherit; cursor: pointer; }
    `;
    document.head.appendChild(st);
  }

  // 2. Quick tabs next to the club selector. A tab switches clubs with the game's own selector.
  // Order the club dropdown with the clubs you picked most recently at the top.
  // (The game itself already remembers your current club between visits.)
  const MRU_KEY = "sbx-club-mru";
  const getMru = () => { try { return JSON.parse(localStorage.getItem(MRU_KEY) || "[]"); } catch (_) { return []; } };
  const bump = (id) => {
    if (!id) return;
    const list = [String(id), ...getMru().filter((x) => x !== String(id))].slice(0, 30);
    try { localStorage.setItem(MRU_KEY, JSON.stringify(list)); } catch (_) {}
  };
  function orderSelector(sel) {
    if (!sel.dataset.sbxHooked) {
      sel.dataset.sbxHooked = "1";
      sel.addEventListener("change", () => { bump(sel.value); setTimeout(() => orderSelector(sel), 0); });
    }
    let mru = getMru();
    if (!mru.length || mru[0] !== sel.value) { bump(sel.value); mru = getMru(); }
    const opts = Array.from(sel.options);
    const rank = (o) => { const i = mru.indexOf(o.value); return i < 0 ? 1000 + opts.indexOf(o) : i; };
    const want = opts.slice().sort((x, y) => rank(x) - rank(y));
    if (want.every((o, i) => o === opts[i])) return;
    const value = sel.value;
    want.forEach((o) => sel.appendChild(o));
    sel.value = value;
  }

  function mountTabs() {
    const sel = document.getElementById("who-team");
    if (!sel) return;
    if (on("selector")) { orderSelector(sel); document.documentElement.classList.add("sbx-sel"); }
    const chip = sel.closest(".clubchip") || sel.parentElement;
    let bar = document.getElementById("sbx-tabs");
    if (!bar) {
      bar = document.createElement("span");
      bar.id = "sbx-tabs";
      chip.insertAdjacentElement("afterend", bar);
    }
    // Computer: the tabs get their own full-width row under SmallBall's header line (club picker,
    // account links), so the site's own controls never squeeze them. The phone keeps them in the line.
    const full = !MOBILE && on("dash") && on("tabs");
    const who = sel.closest("#who") || document.getElementById("who");
    const home = full && who ? who : chip;
    if (home.nextElementSibling !== bar) home.insertAdjacentElement("afterend", bar);
    bar.classList.toggle("sbx-full", full && !!who);
    const opts = new Map(Array.from(sel.options).map((o) => [Number(o.value), o.textContent.replace(/\s*-XsT-\s*$/, "").trim()]));
    const want = clubList().filter((id) => opts.has(id));
    const marks = (id) => { const t = TABSTAT[id]; if (!t || MOBILE) return ""; return `${t.tier ? `<span class="mk">${t.tier}★</span>` : ""}${t.ready ? `<span class="mk rd" title="Ready to train">⚡</span>` : ""}${t.warn ? `<span class="mk wn" title="Open the card: a warning is up">⚠</span>` : ""}`; };
    const key = want.join(",") + "|" + sel.value + "|" + logoVer + "|" + PICKED.join(",") + "|" + want.map((id) => marks(id)).join(",");
    if (bar.dataset.key === key) return;
    bar.dataset.key = key;
    const attach = !MOBILE && on("dash");
    bar.innerHTML = !on("tabs") ? "" : want.map((id) => {
      const btn = `<button type="button" data-club="${id}" aria-pressed="${String(Number(sel.value) === id)}" title="${attach ? `${esc(opts.get(id))}: click to open or close its card, double-click for the full team page` : `Switch to ${esc(opts.get(id))} (${id})`}">${logoImg(id, "sbx-logo-tab")}${esc(opts.get(id))}<span class="id">${id}</span>${marks(id)}</button>`;
      // Computer: the tab is the card's header, and the card hangs off the bottom of it when open.
      return attach ? `<span class="sbx-tabc" data-club="${id}">${btn}<span class="sbx-tabbody"></span></span>` : btn;
    }).join("");
    bar.insertAdjacentHTML("beforeend", `<button type="button" class="gear" title="Club Kit settings: your clubs and which features are on">⚙</button>`);
    bar.querySelector(".gear").onclick = (e) => { e.stopPropagation(); togglePicker(sel, bar); };
    const goTeam = (id) => {
      if (sel.value !== id) { sel.value = id; sel.dispatchEvent(new Event("input", { bubbles: true })); sel.dispatchEvent(new Event("change", { bubbles: true })); }
      setTimeout(() => { location.hash = "#/team/" + id; }, sel.value === id ? 0 : 120);
    };
    bar.querySelectorAll("button[data-club]").forEach((b) => {
      if (MOBILE || !on("dash")) {
        // Phone (and dashboard off): a tab switches club, a second tap opens its page, as before.
        b.onclick = () => { const id = b.dataset.club; if (sel.value === id) { location.hash = "#/team/" + id; return; } sel.value = id; sel.dispatchEvent(new Event("input", { bubbles: true })); sel.dispatchEvent(new Event("change", { bubbles: true })); };
        return;
      }
      // Computer: a tab is the club's card, minimized. Click opens or closes the card; double-click goes to the team page.
      let t = 0;
      b.onclick = () => { clearTimeout(t); t = setTimeout(() => toggleCard(Number(b.dataset.club)), 230); };
      b.ondblclick = (e) => { e.preventDefault(); clearTimeout(t); goTeam(b.dataset.club); };
    });
    applyExp();
  }
  // Which cards are open. Every page starts with them all minimized (just the tabs); your clicks hold
  // until you move between Team pages and the rest of the site.
  let EXP = null, EXP_CTX = "";
  const expCtx = () => (/^#\/team\/\d+/.test(location.hash) ? "team" : "other");
  function expSet() {
    const ctx = expCtx();
    if (EXP === null || ctx !== EXP_CTX) { EXP_CTX = ctx; EXP = new Set(); }
    return EXP;
  }
  function toggleCard(id) { const s = expSet(); s.has(id) ? s.delete(id) : s.add(id); applyExp(); }
  function applyExp() {
    if (MOBILE || !on("dash")) return;
    const s = expSet(), wrap = document.getElementById("sbx-dash-wrap");
    for (const c of document.querySelectorAll("#sbx-tabs .sbx-tabc[data-club]")) {
      const id = Number(c.dataset.club), open = s.has(id), body = c.querySelector(".sbx-tabbody");
      c.classList.toggle("open", open); c.querySelector("button")?.classList.toggle("open", open);
      const html = open ? (dashState.cards && dashState.cards[id]) || `<div class="card"><div class="sub">Loading…</div></div>` : "";
      if (body && body.dataset.h !== html) { body.dataset.h = html; body.innerHTML = html; if (html) wireDash(body); }
    }
    if (!wrap) return;
    wrap.classList.toggle("allmin", s.size === 0);
    const arrow = wrap.querySelector(".arrow"); if (arrow) arrow.textContent = s.size ? "▾" : "▸";
  }


  // Live games bar (the site's own #livebar): keep it as the site stacks it, line the games up in one
  // row that scrolls sideways, or fold it away behind a "● N live" button. The choice is remembered.
  const LB_KEY = "sbx-livebar";
  function mountLiveCtl() {
    const bar = document.getElementById("livebar");
    let ctl = document.getElementById("sbx-lb-ctl");
    const n = bar ? bar.querySelectorAll(".lb-row").length : 0;
    if (!bar || !n) { ctl?.remove(); bar?.classList.remove("sbx-lb-row", "sbx-lb-hide"); return; }
    let mode = "stack"; try { mode = localStorage.getItem(LB_KEY) || (MOBILE ? "row" : "stack"); } catch (_) {}
    bar.classList.toggle("sbx-lb-row", mode === "row"); bar.classList.toggle("sbx-lb-hide", mode === "hide");
    if (!ctl || ctl.nextElementSibling !== bar) {
      ctl?.remove();
      ctl = document.createElement("div"); ctl.id = "sbx-lb-ctl";
      bar.insertAdjacentElement("beforebegin", ctl);
      ctl.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-lb]"); if (!b) return;
        try { localStorage.setItem(LB_KEY, b.dataset.lb); } catch (_) {}
        ctl.dataset.k = ""; mountLiveCtl();
      });
    }
    const k = mode + "|" + n;
    if (ctl.dataset.k === k) return;
    ctl.dataset.k = k;
    const seg = (v, label) => `<button type="button" data-lb="${v}" class="${mode === v ? "on" : ""}">${label}</button>`;
    ctl.innerHTML = mode === "hide"
      ? `<button type="button" data-lb="${MOBILE ? "row" : "stack"}" class="pill" title="Show the live games"><i></i>${n} live game${n === 1 ? "" : "s"} · show</button>`
      : `<span class="lbl"><i></i>Live</span><span class="seg">${seg("stack", "Stack")}${seg("row", "Row")}${seg("hide", "Hide")}</span>`;
  }

  // Stadium skins (computer editions): your own picture for a park in the game player. Stored in this
  // browser's storage for play.smallball.com, where the player page (skins.js) picks it up.
  const SKIN_KEY = "sbx-skins", SKIN_OFF = "sbx-skins-off";
  const skinsGet = () => { try { return JSON.parse(localStorage.getItem(SKIN_KEY) || "{}") || {}; } catch (_) { return {}; } };
  const skinsOn = () => { try { return localStorage.getItem(SKIN_OFF) !== "1"; } catch (_) { return true; } };
  function paintSkins(pop) {
    const box = pop.querySelector(".skins"); if (!box) return;
    const sk = skinsGet();
    const ids = Object.keys(PARKS).map(Number).filter((id) => id >= 2 && id <= 13);
    box.innerHTML = ids.map((id) => { const k = sk[id], [W, H] = SKIN_SIZE[id] || [800, 600];
      return `<div class="skrow"><div class="thumb">${k ? `<img src="${k.src}" alt="">` : `<span class="none">The site's own picture</span>`}</div><span class="nm">${esc(PARKS[id])}</span><span class="sz">${W}×${H}${k ? " · yours" : ""}</span>
        <span class="acts"><label class="pick">${k ? "Replace" : "Choose image"}<input type="file" accept="image/*" data-skin="${id}" hidden></label>${k ? `<button type="button" data-unskin="${id}">Remove</button>` : ""}</span></div>`; }).join("") +
      `<p class="muted skmsg"></p>`;
    const msg = (t) => { const m = box.querySelector(".skmsg"); if (m) m.textContent = t; };
    box.querySelectorAll("input[data-skin]").forEach((inp) => (inp.onchange = () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      const id = inp.dataset.skin, rd = new FileReader();
      rd.onload = () => {
        const img = new Image();
        img.onload = () => {
          // Fit to that park's own view size (most are 800×600), then keep it as a JPEG to stay small.
          const [W, H] = SKIN_SIZE[id] || [800, 600];
          const c = document.createElement("canvas"); c.width = W; c.height = H;
          c.getContext("2d").drawImage(img, 0, 0, W, H);
          const src = c.toDataURL("image/jpeg", 0.88);
          const all = skinsGet(); all[id] = { src, name: f.name, at: Date.now() };
          try { localStorage.setItem(SKIN_KEY, JSON.stringify(all)); paintSkins(pop); msg(`Saved for ${PARKS[id]}${img.width !== W || img.height !== H ? ` (resized from ${img.width}×${img.height} to ${W}×${H})` : ""}. Open a game at that park to see it.`); }
          catch (_) { msg("Couldn't save: the browser's storage for this site is full. Remove a skin and try again."); }
        };
        img.onerror = () => msg("That file didn't open as an image.");
        img.src = rd.result;
      };
      rd.readAsDataURL(f);
    }));
    box.querySelectorAll("button[data-unskin]").forEach((b) => (b.onclick = () => {
      const all = skinsGet(); delete all[b.dataset.unskin];
      try { localStorage.setItem(SKIN_KEY, JSON.stringify(all)); } catch (_) {}
      paintSkins(pop);
    }));
    const tog = pop.querySelector("input[data-skins-on]");
    if (tog) tog.onchange = () => { try { localStorage.setItem(SKIN_OFF, tog.checked ? "0" : "1"); } catch (_) {} };
  }

  // 🏟 Skins: stadium skins in their own window, opened from a launcher at the bottom left (stacked above
  // the Broadcast and Tournament Kit buttons when those are installed). Computer editions only.
  const STENCILS = "https://github.com/slipnsliders/smallball-tools/raw/main/downloads/SmallBall-Skin-Maker-Stencils.zip";
  function openSkins() {
    if (MOBILE) return;
    let ov = document.getElementById("sbx-skins"); if (ov) { ov.remove(); return; }
    ov = document.createElement("div"); ov.id = "sbx-skins";
    ov.innerHTML = `<div class="win" role="dialog" aria-label="Stadium skins">
      <div class="hd"><b>🏟 Stadium Skins</b><button type="button" class="x" aria-label="Close">✕</button></div>
      <p class="muted">Give any park your own picture in SmallBall's game player. Paint at the park's own size (shown on each card); the free <a href="${STENCILS}" target="_blank" rel="noopener">Skin Maker Stencil Pack</a> has a guide and a see-through overlay for every park. Skins stay in this browser only and show the next time a game opens.</p>
      <label class="skon"><input type="checkbox" data-skins-on ${skinsOn() ? "checked" : ""}> Show my skins in the game player</label>
      <div class="skins"></div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener("click", (e) => { if (e.target === ov || e.target.closest(".x")) ov.remove(); });
    paintSkins(ov);
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") document.getElementById("sbx-skins")?.remove(); });
  if (!MOBILE && on("skinbtn")) {
    const sb = document.createElement("button"); sb.id = "sbx-skin-launch"; sb.type = "button"; sb.textContent = "🏟 Skins"; sb.title = "Stadium skins: your own picture for each park";
    sb.onclick = () => openSkins();
    const place = () => { if (!sb.isConnected) document.body.appendChild(sb); const tops = ["tk-launch", "tt-launch"].map((id) => document.getElementById(id)).filter(Boolean).map((e) => e.getBoundingClientRect().top).filter((t) => t > 0); sb.style.bottom = (tops.length ? Math.round(window.innerHeight - Math.min(...tops) + 10) : 16) + "px"; };
    place(); setInterval(place, 2000);
  }

  // The ⚙ picker: tick the clubs you want; order follows the order you tick them in.
  function togglePicker(sel, bar) {
    let pop = document.getElementById("sbx-pick");
    if (pop) { pop.remove(); return; }
    const opts = Array.from(sel.options).map((o) => ({ id: Number(o.value), name: o.textContent.replace(/\s*-XsT-\s*$/, "").trim() }));
    const cur = clubList();
    const nameOf = {}; for (const o of opts) nameOf[o.id] = o.name;
    let order = cur.filter((id) => nameOf[id] != null);
    pop = document.createElement("div");
    pop.id = "sbx-pick";
    // Picked clubs on top, in the exact order the tabs and dashboard use, with arrows to move them.
    const clubsHtml = () => {
      const rest = opts.filter((o) => !order.includes(o.id)).sort((a, b) => a.name.localeCompare(b.name));
      return order.map((id, i) => `<div class="prow on"><label><input type="checkbox" value="${id}" checked> <b class="num">${i + 1}</b> ${esc(nameOf[id])} <span class="muted">${id}</span></label><span class="mv"><button type="button" data-up="${id}" ${i === 0 ? "disabled" : ""} title="Move up">▲</button><button type="button" data-down="${id}" ${i === order.length - 1 ? "disabled" : ""} title="Move down">▼</button></span></div>`).join("") +
        rest.map((o) => `<div class="prow"><label><input type="checkbox" value="${o.id}"> ${esc(o.name)} <span class="muted">${o.id}</span></label></div>`).join("");
    };
    pop.innerHTML = `<b>Your tabs and dashboard</b><div class="muted">Tick the clubs you want; the numbers are their order. Use the arrows to move one.</div><div class="plist">${clubsHtml()}</div>` +
      `<div class="sec"><b>Features</b><div class="muted">Untick anything you don't want. The page reloads when you save a change.</div><div class="feats">` +
      FEATURES.filter(([k]) => !MOBILE || MOBILE_KEEP.includes(k)).map(([k, label]) => `<label><input type="checkbox" data-f="${k}" ${on(k) ? "checked" : ""}> ${esc(label)}</label>`).join("") +
      `</div></div>` + (MOBILE ? "" : `<div class="sec"><b>Stadium skins</b><div class="muted">Skins have their own window now: the 🏟 Skins button at the bottom left of the page. <button type="button" class="linkish" data-a="skins">Open it</button></div></div>`) +
      `<div class="btns"><button type="button" data-a="save">Save</button><button type="button" data-a="reset">Use default</button></div>`;
    document.body.appendChild(pop);
    const gear = bar.querySelector(".gear").getBoundingClientRect();
    pop.style.top = Math.round(gear.bottom + 6) + "px";
    pop.style.left = Math.round(Math.max(8, Math.min(window.innerWidth - 480, gear.right - 460))) + "px";
    pop.style.maxHeight = Math.round(window.innerHeight - gear.bottom - 20) + "px"; pop.style.overflow = "auto";
    const closeOnOutside = (ev) => { if (!pop.contains(ev.target) && !ev.target.closest("#sbx-tabs .gear")) { pop.remove(); document.removeEventListener("mousedown", closeOnOutside, true); } };
    setTimeout(() => document.addEventListener("mousedown", closeOnOutside, true), 0);
    pop.querySelector('[data-a="skins"]')?.addEventListener("click", () => { pop.remove(); openSkins(); });
    const list = pop.querySelector(".plist");
    list.addEventListener("change", (ev) => {
      const c = ev.target.closest("input[value]"); if (!c) return;
      const id = Number(c.value);
      order = order.filter((x) => x !== id);
      if (c.checked) order.push(id);
      list.innerHTML = clubsHtml();
    });
    list.addEventListener("click", (ev) => {
      const b = ev.target.closest("button[data-up], button[data-down]"); if (!b) return;
      ev.preventDefault();
      const id = Number(b.dataset.up || b.dataset.down), i = order.indexOf(id), j = b.dataset.up ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= order.length) return;
      order.splice(i, 1); order.splice(j, 0, id);
      list.innerHTML = clubsHtml();
    });
    const done = (list) => {
      const next = {};
      pop.querySelectorAll("input[data-f]").forEach((c) => { if (!c.checked) next[c.dataset.f] = false; });
      const changed = JSON.stringify(next) !== JSON.stringify(Object.fromEntries(Object.entries(FEAT).filter(([, v]) => v === false)));
      if (changed) { try { localStorage.setItem("sbx-features", JSON.stringify(next)); } catch (_) {} }
      PICKED = list;
      if (hasChromeStorage) chrome.storage.local.set({ sbxClubs: list }); else lsSet({ sbxClubs: list });
      pop.remove();
      bar.dataset.key = "";
      dashState.at = 0; try { sessionStorage.removeItem("sbx-dash-cache"); } catch (_) {}
      document.getElementById("sbx-dash-wrap")?.remove();
      if (changed) { setTimeout(() => location.reload(), 50); return; }
      setTimeout(tick, 0);
    };
    pop.querySelector('[data-a="save"]').onclick = () => done(order);
    pop.querySelector('[data-a="reset"]').onclick = () => done([]);
  }

  // 4. Dashboard for your chosen clubs at the top of every page.
  const dashState = { at: 0, html: "", busy: false };
  async function seasonGames(team) {
    const rows = [];
    let next = null, pages = 0, season = 0;
    do {
      const qs = new URLSearchParams({ club: String(team) });
      if (next) qs.set("before", next);
      const d = await getJSON("/games/all?" + qs.toString());
      const mine = (d.rows || []).filter((g) => g.home_team_id === team || g.away_team_id === team);
      if (!season) season = mine.reduce((m, g) => Math.max(m, g.season_id || 0), 0);
      rows.push(...mine.filter((g) => g.season_id === season));
      next = mine.some((g) => g.season_id !== season) ? null : d.next;
      pages++;
      await sleep(100);
    } while (next && pages < 100);
    return rows;
  }

  // TP refill by design: a starter refills 100 TP in 48 hours, a bench man in 24.
  const NOMINAL = { s: 100 / 48, b: 100 / 24 };
  function tpRates() {
    try { localStorage.removeItem("sbx-tp-obs"); localStorage.removeItem("sbx-tp-rate"); } catch (_) {}
    return { s: { rate: NOMINAL.s }, b: { rate: NOMINAL.b } };
  }

  // Clock time h hours from now, rounded up to the quarter hour: "≈ today 9:45 PM", "≈ Tue 8:30 PM".
  function whenAt(h, short) {
    if (h <= 0.05) return "now";
    const d = new Date(Date.now() + h * 3600e3); d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
    const t = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const day0 = new Date(); day0.setHours(0, 0, 0, 0);
    const days = Math.floor((d - day0) / 864e5);
    const day = days === 0 ? (short ? "" : "today ") : days === 1 ? (short ? "tmrw " : "tomorrow ") : d.toLocaleDateString([], { weekday: "short" }) + " ";
    return (short ? "" : "≈ ") + day + t;
  }
  // Ready-to-train times per club, kept so the tab title can say when one is ready.
  const READY = {};
  try { Object.assign(READY, JSON.parse(sessionStorage.getItem("sbx-ready") || "{}")); } catch (_) {}
  // 📰 Box scores. SmallBall keeps every game's line score and each player's line but has no box score page.
  // Once a game's report airs (its live_until), the kit can show one: line score with R/H/E, both batting
  // orders, the pitchers, fielding and the highlights, plus a Discord-ready copy. Before the report airs it
  // only says when the box score will be ready, so nothing is spoiled. Your clubs are watched about every
  // 90 seconds (both games they started and games they were challenged in) and you get a toast, and if you
  // like a chime or a desktop notification, when a new one is ready. Opponents' names and game lines are
  // shown (they're public results); nobody's skill numbers are. Read-only.
  const bs_BOXK = "sbx-box-v1";
  let bs_BOXN = 0;
  const bs_boxSt = () => { try { return Object.assign({ alerted: {}, unread: {}, primed: {} }, JSON.parse(localStorage.getItem(bs_BOXK) || "{}")); } catch (_) { return { alerted: {}, unread: {}, primed: {} }; } };
  const bs_boxSave = (st) => { try { const ks = Object.keys(st.alerted).sort((a, b) => st.alerted[b] - st.alerted[a]); for (const k of ks.slice(200)) delete st.alerted[k]; localStorage.setItem(bs_BOXK, JSON.stringify(st)); } catch (_) {} };
  const bs_BOXG = {}, bs_BOXNAMES = {};
  async function bs_boxGame(gid) { if (bs_BOXG[gid] && bs_BOXG[gid].status === "final" && bs_BOXG[gid].__aired) return bs_BOXG[gid]; const g = await getJSON(`/games/${gid}`, true); g.__aired = Date.parse(g.live_until || "") <= srvNow(); return (bs_BOXG[gid] = g); }
  async function bs_boxNames(tid) {
    if (bs_BOXNAMES[tid] && Date.now() - bs_BOXNAMES[tid].at < 30 * 60e3) return bs_BOXNAMES[tid].n;
    const n = {}; try { const pr = await getJSON(`/teams/${tid}/profile`, true); for (const p of pr.roster || []) n[p.player_id] = p.name; } catch (_) {}
    bs_BOXNAMES[tid] = { at: Date.now(), n }; return n;
  }
  const bs_bname = (s) => String(s || "").replace(/\s*-?\*?[A-Z][A-Za-z]{1,4}\*?-?\s*$/, (m) => (/^\s*-/.test(m) ? "" : m)).trim();
  const bs_ipStr = (outs) => { const o = Math.round(Number(outs) || 0); return o >= 3 && o % 1 === 0 && o > 30 ? `${Math.floor(o / 3)}.${o % 3}` : String(o); };
  // Build the box score from the game record. ip in the game record is whole innings.
  async function bs_boxData(gid) {
    const g = await bs_boxGame(gid), R = g.result || {}, P = R.players || {};
    const sides = ["away", "home"].map((sd) => {
      const ro = g.rosters[sd], names = {}, tid = ro.team_id;
      return { sd, tid, name: bs_bname(g[sd + "_name"] || ro.name), code: ro.code || "", ro, names };
    });
    await Promise.all(sides.map(async (x) => { x.names = await bs_boxNames(x.tid); }));
    for (const x of sides) {
      const ids = x.ro.player_ids, order = Array.isArray(x.ro.order) && x.ro.order.length === ids.length ? x.ro.order : ids.map((_, i) => i);
      x.bat = order.map((ix, k) => { const pid = ids[ix], L = P[pid] || {}; return { n: k + 1, pid, pos: (x.ro.positions || [])[ix] || "", name: x.names[pid] || `#${pid}`, L }; });
      const tot = { ab: 0, h: 0, b2: 0, b3: 0, hr: 0, rbi: 0, bb: 0, k: 0, e: 0, po: 0, a: 0, dp: 0 };
      for (const b of x.bat) for (const k of Object.keys(tot)) tot[k] += Number(b.L[k]) || 0;
      x.tot = tot; x.runs = Number(g[x.sd + "_runs"]) || 0; x.line = (R.line && R.line[x.sd]) || [];
      x.err = R.errors && R.errors[x.sd] != null ? R.errors[x.sd] : tot.e;
      x.pitches = R.pitches && R.pitches[x.sd];
      x.pitcher = x.bat.find((b) => b.pos === "P") || null;
    }
    const [A, H] = sides;
    for (const [me, opp] of [[A, H], [H, A]]) if (me.pitcher) me.pitch = { name: me.pitcher.name, ip: me.pitcher.L.ip || 0, h: opp.tot.h, r: opp.runs, bb: opp.tot.bb, k: opp.tot.k, hr: opp.tot.hr, pc: me.pitches };
    const fast = R.fastest && R.fastest.mph ? { mph: R.fastest.mph, who: (R.fastest.team_id === A.tid ? A : H).names[R.fastest.player_id] || "" } : null;
    return { g, A, H, inn: Math.max(R.innings || 0, A.line.length, H.line.length, 9), hl: (R.highlights || []).slice(0, 12), fast, park: PARKS[g.park_id] || "", kind: g.kind };
  }
  const bs_KINDN = { big: "BigLeague", pro: "Pro League", exhibition: "Exhibition" };
  function bs_boxHTML(d) {
    const { A, H, inn } = d, cols = Array.from({ length: inn }, (_, i) => i + 1);
    const ln = (x) => `<tr><td class="l t">${esc(x.name)}</td>${cols.map((i) => `<td>${x.line[i - 1] != null ? x.line[i - 1] : x === H && i === inn && H.runs > A.runs && x.line.length < inn ? "x" : ""}</td>`).join("")}<td class="rhe">${x.runs}</td><td class="rhe">${x.tot.h}</td><td class="rhe">${x.err}</td></tr>`;
    const bat = (x) => `<h4>${esc(x.name)}</h4><div class="wrap"><table><tr><th>#</th><th class="l">Player</th><th>Pos</th><th>AB</th><th>H</th><th>2B</th><th>3B</th><th>HR</th><th>RBI</th><th>BB</th><th>K</th><th>PO</th><th>A</th><th>E</th></tr>${x.bat.map((b) => `<tr><td>${b.n}</td><td class="l">${esc(b.name)}</td><td>${esc(b.pos)}</td>${["ab", "h", "b2", "b3", "hr", "rbi", "bb", "k", "po", "a", "e"].map((k) => `<td>${Number(b.L[k]) || 0}</td>`).join("")}</tr>`).join("")}<tr><td></td><td class="l"><b>Totals</b></td><td></td>${["ab", "h", "b2", "b3", "hr", "rbi", "bb", "k", "po", "a", "e"].map((k) => `<td><b>${x.tot[k]}</b></td>`).join("")}</tr></table></div>`;
    const pit = [A, H].filter((x) => x.pitch).map((x) => `<tr><td class="l">${esc(x.pitch.name)} <span style="opacity:.6">(${esc(x.name)})</span></td><td>${x.pitch.ip}</td><td>${x.pitch.h}</td><td>${x.pitch.r}</td><td>${x.pitch.bb}</td><td>${x.pitch.k}</td><td>${x.pitch.hr}</td><td>${x.pitch.pc != null ? x.pitch.pc : "–"}</td></tr>`).join("");
    const dp = A.tot.dp + H.tot.dp;
    return `<div class="wrap"><table class="ls"><tr><th class="l"></th>${cols.map((i) => `<th>${i}</th>`).join("")}<th>R</th><th>H</th><th>E</th></tr>${ln(A)}${ln(H)}</table></div>
      ${bat(A)}${bat(H)}
      ${pit ? `<h4>Pitching</h4><div class="wrap"><table><tr><th class="l">Pitcher</th><th>IP</th><th>H</th><th>R</th><th>BB</th><th>K</th><th>HR</th><th>Pitches</th></tr>${pit}</table></div>` : ""}
      <p class="sub">${dp ? `Double plays: ${esc(A.name)} ${A.tot.dp}, ${esc(H.name)} ${H.tot.dp}. ` : ""}${d.fast ? `Fastest pitch: ${d.fast.mph} MPH${d.fast.who ? ` (${esc(d.fast.who)})` : ""}.` : ""}</p>
      ${d.hl.length ? `<h4>Highlights</h4><ul>${d.hl.map((h) => `<li>${esc(String(h).replace(/^([TB])(\d+)\s+/, (m, t, n) => `${t === "T" ? "Top" : "Bot"} ${n}: `))}</li>`).join("")}</ul>` : ""}`;
  }
  function bs_boxText(d) {
    const { A, H, inn } = d, pad = (v, w) => String(v).padStart(w), padE = (v, w) => String(v).padEnd(w);
    const nw = Math.min(22, Math.max(A.name.length, H.name.length));
    const ln = (x) => padE(x.name.slice(0, nw), nw) + " " + Array.from({ length: inn }, (_, i) => pad(x.line[i] != null ? x.line[i] : " ", 2)).join("") + "  " + pad(x.runs, 2) + pad(x.tot.h, 3) + pad(x.err, 3);
    const head = padE("", nw) + " " + Array.from({ length: inn }, (_, i) => pad(i + 1, 2)).join("") + "   R  H  E";
    const bat = (x) => [`${x.name}`, "   Player                AB  H HR RBI BB  K", ...x.bat.map((b) => `${pad(b.n, 2)} ${padE(b.name.slice(0, 20), 20)} ${pad(Number(b.L.ab) || 0, 3)}${pad(Number(b.L.h) || 0, 3)}${pad(Number(b.L.hr) || 0, 3)}${pad(Number(b.L.rbi) || 0, 4)}${pad(Number(b.L.bb) || 0, 3)}${pad(Number(b.L.k) || 0, 3)}`)].join("\n");
    const pit = [A, H].filter((x) => x.pitch).map((x) => `${x.pitch.name} (${x.name}): ${x.pitch.ip} IP, ${x.pitch.h} H, ${x.pitch.r} R, ${x.pitch.bb} BB, ${x.pitch.k} K${x.pitch.pc != null ? `, ${x.pitch.pc} pitches` : ""}`).join("\n");
    return "📰 " + `${A.name} ${A.runs}, ${H.name} ${H.runs}` + ` · ${bs_KINDN[d.kind] || d.kind}${d.park ? " · " + d.park : ""}\n` + "```\n" + head + "\n" + ln(A) + "\n" + ln(H) + "\n\n" + bat(A) + "\n\n" + bat(H) + (pit ? "\n\n" + pit : "") + "\n```";
  }
  function bs_boxWin(html) {
    let ov = document.getElementById("sbx-box"); if (!ov) { ov = document.createElement("div"); ov.id = "sbx-box"; document.body.appendChild(ov); ov.addEventListener("click", (e) => { if (e.target === ov || e.target.closest(".x")) ov.remove(); }); }
    ov.innerHTML = `<div class="win" role="dialog" aria-label="Box score">${html}</div>`; return ov;
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") document.getElementById("sbx-box")?.remove(); });
  async function bs_boxOpen(gid, back) {
    const st = bs_boxSt(); if (st.unread[gid]) { delete st.unread[gid]; bs_boxSave(st); bs_boxCount(); }
    const ov = bs_boxWin(`<div class="hd"><b>📰 Box score</b><button type="button" class="x" aria-label="Close">✕</button></div><p class="sub">Loading…</p>`);
    try {
      const g = await bs_boxGame(gid), until = Date.parse(g.live_until || "") || 0;
      if (until > srvNow()) { ov.querySelector(".sub").textContent = `Still on the air. The box score is ready at ${new Date(until - SKEW).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`; return; }
      const d = await bs_boxData(gid);
      bs_boxWin(`<div class="hd"><b>📰 ${esc(d.A.name)} ${d.A.runs}, ${esc(d.H.name)} ${d.H.runs}</b>${back ? `<button type="button" class="mini" data-boxback="${back}">← List</button>` : ""}<button type="button" class="mini" data-boxcopy="${gid}">Copy for Discord</button><button type="button" class="x" aria-label="Close">✕</button></div>
        <p class="sub">Final · ${esc(bs_KINDN[d.kind] || d.kind || "")}${d.park ? ` · ${esc(d.park)}` : ""} · ${new Date(d.g.finished_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · game ${gid}</p>${bs_boxHTML(d)}`);
    } catch (e) { const s = document.querySelector("#sbx-box .sub"); if (s) s.textContent = "Couldn't load that box score (" + e.message + ")."; }
  }
  async function bs_boxList(team) {
    const ov = bs_boxWin(`<div class="hd"><b>📰 Box scores</b><button type="button" class="x" aria-label="Close">✕</button></div><p class="sub">Loading…</p>`);
    try {
      const d = await getJSON(`/games/all?club=${team}`, true);
      const rows = (d.rows || []).filter((g) => g.home_team_id === team || g.away_team_id === team).slice(0, 15);
      const now = srvNow(), st = bs_boxSt();
      const items = [];
      for (const r of rows) {
        let until = CD_UNTIL[r.game_id];
        if (until == null) { if (now - Date.parse(r.finished_at) > 3600e3) until = 0; else { try { until = Date.parse((await bs_boxGame(r.game_id)).live_until || "") || 0; } catch (_) { until = 0; } } CD_UNTIL[r.game_id] = until; }
        const vs = r.home_team_id === team ? `vs ${bs_bname(r.away_name)}` : `at ${bs_bname(r.home_name)}`;
        const when = new Date(r.finished_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
        items.push(until > now
          ? `<div class="row wait"><span class="t">${esc(vs)}</span><span class="m">${esc(bs_KINDN[r.kind] || r.kind)} · on the air · box score at ${new Date(until - SKEW).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></div>`
          : `<div class="row"><span class="t">${st.unread[r.game_id] ? "🆕 " : ""}${esc(vs)}</span><span class="m">${esc(bs_KINDN[r.kind] || r.kind)} · ${esc(when)}</span><button type="button" class="mini" data-boxg="${r.game_id}" data-from="${team}">Box score</button></div>`);
      }
      const nm = bs_bname(((rows[0] || {}).home_team_id === team ? (rows[0] || {}).home_name : (rows[0] || {}).away_name) || "Club " + team);
      bs_boxWin(`<div class="hd"><b>📰 ${esc(nm)}: box scores</b><button type="button" class="x" aria-label="Close">✕</button></div><p class="sub">The last ${rows.length} games, newest first. Games still on the air unlock when their report airs. Scores only show inside each box score.</p>${items.join("") || `<p class="sub">No games yet.</p>`}`);
    } catch (e) { const s = document.querySelector("#sbx-box .sub"); if (s) s.textContent = "Couldn't load the games (" + e.message + ")."; }
  }
  document.addEventListener("click", async (e) => {
    const t = e.target.closest && e.target.closest("[data-boxg], [data-boxback], [data-boxcopy], [data-boxtoast]"); if (!t) return;
    if (t.dataset.boxg) bs_boxOpen(Number(t.dataset.boxg), Number(t.dataset.from) || 0);
    else if (t.dataset.boxback) bs_boxList(Number(t.dataset.boxback));
    else if (t.dataset.boxtoast) { t.remove(); bs_boxOpen(Number(t.dataset.boxtoast)); }
    else if (t.dataset.boxcopy) { try { await navigator.clipboard.writeText(bs_boxText(await bs_boxData(Number(t.dataset.boxcopy)))); t.textContent = "Copied"; setTimeout(() => { t.textContent = "Copy for Discord"; }, 1500); } catch (_) { t.textContent = "Couldn't copy"; } }
  });
  function bs_boxCount() { bs_BOXN = Object.keys(bs_boxSt().unread).length; paintTitle(); }
  function bs_boxToast(gid, label) {
    let w = document.getElementById("sbx-boxtoast"); if (!w) { w = document.createElement("div"); w.id = "sbx-boxtoast"; document.body.appendChild(w); }
    const b = document.createElement("button"); b.type = "button"; b.dataset.boxtoast = gid; b.innerHTML = `<span>📰</span><span><b>Box score ready</b><br>${esc(label)}</span>`;
    w.appendChild(b); setTimeout(() => b.remove(), 30000);
  }
  function bs_boxDing() { try { CD_AC = CD_AC || new (window.AudioContext || window.webkitAudioContext)(); const t0 = CD_AC.currentTime + 0.02; [[659.25, 0], [880, 0.14], [1046.5, 0.28]].forEach(([f, dt]) => { const o = CD_AC.createOscillator(), g = CD_AC.createGain(); o.type = "triangle"; o.frequency.value = f; g.gain.setValueAtTime(0, t0 + dt); g.gain.linearRampToValueAtTime(0.14, t0 + dt + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t0 + dt + 0.4); o.connect(g).connect(CD_AC.destination); o.start(t0 + dt); o.stop(t0 + dt + 0.45); }); } catch (_) {} }
  // Watch your clubs. The first look only notes what's already aired (no alert flood); after that, any game
  // whose report airs while the page is open gets an alert. Only one open SmallBall tab alerts (a short lock).
  async function bs_boxScan() {
    if (!on("box") || MOBILE && document.visibilityState !== "visible") return;
    const st = bs_boxSt(), now = srvNow(); let changed = false;
    for (const team of clubList()) {
      try {
        const d = await getJSON(`/games/all?club=${team}`, true);
        for (const r of (d.rows || []).slice(0, 10)) {
          const gid = r.game_id; if (st.alerted[gid]) continue;
          const age = now - Date.parse(r.finished_at);
          if (age > 3 * 3600e3) { st.alerted[gid] = Date.now(); changed = true; continue; }
          let until = CD_UNTIL[gid]; if (until == null) { try { until = Date.parse((await bs_boxGame(gid)).live_until || "") || 0; } catch (_) { continue; } CD_UNTIL[gid] = until; }
          if (until > now) { st.primed[gid] = 1; changed = true; continue; }
          st.alerted[gid] = Date.now(); changed = true;
          if (!st.primed[gid] && !st.started) continue;          // aired before the kit first looked: no alert
          delete st.primed[gid];
          st.unread[gid] = 1;
          let lock = 0; try { lock = Number(localStorage.getItem("sbx-box-lock") || 0); } catch (_) {}
          if (Date.now() - lock < 20000 && sessionStorage.getItem("sbx-box-tab") !== "1") continue;
          try { localStorage.setItem("sbx-box-lock", String(Date.now())); sessionStorage.setItem("sbx-box-tab", "1"); } catch (_) {}
          const label = `${bs_bname(r.away_name)} at ${bs_bname(r.home_name)}`;
          bs_boxToast(gid, label);
          if (on("boxding")) bs_boxDing();
          if (on("boxnote") && typeof Notification !== "undefined" && Notification.permission === "granted") { try { const n = new Notification("📰 Box score ready", { body: label, tag: "sbx-box-" + gid }); n.onclick = () => { window.focus(); bs_boxOpen(gid); n.close(); }; } catch (_) {} }
        }
      } catch (_) {}
      await sleep(400);
    }
    if (!st.started) { st.started = Date.now(); changed = true; }
    if (changed) bs_boxSave(st);
    bs_boxCount();
  }
  if (on("box")) { setTimeout(bs_boxScan, 6000); setInterval(bs_boxScan, 90e3); }
  window.__sbxBoxScan = bs_boxScan;   // for testing
  // In SmallBall's own game lists: the game number and a Box score button next to each Watch button.
  // A game still on the air shows 🔒 until its report airs (opening it just says when it'll be ready).
  function bs_listTick() {
    if (!on("box")) { document.querySelectorAll(".sbx-bxcell").forEach((e) => e.remove()); return; }
    const now = srvNow();
    for (const a of document.querySelectorAll('tr a[href^="/training?watch="]')) {
      const gid = Number((a.getAttribute("href").match(/watch=(\d+)/) || [])[1]); if (!gid) continue;
      let cell = a.parentElement.querySelector(":scope > .sbx-bxcell");
      if (!cell) {
        cell = document.createElement("span"); cell.className = "sbx-bxcell";
        cell.innerHTML = `<span class="sbx-gid" title="Game number">#${gid}</span><button type="button" class="btn small sbx-bxl" data-boxg="${gid}" title="Box score for game ${gid}">📰 Box score</button>${on("hill") && bs_hillRow(a) ? `<button type="button" class="btn small sbx-hill" data-hill="${gid}" title="Open the Hold the Master Form with this game filled in">⛰️ Report</button>` : ""}`;
        a.parentElement.insertBefore(cell.firstChild, a); a.after(cell);
      }
      const b = cell.querySelector(".sbx-bxl"), u = CD_UNTIL[gid], locked = u != null && u > now;
      const txt = locked ? "🔒 Box score" : "📰 Box score";
      if (b && b.textContent !== txt) { b.textContent = txt; b.title = locked ? `Box score unlocks when this game's report airs (${new Date(u - SKEW).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })})` : `Box score for game ${gid}`; }
    }
  }
  setInterval(bs_listTick, 1000);
  // ⛰️ Report to Hold the Hill: on your own club's page, a BigLeague game gets a button that opens the Hold the
  // Master Form with the game ID, the game type and both scores filled in from SmallBall's own game record.
  // You just press Next and Submit (the form is how the Hill knows it's you). Both players still report.
  const HILL_FORM = "https://docs.google.com/forms/d/e/1FAIpQLSfO1EMJ6w017hFyqQFXfda_3J9rM3ivU_o1PYgffN7zX7Xmdg/viewform";
  const HILL_E = { action: "898353382", gid: "2005048912", kind: "649585690", my: "1022644951", opp: "784642772" };
  const HILL_MINE = {};
  function bs_hillRow(a) {
    const m = /#\/team\/(\d+)/.exec(location.hash); if (!m) return false;
    const team = Number(m[1]);
    if (HILL_MINE[team] == null) { HILL_MINE[team] = clubList().includes(team) ? true : "?"; if (HILL_MINE[team] === "?") profileOf(team, 300e3).then((p) => { HILL_MINE[team] = !!(p && p.mine); document.querySelectorAll(".sbx-bxcell").forEach((e) => e.remove()); }).catch(() => { HILL_MINE[team] = false; }); }
    if (HILL_MINE[team] !== true) return false;
    const tr = a.closest("tr"); return !!tr && /BigLeague/i.test(tr.textContent);
  }
  document.addEventListener("click", async (e) => {
    const b = e.target.closest && e.target.closest("[data-hill]"); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const gid = Number(b.dataset.hill), m = /#\/team\/(\d+)/.exec(location.hash), team = m ? Number(m[1]) : 0;
    const win = window.open("about:blank", "_blank");
    try {
      const g = await getJSON(`/games/${gid}`, true);
      if (g.kind !== "big") throw new Error("Only BigLeague games count in Hold the Hill.");
      const home = g.home_team_id === team, my = home ? g.home_runs : g.away_runs, opp = home ? g.away_runs : g.home_runs;
      if (my == null || opp == null) throw new Error("That game has no final score yet.");
      const q = new URLSearchParams({ usp: "pp_url" });
      q.set("entry." + HILL_E.action, "Report my game (game ID and score)"); q.set("entry." + HILL_E.gid, String(gid)); q.set("entry." + HILL_E.kind, "BigLeague");
      q.set("entry." + HILL_E.my, String(my)); q.set("entry." + HILL_E.opp, String(opp));
      if (win) win.location.href = HILL_FORM + "?" + q.toString(); else location.href = HILL_FORM + "?" + q.toString();
    } catch (err) { if (win) win.close(); b.textContent = "⚠ " + err.message; b.title = err.message; setTimeout(() => { b.textContent = "⛰️ Report"; }, 6000); }
  }, true);
  // Desktop notifications need the browser's permission: ask once when you turn the option on.
  if (on("boxnote") && typeof Notification !== "undefined" && Notification.permission === "default") {
    const ask = () => { document.removeEventListener("click", ask, true); try { Notification.requestPermission(); } catch (_) {} };
    document.addEventListener("click", ask, true);
  }

  function paintTitle() {
    if (!on("alert")) { const b = (bs_BOXN ? "📰 " : "") + document.title.replace(/^📰 /, "").replace(/^⚡[^|]*\| /, ""); if (b !== document.title) document.title = b; return; }
    const now = Date.now(), list = clubList().map((id) => READY[id]).filter(Boolean);
    const all = list.filter((r) => r.allAt <= now).map((r) => r.name);
    const bench = list.filter((r) => r.allAt > now && r.benchAt <= now).map((r) => r.name);
    const pre = (bs_BOXN ? "📰 " : "") + (all.length ? `⚡ Ready: ${all.join(", ")} | ` : bench.length ? `⚡ Bench ready: ${bench.join(", ")} | ` : "");
    const base = document.title.replace(/^📰 /, "").replace(/^⚡[^|]*\| /, "");
    if (document.title !== pre + base) document.title = pre + base;
  }
  setInterval(paintTitle, 60000);

  // Game countdown. Timed games (Nov 24, 2026): SmallBall won't start a club's next official game until
  // its last one has been reported, and a game is reported when it finishes airing (the game's
  // live_until). The kit counts down to that on each tab and card, on the server's clock. Once per new
  // game it asks the site's own game preview whether the club really is blocked (the same check the Play
  // dialog makes), so an exhibition that doesn't block shows as "on air", not as a wait. Read-only.
  const CD = {}, CD_UNTIL = {};
  let SKEW = 0;
  const srvNow = () => Date.now() + SKEW;
  async function cdSkew() { try { const d = await getJSON(`/account/live?team=${clubList()[0] || 0}`); if (d && d.now) SKEW = Date.parse(d.now) - Date.now(); } catch (_) {} }
  async function cdLatest(team, rows) {
    if (!on("cd")) return;
    try {
      if (!rows) { const d = await getJSON(`/games/all?club=${team}`, true); rows = (d.rows || []).filter((g) => g.home_team_id === team || g.away_team_id === team); }
      // Only a game the club started counts: the club that starts a game is the visitor (SmallBall's own game
      // preview puts it there), and exhibitions never hold anyone up. A game a club was challenged in can be
      // on the air while that club starts its own, so it gets no countdown (the score hider and freeze still
      // cover it).
      const g = rows.filter((r) => r.away_team_id === team && r.kind !== "exhibition").sort((a, b) => String(b.finished_at).localeCompare(String(a.finished_at)))[0];
      const prev = CD[team] || {};
      if (!g) { CD[team] = Object.assign(prev, { until: 0, gid: 0, checked: Date.now() }); return; }
      let until = CD_UNTIL[g.game_id];
      if (until == null) {
        // Only a game simulated in the last hour can still be on the air.
        if (srvNow() - Date.parse(g.finished_at) > 3600e3) until = 0;
        else { const det = await getJSON(`/games/${g.game_id}`); until = Date.parse(det.live_until || "") || 0; }
        CD_UNTIL[g.game_id] = until;
      }
      const fresh = prev.gid !== g.game_id;
      const c = CD[team] = Object.assign(prev, { until, gid: g.game_id, kind: g.kind, checked: Date.now() });
      if (fresh) { c.rang = false; c.blocks = null; c.reason = ""; }
      if (fresh && until > srvNow()) {
        // Ask the site's own preview once: it says whether the club is held up, and until when.
        try {
          const p = await getJSON(`/games/preview?team=${team}&kind=big`);
          const w = (p && p.wait) || {};
          c.blocks = w.ok === false; c.reason = w.reason || "";
          if (w.ok === false && w.until) { const u = Date.parse(w.until); if (u) c.until = u; }
          if (w.ok !== false) c.until = 0;          // not held up: no countdown
        } catch (_) { c.blocks = true; }
      }
    } catch (_) {}
  }
  const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ":" + String(m).padStart(2, "0") : String(m)) + ":" + String(x).padStart(2, "0"); };
  let CD_AC = null;
  function cdDing() {
    try {
      CD_AC = CD_AC || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = CD_AC.currentTime + 0.02;
      [[880, 0], [1318.5, 0.16]].forEach(([f, dt]) => { const o = CD_AC.createOscillator(), g = CD_AC.createGain(); o.type = "sine"; o.frequency.value = f; g.gain.setValueAtTime(0, t0 + dt); g.gain.linearRampToValueAtTime(0.18, t0 + dt + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t0 + dt + 0.45); o.connect(g).connect(CD_AC.destination); o.start(t0 + dt); o.stop(t0 + dt + 0.5); });
    } catch (_) {}
  }
  function cdTick() {
    const show = on("cd");
    if (!show) { document.querySelectorAll(".sbx-cd").forEach((e) => e.remove()); document.querySelectorAll(".sbx-cdc").forEach((e) => (e.innerHTML = "")); return; }
    const now = srvNow();
    for (const id of clubList()) {
      const c = CD[id], left = c && c.until ? c.until - now : 0;
      if (c && left > 0) c.seen = true;
      if (c && c.seen && left <= 0 && !c.rang) { c.rang = true; c.readyAt = now; if (on("cdding") && c.blocks !== false) cdDing(); }
      const justReady = c && c.readyAt && now - c.readyAt < 3 * 60e3;
      const btn = document.querySelector(`#sbx-tabs button[data-club="${id}"]`);
      if (btn) {
        let el = btn.querySelector(".sbx-cd");
        const txt = left > 0 ? (c.blocks === false ? `📺${mmss(left)}` : `⏳${mmss(left)}`) : justReady && c.blocks !== false ? "✓ play" : "";
        if (txt) {
          if (!el) { el = document.createElement("span"); el.className = "mk sbx-cd"; btn.appendChild(el); }
          if (el.textContent !== txt) el.textContent = txt;
          el.classList.toggle("go", !(left > 0)); el.classList.toggle("air", left > 0 && c.blocks === false);
          el.title = left > 0 ? (c.blocks === false ? `On the air for ${mmss(left)} more. SmallBall says this club can still start an official game.` : `On the air: this club's next official game can start in ${mmss(left)}, when this one's report airs.`) : "Its last game has aired: ready to play.";
        } else if (el) el.remove();
      }
      document.querySelectorAll(`.card[data-club="${id}"] .sbx-cdc`).forEach((e) => {
        const h = left > 0 ? (c.blocks === false ? `📺 On the air · ${mmss(left)} left` : `⏳ Next game in <b>${mmss(left)}</b>`) : justReady && c.blocks !== false ? `✅ Ready to play` : "";
        if (e.innerHTML !== h) e.innerHTML = h;
        e.classList.toggle("wait", left > 0 && c.blocks !== false); e.classList.toggle("go", !(left > 0) && !!h);
      });
    }
  }
  setInterval(cdTick, 1000);
  // Score hider (off to start): in game lists and SmallBall's live bar, a game whose report hasn't aired yet
  // shows its countdown instead of its score. Click the countdown to see the score anyway. Once the report
  // airs the score comes back by itself. The page's club list tells us which games are recent; only those
  // get a details read (for live_until), and each game is read once.
  const HIDE_REV = new Set(), HIDE_ASK = new Set(), HIDE_SCORE = /\b\d{1,3}\s*[–-]\s*\d{1,3}\b/;
  let hidePage = { team: 0, at: 0 };
  async function hideUntil(id) {
    if (CD_UNTIL[id] != null || HIDE_ASK.has(id)) return; HIDE_ASK.add(id);
    try { const det = await getJSON(`/games/${id}`); CD_UNTIL[id] = Date.parse(det.live_until || "") || 0; } catch (_) { HIDE_ASK.delete(id); }
  }
  async function hideLoad() {
    const m = /#\/team\/(\d+)/.exec(location.hash); if (!m) return; const team = Number(m[1]);
    if (hidePage.team === team && Date.now() - hidePage.at < 60e3) return; hidePage = { team, at: Date.now() };
    try {
      const d = await getJSON(`/games/all?club=${team}`, true);
      for (const g of d.rows || []) { if (CD_UNTIL[g.game_id] != null) continue; if (srvNow() - Date.parse(g.finished_at) > 3600e3) { CD_UNTIL[g.game_id] = 0; continue; } await hideUntil(g.game_id); }
    } catch (_) {}
  }
  // The cell keeps its own content (font-size 0 hides it, even if the site rewrites it), and our chip sits on top.
  function hideMask(cell, id, left) {
    cell.classList.add("sbx-hid");
    const txt = `⏳ ${mmss(left)}`; let ch = cell.querySelector(":scope > .sbx-cdh");
    if (!ch) { ch = document.createElement("span"); ch.className = "sbx-cdh"; ch.dataset.game = id; ch.title = "Score hidden until this game's report airs. Click to see it now."; cell.appendChild(ch); }
    if (ch.textContent !== txt) ch.textContent = txt;
  }
  function hideUnmask(cell) { if (!cell.classList.contains("sbx-hid")) return; cell.classList.remove("sbx-hid"); cell.querySelector(":scope > .sbx-cdh")?.remove(); }
  function hideTick() {
    const want = on("cdhide"), now = srvNow();
    if (want || on("box")) hideLoad();   // also tells the Box score buttons which games are still on the air
    for (const a of document.querySelectorAll('a[href^="/training?watch="]')) {
      const id = Number((a.getAttribute("href").match(/watch=(\d+)/) || [])[1]); if (!id) continue;
      const lb = a.classList.contains("lb-row");
      const cells = lb ? [a.querySelector(".lb-sc")].filter(Boolean) : (() => { const row = a.closest("tr"); return row ? [...row.children].filter((td) => !td.querySelector("a") && (td.classList.contains("sbx-hid") || HIDE_SCORE.test(td.textContent))) : []; })();
      if (!cells.length) continue;
      if (want && lb && CD_UNTIL[id] == null) hideUntil(id);
      const left = (CD_UNTIL[id] || 0) - now, hide = want && left > 0 && !HIDE_REV.has(id);
      for (const c of cells) hide ? hideMask(c, id, left) : hideUnmask(c);
    }
  }
  setInterval(hideTick, 1000);
  document.addEventListener("click", (e) => {
    const ch = e.target.closest && e.target.closest(".sbx-cdh"); if (!ch) return;
    e.preventDefault(); e.stopPropagation(); HIDE_REV.add(Number(ch.dataset.game)); hideTick();
  }, true);
  // Keep it fresh without hammering the site: re-check a club a few seconds after you press SmallBall's own
  // Play button in its game dialog, and look over all your clubs every 90 seconds while the page is open.
  document.addEventListener("click", (e) => {
    if (!on("cd") || !e.target.closest || !e.target.closest("#dlg-go")) return;
    const id = Number((document.getElementById("who-team") || {}).value); if (!id) return;
    setTimeout(() => cdLatest(id), 4000); setTimeout(() => cdLatest(id), 15000);
  }, true);
  setInterval(async () => {
    if (!on("cd") || document.visibilityState !== "visible") return;
    await cdSkew();
    for (const id of clubList()) { const c = CD[id]; if (c && c.until > srvNow()) continue; if (c && Date.now() - c.checked < 80e3) continue; await cdLatest(id); await sleep(400); }
  }, 90e3);
  cdSkew();
  // Your own club profiles, cached for a minute.
  const PROF = {};
  async function profileOf(team, maxAge) {
    const c = PROF[team];
    if (c && Date.now() - c.at < maxAge) return c.data;
    const d = await getJSON(`/teams/${team}/profile`);
    PROF[team] = { at: Date.now(), data: d };
    return d;
  }

  // Lineup check: flag when the man pitching is clearly not your pitcher, e.g. after training the bench
  // moved a bench man onto the mound. "Clearly" = someone on the bench or elsewhere in the field pitches
  // 25+ points better and at least 50.
  const POS9 = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
  function pitchWarn(prof) {
    const R = prof.roster, F = prof.field_pos;
    if (!Array.isArray(R) || !Array.isArray(F) || !R.length || F[0] == null) return "";
    const bySlot = {}; R.forEach((m, i) => { bySlot[m.slot ?? i] = m; });
    const cur = bySlot[F[0]]; if (!cur) return "";
    const cp = +cur.pitch_skill || 0;
    let best = null;
    for (const m of R) { if (m === cur) continue; const p = +m.pitch_skill || 0; if (p >= 50 && p - cp >= 25 && (!best || p > +best.pitch_skill)) best = m; }
    if (!best) return "";
    const at = F.indexOf(best.slot), where = at > 0 ? `is playing ${POS9[at]}` : "is on the bench";
    const nm = (m) => esc(String(m.name).replace(/\*+$/, ""));
    return `<div class="pwarn" title="Club stars follow the nine who start, so a weak pitcher costs stars. Fix it in the club's lineup.">⚠ ${nm(cur)} (Pitching ${Math.round(cp)}) is pitching. ${nm(best)} (Pitching ${Math.round(+best.pitch_skill)}) ${where}.</div>`;
  }
  // Passive Training: games train the men who play and spend their TP. Flag it on the card, and warn
  // when it's on with empty tanks (games aren't training anyone) or when it will eat TP in good matches.
  function passiveChip(prof, team) {
    if (!prof.mine) return "";
    if (!prof.passive_training) return ` <button type="button" class="badge pas off" data-passive="${team}" title="Passive Training is off. Click to go to the switch (Settings, bottom of the club page).">Passive off</button>`;
    const R = prof.roster || [], F = new Set(prof.field_pos || []);
    const st = R.filter((m, i) => F.has(m.slot ?? i)); const max = (prof.team_tp_max || 100 * R.length) / Math.max(1, R.length);
    const avg = st.length ? st.reduce((a, m) => a + (+m.tp || 0), 0) / st.length : 0;
    const empty = avg < max * 0.1;
    return ` <button type="button" class="badge pas" data-passive="${team}" title="Passive Training is on: every game trains the men who play and spends their TP, good matches included. Click to go to the switch.">Passive ON</button>` +
      (empty ? `<div class="pwarn">⚠ Passive is on but the starters are out of TP (avg ${Math.round(avg)}): games aren't training them. Turn it off until they refill.</div>`
        : `<div class="pnote">Passive is on: every game, good matches included, spends the starters' TP (avg ${Math.round(avg)} each now).</div>`);
  }
  // What a minimized card (its tab) shows: star tier, ready to train, and whether a warning is up.
  const TABSTAT = {};
  function noteTab(team, prof, card) {
    const r = READY[team], now = Date.now();
    TABSTAT[team] = { tier: prof.star10 ?? (prof.stars ? Math.ceil(prof.stars / 10) : null), ready: !!(r && on("alert") && r.benchAt <= now),
      warn: /class="pwarn"/.test(card) };
  }
  async function clubCard(team) {
    const prof = await profileOf(team, 0);
    if (prof.mine === false) throw new Error("not your club");
    const games = await seasonGames(team);
    await cdLatest(team, on("freeze") ? null : games);   // frozen lists leave out the airing game; the countdown needs it
    const res = (g) => { const h = g.home_team_id === team; const a = h ? g.home_runs : g.away_runs, b = h ? g.away_runs : g.home_runs; return a > b ? "w" : a < b ? "l" : "t"; };
    const good = games.filter((g) => g.good_match === true);
    const gw = good.filter((g) => res(g) === "w").length, gl = good.filter((g) => res(g) === "l").length;
    const rec = (prof.record || []).find((r) => r.league_id === 0) || {};
    const pro = (prof.record || []).find((r) => r.league_id && r.league_id > 0);
    const star10 = prof.star10 != null ? prof.star10 : null;
    const net = gw - gl;
    const onLadder = prof.league_id && prof.league_id > 0;
    let badge;
    if (onLadder) badge = `<span class="badge ok">On the ladder: ${esc(prof.league_name || "ProLeague")}</span>`;
    else if (star10 != null && star10 < 5) badge = `<span class="badge no">Needs 5 stars for Junior</span>`;
    else if (net > 0) badge = `<span class="badge ok">On track for Junior · +${net}</span>`;
    else badge = `<span class="badge no">Needs ${1 - net} more net good-match win${1 - net === 1 ? "" : "s"}</span>`;
    const shown = games.filter(keepGame);
    const sorted = shown.slice().sort((a, b) => String(b.finished_at).localeCompare(String(a.finished_at)));
    const last10 = sorted.slice(0, 10);
    let streak = "";
    if (sorted.length) { const r0 = res(sorted[0]); let n = 0; for (const g of sorted) { if (res(g) !== r0) break; n++; } streak = (r0 === "w" ? "W" : r0 === "l" ? "L" : "T") + n; }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todays = shown.filter((g) => new Date(g.finished_at) >= today);
    const tw = todays.filter((g) => res(g) === "w").length, tl = todays.filter((g) => res(g) === "l").length;
    const played = rec.played || (rec.wins || 0) + (rec.losses || 0);
    let rpg = played ? `${(rec.runs_for / played).toFixed(1)} – ${(rec.runs_against / played).toFixed(1)}` : "—";
    if (goodOnly()) {
      let rf = 0, ra = 0; for (const g of shown) { const h = g.home_team_id === team; rf += h ? g.home_runs : g.away_runs; ra += h ? g.away_runs : g.home_runs; }
      rpg = shown.length ? `${(rf / shown.length).toFixed(1)} – ${(ra / shown.length).toFixed(1)}` : "—";
    }
    const name = String(prof.name || team).replace(/\s*-XsT-\s*$/, "");
    const tp = Math.round(prof.team_tp || 0), tpMax = prof.team_tp_max || 1200;
    const tpPct = Math.max(0, Math.min(100, Math.round(100 * tp / tpMax)));
    // Refill by design: starters 48 hours, bench 24.
    const rates = tpRates();
    let startH = 0, benchH = 0, fullMen = 0;
    const men = prof.roster || [];
    for (const m of men) {
      const h = Math.max(0, 100 - (+m.tp || 0)) / (m.position ? rates.s.rate : rates.b.rate);
      if (h <= 0.05) fullMen++;
      if (m.position) startH = Math.max(startH, h); else benchH = Math.max(benchH, h);
    }
    const when = (h) => h <= 0.05 ? "full" : h < 1 ? "full in <1h" : `full in ≈${Math.round(h)}h`;
    const fullTxt = `Starters ${when(startH)} · Bench ${when(benchH)}`;
    const teamH = Math.max(startH, benchH);
    let nextTxt;
    if (teamH <= 0.05) nextTxt = `<span class="ready">⚡ Full team ready to train</span>`;
    else if (benchH <= 0.05) nextTxt = `<span class="ready">⚡ Bench ready</span> · full team <b>${whenAt(teamH)}</b>`;
    else if (benchH < teamH - 0.5) nextTxt = `Train bench <b>${whenAt(benchH)}</b> · full team <b>${whenAt(teamH)}</b>`;
    else nextTxt = `Train full team <b>${whenAt(teamH)}</b>`;
    if (fullMen && teamH > 0.05) nextTxt += ` · ${fullMen} of ${men.length} men full`;
    READY[team] = { name: String(prof.name || team).replace(/\s*-XsT-\s*$/, ""), benchAt: Date.now() + benchH * 3600e3, allAt: Date.now() + teamH * 3600e3 };
    // Tier watch: good matches are clubs with the same star rating (71–80 stars = 8★, and so on).
    let tierTxt = "";
    if (prof.stars != null) {
      const st = Math.round(prof.stars), tier = Math.max(1, Math.ceil(st / 10));
      const up = tier * 10 + 1 - st, down = st - (tier - 1) * 10;
      if (tier >= 10) tierTxt = `<div class="tier">Top tier</div>`;
      else {
        const warnUp = up <= 2, warnDown = tier > 1 && down <= 2;
        tierTxt = `<div class="tier${warnUp || warnDown ? " warn" : ""}" title="Good matches are clubs with the same star rating. ${tier}★ covers ${(tier - 1) * 10 + 1}–${tier * 10} stars.">${up} star${up === 1 ? "" : "s"} to ${tier + 1}★${warnUp ? " · a Quick Train may move you up" : ""}${warnDown ? ` · ${down} above ${tier - 1}★` : ""}</div>`;
      }
    }
    const tpColor = tpPct >= 90 ? "#16a34a" : tpPct >= 50 ? "#ca8a04" : "#64748b";
    const row = (k, v, lite) => `<div class="row${lite ? " lite" : ""}"><span>${k}</span><b>${v}</b></div>`;
    const rating = star10 != null ? star10 : (prof.stars != null ? Math.ceil(prof.stars / 10) : 0);
    const avg = prof.stars != null ? (prof.stars / 10).toFixed(1) : null;
    const starRow = Array.from({ length: 10 }, (_, i) => `<i class="${i < rating ? "on" : ""}">★</i>`).join("");
    const tc = tierColor(rating);
    const html = `<div class="card on" data-club="${team}" title="Open ${esc(name)}" style="--tier:${tc}">
      <h3><span class="nm">${logoImg(team, "sbx-logo-card")}${esc(name)}</span><span class="id">${team}</span></h3>
      <div class="stars" title="${rating}-star club${avg ? ` (men average ${avg} stars)` : ""}"><span class="srow">${starRow}</span><span class="num">${rating}<small>★</small></span>${avg ? `<span class="avg">avg ${avg}</span>` : ""}</div>
      ${on("tier") ? tierTxt : ""}${pitchWarn(prof)}
      <div class="sub lite">home ${esc(PARKS[prof.home_park_id] || "—")}</div>
      ${badge}${passiveChip(prof, team)}
      <div class="tp" title="Team TP ${tp} of ${tpMax}">
        <div class="tpbar"><div style="width:${tpPct}%;background:${tpColor}"></div></div>
        <div class="tptxt"><span>TP <b>${tp}</b> / ${tpMax} · ${tpPct}%</span></div>
        <div class="tptxt"><span>${fullTxt}</span></div>
        ${on("train") ? `<div class="tptxt next" title="Quick Train spends all TP, so train when the bars are full. Times are estimates from the refill speed."><span>${nextTxt}</span></div>` : ""}
      </div>
      ${row("Good matches", `${gw}–${gl}`)}
      ${row("BigLeague", `${rec.wins ?? 0}–${rec.losses ?? 0}${rec.rank ? ` · #${rec.rank}` : ""}`, true)}
      ${pro ? row("ProLeague", `${pro.wins}–${pro.losses}${pro.rank ? ` · #${pro.rank}` : ""}`) : ""}
      ${row("Runs a game", rpg, true)}
      ${row("Today", todays.length ? `${tw}–${tl}${todays.length - tw - tl ? "–" + (todays.length - tw - tl) : ""} (${todays.length})` : "no games")}
      ${row("Streak", streak || "—")}
      <div class="chips" title="Last 10 games, newest first">${last10.map((g) => `<i class="${res(g)}">${res(g).toUpperCase()}</i>`).join("")}</div>
      <div class="sbx-cdc" title="Timed games: a club can start its next official game once its last one has aired"></div>
      <div class="acts"><button type="button" class="play" data-play="${team}" title="Pick this club and open the site's Games page">▶ Play</button><a class="trn" href="/training?team=${team}" title="Open the site's training page for this club">Training</a></div>
    </div>`;
    noteTab(team, prof, html);
    return html;
  }

  async function buildDash(force) {
    const box = document.getElementById("sbx-dash");
    if (!box || dashState.busy) return;
    const key = clubList().join(",") + (goodOnly() ? "|good" : "");
    if (!force && dashState.html && dashState.key === key && Date.now() - dashState.at < 120000) { box.innerHTML = dashState.html; wireDash(box); applyExp(); return; }
    dashState.busy = true;
    box.innerHTML = clubList().map((id) => `<div class="card"><h3><span>Loading…</span><span class="id">${id}</span></h3></div>`).join("");
    try {
      const cards = [], byId = {};
      for (const id of clubList()) {
        let h;
        try { h = await clubCard(id); }
        catch (e) { h = `<div class="card"><h3><span>Club ${id}</span></h3><div class="sub">Could not load (${esc(e.message || e)})</div></div>`; }
        cards.push(h); byId[id] = h;
      }
      dashState.html = cards.join(""); dashState.cards = byId; dashState.at = Date.now(); dashState.key = key;
      try { sessionStorage.setItem("sbx-dash-cache", JSON.stringify({ html: dashState.html, cards: byId, at: dashState.at, key })); sessionStorage.setItem("sbx-ready", JSON.stringify(READY)); } catch (_) {}
      paintTitle();
      const b2 = document.getElementById("sbx-dash");
      if (b2) { b2.innerHTML = dashState.html; wireDash(b2); }
      const tb = document.getElementById("sbx-tabs"); if (tb) tb.dataset.key = "";
      applyExp();
    } finally { dashState.busy = false; }
  }
  // Play: pick the club with the site's own club switcher, then open its Games page. You still choose the
  // opponent and press the site's own Play button there.
  function goPlay(id) {
    const sel = document.getElementById("who-team");
    if (sel && sel.value !== String(id)) { sel.value = String(id); sel.dispatchEvent(new Event("change", { bubbles: true })); }
    else if (!sel) { try { localStorage.setItem("sb.team", String(id)); } catch (_) {} }
    setTimeout(() => { location.hash = "#/games"; }, 350);
  }
  // Take you to SmallBall's own Passive Training switch (Settings, at the bottom of your club page) and
  // flash it. The kit never flips it for you.
  function goPassive(id) {
    const sel = document.getElementById("who-team");
    const here = location.hash === "#/team/" + id;
    if (!here) { if (sel && sel.value !== String(id)) { sel.value = String(id); sel.dispatchEvent(new Event("change", { bubbles: true })); } setTimeout(() => { location.hash = "#/team/" + id; }, 150); }
    let tries = 0;
    const find = () => {
      const sw = document.getElementById("t-passive");
      if (sw && location.hash === "#/team/" + id) {
        const lab = sw.closest("label") || sw;
        lab.scrollIntoView({ behavior: "smooth", block: "center" });
        lab.classList.add("sbx-flash"); setTimeout(() => lab.classList.remove("sbx-flash"), 3200);
        return;
      }
      if (++tries < 40) setTimeout(find, 150);
    };
    setTimeout(find, here ? 0 : 400);
  }
  function wireDash(box) {
    box.querySelectorAll("[data-passive]").forEach((b) => (b.onclick = (ev) => { ev.stopPropagation(); ev.preventDefault(); goPassive(b.dataset.passive); }));
    box.querySelectorAll(".card [data-play]").forEach((b) => (b.onclick = (ev) => { ev.stopPropagation(); goPlay(b.dataset.play); }));
    box.querySelectorAll(".card .trn").forEach((a) => (a.onclick = (ev) => ev.stopPropagation()));
    box.querySelectorAll(".card[data-club]").forEach((c) => (c.onclick = () => {
      const sel = document.getElementById("who-team");
      const id = c.dataset.club;
      if (sel && sel.value !== id) { sel.value = id; sel.dispatchEvent(new Event("change", { bubbles: true })); }
      location.hash = "#/team/" + id;
    }));
  }

  const DASH_KEY = "sbx-dash-cache", DASH_FOLD = "sbx-dash-collapsed", DASH_TTL = 120000;
  try {
    const c = JSON.parse(sessionStorage.getItem(DASH_KEY) || "null");
    if (c && c.html && Date.now() - c.at < DASH_TTL) { dashState.html = c.html; dashState.cards = c.cards || null; dashState.at = c.at; dashState.key = c.key; }
  } catch (_) {}
  window.addEventListener("hashchange", () => { if (expCtx() !== EXP_CTX) { EXP = null; applyExp(); } });
  function mountDash() {
    const existing = document.getElementById("sbx-dash-wrap");
    if (/^#\/(login|new)\b/.test(location.hash)) { existing?.remove(); return; }
    if (existing && existing.isConnected) return;
    const main = document.querySelector("main");
    if (!main || !document.getElementById("who-team")) return;
    const wrap = document.createElement("section");
    wrap.id = "sbx-dash-wrap";
    let folded = false; if (MOBILE) try { folded = localStorage.getItem(DASH_FOLD) === "1"; } catch (_) {}
    if (folded) wrap.classList.add("collapsed");
    wrap.innerHTML = `<div id="sbx-dash-head"><b class="tog" title="Show or hide">Your clubs <span class="arrow">${folded ? "▸" : "▾"}</span></b><span class="right"><span id="sbx-season"></span>${goodToggle()}<button type="button" id="sbx-dash-refresh">Refresh</button></span></div><div id="sbx-dash"></div>`;
    main.insertAdjacentElement("afterbegin", wrap);
    wrap.querySelector("#sbx-dash-refresh").onclick = () => buildDash(true);
    wrap.querySelector(".tog").onclick = () => {
      if (!MOBILE && on("dash")) { const s = expSet(); if (s.size) s.clear(); else clubList().forEach((id) => s.add(id)); applyExp(); return; }
      const now = !wrap.classList.contains("collapsed");
      wrap.classList.toggle("collapsed", now);
      wrap.querySelector(".arrow").textContent = now ? "▸" : "▾";
      try { localStorage.setItem(DASH_FOLD, now ? "1" : "0"); } catch (_) {}
      if (!now) buildDash(false);
    };
    if (!folded) buildDash(false);
    applyExp();
    paintSeason();
  }
  // Season clock: when the current season closes.
  const SEASON = { at: 0, data: null, busy: false };
  function paintSeason() {
    const el = document.getElementById("sbx-season");
    if (!el || !on("season")) return;
    if ((!SEASON.data || Date.now() - SEASON.at > 600000) && !SEASON.busy) {
      SEASON.busy = true;
      getJSON("/season").then((d) => { SEASON.data = d && d.season; SEASON.at = Date.now(); })
        .catch(() => {}).finally(() => { SEASON.busy = false; paintSeason(); });
    }
    const s = SEASON.data;
    if (!s || !s.closes_at) return;
    const skew = s.server_time ? Date.parse(s.server_time) - SEASON.at : 0;
    const left = Date.parse(s.closes_at) - (Date.now() + skew);
    let txt;
    if (left <= 0) txt = `${esc(s.name || "Season")} closing`;
    else {
      const d = Math.floor(left / 864e5), h = Math.floor(left % 864e5 / 3600e3), m = Math.floor(left % 3600e3 / 60e3);
      const end = new Date(Date.parse(s.closes_at)).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      txt = `${esc(s.name || "Season")} ends in <b>${d ? d + "d " : ""}${h}h${d ? "" : " " + m + "m"}</b> <span class="end">· ${end}</span>`;
    }
    if (el.innerHTML !== txt) el.innerHTML = txt;
  }
  setInterval(paintSeason, 60000);

  // The squad table: a TP column on your own clubs, and player grade colors on any club.
  const SQ = { busy: false };
  function gradeSquad(t, byId) {
    for (const tr of t.querySelectorAll("tr.man")) {
      let lv = [];
      for (const td of tr.children) {
        if (td.classList.contains("sbx-tp") || td.dataset.sbxOv) continue;
        const m = /^\s*(\d{1,2})★\s*$/.exec(td.textContent);
        if (m) {
          const n = Math.min(10, Number(m[1])); lv.push(n);
          const c = tierColor(n);
          if (td.dataset.sbxG !== c || td.querySelector("span.sk:not([data-sbx-g])")) {
            td.dataset.sbxG = c; td.style.color = c; td.style.fontWeight = n >= 8 ? "800" : "";
            // The site colors the star inside its own span, so color that too.
            for (const el of td.querySelectorAll("*")) { el.style.color = c; el.dataset.sbxG = "1"; }
          }
        }
      }
      // Overall: the game's own star rating (read from its star row), shown as one colored number.
      let ovTd = null;
      for (const td of tr.children) if (td.dataset.sbxOv || td.querySelector("span.stars[title]")) { ovTd = td; break; }
      if (ovTd && !ovTd.dataset.sbxOv) {
        const m = /(\d+)/.exec(ovTd.querySelector("span.stars").getAttribute("title") || "");
        if (m) ovTd.dataset.sbxOv = m[1];
      }
      const p = byId && byId[tr.dataset.pid];
      const ov = ovTd && ovTd.dataset.sbxOv ? Number(ovTd.dataset.sbxOv)
        : p && p.overall != null ? Math.round(p.overall)
        : lv.length ? Math.round(lv.reduce((a, b) => a + b, 0) / lv.length) : null;
      if (ov == null) continue;
      const c = tierColor(ov), k = ov + "|" + c;
      const host = ovTd || tr.children[3];
      if (!host) continue;
      if (tr.dataset.sbxGrade === k && host.querySelector(".sbx-grade")) continue;
      tr.dataset.sbxGrade = k;
      const badge = `<span class="sbx-grade" style="--g:${c}" title="Overall: ${ov} of 10 stars">${ov}<small>★</small></span>`;
      if (ovTd) ovTd.innerHTML = badge;
      else { host.querySelector(".sbx-grade")?.remove(); host.insertAdjacentHTML("afterbegin", badge); }
      if (tr.children[0]) tr.children[0].style.boxShadow = `inset 4px 0 0 ${c}`;
    }
  }
  // Skills / Stats / All buttons on the squad heading; columns are sorted by their header names.
  const SQUAD_VIEW = "sbx-squad-view";
  const MOOD_FACES = [[90, "😄"], [70, "🙂"], [50, "😐"], [30, "🙁"], [0, "😣"]];
  function moodFaces(t) {
    const hr = t.querySelector("thead tr");
    if (!hr) return;
    const at = Array.from(hr.children).findIndex((th) => th.textContent.trim() === "Mood");
    if (at < 0) return;
    for (const tr of t.querySelectorAll("tr.man")) {
      const td = tr.children[at];
      if (!td) continue;
      const raw = td.dataset.sbxMood != null && td.querySelector(".sbx-mood") ? td.dataset.sbxMood : td.textContent.trim();
      const v = Number(raw);
      if (raw === "" || !Number.isFinite(v)) continue;
      const face = MOOD_FACES.find(([min]) => v >= min)[1];
      const html = `<span class="sbx-mood" title="Mood ${Math.round(v)}">${face} ${Math.round(v)}</span>`;
      if (td.dataset.sbxMood === raw && td.innerHTML === html) continue;
      td.dataset.sbxMood = raw;
      td.innerHTML = html;
    }
  }
  // Box scores, cached per game. For every club: each player's line (AB, H, 2B, 3B, HR, BB, K, IP) and
  // the runs. For YOUR clubs only: each man's skills as the game had them, which shows when you trained.
  // Other clubs' skills are never stored: they're their owners' business.
  const BOX_KEY = "sbx-box-v2", BOX_MAX = 1500;
  try { localStorage.removeItem("sbx-box-v1"); } catch (_) {}
  let BOX = {}; try { BOX = JSON.parse(localStorage.getItem(BOX_KEY) || "{}"); } catch (_) {}
  let boxDirty = 0;
  const boxSave = (force) => {
    if (!force && ++boxDirty % 25) return;
    try {
      const ids = Object.keys(BOX);
      if (ids.length > BOX_MAX) ids.sort((a, b) => (BOX[a].f || 0) - (BOX[b].f || 0)).slice(0, ids.length - BOX_MAX).forEach((k) => delete BOX[k]);
      localStorage.setItem(BOX_KEY, JSON.stringify(BOX));
    } catch (_) {
      // Storage full: keep the newest half and try once more.
      const ids = Object.keys(BOX).sort((a, b) => (BOX[a].f || 0) - (BOX[b].f || 0));
      ids.slice(0, Math.floor(ids.length / 2)).forEach((k) => delete BOX[k]);
      try { localStorage.setItem(BOX_KEY, JSON.stringify(BOX)); } catch (_) {}
    }
  };
  function boxOf(gd) {
    const res = gd.result || {}, pl = res.players || {}, R = gd.rosters || {}, own = ownIds(), o = { f: Date.parse(gd.finished_at || res.finished_at || 0) || 0 };
    const runs = { home: gd.home_runs ?? res.home_runs ?? 0, away: gd.away_runs ?? res.away_runs ?? 0 };
    for (const [side, opp] of [["home", "away"], ["away", "home"]]) {
      const r = R[side] || {}, ids = r.player_ids || [], p = {};
      for (const id of ids) { const x = pl[id] || {}; p[id] = [x.ab || 0, x.h || 0, x.b2 || 0, x.b3 || 0, x.hr || 0, x.bb || 0, x.k || 0, x.ip || 0, x.rbi || 0, x.po || 0, x.a || 0, x.e || 0, x.dp || 0]; }
      const S = { t: r.team_id, rf: runs[side], ra: runs[opp], p, pc: (res.pitches || {})[side] || 0 };
      if (own.has(String(r.team_id)) && Array.isArray(r.cards)) {
        S.c = {};
        ids.forEach((id, i) => { const c = r.cards[i]; if (c) S.c[id] = [c.pitchSkill, c.catchSkill, c.passPower, c.runPower, c.swingSkill, c.swingPower, c.contactOdds].map((v) => Math.round(+v || 0)); });
      }
      o[side === "home" ? "h" : "a"] = S;
    }
    return o;
  }
  const sideOf = (b, team) => (b && b.h && b.h.t === team ? [b.h, b.a] : b && b.a && b.a.t === team ? [b.a, b.h] : [null, null]);
  // Every game a club played since a cutoff (newest first), up to a cap, across seasons.
  async function gamesSince(team, sinceMs, cap) {
    const rows = []; let next = null, pages = 0;
    do {
      const qs = new URLSearchParams({ club: String(team) });
      if (next) qs.set("before", next);
      const d = await getJSON("/games/all?" + qs.toString());
      const mine = (d.rows || []).filter((g) => (g.home_team_id === team || g.away_team_id === team) && g.finished_at);
      rows.push(...mine);
      const oldest = mine.length ? Date.parse(mine[mine.length - 1].finished_at) : 0;
      next = oldest && oldest < sinceMs ? null : d.next;
      pages++;
      await sleep(100);
    } while (next && pages < 60 && rows.length < cap);
    return rows.filter((g) => Date.parse(g.finished_at) >= sinceMs).slice(0, cap);
  }
  // Fetch box scores we don't have yet, gently; onTick(done, total) reports progress.
  async function fillBoxes(games, isCurrent, onTick) {
    let i = 0;
    for (const g of games) {
      if (!isCurrent()) return false;
      const b = BOX[g.game_id];
      if (!b) {
        try { BOX[g.game_id] = boxOf(await getJSON(`/games/${g.game_id}`)); boxSave(); } catch (_) {}
        await sleep(120);
      }
      if (++i % 10 === 0 && onTick) onTick(i, games.length);
    }
    boxSave(true);
    return true;
  }

  // Season pitching, built from the public box scores of the club's games this season.
  // The site's own career pitching numbers are unreliable (earned runs read 0 for some pitchers),
  // so each game's line is worked out from the box score: innings from the pitcher's line, and
  // hits, walks, strikeouts, homers and runs from what the other side did. Lines are cached per game.
  try { localStorage.removeItem("sbx-pit-v1"); } catch (_) {}
  const PIT = { team: 0, state: "", n: 0, total: 0, rows: null, busy: false, names: {} };
  async function loadPitching(team) {
    if (PIT.busy) return;
    PIT.busy = true; PIT.team = team; PIT.state = "list"; PIT.n = 0; PIT.rows = null;
    try {
      const prof = await getJSON(`/teams/${team}/profile`);
      PIT.names = {}; for (const m of prof.roster || []) PIT.names[m.player_id] = { name: m.name, pos: m.position, ov: m.overall };
      const games = (await seasonGames(team)).filter((g) => g.finished_at);
      const recent = games.filter(keepGame).slice(0, 400);
      PIT.total = recent.length; PIT.state = "games"; paintPitch();
      const ok = await fillBoxes(recent, () => PIT.team === team, (n) => { PIT.n = n; paintPitch(); });
      if (!ok) return;
      const agg = {};
      for (const g of recent) {
        const [S, O] = sideOf(BOX[g.game_id], team);
        if (!S || !O) continue;
        const arms = Object.keys(S.p).filter((id) => S.p[id][7] > 0);
        const ipAll = arms.reduce((a, id) => a + S.p[id][7], 0) || 1;
        const tot = { h: 0, bb: 0, k: 0, hr: 0 };
        for (const L of Object.values(O.p)) { tot.h += L[1]; tot.bb += L[5]; tot.k += L[6]; tot.hr += L[4]; }
        const result = S.rf > S.ra ? 1 : S.rf < S.ra ? -1 : 0;
        for (const id of arms) {
          const f = S.p[id][7] / ipAll;
          const a = agg[id] || (agg[id] = { g: 0, ip: 0, r: 0, h: 0, bb: 0, k: 0, hr: 0, p: 0, w: 0, l: 0, so: 0, cg: 0 });
          a.g++; a.ip += S.p[id][7]; a.r += S.ra * f; a.h += tot.h * f; a.bb += tot.bb * f; a.k += tot.k * f; a.hr += tot.hr * f; a.p += S.pc * f;
          if (arms.length === 1) { if (result > 0) a.w++; else if (result < 0) a.l++; if (S.ra === 0) a.so++; if (S.p[id][7] >= 9) a.cg++; }
        }
      }
      PIT.rows = Object.entries(agg).map(([id, a]) => ({ id, ...a })).sort((x, y) => y.ip - x.ip);
      PIT.state = "done"; PIT.games = recent.length; PIT.capped = games.filter(keepGame).length > recent.length;
    } catch (e) { PIT.state = "error"; }
    finally { PIT.busy = false; paintPitch(); }
  }
  function pitchPanel(host) {
    const m = location.hash.match(/^#\/team\/(\d+)/);
    if (!m) return;
    const team = Number(m[1]);
    let box = document.getElementById("sbx-pitch");
    if (!box) { box = document.createElement("div"); box.id = "sbx-pitch"; host.insertAdjacentElement("afterend", box); }
    if (PIT.team !== team || (!PIT.rows && !PIT.busy && PIT.state !== "error")) loadPitching(team);
    paintPitch();
  }
  function paintPitch() {
    const box = document.getElementById("sbx-pitch");
    if (!box) return;
    let html;
    if (PIT.state === "error") html = `<p class="sbx-muted">Couldn't read the box scores right now. Try again in a minute.</p>`;
    else if (!PIT.rows) html = `<p class="sbx-muted">Reading this season's box scores${PIT.total ? ` · ${PIT.n} of ${PIT.total} games` : ""}… Games are saved after the first read, so next time is quick.</p>`;
    else if (!PIT.rows.length) html = `<p class="sbx-muted">No pitching yet this season.</p>`;
    else {
      const f = (x, d = 2) => Number.isFinite(x) ? x.toFixed(d) : "–";
      const rows = PIT.rows.map((r) => {
        const who = PIT.names[r.id] || { name: "Player " + r.id };
        const ip = r.ip || 0;
        return `<tr><td>${esc(who.name)}${who.pos ? ` <span class="sbx-muted">${esc(who.pos)}</span>` : ` <span class="sbx-muted">bench</span>`}</td><td>${r.g}</td><td>${r.w}–${r.l}</td><td>${Math.round(ip)}</td><td><b>${f(9 * r.r / ip)}</b></td><td>${f((r.h + r.bb) / ip)}</td><td>${f(9 * r.h / ip, 1)}</td><td>${f(9 * r.bb / ip, 1)}</td><td>${f(9 * r.k / ip, 1)}</td><td>${f(9 * r.hr / ip, 1)}</td><td>${Math.round(r.k)}</td><td>${r.cg}</td><td>${r.so}</td><td>${r.g ? Math.round(r.p / r.g) : "–"}</td></tr>`;
      }).join("");
      html = `<div class="sbx-pitch-scroll"><table class="sbx-ptab"><thead><tr><th>Pitcher</th><th title="Games pitched">G</th><th title="Won–lost, in games he pitched alone">W–L</th><th title="Innings pitched">IP</th><th title="Runs allowed per 9 innings (all runs: the box score doesn't split out unearned runs)">RA/9</th><th title="Walks plus hits per inning">WHIP</th><th title="Hits per 9">H/9</th><th title="Walks per 9">BB/9</th><th title="Strikeouts per 9">K/9</th><th title="Home runs per 9">HR/9</th><th title="Strikeouts">K</th><th title="Complete games">CG</th><th title="Shutouts">SHO</th><th title="Pitches per game">P/G</th></tr></thead><tbody>${rows}</tbody></table></div>
        <p class="sbx-muted">This season, from ${PIT.games} box scores${PIT.capped ? " (the most recent 400)" : ""}. Runs allowed count every run, earned or not.</p>`;
    }
    if (box.dataset.h !== html) { box.dataset.h = html; box.innerHTML = html; }
  }

  // Compare: the club's stats over two ranges side by side, e.g. before and after your last training.
  // Training is spotted from your own clubs' box scores: when a man's skills jump between two games, you trained.
  const DAY = 864e5, CMP_KEY = "sbx-cmp-ranges", SK = ["P", "C", "T", "R", "BS", "BP", "BC"];
  const SK_NAME = { P: "Pitching", C: "Catching", T: "Throwing", R: "Running", BS: "Bat Skill", BP: "Bat Power", BC: "Bat Contact" };
  const RANGES = [
    ["since_train", "Since last training"], ["before_train", "The training before that"],
    ["d1", "Last 24 hours"], ["d3", "Last 3 days"], ["pd3", "The 3 days before that"],
    ["d7", "Last 7 days"], ["pd7", "The 7 days before that"], ["d10", "Last 10 days"],
    ["g25", "Last 25 games"], ["pg25", "The 25 games before that"], ["season", "This season"], ["custom", "Custom dates"]
  ];
  const CMP = { team: 0, busy: false, n: 0, total: 0, list: null, names: {}, mine: false, events: [], err: false, horizon: 0 };
  function cmpPrefs() {
    let p = {}; try { p = JSON.parse(localStorage.getItem(CMP_KEY) || "{}"); } catch (_) {}
    return p;
  }
  function cmpSave(p) { try { localStorage.setItem(CMP_KEY, JSON.stringify(p)); } catch (_) {} }
  async function loadCompare(team, days) {
    if (CMP.busy) return;
    CMP.busy = true; CMP.err = false;
    if (CMP.team !== team) { CMP.team = team; CMP.list = null; CMP.events = []; CMP.horizon = 0; }
    try {
      const prof = await getJSON(`/teams/${team}/profile`);
      CMP.mine = ownIds().has(String(team));
      CMP.trainedAt = Date.parse(prof.last_trained_at || 0) || 0;
      CMP.names = {}; for (const m of prof.roster || []) CMP.names[m.player_id] = { name: m.name, pos: m.position };
      const since = Date.now() - days * DAY;
      const list = await gamesSince(team, since, 900);
      CMP.total = list.length; CMP.n = 0; paintCompare();
      const ok = await fillBoxes(list.slice().reverse(), () => CMP.team === team, (n) => { CMP.n = n; paintCompare(); });
      if (!ok) return;
      CMP.list = list.map((g) => ({ id: g.game_id, f: Date.parse(g.finished_at), season: g.season_id, gm: g.good_match === true })).filter((g) => BOX[g.id]).sort((a, b) => a.f - b.f);
      CMP.horizon = days;
      CMP.events = CMP.mine ? trainingEvents(team, CMP.list) : [];
    } catch (_) { CMP.err = true; }
    finally { CMP.busy = false; paintCompare(); }
  }
  // A training = some man's skill rising 4+ points between two games in a row (forgetting only ever lowers them).
  function trainingEvents(team, list) {
    const ev = []; let prev = null;
    for (const g of list) {
      const [S] = sideOf(BOX[g.id], team);
      if (!S || !S.c) continue;
      if (prev) {
        const gains = {}; let men = 0;
        for (const [id, now] of Object.entries(S.c)) {
          const was = prev.c[id]; if (!was) continue;
          let any = false;
          now.forEach((v, i) => { const d = v - was[i]; if (d >= 4) { gains[SK[i]] = (gains[SK[i]] || 0) + d; any = true; } });
          if (any) men++;
        }
        if (men) ev.push({ from: prev.f, to: g.f, gains, men });
      }
      prev = { f: g.f, c: S.c };
    }
    return ev;
  }
  function rangeGames(key, prefs) {
    const L = (CMP.list || []).filter((g) => !goodOnly() || g.gm), now = Date.now(), ev = CMP.events;
    const since = (t) => L.filter((g) => g.f >= t), between = (a, b) => L.filter((g) => g.f >= a && g.f < b);
    const m = /^(p?)([dg])(\d+)$/.exec(key);
    if (key === "since_train") return ev.length ? since(ev[ev.length - 1].to) : CMP.trainedAt ? since(CMP.trainedAt) : [];
    if (key === "before_train") {
      if (!ev.length) return CMP.trainedAt ? L.filter((g) => g.f < CMP.trainedAt) : [];
      const last = ev[ev.length - 1], prevEv = ev[ev.length - 2];
      return between(prevEv ? prevEv.to : 0, last.to);
    }
    if (key === "season") { const sid = L.reduce((x, g) => Math.max(x, g.season || 0), 0); return L.filter((g) => g.season === sid); }
    if (key === "custom") {
      const a = Date.parse((prefs.from || "") + "T00:00"), b = Date.parse((prefs.to || "") + "T00:00") + DAY;
      return Number.isFinite(a) && Number.isFinite(b) ? between(a, b) : [];
    }
    if (m) {
      const n = Number(m[3]);
      if (m[2] === "d") return m[1] ? between(now - 2 * n * DAY, now - n * DAY) : since(now - n * DAY);
      return m[1] ? L.slice(Math.max(0, L.length - 2 * n), Math.max(0, L.length - n)) : L.slice(-n);
    }
    return [];
  }
  function rangeDays(key, prefs) {
    const m = /^(p?)d(\d+)$/.exec(key);
    if (m) return (m[1] ? 2 : 1) * Number(m[2]) + 1;
    if (key === "custom") { const a = Date.parse((prefs.from || "") + "T00:00"); return Number.isFinite(a) ? Math.ceil((Date.now() - a) / DAY) + 1 : 0; }
    return 0;
  }
  function aggRange(team, games) {
    const T = { g: 0, w: 0, l: 0, t: 0, rf: 0, ra: 0 }, bat = {}, pit = {}, card = {};
    for (const g of games) {
      const [S, O] = sideOf(BOX[g.id], team);
      if (!S || !O) continue;
      T.g++; T.rf += S.rf; T.ra += S.ra; if (S.rf > S.ra) T.w++; else if (S.rf < S.ra) T.l++; else T.t++;
      for (const [id, L] of Object.entries(S.p)) {
        const b = bat[id] || (bat[id] = { g: 0, ab: 0, h: 0, b2: 0, b3: 0, hr: 0, bb: 0, k: 0 });
        b.g++; b.ab += L[0]; b.h += L[1]; b.b2 += L[2]; b.b3 += L[3]; b.hr += L[4]; b.bb += L[5]; b.k += L[6];
      }
      const arms = Object.keys(S.p).filter((id) => S.p[id][7] > 0), ipAll = arms.reduce((a, id) => a + S.p[id][7], 0) || 1;
      const tot = { h: 0, bb: 0, k: 0 }; for (const L of Object.values(O.p)) { tot.h += L[1]; tot.bb += L[5]; tot.k += L[6]; }
      for (const id of arms) {
        const f = S.p[id][7] / ipAll, q = pit[id] || (pit[id] = { ip: 0, r: 0, h: 0, bb: 0, k: 0 });
        q.ip += S.p[id][7]; q.r += S.ra * f; q.h += tot.h * f; q.bb += tot.bb * f; q.k += tot.k * f;
      }
      if (S.c) for (const [id, c] of Object.entries(S.c)) card[id] = c;
    }
    return { T, bat, pit, card };
  }
  function cmpPanel(host) {
    const m = location.hash.match(/^#\/team\/(\d+)/);
    if (!m) return;
    const team = Number(m[1]);
    let box = document.getElementById("sbx-cmp");
    if (!box) {
      box = document.createElement("div"); box.id = "sbx-cmp"; host.insertAdjacentElement("afterend", box);
      box.addEventListener("change", (ev) => {
        const el = ev.target, p = cmpPrefs();
        if (el.dataset.r) p[el.dataset.r] = el.value;
        if (el.dataset.d) p[el.dataset.d] = el.value;
        cmpSave(p); box.dataset.h = ""; cmpNeed(team); paintCompare();
      });
    }
    cmpNeed(team);
    paintCompare();
  }
  function cmpNeed(team) {
    const p = cmpPrefs(), mine = ownIds().has(String(team));
    const a = p.a || (mine ? "before_train" : "pd7"), b = p.b || (mine ? "since_train" : "d7");
    const need = Math.min(60, Math.max(21, rangeDays(a, p), rangeDays(b, p)));
    if (!CMP.busy && (CMP.team !== team || (!CMP.list && !CMP.err) || need > CMP.horizon)) loadCompare(team, need);
  }
  function paintCompare() {
    if (document.getElementById("sbx-recap")) paintRecap();
    const box = document.getElementById("sbx-cmp");
    if (!box) return;
    const p = cmpPrefs(), team = CMP.team, mine = ownIds().has(String(team));
    const a = p.a || (mine ? "before_train" : "pd7"), b = p.b || (mine ? "since_train" : "d7");
    const opt = (sel) => RANGES.map(([k, label]) => `<option value="${k}" ${k === sel ? "selected" : ""} ${!mine && /train/.test(k) ? "disabled" : ""}>${label}${!mine && /train/.test(k) ? " (your clubs only)" : ""}</option>`).join("");
    const dates = (which) => `<span class="dates"><input type="date" data-d="from" value="${esc(p.from || "")}"> to <input type="date" data-d="to" value="${esc(p.to || "")}"></span>`;
    let html = `<div class="cmp-head"><label>Compare <select data-r="a">${opt(a)}</select></label><label>with <select data-r="b">${opt(b)}</select></label>${a === "custom" || b === "custom" ? dates() : ""}</div>`;
    if (CMP.err) html += `<p class="sbx-muted">Couldn't read the box scores right now. Try again in a minute.</p>`;
    else if (!CMP.list || CMP.busy) html += `<p class="sbx-muted">Reading box scores${CMP.total ? ` · ${CMP.n} of ${CMP.total} games` : ""}… They're saved after the first read, so next time is quick.</p>`;
    if (CMP.list && !CMP.busy) {
      const GA = rangeGames(a, p), GB = rangeGames(b, p), A = aggRange(team, GA), B = aggRange(team, GB);
      const fmt = (x, d) => Number.isFinite(x) ? (d === 3 ? x.toFixed(3).replace(/^0/, "") : x.toFixed(d)) : "–";
      const cell = (va, vb, d, goodUp, n) => {
        const ok = Number.isFinite(va) && Number.isFinite(vb), dl = ok ? vb - va : NaN;
        const cls = !ok || Math.abs(dl) < (d === 3 ? 0.0005 : 0.05) ? "" : (dl > 0) === goodUp ? "up" : "down";
        return `<td title="${fmt(va, d)} → ${fmt(vb, d)}"><span class="a">${fmt(va, d)}</span><span class="arr">→</span><b>${fmt(vb, d)}</b>${ok ? `<span class="dl ${cls}">${dl > 0 ? "+" : dl < 0 ? "−" : "±"}${fmt(Math.abs(dl), d)}</span>` : ""}${n ? `<span class="n">${n}</span>` : ""}</td>`;
      };
      const rec = (T) => `${T.w}–${T.l}${T.t ? "–" + T.t : ""}`;
      const lbl = (k) => (RANGES.find((r) => r[0] === k) || [k, k])[1];
      html += `<div class="cmp-sum"><span><b>${esc(lbl(a))}</b>: ${A.T.g} games, ${rec(A.T)}</span><span><b>${esc(lbl(b))}</b>: ${B.T.g} games, ${rec(B.T)}</span></div>`;
      if (mine && CMP.events.length) {
        const ev = CMP.events.slice(-3).reverse().map((e) => {
          const t = (x) => new Date(x).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
          const when = `between ${t(e.from)} and ${t(e.to)}`;
          const g = Object.entries(e.gains).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${SK_NAME[k]} +${v}`).join(", ");
          return `<li><b>Trained</b> ${when}: ${esc(g)} <span class="sbx-muted">(${e.men} ${e.men === 1 ? "man" : "men"})</span></li>`;
        }).join("");
        html += `<ul class="cmp-ev">${ev}</ul>`;
      } else if (mine) html += `<p class="sbx-muted">No training spotted in the games read so far${CMP.trainedAt ? `; the club page says last trained ${new Date(CMP.trainedAt).toLocaleDateString()}` : ""}.</p>`;
      if (!GA.length || !GB.length) html += `<p class="sbx-muted">${!GA.length ? esc(lbl(a)) : esc(lbl(b))} has no games yet.</p>`;
      else {
        const per = (T) => ({ rf: T.rf / T.g, ra: T.ra / T.g, wp: (T.w + T.t / 2) / T.g });
        const pa = per(A.T), pb = per(B.T);
        html += `<div class="sbx-pitch-scroll"><table class="sbx-ptab cmp"><thead><tr><th>Club</th><th>Win %</th><th>Runs for / game</th><th>Runs against / game</th></tr></thead><tbody><tr><td>All games</td>${cell(pa.wp, pb.wp, 3, true)}${cell(pa.rf, pb.rf, 2, true)}${cell(pa.ra, pb.ra, 2, false)}</tr></tbody></table></div>`;
        const ids = Object.keys(B.bat).sort((x, y) => (B.bat[y].ab - B.bat[x].ab));
        const rate = (o) => o ? { avg: o.h / o.ab, obp: (o.h + o.bb) / (o.ab + o.bb), slg: (o.h + o.b2 + 2 * o.b3 + 3 * o.hr) / o.ab, hr: o.hr / o.g, k: o.k / (o.ab + o.bb) } : {};
        const skillTxt = (id) => {
          const x = A.card[id], y = B.card[id]; if (!x || !y) return "";
          return y.map((v, i) => [SK[i], v - x[i]]).filter(([, d]) => Math.abs(d) >= 2).sort((u, v) => Math.abs(v[1]) - Math.abs(u[1])).map(([k, d]) => `<span class="${d > 0 ? "up" : "down"}">${k} ${d > 0 ? "+" : "−"}${Math.abs(d)}</span>`).join(" ");
        };
        const brow = ids.map((id) => {
          const ra = rate(A.bat[id]), rb = rate(B.bat[id]), who = CMP.names[id] || { name: "Player " + id };
          return `<tr><td>${esc(who.name)}${who.pos ? ` <span class="sbx-muted">${esc(who.pos)}</span>` : ""}</td>${cell(ra.avg, rb.avg, 3, true)}${cell(ra.obp, rb.obp, 3, true)}${cell(ra.slg, rb.slg, 3, true)}${cell(ra.hr, rb.hr, 2, true)}${cell(ra.k * 100, rb.k * 100, 1, false)}${mine ? `<td class="sk">${skillTxt(id)}</td>` : ""}</tr>`;
        }).join("");
        html += `<div class="sbx-pitch-scroll"><table class="sbx-ptab cmp"><thead><tr><th>Batting</th><th>AVG</th><th>OBP</th><th>SLG</th><th title="Home runs per game">HR / game</th><th title="Strikeouts per plate appearance">K %</th>${mine ? `<th title="Skills when each range ended">Skill change</th>` : ""}</tr></thead><tbody>${brow}</tbody></table></div>`;
        const pids = Object.keys(B.pit).sort((x, y) => B.pit[y].ip - B.pit[x].ip);
        if (pids.length) {
          const pr = (q) => q && q.ip ? { ra: 9 * q.r / q.ip, whip: (q.h + q.bb) / q.ip, k: 9 * q.k / q.ip, bb: 9 * q.bb / q.ip } : {};
          html += `<div class="sbx-pitch-scroll"><table class="sbx-ptab cmp"><thead><tr><th>Pitching</th><th>RA/9</th><th>WHIP</th><th>K/9</th><th>BB/9</th></tr></thead><tbody>` + pids.map((id) => {
            const x = pr(A.pit[id]), y = pr(B.pit[id]), who = CMP.names[id] || { name: "Player " + id };
            return `<tr><td>${esc(who.name)} <span class="sbx-muted">${Math.round(B.pit[id].ip)} IP</span></td>${cell(x.ra, y.ra, 2, false)}${cell(x.whip, y.whip, 2, false)}${cell(x.k, y.k, 1, true)}${cell(x.bb, y.bb, 1, false)}</tr>`;
          }).join("") + `</tbody></table></div>`;
        }
        html += `<p class="sbx-muted">Each cell reads first range → second range, with the change. Green is better, red is worse. Small ranges swing a lot, so treat a handful of games as a hint.</p>`;
      }
    }
    if (box.dataset.h !== html) { box.dataset.h = html; box.innerHTML = html; }
  }

  // Training Recap: one card per training session on your own clubs. Sessions are found in the box
  // scores (a man's skills jump between two games). Each card shows what each man gained, how much
  // he has kept since, and how the club played in the same number of games before and after.
  // What each skill should move. Every check is worked out for the men who trained that skill, plus a
  // club-wide line, from the box scores of the games before and after. These are the expected links;
  // the report tests them, it doesn't assume them.
  //   kind "p" = a share (x out of n), kind "r" = a count per unit (per game, per 9 innings…).
  const FX = {
    P: { why: "A sharper arm should miss more bats, walk fewer and give up less.", scope: "arms", checks: [
      { k: "k9", l: "Strikeouts / 9", up: true, kind: "r", f: (m) => [m.pk, m.ip, 9] },
      { k: "bb9", l: "Walks / 9", up: false, kind: "r", f: (m) => [m.pbb, m.ip, 9] },
      { k: "h9", l: "Hits allowed / 9", up: false, kind: "r", f: (m) => [m.ph, m.ip, 9] },
      { k: "ra9", l: "Runs allowed / 9", up: false, kind: "r", f: (m) => [m.pr, m.ip, 9] }] },
    C: { why: "Better hands should mean fewer errors and more balls turned into outs.", scope: "glove", checks: [
      { k: "erate", l: "Errors per chance", up: false, kind: "p", f: (m) => [m.e, m.po + m.a + m.e], d: 3 },
      { k: "po", l: "Putouts / game", up: true, kind: "r", f: (m) => [m.po, m.g, 1] },
      { k: "obabip", l: "Opponents' avg on balls in play", up: false, kind: "p", team: true, f: (m) => [m.oh - m.ohr, m.oab - m.ok - m.ohr], d: 3 },
      { k: "te", l: "Club errors / game", up: false, kind: "r", team: true, f: (m) => [m.te, m.tg, 1] }] },
    T: { why: "A stronger arm should turn more assists and double plays, with fewer bad throws.", scope: "glove", checks: [
      { k: "a", l: "Assists / game", up: true, kind: "r", f: (m) => [m.a, m.g, 1] },
      { k: "erate", l: "Errors per chance", up: false, kind: "p", f: (m) => [m.e, m.po + m.a + m.e], d: 3 },
      { k: "tdp", l: "Club double plays / game", up: true, kind: "r", team: true, f: (m) => [m.tdp, m.tg, 1] },
      { k: "tra", l: "Club runs allowed / game", up: false, kind: "r", team: true, f: (m) => [m.tra, m.tg, 1] }] },
    R: { why: "Speed should stretch hits into doubles and triples, beat out grounders and score men from base.", scope: "bats", checks: [
      { k: "xb", l: "Doubles + triples per hit", up: true, kind: "p", f: (m) => [m.b2 + m.b3, m.h], d: 3 },
      { k: "babip", l: "Avg on balls in play", up: true, kind: "p", f: (m) => [m.h - m.hr, m.ab - m.k - m.hr], d: 3 },
      { k: "rpb", l: "Club runs per man on base", up: true, kind: "r", team: true, f: (m) => [m.trf, m.th + m.tbb, 1], d: 3 }] },
    BS: { why: "A better eye should mean fewer strikeouts, more walks and more time on base.", scope: "bats", checks: [
      { k: "kp", l: "Strikeout %", up: false, kind: "p", f: (m) => [m.k, m.ab + m.bb], pct: true },
      { k: "bbp", l: "Walk %", up: true, kind: "p", f: (m) => [m.bb, m.ab + m.bb], pct: true },
      { k: "obp", l: "On-base %", up: true, kind: "p", f: (m) => [m.h + m.bb, m.ab + m.bb], d: 3 },
      { k: "trf", l: "Club runs / game", up: true, kind: "r", team: true, f: (m) => [m.trf, m.tg, 1] }] },
    BP: { why: "More power should show up as extra-base hits and home runs.", scope: "bats", checks: [
      { k: "hrp", l: "Home runs per at-bat", up: true, kind: "p", f: (m) => [m.hr, m.ab], d: 3 },
      { k: "xbh", l: "Extra-base hits per at-bat", up: true, kind: "p", f: (m) => [m.b2 + m.b3 + m.hr, m.ab], d: 3 },
      { k: "iso", l: "Isolated power (SLG − AVG)", up: true, kind: "r", f: (m) => [m.b2 + 2 * m.b3 + 3 * m.hr, m.ab, 1], d: 3 },
      { k: "trf", l: "Club runs / game", up: true, kind: "r", team: true, f: (m) => [m.trf, m.tg, 1] }] },
    BC: { why: "Better contact should cut strikeouts and lift the batting average.", scope: "bats", checks: [
      { k: "kp", l: "Strikeout %", up: false, kind: "p", f: (m) => [m.k, m.ab + m.bb], pct: true },
      { k: "avg", l: "Batting average", up: true, kind: "p", f: (m) => [m.h, m.ab], d: 3 },
      { k: "babip", l: "Avg on balls in play", up: true, kind: "p", f: (m) => [m.h - m.hr, m.ab - m.k - m.hr], d: 3 },
      { k: "trf", l: "Club runs / game", up: true, kind: "r", team: true, f: (m) => [m.trf, m.tg, 1] }] }
  };
  // Add up the box scores for a set of men (and the club) over some games.
  function fxAgg(team, games, ids) {
    const m = { g: 0, ab: 0, h: 0, b2: 0, b3: 0, hr: 0, bb: 0, k: 0, po: 0, a: 0, e: 0, dp: 0, ip: 0, pk: 0, pbb: 0, ph: 0, pr: 0,
      tg: 0, trf: 0, tra: 0, th: 0, tbb: 0, te: 0, tdp: 0, oab: 0, oh: 0, ohr: 0, ok: 0 };
    const want = ids ? new Set(ids.map(String)) : null;
    for (const g of games) {
      const [S, O] = sideOf(BOX[g.id], team); if (!S || !O) continue;
      m.tg++; m.trf += S.rf; m.tra += S.ra;
      const o = { ab: 0, h: 0, hr: 0, bb: 0, k: 0 };
      for (const L of Object.values(O.p)) { o.ab += L[0]; o.h += L[1]; o.hr += L[4]; o.bb += L[5]; o.k += L[6]; }
      m.oab += o.ab; m.oh += o.h; m.ohr += o.hr; m.ok += o.k;
      const ipAll = Object.values(S.p).reduce((x, L) => x + (L[7] || 0), 0) || 1;
      let played = false;
      for (const [id, L] of Object.entries(S.p)) {
        m.th += L[1]; m.tbb += L[5]; m.te += L[11]; m.tdp += L[12];
        if (want && !want.has(id)) continue;
        played = true;
        m.ab += L[0]; m.h += L[1]; m.b2 += L[2]; m.b3 += L[3]; m.hr += L[4]; m.bb += L[5]; m.k += L[6];
        m.po += L[9]; m.a += L[10]; m.e += L[11]; m.dp += L[12];
        if (L[7] > 0) { const f = L[7] / ipAll; m.ip += L[7]; m.pk += o.k * f; m.pbb += o.bb * f; m.ph += o.h * f; m.pr += S.ra * f; }
      }
      if (played) m.g++;
    }
    return m;
  }
  // One check: before → after, and how sure we can be the change is real rather than luck.
  // z compares the change to the normal game-to-game wobble for samples that size.
  function fxCheck(c, A, B) {
    const val = (m) => {
      const [x, n, sc] = c.f(m);
      if (!(n > 0)) return null;
      const v = x / n * (sc || 1);
      const se = c.kind === "p" ? Math.sqrt(Math.max(v * (1 - v), 0.25 / n) / n) : Math.sqrt(Math.max(x, 1)) / n * (sc || 1);
      return { v, se, n };
    };
    const a = val(A), b = val(B);
    if (!a || !b) return { c, a, b, z: 0, verdict: "none" };
    const z = (b.v - a.v) / Math.sqrt(a.se * a.se + b.se * b.se || 1), s = c.up ? z : -z;
    const small = Math.min(a.n, b.n) < (c.kind === "p" ? 40 : 8);
    const verdict = s >= 1.64 ? "yes" : s <= -1.64 ? "no" : small ? "early" : s >= 0.5 ? "lean" : s <= -0.5 ? "leanno" : "flat";
    return { c, a, b, z: s, verdict };
  }
  const FX_TXT = { yes: ["✓", "Showing"], lean: ["↗", "Leaning right"], flat: ["≈", "No clear change"], leanno: ["↘", "Leaning wrong"], no: ["✗", "Went the wrong way"], early: ["…", "Too early to tell"], none: ["–", "No data"] };
  function recapPanel(host) {
    const m = location.hash.match(/^#\/team\/(\d+)/);
    if (!m) return;
    const team = Number(m[1]);
    let box = document.getElementById("sbx-recap");
    if (!box) { box = document.createElement("div"); box.id = "sbx-recap"; host.insertAdjacentElement("afterend", box); }
    if (!CMP.busy && (CMP.team !== team || (!CMP.list && !CMP.err) || CMP.horizon < 21)) loadCompare(team, Math.max(21, CMP.team === team ? CMP.horizon : 0)).then(paintRecap);
    paintRecap();
  }
  function teamLine(team, games) {
    const t = { g: 0, w: 0, l: 0, rf: 0, ra: 0, ab: 0, h: 0, b2: 0, b3: 0, hr: 0, bb: 0 };
    for (const g of games) {
      const [S] = sideOf(BOX[g.id], team); if (!S) continue;
      t.g++; t.rf += S.rf; t.ra += S.ra; if (S.rf > S.ra) t.w++; else if (S.rf < S.ra) t.l++;
      for (const L of Object.values(S.p)) { t.ab += L[0]; t.h += L[1]; t.b2 += L[2]; t.b3 += L[3]; t.hr += L[4]; t.bb += L[5]; }
    }
    return { g: t.g, rec: `${t.w}–${t.l}${t.g - t.w - t.l ? "–" + (t.g - t.w - t.l) : ""}`, wp: t.g ? t.w / t.g : NaN, rf: t.rf / t.g, ra: t.ra / t.g, avg: t.h / t.ab, slg: (t.h + t.b2 + 2 * t.b3 + 3 * t.hr) / t.ab, hr: t.hr / t.g };
  }
  function cardAt(team, list, pred) {
    for (const g of list) { if (!pred(g)) continue; const [S] = sideOf(BOX[g.id], team); if (S && S.c) return S.c; }
    return null;
  }
  // TP a session used: from the kit's TP log when it saw both sides of the session, otherwise (latest
  // session only) estimated from where each man's TP sits now and when the session before it was.
  function tpFor(team, e, prevEv) {
    const L = (tpLogAll()[team] || {}).sessions || [];
    const hit = L.find((s) => s.at >= e.from - 36e5 && s.at <= e.to + 36e5);
    if (hit) return { total: hit.total, spent: hit.spent, trained: hit.trained, est: hit.gapH > 12 };
    const c = PROF[team]; if (!c || !c.data) return null;
    // When did he last start filling? The session before this one, or else the site's "last trained"
    // (Quick Trains don't move it, so it's the last full training).
    const lt = Date.parse(c.data.last_trained_at || 0) || 0;
    const lastT = prevEv ? (prevEv.from + prevEv.to) / 2 : lt && lt < e.from ? lt : 0;
    if (!lastT) return null;
    const d = c.data, now = Date.parse(d.server_time || "") || c.at, { R, max } = tpManRates(d), ts = [];
    for (const m of d.roster || []) { const r = R[m.player_id]; if (r && +m.tp < max - 1) ts.push([m.player_id, now - (+m.tp || 0) / r, r]); }
    if (!ts.length) return null;
    const mid = ts.map((x) => x[1]).sort((x, y) => x - y)[ts.length >> 1];
    if (mid < e.from - 36e5 || mid > e.to + 36e5) return null;
    const spent = {}; let total = 0;
    for (const [id, t, r] of ts) { if (Math.abs(t - mid) > 2 * 36e5) continue; const v = Math.min(max, r * (t - lastT)); spent[id] = Math.round(v); total += v; }
    return { total: Math.round(total), spent, trained: d.trained, est: true };
  }
  // Trainer or Quick Train? The trainer moves the club's "last trained" time; a Quick Train never does.
  // "qt": the kit saw "last trained" sitting before the session at a reading after it. "trainer": it moved
  // into the session's window. "": the kit wasn't watching closely enough to say.
  function sessionKind(team, e) {
    const from = (e.log ? e.log.from : e.from) - 36e5, to = (e.log ? e.log.to : e.to) + 36e5;
    const O = ((tpLogAll()[team] || {}).lto || []).slice();
    const d = PROF[team] && PROF[team].data; if (d) O.push([Date.parse(d.server_time || "") || PROF[team].at || Date.now(), Date.parse(d.last_trained_at || 0) || 0]);
    if (O.some(([, lt]) => lt && lt >= from && lt <= to)) return "trainer";
    const after = O.filter(([at]) => at >= to - 36e5).sort((a, b) => a[0] - b[0])[0];
    if (after && after[1] < from) return "qt";
    return "";
  }
  const FX_MIN = 3;
  // Each man's skills right now, from the club page.
  function profSkills(team) {
    const d = PROF[team] && PROF[team].data; if (!d || !Array.isArray(d.roster)) return null;
    const o = {}; for (const m of d.roster) o[m.player_id] = [m.pitch_skill, m.catch_skill, m.pass_power, m.run_speed, m.swing_skill, m.swing_power, m.contact_odds].map((v) => Math.round(+v || 0));
    return o;
  }
  // Sessions from the box scores, plus any the TP log caught that the box scores can't see yet
  // (no game on one side of it). Those carry their own before/after skills.
  function recapEvents(team) {
    const ev = CMP.mine ? CMP.events.slice() : [];
    for (const s of ((tpLogAll()[team] || {}).sessions || [])) {
      if (!s.before || !s.after) continue;
      if (ev.some((e) => s.from <= e.to + 36e5 && s.to >= e.from - 36e5 && (s.at >= e.from - 36e5 && s.at <= e.to + 36e5 || !s.total))) continue;
      const gains = {}; let men = 0;
      for (const [id, now] of Object.entries(s.after)) {
        const was = s.before[id]; if (!was) continue; let any = false;
        now.forEach((v, i) => { const dl = v - was[i]; if (dl >= 4) { gains[SK[i]] = (gains[SK[i]] || 0) + dl; any = true; } });
        if (any) men++;
      }
      if (men) ev.push({ from: s.at, to: s.at, gains, men, log: s });
    }
    return ev.sort((a, b) => a.to - b.to);
  }
  // Skill board: every man and every skill as a color grid, from the club page as it stands now.
  // Needs no games and no history, so a brand-new club gets the full picture straight away.
  const SITE_SK = ["pitch_skill", "catch_skill", "pass_power", "run_speed", "swing_skill", "swing_power", "contact_odds"];
  const POS_ORDER = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
  function skillBoard(team) {
    const d = PROF[team] && PROF[team].data; if (!d || !Array.isArray(d.roster)) return "";
    const tr = d.trained || {}, { max } = tpManRates(d);
    // Baseline for the change column: the kit's own record from 24 hours ago, else the skills on the
    // last game card from before then, else the kit's oldest record (and say since when).
    const now = Date.parse(d.server_time || "") || Date.now(), cut = now - 864e5;
    const K = (tpLogAll()[team] || {}).skh || [];
    let base = null, since = "";
    for (const k of K) if (k.at <= cut) base = k.sk;
    if (!base && CMP.team === team && CMP.list) base = cardAt(team, CMP.list.slice().reverse(), (g) => g.f <= cut);
    if (!base && K.length && now - K[0].at > 36e5) { base = K[0].sk; since = new Date(K[0].at).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" }); }
    const chg = (id, i, v) => { const b = base && base[id]; if (!b || b[i] == null) return ""; const dl = Math.round(v - b[i]); return dl ? `<sup class="${dl > 0 ? "up" : "dn"}">${dl > 0 ? "+" : "−"}${Math.abs(dl)}</sup>` : ""; };
    const men = d.roster.slice().sort((a, b) => (a.position ? POS_ORDER.indexOf(a.position) : 99) - (b.position ? POS_ORDER.indexOf(b.position) : 99) || a.slot - b.slot);
    // Colors run from 0 to the club's best number (at least 50), so a young club's spread still shows.
    const top = Math.max(50, ...d.roster.flatMap((m) => SITE_SK.map((k) => +m[k] || 0)));
    const cell = (v, hit, extra) => { const a = 0.08 + 0.82 * Math.max(0, Math.min(top, v)) / top; return `<td class="sb-c${hit ? " hit" : ""}" style="background:rgba(37,99,235,${a.toFixed(2)});${a > 0.5 ? "color:#fff" : ""}">${Math.round(v)}${extra || ""}</td>`; };
    const rows = men.map((m) => {
      const t = tr[m.player_id] || [], tp = +m.tp || 0;
      return `<tr><th>${esc(String(m.name).replace(/\*+$/, ""))}</th><td class="sb-pos">${m.position ? esc(m.position) : "bench"}</td>${SITE_SK.map((k, i) => cell(+m[k] || 0, t.includes(k), chg(m.player_id, i, +m[k] || 0))).join("")}
        <td class="sb-tp"><span class="sb-tpbar"><i style="width:${Math.round(tp / max * 100)}%"></i></span>${Math.round(tp)}</td></tr>`;
    }).join("");
    const starters = men.filter((m) => m.position), avg = (k, list) => list.length ? list.reduce((a, m) => a + (+m[k] || 0), 0) / list.length : 0;
    const avgChg = (k, i) => { if (!base) return ""; const L2 = starters.filter((m) => base[m.player_id]); if (!L2.length) return ""; const dl = L2.reduce((a, m) => a + (+m[k] || 0) - base[m.player_id][i], 0) / L2.length; return Math.abs(dl) >= 0.5 ? `<sup class="${dl > 0 ? "up" : "dn"}">${dl > 0 ? "+" : "−"}${Math.abs(dl).toFixed(1)}</sup>` : ""; };
    const foot = `<tr class="sb-avg"><th>Starters avg</th><td></td>${SITE_SK.map((k, i) => `<td>${Math.round(avg(k, starters))}${avgChg(k, i)}</td>`).join("")}<td></td></tr>`;
    const chgNote = base ? ` · <span class="up">+</span>/<span class="dn">−</span> = change ${since ? `since ${since}` : "in the last 24 hours"}` : ` · 24-hour change shows once the kit has a day of records`;
    const lastKs = [...new Set(Object.values(tr).flat().filter((x) => x !== "rest"))];
    return `<section class="sb-card"><h4>Skill board <span class="sbx-muted">· right now${lastKs.length ? ` · outlined = worked on in the last session` : ""}${chgNote}</span></h4>
      <div class="sbx-pitch-scroll"><table class="sb-grid"><thead><tr><th></th><th></th>${SK.map((k) => `<th title="${SK_NAME[k]}">${k}</th>`).join("")}<th>TP</th></tr></thead><tbody>${rows}</tbody><tfoot>${foot}</tfoot></table></div>
      <div class="sb-key"><span>0</span><i></i><span>${Math.round(top)}</span><span>· colors scale to this club's best skill</span></div></section>`;
  }
  // The site's own note of the last session ("trained"), placed in time by when everyone's TP ran out.
  // Shown when the kit didn't see that session itself (e.g. a club that's brand new to the kit).
  function siteSession(team, EV) {
    const d = PROF[team] && PROF[team].data; if (!d || !d.trained) return "";
    const ks = [...new Set(Object.values(d.trained).flat().filter((x) => x !== "rest"))]; if (!ks.length) return "";
    const now = Date.parse(d.server_time || "") || PROF[team].at, { R, max } = tpManRates(d), ts = [];
    for (const m of d.roster || []) { const r = R[m.player_id]; if (r && +m.tp < max - 1) ts.push(now - (+m.tp || 0) / r); }
    const at = ts.length ? ts.sort((a, b) => a - b)[ts.length >> 1] : 0;
    if (at && EV.some((e) => at >= e.from - 2 * 36e5 && at <= e.to + 2 * 36e5)) return "";
    const e = { from: at || now, to: at || now }, tp = at ? tpFor(team, e, null) : null;
    const names = ks.map((k) => SK_NAME[SK[SITE_SK.indexOf(k)]] || k), si = SITE_SK.indexOf(ks[0]);
    const men = (d.roster || []).filter((m) => (d.trained[m.player_id] || []).includes(ks[0])).map((m) => ({ id: m.player_id, v: Math.round(+m[ks[0]] || 0), name: String(m.name).replace(/\*+$/, "") })).sort((a, b) => b.v - a.v);
    const W = 640, rowH = 22, x0 = 150, bw = W - x0 - 130, X = (v) => x0 + Math.max(0, Math.min(100, v)) / 100 * bw;
    const bars = men.map((x, i) => { const y = 8 + i * rowH, tpm = tp && tp.spent && tp.spent[x.id] != null ? ` · ${tp.spent[x.id]} TP` : "";
      return `<g><text x="${x0 - 10}" y="${y + 13}" text-anchor="end" class="lb">${esc(x.name)}</text><rect x="${x0}" y="${y + 3}" width="${bw}" height="12" rx="6" class="track"/><rect x="${x0}" y="${y + 3}" width="${Math.max(2, X(x.v) - x0)}" height="12" rx="6" class="gain"/><text x="${X(100) + 8}" y="${y + 13}" class="vl">now <tspan class="g">${x.v}</tspan>${tpm}</text></g>`; }).join("");
    const when = at ? new Date(at).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
    const kind = names.length === 1 ? `${names[0]} training` : `Training: ${names.join(" and ")}`;
    return `<section class="rc-card"><header><span class="tag">${esc(kind)}</span><span class="when">${when ? "≈ " + when : ""}</span></header>
      <div class="rc-head"><span>${tp && tp.total ? `≈ ${tp.total.toLocaleString()} TP across ${men.length} men` : `${men.length} men`}</span><span class="pay early">From the site · gains not measured</span></div>
      ${men.length ? `<svg class="rc-bars" viewBox="0 0 ${W} ${16 + men.length * rowH}" role="img" aria-label="${esc(names[0])} now for each man who trained it">${bars}</svg>` : ""}
      <p class="sbx-muted">The site says this session worked on ${esc(names.join(" and "))}, but the kit hadn't read this club before it, so the before numbers aren't known. These bars show where each man is now. Every session from here on is tracked with full before → after.</p></section>`;
  }
  // Progress: the club's average in each skill over time, one small chart per skill. Builds up from
  // every visit to the club, so it's empty on day one and fills in as the club grows.
  function skillProgress(team) {
    const H = ((tpLogAll()[team] || {}).hist || []);
    if (H.length < 2) return `<section class="sb-card"><h4>Skill progress</h4><p class="sbx-muted">Starts today. Each time you open this club the kit notes its average in every skill; the charts appear after the next change.</p></section>`;
    const t0 = H[0].at, t1 = H[H.length - 1].at || t0 + 1, W = 150, Hh = 40;
    const tiles = SK.map((k, i) => {
      const vs = H.map((h) => h.v[i]), lo = Math.min(...vs), hi = Math.max(...vs), span = Math.max(4, hi - lo);
      const pts = H.map((h) => `${((h.at - t0) / Math.max(1, t1 - t0) * (W - 4) + 2).toFixed(1)},${(Hh - 4 - (h.v[i] - lo) / span * (Hh - 8)).toFixed(1)}`).join(" ");
      const dl = vs[vs.length - 1] - vs[0];
      return `<div class="sp-tile"><span class="k">${SK_NAME[k]}</span><span class="v">${vs[vs.length - 1].toFixed(0)}${Math.abs(dl) >= 0.5 ? ` <span class="${dl > 0 ? "up" : "down"}">${dl > 0 ? "+" : "−"}${Math.abs(dl).toFixed(1)}</span>` : ""}</span>
        <svg viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" aria-label="${SK_NAME[k]} club average over time"><polyline points="${pts}" fill="none" stroke="${dl < -0.4 ? "#f59e0b" : "#2563eb"}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg></div>`;
    }).join("");
    const since = new Date(t0).toLocaleDateString([], { month: "short", day: "numeric" });
    return `<section class="sb-card"><h4>Skill progress <span class="sbx-muted">· club average since ${since}</span></h4><div class="sp-grid">${tiles}</div></section>`;
  }
  function paintRecap() {
    const box = document.getElementById("sbx-recap");
    if (!box) return;
    const team = CMP.team;
    let html = "";
    if (CMP.err) html = `<p class="sbx-muted">Couldn't read the box scores right now. Try again in a minute.</p>`;
    else if (!CMP.list || CMP.busy) html = `<p class="sbx-muted">Reading box scores${CMP.total ? ` · ${CMP.n} of ${CMP.total} games` : ""}… They're saved after the first read, so next time is quick.</p>`;
    else if (!recapEvents(team).length) {
      const site = siteSession(team, []);
      html = `<h3 class="rc-title">Training</h3>${site || `<p class="sbx-muted">No training found yet. The kit spots each session from the box scores or from your TP dropping between visits to this club.</p>`}`;
    }
    else {
      const L = CMP.list.filter((g) => !goodOnly() || g.gm), all = CMP.list;
      const asc = all, desc = all.slice().reverse();
      const t = (x) => new Date(x).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      const f = (v, d) => Number.isFinite(v) ? (d === 3 ? v.toFixed(3).replace(/^(-?)0\./, "$1.") : v.toFixed(d)) : "–";
      const nm = (id) => (CMP.names[id] || { name: "Player " + id }).name.replace(/\*+$/, "");
      const EV = recapEvents(team);
      const nowCard = profSkills(team) || cardAt(team, desc, () => true);
      html += `<h3 class="rc-title">Training Effectiveness</h3><p class="sbx-muted">${EV.length} session${EV.length === 1 ? "" : "s"}, newest first. Each one checks the stats that skill should move, in the games before and after (once there are ${FX_MIN}+ games on each side).${goodOnly() ? " Good matches only." : ""}</p>`;
      html += siteSession(team, EV);
      html += EV.slice().reverse().map((e, idx, arr) => {
        const gains = Object.entries(e.gains).sort((a, b) => b[1] - a[1]);
        const total = gains.reduce((a, x) => a + x[1], 0), [main, mainGain] = gains[0];
        const how = sessionKind(team, e), focus = gains.filter(([, v], i) => i === 0 || v / total >= 0.2).slice(0, 2).map(([k]) => SK_NAME[k]).join(" and ");
        const kind = how === "qt" ? `⚡ Quick Train: ${focus}` : how === "trainer" ? `🏋️ Trainer: ${focus}` : `Training: ${focus}`;
        const kindTip = how === "qt" ? "A Quick Train: the club's \"last trained\" time didn't move." : how === "trainer" ? "The site's trainer: the club's \"last trained\" time moved to this session." : "Trainer or Quick Train? The kit can't tell for this one: it didn't read the club right before and after. It tells them apart from sessions it sees from now on.";
        const before = e.log ? e.log.before : cardAt(team, desc, (g) => g.f <= e.from), after = e.log ? e.log.after : cardAt(team, asc, (g) => g.f >= e.to);
        const nextEv = arr[idx - 1], prevEv = arr[idx + 1];
        const afterGames = L.filter((g) => g.f >= e.to && (!nextEv || g.f < nextEv.from));
        const beforeGames = L.filter((g) => g.f <= e.from && (!prevEv || g.f >= prevEv.to));
        const nRaw = Math.min(25, afterGames.length, beforeGames.length), n = nRaw >= FX_MIN ? nRaw : 0;
        const GA = beforeGames.slice(-n), GB = afterGames.slice(0, n), TA = teamLine(team, GA), TB = teamLine(team, GB);
        const tp = tpFor(team, e, prevEv);
        // Skills worth a section: the main one, plus any other that took 20%+ of the gain.
        const keys = gains.filter(([, v], i) => i === 0 || v / total >= 0.2).map(([k]) => k);
        let checksAll = [];
        const sections = keys.map((k) => {
          const si = SK.indexOf(k), fx = FX[k];
          const men = Object.keys(after || {}).filter((id) => before && before[id]).map((id) => ({ id, b: before[id][si], a: after[id][si], n: nowCard && nowCard[id] ? nowCard[id][si] : null, name: nm(id) }))
            .filter((x) => x.a - x.b >= 2).sort((x, y) => (y.a - y.b) - (x.a - x.b));
          let ids = men.map((x) => x.id);
          if (fx.scope === "arms") ids = ids.filter((id) => GA.concat(GB).some((g) => { const [S] = sideOf(BOX[g.id], team); return S && S.p[id] && S.p[id][7] > 0; }));
          const A = fxAgg(team, GA, ids), B = fxAgg(team, GB, ids);
          const checks = n ? fx.checks.filter((c) => c.team || ids.length).map((c) => fxCheck(c, A, B)) : [];
          checksAll = checksAll.concat(checks);
          // Bars: each man's skill before (grey), the gain (green), and anything he's forgotten since (amber).
          const W = 640, rowH = 22, x0 = 150, bw = W - x0 - 130, X = (v) => x0 + Math.max(0, Math.min(100, v)) / 100 * bw;
          const bars = men.map((x, i) => {
            const y = 8 + i * rowH, faded = x.n != null && x.n < x.a, tpm = tp && tp.spent && tp.spent[x.id] != null ? ` · ${tp.spent[x.id]} TP` : "";
            return `<g><text x="${x0 - 10}" y="${y + 13}" text-anchor="end" class="lb">${esc(x.name)}</text>
              <rect x="${x0}" y="${y + 3}" width="${bw}" height="12" rx="6" class="track"/>
              <rect x="${x0}" y="${y + 3}" width="${X(x.b) - x0}" height="12" rx="6" class="was"/>
              <rect x="${X(x.b)}" y="${y + 3}" width="${Math.max(2, X(x.a) - X(x.b))}" height="12" class="gain"/>
              ${faded ? `<rect x="${X(x.n)}" y="${y + 3}" width="${X(x.a) - X(x.n)}" height="12" class="lost"/>` : ""}
              <text x="${X(100) + 8}" y="${y + 13}" class="vl">${x.b} → <tspan class="g">${x.a}</tspan>${x.n != null && x.n !== x.a ? ` · now ${x.n}` : ""}${tpm}</text></g>`;
          }).join("");
          const svg = men.length ? `<svg class="rc-bars" viewBox="0 0 ${W} ${16 + men.length * rowH}" role="img" aria-label="${esc(SK_NAME[k])} before and after for each man">${bars}</svg>` : "";
          const rows = checks.map((r) => {
            const d = r.c.pct ? 1 : r.c.d || 2, sc = r.c.pct ? 100 : 1, [ic, word] = FX_TXT[r.verdict];
            const va = r.a ? r.a.v * sc : NaN, vb = r.b ? r.b.v * sc : NaN, dl = vb - va;
            const pos = Math.max(-3, Math.min(3, r.z)) / 3 * 50;
            const cls = r.verdict === "yes" || r.verdict === "lean" ? "up" : r.verdict === "no" || r.verdict === "leanno" ? "down" : "";
            return `<div class="fx-row"><span class="fx-l">${esc(r.c.l)}${r.c.team ? ` <span class="sbx-muted">club</span>` : ""}</span>
              <span class="fx-v"><span class="a">${f(va, d)}${r.c.pct ? "%" : ""}</span> → <b>${f(vb, d)}${r.c.pct ? "%" : ""}</b>${Number.isFinite(dl) ? ` <span class="${cls}">${dl > 0 ? "+" : dl < 0 ? "−" : "±"}${f(Math.abs(dl), d)}</span>` : ""}</span>
              <span class="fx-m" title="How far the change is beyond normal game-to-game swing (right = the way training should push it)"><i class="mid"></i><i class="bar ${cls}" style="${pos >= 0 ? `left:50%;width:${pos}%` : `left:${50 + pos}%;width:${-pos}%`}"></i></span>
              <span class="fx-c ${r.verdict}">${ic} ${word}</span></div>`;
          }).join("");
          const who = fx.scope === "arms" ? `${ids.length} pitcher${ids.length === 1 ? "" : "s"} who trained it` : `the ${ids.length} men who trained it`;
          const legend = men.length ? `<div class="legend"><i class="was"></i>before <i class="gain"></i>gained${men.some((x) => x.n != null && x.n < x.a) ? ` <i class="lost"></i>forgotten since` : ""}</div>` : "";
          return `<div class="fx-sec"><h4>${esc(SK_NAME[k])} <span class="g">+${e.gains[k]}</span></h4>${svg}${legend}
            ${n ? `<p class="fx-why">${esc(fx.why)} <span class="sbx-muted">Checked on ${who}${fx.checks.some((c) => c.team) ? ", plus the club" : ""}.</span></p><div class="fx">${rows}</div>` : ""}</div>`;
        }).join("");
        // Headline: TP in, skill out, and how many of the expected stats moved the right way.
        const right = checksAll.filter((r) => r.verdict === "yes" || r.verdict === "lean").length, clear = checksAll.filter((r) => r.verdict === "yes").length;
        const wrong = checksAll.filter((r) => r.verdict === "no").length, judged = checksAll.filter((r) => r.verdict !== "none" && r.verdict !== "early").length;
        const tpTxt = tp && tp.total ? `${tp.est ? "≈ " : ""}${tp.total.toLocaleString()} TP → <b>+${total}</b> skill points <span class="sbx-muted">(${Math.round(total / tp.total * 100)} per 100 TP)</span>` : `<b>+${total}</b> skill points <span class="sbx-muted">· TP not logged for this one</span>`;
        const pay = !n ? `<span class="pay early">Gains only · ${!afterGames.length ? "no games since yet" : !beforeGames.length ? "no games before it to compare" : `${afterGames.length} game${afterGames.length === 1 ? "" : "s"} since, checks start at ${FX_MIN}`}</span>` : !judged ? `<span class="pay early">Too early to tell</span>` : `<span class="pay ${clear && !wrong ? "yes" : wrong > right ? "no" : "lean"}">${right} of ${checksAll.length} checks moving the right way${clear ? ` · ${clear} clearly` : ""}${wrong ? ` · ${wrong} the wrong way` : ""}</span>`;
        const tiles = n ? `<div class="tiles">${[["Win %", TA.wp, TB.wp, 3, true], ["Runs for / game", TA.rf, TB.rf, 2, true], ["Runs against / game", TA.ra, TB.ra, 2, false]].map(([l, va, vb, d, up]) => {
            const ok = Number.isFinite(va) && Number.isFinite(vb), dl = ok ? vb - va : 0, cls = !ok || Math.abs(dl) < (d === 3 ? 0.0005 : 0.05) ? "" : (dl > 0) === up ? "up" : "down";
            return `<div class="tile"><span class="k">${l}</span><span class="v"><span class="a">${f(va, d)}</span> → <b>${f(vb, d)}</b></span>${ok ? `<span class="d ${cls}">${dl > 0 ? "+" : dl < 0 ? "−" : "±"}${f(Math.abs(dl), d)}</span>` : ""}</div>`;
          }).join("")}</div><p class="sbx-muted">${n} games before vs ${n} after (${TA.rec} → ${TB.rec}). Opponents change from game to game, so the checks only call a change once it's bigger than normal swing; "Leaning" means the right direction but not proven yet.</p>`
          : `<p class="sbx-muted">${!afterGames.length ? "No games since this session yet." : !beforeGames.length ? "No games before this session to compare with." : `Only ${afterGames.length} game${afterGames.length === 1 ? "" : "s"} since this session.`} The game checks fill in once there are ${FX_MIN} games on each side.</p>`;
        const other = gains.filter(([k]) => !keys.includes(k)).map(([k, v]) => `${SK_NAME[k]} +${v}`).join(" · ");
        return `<section class="rc-card"><header><span class="tag" title="${esc(kindTip)}">${esc(kind)}</span><span class="when">${e.log ? `${e.log.total ? "≈ " : "between " + t(e.log.from) + " and "}${t(e.log.total ? e.at || e.from : e.log.to)}` : `${t(e.from)} – ${t(e.to)}`}</span></header>
          <div class="rc-head"><span>${tpTxt} across ${e.men} ${e.men === 1 ? "man" : "men"}</span>${pay}</div>
          ${sections}${other ? `<p class="sbx-muted">Also: ${esc(other)}</p>` : ""}
          ${tiles}</section>`;
      }).join("");
    }
    html = skillBoard(team) + (PRIVATE_PASSIVE ? PRIVATE_PASSIVE.html(team) : "") + html + skillProgress(team);
    if (box.dataset.h !== html) { box.dataset.h = html; box.innerHTML = html; }
  }
  function squadView(t) {
    const h = Array.from(document.querySelectorAll("main h2")).find((x) => /^\s*the squad/i.test(x.textContent));
    const hr = t.querySelector("thead tr");
    if (!h || !hr) return;
    // Each new club opens on Skills; switching views on the same club sticks while you stay on it.
    const tid = (location.hash.match(/^#\/team\/(\d+)/) || [])[1] || "";
    if (tid !== squadView.team) { squadView.team = tid; try { localStorage.setItem(SQUAD_VIEW, "skills"); } catch (_) {} }
    let view = "skills"; try { view = localStorage.getItem(SQUAD_VIEW) || "skills"; } catch (_) {}
    let seg = h.querySelector(".sbx-seg");
    if (!seg) {
      seg = document.createElement("span");
      seg.className = "sbx-seg";
      seg.innerHTML = `<button type="button" data-v="skills">Skills</button><button type="button" data-v="stats">Stats</button><button type="button" data-v="all">All</button>${on("pitching") ? `<button type="button" data-v="pitch">Pitching</button>` : ""}${on("compare") ? `<button type="button" data-v="compare">Compare</button>` : ""}${on("recap") && ownIds().has(String((location.hash.match(/^#\/team\/(\d+)/) || [])[1])) ? `<button type="button" data-v="recap">Training</button>` : ""}`;
      h.appendChild(seg);
      seg.insertAdjacentHTML("afterend", goodToggle());
      seg.onclick = (ev) => {
        const b = ev.target.closest("button[data-v]"); if (!b) return;
        ev.stopPropagation();
        try { localStorage.setItem(SQUAD_VIEW, b.dataset.v); } catch (_) {}
        squadView(t);
      };
    }
    const mineHere = ownIds().has(String((location.hash.match(/^#\/team\/(\d+)/) || [])[1]));
    if ((view === "pitch" && !on("pitching")) || (view === "compare" && !on("compare")) || (view === "recap" && (!on("recap") || !mineHere))) view = "skills";
    for (const b of seg.querySelectorAll("button")) b.classList.toggle("on", b.dataset.v === view);
    // Pitching swaps the squad table for the season pitching table.
    const host = t.closest(".scroll") || t;
    if (view === "pitch" || view === "compare" || view === "recap") {
      if (host.style.display !== "none") host.style.display = "none";
      for (const [v, id] of [["pitch", "sbx-pitch"], ["compare", "sbx-cmp"], ["recap", "sbx-recap"]]) if (v !== view) document.getElementById(id)?.remove();
      if (view === "pitch") pitchPanel(host); else if (view === "compare") cmpPanel(host); else recapPanel(host);
      return;
    }
    if (host.style.display === "none") host.style.display = "";
    document.getElementById("sbx-pitch")?.remove();
    document.getElementById("sbx-cmp")?.remove();
    document.getElementById("sbx-recap")?.remove();
    // Name and everything before it always show; skill columns up to BC; stats after.
    const heads = Array.from(hr.children).map((th) => th.textContent.replace(/\?/g, "").trim());
    // Skills run from just after Name through BC; Mood goes with them; the rest are stats
    // (the stats have their own "TP", triple plays, so only the first one counts).
    const nameAt = heads.indexOf("Name"), bcAt = heads.indexOf("BC");
    if (nameAt < 0 || bcAt < 0) return;
    const cells = Array.from(hr.children);
    const kind = heads.map((x, i) => i <= nameAt ? "" : i <= bcAt || x === "Mood" || cells[i].classList.contains("sbx-tpth") ? "skill" : "stat");
    const key = kind.join(",");
    for (const row of t.querySelectorAll("tr")) {
      if (row.dataset.sbxCols === key && row.children[nameAt + 1] && row.children[nameAt + 1].dataset.sbxcol) continue;
      row.dataset.sbxCols = key;
      Array.from(row.children).forEach((cell, i) => { if (kind[i]) cell.dataset.sbxcol = kind[i]; else delete cell.dataset.sbxcol; });
    }
    t.classList.toggle("sbx-v-skills", view === "skills");
    t.classList.toggle("sbx-v-stats", view === "stats");
  }
  function mountSquad() {
    const t = document.querySelector("main table.squad");
    if (!t) return;
    const m = location.hash.match(/^#\/team\/(\d+)/);
    const mine = !!(m && ownIds().has(m[1]));
    const team = m ? Number(m[1]) : null;
    const c = mine ? PROF[team] : null;
    if (mine && (!c || Date.now() - c.at > 60000) && !SQ.busy) {
      SQ.busy = true;
      profileOf(team, 60000).catch(() => {}).finally(() => { SQ.busy = false; setTimeout(tick, 0); });
    }
    const byId = {};
    if (c && c.data && Array.isArray(c.data.roster)) for (const p of c.data.roster) byId[String(p.player_id)] = p;
    if (on("grades")) gradeSquad(t, c ? byId : null);
    if (on("squadtp") && c) squadTp(t, c, byId);
    if (on("mood")) moodFaces(t);
    if (on("squadview")) squadView(t);
    goodStats(t, team);
  }
  // Good matches only, in the squad's Stats columns: the site shows career totals, so with the switch
  // on, the kit swaps in this season's numbers from good-match box scores (and puts the site's back after).
  const GS = { team: 0, busy: false, rows: null, games: 0, n: 0, total: 0 };
  async function loadGoodStats(team) {
    if (GS.busy) return;
    GS.busy = true; GS.team = team; GS.rows = null; GS.n = 0;
    try {
      const games = (await seasonGames(team)).filter((g) => g.finished_at && g.good_match === true).slice(0, 400);
      GS.total = games.length;
      const ok = await fillBoxes(games, () => GS.team === team && goodOnly(), (n) => { GS.n = n; setTimeout(tick, 0); });
      if (!ok) return;
      const agg = {};
      for (const g of games) {
        const [S] = sideOf(BOX[g.game_id], team); if (!S) continue;
        for (const [id, L] of Object.entries(S.p)) {
          const a = agg[id] || (agg[id] = { g: 0, ab: 0, h: 0, b2: 0, b3: 0, hr: 0, bb: 0, k: 0, rbi: 0, po: 0, a: 0, e: 0, dp: 0, full: true });
          a.g++; a.ab += L[0]; a.h += L[1]; a.b2 += L[2]; a.b3 += L[3]; a.hr += L[4]; a.bb += L[5]; a.k += L[6];
          if (L.length > 8) { a.rbi += L[8]; a.po += L[9]; a.a += L[10]; a.e += L[11]; a.dp += L[12]; } else a.full = false;
        }
      }
      GS.rows = agg; GS.games = games.length;
    } catch (_) { GS.rows = {}; }
    finally { GS.busy = false; setTimeout(tick, 0); }
  }
  function goodStats(t, team) {
    const host = t.closest(".scroll") || t;
    let note = document.getElementById("sbx-gs-note");
    const hr = t.querySelector("thead tr");
    const heads = hr ? Array.from(hr.children).map((th) => th.textContent.replace(/\?/g, "").trim()) : [];
    const restore = () => {
      note?.remove();
      for (const td of t.querySelectorAll("td[data-sbx-orig]")) { td.textContent = td.dataset.sbxOrig; delete td.dataset.sbxOrig; delete td.dataset.sbxGs; }
    };
    if (!goodOnly() || !team || !hr) { restore(); return; }
    if (GS.team !== team || (!GS.rows && !GS.busy)) loadGoodStats(team);
    if (!note) { note = document.createElement("div"); note.id = "sbx-gs-note"; host.insertAdjacentElement("beforebegin", note); }
    note.style.display = host.style.display === "none" ? "none" : "";
    const msg = !GS.rows ? `Good matches only: reading this season's box scores${GS.total ? ` · ${GS.n} of ${GS.total}` : ""}… The stats below are the site's career totals until it's done.`
      : `Stats columns: this season, good matches only (${GS.games} games). Sorting by a column still uses the site's career numbers.`;
    if (note.textContent !== msg) note.textContent = msg;
    if (!GS.rows) return;
    const f3 = (x) => Number.isFinite(x) ? x.toFixed(3).replace(/^0/, "") : "–";
    const col = {}; heads.forEach((h, i) => { if (!(h in col)) col[h] = i; });
    const statTP = Array.from(hr.children).findIndex((th) => th.textContent.replace(/\?/g, "").trim() === "TP" && !th.classList.contains("sbx-tpth"));
    for (const tr of t.querySelectorAll("tr.man")) {
      const a = GS.rows[tr.dataset.pid] || { g: 0, ab: 0, h: 0, b2: 0, b3: 0, hr: 0, bb: 0, k: 0, rbi: 0, po: 0, a: 0, e: 0, dp: 0, full: true };
      const ch = a.po + a.a + a.e;
      const vals = {
        G: a.g, AB: a.ab, H: a.h, "2B": a.b2, "3B": a.b3, HR: a.hr, RBI: a.full ? a.rbi : "–", BB: a.bb, K: a.k,
        AVG: f3(a.h / a.ab), OBP: f3((a.h + a.bb) / (a.ab + a.bb)), SLG: f3((a.h + a.b2 + 2 * a.b3 + 3 * a.hr) / a.ab),
        "PO+A": a.full ? a.po + a.a : "–", E: a.full ? a.e : "–", FLD: a.full && ch ? f3((a.po + a.a) / ch) : "–", DP: a.full ? a.dp : "–"
      };
      for (const [h, v] of Object.entries(vals)) {
        const i = col[h]; if (i == null) continue;
        const td = tr.children[i]; if (!td || td.classList.contains("sbx-tp")) continue;
        if (td.dataset.sbxOrig == null) td.dataset.sbxOrig = td.textContent;
        const txt = String(v);
        if (td.textContent !== txt) td.textContent = txt;
        td.dataset.sbxGs = "1";
      }
      // Triple plays aren't in the box score.
      if (statTP >= 0) { const td = tr.children[statTP]; if (td && !td.classList.contains("sbx-tp")) { if (td.dataset.sbxOrig == null) td.dataset.sbxOrig = td.textContent; if (td.textContent !== "–") td.textContent = "–"; } }
    }
  }
  function squadTp(t, c, byId) {
    const hr = t.querySelector("thead tr");
    // The TP column goes at the END of each row: the site sorts by column position, so a column
    // inserted in the middle would make every header after it sort the wrong data.
    if (hr && !hr.querySelector(".sbx-tpth")) {
      const th = document.createElement("th"); th.className = "sbx-tpth"; th.textContent = "TP";
      th.title = "Training points. Starters refill in 48 hours, the bench in 24. A Quick Train spends them all.";
      hr.appendChild(th);
    }
    const minute = Math.floor(Date.now() / 60000);
    for (const tr of t.querySelectorAll("tr.man")) {
      const p = byId[tr.dataset.pid];
      let td = tr.querySelector("td.sbx-tp");
      if (!td) { td = document.createElement("td"); td.className = "sbx-tp"; tr.appendChild(td); }
      else if (td !== tr.lastElementChild) tr.appendChild(td);
      if (!p) { if (td.innerHTML) td.innerHTML = ""; continue; }
      const tp = Math.max(0, Math.min(100, +p.tp || 0)), bench = !p.position;
      const h = (100 - tp) / (bench ? NOMINAL.b : NOMINAL.s), full = h <= 0.05;
      const k = `${c.at}|${minute}|${Math.round(tp)}`;
      if (td.dataset.k === k) continue;
      td.dataset.k = k;
      td.title = full ? "Full: refill is on hold until you train" : `${Math.round(tp)} of 100 TP · full ${whenAt(h)}`;
      td.innerHTML = `<div class="sbx-tpcell${full ? " full" : ""}"><span class="bar"><i style="width:${tp}%"></i></span><span class="v">${Math.round(tp)}</span></div><div class="sbx-tpwhen">${full ? "FULL" : whenAt(h, true)}</div>`;
    }
  }


  // Team notes: a board of sticky notes on every club page, saved per club in the browser
  // (extension storage on desktop, so clearing the site's data doesn't wipe them).
  let NOTES = null;
  const NOTE_COLORS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#fed7aa"];
  function notesLoad(cb) {
    if (NOTES) return cb();
    if (hasChromeStorage) chrome.storage.local.get(["sbxNotes"], (r) => { NOTES = (r && r.sbxNotes) || {}; cb(); });
    else { NOTES = lsGet().sbxNotes || {}; cb(); }
  }
  let notesTimer = 0;
  function notesSave() {
    clearTimeout(notesTimer);
    notesTimer = setTimeout(() => { if (hasChromeStorage) chrome.storage.local.set({ sbxNotes: NOTES }); else lsSet({ sbxNotes: NOTES }); }, 400);
  }
  function mountNotes() {
    const m = location.hash.match(/^#\/team\/(\d+)/);
    const old = document.getElementById("sbx-notes");
    if (!m) { old?.remove(); return; }
    const team = m[1];
    if (old && old.dataset.team === team && old.isConnected) return;
    const anchor = Array.from(document.querySelectorAll("main h2")).find((x) => /^\s*the squad/i.test(x.textContent));
    if (!anchor) return;
    notesLoad(() => {
      if (document.getElementById("sbx-notes")?.dataset.team === team) return;
      document.getElementById("sbx-notes")?.remove();
      const el = document.createElement("details");
      el.id = "sbx-notes"; el.dataset.team = team;
      try { el.open = localStorage.getItem("sbx-notes-open") === "1"; } catch (_) {}
      anchor.insertAdjacentElement("beforebegin", el);
      paintNotes(el, team);
      el.addEventListener("toggle", () => { try { localStorage.setItem("sbx-notes-open", el.open ? "1" : "0"); } catch (_) {} });
      el.addEventListener("input", (ev) => {
        const ta = ev.target.closest("textarea[data-n]"); if (!ta) return;
        const n = (NOTES[team] || []).find((x) => x.id === ta.dataset.n); if (!n) return;
        n.text = ta.value; n.at = Date.now(); notesSave();
        ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px";
        const st = ta.closest(".sbx-note").querySelector(".nt-at"); if (st) st.textContent = "edited just now";
      });
      el.addEventListener("click", (ev) => {
        const b = ev.target.closest("button[data-act]"); if (!b) return;
        ev.preventDefault();
        const list = NOTES[team] || (NOTES[team] = []), id = b.dataset.n, n = list.find((x) => x.id === id);
        if (b.dataset.act === "add") { const nn = { id: Date.now().toString(36), text: "", at: Date.now(), c: list.length % NOTE_COLORS.length }; list.unshift(nn); notesSave(); paintNotes(el, team); el.querySelector(`textarea[data-n="${nn.id}"]`)?.focus(); }
        else if (b.dataset.act === "color" && n) { n.c = ((n.c || 0) + 1) % NOTE_COLORS.length; notesSave(); paintNotes(el, team); }
        else if (b.dataset.act === "pin" && n) { n.pin = !n.pin; notesSave(); paintNotes(el, team); }
        else if (b.dataset.act === "del" && n) {
          // Two taps to delete, no pop-up: the first turns the button into "Delete?".
          if (b.dataset.armed) { NOTES[team] = list.filter((x) => x !== n); if (!NOTES[team].length) delete NOTES[team]; notesSave(); paintNotes(el, team); }
          else { b.dataset.armed = "1"; b.textContent = "Delete?"; setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = "✕"; } }, 3000); }
        }
        else if (b.dataset.act === "copy") {
          const txt = list.map((x) => `${new Date(x.at).toLocaleDateString()}\n${x.text}`).join("\n\n---\n\n");
          navigator.clipboard?.writeText(txt).then(() => { b.textContent = "Copied"; setTimeout(() => { b.textContent = "Copy all"; }, 1500); }).catch(() => {});
        }
      });
    });
  }
  function paintNotes(el, team) {
    const list = (NOTES[team] || []).slice().sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || b.at - a.at);
    const ago = (t) => { const h = (Date.now() - t) / 36e5; return h < 1 ? "edited just now" : h < 24 ? `edited ${Math.round(h)} h ago` : new Date(t).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }); };
    el.innerHTML = `<summary>📝 Team notes${list.length ? ` <span class="nt-n">${list.length}</span>` : ""}</summary>
      <div class="nt-bar"><button type="button" data-act="add">＋ New note</button>${list.length ? `<button type="button" data-act="copy">Copy all</button>` : ""}<span class="sbx-muted">Saved in this browser, just for you.</span></div>
      <div class="nt-board">${list.map((n) => `<div class="sbx-note" style="--nc:${NOTE_COLORS[n.c || 0]}">
        <textarea data-n="${n.id}" rows="4" placeholder="Lineup ideas, who to train next, opponents to watch…">${esc(n.text)}</textarea>
        <div class="nt-foot"><span class="nt-at">${n.pin ? "📌 " : ""}${ago(n.at)}</span><button type="button" data-act="pin" data-n="${n.id}" title="${n.pin ? "Unpin" : "Pin to the front"}">📌</button><button type="button" data-act="color" data-n="${n.id}" title="Change color">🎨</button><button type="button" data-act="del" data-n="${n.id}" title="Delete">✕</button></div></div>`).join("") || `<p class="sbx-muted">No notes yet for this club.</p>`}</div>`;
    el.querySelectorAll("textarea").forEach((ta) => { ta.style.height = "auto"; ta.style.height = Math.max(90, ta.scrollHeight) + "px"; });
  }

  // 5. Logos: a big one by the club name on its page, plus Add / Change / Remove buttons.
  function ownIds() {
    const sel = document.getElementById("who-team");
    return new Set(sel ? Array.from(sel.options).map((o) => o.value) : []);
  }
  function decorate() {
    // Your club page: a big logo by the club's name, plus Set / Remove buttons.
    const m = location.hash.match(/^#\/team\/(\d+)/);
    const id = m && m[1];
    const h1 = document.querySelector("main h1");
    if (!id || !h1 || !ownIds().has(id)) { document.getElementById("sbx-logo-ctl")?.remove(); return; }
    const head = h1.querySelector("img.sbx-logo-head");
    if (head && head.dataset.club !== id) head.remove();
    if (LOGOS[id] && !h1.querySelector("img.sbx-logo-head")) {
      h1.insertAdjacentHTML("afterbegin", logoImg(id, "sbx-logo-head"));
      h1.querySelector("img.sbx-logo-head").dataset.club = id;
    }
    let ctl = document.getElementById("sbx-logo-ctl");
    if (ctl && ctl.dataset.club !== id + "|" + !!LOGOS[id]) { ctl.remove(); ctl = null; }
    if (!ctl) {
      ctl = document.createElement("span");
      ctl.id = "sbx-logo-ctl";
      ctl.dataset.club = id + "|" + !!LOGOS[id];
      ctl.innerHTML = `<button type="button" data-act="set">${LOGOS[id] ? "Change logo" : "Add logo"}</button>${LOGOS[id] ? '<button type="button" data-act="del">Remove</button>' : ""}`;
      h1.insertAdjacentElement("afterend", ctl);
      const file = document.createElement("input");
      file.type = "file"; file.accept = "image/*"; file.id = "sbx-logo-file"; file.hidden = true;
      file.setAttribute("aria-label", "Choose a logo image");
      ctl.appendChild(file);
      file.onchange = async () => {
        const f = file.files && file.files[0];
        if (!f) return;
        try { saveLogo(id, await standardize(f)); } catch (e) { const b = ctl.querySelector('[data-act="set"]'); if (b) b.textContent = "Could not read that image"; }
      };
      ctl.querySelector('[data-act="set"]').onclick = () => file.click();
      const del = ctl.querySelector('[data-act="del"]');
      if (del) del.onclick = () => saveLogo(id, null);
    }
  }

  // 6. Records by stadium, shown in the Stadiums section of your own club pages.
  //    Owned stadiums get their record on their own card; stadiums you've only visited get matching cards.
  const PARK_CACHE = "sbx-park-cache-v1"; // game_id -> park_id. A game's stadium never changes.
  const readParkCache = () => { try { return JSON.parse(localStorage.getItem(PARK_CACHE) || "{}"); } catch (_) { return {}; } };
  const writeParkCache = (c) => { try { localStorage.setItem(PARK_CACHE, JSON.stringify(c)); } catch (_) {} };
  let othersPref = "cards"; try { othersPref = localStorage.getItem("sbx-others") || "cards"; } catch (_) {}
  const PR = { team: null, scope: "season", kind: goodOnly() ? "good" : "all", others: othersPref, rows: null, loading: false, status: "", homePark: null, season: 0 };

  async function loadParkRows(team, scope) {
    const prof = await getJSON(`/teams/${team}/profile`);
    if (prof.mine === false) throw new Error("not your club");
    PR.homePark = prof.home_park_id;
    const rows = [];
    let next = null, pages = 0, season = 0;
    do {
      const qs = new URLSearchParams({ club: String(team) });
      if (next) qs.set("before", next);
      const d = await getJSON("/games/all?" + qs.toString());
      const mine = (d.rows || []).filter((g) => g.home_team_id === team || g.away_team_id === team);
      if (!season) season = mine.reduce((m, g) => Math.max(m, g.season_id || 0), 0);
      const keep = scope === "all" ? mine : mine.filter((g) => g.season_id === season);
      rows.push(...keep);
      next = (scope !== "all" && mine.some((g) => g.season_id !== season)) ? null : d.next;
      pages++;
      PR.status = `Reading your games… ${rows.length}`; paintParkStatus();
      await sleep(100);
    } while (next && pages < 400);
    PR.season = season;
    const cache = readParkCache();
    const todo = rows.filter((g) => cache[g.game_id] == null);
    for (let k = 0; k < todo.length; k++) {
      if (PR.team !== team) return null; // you moved to another club
      PR.status = `Finding stadiums… ${k + 1} of ${todo.length} (first time only)`; paintParkStatus();
      try { const rec = await getJSON(`/games/${todo[k].game_id}`); if (rec.park_id != null) cache[todo[k].game_id] = rec.park_id; } catch (_) {}
      if (k % 20 === 19) writeParkCache(cache);
      await sleep(100);
    }
    writeParkCache(cache);
    rows.forEach((g) => (g.park_id = cache[g.game_id]));
    return rows;
  }

  function parkStats(team) {
    const by = {};
    for (const g of PR.rows || []) {
      if (PR.kind === "good" && g.good_match !== true) continue;
      if (g.park_id == null) continue;
      const home = g.home_team_id === team;
      const rf = home ? g.home_runs : g.away_runs, ra = home ? g.away_runs : g.home_runs;
      const s = (by[g.park_id] = by[g.park_id] || { h: [0, 0, 0], a: [0, 0, 0], rf: 0, ra: 0, n: 0 });
      (home ? s.h : s.a)[rf > ra ? 0 : rf < ra ? 1 : 2]++;
      s.rf += rf; s.ra += ra; s.n++;
    }
    return by;
  }
  const wlt = (x) => `${x[0]}–${x[1]}${x[2] ? "–" + x[2] : ""}`;
  const ZERO = { h: [0, 0, 0], a: [0, 0, 0], rf: 0, ra: 0, n: 0 };
  function recordHtml(s) {
    if (!s || !s.n) return `<div class="sbx-prec"><div class="big"><b>0–0</b><span>no games yet</span></div></div>`;
    const t = [s.h[0] + s.a[0], s.h[1] + s.a[1], s.h[2] + s.a[2]];
    const pct = t[0] + t[1] ? (t[0] / (t[0] + t[1])).toFixed(3).replace(/^0/, "") : "—";
    const parts = [];
    if (s.h[0] + s.h[1] + s.h[2]) parts.push(`home ${wlt(s.h)}`);
    if (s.a[0] + s.a[1] + s.a[2]) parts.push(`away ${wlt(s.a)}`);
    return `<div class="sbx-prec"><div class="big"><b>${wlt(t)}</b><span>${pct}</span></div>
      <div class="muted">${parts.join(" · ")} · ${(s.rf / s.n).toFixed(1)}–${(s.ra / s.n).toFixed(1)} runs a game · ${s.n} game${s.n === 1 ? "" : "s"}</div></div>`;
  }
  function parkIdOf(card) {
    const b = card.querySelector("[data-home]");
    if (b) return Number(b.dataset.home);
    const art = card.querySelector(".pk-art");
    const m = art && (art.getAttribute("style") || "").match(/\/parks\/(\d+)\//);
    return m ? Number(m[1]) : null;
  }
  function paintParkStatus() {
    const el = document.getElementById("sbx-prec-status");
    if (el) el.textContent = PR.status;
  }
  function paintParks(team) {
    const grid = document.querySelector("main .parks");
    if (!grid) return;
    grid.querySelectorAll(".sbx-prec, .park.sbx-visited").forEach((e) => e.remove());
    grid.parentElement.querySelectorAll(".sbx-park-list").forEach((e) => e.remove());
    if (!PR.rows) return;
    const stats = parkStats(team);
    const owned = new Set();
    grid.querySelectorAll(".park").forEach((card) => {
      const id = parkIdOf(card);
      if (id == null) return;
      owned.add(id);
      const body = card.querySelector(".pk-body") || card;
      const btn = body.querySelector("button");
      const html = recordHtml(stats[id]);
      if (btn) btn.insertAdjacentHTML("beforebegin", html); else body.insertAdjacentHTML("beforeend", html);
    });
    // Every other stadium (the practice field excepted), played there or not.
    const others = Object.keys(PARKS).map(Number).filter((id) => id !== 3 && !owned.has(id));
    Object.keys(stats).map(Number).forEach((id) => { if (!owned.has(id) && !others.includes(id)) others.push(id); });
    others.sort((a, b) => ((stats[b] || {}).n || 0) - ((stats[a] || {}).n || 0) || a - b);
    grid.parentElement.querySelectorAll(".sbx-park-list").forEach((e) => e.remove());
    if (PR.others === "cards") {
      others.forEach((id) => {
        const div = document.createElement("div");
        div.className = "park sbx-visited";
        div.innerHTML = `<div class="pk-art" style="background-image:url('/parks/${id}/art.jpg')"></div>
          <div class="pk-body"><b>${esc(PARKS[id] || "Park " + id)}</b> <span class="muted small">${stats[id] ? "Visited · not yours" : "Not yours"}</span>${recordHtml(stats[id] || ZERO)}</div>`;
        grid.appendChild(div);
      });
    } else if (PR.others === "text") {
      const line = (id) => {
        const s0 = stats[id] || ZERO;
        const t = [s0.h[0] + s0.a[0], s0.h[1] + s0.a[1], s0.h[2] + s0.a[2]];
        const pct = t[0] + t[1] ? " · " + (t[0] / (t[0] + t[1])).toFixed(3).replace(/^0/, "") : "";
        const runs = s0.n ? ` · ${(s0.rf / s0.n).toFixed(1)}–${(s0.ra / s0.n).toFixed(1)} runs · ${s0.n} game${s0.n === 1 ? "" : "s"}` : "";
        return `<div class="ln"><b>${esc(PARKS[id] || "Park " + id)}</b> <span>${wlt(t)}${pct}${runs}</span></div>`;
      };
      grid.insertAdjacentHTML("afterend", `<div class="sbx-park-list"><div class="hd">Stadiums you don't own</div>${others.map(line).join("")}</div>`);
    }
    grid.dataset.sbxPainted = `${team}|${PR.scope}|${PR.kind}|${PR.others}|${PR.rows.length}`;
  }
  function mountParkRecords() {
    const grid = document.querySelector("main .parks");
    const m = location.hash.match(/^#\/team\/(\d+)/);
    const team = m ? Number(m[1]) : null;
    if (!grid || !team || !ownIds().has(String(team))) return;
    let ctl = document.getElementById("sbx-prec-ctl");
    if (!ctl || ctl.dataset.team !== String(team)) {
      ctl?.remove();
      ctl = document.createElement("div");
      ctl.id = "sbx-prec-ctl";
      ctl.dataset.team = String(team);
      ctl.innerHTML = `<b>Your record in each stadium</b>
        <select data-k="scope"><option value="season">This season</option><option value="all">All seasons</option></select>
        <select data-k="kind"><option value="all">All games</option><option value="good">Good matches only</option></select>
        <select data-k="others" title="Stadiums you don't own"><option value="cards">Other stadiums as cards</option><option value="text">Other stadiums as a list</option><option value="hide">Hide other stadiums</option></select>
        <span class="muted" id="sbx-prec-status"></span>`;
      grid.insertAdjacentElement("beforebegin", ctl);
      ctl.querySelector('[data-k="scope"]').value = PR.scope;
      ctl.querySelector('[data-k="kind"]').value = PR.kind;
      ctl.querySelector('[data-k="scope"]').onchange = (e) => { PR.scope = e.target.value; PR.rows = null; setTimeout(tick, 0); };
      ctl.querySelector('[data-k="kind"]').onchange = (e) => {
        // The stadium filter is the same switch as everywhere else.
        setGood(e.target.value === "good");
        paintParks(team);
      };
      ctl.querySelector('[data-k="others"]').value = PR.others;
      ctl.querySelector('[data-k="others"]').onchange = (e) => { PR.others = e.target.value; try { localStorage.setItem("sbx-others", PR.others); } catch (_) {} paintParks(team); };
    }
    if (PR.team !== team) { PR.team = team; PR.rows = null; }
    if (!PR.rows) {
      if (!PR.loading) {
        PR.loading = true;
        loadParkRows(team, PR.scope)
          .then((rows) => { if (rows && PR.team === team) { PR.rows = rows; PR.status = ""; paintParkStatus(); paintParks(team); } })
          .catch((e) => { PR.status = "Could not load records: " + (e.message || e); paintParkStatus(); if (PR.team === team) PR.rows = []; })
          .finally(() => { PR.loading = false; setTimeout(tick, 0); });
      }
      return;
    }
    if (PR.rows && grid.dataset.sbxPainted !== `${team}|${PR.scope}|${PR.kind}|${PR.others}|${PR.rows.length}`) paintParks(team);
  }

  // 🕵️ For rgbartley and The Usual Suspects: on their club pages the lineup gets a height chart behind it.
  // Easter egg for The Usual Suspects TUS (rgbartley's club): a case-file banner with rotating lines from the movie,
  // a one-guess "Find Keyser Söze" game over the nine starters, and a mugshot height chart behind the portraits.
  const SUS_QUOTES = [
    ["The greatest trick the Devil ever pulled was convincing the world he didn't exist.", "Verbal Kint"],
    ["How do you shoot the Devil in the back? What if you miss?", "Verbal Kint"],
    ["I believe in God, and the only thing that scares me is Keyser Söze.", "Verbal Kint"],
    ["Who is Keyser Söze?", "Agent Kujan"],
    ["And like that… he's gone.", "Verbal Kint"],
  ];
  const SUS_KEY = "sbx-soze";
  const SUS = { q: Math.floor(Math.random() * SUS_QUOTES.length), timer: 0, round: null };
  const susRec = () => { try { return JSON.parse(localStorage.getItem(SUS_KEY)) || { w: 0, l: 0 }; } catch (_) { return { w: 0, l: 0 }; } };
  function susLineup(box) {
    if (!box) return [];
    const ths = [...box.querySelectorAll("thead th")].map((t) => t.textContent.trim().toLowerCase());
    const iPos = ths.indexOf("pos"), iName = ths.indexOf("name");
    if (iName < 0) return [];
    return [...box.querySelectorAll("tbody tr")].map((tr) => {
      const td = tr.children, img = tr.querySelector("img");
      return { pos: iPos >= 0 && td[iPos] ? td[iPos].textContent.trim() : "", name: (td[iName] ? td[iName].firstChild && td[iName].firstChild.textContent || td[iName].textContent : "").trim().replace(/\.$/, ""), img: img ? img.src : "" };
    }).filter((p) => p.name && !/bench/i.test(p.pos)).slice(0, 9);
  }
  function susQuote(el) {
    const [q, who] = SUS_QUOTES[SUS.q % SUS_QUOTES.length];
    el.innerHTML = "<q>" + esc(q) + "</q><small>— " + esc(who) + ", <i>The Usual Suspects</i> (1995)</small>";
  }
  function susGame(wrap, men) {
    const r = SUS.round;
    const rec = susRec();
    const done = r.pick != null;
    let res = "";
    if (done) {
      const won = r.pick === r.soze, s = men[r.soze];
      res = '<div class="sus-res">' + (won
        ? "<b>🎯 You found him.</b> It was #" + (r.soze + 1) + " " + esc(s.name) + ". Kujan never got this close."
        : "<b>💨 And like that… he's gone.</b> Keyser Söze was #" + (r.soze + 1) + " " + esc(s.name) + ".") +
        '<span style="opacity:.75;font-size:13px">Your record: ' + rec.w + "–" + rec.l + "</span>" +
        '<button class="sus-go" data-sus="again">🔁 New lineup</button></div>';
    }
    wrap.innerHTML = '<div class="sus-help">' + (done ? "The lineup is over." : "Nine suspects. One of them is Keyser Söze. <b>You get one guess.</b>") + "</div>" +
      '<div class="sus-row">' + men.map((p, i) => '<button class="sus-man' + (done && i === r.soze ? " is-soze" : "") + (done && i === r.pick ? " is-pick" : "") + (done && i !== r.soze && i !== r.pick ? " is-out" : "") + '" data-man="' + i + '"' + (done ? " disabled" : "") + ' title="' + (done ? "" : "Point at #" + (i + 1)) + '"><b>' + (i + 1) + "</b>" +
        (p.img ? '<img src="' + esc(p.img) + '" alt="">' : '<div style="height:52px;font-size:30px;line-height:52px">🕴️</div>') + "<span>" + esc(p.name) + "</span><em>" + esc(p.pos) + "</em></button>").join("") + "</div>" + res;
    wrap.querySelectorAll("[data-man]").forEach((b) => { b.onclick = () => {
      if (SUS.round.pick != null) return;
      SUS.round.pick = Number(b.dataset.man);
      const rc = susRec(); if (SUS.round.pick === SUS.round.soze) rc.w++; else rc.l++;
      try { localStorage.setItem(SUS_KEY, JSON.stringify(rc)); } catch (_) {}
      susGame(wrap, men);
    }; });
    const again = wrap.querySelector('[data-sus="again"]');
    if (again) again.onclick = () => { SUS.round = { soze: Math.floor(Math.random() * men.length), pick: null }; susGame(wrap, men); };
  }
  function mountSuspects() {
    const m = location.hash.match(/^#\/team\/(\d+)/);
    const head = document.querySelector("main .teamhead");
    const yes = !!(m && head && /usual suspects/i.test(head.textContent));
    let ban = document.getElementById("sbx-sus");
    const h = [...document.querySelectorAll("main h2")].find((x) => /^(lineup|the squad)/i.test(x.textContent.trim()));
    let box = h ? h.nextElementSibling : null;
    while (box && box.tagName !== "H2" && !(box.matches("table") || box.querySelector("table"))) box = box.nextElementSibling;
    if (box && box.tagName === "H2") box = null;
    if (!yes) {
      if (ban) ban.remove();
      document.querySelectorAll(".sbx-suspects").forEach((x) => x.classList.remove("sbx-suspects"));
      if (SUS.timer) { clearInterval(SUS.timer); SUS.timer = 0; }
      SUS.round = null;
      return;
    }
    if (box) {
      box.classList.add("sbx-suspects");
      const tr = box.querySelector("tbody tr"), td = tr && tr.querySelector("td"), th = box.querySelector("thead");
      if (tr && td) {
        const bt = box.getBoundingClientRect().top;
        box.style.setProperty("--sus-rh", tr.getBoundingClientRect().height.toFixed(2) + "px");
        box.style.setProperty("--sus-top", ((th ? th.getBoundingClientRect().bottom : tr.getBoundingClientRect().top) - bt).toFixed(1) + "px");
        box.style.setProperty("--sus-w", td.getBoundingClientRect().width.toFixed(1) + "px");
      }
    }
    if (ban && ban.isConnected && ban.previousElementSibling === head) return;
    if (!ban) {
      ban = document.createElement("div"); ban.id = "sbx-sus";
      ban.innerHTML = '<div class="sus-top"><div style="flex:1 1 360px"><div class="sus-file">🕵️ Case file · The Usual Suspects</div><div class="sus-q"></div></div>' +
        '<button class="sus-go" data-sus="open" title="One guess. Can you spot him?">🔎 Find Keyser Söze</button></div><div class="sus-game" hidden></div>';
      ban.querySelector('[data-sus="open"]').onclick = () => {
        const g = ban.querySelector(".sus-game"), men = susLineup(box || document.querySelector(".sbx-suspects"));
        if (!g.hidden) { g.hidden = true; return; }
        if (men.length < 2) { g.hidden = false; g.innerHTML = '<div class="sus-help">The suspects aren\'t in the room yet (open the Skills view of the squad).</div>'; return; }
        if (!SUS.round || SUS.round.soze >= men.length) SUS.round = { soze: Math.floor(Math.random() * men.length), pick: null };
        g.hidden = false; susGame(g, men);
      };
    }
    head.insertAdjacentElement("afterend", ban);
    const qel = ban.querySelector(".sus-q"); susQuote(qel);
    if (!SUS.timer) SUS.timer = setInterval(() => {
      const el = document.querySelector("#sbx-sus .sus-q"); if (!el) return;
      el.style.opacity = "0";
      setTimeout(() => { SUS.q++; susQuote(el); el.style.opacity = "1"; }, 600);
    }, 9000);
  }



  // 6b. Tidy the commish's Achievements section (his drawing, rearranged; nothing is recalculated):
  //     - his Stadiums wall: each park's medal and "next" goal go onto the stadium cards above, and the wall folds away
  //     - Country tour: only countries you've played, best first, with a one-line summary and "Show all"
  //     - Earned badges move to the top of the section
  //     If his layout changes and something isn't found, that part is left alone.
  const TOUR_ALL = "sbx-tour-all";
  function achParts() {
    const h = [...document.querySelectorAll("main h2")].find((x) => /^achievements/i.test(x.textContent.trim()));
    if (!h) return null;
    const P = { h, prog: null, parkH: null, parkWall: null, tourH: null, tourWall: null, earnH: null, earned: null };
    for (let n = h.nextElementSibling; n && n.tagName !== "H2"; n = n.nextElementSibling) {
      const t = n.textContent.trim().toLowerCase();
      if (n.tagName === "H3") { if (/^stadiums/.test(t)) P.parkH = n; else if (/^country tour/.test(t)) P.tourH = n; else if (/^earned/.test(t)) P.earnH = n; continue; }
      if (n.querySelector(".achnext") || n.classList.contains("achnext")) P.prog = n;
      else if (n.classList.contains("parkwall")) { if (P.tourH) P.tourWall = n; else if (P.parkH) P.parkWall = n; }
      else if (n.classList.contains("achs") && P.earnH) P.earned = n;
    }
    return P;
  }
  function pwInfo(pw) {
    const body = pw.querySelector(".pw-body") || pw, txt = body.innerText || body.textContent || "";
    const name = ((body.querySelector("b, strong, h4, .pw-name") || {}).textContent || txt.split("\n")[0] || "").trim();
    const m = txt.match(/(\d+)\s+wins?\s*·\s*(\d+)\s+games?/i);
    const nx = txt.match(/next:\s*([^\n]+)/i);
    const medal = /gold/.test(pw.className) || /🥇/.test(txt) ? "🥇" : /silver/.test(pw.className) || /🥈/.test(txt) ? "🥈" : /bronze/.test(pw.className) || /🥉/.test(txt) ? "🥉" : "";
    const goal = nx ? (nx[1].match(/(\d+)\s+wins?/) || [])[1] : null;
    return { pw, name, wins: m ? Number(m[1]) : 0, games: m ? Number(m[2]) : 0, next: nx ? nx[1].trim() : "", medal, goal: goal ? Number(goal) : (nx && /first win/i.test(nx[1]) ? 1 : 0) };
  }
  function medalHtml(x) {
    const pct = x.goal ? Math.min(100, Math.round(100 * x.wins / x.goal)) : 100;
    return `<div class="sbx-medal" title="From the Achievements section: official wins in this stadium, all seasons">${x.medal ? x.medal + " " : "🏅 "}<b>${x.wins}</b> official win${x.wins === 1 ? "" : "s"} all-time${x.next ? " · next: " + esc(x.next) : ""}<div class="bar"><i style="width:${pct}%"></i></div></div>`;
  }
  function mountAchTidy() {
    const P = achParts();
    if (!P) return;
    // 1. Earned badges first
    if (P.earnH && P.earned && P.h.nextElementSibling !== P.earnH) {
      P.h.insertAdjacentElement("afterend", P.earned);
      P.h.insertAdjacentElement("afterend", P.earnH);
    }
    // 2. Stadium medals onto the stadium cards
    if (P.parkWall) {
      const info = {};
      P.parkWall.querySelectorAll(".pw").forEach((pw) => { const x = pwInfo(pw); if (x.name) info[x.name.toLowerCase()] = x; });
      let hit = 0;
      document.querySelectorAll("main .parks .park").forEach((card) => {
        const nameEl = card.querySelector(".pk-body b, .pk-body strong, b, strong");
        const x = nameEl && info[nameEl.textContent.trim().toLowerCase()];
        if (!x) return;
        hit++;
        const sig = `${x.wins}|${x.games}|${x.next}|${x.medal}`;
        const old = card.querySelector(".sbx-medal");
        if (old && old.dataset.sig === sig) return;
        old?.remove();
        const body = card.querySelector(".pk-body") || card, btn = body.querySelector("button");
        if (btn) btn.insertAdjacentHTML("beforebegin", medalHtml(x)); else body.insertAdjacentHTML("beforeend", medalHtml(x));
        card.querySelector(".sbx-medal").dataset.sig = sig;
      });
      if (hit && !P.parkWall.classList.contains("sbx-hide")) {
        P.parkWall.classList.add("sbx-hide"); P.parkH?.classList.add("sbx-hide");
        P.parkWall.insertAdjacentHTML("afterend", `<div class="sbx-movednote">🏟️ Stadium medals are on your stadium cards in the Stadiums section above (Club Kit).</div>`);
      }
    }
    // 3. Country tour: where you've played, best first
    if (P.tourWall) {
      const cards = [...P.tourWall.querySelectorAll(".pw")].map(pwInfo);
      const played = cards.filter((x) => x.games > 0).sort((a, b) => b.wins - a.wins || b.games - a.games);
      let all = false; try { all = localStorage.getItem(TOUR_ALL) === "1"; } catch (_) {}
      cards.forEach((x) => { x.pw.style.order = x.games ? String(-(x.wins * 1000 + x.games)) : "0"; x.pw.classList.toggle("sbx-hide", !all && !x.games); });
      const glob = P.prog ? [...P.prog.querySelectorAll(".an")].find((a) => /globetrotter/i.test(a.textContent)) : null;
      const gm = glob && glob.textContent.match(/(\d+)\s*\/\s*(\d+)/);
      const beaten = played.filter((x) => x.wins > 0).length;
      const sig = `${played.length}|${beaten}|${cards.length}|${all}|${gm ? gm[0] : ""}`;
      let bar = P.tourWall.previousElementSibling;
      if (!bar || !bar.classList.contains("sbx-tour")) { bar = document.createElement("div"); bar.className = "sbx-tour"; P.tourWall.insertAdjacentElement("beforebegin", bar); }
      if (bar.dataset.sig !== sig) {
        bar.dataset.sig = sig;
        bar.innerHTML = `<span>🌍 <b>${played.length}</b> of ${cards.length} countries played · <b>${beaten}</b> beaten${gm ? ` · Globetrotter ${gm[1]}/${gm[2]}` : ""}</span>` +
          `<button type="button">${all ? "Only where you've played" : `Show all ${cards.length}`}</button>`;
        bar.querySelector("button").onclick = () => { try { localStorage.setItem(TOUR_ALL, all ? "0" : "1"); } catch (_) {} bar.dataset.sig = ""; mountAchTidy(); };
      }
    }
  }

  // 7. Fold the long "This season's games" list on club pages. Starts folded, with a summary in its place;
  //    remembers your choice.
  const GAMES_OPEN = "sbx-games-open";
  const GSUM = { team: null, at: 0, html: "", busy: false };
  function resultOf(g, team) {
    const h = g.home_team_id === team;
    const a = h ? g.home_runs : g.away_runs, b = h ? g.away_runs : g.home_runs;
    return a > b ? "w" : a < b ? "l" : "t";
  }
  function summaryHtml(rows, team) {
    if (!rows.length) return `<div class="sbx-gsum muted">No games yet this season.</div>`;
    const tally = (list) => { const t = [0, 0, 0]; for (const g of list) t["wlt".indexOf(resultOf(g, team))]++; return t; };
    const rec = (t) => `${t[0]}–${t[1]}${t[2] ? "–" + t[2] : ""}`;
    const all = tally(rows), good = tally(rows.filter((g) => g.good_match === true));
    const big = tally(rows.filter((g) => g.kind === "big")), pro = rows.filter((g) => g.kind === "pro"), ex = rows.filter((g) => g.kind === "exhibition");
    const day = new Date(); day.setHours(0, 0, 0, 0);
    const today = tally(rows.filter((g) => new Date(g.finished_at) >= day));
    let rf = 0, ra = 0; for (const g of rows) { const h = g.home_team_id === team; rf += h ? g.home_runs : g.away_runs; ra += h ? g.away_runs : g.home_runs; }
    const sorted = rows.slice().sort((a, b) => String(b.finished_at).localeCompare(String(a.finished_at)));
    const r0 = resultOf(sorted[0], team); let n = 0; for (const g of sorted) { if (resultOf(g, team) !== r0) break; n++; }
    const pct = all[0] + all[1] ? (all[0] / (all[0] + all[1])).toFixed(3).replace(/^0/, "") : "—";
    const item = (k, v) => `<span class="it"><span class="k">${k}</span><b>${v}</b></span>`;
    return `<div class="sbx-gsum">
      ${goodOnly() ? `<span class="it gonly">Good matches only</span>` : ""}${item("Games", rows.length)}${item("Record", `${rec(all)} · ${pct}`)}${item("Good matches", rec(good))}${item("BigLeague", rec(big))}
      ${pro.length ? item("ProLeague", rec(tally(pro))) : ""}${ex.length ? item("Exhibitions", ex.length) : ""}
      ${item("Today", today[0] + today[1] + today[2] ? rec(today) : "none")}${item("Runs a game", `${(rf / rows.length).toFixed(1)}–${(ra / rows.length).toFixed(1)}`)}
      ${item("Streak", (r0 === "w" ? "W" : r0 === "l" ? "L" : "T") + n)}
      <span class="chips" title="Last 10, newest first">${sorted.slice(0, 10).map((g) => { const r = resultOf(g, team); return `<i class="${r}">${r.toUpperCase()}</i>`; }).join("")}</span>
      ${on("opps") ? oppsHtml(rows, team) : ""}
    </div>`;
  }
  // Most-played opponents this season, with your record against each.
  function oppsHtml(rows, team) {
    const by = new Map();
    for (const g of rows) {
      const h = g.home_team_id === team, id = h ? g.away_team_id : g.home_team_id;
      const name = String((h ? g.away_name : g.home_name) || "Club " + id).replace(/\s+-[A-Za-z]{2,4}-\s*$/, "");
      const o = by.get(id) || { id, name, t: [0, 0, 0], good: 0, last: "" };
      o.t["wlt".indexOf(resultOf(g, team))]++; if (g.good_match === true) o.good++;
      if (String(g.finished_at) > o.last) o.last = String(g.finished_at);
      by.set(id, o);
    }
    const top = [...by.values()].sort((a, b) => (b.t[0] + b.t[1] + b.t[2]) - (a.t[0] + a.t[1] + a.t[2]) || b.last.localeCompare(a.last)).slice(0, 8);
    if (!top.length) return "";
    const rec = (t) => `${t[0]}–${t[1]}${t[2] ? "–" + t[2] : ""}`;
    return `<div class="sbx-opps"><span class="k">Most played</span>${top.map((o) => {
      const n = o.t[0] + o.t[1] + o.t[2];
      return `<a class="op" href="#/team/${o.id}" title="${esc(o.name)}: ${n} games, ${o.good} good matches"><span>${esc(o.name)}</span><span class="n">${n}g</span><b>${rec(o.t)}</b>${o.good === n ? `<span class="gm" title="All good matches">●</span>` : ""}</a>`;
    }).join("")}</div>`;
  }
  // Three views of the season's games: summary only, last 10, full season.
  const GAMES_MODE = "sbx-games-mode";
  function gamesMode() {
    try {
      const m = localStorage.getItem(GAMES_MODE);
      if (m === "sum" || m === "ten" || m === "all") return m;
      return localStorage.getItem(GAMES_OPEN) === "1" ? "all" : "sum";
    } catch (_) { return "sum"; }
  }
  function mountGamesFold() {
    const h = Array.from(document.querySelectorAll("main h2")).find((x) => /season.s games|official games/i.test(x.textContent));
    if (!h) return;
    const m = location.hash.match(/^#\/team\/(\d+)/);
    const team = m ? Number(m[1]) : null;
    const parts = [];
    for (let e = h.nextElementSibling; e && e.tagName !== "H2"; e = e.nextElementSibling) if (!e.classList.contains("sbx-gsum-wrap")) parts.push(e);
    if (!parts.length) return;
    const mode = gamesMode();
    let seg = h.querySelector(".sbx-seg");
    if (!seg) {
      h.querySelector(".sbx-fold")?.remove();
      seg = document.createElement("span");
      seg.className = "sbx-seg";
      seg.innerHTML = `<button type="button" data-m="sum">Summary</button><button type="button" data-m="ten">Last 10</button><button type="button" data-m="all">Full season</button>`;
      h.appendChild(seg);
      seg.insertAdjacentHTML("afterend", goodToggle());
      seg.onclick = (ev) => {
        const b = ev.target.closest("button[data-m]"); if (!b) return;
        ev.stopPropagation();
        try { localStorage.setItem(GAMES_MODE, b.dataset.m); } catch (_) {}
        mountGamesFold();
      };
    }
    for (const b of seg.querySelectorAll("button")) { const on = b.dataset.m === mode; if (b.classList.contains("on") !== on) b.classList.toggle("on", on); }
    for (const e of parts) {
      if (e.dataset.sbxFold !== "1") { e.dataset.sbxFold = "1"; e.dataset.sbxDisplay = e.style.display || ""; }
      const target = mode === "sum" ? "none" : e.dataset.sbxDisplay;
      if (e.style.display !== target) e.style.display = target;
      // Last 10: the site lists games newest first, so keep the first ten rows.
      let k = 0;
      for (const tr of e.querySelectorAll("tr")) {
        if (!tr.querySelector("td")) continue;
        const isGood = /good match/i.test(tr.textContent);
        const hide = (goodOnly() && !isGood) || (mode === "ten" && k++ >= 10);
        if (hide && tr.dataset.sbxTen !== "1") { tr.dataset.sbxTen = "1"; tr.dataset.sbxDisplay = tr.style.display || ""; tr.style.display = "none"; }
        else if (!hide && tr.dataset.sbxTen === "1") { tr.style.display = tr.dataset.sbxDisplay || ""; delete tr.dataset.sbxTen; }
      }
    }
    // The summary (with most-played opponents) sits above the list in every view.
    let wrap = h.nextElementSibling && h.nextElementSibling.classList.contains("sbx-gsum-wrap") ? h.nextElementSibling : null;
    if (!team) { wrap?.remove(); return; }
    if (!wrap) { wrap = document.createElement("div"); wrap.className = "sbx-gsum-wrap"; h.insertAdjacentElement("afterend", wrap); }
    if (GSUM.team === team && GSUM.html && Date.now() - GSUM.at < 120000) {
      if (wrap.dataset.at !== String(GSUM.at)) { wrap.innerHTML = GSUM.html; wrap.dataset.at = String(GSUM.at); }
      return;
    }
    if (GSUM.busy) return;
    if (!wrap.innerHTML) wrap.innerHTML = `<div class="sbx-gsum muted">Summing up this season's games…</div>`;
    GSUM.busy = true;
    seasonGames(team)
      .then((list) => { GSUM.team = team; GSUM.html = summaryHtml(list.filter(keepGame), team); GSUM.at = Date.now(); })
      .catch(() => { GSUM.team = team; GSUM.html = `<div class="sbx-gsum muted">Couldn't load the summary.</div>`; GSUM.at = Date.now(); })
      .finally(() => { GSUM.busy = false; setTimeout(tick, 0); });
  }


  // 🥊 Challenge links from Discord (Hold the Hill, the Brawl, wagers) look like
  // play.smallball.com/?sbx_as=<your club>#/team/<opponent>. On that opponent's page this shows which club
  // you're about to play as. If the site has another of your clubs picked, one click switches it (the same
  // club switcher the site uses). You still press SmallBall's own Play button: the kit never plays for you.
  const CHARGE = (() => {
    const as = (new URLSearchParams(location.search).get("sbx_as") || "").replace(/\D/g, "");
    const vs = (location.hash.match(/^#\/team\/(\d+)/) || [])[1] || "";
    return { as, vs };
  })();
  function mountCharge() {
    let el = document.getElementById("sbx-charge");
    const here = CHARGE.as && CHARGE.vs && location.hash.replace(/[?].*$/, "") === "#/team/" + CHARGE.vs;
    if (!here || CHARGE.closed) { if (el) el.remove(); return; }
    const sel = document.getElementById("who-team"); if (!sel) return;
    const opt = (id) => [...sel.options].find((o) => o.value === id);
    const nm = (id) => (opt(id) ? opt(id).textContent.trim() : "club " + id);
    const cur = sel.value, mine = !!opt(CHARGE.as), ok = cur === CHARGE.as;
    const key = CHARGE.as + "|" + cur;
    if (el && el.dataset.k === key) return;
    if (!el) {
      el = document.createElement("div"); el.id = "sbx-charge";
      el.style.cssText = "position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:2147483000;max-width:min(680px,94vw);padding:10px 14px;border-radius:12px;font:600 15px/1.35 system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.45);display:flex;gap:10px;align-items:center;flex-wrap:wrap";
      document.body.appendChild(el);
    }
    el.dataset.k = key;
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const x = '<button data-x style="margin-left:auto;background:none;border:0;color:inherit;font-size:18px;cursor:pointer;opacity:.7">×</button>';
    if (!mine) {
      el.style.background = "#7a1020"; el.style.color = "#fff";
      el.innerHTML = '<span>🥊 This challenge link is for <b>club ' + esc(CHARGE.as) + '</b>, which isn\'t one of the clubs on this login. Log in as that club\'s owner to play it.</span>' + x;
    } else if (ok) {
      el.style.background = "#0f5132"; el.style.color = "#fff";
      el.innerHTML = '<span>🥊 ✅ You\'re playing as <b>' + esc(nm(CHARGE.as)) + '</b> vs club ' + esc(CHARGE.vs) + '. Hit <b>Play</b> (BigLeague, not Exhibition) when you\'re ready.</span>' + x;
    } else {
      el.style.background = "#b45309"; el.style.color = "#fff";
      el.innerHTML = '<span>🥊 ⚠️ You\'re on <b>' + esc(nm(cur)) + '</b>. This challenge is for <b>' + esc(nm(CHARGE.as)) + '</b>.</span>' +
        '<button data-sw style="background:#fff;color:#7c2d12;border:0;border-radius:999px;padding:6px 12px;font-weight:700;cursor:pointer">Switch to ' + esc(nm(CHARGE.as)) + '</button>' + x;
    }
    const sw = el.querySelector("[data-sw]");
    if (sw) sw.onclick = () => { sel.value = CHARGE.as; sel.dispatchEvent(new Event("change", { bubbles: true })); setTimeout(() => { if (location.hash !== "#/team/" + CHARGE.vs) location.hash = "#/team/" + CHARGE.vs; mountCharge(); }, 400); };
    el.querySelector("[data-x]").onclick = () => { CHARGE.closed = true; el.remove(); };
  }
  // 🏆 Live tournament chip. Every tournament run by the SmallBall tournament script publishes its bracket on
  // GitHub, plus a list of all tournaments. The kit reads those public files (no login, nothing is sent) and, when
  // one of your clubs has a match open, shows who you play, the deadline and a Start button (a 🥊 challenge link).
  // Results only appear there once Discord has posted them, so it never spoils a game still on the air.
  const LIVE = { at: 0, busy: false, items: [], key: "" };
  const LIVE_REPO = "slipnsliders/smallball-tools";
  const LIVE_PAIRS = [{ nine: "Front", a: 0, b: 0, tee: "A" }, { nine: "Front", a: 1, b: 1, tee: "B" }, { nine: "Back", a: 0, b: 1, tee: "B" }, { nine: "Back", a: 1, b: 0, tee: "A" }];
  async function liveGet(path) {
    // raw.githubusercontent first (no rate limit; a few minutes behind at most), the GitHub API as a backup
    const urls = ["https://raw.githubusercontent.com/" + LIVE_REPO + "/main/" + path + "?t=" + Math.floor(Date.now() / 60000), "https://api.github.com/repos/" + LIVE_REPO + "/contents/" + path + "?ref=main"];
    for (let i = 0; i < urls.length; i++) {
      try { const r = await fetch(urls[i], { cache: "no-store", credentials: "omit", headers: i ? { Accept: "application/vnd.github.raw+json" } : {} }); if (r.ok) return await r.json(); } catch (_) {}
    }
    return null;
  }
  const liveWhen = (ms) => (ms ? new Date(ms).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" }) : "");
  const liveStart = (me, opp) => "https://play.smallball.com/?sbx_as=" + me + "#/team/" + opp;
  function liveItems(D, t, mine) {
    const out = [], url = t.url || "", scr = D.fmt === "scramble", has = (id) => mine.has(String(id));
    const icon = scr ? "⛳" : "🏆";
    if (!D.matches) {   // sign-ups still open
      (D.entrants || []).filter((e) => has(e.id)).forEach((e) => out.push({ k: t.slug + ":su:" + e.id, scr, title: icon + " " + D.name, lines: [{ t: "📝 <b>" + esc(e.n) + "</b> is signed up" + (D.start ? " · first match " + esc(liveWhen(D.start)) : "") }], url }));
      return out;
    }
    if (D.done) {
      const c = D.champ; const won = c && (has(c.id) || (c.clubs || []).some((x) => has(x.id)));
      if (won) out.push({ k: t.slug + ":champ", scr, title: "👑 " + D.name, lines: [{ t: "You won it! 🎉" }], url });
      return out;
    }
    for (const m of D.matches) {
      if (m.w || m.v || m.bye || !m.a || !m.z) {
        // through to a match whose opponent isn't known yet
        if (!m.w && !m.v && (m.a || m.z) && !(m.a && m.z)) {
          const x = m.a || m.z, me = scr ? (x.clubs || []).find((c) => has(c.id)) : has(x.id) ? x : null;
          if (me) out.push({ k: t.slug + ":wait:" + m.id, scr, title: icon + " " + D.name + " · " + m.l, lines: [{ t: "⏳ <b>" + esc(me.n) + "</b> is through. This match opens the moment your opponent is known." }], url: url + (scr ? "#m=" + m.id : "") });
        }
        continue;
      }
      if (!m.open) continue;
      const dl = m.dl ? " · play by <b>" + esc(liveWhen(m.dl)) + "</b>" : "";
      if (scr) {
        const A = m.a, B = m.z, side = (A.clubs || []).some((c) => has(c.id)) ? "A" : (B.clubs || []).some((c) => has(c.id)) ? "B" : "";
        if (!side) continue;
        const lines = [];
        LIVE_PAIRS.forEach((p, i) => {
          const ca = A.clubs[p.a], cb = B.clubs[p.b], me = side === "A" ? ca : cb, opp = side === "A" ? cb : ca;
          if (!has(me.id)) return;
          const g = (m.games || [])[i] || {}, iTee = p.tee === side;
          const st = g.aired ? "✓ played" : g.g ? "📡 found, airing" : iTee ? "you tee off" : "they tee off";
          lines.push({ t: p.nine + ": <b>" + esc(me.n) + "</b> vs " + esc(opp.n) + " <code>" + esc(opp.id) + "</code> · " + st, go: !g.g && iTee ? liveStart(me.id, opp.id) : "" });
        });
        out.push({ k: t.slug + ":" + m.id, scr, title: "⛳ " + D.name + " · " + m.l, sub: "Team " + esc((side === "A" ? A : B).n.replace(/^Team /, "")) + " vs " + esc((side === "A" ? B : A).n) + dl, lines, url: url + "#m=" + m.id });
      } else {
        const me = has(m.a.id) ? m.a : has(m.z.id) ? m.z : null; if (!me) continue;
        const opp = me === m.a ? m.z : m.a, starts = (me.s || 99) > (opp.s || 99);
        const line = m.live || m.g ? { t: "📡 Game found. The result posts once it has aired." }
          : starts ? { t: "🥊 You <b>start the game</b> (BigLeague, not Exhibition)", go: liveStart(me.id, opp.id) }
          : { t: "🛡️ " + esc(opp.n) + " starts the game. Be ready to play." };
        out.push({ k: t.slug + ":" + m.id, scr, title: "🏆 " + D.name + " · " + m.l, sub: "<b>" + esc(me.n) + "</b> vs " + esc(opp.n) + " <code>" + esc(opp.id) + "</code>" + dl, lines: [line], url });
      }
    }
    return out;
  }
  // ⛰️ Hold the Hill: one card per club of yours on the Hill (from the public HtH Leaderboard data).
  const HILL_BOARD = "https://slipnsliders.github.io/smallball-tools/hill/";
  // A club name that opens its SmallBall club page (same tab, like SmallBall's own links)
  const clubA = (name, id) => '<a href="#/team/' + encodeURIComponent(id) + '" title="Open ' + esc(name) + '\'s club page" style="color:inherit;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px">' + esc(name) + "</a>";
  const hillNeed = (gap) => (gap <= 1 ? 1 : gap + 1);
  function hillItems(H, mine) {
    if (!H || !H.ladder) return [];
    const all = (H.ace ? [H.ace] : []).concat(H.ladder), reach = Number(H.reach) || 3, form = H.formLink || HILL_BOARD;
    const wal = {}; (H.wallet || []).forEach((w) => { wal[w.name] = w; });
    const out = [];
    all.filter((p) => mine.has(String(p.clubId))).forEach((me) => {
      const r = Number(me.rank), w = wal[me.name];
      const sub = "<b>" + clubA(me.name, me.clubId) + "</b> · " + esc(me.club) + " · " + me.w + "–" + me.l +
        (w ? " · 💰 <b>" + w.bank + "</b> BB" + (w.streak ? " · 🔥 " + w.streak : "") + (w.items && w.items.length ? " · " + w.items.join(" ") : "") : "");
      const lines = [], B = H.bell || null, bellUntil = B && B.until ? esc(liveWhen(Date.parse(B.until))) : "", bellAt = B && B.next ? esc(liveWhen(Date.parse(B.next))) : "";
      const ch = (H.charges || []).find((c) => c.ch === me.name || c.df === me.name);
      if (ch) {
        const opp = all.find((p) => p.name === (ch.ch === me.name ? ch.df : ch.ch));
        const by = ch.deadline ? " · play by <b>" + esc(liveWhen(Date.parse(ch.deadline))) + "</b>" : "";
        if (/reported|airing/i.test(ch.status || "")) lines.push({ t: "📡 Your Hill game is in. The result posts once it has aired." });
        else if (ch.ch === me.name) lines.push({ t: "🥊 You charged <b>" + (opp ? clubA(ch.df, opp.clubId) : esc(ch.df)) + "</b>" + (opp ? " <code>" + esc(opp.clubId) + "</code>" : "") + by + ". Start a BigLeague game as the visitor.", go: opp ? liveStart(me.clubId, opp.clubId) : "" });
        else lines.push({ t: "🛡️ <b>" + (opp ? clubA(ch.ch, opp.clubId) : esc(ch.ch)) + "</b> charged you" + by + ". They start the game; be ready." });
      } else if (r === 0) {
        lines.push({ t: "♠ You hold the mound. Defend it" + (me.next ? ": the next defense is worth <b>+" + me.next + "</b>" : "") + "." });
        if (B && B.open) lines.push({ t: "🔔 <b>The Bell is ringing</b> until <b>" + bellUntil + "</b>: anyone on the climb can charge you (they need to win by " + (B.margin || 3) + "+)." });
        else if (B && B.soon) lines.push({ t: "🔔 The Bell rings at <b>" + bellAt + "</b>. For an hour, anyone on the climb can charge you." });
      } else {
        const tg = [];
        const openTo = Number(H.moundOpenTo) || 0;
        if (H.ace && B && B.open && !(r === 1 || (openTo && r <= openTo))) lines.push({ t: "🔔 <b>THE BELL IS RINGING</b> until <b>" + bellUntil + "</b>! Charge ♠ <b>" + clubA(H.ace.name, H.ace.clubId) + "</b> <code>" + esc(H.ace.clubId) + "</code>: win by " + (B.margin || 3) + "+ for the title, a smaller win makes you #1 contender. First one in.", go: form, btn: "🔔 Charge", ext: 1 });
        else if (H.ace && B && B.soon && !(r === 1 || (openTo && r <= openTo))) lines.push({ t: "🔔 The Bell rings at <b>" + bellAt + "</b>: for an hour, anyone can charge the Ace." });
        if (H.ace && (r === 1 || (openTo && r <= openTo))) tg.push({ t: "♠ <b>" + clubA(H.ace.name, H.ace.clubId) + "</b> (the Ace) <code>" + esc(H.ace.clubId) + "</code> · title shot" });
        H.ladder.filter((p) => r - Number(p.rank) >= 1 && r - Number(p.rank) <= reach).sort((a, b) => a.rank - b.rank).forEach((p) => {
          const n = hillNeed(r - Number(p.rank)); tg.push({ t: "#" + p.rank + " <b>" + clubA(p.name, p.clubId) + "</b> <code>" + esc(p.clubId) + "</code> · " + (n > 1 ? "win by " + n + "+" : "just win") });
        });
        const j = H.ladder.find((p) => r - Number(p.rank) === reach + 1);
        if (j) tg.push({ t: "🪜 #" + j.rank + " <b>" + clubA(j.name, j.clubId) + "</b> with a Ladder Jump" });
        if (tg.length) { lines.push({ t: "You can charge:" }); tg.forEach((x) => lines.push(x)); lines.push({ t: '<span style="opacity:.75;font-size:12px">The Master Form\'s 🔎 Who can I charge? has the exact list (cooldowns, items).</span>', go: form, btn: "🥊 Charge", ext: 1 }); }
        else lines.push({ t: "Nobody in reach right now. Win a defense or wait for the ladder to move." });
      }
      lines.push({ t: '<span style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px"><a href="' + esc(form) + '" target="_blank" rel="noopener" style="color:#facc15;font-weight:700;text-decoration:none">📝 Master Form</a><a href="' + HILL_BOARD + '" target="_blank" rel="noopener" style="color:#facc15;font-weight:700;text-decoration:none">📊 Live Hold the Hill Leaderboard</a></span>' });
      out.push({ k: "hill:" + me.clubId, hill: true, bell: !!(B && B.open), title: r === 0 ? "⛰️ Hold the Hill · ♠ The Ace" : "⛰️ Hold the Hill · #" + r + " of " + H.ladder.length, sub, lines, url: HILL_BOARD });
    });
    return out;
  }
  async function liveRefresh(force) {
    if (LIVE.busy || (document.hidden && !force) || !on("live")) return;
    const mine = ownIds();
    LIVE.busy = true;
    try {
      const idx = await liveGet("docs/tournaments/index.json"), list = (idx && idx.list) || [], items = [];
      LIVE.signups = list.filter((t) => t.status === "signups" && !(t.signupClose && t.signupClose < Date.now())).length;
      for (const t of list) {
        if (!mine.size) break;
        if (t.status === "done" && !(t.finished && Date.now() - t.finished < 864e5)) continue;
        const m = /github\.io\/[^/]+\/(.*)$/.exec(t.url || ""); if (!m) continue;
        const D = await liveGet("docs/" + m[1].replace(/\/?$/, "/") + "bracket.json");
        if (D && D.name) { try { items.push(...liveItems(D, t, mine)); } catch (_) {} }
      }
      if (on("hillcard") && mine.size) { try { const H = await liveGet("docs/hill/board.json"); items.unshift(...hillItems(H, mine)); } catch (_) {} }
      LIVE.items = items; LIVE.at = Date.now(); mountLive();
    } finally { LIVE.busy = false; }
  }
  const LIVE_HIDE_KEY = "sbx-live-hidden";
  const liveHidden = () => { try { return JSON.parse(sessionStorage.getItem(LIVE_HIDE_KEY) || "{}"); } catch (_) { return {}; } };
  // Box-score toasts share the bottom-right corner, so they sit just above the chip.
  function liveLift() { const el = document.getElementById("sbx-live"); document.documentElement.style.setProperty("--sbx-live-h", el ? (el.offsetHeight + 8) + "px" : "0px"); }
  // The 🏆 Tournaments button (always there: it opens the Tournaments page) with a card above it for each
  // tournament you're in. ▾ on the button folds the cards away; the button then shows how many are waiting.
  const TOURNEY_HOME = "https://slipnsliders.github.io/smallball-tools/tournaments/";
  const LIVE_MIN_KEY = "sbx-live-min";
  const liveMin = () => { try { return sessionStorage.getItem(LIVE_MIN_KEY) === "1"; } catch (_) { return false; } };
  function mountLive() {
    if (!on("live")) return;
    let el = document.getElementById("sbx-live");
    const hidden = liveHidden(), items = LIVE.items.filter((x) => hidden[x.k] !== JSON.stringify(x.lines));
    const min = liveMin(), su = LIVE.signups || 0;
    const key = JSON.stringify(items) + min + su;
    if (el && el.isConnected && el.dataset.key === key) return;
    if (!el) {
      el = document.createElement("div"); el.id = "sbx-live";
      el.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:2147482990;width:min(380px,calc(100vw - 24px));display:flex;flex-direction:column;align-items:stretch;gap:8px;font:14px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;pointer-events:none";
    }
    if (!el.isConnected) document.body.appendChild(el);
    el.dataset.key = key;
    const pill = "white-space:nowrap;flex:none;border:0;border-radius:999px;font:800 14px/1 system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.35);cursor:pointer;pointer-events:auto;text-decoration:none;display:inline-flex;align-items:center;gap:6px";
    const cards = min ? "" : items.map((x, i) => {
      const bg = x.bell ? "linear-gradient(180deg,#8a6200,#3b2400)" : x.hill ? "linear-gradient(180deg,#7a1f2b,#2b0d12)" : x.scr ? "linear-gradient(180deg,#1f5a36,#0c3322)" : "linear-gradient(180deg,#1b2b52,#0e1b33)";
      const edge = x.bell ? "#facc15" : x.hill ? "#ef4444" : x.scr ? "#4ade80" : "#facc15";
      const ln = x.lines.map((l) => '<div style="margin-top:6px;display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="flex:1;min-width:180px">' + l.t + "</span>" +
        (l.go ? '<a href="' + esc(l.go) + '"' + (l.ext ? ' target="_blank" rel="noopener"' : "") + ' style="background:#facc15;color:#1b1300;text-decoration:none;font-weight:800;border-radius:999px;padding:5px 12px;white-space:nowrap">' + (l.btn || "▶ Start") + "</a>" : "") + "</div>").join("");
      return '<div style="pointer-events:auto;background:' + bg + ';color:#f4efe2;border-radius:14px;padding:11px 12px 11px 14px;box-shadow:0 10px 28px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.1);border-left:5px solid ' + edge + '">' +
        '<div style="display:flex;align-items:center;gap:8px"><b style="flex:1;font-size:15px;letter-spacing:.2px">' + esc(x.title) + "</b>" +
        '<a href="' + esc(x.url) + '" target="_blank" style="color:#facc15;font-size:12px;text-decoration:none;white-space:nowrap">' + (x.hill ? "📊 HtH Leaderboard" : x.scr ? "🔎 Card" : "🗂️ Bracket") + "</a>" +
        '<button data-x="' + i + '" title="Hide this card until something changes" style="background:rgba(255,255,255,.12);border:0;color:inherit;cursor:pointer;font-size:14px;line-height:1;border-radius:999px;width:24px;height:24px">×</button></div>' +
        (x.sub ? '<div style="font-size:13px;opacity:.92;margin-top:3px">' + x.sub + "</div>" : "") + ln + "</div>";
    }).join("");
    const fold = items.length ? '<button data-fold title="' + (min ? "Show your cards" : "Tuck these cards away (the button stays)") + '" style="' + pill + ';padding:9px 14px;background:#0b1220;color:#fde68a;border:1px solid #475569">' +
      (min ? "▴ Show " + items.length + " card" + (items.length === 1 ? "" : "s") : "▾ Hide cards") + "</button>" : "";
    const home = '<a data-home href="' + TOURNEY_HOME + '" target="_blank" rel="noopener" title="SmallBall tournaments: brackets, sign-ups, the Hall of Champions" style="' + pill + ';padding:10px 16px;background:linear-gradient(135deg,#b45309,#f59e0b);color:#1c1917">🏆 Tournaments' +
      (su ? '<span style="font:700 11px/1 system-ui,sans-serif;background:#14532d;color:#bbf7d0;border-radius:999px;padding:4px 7px">sign-ups open</span>' : "") + "</a>";
    el.innerHTML = cards + '<div style="display:flex;justify-content:flex-end;gap:8px">' + fold + home + "</div>";
    el.querySelectorAll("[data-x]").forEach((b) => { b.onclick = () => { const x = items[Number(b.dataset.x)], h = liveHidden(); h[x.k] = JSON.stringify(x.lines); try { sessionStorage.setItem(LIVE_HIDE_KEY, JSON.stringify(h)); } catch (_) {} mountLive(); }; });
    const fb = el.querySelector("[data-fold]"); if (fb) fb.onclick = () => { try { sessionStorage.setItem(LIVE_MIN_KEY, min ? "0" : "1"); } catch (_) {} mountLive(); };
    el.querySelectorAll("code").forEach((c) => { c.style.cssText = "font:700 12px ui-monospace,monospace;background:rgba(250,204,21,.18);color:#fde68a;border-radius:5px;padding:1px 5px"; });
    liveLift();
  }
  setTimeout(() => liveRefresh(true), 3000);
  setInterval(() => liveRefresh(false), 180000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - LIVE.at > 60000) liveRefresh(false); });
  // Keep everything mounted as the page re-renders.
  let busy = false;
  const tick = () => {
    if (busy) return;
    busy = true;
    // Each part runs on its own: one failing never stops the others.
    const safe = (fn) => { try { fn(); } catch (e) { if (!safe.seen) { safe.seen = 1; console.warn("[Club Kit]", e); } } };
    try {
      safe(mountTabs);
      if (on("dash")) safe(mountDash);
      if (on("logos")) safe(decorate);
      if (on("parks")) safe(mountParkRecords);
      if (on("achtidy")) safe(mountAchTidy);
      safe(mountSuspects);
      if (on("games")) safe(mountGamesFold);
      if (on("livebar")) safe(mountLiveCtl);
      safe(mountSquad);
      if (on("notes")) safe(mountNotes);
      safe(paintTitle);
      if (on("charge")) safe(mountCharge);
      if (on("live")) safe(mountLive);
    } finally { busy = false; }
  };
  new MutationObserver(tick).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", () => setTimeout(tick, 0));
  setTimeout(tick, 0);
  loadLogos();
  function setGood(v) {
    try { localStorage.setItem(GOOD_KEY, v ? "1" : "0"); } catch (_) {}
    document.querySelectorAll(".sbx-good input").forEach((x) => { x.checked = v; });
    document.querySelectorAll('[data-k="kind"]').forEach((x) => { x.value = v ? "good" : "all"; });
    // Rebuild everything that counts games.
    dashState.at = 0; try { sessionStorage.removeItem("sbx-dash-cache"); } catch (_) {}
    document.getElementById("sbx-dash-wrap")?.remove();
    GSUM.at = 0; GSUM.team = null;
    PR.kind = v ? "good" : "all";
    if (PIT.rows) { PIT.rows = null; PIT.team = 0; }
    const cb = document.getElementById("sbx-cmp"); if (cb) cb.dataset.h = "";
    document.querySelectorAll("[data-sbx-painted]").forEach((g) => { g.dataset.sbxPainted = ""; });
    setTimeout(tick, 0); paintCompare();
  }
  document.addEventListener("change", (ev) => {
    const box = ev.target.closest && ev.target.closest(".sbx-good input");
    if (box) setGood(box.checked);
  }, true);
  // When you flip SmallBall's own Passive Training switch, refresh that club's card and tab: show the new
  // state straight away, then re-read the club once the site has saved it (or put it back if it didn't).
  document.addEventListener("change", (ev) => {
    if (!ev.target || ev.target.id !== "t-passive") return;
    const team = Number((location.hash.match(/^#\/team\/(\d+)/) || [])[1]); if (!team) return;
    const want = ev.target.checked;
    const redraw = () => {
      dashState.at = 0; dashState.cards = null; try { sessionStorage.removeItem("sbx-dash-cache"); } catch (_) {}
      const tb = document.getElementById("sbx-tabs"); if (tb) tb.dataset.key = "";
      buildDash(true);
    };
    if (PROF[team] && PROF[team].data) { PROF[team].data.passive_training = want; redraw(); }
    const later = (n) => { if (dashState.busy && n < 40) return setTimeout(() => later(n + 1), 250); delete PROF[team]; redraw(); };
    setTimeout(() => later(0), 1200);
  });
})();
// SmallBall Club Kit: ROTATE BENCH for Passive Training clubs.
// Games train the men who play and spend their TP, so this swaps the bench men with the most TP in for the
// most drained starters (the pitcher stays). It only fills in the lineup form: nothing is saved until you
// press Save yourself. Turn it off in the Club Kit's ⚙ under Features.
(() => {
  if (window.top !== window) return;
  try { if (JSON.parse(localStorage.getItem("sbx-features") || "{}").rotate === false) return; } catch (_) {}
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  async function getJSON(url) {
    const r = await fetch(url, { credentials: "include" });
    if (!r.ok) throw new Error("HTTP " + r.status + " for " + url);
    return r.json();
  }
  function currentTeamId() {
    const m = location.hash.match(/#\/team\/(\d+)/);
    if (m) return Number(m[1]);
    const sel = document.getElementById("who-team");
    return sel && sel.value ? Number(sel.value) : null;
  }
  function setNativeSelectValue(selectEl, newValue) {
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
    if (!nativeSetter) return;
    nativeSetter.call(selectEl, newValue);
    selectEl.dispatchEvent(new Event("input", { bubbles: true }));
    selectEl.dispatchEvent(new Event("change", { bubbles: true }));
  }
  const posSelect = (i) => document.querySelector(`select[data-pos="${i}"]`);

  // The button sits after Save (and after PlayerOptimizer III's AUTO-OPTIMIZE when that's there). Your own clubs only:
  // other clubs have no lineup editor.
  function mount() {
    const save = document.getElementById("lu-save");
    const have = document.getElementById("sbx-rotate-bar");
    if (!save || !posSelect(0)) { if (have) have.remove(); return; }
    if (have) return;
    const bar = document.createElement("span");
    bar.id = "sbx-rotate-bar";
    bar.style.cssText = "display:inline-flex;align-items:center;gap:10px;margin-left:12px;";
    const btn = document.createElement("button");
    btn.type = "button"; btn.textContent = "ROTATE BENCH";
    btn.title = "Passive Training: swap the bench men with the most TP in for the most drained starters (your pitcher stays). Fills the form only; you still press Save.";
    btn.style.cssText = "padding:8px 16px;background:#15803d;color:#fff;border:none;border-radius:20px;font-weight:700;cursor:pointer;font-size:13px;";
    const status = document.createElement("span");
    status.style.cssText = "font-size:12px;opacity:.85;";
    btn.onclick = async () => {
      btn.disabled = true; status.textContent = "Working…";
      try { await runRotate(status); }
      catch (err) { status.textContent = "Could not rotate: " + (err && err.message ? err.message : err); }
      finally { btn.disabled = false; }
    };
    bar.append(btn, status);
    const after = document.getElementById("sb-optimizer-bar") || save;
    after.parentNode.insertBefore(bar, after.nextSibling);
  }
  new MutationObserver(mount).observe(document.body, { childList: true, subtree: true });
  setTimeout(mount, 0);

  // Rotate bench (Passive Training). Dropdowns data-pos 0..8 = 1B 2B SS 3B LF CF RF P C, 9..11 = bench.
  const DD = ["1B", "2B", "SS", "3B", "LF", "CF", "RF", "P", "C", "bench", "bench", "bench"];
  const ROT_MIN_GAP = 20;
  async function runRotate(status) {
    const teamId = currentTeamId();
    if (!teamId) throw new Error("open one of your club pages first");
    if (!posSelect(0)) throw new Error("lineup dropdowns not found on this page");
    status.textContent = "Reading your club…";
    const profile = await getJSON(`/teams/${teamId}/profile`);
    if (!profile.mine) throw new Error("not your club");
    const byId = new Map(profile.roster.map((p) => [String(p.player_id), p]));
    const cur = [];
    for (let i = 0; i < 12; i++) { const sel = posSelect(i); if (!sel) throw new Error("lineup dropdowns not found on this page"); cur.push(sel.value); }
    if (cur.some((v) => !byId.has(v))) throw new Error("couldn't match the lineup to your roster");
    const tp = (id) => +byId.get(id).tp || 0;
    const nm = (id) => String(byId.get(id).name).replace(/\*+$/, "");
    // Out: fielders (not the pitcher) with the least TP. In: bench men with the most TP.
    const outs = [0, 1, 2, 3, 4, 5, 6, 8].sort((a, b) => tp(cur[a]) - tp(cur[b]));
    const ins = [9, 10, 11].sort((a, b) => tp(cur[b]) - tp(cur[a]));
    const swaps = [];
    for (let k = 0; k < ins.length; k++) {
      const o = outs[k], n = ins[k];
      if (o == null || tp(cur[n]) - tp(cur[o]) < ROT_MIN_GAP) break;
      swaps.push([o, n]);
    }
    if (!swaps.length) { status.textContent = `Nothing to rotate: no bench man has ${ROT_MIN_GAP}+ more TP than a starter.`; return; }
    const target = cur.slice();
    for (const [o, n] of swaps) { target[o] = cur[n]; target[n] = cur[o]; }
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < 12; i++) {
        const sel = posSelect(i);
        if (sel && sel.value !== target[i]) { setNativeSelectValue(sel, target[i]); await sleep(120); }
      }
      if (target.every((id, i) => posSelect(i) && posSelect(i).value === id)) break;
    }
    const ok = target.every((id, i) => posSelect(i) && posSelect(i).value === id);
    renderRotateBanner(swaps.map(([o, n]) => ({ pos: DD[o], inName: nm(cur[n]), inTp: tp(cur[n]), outName: nm(cur[o]), outTp: tp(cur[o]) })), nm(cur[7]), tp(cur[7]), ok);
    status.textContent = ok ? "Rotated. Check the batting order, then press Save." : "Partly filled. Check the lineup before saving.";
  }
  function renderRotateBanner(rows, pName, pTp, ok) {
    document.getElementById("sbx-rotate-banner")?.remove();
    const anchor = document.getElementById("sbx-rotate-bar") || document.getElementById("lu-save");
    if (!anchor || !anchor.parentNode) return;
    const d = document.createElement("div");
    d.id = "sbx-rotate-banner";
    d.style.cssText = "margin-top:14px;padding:14px 16px;border-radius:12px;background:#f0fdf4;border:1px solid #86efac;color:#14532d;font-size:13px;line-height:1.5;";
    d.innerHTML = `<b>Bench rotation${ok ? "" : " (partly filled)"}</b> · Passive Training spends the TP of the men who play.<br>` +
      rows.map((r) => `<b>${esc(r.inName)}</b> (${Math.round(r.inTp)} TP) in at ${r.pos} for ${esc(r.outName)} (${Math.round(r.outTp)} TP), who sits and refills.`).join("<br>") +
      `<br><span style="opacity:.8">${esc(pName)} stays on the mound (${Math.round(pTp)} TP). Batting order: check it, then press <b>Save</b>. Nothing is saved until you do.</span>`;
    anchor.parentNode.insertBefore(d, anchor.nextSibling);
  }

})();
// SmallBall Club Kit: 🧩 LINEUP BUILDER.
// Drag men between positions, the bench and the batting order, or let ⚡ Optimize build the lineup YOUR way
// (presets, sliders, rules, 🔒 locks). It only fills in SmallBall's own lineup form: nothing is saved until you
// press Save yourself. Your settings are kept per club in this browser. Turn it off in the Club Kit's ⚙ under Features.
(() => {
  if (window.top !== window) return;
  try { if (JSON.parse(localStorage.getItem("sbx-features") || "{}").builder === false) return; } catch (_) {}

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const POS = ["1B", "2B", "SS", "3B", "LF", "CF", "RF", "P", "C", "B1", "B2", "B3"];
  const FIELD = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  const posSelect = (i) => document.querySelector(`#t-lineup select[data-pos="${i}"], select[data-pos="${i}"]`);
  const KEY = "sbx-builder";

  // ---------- settings ----------
  const PRESETS = {
    balanced: { label: "⚖️ Balanced", w: { bc: 5, bs: 5, bp: 5, r: 4, d: 5, tp: 0 }, order: "classic", tip: "A bit of everything." },
    moneyball: { label: "📊 Moneyball", w: { bc: 8, bs: 7, bp: 4, r: 2, d: 4, tp: 0 }, order: "best", tip: "Get on base. Contact and batting skill first." },
    smallball: { label: "🏃 Small Ball", w: { bc: 7, bs: 4, bp: 1, r: 9, d: 6, tp: 0 }, order: "speed", tip: "Speed and contact, and a good glove." },
    power: { label: "💣 Power", w: { bc: 3, bs: 4, bp: 10, r: 2, d: 3, tp: 0 }, order: "classic", tip: "Swing for the fences." },
    defense: { label: "🧤 Defense first", w: { bc: 4, bs: 4, bp: 3, r: 3, d: 10, tp: 0 }, order: "classic", tip: "Best gloves and arms on the field." },
    passive: { label: "🔋 Passive Training", w: { bc: 4, bs: 4, bp: 4, r: 3, d: 4, tp: 10 }, order: "classic", tip: "Play the men with the most TP so it gets spent." },
  };
  const SLIDERS = [
    ["bc", "Contact", "BC: puts the ball in play"],
    ["bs", "Batting skill", "BS: quality of contact"],
    ["bp", "Power", "BP: extra bases and homers"],
    ["r", "Speed", "R: on the bases and in the field"],
    ["d", "Defense", "How much the glove and arm matter at each position"],
    ["tp", "Training (TP)", "Passive Training: start the men with the most TP"],
  ];
  const ORDERS = { classic: "Classic (table-setters 1–2, power 3–5)", best: "Best hitters at the top", speed: "Speed at the top", keep: "Keep my order" };
  const allCfg = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (_) { return {}; } };
  function cfg(team) {
    const c = allCfg()[team] || {};
    const base = PRESETS[c.preset] || PRESETS.balanced;
    return { preset: c.preset || "balanced", w: { ...base.w, ...(c.w || {}) }, order: c.order || base.order, p9: c.p9 !== false, orderOnly: !!c.orderOnly, locks: c.locks || [] };
  }
  function saveCfg(team, c) { const a = allCfg(); a[team] = c; try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (_) {} }

  // ---------- reading SmallBall's form ----------
  function teamId() { const m = location.hash.match(/#\/team\/(\d+)/); return m ? Number(m[1]) : null; }
  function setSel(sel, v) {
    const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    if (!set) return;
    set.call(sel, v);
    sel.dispatchEvent(new Event("input", { bubbles: true }));
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  }
  const orderRows = () => [...document.querySelectorAll("#t-lineup ol.order li")];
  function rowName(li) {
    const c = li.cloneNode(true);
    c.querySelectorAll("span,em,button,i,small").forEach((x) => x.remove());
    return c.textContent.replace(/\s+/g, " ").trim();
  }
  function readForm(byName) {
    const pos = [];
    for (let i = 0; i < 12; i++) { const s = posSelect(i); if (!s) return null; pos.push(s.value); }
    const order = orderRows().map((li) => (byName.get(rowName(li)) || {}).id || null);
    return { pos, order };
  }

  // ---------- scoring ----------
  const S = (p, k) => Number(p[k]) || 0;
  const glove = (p) => S(p, "catch_skill"), arm = (p) => S(p, "pass_power"), spd = (p) => S(p, "run_speed");
  const DEF = {
    "1B": (p) => 0.8 * glove(p) + 0.2 * arm(p),
    "2B": (p) => 0.6 * glove(p) + 0.2 * arm(p) + 0.2 * spd(p),
    SS: (p) => 0.45 * glove(p) + 0.35 * arm(p) + 0.2 * spd(p),
    "3B": (p) => 0.5 * glove(p) + 0.5 * arm(p),
    LF: (p) => 0.45 * glove(p) + 0.25 * arm(p) + 0.3 * spd(p),
    CF: (p) => 0.35 * glove(p) + 0.2 * arm(p) + 0.45 * spd(p),
    RF: (p) => 0.4 * glove(p) + 0.35 * arm(p) + 0.25 * spd(p),
    C: (p) => 0.55 * glove(p) + 0.45 * arm(p),
    P: (p) => S(p, "pitch_skill"),
  };
  const DEF_WHY = { "1B": "glove", "2B": "glove, quickness", SS: "glove, arm, range", "3B": "glove, arm", LF: "glove, speed", CF: "speed, glove", RF: "arm, glove", C: "glove, arm", P: "pitching" };
  function offense(p, w) {
    const t = w.bc + w.bs + w.bp + w.r;
    return t ? (w.bc * S(p, "contact_odds") + w.bs * S(p, "swing_skill") + w.bp * S(p, "swing_power") + w.r * spd(p)) / t : 0;
  }
  function value(p, posName, w, tpN) {
    if (posName === "P") return 3 * S(p, "pitch_skill") + 0.3 * offense(p, w) + (w.tp / 5) * tpN(p);
    return offense(p, w) + (w.d / 5) * DEF[posName](p) + (w.tp / 5) * tpN(p);
  }

  // Hungarian algorithm (minimize cost) for a square matrix.
  function hungarian(cost) {
    const n = cost.length, u = Array(n + 1).fill(0), v = Array(n + 1).fill(0), p = Array(n + 1).fill(0), way = Array(n + 1).fill(0);
    for (let i = 1; i <= n; i++) {
      p[0] = i; let j0 = 0; const minv = Array(n + 1).fill(Infinity), used = Array(n + 1).fill(false);
      do {
        used[j0] = true; const i0 = p[j0]; let delta = Infinity, j1 = 0;
        for (let j = 1; j <= n; j++) if (!used[j]) {
          const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
        for (let j = 0; j <= n; j++) { if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta; }
        j0 = j1;
      } while (p[j0] !== 0);
      do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
    }
    const ans = Array(n); for (let j = 1; j <= n; j++) if (p[j]) ans[p[j] - 1] = j - 1;
    return ans; // ans[row] = column
  }

  function optimize(st, c) {
    const men = st.pos.map((id) => st.byId.get(id));
    const tps = men.map((p) => S(p, "tp")), lo = Math.min(...tps), hi = Math.max(...tps);
    const tpN = (p) => (hi > lo ? (100 * (S(p, "tp") - lo)) / (hi - lo) : 0);
    let pos = st.pos.slice();
    if (!c.orderOnly) {
      const locked = new Set(c.locks.map(String));
      // rows = the 12 men (in their current spots), columns = the 12 spots
      const BIG = 1e6;
      const cost = men.map((p, r) => POS.map((name, col) => {
        const isLocked = locked.has(String(p.player_id));
        if (isLocked) return col === r ? -BIG : BIG;
        if (locked.has(st.pos[col]) ) return BIG; // that spot belongs to a locked man
        return col >= 9 ? 0 : -value(p, name, c.w, tpN);
      }));
      const a = hungarian(cost);
      const next = Array(12);
      a.forEach((col, r) => { next[col] = String(men[r].player_id); });
      // bench: most TP first in B1 (cosmetic), locked bench men stay put
      const benchFree = [9, 10, 11].filter((i) => !locked.has(st.pos[i]));
      const benchMen = benchFree.map((i) => next[i]).sort((x, y) => S(st.byId.get(y), "tp") - S(st.byId.get(x), "tp"));
      benchFree.forEach((i, k) => { next[i] = benchMen[k]; });
      pos = next;
    }
    // batting order of the 9 starters
    const starters = FIELD.map((i) => pos[i]);
    const P = pos[7];
    const off = (id) => offense(st.byId.get(id), c.w);
    let order;
    if (c.order === "keep") {
      const prev = st.order.filter((id) => starters.includes(id));
      const add = starters.filter((id) => !prev.includes(id));
      // a new starter takes the order spot of the man he replaced
      order = st.order.map((id) => (starters.includes(id) ? id : add.shift() || null)).filter(Boolean);
      add.forEach((id) => order.push(id));
    } else {
      let pool = starters.filter((id) => !(c.p9 && id === P));
      const by = (f) => (x, y) => f(st.byId.get(y)) - f(st.byId.get(x));
      if (c.order === "best") order = pool.sort((x, y) => off(y) - off(x));
      else if (c.order === "speed") order = pool.sort(by((p) => spd(p) * 2 + offense(p, c.w)));
      else {
        const lead = (p) => 0.45 * S(p, "contact_odds") + 0.25 * S(p, "swing_skill") + 0.3 * spd(p);
        const heart = (p) => 0.5 * S(p, "swing_power") + 0.3 * S(p, "swing_skill") + 0.2 * S(p, "contact_odds");
        const take = (f) => { pool.sort(by(f)); return pool.shift(); };
        const one = take(lead), two = take(lead), four = take(heart), three = take(heart), five = take(heart);
        order = [one, two, three, four, five, ...pool.sort((x, y) => off(y) - off(x))];
      }
      if (c.p9) order.push(P);
    }
    return { pos, order };
  }

  // ---------- writing SmallBall's form ----------
  let busy = false;
  async function apply(target, st) {
    busy = true;
    try {
      for (let pass = 0; pass < 3; pass++) {
        for (let i = 0; i < 12; i++) {
          const s = posSelect(i);
          if (s && s.value !== target.pos[i]) { setSel(s, target.pos[i]); await sleep(90); }
        }
        if (target.pos.every((id, i) => posSelect(i) && posSelect(i).value === id)) break;
      }
      await sleep(150);
      const nm = (id) => st.byId.get(id).name;
      for (let t = 0; t < target.order.length; t++) {
        for (let tries = 0; tries < 12; tries++) {
          const rows = orderRows();
          const at = rows.findIndex((li) => rowName(li) === nm(target.order[t]));
          if (at <= t) break;
          const up = [...rows[at].querySelectorAll("button")].find((b) => b.textContent.trim() === "▲");
          if (!up || up.disabled) break;
          up.click(); await sleep(70);
        }
      }
      await sleep(100);
    } finally { busy = false; }
  }

  // ---------- UI ----------
  const CSS = `
  #sbx-build { margin: 0 0 16px; padding: 14px 16px 16px; border-radius: 14px; background: linear-gradient(180deg, rgba(30,41,82,.92), rgba(14,22,44,.95)); color: #eef2ff; box-shadow: 0 8px 24px rgba(0,0,0,.35), 0 0 0 1px rgba(255,255,255,.08); font: 14px/1.35 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  #sbx-build * { box-sizing: border-box; }
  #sbx-build .bh { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  #sbx-build .bh .xb-t { flex: 1 1 320px; min-width: 0; } #sbx-build .bh h3 { margin: 0; font-size: 18px; }
  #sbx-build .bh .xb-sub { margin: 3px 0 0; font: 400 12.5px/1.35 system-ui, sans-serif; opacity: .8; text-transform: none; letter-spacing: normal; }
  #sbx-build .bb { border: 0; border-radius: 999px; padding: 8px 14px; font: 800 13px/1 system-ui, sans-serif; cursor: pointer; background: rgba(255,255,255,.12); color: inherit; }
  #sbx-build .bb.go { background: #facc15; color: #1b1300; }
  #sbx-build .bb:disabled { opacity: .5; cursor: wait; }
  #sbx-build .field, #sbx-build .ord { min-width: 0; }
  #sbx-build .cols { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 14px; margin-top: 12px; }
  @media (max-width: 760px) { #sbx-build .cols { grid-template-columns: 1fr; } }
  #sbx-build .field { position: relative; border-radius: 12px; padding: 10px; background: radial-gradient(ellipse at 50% 120%, #8a5a2b 0 34%, transparent 35%), repeating-linear-gradient(90deg, #2f6b3a 0 26px, #2a6134 26px 52px); display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px 6px; }
  #sbx-build .slot { min-width: 0; border-radius: 10px; padding: 4px; min-height: 64px; background: rgba(0,0,0,.18); border: 2px dashed transparent; }
  #sbx-build .slot > b { display: block; font: 800 11px/1 ui-monospace, monospace; letter-spacing: .08em; color: #fde68a; margin: 1px 0 3px 3px; }
  #sbx-build .slot.hot, #sbx-build .ord li.hot { border-color: #facc15; background: rgba(250,204,21,.18); }
  #sbx-build .bench { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 4px; padding-top: 8px; border-top: 2px solid rgba(255,255,255,.25); }
  #sbx-build .chip { position: relative; overflow: hidden; min-width: 0; display: block; text-align: left; letter-spacing: normal; text-transform: none; background: #f8f5ec; color: #1e1b14; border-radius: 8px; padding: 5px 7px 5px 8px; cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; box-shadow: 0 2px 6px rgba(0,0,0,.3); }
  #sbx-build .chip.sel { outline: 3px solid #facc15; }
  #sbx-build .chip .xb-n { display: block; font-weight: 800; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 18px; }
  #sbx-build .chip .xb-s { display: block; font-size: 10.5px; opacity: .75; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #sbx-build .chip .fit { height: 3px; border-radius: 2px; margin-top: 3px; background: #e5e7eb; overflow: hidden; }
  #sbx-build .chip .fit i { display: block; height: 100%; }
  #sbx-build .chip .lk { position: absolute; top: 3px; right: 4px; border: 0; background: none; cursor: pointer; font-size: 12px; padding: 0; opacity: .35; }
  #sbx-build .chip .lk.on { opacity: 1; }
  #sbx-build .ord { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
  #sbx-build .ord li { min-width: 0; margin: 0; list-style: none; display: flex; align-items: center; gap: 8px; border-radius: 10px; border: 2px dashed transparent; padding: 1px; }
  #sbx-build .ord li > b { width: 22px; text-align: center; font: 800 15px/1 ui-monospace, monospace; color: #fde68a; flex: none; }
  #sbx-build .ord li .chip { flex: 1; }
  #sbx-build .chip .pos { font: 800 10.5px/1 ui-monospace, monospace; background: #1e293b; color: #fde68a; border-radius: 5px; padding: 2px 5px; margin-right: 2px; vertical-align: 1px; }
  #sbx-build .ghost { position: fixed; z-index: 2147483000; pointer-events: none; opacity: .92; transform: rotate(-2deg) scale(1.04); box-shadow: 0 12px 26px rgba(0,0,0,.45); }
  #sbx-build .cust { margin-top: 12px; padding: 12px; border-radius: 12px; background: rgba(0,0,0,.25); }
  #sbx-build .presets { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
  #sbx-build .presets button { border: 1px solid rgba(255,255,255,.25); background: transparent; color: inherit; border-radius: 999px; padding: 6px 11px; font: 700 12.5px/1 system-ui, sans-serif; cursor: pointer; }
  #sbx-build .presets button.on { background: #facc15; color: #1b1300; border-color: #facc15; }
  #sbx-build .sl { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 6px 16px; }
  #sbx-build .sl label { display: grid; grid-template-columns: 96px 1fr 22px; align-items: center; gap: 8px; font-size: 12.5px; }
  #sbx-build .sl input { width: 100%; accent-color: #facc15; }
  #sbx-build .rules { display: flex; gap: 8px 18px; flex-wrap: wrap; margin-top: 10px; font-size: 12.5px; align-items: center; }
  #sbx-build .rules select { font: inherit; border-radius: 6px; padding: 3px 6px; }
  #sbx-build .why { margin-top: 12px; padding: 10px 12px; border-radius: 10px; background: rgba(250,204,21,.1); border: 1px solid rgba(250,204,21,.35); font-size: 12.5px; }
  #sbx-build .why ul { margin: 6px 0 0; padding-left: 18px; }
  #sbx-build .msg { font-size: 12.5px; opacity: .85; margin-top: 8px; min-height: 1em; }
  `;
  const AREA = { // position index -> [grid-column, grid-row]
    4: ["1 / 3", "1"], 5: ["3 / 5", "1"], 6: ["5 / 7", "1"],
    2: ["2 / 4", "2"], 1: ["4 / 6", "2"],
    3: ["1 / 3", "3"], 7: ["3 / 5", "3"], 0: ["5 / 7", "3"],
    8: ["3 / 5", "4"],
  };

  const ST = { team: null, prof: null, byId: null, byName: null, el: null, sel: null, why: "", snapshot: null, open: false, sig: "" };

  function statLine(p, posName) {
    if (posName === "P") return `Pitch ${S(p, "pitch_skill")} · Glove ${glove(p)}`;
    return `Con ${S(p, "contact_odds")} · Bat ${S(p, "swing_skill")} · Pow ${S(p, "swing_power")} · Spd ${spd(p)}`;
  }
  function chip(id, posName, c, tag) {
    const p = ST.byId.get(id);
    if (!p) return '<div class="chip"><span class="xb-n">?</span></div>';
    const lock = c.locks.map(String).includes(String(id));
    const f = posName && DEF[posName] ? Math.round(DEF[posName](p)) : null;
    const col = f == null ? "" : f >= 80 ? "#16a34a" : f >= 60 ? "#ca8a04" : "#dc2626";
    return `<div class="chip" data-id="${esc(id)}" title="${esc(p.name)} · Contact ${S(p, "contact_odds")}, Batting ${S(p, "swing_skill")}, Power ${S(p, "swing_power")}, Speed ${spd(p)}, Glove ${glove(p)}, Arm ${arm(p)}, Pitch ${S(p, "pitch_skill")} · TP ${S(p, "tp")}${f != null ? ` · ${posName} fit ${f} (${DEF_WHY[posName]})` : ""}">` +
      `<button class="lk${lock ? " on" : ""}" data-lock="${esc(id)}" title="${lock ? "Locked: Optimize leaves him where he is. Click to unlock." : "Lock him here so Optimize leaves him alone"}">${lock ? "🔒" : "🔓"}</button>` +
      `<span class="xb-n">${tag ? `<span class="pos">${esc(tag)}</span> ` : ""}${esc(p.name)}</span><span class="xb-s">${esc(statLine(p, posName))}${S(p, "tp") ? ` · TP ${Math.round(S(p, "tp") * 10) / 10}` : ""}</span>` +
      (f != null ? `<div class="fit"><i style="width:${f}%;background:${col}"></i></div>` : "") + "</div>";
  }

  function render() {
    const el = ST.el, team = ST.team, c = cfg(team);
    const form = readForm(ST.byName);
    if (!form) return;
    ST.form = form; ST.sig = JSON.stringify(form);
    const posOf = (id) => { const i = form.pos.indexOf(id); return i >= 0 ? POS[i] : ""; };
    const field = FIELD.map((i) => `<div class="slot" data-slot="${i}" style="grid-column:${AREA[i][0]};grid-row:${AREA[i][1]}"><b>${POS[i]}</b>${chip(form.pos[i], POS[i], c)}</div>`).join("") +
      `<div class="bench">${[9, 10, 11].map((i) => `<div class="slot" data-slot="${i}"><b>BENCH</b>${chip(form.pos[i], null, c)}</div>`).join("")}</div>`;
    const order = form.order.map((id, k) => `<li data-ord="${k}"><b>${k + 1}</b>${id ? chip(id, null, c, posOf(id)) : '<div class="chip">?</div>'}</li>`).join("");
    const pre = Object.entries(PRESETS).map(([k, v]) => `<button data-preset="${k}" class="${c.preset === k ? "on" : ""}" title="${esc(v.tip)}">${v.label}</button>`).join("");
    const sl = SLIDERS.map(([k, label, tip]) => `<label title="${esc(tip)}"><span>${label}</span><input type="range" min="0" max="10" step="1" data-w="${k}" value="${c.w[k]}"><b>${c.w[k]}</b></label>`).join("");
    el.innerHTML = `<div class="bh"><div class="xb-t"><h3>🧩 Lineup Builder</h3><div class="xb-sub">Drag men between spots, the bench and the batting order (or tap one, then another). It fills SmallBall's form below; nothing is saved until you press <b>Save</b>.</div></div>` +
      `<button class="bb go" data-act="opt" title="Build the lineup and batting order with your settings">⚡ Optimize my way</button>` +
      `<button class="bb" data-act="cust">⚙️ ${ST.open ? "Hide settings" : "My settings"}</button>` +
      (ST.snapshot ? `<button class="bb" data-act="undo" title="Put the form back the way it was before your changes">↺ Undo my changes</button>` : "") + "</div>" +
      (ST.open ? `<div class="cust"><div class="presets">${pre}</div><div class="sl">${sl}</div><div class="rules">` +
        `<label>Batting order: <select data-order>${Object.entries(ORDERS).map(([k, v]) => `<option value="${k}"${c.order === k ? " selected" : ""}>${v}</option>`).join("")}</select></label>` +
        `<label><input type="checkbox" data-p9${c.p9 ? " checked" : ""}> Pitcher bats 9th</label>` +
        `<label><input type="checkbox" data-oo${c.orderOnly ? " checked" : ""}> Only change the batting order</label>` +
        `<span style="opacity:.75">🔒 on a man = Optimize leaves him where he is.</span></div></div>` : "") +
      `<div class="cols"><div class="field">${field}</div><ol class="ord">${order}</ol></div>` +
      (ST.why ? `<div class="why">${ST.why}</div>` : "") + `<div class="msg"></div>`;
    wire();
  }

  function msg(t) { const m = ST.el && ST.el.querySelector(".msg"); if (m) m.innerHTML = t; }
  async function change(target, note) {
    if (busy) return;
    if (!ST.snapshot) ST.snapshot = { pos: ST.form.pos.slice(), order: ST.form.order.slice() };
    ST.el.querySelectorAll("button").forEach((b) => (b.disabled = true));
    msg("Filling in the form…");
    await apply(target, ST);
    ST.sel = null;
    render();
    const ok = readForm(ST.byName);
    const same = ok && target.pos.every((id, i) => ok.pos[i] === id) && target.order.every((id, i) => ok.order[i] === id);
    msg((same ? "✓ " : "⚠️ Partly filled: check the form. ") + (note || "") + " Press <b>Save</b> below to keep it.");
  }

  function swapSlots(a, b) {
    const pos = ST.form.pos.slice(); [pos[a], pos[b]] = [pos[b], pos[a]];
    // the batting order follows the men: a bench man coming in takes the spot of the man he replaced
    const starters = new Set(FIELD.map((i) => pos[i]));
    const order = ST.form.order.map((id) => { if (starters.has(id)) return id; const i = ST.form.pos.indexOf(id); return pos[i]; });
    return { pos, order };
  }
  function moveOrder(from, to) {
    const order = ST.form.order.slice(); const [x] = order.splice(from, 1); order.splice(to, 0, x);
    return { pos: ST.form.pos.slice(), order };
  }
  function drop(src, dst) {
    // src/dst: {slot:i} or {ord:k}
    const who = (i) => ST.byId.get(ST.form.pos[i]).name, where = (i) => (i >= 9 ? "the bench" : POS[i]);
    if (src.slot != null && dst.slot != null && src.slot !== dst.slot) return change(swapSlots(src.slot, dst.slot), who(src.slot) + " to " + where(dst.slot) + ", " + who(dst.slot) + " to " + where(src.slot) + ".");
    if (src.ord != null && dst.ord != null && src.ord !== dst.ord) return change(moveOrder(src.ord, dst.ord), "Batting order changed.");
    if (src.slot != null && dst.ord != null) { // a man onto a batter: he takes that batter's position
      const i = ST.form.pos.indexOf(ST.form.order[dst.ord]);
      if (i >= 0 && i !== src.slot) return change(swapSlots(src.slot, i), "In for " + ST.byId.get(ST.form.order[dst.ord]).name + ".");
    }
    if (src.ord != null && dst.slot != null) {
      const i = ST.form.pos.indexOf(ST.form.order[src.ord]);
      if (i >= 0 && i !== dst.slot) return change(swapSlots(i, dst.slot), who(i) + " to " + where(dst.slot) + ", " + who(dst.slot) + " to " + where(i) + ".");
    }
  }
  const spotOf = (node) => {
    const s = node && node.closest("[data-slot],[data-ord]");
    if (!s || !ST.el.contains(s)) return null;
    return s.dataset.slot != null ? { slot: Number(s.dataset.slot), node: s } : { ord: Number(s.dataset.ord), node: s };
  };

  function wire() {
    const el = ST.el, team = ST.team;
    const c = () => cfg(team);
    el.querySelectorAll("[data-act]").forEach((b) => (b.onclick = async () => {
      const a = b.dataset.act;
      if (a === "cust") { ST.open = !ST.open; render(); }
      else if (a === "undo" && ST.snapshot) { const s = ST.snapshot; await change(s, "Back to how it was."); ST.snapshot = null; ST.why = ""; render(); msg("↺ Back to how it was before your changes."); }
      else if (a === "opt") {
        const conf = c(), t = optimize({ ...ST.form, byId: ST.byId }, conf);
        ST.why = explain(t, conf);
        await change(t, "Optimized with " + (PRESETS[conf.preset] ? PRESETS[conf.preset].label : "your settings") + ".");
      }
    }));
    el.querySelectorAll("[data-preset]").forEach((b) => (b.onclick = () => { const k = b.dataset.preset; const old = c(); saveCfg(team, { ...old, preset: k, w: { ...PRESETS[k].w }, order: PRESETS[k].order }); render(); }));
    el.querySelectorAll("[data-w]").forEach((r) => {
      r.oninput = () => { r.nextElementSibling.textContent = r.value; };
      r.onchange = () => { const old = c(); old.w[r.dataset.w] = Number(r.value); saveCfg(team, { ...old, preset: "custom" }); render(); };
    });
    const o = el.querySelector("[data-order]"); if (o) o.onchange = () => { saveCfg(team, { ...c(), order: o.value }); };
    const p9 = el.querySelector("[data-p9]"); if (p9) p9.onchange = () => { saveCfg(team, { ...c(), p9: p9.checked }); };
    const oo = el.querySelector("[data-oo]"); if (oo) oo.onchange = () => { saveCfg(team, { ...c(), orderOnly: oo.checked }); };
    el.querySelectorAll("[data-lock]").forEach((b) => {
      b.onpointerdown = (e) => e.stopPropagation();
      b.onclick = (e) => { e.stopPropagation(); const cc = c(), id = String(b.dataset.lock); const L = new Set(cc.locks.map(String)); if (L.has(id)) L.delete(id); else L.add(id); saveCfg(team, { ...cc, locks: [...L] }); render(); };
    });
    el.querySelectorAll(".chip[data-id]").forEach((ch) => (ch.onpointerdown = (e) => startDrag(e, ch)));
  }

  function startDrag(e, ch) {
    if (busy || e.button > 0) return;
    const src = spotOf(ch); if (!src) return;
    const x0 = e.clientX, y0 = e.clientY;
    let ghost = null, hot = null;
    const r = ch.getBoundingClientRect();
    const move = (ev) => {
      if (!ghost) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
        ghost = ch.cloneNode(true); ghost.classList.add("ghost"); ghost.style.width = r.width + "px"; ST.el.appendChild(ghost);
        ch.style.opacity = ".35";
      }
      ev.preventDefault();
      ghost.style.left = ev.clientX - r.width / 2 + "px"; ghost.style.top = ev.clientY - 18 + "px";
      const t = spotOf(document.elementFromPoint(ev.clientX, ev.clientY));
      if (hot && (!t || t.node !== hot)) hot.classList.remove("hot");
      hot = t && t.node !== src.node ? t.node : null;
      if (hot) hot.classList.add("hot");
    };
    const up = (ev) => {
      document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
      if (hot) hot.classList.remove("hot");
      if (ghost) {
        ghost.remove(); ch.style.opacity = "";
        const t = spotOf(document.elementFromPoint(ev.clientX, ev.clientY));
        if (t) drop(src, t);
        return;
      }
      // a tap: pick this man, then tap another to swap or move
      if (ST.sel && ST.sel.node.isConnected && ST.sel.node !== src.node) { const s = ST.sel; ST.sel = null; ST.el.querySelectorAll(".chip.sel").forEach((x) => x.classList.remove("sel")); drop(s, src); return; }
      ST.el.querySelectorAll(".chip.sel").forEach((x) => x.classList.remove("sel"));
      if (ST.sel && ST.sel.node === src.node) { ST.sel = null; msg(""); return; }
      ST.sel = src; ch.classList.add("sel"); msg("Now tap where he should go.");
    };
    document.addEventListener("pointermove", move, { passive: false }); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
  }

  function explain(t, c) {
    const was = new Set(FIELD.map((i) => ST.form.pos[i]));
    const ins = FIELD.map((i) => t.pos[i]).filter((id) => !was.has(id)).map((id) => ST.byId.get(id).name);
    const outs = [...was].filter((id) => !FIELD.map((i) => t.pos[i]).includes(id)).map((id) => ST.byId.get(id).name);
    const lines = c.orderOnly ? [] : FIELD.map((i) => {
      const p = ST.byId.get(t.pos[i]);
      return `<li><b>${POS[i]}</b> ${esc(p.name)}: ${POS[i] === "P" ? "pitching " + S(p, "pitch_skill") : `fit ${Math.round(DEF[POS[i]](p))} (${DEF_WHY[POS[i]]}), bat ${Math.round(offense(p, c.w))}`}</li>`;
    });
    const name = PRESETS[c.preset] ? PRESETS[c.preset].label : "🎛️ Your custom mix";
    return `<b>⚡ ${esc(name)}</b> · order: ${esc(ORDERS[c.order])}${c.p9 && c.order !== "keep" ? ", pitcher 9th" : ""}${c.locks.length ? ` · 🔒 ${c.locks.length} locked` : ""}` +
      (ins.length ? `<br>In: <b>${ins.map(esc).join(", ")}</b> · Out: ${outs.map(esc).join(", ")}` : c.orderOnly ? "" : "<br>Same nine men, maybe in new spots.") +
      (lines.length ? `<ul>${lines.join("")}</ul>` : "") + `<div style="opacity:.75;margin-top:4px">Bat = your mix of contact, batting skill, power and speed. Fit = glove, arm and speed for that position.</div>`;
  }

  // ---------- after Save: ask SmallBall what it actually kept ----------
  // field_pos lists the nine starters in this order (roster slots); batting_order lists positions (indexes into it).
  const SERVER_POS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
  async function verifySave(expect) {
    const say = (html, ok) => {
      const m = document.getElementById("lu-msg"); if (!m) return;
      let x = document.getElementById("sbx-build-check");
      if (!x) { x = document.createElement("div"); x.id = "sbx-build-check"; m.parentElement.appendChild(x); }
      x.style.cssText = "margin-top:8px;padding:8px 12px;border-radius:10px;font:600 13px/1.4 system-ui,sans-serif;" + (ok ? "background:rgba(22,163,74,.15);border:1px solid rgba(22,163,74,.5)" : "background:rgba(220,38,38,.15);border:1px solid rgba(220,38,38,.55)");
      x.innerHTML = html;
    };
    try {
      const prof = await (await fetch(`/teams/${ST.team}/profile`, { credentials: "include", cache: "no-store" })).json();
      const bySlot = new Map(prof.roster.map((p) => [Number(p.slot), p]));
      const nm = (id) => (ST.byId.get(String(id)) || {}).name || "?";
      const diffs = [];
      (prof.field_pos || []).forEach((slot, k) => {
        const have = String((bySlot.get(Number(slot)) || {}).player_id), want = expect.pos[POS.indexOf(SERVER_POS[k])];
        if (have !== want) diffs.push(`${SERVER_POS[k]}: SmallBall has ${esc(nm(have))}, the form had ${esc(nm(want))}`);
      });
      const order = (prof.batting_order || []).map((k) => String((bySlot.get(Number(prof.field_pos[k])) || {}).player_id));
      const badOrder = order.length === expect.order.length && order.some((id, i) => id !== expect.order[i]);
      if (!diffs.length && !badOrder) say("🧩 ✓ Checked with SmallBall: it has this exact lineup and batting order.", true);
      else say("🧩 ⚠️ SmallBall didn't keep everything:<br>" + diffs.concat(badOrder ? ["Batting order: SmallBall has " + order.map((id) => esc(nm(id))).join(", ")] : []).join("<br>") +
        "<br><span style=\"font-weight:400;opacity:.85\">Reload the page and try again, or set it with the dropdowns. Please screenshot this for slipnsliders.</span>", false);
    } catch (e) { say("🧩 Couldn't check with SmallBall (" + esc(e.message || e) + ").", false); }
  }
  document.addEventListener("click", (e) => {
    if (!e.target || !e.target.closest || !e.target.closest("#lu-save") || !ST.prof || !ST.prof.mine) return;
    const expect = readForm(ST.byName); if (!expect) return;
    const old = document.getElementById("sbx-build-check"); if (old) old.remove();
    setTimeout(() => verifySave(expect), 2000);
  }, true);

  // ---------- mount ----------
  let loading = false;
  async function mount() {
    const lu = document.getElementById("t-lineup"), save = document.getElementById("lu-save"), team = teamId();
    const have = document.getElementById("sbx-build");
    if (!lu || !save || !team || !posSelect(0)) { if (have) have.remove(); return; }
    if (ST.team !== team) { ST.team = team; ST.prof = null; ST.snapshot = null; ST.why = ""; ST.sel = null; }
    if (!ST.prof) {
      if (loading) return; loading = true;
      try {
        const prof = await (await fetch(`/teams/${team}/profile`, { credentials: "include" })).json();
        if (!prof || !prof.mine || !Array.isArray(prof.roster)) { loading = false; ST.prof = { mine: false }; return; }
        ST.prof = prof;
        ST.byId = new Map(prof.roster.map((p) => [String(p.player_id), p]));
        ST.byName = new Map(prof.roster.map((p) => [String(p.name).trim(), { id: String(p.player_id) }]));
      } catch (_) { loading = false; return; }
      loading = false;
    }
    if (!ST.prof.mine) { if (have) have.remove(); return; }
    if (!document.getElementById("sbx-build-css")) { const s = document.createElement("style"); s.id = "sbx-build-css"; s.textContent = CSS; document.head.appendChild(s); }
    if (!have || have.nextElementSibling !== lu) {
      ST.el = have || document.createElement("div"); ST.el.id = "sbx-build";
      lu.parentElement.insertBefore(ST.el, lu);
      ST.sig = "";
    }
    if (busy) return;
    const f = readForm(ST.byName); if (!f) return;
    const sig = JSON.stringify(f);
    if (sig !== ST.sig) { ST.sig = sig; render(); }
  }
  let t = 0;
  new MutationObserver((muts) => {
    if (busy) return;
    if (ST.el && muts.every((m) => ST.el.contains(m.target))) return;
    clearTimeout(t); t = setTimeout(mount, 150);
  }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener("change", (e) => { if (!busy && e.target && e.target.matches && e.target.matches("select[data-pos]")) { clearTimeout(t); t = setTimeout(mount, 150); } }, true);
  window.addEventListener("hashchange", () => setTimeout(mount, 300));
  setTimeout(mount, 500);
})();
