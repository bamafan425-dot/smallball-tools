(async()=>{const esc=(s)=>String(s).replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const HILL_BOARD="https://slipnsliders.github.io/smallball-tools/hill/"; const hillNeed=(gap)=>(gap<=1?1:gap+1);
function ownIds(){const sel=document.getElementById("who-team");return new Set(sel?Array.from(sel.options).map(o=>o.value):[]);}
const LIVE={H:await (await fetch("https://raw.githubusercontent.com/slipnsliders/smallball-tools/main/docs/hill/board.json?t="+Date.now())).json()};
  function chargeUrl(H, target, isAce) {
    const P = H && H.prefill, base = (H && H.formLink) || HILL_BOARD;
    const opt = isAce ? P && P.ace : target && target.opt;
    if (!P || !P.url || !P.action || !P.opp || !opt) return base;
    return P.url + "?usp=pp_url&" + P.action + "=" + encodeURIComponent(P.charge) + "&" + P.opp + "=" + encodeURIComponent(opt);
  }

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

  function paintCdn() {
    document.querySelectorAll(".sbx-cdn[data-until]").forEach((el) => {
      const ms = Date.parse(el.dataset.until) - Date.now();
      const m = Math.round(ms / 60000), txt = ms <= 0 ? "time's up" : m < 60 ? m + " min left" : Math.floor(m / 60) + " h " + (m % 60) + " min left";
      if (el.textContent !== txt) el.textContent = txt;
      el.style.cssText = "display:inline-block;margin-left:4px;padding:1px 7px;border-radius:999px;font:700 11.5px/1.5 system-ui,sans-serif;white-space:nowrap;" +
        (ms <= 30 * 60000 ? "background:#dc2626;color:#fff" : ms <= 2 * 3600000 ? "background:#f59e0b;color:#1b1300" : "background:rgba(255,255,255,.16);color:inherit");
    });
  }

  function mountHillBar() {
    let el = document.getElementById("sbx-hillbar");
    const m = location.hash.match(/^#\/team\/(\d+)/), head = document.querySelector("main .teamhead"), H = LIVE.H;
    if (!m || !head || !H || !H.ladder) { if (el) el.remove(); return; }
    const id = m[1], mine = ownIds(), all = (H.ace ? [H.ace] : []).concat(H.ladder);
    const tgt = all.find((p) => String(p.clubId) === id);
    if (!tgt || mine.has(id)) { if (el) el.remove(); return; }
    const reach = Number(H.reach) || 3, openTo = Number(H.moundOpenTo) || 0, B = H.bell || null, t = Number(tgt.rank), isAce = H.ace && String(H.ace.clubId) === id;
    const busy = (n) => (H.charges || []).find((c) => c.ch === n || c.df === n);
    const opts = [], notes = [];
    all.filter((p) => mine.has(String(p.clubId))).forEach((me) => {
      const r = Number(me.rank);
      if (r === 0) { notes.push("You hold the mound with " + esc(me.club) + "."); return; }
      let ok = false, need = "";
      if (isAce) { if (r === 1 || (openTo && r <= openTo)) { ok = true; need = "title shot, any win"; } else if (B && B.open) { ok = true; need = "🔔 Bell: win by " + (B.margin || 3) + "+ for the title"; } }
      else if (r - t >= 1 && r - t <= reach) { ok = true; const n = hillNeed(r - t); need = n > 1 ? "win by " + n + "+" : "just win"; }
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
    const ttl = "⛰️ <b>" + esc(tgt.name) + "</b> is " + (isAce ? "♠ <b>the Ace</b>" : "<b>#" + t + "</b>") + " on Hold the Hill.";
    el.innerHTML = '<span style="flex:1 1 260px">' + ttl + (notes.length && !opts.length ? ' <span style="opacity:.8">' + notes.join(" ") + "</span>" : "") + "</span>" +
      opts.map((o) => '<a href="' + esc(chargeUrl(H, tgt, isAce)) + '" target="_blank" rel="noopener" title="Opens the Master Form with this charge filled in. Submit it signed in as ' + esc(o.me.name) + '. If the Opponent box comes up empty (an old draft of the form can do that), pick ' + esc(isAce ? "♠ THE ACE" : "#" + t + " · " + tgt.name) + '." style="background:#facc15;color:#1b1300;font-weight:800;padding:8px 14px;border-radius:999px;text-decoration:none;white-space:nowrap">⚔️ Charge them' + (opts.length > 1 ? " with " + esc(o.me.club) : "") + ' <span style="font-weight:600;opacity:.8">· ' + esc(o.need) + "</span></a>").join("");
    if (el.previousElementSibling !== head) head.insertAdjacentElement("afterend", el);
  }

mountHillBar(); paintCdn(); return document.getElementById("sbx-hillbar") ? document.getElementById("sbx-hillbar").innerText : "no bar";})()