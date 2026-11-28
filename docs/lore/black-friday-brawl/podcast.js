/* 🎙️ The Brawl Recap: a two-host recap read aloud by the listener's own browser voices (Web Speech).
   Script lives in podcast.json. Text is set with textContent only. */
{
  const ROOT = new URL('.', document.currentScript.src).href;
  const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; };
  const css = `
.pod{margin:22px 0 8px;padding:18px;border:2px solid var(--ac,#e11d48);border-radius:16px;background:linear-gradient(135deg,rgba(225,29,72,.16),rgba(0,0,0,.12));}
.pod-top{display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.pod-btn{flex:none;width:64px;height:64px;border-radius:50%;border:0;background:var(--ac,#e11d48);color:#fff;font-size:26px;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.35)}
.pod-btn:focus-visible,.pod-ctl button:focus-visible{outline:3px solid #ffd166;outline-offset:2px}
.pod-t{flex:1;min-width:200px}.pod-t b{display:block;font:800 26px/1.05 'Barlow Condensed',sans-serif;letter-spacing:.01em}
.pod-t span{font-size:14px;opacity:.85}
.pod-shout{margin:12px 0 0;padding:8px 12px;border-radius:10px;background:rgba(255,209,102,.14);border:1px solid rgba(255,209,102,.5);font-size:15px}
.pod-bar{position:relative;height:8px;margin:14px 0 6px;border-radius:99px;background:rgba(255,255,255,.15);overflow:hidden;cursor:pointer}
.pod-bar i{position:absolute;left:0;top:0;bottom:0;width:0;background:var(--ac,#e11d48);transition:width .3s}
.pod-meta{display:flex;justify-content:space-between;font-size:13px;opacity:.8;gap:10px;flex-wrap:wrap}
.pod-ctl{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.pod-ctl button{min-height:40px;padding:0 14px;border-radius:99px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.06);color:inherit;font:600 14px Barlow,sans-serif;cursor:pointer}
.pod-ctl button[aria-pressed=true]{background:#ffd166;color:#1b1300;border-color:#ffd166}
.pod details{margin-top:12px}.pod summary{cursor:pointer;font-weight:600}
.pod ol{list-style:none;margin:10px 0 0;padding:0;max-height:340px;overflow:auto}
.pod li{padding:6px 10px;border-radius:8px;cursor:pointer;line-height:1.45}
.pod li b{font-weight:700;margin-right:6px}.pod li.A b{color:#ffd166}.pod li.B b{color:#7dd3fc}
.pod li.on{background:rgba(255,255,255,.12)}
.pod-note{font-size:12.5px;opacity:.7;margin-top:8px}`;
  const st = document.createElement('style'); st.textContent = css; document.head.append(st);

  fetch(ROOT + 'podcast.json').then(r => r.json()).then(P => {
    const S = window.speechSynthesis;
    const L = P.lines, words = L.map(l => l[1].split(/\s+/).length), total = words.reduce((a, b) => a + b, 0);
    let i = 0, playing = false, rate = 1, vA = null, vB = null;
    const mins = w => Math.max(1, Math.round(w / (160 * rate)));

    const box = el('section', 'pod'); box.id = 'podcast';
    const top = el('div', 'pod-top');
    const btn = el('button', 'pod-btn', '▶'); btn.type = 'button'; btn.setAttribute('aria-label', 'Play the podcast');
    const t = el('div', 'pod-t'); t.append(el('b', null, '🎙️ ' + P.title), el('span', null, 'A two-host recap of the night with ' + P.hosts.A + ' and ' + P.hosts.B + ' · about ' + mins(total) + ' minutes'));
    top.append(btn, t);
    const shout = el('div', 'pod-shout', '📣 Made at the request of GCool. This one\'s for you!');
    const bar = el('div', 'pod-bar'), fill = el('i'); bar.append(fill);
    const meta = el('div', 'pod-meta'), m1 = el('span', null, ''), m2 = el('span', null, ''); meta.append(m1, m2);
    const ctl = el('div', 'pod-ctl');
    const back = el('button', null, '⏮ Back'), next = el('button', null, 'Skip ⏭'), sp = el('button', null, 'Speed 1×');
    [back, next, sp].forEach(b => { b.type = 'button'; ctl.append(b); });
    const det = el('details'); det.append(el('summary', null, '📜 Transcript'));
    const ol = el('ol'); L.forEach((l, k) => { const li = el('li', l[0]); li.append(el('b', null, P.hosts[l[0]] + ':'), document.createTextNode(l[1])); li.onclick = () => { i = k; play(); }; ol.append(li); });
    det.append(ol);
    const note = el('div', 'pod-note', S ? 'Read aloud by your device\'s built-in voices, so it sounds a little different on every phone and computer.' : 'Your browser can\'t read this aloud. The transcript is below.');
    box.append(top, shout, bar, meta, ctl, det, note);

    function pickVoices() {
      const vs = (S && S.getVoices() || []).filter(v => /^en(-|_|$)/i.test(v.lang));
      if (!vs.length) return;
      const rank = v => (/Google|Natural|Neural|Premium|Enhanced|Siri/i.test(v.name) ? 0 : 1) + (/en-US/i.test(v.lang) ? 0 : 0.5);
      const male = /Male|Daniel|Alex|Fred|Guy|David|Mark|Aaron|Arthur|Tom|Rishi|Google UK English Male/i, fem = /Female|Samantha|Victoria|Karen|Moira|Tessa|Zira|Jenny|Aria|Susan|Nicky|Google US English/i;
      const sorted = vs.slice().sort((a, b) => rank(a) - rank(b));
      vA = sorted.find(v => male.test(v.name)) || sorted[0];
      vB = sorted.find(v => v !== vA && fem.test(v.name)) || sorted.find(v => v !== vA) || vA;
    }
    if (S) { pickVoices(); S.onvoiceschanged = pickVoices; }

    function show() {
      const done = words.slice(0, i).reduce((a, b) => a + b, 0);
      fill.style.width = (100 * done / total) + '%';
      m1.textContent = (playing ? '🔊 ' + P.hosts[L[Math.min(i, L.length - 1)][0]] : (i ? '⏸ Paused' : '')) + '';
      m2.textContent = i >= L.length ? 'Finished' : 'about ' + mins(total - done) + ' min left';
      btn.textContent = playing ? '⏸' : '▶'; btn.setAttribute('aria-label', playing ? 'Pause' : 'Play the podcast');
      [...ol.children].forEach((li, k) => li.classList.toggle('on', k === i && (playing || i > 0)));
    }
    let keep = null;
    function say() {
      if (!playing) return;
      if (i >= L.length) { playing = false; i = 0; show(); return; }
      const [who, txt] = L[i], u = new SpeechSynthesisUtterance(txt);
      const v = who === 'A' ? vA : vB; if (v) { u.voice = v; u.lang = v.lang; }
      u.rate = rate * (who === 'A' ? 1.02 : 1); u.pitch = who === 'A' ? 0.9 : 1.1;
      u.onend = () => { if (!playing) return; i++; show(); setTimeout(say, 260); };
      u.onerror = e => { if (e.error === 'interrupted' || e.error === 'canceled') return; i++; show(); setTimeout(say, 200); };
      S.speak(u); show();
    }
    function play() { if (!S) return; S.cancel(); playing = true; if (!vA) pickVoices(); say(); clearInterval(keep); keep = setInterval(() => { if (playing && S.paused) S.resume(); }, 5000); }
    function pause() { playing = false; S && S.cancel(); clearInterval(keep); show(); }
    btn.onclick = () => playing ? pause() : (i >= L.length && (i = 0), play());
    back.onclick = () => { i = Math.max(0, i - 1); playing ? play() : show(); };
    next.onclick = () => { i = Math.min(L.length - 1, i + 1); playing ? play() : show(); };
    sp.onclick = () => { rate = rate === 1 ? 1.25 : rate === 1.25 ? 1.5 : 1; sp.textContent = 'Speed ' + rate + '×'; sp.setAttribute('aria-pressed', rate > 1); playing ? play() : show(); };
    bar.onclick = e => { const r = bar.getBoundingClientRect(), f = (e.clientX - r.left) / r.width; let acc = 0, k = 0; while (k < L.length - 1 && (acc + words[k]) / total < f) acc += words[k++]; i = k; playing ? play() : show(); };
    addEventListener('pagehide', () => S && S.cancel());
    show();

    const mount = () => { const hero = document.querySelector('#app .st-hero'); if (!hero) return false; hero.after(box); return true; };
    if (!mount()) { const mo = new MutationObserver(() => { if (mount()) mo.disconnect(); }); mo.observe(document.getElementById('app'), { childList: true, subtree: true }); }
  }).catch(() => { });
}
