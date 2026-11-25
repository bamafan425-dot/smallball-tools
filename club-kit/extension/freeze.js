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
