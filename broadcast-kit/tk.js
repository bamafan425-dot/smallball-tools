(() => {
  // SmallBall Broadcast Kit (formerly the Tournament Kit): a no-spoilers watch-along multiview of the site's own game player.
  // Read-only: it never plays, trains or saves anything on the site. It only reads game lists and
  // opens the site's own player (/training?watch=<game>) in tiles, the same page the Watch buttons open.
  if (window.top !== window) return;               // not inside our own player tiles
  if (document.getElementById("tk-launch")) return;

  const KEY = "tk-state-v1";
  const DEF = { clubs: [], queue: [], air: [], watched: {}, meta: {}, shield: true, layout: "quad", main: 0, autoNext: true };
  let S;
  try { S = Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (_) { S = Object.assign({}, DEF); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) {} };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function getJSON(url) { const r = await fetch(url, { credentials: "include" }); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }
  const KIND = { big: "BigLeague", pro: "ProLeague", exhibition: "Exhibition" };
  const nm = (s) => String(s || "").replace(/\s*-?\s*\*?[A-Z][A-Za-z]{1,4}\*?-?\s*$/, (m) => m).trim();
  const when = (iso) => { const d = new Date(iso); const today = new Date(); const same = d.toDateString() === today.toDateString();
    return (same ? "today " : d.toLocaleDateString([], { month: "short", day: "numeric" }) + " ") + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); };

  // Keep what a game is, never how it ended: no runs are stored or shown anywhere in this kit.
  function remember(row) {
    S.meta[row.game_id] = { id: row.game_id, at: row.finished_at, kind: row.kind, good: !!row.good_match,
      home: row.home_name, away: row.away_name, hid: row.home_team_id, aid: row.away_team_id };
  }
  const label = (m) => m ? `${esc(nm(m.away))} <span class="at">at</span> ${esc(nm(m.home))}` : "Game";
  const tags = (m) => m ? `${m.tag ? `<span class="tag trn">🏆 ${esc(m.tag)}</span>` : ""}<span class="tag">${KIND[m.kind] || esc(m.kind || "")}</span>${m.good ? `<span class="tag good">good match</span>` : ""}<span class="when">${when(m.at)}</span>` : "";
  const unwatched = () => S.queue.filter((id) => !S.watched[id]);
  // What plays next: queued, unwatched and not on a tile, in queue order.
  const upNext = () => S.queue.filter((id) => !S.watched[id] && !S.air.includes(id));
  const maxTiles = () => (S.layout === "single" ? 1 : 4);

  // ---------- Watch list: new games from the tournament clubs join the queue, results unseen ----------
  let polling = false;
  async function poll() {
    if (polling || !S.clubs.length || document.visibilityState !== "visible") return;
    polling = true;
    try {
      for (const c of S.clubs) {
        try {
          const g = await getJSON(`/games/all?club=${c.id}`);
          for (const row of g.rows || []) {
            if (Date.parse(row.finished_at) < c.since) continue;
            if (!S.meta[row.game_id]) remember(row);
            if (!S.watched[row.game_id] && !S.queue.includes(row.game_id) && !S.air.includes(row.game_id)) S.queue.push(row.game_id);
          }
        } catch (_) {}
        await sleep(1500);
      }
      S.queue.sort((a, b) => Date.parse((S.meta[a] || {}).at || 0) - Date.parse((S.meta[b] || {}).at || 0));
      save(); paintBadge(); if (isOpen()) paintSide(); shield();
    } finally { polling = false; }
  }
  setInterval(poll, 60000); setTimeout(poll, 4000);

  // ---------- Tournament Kit hand-off ----------
  // The Tournament Kit (its own extension) leaves clubs and games for us in this page's storage, which both
  // kits share, and bumps an attribute on <html>. Clubs join the watch list, so their new games queue up on
  // their own; tournament games join the queue with their round label (R1 · Match 3).
  const INBOX = "sbx-bcast-inbox";
  let inboxBusy = false;
  async function takeInbox() {
    if (inboxBusy) return;
    let box; try { box = JSON.parse(localStorage.getItem(INBOX) || "null"); } catch (_) { box = null; }
    if (!box || !Array.isArray(box.items) || !box.items.length) return;
    inboxBusy = true;
    try {
      localStorage.removeItem(INBOX);
      let clubs = 0;
      for (const it of box.items) {
        if (it.club && !S.clubs.some((c) => c.id === it.club)) { S.clubs.push({ id: it.club, name: it.name || "Club " + it.club, since: it.since || Date.now(), tourney: it.tourney || "" }); clubs++; }
        if (it.game) { if (!S.queue.includes(it.game) && !S.watched[it.game] && !S.air.includes(it.game)) await addIds(String(it.game)); if (S.meta[it.game] && it.label) S.meta[it.game].tag = it.label; }
      }
      save(); paintBadge(); if (isOpen()) paintSide(); shield();
      if (clubs) poll();
    } finally { inboxBusy = false; }
  }
  new MutationObserver(takeInbox).observe(document.documentElement, { attributes: true, attributeFilter: ["data-sbx-inbox"] });
  setInterval(takeInbox, 5000); setTimeout(takeInbox, 1500);

  // ---------- Spoiler shield: blur scores of tracked games you haven't watched, on the site's pages ----------
  // Shielded: games in the queue or on air that you haven't watched (followed clubs' new games land in the queue).
  const shielded = (id) => { id = Number(id); return S.shield && !S.watched[id] && (S.queue.includes(id) || S.air.includes(id)); };
  const SCORE = /\b\d{1,3}\s*[–-]\s*\d{1,3}\b/;
  function shield() {
    for (const a of document.querySelectorAll('a[href^="/training?watch="]')) {
      if (a.closest("#tk-ov")) continue;
      const id = Number((a.getAttribute("href").match(/watch=(\d+)/) || [])[1]);
      const row = a.closest("tr, li"); if (!row) continue;
      for (const cell of row.querySelectorAll("td, .score, b")) {
        if (cell.querySelector("a")) continue;
        const hide = shielded(id) && SCORE.test(cell.textContent);
        if (hide && !cell.classList.contains("tk-hide") && !cell.dataset.tkShown) { cell.classList.add("tk-hide"); cell.title = "Hidden by the spoiler shield. Click to peek."; }
        if (!hide && cell.classList.contains("tk-hide")) { cell.classList.remove("tk-hide"); cell.removeAttribute("title"); }
      }
    }
    // Club Kit dashboard cards are left alone: skip them if you're avoiding spoilers.
  }
  document.addEventListener("click", (ev) => {
    const c = ev.target.closest(".tk-hide"); if (!c) return;
    ev.preventDefault(); ev.stopPropagation(); c.classList.remove("tk-hide"); c.dataset.tkShown = "1";
  }, true);
  let shT = 0;
  new MutationObserver(() => { clearTimeout(shT); shT = setTimeout(shield, 150); }).observe(document.body, { childList: true, subtree: true });

  // ---------- UI ----------
  const css = document.createElement("style");
  css.textContent = `
    #tk-launch { position: fixed; left: 16px; bottom: 16px; z-index: 2147483000; display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 999px; border: 0; background: #b91c1c; color: #fff; font: 800 14px/1 system-ui, sans-serif; cursor: pointer; box-shadow: 0 6px 20px rgba(0,0,0,.35); }
    #tk-launch .n { background: #fff; color: #b91c1c; border-radius: 999px; padding: 2px 7px; font-size: 12px; }
    .tk-hide { filter: blur(7px); cursor: pointer; user-select: none; }
    #tk-ov { position: fixed; inset: 0; z-index: 2147483001; background: #05070d; color: #e5e7eb; font: 14px/1.4 system-ui, -apple-system, Segoe UI, sans-serif; display: grid; grid-template-rows: auto 1fr auto; }
    #tk-ov button { font: inherit; cursor: pointer; }
    #tk-ov .top { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; padding: 10px 14px; background: #0b1220; border-bottom: 1px solid #1f2937; }
    #tk-ov .top h2 { margin: 0 8px 0 0; font-size: 18px; letter-spacing: .02em; } #tk-ov .top h2 .live { color: #ef4444; }
    #tk-ov .seg { display: inline-flex; border: 1px solid #334155; border-radius: 999px; overflow: hidden; }
    #tk-ov .seg button { background: transparent; color: #cbd5e1; border: 0; padding: 6px 12px; font-weight: 700; font-size: 13px; }
    #tk-ov .seg button.on { background: #1d4ed8; color: #fff; }
    #tk-ov .lbl { font-size: 12px; opacity: .7; margin-right: 2px; }
    #tk-ov label.sw { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; font-size: 13px; }
    #tk-ov .x { margin-left: auto; background: #1f2937; color: #fff; border: 0; border-radius: 999px; padding: 7px 14px; font-weight: 800; }
    #tk-ov .body { display: grid; grid-template-columns: 320px 1fr; min-height: 0; }
    #tk-ov aside { overflow: auto; padding: 12px 14px; border-right: 1px solid #1f2937; background: #070b14; }
    #tk-ov aside h4 { margin: 14px 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; opacity: .7; } #tk-ov aside h4:first-child { margin-top: 0; }
    #tk-ov .add { display: flex; gap: 6px; } #tk-ov .add input { flex: 1; min-width: 0; background: #0f172a; color: #fff; border: 1px solid #334155; border-radius: 8px; padding: 6px 8px; font: inherit; }
    #tk-ov .add button, #tk-ov .mini { background: #1e293b; color: #fff; border: 1px solid #334155; border-radius: 8px; padding: 5px 10px; font-weight: 700; font-size: 12.5px; }
    #tk-ov .note { font-size: 12px; opacity: .6; margin: 6px 0 0; }
    #tk-ov .item { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; align-items: center; padding: 7px 8px; border: 1px solid #1f2937; border-radius: 10px; margin: 6px 0; background: #0b1220; }
    #tk-ov .item .t { font-weight: 700; font-size: 13px; } #tk-ov .item .t .at { opacity: .55; font-weight: 400; }
    #tk-ov .item .m { grid-column: 1; font-size: 11.5px; opacity: .75; display: flex; flex-wrap: wrap; gap: 4px 6px; align-items: center; }
    #tk-ov .item .b { grid-column: 2; grid-row: 1 / span 2; display: flex; gap: 4px; }
    #tk-ov .tag { border: 1px solid #334155; border-radius: 999px; padding: 0 6px; font-size: 11px; } #tk-ov .tag.trn { background: #713f12; color: #fde68a; } #tk-ov .tag.good { border-color: #16a34a; color: #4ade80; }
    #tk-ov .item.watched { opacity: .5; }
    #tk-ov .stage { position: relative; display: grid; gap: 6px; padding: 6px; min-height: 0; }
    #tk-ov .stage[data-l="single"] { grid-template-columns: 1fr; grid-template-rows: 1fr; }
    #tk-ov .stage[data-l="quad"] { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
    #tk-ov .stage[data-l="main3"] { grid-template-columns: 3fr 1fr; grid-template-rows: 1fr 1fr 1fr; }
    #tk-ov .stage[data-l="main3"] .tile.main { grid-row: 1 / span 3; grid-column: 1; }
    #tk-ov .tile { position: relative; display: grid; grid-template-rows: auto 1fr; min-height: 0; min-width: 0; background: #000; border: 1px solid #1f2937; border-radius: 10px; overflow: hidden; }
    #tk-ov .tile.main { border-color: #b91c1c; }
    #tk-ov .tile .th { display: flex; align-items: center; gap: 8px; padding: 5px 8px; background: #0b1220; font-size: 12.5px; }
    #tk-ov .tile .th .t { font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } #tk-ov .tile .th .t .at { opacity: .55; font-weight: 400; }
    #tk-ov .tile .th .sp { margin-left: auto; display: flex; gap: 4px; }
    #tk-ov .tile .slot { position: relative; min-height: 0; display: grid; }
    #tk-ov .tile iframe { width: 100%; height: 100%; border: 0; background: #000; }
    #tk-ov .tile .wait { display: grid; place-items: center; text-align: center; padding: 16px; opacity: .8; font-size: 15px; }
    #tk-ov .empty { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; opacity: .6; font-size: 16px; padding: 24px; }
    #tk-ov .quick { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin: 0 0 8px; padding: 8px; border-radius: 10px; background: #111827; }
    #tk-ov .quick .go { padding: 8px 14px; font-size: 14px; }
    #tk-ov .chips { display: flex; flex-direction: column; gap: 6px; }
    #tk-ov .chip { display: flex; align-items: center; gap: 6px; padding: 5px 8px; border: 1px solid #1f2937; border-radius: 10px; font-size: 12.5px; } #tk-ov .chip b { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #tk-ov .mini.on { background: #b91c1c; border-color: #ef4444; color: #fff; }
    #tk-ov .foot { display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: #0b1220; border-top: 1px solid #1f2937; }
    #tk-ov .go { background: #16a34a; color: #fff; border: 0; border-radius: 999px; padding: 10px 22px; font-weight: 900; font-size: 15px; }
    #tk-ov .go:disabled { opacity: .4; cursor: default; }
    #tk-ov .count { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(0,0,0,.75); font: 900 140px/1 system-ui, sans-serif; color: #fff; z-index: 5; }
    #tk-ov .body.withbooth { grid-template-columns: 320px 1fr 360px; }
    #tk-ov .booth { border-left: 1px solid #1f2937; background: #070b14; display: grid; grid-template-rows: auto 1fr; min-height: 0; }
    #tk-ov .booth .bh { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid #1f2937; } #tk-ov .booth .bh .sp { margin-left: auto; }
    #tk-ov .booth .blist { overflow: auto; padding: 6px 10px; font-size: 13px; }
    #tk-ov .booth .bl { display: grid; grid-template-columns: auto auto 1fr; gap: 6px; align-items: baseline; padding: 4px 0; border-bottom: 1px solid #111827; }
    #tk-ov .booth .bl.hot { background: rgba(250,204,21,.08); }
    #tk-ov .booth .gt { font-size: 10.5px; font-weight: 800; color: var(--c); white-space: nowrap; max-width: 120px; overflow: hidden; text-overflow: ellipsis; }
    #tk-ov .booth .hf { font-size: 11px; opacity: .6; font-variant-numeric: tabular-nums; }
    #tk-ov .booth .tx i { opacity: .7; font-size: 11.5px; }
    #tk-ov .booth[hidden], #tk-ov .rpanel[hidden] { display: none !important; }
    #tk-ov .rwrap { position: relative; display: inline-flex; gap: 4px; }
    #tk-ov .radio-btn.on { background: #b91c1c; border-color: #ef4444; }
    #tk-ov .rpanel { position: absolute; top: calc(100% + 8px); right: 0; z-index: 20; width: 360px; background: #0b1220; border: 1px solid #334155; border-radius: 12px; padding: 12px; box-shadow: 0 12px 30px rgba(0,0,0,.5); }
    #tk-ov .rpanel .rrow { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; margin: 0 0 9px; }
    #tk-ov .rpanel .rrow .lbl { width: 84px; }
    #tk-ov .rpanel select { flex: 1; min-width: 0; background: #0f172a; color: #fff; border: 1px solid #334155; border-radius: 8px; padding: 5px 6px; font: inherit; font-size: 12.5px; }
    #tk-ov .rpanel input[type=range] { flex: 1; }
    #tk-ov .rpanel .rhow summary { cursor: pointer; font-weight: 700; font-size: 12.5px; margin: 4px 0; } #tk-ov .rpanel .rhow ol { padding-left: 18px; margin: 4px 0 8px; opacity: .8; } #tk-ov .rpanel .rhow li { margin: 0 0 4px; }
    #tk-ov .rpanel { max-height: 75vh; overflow: auto; }
    #tk-ov .onradio { font-size: 10.5px; font-weight: 900; color: #fff; background: #b91c1c; border-radius: 999px; padding: 1px 7px; white-space: nowrap; }
    #tk-ov .rcap { margin-left: auto; font-size: 13px; opacity: .9; max-width: 55%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } #tk-ov .rcap b { color: #fca5a5; }
    @media (max-width: 900px) { #tk-ov .body { grid-template-columns: 1fr; grid-template-rows: auto 1fr; } #tk-ov aside { max-height: 38vh; border-right: 0; border-bottom: 1px solid #1f2937; } }
    /* ---- Stream Mode: SBSN on the air. The kit's controls go away; the on-air game fills the window under TV graphics. ---- */
    #tk-ov .stream-btn { background: #0E1B33; border-color: #C8102E; }
    #tk-ov.sm { grid-template-rows: 1fr; background: #0E1B33; }
    #tk-ov.sm .top, #tk-ov.sm .foot, #tk-ov.sm aside, #tk-ov.sm .booth { display: none !important; }
    #tk-ov.sm .body, #tk-ov.sm .body.withbooth { grid-template-columns: 1fr !important; grid-template-rows: 1fr !important; }
    #tk-ov.sm .stage { grid-template-columns: 1fr !important; grid-template-rows: 1fr !important; padding: 0; gap: 0; }
    #tk-ov.sm .tile { display: none; border: 0; border-radius: 0; }
    #tk-ov.sm .tile.onair { display: grid; grid-row: 1; grid-column: 1; grid-template-rows: 1fr; }
    #tk-ov.sm .tile .th, #tk-ov.sm .empty { display: none; }
    #tk-ov .sbsn-tv { display: none; }
    #tk-ov.sm .sbsn-tv { display: block; position: fixed; inset: 0; pointer-events: none; z-index: 30; color: #F4EBD9; font-family: 'Bebas Neue', Impact, 'Arial Narrow', sans-serif; }
    .sbsn-tv .bug { position: absolute; left: 2vw; top: 2.4vh; display: none; align-items: stretch; background: #0E1B33; border: 3px solid #F4EBD9; box-shadow: 0 .6vh 0 #C8102E; font-size: 3.6vh; line-height: 1; }
    .sbsn-tv .bug.on { display: flex; }
    .sbsn-tv .bug > span { display: flex; align-items: center; padding: .8vh .9vw; white-space: nowrap; }
    .sbsn-tv .bug .net { background: #C8102E; letter-spacing: .12em; }
    .sbsn-tv .bug .sc { background: #F4EBD9; color: #0E1B33; min-width: 2.2vw; justify-content: center; }
    .sbsn-tv .bug .inn { font-family: Oswald, 'Arial Narrow', system-ui, sans-serif; font-weight: 600; font-size: 2.3vh; gap: .7vw; }
    .sbsn-tv .trn { position: absolute; left: 2vw; top: 9vh; display: none; background: #C8102E; padding: .5vh .8vw; font: 600 2vh/1 Oswald, 'Arial Narrow', system-ui, sans-serif; letter-spacing: .1em; text-transform: uppercase; }
    .sbsn-tv .trn.on { display: block; }
    .sbsn-tv .cap { position: absolute; left: 10vw; right: 10vw; bottom: 9vh; background: rgba(14,27,51,.93); border: 2px solid rgba(244,235,217,.35); padding: 1.3vh 1.5vw; font: 500 2.7vh/1.32 Oswald, 'Arial Narrow', system-ui, sans-serif; opacity: 0; transition: opacity .35s; }
    .sbsn-tv .cap.on { opacity: 1; }
    .sbsn-tv .cap b { color: #ffb4b4; font-weight: 600; margin-right: .4vw; text-transform: uppercase; letter-spacing: .06em; }
    .sbsn-tv .tick { position: absolute; left: 0; right: 0; bottom: 0; height: 6vh; background: #0E1B33; border-top: .5vh solid #C8102E; display: flex; align-items: center; overflow: hidden; }
    .sbsn-tv .tick .lab { flex: none; height: 100%; display: flex; align-items: center; padding: 0 1.3vw; background: #C8102E; font-size: 3.3vh; letter-spacing: .12em; z-index: 1; }
    .sbsn-tv .tick .clip { flex: 1; overflow: hidden; height: 100%; display: flex; align-items: center; }
    .sbsn-tv .tick .run { display: inline-block; white-space: nowrap; font-size: 3vh; letter-spacing: .05em; padding-left: 100%; animation: sbsnTick var(--dur, 80s) linear infinite; }
    .sbsn-tv .tick .run i { font-style: normal; color: #C8102E; margin: 0 1.2vw; }
    @keyframes sbsnTick { from { transform: translateX(0); } to { transform: translateX(-100%); } }
    .sbsn-tv .card { position: absolute; right: 2vw; top: 24vh; width: 34vw; border-radius: 0; margin: 0; display: none; background: #0E1B33; border: 3px solid #F4EBD9; box-shadow: 0 .8vh 0 #C8102E; padding: 2.4vh 1.8vw; }
    .sbsn-tv .card.on { display: block; }
    .sbsn-tv .card .k { font-size: 2.6vh; letter-spacing: .16em; color: #ff8a8a; }
    .sbsn-tv .card .h { font-size: 5.2vh; line-height: 1.02; margin: .6vh 0 1.4vh; }
    .sbsn-tv .card .p { font: 500 2.5vh/1.35 Oswald, 'Arial Narrow', system-ui, sans-serif; }
    .sbsn-tv .card ol { margin: 0; padding: 0; list-style: none; font: 500 2.6vh/1.5 Oswald, 'Arial Narrow', system-ui, sans-serif; }
    .sbsn-tv .card ol li span { display: inline-block; width: 2.6vw; color: #ff8a8a; }
    .sbsn-tv .card .clock { margin-top: 1.4vh; height: .8vh; background: rgba(244,235,217,.2); }
    .sbsn-tv .card .clock i { display: block; height: 100%; background: #C8102E; animation: sbsnClock var(--t, 6s) linear forwards; }
    @keyframes sbsnClock { from { width: 100%; } to { width: 0; } }
    .sbsn-tv .full { position: absolute; inset: 0 0 6vh 0; display: none; place-items: center; text-align: center; background: repeating-linear-gradient(90deg, rgba(244,235,217,.04) 0 2px, transparent 2px 7vw), #0E1B33; }
    .sbsn-tv .full.on { display: grid; }
    .sbsn-tv .full .k { font-size: 3.4vh; letter-spacing: .3em; color: #ff8a8a; }
    .sbsn-tv .full .h { font-size: 9vh; line-height: 1.02; margin: 1.6vh auto; max-width: 88vw; text-shadow: .5vh .5vh 0 #C8102E; }
    .sbsn-tv .full .p { font: 500 3vh/1.4 Oswald, 'Arial Narrow', system-ui, sans-serif; opacity: .9; max-width: 70vw; margin: 0 auto; }
    .sbsn-tv .full .logo { font-size: 6vh; letter-spacing: .2em; margin-bottom: 3vh; display: inline-block; border: 3px solid #F4EBD9; padding: .6vh 1.4vw; box-shadow: 0 .6vh 0 #C8102E; }
    .sbsn-tv .smx { pointer-events: auto; position: absolute; right: 1vw; top: 1vh; opacity: 0; transition: opacity .2s; background: #1f2937; color: #fff; border: 0; border-radius: 999px; padding: 8px 14px; font: 700 13px/1 system-ui, sans-serif; cursor: pointer; }
    .sbsn-tv .smx:hover, .sbsn-tv .smx:focus { opacity: 1; }
  `;
  document.head.appendChild(css);

  const launch = document.createElement("button");
  launch.id = "tk-launch"; launch.type = "button"; launch.title = "SmallBall Broadcast: watch games together, no spoilers";
  launch.onclick = () => open();
  document.body.appendChild(launch);
  function paintBadge() { const n = unwatched().length; launch.innerHTML = `📺 Broadcast${n ? ` <span class="n">${n}</span>` : ""}`; }
  // On a game's own watch page: one click puts that game in the Broadcast queue.
  const qThis = document.createElement("button"); qThis.id = "tk-qthis"; qThis.type = "button";
  qThis.style.cssText = "position:fixed;left:16px;bottom:20px;z-index:2147483000;padding:7px 12px;border-radius:999px;border:1px solid #ef4444;background:#111827;color:#fff;font:700 12.5px system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.35)";
  function paintQThis() {
    const gid = Number(new URLSearchParams(location.search).get("watch")) || 0;
    if (!gid || !/^\/training/.test(location.pathname) || isOpen()) { qThis.remove(); return; }
    const inQ = S.queue.includes(gid) || S.air.includes(gid);
    qThis.textContent = inQ ? "📺 In the Broadcast queue" : "📺＋ Add this game to the Broadcast";
    qThis.disabled = inQ; qThis.style.opacity = inQ ? ".7" : "1";
    qThis.onclick = async () => { await addIds(String(gid)); paintQThis(); };
    if (!qThis.isConnected) document.body.appendChild(qThis);
    const lr = launch.getBoundingClientRect(); if (lr.width) { qThis.style.left = Math.round(lr.right + 8) + "px"; qThis.style.bottom = Math.round(window.innerHeight - lr.bottom + (lr.height - qThis.offsetHeight) / 2) + "px"; }
  }
  setInterval(paintQThis, 2000); setTimeout(paintQThis, 800);
  paintBadge();

  let ov = null, browse = null, browseClub = 0;
  const isOpen = () => !!(ov && ov.isConnected);
  function open() {
    if (isOpen()) return;
    ov = document.createElement("div"); ov.id = "tk-ov";
    ov.innerHTML = `
      <div class="top"><h2><span class="live">●</span> SmallBall Broadcast</h2>
        <span class="lbl">Layout</span><span class="seg" data-seg="layout"><button data-v="single">Single</button><button data-v="quad">2×2</button><button data-v="main3">Main + 3</button></span>
        <span class="lbl">Speed, all tiles</span><span class="seg" data-seg="speed"><button data-v="1×">1×</button><button data-v="2×">2×</button><button data-v="4×">4×</button></span>
        <label class="sw" title="Blur the scores of games you haven't watched yet, on SmallBall's pages and on Club Kit cards"><input type="checkbox" data-k="shield"> Spoiler shield</label>
        <button class="mini booth-btn" data-act="booth" title="Live play-by-play from every tile, with highlights. Copy or download it for Discord.">🎙 Booth</button>
        <span class="rwrap"><button class="mini radio-btn" data-act="radio" title="Two announcers call the game out loud, with jokes. No spoilers: they only talk about plays the tile has shown.">📻 Radio</button><button class="mini" data-act="rset" title="Radio settings: voices, quips, volume">⚙</button><div class="rpanel" hidden></div></span>
        <button class="mini stream-btn" data-act="stream" title="Stream Mode: a clean TV screen for OBS or StreamYard to capture. Esc comes back here.">📺 Stream Mode</button>
        <button class="x" data-act="close">Close</button></div>
      <div class="body"><aside></aside><section class="stage"></section><section class="booth" hidden></section></div>
      <div class="foot"><button class="go" data-act="go">▶ Start the broadcast</button><span class="note" data-k="foot"></span><span class="rcap"></span></div>
      <div class="sbsn-tv" aria-live="off">
        <div class="bug"><span class="net">SBSN</span><span class="ta"></span><span class="sc sa"></span><span class="th"></span><span class="sc sh"></span><span class="inn"></span></div>
        <div class="trn"></div>
        <div class="card"></div>
        <div class="full"></div>
        <div class="cap"></div>
        <div class="tick"><span class="lab">SBSN</span><span class="clip"><span class="run"></span></span></div>
        <button class="smx" data-act="smexit">Leave Stream Mode (Esc)</button>
      </div>`;
    document.body.appendChild(ov);
    document.documentElement.style.overflow = "hidden";
    ov.addEventListener("click", onClick);
    ov.querySelector('[data-k="shield"]').checked = S.shield;
    ov.querySelector('[data-k="shield"]').onchange = (e) => { S.shield = e.target.checked; save(); shield(); };
    ov.addEventListener("change", (e) => { if (e.target.dataset && e.target.dataset.k === "autoNext") { S.autoNext = e.target.checked; save(); paintSide(); } });
    ov.addEventListener("input", (e) => { const gk = e.target.dataset && e.target.dataset.g; if (gk) { R.guests[gk] = e.target.checked; rsave(); return; } const k = e.target.dataset && e.target.dataset.r; if (!k) return; R[k] = e.target.type === "checkbox" ? e.target.checked : e.target.type === "range" ? Number(e.target.value) : e.target.value; rsave(); if (k === "pbp" || k === "color" || k === "guestVoice") paintRadio(); });
    paintSeg(); paintSide(); paintStage(); paintRadio();
  }
  function close() {
    if (!isOpen()) return;
    hush(); R.on = false;
    ov.remove(); ov = null; document.documentElement.style.overflow = "";
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && isOpen() && !e.target.closest("input")) { if (SM) streamToggle(false); else close(); } });
  function paintSeg() { for (const b of ov.querySelectorAll('[data-seg="layout"] button')) b.classList.toggle("on", b.dataset.v === S.layout); }

  function paintSide() {
    if (!isOpen()) return;
    const side = ov.querySelector("aside");
    // Keep whatever is half-typed in the boxes across a refresh.
    const typed = {}; for (const i of side.querySelectorAll("input[data-k]")) typed[i.dataset.k] = i.value;
    const focus = document.activeElement && side.contains(document.activeElement) ? document.activeElement.dataset.k : null;
    const club = (c) => `<div class="item"><span class="t">${esc(c.name || "Club " + c.id)}</span><span class="m">#${c.id} · since ${when(c.since)}</span><span class="b"><button class="mini" data-act="unclub" data-id="${c.id}" title="Stop following">✕</button></span></div>`;
    const game = (id, extra) => { const m = S.meta[id]; return `<div class="item${S.watched[id] ? " watched" : ""}"><span class="t">${label(m)}</span><span class="m">${tags(m)}${S.watched[id] ? `<span class="tag">watched</span>` : ""}</span><span class="b">${extra}</span></div>`; };
    const q = S.queue.filter((id) => !S.air.includes(id));
    const free = maxTiles() - S.air.length, nUp = upNext().length;
    // Your own clubs, from the site's club picker: follow or browse with one click.
    const mine = [...document.querySelectorAll("#who-team option")].map((o) => ({ id: Number(o.value), name: (o.textContent || "").replace(/\s*\d+\s*$/, "").trim() })).filter((c) => c.id > 0).slice(0, 8);
    const chips = mine.length ? `<div class="chips">${mine.map((c) => `<span class="chip"><b>${esc(c.name || "Club " + c.id)}</b>${S.clubs.some((x) => x.id === c.id) ? `<span class="note">following</span>` : `<button class="mini" data-act="fclub" data-id="${c.id}" title="Follow: its new games join the queue by themselves">Follow</button>`}<button class="mini" data-act="bclub" data-id="${c.id}" title="Pick from its recent games">Games</button></span>`).join("")}</div>` : "";
    side.innerHTML = `
      <div class="quick">${nUp && free > 0 ? `<button class="go" data-act="fill">▶ Watch the next ${Math.min(free, nUp)}${live ? "" : " now"}</button>` : !nUp ? `<span class="note">Add games below and they'll line up here.</span>` : `<span class="note">All tiles in use. ✓ Done on a tile frees it${S.autoNext ? " (or it frees itself at the final)" : ""}.</span>`}
        <label class="sw" title="When a game reaches its final, mark it watched and put the next game from the queue on that tile"><input type="checkbox" data-k="autoNext" ${S.autoNext ? "checked" : ""}> Auto next</label></div>
      <h4>Queue · ${q.filter((id) => !S.watched[id]).length} to watch</h4>
      ${q.length ? q.map((id, qi) => game(id, `${S.watched[id] ? "" : `<button class="mini on" data-act="air" data-id="${id}" title="${live ? "Play it now on a free tile" : "Put it on a tile; Start plays them all together"}">${live ? "▶ Play" : "＋ Tile"}</button>${qi ? `<button class="mini" data-act="top" data-id="${id}" title="Move to the front of the queue">⤒</button>` : ""}`}<button class="mini" data-act="drop" data-id="${id}" title="Remove from the queue">✕</button>`)).join("") : `<p class="note">Empty. Follow clubs or add games above.</p>`}
      ${Object.keys(S.watched).length ? `<h4>Watched</h4><p class="note">${Object.keys(S.watched).length} game${Object.keys(S.watched).length === 1 ? "" : "s"} marked watched. <button class="mini" data-act="clearw">Forget them</button></p>` : ""}
      ${chips ? `<h4>Your clubs</h4>${chips}` : ""}
      ${browse ? `<div data-k="browselist">${browse}</div>` : ""}
      <h4>Clubs to watch</h4>
      <div class="add"><input data-k="club" inputmode="numeric" placeholder="Club number, e.g. 3249"><button data-act="club">Follow</button></div>
      ${S.clubs.map(club).join("")}
      <p class="note">New games these clubs play from now on join the queue by themselves, about once a minute, with the results hidden.</p>
      <h4>Add games</h4>
      <div class="add"><input data-k="ids" placeholder="Game numbers or watch links: 4821, 4806"><button data-act="ids">Add</button></div>
      <div class="add" style="margin-top:6px"><input data-k="browse" inputmode="numeric" placeholder="Browse a club's games: number"><button data-act="browse">Browse</button></div>

`;
    for (const i of side.querySelectorAll("input[data-k]")) if (typed[i.dataset.k] != null) i.value = typed[i.dataset.k];
    if (focus) side.querySelector(`input[data-k="${focus}"]`)?.focus();
  }

  let live = false;
  // Tiles are keyed by game and never rebuilt while they play: a playing frame that is moved or
  // replaced reloads, which would restart that game. Layout changes use CSS order, not DOM moves.
  function tileHead(id, i, isMain) {
    const onR = R.on && radioGame() === id;
    return `<span class="t">${label(S.meta[id])}</span>${onR ? `<span class="onradio">📻 ON RADIO</span>` : ""}<span class="sp">${R.on && !onR ? `<button class="mini" data-act="rtile" data-id="${id}" title="Put this game on the radio">📻</button>` : ""}${S.layout === "main3" && !isMain ? `<button class="mini" data-act="main" data-i="${i}" title="Make this the main tile">⤢</button>` : ""}<button class="mini" data-act="done" data-id="${id}" title="Mark watched and take it off the air">✓ Done</button><button class="mini" data-act="off" data-id="${id}" title="Back to the queue, still unwatched">✕</button></span>`;
  }
  function paintStage() {
    if (!isOpen()) return;
    const st = ov.querySelector(".stage"); st.dataset.l = S.layout;
    const max = S.layout === "single" ? 1 : 4;
    const ids = S.air.slice(0, max);
    st.querySelector(".empty")?.remove();
    for (const t of st.querySelectorAll(".tile")) if (!ids.includes(Number(t.dataset.id))) t.remove();
    if (!ids.length) { live = false; st.insertAdjacentHTML("beforeend", `<div class="empty"><div>Press <b>▶ Watch the next</b> on the left to fill ${max > 1 ? "the tiles" : "the tile"} from the queue and start, or pick games with <b>＋ Tile</b> and press <b>Start</b>.<br><span class="note">Everyone who starts together sees the same pitch at the same time.${S.autoNext ? " With Auto next on, each finished game makes way for the next one." : ""}</span></div></div>`); paintFoot(); return; }
    if (S.main >= ids.length) S.main = 0;
    ids.forEach((id, i) => {
      let t = st.querySelector(`.tile[data-id="${id}"]`);
      if (!t) { t = document.createElement("div"); t.className = "tile"; t.dataset.id = id; t.innerHTML = `<div class="th"></div><div class="slot"></div>`; st.appendChild(t); }
      const isMain = S.layout === "main3" && i === S.main;
      t.classList.toggle("main", isMain); t.style.order = isMain ? 0 : i + 1;
      t.classList.toggle("onair", id === radioGame());
      t.querySelector(".th").innerHTML = tileHead(id, i, isMain);
      const slot = t.querySelector(".slot");
      if (live && !slot.querySelector("iframe")) {
        slot.innerHTML = `<iframe allow="autoplay; fullscreen" src="/training?watch=${id}"></iframe>`;
        const f = slot.firstChild; f.addEventListener("load", () => { tidyTile(f); attachLog(f, id); watchEnd(f, id); });
      } else if (!live && !slot.querySelector(".wait")) slot.innerHTML = `<div class="wait">${label(S.meta[id])}<br><span class="note">Ready. Press Start.</span></div>`;
    });
    paintFoot();
  }
  function paintFoot() {
    const n = S.air.length, foot = ov.querySelector('[data-k="foot"]'), go = ov.querySelector('[data-act="go"]');
    go.disabled = !n; go.textContent = live ? "↺ Restart together" : "▶ Start the broadcast";
    foot.textContent = n ? `${n} game${n === 1 ? "" : "s"} on air. A 5-second countdown, then every tile starts at once.` : "";
  }
  // Inside each tile show just the ballgame: hide the site's header and footer (same site, so allowed).
  function tidyTile(f) {
    try {
      const d = f.contentDocument; if (!d || d.getElementById("tk-tile-css")) return;
      const s = d.createElement("style"); s.id = "tk-tile-css";
      s.textContent = "header.sitenav, footer.sb-foot, #livebar { display: none !important; } body { background: #000 !important; } .wrap { max-width: none !important; padding-top: 0 !important; margin-top: 0 !important; } html.sbx-sm .main { max-width: calc((100vh - 9vh) * 1.59) !important; margin-left: auto !important; margin-right: auto !important; }";
      d.head.appendChild(s);
    } catch (_) {}
    tvFit(f);
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
  let boothOn = false;
  function paintBooth() {
    if (!isOpen() || !boothOn) return;
    const box = ov.querySelector(".booth"); if (!box) return;
    const ids = S.air.slice(0, S.layout === "single" ? 1 : 4);
    const rows = [];
    ids.forEach((id, gi) => (LOG[id] || []).forEach((e, n) => rows.push({ id, gi, e, n })));
    rows.sort((a, b) => b.e.at - a.e.at || b.n - a.n);
    const html = rows.slice(0, 250).map(({ id, gi, e }) => {
      const m = S.meta[id], tag = m ? `${esc(nm(m.away)).slice(0, 14)} @ ${esc(nm(m.home)).slice(0, 14)}` : "#" + id;
      return `<div class="bl${e.hl ? " hot" : ""}"><span class="gt" style="--c:${TAGC[gi % 4]}">${tag}</span><span class="hf">${esc(e.h)}</span><span class="tx">${e.hl ? "📣 " : ""}${esc(e.t)}${e.hl ? ` <i>${esc(e.hl)}</i>` : ""}</span></div>`;
    }).join("");
    box.querySelector(".blist").innerHTML = html || `<p class="note">Plays show here as the tiles play them.</p>`;
  }
  // A transcript for one game, in order, with half-inning breaks: ready to paste into Discord.
  function transcript(id) {
    const m = S.meta[id], L = LOG[id] || []; let last = "", out = [];
    out.push(`${m ? `${nm(m.away)} at ${nm(m.home)}` : "Game " + id} · SmallBall${m && m.kind ? ` · ${KIND[m.kind] || m.kind}` : ""}`);
    for (const e of L) { if (e.h !== last) { out.push("", `— ${halfName(e.h)} —`); last = e.h; } out.push(`${e.hl ? "📣 " : ""}${e.t}${e.hl ? ` (${e.hl})` : ""}`); if (e.radio) for (const r of e.radio) out.push(`    🎙 ${r}`); }
    return out.join("\n");
  }
  function openBooth() {
    boothOn = !boothOn;
    const box = ov.querySelector(".booth"); box.hidden = !boothOn;
    ov.querySelector(".body").classList.toggle("withbooth", boothOn);
    if (boothOn) {
      box.innerHTML = `<div class="bh"><b>🎙 Booth</b><span class="note">Live from every tile</span><span class="sp"></span><button class="mini" data-act="copyall">Copy transcripts</button><button class="mini" data-act="dl">Download</button></div><div class="blist"></div>`;
      paintBooth();
    }
  }
  function allTranscripts() { const ids = S.air.concat(Object.keys(LOG).map(Number).filter((x) => !S.air.includes(x))).filter((id) => (LOG[id] || []).length); return ids.map(transcript).join("\n\n────────\n\n"); }

  // ---------- 📻 Radio: a booth calls one tile's game out loud, in step with the picture ----------
  // Mack Ramsey (play-by-play, a shameless homer for the home team) and Dewey Seeds (color), plus a rotating
  // guest. Two feeds, both already on screen, so nothing is ever spoiled:
  //   • the player's own scoreboard (count, outs, pitch counter, batter, pitch speed, score): live, every pitch
  //   • the player's play log: what each play was, posted once the ball is dead
  // Every line has a shelf life. A stale line is skipped, and a big play cuts a joke off, so the booth stays
  // with the pitch instead of drifting behind it. Speech is the browser's own; nothing is sent anywhere.
  const RKEY = "tk-radio-v1";
  const RDEF = { on: false, style: "pbp", quips: "some", updates: "half", air: "nonstop", sit: "some", lean: "fair", pbp: "", color: "", guestVoice: "", vol: 1, organ: true, game: 0, pitches: "all", guests: { quiz: true, qb: true, obvious: true } };
  let R; try { R = Object.assign({}, RDEF, JSON.parse(localStorage.getItem(RKEY) || "{}")); } catch (_) { R = Object.assign({}, RDEF); }
  R.guests = Object.assign({}, RDEF.guests, R.guests || {});
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
  const WRONG = ["Is it... Herbert Hoover?", "I'm going to say forty-two.", "Pass. I panicked.", "Whatever the Commish says, I'm saying that.", "Can I phone a friend? Johnny Bosco?", "Is the answer pie? It's usually pie."];
  function storySeg() {
    const st = pickFresh("story", STORIES);
    st.forEach(([w, t], i) => say(w, t, 2, { maxAge: 90000, seg: true, on: i === 0 ? () => tvCard({ k: "From the archives", h: "Tales from the Dugout", p: "Mack and Dewey dig into SmallBall history." }, 9000 * st.length) : null }));
  }
  function triviaSeg(g) {
    const [qq, a] = pickFresh("trivia", TRIVIA), host = g.guestIn && g.guest === "quiz" ? "g" : "p";
    say("p", pickFresh("trivh", ["It's time for SmallBall Trivia!", "SmallBall Trivia time, folks. Play along at home.", "Trivia break! Brought to you by nobody. We have no sponsors."]), 2, { maxAge: 90000, seg: true, on: () => tvCard({ k: "SmallBall Trivia", h: qq, p: "Answer in chat before the booth does." }, 60000) });
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
      else say("c", pickFresh("bigq", ["Those clubs play more games than I eat hot dogs, and Mack, I eat a lot of hot dogs.", "The BigLeague: anybody can play anybody. It's democracy with bats.", "I'm told the standings are updated live. Unlike me."]), 2, { maxAge: 90000, seg: true });
    } catch (_) { storySeg(); }
  }
  function stretchSeg() {
    say("p", "It's the seventh inning stretch! Everybody up.", 2, { maxAge: 90000, seg: true, on: () => tvCard({ k: "Seventh inning stretch", h: "Everybody up!", p: "♪ Take Me Out to the Ball Game ♪" }, 16000) });
    setTimeout(() => melody(), 2500);
    say("pause", "🎵 …", 2, { maxAge: 90000, seg: true, ms: 7000 });
    say("c", pickFresh("stretch", ["I'm up. I'm stretching. Something popped.", "The organist is giving it everything she's got. She's got about four notes.", "Stretch it out, folks. The pitcher sure can't. No bullpen."]), 2, { maxAge: 90000, seg: true });
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
    if (!R.on || !TTS || id !== radioGame()) return;
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
      if (p.first && !["milestone", "bigfirst"].includes(p.k) && q && Math.random() < 0.5) say("c", "And that's a first, by the way. Write it down.", 1, { maxAge: 6000, ev: e });
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
    const it = { who, text, pri, at: Date.now(), maxAge: o.maxAge || 6000, ev: o.ev, seg: !!o.seg, ms: o.ms || 0, on: o.on };
    if (o.front) { let i = 0; while (i < RQ.length && RQ[i].pri >= pri && !RQ[i].seg) i++; RQ.splice(i, 0, it); } else RQ.push(it);
    while (RQ.length > 12 || RQ.filter((x) => !x.seg).length > 5) { let i = RQ.findIndex((x) => x.pri === 0 && !x.seg); if (i < 0) i = RQ.findIndex((x) => x.pri === 1 && !x.seg); if (i < 0) i = RQ.findIndex((x) => !x.seg); if (i < 0) i = RQ.length - 1; RQ.splice(i, 1); }
    if (o.cut) for (let i = RQ.length - 1; i >= 0; i--) if (RQ[i] !== it && RQ[i].pri < 2 && !RQ[i].seg) RQ.splice(i, 1);   // a big play clears the jokes waiting in line (no mid-sentence cancel: it can crash ChromeOS speech)
    pump();
  }
  let VO = [];
  function loadVoices() { VO = TTS ? speechSynthesis.getVoices() : []; if (isOpen()) paintRadio(); }
  if (TTS) { loadVoices(); speechSynthesis.addEventListener?.("voiceschanged", loadVoices); }
  function voiceFor(who, localOnly) {
    const en = VO.filter((v) => /^en/i.test(v.lang) && !BADV.has(v.name) && (!localOnly || v.localService)); const want = who === "c" ? R.color : who === "g" ? R.guestVoice : R.pbp;
    const byName = en.find((v) => v.name === want); if (byName) return byName;
    const taken = who === "p" ? [] : who === "c" ? [(voiceFor("p", localOnly) || {}).name] : [(voiceFor("p", localOnly) || {}).name, (voiceFor("c", localOnly) || {}).name];
    const pref = who === "c" ? [/UK English Male/i, /Daniel/i, /Fred/i, /Guy|Ryan|George/i, /Male/i] : who === "g" ? [/UK English Female/i, /Australia|Karen|Moira|Tessa/i, /Samantha|Victoria/i, /Female/i] : [/US English/i, /Alex/i, /Samantha/i, /Aria|Jenny|Mark/i];
    for (const re of pref) { const v = en.find((x) => re.test(x.name) && !taken.includes(x.name)); if (v) return v; }
    return en.find((x) => !taken.includes(x.name)) || en[0] || null;
  }
  const who2name = (w, id) => (w === "p" ? "Mack" : w === "c" ? "Dewey" : (GUESTS[(GS[id] || {}).guest] || {}).name || "Guest");
  function pump() {
    if (speaking || !RQ.length || !talking()) return;
    if (Date.now() - cutAt < 120) { setTimeout(pump, 130); return; }
    const it = RQ.shift();
    if (Date.now() - it.at > it.maxAge) return pump();
    if (it.on) { try { it.on(); } catch (_) {} }   // Stream Mode cards go up the moment their line is spoken
    if (it.who === "pause") {           // a beat of silence (trivia thinking time)
      speaking = it; const cap = isOpen() && ov.querySelector(".rcap"); if (cap) cap.innerHTML = it.text ? esc(it.text) : "🤔 …"; tvCap("", "");
      setTimeout(() => { if (speaking === it) { speaking = null; pump(); } }, it.ms || 5000); return;
    }
    if (speechDown) { const nm0 = who2name(it.who, radioGame()); const cap = isOpen() && ov.querySelector(".rcap"); if (cap) cap.innerHTML = `🔇 <b>${esc(nm0)}:</b> ${esc(it.text)}`; tvCap(nm0, it.text); if (it.ev) (it.ev.radio || (it.ev.radio = [])).push(`${nm0}: ${it.text}`); speaking = it; setTimeout(() => { if (speaking === it) { speaking = null; pump(); } }, 900 + it.text.length * 45); return; }
    const synth = speechSynthesis;
    const id = radioGame(), G = it.who === "g" ? GUESTS[(GS[id] || {}).guest] : null;
    const u = new SpeechSynthesisUtterance(it.text), v = voiceFor(it.who, it.retry);
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
    const nmw = who2name(it.who, id);
    if (it.ev) (it.ev.radio || (it.ev.radio = [])).push(`${nmw}: ${it.text}`);   // transcripts keep what was actually said
    const cap = isOpen() && ov.querySelector(".rcap"); if (cap) cap.innerHTML = `<b>${esc(nmw)}:</b> ${esc(it.text)}`;
    tvCap(nmw, it.text);
  }
  function paintDiag() {
    const el = isOpen() && ov.querySelector(".rdiag"); if (!el) return;
    if (speechDown) { el.innerHTML = `<b>This computer's text-to-speech isn't working</b> (${esc(lastErr || "no sound")}), so the booth is showing captions only. Every voice failed, so it's not the kit. Fix: restart Chrome (on a Chromebook, restart the Chromebook), then check the voice speaks in your system's text-to-speech settings. Then press Test the booth.`; return; }
    el.textContent = lastErr ? `Speech trouble: ${lastErr}. ${BADV.size ? `Skipping ${[...BADV].join(", ")}; using voices on this computer.` : ""}` : heard ? `Speech OK (${heard} lines heard).` : "";
  }
  function hush() { RQ.length = 0; speaking = null; clearTimeout(rT); cutAt = Date.now(); try { speechSynthesis.cancel(); } catch (_) {} }

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

  function radioIntro() {
    if (!R.on) return;
    const id = radioGame(); if (!id) return;
    const g = gstate(id), pool = Object.keys(GUESTS).filter((k) => R.guests[k]);
    g.guest = pool.length ? pick(pool) : null; g.guestIn = false;
    const t = teams(id, "top");
    say("p", `Hello again, everybody. Mack Ramsey here with Dewey Seeds, and welcome to SmallBall Radio. It's the ${t.away} visiting your ${t.home}.`, 3, { maxAge: 30000 });
    if (R.quips !== "off") say("c", Math.random() < 0.3 ? "SmallBall Radio, back on the air. First time since the frog. Somebody check on Johnny Bosco." : pickFresh("intro", L_COL.intro), 3, { maxAge: 30000 });
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
    const btn = ov.querySelector('[data-act="radio"]'); if (btn) { btn.classList.toggle("on", R.on); btn.textContent = R.on ? "📻 Radio on" : "📻 Radio"; }
    const box = ov.querySelector(".rpanel"); if (!box || box.hidden) return;
    const en = VO.filter((v) => /^en/i.test(v.lang));
    const opts = (cur, who) => `<option value="">Automatic${(voiceFor(who) || {}).name ? ` (${esc(voiceFor(who).name)})` : ""}</option>` + en.map((v) => `<option${v.name === cur ? " selected" : ""}>${esc(v.name)}</option>`).join("");
    const seg = (key, vals) => `<span class="seg" data-seg="${key}">${vals.map(([v, l]) => `<button data-v="${v}" class="${R[key] === v ? "on" : ""}">${l}</button>`).join("")}</span>`;
    box.innerHTML = `
      <div class="rrow"><b>📻 SmallBall Radio</b><span class="note">Mack calls it, Dewey colors it, a guest drops by.</span></div>
      ${TTS ? "" : `<p class="note">This browser has no speech voices, so the radio can't talk here.</p>`}
      <div class="rrow"><span class="lbl">Mack</span><select data-r="pbp">${opts(R.pbp, "p")}</select></div>
      <div class="rrow"><span class="lbl">Dewey</span><select data-r="color">${opts(R.color, "c")}</select></div>
      <div class="rrow"><span class="lbl">Guest</span><select data-r="guestVoice">${opts(R.guestVoice, "g")}</select></div>
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
      <div class="rrow"><button class="mini" data-act="rtest">Test the booth</button><span class="note">On air: ${radioGame() ? label(S.meta[radioGame()]) : "no game yet"}. Use 📻 on a tile to switch.</span></div>
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
    paintDiag();
  }
  function radioToggle() {
    if (!TTS) { R.on = false; return; }
    R.on = !R.on;
    if (!R.on) hush(); else { loadVoices(); if (live) radioIntro(); }
    const box = ov.querySelector(".rpanel"); if (box && R.on) box.hidden = false;
    paintRadio(); paintStage();
  }
  let testing = 0;
  const talking = () => R.on || Date.now() - testing < 25000;
  function radioTest() {
    hush(); testing = Date.now(); speechDown = false; fails = 0; BADV.clear(); lastErr = "";
    say("p", "Testing, one two. Mack Ramsey here. Two and one... swung on, and that ball is outta here!", 3, { maxAge: 30000 }); organ(2);
    say("c", "And I'm Dewey Seeds. They've asked me to stop eating the microphone foam.", 3, { maxAge: 30000 });
    say("g", "And I'm the guest. What is... a microphone check?", 3, { maxAge: 30000 });
  }

  function setSpeed(v) {
    for (const f of ov.querySelectorAll(".stage iframe")) {
      // The player's own speed buttons read "1×", "2×", "4×": match on the number.
      try { const want = v.replace(/\D/g, ""); const b = [...f.contentDocument.querySelectorAll("button")].find((x) => { const t = x.textContent.trim(); return t.length <= 3 && /^\d\s*\S?$/.test(t) && t.replace(/\D/g, "") === want; }); if (b) b.click(); } catch (_) {}
    }
    for (const b of ov.querySelectorAll('[data-seg="speed"] button')) b.classList.toggle("on", b.dataset.v === v);
  }
  async function countdown() {
    const st = ov.querySelector(".stage");
    const c = document.createElement("div"); c.className = "count"; st.appendChild(c);
    for (let i = 5; i >= 1; i--) { c.textContent = i; await sleep(1000); if (!isOpen()) return; }
    c.remove(); live = true; paintStage();
  }

  async function addIds(text) {
    const ids = [...new Set((text.match(/\d+/g) || []).map(Number))];
    for (const id of ids) {
      if (!S.meta[id]) {
        try { const g = await getJSON(`/games/${id}`);
          const hid = g.home_team_id || (g.rosters && g.rosters.home && g.rosters.home.team_id), aid = g.away_team_id || (g.rosters && g.rosters.away && g.rosters.away.team_id);
          let home = g.home_name, away = g.away_name;
          if (!home && hid) try { home = (await getJSON(`/teams/${hid}/profile`)).name; } catch (_) {}
          if (!away && aid) try { away = (await getJSON(`/teams/${aid}/profile`)).name; } catch (_) {}
          S.meta[id] = { id, at: g.finished_at, kind: g.kind || "", good: !!g.good_match, home: home || "Home", away: away || "Away", hid, aid };
        } catch (_) { S.meta[id] = { id, at: new Date().toISOString(), kind: "", home: "Game", away: "#" + id }; }
      }
      if (!S.queue.includes(id)) S.queue.push(id);
    }
    save(); paintBadge(); paintSide(); shield();
  }
  async function doBrowse(club) {
    browseClub = club; browse = `<p class="note">Loading…</p>`; paintSide();
    try {
      const g = await getJSON(`/games/all?club=${club}`);
      const rows = (g.rows || []).slice(0, 20); rows.forEach((r) => { if (!S.meta[r.game_id]) remember(r); });
      save();
      browse = rows.length ? rows.map((r) => `<div class="item"><span class="t">${label(S.meta[r.game_id])}</span><span class="m">${tags(S.meta[r.game_id])}${S.watched[r.game_id] ? `<span class="tag">watched</span>` : ""}</span><span class="b">${S.queue.includes(r.game_id) ? `<span class="note">queued</span>` : `<button class="mini" data-act="q" data-id="${r.game_id}">＋</button>`}</span></div>`).join("") + `<button class="mini" data-act="unbrowse">Close the list</button>`
        : `<p class="note">No games found for that club.</p>`;
    } catch (e) { browse = `<p class="note">Couldn't load that club (${esc(e.message)}).</p>`; }
    paintSide(); shield();
  }

  async function onClick(ev) {
    const b = ev.target.closest("[data-act], [data-seg] button"); if (!b) return;
    const seg = b.closest("[data-seg]");
    if (seg && seg.dataset.seg === "layout") { S.layout = b.dataset.v; save(); paintSeg(); paintStage(); return; }
    if (seg && seg.dataset.seg === "speed") { setSpeed(b.dataset.v); return; }
    if (seg && ["quips", "pitches", "style", "updates", "sit", "air", "lean"].includes(seg.dataset.seg)) { R[seg.dataset.seg] = b.dataset.v; rsave(); paintRadio(); return; }
    const act = b.dataset.act, id = Number(b.dataset.id);
    const val = (k) => (ov.querySelector(`[data-k="${k}"]`) || {}).value || "";
    if (act === "close") close();
    else if (act === "club") {
      const cid = Number(val("club")); if (!cid || S.clubs.some((c) => c.id === cid)) return;
      let name = ""; try { name = (await getJSON(`/teams/${cid}/profile`)).name; } catch (_) {}
      S.clubs.push({ id: cid, name, since: Date.now() }); save(); paintSide(); poll();
    }
    else if (act === "unclub") { S.clubs = S.clubs.filter((c) => c.id !== id); save(); paintSide(); }
    else if (act === "ids") await addIds(val("ids"));
    else if (act === "browse") { const cid = Number(val("browse")); if (cid) await doBrowse(cid); }
    else if (act === "unbrowse") { browse = null; browseClub = 0; paintSide(); }
    else if (act === "fill") await fillTiles();
    else if (act === "fclub") { if (!S.clubs.some((c) => c.id === id)) { let name = ""; try { name = (await getJSON(`/teams/${id}/profile`)).name; } catch (_) {} S.clubs.push({ id, name, since: Date.now() }); save(); paintSide(); poll(); } }
    else if (act === "bclub") await doBrowse(id);
    else if (act === "top") { S.queue = [id].concat(S.queue.filter((x) => x !== id)); save(); paintSide(); }
    else if (act === "q") { if (!S.queue.includes(id)) S.queue.push(id); save(); paintBadge(); if (browseClub) await doBrowse(browseClub); else paintSide(); shield(); }
    else if (act === "drop") { S.queue = S.queue.filter((x) => x !== id); save(); paintBadge(); paintSide(); }
    else if (act === "air") {
      const max = S.layout === "single" ? 1 : 4;
      if (S.air.length >= max) { const f = ov.querySelector('[data-k="foot"]'); f.textContent = `All ${max} tile${max > 1 ? "s are" : " is"} in use. Press ✓ Done or ✕ on a tile to free one${max === 1 ? ", or switch the layout to 2×2" : ""}.`; return; }
      if (!S.air.includes(id)) S.air.push(id); save(); paintSide(); paintStage();
    }
    else if (act === "off") { S.air = S.air.filter((x) => x !== id); save(); paintSide(); paintStage(); }
    else if (act === "done") { S.watched[id] = Date.now(); S.air = S.air.filter((x) => x !== id); save(); paintBadge(); paintSide(); paintStage(); shield(); }
    else if (act === "main") { S.main = Number(b.dataset.i); save(); paintStage(); }
    else if (act === "clearw") { S.watched = {}; save(); paintBadge(); paintSide(); shield(); }
    else if (act === "booth") openBooth();
    else if (act === "radio") radioToggle();
    else if (act === "rset") { const p = ov.querySelector(".rpanel"); p.hidden = !p.hidden; paintRadio(); }
    else if (act === "rtest") radioTest();
    else if (act === "rtile") { R.game = id; hush(); rsave(); paintStage(); paintRadio(); const m = S.meta[id]; if (R.on && m) say("p", `We're switching over to the ${spk(m.away)} and the ${spk(m.home)}.`, 3); }
    else if (act === "copyall") { const t = allTranscripts(); try { await navigator.clipboard.writeText(t); b.textContent = "Copied"; setTimeout(() => { b.textContent = "Copy transcripts"; }, 1500); } catch (_) {} }
    else if (act === "dl") { const t = allTranscripts(); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([t], { type: "text/plain" })); a.download = `smallball-broadcast-${new Date().toISOString().slice(0, 10)}.txt`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
    else if (act === "go") await goLive();
    else if (act === "stream") streamToggle(true);
    else if (act === "smexit") streamToggle(false);
  }
  // One click: put the next games from the queue on the free tiles, and start (or join the running broadcast).
  async function fillTiles() {
    const free = maxTiles() - S.air.length; if (free <= 0) return;
    const next = upNext().slice(0, free); if (!next.length) return;
    S.air = S.air.concat(next); save(); paintSide(); paintStage();
    if (!live) await goLive();
  }
  // Auto next: when a tile's game shows its final for 20 seconds, it's watched; the next queued game takes the tile.
  function watchEnd(f, id) {
    let seen = 0;
    const iv = setInterval(() => {
      if (!f.isConnected || !S.air.includes(id)) { clearInterval(iv); return; }
      if (SM || !S.autoNext) return;                 // Stream Mode runs its own auto-pilot
      let inn = ""; try { inn = ((f.contentDocument.querySelector("#inning") || {}).textContent || "").trim(); } catch (_) { return; }
      if (!/final/i.test(inn)) { seen = 0; return; }
      if (!seen) { seen = Date.now(); return; }
      if (Date.now() - seen < 20000) return;
      clearInterval(iv);
      S.watched[id] = Date.now();
      const slot = S.air.indexOf(id), nx = upNext()[0];
      S.air = S.air.filter((x) => x !== id);
      if (nx) S.air.splice(slot, 0, nx);
      if (R.game === id) R.game = nx || 0;
      save(); paintBadge(); shield(); paintSide(); paintStage();
    }, 2000);
  }
  async function goLive() { hush(); for (const id of S.air) { delete LOG[id]; delete GS[id]; delete BS[id]; } radioIntro(); live = false; for (const sl of ov.querySelectorAll(".stage .slot")) sl.innerHTML = ""; paintStage(); await countdown(); }

  // ---------- Stream Mode: SBSN, a TV screen for OBS or StreamYard to capture ----------
  // Everything on it is already on screen somewhere: the score bug copies the on-air tile's own scoreboard,
  // the captions are the booth's lines, the ticker is the public season page. Scores of games still waiting
  // in the queue are never shown, and BigLeague records of clubs with unwatched games are left off.
  let SM = false, fontsIn = false, tvSeasonAt = 0, tvSeasonData = null, finalAt = 0, finalId = 0, waiting = false, nextT = 0, capT = 0, cardT = 0;
  const tv = (sel) => (isOpen() ? ov.querySelector(".sbsn-tv " + sel) : null);
  function streamToggle(on) {
    if (!isOpen()) return;
    SM = !!on; ov.classList.toggle("sm", SM);
    const btn = ov.querySelector('[data-act="stream"]'); if (btn) btn.blur();
    if (SM) {
      if (!fontsIn) { fontsIn = true; const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Oswald:wght@500;600&display=swap"; document.head.appendChild(l); }
      if (TTS && !R.on) radioToggle();            // this click is the one that lets the booth speak
      const rp = ov.querySelector(".rpanel"); if (rp) rp.hidden = true;
      tvSeason(true); tvTick();
      if (!live) { if (!S.air.length) tvNext(); else goLive(); }
    } else { tvCard(null); tvFull(null); tvCap("", ""); }
    paintStage();
    for (const f of ov.querySelectorAll(".stage iframe")) tvFit(f);
  }
  // In Stream Mode the player's field is sized to the window's height, so the whole diamond shows above the ticker.
  function tvFit(f) { try { f.contentDocument.documentElement.classList.toggle("sbx-sm", SM); } catch (_) {} }
  function tvCap(name, text) {
    const el = tv(".cap"); if (!el) return;
    clearTimeout(capT);
    if (!text) { el.classList.remove("on"); return; }
    el.innerHTML = `${name ? `<b>${esc(name)}</b>` : ""}${esc(text)}`; el.classList.add("on");
    capT = setTimeout(() => el.classList.remove("on"), 4500 + text.length * 70);
  }
  function tvCard(c, ms) {
    const el = tv(".card"); if (!el) return;
    clearTimeout(cardT);
    if (!c || !SM) { el.classList.remove("on"); return; }
    el.innerHTML = `<div class="k">${esc(c.k)}</div><div class="h">${esc(c.h)}</div>${c.p ? `<div class="p">${esc(c.p)}</div>` : ""}${c.list ? `<ol>${c.list.map((x, i) => `<li><span>${i + 1}.</span>${esc(x)}</li>`).join("")}</ol>` : ""}${c.clock ? `<div class="clock"><i style="--t:${c.clock}s"></i></div>` : ""}`;
    el.classList.add("on");
    cardT = setTimeout(() => el.classList.remove("on"), ms || 15000);
  }
  function tvFull(c) {
    const el = tv(".full"); if (!el) return;
    if (!c) { el.classList.remove("on"); return; }
    el.innerHTML = `<div><div class="logo">SBSN</div><div class="k">${esc(c.k)}</div><div class="h">${esc(c.h)}</div>${c.p ? `<div class="p">${esc(c.p)}</div>` : ""}</div>`;
    el.classList.add("on");
  }
  // Clubs with games still waiting to be watched: their records stay off the screen.
  function tvSpoilClubs() { const s = new Set(); for (const id of S.queue.concat(S.air)) if (!S.watched[id] && S.meta[id]) { s.add(String(S.meta[id].hid)); s.add(String(S.meta[id].aid)); } return s; }
  async function tvSeason(force) {
    if (!SM) return;
    if (force || Date.now() - tvSeasonAt > 300000) { tvSeasonAt = Date.now(); try { tvSeasonData = await getJSON("/season"); } catch (_) {} }
    const s = tvSeasonData, hidden = tvSpoilClubs(), parts = [];
    if (s && s.big && s.big.length) parts.push("BIGLEAGUE TOP 10: " + s.big.slice().sort((a, b) => a.rank - b.rank).slice(0, 10).map((x) => `${x.rank}. ${spk(x.name)}${hidden.has(String(x.team_id)) ? "" : ` (${x.wins}-${x.losses})`}`).join("   "));
    const first = s && s.pro && (s.pro[1] || s.pro["1"]); if (Array.isArray(first) && first[0] && first[0].name && !hidden.has(String(first[0].team_id))) parts.push(`FIRST LEAGUE: ${spk(first[0].name)} on top`);
    if (s && s.season && s.season.closes_at) { const d = Math.ceil((Date.parse(s.season.closes_at) - Date.parse(s.season.server_time || new Date().toISOString())) / 864e5); if (d > 0) parts.push(`${d} DAY${d === 1 ? "" : "S"} LEFT IN ${String(s.season.name || "THE SEASON").toUpperCase()}`); }
    const up = S.queue.filter((id) => !S.watched[id] && !S.air.includes(id)).slice(0, 4).map((id) => { const m = S.meta[id] || {}; return `${m.tag ? m.tag + ": " : ""}${spk(m.away)} at ${spk(m.home)}`; });
    if (up.length) parts.push("UP NEXT ON SBSN: " + up.join("   ·   "));
    parts.push("SMALLBALL SPORTS NETWORK · LIVE FROM PLAY.SMALLBALL.COM · NO SPOILERS IN THE CHAT");
    const run = tv(".run"); if (!run) return;
    const html = parts.map(esc).join("<i>★</i>");
    if (run.dataset.h !== html) { run.dataset.h = html; run.innerHTML = html; run.style.setProperty("--dur", Math.max(40, Math.round(run.textContent.length / 9)) + "s"); }
  }
  // The score bug and the auto-pilot: read the on-air tile's own scoreboard once a second.
  function tvTick() {
    if (!SM || !isOpen()) return;
    const id = radioGame(), bug = tv(".bug"), trn = tv(".trn"); if (!bug) return;
    const f = id && ov.querySelector(`.tile[data-id="${id}"] iframe`);
    let d = null; try { d = f && f.contentDocument; } catch (_) {}
    const tx = (sel) => ((d && d.querySelector(sel)) || {}).textContent?.trim() || "";
    const inn = tx("#inning");
    if (!d || !live || !inn) { bug.classList.remove("on"); trn.classList.remove("on"); }
    else {
      const m = S.meta[id] || {}, short = (s) => { s = spk(s); return s.length > 16 ? s.slice(0, 15) + "…" : s; };
      const outs = tx("#outs"), cnt = tx("#count").replace(/\s+/g, " "), final = /final/i.test(inn);
      bug.querySelector(".ta").textContent = short(m.away); bug.querySelector(".th").textContent = short(m.home);
      bug.querySelector(".sa").textContent = tx("#score-a") || "0"; bug.querySelector(".sh").textContent = tx("#score-b") || "0";
      bug.querySelector(".inn").textContent = final ? "FINAL" : [inn, /\d/.test(outs) ? `${outs.replace(/\D/g, "")} OUT` : "", cnt].filter(Boolean).join("  ·  ");
      bug.classList.add("on");
      trn.textContent = m.tag ? `🏆 ${m.tag}` : (KIND[m.kind] || ""); trn.classList.toggle("on", !!trn.textContent);
      if (final) { if (finalId !== id) { finalId = id; finalAt = Date.now(); } else if (Date.now() - finalAt > 25000) { finalId = 0; tvNext(id); } }
    }
    if (waiting && S.queue.some((x) => !S.watched[x] && !S.air.includes(x))) tvNext();
  }
  setInterval(tvTick, 1000);
  setInterval(() => tvSeason(false), 30000);
  // Next game: the finished one is marked watched, the next unwatched game in the queue (tournament games
  // first) gets a "Next on SBSN" card, then goes on the air. Nothing queued: a waiting screen until one is.
  function tvNext(doneId) {
    if (!SM || nextT) return;
    if (doneId) { S.watched[doneId] = Date.now(); S.air = S.air.filter((x) => x !== doneId); if (R.game === doneId) R.game = 0; save(); paintBadge(); shield(); }
    const cands = S.queue.filter((x) => !S.watched[x] && !S.air.includes(x));
    const next = S.air.find((x) => !S.watched[x]) || cands.find((x) => (S.meta[x] || {}).tag) || cands[0];
    if (!next) {
      waiting = true; tvCard(null);
      tvFull({ k: "Stay tuned", h: "SBSN will be right back", p: S.clubs.length ? `The next game from the ${S.clubs.length} club${S.clubs.length === 1 ? "" : "s"} we follow airs as soon as it's played.` : "Add games or follow clubs in the Broadcast Kit and they air here." });
      paintStage(); tvSeason(false); return;
    }
    waiting = false; const m = S.meta[next] || {};
    tvCard(null); tvCap("", "");
    tvFull({ k: m.tag ? `Next on SBSN · ${m.tag}` : `Next on SBSN · ${KIND[m.kind] || "SmallBall"}`, h: `${spk(m.away)} at ${spk(m.home)}`, p: "First pitch in a few seconds. No spoilers in the chat!" });
    nextT = setTimeout(() => {
      nextT = 0; if (!SM || !isOpen()) return;
      const playing = !!ov.querySelector(`.tile[data-id="${next}"] iframe`);   // already rolling on another tile: just switch to it
      if (!S.air.includes(next)) S.air.unshift(next);
      R.game = next; save();
      if (!playing) { delete LOG[next]; delete GS[next]; delete BS[next]; }
      tvFull(null); hush(); live = true; paintSide(); paintStage(); radioIntro(); tvSeason(false);
    }, doneId ? 12000 : 6000);
  }
})();
