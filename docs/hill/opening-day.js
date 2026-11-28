/* 🎉 OPENING DAY for the Live Hold the Hill Leaderboard.
   Runs for 24 hours after the commish presses 🏁 Fresh start (the board's openingDay stamp), or between the
   start/end in opening.json. First visit in that window: a short animated intro (lights, fireworks, the Ace
   taking the mound, the starting ladder, PLAY BALL). After that, an Opening Day banner sits on top of the board
   with a countdown, the first charge and first result of the season, and the "drops" listed in opening.json.
   Add a drop to opening.json any time; it shows up on the next refresh once its "at" time has passed.
   Preview any time: add ?opening=1 to the page address. */
(function () {
  'use strict';
  var Q = location.search, PREVIEW = /[?&]opening=1/.test(Q);
  var CFG = null, STARTED = false, OPEN_AT = 0, END_AT = 0;
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function D() { return window.__D || {}; }
  function t(ms) { return new Date(ms).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }); }

  function loadCfg(cb) {
    var u = ['https://raw.githubusercontent.com/slipnsliders/smallball-tools/main/docs/hill/opening.json?t=' + Date.now(), 'opening.json?t=' + Date.now()];
    (function go(i) {
      if (i >= u.length) return cb({});
      fetch(u[i], { cache: 'no-store' }).then(function (r) { if (!r.ok) throw r.status; return r.json(); }).then(cb).catch(function () { go(i + 1); });
    })(0);
  }

  // The window: the board's stamp first (set by 🏁 Fresh start), else opening.json, else preview.
  function windowNow() {
    var d = D(), c = CFG || {};
    var s = Date.parse(d.openingDay || '') || Date.parse(c.start || '') || 0;
    var e = Date.parse(c.end || '') || (s ? s + 24 * 3600e3 : 0);
    if (PREVIEW && !(s && Date.now() >= s && Date.now() < e)) { s = Date.now() - 60e3; e = s + 24 * 3600e3; }
    return { s: s, e: e, on: !!s && Date.now() >= s && Date.now() < e };
  }

  // ───────────── styles ─────────────
  var css = [
    '#od-intro{position:fixed;inset:0;z-index:2147483000;background:#050b18;overflow:hidden;font-family:Oswald,system-ui,sans-serif;color:#F4EBD9}',
    '#od-intro canvas{position:absolute;inset:0;width:100%;height:100%}',
    '#od-intro .stage{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:20px;pointer-events:none}',
    '#od-intro .kick{font:400 clamp(16px,2.6vw,26px) "Bebas Neue",Impact,sans-serif;letter-spacing:.35em;color:#ffd166;opacity:0;transform:translateY(10px);transition:all .7s}',
    '#od-intro .big{font:400 clamp(64px,15vw,190px)/.9 Anton,Impact,sans-serif;letter-spacing:.02em;color:#F4EBD9;text-shadow:0 0 30px rgba(255,209,102,.55),0 8px 0 #C8102E;opacity:0;transform:scale(2.4);transition:transform .55s cubic-bezier(.2,1.6,.4,1),opacity .3s}',
    '#od-intro .sub{font:400 clamp(18px,3.2vw,34px) "Bebas Neue",Impact,sans-serif;letter-spacing:.18em;margin-top:10px;opacity:0;transition:opacity .8s}',
    '#od-intro .show{opacity:1!important;transform:none!important}',
    '#od-intro .card{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(.6) rotate(-6deg);opacity:0;transition:all .6s cubic-bezier(.2,1.4,.4,1);background:linear-gradient(160deg,#16305e,#0b1a35);border:4px solid #ffd166;border-radius:18px;padding:22px 34px;min-width:min(520px,86vw);box-shadow:0 0 60px rgba(255,209,102,.35)}',
    '#od-intro .card.show{transform:translate(-50%,-50%) scale(1) rotate(0)!important}',
    '#od-intro .card .l{font:400 18px "Bebas Neue",sans-serif;letter-spacing:.3em;color:#ffd166}',
    '#od-intro .card .n{font:400 clamp(40px,7vw,72px)/1 Anton,Impact,sans-serif;margin:6px 0}',
    '#od-intro .card .c{font-size:18px;opacity:.85}',
    '#od-intro .roll{position:absolute;left:50%;top:48%;transform:translate(-50%,-50%);width:min(600px,92vw);max-height:80vh;overflow:hidden;opacity:0;transition:opacity .4s}',
    '#od-intro .roll h3{margin:0 0 4px;font:400 26px "Bebas Neue",sans-serif;letter-spacing:.3em;color:#ffd166;text-align:center}',
    '#od-intro .roll .step{animation:none;opacity:0;translate:-60px 0;transition:opacity .45s,translate .45s;position:relative}',
    '#od-intro .roll .step.show{opacity:1;translate:0 0}',
    '#od-intro .go{pointer-events:auto;margin-top:26px;font:400 34px "Bebas Neue",Impact,sans-serif;letter-spacing:.12em;background:#C8102E;color:#fff;border:3px solid #ffd166;border-radius:999px;padding:8px 38px;cursor:pointer;opacity:0;transform:scale(.6);transition:all .5s cubic-bezier(.2,1.6,.4,1);box-shadow:0 0 30px rgba(200,16,46,.6)}',
    '#od-intro .go:hover{background:#e11d48}',
    '#od-intro .skip{position:absolute;right:14px;top:12px;z-index:3;background:rgba(0,0,0,.35);color:#F4EBD9;border:1px solid rgba(244,235,217,.35);border-radius:999px;padding:5px 14px;font:500 14px Oswald,sans-serif;cursor:pointer}',
    '#od-intro.out{opacity:0;transition:opacity .6s}',
    '#od-banner{position:relative;overflow:hidden;margin:18px 0 6px;border:3px solid #ffd166;border-radius:18px;background:linear-gradient(135deg,#1b0f2e 0%,#16305e 45%,#3a0d18 100%);padding:16px 18px 14px;box-shadow:0 0 34px rgba(255,209,102,.25)}',
    '#od-banner::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(115deg,rgba(255,255,255,.035) 0 14px,transparent 14px 28px);pointer-events:none}',
    '#od-banner .bunting{position:absolute;left:0;right:0;top:0;height:16px;background:repeating-linear-gradient(90deg,#C8102E 0 26px,#F4EBD9 26px 52px,#1d4ed8 52px 78px);clip-path:polygon(0 0,100% 0,100% 40%,98% 100%,96% 40%,94% 100%,92% 40%,90% 100%,88% 40%,86% 100%,84% 40%,82% 100%,80% 40%,78% 100%,76% 40%,74% 100%,72% 40%,70% 100%,68% 40%,66% 100%,64% 40%,62% 100%,60% 40%,58% 100%,56% 40%,54% 100%,52% 40%,50% 100%,48% 40%,46% 100%,44% 40%,42% 100%,40% 40%,38% 100%,36% 40%,34% 100%,32% 40%,30% 100%,28% 40%,26% 100%,24% 40%,22% 100%,20% 40%,18% 100%,16% 40%,14% 100%,12% 40%,10% 100%,8% 40%,6% 100%,4% 40%,2% 100%,0 40%);opacity:.9}',
    '#od-banner .hd{position:relative;display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 16px;margin-top:8px}',
    '#od-banner h2{margin:0;font:400 clamp(30px,5vw,44px)/1 Anton,Impact,sans-serif;color:#F4EBD9;text-shadow:0 0 18px rgba(255,209,102,.5),0 4px 0 #C8102E;letter-spacing:.02em}',
    '#od-banner .cd{font:400 20px "Bebas Neue",sans-serif;letter-spacing:.12em;color:#ffd166}',
    '#od-banner .rp{margin-left:auto;background:rgba(0,0,0,.3);color:#F4EBD9;border:1px solid rgba(255,209,102,.6);border-radius:999px;padding:4px 14px;font:500 14px Oswald,sans-serif;cursor:pointer}',
    '#od-banner .rp:hover{background:#C8102E}',
    '#od-banner .grid{position:relative;display:grid;grid-template-columns:minmax(200px,1fr) minmax(200px,1fr) minmax(260px,1.6fr);gap:12px;margin-top:12px}',
    '#od-banner .box{background:rgba(5,11,24,.55);border:1px solid rgba(244,235,217,.18);border-radius:12px;padding:10px 12px}',
    '#od-banner .box h4{margin:0 0 6px;font:400 19px "Bebas Neue",sans-serif;letter-spacing:.14em;color:#ffd166}',
    '#od-banner .box p{margin:0;font-size:14.5px;line-height:1.4}',
    '#od-banner .lu{list-style:none;margin:0;padding:0;font-size:14.5px}',
    '#od-banner .lu li{display:flex;gap:8px;padding:2px 0;border-bottom:1px dashed rgba(244,235,217,.12)}',
    '#od-banner .lu b{font:400 19px "Bebas Neue",sans-serif;color:#ffd166;min-width:34px}',
    '#od-banner .lu i{font-style:normal;opacity:.65;margin-left:auto;font-size:13px}',
    '#od-banner .drop{display:flex;gap:10px;padding:6px 0;border-bottom:1px dashed rgba(244,235,217,.12)}',
    '#od-banner .drop:last-child{border-bottom:0}',
    '#od-banner .drop .ic{font-size:24px;line-height:1}',
    '#od-banner .drop b{display:block;color:#ffd166;font-weight:600}',
    '#od-banner .drop small{opacity:.55;font-size:12px}',
    '#od-banner .new{display:inline-block;background:#C8102E;color:#fff;font:700 10px system-ui;letter-spacing:.08em;border-radius:6px;padding:1px 6px;margin-left:6px;vertical-align:2px;animation:odp 1.2s ease-in-out infinite alternate}',
    '@keyframes odp{to{box-shadow:0 0 10px #C8102E}}',
    '#od-banner .ball{position:absolute;right:-30px;bottom:-30px;font-size:120px;opacity:.12;transform:rotate(-20deg);pointer-events:none}',
    '@media (max-width:760px){#od-banner .grid{grid-template-columns:1fr}}',
    '#od-banner .drops{max-height:190px;overflow:auto}',
    '@media (prefers-reduced-motion:reduce){#od-intro *{transition:none!important}#od-banner .new{animation:none}}'
  ].join('\n');

  // The ladder drawn exactly like the board's own "The Climb" (same classes, so the same look all season).
  function climb(A, lad) {
    var id = function (p) { return p.clubId ? ' · ID ' + esc(p.clubId) : ''; };
    return (A ? '<div class="step ace"><span class="tag bb">♠ THE ACE · ON THE MOUND</span><span class="rk bb">👑</span><span class="who bb">' + esc(A.name) + '<small>' + esc(A.club) + id(A) + '</small></span><span class="wl bb"><b>' + (A.rdef || 0) + '</b>' + ((A.rdef || 0) === 1 ? 'defense' : 'defenses') + '</span></div>' : '') +
      lad.map(function (p, i) { return '<div class="step' + (i === 0 ? ' top' : '') + '" style="--i:' + Math.min(i + 1, 9) + '"><span class="rk bb">#' + esc(p.rank) + '</span><span class="who bb">' + esc(p.name) + '<small>' + esc(p.club) + id(p) + '</small></span><span class="wl bb">' + (p.w || 0) + '-' + (p.l || 0) + '</span></div>'; }).join('');
  }
  // ───────────── the intro ─────────────
  function intro(w, force) {
    var key = 'hth-od-seen-' + w.s;
    if (!force) { try { if (localStorage.getItem(key)) return; } catch (e) { } }
    try { localStorage.setItem(key, '1'); } catch (e) { }
    var d = D(), A = d.ace, lad = (d.ladder || []).slice(0, 8);
    var el = document.createElement('div'); el.id = 'od-intro';
    el.innerHTML = '<canvas></canvas><button class="skip" type="button">Skip ⏭</button>' +
      '<div class="stage"><div class="kick">⚾ SMALLBALL PRESENTS ⚾</div><div class="big">OPENING DAY</div><div class="sub">HOLD THE HILL · A FRESH SEASON</div></div>' +
      '<div class="card"><div class="l">♠ TAKING THE MOUND</div><div class="n">' + esc(A ? A.name : 'THE HILL IS OPEN') + '</div><div class="c">' + (A ? esc(A.club) + (A.clubId ? ' · #' + esc(A.clubId) : '') + (D().openingDay ? '<br>🏆 Starts the season on the mound' : '') : 'First club to claim it plants the flag') + '</div></div>' +
      '<div class="roll"><h3>THE CLIMB · OPENING DAY</h3><div class="climb">' + climb(A, lad) + '</div></div>' +
      '<div class="stage" style="justify-content:flex-end;padding-bottom:12vh"><button class="go" type="button">PLAY BALL! ⚾</button></div>';
    document.body.appendChild(el);
    var cv = el.querySelector('canvas'), cx = cv.getContext('2d'), W = 0, H = 0, parts = [], timers = [], alive = true, lights = 0, t0 = performance.now();
    function size() { W = cv.width = innerWidth * devicePixelRatio; H = cv.height = innerHeight * devicePixelRatio; }
    size(); addEventListener('resize', size);
    function later(ms, fn) { timers.push(setTimeout(function () { if (alive) fn(); }, RM ? Math.min(ms, 300) : ms)); }
    function burst(x, y, n, hue) {
      for (var i = 0; i < n; i++) { var a = Math.random() * Math.PI * 2, v = (2 + Math.random() * 5) * devicePixelRatio; parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 60 + Math.random() * 40, h: hue + Math.random() * 30 - 15, s: 2 + Math.random() * 2 }); }
    }
    function confetti(n) { for (var i = 0; i < n; i++) parts.push({ x: Math.random() * W, y: -20, vx: (Math.random() - .5) * 3, vy: 2 + Math.random() * 3, life: 220, h: [0, 45, 210, 350, 50][i % 5], s: 5 * devicePixelRatio, conf: 1, r: Math.random() * 6 }); }
    function draw(now) {
      if (!alive) return;
      var g = cx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#050b18'); g.addColorStop(.6, '#0e1f42'); g.addColorStop(1, '#16351f'); cx.fillStyle = g; cx.fillRect(0, 0, W, H);
      // light towers flick on one by one
      var tw = [.08, .3, .7, .92];
      tw.forEach(function (fx, i) {
        var on = lights > i, x = fx * W, y = H * .18;
        cx.fillStyle = '#1b2742'; cx.fillRect(x - 3 * devicePixelRatio, y, 6 * devicePixelRatio, H * .6);
        cx.fillStyle = on ? '#fff7d6' : '#2a3657'; cx.fillRect(x - 26 * devicePixelRatio, y - 14 * devicePixelRatio, 52 * devicePixelRatio, 18 * devicePixelRatio);
        if (on) { var rg = cx.createRadialGradient(x, y, 0, x, y, H * .55); rg.addColorStop(0, 'rgba(255,247,214,.35)'); rg.addColorStop(1, 'rgba(255,247,214,0)'); cx.fillStyle = rg; cx.fillRect(0, 0, W, H); }
      });
      // field and crowd
      cx.fillStyle = '#1f5a2c'; cx.beginPath(); cx.ellipse(W / 2, H * 1.08, W * .75, H * .3, 0, 0, Math.PI * 2); cx.fill();
      cx.fillStyle = '#b07a43'; cx.beginPath(); cx.moveTo(W / 2, H * .8); cx.lineTo(W / 2 + H * .12, H * .9); cx.lineTo(W / 2, H); cx.lineTo(W / 2 - H * .12, H * .9); cx.closePath(); cx.fill();
      cx.fillStyle = '#070d1d';
      for (var k = 0; k < 90; k++) { var bx = (k / 90) * W, bob = Math.sin(now / 180 + k) * (lights > 3 ? 5 : 1) * devicePixelRatio; cx.beginPath(); cx.arc(bx + 8, H * .79 + bob, 9 * devicePixelRatio, 0, Math.PI * 2); cx.fill(); }
      // particles
      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i]; p.x += p.vx; p.y += p.vy; p.vy += p.conf ? .02 : .06 * devicePixelRatio; p.vx *= .99; p.life--;
        if (p.life <= 0 || p.y > H + 40) { parts.splice(i, 1); continue; }
        cx.globalAlpha = Math.min(1, p.life / 40); cx.fillStyle = 'hsl(' + p.h + ',95%,62%)';
        if (p.conf) { cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r += .1); cx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); cx.restore(); }
        else { cx.beginPath(); cx.arc(p.x, p.y, p.s * devicePixelRatio / 2, 0, Math.PI * 2); cx.fill(); }
      }
      cx.globalAlpha = 1;
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
    var $ = function (s) { return el.querySelector(s); };
    var show = function (s) { var n = $(s); if (n) n.classList.add('show'); };
    var hide = function (s) { var n = $(s); if (n) { n.classList.remove('show'); n.style.opacity = '0'; } };
    for (var i = 0; i < 4; i++) (function (i) { later(300 + i * 350, function () { lights = i + 1; }); })(i);
    later(1700, function () { show('.kick'); });
    later(2300, function () { show('.big'); burst(W * .25, H * .3, 90, 45); burst(W * .75, H * .28, 90, 350); });
    later(2900, function () { show('.sub'); burst(W * .5, H * .2, 120, 210); });
    later(4600, function () { ['.kick', '.big', '.sub'].forEach(hide); show('.card'); burst(W * .5, H * .25, 140, 50); });
    later(7400, function () {
      hide('.card'); var R = $('.roll'); R.style.opacity = '1';
      [].forEach.call(R.querySelectorAll('.step'), function (row, i) { later(i * 260, function () { row.classList.add('show'); }); });
    });
    later(7400 + Math.max(1, lad.length) * 260 + 1200, function () { show('.go'); confetti(160); burst(W * .3, H * .3, 100, 0); burst(W * .7, H * .3, 100, 210); });
    var fw = setInterval(function () { if (lights > 3 && !RM) burst(W * (.15 + Math.random() * .7), H * (.12 + Math.random() * .25), 60, Math.random() * 360); }, 1100); timers.push(fw);
    function close() {
      if (!alive) return; el.classList.add('out');
      setTimeout(function () { alive = false; timers.forEach(function (x) { clearTimeout(x); clearInterval(x); }); removeEventListener('resize', size); el.remove(); }, 600);
    }
    $('.go').onclick = close; $('.skip').onclick = close;
    addEventListener('keydown', function k(e) { if (e.key === 'Escape') { close(); removeEventListener('keydown', k); } });
  }

  // ───────────── the banner ─────────────
  function seasonFirsts(w) {
    var d = D(), ms = (d.matches || []).filter(function (m) { return Date.parse(m.date) >= w.s; }).sort(function (a, b) { return Date.parse(a.date) - Date.parse(b.date); });
    var ch = (d.charges || []).filter(function (c) { return Date.parse(c.created) >= w.s; }).sort(function (a, b) { return Date.parse(a.created) - Date.parse(b.created); });
    return { m: ms[0], c: ch[0], games: ms.length };
  }
  function drops(w) {
    var c = CFG || {}, now = Date.now();
    return (c.drops || []).filter(function (x) { var at = Date.parse(x.at || '') || w.s; return at <= now; })
      .sort(function (a, b) { return (Date.parse(b.at || '') || w.s) - (Date.parse(a.at || '') || w.s); });
  }
  function banner(w) {
    var app = document.getElementById('app'); if (!app) return;
    var b = document.getElementById('od-banner');
    if (!b) { b = document.createElement('section'); b.id = 'od-banner'; app.insertBefore(b, app.firstChild); }
    var d = D(), A = d.ace, f = seasonFirsts(w), lad = d.ladder || [], left = Math.max(0, w.e - Date.now());
    var h = Math.floor(left / 36e5), m = Math.floor(left % 36e5 / 6e4);
    var dr = drops(w);
    var html = '<div class="bunting"></div><div class="ball">⚾</div><div class="hd"><h2>🎉 OPENING DAY</h2><span class="cd">Hold the Hill · a fresh season · the party runs ' + h + 'h ' + m + 'm more</span><button class="rp" type="button" data-odreplay>▶ Replay the intro</button></div><div class="grid">';
    html += '<div class="box"><h4>♠ On the mound</h4><p>' + (A ? '<b>' + esc(A.name) + '</b> · ' + esc(A.club) + (d.openingDay ? '<br>Opens the new season as the Ace, straight from the Black Friday Brawl\'s final day. ' : '<br>') + 'First club to knock them off writes history.' : 'The hill is open: the first club to claim it plants the flag.') + '</p></div>';
    html += '<div class="box"><h4>⚾ First pitch</h4><p>' + (f.c ? '<b>' + esc(f.c.ch) + '</b> threw the first charge of the season at <b>' + esc(f.c.df) + '</b> (' + t(Date.parse(f.c.created)) + ').' : 'No charges yet. Who throws the first pitch of the season?') +
      (f.m ? '<br>🏁 First result: <b>' + esc(f.m.w) + '</b> beat <b>' + esc(f.m.l) + '</b> ' + esc(f.m.wr) + '–' + esc(f.m.lr) + '.' : '') + (f.games > 1 ? '<br>' + f.games + ' games played so far today.' : '') + '</p></div>';
    if (dr.length) html += '<div class="box"><h4>🎁 Opening Day extras</h4><div class="drops">' + dr.map(function (x) {
      var at = Date.parse(x.at || '') || w.s, fresh = Date.now() - at < 2 * 3600e3 && x.at;
      return '<div class="drop"><span class="ic">' + esc(x.icon || '⚾') + '</span><div><b>' + esc(x.title || '') + (fresh ? '<span class="new">NEW</span>' : '') + '</b>' + (x.html ? String(x.html) : esc(x.body || '')) + (x.at ? '<br><small>' + t(at) + '</small>' : '') + '</div></div>';
    }).join('') + '</div></div>';
    html += '</div>';
    if (b.dataset.h !== html) { b.innerHTML = html; b.dataset.h = html; b.querySelector('[data-odreplay]').onclick = function () { intro(w, true); }; }
  }

  function tick() {
    var w = windowNow(), b = document.getElementById('od-banner');
    if (!w.on) { if (b) b.remove(); return; }
    banner(w);
    if (!STARTED) { STARTED = true; intro(w, false); }
  }
  function boot() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    loadCfg(function (c) {
      CFG = c || {};
      (function wait(n) { if (window.__D && document.getElementById('app') && document.getElementById('app').children.length) { tick(); setInterval(tick, 30000); } else if (n < 120) setTimeout(function () { wait(n + 1); }, 250); })(0);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
