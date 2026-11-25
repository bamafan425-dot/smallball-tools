(() => {
  // SmallBall Tournament Kit: sign-ups from a Google Form, a bracket in any of eight formats, results read
  // from the real games between the two clubs, and a hand-off to the Broadcast Kit for the watch-along.
  // Read-only on SmallBall: it never starts, plays, trains or saves anything there.
  if (window.top !== window) return;
  if (document.getElementById("tt-launch")) return;

  const KEY = "sbt-state-v1";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function getJSON(url) { const r = await fetch(url, { credentials: "include" }); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }
  const PARKS = { 2: "League field", 4: "Homerun stadium", 5: "World Park", 6: "Monster Park", 7: "BrickYard", 8: "Alice's Park", 9: "Field of Dreams", 10: "Letterbox Park", 11: "Jurassic Park", 12: "Ocean Park", 13: "Centennial Field" };
  const cleanName = (s) => String(s || "").replace(/\s*-[^-\s][^-]*-\s*$/, "").trim();

  // ===================== Bracket engine =====================
  // A tournament is a list of matches. A side is either a club ({ club }) or a pointer to another match's
  // winner or loser ({ from: "W3", take: "W" }). Results come from real games between the two clubs, so the
  // engine only has to know who meets whom, in what order. BYE is a side that always loses.
  const BYE = -1;
  const FORMATS = {
    single: { name: "Single elimination", blurb: "Lose once and you're out. Byes go to the top seeds." },
    double: { name: "Double elimination", blurb: "Winners and losers brackets. You're out after two losses. The losers-bracket champ has to beat the winners-bracket champ twice." },
    rr: { name: "Round robin", blurb: "Everybody plays everybody. Best record wins." },
    groups: { name: "Groups, then knockout", blurb: "Round-robin groups, then the top of each group goes into a single-elimination bracket." },
    swiss: { name: "Swiss", blurb: "Nobody's knocked out. Each round you face a club with the same record. Best record after the last round wins. Great for big chats." },
    koth: { name: "King of the Hill", blurb: "Top seed holds the hill. Every other club gets one shot in order; win and you take the hill. Whoever holds it at the end is champion, and the longest reign gets bragging rights." },
    gauntlet: { name: "The Gauntlet", blurb: "Bottom seeds fight their way up: the lowest two play, the winner faces the next seed up, all the way to the top seed in the final." },
    survivor: { name: "Survivor", blurb: "Single elimination, but the bracket is redrawn at random every round. Nobody knows their path." },
  };
  // Standard seed order for a bracket of n (power of 2): 1 v n, and the top two can only meet in the final.
  function seedOrder(n) {
    let a = [1];
    while (a.length < n) { const m = a.length * 2 + 1, b = []; for (const s of a) b.push(s, m - s); a = b; }
    return a;
  }
  const pow2 = (n) => { let p = 1; while (p < n) p *= 2; return Math.max(2, p); };
  const roundName = (left, kind) => left === 2 ? (kind ? `${kind} final` : "Final") : left === 4 ? (kind ? `${kind} semifinal` : "Semifinal") : left === 8 ? (kind ? `${kind} quarterfinal` : "Quarterfinal") : `${kind ? kind + " r" : "R"}ound of ${left}`;

  // Seeding: who is seed 1, 2, 3...
  function seeded(entries, how) {
    const e = entries.filter((x) => x.ok !== false).slice();
    if (how === "stars") e.sort((a, b) => (b.stars || 0) - (a.stars || 0) || a.signed - b.signed);
    else if (how === "random") { for (let i = e.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [e[i], e[j]] = [e[j], e[i]]; } }
    else if (how === "starsLow") e.sort((a, b) => (a.stars || 0) - (b.stars || 0) || a.signed - b.signed);
    else e.sort((a, b) => a.signed - b.signed);           // sign-up order, the 2002 standard
    return e.map((x, i) => Object.assign({}, x, { seed: i + 1 }));
  }

  // ---- Single elimination (also the knockout stage of Groups) ----
  function buildSingle(clubs, opt = {}) {
    const n = pow2(clubs.length), order = seedOrder(n), M = [], pre = opt.prefix || "", label = opt.label || "";
    let prev = [];
    for (let i = 0; i < n / 2; i++) {
      const sa = order[2 * i], sb = order[2 * i + 1];
      const a = clubs[sa - 1] ? { club: clubs[sa - 1] } : { club: BYE }, b = clubs[sb - 1] ? { club: clubs[sb - 1] } : { club: BYE };
      const m = { id: `${pre}R1M${i + 1}`, round: 1, slot: i, a, b, bracket: opt.bracket || "W" };
      M.push(m); prev.push(m.id);
    }
    let r = 1, left = n;
    M.filter((m) => m.round === 1).forEach((m) => (m.label = `${label}${roundName(left, opt.kind)} · Match ${m.slot + 1}`));
    while (prev.length > 1) {
      r++; left /= 2; const next = [];
      for (let i = 0; i < prev.length / 2; i++) {
        const m = { id: `${pre}R${r}M${i + 1}`, round: r, slot: i, a: { from: prev[2 * i], take: "W" }, b: { from: prev[2 * i + 1], take: "W" }, bracket: opt.bracket || "W", label: `${label}${roundName(left, opt.kind)}${prev.length > 2 ? ` · Match ${i + 1}` : ""}` };
        M.push(m); next.push(m.id);
      }
      prev = next;
    }
    return { matches: M, final: prev[0], rounds: r };
  }

  // ---- Double elimination ----
  function buildDouble(clubs, opt = {}) {
    const W = buildSingle(clubs, { bracket: "W", kind: "Winners", prefix: "W" });
    const M = W.matches.slice(), k = W.rounds;
    const wb = (r) => W.matches.filter((m) => m.round === r).map((m) => m.id);
    let lr = 0, cur = [];
    const add = (a, b, name) => { lr++; return { id: `L${lr}M`, a, b }; };
    // Losers round 1: losers of winners round 1, paired.
    const r1 = wb(1); let li = 0;
    for (let i = 0; i < r1.length; i += 2) { const m = { id: `LR1M${++li}`, round: 1, slot: li - 1, bracket: "L", a: { from: r1[i], take: "L" }, b: { from: r1[i + 1], take: "L" } }; M.push(m); cur.push(m.id); }
    let lround = 1;
    for (let r = 2; r <= k; r++) {
      // Drop-in round: winners-round-r losers come down to meet the losers-bracket survivors (reversed, to dodge quick rematches).
      const drop = wb(r).slice().reverse(), next = []; lround++; li = 0;
      for (let i = 0; i < cur.length; i++) { const m = { id: `LR${lround}M${++li}`, round: lround, slot: li - 1, bracket: "L", a: { from: cur[i], take: "W" }, b: { from: drop[i], take: "L" } }; M.push(m); next.push(m.id); }
      cur = next;
      if (cur.length > 1) {
        lround++; li = 0; const nx = [];
        for (let i = 0; i < cur.length; i += 2) { const m = { id: `LR${lround}M${++li}`, round: lround, slot: li - 1, bracket: "L", a: { from: cur[i], take: "W" }, b: { from: cur[i + 1], take: "W" } }; M.push(m); nx.push(m.id); }
        cur = nx;
      }
    }
    const lTotal = lround;
    M.filter((m) => m.bracket === "L").forEach((m) => { const left = M.filter((x) => x.bracket === "L" && x.round === m.round).length; m.label = m.round === lTotal ? "Losers final" : `Losers round ${m.round}${left > 1 ? ` · Match ${m.slot + 1}` : ""}`; });
    const gf = { id: "GF", round: 1, slot: 0, bracket: "F", label: "Grand final", a: { from: W.final, take: "W" }, b: { from: cur[0], take: "W" } };
    M.push(gf);
    if (opt.reset !== false) M.push({ id: "GF2", round: 2, slot: 0, bracket: "F", label: "Grand final, reset", resetOf: "GF", a: { from: "GF", take: "W" }, b: { from: "GF", take: "L" } });
    return { matches: M, final: opt.reset !== false ? "GF2" : "GF" };
  }

  // ---- Round robin (circle method) ----
  function buildRR(clubs, opt = {}) {
    const list = clubs.slice(); if (list.length % 2) list.push(BYE);
    const n = list.length, M = [], pre = opt.prefix || "", g = opt.group || "";
    const arr = list.slice();
    for (let r = 0; r < n - 1; r++) {
      for (let i = 0; i < n / 2; i++) {
        const a = arr[i], b = arr[n - 1 - i];
        if (a === BYE || b === BYE) continue;
        M.push({ id: `${pre}RR${r + 1}M${i + 1}`, round: r + 1, slot: i, bracket: g ? "G" : "RR", group: g, a: { club: r % 2 ? b : a }, b: { club: r % 2 ? a : b }, label: `${g ? `Group ${g} · ` : ""}Round ${r + 1}` });
      }
      arr.splice(1, 0, arr.pop());
    }
    return { matches: M };
  }

  // ---- Groups: snake the seeds into groups, round robin each ----
  function buildGroups(clubs, opt = {}) {
    const size = Math.max(3, opt.size || 4), ng = Math.max(2, Math.round(clubs.length / size)), groups = Array.from({ length: ng }, () => []);
    clubs.forEach((c, i) => { const r = Math.floor(i / ng), j = i % ng; groups[r % 2 ? ng - 1 - j : j].push(c); });
    const M = [];
    groups.forEach((g, i) => { const L = String.fromCharCode(65 + i); M.push(...buildRR(g, { prefix: "G" + L, group: L }).matches); });
    return { matches: M, groups: groups.map((g, i) => ({ name: String.fromCharCode(65 + i), clubs: g })) };
  }

  // Everything the engine knows: resolve sides, find the next playable matches, and tidy up byes.
  function sideClub(T, side) {
    if (!side) return null;
    if (side.club != null) return side.club;
    const m = T.matches.find((x) => x.id === side.from); if (!m || !m.winner) return null;
    return side.take === "L" ? m.loser : m.winner;
  }
  function settle(T) {
    // Walk forward until nothing changes: byes advance, a reset final is dropped when the winners-bracket champ wins the first.
    for (let pass = 0; pass < 50; pass++) {
      let changed = false;
      for (const m of T.matches) {
        if (m.winner || m.void) continue;
        const a = sideClub(T, m.a), b = sideClub(T, m.b);
        if (m.resetOf) { const gf = T.matches.find((x) => x.id === m.resetOf); if (gf && gf.winner && gf.winner === sideClub(T, gf.a)) { m.void = true; changed = true; continue; } }
        if (a == null || b == null) continue;
        if (a === BYE || b === BYE) { m.winner = a === BYE ? b : a; m.loser = a === BYE ? a : b; m.bye = true; changed = true; continue; }
        if (!m.openAt) { m.openAt = Date.now(); changed = true; }
      }
      if (!changed) break;
    }
  }
  const MIN = { double: 3, groups: 6 };
  const playable = (T) => T.matches.filter((m) => !m.winner && !m.void && sideClub(T, m.a) > 0 && sideClub(T, m.b) > 0);

  // Standings for round robin, groups and Swiss: wins, then head to head, then run difference.
  function standings(T, clubs, filter) {
    const row = {}; for (const c of clubs) row[c] = { club: c, w: 0, l: 0, rf: 0, ra: 0, p: 0 };
    for (const m of T.matches) {
      if (!m.winner || m.bye || (filter && !filter(m))) continue;
      const a = sideClub(T, m.a), b = sideClub(T, m.b);
      if (!row[a] || !row[b]) continue;
      row[m.winner].w++; row[m.loser].l++; row[a].p++; row[b].p++;
      row[a].rf += m.runs ? m.runs[0] : 0; row[a].ra += m.runs ? m.runs[1] : 0; row[b].rf += m.runs ? m.runs[1] : 0; row[b].ra += m.runs ? m.runs[0] : 0;
    }
    const h2h = (x, y) => { const m = T.matches.find((mm) => mm.winner && !mm.bye && [sideClub(T, mm.a), sideClub(T, mm.b)].includes(x) && [sideClub(T, mm.a), sideClub(T, mm.b)].includes(y)); return m ? (m.winner === x ? -1 : 1) : 0; };
    return Object.values(row).sort((x, y) => y.w - x.w || x.l - y.l || h2h(x.club, y.club) || (y.rf - y.ra) - (x.rf - x.ra));
  }

  // Formats that grow as they go: Swiss rounds, Survivor redraws, King of the Hill, the Gauntlet, the knockout after groups.
  function grow(T) {
    const all = T.seeds.map((s) => s.club);
    const done = (ms) => ms.length && ms.every((m) => m.winner || m.void);
    if (T.fmt === "swiss") {
      const rounds = T.opt.swissRounds || Math.max(3, Math.ceil(Math.log2(all.length)));
      const last = Math.max(0, ...T.matches.map((m) => m.round));
      if (last >= rounds || (last && !done(T.matches.filter((m) => m.round === last)))) return;
      const st = standings(T, all), r = last + 1, met = new Set(T.matches.map((m) => [sideClub(T, m.a), sideClub(T, m.b)].sort().join("-")));
      const pool = st.map((x) => x.club), M = [];
      if (pool.length % 2) { // bye to the lowest club that hasn't had one
        const byes = new Set(T.matches.filter((m) => m.bye).map((m) => m.winner));
        const k = pool.slice().reverse().find((c) => !byes.has(c)) ?? pool[pool.length - 1];
        pool.splice(pool.indexOf(k), 1); M.push({ id: `S${r}BYE`, round: r, slot: 99, bracket: "SW", label: `Round ${r} · bye`, a: { club: k }, b: { club: BYE } });
      }
      while (pool.length) {
        const a = pool.shift(); let j = pool.findIndex((b) => !met.has([a, b].sort().join("-"))); if (j < 0) j = 0;
        const b = pool.splice(j, 1)[0]; M.push({ id: `S${r}M${M.length + 1}`, round: r, slot: M.length, bracket: "SW", label: `Round ${r} · Match ${M.length + 1}`, a: { club: a }, b: { club: b } });
      }
      T.matches.push(...M);
    } else if (T.fmt === "survivor") {
      const last = Math.max(0, ...T.matches.map((m) => m.round));
      const alive = last ? T.matches.filter((m) => m.round === last).map((m) => m.winner) : all;
      if (last && !done(T.matches.filter((m) => m.round === last))) return;
      if (alive.length < 2) return;
      const pool = alive.filter((c) => c !== BYE); for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      if (pool.length % 2) pool.push(BYE);
      const r = last + 1, left = pool.length;
      for (let i = 0; i < pool.length; i += 2) T.matches.push({ id: `V${r}M${i / 2 + 1}`, round: r, slot: i / 2, bracket: "W", label: `${roundName(pow2(left))}${left > 2 ? ` · Match ${i / 2 + 1}` : ""}`, a: { club: pool[i] }, b: { club: pool[i + 1] } });
    } else if (T.fmt === "koth" || T.fmt === "gauntlet") {
      const last = T.matches[T.matches.length - 1];
      if (last && !last.winner) return;
      // King of the Hill: seed 1 holds, challengers 2, 3, 4... Gauntlet: start at the bottom, climb to seed 1.
      const order = T.fmt === "koth" ? all.slice(1) : all.slice(0, -2).reverse();
      const n = T.matches.length;
      if (n >= order.length + (T.fmt === "koth" ? 0 : 1)) return;
      const holder = last ? last.winner : T.fmt === "koth" ? all[0] : all[all.length - 1];
      const challenger = T.fmt === "koth" ? order[n] : n === 0 ? all[all.length - 2] : order[n - 1];
      if (challenger == null) return;
      const label = T.fmt === "koth" ? `Challenge ${n + 1} of ${order.length}` : (challenger === all[0] ? "The Gauntlet final" : `The Gauntlet · step ${n + 1}`);
      T.matches.push({ id: `${T.fmt === "koth" ? "K" : "G"}${n + 1}`, round: n + 1, slot: 0, bracket: T.fmt === "koth" ? "K" : "GT", label, a: { club: holder }, b: { club: challenger } });
    } else if (T.fmt === "groups" && !T.matches.some((m) => m.bracket === "W")) {
      const gm = T.matches.filter((m) => m.bracket === "G");
      if (!done(gm)) return;
      const adv = T.opt.advance || 2, firsts = [], rest = [];
      for (const g of T.groups) { const st = standings(T, g.clubs, (m) => m.group === g.name); st.slice(0, adv).forEach((x, i) => (i === 0 ? firsts : rest).push(x.club)); }
      const ko = buildSingle(firsts.concat(rest), { prefix: "K", kind: "" });
      T.matches.push(...ko.matches); T.final = ko.final;
    }
  }

  function createTournament(entries, fmt, opt) {
    const seeds = seeded(entries, opt.seeding || "signup"), clubs = seeds.map((s) => s.club);
    if (fmt === "double" && clubs.length < 3) fmt = "single";     // too few for a losers bracket
    if (fmt === "groups" && clubs.length < 6) fmt = "rr";         // too few for two groups
    const T = { fmt, opt, seeds, matches: [], groups: null, final: null, created: Date.now() };
    if (fmt === "single") Object.assign(T, buildSingle(clubs));
    else if (fmt === "double") Object.assign(T, buildDouble(clubs, { reset: opt.reset !== false }));
    else if (fmt === "rr") Object.assign(T, buildRR(clubs));
    else if (fmt === "groups") Object.assign(T, buildGroups(clubs, { size: opt.groupSize }));
    T.matches.forEach((m) => (m.bo = seriesFor(T, m)));
    settle(T); grow(T); T.matches.forEach((m) => (m.bo = m.bo || seriesFor(T, m))); settle(T);
    return T;
  }
  // Series length: the default (one game), with optional longer semis and finals.
  function seriesFor(T, m) {
    const s = T.opt.series || { def: 1 };
    const isFinal = /final$/i.test(m.label || "") && !/semi|quarter|losers/i.test(m.label || "") || m.bracket === "F";
    const isSemi = /semifinal/i.test(m.label || "");
    return (isFinal && s.final) || (isSemi && s.semi) || s.def || 1;
  }
  // After results change: settle, grow, and give new matches their series length.
  function advance(T) { settle(T); grow(T); T.matches.forEach((m) => (m.bo = m.bo || seriesFor(T, m))); settle(T); }
  function champion(T) {
    if (T.fmt === "rr" || T.fmt === "swiss") { const ms = T.matches; if (!ms.length || ms.some((m) => !m.winner && !m.void)) return null; if (T.fmt === "swiss") { const rounds = T.opt.swissRounds || Math.max(3, Math.ceil(Math.log2(T.seeds.length))); if (Math.max(...ms.map((m) => m.round)) < rounds) return null; } return standings(T, T.seeds.map((s) => s.club))[0].club; }
    if (T.fmt === "koth" || T.fmt === "gauntlet" || T.fmt === "survivor") { const pending = playable(T).length; if (pending) return null; const n = T.matches.length; const need = T.fmt === "koth" ? T.seeds.length - 1 : T.fmt === "gauntlet" ? T.seeds.length - 1 : 0; if (T.fmt !== "survivor" && n < need) return null; const last = T.matches[T.matches.length - 1]; if (T.fmt === "survivor") { const r = Math.max(...T.matches.map((m) => m.round)); const lastR = T.matches.filter((m) => m.round === r); return lastR.length === 1 && lastR[0].winner > 0 ? lastR[0].winner : null; } return last && last.winner; }
    const f = T.matches.find((m) => m.id === (T.fmt === "double" ? "GF2" : T.final));
    if (T.fmt === "double") { const gf = T.matches.find((m) => m.id === "GF"); if (f && f.void) return gf.winner; return f && f.winner || (T.opt.reset === false ? gf && gf.winner : null); }
    return f && f.winner;
  }


  // ===================== State =====================
  const DEF = { name: "SmallBall Tournament", sheet: "", entries: [], fmt: "single", opt: { seeding: "signup", series: { def: 1, semi: 0, final: 0 }, kind: "any", parks: "home", reset: true, groupSize: 4, advance: 2, swissRounds: 0, spoiler: true, autoSend: true }, T: null, start: 0, pulledAt: 0, used: {} };
  let S;
  try { S = Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || "{}")); S.opt = Object.assign({}, DEF.opt, S.opt || {}); S.opt.series = Object.assign({}, DEF.opt.series, S.opt.series || {}); } catch (_) { S = JSON.parse(JSON.stringify(DEF)); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) {} };
  const CLUB = (id) => S.entries.find((e) => e.club === id) || { club: id, name: id === BYE ? "BYE" : "Club " + id };

  // ===================== Sign-ups =====================
  // The Google Form's responses sheet, published to the web as CSV (File → Share → Publish to web → CSV).
  function parseCSV(text) {
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true; else if (c === ",") { row.push(cell); cell = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; } else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((x) => x.trim()));
  }
  function csvURL(u) {
    u = String(u || "").trim(); if (!u) return "";
    let m = /\/spreadsheets\/d\/e\/([^/]+)\/pub/.exec(u); if (m) return `https://docs.google.com/spreadsheets/d/e/${m[1]}/pub?output=csv${/gid=(\d+)/.test(u) ? "&gid=" + /gid=(\d+)/.exec(u)[1] : ""}`;
    m = /\/spreadsheets\/d\/([^/]+)/.exec(u); if (m) return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv${/gid=(\d+)/.test(u) ? "&gid=" + /gid=(\d+)/.exec(u)[1] : ""}`;
    return u;
  }
  // The sheet lives on Google, so the extension's background worker fetches it (no cross-site trouble).
  function fetchText(url) {
    return new Promise((resolve) => {
      try { if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) { chrome.runtime.sendMessage({ type: "csv", url }, (r) => resolve(r || { ok: false, status: 0 })); return; } } catch (_) {}
      fetch(url, { credentials: "omit" }).then(async (r) => resolve({ ok: r.ok, status: r.status, text: await r.text() })).catch(() => resolve({ ok: false, status: 0 }));
    });
  }
  async function pullSheet() {
    const url = csvURL(S.sheet); if (!url) throw new Error("Paste the sign-up sheet's link first.");
    const res = await fetchText(url); if (!res.ok) throw new Error(`The sheet answered ${res.status || "nothing"}. Make sure it's published to the web (or shared "anyone with the link").`);
    const text = res.text; if (/^\s*</.test(text)) throw new Error("That link gave back a web page, not the sheet's data. Publish the sheet to the web as CSV and paste that link.");
    const rows = parseCSV(text); if (rows.length < 2) return 0;
    const head = rows[0].map((h) => h.toLowerCase());
    const col = (re) => head.findIndex((h) => re.test(h));
    let ci = col(/club.*(#|num|no\b|id)|team.*(#|num|no\b|id)|club number|team number/); if (ci < 0) ci = col(/club|team/);
    const ti = col(/timestamp|submitted|time/), oi = col(/owner|your name|smallball name|nick|name/), di = col(/discord/), ni = col(/club name|team name/), nti = col(/note|message|trash|anything/);
    let added = 0;
    rows.slice(1).forEach((r, k) => {
      const raw = (r[ci] || r.find((x) => /^\s*#?\d{2,7}\s*$/.test(x)) || "").trim();
      const club = Number((/(\d{2,7})/.exec(raw) || [])[1]); if (!club) return;
      if (S.entries.some((e) => e.club === club)) return;
      const signed = ti >= 0 && Date.parse(r[ti]) ? Date.parse(r[ti]) : Date.now() + k;
      S.entries.push({ club, name: ni >= 0 && ni !== oi ? (r[ni] || "").trim() : "", owner: oi >= 0 && oi !== ci && oi !== ni ? (r[oi] || "").trim() : "", discord: di >= 0 ? (r[di] || "").trim() : "", note: nti >= 0 ? (r[nti] || "").trim().slice(0, 140) : "", signed, src: "form" });
      added++;
    });
    S.pulledAt = Date.now(); save(); await checkClubs(); return added;
  }
  async function checkClubs() {
    for (const e of S.entries) {
      if (e.checked && Date.now() - e.checked < 30 * 60e3) continue;
      try { const p = await getJSON(`/teams/${e.club}/profile`); e.name = cleanName(p.name) || e.name || "Club " + e.club; e.stars = p.stars; e.star10 = p.star10; e.ok = true; }
      catch (_) { e.ok = false; }
      e.checked = Date.now(); save(); if (isOpen()) paint(); await sleep(250);
    }
  }

  // ===================== Results from real games =====================
  // A match is decided by games between its two clubs played after it opened (after the tournament started,
  // for the first round). Each game counts once. A tie doesn't count; replay it.
  const watchedBC = () => { try { return (JSON.parse(localStorage.getItem("tk-state-v1") || "{}").watched) || {}; } catch (_) { return {}; } };
  let checking = false;
  async function checkResults() {
    const T = S.T; if (!T || checking) return 0;
    checking = true; let changed = 0;
    try {
      const open = playable(T); const cache = {};
      for (const m of open) {
        const a = sideClub(T, m.a), b = sideClub(T, m.b);
        if (!cache[a]) { try { cache[a] = (await getJSON(`/games/all?club=${a}`)).rows || []; } catch (_) { cache[a] = []; } await sleep(300); }
        const since = Math.max(S.start || 0, (m.openAt || 0) - 120e3);
        const games = cache[a].filter((g) => ((g.home_team_id === a && g.away_team_id === b) || (g.home_team_id === b && g.away_team_id === a)) && Date.parse(g.finished_at) >= since && !S.used[g.game_id] && (S.opt.kind === "any" || (S.opt.kind === "official" ? g.kind !== "exhibition" : g.kind === S.opt.kind)))
          .sort((x, y) => Date.parse(x.finished_at) - Date.parse(y.finished_at));
        m.games = m.games || [];
        for (const g of games) {
          const ra = g.home_team_id === a ? g.home_runs : g.away_runs, rb = g.home_team_id === a ? g.away_runs : g.home_runs;
          S.used[g.game_id] = m.id;
          if (ra === rb) { m.games.push({ id: g.game_id, tie: true, at: g.finished_at }); continue; }
          m.games.push({ id: g.game_id, w: ra > rb ? a : b, ra, rb, at: g.finished_at });
          handOff([{ game: g.game_id, label: m.label }]);
          const need = Math.ceil((m.bo || 1) / 2), wa = m.games.filter((x) => x.w === a).length, wb = m.games.filter((x) => x.w === b).length;
          if (wa >= need || wb >= need) {
            m.winner = wa >= need ? a : b; m.loser = m.winner === a ? b : a;
            m.runs = [m.games.reduce((s, x) => s + (x.ra || 0), 0), m.games.reduce((s, x) => s + (x.rb || 0), 0)];
            m.decidedAt = Date.now(); changed++; break;
          }
        }
      }
      if (changed) { advance(T); parkUp(T); if (S.opt.autoSend) sendClubs(true); }
      save(); if (isOpen()) paint();
    } finally { checking = false; }
    return changed;
  }
  // Scans keep running in a background tab (Chrome slows timers there to about once a minute, which is fine).
  setInterval(() => { if (S.T && !champion(S.T)) checkResults(); }, 45e3);
  setTimeout(() => { if (S.T && !champion(S.T)) checkResults(); }, 5000);

  // ===================== Hand-off to the Broadcast Kit =====================
  // Both kits run on this page and share its storage: leave clubs and games in the inbox, then bump an
  // attribute on <html> so the Broadcast Kit picks them up right away.
  function handOff(items) {
    if (!S.opt.autoSend && !items.force) return;
    let box; try { box = JSON.parse(localStorage.getItem("sbx-bcast-inbox") || "null"); } catch (_) {} box = box && Array.isArray(box.items) ? box : { items: [] };
    box.items.push(...items.map((x) => Object.assign({ tourney: S.name }, x))); box.at = Date.now();
    try { localStorage.setItem("sbx-bcast-inbox", JSON.stringify(box)); } catch (_) {}
    document.documentElement.setAttribute("data-sbx-inbox", String(Date.now()));
  }
  function sendClubs(quiet) {
    const live = S.T ? new Set(playable(S.T).flatMap((m) => [sideClub(S.T, m.a), sideClub(S.T, m.b)])) : null;
    const items = S.entries.filter((e) => e.ok !== false && (!live || live.has(e.club))).map((e) => ({ club: e.club, name: e.name, since: S.start || Date.now() }));
    if (items.length) { const arr = items; if (!quiet) arr.force = true; handOff(arr); }
    return items.length;
  }

  // ===================== Spoiler-safe view =====================
  // A result stays hidden until you've watched its games in the Broadcast Kit, and so does everything it decides.
  function hiddenMatch(m) { if (!S.opt.spoiler || !m.winner || m.bye) return false; const w = watchedBC(); return (m.games || []).some((g) => !g.tie && !w[g.id]); }
  const GROW = ["swiss", "survivor", "koth", "gauntlet"];
  function depHidden(T, m, seen = new Set()) {
    if (!S.opt.spoiler || seen.has(m.id)) return false; seen.add(m.id);
    for (const sd of [m.a, m.b]) { if (sd && sd.from) { const src = T.matches.find((x) => x.id === sd.from); if (src && (hiddenMatch(src) || depHidden(T, src, seen))) return true; } }
    if (GROW.includes(T.fmt) && T.matches.some((x) => x.round < m.round && hiddenMatch(x))) return true;
    if (T.fmt === "groups" && m.bracket === "W" && T.matches.some((x) => x.bracket === "G" && hiddenMatch(x))) return true;
    return false;
  }
  function shownSide(T, side) {
    if (!side) return { club: null };
    if (side.club != null) return { club: side.club };
    const src = T.matches.find((x) => x.id === side.from);
    if (!src) return { club: null };
    if (!src.winner) return { club: null, wait: `${side.take === "L" ? "Loser" : "Winner"} of ${src.label || src.id}` };
    if (hiddenMatch(src)) return { club: null, wait: `${side.take === "L" ? "Loser" : "Winner"} of ${src.label || src.id}`, hidden: true };
    return { club: side.take === "L" ? src.loser : src.winner };
  }

  // ===================== UI =====================
  const css = `
    #tt-launch { position: fixed; left: 16px; bottom: 66px; z-index: 2147483000; display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 999px; border: 0; background: linear-gradient(135deg,#b45309,#f59e0b); color: #1c1917; font: 800 14px/1 system-ui, sans-serif; cursor: pointer; box-shadow: 0 6px 20px rgba(0,0,0,.35); }
    /* SmallBall's own stylesheet uses some of the same class names (.note, .row, .tag, .b, .seg, .vs, .at, .go):
       undo its styling inside the kit's window first, then the kit's own rules below apply. */
    #tt-ov :is(.b, .note, .tag, .vs, .at, .seg, .go, .row) { all: revert; }
    #tt-ov { position: fixed; inset: 0; z-index: 2147483001; background: radial-gradient(1200px 600px at 20% -10%, #1e293b, #0b1120 60%); color: #e2e8f0; font: 14px/1.4 system-ui, sans-serif; display: flex; flex-direction: column; }
    #tt-ov * { box-sizing: border-box; }
    #tt-ov header { display: flex; align-items: center; gap: 12px; padding: 12px 18px; border-bottom: 1px solid #334155; background: rgba(15,23,42,.8); }
    #tt-ov header .logo { font-size: 22px; } #tt-ov header input.tname { background: transparent; border: 0; color: #fde68a; font: 800 20px system-ui; min-width: 260px; }
    #tt-ov nav { display: flex; gap: 4px; margin-left: 10px; } #tt-ov nav button { background: transparent; color: #94a3b8; border: 0; padding: 8px 12px; border-radius: 8px; font: 700 13px system-ui; cursor: pointer; }
    #tt-ov nav button.on { background: #f59e0b; color: #1c1917; }
    #tt-ov .sp { flex: 1; } #tt-ov .pill { padding: 3px 10px; border-radius: 999px; font: 800 11px system-ui; background: #334155; } #tt-ov .pill.live { background: #16a34a; color: #fff; } #tt-ov .pill.done { background: #f59e0b; color: #1c1917; }
    #tt-ov .x { background: #334155; color: #fff; border: 0; padding: 8px 14px; border-radius: 8px; cursor: pointer; font-weight: 700; }
    #tt-ov main { flex: 1; overflow: auto; padding: 18px 22px 60px; }
    #tt-ov h2 { margin: 0 0 4px; font: 800 18px system-ui; color: #fde68a; } #tt-ov h3 { margin: 18px 0 8px; font: 800 14px system-ui; color: #fbbf24; text-transform: uppercase; letter-spacing: .06em; }
    #tt-ov .note { color: #94a3b8; font-size: 12.5px; } #tt-ov .err { color: #fca5a5; } #tt-ov .ok { color: #86efac; }
    #tt-ov .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 8px 0; }
    #tt-ov input[type=text], #tt-ov input[type=number], #tt-ov input[type=datetime-local], #tt-ov select { background: #0f172a; color: #e2e8f0; border: 1px solid #334155; border-radius: 8px; padding: 7px 10px; font: inherit; }
    #tt-ov input.wide { flex: 1; min-width: 320px; }
    #tt-ov button.b { background: #1e293b; color: #e2e8f0; border: 1px solid #475569; border-radius: 8px; padding: 7px 12px; font: 700 13px system-ui; cursor: pointer; } #tt-ov button.b:hover { border-color: #f59e0b; }
    #tt-ov button.go { background: #f59e0b; color: #1c1917; border-color: #f59e0b; } #tt-ov button.red { border-color: #b91c1c; color: #fecaca; }
    #tt-ov table { border-collapse: collapse; width: 100%; } #tt-ov th, #tt-ov td { text-align: left; padding: 7px 8px; border-bottom: 1px solid #1e293b; } #tt-ov th { color: #94a3b8; font-size: 11.5px; text-transform: uppercase; letter-spacing: .05em; }
    #tt-ov .fmts { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
    #tt-ov .fmt { border: 1px solid #334155; border-radius: 12px; padding: 12px; cursor: pointer; background: rgba(30,41,59,.6); } #tt-ov .fmt b { display: block; color: #fde68a; margin-bottom: 4px; } #tt-ov .fmt.on { border-color: #f59e0b; box-shadow: 0 0 0 2px rgba(245,158,11,.35); background: rgba(120,53,15,.35); }
    #tt-ov .seg { display: inline-flex; border: 1px solid #475569; border-radius: 9px; overflow: hidden; } #tt-ov .seg button { background: transparent; color: #cbd5e1; border: 0; padding: 7px 11px; font: 700 12.5px system-ui; cursor: pointer; } #tt-ov .seg button.on { background: #f59e0b; color: #1c1917; }
    #tt-ov .bracket { display: flex; gap: 26px; align-items: stretch; overflow-x: auto; padding-bottom: 12px; }
    #tt-ov .col { display: flex; flex-direction: column; gap: 10px; min-width: 230px; }
    #tt-ov .col > .cm { flex: 1; display: flex; flex-direction: column; justify-content: space-around; gap: 14px; }
    #tt-ov .col > .rt { font: 800 11.5px system-ui; color: #fbbf24; text-transform: uppercase; letter-spacing: .07em; text-align: center; }
    #tt-ov .m { border: 1px solid #334155; border-radius: 10px; background: #0f172a; overflow: hidden; position: relative; }
    #tt-ov .m .lab { font-size: 10.5px; color: #64748b; padding: 4px 9px 0; display: flex; justify-content: space-between; }
    #tt-ov .m .sd { display: flex; align-items: center; gap: 7px; padding: 6px 9px; } #tt-ov .m .sd + .sd { border-top: 1px solid #1e293b; }
    #tt-ov .m .sd .seed { width: 20px; color: #64748b; font-size: 11px; text-align: right; } #tt-ov .m .sd .nm { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } #tt-ov .m .sd .st { color: #f59e0b; font-size: 11px; }
    #tt-ov .m .sd.w { background: rgba(22,163,74,.18); } #tt-ov .m .sd.w .nm { font-weight: 800; color: #bbf7d0; } #tt-ov .m .sd.l .nm { color: #64748b; text-decoration: line-through; }
    #tt-ov .m .sd .wait { color: #64748b; font-style: italic; font-size: 12px; } #tt-ov .m .wins { font: 800 12px system-ui; color: #fde68a; }
    #tt-ov .m.live { border-color: #16a34a; } #tt-ov .m.hid { border-style: dashed; } #tt-ov .m .hidn { font-size: 11px; color: #93c5fd; padding: 3px 9px 6px; }
    #tt-ov .champ { margin: 14px 0; padding: 16px; border-radius: 14px; background: linear-gradient(135deg, rgba(180,83,9,.4), rgba(245,158,11,.2)); border: 1px solid #f59e0b; font: 800 18px system-ui; color: #fde68a; }
    #tt-ov .card2 { border: 1px solid #334155; border-radius: 12px; padding: 12px 14px; background: rgba(15,23,42,.7); margin-bottom: 10px; }
    #tt-ov .vs { display: flex; align-items: center; gap: 10px; font: 700 15px system-ui; } #tt-ov .vs .at { color: #64748b; font-size: 12px; }
    #tt-ov .tag { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #334155; font: 700 11px system-ui; margin-right: 4px; } #tt-ov .tag.gold { background: #78350f; color: #fde68a; }
    #tt-ov textarea { width: 100%; min-height: 260px; background: #0f172a; color: #e2e8f0; border: 1px solid #334155; border-radius: 10px; padding: 10px; font: 12.5px/1.45 ui-monospace, monospace; }
    #tt-ov .grid2 { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; }
  `;
  let ov = null, tab = "signups", msg = "";
  const isOpen = () => !!ov;
  function open() {
    if (ov) return;
    ov = document.createElement("div"); ov.id = "tt-ov";
    ov.innerHTML = `<style>${css}</style><header><span class="logo">🏆</span><input class="tname" value="${esc(S.name)}" title="Tournament name"><nav>
      ${[["signups", "Sign-ups"], ["setup", "Setup"], ["bracket", "Bracket"], ["matches", "Matches"], ["share", "Share"]].map(([k, l]) => `<button data-tab="${k}">${l}</button>`).join("")}</nav>
      <span class="sp"></span><span class="pill" data-k="status"></span><button class="x" data-act="close">Close</button></header><main></main>`;
    document.body.appendChild(ov); document.documentElement.style.overflow = "hidden";
    ov.querySelector(".tname").oninput = (e) => { S.name = e.target.value; save(); };
    ov.addEventListener("click", onClick); ov.addEventListener("change", onChange);
    if (S.T) checkResults();
    paint();
  }
  function close() { if (!ov) return; ov.remove(); ov = null; document.documentElement.style.overflow = ""; }

  function status() {
    if (!S.T) return ["Sign-ups", ""];
    const ch = champion(S.T); if (ch && !hiddenChampion()) return ["Champion crowned", "done"];
    return ["Live", "live"];
  }
  const hiddenChampion = () => { const T = S.T; if (!T) return false; const last = T.matches.filter((m) => m.winner).sort((a, b) => (b.decidedAt || 0) - (a.decidedAt || 0))[0]; return last && hiddenMatch(last); };

  function paint() {
    if (!ov) return;
    ov.querySelectorAll("nav button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
    const [st, cls] = status(); const pill = ov.querySelector("[data-k=status]"); pill.textContent = st; pill.className = "pill " + cls;
    const main = ov.querySelector("main");
    main.innerHTML = tab === "signups" ? viewSignups() : tab === "setup" ? viewSetup() : tab === "bracket" ? viewBracket() : tab === "matches" ? viewMatches() : viewShare();
  }

  function viewSignups() {
    const ok = S.entries.filter((e) => e.ok !== false).length;
    return `<h2>Sign-ups</h2><p class="note">Clubs come in from your Google Form's responses sheet. Seeds follow the order on the Setup tab (sign-up order by default, the way it was done back in the day).</p>
      <div class="row"><input type="text" class="wide" data-k="sheet" placeholder="Sign-up sheet link (the form's responses sheet, published to the web as CSV)" value="${esc(S.sheet)}"><button class="b go" data-act="pull">Pull sign-ups</button></div>
      <div class="row"><input type="number" data-k="addclub" placeholder="Club #" style="width:120px"><input type="text" data-k="addowner" placeholder="Owner (optional)"><button class="b" data-act="add">Add a club by hand</button>
        <span class="sp"></span><span class="note">${S.pulledAt ? `Last pulled ${new Date(S.pulledAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}</span></div>
      ${msg ? `<p class="${/^✓/.test(msg) ? "ok" : "err"}">${esc(msg)}</p>` : ""}
      <h3>${ok} club${ok === 1 ? "" : "s"} in${S.entries.length - ok ? ` · ${S.entries.length - ok} to fix` : ""}</h3>
      <table><tr><th>#</th><th>Club</th><th>No.</th><th>Stars</th><th>Owner</th><th>Discord</th><th>Signed up</th><th></th></tr>
      ${S.entries.slice().sort((a, b) => a.signed - b.signed).map((e, i) => `<tr><td>${i + 1}</td><td>${e.ok === false ? `<span class="err">Club not found</span>` : `<a href="#/team/${e.club}" style="color:#e2e8f0">${esc(e.name || "…")}</a>`}</td><td>${e.club}</td><td>${e.star10 != null ? e.star10 + "★" : ""}</td><td>${esc(e.owner || "")}</td><td>${esc(e.discord || "")}</td>
        <td class="note">${new Date(e.signed).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td><td><button class="b red" data-act="drop" data-club="${e.club}" ${S.T ? "disabled title='The bracket is built'" : ""}>Remove</button></td></tr>`).join("")}</table>`;
  }

  function seg(key, vals, cur) { return `<span class="seg" data-seg="${key}">${vals.map(([v, l]) => `<button data-v="${v}" class="${String(cur) === String(v) ? "on" : ""}">${l}</button>`).join("")}</span>`; }
  function viewSetup() {
    const o = S.opt, n = S.entries.filter((e) => e.ok !== false).length, f = S.fmt;
    const extra = f === "double" ? `<div class="row"><label><input type="checkbox" data-opt="reset" ${o.reset ? "checked" : ""}> Bracket reset: if the losers-bracket champ wins the grand final, play it again</label></div>`
      : f === "groups" ? `<div class="row">Group size ${seg("groupSize", [[3, "3"], [4, "4"], [5, "5"], [6, "6"]], o.groupSize)} &nbsp; Advance from each group ${seg("advance", [[1, "1"], [2, "2"], [3, "3"]], o.advance)}</div>`
      : f === "swiss" ? `<div class="row">Rounds ${seg("swissRounds", [[0, `Auto (${Math.max(3, Math.ceil(Math.log2(Math.max(2, n))))})`], [3, "3"], [4, "4"], [5, "5"], [6, "6"], [7, "7"]], o.swissRounds)}</div>` : "";
    const warn = (f === "double" && n < 3) ? "Double elimination needs 3+ clubs; it'll run as single elimination." : (f === "groups" && n < 6) ? "Groups need 6+ clubs; it'll run as a round robin." : "";
    return `<h2>Setup</h2><p class="note">${n} club${n === 1 ? "" : "s"} signed up. Pick a format, then build the bracket.</p>
      <h3>Format</h3><div class="fmts">${Object.entries(FORMATS).map(([k, v]) => `<div class="fmt ${f === k ? "on" : ""}" data-fmt="${k}"><b>${v.name}</b><span class="note">${v.blurb}</span></div>`).join("")}</div>
      ${extra}${warn ? `<p class="err">${warn}</p>` : ""}
      <h3>Series</h3><div class="row">Every match ${seg("def", [[1, "One game"], [3, "Best of 3"], [5, "Best of 5"], [7, "Best of 7"]], o.series.def)}</div>
      <div class="row">Semifinals ${seg("semi", [[0, "Same"], [3, "Best of 3"], [5, "Best of 5"]], o.series.semi)} &nbsp; Final ${seg("final", [[0, "Same"], [3, "Best of 3"], [5, "Best of 5"], [7, "Best of 7"]], o.series.final)}</div>
      <h3>Seeding</h3><div class="row">${seg("seeding", [["signup", "Sign-up order (the classic)"], ["stars", "Stars, high to low"], ["starsLow", "Underdogs first"], ["random", "Random draw"]], o.seeding)}</div>
      <h3>Games that count</h3><div class="row">${seg("kind", [["any", "Any game"], ["exhibition", "Exhibitions only"], ["official", "Official games only"]], o.kind)}</div>
      <div class="row">Parks ${seg("parks", [["home", "Higher seed's home park"], ["roulette", "Park Roulette (a random park per match, for exhibitions)"]], o.parks)}</div>
      <p class="note">Owners play their own matches on SmallBall as usual. The kit finds the game between the two clubs after the tournament starts and moves the winner on.</p>
      <h3>Watch-along</h3>
      <div class="row"><label><input type="checkbox" data-opt="spoiler" ${o.spoiler ? "checked" : ""}> Spoiler-safe bracket: hide a result until its game is watched in the Broadcast Kit</label></div>
      <div class="row"><label><input type="checkbox" data-opt="autoSend" ${o.autoSend ? "checked" : ""}> Send tournament clubs and games to the Broadcast Kit's queue automatically</label></div>
      <h3>Start</h3><div class="row"><button class="b go" data-act="build">${S.T ? "Rebuild the bracket (starts over)" : "Build the bracket and start"}</button>${S.T ? `<span class="note">Started ${new Date(S.start).toLocaleString()}</span>` : ""}</div>`;
  }

  function sideHTML(T, m, side, which) {
    if (depHidden(T, m)) return `<div class="sd"><span class="seed"></span><span class="wait">🙈 decided by unwatched games</span></div>`;
    const s = shownSide(T, side), c = s.club;
    if (c == null) return `<div class="sd"><span class="seed"></span><span class="wait">${esc(s.wait || "TBD")}</span></div>`;
    if (c === BYE) return `<div class="sd l"><span class="seed"></span><span class="nm">bye</span></div>`;
    const e = CLUB(c), seed = (T.seeds.find((x) => x.club === c) || {}).seed;
    const res = m.winner && !hiddenMatch(m) ? (m.winner === c ? "w" : "l") : "";
    const wins = (m.games || []).filter((g) => g.w === c && (!S.opt.spoiler || watchedBC()[g.id])).length;
    return `<div class="sd ${res}"><span class="seed">${seed || ""}</span><span class="nm" title="${esc(e.name)} (#${c})">${esc(e.name)}</span>${e.star10 != null ? `<span class="st">${e.star10}★</span>` : ""}${(m.bo || 1) > 1 ? `<span class="wins">${wins}</span>` : ""}</div>`;
  }
  function matchHTML(T, m) {
    if (m.void) return "";
    const hid = hiddenMatch(m), live = !m.winner && sideClub(T, m.a) > 0 && sideClub(T, m.b) > 0;
    return `<div class="m ${live ? "live" : ""} ${hid ? "hid" : ""}"><div class="lab"><span>${esc(m.label || m.id)}</span><span>${[(m.bo || 1) > 1 ? "Bo" + m.bo : "", m.park && !m.bye && S.opt.parks === "roulette" ? esc(PARKS[m.park] || "") : ""].filter(Boolean).join(" · ")}</span></div>${sideHTML(T, m, m.a)}${sideHTML(T, m, m.b)}${hid ? `<div class="hidn">🙈 Played. Watch it in the Broadcast Kit to reveal.</div>` : ""}</div>`;
  }
  function columns(T, ms, key) {
    const rounds = [...new Set(ms.map((m) => m.round))].sort((a, b) => a - b);
    return `<div class="bracket">${rounds.map((r) => { const col = ms.filter((m) => m.round === r && !m.void).sort((a, b) => a.slot - b.slot); if (!col.length) return ""; const name = (col[0].label || "").split(" · ")[0]; return `<div class="col"><div class="rt">${esc(name)}</div><div class="cm">${col.map((m) => matchHTML(T, m)).join("")}</div></div>`; }).join("")}</div>`;
  }
  function table(T, clubs, filter) {
    const st = standings(T, clubs, filter), w = watchedBC();
    if (S.opt.spoiler && T.matches.some((m) => (!filter || filter(m)) && hiddenMatch(m))) return `<p class="note">🙈 Standings are hidden until every played game here has been watched in the Broadcast Kit.</p>`;
    return `<table><tr><th>#</th><th>Club</th><th>W</th><th>L</th><th>Run diff</th></tr>${st.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(CLUB(x.club).name)}</td><td>${x.w}</td><td>${x.l}</td><td>${x.rf - x.ra > 0 ? "+" : ""}${x.rf - x.ra}</td></tr>`).join("")}</table>`;
  }
  function viewBracket() {
    const T = S.T; if (!T) return `<h2>Bracket</h2><p class="note">Build it on the Setup tab.</p>`;
    const ch = champion(T), chShow = ch && !hiddenChampion();
    let out = `<h2>${esc(FORMATS[T.fmt].name)}</h2><p class="note">${T.seeds.length} clubs · seeded by ${{ signup: "sign-up order", stars: "stars", starsLow: "underdogs first", random: "random draw" }[T.opt.seeding] || "sign-up order"} · ${(T.opt.series.def || 1) > 1 ? "best of " + T.opt.series.def : "one game"} a match${T.opt.series.semi ? `, best of ${T.opt.series.semi} semis` : ""}${T.opt.series.final ? `, best of ${T.opt.series.final} final` : ""}${T.opt.parks === "roulette" ? " · Park Roulette" : ""}</p>`;
    if (chShow) out += `<div class="champ">🏆 Champion: ${esc(CLUB(ch).name)} (#${ch})</div>`;
    if (T.fmt === "single" || T.fmt === "survivor") out += columns(T, T.matches);
    else if (T.fmt === "double") out += `<h3>Winners bracket</h3>${columns(T, T.matches.filter((m) => m.bracket === "W"))}<h3>Losers bracket</h3>${columns(T, T.matches.filter((m) => m.bracket === "L"))}<h3>Grand final</h3>${columns(T, T.matches.filter((m) => m.bracket === "F"))}`;
    else if (T.fmt === "rr") out += `<h3>Standings</h3>${table(T, T.seeds.map((s) => s.club))}<h3>Rounds</h3>${columns(T, T.matches)}`;
    else if (T.fmt === "swiss") out += `<h3>Standings</h3>${table(T, T.seeds.map((s) => s.club))}<h3>Rounds</h3>${columns(T, T.matches)}`;
    else if (T.fmt === "groups") out += `<div class="grid2">${T.groups.map((g) => `<div class="card2"><h3 style="margin-top:0">Group ${g.name}</h3>${table(T, g.clubs, (m) => m.group === g.name)}</div>`).join("")}</div><h3>Group games</h3>${columns(T, T.matches.filter((m) => m.bracket === "G"))}${T.matches.some((m) => m.bracket === "W") ? `<h3>Knockout</h3>${columns(T, T.matches.filter((m) => m.bracket === "W"))}` : `<p class="note">The knockout bracket appears when the groups are done.</p>`}`;
    else if (T.fmt === "koth") {
      const holder = (() => { const done = T.matches.filter((m) => m.winner && !hiddenMatch(m)); return done.length ? done[done.length - 1].winner : T.seeds[0].club; })();
      const reigns = {}; let cur = T.seeds[0].club, run = 0; for (const m of T.matches.filter((x) => x.winner && !hiddenMatch(x))) { if (m.winner === cur) run++; else { cur = m.winner; run = 0; } reigns[cur] = Math.max(reigns[cur] || 0, run); }
      const best = Object.entries(reigns).sort((a, b) => b[1] - a[1])[0];
      out += `<div class="card2"><div class="vs">⛰️ On the hill: ${esc(CLUB(holder).name)}</div>${best && best[1] ? `<p class="note">Longest reign: ${esc(CLUB(+best[0]).name)}, ${best[1]} defense${best[1] === 1 ? "" : "s"}</p>` : ""}<p class="note">Still to challenge: ${T.seeds.slice(T.matches.length + 1).map((s) => esc(CLUB(s.club).name)).join(", ") || "nobody"}</p></div>${columns(T, T.matches)}`;
    } else if (T.fmt === "gauntlet") out += `<p class="note">Climbing order: ${T.seeds.slice().reverse().map((s) => `${s.seed}. ${esc(CLUB(s.club).name)}`).join(" → ")}</p>${columns(T, T.matches)}`;
    return out;
  }
  function viewMatches() {
    const T = S.T; if (!T) return `<h2>Matches</h2><p class="note">Build the bracket on the Setup tab.</p>`;
    const up = playable(T);
    const done = T.matches.filter((m) => m.winner && !m.bye).sort((a, b) => (b.decidedAt || 0) - (a.decidedAt || 0));
    const card = (m) => { const a = sideClub(T, m.a), b = sideClub(T, m.b), A = CLUB(a), B = CLUB(b), need = Math.ceil((m.bo || 1) / 2);
      const home = m.park && S.opt.parks === "roulette" ? `Exhibition at ${PARKS[m.park]}` : `at ${esc(A.name)}'s park`;
      return `<div class="card2"><div class="row" style="margin:0 0 6px"><span class="tag gold">${esc(m.label || m.id)}</span><span class="tag">${(m.bo || 1) > 1 ? `Best of ${m.bo} (first to ${need})` : "One game"}</span><span class="tag">${home}</span></div>
        <div class="vs">${esc(B.name)} <span class="note">#${b}${B.star10 != null ? " · " + B.star10 + "★" : ""}</span> <span class="at">at</span> ${esc(A.name)} <span class="note">#${a}${A.star10 != null ? " · " + A.star10 + "★" : ""}</span></div>
        ${(m.games || []).length ? `<p class="note">${m.games.length} game${m.games.length === 1 ? "" : "s"} found so far${m.games.some((g) => g.tie) ? " (a tie doesn't count; replay it)" : ""}: ${m.games.map((g) => `<a href="/training?watch=${g.id}" target="_blank" rel="noopener">#${g.id}</a>`).join(" ")}</p>` : ""}
        <div class="row"><button class="b" data-act="callout" data-m="${m.id}">Copy the call-out</button><button class="b" data-act="watch" data-m="${m.id}">📺 Clubs to Broadcast</button>
          <span class="sp"></span><span class="note">Settle it by hand:</span><button class="b" data-act="setw" data-m="${m.id}" data-w="${a}">${esc(A.name)} wins</button><button class="b" data-act="setw" data-m="${m.id}" data-w="${b}">${esc(B.name)} wins</button></div></div>`; };
    return `<h2>Matches</h2><p class="note">Organizer view: this tab shows who plays next, which can give away earlier results. The Bracket and Share tabs stay spoiler-safe.</p><div class="row"><button class="b go" data-act="check">Check for results now</button><button class="b" data-act="sendall">📺 Send all live clubs to Broadcast</button><button class="b" data-act="copyids">📋 Copy game IDs</button><span class="note">The kit checks every 45 seconds or so while a SmallBall tab is open, even in the background. A game counts as soon as either club starts it.</span></div>
      <h3>Up now (${up.length})</h3>${up.map(card).join("") || `<p class="note">${champion(T) ? "That's the tournament!" : "Waiting on results."}</p>`}
      <h3>Done</h3>${done.map((m) => `<div class="card2"><span class="tag gold">${esc(m.label || m.id)}</span> ${(m.games || []).length ? `<span class="note">${m.games.map((g) => `<a href="/training?watch=${g.id}" target="_blank" rel="noopener">#${g.id}</a>`).join(" ")}</span> ` : ""}${hiddenMatch(m) ? `<span class="note">🙈 Result hidden until watched</span>` : `<b>${esc(CLUB(m.winner).name)}</b> over ${esc(CLUB(m.loser).name)}${(m.bo || 1) > 1 ? ` (${m.games.filter((g) => g.w === m.winner).length}–${m.games.filter((g) => g.w === m.loser).length})` : ""} <button class="b red" data-act="undo" data-m="${m.id}" style="float:right">Undo</button>`}</div>`).join("") || `<p class="note">Nothing yet.</p>`}`;
  }
  // Every tournament game found so far, in the order they were played.
  const allIds = () => (S.T ? S.T.matches.flatMap((m) => (m.games || []).map((g) => [g.at, g.id])).sort((x, y) => String(x[0]).localeCompare(String(y[0]))).map((x) => x[1]) : []);
  // A bracket code: the whole tournament (clubs, format, bracket and games found) in one line of text. Paste
  // it into anyone's Tournament Kit (Share tab → Load a bracket code) and they get the same bracket, which
  // keeps itself up to date from the games on SmallBall, with results hidden until they've watched them.
  const toCode = () => "SBT1:" + btoa(unescape(encodeURIComponent(JSON.stringify({ n: S.name, f: S.fmt, o: S.opt, e: S.entries, T: S.T, s: S.start, u: S.used }))));
  function fromCode(c) { const m = /SBT1:([A-Za-z0-9+/=]+)/.exec(String(c || "")); if (!m) throw new Error("That isn't a bracket code (they start with SBT1:)."); const d = JSON.parse(decodeURIComponent(escape(atob(m[1])))); if (!d.T || !Array.isArray(d.e)) throw new Error("That code has no bracket in it."); return d; }
  function shareText() {
    const T = S.T; if (!T) return "Build the bracket first.";
    const L = [`🏆 ${S.name} · ${FORMATS[T.fmt].name} · ${T.seeds.length} clubs`, ""];
    const ch = champion(T); if (ch && !hiddenChampion()) L.push(`👑 CHAMPION: ${CLUB(ch).name} (#${ch})`, "");
    const up = playable(T);
    if (up.length) { L.push("⚾ UP NOW"); for (const m of up) { if (depHidden(T, m)) { L.push(`• ${m.label}: ||matchup hidden, watch the earlier games first||`); continue; } const a = sideClub(T, m.a), b = sideClub(T, m.b); L.push(`• ${m.label}: ${CLUB(b).name} (#${b}) at ${CLUB(a).name} (#${a})${(m.bo || 1) > 1 ? ` · best of ${m.bo}` : ""}${m.park && S.opt.parks === "roulette" ? ` · ${PARKS[m.park]}` : ""}`); } L.push(""); }
    const done = T.matches.filter((m) => m.winner && !m.bye);
    if (done.length) { L.push("✅ RESULTS"); for (const m of done) L.push(hiddenMatch(m) ? `• ${m.label}: ||result hidden, watch it first||` : `• ${m.label}: ${CLUB(m.winner).name} over ${CLUB(m.loser).name}`); L.push(""); }
    const ids = allIds(); if (ids.length) L.push("🎬 Game IDs (paste into the Broadcast Kit's Add games box): " + ids.join(", "), "");
    L.push("Seeds: " + T.seeds.map((s) => `${s.seed}. ${CLUB(s.club).name}`).join(" · "));
    return L.join("\n");
  }
  function viewShare() {
    return `<h2>Share</h2><p class="note">Paste into Discord. With the spoiler-safe bracket on, results you haven't watched stay hidden here too.</p>
      <div class="row"><button class="b go" data-act="copyshare">Copy</button></div><textarea readonly>${esc(shareText())}</textarea>
      <h3>Share the bracket</h3><p class="note">A bracket code is the whole tournament in one line. Anyone with the Tournament Kit can load it and follow along: their copy finds new games on its own, and results stay hidden until they've watched them.</p>
      <div class="row"><button class="b go" data-act="copycode">📋 Copy bracket code</button><span class="note">${S.T ? `${toCode().length.toLocaleString()} characters` : ""}</span></div>
      <h3>Load a bracket code</h3><div class="row"><input data-k="code" placeholder="Paste a code that starts with SBT1:" style="flex:1"><button class="b" data-act="loadcode">Load</button></div><p class="note">Loading replaces the tournament on this computer.</p>`;
  }

  async function onClick(e) {
    const t = e.target.closest("button, .fmt"); if (!t) return;
    if (t.dataset.tab) { tab = t.dataset.tab; msg = ""; paint(); return; }
    if (t.classList.contains("fmt")) { S.fmt = t.dataset.fmt; save(); paint(); return; }
    const sg = t.closest(".seg");
    if (sg && t.dataset.v != null) {
      const k = sg.dataset.seg, v = /^-?\d+$/.test(t.dataset.v) ? Number(t.dataset.v) : t.dataset.v;
      if (["def", "semi", "final"].includes(k)) S.opt.series[k] = v; else S.opt[k] = v;
      save(); paint(); return;
    }
    const act = t.dataset.act, T = S.T, m = T && t.dataset.m ? T.matches.find((x) => x.id === t.dataset.m) : null;
    if (act === "close") close();
    else if (act === "pull") { msg = "Pulling…"; paint(); try { const n = await pullSheet(); msg = `✓ ${n} new sign-up${n === 1 ? "" : "s"}.`; } catch (err) { msg = String(err.message || err); } paint(); }
    else if (act === "add") { const id = Number(ov.querySelector("[data-k=addclub]").value); if (!id) return; if (!S.entries.some((x) => x.club === id)) S.entries.push({ club: id, owner: ov.querySelector("[data-k=addowner]").value.trim(), signed: Date.now(), src: "hand" }); save(); paint(); checkClubs(); }
    else if (act === "drop") { S.entries = S.entries.filter((x) => x.club !== Number(t.dataset.club)); save(); paint(); }
    else if (act === "build") {
      const ents = S.entries.filter((x) => x.ok !== false); if (ents.length < 2) { alertMsg("Need at least two clubs."); return; }
      if (S.T && !confirm("Rebuild the bracket? Results so far are cleared.")) return;
      S.T = createTournament(ents, S.fmt, JSON.parse(JSON.stringify(S.opt))); S.start = Date.now(); S.used = {};
      if (S.opt.parks === "roulette") { const ids = Object.keys(PARKS).map(Number); S.T.matches.forEach((x) => (x.park = ids[Math.floor(Math.random() * ids.length)])); }
      save(); if (S.opt.autoSend) sendClubs(true); tab = "bracket"; paint();
    }
    else if (act === "check") { t.disabled = true; t.textContent = "Checking…"; const n = await checkResults(); t.textContent = n ? `✓ ${n} decided` : "No new results"; setTimeout(paint, 1500); }
    else if (act === "sendall") { const n = sendClubs(false); t.textContent = `✓ Sent ${n} club${n === 1 ? "" : "s"}`; }
    else if (act === "watch" && m) { const items = [{ club: sideClub(T, m.a), name: CLUB(sideClub(T, m.a)).name, since: S.start }, { club: sideClub(T, m.b), name: CLUB(sideClub(T, m.b)).name, since: S.start }]; items.force = true; handOff(items); t.textContent = "✓ Sent"; }
    else if (act === "callout" && m) { const a = sideClub(T, m.a), b = sideClub(T, m.b), A = CLUB(a), B = CLUB(b); const txt = `⚾ ${S.name} · ${m.label}: ${B.name} (#${b}${B.discord ? ", " + B.discord : ""}) at ${A.name} (#${a}${A.discord ? ", " + A.discord : ""})${(m.bo || 1) > 1 ? ` · best of ${m.bo}` : ""}${m.park && S.opt.parks === "roulette" ? ` · exhibition at ${PARKS[m.park]}` : ""}. Play ball!`; await navigator.clipboard.writeText(txt).catch(() => {}); t.textContent = "✓ Copied"; }
    else if (act === "setw" && m) { const w = Number(t.dataset.w); m.winner = w; m.loser = w === sideClub(T, m.a) ? sideClub(T, m.b) : sideClub(T, m.a); m.decidedAt = Date.now(); m.manual = true; advance(T); parkUp(T); save(); paint(); }
    else if (act === "undo" && m) {
      const later = T.matches.filter((x) => (x.a.from === m.id || x.b.from === m.id) && x.winner);
      if (later.length) { alertMsg("A later match already depends on this one. Undo that first."); return; }
      m.winner = m.loser = null; m.decidedAt = 0; (m.games || []).forEach((g) => delete S.used[g.id]); m.games = []; save(); paint();
    }
    else if (act === "copyshare") { await navigator.clipboard.writeText(shareText()).catch(() => {}); t.textContent = "✓ Copied"; }
    else if (act === "copycode") { await navigator.clipboard.writeText(toCode()).catch(() => {}); t.textContent = "✓ Copied"; }
    else if (act === "copyids") { const ids = allIds(); await navigator.clipboard.writeText(ids.join(", ")).catch(() => {}); t.textContent = ids.length ? `✓ Copied ${ids.length}` : "No games yet"; }
    else if (act === "loadcode") {
      const inp = ov.querySelector('[data-k="code"]');
      try { const d = fromCode(inp && inp.value); if (S.T && !window.confirm(`Replace "${S.name}" with "${d.n}"?`)) return; Object.assign(S, { name: d.n, fmt: d.f, opt: Object.assign({}, S.opt, d.o), entries: d.e, T: d.T, start: d.s || Date.now(), used: d.u || {} }); save(); tab = "bracket"; msg = `Loaded "${d.n}".`; paint(); checkResults(); }
      catch (err) { msg = err.message; paint(); }
    }
  }
  function parkUp(T) { if (S.opt.parks !== "roulette") return; const ids = Object.keys(PARKS).map(Number); T.matches.forEach((x) => { if (!x.park) x.park = ids[Math.floor(Math.random() * ids.length)]; }); }
  function alertMsg(s) { msg = s; paint(); }
  function onChange(e) {
    const k = e.target.dataset.k, o = e.target.dataset.opt;
    if (k === "sheet") { S.sheet = e.target.value.trim(); save(); }
    if (o) { S.opt[o] = e.target.checked; save(); }
  }

  const btn = document.createElement("button"); btn.id = "tt-launch"; btn.type = "button"; btn.innerHTML = "🏆 Tournament";
  const st = document.createElement("style"); st.textContent = css.split("\n").filter((l) => /#tt-launch/.test(l)).join("\n");
  document.head.appendChild(st); document.body.appendChild(btn);
  btn.onclick = () => (ov ? close() : open());
})();
