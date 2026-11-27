// SmallBall Club Kit: 🧩 LINEUP BUILDER.
// Drag men between positions, the bench and the batting order, or let ⚡ Optimize build the lineup YOUR way
// (presets, sliders, rules, 🔒 locks). It only fills in SmallBall's own lineup form: nothing is saved until you
// press Save yourself. Your settings are kept per club in this browser. Turn it off in the Club Kit's ⚙ under Features.
(() => {
  if (window.top !== window) return;
  try {  } catch (_) {}

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

  const sameLineup = (a, b) => a && b && a.pos.every((id, i) => id === b.pos[i]) && a.order.every((id, i) => id === b.order[i]);
  function savedRow(c, form) {
    const list = c.saved || [];
    return `<div class="saved"><span class="lbl">💾 Saved lineups:</span>` +
      (list.length ? list.map((x, i) => `<span class="sv${sameLineup(x, form) ? " cur" : ""}" title="${esc(x.name)} · saved ${esc(new Date(x.at).toLocaleDateString())}${sameLineup(x, form) ? " · this is what's in the form now" : ""}"><button type="button" data-load="${i}">${esc(x.name)}</button><button type="button" class="del" data-del="${i}" title="Delete this saved lineup">✕</button></span>`).join("") : `<span style="opacity:.65">none yet</span>`) +
      (ST.naming ? `<input type="text" maxlength="30" placeholder="Name it, e.g. Hill defense" data-name><button type="button" class="bb go" data-sv="ok">Save</button><button type="button" class="bb" data-sv="no">Cancel</button>`
        : `<button type="button" class="bb" data-sv="new" title="Save the lineup and batting order that are in the form right now">＋ Save this lineup</button>`) + "</div>";
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
