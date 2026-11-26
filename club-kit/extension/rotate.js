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
