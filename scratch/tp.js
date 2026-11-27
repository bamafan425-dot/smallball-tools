(()=>{const esc=(s)=>String(s).replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms)); const PROF={}; const BOX={}; const boxSave=()=>{};
async function getJSON(u){const r=await fetch(u,{credentials:"include"}); if(!r.ok) throw new Error("HTTP "+r.status); return r.json();}
function ownIds(){const sel=document.getElementById("who-team");return new Set(sel?Array.from(sel.options).map(o=>o.value):[]);}
const tick=()=>{ const t=document.querySelector("main table.squad"); const m=location.hash.match(/#\/team\/(\d+)/); if(t&&m) hotTags(t,Number(m[1])); mountTrainPlan(); };
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

  // ───────── 🔥🧊 Hot & cold: the last 10 games against each man's career, in the squad table ─────────
  const HOT = {};   // team -> { at, busy, map: pid -> { tag, tip } }
  window.__sbxHot2 = HOT;   // the Lineup Builder reads this for its chips
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

  // ───────── 🏋️ Training plan: your plan for each man, next to the trainer and on your club page ─────────
  const TPLAN_KEY = "sbx-trainplan";
  const SKL = [["P", "pitch_skill", "Pitching"], ["C", "catch_skill", "Glove"], ["T", "pass_power", "Arm"], ["R", "run_speed", "Speed"], ["BS", "swing_skill", "Batting skill"], ["BP", "swing_power", "Power"], ["BC", "contact_odds", "Contact"]];
  const tplanAll = () => { try { return JSON.parse(localStorage.getItem(TPLAN_KEY)) || {}; } catch (_) { return {}; } };
  const tplanSave = (team, o) => { const a = tplanAll(); a[team] = o; try { localStorage.setItem(TPLAN_KEY, JSON.stringify(a)); } catch (_) {} };
  const todayKey = () => new Date().toLocaleDateString("en-CA");
  const TPL = { open: false, team: 0, sig: "" };
  function tplanTeam() {
    if (location.pathname === "/training") { const q = new URLSearchParams(location.search); const id = Number(q.get("team") || q.get("watch") || 0); return id || Number((document.getElementById("who-team") || {}).value || 0); }
    const m = location.hash.match(/^#\/team\/(\d+)/); return m && ownIds().has(m[1]) ? Number(m[1]) : 0;
  }
  // "About how far to the next star": compares a man's skill average with the teammates already a star higher.
  function nextStar(p, roster) {
    const avg = (x) => SKL.reduce((t, [, k]) => t + (+x[k] || 0), 0) / SKL.length;
    const o = +p.overall || 0, up = roster.filter((x) => (+x.overall || 0) === o + 1);
    if (!up.length) return null;
    const need = Math.min(...up.map(avg)) - avg(p);
    return { star: o + 1, gap: Math.max(0, Math.round(need * SKL.length)) };   // in total skill points
  }
  function mountTrainPlan() {
    const team = tplanTeam(), onTrainer = location.pathname === "/training";
    let btn = document.getElementById("sbx-tplan-btn"), pan = document.getElementById("sbx-tplan");
    if (!team) { btn?.remove(); pan?.remove(); return; }
    if (!btn) {
      btn = document.createElement("button"); btn.id = "sbx-tplan-btn"; btn.type = "button";
      btn.style.cssText = "position:fixed;z-index:2147482000;right:14px;" + (onTrainer ? "top:130px" : "bottom:64px") + ";border:0;border-radius:999px;padding:9px 14px;font:800 13px/1 system-ui,sans-serif;background:#16a34a;color:#fff;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.35)";
      btn.onclick = () => { TPL.open = !TPL.open; TPL.sig = ""; mountTrainPlan(); };
      document.body.appendChild(btn);
    }
    btn.textContent = TPL.open ? "🏋️ Hide plan" : "🏋️ Training plan";
    if (!TPL.open) { pan?.remove(); return; }
    const c = PROF[team];
    if (!c || Date.now() - c.at > 120000) { if (!TPL.loading) { TPL.loading = true; profileOf(team, 120000).catch(() => {}).finally(() => { TPL.loading = false; TPL.sig = ""; setTimeout(mountTrainPlan, 0); }); } if (!c) return; }
    if (!HOT[team] || (!HOT[team].busy && Date.now() - HOT[team].at > 10 * 60000)) loadHot(team);
    const prof = c.data, roster = (prof && prof.roster) || [], plan = tplanAll()[team] || {}, hot = (HOT[team] || {}).map || {};
    const sig = JSON.stringify([team, c.at, plan, Object.keys(hot).length, todayKey()]);
    if (pan && pan.dataset.sig === sig) return;
    if (!pan) {
      pan = document.createElement("div"); pan.id = "sbx-tplan";
      pan.style.cssText = "position:fixed;z-index:2147481999;right:14px;" + (onTrainer ? "top:170px" : "bottom:110px") + ";width:min(430px,94vw);max-height:" + (onTrainer ? "calc(100vh - 190px)" : "70vh") + ";overflow:auto;background:#0f1b33;color:#f4ebd9;border-radius:14px;box-shadow:0 14px 40px rgba(0,0,0,.45);font:13px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:12px 14px";
      document.body.appendChild(pan);
    }
    pan.dataset.sig = sig;
    const today = todayKey(), done = roster.filter((p) => (plan[p.player_id] || {}).done === today).length, planned = roster.filter((p) => ((plan[p.player_id] || {}).focus || []).length).length;
    const ready = roster.filter((p) => (+p.tp || 0) >= 95).map((p) => esc(p.name));
    const rows = roster.slice().sort((a, b) => (b.position ? 1 : 0) - (a.position ? 1 : 0) || (+b.tp || 0) - (+a.tp || 0)).map((p) => {
      const P = plan[p.player_id] || {}, f = P.focus || [], ns = nextStar(p, roster), tp = Math.round(+p.tp || 0), h = hot[p.player_id];
      return '<div class="tr" data-pid="' + p.player_id + '" style="padding:8px 0;border-top:1px solid rgba(255,255,255,.08)">' +
        '<div style="display:flex;align-items:center;gap:6px"><label title="Trained today" style="cursor:pointer"><input type="checkbox" data-done ' + (P.done === today ? "checked" : "") + '></label>' +
        '<b style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (h ? '<span title="' + esc(h.tip) + '">' + (h.tag === "hot" ? "🔥" : "🧊") + "</span> " : "") + esc(p.name) + ' <span style="opacity:.65;font-weight:600">' + esc(p.position || "bench") + " · " + (+p.overall || 0) + "★</span></b>" +
        '<span title="Training points: full at 100" style="font-size:11.5px;font-weight:700;padding:1px 7px;border-radius:999px;' + (tp >= 95 ? "background:#16a34a;color:#fff" : "background:rgba(255,255,255,.12)") + '">' + tp + " TP</span></div>" +
        '<div style="display:flex;flex-wrap:wrap;gap:4px;margin:5px 0 0 22px">' + SKL.map(([k, f2, nm]) => '<button type="button" data-sk="' + k + '" title="' + nm + ": " + (+p[f2] || 0) + (f.includes(k) ? " · in your plan" : " · tap to add to the plan") + '" style="border:1px solid ' + (f.includes(k) ? "#facc15" : "rgba(255,255,255,.2)") + ";background:" + (f.includes(k) ? "#facc15" : "transparent") + ";color:" + (f.includes(k) ? "#1b1300" : "inherit") + ';border-radius:7px;padding:2px 6px;font:700 11px/1.3 ui-monospace,monospace;cursor:pointer">' + k + " " + (+p[f2] || 0) + "</button>").join("") + "</div>" +
        '<div style="display:flex;gap:6px;align-items:center;margin:5px 0 0 22px">' + (ns ? '<span style="font-size:11.5px;opacity:.75;white-space:nowrap" title="Compared with the teammates already at ' + ns.star + '★: about this many skill points short. A rough guide, not the site\'s formula.">≈' + ns.gap + " to " + ns.star + "★</span>" : "") +
        '<input type="text" data-note value="' + esc(P.note || "") + '" placeholder="Plan note: e.g. BP to 90, then BC" maxlength="80" style="flex:1;min-width:0;font:inherit;font-size:12px;background:#13254a;color:inherit;border:1px solid rgba(255,255,255,.2);border-radius:7px;padding:3px 7px"></div></div>';
    }).join("");
    pan.innerHTML = '<div style="display:flex;align-items:center;gap:8px"><b style="font-size:15px;flex:1">🏋️ Training plan · ' + esc(prof.name || team) + '</b><button type="button" data-x style="border:0;background:none;color:inherit;font-size:18px;cursor:pointer;opacity:.7" title="Close">✕</button></div>' +
      '<div style="opacity:.8;margin:4px 0 8px">Tap skills to plan what each man works on, add a note, tick ✓ when he\'s trained today. Saved in this browser (and in 💾 backups). The kit never trains for you.</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;font-size:12px;margin-bottom:4px"><span style="background:rgba(255,255,255,.1);border-radius:999px;padding:3px 9px">✓ ' + done + " of " + roster.length + " trained today</span>" +
      '<span style="background:rgba(255,255,255,.1);border-radius:999px;padding:3px 9px">📝 ' + planned + " with a plan</span>" +
      (ready.length ? '<span style="background:#16a34a;color:#fff;border-radius:999px;padding:3px 9px" title="Full of training points">⚡ Ready: ' + ready.slice(0, 4).join(", ") + (ready.length > 4 ? " +" + (ready.length - 4) : "") + "</span>" : "") + "</div>" + rows;
    const upd = (pid, fn) => { const all = tplanAll(), t = all[team] || {}, x = t[pid] || {}; fn(x); t[pid] = x; tplanSave(team, t); };
    pan.querySelector("[data-x]").onclick = () => { TPL.open = false; mountTrainPlan(); };
    pan.querySelectorAll(".tr").forEach((row) => {
      const pid = row.dataset.pid;
      row.querySelector("[data-done]").onchange = (e) => { upd(pid, (x) => { x.done = e.target.checked ? todayKey() : ""; }); TPL.sig = ""; pan.dataset.sig = ""; mountTrainPlan(); };
      row.querySelectorAll("[data-sk]").forEach((b) => (b.onclick = () => { upd(pid, (x) => { const f = new Set(x.focus || []); f.has(b.dataset.sk) ? f.delete(b.dataset.sk) : f.add(b.dataset.sk); x.focus = SKL.map(([k]) => k).filter((k) => f.has(k)); }); pan.dataset.sig = ""; mountTrainPlan(); }));
      const n = row.querySelector("[data-note]"); n.onchange = () => upd(pid, (x) => { x.note = n.value.trim(); });
    });
  }


window.__T={tick,HOT,mountTrainPlan,TPL}; TPL.open=true; tick();})();