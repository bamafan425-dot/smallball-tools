// ==UserScript==
// @name         SmallBall Club Kit (phone)
// @namespace    slipnsliders.smallball
// @version      1.44.0
// @description  The big picture on your phone: club cards with stars, tier, TP and train times, records and streaks, quick tabs, a one-tap Play button, your Hold the Hill card and tournament matches. Read-only: it never plays, trains or saves for you. Updates itself.
// @match        https://play.smallball.com/*
// @run-at       document-idle
// @inject-into  page
// @grant        none
// @noframes
// @updateURL    https://raw.githubusercontent.com/slipnsliders/smallball-tools/main/downloads/SmallBall-Club-Kit.user.js
// @downloadURL  https://raw.githubusercontent.com/slipnsliders/smallball-tools/main/downloads/SmallBall-Club-Kit.user.js
// ==/UserScript==
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
const SBX_MOBILE = true;
// SmallBall Club Kit: quick club tabs, a readable club selector, club logos, a club dashboard, stadium records
// and a foldable games list.
// Read-only: it only reads your own clubs' pages and never plays, trains or saves anything.
(() => {
  "use strict";

  // Which clubs get tabs and dashboard cards. Empty means "your first four clubs";
  // pick your own with the ⚙ button next to the tabs.
  const KIT_VERSION = "1.44.0";   // filled in by the build
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
    ["srank", "⭐ Star list rank on your club cards and club pages (click it for the full star list)"],
    ["tabs", "Quick tabs"], ["selector", "Club selector: readable, recent first"], ["logos", "Club logos"],
    ["dash", "Club dashboard"], ["season", "Season clock"], ["tier", "Tier watch"], ["train", "Train times"], ["totop", "⬆ Back-to-top button (bottom right) that takes you back up to your club cards"], ["explorer", "🔭 Explorer link in the top menu (the site's Team explorer, normally only in the footer)"], ["scout", "🔎 Scouting report (record, lineup card, hot and cold, pitching) and ⚔️ rivalry on other clubs' pages"], ["alerts", "🔔 Alerts and inbox: charges, the Bell, wagers and tournament matches (top right)"], ["tplan", "📋 Asst. Trainer Kit: a full-page training planner on your club page, and a live board under the trainer"], ["hotcold", "🔥🧊 Hot and cold tags in the squad (last 10 games vs the 15 before)"],
    ["alert", "Tab title alert when ready to train"], ["parks", "Stadium records"], ["hillcard", "⛰️ Hold the Hill card (bottom right): your ladder spot, who you can charge, your Brawl Bucks"], ["achtidy", "Tidy the Achievements section: medals on your stadium cards, Country tour shows where you've played, Earned badges first"], ["games", "Season games views"],
    ["opps", "Most played opponents"], ["squadtp", "TP column in the squad"], ["squadview", "Squad: Skills / Stats views"], ["mood", "Mood faces"], ["pitching", "Pitching stats"], ["compare", "Compare two date ranges"], ["recap", "Training Effectiveness (your clubs)"], ["notes", "Team notes"], ["livebar", "Live games bar: stack, row or hide"], ["grades", "Player grade colors"],
    ["cd", "Game countdown: when each club can play again"], ["cdding", "Chime when a club can play again (off to start)"], ["cdhide", "Hide scores of games still on the air behind their countdown (click to reveal)"],
    ["freeze", "Freeze records and stats until a game's report airs (off to start)"], ["skinbtn", "🏟 Skins button (stadium skins in their own window)"], ["radio", "📻 Radio button in the game player (Mack and Dewey call the game out loud)"], ["optimizer", "🧪 PlayerOptimizer III by Jon2s (AUTO-OPTIMIZE next to Save)"], ["rotate", "🔁 Rotate Bench for Passive Training (next to Save)"], ["builder", "🧩 Lineup Builder: drag-and-drop lineup and your own optimizer (above the lineup editor)"],
    ["box", "📰 Box scores after each game, with an alert when one's ready"], ["cast", "📡 SmallCast under the game player: line score, at bat, play by play, batters (no spoilers)"], ["kcards", "🅺 K Korner: hang a K on the stadium for every home strikeout (backwards K for called third strikes)"], ["kboth", "🅺 K Korner for both teams: the visiting club gets its own row (navy cards, gold K) (off to start)"], ["hill", "⛰️ Report to Hold the Hill button on BigLeague games"], ["charge", "🥊 Challenge links: shows which club you're playing as, with a one-click switch"], ["live", "🏆 Tournaments button, with a card for each tournament you're in (your match, deadline, Start button)"], ["boxding", "Chime when a box score is ready (off to start)"], ["boxnote", "Desktop notification when a box score is ready (off to start)"]
  ];
  let FEAT = {}; try { FEAT = JSON.parse(localStorage.getItem("sbx-features") || "{}"); } catch (_) {}
  // Phone edition: the big picture only. Club cards, quick tabs and a Play button; none of the box-score
  // tools, so it stays light on a phone and on the site.
  const MOBILE = typeof SBX_MOBILE !== "undefined" && !!SBX_MOBILE;
  const MOBILE_KEEP = ["srank", "totop", "explorer", "scout", "alerts", "tplan", "hotcold", "hillcard", "achtidy", "charge", "live", "tabs", "selector", "logos", "dash", "season", "tier", "train", "alert", "livebar", "cd", "cdding", "cdhide", "freeze", "box", "boxding", "hill"];
  const OFF_TO_START = ["cdding", "freeze", "boxding", "boxnote", "kboth"];   // the few features that start off
  // iPad edition (a Safari userscript): the full kit, minus what a userscript can't do there.
  const TABLET = typeof SBX_TABLET !== "undefined" && !!SBX_TABLET;
  const TABLET_OFF = ["skinbtn", "radio", "optimizer"];
  const on = (f) => (TABLET && TABLET_OFF.includes(f) ? false : MOBILE && !MOBILE_KEEP.includes(f) ? false : OFF_TO_START.includes(f) ? FEAT[f] === true : FEAT[f] !== false);
  // The trainer is /training on its own; /training?watch=<game> is the game player, where the Asst. Trainer stays out of the way.
  const isTrainer = () => location.pathname === "/training" && !/[?&](watch|game)=/.test(location.search);
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
    if (pm && d && d.mine) { try { if (!isTrainer()) tpLog(Number(pm[1]), d); } catch (_) {} try { trainTrack(Number(pm[1]), d); } catch (_) {} }
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
      #sbx-pick .sbx-tbtns { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
      #sbx-pick .sbx-tbtns button { cursor: pointer; border-radius: 999px; padding: 5px 10px; font: 600 12.5px/1.2 system-ui, sans-serif; border: 1px solid rgba(127,127,127,.45); background: rgba(127,127,127,.12); color: inherit; }
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
      #sbx-set-launch { position: fixed; left: 16px; bottom: 16px; z-index: 2147482999; display: inline-flex; align-items: center; gap: 6px; padding: 10px 16px; border-radius: 999px; border: 2px solid #fde68a; background: linear-gradient(135deg,#ca8a04,#facc15); color: #1b1300; font: 900 14px/1 system-ui, sans-serif; cursor: pointer; box-shadow: 0 6px 20px rgba(0,0,0,.35), 0 0 0 3px rgba(250,204,21,.25); }
      #sbx-set-launch:hover { filter: brightness(1.08); transform: translateY(-1px); }
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
      a.sbx-srank { display: inline-flex; align-items: center; gap: 3px; margin-left: auto; padding: 1px 8px; border-radius: 999px; font: 800 11.5px system-ui, sans-serif; text-decoration: none; white-space: nowrap; background: rgba(245,179,1,.14); color: #f5b301; border: 1px solid rgba(245,179,1,.45); cursor: pointer; }
      a.sbx-srank.nr { background: rgba(127,127,127,.12); color: inherit; opacity: .7; border-color: rgba(127,127,127,.4); }
      a.sbx-srank:hover { filter: brightness(1.2); opacity: 1; }
      .teamhead .facts .fact a.sbx-srank { margin-left: 0; font-size: 13px; }
      #s-starlist tr.sbx-starme td { background: rgba(245,179,1,.22) !important; }
      #s-starlist tr.sbx-starme { outline: 2px solid #f5b301; outline-offset: -2px; }
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
      :is(#sbx-dash, .sbx-tabbody) .acts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
      :is(#sbx-dash, .sbx-tabbody) .acts > :is(.play, .trn) { white-space: nowrap; gap: 6px; text-decoration: none; line-height: 1; font-weight: 800; }
      :is(#sbx-dash, .sbx-tabbody) .acts > .bxb { grid-column: 1 / -1; }
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
      /* one color per action, everywhere in the kit: ▶ Play green, 🏋️ Training blue, 📋 Plan purple, 🧢 Lineup amber */
      :is(#sbx-dash, .sbx-tabbody) .acts .trn.c-train { background: #2563eb; color: #fff; border: 0; }
      :is(#sbx-dash, .sbx-tabbody) .acts .trn.c-plan { background: #7c3aed; color: #fff; border: 0; }
      :is(#sbx-dash, .sbx-tabbody) .acts .trn.c-lineup { background: #d97706; color: #fff; border: 0; }
      :is(#sbx-dash, .sbx-tabbody) .acts :is(.play, .trn):hover { filter: brightness(1.12); }
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
    const place = () => { if (!sb.isConnected) document.body.appendChild(sb); const tops = ["tk-launch", "tt-launch", "sbx-set-launch"].map((id) => document.getElementById(id)).filter(Boolean).map((e) => e.getBoundingClientRect().top).filter((t) => t > 0); sb.style.bottom = (tops.length ? Math.round(window.innerHeight - Math.min(...tops) + 10) : 16) + "px"; };
    place(); setInterval(place, 2000);
  }
  // ⚙️ Club Kit: a settings chip at the very bottom of the left-hand stack; Multiview's button
  // (and the old Tournament Kit's) move up one place to make room.
  if (!MOBILE) {
    const kb = document.createElement("button"); kb.id = "sbx-set-launch"; kb.type = "button"; kb.textContent = "⚙️ Club Kit Settings"; kb.title = "Every Club Kit setting on one page";
    kb.onclick = () => openSettings();
    const lift = () => {
      if (!kb.isConnected) document.body.appendChild(kb);
      let y = 16 + Math.round(kb.getBoundingClientRect().height || 34) + 10;
      for (const id of ["tk-launch", "tt-launch"]) { const e = document.getElementById(id); if (!e) continue; const want = y + "px"; if (e.style.bottom !== want) e.style.bottom = want; y += Math.round(e.getBoundingClientRect().height || 34) + 10; }
    };
    lift(); setInterval(lift, 2000);
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
    pop.innerHTML = `<button type="button" data-t="all" style="width:100%;margin-bottom:10px;border:0;border-radius:10px;padding:10px;background:#facc15;color:#1b1300;font-weight:800;cursor:pointer">⚙️ All settings (full page)</button><b>Your tabs and dashboard</b><div class="muted">Tick the clubs you want; the numbers are their order. Use the arrows to move one.</div><div class="plist">${clubsHtml()}</div>` +
      `<div class="sec"><b>Features</b><div class="muted">Untick anything you don't want. The page reloads when you save a change.</div><div class="feats">` +
      FEATURES.filter(([k]) => !MOBILE || MOBILE_KEEP.includes(k)).map(([k, label]) => `<label><input type="checkbox" data-f="${k}" ${on(k) ? "checked" : ""}> ${esc(label)}</label>`).join("") +
      `</div></div>` + (MOBILE ? "" : `<div class="sec"><b>Stadium skins</b><div class="muted">Skins have their own window now: the 🏟 Skins button at the bottom left of the page. <button type="button" class="linkish" data-a="skins">Open it</button></div></div>`) +
      `<div class="sec"><b>Club Kit ${esc(KIT_VERSION)}</b> <span class="muted">· ${esc(kitEdition())}</span><div class="sbx-tbtns"><button type="button" data-t="tour">🎓 Tour</button><button type="button" data-t="new">✨ What's new</button><button type="button" data-t="health">🩺 Health check</button><button type="button" data-t="backup">💾 Back up / restore</button></div></div>` +
      `<div class="btns"><button type="button" data-a="save">Save</button><button type="button" data-a="reset">Use default</button></div>`;
    document.body.appendChild(pop);
    pop.querySelectorAll("[data-t]").forEach((b) => b.addEventListener("click", () => { pop.remove(); ({ new: () => whatsNew(true), health: openHealth, backup: openBackup, all: () => openSettings(), tour: () => openTour(0) })[b.dataset.t](); }));
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
      const next = Object.assign({}, FEAT);
      pop.querySelectorAll("input[data-f]").forEach((c) => { const f = c.dataset.f; if (OFF_TO_START.includes(f)) { if (c.checked) next[f] = true; else delete next[f]; } else if (c.checked) delete next[f]; else next[f] = false; });
      const changed = JSON.stringify(next) !== JSON.stringify(FEAT);
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

  // ───────── ⚙️ All settings: a full page for every Club Kit setting ─────────
  // Opened from the ⚙ menu. Feature switches need a page reload to take effect, so they wait for
  // "Save and reload"; the clubs list and the small options save as you change them.
  const SET_GROUPS = [
    ["clubpage", "🏠 Club pages", "Tabs, the dashboard and what shows on a club's page.", ["totop", "tabs", "selector", "logos", "dash", "season", "tier", "train", "notes", "achtidy", "parks", "opps", "mood", "grades", "explorer"]],
    ["squad", "🧢 Squad & lineup", "The squad table and the lineup editor.", ["squadtp", "squadview", "hotcold", "pitching", "builder", "optimizer", "rotate"]],
    ["games", "📰 Games & box scores", "Box scores, countdowns and spoiler control.", ["games", "cast", "kcards", "kboth", "box", "boxding", "boxnote", "cd", "cdding", "cdhide", "freeze", "livebar", "compare", "recap"]],
    ["training", "🏋️ Training", "The Asst. Trainer Kit and training reminders.", ["tplan", "alert"]],
    ["scouting", "🔎 Other clubs", "What you see on other clubs' pages.", ["scout"]],
    ["hill", "⛰️ Hill & tournaments", "Hold the Hill, tournaments and alerts.", ["hillcard", "hill", "charge", "live", "alerts"]],
    ["extras", "📻 Extras", "Stadium skins and the radio.", ["skinbtn", "radio"]],
  ];
  const ST = { pend: null, q: "", sec: "" };
  const featAvail = (k) => !(TABLET && TABLET_OFF.includes(k)) && !(MOBILE && !MOBILE_KEEP.includes(k));
  const featSplit = (label) => { const m = /^(.+?)(?::\s|\s\()(.*)$/.exec(label); return m ? [m[1], (label.charAt(m[1].length) === "(" ? "(" : "") + m[2]] : [label, ""]; };
  function openSettings(sec) {
    document.getElementById("sbx-pick")?.remove();
    ST.pend = null; ST.q = ""; ST.sec = sec || "";
    let el = document.getElementById("sbx-set");
    if (!el) {
      el = document.createElement("div"); el.id = "sbx-set"; document.body.appendChild(el);
      if (!document.getElementById("sbx-set-css")) {
        const st = document.createElement("style"); st.id = "sbx-set-css";
        st.textContent = [
          "#sbx-set{position:fixed;inset:0;z-index:2147483550;background:rgba(6,12,26,.98);color:#f4ebd9;font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:flex;flex-direction:column}",
          "#sbx-set .s-top{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:16px 24px;border-bottom:1px solid rgba(255,255,255,.08)}",
          "#sbx-set h2{margin:0;font:900 22px/1 system-ui,sans-serif}",
          "#sbx-set .s-q{flex:1;min-width:200px;max-width:420px;font:inherit;background:#13254a;color:inherit;border:1px solid rgba(255,255,255,.2);border-radius:10px;padding:8px 12px}",
          "#sbx-set .s-x{margin-left:auto;border:0;background:rgba(255,255,255,.12);color:inherit;border-radius:10px;padding:8px 14px;font-weight:800;cursor:pointer}",
          "#sbx-set .s-main{flex:1;display:grid;grid-template-columns:230px 1fr;min-height:0}",
          "@media (max-width:760px){#sbx-set .s-main{grid-template-columns:1fr}#sbx-set .s-nav{display:none}}",
          "#sbx-set .s-nav{border-right:1px solid rgba(255,255,255,.08);padding:12px;overflow:auto}",
          "#sbx-set .s-nav a{display:block;padding:8px 12px;border-radius:9px;color:inherit;text-decoration:none;font-weight:700}",
          "#sbx-set .s-nav a:hover{background:rgba(255,255,255,.07)}#sbx-set .s-nav a.on{background:#facc15;color:#1b1300}",
          "#sbx-set .s-body{overflow:auto;padding:18px 26px 120px}",
          "#sbx-set section{max-width:1100px;margin:0 auto 26px}",
          "#sbx-set section h3{margin:0;font:900 18px/1.2 system-ui,sans-serif}#sbx-set section>p{margin:3px 0 10px;opacity:.7}",
          "#sbx-set .s-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}",
          "#sbx-set .s-card{background:#0f1b33;border-radius:12px;padding:11px 13px;display:flex;gap:12px;align-items:flex-start;cursor:pointer;border:1px solid transparent}",
          "#sbx-set .s-card:hover{border-color:rgba(255,255,255,.15)}#sbx-set .s-card.ch{border-color:#facc15}",
          "#sbx-set .s-card b{display:block}#sbx-set .s-card span.d{display:block;opacity:.7;font-size:12.5px;margin-top:2px}",
          "#sbx-set .sw{flex:none;width:40px;height:22px;border-radius:999px;background:#334155;position:relative;margin-top:2px;transition:background .15s}",
          "#sbx-set .sw:after{content:'';position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:999px;background:#fff;transition:left .15s}",
          "#sbx-set .on .sw{background:#16a34a}#sbx-set .on .sw:after{left:21px}",
          "#sbx-set .s-row{background:#0f1b33;border-radius:12px;padding:11px 13px;margin-bottom:8px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}",
          "#sbx-set .s-row label{display:flex;gap:8px;align-items:center;cursor:pointer}",
          "#sbx-set .s-row select,#sbx-set .s-row input[type=text]{font:inherit;background:#13254a;color:inherit;border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:5px 8px}",
          "#sbx-set .s-btn{border:0;background:rgba(255,255,255,.12);color:inherit;border-radius:9px;padding:7px 12px;font-weight:700;cursor:pointer}",
          "#sbx-set .s-club{display:flex;align-items:center;gap:8px;background:#0f1b33;border-radius:10px;padding:7px 10px;margin-bottom:6px}",
          "#sbx-set .s-club.off{opacity:.55}#sbx-set .s-club b.n{width:22px;text-align:center;color:#fde68a}",
          "#sbx-set .s-club .mv{margin-left:auto;display:flex;gap:4px}#sbx-set .s-club .mv button{border:0;background:rgba(255,255,255,.12);color:inherit;border-radius:6px;padding:2px 8px;cursor:pointer}",
          "#sbx-set .s-save{position:fixed;left:50%;transform:translateX(-50%);bottom:22px;background:#facc15;color:#1b1300;border-radius:999px;padding:10px 12px 10px 18px;display:flex;gap:12px;align-items:center;font-weight:800;box-shadow:0 10px 30px rgba(0,0,0,.5)}",
          "#sbx-set .s-save button{border:0;border-radius:999px;padding:7px 14px;font-weight:800;cursor:pointer}#sbx-set .s-save .go{background:#1b1300;color:#facc15}#sbx-set .s-save .no{background:rgba(0,0,0,.12);color:#1b1300}",
          "#sbx-set .muted{opacity:.65}",
        ].join("");
        document.head.appendChild(st);
      }
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && document.getElementById("sbx-set") && !/input|textarea|select/i.test((e.target || {}).tagName || "")) closeSettings(); });
    }
    paintSettings();
  }
  function closeSettings() {
    if (ST.pend && Object.keys(ST.pend).length && !confirmLeave()) return;
    document.getElementById("sbx-set")?.remove(); ST.pend = null;
  }
  // No browser dialogs (they can freeze helpers): an unsaved change just asks once, inside the page.
  function confirmLeave() { const b = document.querySelector("#sbx-set .s-save"); if (b && !b.dataset.warned) { b.dataset.warned = "1"; b.querySelector("span").textContent = "You have unsaved switches. Close again to drop them."; return false; } return true; }
  function featOn(k) { return ST.pend && k in ST.pend ? ST.pend[k] : on(k); }
  function paintSettings() {
    const el = document.getElementById("sbx-set"); if (!el) return;
    const q = ST.q.trim().toLowerCase(), match = (t) => !q || t.toLowerCase().includes(q);
    const lab = Object.fromEntries(FEATURES);
    const groups = SET_GROUPS.map(([id, title, blurb, keys]) => {
      const cards = keys.filter((k) => lab[k] && featAvail(k)).filter((k) => match(lab[k] + " " + title)).map((k) => {
        const [name, desc] = featSplit(lab[k]), isOn = featOn(k), ch = ST.pend && k in ST.pend;
        return '<div class="s-card' + (isOn ? " on" : "") + (ch ? " ch" : "") + '" data-f="' + k + '" role="switch" aria-checked="' + isOn + '"><i class="sw"></i><div><b>' + esc(name) + "</b>" + (desc ? '<span class="d">' + esc(desc) + "</span>" : "")  + "</div></div>";
      }).join("");
      return cards ? '<section id="ss-' + id + '"><h3>' + title + "</h3><p>" + esc(blurb) + '</p><div class="s-grid">' + cards + "</div></section>" : "";
    }).join("");
    // Options that already exist elsewhere in the kit, gathered here
    const ao = alertOpt(), atm = atMode(), ats = atSide();
    const opts = match("alerts pop-ups desktop chime sound asst trainer mode notes compare gains") ? '<section id="ss-options"><h3>🎛️ Options</h3><p>Finer settings for features above. These save as you change them.</p>' +
      '<div class="s-row"><b style="min-width:140px">🔔 Alerts</b><label><input type="checkbox" data-o="pop"' + (ao.pop ? " checked" : "") + "> Desktop pop-ups</label><label><input type=\"checkbox\" data-o=\"sound\"" + (ao.sound ? " checked" : "") + "> Chime with new alerts</label></div>" +
      '<div class="s-row"><b style="min-width:140px">📋 Asst. Trainer</b><label>Live board starts in <select data-atm><option value="plan"' + (atm === "plan" ? " selected" : "") + '>🎯 Compare to plan</option><option value="gains"' + (atm === "gains" ? " selected" : "") + '>📈 Just track gains</option></select></label><label><input type="checkbox" data-atn' + (ats.n ? " checked" : "") + "> 📝 Training notes open beside the trainer</label></div></section>" : "";
    const clubs = !q || match("clubs tabs dashboard order") ? '<section id="ss-clubs"><h3>⭐ Your clubs</h3><p>The clubs in your tabs and dashboard, in this order. Saves as you change it.</p><div data-clubs>' + setClubsHtml() + "</div></section>" : "";
    const kit = !q || match("kit version what's new health backup restore") ? '<section id="ss-kit"><h3>🧰 Kit</h3><p>Club Kit ' + esc(KIT_VERSION) + " · " + esc(kitEdition()) + '</p><div class="s-row"><button type="button" class="s-btn" data-t="tour">🎓 Take the tour</button><button type="button" class="s-btn" data-t="new">✨ What\'s new</button><button type="button" class="s-btn" data-t="health">🩺 Health check</button><button type="button" class="s-btn" data-t="backup">💾 Back up / restore</button>' + (MOBILE ? "" : '<button type="button" class="s-btn" data-t="skins">🏟 Stadium skins</button>') + '<button type="button" class="s-btn" data-t="defaults" title="Every switch back to how the kit ships">↺ All switches to default</button></div></section>' : "";
    const nav = [["clubs", "⭐ Your clubs"]].concat(SET_GROUPS.map(([id, t]) => [id, t]), [["options", "🎛️ Options"], ["kit", "🧰 Kit"]]);
    const n = ST.pend ? Object.keys(ST.pend).length : 0;
    const body = el.querySelector(".s-body"), sc = body ? body.scrollTop : 0, focusQ = document.activeElement && document.activeElement.classList.contains("s-q");
    el.innerHTML = '<div class="s-top"><h2>⚙️ Club Kit settings</h2><input class="s-q" type="search" placeholder="Search settings, e.g. chime, box scores, Hill" value="' + esc(ST.q) + '"><button type="button" class="s-x" data-close>✕ Close</button></div>' +
      '<div class="s-main"><nav class="s-nav">' + nav.map(([id, t]) => '<a href="#" data-go="' + id + '">' + t + "</a>").join("") + '</nav><div class="s-body">' + (clubs + groups + opts + kit || '<p class="muted">Nothing matches "' + esc(ST.q) + '".</p>') + "</div></div>" +
      (n ? '<div class="s-save"><span>' + n + " switch" + (n === 1 ? "" : "es") + ' changed. They take effect after a reload.</span><button type="button" class="no" data-undo>Undo</button><button type="button" class="go" data-apply>Save and reload</button></div>' : "");
    const nb = el.querySelector(".s-body"); nb.scrollTop = sc;
    if (ST.sec) { const t = el.querySelector("#ss-" + ST.sec); if (t) t.scrollIntoView(); ST.sec = ""; }
    const qi = el.querySelector(".s-q"); qi.oninput = () => { ST.q = qi.value; paintSettings(); }; if (focusQ) { qi.focus(); qi.setSelectionRange(qi.value.length, qi.value.length); }
    el.querySelector("[data-close]").onclick = closeSettings;
    el.querySelectorAll("[data-go]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); const t = el.querySelector("#ss-" + a.dataset.go); if (t) t.scrollIntoView({ behavior: "smooth" }); el.querySelectorAll("[data-go]").forEach((x) => x.classList.toggle("on", x === a)); }));
    el.querySelectorAll(".s-card[data-f]").forEach((c) => (c.onclick = () => {
      const k = c.dataset.f, want = !featOn(k); ST.pend = ST.pend || {};
      if (want === on(k)) delete ST.pend[k]; else ST.pend[k] = want;
      paintSettings();
    }));
    const un = el.querySelector("[data-undo]"); if (un) un.onclick = () => { ST.pend = null; paintSettings(); };
    const ap = el.querySelector("[data-apply]"); if (ap) ap.onclick = () => {
      const next = Object.assign({}, FEAT);
      for (const [k, v] of Object.entries(ST.pend || {})) { if (OFF_TO_START.includes(k)) { if (v) next[k] = true; else delete next[k]; } else { if (v) delete next[k]; else next[k] = false; } }
      try { localStorage.setItem("sbx-features", JSON.stringify(next)); } catch (_) {}
      setTimeout(() => location.reload(), 50);
    };
    el.querySelectorAll("[data-o]").forEach((c) => (c.onchange = async () => {
      const o = alertOpt(); o[c.dataset.o] = c.checked;
      if (c.dataset.o === "pop" && c.checked && typeof Notification !== "undefined" && Notification.permission !== "granted") { try { if ((await Notification.requestPermission()) !== "granted") { o.pop = false; c.checked = false; } } catch (_) { o.pop = false; c.checked = false; } }
      if (c.dataset.o === "sound" && c.checked) chime();
      try { localStorage.setItem(ALERT_OPT, JSON.stringify(o)); } catch (_) {}
      if (hasChromeStorage) { try { chrome.storage.local.set({ sbxAlertPop: !!o.pop }); } catch (_) {} }
    }));
    const sm = el.querySelector("[data-atm]"); if (sm) sm.onchange = () => { try { localStorage.setItem(AT_MODE, sm.value); } catch (_) {} };
    const sn = el.querySelector("[data-atn]"); if (sn) sn.onchange = () => { try { localStorage.setItem(AT_SIDE, JSON.stringify(Object.assign(atSide(), { n: sn.checked }))); } catch (_) {} };
    el.querySelectorAll("[data-t]").forEach((b) => (b.onclick = () => {
      const t = b.dataset.t;
      if (t === "defaults") { ST.pend = {}; for (const [k] of FEATURES) { const def = !OFF_TO_START.includes(k); if (featAvail(k) && on(k) !== def) ST.pend[k] = def; } if (!Object.keys(ST.pend).length) ST.pend = null; paintSettings(); return; }
      document.getElementById("sbx-set")?.remove(); ST.pend = null;
      ({ new: () => whatsNew(true), health: openHealth, backup: openBackup, skins: openSkins, tour: () => openTour(0) })[t]();
    }));
    const cl = el.querySelector("[data-clubs]"); if (cl) wireSetClubs(cl);
  }
  // ⭐ Your clubs: the same list as the ⚙ menu, saved straight away.
  function setClubOpts() { const sel = document.getElementById("who-team"); return sel ? Array.from(sel.options).map((o) => ({ id: Number(o.value), name: o.textContent.replace(/\s*-XsT-\s*$/, "").trim() })) : []; }
  function setClubsHtml() {
    const opts = setClubOpts(), nameOf = Object.fromEntries(opts.map((o) => [o.id, o.name])), order = clubList().filter((id) => nameOf[id] != null);
    if (!opts.length) return '<p class="muted">Your clubs show up here on any SmallBall page where you are signed in.</p>';
    const rest = opts.filter((o) => !order.includes(o.id)).sort((a, b) => a.name.localeCompare(b.name));
    return order.map((id, i) => '<div class="s-club"><input type="checkbox" data-c="' + id + '" checked><b class="n">' + (i + 1) + "</b>" + esc(nameOf[id]) + ' <span class="muted">' + id + '</span><span class="mv"><button type="button" data-up="' + id + '"' + (i ? "" : " disabled") + ' title="Move up">▲</button><button type="button" data-down="' + id + '"' + (i < order.length - 1 ? "" : " disabled") + ' title="Move down">▼</button></span></div>').join("") +
      rest.map((o) => '<div class="s-club off"><input type="checkbox" data-c="' + o.id + '"><b class="n"></b>' + esc(o.name) + ' <span class="muted">' + o.id + "</span></div>").join("");
  }
  function wireSetClubs(box) {
    const save = (list) => {
      PICKED = list;
      if (hasChromeStorage) chrome.storage.local.set({ sbxClubs: list }); else lsSet({ sbxClubs: list });
      const bar = document.getElementById("sbx-tabs"); if (bar) bar.dataset.key = "";
      dashState.at = 0; try { sessionStorage.removeItem("sbx-dash-cache"); } catch (_) {}
      document.getElementById("sbx-dash-wrap")?.remove();
      box.innerHTML = setClubsHtml(); wireSetClubs(box); setTimeout(tick, 0);
    };
    const nameOf = Object.fromEntries(setClubOpts().map((o) => [o.id, o.name]));
    const order = () => clubList().filter((id) => nameOf[id] != null);
    box.querySelectorAll("[data-c]").forEach((c) => (c.onchange = () => { const id = Number(c.dataset.c); const o = order().filter((x) => x !== id); if (c.checked) o.push(id); save(o); }));
    box.querySelectorAll("[data-up],[data-down]").forEach((b) => (b.onclick = () => { const o = order(), id = Number(b.dataset.up || b.dataset.down), i = o.indexOf(id), j = b.dataset.up ? i - 1 : i + 1; if (i < 0 || j < 0 || j >= o.length) return; o.splice(i, 1); o.splice(j, 0, id); save(o); }));
  }

  // ───────── Club Kit tools: ✨ What's new · 🩺 Health check · 💾 Back up / restore (in the ⚙ settings) ─────────
  // Newest first. Each release adds a short entry here; people see what's new once, right after they update.
  const CHANGELOG = [
    { v: "1.44.0", d: "Nov 28", items: [
      "✅ <b>Finish training</b>: a big green button on the trainer. Tap it when you're done and it walks you through a <b>training wrap-up</b> (TP spent, skill gained, your best jump, who grew, who has TP left, 📋 copy the report), then <b>your lineup</b>.",
      "↩️ <b>Put your lineup back</b>: moving men around in the trainer changes your real lineup. The kit notes your lineup when you open the trainer, and Finish training can put it back and save it in one tap. Or ⚡ optimize it, or edit it yourself in the 🧩 Lineup Builder.",
    ] },
    { v: "1.43.0", d: "Nov 27", items: [
      "🥊 <b>Hide your cards, peek when you want</b>: every Hill, 🌱 Farm and 🏆 tournament card (bottom right) has a Hide button. Hidden cards stay away until you bring them back; the 🥊, 🌱 and 🏆 buttons below peek at them, and 📌 Keep puts one back for good. A red dot means something changed on a card you hid.",
      "🏆 The Tournaments button shows how many tournaments you're in.",
    ] },
    { v: "1.42.0", d: "Nov 27", items: [
      "⭐ <b>Star list rank</b> on your club cards and on every club's page: its place on SmallBall's star list for its star level (NR when it isn't in the top 100). Click it to open the full list with the club picked out.",
      "📋 <b>Asst. Trainer</b>: a TP bar under \"TP left\" on the player card, in the same gold and green as the club page's TP column, and <b>↕ Sort by TP</b> on the board (most left, least left, or the club's order).",
      "🏆 Your Hill and tournament cards (bottom right) now start open. ▾ still tucks them away.",
    ] },
    { v: "1.41.2", d: "Nov 27", items: [
      "🕐 Tournament and Hill times now show their time zone (shown in yours, like 6:00 PM MST).",
      "📊 <b>Skill board</b> on the Asst. Trainer's board: every man's skills side by side with this session's gains, his weakest in amber.",
      "📋 <b>Asst. Trainer on the trainer</b>: the board sits under the trainer (or above it, or floating: its ⬇ ⬆ 🪟 buttons), and clicking a man pops up a 🎯 floating card with his skills, this session\'s gains and his plan. Drag it anywhere; it stays on him until you click someone else. Click a man on the board and the kit selects him in the trainer for you, and the card\'s 📍 Send to buttons (they use the trainer\'s own moves, no dragging) send him on deck to bat, to the mound, to the 😴 rest area to sit out, or to any position.",
    ] },
    { v: "1.41.1", d: "Nov 27", items: [
      "📡 <b>SmallCast</b>: watch a game and the stadium scoreboard becomes a jumbotron, with who's up, the latest plays and a video board for big plays. Or move it under the board, below the player, or floating beside it for the full game cast. A line score that fills in inning by inning, who's at bat and his day so far, the count, pitch count and speed, play by play, scoring plays, each lineup's day, and how both clubs came in. It reads the game as it plays, so it never spoils anything. 📻 Radio and 📺 Multiview are in its header; put it above or below the player, float it beside the game and drag it where you like, hang it 🏟 under the stadium scoreboard, or turn the scoreboard into a 📺 Jumbotron: wings on both sides of the official board with who's up, the last plays, and a video board that goes wild on big plays; switch it off in ⚙️ All settings → Games.",
      "🅺 <b>K Korner</b>: watching a game, a K card hangs on the stadium for every strikeout by the home pitchers (backwards for a called third strike), grouped by inning, with a gold 🔥 card when they strike out the side. Turn on <b>both teams</b> in ⚙️ All settings → Games for a navy row for the visitors.",
      "⚙️ <b>Club Kit Settings</b> button at the bottom left (under 📺 Multiview) opens All settings from any page.",
      "📋 The Asst. Trainer no longer pops up while you watch a game.",
      "📼 <b>Synthia Small</b>, the original voice of SmallBall Radio, is back in the booth (a little off her rocker): a season report once a game and the odd remark. Switch her off in the radio's booth settings.",
      "📻 <b>Radio</b>: Mack and Dewey picked up 33 new stories about the Commish's comebacks, most from the famous 2007 chat, and they now call plays written without a jersey number (they were skipping some).",
      "⏱ <b>Spoiler clock on by default</b>: in game lists, a finished game's score hides behind its countdown until its report airs (click to reveal). The live ticker keeps its scores. Turn it off in ⚙️ All settings → Games.",
    ] },
    { v: "1.41.0", d: "Nov 27", items: [
      "🎓 <b>Guided tour</b>: a click-through of every major feature (and the ones that are easy to miss) shows once after this update. Reopen it any time from ⚙ → 🎓 Tour, ⚙️ All settings, or ✨ What's new.",
    ] },
    { v: "1.40.2", d: "Nov 27", items: [
      "🌱 <b>Farm Hill</b> in the kit: each of your Farm clubs gets its own card (rank, who it can charge, pre-filled 🥊 Charge buttons that fill in which club is charging), the ⚔️ Charge bar works on Farm clubs\' pages, and Farm charges and the Farm Bell come through your 🔔 alerts.",
      "⬆ <b>Back-to-top</b> button (bottom right) once you scroll down: one tap back up to your club cards. Your 🏆 Hill and tournament cards now start tucked away, with a red circle counting how many are waiting.",
      "🧢 <b>Lineup</b> button on your club cards, next to Play, Training and Plan: one click takes you to that club\'s lineup editor (and the 🧩 Lineup Builder).",
      "⚙️ <b>All settings</b>, a full page (⚙ menu → All settings): every feature as a switch card grouped by area, a search box, your clubs and their order, alert and Asst. Trainer options, and the kit tools. Also fixed: features that start off (the chimes, score freeze) can now be switched on.",
      "🩹 Your ⛰️ Hill card shows when you're recovering from a lost charge at the Ace (Hold the Hill 3.20), with a countdown, instead of Charge buttons.",
      "📋 <b>Asst. Trainer Kit</b>: the training plan is now a full page (📋 button on your club page). Every man as a card with all seven skills under SmallBall's names, his gains this week, 🎯 the skills in his plan with how much TP to spend on each, and notes. Open it from 📋 Training plan on your club page or 📋 Plan on your club cards, then ⚾ Take it to the field: on the trainer, a live board under the game (🎯 compare to plan, or 📈 just track gains) shows every man's TP draining and his gains as they land (\"Running +1\"), progress toward his targets, and a feed of the latest gains. 📝 Training notes sit beside the game.",
      "🔎 <b>Scouting report, rebuilt</b> as a real baseball report: their record, runs for and against, last 10 and streak; a lineup card with career AVG/OBP/SLG, HR, RBI, K%, fielding and the last 10 games; who\'s 🔥 hot and 🧊 cold with the numbers; and their pitching staff (RA/9, WHIP, K/9). No more tips.",
      "🔭 <b>Explorer</b> link at the end of the top menu, to the site's Team explorer (it was only in the footer).",
    ] },
    { v: "1.40.1", d: "Nov 27", items: [
      "🛠️ Fixed: the trainer page could freeze with the 🏋️ Training plan button on. It loads normally again.",
    ] },
    { v: "1.40.0", d: "Nov 27", items: [
      "🔎 <b>Scouting report</b> on other clubs' pages: their lineup in batting order with star ratings, their lineup's career OPS, homers and strikeouts next to yours, their pitcher, best bats (with 🔥🧊), shakiest gloves, and a few tips to beat them.",
      "⚔️ <b>Rivalries</b>: your record against them, last meeting and recent results. 10+ games makes it a ⚔️ Rivalry, 25+ a ⚔️🔥 Blood feud. Rivals get the ⚔️ in your Most played list too.",
    ] },
    { v: "1.39.0", d: "Nov 27", items: [
      "🔔 <b>Alerts and inbox</b>: a 🔔 at the top right counts what's waiting on you (red when it's urgent). You get a heads-up when you're charged on the Hill, your charge is about to run out, the Bell rings (or is about to), a wager comes in, or your tournament match opens. Tap the 🔔 for the list, and turn on desktop pop-ups or a chime there.",
      "In Chrome, with desktop pop-ups on, the kit also checks every few minutes while SmallBall is closed and pops up a notification.",
    ] },
    { v: "1.38.0", d: "Nov 27", items: [
      "🏋️ <b>Training plan</b>: a 🏋️ button on your club page and next to the trainer opens your plan for every man. Tap the skills he's working on, add a note (\"BP to 90, then BC\"), tick ✓ when he's trained today, and see who's ⚡ full of TP and about how far each man is from his next ★. Saved in your browser and in 💾 backups. The kit never trains for you.",
      "🔥🧊 <b>Hot and cold</b>: tags next to names in the squad: each man's last 10 games against the 15 before them (hover for the line). They show in the 🧩 Lineup Builder too.",
    ] },
    { v: "1.37.1", d: "Nov 27", items: [
      "⚔️ <b>Charge this club</b>: on another club's page, if one of your clubs can charge them on Hold the Hill, a button opens the Master Form with the charge already filled in (or it tells you why not).",
      "🥊 Every name in your ⛰️ Hill card's \"You can charge\" list has its own <b>Charge</b> button, pre-filled the same way.",
      "⏱ <b>Live countdowns</b> on Hill charges and the 🔔 Bell: time left, turning orange, then red near the end.",
    ] },
    { v: "1.37.0", d: "Nov 27", items: [
      "💾 <b>Saved lineups</b> in the 🧩 Lineup Builder: save your lineup and batting order under a name (\"Hill defense\", \"vs power teams\") and switch back with one tap. You still press Save.",
      "✨ <b>What's new</b>: this card. It shows up once after each update; reopen it any time from ⚙ settings.",
      "🩺 <b>Health check</b> in ⚙ settings: checks your SmallBall sign-in, your clubs, the Hold the Hill and tournament data, and whether you're on the latest kit. 📋 Copy the report to send to slipnsliders.",
      "💾 <b>Back up / restore</b> in ⚙ settings: one code that carries your clubs, notes, switches and saved lineups to a new device or a reinstall.",
    ] },
    { v: "1.36.2", d: "Nov 26", items: ["🔔 <b>The Bell</b> on your ⛰️ Hill card: it turns gold with a Charge button while the Bell rings, and gives a heads-up before."] },
    { v: "1.36.0", d: "Nov 26", items: ["🧩 <b>Lineup Builder</b>: drag-and-drop lineup and batting order above SmallBall's editor, and ⚡ Optimize my way with presets, sliders, rules and 🔒 locks. After you press Save it checks with SmallBall that it stuck."] },
    { v: "1.35.0", d: "Nov 26", items: ["⛰️ Hill card: club names open their club pages, plus links to the 📝 Master Form and the 📊 Live Hold the Hill Leaderboard."] },
  ];
  const SEEN_KEY = "sbx-seen-version";
  const verNum = (v) => String(v || "0").split(".").map(Number).reduce((a, x, i) => a + (x || 0) * Math.pow(1000, 2 - i), 0);
  function kitEdition() { return TABLET ? "iPad edition" : MOBILE ? "phone edition" : DEFAULT_CLUBS.length ? "private kit" : "Chrome extension"; }
  function sbxModal(title, html, wide) {
    document.getElementById("sbx-modal")?.remove();
    if (!document.getElementById("sbx-modal-css")) {
      const st = document.createElement("style"); st.id = "sbx-modal-css";
      st.textContent = `#sbx-modal{position:fixed;inset:0;z-index:2147483600;background:rgba(0,0,0,.5);display:grid;place-items:center;padding:12px}
      #sbx-modal .box{width:min(560px,100%);max-height:86vh;overflow:auto;background:#0f1b33;color:#f4ebd9;border-radius:16px;padding:18px 20px;box-shadow:0 20px 60px rgba(0,0,0,.5);font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
      #sbx-modal .box.wide{width:min(680px,100%)}#sbx-modal h3{margin:0 0 10px;font-size:19px}#sbx-modal .x{float:right;border:0;background:none;color:inherit;font-size:20px;cursor:pointer;opacity:.7}
      #sbx-modal ul{margin:6px 0 12px;padding-left:20px}#sbx-modal li{margin:4px 0}#sbx-modal .ver{font:800 12px/1 ui-monospace,monospace;color:#fde68a;margin-top:10px;letter-spacing:.06em}
      #sbx-modal .row{display:flex;gap:10px;align-items:flex-start;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.08)}#sbx-modal .row b{min-width:22px}
      #sbx-modal .acts{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:14px}
      #sbx-modal button.b{border:0;border-radius:999px;padding:9px 15px;font:700 13px/1 system-ui,sans-serif;cursor:pointer;background:rgba(255,255,255,.13);color:inherit}#sbx-modal button.b.go{background:#facc15;color:#1b1300}
      #sbx-modal textarea{width:100%;min-height:110px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:#13254a;color:#f4ebd9;font:12px/1.35 ui-monospace,monospace;padding:8px;box-sizing:border-box}
      #sbx-modal .muted{opacity:.72;font-size:12.5px}#sbx-modal a{color:#fde68a}#sbx-modal .msg{font-size:13px;margin-top:8px;min-height:1em}`;
      document.head.appendChild(st);
    }
    const ov = document.createElement("div"); ov.id = "sbx-modal";
    ov.innerHTML = `<div class="box${wide ? " wide" : ""}"><button class="x" type="button" title="Close">✕</button><h3>${title}</h3>${html}</div>`;
    ov.addEventListener("click", (e) => { if (e.target === ov || e.target.closest(".x")) ov.remove(); });
    document.body.appendChild(ov);
    return ov;
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") document.getElementById("sbx-modal")?.remove(); });

  // ✨ What's new: once after each update (not on a brand-new install), and from ⚙ any time.
  function whatsNew(force) {
    let seen = ""; try { seen = localStorage.getItem(SEEN_KEY) || ""; } catch (_) {}
    if (!force) {
      if (!seen) { try { localStorage.setItem(SEEN_KEY, KIT_VERSION); } catch (_) {} return; }   // first install: no pop-up
      if (verNum(seen) >= verNum(KIT_VERSION)) return;
    }
    const list = CHANGELOG.filter((c) => verNum(c.v) <= verNum(KIT_VERSION) && (force || verNum(c.v) > verNum(seen))).slice(0, force ? 5 : 6);
    if (!list.length) { try { localStorage.setItem(SEEN_KEY, KIT_VERSION); } catch (_) {} if (!force) return; }
    const ov = sbxModal("✨ What's new in the Club Kit", (list.length ? list : CHANGELOG.slice(0, 1)).map((c) => `<div class="ver">${esc(c.v)} · ${esc(c.d)}</div><ul>${c.items.map((x) => "<li>" + x + "</li>").join("")}</ul>`).join("") +
      `<div class="muted">You're on ${esc(KIT_VERSION)} (${esc(kitEdition())}). Reopen this any time: ⚙ settings → ✨ What's new.</div>` +
      `<div class="acts"><button class="b" type="button" data-tour>🎓 Tour</button><a class="b" href="https://slipnsliders.github.io/smallball-tools/club-kit/" target="_blank" rel="noopener" style="text-decoration:none;padding:9px 6px">Every update →</a><button class="b go" type="button" data-ok>Got it</button></div>`);
    const done = () => { try { localStorage.setItem(SEEN_KEY, KIT_VERSION); } catch (_) {} ov.remove(); };
    ov.querySelector("[data-ok]").onclick = done;
    ov.querySelector("[data-tour]").onclick = () => { done(); openTour(0); };
    ov.querySelector(".x").addEventListener("click", done);
  }

  // ───────── 🎓 The tour: a click-through of the kit's features, once for everyone after 1.41, and from ⚙ any time ─────────
  // Each step says what a feature does and, if it's on the page you're looking at, outlines it in gold.
  const TOUR_KEY = "sbx-tour-v1";
  const TOUR = [
    { t: "👋 Welcome to the Club Kit", f: [], b: "A one-minute tour of what the kit adds to SmallBall, including a few things that are easy to miss. Click <b>Next</b> to go through it, or <b>Skip</b>. You can reopen it any time: ⚙ → 🎓 Tour." },
    { t: "⭐ Your clubs, one click away", f: ["tabs", "dash"], go: "home", sel: ["#sbx-tabs", "#sbx-dash-wrap"], b: "The <b>quick tabs</b> along the top switch clubs in one click, and the <b>club cards</b> show each club's record, TP and when it can play again. Each card has <b>▶ Play</b>, <b>Training</b>, <b>📋 Plan</b> and <b>🧢 Lineup</b>. Pick your clubs and their order with the <b>⚙</b> button next to the tabs." },
    { t: "🧩 Lineup Builder", f: ["builder"], go: "mine", sel: ["#sbx-build"], b: "On your club page, above SmallBall's lineup editor: <b>drag and drop</b> men between spots, the bench and the batting order, or let <b>⚡ Optimize my way</b> do it with your own presets and sliders. <b>💾 Save this lineup</b> keeps lineups to reload later. It fills SmallBall's form; nothing is saved until you press Save, and then it checks the save stuck." },
    { t: "📋 Asst. Trainer Kit", f: ["tplan"], go: "mine", sel: ["main .th-btns [data-atplan]"], b: "<b>📋 Training plan</b> (on your club page and club cards) opens a full-page planner: every man's skills, his gains this week, and the TP you plan to spend on each skill. <b>⚾ Take it to the field</b> opens the trainer with a <b>live board under the game</b>: TP draining and gains landing as you train, compared to your plan." },
    { t: "📰 Box scores, countdowns, no spoilers", f: ["box", "cd"], b: "A <b>box score</b> after each game (with an alert when one is ready), a <b>⏱ countdown</b> for when each club can play again, and spoiler switches in ⚙ settings to hide scores of games still on the air." },
    { t: "📡 SmallCast", f: ["cast"], b: "When you <b>watch a game</b>, SmallCast turns the stadium scoreboard into a <b>jumbotron</b>: who's up and his day so far, the latest plays, a video board that goes wild on big plays, and K cards for home strikeouts. Its buttons move it under the board, below or above the player, or floating beside it, where the full view adds a line score that fills in inning by inning, who's at bat and how his day is going, the count and pitch count, play by play, scoring plays and each lineup's day, plus how both clubs came in. It reads the game as it plays, so it never spoils what's coming. 📻 Radio and 📺 Multiview are one click away in its header." },
    { t: "🔎 Scouting other clubs", f: ["scout", "hotcold"], go: "other", sel: ["#sbx-scout"], b: "On another club's page, the <b>🔎 Scouting report</b>: their record, a lineup card with career numbers, who's <b>🔥 hot or 🧊 cold</b>, their pitching, and your <b>⚔️ head-to-head</b> record. Just numbers; the decisions are yours." },
    { t: "⛰️ Hold the Hill & 🌱 Farm Hill", f: ["hillcard", "charge"], sel: ["#sbx-live"], b: "Bottom right: your <b>Hill cards</b> (tucked away under <b>▴ Cards</b>, with a red count). Your rank, who you can charge and <b>🥊 Charge</b> buttons that fill in the Master Form for you. Clubs at 6★ and under play on the <b>🌱 Farm Hill</b>: bring your young clubs. On another Hill club's page, a <b>⚔️ Charge</b> bar shows if you can take a shot." },
    { t: "🏆 Tournaments & 🏦 Prize Vault", f: ["live"], sel: ["#sbx-live [data-home]"], b: "The <b>🏆 Tournaments</b> button lists what's coming up; once you're signed up, a card shows your match, its deadline and a <b>Start</b> button. Winners get tickets from the <b>🏦 Prize Vault</b>, filled by the community: gift a ticket to club 1008 to add to it." },
    { t: "🔔 Alerts", f: ["alerts"], sel: ["#sbx-inbox"], b: "The <b>🔔</b> top right lights up when something is waiting on you: you've been charged, the Bell is ringing, a wager came in, your tournament match is open. Turn on <b>desktop pop-ups</b> in it to hear about them with SmallBall closed (Chrome)." },
    { t: "👀 Easy to miss", f: [], go: "mine", b: "<b>⬆</b> (bottom right) takes you back up to your clubs. <b>Explorer</b> in the top menu searches every club. On your club page: <b>Squad views</b> (Skills / Stats), <b>Pitching</b>, <b>Compare</b> two date ranges, <b>Training</b> effectiveness and <b>📝 Team notes</b>. In the game player: <b>📻 Radio</b> calls the game out loud. <b>🏟 Skins</b> (bottom left) put your own picture on each park." },
    { t: "⚙️ Make it yours", f: [], sel: ["#sbx-set-launch", "#sbx-tabs .gear"], b: "The gold <b>⚙️ Club Kit Settings</b> button (bottom left) or <b>⚙ → ⚙️ All settings</b> opens a full page with every feature as a switch and a search box. There's also <b>💾 Back up / restore</b> (one code moves your setup to another device), <b>🩺 Health check</b>, and <b>✨ What's new</b> for the full list of changes. Enjoy the kit! ⚾" },
  ];
  // Steps can take you to the page they're about: "mine" is your first club's page, "other" is the club you
  // played last (for the scouting report), "home" is the front page. Off the front page's address (Explorer,
  // a game), the page reloads, so the tour keeps its place in sessionStorage and picks up where it left off.
  const TOUR_AT = "sbx-tour-at";
  let TOUR_OPP = 0;
  async function tourOpp(mine) {
    if (TOUR_OPP) return TOUR_OPP;
    try {
      const own = ownIds(), d = await getJSON(`/games/all?club=${mine}`, true);
      const g = (d.rows || []).filter((r) => r.home_team_id === mine || r.away_team_id === mine).sort((x, y) => y.game_id - x.game_id).find((r) => !own.has(String(r.home_team_id === mine ? r.away_team_id : r.home_team_id)));
      if (g) TOUR_OPP = g.home_team_id === mine ? g.away_team_id : g.home_team_id;
    } catch (_) {}
    return TOUR_OPP;
  }
  function openTour(start) {
    const steps = TOUR.filter((s) => !s.f.length || s.f.some((k) => on(k)));
    let i = Math.max(0, Math.min(start || 0, steps.length - 1)), lit = null, token = 0;
    document.getElementById("sbx-modal")?.remove(); document.getElementById("sbx-pick")?.remove(); document.getElementById("sbx-settings")?.remove();
    let el = document.getElementById("sbx-tour"); if (el) el.remove();
    el = document.createElement("div"); el.id = "sbx-tour";
    el.style.cssText = "position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:2147483600;width:min(520px,calc(100vw - 24px));background:#0f1b33;color:#f4ebd9;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.6),0 0 0 2px #facc15;padding:16px 18px 14px;font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif";
    document.body.appendChild(el);
    const unlight = () => { if (lit) { lit.style.outline = lit.dataset.sbxOl || ""; lit.style.outlineOffset = ""; lit = null; } };
    const done = () => { token++; unlight(); el.remove(); try { sessionStorage.removeItem(TOUR_AT); localStorage.setItem(TOUR_KEY, "1"); localStorage.setItem(SEEN_KEY, KIT_VERSION); } catch (_) {} };
    const mine = () => { const own = [...ownIds()].map(Number), first = clubList().find((id) => own.includes(id)); return first || own[0] || 0; };
    // Go to the step's page; returns false when the page is reloading (the tour resumes after).
    async function goTo(s) {
      if (!s.go) return true;
      let want = "";
      if (s.go === "home") { if (!/^#\/team\//.test(location.hash) && location.pathname === "/") return true; want = "#/"; }
      else { const me = mine(); if (!me) return true; const id = s.go === "mine" ? me : await tourOpp(me); if (!id) return true; want = "#/team/" + id; }
      if (location.pathname !== "/") { try { sessionStorage.setItem(TOUR_AT, JSON.stringify({ i, at: Date.now() })); } catch (_) {} location.href = "/" + want; return false; }
      if (location.hash !== want) { location.hash = want; window.scrollTo(0, 0); }
      return true;
    }
    const paint = async () => {
      const my = ++token; unlight();
      const s = steps[i];
      el.innerHTML = '<div style="display:flex;align-items:center;gap:8px"><b style="font-size:17px;flex:1">' + s.t + '</b><span style="opacity:.6;font-size:12px">' + (i + 1) + " / " + steps.length + '</span><button type="button" data-skip style="border:0;background:none;color:inherit;opacity:.7;cursor:pointer;font-size:18px" title="Close the tour">✕</button></div>' +
        '<div style="margin-top:6px">' + s.b + '</div><div data-where style="margin-top:6px;font-size:12px;opacity:.65"></div>' +
        '<div style="display:flex;align-items:center;gap:6px;margin-top:12px"><div style="flex:1;display:flex;gap:4px">' + steps.map((_, k) => '<i style="width:' + (k === i ? 16 : 7) + 'px;height:7px;border-radius:999px;background:' + (k === i ? "#facc15" : "rgba(255,255,255,.25)") + '"></i>').join("") + "</div>" +
        (i ? '<button type="button" data-back style="border:0;border-radius:999px;padding:8px 14px;background:rgba(255,255,255,.13);color:inherit;font-weight:700;cursor:pointer">Back</button>' : '<button type="button" data-skip style="border:0;border-radius:999px;padding:8px 14px;background:rgba(255,255,255,.13);color:inherit;font-weight:700;cursor:pointer">Skip</button>') +
        (i < steps.length - 1 ? '<button type="button" data-next style="border:0;border-radius:999px;padding:8px 16px;background:#facc15;color:#1b1300;font-weight:800;cursor:pointer">Next</button>'
          : '<button type="button" data-new style="border:0;border-radius:999px;padding:8px 14px;background:rgba(255,255,255,.13);color:inherit;font-weight:700;cursor:pointer">✨ What\'s new</button><button type="button" data-skip style="border:0;border-radius:999px;padding:8px 16px;background:#facc15;color:#1b1300;font-weight:800;cursor:pointer">Done</button>') + "</div>";
      el.querySelectorAll("[data-skip]").forEach((b) => (b.onclick = done));
      const n = el.querySelector("[data-next]"); if (n) n.onclick = () => { i++; paint(); };
      const bk = el.querySelector("[data-back]"); if (bk) bk.onclick = () => { i--; paint(); };
      const w = el.querySelector("[data-new]"); if (w) w.onclick = () => { done(); whatsNew(true); };
      try { sessionStorage.setItem(TOUR_AT, JSON.stringify({ i, at: Date.now() })); } catch (_) {}
      const where = el.querySelector("[data-where]");
      if (s.go) where.textContent = s.go === "other" ? "Taking you to a club you've played…" : s.go === "mine" ? "Taking you to your club's page…" : "";
      if (!(await goTo(s)) || my !== token) return;
      // The page draws a moment after it opens: look for the feature for a few seconds, then outline it.
      const t0 = Date.now();
      while (my === token && (s.sel || []).length && Date.now() - t0 < 6000) {
        const tgt = s.sel.map((q) => document.querySelector(q)).find((e) => e && e.getBoundingClientRect().height > 0);
        if (tgt) { lit = tgt; tgt.dataset.sbxOl = tgt.style.outline; tgt.style.outline = "3px solid #facc15"; tgt.style.outlineOffset = "3px"; const r = tgt.getBoundingClientRect(); if (r.top < 60 || r.bottom > innerHeight - 260) tgt.scrollIntoView({ behavior: "smooth", block: "center" }); where.textContent = ""; return; }
        await sleep(300);
      }
      if (my === token) where.textContent = s.sel ? "(It shows up on " + (s.go === "other" ? "other clubs' pages" : s.go === "mine" ? "your club pages" : "the pages where it applies") + ".)" : "";
    };
    paint();
  }

  // 🩺 Health check: a quick look at everything the kit depends on, with a report to copy into Discord.
  async function openHealth() {
    const ov = sbxModal("🩺 Club Kit health check", `<div class="hc"><div class="muted">Checking…</div></div><div class="acts"><button class="b" type="button" data-copy disabled>📋 Copy report</button><button class="b go" type="button" data-again>Run again</button></div><div class="msg"></div>`, true);
    const out = [], box = ov.querySelector(".hc");
    const add = (ok, label, text) => { out.push([ok, label, text]); box.innerHTML = out.map(([o, l, t]) => `<div class="row"><b>${o === true ? "✅" : o === false ? "❌" : "⚠️"}</b><div><b>${esc(l)}</b><div class="muted">${t}</div></div></div>`).join(""); };
    const run = async () => {
      out.length = 0; box.innerHTML = '<div class="muted">Checking…</div>';
      // 1. version
      try {
        const v = await liveGet("downloads/version.json"), latest = v && v.version;
        if (!latest) add(null, "Kit version", "You're on " + esc(KIT_VERSION) + ". Couldn't reach GitHub to compare.");
        else if (verNum(latest) > verNum(KIT_VERSION)) add(null, "Kit version", "You're on " + esc(KIT_VERSION) + "; <b>" + esc(latest) + "</b> is out. " + (TABLET || MOBILE ? "Your userscript app updates it on its own; you can also check for updates in the app." : DEFAULT_CLUBS.length ? "Your private kit updates itself (or press Update now in its pop-up)." : "Download it from the Club Kit page."));
        else add(true, "Kit version", "Up to date: " + esc(KIT_VERSION) + " (" + esc(kitEdition()) + ").");
      } catch (e) { add(null, "Kit version", esc(e.message || e)); }
      // 2. storage
      try { localStorage.setItem("sbx-hc", "1"); localStorage.removeItem("sbx-hc"); add(true, "Settings storage", hasChromeStorage ? "Browser and extension storage both work." : "Browser storage works."); }
      catch (e) { add(false, "Settings storage", "This browser blocks site storage (private mode?). The kit can't remember your settings."); }
      // 3. clubs + SmallBall sign-in
      const clubs = clubList();
      if (!clubs.length) add(null, "Your clubs", "No clubs picked. Open ⚙ settings and tick your clubs.");
      else add(true, "Your clubs", clubs.length + " in your tabs and dashboard: " + clubs.map((c) => esc(String(c))).join(", ") + ".");
      if (clubs.length) {
        try { const p = await getJSON("/teams/" + clubs[0] + "/profile", true); add(p && p.mine ? true : null, "SmallBall sign-in", p && p.mine ? "Signed in; SmallBall answers for " + esc(p.name || clubs[0]) + "." : "SmallBall answered, but doesn't show " + esc(String(clubs[0])) + " as yours. Are you signed in as its owner?"); }
        catch (e) { add(false, "SmallBall sign-in", "SmallBall didn't answer (" + esc(e.message || e) + "). Try reloading, or sign in again."); }
      }
      // 4. Hill + tournaments
      try {
        const H = await liveGet("docs/hill/board.json"), at = H && Date.parse(H.updated || H.generated || "");
        if (!H) add(false, "Hold the Hill data", "Couldn't load the Live Hold the Hill Leaderboard data.");
        else { const mins = at ? Math.round((Date.now() - at) / 60000) : null; add(mins == null || mins < 180 ? true : null, "Hold the Hill data", "Loaded" + (mins != null ? ", updated " + (mins < 60 ? mins + " min" : Math.round(mins / 60) + " h") + " ago" : "") + (H.ace ? ". ♠ Ace: " + esc(H.ace.name) : "") + "."); }
      } catch (e) { add(false, "Hold the Hill data", esc(e.message || e)); }
      try {
        const T = await liveGet("docs/tournaments/index.json"), list = (T && T.list) || [];
        const open = list.filter((t) => t.signupClose && t.signupClose > Date.now());
        add(T ? true : false, "Tournaments", T ? list.length + " on the Tournaments page" + (open.length ? "; sign-ups open: " + open.map((t) => esc(t.name)).join(", ") : "") + "." : "Couldn't load the Tournaments page data.");
      } catch (e) { add(false, "Tournaments", esc(e.message || e)); }
      // 5. switches + saved lineups
      const off = FEATURES.filter(([k]) => !on(k)).map(([, l]) => l.split(":")[0].split("(")[0].trim());
      add(true, "Features", off.length ? off.length + " turned off: " + off.slice(0, 8).map(esc).join("; ") + (off.length > 8 ? "…" : "") : "Everything is on.");
      try { const B = JSON.parse(localStorage.getItem("sbx-builder") || "{}"), n = Object.values(B).reduce((a, c) => a + ((c && c.saved) || []).length, 0); add(true, "Lineup Builder", n ? n + " saved lineup" + (n === 1 ? "" : "s") + "." : "No saved lineups yet."); } catch (_) { add(null, "Lineup Builder", "Its settings couldn't be read."); }
      add(true, "Browser", esc((navigator.userAgent.match(/(iPad|iPhone|Android|CrOS|Windows|Mac OS X)[^;)]*/) || ["?"])[0]) + " · screen " + innerWidth + "×" + innerHeight + ".");
      ov.querySelector("[data-copy]").disabled = false;
    };
    ov.querySelector("[data-again]").onclick = run;
    ov.querySelector("[data-copy]").onclick = async () => {
      const txt = "🩺 Club Kit health check · " + KIT_VERSION + " · " + kitEdition() + "\n" + out.map(([o, l, t]) => (o === true ? "✅ " : o === false ? "❌ " : "⚠️ ") + l + ": " + t.replace(/<[^>]+>/g, "")).join("\n");
      try { await navigator.clipboard.writeText(txt); ov.querySelector(".msg").textContent = "📋 Copied. Paste it in Discord for slipnsliders."; }
      catch (_) { ov.querySelector(".msg").innerHTML = '<textarea readonly>' + esc(txt) + "</textarea>"; }
    };
    run();
  }

  // 💾 Back up / restore: your clubs, notes, switches, saved lineups and the rest, as one code.
  const BACKUP_SKIP = /^sbx-(box-v\d|dash-cache|tplog|park-cache|passive|hc|seen-version|live-hidden|live-min)/;   // caches and history, not settings
  const BIG_KEYS = /^sbx-skins$/;   // stadium pictures: optional, they can be large
  const b64e = (str) => { const b = new TextEncoder().encode(str); let s = ""; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192)); return btoa(s); };
  const b64d = (str) => new TextDecoder().decode(Uint8Array.from(atob(str.replace(/\s+/g, "")), (c) => c.charCodeAt(0)));
  const csGet = (keys) => new Promise((res) => { try { chrome.storage.local.get(keys, (r) => res(r || {})); } catch (_) { res({}); } });
  async function makeBackup(withPics) {
    const ls = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!/^sbx/.test(k) || BACKUP_SKIP.test(k) || (!withPics && BIG_KEYS.test(k))) continue;
      ls[k] = localStorage.getItem(k);
    }
    let ext = null;
    if (hasChromeStorage) {
      ext = await csGet(["sbxClubs", "sbxNotes", "sbxLogos"]);
      if (!withPics) delete ext.sbxLogos;
    } else if (!withPics && ls[LS_STORE]) {
      try { const o = JSON.parse(ls[LS_STORE]); delete o.sbxLogos; ls[LS_STORE] = JSON.stringify(o); } catch (_) {}
    }
    return "SBXKIT1:" + b64e(JSON.stringify({ v: 1, kit: KIT_VERSION, from: kitEdition(), at: new Date().toISOString(), ls: ls, ext: ext }));
  }
  function openBackup() {
    const ov = sbxModal("💾 Back up / restore your Club Kit", `<div class="muted">Your clubs, notes, feature switches, saved lineups and other settings, as one code. Copy it somewhere safe, or paste it on another device (Chrome, phone or iPad) to set the kit up the same way.</div>
      <p><b>Back up</b> <label class="muted" style="margin-left:8px"><input type="checkbox" data-pics> include logos and stadium pictures (bigger)</label></p>
      <textarea readonly data-out placeholder="Press Make a backup code"></textarea>
      <div class="acts"><button class="b" type="button" data-dl disabled>⬇️ Save as a file</button><button class="b" type="button" data-cp disabled>📋 Copy</button><button class="b go" type="button" data-mk>Make a backup code</button></div>
      <p style="margin-top:16px"><b>Restore</b> <span class="muted">Paste a backup code. It replaces the settings on this device, then reloads.</span></p>
      <textarea data-in placeholder="SBXKIT1:…"></textarea>
      <div class="acts"><button class="b" type="button" data-file>📂 Open a file</button><button class="b go" type="button" data-rs>Restore</button></div><div class="msg"></div>`, true);
    const $ = (s) => ov.querySelector(s), msg = (t) => { $(".msg").innerHTML = t; };
    $("[data-mk]").onclick = async () => {
      const code = await makeBackup($("[data-pics]").checked);
      $("[data-out]").value = code; $("[data-cp]").disabled = $("[data-dl]").disabled = false;
      msg("Backup ready: " + Math.max(1, Math.round(code.length / 1024)) + " KB.");
    };
    $("[data-cp]").onclick = async () => { try { await navigator.clipboard.writeText($("[data-out]").value); msg("📋 Copied."); } catch (_) { $("[data-out]").select(); msg("Select-all is on: copy it with your keyboard or long-press."); } };
    $("[data-dl]").onclick = () => {
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([$("[data-out]").value], { type: "text/plain" }));
      a.download = "SmallBall-Club-Kit-backup-" + new Date().toISOString().slice(0, 10) + ".txt"; document.body.appendChild(a); a.click(); a.remove();
    };
    $("[data-file]").onclick = () => {
      const f = document.createElement("input"); f.type = "file"; f.accept = ".txt,text/plain";
      f.onchange = () => { const r = new FileReader(); r.onload = () => { $("[data-in]").value = String(r.result || "").trim(); msg("File loaded. Press Restore."); }; if (f.files[0]) r.readAsText(f.files[0]); };
      f.click();
    };
    $("[data-rs]").onclick = async () => {
      const raw = $("[data-in]").value.trim();
      let d; try { if (!raw.startsWith("SBXKIT1:")) throw 0; d = JSON.parse(b64d(raw.slice(8))); if (!d || d.v !== 1 || typeof d.ls !== "object") throw 0; } catch (_) { msg("❌ That isn't a Club Kit backup code. It should start with SBXKIT1:"); return; }
      const btn = $("[data-rs]");
      if (btn.dataset.sure !== "1") { btn.dataset.sure = "1"; btn.textContent = "Yes, replace my settings"; msg("This backup is from " + esc(d.from || "?") + " (" + esc(d.kit || "?") + "), " + esc(String(d.at || "").slice(0, 10)) + ". Press again to restore."); return; }
      try {
        Object.keys(d.ls).forEach((k) => { if (/^sbx/.test(k)) localStorage.setItem(k, d.ls[k]); });
        const ext = d.ext || {};
        if (hasChromeStorage) { const put = {}; ["sbxClubs", "sbxNotes", "sbxLogos"].forEach((k) => { if (ext[k] != null) put[k] = ext[k]; }); if (Object.keys(put).length) await new Promise((res) => chrome.storage.local.set(put, res)); }
        else { const put = {}; ["sbxClubs", "sbxNotes", "sbxLogos"].forEach((k) => { if (ext[k] != null) put[k] = ext[k]; }); if (Object.keys(put).length) lsSet(put); }
        msg("✅ Restored. Reloading…"); setTimeout(() => location.reload(), 700);
      } catch (e) { msg("❌ Couldn't restore: " + esc(e.message || e)); }
    };
  }
  if (window.top === window) setTimeout(() => {
    let toured = false; try { toured = !!localStorage.getItem(TOUR_KEY); } catch (_) {}
    // not over the trainer or a game: the tour waits for the next page you open
    // a tour that reloaded the page to reach a step picks up where it was
    let resume = null; try { resume = JSON.parse(sessionStorage.getItem(TOUR_AT) || "null"); } catch (_) {}
    if (resume && Date.now() - resume.at < 120e3 && location.pathname !== "/training") { try { openTour(resume.i); } catch (_) {} return; }
    try { if (toured) whatsNew(false); else if (location.pathname !== "/training") openTour(0); } catch (_) {}
  }, 3500);

  // ───────── 🔥🧊 Hot & cold: the last 10 games against each man's career, in the squad table ─────────
  const HOT = {};   // team -> { at, busy, map: pid -> { tag, tip } }
  window.__sbxHot = HOT;   // the Lineup Builder reads this for its chips
  const opsOf = (ab, h, b2, b3, hr, bb) => { const pa = ab + bb; if (!pa || !ab) return null; const tb = h + b2 + 2 * b3 + 3 * hr; return (h + bb) / pa + tb / ab; };
  async function loadHot(team) {
    // Form, not talent: each man's last 10 games against the 15 before them (his career line if those are too few).
    const H = HOT[team] || (HOT[team] = { at: 0, busy: false, map: {} });
    if (H.busy || Date.now() - H.at < 10 * 60000) return;
    H.busy = true;
    try {
      const prof = await profileOf(team, 5 * 60000);
      const games = (await seasonGames(team)).filter((g) => g.finished_at).sort((a, b) => Date.parse(b.finished_at) - Date.parse(a.finished_at)).slice(0, 25);
      await fillBoxes(games, () => true);
      const sum = (list) => {
        const L = {};
        for (const g of list) {
          const [S] = sideOf(BOX[g.game_id], team); if (!S) continue;
          for (const [id, x] of Object.entries(S.p)) { const a = L[id] || (L[id] = { g: 0, ab: 0, h: 0, b2: 0, b3: 0, hr: 0, bb: 0, k: 0 }); a.g++; a.ab += x[0]; a.h += x[1]; a.b2 += x[2]; a.b3 += x[3]; a.hr += x[4]; a.bb += x[5]; a.k += x[6] || 0; }
        }
        return L;
      };
      const R = sum(games.slice(0, 10)), B = sum(games.slice(10)), map = {}, f3 = (x) => x.toFixed(3).replace(/^0/, "");
      // Their pitching over these games, from the box scores (the site's career pitching numbers aren't reliable).
      const arms = {};
      for (const g of games) {
        const [S, O] = sideOf(BOX[g.game_id], team); if (!S || !O) continue;
        const ids = Object.keys(S.p).filter((id) => S.p[id][7] > 0), ipAll = ids.reduce((t, id) => t + S.p[id][7], 0) || 1;
        const tot = { h: 0, bb: 0, k: 0, hr: 0 }; for (const L of Object.values(O.p)) { tot.h += L[1]; tot.bb += L[5]; tot.k += L[6]; tot.hr += L[4]; }
        for (const id of ids) { const f = S.p[id][7] / ipAll, a = arms[id] || (arms[id] = { g: 0, ip: 0, r: 0, h: 0, bb: 0, k: 0, hr: 0 }); a.g++; a.ip += S.p[id][7]; a.r += S.ra * f; a.h += tot.h * f; a.bb += tot.bb * f; a.k += tot.k * f; a.hr += tot.hr * f; }
      }
      H.last10 = R; H.arms = arms; H.n = games.length;
      for (const p of (prof && prof.roster) || []) {
        const a = R[String(p.player_id)], b = B[String(p.player_id)], c = p.career || {};
        if (!a || a.ab < 15) continue;
        const now = opsOf(a.ab, a.h, a.b2, a.b3, a.hr, a.bb);
        let base = null, vs = "";
        if (b && b.ab >= 25) { base = opsOf(b.ab, b.h, b.b2, b.b3, b.hr, b.bb); vs = "the " + b.g + " games before"; }
        else if ((c.at_bats || 0) >= 60) { base = opsOf(c.at_bats || 0, c.hits || 0, c.doubles || 0, c.triples || 0, c.home_runs || 0, c.walks || 0); vs = "career"; }
        if (now == null || base == null || !base) continue;
        const rel = (now - base) / base;
        const tip = "Last " + a.g + " games: " + a.h + "-for-" + a.ab + (a.hr ? ", " + a.hr + " HR" : "") + (a.bb ? ", " + a.bb + " BB" : "") + " · OPS " + f3(now) + " (" + vs + ": " + f3(base) + ")";
        const num = { g: a.g, ab: a.ab, h: a.h, hr: a.hr, bb: a.bb, now, base, vs };
        if (rel >= 0.2) map[p.player_id] = { tag: "hot", tip: "🔥 Hot. " + tip, num };
        else if (rel <= -0.2) map[p.player_id] = { tag: "cold", tip: "🧊 Cold. " + tip, num };
      }
      H.map = map; H.at = Date.now();
    } catch (_) { H.at = Date.now() - 8 * 60000; }
    finally { H.busy = false; setTimeout(tick, 0); }
  }

  function hotTags(t, team) {
    if (!team) return;
    const H = HOT[team];
    if (!H || (!H.busy && Date.now() - H.at > 10 * 60000)) loadHot(team);
    if (!H || !H.at) return;
    for (const tr of t.querySelectorAll("tr.man")) {
      const td = tr.children[3]; if (!td) continue;
      const x = H.map[tr.dataset.pid], cur = td.querySelector(".sbx-hot");
      const want = x ? (x.tag === "hot" ? "🔥" : "🧊") : "";
      if (cur && cur.textContent === want && cur.title === (x && x.tip)) continue;
      if (cur) cur.remove();
      if (!x) continue;
      const sp = document.createElement("span"); sp.className = "sbx-hot"; sp.textContent = want; sp.title = x.tip;
      sp.style.cssText = "margin-right:4px;cursor:help";
      td.insertBefore(sp, td.firstChild);
    }
  }

  // ───────── 🏋️ Training plan: your plan for each man, next to the trainer and on your club page ─────────
  const TPLAN_KEY = "sbx-trainplan";
  const SKL = [["P", "pitch_skill", "Pitching"], ["C", "catch_skill", "Catching"], ["T", "pass_power", "Throwing"], ["R", "run_speed", "Running"], ["BS", "swing_skill", "Bat Skill"], ["BP", "swing_power", "Bat Power"], ["BC", "contact_odds", "Bat Contact"]];   // SmallBall's own names
  const tplanAll = () => { try { return JSON.parse(localStorage.getItem(TPLAN_KEY)) || {}; } catch (_) { return {}; } };
  const tplanSave = (team, o) => { const a = tplanAll(); a[team] = o; try { localStorage.setItem(TPLAN_KEY, JSON.stringify(a)); } catch (_) {} };
  const todayKey = () => new Date().toLocaleDateString("en-CA");
  function tplanTeam() {
    if (isTrainer()) { const q = new URLSearchParams(location.search); const id = Number(q.get("team") || 0); return id || Number((document.getElementById("who-team") || {}).value || 0); }
    const m = location.hash.match(/^#\/team\/(\d+)/); return m && ownIds().has(m[1]) ? Number(m[1]) : 0;
  }
  // ── Training tracker: every read of your own club, compare each man's TP and skills with the last read.
  // TP below his refill line = TP spent; a skill going up = a gain. TP is split across the skills that rose
  // (by how much each rose); if he spent TP but didn't rise, to what the squad rose in, since the trainer
  // drills everyone at once. With nothing rising at all, it goes to his one planned skill if he has
  // exactly one, otherwise it's "not yet matched". Per day, per man, kept 45 days. Read-only, like the rest.
  const TTRK_KEY = "sbx-traintrack";
  const ttrkAll = () => { try { return JSON.parse(localStorage.getItem(TTRK_KEY)) || {}; } catch (_) { return {}; } };
  function trainTrack(team, d) {
    const all = ttrkAll(), T = all[team] || (all[team] = { snap: null, days: {} });
    const now = Date.parse(d.server_time || "") || Date.now(), roster = d.roster || [];
    const snap = { at: now, m: {} };
    for (const p of roster) snap.m[p.player_id] = [Math.round(+p.tp || 0)].concat(SKL.map(([, k]) => Math.round(+p[k] || 0)));
    const prev = T.snap;
    if (prev && now > prev.at) {
      const { R, max } = tpManRates(d), day = new Date(now).toLocaleDateString("en-CA"), plans = tplanAll()[team] || {};
      // A drill burns TP over a few seconds, then the skill ticks up, and men can be on different drills at once.
      // So TP a man spends waits ("pending") and is credited to the next skill HE gains. Pending TP left
      // 15 minutes with no gain goes to his one planned skill, or shows as "not matched".
      const pend = T.pend || (T.pend = {});
      for (const id of Object.keys(snap.m)) {
        const a = prev.m[id], b = snap.m[id]; if (!a) continue;
        const expect = Math.min(max, a[0] + (R[id] || 0) * (now - prev.at)), spent = Math.max(0, expect - b[0]);
        const g = SKL.map((_, i) => Math.max(0, b[i + 1] - a[i + 1])), gs = g.reduce((t, x) => t + x, 0);
        const P = pend[id];
        if (spent < 1.5 && !gs) {
          if (P && now - P.at > 15 * 6e4) { const D = T.days[P.day] || (T.days[P.day] = {}), M = D[id] || (D[id] = { tp: 0, g: SKL.map(() => 0), a: SKL.map(() => 0), u: 0, at: 0 }); const f = (plans[id] || {}).focus || []; if (f.length === 1) M.a[SKL.findIndex(([k]) => k === f[0])] += Math.round(P.tp); else M.u += Math.round(P.tp); delete pend[id]; }
          continue;
        }
        const D = T.days[day] || (T.days[day] = {}), M = D[id] || (D[id] = { tp: 0, g: SKL.map(() => 0), a: SKL.map(() => 0), u: 0, at: 0 });
        const sp = spent >= 1.5 ? spent : 0;
        M.tp = Math.round((M.tp + sp) * 10) / 10; M.at = now; g.forEach((x, i) => (M.g[i] += x));
        if (gs) { const nm = (roster.find((x) => String(x.player_id) === id) || {}).name || "#" + id; g.forEach((x, i) => { if (x) atEv.push({ at: now, team, pid: id, name: nm, k: SKL[i][2], from: a[i + 1], to: b[i + 1] }); }); if (atEv.length > 400) atEv.splice(0, atEv.length - 400); AT.flash[id] = Date.now(); }
        if (gs) { const tot = sp + (P ? P.tp : 0); g.forEach((x, i) => (M.a[i] = Math.round((M.a[i] + (tot * x) / gs) * 10) / 10)); delete pend[id]; }
        else if (sp) pend[id] = { tp: (P ? P.tp : 0) + sp, at: now, day };
      }
      const keep = Object.keys(T.days).sort().slice(-45), nd = {}; keep.forEach((k) => (nd[k] = T.days[k])); T.days = nd;
    }
    T.snap = snap;
    try { localStorage.setItem(TTRK_KEY, JSON.stringify(all)); } catch (_) {}
    if (typeof mountAsst === "function" && (AT.open || isTrainer())) { const ae = document.activeElement; if (!(ae && /input|textarea/i.test(ae.tagName) && ae.closest && ae.closest("#sbx-at,#sbx-atnotes"))) atRedraw(); }
  }
  // Totals for one man since a day (inclusive): TP spent, gains and TP per skill.
  function ttrkSum(team, pid, since) {
    const T = ttrkAll()[team], o = { tp: 0, g: SKL.map(() => 0), a: SKL.map(() => 0), u: 0 };
    if (!T) return o;
    for (const [day, D] of Object.entries(T.days)) { if (since && day < since) continue; const M = D[pid]; if (!M) continue; o.tp += M.tp; o.u += M.u; M.g.forEach((x, i) => (o.g[i] += x)); M.a.forEach((x, i) => (o.a[i] += x)); }
    const P = T.pend && T.pend[pid]; if (P && (!since || P.day >= since)) o.u += Math.round(P.tp);
    o.tp = Math.round(o.tp); o.a = o.a.map((x) => Math.round(x));
    return o;
  }
  // On the trainer, re-read your club every 6 seconds (the site saves each drill as it happens) so the cards keep up while you train.
  setInterval(() => {
    try {
      if (!isTrainer() || document.hidden || !on("tplan")) return;
      const team = tplanTeam(); if (team) profileOf(team, 4000).catch(() => {});
    } catch (_) {}
  }, 6000);
  // "About how far to the next star": compares a man's skill average with the teammates already a star higher.
  function nextStar(p, roster) {
    const avg = (x) => SKL.reduce((t, [, k]) => t + (+x[k] || 0), 0) / SKL.length;
    const o = +p.overall || 0, up = roster.filter((x) => (+x.overall || 0) === o + 1);
    if (!up.length) return null;
    const need = Math.min(...up.map(avg)) - avg(p);
    return { star: o + 1, gap: Math.max(0, Math.round(need * SKL.length)) };   // in total skill points
  }
  // ───────── 📋 Asst. Trainer Kit ─────────
  // Off the trainer: a full-page planner for one of your clubs (📋 button on your club page).
  // On the trainer: a live board under the game with every man, his TP and his gains as they land.
  // Read-only: the kit never trains for you. Plans are kept in this browser (and in 💾 backups).
  const AT = { open: false, team: 0, sess: null, flash: {}, seen: {}, sig: "", dsig: "" };
  const atEv = [];   // recent gains, newest last: { at, team, pid, name, k, from, to }
  const atStyle = () => {
    if (document.getElementById("sbx-at-css")) return;
    const st = document.createElement("style"); st.id = "sbx-at-css";
    st.textContent = [
      "#sbx-at,#sbx-dock{font:13px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#f4ebd9}",
      "#sbx-at{position:fixed;inset:0;z-index:2147483300;background:rgba(6,12,26,.97);overflow:auto;padding:22px 26px 60px}",
      "#sbx-at h2{margin:0;font:900 24px/1.1 system-ui,sans-serif;letter-spacing:.3px}",
      ".at-top{display:flex;align-items:center;gap:12px;flex-wrap:wrap;max-width:1500px;margin:0 auto}",
      ".at-x{margin-left:auto;border:0;background:rgba(255,255,255,.12);color:inherit;border-radius:10px;padding:8px 14px;font-weight:800;cursor:pointer}",
      ".at-clubs{display:flex;gap:6px;flex-wrap:wrap;max-width:1500px;margin:14px auto 0}",
      ".at-clubs button{border:1px solid rgba(255,255,255,.2);background:transparent;color:inherit;border-radius:999px;padding:5px 12px;cursor:pointer;font-weight:700}",
      ".at-clubs button.on{background:#facc15;color:#1b1300;border-color:#facc15}",
      ".at-sum{display:flex;gap:8px;flex-wrap:wrap;max-width:1500px;margin:12px auto 0}",
      ".at-sum span{background:rgba(255,255,255,.08);border-radius:999px;padding:5px 12px}",
      ".at-sum b{color:#fde68a}",
      ".at-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:14px;max-width:1500px;margin:16px auto 0}",
      ".at-card{background:#0f1b33;border-radius:14px;padding:13px 14px;box-shadow:0 6px 18px rgba(0,0,0,.35)}",
      ".at-card.done{box-shadow:inset 4px 0 0 #16a34a,0 6px 18px rgba(0,0,0,.35)}",
      ".at-nm{font-weight:900;font-size:15px}",
      ".at-sub{opacity:.65;font-size:12px}",
      ".at-bar{height:7px;border-radius:999px;background:rgba(255,255,255,.12);overflow:hidden}",
      ".at-bar i{display:block;height:100%;transition:width .6s ease,background .6s}",
      ".at-sk{display:grid;grid-template-columns:92px 1fr 34px 40px;gap:8px;align-items:center;padding:4px 6px;border-radius:8px;cursor:pointer}",
      ".at-sk:hover{background:rgba(255,255,255,.06)}",
      ".at-sk.f{background:rgba(250,204,21,.13);outline:1px solid rgba(250,204,21,.5)}",
      ".at-sk .v{text-align:right;font-weight:800;font-variant-numeric:tabular-nums}",
      ".at-sk .g{text-align:right;font-size:12px;color:#4ade80;font-weight:700}",
      ".at-tg{display:flex;align-items:center;gap:8px;margin:2px 6px 6px 6px;font-size:12px}",
      ".at-tg input,.at-note{font:inherit;font-size:12px;background:#13254a;color:inherit;border:1px solid rgba(255,255,255,.2);border-radius:7px;padding:3px 7px}",
      ".at-tg input{width:62px}",
      ".at-note{width:100%;box-sizing:border-box;margin-top:8px}",
      ".at-today{margin-top:8px;font-size:12px;background:rgba(22,163,74,.16);border-radius:7px;padding:4px 8px}",
      ".at-help{max-width:1500px;margin:14px auto 0;opacity:.7;font-size:12.5px}",
      "#sbx-dock{margin:14px auto 30px;max-width:1500px;background:#0b1428;border-radius:14px;padding:12px 14px;box-shadow:0 8px 24px rgba(0,0,0,.35)}",
      "#sbx-dock .dk-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap}",
      "#sbx-dock .dk-h b.t{font:900 16px/1 system-ui,sans-serif}",
      "#sbx-dock .dk-h>span{background:rgba(255,255,255,.08);border-radius:999px;padding:3px 10px;font-size:12px}",
      "#sbx-dock .dk-h b{color:#fde68a}#sbx-dock .dk-h b.t{color:inherit}",
      "#sbx-dock .dk-mode{display:inline-flex;gap:0!important;padding:0!important;overflow:hidden;background:rgba(255,255,255,.08)}",
      "#sbx-dock .dk-mode button{border:0;background:none;color:inherit;padding:4px 10px;font-size:12px;font-weight:700;cursor:pointer}#sbx-dock .dk-mode button.on{background:#facc15;color:#1b1300}",
      "#sbx-dock .dk-plan{margin-left:auto;border:0;background:#7c3aed;color:#fff;border-radius:999px;padding:5px 12px;font-weight:800;cursor:pointer}",
      "#sbx-dock .dk-body{display:grid;grid-template-columns:1fr 250px;gap:12px;margin-top:10px}",
      "@media (max-width:900px){#sbx-dock .dk-body{grid-template-columns:1fr}}",
      "#sbx-dock .gn i.off{background:#64748b}",
      "#sbx-atnotes textarea,#sbx-atnotes input{width:100%;box-sizing:border-box;font:inherit;font-size:12px;background:#13254a;color:inherit;border:1px solid rgba(255,255,255,.2);border-radius:7px;padding:5px 7px}",
      "#sbx-atnotes .nt-m{margin-top:9px;font-size:12.5px}#sbx-atnotes .nt-m input{margin-top:3px}",
      ".at-side{position:fixed;top:76px;bottom:110px;z-index:2147481990;background:rgba(8,15,32,.96);border:1px solid rgba(255,255,255,.1);box-shadow:0 10px 30px rgba(0,0,0,.45);display:flex;flex-direction:column;font:13px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#f4ebd9}",
      ".at-side.l{left:0;border-radius:0 14px 14px 0}.at-side.r{right:0;border-radius:14px 0 0 14px;z-index:2147483500}",
      ".at-side.min{width:34px;background:#16a34a;border:0;top:180px;bottom:auto}",
      ".at-tab{border:0;background:none;color:#fff;font:800 12px/1.15 system-ui,sans-serif;cursor:pointer;padding:10px 0;width:34px}",
      ".at-side .sd-h{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.08)}",
      ".at-side .sd-h b{font:900 15px/1 system-ui,sans-serif;white-space:nowrap}.at-side .sd-h .at-sub{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".at-side .sd-h button{border:0;background:rgba(255,255,255,.12);color:inherit;border-radius:7px;padding:3px 8px;cursor:pointer;font-weight:800}",
      ".at-side .sd-b{overflow:auto;padding:10px;flex:1}",
      ".at-side.l .at-card{padding:10px 11px;margin-bottom:10px}.at-side.l .at-sk{grid-template-columns:78px 1fr 26px 28px;gap:6px;padding:2px 4px;font-size:12px}",
      ".at-side.l .at-nm{font-size:14px}",
      "#sbx-dock .dk-sum{display:flex;gap:6px;margin-bottom:8px}#sbx-dock .dk-sum span{background:rgba(255,255,255,.08);border-radius:999px;padding:3px 10px;font-size:12px}#sbx-dock .dk-sum b{color:#fde68a}",
      "#sbx-dock .dk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}",
      "#sbx-dock .dk-m{background:#13213f;border-radius:10px;padding:7px 9px;transition:background .6s}",
      "#sbx-dock .dk-m.fl{background:#14532d}",
      "#sbx-dock .dk-m .n{font-weight:800;font-size:13px;line-height:1.2}",
      "#sbx-dock .dk-m .p{opacity:.6;font-size:11px;font-weight:600}",
      "#sbx-dock .dk-m .tp{display:flex;align-items:center;gap:6px;margin-top:4px;font-size:11.5px}",
      "#sbx-dock .dk-m .tp .at-bar{flex:1;height:6px}",
      "#sbx-dock .gn{display:flex;flex-wrap:wrap;gap:3px;margin-top:5px}",
      "#sbx-dock .gn i{font-style:normal;background:#16a34a;color:#fff;border-radius:6px;padding:1px 6px;font-size:11px;font-weight:700}",
      "#sbx-dock .gn i.pl{background:#facc15;color:#1b1300}",
      "#sbx-dock .tg{font-size:11px;margin-top:4px;opacity:.9}",
      "#sbx-dock .feed{background:#13213f;border-radius:10px;padding:8px 10px;font-size:12px;margin-top:8px}",
      "#sbx-dock .feed div{padding:3px 0;border-bottom:1px solid rgba(255,255,255,.06)}",
      "#sbx-dock .feed b{color:#4ade80}",
      "#sbx-dock .dk-pl{display:inline-flex;gap:0!important;padding:2px!important;background:rgba(255,255,255,.08);border-radius:999px}",
      "#sbx-dock .dk-pl button{border:0;background:none;color:inherit;opacity:.7;padding:3px 7px;font-size:12px;cursor:pointer;border-radius:999px}#sbx-dock .dk-pl button.on{background:#334155;opacity:1}",
      "#sbx-dock.fl{position:fixed;right:16px;top:90px;z-index:2147482990;margin:0;width:min(620px,calc(100vw - 32px));max-height:calc(100vh - 110px);overflow:auto;box-shadow:0 18px 50px rgba(0,0,0,.6)}",
      "#sbx-dock.fl .dk-h{cursor:move;user-select:none}#sbx-dock.fl .dk-body{grid-template-columns:1fr}#sbx-dock.fl .dk-plan{margin-left:0}",
      "#sbx-dock.bug{position:fixed;right:16px;top:110px;z-index:2147482990;margin:0;width:290px;padding:10px 12px;border-radius:14px;background:linear-gradient(#10182c,#0b1220);box-shadow:0 14px 40px rgba(0,0,0,.6),0 0 0 2px #16a34a}",
      "#sbx-dock .bg-h{display:flex;align-items:center;gap:6px;cursor:move;user-select:none}#sbx-dock .bg-h b{flex:1;font:900 11px system-ui,sans-serif;letter-spacing:.12em;color:#4ade80}",
      "#sbx-dock .bg-club{font-weight:800;margin-top:4px}#sbx-dock .bg-club span{opacity:.55;font-weight:600;font-size:11px}",
      "#sbx-dock .bg-nums{display:flex;gap:6px;margin-top:8px}#sbx-dock .bg-nums div{flex:1;background:rgba(255,255,255,.06);border-radius:10px;padding:6px 4px;text-align:center}",
      "#sbx-dock .bg-nums b{display:block;font:900 20px/1 system-ui,sans-serif;color:#fde68a}#sbx-dock .bg-nums b.g{color:#4ade80}#sbx-dock .bg-nums b.y{color:#facc15}#sbx-dock .bg-nums span{font-size:10px;opacity:.65}",
      "#sbx-dock .bg-last{margin-top:8px;font-size:12px;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,.05);transition:background .5s}#sbx-dock .bg-last b{color:#4ade80}#sbx-dock .bg-last.hot{background:#14532d}",
      "#sbx-dock .bg-btns{display:flex;gap:6px;margin-top:8px}#sbx-dock .bg-open{flex:1;border:0;border-radius:999px;padding:6px 4px;background:rgba(255,255,255,.1);color:inherit;font-weight:800;font-size:11.5px;cursor:pointer}#sbx-dock .bg-open:hover{background:rgba(255,255,255,.18)}",
      "#sbx-dock .dk-view{display:inline-flex;gap:0!important;padding:0!important;overflow:hidden;background:rgba(255,255,255,.08)}#sbx-dock .dk-view button{border:0;background:none;color:inherit;padding:4px 10px;font-size:12px;font-weight:700;cursor:pointer}#sbx-dock .dk-view button.on{background:#38bdf8;color:#082f49}",
      "#sbx-dock .dk-sk{overflow:auto}#sbx-dock .dk-sk table{border-collapse:collapse;width:100%;font-size:12px;font-variant-numeric:tabular-nums}#sbx-dock .dk-sk th{text-align:center;font-size:11px;opacity:.75;padding:4px 5px;white-space:nowrap}#sbx-dock .dk-sk td{text-align:center;padding:4px 5px;border-top:1px solid rgba(255,255,255,.07)}",
      "#sbx-dock .dk-sk td.nm{text-align:left;font-weight:700;white-space:nowrap}#sbx-dock .dk-sk td.lo{background:rgba(245,158,11,.25);color:#fde68a;font-weight:800;border-radius:4px}#sbx-dock .dk-sk td.na{opacity:.35}#sbx-dock .dk-sk td i{font-style:normal;color:#4ade80;font-size:10.5px;font-weight:800}#sbx-dock .dk-skn{font-size:11px;opacity:.6;margin-top:6px}",
      "#sbx-dock .bg-weak{margin-top:8px;font-size:11.5px}#sbx-dock .bg-wt{border:0;background:none;color:inherit;font-weight:800;padding:0 0 3px;cursor:pointer;font-size:11.5px;opacity:.85}",
      "#sbx-dock .bg-weak div{display:flex;gap:6px;align-items:baseline;padding:2px 0;border-top:1px solid rgba(255,255,255,.06)}#sbx-dock .bg-weak .nm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#sbx-dock .bg-weak .nm i{font-style:normal;opacity:.5;font-size:10px}",
      "#sbx-dock .bg-weak .w1{color:#fde68a;white-space:nowrap}#sbx-dock .bg-weak .w1 b{color:#fbbf24}#sbx-dock .bg-weak .w2{opacity:.55;white-space:nowrap;font-size:10.5px}",
      "#sbx-dock.bug{max-height:calc(100vh - 130px);overflow:auto}",
      "#sbx-selbug{position:fixed;right:16px;top:120px;z-index:2147482990;width:260px;background:linear-gradient(#10182c,#0b1220);color:#f4ebd9;border-radius:14px;padding:10px 12px;box-shadow:0 14px 40px rgba(0,0,0,.6),0 0 0 2px #38bdf8;font:12px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}",
      "#sbx-selbug .bg-h{display:flex;align-items:baseline;gap:6px;cursor:move;user-select:none}#sbx-selbug .bg-h b{font:900 14px/1.2 system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#sbx-selbug .bg-h i{font-style:normal;opacity:.55;font-size:11px}#sbx-selbug .x{margin-left:auto;border:0;background:none;color:inherit;opacity:.6;cursor:pointer;font-size:14px}",
      "#sbx-dock .dk-finish{background:linear-gradient(180deg,#22c55e,#15803d);color:#fff;border:2px solid #bbf7d0;border-radius:999px;padding:7px 18px;font:900 15px/1 system-ui,sans-serif;letter-spacing:.3px;cursor:pointer;box-shadow:0 4px 14px rgba(34,197,94,.45);white-space:nowrap}#sbx-dock .dk-finish:hover{filter:brightness(1.1)}",
      "#sbx-selbug .tpl{margin:-3px 0 8px}#sbx-selbug .tpl .at-bar{height:6px}",
      "#sbx-selbug .nums{display:flex;gap:8px;flex-wrap:wrap;margin:5px 0 7px;font-size:11px;opacity:.9}#sbx-selbug .nums b{color:#fde68a}#sbx-selbug .nums b.g{color:#4ade80}#sbx-selbug .nums b.r{color:#f87171}",
      "#sbx-selbug .sr{display:grid;grid-template-columns:86px 1fr 24px 24px;gap:5px;align-items:center;padding:2px 0}#sbx-selbug .sr .nm{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#sbx-selbug .sr b{text-align:right}#sbx-selbug .sr em{font-style:normal;color:#4ade80;font-weight:800;font-size:11px}",
      "#sbx-selbug .bar{height:7px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden}#sbx-selbug .bar i{display:block;height:100%;background:#38bdf8;border-radius:999px}",
      "#sbx-selbug .sr.lo .nm,#sbx-selbug .sr.lo b{color:#fbbf24}#sbx-selbug .sr.lo .bar i{background:#f59e0b}#sbx-selbug .sr.pl .bar i{background:#facc15}#sbx-selbug .tg{font-size:10.5px;opacity:.75;padding:0 0 2px 86px}#sbx-selbug .ft{margin-top:6px;font-size:10.5px;opacity:.5}",
      "#sbx-selbug .send{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;align-items:center}#sbx-selbug .send span{font-size:10.5px;opacity:.6;margin-right:2px}#sbx-selbug .send button{border:0;border-radius:999px;padding:3px 8px;background:#1e3a5f;color:#e0f2fe;font:700 11px system-ui,sans-serif;cursor:pointer}#sbx-selbug .send button:hover{background:#2563eb;color:#fff}",
      "#sbx-dock .bg-sel{margin-top:8px;background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.3);border-radius:10px;padding:7px 8px;font-size:11.5px}#sbx-dock .bg-sel.none{opacity:.6;background:none;border-style:dashed}",
      "#sbx-dock .bg-sel .hd{display:flex;gap:6px;align-items:baseline;font-weight:800;font-size:12.5px;margin-bottom:4px}#sbx-dock .bg-sel .hd i{font-style:normal;opacity:.55;font-size:10.5px}#sbx-dock .bg-sel .hd span{margin-left:auto;color:#fde68a}",
      "#sbx-dock .bg-sel .sr{display:grid;grid-template-columns:82px 1fr 24px 22px;gap:5px;align-items:center;padding:1px 0}#sbx-dock .bg-sel .sr .nm{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      "#sbx-dock .bg-sel .bar{height:6px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden}#sbx-dock .bg-sel .bar i{display:block;height:100%;background:#38bdf8;border-radius:999px}",
      "#sbx-dock .bg-sel .sr b{text-align:right}#sbx-dock .bg-sel .sr em{font-style:normal;color:#4ade80;font-weight:800;font-size:10.5px}#sbx-dock .bg-sel .sr.lo .nm,#sbx-dock .bg-sel .sr.lo b{color:#fbbf24}#sbx-dock .bg-sel .sr.lo .bar i{background:#f59e0b}",
      "#sbx-dock [data-atman]{cursor:pointer}#sbx-dock .dk-m:hover{background:#1a2c52}#sbx-dock .dk-sk tr[data-atman]:hover td{background:rgba(255,255,255,.05)}#sbx-dock .tapped{box-shadow:0 0 0 2px #facc15!important}",
      "#sbx-dock .dk-sk tr.sel td{background:rgba(56,189,248,.12)}#sbx-dock .dk-m.sel{box-shadow:0 0 0 2px #38bdf8}",
      "#sbx-dock .bg-drag{font-size:10px;opacity:.5;letter-spacing:.04em}",
      "#sbx-dock .dk-bug{border:0;background:#16a34a;color:#fff;border-radius:999px;padding:5px 12px;font-weight:800;cursor:pointer;box-shadow:0 0 0 2px rgba(74,222,128,.35)}#sbx-dock .dk-bug:hover{filter:brightness(1.1)}",
      "#sbx-dock.bug .dk-bug{display:none}",
    ].join("");
    document.head.appendChild(st);
  };
  // Same colors as the TP column on the club page: gold while it fills or drains, green when full.
  const tpBar = (tp) => '<div class="at-bar"><i style="width:' + Math.min(100, Math.max(0, tp)) + "%;background:" + (tp >= 99.5 ? "#16a34a" : "#ca8a04") + '"></i></div>';
  const fmtT = (t) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toLocaleDateString("en-CA"); };
  function atRedraw() { AT.sig = ""; AT.dsig = ""; setTimeout(mountAsst, 0); }

  // Flow: 📋 Training plan (club page header and club cards) → full-page planner → ⚾ Take it to the field →
  // the trainer, with the live board under the game and 📝 training notes on the side.
  const AT_SIDE = "sbx-at-side", AT_MODE = "sbx-at-mode";
  const atSide = () => { try { return Object.assign({ n: true }, JSON.parse(localStorage.getItem(AT_SIDE) || "{}")); } catch (_) { return { n: true }; } };
  const atSideSet = (o) => { try { localStorage.setItem(AT_SIDE, JSON.stringify(Object.assign(atSide(), o))); } catch (_) {} atRedraw(); };
  // Where the live board sits on the trainer: a small floating "bug" (default), the full board floating, or the
  // full board above or below the trainer. The bug and the floating board drag by their title bar.
  const AT_PLACE = "sbx-at-place", AT_POS = "sbx-at-pos", AT_VIEW = "sbx-at-view", AT_WEAK = "sbx-at-weak";
  const atView = () => { try { return localStorage.getItem(AT_VIEW) === "skills" ? "skills" : "session"; } catch (_) { return "session"; } };
  const AT_SORT = "sbx-at-sort";   // the board's order: "" = the club's own order, "tpd" = most TP left first, "tpa" = least first
  const atSort = () => { try { const v = localStorage.getItem(AT_SORT) || ""; return v === "tpd" || v === "tpa" ? v : ""; } catch (_) { return ""; } };
  const atWeakOpen = () => { try { return localStorage.getItem(AT_WEAK) !== "0"; } catch (_) { return true; } };
  // A man's skills that count for him: Pitching only for the man on the mound (everyone's would be "weakest" otherwise).
  const atSkillsFor = (p) => SKL.map(([k, f, nm], i) => ({ k, i, nm, v: Math.round(+p[f] || 0) })).filter((x) => x.k !== "P" || p.position === "P");
  function atSelName() {
    // The trainer's scoreboard: "<b class=sb-name>Thor <small>LF</small></b>" for the man you clicked.
    const pn = document.querySelector(".sb-practice b.sb-name, b.sb-name");
    if (pn) { const t = (pn.childNodes[0] && pn.childNodes[0].nodeType === 3 ? pn.childNodes[0].textContent : pn.textContent.replace((pn.querySelector("small") || {}).textContent || "", "")).trim(); if (t) return t; }
    const card = document.querySelector(".stage-wrap .sb .sb-card b, .sb .sb-card b, .sb-card b");
    const a = card && card.textContent.trim(); if (a) return a.replace(/^\s*#?\d+\s+/, "");
    const pc = document.getElementById("player");
    if (pc && (pc.classList.contains("on") || pc.offsetParent)) return ((document.getElementById("p-name") || {}).textContent || "").trim();
    return "";
  }
  const atShort = (n) => { const w = String(n || "").trim().split(/\s+/); return w.length > 1 ? w[0][0] + ". " + w.slice(1).join(" ") : w[0] || ""; };
  const atPlace = () => { try { const v = localStorage.getItem(AT_PLACE); return ["float", "below", "above"].includes(v) ? v : "below"; } catch (_) { return "below"; } };
  const atPlaceBtns = (pl, words) => '<span class="dk-pl" title="Where the Asst. Trainer sits">' + [["below", "⬇", "Below", "Under the trainer"], ["above", "⬆", "Above", "Above the trainer"], ["float", "🪟", "Float", "The whole board, floating beside the trainer"]]
    .map(([k, l, w, t]) => '<button type="button" data-atpl="' + k + '" class="' + (pl === k ? "on" : "") + '" title="' + t + '">' + l + (words ? " " + w : "") + "</button>").join("") + "</span>";
  function atDrag(el, posKey) {
    if (el.dataset.drag) return; el.dataset.drag = "1"; posKey = posKey || AT_POS;
    el.addEventListener("pointerdown", (e) => {
      if (!/fl|bug/.test(el.dataset.pl || "") || !e.target.closest(".dk-h,.bg-h") || e.target.closest("button,a")) return;
      const r = el.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
      const mv = (ev) => { el.style.left = Math.max(0, Math.min(innerWidth - 120, ev.clientX - dx)) + "px"; el.style.top = Math.max(0, Math.min(innerHeight - 50, ev.clientY - dy)) + "px"; el.style.right = "auto"; };
      const up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); try { localStorage.setItem(posKey, JSON.stringify({ x: parseInt(el.style.left), y: parseInt(el.style.top) })); } catch (_) {} };
      addEventListener("pointermove", mv); addEventListener("pointerup", up); e.preventDefault();
    });
  }
  const atMode = () => { try { return localStorage.getItem(AT_MODE) === "gains" ? "gains" : "plan"; } catch (_) { return "plan"; } };
  const atOpen = (team) => { AT.open = true; AT.team = Number(team) || tplanTeam() || AT.team; atRedraw(); };
  // 🧢 Lineup on the club cards: open that club's page and scroll to the lineup editor (the 🧩 Lineup Builder sits on top of it).
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("[data-lineup]"); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const team = b.dataset.lineup, want = "#/team/" + team;
    if (location.hash !== want) location.hash = want;
    let n = 0;
    const go = () => {
      const lu = document.getElementById("t-lineup"), onIt = location.hash === want;
      const tgt = onIt && (document.getElementById("sbx-build") || lu);
      if (tgt) {
        // The page keeps filling in for a moment after it opens, so aim again until the editor stays near the top.
        const aim = (k) => { const t = document.getElementById("sbx-build") || document.getElementById("t-lineup"); if (!t) return; const y = t.getBoundingClientRect().top; if (Math.abs(y - 70) > 40) window.scrollBy(0, y - 70); if (k < 6) setTimeout(() => aim(k + 1), 400); else { t.style.transition = "box-shadow .4s"; t.style.boxShadow = "0 0 0 3px #facc15"; setTimeout(() => { t.style.boxShadow = ""; }, 1600); } };
        aim(0); return;
      }
      if (++n < 40) setTimeout(go, 200);
    };
    setTimeout(go, 150);
  }, true);
  document.addEventListener("click", (e) => { const b = e.target.closest && e.target.closest("[data-atplan]"); if (b) { e.preventDefault(); atOpen(b.dataset.atplan); } }, true);
  // 🧩 Moving men around in the trainer changes the club's real lineup. When you open the trainer, the kit notes
  // the lineup and batting order you had (once, until you've dealt with it on the club page), so the 🧩 Lineup
  // Builder can put it back, or ⚡ optimize, when you're done.
  const PRETRAIN_KEY = "sbx-pretrain", PRETRAIN = {};
  function preTrainSnap(team) {
    if (PRETRAIN[team]) return; PRETRAIN[team] = 1;
    let all = {}; try { all = JSON.parse(localStorage.getItem(PRETRAIN_KEY) || "{}"); } catch (_) {}
    const have = all[team]; if (have && have.open && Date.now() - have.at < 24 * 3600e3) return;
    fetch("/teams/" + team + "/profile", { credentials: "include", cache: "no-store" }).then((r) => r.json()).then((prof) => {
      if (!prof || !prof.mine || !Array.isArray(prof.roster) || !Array.isArray(prof.field_pos)) return;
      const SP = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"], bySlot = new Map(prof.roster.map((p) => [Number(p.slot), p]));
      const field = {}; prof.field_pos.forEach((slot, k) => { const p = bySlot.get(Number(slot)); if (p && SP[k]) field[SP[k]] = String(p.player_id); });
      const order = (prof.batting_order || []).map((k) => { const p = bySlot.get(Number(prof.field_pos[k])); return p ? String(p.player_id) : null; }).filter(Boolean);
      const on = new Set(Object.values(field)), bench = prof.roster.filter((p) => !on.has(String(p.player_id))).sort((a, b) => Number(a.slot) - Number(b.slot)).map((p) => String(p.player_id));
      if (Object.keys(field).length < 9) return;
      let a2 = {}; try { a2 = JSON.parse(localStorage.getItem(PRETRAIN_KEY) || "{}"); } catch (_) {}
      a2[team] = { at: Date.now(), open: true, field, order, bench }; try { localStorage.setItem(PRETRAIN_KEY, JSON.stringify(a2)); } catch (_) {}
    }).catch(() => {});
  }
  // ✅ Finish training: a wrap-up of the session (what you spent, what grew, who's next), then your lineup.
  async function atWrapUp(team) {
    const ov = sbxModal("✅ Training wrap-up", '<div class="muted">Reading your club…</div>', true);
    let d; try { d = await profileOf(team, 0); } catch (_) { d = PROF[team] && PROF[team].data; }
    const S = AT.sess; if (!d || !S || S.team !== team) { ov.querySelector(".box").innerHTML += '<div class="msg">Couldn\'t read this session. Close and try again.</div>'; return; }
    const plan = tplanAll()[team] || {}, roster = d.roster || [];
    let spent = 0, gained = 0, onP = 0, offP = 0, best = null;
    const men = roster.map((p) => {
      const b = S.base[p.player_id] || { tp: +p.tp || 0, s: SKL.map(() => 0) };
      const g = SKL.map(([, k], i) => Math.max(0, Math.round(+p[k] || 0) - b.s[i])), sum = g.reduce((x, y) => x + y, 0);
      const sp = Math.max(0, Math.round(b.tp - (+p.tp || 0))), f = (plan[p.player_id] || {}).focus || [];
      g.forEach((x, i) => { if (f.includes(SKL[i][0])) onP += x; else if (f.length) offP += x; if (x && (!best || x > best.x)) best = { x, who: p.name, sk: SKL[i][2] }; });
      spent += sp; gained += sum;
      return { p, g, sum, sp, left: Math.round(+p.tp || 0) };
    });
    const mins = Math.max(1, Math.round((Date.now() - S.at) / 60000));
    const worked = men.filter((m) => m.sum || m.sp).sort((a, b) => b.sum - a.sum || b.sp - a.sp);
    const next = men.filter((m) => m.left >= 10).sort((a, b) => b.left - a.left).slice(0, 4);
    const row = (m) => '<div class="row"><b>' + esc(m.p.name) + '</b><span style="flex:1">' + (m.sum ? SKL.map(([, , nm], i) => (m.g[i] ? nm + " <b>+" + m.g[i] + "</b>" : "")).filter(Boolean).join(" · ") : '<span class="muted">no gains yet</span>') + '</span><span class="muted" style="white-space:nowrap">' + m.sp + " TP spent · " + m.left + " left</span></div>";
    const stat = (n, l) => '<div style="flex:1;min-width:110px;background:rgba(255,255,255,.07);border-radius:12px;padding:10px 12px;text-align:center"><div style="font:900 24px/1 system-ui,sans-serif;color:#fde68a">' + n + '</div><div class="muted" style="margin-top:4px">' + l + "</div></div>";
    // How the lineup stands next to the one from when you opened the trainer.
    let pre = null; try { pre = (JSON.parse(localStorage.getItem(PRETRAIN_KEY) || "{}") || {})[team] || null; } catch (_) {}
    if (pre && (!pre.open || Date.now() - pre.at > 24 * 3600e3)) pre = null;
    let moved = 0;
    if (pre && Array.isArray(d.field_pos)) {
      const SP = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"], bySlot = new Map(roster.map((p) => [Number(p.slot), p]));
      d.field_pos.forEach((slot, k) => { const p = bySlot.get(Number(slot)); if (p && pre.field[SP[k]] && pre.field[SP[k]] !== String(p.player_id)) moved++; });
    }
    const go = (mode) => { try { sessionStorage.setItem("sbx-lu-fix", JSON.stringify({ team: String(team), restore: mode === "restore", mode, at: Date.now() })); } catch (_) {} location.href = "/#/team/" + team; };
    const report = "📋 Training wrap-up · " + (d.name || "") + "\n" + mins + " min · " + spent + " TP spent · +" + gained + " skill" + (best ? "\n⭐ Best jump: " + best.who + " " + best.sk + " +" + best.x : "") + "\n" +
      worked.slice(0, 6).map((m) => "• " + m.p.name + ": " + SKL.map(([, , nm], i) => (m.g[i] ? nm + " +" + m.g[i] : "")).filter(Boolean).join(", ")).filter((x) => !/: $/.test(x)).join("\n");
    const html =
      '<div class="muted" style="margin:-4px 0 10px">Step 1 of 2 · ' + esc(d.name || "") + "</div>" +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' + stat(spent, "TP spent") + stat("+" + gained, "skill gained") + stat(spent ? (gained / spent * 10).toFixed(1) : "–", "skill per 10 TP") + stat(mins + "m", "in the trainer") + "</div>" +
      (best ? '<div style="margin-top:10px">⭐ <b>Best jump:</b> ' + esc(best.who) + " · " + best.sk + " <b>+" + best.x + "</b></div>" : "") +
      (onP + offP ? '<div class="muted" style="margin-top:4px">🎯 On plan +' + onP + " · off plan +" + offP + "</div>" : "") +
      '<h4 style="margin:14px 0 4px">Who grew</h4>' + (worked.length ? worked.map(row).join("") : '<div class="muted">Nobody trained this session.</div>') +
      (next.length ? '<h4 style="margin:14px 0 4px">Next time</h4><div class="muted">Most TP still to spend: ' + next.map((m) => esc(m.p.name) + " (" + m.left + ")").join(", ") + "</div>" : "") +
      '<div class="acts"><button class="b" type="button" data-wcopy>📋 Copy report</button><button class="b go" type="button" data-wnext>Next: my lineup →</button></div><div class="msg"></div>';
    const box = ov.querySelector(".box"); box.innerHTML = '<button class="x" type="button" title="Close">✕</button><h3>✅ Training wrap-up</h3>' + html;
    box.querySelector("[data-wcopy]").onclick = () => { try { navigator.clipboard.writeText(report); box.querySelector(".msg").textContent = "Copied. Paste it anywhere."; } catch (_) {} };
    box.querySelector("[data-wnext]").onclick = () => {
      box.innerHTML = '<button class="x" type="button" title="Close">✕</button><h3>🧩 Your lineup</h3><div class="muted" style="margin:-4px 0 10px">Step 2 of 2</div>' +
        (pre ? (moved ? "<p>Training moved <b>" + moved + "</b> of your starters off the spots they had when you opened the trainer.</p>" : "<p>Your starters are where they were when you opened the trainer" + (Array.isArray(d.field_pos) ? "" : " (as far as the kit can tell)") + ".</p>")
          : "<p>The kit didn't note a lineup when you opened the trainer, so there's nothing to put back. You can still optimize or edit it.</p>") +
        '<div style="display:grid;gap:8px">' +
        (pre ? '<button class="b go" type="button" data-wl="restore" style="padding:12px">↩️ Put back my lineup from before training <span style="font-weight:500">(and save it)</span></button>' : "") +
        '<button class="b" type="button" data-wl="opt" style="padding:12px">⚡ Optimize my lineup <span style="font-weight:500;opacity:.8">(you check it, then Save)</span></button>' +
        '<button class="b" type="button" data-wl="edit" style="padding:12px">🧩 Edit it myself in the Lineup Builder</button>' +
        '<button class="b" type="button" data-wl="keep" style="padding:12px">👍 Keep it as it is</button></div>';
      box.querySelectorAll("[data-wl]").forEach((b) => (b.onclick = () => {
        const m = b.dataset.wl;
        if (m === "keep") { try { const all = JSON.parse(localStorage.getItem(PRETRAIN_KEY) || "{}"); if (all[team]) { all[team].open = false; localStorage.setItem(PRETRAIN_KEY, JSON.stringify(all)); } } catch (_) {} ov.remove(); return; }
        go(m);
      }));
    };
  }
  // ✅ The easy button: a big floating "Finish training" chip on the trainer, always in reach. It shows what the
  // session has done so far and opens the wrap-up (report, then lineup).
  function mountFinishChip(team) {
    let b = document.getElementById("sbx-finish");
    if (!on("tplan")) { b?.remove(); return; }
    if (!b) {
      b = document.createElement("button"); b.id = "sbx-finish"; b.type = "button";
      b.style.cssText = "position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147482995;border:2px solid #bbf7d0;border-radius:999px;padding:12px 24px;background:linear-gradient(180deg,#22c55e,#15803d);color:#fff;font:900 17px/1 system-ui,sans-serif;letter-spacing:.3px;cursor:pointer;box-shadow:0 8px 26px rgba(0,0,0,.45),0 0 0 4px rgba(34,197,94,.25);display:flex;align-items:center;gap:10px;white-space:nowrap";
      b.title = "Alright, time to finish: see what this session did, then sort out your lineup";
      b.onmouseenter = () => (b.style.filter = "brightness(1.1)"); b.onmouseleave = () => (b.style.filter = "");
      document.body.appendChild(b);
    }
    b.onclick = () => atWrapUp(team);
    let txt = "";
    try {
      const S = AT.sess, c = PROF[team];
      if (S && S.team === team && c) {
        let sp = 0, g = 0;
        (c.data.roster || []).forEach((p) => { const x = S.base[p.player_id]; if (!x) return; sp += Math.max(0, Math.round(x.tp - (+p.tp || 0))); SKL.forEach(([, k], i) => { g += Math.max(0, Math.round(+p[k] || 0) - x.s[i]); }); });
        if (sp || g) txt = '<span style="font:700 13px/1 system-ui,sans-serif;background:rgba(0,0,0,.22);border-radius:999px;padding:5px 9px">' + sp + " TP · +" + g + " skill</span>";
      }
    } catch (_) {}
    const html = "✅ Finish training" + txt;
    if (b.dataset.h !== html) { b.innerHTML = html; b.dataset.h = html; }
  }
  function mountAsst() {
    atStyle();
    const onTrainer = isTrainer(), team = tplanTeam();
    document.getElementById("sbx-tplan-btn")?.remove();   // the old floating button
    if (onTrainer && team) { AT.open = false; document.getElementById("sbx-at")?.remove(); if (on("builder")) preTrainSnap(team); mountDock(team); mountFinishChip(team); mountTrainNotes(team); return; }
    document.getElementById("sbx-dock")?.remove(); document.getElementById("sbx-finish")?.remove(); document.getElementById("sbx-atnotes")?.remove(); document.getElementById("sbx-selbug")?.remove(); AT.sess = null;
    // 📋 Training plan in your club page's header, beside the site's Training button
    const hb = document.querySelector("main .th-btns");
    if (hb && team && !hb.querySelector("[data-atplan]")) {
      const a = document.createElement("a"); a.href = "#"; a.className = "btn"; a.dataset.atplan = String(team); a.textContent = "📋 Training plan";
      a.style.cssText = "background:#7c3aed;color:#fff"; a.title = "Plan this club's training (Asst. Trainer Kit)";
      hb.insertBefore(a, hb.firstChild);
    }
    if (AT.open) mountPlanner(); else document.getElementById("sbx-at")?.remove();
  }
  function atSideW() { const cv = document.querySelector("canvas#stage") || document.querySelector("canvas"); const r = cv ? cv.getBoundingClientRect() : null; const gap = r ? r.left : 300; return Math.max(200, Math.min(320, Math.round(gap - 16))); }
  // 📝 Training notes beside the trainer: a running note for the club, plus each man's plan note.
  function mountTrainNotes(team) {
    let el = document.getElementById("sbx-atnotes");
    const sd = atSide();
    if (!el) { el = document.createElement("div"); el.id = "sbx-atnotes"; el.className = "at-side l"; document.body.appendChild(el); }
    el.style.width = sd.n ? atSideW() + "px" : "";
    el.classList.toggle("min", !sd.n);
    if (!sd.n) { if (el.dataset.sig !== "min") { el.dataset.sig = "min"; el.innerHTML = '<button type="button" class="at-tab" title="Show your training notes">📝<br>N<br>o<br>t<br>e<br>s</button>'; el.querySelector(".at-tab").onclick = () => atSideSet({ n: true }); } return; }
    if (el.contains(document.activeElement) && /input|textarea/i.test(document.activeElement.tagName)) return;
    const c = PROF[team], plan = tplanAll()[team] || {}, sig = JSON.stringify([team, c ? c.at : 0, plan]);
    if (el.dataset.sig === sig) return;
    el.dataset.sig = sig;
    const roster = c && c.data ? (c.data.roster || []).slice().sort((a, b) => (b.position ? 1 : 0) - (a.position ? 1 : 0) || (+a.bats || 99) - (+b.bats || 99)) : [];
    const men = roster.map((p) => { const P = plan[p.player_id] || {}, f = (P.focus || []).map((k) => SKL.find((x) => x[0] === k)[2]); return '<div class="nt-m"><b>' + esc(p.name) + "</b>" + (f.length ? ' <span class="at-sub">🎯 ' + f.join(", ") + "</span>" : "") +
      '<input type="text" data-pn="' + p.player_id + '" value="' + esc(P.note || "") + '" maxlength="120" placeholder="Note for him"></div>'; }).join("");
    el.innerHTML = '<div class="sd-h"><b>📝 Training notes</b><span class="at-sub"></span><button type="button" data-fold title="Fold">‹</button></div><div class="sd-b">' +
      '<textarea data-club-note rows="4" placeholder="Notes for this club: what you are working on, what to try next time…">' + esc((plan._club || {}).note || "") + "</textarea>" + men + "</div>";
    el.querySelector("[data-fold]").onclick = () => atSideSet({ n: false });
    const upd = (pid, fn) => { const all = tplanAll(), t = all[team] || {}, x = t[pid] || {}; fn(x); t[pid] = x; tplanSave(team, t); };
    el.querySelector("[data-club-note]").onchange = (e) => upd("_club", (x) => { x.note = e.target.value.trim(); });
    el.querySelectorAll("[data-pn]").forEach((i) => (i.onchange = () => upd(i.dataset.pn, (x) => { x.note = i.value.trim(); })));
  }

  // ── Full-page planner ──
  // The planner cards (full page, and the slim column beside the trainer)
  function atCards(team, prof) {
    const roster = (prof.roster || []).slice().sort((a, b) => (b.position ? 1 : 0) - (a.position ? 1 : 0) || (+a.bats || 99) - (+b.bats || 99));
    const plan = tplanAll()[team] || {}, hot = (HOT[team] || {}).map || {}, today = todayKey(), wk = daysAgo(6);
    if (!HOT[team] || (!HOT[team].busy && Date.now() - HOT[team].at > 10 * 60000)) loadHot(team);
    let tpSum = 0, ready = 0, done = 0, wkGain = 0, wkTp = 0;
    const cards = roster.map((p) => {
      const P = plan[p.player_id] || {}, f = P.focus || [], bud = P.budget || {}, tp = Math.round(+p.tp || 0), h = hot[p.player_id];
      const tot = ttrkSum(team, p.player_id, P.since || ""), td = ttrkSum(team, p.player_id, today), w = ttrkSum(team, p.player_id, wk), ns = nextStar(p, roster);
      tpSum += tp; if (tp >= 95) ready++; if (P.done === today || td.tp >= 5) done++; wkGain += w.g.reduce((a, b) => a + b, 0); wkTp += w.tp;
      const rows = SKL.map(([k, f2, nm], i) => {
        const v = Math.round(+p[f2] || 0), on = f.includes(k), B = +bud[k] || 0, used = tot.a[i];
        return '<div class="at-sk' + (on ? " f" : "") + '" data-sk="' + k + '" title="' + (on ? "In his plan. Click to take it out." : "Click to add " + nm + " to his plan") + '"><span>' + (on ? "🎯 " : "") + nm + "</span>" +
          '<div class="at-bar"><i style="width:' + Math.min(100, v) + "%;background:" + (on ? "#facc15" : "rgba(255,255,255,.35)") + '"></i></div><span class="v">' + v + '</span><span class="g">' + (w.g[i] ? "+" + w.g[i] : "") + "</span></div>" +
          (on ? '<div class="at-tg"><span>Spend</span><input type="number" min="0" max="999" step="5" data-bud="' + k + '" value="' + (B || "") + '" placeholder="TP"><span>TP</span>' +
            (B ? '<div class="at-bar" style="flex:1"><i style="width:' + Math.min(100, Math.round((100 * used) / B)) + "%;background:" + (used >= B ? "#16a34a" : "#facc15") + '"></i></div><b style="' + (used >= B ? "color:#4ade80" : "") + '">' + used + "/" + B + (used >= B ? " ✓" : "") + "</b>" : used ? '<span style="opacity:.7">' + used + " TP so far</span>" : "") + "</div>" : "");
      }).join("");
      const todayLine = td.tp || td.g.some(Boolean) ? '<div class="at-today">Today: ' + (td.tp ? "<b>−" + td.tp + " TP</b>" : "") + (td.g.some(Boolean) ? (td.tp ? " · " : "") + SKL.map((x, i) => (td.g[i] ? x[2] + ' <b style="color:#4ade80">+' + td.g[i] + "</b>" : "")).filter(Boolean).join(", ") : "") + "</div>" : "";
      return '<div class="at-card' + (P.done === today || td.tp >= 5 ? " done" : "") + '" data-pid="' + p.player_id + '">' +
        '<div style="display:flex;align-items:baseline;gap:8px"><span class="at-nm">' + (h ? '<span title="' + esc(h.tip) + '">' + (h.tag === "hot" ? "🔥" : "🧊") + "</span> " : "") + esc(p.name) + '</span><span class="at-sub">' + esc(p.position || "bench") + " · " + (+p.overall || 0) + "★</span>" +
        (ns ? '<span class="at-sub" style="margin-left:auto" title="Compared with the teammates already at ' + ns.star + '★: about this many skill points short. A rough guide, not the site\'s formula.">≈' + ns.gap + " to " + ns.star + "★</span>" : "") + "</div>" +
        '<div style="display:flex;align-items:center;gap:8px;margin:8px 0 6px"><div style="flex:1">' + tpBar(tp) + '</div><b style="font-size:12px;white-space:nowrap;' + (tp >= 95 ? "color:#4ade80" : "") + '">' + tp + " TP" + (tp >= 95 ? " ⚡" : "") + "</b></div>" + rows +
        (tot.u ? '<div class="at-sub" style="margin:2px 6px" title="TP spent in a drill that has not paid off yet. It moves to a skill the next time one of his skills goes up.">+ ' + tot.u + " TP in a drill, waiting on a gain</div>" : "") + todayLine +
        '<input class="at-note" type="text" data-note value="' + esc(P.note || "") + '" maxlength="120" placeholder="Note: e.g. Bat Power to 90, then Bat Contact">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:12px"><label style="display:flex;align-items:center;gap:5px;cursor:pointer"><input type="checkbox" data-done ' + (P.done === today || td.tp >= 5 ? "checked" : "") + (td.tp >= 5 && P.done !== today ? ' disabled title="The kit saw TP spent today"' : "") + "> Trained today</label>" +
        (f.length ? '<span class="at-sub" style="margin-left:auto">Counting since ' + esc(P.since || "today") + ' <button type="button" data-reset style="border:0;background:rgba(255,255,255,.12);color:inherit;border-radius:6px;padding:1px 7px;cursor:pointer;font-size:11.5px" title="Start counting TP from today">↺</button></span>' : "") + "</div></div>";
    }).join("");
    const sum = '<div class="at-sum"><span>Team TP <b>' + tpSum + "</b></span><span>⚡ Full <b>" + ready + "</b></span><span>✓ Trained today <b>" + done + " of " + roster.length + "</b></span><span>Last 7 days <b>+" + wkGain + "</b> skill points for <b>" + wkTp + " TP</b></span></div>";
    return { cards, sum };
  }
  function mountPlanner() {
    const mine = [...ownIds()].map(Number);
    if (!AT.team || !mine.includes(AT.team)) AT.team = tplanTeam() || mine[0] || 0;
    const team = AT.team; if (!team) return;
    const c = PROF[team];
    if (!c || Date.now() - c.at > 120000) { if (!AT.loading) { AT.loading = true; profileOf(team, 120000).catch(() => {}).finally(() => { AT.loading = false; atRedraw(); }); } }
    let el = document.getElementById("sbx-at");
    if (!el) { el = document.createElement("div"); el.id = "sbx-at"; document.body.appendChild(el); if (!AT.keyed) AT.keyed = 1, document.addEventListener("keydown", (e) => { if (e.key === "Escape" && AT.open && !/input|textarea/i.test((e.target || {}).tagName || "")) { AT.open = false; atRedraw(); } }); }
    const T = ttrkAll()[team];
    const sig = JSON.stringify([team, c ? c.at : 0, T && T.snap ? T.snap.at : 0, tplanAll()[team] || {}, todayKey(), mine]);
    if (el.dataset.sig === sig) return;
    el.dataset.sig = sig;
    const clubs = '<div class="at-clubs">' + mine.map((id) => '<button type="button" data-club="' + id + '" class="' + (id === team ? "on" : "") + '">' + esc(nameOfClub(id)) + "</button>").join("") + "</div>";
    const head = '<div class="at-top"><h2>📋 Asst. Trainer Kit</h2><span class="at-sub">Plan what each man works on and how much TP to spend. Open the trainer and the live board under the game tracks it as you go.</span><a class="at-x" href="/training?team=' + team + '" style="background:#2563eb;color:#fff;text-decoration:none" title="Open the trainer for this club, with the live board under the game">⚾ Take it to the field</a><button type="button" class="at-x" style="margin-left:0" data-close>✕ Close</button></div>' + clubs;
    if (!c || !c.data) { el.innerHTML = head + '<div class="at-help">Reading the club…</div>'; atWire(el); return; }
    const { cards, sum } = atCards(team, c.data);
    const sc = el.scrollTop;
    el.innerHTML = head + sum + '<div class="at-grid">' + cards + "</div>" +
      '<div class="at-help">🎯 Click a skill to put it in his plan, then set how much TP to spend on it. Green numbers are what he gained in the last 7 days. The kit tracks TP and gains each time it reads your club, and live on the trainer. It never trains for you.</div>';
    el.scrollTop = sc;
    atWire(el, team);
  }
  function atWire(el, team, onClose) {
    const cx = el.querySelector("[data-close]"); if (cx) cx.onclick = onClose || (() => { AT.open = false; atRedraw(); });
    el.querySelectorAll("[data-club]").forEach((b) => (b.onclick = () => { AT.team = Number(b.dataset.club); el.dataset.sig = ""; atRedraw(); }));
    if (!team) return;
    const upd = (pid, fn) => { const all = tplanAll(), t = all[team] || {}, x = t[pid] || {}; fn(x); t[pid] = x; tplanSave(team, t); };
    el.querySelectorAll(".at-card").forEach((card) => {
      const pid = card.dataset.pid;
      card.querySelectorAll(".at-sk").forEach((r) => (r.onclick = () => { upd(pid, (x) => { const f = new Set(x.focus || []); f.has(r.dataset.sk) ? f.delete(r.dataset.sk) : f.add(r.dataset.sk); x.focus = SKL.map(([k]) => k).filter((k) => f.has(k)); if (x.focus.length && !x.since) x.since = todayKey(); }); atRedraw(); }));
      card.querySelectorAll("[data-bud]").forEach((i) => { i.onclick = (e) => e.stopPropagation(); i.onchange = () => { upd(pid, (x) => { const B = x.budget || {}; const v = Math.round(+i.value || 0); if (v > 0) B[i.dataset.bud] = v; else delete B[i.dataset.bud]; x.budget = B; if (!x.since) x.since = todayKey(); }); atRedraw(); }; });
      const n = card.querySelector("[data-note]"); n.onchange = () => upd(pid, (x) => { x.note = n.value.trim(); });
      const d = card.querySelector("[data-done]"); d.onchange = () => { upd(pid, (x) => { x.done = d.checked ? todayKey() : ""; }); atRedraw(); };
      const rs = card.querySelector("[data-reset]"); if (rs) rs.onclick = () => { upd(pid, (x) => { x.since = todayKey(); }); atRedraw(); };
    });
  }

  // ── Live board under the trainer ──
  // ───────── 📡 SmallCast: a game cast under the player when you watch a game ─────────
  // Everything it shows is read off the player as it plays (the scoreboard and the play-by-play), so it
  // never runs ahead of the picture: no spoilers. "Coming in" uses only games played before this one.
  const onWatch = () => location.pathname === "/training" && /[?&](watch|game)=\d+/.test(location.search);
  const CAST_FOLD = "sbx-cast-fold", CAST_TAB = "sbx-cast-tab", CAST_PLACE = "sbx-cast-place", CAST_POS = "sbx-cast-pos";
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
    if (!on("cast") || !onWatch()) { if (CAST) { document.getElementById("sbx-cast")?.remove(); document.getElementById("sbx-kk")?.remove(); CAST = null; } return; }
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
    // Home pitchers' Ks hang on the row next to the board (white cards, red K); with "both teams" on, the visitors'
    // pitchers get a second row (navy cards, gold K). Cards are grouped by inning with the inning number between
    // groups, and an inning struck out on three Ks gets one gold "side retired" card, so three plain K cards never
    // hang side by side.
    let el = document.getElementById("sbx-kk");
    const C = CAST;
    const ksFor = (half) => (C && on("kcards") && B ? C.ev.filter((e) => e.h[0] === half && e.p.k === "k") : []);
    const home = ksFor("T"), away = on("kboth") ? ksFor("B") : [];
    if (!home.length && !away.length) { el?.remove(); return; }
    if (!el) { el = document.createElement("div"); el.id = "sbx-kk"; }
    if (el.parentNode !== sw) sw.appendChild(el);
    const sz = Math.max(12, Math.min(22, Math.round(B.h / 6)));
    const groups = (ks) => { const g = []; for (const e of ks) { const n = +e.h.slice(1); const last = g[g.length - 1]; if (last && last.inn === n) last.ks.push(e); else g.push({ inn: n, ks: [e] }); } return g; };
    const rowHtml = (ks, cls, who) => {
      let g = groups(ks), cards = 0, cut = 0;
      for (let k = g.length - 1; k >= 0; k--) { cards += g[k].ks.length >= 3 ? 1 : g[k].ks.length; if (cards > 12) { cut = k + 1; break; } }
      const hidden = g.slice(0, cut).reduce((x, y) => x + y.ks.length, 0); g = g.slice(cut);
      const lastLive = ks.length && ks[ks.length - 1].live ? ks[ks.length - 1] : null;
      return `<div class="kr ${cls}" title="${ks.length} strikeout${ks.length === 1 ? "" : "s"} by ${esc(who)} pitchers">` + (hidden ? `<b>+${hidden}</b>` : "") +
        g.map((G, gi) => `<u>${G.inn}</u>` + (G.ks.length >= 3 ? `<i class="sr${G.ks.includes(lastLive) ? " new" : ""}" style="--r:${(gi * 37) % 7 - 3}deg" title="Struck out the side in the ${G.inn}">🔥${G.ks.length}</i>`
          : G.ks.map((e, i) => `<i class="${e.p.look ? "lk" : ""}${e === lastLive ? " new" : ""}" style="--r:${((gi * 3 + i) * 37) % 7 - 3}deg">K</i>`).join(""))).join("") + "</div>";
    };
    const M = C.meta || {}, A = M.away || "the visiting", H = M.home || "the home";
    const html = (home.length ? rowHtml(home, "kh", H) : "") + (away.length ? rowHtml(away, "ka", A) : "");
    const rows = (home.length ? 1 : 0) + (away.length ? 1 : 0), tall = rows * (sz * 1.45 + 6);
    const top = place === "board" ? B.y - tall - 6 : B.y + B.h + 6;
    const st = `left:${Math.round(Math.max(4, B.x))}px;width:${Math.round(B.w)}px;top:${Math.round(Math.max(2, top))}px;--k:${sz}px`;
    if (el.dataset.st !== st) { el.dataset.st = st; el.style.cssText = st; }
    if (el.dataset.sig === html) return; el.dataset.sig = html;
    el.innerHTML = html;
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
.sc-logo{display:inline-flex;align-items:center;gap:3px;font:900 15px/1 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.06em;vertical-align:middle}
.sc-logo svg{width:1.45em;height:1.45em;margin-right:2px;filter:drop-shadow(0 0 4px rgba(255,194,61,.45))}
.sc-logo b{color:#fff;font-weight:900}.sc-logo i{font-style:normal;color:#ffc23d;font-weight:900}
.sc-logo.sm{font-size:11px}.sc-logo.big{font-size:clamp(11px,13cqw,28px);text-shadow:0 0 12px rgba(255,194,61,.35)}
#sbx-cast.jumbo .jt-l{container-type:inline-size}
#sbx-cast.jumbo .jt-brand{max-width:100%;display:flex;flex-direction:column;align-items:center;gap:4px;animation:jtIn .5s ease-out}
#sbx-cast.jumbo .jt-tag{font:800 clamp(7px,6cqw,9px) system-ui,sans-serif;letter-spacing:.16em;color:#94a3b8;text-align:center}
#sbx-cast.jumbo .jt-top .sc-logo{margin-right:4px}
@keyframes jtIn{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}}
#sbx-kk{position:absolute;z-index:6;display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:auto}
#sbx-kk .kr{display:flex;align-items:center;gap:4px}
#sbx-kk u{text-decoration:none;font:800 9px system-ui,sans-serif;color:rgba(255,255,255,.8);text-shadow:0 1px 2px #000;margin:0 1px 0 6px}
#sbx-kk .kr>u:first-child,#sbx-kk b+u{margin-left:0}
#sbx-kk .ka i{background:#1e3a8a;color:#fbbf24}
#sbx-kk i.sr{width:calc(var(--k)*1.8);background:linear-gradient(#fde68a,#f59e0b);color:#7c2d12;font:900 calc(var(--k)*.62)/1 system-ui,sans-serif}
#sbx-kk .ka i.sr{background:linear-gradient(#fbbf24,#b45309);color:#1e3a8a}
#sbx-kk i{display:inline-flex;align-items:center;justify-content:center;width:var(--k);height:calc(var(--k)*1.45);background:#fff;color:#c1121f;font:900 calc(var(--k)*1.05)/1 Georgia,"Times New Roman",serif;font-style:normal;border-radius:2px;box-shadow:0 2px 4px rgba(0,0,0,.45);transform:rotate(var(--r));transform-origin:top center}
#sbx-kk i.lk{transform:rotate(var(--r)) scaleX(-1)}
#sbx-kk i.new{animation:kkHang .9s cubic-bezier(.3,1.6,.5,1)}
#sbx-kk i.lk.new{animation:kkHangL .9s cubic-bezier(.3,1.6,.5,1)}
#sbx-kk b{align-self:center;color:#fff;font:800 12px system-ui,sans-serif;text-shadow:0 1px 3px #000}
@keyframes kkHang{from{transform:translateY(-140%) rotate(-20deg);opacity:0}to{transform:rotate(var(--r));opacity:1}}
@keyframes kkHangL{from{transform:translateY(-140%) rotate(-20deg) scaleX(-1);opacity:0}to{transform:rotate(var(--r)) scaleX(-1);opacity:1}}
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
#sbx-cast.jumbo>div:empty{pointer-events:none}
#sbx-cast.jumbo.jt-one .jt-l{margin-right:4px}
#sbx-cast.jumbo .jt-wing.jt-l{padding-top:calc(5px + var(--pl,0px))}
#sbx-cast.jumbo .jt-wing.jt-r{padding-top:calc(5px + var(--pr,0px))}
#sbx-cast.jumbo .jt-wing{pointer-events:auto;overflow:hidden;background:linear-gradient(rgba(16,22,31,.78),rgba(7,10,16,.78));box-shadow:0 0 0 2px rgba(43,51,64,.9),0 4px 10px rgba(0,0,0,.4);padding:5px 9px}
#sbx-cast.jumbo .jt-l{border-radius:5px 0 0 5px;display:flex;align-items:center;justify-content:center;text-align:center}
#sbx-cast.jumbo .jt-r{border-radius:0 5px 5px 0}
#sbx-cast.jumbo .jt-lbl{color:#ffc23d;font:900 10px system-ui,sans-serif;letter-spacing:.12em}
#sbx-cast.jumbo .jt-bat{min-width:0;max-width:100%}
#sbx-cast.jumbo .jt-bat b{display:block;font-size:13px;margin:2px 0;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
#sbx-cast.jumbo .jt-k{opacity:.7;font-size:10px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical}
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
      (document.getElementById("tk-launch") ? '<button type="button" data-cbc title="Open Multiview">📺 Multiview</button>' : "") +
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
  setInterval(() => { try { castTick(); } catch (_) {} }, 1000);

  // 🎯 The player bug: click a man in the trainer and a small floating card shows his skills, this session's gains
  // and his plan, whatever the big board is doing. It stays on him until you click someone else; ✕ hides it until then.
  const AT_SELPOS = "sbx-at-selpos";
  // Click a man on the board and the kit taps him in the trainer for you: it runs the mouse over the field
  // (no clicks) until SmallBall's own hover label shows his name, then taps him once, just like your own click.
  // Run SmallBall's own hover label over part of the field (no clicks) and map every man it names to the box he covers.
  function atScan(area, step) {
    const cv = document.getElementById("stage"), hv = document.getElementById("hovername"); if (!cv || !hv) return {};
    const key = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
    const r = cv.getBoundingClientRect(), a = area || { l: r.left, t: r.top, r: r.right, b: r.bottom }, st = step || 6, out = {};
    const fire = (type, x, y) => cv.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: "mouse", isPrimary: true }));
    for (let y = Math.max(r.top + 1, a.t); y < Math.min(r.bottom, a.b); y += st)
      for (let x = Math.max(r.left + 1, a.l); x < Math.min(r.right, a.r); x += st) {
        fire("pointermove", x, y);
        if (hv.hidden) continue;
        const nm = (hv.childNodes[0] ? hv.childNodes[0].textContent : hv.textContent).trim(), k = key(nm); if (!k) continue;
        const b = out[k] || (out[k] = { name: nm, l: x, r: x, t: y, b: y }); b.l = Math.min(b.l, x); b.r = Math.max(b.r, x); b.t = Math.min(b.t, y); b.b = Math.max(b.b, y);
      }
    cv.dispatchEvent(new PointerEvent("pointerleave", { bubbles: false }));
    return out;
  }
  const atKey = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  function atFindMan(name) {
    const boxes = atScan(null, 6), want = atKey(name);
    const k = Object.keys(boxes).find((x) => x === want) || Object.keys(boxes).find((x) => x.startsWith(want) || want.startsWith(x));
    const b = k && boxes[k]; if (!b) return null;
    return { x: (b.l + b.r) / 2, y: (b.t + b.b) / 2, feet: { x: (b.l + b.r) / 2, y: b.b }, box: b };   // grab him by the middle; his feet are where he stands
  }
  // 📍 Send a man to a spot. SmallBall snaps a dropped man to the nearest spot, measured from where each spot's man
  // actually stands, so the kit aims for the feet of whoever is standing there now (SmallBall's spots move a bit from
  // park to park); with nobody there it aims for the spot itself, turned into a screen point by SmallBall's own view.
  // The batter's box can't be dropped on (the plate area counts as the catcher's spot): a man reaches it from the
  // on-deck circle, so 🏏 sends him on deck (he bats after 10 pitches or a homer, right away if nobody's batting).
  const AT_SPOTS = { BOX: [-46, 14, "🏏 To bat (on deck)"], DECK: [-46, 14, "On deck"], P: [0, 63.6396, "⚾ Mound"], C: [0, -12, "C"], "1B": [75, 105, "1B"], "2B": [35, 160, "2B"], SS: [-35, 160, "SS"], "3B": [-75, 105, "3B"], LF: [-150, 260, "LF"], CF: [0, 300, "CF"], RF: [150, 260, "RF"], REST: [160, 60, "😴 Rest area"] };   // REST: inside SmallBall's rest area (foul ground past 1B), where a dropped man sits out
  function atProject(pts) {
    return new Promise((res) => {
      try { const v = window.smallballView; if (v && v.project) return res(pts.map((p) => { const q = v.project(p[0], p[1], 0); return [q.x, q.y]; })); } catch (_) {}
      const id = "p" + Date.now() + Math.random(), done = (e) => { if (e.data && e.data.sbxAtR === id) { removeEventListener("message", done); res(e.data.out); } };
      addEventListener("message", done); window.postMessage({ sbxAt: "project", id, pts }, "*");
      setTimeout(() => { removeEventListener("message", done); res(null); }, 1500);
    });
  }
  // Ask the kit's helper inside the trainer page (trainer-bridge.js). null = no helper answered (old kit, or not the trainer).
  function atAsk(msg, ms) {
    return new Promise((res) => {
      const id = "a" + Date.now() + Math.random(), done = (e) => { if (e.data && e.data.sbxAtR === id) { removeEventListener("message", done); clearTimeout(tm); res(e.data.out); } };
      addEventListener("message", done); window.postMessage(Object.assign({ id }, msg), "*");
      const tm = setTimeout(() => { removeEventListener("message", done); res(null); }, ms || 1200);
    });
  }
  const atSpotWord = (spot, out) => out && out.sat ? "the rest area" : out && out.spot === "BOX" ? "the batter's box" : out && out.spot === "DECK" ? "on deck" : (AT_SPOTS[spot] ? AT_SPOTS[spot][2].replace(/^\S+ /, "") : spot);
  async function atSendTo(name, spot, pid) {
    if (AT.sending) return; AT.sending = true;
    try {
      // First choice: the trainer's own pick-up-and-set-down, no dragging involved.
      const out = await atAsk({ sbxAt: "send", name, pid, spot });
      if (out) {
        if (!out.ok) atToast(out.msg || "SmallBall wouldn't move him.");
        else atToast("Sent " + name + " to " + (spot === "BOX" && out.spot === "DECK" ? "on deck (he bats next)" : atSpotWord(spot, out)) + (out.swap ? " (swapping with " + out.swap + ")" : "") + ".");
        return;
      }
      // Fallback (helper didn't answer): drag him there with the pointer.
      const cv = document.getElementById("stage"), S0 = AT_SPOTS[spot]; if (!cv || !S0) return;
      const pr = await atProject([[S0[0], S0[1]]]);
      if (!pr || !pr[0]) { atToast("Couldn't read the field's layout. Reload the trainer (and the kit in chrome://extensions) and try again."); return; }
      // SmallBall's view works in the #overlay canvas's units (1160x730), not #stage's pixels (those scale with the
      // screen's pixel ratio, which is why the old math landed in different places on different screens).
      const ov = document.getElementById("overlay"), OW = (ov && ov.width) || 1160, OH = (ov && ov.height) || 730;
      const r = cv.getBoundingClientRect(), sx = r.left + pr[0][0] / OW * r.width, sy = r.top + pr[0][1] / OH * r.height;
      const from = atFindMan(name); if (!from) { atToast("Couldn't find " + name + " on the field right now."); return; }
      // Who's standing on that spot now? Look around the spot for the nearest man's feet (not the man we're sending).
      let to = { x: sx, y: sy }, onIt = null;
      if (spot !== "BOX" && spot !== "DECK" && spot !== "REST") {
        const rad = 70 / 1365 * r.width + 20, boxes = atScan({ l: sx - rad, t: sy - rad * 1.6, r: sx + rad, b: sy + rad * 0.6 }, 5), me = atKey(name);
        let best = 1e9;
        for (const [k, b] of Object.entries(boxes)) { if (k === me) continue; const fx = (b.l + b.r) / 2, fy = b.b, d = Math.hypot(fx - sx, fy - sy); if (d < best) { best = d; onIt = b; to = { x: fx, y: fy - 2 }; } }
        if (best > rad) onIt = null;
        to = { x: sx, y: sy };   // the spot itself: a carried man stands exactly under the pointer, and the drop snaps to the nearest spot
      }
      if (Math.hypot(from.feet.x - to.x, from.feet.y - to.y) < 6) { atToast(name + " is already there."); return; }
      const ev = (type, x, y, b) => { const o = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0, buttons: b }; cv.dispatchEvent(new PointerEvent(type, o)); if (type !== "pointerdown") window.dispatchEvent(new PointerEvent(type, o)); };
      // Avoid SmallBall's double-tap (two taps within 350 ms drop a "magnet"): wait if the last tap was just now.
      const since = Date.now() - (AT.lastTapAt || 0); if (since < 400) await sleep(400 - since);
      // Grab him by the middle and let go over the target: SmallBall stands a carried man on the ground under the
      // pointer, so the pointer goes to the spot itself.
      ev("pointerdown", from.x, from.y, 1);
      for (let k = 1; k <= 12; k++) { const t = k / 12; ev("pointermove", from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, 1); await sleep(16); }
      await sleep(40); ev("pointermove", to.x, to.y, 1); ev("pointerup", to.x, to.y, 0);
      AT.lastTapAt = Date.now();
      atToast("Sent " + name + " to " + S0[2].replace(/^\S+ /, "") + (onIt ? " (swapping with " + onIt.name + ")" : "") + ".");
    } finally { AT.sending = false; }
  }
  async function atSelectInTrainer(name, from, pid) {
    const out = await atAsk({ sbxAt: "focus", name, pid });
    if (out && out.ok) { if (from) { from.classList.add("tapped"); setTimeout(() => from.classList.remove("tapped"), 700); } return; }
    if (out && /Couldn't find|Let go/.test(out.msg || "")) { atToast(out.msg); return; }
    const cv = document.getElementById("stage"), hv = document.getElementById("hovername");
    if (!cv || !hv) return;
    const key = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
    const r = cv.getBoundingClientRect(), want = key(name), step = 7;
    const fire = (type, x, y, extra) => cv.dispatchEvent(new PointerEvent(type, Object.assign({ bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0, buttons: type === "pointerdown" ? 1 : 0 }, extra || {})));
    let hit = null;
    for (let y = r.top + 4; y < r.bottom && !hit; y += step)
      for (let x = r.left + 4; x < r.right; x += step) {
        fire("pointermove", x, y);
        if (!hv.hidden) { const got = key(hv.childNodes[0] ? hv.childNodes[0].textContent : hv.textContent); if (got && (got === want || got.startsWith(want) || want.startsWith(got))) { hit = { x, y }; break; } }
      }
    cv.dispatchEvent(new PointerEvent("pointerleave", { bubbles: false }));
    if (!hit) { atToast("Couldn't find " + name + " on the field right now (men off the field can't be picked)."); return; }
    // a few pixels lower: the label's box starts at his head, his middle is a surer tap
    fire("pointerdown", hit.x, hit.y + 6); fire("pointerup", hit.x, hit.y + 6); window.dispatchEvent(new PointerEvent("pointerup", { clientX: hit.x, clientY: hit.y + 6, bubbles: true }));
    if (from) { from.classList.add("tapped"); setTimeout(() => from.classList.remove("tapped"), 700); }
  }
  function atToast(msg) {
    let t = document.getElementById("sbx-at-toast"); if (!t) { t = document.createElement("div"); t.id = "sbx-at-toast"; document.body.appendChild(t); }
    t.textContent = msg; t.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483600;background:#0f1b33;color:#f4ebd9;padding:10px 16px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.5);font:13px system-ui,sans-serif";
    clearTimeout(atToast.t); atToast.t = setTimeout(() => t.remove(), 3500);
  }
  function mountSelBug(team, c, roster, S, plan, selP) {
    let el = document.getElementById("sbx-selbug");
    if (!selP || AT.selHidden === selP.player_id) { el?.remove(); return; }
    if (!el) {
      el = document.createElement("div"); el.id = "sbx-selbug"; el.dataset.pl = "bug"; atDrag(el, AT_SELPOS);
      let P = null; try { P = JSON.parse(localStorage.getItem(AT_SELPOS) || "null"); } catch (_) {}
      if (P && P.x < innerWidth - 120 && P.y < innerHeight - 50) { el.style.left = P.x + "px"; el.style.top = P.y + "px"; el.style.right = "auto"; }
      document.body.appendChild(el);
    }
    const b = S.base[selP.player_id] || { tp: +selP.tp || 0, s: SKL.map(() => 0) }, Pl = plan[selP.player_id] || {}, f = Pl.focus || [], bud = Pl.budget || {};
    const mine = atSkillsFor(selP), low = Math.min.apply(null, mine.map((x) => x.v)), tp = Math.round(+selP.tp || 0), sp = Math.max(0, Math.round(b.tp - (+selP.tp || 0)));
    const tot = ttrkSum(team, selP.player_id, Pl.since || "");
    let gsum = 0;
    const rows = mine.map((x) => { const g = Math.max(0, x.v - b.s[x.i]); gsum += g; const B = +bud[x.k], used = tot.a[x.i];
      return '<div class="sr' + (x.v === low ? " lo" : "") + (f.includes(x.k) ? " pl" : "") + '"><span class="nm">' + (f.includes(x.k) ? "🎯 " : "") + x.nm + '</span><span class="bar"><i style="width:' + Math.max(2, Math.min(100, x.v)) + '%"></i></span><b>' + x.v + "</b><em>" + (g ? "+" + g : "") + "</em></div>" +
        (B ? '<div class="tg">' + used + " / " + B + " TP planned" + (used >= B ? " ✓" : "") + "</div>" : ""); }).join("");
    const sig = selP.player_id + "|" + c.at + "|" + JSON.stringify(Pl) + "|" + atEv.length;
    if (el.dataset.sig === sig) return; el.dataset.sig = sig;
    el.innerHTML = '<div class="bg-h"><b>🎯 ' + esc(selP.name) + '</b><i>' + esc(selP.position || "bench") + '</i><button type="button" class="x" title="Hide until you click another man">✕</button></div>' +
      '<div class="nums"><span><b>' + tp + "</b> TP left</span><span>" + (sp ? '<b class="r">−' + sp + "</b> spent" : "no TP spent yet") + "</span><span>" + (gsum ? '<b class="g">+' + gsum + "</b> gained" : "no gains yet") + "</span></div>" + '<div class="tpl">' + tpBar(tp) + "</div>" + rows +
      '<div class="send"><span>Send to</span>' + ["BOX", "P", "REST", "C", "1B", "2B", "SS", "3B", "LF", "CF", "RF"].map((k) => '<button type="button" data-send="' + k + '" title="Move him to ' + AT_SPOTS[k][2].replace(/^\S+ /, "") + '">' + AT_SPOTS[k][2] + "</button>").join("") + "</div>" +
      '<div class="ft">Session since ' + new Date(S.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + (low >= 0 ? " · amber = his weakest skill" : "") + "</div>";
    el.querySelector(".x").onclick = () => { AT.selHidden = selP.player_id; el.remove(); };
    el.querySelectorAll("[data-send]").forEach((b) => (b.onclick = () => atSendTo(selP.name, b.dataset.send, selP.player_id)));
  }
  function mountDock(team) {
    const wrap = document.querySelector(".wrap"), main = wrap && wrap.querySelector(".main"); if (!main) return;
    let el = document.getElementById("sbx-dock");
    if (!el) {
      el = document.createElement("div"); el.id = "sbx-dock"; atDrag(el);
      el.addEventListener("click", (e) => { const m = e.target.closest("[data-atman]"); if (m && !e.target.closest("button,a,input")) atSelectInTrainer(m.dataset.atman, m, m.dataset.atpid); });
    }
    const pl = atPlace(), floating = pl === "bug" || pl === "float";
    if (el.dataset.pl !== pl) {
      el.dataset.pl = pl; el.dataset.sig = ""; el.className = pl === "bug" ? "bug" : pl === "float" ? "fl" : "";
      el.style.left = el.style.top = el.style.right = "";
      if (floating) { let P = null; try { P = JSON.parse(localStorage.getItem(AT_POS) || "null"); } catch (_) {} if (P && P.x < innerWidth - 120 && P.y < innerHeight - 50) { el.style.left = P.x + "px"; el.style.top = P.y + "px"; el.style.right = "auto"; } }
    }
    if (floating) { if (el.parentNode !== document.body) document.body.appendChild(el); }
    else if (pl === "above") { if (el.nextElementSibling !== main) main.insertAdjacentElement("beforebegin", el); }
    else if (el.previousElementSibling !== main) main.insertAdjacentElement("afterend", el);
    const c = PROF[team];
    if (!c) { if (!AT.loading) { AT.loading = true; profileOf(team, 4000).catch(() => {}).finally(() => { AT.loading = false; atRedraw(); }); } if (!el.innerHTML) el.innerHTML = '<div class="dk-h"><b class="t">📋 Asst. Trainer</b><span>Reading your club…</span></div>'; return; }
    const roster = (c.data.roster || []).slice().sort((a, b) => (b.position ? 1 : 0) - (a.position ? 1 : 0) || (+a.bats || 99) - (+b.bats || 99));
    // The session starts when you open the trainer: everything on the board is since then.
    if (!AT.sess || AT.sess.team !== team) {
      const base = {}; roster.forEach((p) => { base[p.player_id] = { tp: +p.tp || 0, s: SKL.map(([, k]) => Math.round(+p[k] || 0)) }; });
      AT.sess = { team, at: Date.now(), base };
    }
    const S = AT.sess, plan = tplanAll()[team] || {}, mode = atMode(), cmp = mode === "plan";
    const lastEv = atEv.filter((e) => e.team === team).slice(-1)[0], hot = lastEv && Date.now() - lastEv.at < 6000;
    const view = atView(), weakOpen = atWeakOpen();
    // The man you've clicked in the trainer: SmallBall's own Player card (#player) names him in #p-name.
    // Hold the last man clicked: the board flashes reports over his name now and then, and he should stay put until you click someone else.
    const nowSel = atSelName(); if (nowSel) { if (nowSel !== AT.selName) AT.selHidden = null; AT.selName = nowSel; AT.selTeam = team; }
    const heldSel = AT.selTeam === team ? AT.selName || "" : "";
    const selP = (function () {
      // SmallBall turns the card on with its "on" class (the card can sit in a panel the trainer keeps out of view).
      // On the trainer the man you click shows on the stadium scoreboard's player card (.sb-card); in the game
      // player it's SmallBall's Player card (#player). Either one names him.
      const key = (t) => String(t || "").replace(/^\s*#?\d+\s+/, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
      const nm = key(heldSel); if (!nm) return null;
      return roster.find((p) => key(p.name) === nm) || roster.find((p) => key(p.name) && (key(p.name).startsWith(nm) || nm.startsWith(key(p.name)))) || null;
    })();
    const selRaw = heldSel, selOn = true;
    const srt = atSort(), tpOf = (p) => +p.tp || 0;
    const order = srt ? roster.slice().sort((a, b) => (srt === "tpa" ? tpOf(a) - tpOf(b) : tpOf(b) - tpOf(a))) : roster;
    const dsig = srt + "|" + c.at + "|" + JSON.stringify(plan) + "|" + atEv.length + "|" + mode + "|" + pl + "|" + hot + "|" + view + "|" + weakOpen + "|" + (selP ? selP.player_id : "") + "|" + selRaw + selOn;
    mountSelBug(team, c, roster, S, plan, selP);
    if (el.dataset.sig === dsig) return;
    el.dataset.sig = dsig;
    let spent = 0, gains = 0, onPlan = 0, offPlan = 0, planned = 0;
    const tiles = order.map((p) => {
      const b = S.base[p.player_id] || { tp: +p.tp || 0, s: SKL.map(() => 0) };
      const tp = Math.round(+p.tp || 0), sp = Math.max(0, Math.round(b.tp - (+p.tp || 0)));
      const g = SKL.map(([, k], i) => Math.max(0, Math.round(+p[k] || 0) - b.s[i])); spent += sp; gains += g.reduce((x, y) => x + y, 0);
      const P = plan[p.player_id] || {}, f = P.focus || [], bud = P.budget || {}, tot = ttrkSum(team, p.player_id, P.since || "");
      if (f.length) planned++;
      g.forEach((x, i) => { if (f.includes(SKL[i][0])) onPlan += x; else offPlan += x; });
      const fl = AT.flash[p.player_id] && Date.now() - AT.flash[p.player_id] < 4000;
      const chips = SKL.map(([k, , nm], i) => (g[i] ? '<i class="' + (cmp && f.includes(k) ? "pl" : cmp && f.length ? "off" : "") + '" title="' + (cmp ? (f.includes(k) ? "In his plan" : f.length ? "Not in his plan" : "") : "") + '">' + nm + " +" + g[i] + "</i>" : "")).join("");
      const tg = !cmp ? "" : f.filter((k) => +bud[k]).map((k) => { const i = SKL.findIndex((x) => x[0] === k), B = +bud[k], u = tot.a[i]; return '<div class="tg">🎯 ' + SKL[i][2] + " " + u + "/" + B + " TP " + (u >= B ? "✓" : "") + '<div class="at-bar" style="height:4px;margin-top:2px"><i style="width:' + Math.min(100, Math.round((100 * u) / B)) + "%;background:" + (u >= B ? "#16a34a" : "#facc15") + '"></i></div></div>'; }).join("");
      const plain = cmp && !tg && f.length ? '<div class="tg">🎯 ' + f.map((k) => SKL.find((x) => x[0] === k)[2]).join(", ") + "</div>" : "";
      return '<div class="dk-m' + (fl ? " fl" : "") + (selP && selP.player_id === p.player_id ? " sel" : "") + '" data-atman="' + esc(p.name) + '" data-atpid="' + esc(String(p.player_id)) + '" title="Click to select him in the trainer"><div class="n">' + esc(p.name) + ' <span class="p">' + esc(p.position || "bench") + "</span></div>" +
        '<div class="tp">' + tpBar(tp) + "<span><b>" + tp + "</b>" + (sp ? ' <span style="color:#f87171">−' + sp + "</span>" : "") + "</span></div>" +
        (chips ? '<div class="gn">' + chips + "</div>" : "") + tg + plain + "</div>";
    }).join("");
    const feed = atEv.filter((e) => e.team === team && e.at >= S.at).slice(-40).reverse().map((e) => "<div>" + fmtT(e.at) + " · " + esc(e.name) + ": " + esc(e.k) + " " + e.from + " → <b>" + e.to + "</b></div>").join("") || '<div style="opacity:.6">Gains show up here as they land.</div>';
    const sortBtn = '<span class="dk-mode"><button type="button" data-atsort="' + (srt === "" ? "tpd" : srt === "tpd" ? "tpa" : "") + '" class="' + (srt ? "on" : "") + '" title="Click to change the order: the club\'s own order, most TP left first, least TP left first">' + (srt === "tpd" ? "↓ Most TP left" : srt === "tpa" ? "↑ Least TP left" : "↕ Sort by TP") + "</button></span>";
    const doneBtn = on("builder") ? '<button type="button" data-atdone class="dk-finish" title="Done training: see what this session did, then sort out your lineup">✅ Finish training</button>' : "";
    const modes = doneBtn + sortBtn + '<span class="dk-mode"><button type="button" data-mode="plan" class="' + (cmp ? "on" : "") + '" title="Gold = gains in his plan, grey = gains outside it, with his TP targets">🎯 Compare to plan</button><button type="button" data-mode="gains" class="' + (cmp ? "" : "on") + '" title="Just TP and gains, no plan">📈 Just track gains</button></span>';
    if (pl === "bug") {
      // The bug: the session in a glance, and the latest gain as it lands.
      const left = roster.reduce((x, p) => x + Math.round(+p.tp || 0), 0);
      el.innerHTML = '<div class="bg-h"><b>🐞 ASST. TRAINER</b><span class="bg-drag" title="Drag me anywhere">⠿ drag</span></div><div class="bg-club">' + esc(c.data.name || "") + ' <span>since ' + new Date(S.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + "</span></div>" +
        '<div class="bg-nums"><div><b>' + spent + '</b><span>TP spent</span></div><div><b class="g">+' + gains + '</b><span>gains</span></div>' + (cmp && planned ? '<div><b class="y">+' + onPlan + '</b><span>on plan</span></div>' : '<div><b>' + left + '</b><span>TP left</span></div>') + "</div>" +
        (function () {
          // 🎯 The man you've clicked: every skill that counts for him, this session's gains, his plan, his weakest in amber.
          if (!selP) return '<div class="bg-sel none">' + (selRaw ? "🎯 The trainer shows <b>" + esc(selRaw) + "</b>, but he isn't on this club's list yet. Tell Slip!" : "🎯 Click a man in the trainer to see his skills here.") + "</div>";
          const b = S.base[selP.player_id] || { s: SKL.map(() => 0) }, P = plan[selP.player_id] || {}, f = P.focus || [];
          const mine = atSkillsFor(selP), low = Math.min.apply(null, mine.map((x) => x.v));
          return '<div class="bg-sel"><div class="hd">🎯 ' + esc(selP.name) + ' <i>' + esc(selP.position || "bench") + "</i><span>" + Math.round(+selP.tp || 0) + " TP</span></div>" +
            mine.map((x) => { const g = Math.max(0, x.v - b.s[x.i]); return '<div class="sr' + (x.v === low ? " lo" : "") + '"><span class="nm">' + (f.includes(x.k) ? "🎯 " : "") + x.nm + '</span><span class="bar"><i style="width:' + Math.max(2, Math.min(100, x.v)) + '%"></i></span><b>' + x.v + "</b>" + (g ? '<em>+' + g + "</em>" : "<em></em>") + "</div>"; }).join("") + "</div>";
        })() +
        (function () {
          // Each starter's weakest skill (and the next one up), lowest first: what's furthest behind, so you can decide what to train.
          const men = roster.filter((p) => p.position).map((p) => { const sk = atSkillsFor(p).sort((a, b) => a.v - b.v); return { p, a: sk[0], b: sk[1] }; }).filter((x) => x.a).sort((x, y) => x.a.v - y.a.v);
          if (!men.length) return "";
          return '<div class="bg-weak"><button type="button" class="bg-wt" data-atweak="' + (weakOpen ? "0" : "1") + '">' + (weakOpen ? "▾" : "▸") + " Weakest skills</button>" + (weakOpen ? men.map((x) => '<div><span class="nm">' + esc(atShort(x.p.name)) + ' <i>' + esc(x.p.position) + '</i></span><span class="w1">' + x.a.nm + " <b>" + x.a.v + "</b></span>" + (x.b ? '<span class="w2">' + x.b.nm + " " + x.b.v + "</span>" : "") + "</div>").join("") : "") + "</div>";
        })() +
        (lastEv && lastEv.at >= S.at ? '<div class="bg-last' + (hot ? " hot" : "") + '">' + esc(lastEv.name) + ": " + esc(lastEv.k) + " " + lastEv.from + " → <b>" + lastEv.to + "</b></div>" : '<div class="bg-last" style="opacity:.6">Gains show here as they land.</div>') +
        '<div class="bg-btns"><button type="button" class="bg-open" data-atpl="float" title="The full board, floating">▾ Full board</button><button type="button" class="bg-open" data-atpl="below" title="The full board under the trainer, where it used to be">⬇ Under the trainer</button></div>';
      el.querySelectorAll("[data-atpl]").forEach((b) => (b.onclick = () => { try { localStorage.setItem(AT_PLACE, b.dataset.atpl); } catch (_) {} atRedraw(); }));
      el.querySelectorAll("[data-atweak]").forEach((b) => (b.onclick = () => { try { localStorage.setItem(AT_WEAK, b.dataset.atweak); } catch (_) {} el.dataset.sig = ""; atRedraw(); }));
      if (hot) setTimeout(() => { el.dataset.sig = ""; atRedraw(); }, 6200);
      return;
    }
    el.innerHTML = '<div class="dk-h"><b class="t">📋 Asst. Trainer · ' + esc(c.data.name || "") + "</b><span>Since " + new Date(S.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + "</span><span>TP spent <b>" + spent + "</b></span><span>Skill gains <b>+" + gains + "</b></span>" +
      (cmp && planned ? '<span title="Gains in the skills you planned, and gains outside them">On plan <b>+' + onPlan + "</b> · off plan <b>+" + offPlan + "</b></span>" : cmp ? '<span style="opacity:.75">No plan yet: open 📋 Training plan</span>' : "") + modes + '<button type="button" class="dk-plan" data-atplan="' + team + '">📋 Open the plan</button><span class="dk-view"><button type="button" data-atview="session" class="' + (view === "session" ? "on" : "") + '" title="TP and gains this session">🃏 Session</button><button type="button" data-atview="skills" class="' + (view === "skills" ? "on" : "") + '" title="Every man\'s skills side by side, his weakest in amber">📊 Skill board</button></span>' + atPlaceBtns(pl, true) + '</div>' +
      '<div class="dk-body">' + (view === "skills" ? (function () {
        // 📊 The skill board: every man, every SmallBall skill, this session's gains beside them, his weakest in amber.
        const head = "<tr><th>Man</th><th>Pos</th>" + SKL.map(([, , nm]) => "<th>" + nm + "</th>").join("") + "<th>TP</th></tr>";
        const rows = order.map((p) => {
          const b = S.base[p.player_id] || { s: SKL.map(() => 0) }, mine = atSkillsFor(p), low = mine.length ? Math.min.apply(null, mine.map((x) => x.v)) : -1;
          return "<tr data-atman=\"" + esc(p.name) + "\" data-atpid=\"" + esc(String(p.player_id)) + "\" title=\"Click to select him in the trainer\"" + (selP && selP.player_id === p.player_id ? ' class="sel"' : "") + "><td class=\"nm\">" + esc(p.name) + "</td><td>" + esc(p.position || "bench") + "</td>" + SKL.map(([k, f], i) => { const v = Math.round(+p[f] || 0), g = Math.max(0, v - b.s[i]), counts = k !== "P" || p.position === "P"; return '<td class="' + (counts && v === low ? "lo" : !counts ? "na" : "") + '">' + v + (g ? ' <i>+' + g + "</i>" : "") + "</td>"; }).join("") + "<td>" + Math.round(+p.tp || 0) + "</td></tr>";
        }).join("");
        return '<div class="dk-sk"><table>' + head + rows + '</table><div class="dk-skn">Amber: his weakest skill that counts for his spot (Pitching counts only for the man on the mound). Green: gained this session.</div></div>';
      })() : '<div class="dk-grid">' + tiles + '</div>') + '<div class="feed"><div style="font-weight:800;border:0;padding-bottom:5px">Latest gains</div>' + feed + "</div></div>";
    el.querySelectorAll("[data-mode]").forEach((b) => (b.onclick = () => { try { localStorage.setItem(AT_MODE, b.dataset.mode); } catch (_) {} el.dataset.sig = ""; atRedraw(); }));
    el.querySelectorAll("[data-atpl]").forEach((b) => (b.onclick = () => { try { localStorage.setItem(AT_PLACE, b.dataset.atpl); } catch (_) {} atRedraw(); }));
    el.querySelectorAll("[data-atview]").forEach((b) => (b.onclick = () => { try { localStorage.setItem(AT_VIEW, b.dataset.atview); } catch (_) {} el.dataset.sig = ""; atRedraw(); }));
    el.querySelectorAll("[data-atsort]").forEach((b) => (b.onclick = () => { try { localStorage.setItem(AT_SORT, b.dataset.atsort); } catch (_) {} el.dataset.sig = ""; atRedraw(); }));
    el.querySelectorAll("[data-atdone]").forEach((b) => (b.onclick = () => atWrapUp(team)));
  }

  // 🔭 The site's Team explorer only has a footer link: add a quiet one at the end of the top menu.
  function mountExplorer() {
    const nav = document.getElementById("nav");
    if (!nav || nav.querySelector("#sbx-explorer")) return;
    const a = document.createElement("a");
    a.id = "sbx-explorer"; a.href = "/explorer"; a.textContent = "Explorer";
    a.title = "Team explorer: search and filter every club in SmallBall (added by the Club Kit)";
    a.style.cssText = "opacity:.6";
    nav.appendChild(a);
  }

  // ───────── 🔔 Alerts & 📥 inbox: what needs you right now, from the Hill and your tournaments ─────────
  // Read-only, from the same public files as the live cards. In the Chrome extension, a background worker also
  // checks every few minutes with SmallBall closed (it shares the "seen" list, so you never get the same alert twice).
  const ALERT_OPT = "sbx-alerts-opt";   // { pop: desktop notifications, sound: chime }
  const AL = { events: [], seen: null, at: 0 };
  const alertOpt = () => { try { return Object.assign({ pop: false, sound: false }, JSON.parse(localStorage.getItem(ALERT_OPT) || "{}")); } catch (_) { return { pop: false, sound: false }; } };
  const stripTags = (h) => String(h || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
  function seenGet() {
    return new Promise((res) => {
      if (hasChromeStorage) { try { chrome.storage.local.get(["sbxAlertSeen"], (r) => res((r && r.sbxAlertSeen) || {})); return; } catch (_) {} }
      try { res(JSON.parse(localStorage.getItem("sbx-alert-seen") || "{}")); } catch (_) { res({}); }
    });
  }
  function seenPut(o) {
    const cut = Date.now() - 3 * 864e5; Object.keys(o).forEach((k) => { if (o[k] < cut) delete o[k]; });
    if (hasChromeStorage) { try { chrome.storage.local.set({ sbxAlertSeen: o }); return; } catch (_) {} }
    try { localStorage.setItem("sbx-alert-seen", JSON.stringify(o)); } catch (_) {}
  }
  // Everything that's waiting on one of your clubs right now.
  function alertEvents(H0, items, mine) {
    const ev = [], now = Date.now();
    for (const H of hillViews(H0)) {
      const LB = H.isFarm ? "the Farm Hill" : "the Hill", PF = H.isFarm ? "f" : "";
      const all = (H.ace ? [H.ace] : []).concat(H.ladder), me = all.filter((p) => mine.has(String(p.clubId))), names = new Set(me.map((p) => p.name));
      const clubOf = (n) => (all.find((p) => p.name === n) || {}).club || n;
      for (const c of H.charges || []) {
        if (/reported|airing/i.test(c.status || "")) continue;
        const dl = Date.parse(c.deadline || "") || 0;
        if (names.has(c.df)) ev.push({ id: PF + "hc:" + c.created + ":" + c.df, ico: "🛡️", title: "You've been charged on " + LB, text: c.ch + " charged " + clubOf(c.df) + (c.type === "Title" ? " for the title" : "") + ". They start the game; be ready.", until: c.deadline, url: HILL_BOARD, hot: true });
        if (names.has(c.ch) && dl && dl - now < 30 * 60000 && dl > now) ev.push({ id: PF + "hd:" + c.created, ico: "⏱", title: "Under 30 minutes to play your " + (H.isFarm ? "Farm" : "Hill") + " game", text: "Your charge on " + c.df + " runs out soon. Start a BigLeague game as the visitor.", until: c.deadline, url: HILL_BOARD, hot: true });
      }
      const B = H.bell, climbers = me.filter((p) => Number(p.rank) > 0), ace = me.find((p) => Number(p.rank) === 0);
      if (B && B.open && !B.answered) {
        if (climbers.length) ev.push({ id: PF + "bell:" + B.until, ico: "🔔", title: H.isFarm ? "THE FARM BELL IS RINGING" : "THE BELL IS RINGING", text: "Anyone on the climb can charge the Ace" + (H.ace ? " (" + H.ace.name + ")" : "") + ". Win by " + (B.margin || 3) + "+ for the title. First one in.", until: B.until, url: chargeUrl(H, H.ace, true, (climbers[0] || {}).clubId), hot: true });
        else if (ace) ev.push({ id: PF + "bella:" + B.until, ico: "🔔", title: "The Bell is ringing: anyone can charge you", text: "They need to win by " + (B.margin || 3) + "+ to take the hill.", until: B.until, url: HILL_BOARD });
      } else if (B && B.soon && B.next && me.length) ev.push({ id: PF + "bells:" + B.next, ico: "🔔", title: (H.isFarm ? "The Farm Bell" : "The Bell") + " rings at " + liveWhen(Date.parse(B.next)), text: "For an hour, anyone on the climb can charge the Ace.", until: B.next, url: HILL_BOARD });
      for (const w of (H.isFarm ? [] : ((H.wagers || {}).open || []))) {
        if (!names.has(w.t)) continue;
        ev.push({ id: "wg:" + w.id, ico: "🤝", title: w.m + " offered you a wager", text: stripTags(w.terms || "") + (w.ms ? " · " + w.ms + " BB" : "") + ". Answer it on the Master Form.", until: w.exp, url: H.formLink || HILL_BOARD });
      }
    }
    for (const it of items || []) {
      if (!it || it.hill) continue;
      const L = (it.lines || []).find((l) => l.go && !l.ext);
      if (!L) continue;
      ev.push({ id: "tm:" + it.k + ":" + stripTags(L.t).slice(0, 80), ico: "🏆", title: stripTags(it.title) + ": your match is open", text: stripTags(L.t), url: L.go, hot: true });
    }
    return ev;
  }
  function chime() {
    try { const A = new (window.AudioContext || window.webkitAudioContext)(), o = A.createOscillator(), g = A.createGain(); o.type = "sine"; o.frequency.value = 880; o.connect(g); g.connect(A.destination); g.gain.setValueAtTime(0.0001, A.currentTime); g.gain.exponentialRampToValueAtTime(0.25, A.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, A.currentTime + 0.6); o.start(); o.stop(A.currentTime + 0.65); } catch (_) {}
  }
  function toast(e) {
    let wrap = document.getElementById("sbx-toasts");
    if (!wrap) { wrap = document.createElement("div"); wrap.id = "sbx-toasts"; wrap.style.cssText = "position:fixed;z-index:2147483500;top:58px;right:14px;display:flex;flex-direction:column;gap:8px;width:min(360px,92vw)"; document.body.appendChild(wrap); }
    const t = document.createElement("div");
    t.style.cssText = "background:" + (e.hot ? "#7a1f2b" : "#0f1b33") + ";color:#fff;border-radius:12px;padding:10px 12px;box-shadow:0 10px 30px rgba(0,0,0,.45);font:13px/1.35 system-ui,sans-serif;cursor:pointer;border-left:4px solid #facc15";
    t.innerHTML = "<b>" + esc(e.ico + " " + e.title) + "</b><div style=\"opacity:.9;margin-top:2px\">" + esc(e.text) + "</div>";
    t.onclick = () => { if (e.url) window.open(e.url, "_blank", "noopener"); t.remove(); };
    wrap.appendChild(t);
    setTimeout(() => t.remove(), 12000);
  }
  async function alertsRun() {
    if (!on("alerts")) return;
    const mine = ownIds(); if (!mine.size) return;
    if (hasChromeStorage) { try { chrome.storage.local.set({ sbxAlertCfg: { own: [...mine], at: Date.now() } }); } catch (_) {} }
    let H = LIVE.H;
    if (!H || Date.now() - (LIVE.Hat || 0) > 120000) { try { H = await liveGet("docs/hill/board.json"); if (H) { LIVE.H = H; LIVE.Hat = Date.now(); } } catch (_) {} }
    const ev = alertEvents(H, LIVE.items, mine), seen = await seenGet(), opt = alertOpt(), fresh = ev.filter((e) => !seen[e.id]);
    AL.events = ev; AL.at = Date.now();
    if (AL.first === undefined) { AL.first = true; }
    if (fresh.length) {
      fresh.forEach((e) => { seen[e.id] = Date.now(); });
      seenPut(seen);
      fresh.slice(0, 3).forEach((e) => {
        toast(e);
        if (opt.pop && typeof Notification !== "undefined" && Notification.permission === "granted") {
          try { const n = new Notification(e.ico + " " + e.title, { body: e.text, tag: e.id, }); n.onclick = () => { window.focus(); if (e.url) window.open(e.url, "_blank", "noopener"); n.close(); }; } catch (_) {}
        }
      });
      if (opt.sound) chime();
    }
    paintInbox();
  }
  function paintInbox() {
    if (!on("alerts")) { document.getElementById("sbx-inbox")?.remove(); return; }
    let b = document.getElementById("sbx-inbox");
    if (!b) {
      b = document.createElement("button"); b.id = "sbx-inbox"; b.type = "button";
      b.style.cssText = "position:fixed;z-index:2147483400;top:12px;right:14px;border:0;border-radius:999px;min-width:40px;height:40px;padding:0 12px;font:800 15px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.35)";
      b.onclick = openInbox; document.body.appendChild(b);
    }
    const n = AL.events.length, hot = AL.events.some((e) => e.hot);
    const txt = "🔔" + (n ? " " + n : "");
    if (b.textContent !== txt) b.textContent = txt;
    b.style.background = n ? (hot ? "#dc2626" : "#facc15") : "rgba(15,27,51,.85)"; b.style.color = n && !hot ? "#1b1300" : "#fff";
    b.title = n ? n + " thing" + (n === 1 ? "" : "s") + " waiting on you" : "Nothing waiting on you right now";
  }
  function openInbox() {
    const opt = alertOpt(), ev = AL.events;
    const can = typeof Notification !== "undefined", perm = can ? Notification.permission : "unsupported";
    const ov = sbxModal("🔔 Waiting on you", (ev.length ? ev.map((e) => '<div class="row" style="cursor:' + (e.url ? "pointer" : "default") + '" data-url="' + esc(e.url || "") + '"><b>' + esc(e.ico) + "</b><div><b>" + esc(e.title) + '</b><div class="muted">' + esc(e.text) + (e.until ? cdn(e.until) : "") + "</div></div></div>").join("") : '<div class="muted">Nothing right now. You\'ll get a heads-up here when you\'re charged, the 🔔 Bell rings, a wager comes in, or your tournament match opens.</div>') +
      '<div style="margin-top:14px;display:flex;flex-direction:column;gap:6px"><label><input type="checkbox" data-o="pop"' + (opt.pop ? " checked" : "") + (can ? "" : " disabled") + "> Desktop pop-ups" + (perm === "denied" ? ' <span class="muted">(blocked in this browser\'s site settings)</span>' : !can ? ' <span class="muted">(not supported here)</span>' : "") + "</label>" +
      '<label><input type="checkbox" data-o="sound"' + (opt.sound ? " checked" : "") + "> Chime with new alerts</label>" +
      '<span class="muted">' + (hasChromeStorage ? "With desktop pop-ups on, the Chrome kit also checks every few minutes while SmallBall is closed." : "Alerts come while SmallBall is open in a tab.") + "</span></div>");
    paintCdn();
    ov.querySelectorAll("[data-url]").forEach((r) => { if (r.dataset.url) r.onclick = () => window.open(r.dataset.url, "_blank", "noopener"); });
    ov.querySelectorAll("[data-o]").forEach((c) => (c.onchange = async () => {
      const o = alertOpt(); o[c.dataset.o] = c.checked;
      if (c.dataset.o === "pop" && c.checked && can && Notification.permission !== "granted") { try { const p = await Notification.requestPermission(); if (p !== "granted") { o.pop = false; c.checked = false; } } catch (_) { o.pop = false; c.checked = false; } }
      if (c.dataset.o === "sound" && c.checked) chime();
      try { localStorage.setItem(ALERT_OPT, JSON.stringify(o)); } catch (_) {}
      if (hasChromeStorage) { try { chrome.storage.local.set({ sbxAlertPop: !!o.pop }); } catch (_) {} }
    }));
  }
  if (window.top === window) { setTimeout(() => { try { alertsRun(); } catch (_) {} }, 6000); setInterval(() => { try { alertsRun(); } catch (_) {} }, 120000); }

  // ───────── 🔎 Scouting report + ⚔️ rivalry, on other clubs' pages ─────────
  // From what SmallBall already shows anyone: their roster, their recent games and your games against them.
  const SC = {};   // team -> { busy, at, prof, h2h }
  const SCOUT_OPEN = "sbx-scout-open";
  async function loadScout(team) {
    const S = SC[team] || (SC[team] = { busy: false, at: 0 });
    if (S.busy || Date.now() - S.at < 10 * 60000) return;
    S.busy = true;
    try {
      S.prof = await profileOf(team, 10 * 60000);
      const mine = ownIds(), games = await gamesSince(team, 0, 300);
      const h2h = {};
      for (const g of games) {
        const opp = g.home_team_id === team ? g.away_team_id : g.home_team_id;
        if (!mine.has(String(opp))) continue;
        const o = h2h[opp] || (h2h[opp] = { t: [0, 0, 0], g: [], name: String(g.home_team_id === team ? g.away_name : g.home_name || "") });
        o.t["wlt".indexOf(resultOf(g, opp))]++; o.g.push(g);
      }
      S.h2h = h2h; S.games = games.filter((g) => g.finished_at); S.at = Date.now();
    } catch (_) { S.at = Date.now() - 8 * 60000; }
    finally { S.busy = false; setTimeout(tick, 0); }
  }
  function scoutHtml(team, S) {
    // A baseball scouting report: what they've done, not advice. Career lines come from the club page;
    // recent form and pitching come from their last 25 box scores. Other clubs' skill numbers aren't public.
    const P = S.prof, roster = (P && P.roster) || [], st = roster.filter((p) => p.position).sort((a, b) => (+a.bats || 9) - (+b.bats || 9));
    if (!st.length) return '<div class="muted">No lineup to read yet.</div>';
    const f3 = (x) => (x == null || !isFinite(x) ? "–" : x.toFixed(3).replace(/^0/, "")), f1 = (x) => (x == null || !isFinite(x) ? "–" : x.toFixed(1)), f2 = (x) => (x == null || !isFinite(x) ? "–" : x.toFixed(2));
    const slash = (ab, h, b2, b3, hr, bb) => (ab ? { avg: h / ab, obp: (h + bb) / (ab + bb), slg: (h + b2 + 2 * b3 + 3 * hr) / ab } : null);
    const HT = HOT[team] || {}, hot = HT.map || {}, l10 = HT.last10 || {}, arms = HT.arms || {};
    const tag = (p) => { const h = hot[p.player_id]; return h ? '<span title="' + esc(h.tip) + '">' + (h.tag === "hot" ? "🔥" : "🧊") + "</span> " : ""; };
    // Team form, from their recent games
    const G = (S.games || []).slice().sort((a, b) => String(b.finished_at).localeCompare(String(a.finished_at)));
    let form = "";
    if (G.length) {
      const t = [0, 0, 0]; let rf = 0, ra = 0; const res = G.map((g) => resultOf(g, team));
      G.forEach((g, i) => { t["wlt".indexOf(res[i])]++; const home = g.home_team_id === team; rf += Number(home ? g.home_runs : g.away_runs) || 0; ra += Number(home ? g.away_runs : g.home_runs) || 0; });
      const l = res.slice(0, 10), l10r = [0, 0, 0]; l.forEach((r) => l10r["wlt".indexOf(r)]++);
      let k = 0; while (k < res.length && res[k] === res[0]) k++;
      const rec = (x) => x[0] + "–" + x[1] + (x[2] ? "–" + x[2] : ""), n = G.length, rd = rf - ra;
      const it = (k2, v, ti) => '<span class="it" title="' + esc(ti || "") + '"><span class="k">' + k2 + "</span><b>" + v + "</b></span>";
      form = '<div class="sc-h">Team</div><div class="sc-row">' + it("Record", rec(t), "Their last " + n + " games") + it("Win %", f3(t[0] / Math.max(1, t[0] + t[1])).replace(/^\./, ".")) +
        it("Runs/G", f2(rf / n), "Runs scored per game") + it("Allowed/G", f2(ra / n), "Runs allowed per game") + it("Run diff", (rd > 0 ? "+" : "") + rd) +
        it("Last 10", rec(l10r)) + it("Streak", (res[0] || "").toUpperCase() + k) + '<span class="muted" style="font-size:12px">last ' + n + " games</span></div>";
    }
    // Lineup card
    const rows = st.map((p, i) => {
      const c = p.career || {}, ab = c.at_bats || 0, sl = slash(ab, c.hits || 0, c.doubles || 0, c.triples || 0, c.home_runs || 0, c.walks || 0);
      const ch = (c.putouts || 0) + (c.assists || 0) + (c.errors || 0), fp = ch >= 20 ? ((c.putouts || 0) + (c.assists || 0)) / ch : null;
      const r = l10[String(p.player_id)], rs = r && r.ab ? slash(r.ab, r.h, r.b2, r.b3, r.hr, r.bb) : null;
      return "<tr><td>" + (i + 1) + "</td><td>" + esc(p.position) + '</td><td class="sc-nm">' + tag(p) + esc(p.name) + "</td>" +
        "<td>" + (sl && ab >= 20 ? f3(sl.avg) + "/" + f3(sl.obp) + "/" + f3(sl.slg) : '<span class="muted">' + ab + " AB</span>") + "</td><td>" + (c.home_runs || 0) + "</td><td>" + (c.runs_batted_in != null ? c.runs_batted_in : c.rbi != null ? c.rbi : "–") + "</td><td>" + (ab ? Math.round(100 * (c.strikeouts || 0) / ab) + "%" : "–") + "</td>" +
        "<td>" + (fp != null ? f3(fp) : "–") + "</td><td>" + (c.errors || 0) + "</td>" +
        "<td>" + (r ? r.h + "-" + r.ab + (r.hr ? ", " + r.hr + " HR" : "") + (rs ? ' <span class="muted">' + f3(rs.avg) + "</span>" : "") : "–") + "</td></tr>";
    }).join("");
    const card = '<div class="sc-h">Lineup</div><div class="sc-scroll"><table class="sc-t"><thead><tr><th>#</th><th>Pos</th><th>Name</th><th title="Career batting average / on-base / slugging">Career AVG/OBP/SLG</th><th title="Career home runs">HR</th><th title="Career runs batted in">RBI</th><th title="Career strikeouts per at-bat">K%</th><th title="Career fielding percentage">Fld%</th><th title="Career errors">E</th><th title="Hits-at-bats over their last 10 games">Last 10</th></tr></thead><tbody>' + rows + "</tbody></table></div>";
    // Hot and cold
    const hc = st.filter((p) => hot[p.player_id]).concat(roster.filter((p) => !p.position && hot[p.player_id]));
    const hcHtml = hc.length ? '<div class="sc-h">Hot and cold</div>' + hc.map((p) => { const h = hot[p.player_id], n = h.num || {}; return '<div class="sc-row"><span>' + (h.tag === "hot" ? "🔥" : "🧊") + " <b>" + esc(p.name) + "</b> " + esc(p.position || "bench") + '</span><span class="muted">last ' + n.g + " games: " + n.h + "-for-" + n.ab + (n.hr ? ", " + n.hr + " HR" : "") + (n.bb ? ", " + n.bb + " BB" : "") + " · OPS " + f3(n.now) + " (" + esc(n.vs || "before") + " " + f3(n.base) + ")</span></div>"; }).join("")
      : HT.at ? '<div class="sc-h">Hot and cold</div><div class="sc-row muted">Nobody running hot or cold: every regular is within 20% of his usual OPS.</div>' : "";
    // Pitching staff
    const byId = new Map(roster.map((p) => [String(p.player_id), p]));
    const staff = Object.entries(arms).map(([id, a]) => ({ id, a, p: byId.get(id) })).filter((x) => x.a.ip >= 3).sort((x, y) => y.a.ip - x.a.ip).slice(0, 4);
    const pitHtml = staff.length ? '<div class="sc-h">Pitching</div><div class="sc-scroll"><table class="sc-t"><thead><tr><th>Pitcher</th><th>G</th><th>IP</th><th title="Runs allowed per 9 innings">RA/9</th><th title="Walks plus hits per inning">WHIP</th><th title="Strikeouts per 9">K/9</th><th title="Walks per 9">BB/9</th><th title="Home runs per 9">HR/9</th></tr></thead><tbody>' +
      staff.map((x) => { const a = x.a, n9 = 9 / a.ip; return '<tr><td class="sc-nm">' + esc(x.p ? x.p.name : "#" + x.id) + (x.p && x.p.position === "P" ? ' <span class="muted">starter</span>' : "") + "</td><td>" + a.g + "</td><td>" + Math.round(a.ip) + "</td><td>" + f2(a.r * n9) + "</td><td>" + f2((a.h + a.bb) / a.ip) + "</td><td>" + f1(a.k * n9) + "</td><td>" + f1(a.bb * n9) + "</td><td>" + f1(a.hr * n9) + "</td></tr>"; }).join("") + "</tbody></table></div>"
      : HT.at ? "" : '<div class="sc-row muted">Reading their box scores for form and pitching…</div>';
    return form + card + hcHtml + pitHtml +
      '<div class="sc-row muted" style="font-size:12px">Career lines from their club page. Last 10, hot and cold (last 10 games vs the 15 before) and pitching from their last ' + (HT.n || 25) + " box scores.</div>";
  }

  function h2hHtml(S) {
    const H = S.h2h || {}, keys = Object.keys(H);
    if (!keys.length) return '<div class="sc-row muted">You haven\'t played them yet.</div>';
    const rec = (t) => t[0] + "–" + t[1] + (t[2] ? "–" + t[2] : "");
    return keys.map((k) => {
      const o = H[k], n = o.t[0] + o.t[1] + o.t[2], g = o.g.slice().sort((a, b) => String(b.finished_at).localeCompare(String(a.finished_at)));
      const last = g[0], r = last ? resultOf(last, Number(k)) : "", lv = n >= 25 ? "⚔️🔥 Blood feud" : n >= 10 ? "⚔️ Rivalry" : "";
      const my = last ? (last.home_team_id === Number(k) ? last.home_runs + "–" + last.away_runs : last.away_runs + "–" + last.home_runs) : "";
      const streak = g.slice(0, 5).map((x) => '<i class="' + resultOf(x, Number(k)) + '">' + resultOf(x, Number(k)).toUpperCase() + "</i>").join("");
      return '<div class="sc-row"><b>' + (lv ? lv + " · " : "") + "You (" + esc(nameOfClub(Number(k))) + ") vs them</b> " + n + " games · <b>" + rec(o.t) + "</b>" +
        (last ? " · last: " + (r === "w" ? "won" : r === "l" ? "lost" : "tied") + " " + my + ", " + esc(new Date(last.finished_at).toLocaleDateString([], { month: "short", day: "numeric" })) : "") + ' <span class="chips">' + streak + "</span></div>";
    }).join("");
  }
  function nameOfClub(id) { const o = [...((document.getElementById("who-team") || {}).options || [])].find((x) => Number(x.value) === id); return o ? o.textContent.replace(/\s*-[A-Za-z]{2,4}-\s*$/, "").trim() : "club " + id; }
  function mountScout() {
    let el = document.getElementById("sbx-scout");
    const m = location.hash.match(/^#\/team\/(\d+)/), head = document.querySelector("main .teamhead");
    if (!m || !head || ownIds().has(m[1]) || !ownIds().size) { if (el) el.remove(); return; }
    const team = Number(m[1]), S = SC[team];
    if (!S || (!S.busy && Date.now() - S.at > 10 * 60000)) loadScout(team);
    if (!HOT[team] || (!HOT[team].busy && Date.now() - HOT[team].at > 10 * 60000)) loadHot(team);
    let open = true; try { open = localStorage.getItem(SCOUT_OPEN) !== "0"; } catch (_) {}
    if (!document.getElementById("sbx-scout-css")) {
      const st = document.createElement("style"); st.id = "sbx-scout-css";
      st.textContent = "#sbx-scout{margin:10px 0;padding:10px 14px;border-radius:12px;background:rgba(127,127,127,.1);border:1px solid rgba(127,127,127,.3);font:13.5px/1.45 system-ui,sans-serif}#sbx-scout summary{cursor:pointer;font-weight:800;font-size:15px}#sbx-scout .sc-row{margin-top:7px;display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline}#sbx-scout .sc-man{white-space:nowrap}#sbx-scout .sc-man i{opacity:.6;font-style:normal;font-size:11.5px}#sbx-scout .it{display:inline-flex;gap:5px;align-items:baseline;background:rgba(127,127,127,.14);border-radius:999px;padding:2px 9px}#sbx-scout .it .k{opacity:.7;font-size:12px}#sbx-scout .sc-h{margin-top:12px;font-weight:800;font-size:12px;letter-spacing:.06em;text-transform:uppercase;opacity:.75}#sbx-scout .sc-scroll{overflow-x:auto;margin-top:4px}#sbx-scout .sc-t{border-collapse:collapse;font-size:12.5px;width:100%;white-space:nowrap}#sbx-scout .sc-t th{text-align:left;font-weight:700;opacity:.7;padding:3px 8px;border-bottom:1px solid rgba(127,127,127,.35)}#sbx-scout .sc-t td{padding:3px 8px;border-bottom:1px solid rgba(127,127,127,.15);font-variant-numeric:tabular-nums}#sbx-scout .sc-t td.sc-nm{font-weight:700}#sbx-scout .sc-tips{display:block;padding:6px 10px;border-radius:9px;background:rgba(250,204,21,.12);border:1px solid rgba(250,204,21,.4)}#sbx-scout .chips i{display:inline-block;width:18px;text-align:center;font-style:normal;font-weight:800;font-size:11px;border-radius:4px;margin-left:2px}#sbx-scout .chips i.w{background:#16a34a;color:#fff}#sbx-scout .chips i.l{background:#dc2626;color:#fff}#sbx-scout .chips i.t{background:#64748b;color:#fff}";
      document.head.appendChild(st);
    }
    const body = !S || !S.prof ? '<div class="sc-row muted">Reading their roster and your games against them…</div>' : scoutHtml(team, S) + '<div class="sc-h">Head to head</div>' + h2hHtml(S);
    const key = team + "|" + (S ? S.at : 0) + "|" + ((HOT[team] || {}).at || 0) + "|" + open + "|" + (PROF[Number((document.getElementById("who-team") || {}).value || 0)] ? 1 : 0);
    if (el && el.dataset.k === key && el.isConnected) return;
    if (!el) { el = document.createElement("details"); el.id = "sbx-scout"; el.addEventListener("toggle", () => { try { localStorage.setItem(SCOUT_OPEN, el.open ? "1" : "0"); } catch (_) {} }); }
    el.dataset.k = key; el.open = open;
    el.innerHTML = "<summary>🔎 Scouting report</summary>" + body;
    const after = document.getElementById("sbx-hillbar") || head;
    if (el.previousElementSibling !== after) after.insertAdjacentElement("afterend", el);
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
        <p class="sub">Final · ${esc(bs_KINDN[d.kind] || d.kind || "")}${d.park ? ` · ${esc(d.park)}` : ""} · ${new Date(d.g.finished_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })} · game ${gid}</p>${bs_boxHTML(d)}`);
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
        const when = new Date(r.finished_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
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
  // Score hider (on to start): in game lists (not the live ticker, which runs with the broadcast), a game whose report hasn't aired yet
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
      // The live ticker's score runs with the broadcast, so it isn't a spoiler: leave it showing.
      if (lb) { const c = a.querySelector(".lb-sc"); if (c) hideUnmask(c); continue; }
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
      <div class="stars" title="${rating}-star club${avg ? ` (men average ${avg} stars)` : ""}"><span class="srow">${starRow}</span><span class="num">${rating}<small>★</small></span>${avg ? `<span class="avg">avg ${avg}</span>` : ""}${on("srank") ? starChip(team, rating) : ""}</div>
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
      <div class="acts"><button type="button" class="play" data-play="${team}" title="Pick this club and open the site's Games page">▶ Play</button><a class="trn c-train" href="/training?team=${team}" title="Open the site's training page for this club">🏋️ Training</a><button type="button" class="trn c-plan" data-atplan="${team}" title="Plan this club's training (Asst. Trainer Kit)">📋 Plan</button><button type="button" class="trn c-lineup" data-lineup="${team}" title="Jump to this club's lineup editor">🧢 Lineup</button></div>
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
  // ⭐ Star lists: SmallBall's Season page ranks the clubs of each star league (the top 100 of each) by exact
  // rating. The kit reads all ten lists every 10 minutes and shows a club's place in its own league ("NR" when
  // it isn't on it). Clicking the chip opens the Season page on that league's list with the club picked out.
  const STARL = { at: 0, map: null, busy: false };
  function starRanks() {
    if ((!STARL.map || Date.now() - STARL.at > 600e3) && !STARL.busy) {
      STARL.busy = true;
      Promise.all(Array.from({ length: 10 }, (_, i) => fetch("/season/stars?star=" + (i + 1), { headers: { Accept: "application/json" }, credentials: "include" }).then((r) => (r.ok ? r.json() : null)).catch(() => null)))
        .then((all) => {
          if (all.every((j) => !j || !Array.isArray(j.rows))) return;
          const m = {};
          all.forEach((j, i) => { if (j && Array.isArray(j.rows)) j.rows.forEach((x, k) => { m[x.team_id] = { t: Number(j.star) || i + 1, r: k + 1, n: j.rows.length }; }); });
          STARL.map = m; STARL.at = Date.now();
        })
        .finally(() => { STARL.busy = false; try { fillStarRanks(); } catch (_) {} });
    }
    return STARL.map;
  }
  function starTxt(team, tier) {
    const m = starRanks(), x = m && m[team];
    if (!m) return { t: "⭐ …", cls: "nr", tier, tip: "Reading the star lists…" };
    if (x) return { t: "⭐ #" + x.r, cls: "", tier: x.t, tip: "#" + x.r + " of " + x.n + " on the " + x.t + "★ star list. Click for the full list." };
    return { t: "⭐ NR", cls: "nr", tier, tip: "Not ranked on the " + (tier ? tier + "★ " : "") + "star list (it shows the top 100). Click for the full list." };
  }
  function starChip(team, tier) {
    const x = starTxt(Number(team), tier);
    return '<a class="sbx-srank ' + x.cls + '" data-srank="' + esc(String(team)) + '" data-tier="' + esc(String(x.tier || "")) + '" href="#/season" title="' + esc(x.tip) + '">' + esc(x.t) + "</a>";
  }
  function fillStarRanks() {
    for (const a of document.querySelectorAll("a.sbx-srank[data-srank]")) {
      const x = starTxt(Number(a.dataset.srank), Number(a.dataset.tier) || 0);
      if (a.textContent !== x.t) a.textContent = x.t;
      if (a.className !== ("sbx-srank " + x.cls).trim() && a.className !== "sbx-srank " + x.cls) a.className = "sbx-srank " + x.cls;
      if (a.title !== x.tip) a.title = x.tip;
      if (x.tier && a.dataset.tier !== String(x.tier)) a.dataset.tier = String(x.tier);
    }
  }
  // Click: open the Season page on the club's star league and pick the club out of the list.
  document.addEventListener("click", (e) => {
    const a = e.target && e.target.closest && e.target.closest("a.sbx-srank[data-srank]");
    if (!a) return;
    e.preventDefault(); e.stopPropagation();
    try { sessionStorage.setItem("sbx-starjump", JSON.stringify({ id: Number(a.dataset.srank), t: Number(a.dataset.tier) || 0, at: Date.now() })); } catch (_) {}
    if (location.hash === "#/season") starJump(); else location.hash = "#/season";
  }, true);
  function starJump(n) {
    let J = null; try { J = JSON.parse(sessionStorage.getItem("sbx-starjump") || "null"); } catch (_) {}
    if (!J || Date.now() - J.at > 30000 || location.hash !== "#/season") return;
    n = n || 0;
    const tabs = document.getElementById("s-stars");
    if (!tabs) { if (n < 40) setTimeout(() => starJump(n + 1), 250); return; }
    if (J.t) { const b = tabs.querySelector('button[data-star="' + J.t + '"]'); if (b && !b.classList.contains("on")) { b.click(); setTimeout(() => starJump(n + 1), 300); return; } }
    const list = document.getElementById("s-starlist");
    const row = list && [...list.querySelectorAll("tr")].find((tr) => new RegExp("#" + J.id + "\\b").test(tr.textContent));
    if (!row && n < 12) { setTimeout(() => starJump(n + 1), 300); return; }
    try { sessionStorage.removeItem("sbx-starjump"); } catch (_) {}
    (tabs.closest(".card") || tabs).scrollIntoView({ block: "start", behavior: "smooth" });
    if (row) { row.classList.add("sbx-starme"); setTimeout(() => row.scrollIntoView({ block: "center", behavior: "smooth" }), 450); }
  }
  // ⭐ On any club's page: its star list place beside its stars.
  function mountStarFact() {
    const m = location.hash.match(/^#\/team\/(\d+)/);
    const facts = document.querySelector("main .teamhead .facts");
    const old = document.querySelector("main .teamhead .facts .sbx-srankf");
    if (!m || !facts) { old?.remove(); return; }
    if (old && old.dataset.team === m[1]) { fillStarRanks(); return; }
    old?.remove();
    const st = [...facts.querySelectorAll(".fact .stars")][0];
    const tier = st ? Number((st.getAttribute("title") || "").match(/\d+/)?.[0] || 0) : 0;
    const f = document.createElement("span"); f.className = "fact sbx-srankf"; f.dataset.team = m[1];
    f.innerHTML = starChip(Number(m[1]), tier);
    const after = st ? st.closest(".fact") : null;
    if (after && after.parentNode === facts) after.after(f); else facts.appendChild(f);
  }

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
      const end = new Date(Date.parse(s.closes_at)).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
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
          const t = (x) => new Date(x).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
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
    if (!base && K.length && now - K[0].at > 36e5) { base = K[0].sk; since = new Date(K[0].at).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" }); }
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
    const when = at ? new Date(at).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }) : "";
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
      const t = (x) => new Date(x).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
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
    if (on("hotcold")) hotTags(t, team);
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
      return `<a class="op" href="#/team/${o.id}" title="${esc(o.name)}: ${n} games, ${o.good} good matches${n >= 10 ? " · ⚔️ rivalry" : ""}"><span>${n >= 25 ? "⚔️🔥 " : n >= 10 ? "⚔️ " : ""}${esc(o.name)}</span><span class="n">${n}g</span><b>${rec(o.t)}</b>${o.good === n ? `<span class="gm" title="All good matches">●</span>` : ""}</a>`;
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
  // ⚔️ On another club's page: if it's on Hold the Hill and one of your clubs can charge it, a button that opens
  // the Master Form with the charge filled in (or a note on why not).
  function mountHillBar() {
    let el = document.getElementById("sbx-hillbar");
    const m = location.hash.match(/^#\/team\/(\d+)/), head = document.querySelector("main .teamhead");
    const H = m && LIVE.H ? hillViews(LIVE.H).find((v) => (v.ace ? [v.ace] : []).concat(v.ladder).some((p) => String(p.clubId) === m[1])) : null;
    if (!m || !head || !H || !H.ladder) { if (el) el.remove(); return; }
    const id = m[1], mine = ownIds(), all = (H.ace ? [H.ace] : []).concat(H.ladder);
    const tgt = all.find((p) => String(p.clubId) === id);
    if (!tgt || mine.has(id)) { if (el) el.remove(); return; }
    const reach = H.isFarm ? 999 : Number(H.reach) || 3, openTo = H.isFarm ? 999 : Number(H.moundOpenTo) || 0, B = H.bell || null, t = Number(tgt.rank), isAce = H.ace && String(H.ace.clubId) === id;
    const busy = (n) => (H.charges || []).find((c) => c.ch === n || c.df === n);
    const opts = [], notes = [];
    all.filter((p) => mine.has(String(p.clubId))).forEach((me) => {
      const r = Number(me.rank);
      if (r === 0) { notes.push("You hold the " + (H.isFarm ? "Farm " : "") + "mound with " + esc(me.club) + "."); return; }
      let ok = false, need = "";
      if (isAce) { if (r === 1 || (openTo && r <= openTo)) { ok = true; need = "title shot, any win"; } else if (B && B.open) { ok = true; need = "🔔 Bell: win by " + (B.margin || 3) + "+ for the title"; } }
      else if (r - t >= 1 && r - t <= reach) { ok = true; const n = hillNeed(r - t, H.isFarm); need = n > 1 ? "win by " + n + "+" : "just win"; }
      if (ok && busy(me.name)) notes.push(esc(me.club) + " already has a Hill fight going.");
      else if (ok) opts.push({ me, need });
      else notes.push(esc(me.club) + " is #" + r + ": " + (isAce ? "the Ace is open to " + (openTo > 1 ? "#1–#" + openTo : "#1 only") + " right now" : t > r ? "they're below you" : "#" + t + " is out of reach (up to " + reach + " spots up)") + ".");
    });
    if (busy(tgt.name)) notes.unshift("They're in a Hill fight right now.");
    const key = id + "|" + JSON.stringify(opts.map((o) => o.me.clubId + o.need)) + notes.join("") + (H.updated || "");
    if (el && el.dataset.k === key && el.isConnected) return;
    if (!el) { el = document.createElement("div"); el.id = "sbx-hillbar"; }
    el.dataset.k = key;
    el.style.cssText = "display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;margin:10px 0;padding:10px 14px;border-radius:12px;background:linear-gradient(180deg,#7a1f2b,#2b0d12);color:#fff;font:14px/1.4 system-ui,sans-serif;box-shadow:inset 4px 0 0 #ef4444";
    const ttl = (H.isFarm ? "🌱" : "⛰️") + " <b>" + esc(tgt.name) + "</b> is " + (isAce ? (H.isFarm ? "🌱 <b>the Farm Ace</b>" : "♠ <b>the Ace</b>") : "<b>#" + t + "</b>") + " on " + (H.isFarm ? "the Farm Hill" : "Hold the Hill") + ".";
    el.innerHTML = '<span style="flex:1 1 260px">' + ttl + (notes.length && !opts.length ? ' <span style="opacity:.8">' + notes.join(" ") + "</span>" : "") + "</span>" +
      opts.map((o) => '<a href="' + esc(chargeUrl(H, tgt, isAce, o.me.clubId)) + '" target="_blank" rel="noopener" title="Opens the Master Form with this charge filled in. Submit it signed in as ' + esc(o.me.name) + '. If the Opponent box comes up empty (an old draft of the form can do that), pick ' + esc(isAce ? "♠ THE ACE" : "#" + t + " · " + tgt.name) + '." style="background:#facc15;color:#1b1300;font-weight:800;padding:8px 14px;border-radius:999px;text-decoration:none;white-space:nowrap">⚔️ Charge them' + (opts.length > 1 ? " with " + esc(o.me.club) : "") + ' <span style="font-weight:600;opacity:.8">· ' + esc(o.need) + "</span></a>").join("");
    if (el.previousElementSibling !== head) head.insertAdjacentElement("afterend", el);
  }
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
  const liveWhen = (ms) => (ms ? new Date(ms).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" }) : "");
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
  const hillNeed = (gap, farm) => (farm || gap <= 1 ? 1 : gap + 1);   // 🌱 the Farm Hill: any win counts
  // A Master Form link with the charge already filled in (action + opponent), when the Hill publishes the form's
  // pre-fill names; otherwise the plain form link.
  // The Hill data holds two ladders: Hold the Hill, and the 🌱 Farm Hill (H.farm). Each "view" looks like the
  // Hill data, so the cards, the charge bar and the alerts work the same on both.
  function farmView(H) {
    const F = H && H.farm; if (!F || !F.ladder) return null;
    return Object.assign({}, F, { isFarm: true, reach: H.reach, formLink: H.formLink, wallet: H.wallet, updated: H.updated, wagers: null,
      prefill: H.prefill ? Object.assign({}, H.prefill, { ace: H.prefill.farmAce || F.aceChoice }) : null });
  }
  const hillViews = (H) => [H, farmView(H)].filter((v) => v && v.ladder);
  const hillLbl = (V) => (V.isFarm ? "🌱 Farm Hill" : "⛰️ Hold the Hill");
  function chargeUrl(H, target, isAce, meClub) {
    const P = H && H.prefill, base = (H && H.formLink) || HILL_BOARD;
    const opt = isAce ? P && P.ace : target && target.opt;
    if (!P || !P.url || !P.action || !P.opp || !opt) return base;
    return P.url + "?usp=pp_url&" + P.action + "=" + encodeURIComponent(P.charge) + "&" + P.opp + "=" + encodeURIComponent(opt) + (H.isFarm && P.club && meClub ? "&" + P.club + "=" + encodeURIComponent(meClub) : "");
  }
  // ⏱ Live countdowns: any <span class="sbx-cdn" data-until="ISO"> shows the time left and turns red near the end.
  function cdn(iso) { return iso ? ' <span class="sbx-cdn" data-until="' + esc(iso) + '"></span>' : ""; }
  function paintCdn() {
    document.querySelectorAll(".sbx-cdn[data-until]").forEach((el) => {
      const ms = Date.parse(el.dataset.until) - Date.now();
      const m = Math.round(ms / 60000), txt = ms <= 0 ? "time's up" : m < 60 ? m + " min left" : Math.floor(m / 60) + " h " + (m % 60) + " min left";
      if (el.textContent !== txt) el.textContent = txt;
      el.style.cssText = "display:inline-block;margin-left:4px;padding:1px 7px;border-radius:999px;font:700 11.5px/1.5 system-ui,sans-serif;white-space:nowrap;" +
        (ms <= 30 * 60000 ? "background:#dc2626;color:#fff" : ms <= 2 * 3600000 ? "background:#f59e0b;color:#1b1300" : "background:rgba(255,255,255,.16);color:inherit");
    });
  }
  setInterval(paintCdn, 30000);
  function hillItems(H, mine) {
    if (!H || !H.ladder) return [];
    const LBL = hillLbl(H), BURL = HILL_BOARD + (H.isFarm ? "#farm" : ""), ACEW = H.isFarm ? "the 🌱 Farm Ace" : "the Ace";
    const all = (H.ace ? [H.ace] : []).concat(H.ladder), reach = H.isFarm ? 999 : Number(H.reach) || 3, form = H.formLink || HILL_BOARD;
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
        const by = ch.deadline ? " · play by <b>" + esc(liveWhen(Date.parse(ch.deadline))) + "</b>" + cdn(ch.deadline) : "";
        if (/reported|airing/i.test(ch.status || "")) lines.push({ t: "📡 Your " + (H.isFarm ? "Farm" : "Hill") + " game is in. The result posts once it has aired." });
        else if (ch.ch === me.name) lines.push({ t: "🥊 You charged <b>" + (opp ? clubA(ch.df, opp.clubId) : esc(ch.df)) + "</b>" + (opp ? " <code>" + esc(opp.clubId) + "</code>" : "") + by + ". Start a BigLeague game as the visitor.", go: opp ? liveStart(me.clubId, opp.clubId) : "" });
        else lines.push({ t: "🛡️ <b>" + (opp ? clubA(ch.ch, opp.clubId) : esc(ch.ch)) + "</b> charged you" + by + ". They start the game; be ready." });
      } else if (r === 0) {
        lines.push({ t: (H.isFarm ? "🌱 You hold the Farm mound. Defend it" : "♠ You hold the mound. Defend it") + (me.next ? ": the next defense is worth <b>+" + me.next + "</b>" : "") + "." });
        if (B && B.open) lines.push({ t: "🔔 <b>The Bell is ringing</b> until <b>" + bellUntil + "</b>" + cdn(B.until) + ": anyone on the climb can charge you (they need to win by " + (B.margin || 3) + "+)." });
        else if (B && B.soon) lines.push({ t: "🔔 The Bell rings at <b>" + bellAt + "</b>. For an hour, anyone on the climb can charge you." });
      } else if (me.rest && Date.parse(me.rest) > Date.now()) {
        // 🩹 Lost a charge at the Ace: no charging anyone until the recovery is over
        lines.push({ t: "🩹 <b>Recovering</b> from your last charge at the Ace: you can charge again at <b>" + new Date(me.rest).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + "</b>" + cdn(me.rest) + "." });
      } else {
        const tg = [];
        const openTo = H.isFarm ? 999 : Number(H.moundOpenTo) || 0;
        if (H.ace && B && B.open && !(r === 1 || (openTo && r <= openTo))) lines.push({ t: "🔔 <b>THE BELL IS RINGING</b> until <b>" + bellUntil + "</b>" + cdn(B.until) + "! Charge ♠ <b>" + clubA(H.ace.name, H.ace.clubId) + "</b> <code>" + esc(H.ace.clubId) + "</code>: win by " + (B.margin || 3) + "+ for the title, a smaller win makes you #1 contender. First one in.", go: chargeUrl(H, H.ace, true, me.clubId), btn: "🔔 Charge", ext: 1 });
        else if (H.ace && B && B.soon && !(r === 1 || (openTo && r <= openTo))) lines.push({ t: "🔔 The Bell rings at <b>" + bellAt + "</b>: for an hour, anyone can charge the Ace." });
        if (H.ace && (r === 1 || (openTo && r <= openTo))) tg.push({ t: (H.isFarm ? "🌱" : "♠") + " <b>" + clubA(H.ace.name, H.ace.clubId) + "</b> (" + ACEW + ") <code>" + esc(H.ace.clubId) + "</code> · title shot", go: chargeUrl(H, H.ace, true, me.clubId), btn: "🥊 Charge", ext: 1 });
        H.ladder.filter((p) => r - Number(p.rank) >= 1 && r - Number(p.rank) <= reach).sort((a, b) => a.rank - b.rank).forEach((p) => {
          const n = hillNeed(r - Number(p.rank), H.isFarm); tg.push({ t: "#" + p.rank + " <b>" + clubA(p.name, p.clubId) + "</b> <code>" + esc(p.clubId) + "</code> · " + (n > 1 ? "win by " + n + "+" : "just win"), go: chargeUrl(H, p, false, me.clubId), btn: "🥊 Charge", ext: 1 });
        });
        const j = H.ladder.find((p) => r - Number(p.rank) === reach + 1);
        if (j) tg.push({ t: "🪜 #" + j.rank + " <b>" + clubA(j.name, j.clubId) + "</b> with a Ladder Jump" });
        if (tg.length) { lines.push({ t: "You can charge:" }); tg.forEach((x) => lines.push(x)); lines.push({ t: '<span style="opacity:.75;font-size:12px">🥊 Charge opens the Master Form with that charge filled in. Its 🔎 Who can I charge? has the exact list (cooldowns, items).</span>' }); }
        else lines.push({ t: "Nobody in reach right now. Win a defense or wait for the ladder to move." });
      }
      lines.push({ t: '<span style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px"><a href="' + esc(form) + '" target="_blank" rel="noopener" style="color:#facc15;font-weight:700;text-decoration:none">📝 Master Form</a><a href="' + HILL_BOARD + '" target="_blank" rel="noopener" style="color:#facc15;font-weight:700;text-decoration:none">📊 Live Hold the Hill Leaderboard</a></span>' });
      out.push({ k: "hill:" + me.clubId, hill: true, farm: !!H.isFarm, bell: !!(B && B.open), title: r === 0 ? LBL + (H.isFarm ? " · 🌱 The Farm Ace" : " · ♠ The Ace") : LBL + " · #" + r + " of " + H.ladder.length, sub, lines, url: BURL });
    });
    return out;
  }
  async function liveRefresh(force) {
    if (LIVE.busy || (document.hidden && !force && !on("alerts")) || !on("live")) return;
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
      if (on("hillcard") && mine.size) { try { const H = await liveGet("docs/hill/board.json"); LIVE.H = H; LIVE.Hat = Date.now(); items.unshift(...hillViews(H).flatMap((V) => hillItems(V, mine))); } catch (_) {} }
      LIVE.items = items; LIVE.at = Date.now(); mountLive();
      try { alertsRun(); } catch (_) {}
    } finally { LIVE.busy = false; }
  }
  const LIVE_HIDE_KEY = "sbx-live-hidden";
  const liveHidden = () => { try { return JSON.parse(sessionStorage.getItem(LIVE_HIDE_KEY) || "{}"); } catch (_) { return {}; } };
  // Box-score toasts share the bottom-right corner, so they sit just above the chip.
  // ⬆ A floating button back up to your club cards, once you've scrolled down a page.
  function mountTopBtn() {
    let b = document.getElementById("sbx-top");
    if (!b) {
      b = document.createElement("button"); b.id = "sbx-top"; b.type = "button"; b.textContent = "⬆"; b.title = "Back up to your club cards";
      b.style.cssText = "position:fixed;right:16px;z-index:2147482980;width:44px;height:44px;border-radius:999px;border:1px solid #475569;background:#0b1220;color:#fde68a;font:800 20px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.45);transition:opacity .2s,transform .2s;opacity:0;transform:translateY(8px);pointer-events:none";
      b.onclick = () => { const t = ["sbx-dash-wrap", "sbx-tabs"].map((id) => document.getElementById(id)).find((e) => e && e.getBoundingClientRect().height > 0); if (t) { const y = t.getBoundingClientRect().top + window.scrollY - 80; window.scrollTo({ top: Math.max(0, y), behavior: "smooth" }); } else window.scrollTo({ top: 0, behavior: "smooth" }); };
      document.body.appendChild(b);
      const show = () => { const on2 = window.scrollY > 700; b.style.opacity = on2 ? "1" : "0"; b.style.transform = on2 ? "none" : "translateY(8px)"; b.style.pointerEvents = on2 ? "auto" : "none"; b.style.bottom = "calc(var(--sbx-live-h, 0px) + 18px)"; };
      window.addEventListener("scroll", show, { passive: true }); show();
    }
  }
  function liveLift() { const el = document.getElementById("sbx-live"); document.documentElement.style.setProperty("--sbx-live-h", el ? (el.offsetHeight + 8) + "px" : "0px"); }
  // The 🏆 Tournaments button (always there: it opens the Tournaments page) with a card above it for each
  // tournament you're in. ▾ on the button folds the cards away; the button then shows how many are waiting.
  const TOURNEY_HOME = "https://slipnsliders.github.io/smallball-tools/tournaments/";
  const LIVE_MIN_KEY = "sbx-live-min";
  // Cards you put away stay away (this browser) until you bring them back: 🥊 Hill cards, 🌱 Farm cards and
  // 🏆 tournament cards each have their own button below that peeks at them. A hidden card whose news changed
  // lights that button up with a red dot.
  const CARD_HIDE_KEY = "sbx-card-hidden", PEEK_KEY = "sbx-card-peek";
  const cardGroup = (x) => (x.farm ? "farm" : x.hill ? "hill" : "tour");
  const cardSig = (x) => JSON.stringify(x.lines);
  const cardHidden = () => {
    let h = {}; try { h = JSON.parse(localStorage.getItem(CARD_HIDE_KEY) || "{}"); } catch (_) {}
    try { const old = JSON.parse(localStorage.getItem("sbx-farm-hidden") || "null"); if (old) { Object.keys(old).forEach((k) => { if (!(k in h)) h[k] = ""; }); localStorage.setItem(CARD_HIDE_KEY, JSON.stringify(h)); localStorage.removeItem("sbx-farm-hidden"); } } catch (_) {}
    return h;
  };
  function setCardHidden(x, hide) { const h = cardHidden(); if (hide) h[x.k] = cardSig(x); else delete h[x.k]; try { localStorage.setItem(CARD_HIDE_KEY, JSON.stringify(h)); } catch (_) {} }
  const peeks = () => { try { return JSON.parse(sessionStorage.getItem(PEEK_KEY) || "{}"); } catch (_) { return {}; } };
  function setPeek(g, v) { const p = peeks(); p[g] = v ? 1 : 0; try { sessionStorage.setItem(PEEK_KEY, JSON.stringify(p)); if (v) sessionStorage.setItem(LIVE_MIN_KEY, "0"); } catch (_) {} }
  const liveMin = () => { try { return sessionStorage.getItem(LIVE_MIN_KEY) === "1"; } catch (_) { return false; } };   // open until you tuck them away (this tab remembers)
  function mountLive() {
    if (!on("live")) return;
    let el = document.getElementById("sbx-live");
    const ch = cardHidden(), pk = peeks();
    const away = { hill: [], farm: [], tour: [] }, news = { hill: false, farm: false, tour: false };
    LIVE.items.forEach((x) => { if (x.k in ch) { const g = cardGroup(x); away[g].push(x); if (ch[x.k] && ch[x.k] !== cardSig(x)) news[g] = true; } });
    const items = LIVE.items.filter((x) => !(x.k in ch) || pk[cardGroup(x)]);
    const tourN = LIVE.items.filter((x) => cardGroup(x) === "tour").length;
    const min = liveMin(), su = LIVE.signups || 0;
    const key = JSON.stringify(items) + min + su + JSON.stringify(pk) + JSON.stringify(away.hill.length + "/" + away.farm.length + "/" + away.tour.length) + JSON.stringify(news) + tourN;
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
        ((x.k in ch) ? '<button data-keep="' + i + '" title="Show this card all the time again" style="background:#14532d;border:0;color:#bbf7d0;cursor:pointer;font:700 11.5px system-ui,sans-serif;border-radius:999px;padding:4px 9px;white-space:nowrap">📌 Keep</button>'
          : '<button data-hide="' + i + '" title="Put this card away. Bring it back any time from the ' + ({ hill: "🥊 Hill", farm: "🌱 Farm", tour: "🏆 Tournaments" })[cardGroup(x)] + ' button below" style="background:rgba(255,255,255,.12);border:0;color:inherit;cursor:pointer;font:700 11.5px system-ui,sans-serif;border-radius:999px;padding:4px 9px;white-space:nowrap">' + ({ hill: "🥊", farm: "🌱", tour: "🏆" })[cardGroup(x)] + ' Hide</button>') + '</div>' +
        (x.sub ? '<div style="font-size:13px;opacity:.92;margin-top:3px">' + x.sub + "</div>" : "") + ln + "</div>";
    }).join("");
    const fold = items.length ? '<button data-fold title="' + (min ? "Show your Hill and tournament cards" : "Tuck these cards away (the button stays)") + '" style="' + pill + ';position:relative;padding:9px 14px;background:#0b1220;color:#fde68a;border:1px solid #475569">' +
      (min ? "▴ Cards" + '<span title="' + items.length + ' card' + (items.length === 1 ? "" : "s") + ' waiting" style="position:absolute;top:-7px;right:-7px;min-width:22px;height:22px;padding:0 6px;box-sizing:border-box;border-radius:999px;background:#dc2626;color:#fff;font:800 12px/22px system-ui,sans-serif;text-align:center;box-shadow:0 0 0 2px #0b1220,0 2px 6px rgba(0,0,0,.5)">' + items.length + "</span>" : "▾ Hide cards") + "</button>" : "";
    const home = '<a data-home href="' + TOURNEY_HOME + '" target="_blank" rel="noopener" title="SmallBall tournaments: brackets, sign-ups, the Hall of Champions" style="' + pill + ';padding:10px 16px;background:linear-gradient(135deg,#b45309,#f59e0b);color:#1c1917">🏆 Tournaments' +
      (su ? '<span style="font:700 11px/1 system-ui,sans-serif;background:#14532d;color:#bbf7d0;border-radius:999px;padding:4px 7px">sign-ups open</span>' : "") + "</a>";
    const dot = (on) => (on ? '<span title="Something changed on a hidden card" style="position:absolute;top:-4px;right:-4px;width:11px;height:11px;border-radius:999px;background:#dc2626;box-shadow:0 0 0 2px #0b1220"></span>' : "");
    const peekBtn = (g, ico, name, bg, fg, bd) => away[g].length ? '<button data-peek="' + g + '" title="' + (pk[g] ? "Put the " + name + " cards you hid away again" : "Peek at the " + name + " cards you hid") + '" style="' + pill + ';position:relative;padding:9px 12px;background:' + bg + ';color:' + fg + ';border:1px solid ' + bd + '">' + ico + " " + (pk[g] ? "Hide" : away[g].length) + dot(news[g] && !pk[g]) + "</button>" : "";
    const tourBadge = tourN ? '<button data-peek="tour" title="' + tourN + " tournament" + (tourN === 1 ? "" : "s") + " you're in" + (away.tour.length ? (pk.tour ? ". Click to put the hidden ones away again" : ". Click to peek at the " + away.tour.length + " you hid") : "") + '" style="' + pill + ';position:relative;padding:9px 11px;background:#7c2d12;color:#fde68a;border:1px solid #f59e0b;cursor:' + (away.tour.length ? "pointer" : "default") + '">🏆 ' + tourN + dot(news.tour && !pk.tour) + "</button>" : "";
    el.innerHTML = cards + '<div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap">' + peekBtn("hill", "🥊", "Hill", "#7a1f2b", "#fecaca", "#ef4444") + peekBtn("farm", "🌱", "Farm", "#14532d", "#bbf7d0", "#22c55e") + fold + tourBadge + home + "</div>";
    el.querySelectorAll("[data-hide]").forEach((b) => { b.onclick = () => { const x = items[Number(b.dataset.hide)]; setCardHidden(x, true); setPeek(cardGroup(x), false); mountLive(); }; });
    el.querySelectorAll("[data-keep]").forEach((b) => { b.onclick = () => { setCardHidden(items[Number(b.dataset.keep)], false); mountLive(); }; });
    el.querySelectorAll("[data-peek]").forEach((b) => { b.onclick = () => { const g = b.dataset.peek; if (!away[g].length) return; setPeek(g, !pk[g]); mountLive(); }; });
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
      if (on("srank")) { safe(mountStarFact); safe(fillStarRanks); if (location.hash === "#/season") safe(starJump); }
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
      if (on("hillcard")) safe(mountHillBar);
      safe(paintCdn);
      if (on("totop")) safe(mountTopBtn);
      if (on("live")) safe(mountLive);
      if (on("explorer")) safe(mountExplorer);
      if (on("tplan")) safe(mountAsst);
      if (on("scout")) safe(mountScout);
    } finally { busy = false; try { OBS.takeRecords(); } catch (_) {} }   // drop the changes the kit just made itself
  };
  const OBS = new MutationObserver(tick);
  OBS.observe(document.body, { childList: true, subtree: true });
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
    return { preset: c.preset || "balanced", w: { ...base.w, ...(c.w || {}) }, order: c.order || base.order, p9: c.p9 !== false, orderOnly: !!c.orderOnly, locks: c.locks || [], saved: Array.isArray(c.saved) ? c.saved : [] };
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
#sbx-build .pretrain{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:10px 0 4px;padding:10px 12px;border-radius:12px;background:rgba(124,58,237,.16);border:1px solid rgba(167,139,250,.6);font:600 13.5px/1.4 system-ui,sans-serif}
#sbx-build .pretrain span{display:flex;flex-wrap:wrap;gap:6px}

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
  #sbx-build .saved { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 10px; font-size: 12.5px; }
  #sbx-build .saved .lbl { opacity: .8; font-weight: 700; margin-right: 2px; }
  #sbx-build .saved .sv { display: inline-flex; align-items: center; border-radius: 999px; background: rgba(250,204,21,.16); border: 1px solid rgba(250,204,21,.45); overflow: hidden; }
  #sbx-build .saved .sv button { border: 0; background: none; color: inherit; font: 700 12.5px/1 system-ui, sans-serif; padding: 6px 10px; cursor: pointer; }
  #sbx-build .saved .sv button.del { padding: 6px 8px 6px 2px; opacity: .55; font-weight: 400; }
  #sbx-build .saved .sv.cur { background: #facc15; color: #1b1300; }
  #sbx-build .saved input { font: inherit; border-radius: 8px; border: 1px solid rgba(255,255,255,.3); background: rgba(0,0,0,.25); color: inherit; padding: 5px 8px; width: 170px; }
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
  // 🔥🧊 from the Club Kit's hot & cold tags (last 10 games vs career), when it has them
  function hotMark(id) { try { const x = ((window.__sbxHot || {})[ST.team] || {}).map || {}, h = x[id]; return h ? `<span title="${esc(h.tip)}">${h.tag === "hot" ? "🔥" : "🧊"}</span> ` : ""; } catch (_) { return ""; } }
  function chip(id, posName, c, tag) {
    const p = ST.byId.get(id);
    if (!p) return '<div class="chip"><span class="xb-n">?</span></div>';
    const lock = c.locks.map(String).includes(String(id));
    const f = posName && DEF[posName] ? Math.round(DEF[posName](p)) : null;
    const col = f == null ? "" : f >= 80 ? "#16a34a" : f >= 60 ? "#ca8a04" : "#dc2626";
    return `<div class="chip" data-id="${esc(id)}" title="${esc(p.name)} · Contact ${S(p, "contact_odds")}, Batting ${S(p, "swing_skill")}, Power ${S(p, "swing_power")}, Speed ${spd(p)}, Glove ${glove(p)}, Arm ${arm(p)}, Pitch ${S(p, "pitch_skill")} · TP ${S(p, "tp")}${f != null ? ` · ${posName} fit ${f} (${DEF_WHY[posName]})` : ""}">` +
      `<button class="lk${lock ? " on" : ""}" data-lock="${esc(id)}" title="${lock ? "Locked: Optimize leaves him where he is. Click to unlock." : "Lock him here so Optimize leaves him alone"}">${lock ? "🔒" : "🔓"}</button>` +
      `<span class="xb-n">${tag ? `<span class="pos">${esc(tag)}</span> ` : ""}${hotMark(id)}${esc(p.name)}</span><span class="xb-s">${esc(statLine(p, posName))}${S(p, "tp") ? ` · TP ${Math.round(S(p, "tp") * 10) / 10}` : ""}</span>` +
      (f != null ? `<div class="fit"><i style="width:${f}%;background:${col}"></i></div>` : "") + "</div>";
  }

  const sameLineup = (a, b) => a && b && a.pos.every((id, i) => id === b.pos[i]) && a.order.every((id, i) => id === b.order[i]);
  function savedRow(c, form) {
    const list = c.saved || [];
    return `<div class="saved"><span class="lbl">💾 Saved lineups:</span>` +
      (list.length ? list.map((x, i) => `<span class="sv${sameLineup(x, form) ? " cur" : ""}" title="${esc(x.name)} · saved ${esc(new Date(x.at).toLocaleDateString())}${sameLineup(x, form) ? " · this is what's in the form now" : ""}"><button type="button" data-load="${i}">${esc(x.name)}</button><button type="button" class="del" data-del="${i}" title="Delete this saved lineup">✕</button></span>`).join("") : `<span style="opacity:.65">none yet</span>`) +
      (ST.naming ? `<input type="text" maxlength="30" placeholder="Name it, e.g. Hill defense" data-name><button type="button" class="bb go" data-sv="ok">Save</button><button type="button" class="bb" data-sv="no">Cancel</button>`
        : `<button type="button" class="bb" data-sv="new" title="Save the lineup and batting order that are in the form right now">＋ Save this lineup</button>`) + "</div>";
  }
  // 🏋️ The lineup you had before training (noted by the Asst. Trainer when you opened the trainer).
  const PRE_KEY = "sbx-pretrain";
  function preGet(team) {
    let all = {}; try { all = JSON.parse(localStorage.getItem(PRE_KEY) || "{}"); } catch (_) {}
    const x = all[team]; if (!x || !x.open || Date.now() - x.at > 24 * 3600e3) return null;
    const pos = POS.map((k, i) => (i < 9 ? x.field[k] : (x.bench || [])[i - 9]) || "");
    if (pos.some((id) => !id || !ST.byId || !ST.byId.has(String(id)))) return null;   // someone left the club: can't rebuild it
    return { at: x.at, pos: pos.map(String), order: (x.order || []).map(String) };
  }
  function preClose(team) { let all = {}; try { all = JSON.parse(localStorage.getItem(PRE_KEY) || "{}"); } catch (_) {} if (all[team]) { all[team].open = false; try { localStorage.setItem(PRE_KEY, JSON.stringify(all)); } catch (_) {} } }
  const sameForm = (a, b) => a && b && a.pos.every((id, i) => id === b.pos[i]) && a.order.length === b.order.length && a.order.every((id, i) => id === b.order[i]);
  function render() {
    const el = ST.el, team = ST.team, c = cfg(team);
    const form = readForm(ST.byName);
    if (!form) return;
    ST.form = form; ST.sig = JSON.stringify(form);
    const ptl = preGet(team);
    if (ptl && sameForm(ptl, form) && !ST.preShown) preClose(team);   // the lineup is already back: nothing to do
    const preBar = ptl && !sameForm(ptl, form) ? `<div class="pretrain">🏋️ <b>Training moved your men around.</b> Want the lineup you had before training (${new Date(ptl.at).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })})?` +
      `<span><button class="bb go" data-act="pre" title="Fill the form with the lineup and batting order from before training">↩️ Put back my lineup</button>` +
      `<button class="bb" data-act="opt" title="Build a fresh lineup with your settings instead">⚡ Optimize instead</button>` +
      `<button class="bb" data-act="prekeep" title="Keep the lineup as it is now">Keep it as is</button></span></div>` : "";
    if (preBar) ST.preShown = true;
    const posOf = (id) => { const i = form.pos.indexOf(id); return i >= 0 ? POS[i] : ""; };
    const field = FIELD.map((i) => `<div class="slot" data-slot="${i}" style="grid-column:${AREA[i][0]};grid-row:${AREA[i][1]}"><b>${POS[i]}</b>${chip(form.pos[i], POS[i], c)}</div>`).join("") +
      `<div class="bench">${[9, 10, 11].map((i) => `<div class="slot" data-slot="${i}"><b>BENCH</b>${chip(form.pos[i], null, c)}</div>`).join("")}</div>`;
    const order = form.order.map((id, k) => `<li data-ord="${k}"><b>${k + 1}</b>${id ? chip(id, null, c, posOf(id)) : '<div class="chip">?</div>'}</li>`).join("");
    const pre = Object.entries(PRESETS).map(([k, v]) => `<button data-preset="${k}" class="${c.preset === k ? "on" : ""}" title="${esc(v.tip)}">${v.label}</button>`).join("");
    const sl = SLIDERS.map(([k, label, tip]) => `<label title="${esc(tip)}"><span>${label}</span><input type="range" min="0" max="10" step="1" data-w="${k}" value="${c.w[k]}"><b>${c.w[k]}</b></label>`).join("");
    el.innerHTML = `<div class="bh"><div class="xb-t"><h3>🧩 Lineup Builder</h3><div class="xb-sub">Drag men between spots, the bench and the batting order (or tap one, then another). It fills SmallBall's form below; nothing is saved until you press <b>Save</b>.</div></div>` +
      `<button class="bb go" data-act="opt" title="Build the lineup and batting order with your settings">⚡ Optimize my way</button>` +
      `<button class="bb" data-act="cust">⚙️ ${ST.open ? "Hide settings" : "My settings"}</button>` +
      (ST.snapshot ? `<button class="bb" data-act="undo" title="Put the form back the way it was before your changes">↺ Undo my changes</button>` : "") + "</div>" + preBar +
      savedRow(c, form) +
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
      else if (a === "pre") { const p = preGet(team); if (p) await change(p, "Back to your lineup from before training."); }
      else if (a === "prekeep") { preClose(team); render(); msg("👍 Keeping the lineup as it is."); }
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
    const sv = (a) => el.querySelector(`[data-sv="${a}"]`);
    if (sv("new")) sv("new").onclick = () => { ST.naming = true; render(); const i = el.querySelector("[data-name]"); if (i) i.focus(); };
    if (sv("no")) sv("no").onclick = () => { ST.naming = false; render(); };
    const doSave = () => {
      const i = el.querySelector("[data-name]"), name = (i && i.value.trim()) || "Lineup " + ((c().saved || []).length + 1);
      const cc = c(), list = (cc.saved || []).filter((x) => x.name.toLowerCase() !== name.toLowerCase());
      if (list.length >= 12) { msg("You can keep up to 12 saved lineups per club. Delete one first."); return; }
      list.push({ name, pos: ST.form.pos.slice(), order: ST.form.order.slice(), at: Date.now() });
      saveCfg(team, { ...cc, saved: list }); ST.naming = false; render(); msg("💾 Saved \"" + esc(name) + "\". Tap it any time to put it back in the form.");
    };
    if (sv("ok")) sv("ok").onclick = doSave;
    const nm = el.querySelector("[data-name]"); if (nm) nm.onkeydown = (e) => { if (e.key === "Enter") doSave(); if (e.key === "Escape") { ST.naming = false; render(); } };
    el.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => {
      const cc = c(), i = Number(b.dataset.del), x = (cc.saved || [])[i]; if (!x) return;
      if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = "delete?"; setTimeout(() => { if (b.isConnected) { b.dataset.sure = ""; b.textContent = "✕"; } }, 3000); return; }
      cc.saved.splice(i, 1); saveCfg(team, cc); render(); msg("Deleted \"" + esc(x.name) + "\".");
    }));
    el.querySelectorAll("[data-load]").forEach((b) => (b.onclick = async () => {
      const x = (c().saved || [])[Number(b.dataset.load)]; if (!x) return;
      const have = new Set(ST.form.pos), want = new Set(x.pos);
      const gone = x.pos.filter((id) => !have.has(id)).map((id) => (ST.byId.get(id) || {}).name || "a man who's left");
      if (gone.length || have.size !== want.size || x.order.some((id) => !x.pos.slice(0, 9).includes(id))) { msg("⚠️ \"" + esc(x.name) + "\" has men who aren't on the roster any more (" + gone.map(esc).join(", ") + "). Set it up again and re-save it."); return; }
      ST.why = "";
      await change({ pos: x.pos.slice(), order: x.order.slice() }, "Loaded \"" + esc(x.name) + "\".");
    }));
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
    preClose(ST.team);
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
    // ✅ Finish training (from the Asst. Trainer): put the lineup from before training back and press Save for you.
    let fx = null; try { fx = JSON.parse(sessionStorage.getItem("sbx-lu-fix") || "null"); } catch (_) {}
    if (fx && String(fx.team) === String(team) && ST.el && Date.now() - (fx.at || 0) < 120000) {
      try { sessionStorage.removeItem("sbx-lu-fix"); } catch (_) {}
      setTimeout(() => ST.el.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
      const p = preGet(team), now = readForm(ST.byName);
      if (fx.mode === "opt") { const conf = cfg(team), t = optimize({ ...now, byId: ST.byId }, conf); ST.why = explain(t, conf); await change(t, "Optimized with " + (PRESETS[conf.preset] ? PRESETS[conf.preset].label : "your settings") + "."); preClose(team); }
      else if (fx.mode === "edit") { msg("🧩 Drag men around, or use ↩️ / ⚡ above. Press <b>Save</b> below when it looks right."); }
      else if (!p) msg("✅ Training done. There's no lineup from before training to put back (it's older than a day, or a man has left the club).");
      else if (sameForm(p, now)) { preClose(team); msg("✅ Training done. Your lineup is already the way it was before training."); }
      else {
        await change(p, "Back to your lineup from before training.");
        const got = readForm(ST.byName), save = document.getElementById("lu-save");
        if (save && sameForm(p, got)) { msg("✅ Putting your lineup back and saving…"); save.click(); }
        else msg("⚠️ Couldn't fill the whole lineup back in. Check the form, then press <b>Save</b>.");
      }
    }
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
