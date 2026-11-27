(()=>{const esc=(s)=>String(s).replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms)); const PROF={}; const BOX={}; const boxSave=()=>{};
async function getJSON(u){const r=await fetch(u,{credentials:"include"}); if(!r.ok) throw new Error("HTTP "+r.status); return r.json();}
function ownIds(){const sel=document.getElementById("who-team");return new Set(sel?Array.from(sel.options).map(o=>o.value):[]);}
const tick=()=>{ try{ mountScout(); }catch(e){console.warn(e)} };
  async function profileOf(team, maxAge) {
    const c = PROF[team];
    if (c && Date.now() - c.at < maxAge) return c.data;
    const d = await getJSON(`/teams/${team}/profile`);
    PROF[team] = { at: Date.now(), data: d };
    return d;
  }

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

  function resultOf(g, team) {
    const h = g.home_team_id === team;
    const a = h ? g.home_runs : g.away_runs, b = h ? g.away_runs : g.home_runs;
    return a > b ? "w" : a < b ? "l" : "t";
  }

  // ───────── 🔥🧊 Hot & cold: the last 10 games against each man's career, in the squad table ─────────
  const HOT = {};   // team -> { at, busy, map: pid -> { tag, tip } }
     // the Lineup Builder reads this for its chips
  const opsOf = (ab, h, b2, b3, hr, bb) => { const pa = ab + bb; if (!pa || !ab) return null; const tb = h + b2 + 2 * b3 + 3 * hr; return (h + bb) / pa + tb / ab; };
  async function loadHot(team) {
    const H = HOT[team] || (HOT[team] = { at: 0, busy: false, map: {} });
    if (H.busy || Date.now() - H.at < 10 * 60000) return;
    H.busy = true;
    try {
      const prof = await profileOf(team, 5 * 60000);
      const games = (await seasonGames(team)).filter((g) => g.finished_at).sort((a, b) => Date.parse(b.finished_at) - Date.parse(a.finished_at)).slice(0, 10);
      await fillBoxes(games, () => true);
      const L = {};
      for (const g of games) {
        const [S] = sideOf(BOX[g.game_id], team); if (!S) continue;
        for (const [id, x] of Object.entries(S.p)) { const a = L[id] || (L[id] = { g: 0, ab: 0, h: 0, b2: 0, b3: 0, hr: 0, bb: 0 }); a.g++; a.ab += x[0]; a.h += x[1]; a.b2 += x[2]; a.b3 += x[3]; a.hr += x[4]; a.bb += x[5]; }
      }
      const map = {};
      for (const p of (prof && prof.roster) || []) {
        const a = L[String(p.player_id)], c = p.career || {};
        if (!a || a.ab < 15) continue;
        const now = opsOf(a.ab, a.h, a.b2, a.b3, a.hr, a.bb), car = opsOf(c.at_bats || 0, c.hits || 0, c.doubles || 0, c.triples || 0, c.home_runs || 0, c.walks || 0);
        if (now == null || car == null || (c.at_bats || 0) < 60) continue;
        const d = now - car, f3 = (x) => x.toFixed(3).replace(/^0/, "");
        const tip = "Last " + a.g + " games: " + a.h + "-for-" + a.ab + (a.hr ? ", " + a.hr + " HR" : "") + (a.bb ? ", " + a.bb + " BB" : "") + " · OPS " + f3(now) + " (career " + f3(car) + ")";
        if (d >= 0.15) map[p.player_id] = { tag: "hot", tip: "🔥 Hot. " + tip };
        else if (d <= -0.15) map[p.player_id] = { tag: "cold", tip: "🧊 Cold. " + tip };
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


  // ───────── 🔎 Scouting report + ⚔️ rivalry, on other clubs' pages ─────────
  // From what SmallBall already shows anyone: their roster, their recent games and your games against them.
  const SC = {};   // team -> { busy, at, prof, h2h }
  const SCOUT_OPEN = "sbx-scout-open";
  const DEFIT = {   // the same position fit the Lineup Builder uses: glove, arm and speed
    "1B": (p) => 0.8 * p.catch_skill + 0.2 * p.pass_power, "2B": (p) => 0.6 * p.catch_skill + 0.2 * p.pass_power + 0.2 * p.run_speed,
    SS: (p) => 0.45 * p.catch_skill + 0.35 * p.pass_power + 0.2 * p.run_speed, "3B": (p) => 0.5 * p.catch_skill + 0.5 * p.pass_power,
    LF: (p) => 0.45 * p.catch_skill + 0.25 * p.pass_power + 0.3 * p.run_speed, CF: (p) => 0.35 * p.catch_skill + 0.2 * p.pass_power + 0.45 * p.run_speed,
    RF: (p) => 0.4 * p.catch_skill + 0.35 * p.pass_power + 0.25 * p.run_speed, C: (p) => 0.55 * p.catch_skill + 0.45 * p.pass_power,
  };
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
      S.h2h = h2h; S.at = Date.now();
    } catch (_) { S.at = Date.now() - 8 * 60000; }
    finally { S.busy = false; setTimeout(tick, 0); }
  }
  function scoutHtml(team, S) {
    const P = S.prof, roster = (P && P.roster) || [], st = roster.filter((p) => p.position).sort((a, b) => (+a.bats || 9) - (+b.bats || 9));
    if (!st.length) return '<div class="muted">No lineup to read yet.</div>';
    const ops = (c) => { c = c || {}; const ab = c.at_bats || 0, bb = c.walks || 0; if (ab < 60) return null; const tb = (c.hits || 0) + (c.doubles || 0) + 2 * (c.triples || 0) + 3 * (c.home_runs || 0); return ((c.hits || 0) + bb) / (ab + bb) + tb / ab; };
    const f3 = (x) => x.toFixed(3).replace(/^0/, ""), avg = (list, k) => list.length ? list.reduce((t, p) => t + (+p[k] || 0), 0) / list.length : 0;
    const hot = ((HOT[team] || {}).map) || {}, tag = (p) => { const h = hot[p.player_id]; return h ? '<span title="' + esc(h.tip) + '">' + (h.tag === "hot" ? "🔥" : "🧊") + "</span> " : ""; };
    const bats = st.filter((p) => p.position !== "P").map((p) => ({ p, o: ops(p.career) })).filter((x) => x.o != null).sort((a, b) => b.o - a.o).slice(0, 3);
    const pit = st.find((p) => p.position === "P");
    const fits = st.filter((p) => DEFIT[p.position]).map((p) => ({ p, f: Math.round(DEFIT[p.position](p)) })).sort((a, b) => a.f - b.f);
    const myTeam = Number((document.getElementById("who-team") || {}).value || 0), myC = PROF[myTeam], mySt = myC && myC.data && myC.data.roster ? myC.data.roster.filter((p) => p.position && p.position !== "P") : [];
    if (myTeam && !myC) profileOf(myTeam, 300000).then(() => setTimeout(tick, 0)).catch(() => {});
    const them = st.filter((p) => p.position !== "P"), A = (k) => Math.round(avg(them, k)), M = (k) => Math.round(avg(mySt, k));
    const tips = [];
    if (pit) { const pv = +pit.pitch_skill || 0; if (pv >= 90) tips.push("🎯 Their pitcher is tough (" + esc(pit.name) + ", P " + pv + "): contact bats over power."); else if (pv && pv <= 75) tips.push("💣 Their pitcher is hittable (" + esc(pit.name) + ", P " + pv + "): load up on power."); }
    if (mySt.length && M("run_speed") - A("run_speed") >= 4) tips.push("🏃 You're quicker (speed " + M("run_speed") + " vs " + A("run_speed") + "): put speed at the top of your order.");
    if (mySt.length && A("swing_power") - M("swing_power") >= 4) tips.push("🧤 They hit for more power (" + A("swing_power") + " vs " + M("swing_power") + "): your best gloves and arms in the outfield.");
    if (fits.length && fits[0].f < 72) tips.push("🎯 Soft spot at " + esc(fits[0].p.position) + ": " + esc(fits[0].p.name) + " (fit " + fits[0].f + ").");
    const hotOne = them.find((p) => (hot[p.player_id] || {}).tag === "hot"); if (hotOne) tips.push("🔥 Watch " + esc(hotOne.name) + ": hot over the last 10 games.");
    const cmp = (k, label) => '<span class="it" title="Their starters\' average' + (mySt.length ? " vs yours" : "") + '"><span class="k">' + label + "</span><b>" + A(k) + "</b>" + (mySt.length ? ' <span style="opacity:.7">vs ' + M(k) + "</span>" : "") + "</span>";
    return '<div class="sc-row"><b>Lineup</b> ' + st.map((p, i) => '<span class="sc-man" title="' + esc(p.name) + " · " + p.position + " · " + (+p.overall || 0) + '★">' + (i + 1) + ". " + tag(p) + esc(p.name) + ' <i>' + esc(p.position) + "</i></span>").join("") + "</div>" +
      '<div class="sc-row">' + cmp("contact_odds", "Contact") + cmp("swing_skill", "Batting") + cmp("swing_power", "Power") + cmp("run_speed", "Speed") + (pit ? '<span class="it"><span class="k">Pitcher</span><b>' + esc(pit.name) + " · P " + (+pit.pitch_skill || 0) + "</b></span>" : "") + "</div>" +
      (bats.length ? '<div class="sc-row"><b>Best bats</b> ' + bats.map((x) => tag(x.p) + esc(x.p.name) + ' <span style="opacity:.7">OPS ' + f3(x.o) + "</span>").join(" · ") + "</div>" : "") +
      (fits.length ? '<div class="sc-row"><b>Weakest gloves</b> ' + fits.slice(0, 2).map((x) => esc(x.p.position) + " " + esc(x.p.name) + ' <span style="opacity:.7">fit ' + x.f + "</span>").join(" · ") + "</div>" : "") +
      (tips.length ? '<div class="sc-row sc-tips">' + tips.slice(0, 4).map((t) => "<div>" + t + "</div>").join("") + "</div>" : "");
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
      st.textContent = "#sbx-scout{margin:10px 0;padding:10px 14px;border-radius:12px;background:rgba(127,127,127,.1);border:1px solid rgba(127,127,127,.3);font:13.5px/1.45 system-ui,sans-serif}#sbx-scout summary{cursor:pointer;font-weight:800;font-size:15px}#sbx-scout .sc-row{margin-top:7px;display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline}#sbx-scout .sc-man{white-space:nowrap}#sbx-scout .sc-man i{opacity:.6;font-style:normal;font-size:11.5px}#sbx-scout .it{display:inline-flex;gap:5px;align-items:baseline;background:rgba(127,127,127,.14);border-radius:999px;padding:2px 9px}#sbx-scout .it .k{opacity:.7;font-size:12px}#sbx-scout .sc-tips{display:block;padding:6px 10px;border-radius:9px;background:rgba(250,204,21,.12);border:1px solid rgba(250,204,21,.4)}#sbx-scout .chips i{display:inline-block;width:18px;text-align:center;font-style:normal;font-weight:800;font-size:11px;border-radius:4px;margin-left:2px}#sbx-scout .chips i.w{background:#16a34a;color:#fff}#sbx-scout .chips i.l{background:#dc2626;color:#fff}#sbx-scout .chips i.t{background:#64748b;color:#fff}";
      document.head.appendChild(st);
    }
    const body = !S || !S.prof ? '<div class="sc-row muted">Reading their roster and your games against them…</div>' : h2hHtml(S) + scoutHtml(team, S);
    const key = team + "|" + (S ? S.at : 0) + "|" + ((HOT[team] || {}).at || 0) + "|" + open + "|" + (PROF[Number((document.getElementById("who-team") || {}).value || 0)] ? 1 : 0);
    if (el && el.dataset.k === key && el.isConnected) return;
    if (!el) { el = document.createElement("details"); el.id = "sbx-scout"; el.addEventListener("toggle", () => { try { localStorage.setItem(SCOUT_OPEN, el.open ? "1" : "0"); } catch (_) {} }); }
    el.dataset.k = key; el.open = open;
    el.innerHTML = "<summary>🔎 Scouting report</summary>" + body;
    const after = document.getElementById("sbx-hillbar") || head;
    if (el.previousElementSibling !== after) after.insertAdjacentElement("afterend", el);
  }


window.__S={tick,SC}; tick();})();