/* 🏛️ HALL OF FAME + 🔮 COMING SOON for the Live Hold the Hill Leaderboard.
   Adds two tabs and a floating gold 🏛️ Hall of Fame button. Everything runs off the board data:
   - Hall of Fame: seasons listed in hall.json are enshrined for good. The season being played shows as a
     PROJECTED plaque ("if the season ended right now"), with the award race as medals.
   - Coming soon: teasers for the Holiday Tree (Dec 24 – Jan 1), Season 2 (The Dog Pile) and later themes.
   Cosmetic only: nothing here changes the Sheet or the Hill script. */
(function () {
  'use strict';
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var HALL = { seasons: [] };
  var TREE_ON = Date.parse('2026-12-24T07:00:00Z'), BALL = Date.parse('2027-01-01T07:00:00Z'), TREE_OFF = Date.parse('2027-01-02T07:00:00Z');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function D() { return window.__D || {}; }
  function link(id) { return id ? ' · <a class="cid" href="https://play.smallball.com/#/team/' + esc(id) + '" target="_blank" rel="noopener">ID ' + esc(id) + '</a>' : ''; }
  function ndays(a, b) { return Math.max(0, Math.floor(((b ? new Date(b) : new Date()) - new Date(a)) / 864e5)); }
  function cd(ms) { if (ms <= 0) return '0:00:00'; var d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60; return (d ? d + 'd ' : '') + h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }
  function when(s) { return new Date(s).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }); }

  var CSS = ''
    + '.hof{--g1:#ffe08a;--g2:#d4a017;--g3:#8a6410;position:relative}'
    + '.hof-hero{position:relative;margin:18px 0 8px;padding:28px 20px 30px;text-align:center;background:radial-gradient(ellipse at 50% 0,rgba(255,209,102,.22),transparent 60%),linear-gradient(180deg,#14223f,#0b1428);border:2px solid rgba(255,209,102,.35);overflow:hidden}'
    + '.hof-hero:before,.hof-hero:after{content:"";position:absolute;top:0;bottom:0;width:38px;background:repeating-linear-gradient(90deg,rgba(255,224,138,.16) 0 6px,rgba(255,224,138,.04) 6px 12px)}.hof-hero:before{left:0}.hof-hero:after{right:0}'
    + '.hof-hero h2{justify-content:center;margin:0}.hof-hero h2:after{display:none}.hof-hero .bb.ttl{font-size:clamp(40px,8vw,72px);line-height:.95;background:linear-gradient(180deg,var(--g1),var(--g2) 55%,var(--g3));-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 3px 0 rgba(0,0,0,.5))}'
    + '.hof-hero p{max-width:640px;margin:6px auto 0;opacity:.85}'
    + '.plaque{position:relative;max-width:720px;margin:22px auto 10px;padding:26px 22px 22px;text-align:center;color:#2a1c00;background:linear-gradient(135deg,#fff1b8,#e9b93a 30%,#fbe08a 50%,#c8921c 72%,#f6d572);border:6px solid #7a5308;box-shadow:0 0 0 3px #f6d572,0 14px 40px rgba(0,0,0,.55),0 0 60px rgba(255,209,102,.25);overflow:hidden}'
    + '.plaque:after{content:"";position:absolute;top:-20%;bottom:-20%;width:40%;left:-60%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.55),transparent);transform:skewX(-18deg);animation:hofsh 4.5s ease-in-out infinite}'
    + '@keyframes hofsh{0%,55%{left:-60%}100%{left:130%}}'
    + '.plaque .k{letter-spacing:.3em;font-size:13px;font-weight:600}.plaque .nm{font-family:Anton,Impact,sans-serif;font-size:clamp(40px,8vw,68px);line-height:1;margin:4px 0;color:#241600;text-shadow:0 2px 0 rgba(255,255,255,.5)}'
    + '.plaque .cl{font-size:17px;font-weight:600}.plaque .cl a{color:#3b2a00}.plaque .st{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:14px}'
    + '.plaque .st span{background:rgba(42,28,0,.12);border:1px solid rgba(42,28,0,.35);padding:4px 12px;font-weight:600}.plaque .st b{font-family:Anton,sans-serif;font-weight:400;font-size:22px;margin-right:6px}'
    + '.plaque .sp{font-size:44px;line-height:1}'
    + '.stamp{position:absolute;top:18px;right:-46px;transform:rotate(32deg);background:#C8102E;color:#fff;font:600 12px Oswald,sans-serif;letter-spacing:.18em;padding:6px 52px;box-shadow:0 3px 0 rgba(0,0,0,.35);z-index:2}'
    + '.proj{display:inline-flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:center;margin:6px auto 0;padding:6px 14px;border:2px dashed #ffd166;color:#ffd166;font-size:14px}.proj b{font-family:Anton,sans-serif;font-weight:400;font-size:20px;font-variant-numeric:tabular-nums}'
    + '.medals{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;margin-top:10px}'
    + '.medal{position:relative;text-align:center;padding:14px 10px 12px;background:linear-gradient(180deg,rgba(255,209,102,.10),rgba(255,209,102,.02));border:1px solid rgba(255,209,102,.3)}'
    + '.medal .disc{width:66px;height:66px;margin:0 auto 8px;border-radius:50%;display:grid;place-items:center;font-size:30px;background:radial-gradient(circle at 35% 30%,#fff3c4,#e2ad2c 55%,#8a6410);box-shadow:0 0 0 4px #7a5308,0 6px 14px rgba(0,0,0,.45)}'
    + '.medal .an{font-family:"Bebas Neue",Impact,sans-serif;font-size:20px;letter-spacing:.04em;color:#ffd166;line-height:1.05}.medal .who{font-family:Anton,sans-serif;font-size:20px;margin-top:4px}.medal small{display:block;opacity:.72;font-size:13px}'
    + '.medal.open{border-style:dashed;background:none}.medal.open .disc{background:none;border:3px dashed rgba(255,209,102,.45);box-shadow:none;filter:grayscale(1);opacity:.55}.medal.open .who{color:rgba(244,235,217,.55);font-family:Oswald,sans-serif;font-size:15px}'
    + '.podium{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:end;gap:8px;max-width:520px;margin:14px auto 0}'
    + '.podium div{text-align:center}.podium .blk{margin-top:6px;font-family:Anton,sans-serif;font-size:28px;color:#1b1300;display:grid;place-items:center}'
    + '.podium .p1 .blk{height:110px;background:linear-gradient(#ffe08a,#c8921c)}.podium .p2 .blk{height:80px;background:linear-gradient(#f1f5f9,#94a3b8)}.podium .p3 .blk{height:60px;background:linear-gradient(#f5c38a,#a0602a)}'
    + '.podium .nm{font-family:Anton,sans-serif;font-size:18px;overflow-wrap:anywhere}.podium small{display:block;opacity:.7}'
    + '.peds{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;margin-top:10px}'
    + '.ped{text-align:center;padding:16px 12px;border:2px dashed rgba(244,235,217,.22)}.ped .ic{font-size:34px}.ped .bb{font-size:22px;color:#ffd166}.ped .yn{font-family:Anton,sans-serif;font-size:20px;opacity:.45;margin-top:4px}.ped small{display:block;opacity:.7}'
    + '.ensh .plaque{max-width:none}'
    + '#hof-fab{position:fixed;right:14px;bottom:58px;z-index:9989;display:flex;align-items:center;gap:10px;text-decoration:none;color:#2a1c00;padding:8px 16px 8px 10px;border-radius:999px;background:linear-gradient(135deg,#fff1b8,#e9b93a 35%,#fbe08a 55%,#c8921c);border:3px solid #7a5308;box-shadow:0 10px 28px rgba(0,0,0,.5),0 0 24px rgba(255,209,102,.35);overflow:hidden;max-width:calc(100vw - 28px)}'
    + '#hof-fab:after{content:"";position:absolute;top:0;bottom:0;width:30%;left:-40%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.7),transparent);transform:skewX(-18deg);animation:hofsh 5s ease-in-out infinite}'
    + '#hof-fab .ic{font-size:26px;line-height:1}#hof-fab b{display:block;font-family:Anton,Impact,sans-serif;font-weight:400;font-size:18px;line-height:1.05;letter-spacing:.02em}#hof-fab small{display:block;font:600 12px/1.2 Oswald,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:190px}'
    + '#hof-fab.hide{display:none}@media(max-width:600px){#hof-fab{bottom:52px;padding:6px 12px 6px 8px}#hof-fab small{max-width:120px}}'
    + '@media(prefers-reduced-motion:reduce){#hof-fab:after{animation:none}}'
    + '.tabs a#s2tab{position:relative;background:linear-gradient(90deg,#14532d,#ff7a1a);border-color:#ff7a1a;color:#fff;animation:s2glow 2.2s ease-in-out infinite}'
    + '.tabs a#s2tab.on{background:linear-gradient(90deg,#ff7a1a,#C8102E);border-color:#C8102E;animation:none}'
    + '@keyframes s2glow{50%{box-shadow:0 0 18px rgba(255,122,26,.75)}}'
    + '.s2new{position:absolute;top:-9px;right:-8px;font:700 10px/1 Oswald,sans-serif;font-style:normal;letter-spacing:.08em;background:#ffd166;color:#1b1300;padding:3px 6px;border-radius:999px;transform:rotate(8deg);box-shadow:0 2px 0 #000}'
    + '#s2tab.seen .s2new{display:none}'
    + '@media(prefers-reduced-motion:reduce){.tabs a#s2tab{animation:none}}'
    + '.soon .lede{opacity:.85;max-width:720px}'
    + '.tz{position:relative;margin:20px 0 6px;padding:22px 20px;overflow:hidden;border:2px solid rgba(255,255,255,.15)}'
    + '.tz h3{margin:0;font-family:Anton,Impact,sans-serif;font-weight:400;font-size:clamp(32px,6vw,52px);line-height:1}.tz .kick{letter-spacing:.25em;font-size:12px;opacity:.85}.tz .clk{font-family:Anton,sans-serif;font-size:clamp(24px,4vw,34px);font-variant-numeric:tabular-nums}'
    + '.tz.xmas{background:radial-gradient(ellipse at 80% 0,rgba(255,209,102,.25),transparent 50%),linear-gradient(160deg,#0f3b26,#08221a);border-color:#e23b3b}.tz.xmas h3{font-family:"Mountains of Christmas",Anton,serif;color:#fff4c2;text-shadow:0 0 24px rgba(255,209,102,.5)}.tz.xmas .clk{color:#ffd166}'
    + '.tz.dog{background:repeating-linear-gradient(90deg,transparent 0 79px,rgba(255,255,255,.12) 79px 82px),linear-gradient(180deg,#14532d,#0b3d20);border-color:#ff7a1a}.tz.dog h3{color:#fff}.tz.dog .clk{color:#ff7a1a}'
    + '.tz .row2{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:18px;align-items:center}@media(max-width:720px){.tz .row2{grid-template-columns:minmax(0,1fr)}}'
    + '.tz svg{width:100%;height:auto;max-height:260px;display:block}'
    + '.wk{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;margin-top:12px}'
    + '.wk div{background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.14);padding:10px 12px}.wk b{display:block;font-family:"Bebas Neue",Impact,sans-serif;font-weight:400;font-size:21px;letter-spacing:.03em}.wk small{display:block;opacity:.6;font-size:12px;letter-spacing:.08em}'
    + '.xmas .wk b{color:#ffd166}.dog .wk b{color:#ffb070}.wk div.now{border-color:#ffd166;box-shadow:inset 0 0 0 2px #ffd166}'
    + '.tz h4{margin:18px 0 0;font-family:"Bebas Neue",Impact,sans-serif;font-weight:400;font-size:24px;letter-spacing:.05em}'
    + '.later{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px;margin-top:10px}.later div{padding:12px 14px;border:1px solid rgba(255,255,255,.16);border-top:6px solid var(--c)}.later b{font-family:Anton,sans-serif;font-weight:400;font-size:22px;display:block}.later small{opacity:.65;letter-spacing:.08em}'
    + '.fine{font-size:12px;opacity:.6;margin-top:10px}'
    + '.bobx{animation:hofbob 2.4s ease-in-out infinite;transform-box:fill-box;transform-origin:center}@keyframes hofbob{50%{transform:translateY(-6px)}}'
    + '@media(prefers-reduced-motion:reduce){.plaque:after,.bobx{animation:none}}';

  /* ---------------- HALL OF FAME ---------------- */
  function plaque(s, projected) {
    var a = s.ace || {};
    return '<div class="plaque">' + (projected ? '<div class="stamp">PROJECTED</div>' : '')
      + '<div class="sp">♠</div><div class="k">SEASON ' + esc(s.season) + ' ACE' + (s.theme ? ' · ' + esc(s.theme).toUpperCase() : '') + '</div>'
      + '<div class="nm">' + (a.name ? esc(a.name) : 'Vacant') + '</div>'
      + '<div class="cl">' + esc(a.club || (projected ? 'Nobody on the mound right now' : '')) + link(a.clubId) + '</div>'
      + '<div class="st">' + (a.days != null ? '<span><b>' + a.days + '</b>' + (a.days === 1 ? 'day' : 'days') + ' on the mound</span>' : '')
      + (a.defenses != null ? '<span><b>' + a.defenses + '</b>defenses</span>' : '') + (a.pts != null ? '<span><b>' + a.pts + '</b>reign pts</span>' : '') + '</div></div>';
  }
  function medals(list) {
    return '<div class="medals">' + list.map(function (x) {
      var open = !x.who;
      return '<div class="medal' + (open ? ' open' : '') + '"><div class="disc">' + esc(x.icon || '🏅') + '</div><div class="an">' + esc(x.name) + '</div>'
        + '<div class="who">' + (open ? (x.note ? esc(x.note) : 'Up for grabs') : esc(x.who)) + '</div><small>' + (open ? esc(x.what) : esc(x.club) + (x.value ? ' · ' + esc(x.value) : '')) + '</small></div>';
    }).join('') + '</div>';
  }
  function podium(cup) {
    var c = (cup || []).slice(0, 3); if (!c.length) return '';
    var ord = [c[1], c[0], c[2]], cls = ['p2', 'p1', 'p3'], num = [2, 1, 3];
    return '<div class="podium">' + ord.map(function (x, i) {
      return '<div class="' + cls[i] + '">' + (x ? '<div class="nm">' + esc(x.name) + '</div><small>' + esc(x.club) + ' · ' + x.pts + ' pts</small>' : '<small>open</small>') + '<div class="blk">' + num[i] + '</div></div>';
    }).join('') + '</div>';
  }
  function projectedSeason() {
    var d = D(), A = d.ace, rg = (d.reigns || [])[0];
    var cur = (d.reigns || []).filter(function (r) { return !r.end; })[0] || rg;
    return {
      season: d.season || 1,
      ace: A ? { name: A.name, club: A.club, clubId: A.clubId, days: cur ? ndays(cur.start) : ndays(A.since), defenses: A.rdef != null ? A.rdef : A.defenses, pts: A.rpts != null ? A.rpts : A.pts } : {},
      awards: (d.awards || []).filter(function (x) { return !/Ace$/.test(x.name) && !((d.cup || []).length && /Cup$/.test(x.name)); }), cup: d.cup || []
    };
  }
  function hallHTML() {
    var d = D(), done = HALL.seasons || [], live = d.season && !done.some(function (s) { return +s.season === +d.season; });
    var final = live && d.seasonClosed, P = live ? projectedSeason() : null;
    var h = '<div class="hof"><div class="hof-hero"><div class="bb" style="letter-spacing:.35em;font-size:14px;opacity:.8">HOLD THE HILL</div><div class="bb ttl">Hall of Fame</div>'
      + '<p>Every season ends with a plaque. Aces, Cup winners and award winners hang here for good. Get your name on the wall.</p></div>';
    if (P) {
      h += '<h2 class="bb">' + (final ? '🏛️ Season ' + esc(P.season) + ' · final, being enshrined' : '🔮 If Season ' + esc(P.season) + ' ended right now') + '</h2>';
      if (!final) h += '<div style="text-align:center"><span class="proj">NOT FINAL · the plaque is still being carved · locks in <b id="hof-lock">' + (d.seasonEnd ? cd(Date.parse(d.seasonEnd) - Date.now()) : '') + '</b></span></div>';
      h += plaque(P, !final);
      if (P.cup.length) h += '<h2 class="bb">🏆 The Bench Clearer Cup' + (final ? '' : ' · as it stands') + '</h2>' + podium(P.cup);
      h += '<h2 class="bb">🏅 Season ' + esc(P.season) + ' medals' + (final ? '' : ' · race is on') + '</h2>' + medals(P.awards);
      if (!final) h += '<div class="fine">Projection from the live board. Anything can change until the final buzzer ' + (d.seasonEnd ? '(' + esc(when(d.seasonEnd)) + ')' : '') + '. Empty medals are still up for grabs.</div>';
    }
    if (done.length) {
      h += '<h2 class="bb">🏛️ Enshrined</h2><div class="ensh">' + done.slice().reverse().map(function (s) {
        return plaque(s, false) + (s.cup && s.cup.length ? podium(s.cup) : '') + (s.awards && s.awards.length ? medals(s.awards) : '');
      }).join('') + '</div>';
    }
    h += '<h2 class="bb">🪧 Empty pedestals</h2><div class="peds">'
      + '<div class="ped"><div class="ic">🎄</div><div class="bb">Holiday Tree Star</div><small>Top of the Tree at the ball drop · Dec 31</small><div class="yn">your name here</div></div>'
      + '<div class="ped"><div class="ic">🐶</div><div class="bb">Season 2 Top Dog</div><small>The Dog Pile · January</small><div class="yn">your name here</div></div>'
      + '<div class="ped"><div class="ic">🏀</div><div class="bb">King of the Court</div><small>Season 3 · coming later</small><div class="yn">your name here</div></div>'
      + '<div class="ped"><div class="ic">🧢</div><div class="bb">Bleacher Vote</div><small>Every season · the players pick</small><div class="yn">your name here</div></div></div></div>';
    return h;
  }

  /* ---------------- COMING SOON ---------------- */
  function treeSVG() {
    var g = '<svg viewBox="0 0 400 300" role="img" aria-label="Holiday tree with a star on top"><rect y="270" width="400" height="30" fill="#eef4f7" opacity=".9"/><rect x="186" y="246" width="28" height="28" fill="#6b3d1f"/>';
    [[200, 60, 110, 140], [200, 110, 145, 200], [200, 160, 180, 256]].forEach(function (t) { g += '<path d="M' + t[0] + ' ' + t[1] + 'L' + (t[0] + t[2]) + ' ' + t[3] + 'L' + (t[0] - t[2]) + ' ' + t[3] + 'Z" fill="#1f6b3a"/><path d="M' + t[0] + ' ' + t[1] + 'L' + (t[0] - t[2]) + ' ' + t[3] + 'L' + (t[0] - t[2] / 2) + ' ' + t[3] + 'Z" fill="rgba(255,255,255,.08)"/>'; });
    var L = (D().ladder || []).slice(0, 8), sp = [[185, 120], [222, 150], [168, 180], [240, 198], [150, 230], [215, 238], [270, 240], [125, 245]], oc = ['#e23b3b', '#ffd166', '#4cc9f0', '#f72585'];
    L.forEach(function (p, i) { var s = sp[i]; g += '<circle cx="' + s[0] + '" cy="' + s[1] + '" r="12" fill="' + oc[i % 4] + '"/><circle cx="' + (s[0] - 4) + '" cy="' + (s[1] - 4) + '" r="3" fill="rgba(255,255,255,.65)"/><text x="' + s[0] + '" y="' + (s[1] + 5) + '" text-anchor="middle" font-family="Anton" font-size="12" fill="#111">' + esc(p.rank) + '</text>'; });
    g += '<g class="bobx"><path d="M200 12l9 24h26l-21 15 8 25-22-15-22 15 8-25-21-15h26z" fill="#ffd166" stroke="#fff4c2" stroke-width="2"/></g>';
    for (var i = 0; i < 30; i++) g += '<circle cx="' + ((i * 137) % 400) + '" cy="' + ((i * 71) % 260) + '" r="' + (1 + i % 3) + '" fill="rgba(255,255,255,.55)"/>';
    return g + '</svg>';
  }
  function pileSVG() {
    var g = '<svg viewBox="0 0 400 280" role="img" aria-label="A pile of football helmets with a dog on top">', cols = ['#c8102e', '#203f8f', '#ffb612', '#4f2683', '#0a7d48', '#e05a00'], k = 0;
    [[60, 225, 5], [92, 178, 4], [124, 131, 3]].forEach(function (r) { for (var j = 0; j < r[2]; j++) { var x = r[0] + j * 70, y = r[1], c = cols[(k++) % 6]; g += '<g transform="translate(' + x + ',' + y + ')"><path d="M-32 8A32 30 0 0 1 32 4L34 16 8 20 6 26-28 26Z" fill="' + c + '"/><path d="M-30 2A32 28 0 0 1 16-20" stroke="rgba(255,255,255,.35)" stroke-width="4" fill="none"/><rect x="-5" y="-22" width="7" height="48" fill="#f4f1e6" opacity=".85" transform="rotate(8)"/><path d="M10 11H36M10 19H34M24 6V24" stroke="#ccc" stroke-width="3"/></g>'; } });
    g += '<g class="bobx"><circle cx="194" cy="74" r="28" fill="#c98b4b"/><path d="M168 62q-14 24 0 36 4-20 6-32zM220 62q14 24 0 36-4-20-6-32z" fill="#7a4a22"/><ellipse cx="194" cy="88" rx="13" ry="10" fill="#e7c08f"/><circle cx="194" cy="81" r="5" fill="#222"/><circle cx="184" cy="68" r="3.5" fill="#222"/><circle cx="204" cy="68" r="3.5" fill="#222"/><path d="M174 48l10-13 10 12 10-12 10 13z" fill="#ffd166"/></g>';
    return g + '<rect y="256" width="400" height="24" fill="rgba(255,255,255,.08)"/></svg>';
  }
  var NIGHTS = [
    ['Dec 24', '🤫 Silent Night', 'No items. No trash talk. The bot only posts 🤫 for the night.'],
    ['Dec 25', '🧦 Stocking Stuffers', 'Everyone wakes up to a free random item. One stocking has a 🪨 Lump of Coal in it.'],
    ['Dec 26', '🥊 Boxing Day', 'Brass Knuckles half off. Any title win by 3+ is a knockout.'],
    ['Dec 27', '❄️ Snow Day', 'The whole top 5 can charge the Star, all day.'],
    ['Dec 28', '🐘 White Elephant', 'Before any charge you can swap one of your items for a random item from the shop. No take-backs.'],
    ['Dec 29', '📜 Naughty List', 'The Star wears a bounty that grows 25 BB every hour nobody charges.'],
    ['Dec 30', '🙃 Upside-Down Tree', 'For 6 hours the ladder flips: the bottom club gets a title shot and #1 waits in line.'],
    ['Dec 31', '🪩 Ball Drop', 'A new title shot every 2 hours. Whoever is the Star at midnight takes the Holiday Crown.'],
    ['Jan 1', '🥴 Hangover Classic', 'Any loss from the tree can be replayed once. Winner takes 50 BB off the other.']];
  var XITEMS = [
    ['🪨 Lump of Coal', 'Throw it at any club: their next win pays zero Brawl Bucks.'],
    ['🛷 Sleigh Ride', 'Charge 2 extra spots up. Lose, and you sled straight to the bottom.'],
    ['🦌 Rudolph', 'One charge during quiet hours. He lights the way.'],
    ['🍪 Milk & Cookies', 'Leave them for the Star: their Brass Knuckles don\'t count on your charge.'],
    ['🎁 Re-gift', 'Lose at the Star and the slide goes to a random club instead of you.'],
    ['🔔 Jingle Bell', 'Ring a 20-minute mini Bell. Anyone can charge the Star while it jingles.']];
  var DITEMS = [
    ['🦴 Spiked Collar', 'Brass Knuckles in a dog collar: the challenger needs 1 more run.'],
    ['🙏 Hail Mary', 'Charge the Top Dog from ANY spot. Win by 6+ and it\'s yours. Miss and you owe the Top Dog 100 BB.'],
    ['🧊 Gatorade Bath', 'Top Dog only: after a stop, dump it on the loser. They sit out 6 extra hours.'],
    ['🎾 Fetch', 'Win your blitz and fetch 50 BB from whoever you beat.'],
    ['🏈 Onside Kick', 'Charge 4 spots up. Recover it or tumble to the bottom.'],
    ['🚩 Challenge Flag', 'The Mulligan, in stripes: a loss at the pile doesn\'t count.']];
  var DRULES = [
    ['⏱️ Two-Minute Warning', 'The last 2 hours before quiet time pay double for wins.'],
    ['🤾 Fumble', 'Top Dog loses by 4+? Fumbled. Straight to the bottom of the pile.'],
    ['🐕 Puppy Pile-On', 'The 3rd club to blitz the Top Dog in one day gets a 1-run head start.'],
    ['😴 Bye Week', 'One 24-hour shield per club, per season. Nobody can blitz you.'],
    ['🏆 Super Bowl Sunday', 'Season finale: Top Dog vs #1, best of 3, sportsbook wide open.'],
    ['🐶 Dog of the Week', 'A weekly Bleacher Vote. Winner gets a free treat (item).']];
  var LATER = [['#f77f00', '🏀 King of the Court', 'SEASON 3', 'The last week turns into an 8-club March Madness bracket.'], ['#0b6e4f', '⛳ The Green Jacket', 'MASTERS WEEK', 'Handicap strokes: lower clubs start with free runs.'], ['#7b2cbf', '🤼 Royal Rumble', 'ONE WILD WEEKEND', 'A new club enters every 90 minutes. Last one standing.'], ['#c1121f', '🌹 Run for the Roses', 'DERBY DAY', 'The ladder is the field. Exacta bets at post time.'], ['#ff6d00', '🎃 Haunted Hill', 'OCTOBER', 'Inactive clubs come back as ghosts and haunt charges.'], ['#219ebc', '🏰 Sandcastle', 'SUMMER', 'High tide washes the no-shows down a spot every night.']];
  function cards(a, nowIdx) { return '<div class="wk">' + a.map(function (x, i) { return '<div' + (i === nowIdx ? ' class="now"' : '') + '>' + (x.length > 2 ? '<small>' + esc(x[0]) + '</small><b>' + esc(x[1]) + '</b>' + esc(x[2]) : '<b>' + esc(x[0]) + '</b>' + esc(x[1])) + '</div>'; }).join('') + '</div>'; }
  function soonHTML() {
    var now = Date.now(), on = now >= TREE_ON && now < TREE_OFF ? Math.floor((now - TREE_ON) / 864e5) : -1;
    return '<div class="soon"><h2 class="bb">🐶 Season 2 sneak peek</h2><p class="lede">Season 1 is just the warm-up. Season 2 trades the mound for a pile of helmets, and the shop for a doghouse. Here\'s the first look, plus the holiday ladder that bridges the gap.</p>'
      + '<div class="tz dog"><div class="row2"><div><div class="kick">SEASON 2 · KICKS OFF EARLY JANUARY · FOOTBALL</div><h3>The Dog Pile</h3>'
      + '<p>The mound becomes a pile and the Ace becomes the <b>🐶 Top Dog</b>. Every charge is a blitz, every title shot is a goal-line stand, and Brawl Bucks become <b>🦴 Bone Bucks</b>.</p></div><div>' + pileSVG() + '</div></div>'
      + '<h4>🏈 New rules</h4>' + cards(DRULES) + '<h4>🦴 The doghouse shop</h4>' + cards(DITEMS) + '</div>'
      + '<h2 class="bb">🎄 Before kickoff: the holiday ladder</h2>'
      + '<div class="tz xmas" id="tz-xmas"><div class="row2"><div><div class="kick">DEC 24 – JAN 1 · 9 NIGHTS · HOLIDAY LADDER</div><h3>Top of the Tree</h3>'
      + '<p>The ladder becomes a tree. The Ace is the <b>⭐ Star</b>, everyone else hangs as an ornament, and whoever is on top when the ball drops takes the <b>Holiday Crown</b> and a spot in the Hall of Fame.</p>'
      + '<div class="kick" id="xk">' + (now < TREE_ON ? 'THE TREE LIGHTS UP IN' : now < BALL ? 'BALL DROP IN' : 'HAPPY NEW YEAR') + '</div><div class="clk" id="xc"></div></div><div>' + treeSVG() + '</div></div>'
      + '<h4>Nine nights, nine twists</h4>' + cards(NIGHTS, on) + '<h4>🎅 Holiday shop</h4>' + cards(XITEMS)
      + '<h4>🎁 Secret Santa</h4><p style="margin:4px 0 0">Every club draws a secret target on Christmas Eve. Beat yours any night of the tree for a 100 BB gift.</p></div>'
      + '<h2 class="bb">👀 And after that…</h2><div class="later">' + LATER.map(function (x) { return '<div style="--c:' + x[0] + '"><small>' + esc(x[2]) + '</small><b>' + esc(x[1]) + '</b>' + esc(x[3]) + '</div>'; }).join('') + '</div>'
      + '<div class="fine">Previews. Every rule and item here is subject to change, and to the commish\'s sense of humor. Got a wacky idea? Pitch it in the Hill Discord.</div></div>';
  }

  /* ---------------- MOUNT ---------------- */
  var MINE = ['hof', 'soon'];
  function show(k) {
    if (MINE.indexOf(k) < 0) return;
    document.querySelectorAll('.tabs a').forEach(function (a) { a.className = a.dataset.t === k ? 'on' : ''; });
    document.querySelectorAll('.pane').forEach(function (x) { x.className = 'pane' + (x.id === 'p-' + k ? ' on' : ''); });
  }
  function fab() {
    var d = D(), A = d.ace; if (document.getElementById('hof-fab')) return;
    var w = document.createElement('a'); w.id = 'hof-fab'; w.href = '#hof'; w.title = 'Hold the Hill Hall of Fame';
    w.innerHTML = '<span class="ic">🏛️</span><span><b>Hall of Fame</b><small>' + (A && !d.seasonClosed ? '♠ ' + esc(A.name) + ' on pace · not final' : 'Season ' + esc(d.season) + ' plaques') + '</small></span>';
    document.body.appendChild(w);
  }
  function fabSync(k) { var f = document.getElementById('hof-fab'); if (f) f.className = k === 'hof' ? 'hide' : ''; }
  function mount() {
    var nav = document.querySelector('#app .tabs'), app = document.getElementById('app'); if (!nav || document.getElementById('p-hof')) return;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    var fl = document.createElement('link'); fl.rel = 'stylesheet'; fl.href = 'https://fonts.googleapis.com/css2?family=Mountains+of+Christmas:wght@700&display=swap'; document.head.appendChild(fl);
    var after = nav.querySelector('a[data-t=farm]') || nav.querySelector('a[data-t=hill]');
    var a1 = document.createElement('a'); a1.href = '#hof'; a1.dataset.t = 'hof'; a1.textContent = '🏛️ Hall of Fame';
    var a2 = document.createElement('a'); a2.href = '#soon'; a2.dataset.t = 'soon'; a2.id = 's2tab'; a2.innerHTML = '🐶 Season 2 Preview<i class="s2new">NEW</i>';
    after.after(a1); a1.after(a2);
    var p1 = document.createElement('section'); p1.className = 'pane'; p1.id = 'p-hof'; p1.innerHTML = hallHTML();
    var p2 = document.createElement('section'); p2.className = 'pane'; p2.id = 'p-soon'; p2.innerHTML = soonHTML();
    app.appendChild(p1); app.appendChild(p2); fab(); try { if (localStorage.getItem('hth-s2-seen')) a2.classList.add('seen'); } catch (e) { }
    show((location.hash || '').slice(1)); fabSync((location.hash || '').slice(1));
    window.addEventListener('hashchange', function () { var k = (location.hash || '').slice(1); show(k); fabSync(k); if (k === 'soon') { var s2 = document.getElementById('s2tab'); if (s2) s2.classList.add('seen'); try { localStorage.setItem('hth-s2-seen', '1'); } catch (e) { } } if (k === 'hof') window.scrollTo({ top: document.querySelector('#app .tabs').offsetTop, behavior: RM ? 'auto' : 'smooth' }); });
    setInterval(function () {
      var n = Date.now(), d = D(), lk = document.getElementById('hof-lock'), xc = document.getElementById('xc'), xk = document.getElementById('xk');
      if (lk && d.seasonEnd) lk.textContent = cd(Date.parse(d.seasonEnd) - n);
      if (xc) { var tgt = n < TREE_ON ? TREE_ON : BALL; xc.textContent = n < BALL ? cd(tgt - n) : '🎆'; if (xk) xk.textContent = n < TREE_ON ? 'THE TREE LIGHTS UP IN' : n < BALL ? 'BALL DROP IN' : 'HAPPY NEW YEAR'; }
    }, 1000);
  }
  function boot() {
    var u = ['https://raw.githubusercontent.com/slipnsliders/smallball-tools/main/docs/hill/hall.json?t=' + Date.now(), 'hall.json?t=' + Date.now()];
    (function get(i) {
      if (i >= u.length) return wait(0);
      fetch(u[i], { cache: 'no-store' }).then(function (r) { if (!r.ok) throw r.status; return r.json(); }).then(function (j) { if (j && j.seasons) HALL = j; wait(0); }).catch(function () { get(i + 1); });
    })(0);
    function wait(n) { if (window.__D && document.querySelector('#app .tabs')) { try { mount(); } catch (e) { console.warn('hall', e); } } else if (n < 160) setTimeout(function () { wait(n + 1); }, 250); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
