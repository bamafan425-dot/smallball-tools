(()=>{const esc=(s)=>String(s).replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const on=()=>true, hasChromeStorage=false, LIVE={}, HILL_BOARD="https://slipnsliders.github.io/smallball-tools/hill/"; const liveWhen=(ms)=>new Date(ms).toLocaleString([], {weekday:"short",hour:"numeric",minute:"2-digit"});
function ownIds(){return new Set(["8897"]);} async function liveGet(){return null;}
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
  function alertEvents(H, items, mine) {
    const ev = [], now = Date.now();
    if (H && H.ladder) {
      const all = (H.ace ? [H.ace] : []).concat(H.ladder), me = all.filter((p) => mine.has(String(p.clubId))), names = new Set(me.map((p) => p.name));
      const clubOf = (n) => (all.find((p) => p.name === n) || {}).club || n;
      for (const c of H.charges || []) {
        if (/reported|airing/i.test(c.status || "")) continue;
        const dl = Date.parse(c.deadline || "") || 0;
        if (names.has(c.df)) ev.push({ id: "hc:" + c.created + ":" + c.df, ico: "🛡️", title: "You've been charged on the Hill", text: c.ch + " charged " + clubOf(c.df) + (c.type === "Title" ? " for the title" : "") + ". They start the game; be ready.", until: c.deadline, url: HILL_BOARD, hot: true });
        if (names.has(c.ch) && dl && dl - now < 30 * 60000 && dl > now) ev.push({ id: "hd:" + c.created, ico: "⏱", title: "Under 30 minutes to play your Hill game", text: "Your charge on " + c.df + " runs out soon. Start a BigLeague game as the visitor.", until: c.deadline, url: HILL_BOARD, hot: true });
      }
      const B = H.bell, climbers = me.filter((p) => Number(p.rank) > 0), ace = me.find((p) => Number(p.rank) === 0);
      if (B && B.open && !B.answered) {
        if (climbers.length) ev.push({ id: "bell:" + B.until, ico: "🔔", title: "THE BELL IS RINGING", text: "Anyone on the climb can charge the Ace" + (H.ace ? " (" + H.ace.name + ")" : "") + ". Win by " + (B.margin || 3) + "+ for the title. First one in.", until: B.until, url: chargeUrl(H, H.ace, true), hot: true });
        else if (ace) ev.push({ id: "bella:" + B.until, ico: "🔔", title: "The Bell is ringing: anyone can charge you", text: "They need to win by " + (B.margin || 3) + "+ to take the hill.", until: B.until, url: HILL_BOARD });
      } else if (B && B.soon && B.next && me.length) ev.push({ id: "bells:" + B.next, ico: "🔔", title: "The Bell rings at " + liveWhen(Date.parse(B.next)), text: "For an hour, anyone on the climb can charge the Ace.", until: B.next, url: HILL_BOARD });
      for (const w of ((H.wagers || {}).open || [])) {
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
  


const n=Date.now(); AL.events=[{id:"a",ico:"🛡️",title:"You've been charged on the Hill",text:"N*S charged Terrapin Station -XsT-. They start the game; be ready.",until:new Date(n+47*60000).toISOString(),url:HILL_BOARD,hot:true},{id:"b",ico:"🔔",title:"THE BELL IS RINGING",text:"Anyone on the climb can charge the Ace (Diablow89). Win by 3+ for the title. First one in.",until:new Date(n+22*60000).toISOString(),url:HILL_BOARD,hot:true},{id:"c",ico:"🏆",title:"Black Friday Brawl: your match is open",text:"Wave 1 vs Ajax Assassins · Start",url:HILL_BOARD,hot:true}];
paintInbox(); toast(AL.events[1]); window.__AL={openInbox};})();