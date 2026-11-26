(()=>{document.getElementById('sbx-sus')?.remove();const st=document.createElement('style');st.textContent="      .sbx-suspects { position: relative; }\n      .sbx-suspects::after { content: \"\"; position: absolute; pointer-events: none; left: 0; top: var(--sus-top, 0px); bottom: 0; width: var(--sus-w, 44px); mix-blend-mode: multiply; background-image: repeating-linear-gradient(180deg, transparent 0 calc(var(--sus-rh, 40px) / 4 - 1px), rgba(20,20,20,.55) calc(var(--sus-rh, 40px) / 4 - 1px) calc(var(--sus-rh, 40px) / 4)), repeating-linear-gradient(180deg, transparent 0 calc(var(--sus-rh, 40px) - 2px), rgba(0,0,0,.85) calc(var(--sus-rh, 40px) - 2px) var(--sus-rh, 40px)); }\n      #sbx-sus { margin: 10px 0 14px; padding: 14px 16px; border-radius: 12px; color: #f4efe2; background: repeating-linear-gradient(0deg, rgba(255,255,255,.035) 0 1px, transparent 1px 4px), linear-gradient(135deg, #17130d, #2a2116 60%, #17130d); border: 1px solid rgba(250,204,21,.35); box-shadow: 0 6px 20px rgba(0,0,0,.35); font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }\n      #sbx-sus .sus-top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }\n      #sbx-sus .sus-file { font: 800 11px/1 ui-monospace, monospace; letter-spacing: .18em; color: #facc15; text-transform: uppercase; }\n      #sbx-sus .sus-q { flex: 1 1 360px; min-height: 2.6em; transition: opacity .6s; }\n      #sbx-sus .sus-q q { display: block; font: italic 600 19px/1.3 Georgia, \"Times New Roman\", serif; quotes: \"\u201c\" \"\u201d\"; }\n      #sbx-sus .sus-q small { display: block; margin-top: 4px; font-size: 12px; opacity: .7; letter-spacing: .05em; }\n      #sbx-sus .sus-go { flex: none; border: 0; border-radius: 999px; padding: 9px 16px; font: 800 14px/1 system-ui, sans-serif; background: #facc15; color: #1b1300; cursor: pointer; box-shadow: 0 3px 10px rgba(250,204,21,.25); }\n      #sbx-sus .sus-go:hover { filter: brightness(1.08); }\n      #sbx-sus .sus-game { margin-top: 12px; border-top: 1px dashed rgba(250,204,21,.35); padding-top: 12px; }\n      #sbx-sus .sus-help { font-size: 13px; opacity: .9; margin-bottom: 10px; }\n      #sbx-sus .sus-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 8px; }\n      #sbx-sus .sus-man { position: relative; border: 1px solid rgba(255,255,255,.18); border-radius: 10px; padding: 8px 4px 6px; text-align: center; cursor: pointer; color: inherit; font: inherit; background: repeating-linear-gradient(180deg, transparent 0 9px, rgba(0,0,0,.35) 9px 10px), #cfc8b4; color: #1b1300; transition: transform .15s; }\n      #sbx-sus .sus-man:hover:not(:disabled) { transform: translateY(-3px); }\n      #sbx-sus .sus-man:disabled { cursor: default; }\n      #sbx-sus .sus-man b { position: absolute; top: 4px; left: 6px; font: 800 12px/1 ui-monospace, monospace; }\n      #sbx-sus .sus-man img { width: 44px; height: 52px; object-fit: contain; display: block; margin: 0 auto 4px; }\n      #sbx-sus .sus-man span { display: block; font-size: 12px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n      #sbx-sus .sus-man em { display: block; font-size: 10px; font-style: normal; opacity: .7; }\n      #sbx-sus .sus-man.is-soze { outline: 3px solid #ef4444; background: repeating-linear-gradient(180deg, transparent 0 9px, rgba(0,0,0,.35) 9px 10px), #fca5a5; }\n      #sbx-sus .sus-man.is-pick { box-shadow: 0 0 0 3px #facc15; }\n      #sbx-sus .sus-man.is-out { opacity: .4; }\n      #sbx-sus .sus-res { margin-top: 12px; font-size: 15px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }\n      #sbx-sus .sus-res b { font-size: 17px; }";document.head.appendChild(st);const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // Easter egg for The Usual Suspects TUS (rgbartley's club): a case-file banner with rotating lines from the movie,
  // a one-guess "Find Keyser Söze" game over the nine starters, and a mugshot height chart behind the portraits.
  const SUS_QUOTES = [
    ["The greatest trick the Devil ever pulled was convincing the world he didn't exist.", "Verbal Kint"],
    ["How do you shoot the Devil in the back? What if you miss?", "Verbal Kint"],
    ["I believe in God, and the only thing that scares me is Keyser Söze.", "Verbal Kint"],
    ["Who is Keyser Söze?", "Agent Kujan"],
    ["And like that… he's gone.", "Verbal Kint"],
  ];
  const SUS_KEY = "sbx-soze";
  const SUS = { q: Math.floor(Math.random() * SUS_QUOTES.length), timer: 0, round: null };
  const susRec = () => { try { return JSON.parse(localStorage.getItem(SUS_KEY)) || { w: 0, l: 0 }; } catch (_) { return { w: 0, l: 0 }; } };
  function susLineup(box) {
    if (!box) return [];
    const ths = [...box.querySelectorAll("thead th")].map((t) => t.textContent.trim().toLowerCase());
    const iPos = ths.indexOf("pos"), iName = ths.indexOf("name");
    if (iName < 0) return [];
    return [...box.querySelectorAll("tbody tr")].map((tr) => {
      const td = tr.children, img = tr.querySelector("img");
      return { pos: iPos >= 0 && td[iPos] ? td[iPos].textContent.trim() : "", name: (td[iName] ? td[iName].firstChild && td[iName].firstChild.textContent || td[iName].textContent : "").trim().replace(/\.$/, ""), img: img ? img.src : "" };
    }).filter((p) => p.name && !/bench/i.test(p.pos)).slice(0, 9);
  }
  function susQuote(el) {
    const [q, who] = SUS_QUOTES[SUS.q % SUS_QUOTES.length];
    el.innerHTML = "<q>" + esc(q) + "</q><small>— " + esc(who) + ", <i>The Usual Suspects</i> (1995)</small>";
  }
  function susGame(wrap, men) {
    const r = SUS.round;
    const rec = susRec();
    const done = r.pick != null;
    let res = "";
    if (done) {
      const won = r.pick === r.soze, s = men[r.soze];
      res = '<div class="sus-res">' + (won
        ? "<b>🎯 You found him.</b> It was #" + (r.soze + 1) + " " + esc(s.name) + ". Kujan never got this close."
        : "<b>💨 And like that… he's gone.</b> Keyser Söze was #" + (r.soze + 1) + " " + esc(s.name) + ".") +
        '<span style="opacity:.75;font-size:13px">Your record: ' + rec.w + "–" + rec.l + "</span>" +
        '<button class="sus-go" data-sus="again">🔁 New lineup</button></div>';
    }
    wrap.innerHTML = '<div class="sus-help">' + (done ? "The lineup is over." : "Nine suspects. One of them is Keyser Söze. <b>You get one guess.</b>") + "</div>" +
      '<div class="sus-row">' + men.map((p, i) => '<button class="sus-man' + (done && i === r.soze ? " is-soze" : "") + (done && i === r.pick ? " is-pick" : "") + (done && i !== r.soze && i !== r.pick ? " is-out" : "") + '" data-man="' + i + '"' + (done ? " disabled" : "") + ' title="' + (done ? "" : "Point at #" + (i + 1)) + '"><b>' + (i + 1) + "</b>" +
        (p.img ? '<img src="' + esc(p.img) + '" alt="">' : '<div style="height:52px;font-size:30px;line-height:52px">🕴️</div>') + "<span>" + esc(p.name) + "</span><em>" + esc(p.pos) + "</em></button>").join("") + "</div>" + res;
    wrap.querySelectorAll("[data-man]").forEach((b) => { b.onclick = () => {
      if (SUS.round.pick != null) return;
      SUS.round.pick = Number(b.dataset.man);
      const rc = susRec(); if (SUS.round.pick === SUS.round.soze) rc.w++; else rc.l++;
      try { localStorage.setItem(SUS_KEY, JSON.stringify(rc)); } catch (_) {}
      susGame(wrap, men);
    }; });
    const again = wrap.querySelector('[data-sus="again"]');
    if (again) again.onclick = () => { SUS.round = { soze: Math.floor(Math.random() * men.length), pick: null }; susGame(wrap, men); };
  }
  function mountSuspects() {
    const m = location.hash.match(/^#\/team\/(\d+)/);
    const head = document.querySelector("main .teamhead");
    const yes = !!(m && head && /usual suspects/i.test(head.textContent));
    let ban = document.getElementById("sbx-sus");
    const h = [...document.querySelectorAll("main h2")].find((x) => /^(lineup|the squad)/i.test(x.textContent.trim()));
    let box = h ? h.nextElementSibling : null;
    while (box && box.tagName !== "H2" && !(box.matches("table") || box.querySelector("table"))) box = box.nextElementSibling;
    if (box && box.tagName === "H2") box = null;
    if (!yes) {
      if (ban) ban.remove();
      document.querySelectorAll(".sbx-suspects").forEach((x) => x.classList.remove("sbx-suspects"));
      if (SUS.timer) { clearInterval(SUS.timer); SUS.timer = 0; }
      SUS.round = null;
      return;
    }
    if (box) {
      box.classList.add("sbx-suspects");
      const tr = box.querySelector("tbody tr"), td = tr && tr.querySelector("td"), th = box.querySelector("thead");
      if (tr && td) {
        const bt = box.getBoundingClientRect().top;
        box.style.setProperty("--sus-rh", tr.getBoundingClientRect().height.toFixed(2) + "px");
        box.style.setProperty("--sus-top", ((th ? th.getBoundingClientRect().bottom : tr.getBoundingClientRect().top) - bt).toFixed(1) + "px");
        box.style.setProperty("--sus-w", td.getBoundingClientRect().width.toFixed(1) + "px");
      }
    }
    if (ban && ban.isConnected && ban.previousElementSibling === head) return;
    if (!ban) {
      ban = document.createElement("div"); ban.id = "sbx-sus";
      ban.innerHTML = '<div class="sus-top"><div style="flex:1 1 360px"><div class="sus-file">🕵️ Case file · The Usual Suspects</div><div class="sus-q"></div></div>' +
        '<button class="sus-go" data-sus="open" title="One guess. Can you spot him?">🔎 Find Keyser Söze</button></div><div class="sus-game" hidden></div>';
      ban.querySelector('[data-sus="open"]').onclick = () => {
        const g = ban.querySelector(".sus-game"), men = susLineup(box || document.querySelector(".sbx-suspects"));
        if (!g.hidden) { g.hidden = true; return; }
        if (men.length < 2) { g.hidden = false; g.innerHTML = '<div class="sus-help">The suspects aren\'t in the room yet (open the Skills view of the squad).</div>'; return; }
        if (!SUS.round || SUS.round.soze >= men.length) SUS.round = { soze: Math.floor(Math.random() * men.length), pick: null };
        g.hidden = false; susGame(g, men);
      };
    }
    head.insertAdjacentElement("afterend", ban);
    const qel = ban.querySelector(".sus-q"); susQuote(qel);
    if (!SUS.timer) SUS.timer = setInterval(() => {
      const el = document.querySelector("#sbx-sus .sus-q"); if (!el) return;
      el.style.opacity = "0";
      setTimeout(() => { SUS.q++; susQuote(el); el.style.opacity = "1"; }, 600);
    }, 9000);
  }
mountSuspects(); window.__ms=mountSuspects; document.getElementById('sbx-sus').scrollIntoView({block:'start'}); window.scrollBy(0,-10); return document.getElementById('sbx-sus').outerHTML.length;})()