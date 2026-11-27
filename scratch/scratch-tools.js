(()=>{
const KIT_VERSION="1.37.0", TABLET=false, MOBILE=false, DEFAULT_CLUBS=[3249,1008,8897], hasChromeStorage=false, LS_STORE="sbx-store";
const esc=(s)=>String(s).replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const FEATURES=[["builder","Lineup Builder"],["radio","Radio"]]; const on=(k)=>k!=="radio";
const clubList=()=>[8897,3249]; const lsSet=(o)=>{};
async function getJSON(u){const r=await fetch(u,{credentials:"include"}); if(!r.ok) throw new Error("HTTP "+r.status); return r.json();}
const LIVE_REPO = "slipnsliders/smallball-tools";
  async function liveGet(path) {
    // raw.githubusercontent first (no rate limit; a few minutes behind at most), the GitHub API as a backup
    const urls = ["https://raw.githubusercontent.com/" + LIVE_REPO + "/main/" + path + "?t=" + Math.floor(Date.now() / 60000), "https://api.github.com/repos/" + LIVE_REPO + "/contents/" + path + "?ref=main"];
    for (let i = 0; i < urls.length; i++) {
      try { const r = await fetch(urls[i], { cache: "no-store", credentials: "omit", headers: i ? { Accept: "application/vnd.github.raw+json" } : {} }); if (r.ok) return await r.json(); } catch (_) {}
    }
    return null;
  }  // ───────── Club Kit tools: ✨ What's new · 🩺 Health check · 💾 Back up / restore (in the ⚙ settings) ─────────
  // Newest first. Each release adds a short entry here; people see what's new once, right after they update.
  const CHANGELOG = [
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
    const list = CHANGELOG.filter((c) => verNum(c.v) <= verNum(KIT_VERSION) && (force || verNum(c.v) > verNum(seen))).slice(0, force ? 4 : 3);
    if (!list.length) { try { localStorage.setItem(SEEN_KEY, KIT_VERSION); } catch (_) {} if (!force) return; }
    const ov = sbxModal("✨ What's new in the Club Kit", (list.length ? list : CHANGELOG.slice(0, 1)).map((c) => `<div class="ver">${esc(c.v)} · ${esc(c.d)}</div><ul>${c.items.map((x) => "<li>" + x + "</li>").join("")}</ul>`).join("") +
      `<div class="muted">You're on ${esc(KIT_VERSION)} (${esc(kitEdition())}). Reopen this any time: ⚙ settings → ✨ What's new.</div>` +
      `<div class="acts"><a class="b" href="https://slipnsliders.github.io/smallball-tools/club-kit/" target="_blank" rel="noopener" style="text-decoration:none;padding:9px 6px">Every update →</a><button class="b go" type="button" data-ok>Got it</button></div>`);
    const done = () => { try { localStorage.setItem(SEEN_KEY, KIT_VERSION); } catch (_) {} ov.remove(); };
    ov.querySelector("[data-ok]").onclick = done;
    ov.querySelector(".x").addEventListener("click", done);
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
  const BACKUP_SKIP = /^sbx-(box-v2|dash-cache|tplog|park-cache|hc|seen-version)/;
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
  


window.__sbxT={whatsNew,openHealth,openBackup};})();