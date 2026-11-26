/**
 * SmallBall Tournament (v1.4: the live bracket can live on GitHub Pages; v1.3: sleeps when nothing is due, to save Google run time; v1.2: a bracket preview while sign-ups are open; v1.1: blank-form sign-ups for returning players) · by Slip (slipnsliders) for the SmallBall community
 * A Google Sheet + Form + Apps Script that runs a SmallBall tournament on its own:
 *   sign-ups on a Google Form → a seeded bracket → fixed waves of matches → BigLeague games found on
 *   SmallBall automatically → results posted to Discord once each game has aired (no spoilers) → a live
 *   bracket web page with a "save as image" button. No-shows and ties are handled by the rules below, so
 *   it keeps running when the organizer is away.
 * Read-only on SmallBall: it only reads the public game list (/games/all?club=ID). It never plays,
 * trains or saves anything there. Owners play their own matches.
 *
 * SETUP: Extensions → Apps Script, paste this file, Save. Run `setup` once (approve). Fill in Config.
 * Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone) for the live bracket.
 */

// ===================== Settings (the Config tab) =====================
const DEFAULTS = {
  TOURNEY_NAME: ['Black Friday Brawl', 'Shown everywhere'],
  DISCORD_WEBHOOK_URL: ['', 'Discord channel → Edit Channel → Integrations → Webhooks → New Webhook → Copy URL'],
  LOG_WEBHOOK_URL: ['', 'Optional: a private channel that gets the Log (errors, rejections)'],
  FORMAT: ['double', 'double (double elimination) or single (single elimination)'],
  GRAND_FINAL_RESET: ['yes', 'Double elimination: if the losers-bracket champ wins the grand final, play once more (yes/no)'],
  SEEDING: ['signup', 'signup (sign-up order), stars (most stars first) or random'],
  SIGNUP_CLOSE: ['2026-11-26 21:00', 'Sign-ups close and the bracket is drawn (yyyy-MM-dd HH:mm, Mountain time)'],
  START: ['2026-11-27 09:00', 'Wave 1 starts (yyyy-MM-dd HH:mm, Mountain time)'],
  WAVE_MINUTES: ['60', 'Each wave lasts this long. A match opens at the start of a wave and must be played before it ends'],
  ALLOWED_KINDS: ['big', 'Game types that count, comma separated: big, pro, exhibition'],
  POST_DELAY_MINUTES: ['25', 'Results post this long after the game is played, once it has aired (official games air about 22 minutes)'],
  NO_SHOW: ['higher seed', 'No game by the end of the wave: "higher seed" moves on automatically, or "commish" waits for you'],
  TIE_RULE: ['replay', 'A tie: "replay" (play again; the match gets 30 more minutes) or "higher seed"'],
  MAX_CLUBS: ['32', 'Sign-ups stop at this many clubs'],
  PREVIEW_SIZE: ['16', 'While sign-ups are open, the bracket page shows a preview bracket this big (16 = no byes). It grows to 32 if more sign up'],
  MIN_STARS: ['0', 'Lowest club stars allowed (0 = anyone)'],
  MAX_STARS: ['10', 'Highest club stars allowed'],
  FORM_LINK: ['', 'Short link to the sign-up form (filled in by setup; swap in a tinyurl if you like)'],
  BOARD_LINK: ['', 'Link to the live bracket for Discord posts. Blank = the web app link, found on its own'],
  PRIZES: ['SmallBall Tickets and pictures of dogs', 'Shown on the bracket and the champion post'],
  HILL_SHEET_ID: ['', 'Optional: the Hold the Hill spreadsheet ID (the long code in its link). Hill players can then sign up with a blank form'],
  FORM_ID: ['', '(set by setup)'],
  TZ: ['America/Denver', 'Time zone for the times above'],
  GITHUB_REPO: ['slipnsliders/smallball-tools', 'Optional: the GitHub repo that hosts the bracket page (owner/repo). Connect it from the 🏆 Tournament menu'],
  GITHUB_PATH: ['docs/brawl/bracket.json', 'Where the bracket data goes in that repo (the page sits next to it)'],
};
const SHEETS = { CONFIG: 'Config', ROSTER: 'Roster', ENTRANTS: 'Entrants', MATCHES: 'Matches', LOG: 'Log', STATE: 'State', BOARD: 'Board' };
const ENTRANT_COLS = ['Email', 'Discord', 'DiscordID', 'Owner', 'Club', 'ClubID', 'Stars', 'Joined', 'Status', 'Seed'];
// Everyone who has ever signed up here (it comes along when you copy this Sheet for the next tournament).
const ROSTER_COLS = ['Email', 'Discord', 'DiscordID', 'Owner', 'Club', 'ClubID', 'Stars', 'LastSeen'];
const FORM_DESC = 'Played before, or on Hold the Hill? Just submit: leave the boxes blank and we fill them in from your record (your Google sign-in tells us who you are). Fill in only what\'s new, like a different club.\n\nOne club per owner. BigLeague games only. Read-only: the tournament reads SmallBall\'s public game list and never plays or saves anything for you.';
const Q = {
  DISCORD: 'Discord username',
  DISCORD_ID: 'Discord user ID (optional: lets the bracket @tag you when your match opens)',
  OWNER: 'SmallBall owner name',
  CLUB: 'Club name',
  CLUB_ID: 'Club ID # (one club per owner)',
  STARS: 'Club stars (0-10, shown on your SmallBall club page)',
};
const BYE = -1;

// ===================== Small helpers =====================
const norm_ = (v) => String(v == null ? '' : v).trim();
const lc_ = (v) => norm_(v).toLowerCase();
const esc_ = (s) => norm_(s).replace(/([*_~`|>\\])/g, '\\$1');   // Discord markdown
const now_ = () => new Date();
function fail_(msg) { const e = new Error(msg); e.userFacing = true; throw e; }

function ss_() { return SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID')); }
function sheet_(name, header) {
  const ss = ss_(); let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); if (header) { sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold'); sh.setFrozenRows(1); } }
  return sh;
}
let CFG_CACHE = null;
function cfg_() {
  if (CFG_CACHE) return CFG_CACHE;
  const sh = sheet_(SHEETS.CONFIG, ['Key', 'Value', 'Notes']);
  const vals = sh.getDataRange().getValues(), C = {};
  for (let i = 1; i < vals.length; i++) if (vals[i][0]) C[norm_(vals[i][0])] = vals[i][1];
  Object.keys(DEFAULTS).forEach((k) => { if (C[k] === undefined || C[k] === '') C[k] = C[k] === '' ? '' : DEFAULTS[k][0]; });
  CFG_CACHE = C; return C;
}
function setCfg_(key, value) {
  const sh = sheet_(SHEETS.CONFIG, ['Key', 'Value', 'Notes']), vals = sh.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) if (norm_(vals[i][0]) === key) { sh.getRange(i + 1, 2).setValue(value); CFG_CACHE = null; return; }
  sh.appendRow([key, value, DEFAULTS[key] ? DEFAULTS[key][1] : '']); CFG_CACHE = null;
}
function tz_(C) { return norm_((C || cfg_()).TZ) || 'America/Denver'; }
// A Config time: a real date (Sheets may turn it into one) or "yyyy-MM-dd HH:mm" in the tournament's time zone.
function when_(v, C) {
  if (v instanceof Date) return v.getTime();
  const s = norm_(v); if (!s) return 0;
  try { return Utilities.parseDate(s.replace('T', ' ').slice(0, 16), tz_(C), 'yyyy-MM-dd HH:mm').getTime(); } catch (e) { return Date.parse(s) || 0; }
}
const fmtT_ = (t, C) => Utilities.formatDate(new Date(t), tz_(C), 'EEE h:mm a');
const ts_ = (t) => '<t:' + Math.floor(t / 1000) + ':t>';      // Discord shows it in each reader's own time
const tsR_ = (t) => '<t:' + Math.floor(t / 1000) + ':R>';

function log_(actor, action, details) {
  try {
    const sh = sheet_(SHEETS.LOG, ['Time', 'Actor', 'Action', 'Details']);
    sh.appendRow([now_(), actor, action, norm_(details).slice(0, 4000)]);
    const C = cfg_();
    if (norm_(C.LOG_WEBHOOK_URL) && !/^Discord/.test(action)) queueLog_('`' + action + '` ' + norm_(details).slice(0, 300));
  } catch (e) { }
}
function queueLog_(line) {
  const p = PropertiesService.getScriptProperties();
  let q = []; try { q = JSON.parse(p.getProperty('LOG_QUEUE') || '[]'); } catch (e) { }
  q.push(line); p.setProperty('LOG_QUEUE', JSON.stringify(q.slice(-60)));
}
function flushLog_() {
  const p = PropertiesService.getScriptProperties(), C = cfg_(), url = norm_(C.LOG_WEBHOOK_URL);
  let q = []; try { q = JSON.parse(p.getProperty('LOG_QUEUE') || '[]'); } catch (e) { }
  if (!q.length || !url) return;
  p.setProperty('LOG_QUEUE', '[]');
  sendChunk_(url, '🏆 Tournament log', q.join('\n').slice(0, 1900));
}

// ===================== Discord =====================
function webhook_(C) { return norm_(C.DISCORD_WEBHOOK_URL); }
// One message to one webhook. Returns the HTTP code (0 = it never got there).
function sendChunk_(url, name, chunk, embeds) {
  const send = (text) => UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify(Object.assign({ content: text, username: name, allowed_mentions: { parse: ['users'] } }, embeds ? { embeds } : {})) });
  let res, code;
  try { res = send(chunk); code = res.getResponseCode(); } catch (e) { log_('system', 'Discord error', String(e)); return 0; }
  // "error code: 1015" is Cloudflare briefly blocking Google's servers: the retry queue handles that one.
  for (let tries = 0; code === 429 && tries < 2 && !/1015/.test(res.getContentText()); tries++) {
    let wait = 1.5; try { wait = Number(JSON.parse(res.getContentText()).retry_after) || 1.5; } catch (e) { }
    Utilities.sleep(Math.min(8, wait + 0.25) * 1000); res = send(chunk); code = res.getResponseCode();
  }
  if (code >= 400 && code !== 429 && code < 500) {   // formatting Discord didn't like: send it plain
    const plain = chunk.replace(/\[([^\]]*)\]\(<?([^)>]+)>?\)/g, '$1 $2').replace(/`/g, '');
    if (plain !== chunk) { res = send(plain); code = res.getResponseCode(); }
  }
  if (code >= 300) log_('system', 'Discord error ' + code + (code === 429 || code >= 500 ? ' (will retry)' : ''), String(res.getContentText()).slice(0, 80) + ' · ' + chunk.slice(0, 120));
  return code;
}
function post_(content, embeds) {
  const C = cfg_(), url = webhook_(C);
  if (!url) { log_('system', 'Discord (no webhook set)', content); return; }
  const chunks = []; let s = content;
  while (s.length > 1900) { const cut = s.lastIndexOf('\n', 1900); const at = cut > 0 ? cut : 1900; chunks.push(s.slice(0, at)); s = s.slice(at); }
  chunks.push(s);
  chunks.forEach((chunk, i) => {
    const code = sendChunk_(url, norm_(C.TOURNEY_NAME) || 'Tournament', chunk, i === chunks.length - 1 ? embeds : null);
    if (code === 429 || code >= 500 || code === 0) queueRetry_(chunk);
  });
}
function queueRetry_(chunk) {
  const p = PropertiesService.getScriptProperties();
  let q = []; try { q = JSON.parse(p.getProperty('RETRY_POSTS') || '[]'); } catch (e) { }
  q.push({ text: chunk, n: 0, first: Date.now(), at: Date.now() + 60000 });
  p.setProperty('RETRY_POSTS', JSON.stringify(q.slice(-40)));
}
function flushRetries_() {
  const p = PropertiesService.getScriptProperties();
  let q = []; try { q = JSON.parse(p.getProperty('RETRY_POSTS') || '[]'); } catch (e) { }
  if (!q.length) return;
  const C = cfg_(), url = webhook_(C), t = Date.now(), keep = []; let blocked = false, sent = 0;
  q.forEach((x) => {
    if (!url || blocked || x.at > t || sent >= 5) { keep.push(x); return; }
    const code = sendChunk_(url, norm_(C.TOURNEY_NAME) || 'Tournament', x.text);
    if (code >= 200 && code < 300) { sent++; return; }
    if (code === 429 || code >= 500 || code === 0) {
      blocked = true;
      if (t - x.first > 6 * 3600e3) { log_('system', 'Discord gave up', x.text.slice(0, 300)); return; }
      x.n++; x.at = t + Math.min(10, Math.pow(2, x.n)) * 60000; keep.push(x);
    }
  });
  p.setProperty('RETRY_POSTS', JSON.stringify(keep));
}
function boardUrl_(C) {
  let u = norm_(C.BOARD_LINK);
  if (!u) try { u = ScriptApp.getService().getUrl() || ''; } catch (e) { u = ''; }
  return u;
}
function linksLine_(C) {
  C = C || cfg_();
  const b = boardUrl_(C), f = norm_(C.FORM_LINK), bits = [];
  if (b) bits.push('🗂️ [Live bracket](<' + b + '>)');
  if (f) bits.push('📝 [Sign-up form](<' + f + '>)');
  return bits.length ? '\n' + bits.join(' · ') : '';
}

// ===================== Entrants =====================
function readTable_(name, cols) {
  const sh = sheet_(name, cols), vals = sh.getDataRange().getValues(), head = vals[0].map(norm_), rows = [];
  for (let i = 1; i < vals.length; i++) {
    const r = { _row: i + 1 }; head.forEach((h, j) => { r[h] = vals[i][j]; }); if (head.some((h) => norm_(r[h]))) rows.push(r);
  }
  return { sh, head, rows };
}
function writeRow_(t, r) { t.sh.getRange(r._row, 1, 1, t.head.length).setValues([t.head.map((h) => (r[h] === undefined ? '' : r[h]))]); }
function appendRow_(t, r) { t.sh.appendRow(t.head.map((h) => (r[h] === undefined ? '' : r[h]))); }
function entrants_() { return readTable_(SHEETS.ENTRANTS, ENTRANT_COLS); }
const tag_ = (e) => (e && /^\d{15,21}$/.test(norm_(e.DiscordID)) ? '<@' + norm_(e.DiscordID) + '>' : '**' + esc_(e ? e.Discord : '?') + '**');
const clubTxt_ = (e) => '*' + esc_(e.Club) + '* (club ID `' + norm_(e.ClubID) + '`' + (norm_(e.Stars) !== '' ? ' · ' + norm_(e.Stars) + '★' : '') + ')';

// ===================== The form =====================
function onTourneyFormSubmit(e) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  let sub = null;
  try {
    sub = readSubmission_(e);
    register_(sub);
  } catch (err) {
    log_(sub ? sub.email : 'form', 'Rejected', String(err.message || err));
    if (err.userFacing) rejectPost_(sub, err.message);
    else rejectPost_(sub, 'Something went wrong on our end. The organizer has been flagged.');
  } finally { lock.releaseLock(); }
}
function readSubmission_(e) {
  const r = e && e.response; if (!r) fail_('No form response found.');
  const out = { email: lc_(r.getRespondentEmail()), a: {} };
  r.getItemResponses().forEach((ir) => { out.a[ir.getItem().getTitle()] = norm_(ir.getResponse()); });
  const pick = (k) => { if (out.a[k] !== undefined) return out.a[k]; const key = Object.keys(out.a).find((t) => t.toLowerCase().indexOf(k.toLowerCase().split(' (')[0]) === 0); return key ? out.a[key] : ''; };
  out.discord = pick(Q.DISCORD); out.discordId = pick(Q.DISCORD_ID); out.owner = pick(Q.OWNER); out.club = pick(Q.CLUB);
  out.clubId = pick(Q.CLUB_ID).replace(/[^\d]/g, ''); out.stars = pick(Q.STARS);
  return out;
}
// What we already know about this Google account: this Sheet's Roster first, then the Hold the Hill sheet.
function knownPerson_(email, C) {
  const out = {};
  const take = (r) => { if (!r) return; ['Discord', 'DiscordID', 'Owner', 'Club', 'ClubID', 'Stars'].forEach((k) => { if (out[k] === undefined && norm_(r[k]) !== '') out[k] = norm_(r[k]); }); };
  try { take(readTable_(SHEETS.ROSTER, ROSTER_COLS).rows.find((r) => lc_(r.Email) === email)); } catch (e) { }
  if (norm_(C.HILL_SHEET_ID)) try {
    const hs = SpreadsheetApp.openById(norm_(C.HILL_SHEET_ID)), grab = (name) => { const sh = hs.getSheetByName(name); if (!sh) return []; const v = sh.getDataRange().getValues(), h = v[0].map(norm_); return v.slice(1).map((row) => { const o = {}; h.forEach((k, j) => { o[k] = row[j]; }); return o; }); };
    const p = grab('Players').find((r) => lc_(r.Email) === email);
    if (p) { take({ Discord: p.Discord, DiscordID: p.DiscordID, Owner: p.OwnerID, Club: p.Club, ClubID: p.ClubID });
      const st = grab('Stars').find((r) => norm_(r.ClubID) === norm_(p.ClubID)); if (st) take({ Stars: st.Stars }); }
  } catch (e) { log_('system', 'Hill sheet not readable', String(e.message || e)); }
  return out;
}
function remember_(rec) {
  const rt = readTable_(SHEETS.ROSTER, ROSTER_COLS), row = rt.rows.find((r) => lc_(r.Email) === rec.Email);
  const v = { Email: rec.Email, Discord: rec.Discord, DiscordID: rec.DiscordID, Owner: rec.Owner, Club: rec.Club, ClubID: rec.ClubID, Stars: rec.Stars, LastSeen: now_() };
  if (row) { Object.assign(row, v); writeRow_(rt, row); } else appendRow_(rt, v);
}
function register_(sub) {
  const C = cfg_(), t = Date.now();
  // Blank boxes are filled in from what we know about this Google account.
  if (sub.email) {
    const k = knownPerson_(sub.email, C), was = [];
    if (!sub.discord && k.Discord) { sub.discord = k.Discord; was.push('Discord'); }
    if (!sub.discordId && k.DiscordID) { sub.discordId = k.DiscordID.replace(/[^\d]/g, ''); was.push('Discord ID'); }
    if (!sub.owner && k.Owner) { sub.owner = k.Owner; was.push('owner name'); }
    if (!sub.clubId && k.ClubID) { sub.clubId = k.ClubID.replace(/[^\d]/g, ''); if (!sub.club && k.Club) sub.club = k.Club; was.push('club'); }
    if (!sub.club && k.Club && sub.clubId === norm_(k.ClubID)) sub.club = k.Club;
    if (sub.stars === '' && k.Stars !== undefined && sub.clubId === norm_(k.ClubID)) sub.stars = k.Stars;
    sub.filled = was;
  }
  if (stateGet_()) fail_('Sign-ups are closed: the bracket has been drawn.');
  if (when_(C.SIGNUP_CLOSE, C) && t >= when_(C.SIGNUP_CLOSE, C)) fail_('Sign-ups closed ' + fmtT_(when_(C.SIGNUP_CLOSE, C), C) + '.');
  if (!sub.email) fail_('The form needs your Google sign-in (email) so you can update your entry.');
  if (!sub.discord || !sub.club || !sub.clubId) fail_('We need your ' + [!sub.discord && 'Discord username', !sub.club && 'club name', !sub.clubId && 'club ID'].filter(Boolean).join(', ') + '. We didn\'t have ' + (!sub.discord && !sub.club && !sub.clubId ? 'you' : 'that') + ' on record yet, so fill it in once and next time a blank form is enough.');
  const stars = sub.stars === '' ? '' : Number(sub.stars);
  if (stars !== '' && (isNaN(stars) || stars < 0 || stars > 10)) fail_('Club stars must be a number from 0 to 10.');
  if (stars !== '' && (stars < Number(C.MIN_STARS || 0) || stars > Number(C.MAX_STARS || 10))) fail_('This tournament is for ' + C.MIN_STARS + '–' + C.MAX_STARS + '★ clubs.');
  if (sub.discordId && !/^\d{15,21}$/.test(sub.discordId)) fail_('The Discord user ID is the long number (Discord → Settings → Advanced → Developer Mode, then right-click your name → Copy User ID). Leave it blank if unsure.');
  const et = entrants_(), active = et.rows.filter((r) => r.Status !== 'Withdrawn');
  const mine = et.rows.find((r) => lc_(r.Email) === sub.email);
  const clash = active.find((r) => norm_(r.ClubID) === sub.clubId && r !== mine);
  if (clash) fail_('Club ID ' + sub.clubId + ' is already signed up (' + clash.Discord + ').');
  if (!mine && active.length >= Number(C.MAX_CLUBS || 32)) fail_('The bracket is full (' + C.MAX_CLUBS + ' clubs).');
  // Is it a real club? The public game list answers for any club; a club with no games at all can't play anyway.
  let rows = null; try { rows = clubGames_(sub.clubId); } catch (e) { rows = null; }
  if (rows && !rows.length) fail_('SmallBall shows no games at all for club ID ' + sub.clubId + '. Check the number on your club page.');
  const rec = { Email: sub.email, Discord: sub.discord, DiscordID: sub.discordId || '', Owner: sub.owner, Club: sub.club, ClubID: sub.clubId, Stars: stars, Status: 'In' };
  try { remember_(rec); } catch (e) { }
  const fromRecord = sub.filled && sub.filled.length ? ' *(filled in from your record: ' + sub.filled.join(', ') + ')*' : '';
  if (mine) { Object.assign(mine, rec); writeRow_(et, mine); log_(sub.email, 'Updated', sub.club + ' (' + sub.clubId + ')'); post_('✏️ ' + tag_(mine) + ' updated their entry: ' + clubTxt_(mine) + '.' + fromRecord); }
  else {
    rec.Joined = now_(); appendRow_(et, rec);
    const n = active.length + 1;
    log_(sub.email, 'Signed up', sub.club + ' (' + sub.clubId + ') #' + n);
    post_('🆕 ' + tag_(rec) + ' signs up with ' + clubTxt_(rec) + '. **' + n + ' of ' + Math.max(Number(C.PREVIEW_SIZE) || 16, pow2_(n)) + '** spots filled for the **' + esc_(C.TOURNEY_NAME) + '**.' + fromRecord +
      (when_(C.SIGNUP_CLOSE, C) ? '\n-# Sign-ups close ' + ts_(when_(C.SIGNUP_CLOSE, C)) + ' (' + tsR_(when_(C.SIGNUP_CLOSE, C)) + ').' : '') + linksLine_(C));
  }
  snapshot_();
}
function rejectPost_(sub, msg) {
  const C = cfg_(), who = sub && sub.discordId && /^\d{15,21}$/.test(sub.discordId) ? '<@' + sub.discordId + '> ' : sub && sub.discord ? '**' + esc_(sub.discord) + '** ' : '';
  post_(who + '❌ Your sign-up didn\'t go through.', [{ color: 0xC8102E, title: '❌ Sign-up rejected', description: msg + (norm_(C.FORM_LINK) ? '\n\n🔁 Fix it and send the form again: ' + norm_(C.FORM_LINK) : '') }]);
}

// ===================== Bracket engine (from the SmallBall Tournament Kit) =====================
function seedOrder_(n) { let a = [1]; while (a.length < n) { const m = a.length * 2 + 1, b = []; for (const s of a) b.push(s, m - s); a = b; } return a; }
const pow2_ = (n) => { let p = 1; while (p < n) p *= 2; return Math.max(2, p); };
const roundName_ = (left, kind) => left === 2 ? (kind ? kind + ' final' : 'Final') : left === 4 ? (kind ? kind + ' semifinal' : 'Semifinal') : left === 8 ? (kind ? kind + ' quarterfinal' : 'Quarterfinal') : (kind ? kind + ' r' : 'R') + 'ound of ' + left;
function buildSingle_(clubs, opt) {
  opt = opt || {};
  const n = pow2_(clubs.length), order = seedOrder_(n), M = [], pre = opt.prefix || '';
  let prev = [];
  for (let i = 0; i < n / 2; i++) {
    const sa = order[2 * i], sb = order[2 * i + 1];
    const m = { id: pre + 'R1M' + (i + 1), round: 1, slot: i, a: { club: clubs[sa - 1] != null ? clubs[sa - 1] : BYE }, b: { club: clubs[sb - 1] != null ? clubs[sb - 1] : BYE }, bracket: opt.bracket || 'W' };
    M.push(m); prev.push(m.id);
  }
  let r = 1, left = n;
  M.filter((m) => m.round === 1).forEach((m) => (m.label = roundName_(left, opt.kind) + ' · Match ' + (m.slot + 1)));
  while (prev.length > 1) {
    r++; left /= 2; const next = [];
    for (let i = 0; i < prev.length / 2; i++) {
      const m = { id: pre + 'R' + r + 'M' + (i + 1), round: r, slot: i, a: { from: prev[2 * i], take: 'W' }, b: { from: prev[2 * i + 1], take: 'W' }, bracket: opt.bracket || 'W', label: roundName_(left, opt.kind) + (prev.length > 2 ? ' · Match ' + (i + 1) : '') };
      M.push(m); next.push(m.id);
    }
    prev = next;
  }
  return { matches: M, final: prev[0], rounds: r };
}
function buildDouble_(clubs, reset) {
  const W = buildSingle_(clubs, { bracket: 'W', kind: 'Winners', prefix: 'W' });
  const M = W.matches.slice(), k = W.rounds, wb = (r) => W.matches.filter((m) => m.round === r).map((m) => m.id);
  let cur = [], li = 0;
  const r1 = wb(1);
  for (let i = 0; i < r1.length; i += 2) { const m = { id: 'LR1M' + (++li), round: 1, slot: li - 1, bracket: 'L', a: { from: r1[i], take: 'L' }, b: { from: r1[i + 1], take: 'L' } }; M.push(m); cur.push(m.id); }
  let lround = 1;
  for (let r = 2; r <= k; r++) {
    const drop = wb(r).slice().reverse(), next = []; lround++; li = 0;   // reversed to dodge quick rematches
    for (let i = 0; i < cur.length; i++) { const m = { id: 'LR' + lround + 'M' + (++li), round: lround, slot: li - 1, bracket: 'L', a: { from: cur[i], take: 'W' }, b: { from: drop[i], take: 'L' } }; M.push(m); next.push(m.id); }
    cur = next;
    if (cur.length > 1) {
      lround++; li = 0; const nx = [];
      for (let i = 0; i < cur.length; i += 2) { const m = { id: 'LR' + lround + 'M' + (++li), round: lround, slot: li - 1, bracket: 'L', a: { from: cur[i], take: 'W' }, b: { from: cur[i + 1], take: 'W' } }; M.push(m); nx.push(m.id); }
      cur = nx;
    }
  }
  const lTotal = lround;
  M.filter((m) => m.bracket === 'L').forEach((m) => { const left = M.filter((x) => x.bracket === 'L' && x.round === m.round).length; m.label = m.round === lTotal ? 'Losers final' : 'Losers round ' + m.round + (left > 1 ? ' · Match ' + (m.slot + 1) : ''); });
  M.push({ id: 'GF', round: 1, slot: 0, bracket: 'F', label: 'Grand final', a: { from: W.final, take: 'W' }, b: { from: cur[0], take: 'W' } });
  if (reset) M.push({ id: 'GF2', round: 2, slot: 0, bracket: 'F', label: 'Grand final, reset', resetOf: 'GF', a: { from: 'GF', take: 'W' }, b: { from: 'GF', take: 'L' } });
  return { matches: M, final: reset ? 'GF2' : 'GF', wRounds: k, lRounds: lTotal };
}
function sideClub_(T, side) {
  if (!side) return null;
  if (side.club != null) return side.club;
  const m = T.matches.find((x) => x.id === side.from); if (!m || !m.winner) return null;
  return side.take === 'L' ? m.loser : m.winner;
}
// Byes advance; a reset final is dropped when the winners-bracket champ wins the first grand final.
function settle_(T) {
  for (let pass = 0; pass < 60; pass++) {
    let changed = false;
    for (const m of T.matches) {
      if (m.winner || m.void) continue;
      if (m.resetOf) { const gf = T.matches.find((x) => x.id === m.resetOf); if (gf && gf.winner && gf.winner === sideClub_(T, gf.a)) { m.void = true; changed = true; continue; } }
      // A losers-bracket slot fed by a bye's "loser" is empty: the other side walks through.
      const a = sideClub_(T, m.a), b = sideClub_(T, m.b);
      if (a == null || b == null) continue;
      if (a === BYE || b === BYE) { m.winner = a === BYE ? b : a; m.loser = a === BYE ? a : b; m.bye = true; changed = true; }
    }
    if (!changed) break;
  }
}
function champion_(T) {
  if (T.fmt === 'double') {
    const gf = T.matches.find((m) => m.id === 'GF'), f2 = T.matches.find((m) => m.id === 'GF2');
    if (!gf || !gf.winner) return null;
    if (!f2) return gf.winner;
    if (f2.void) return gf.winner;
    return f2.winner || null;
  }
  const f = T.matches.find((m) => m.id === T.final); return f && f.winner > 0 ? f.winner : null;
}
function seededEntrants_(entrants, C) {
  const how = lc_(C.SEEDING), e = entrants.slice();
  if (how === 'stars') e.sort((a, b) => (Number(b.Stars) || 0) - (Number(a.Stars) || 0) || new Date(a.Joined) - new Date(b.Joined));
  else e.sort((a, b) => new Date(a.Joined) - new Date(b.Joined));   // random seeding: the preview shows sign-up order
  return e;
}
function createTournament_(entrants, C) {
  const how = lc_(C.SEEDING), e = entrants.slice();
  if (how === 'stars') e.sort((a, b) => (Number(b.Stars) || 0) - (Number(a.Stars) || 0) || new Date(a.Joined) - new Date(b.Joined));
  else if (how === 'random') { for (let i = e.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const x = e[i]; e[i] = e[j]; e[j] = x; } }
  else e.sort((a, b) => new Date(a.Joined) - new Date(b.Joined));
  const clubs = e.map((x) => Number(x.ClubID));
  let fmt = lc_(C.FORMAT) === 'single' ? 'single' : 'double';
  if (fmt === 'double' && clubs.length < 3) fmt = 'single';
  const T = { fmt, seeds: e.map((x, i) => ({ club: Number(x.ClubID), seed: i + 1 })), created: Date.now(), wave: 0, matches: [], final: null };
  Object.assign(T, fmt === 'double' ? buildDouble_(clubs, lc_(C.GRAND_FINAL_RESET) !== 'no') : buildSingle_(clubs, {}));
  settle_(T);
  return T;
}

// ===================== State =====================
function stateGet_() {
  const v = sheet_(SHEETS.STATE).getRange(1, 1).getValue();
  if (!v) return null; try { return JSON.parse(v); } catch (e) { return null; }
}
function stateSet_(T) { sheet_(SHEETS.STATE).getRange(1, 1).setValue(T ? JSON.stringify(T) : ''); }
function entrantMap_() { const m = {}; entrants_().rows.forEach((r) => { if (r.Status !== 'Withdrawn') m[Number(r.ClubID)] = r; }); return m; }
const seedOf_ = (T, club) => { const s = T.seeds.find((x) => x.club === club); return s ? s.seed : 99; };
function nameOf_(E, T, club) { const e = E[club]; return e ? '#' + seedOf_(T, club) + ' ' + tag_(e) + ' (*' + esc_(e.Club) + '*)' : 'TBD'; }
function plainName_(E, club) { const e = E[club]; return e ? norm_(e.Club) : 'TBD'; }

// ===================== SmallBall =====================
function clubGames_(clubId) {
  const r = UrlFetchApp.fetch('https://play.smallball.com/games/all?club=' + encodeURIComponent(clubId), { muteHttpExceptions: true, headers: { Accept: 'application/json' } });
  if (r.getResponseCode() !== 200) throw new Error('SmallBall answered ' + r.getResponseCode());
  return (JSON.parse(r.getContentText()).rows || []);
}
const watchUrl_ = (gid) => 'https://play.smallball.com/training?watch=' + gid;

// ===================== The clock: runs every minute =====================
// Free Google accounts get about 90 minutes of trigger run time a day, shared by every script you own (Hold the
// Hill too). So the clock wakes every minute but only works when something is due: it writes down when that
// is (NEXT_AT) and goes straight back to sleep until then. Reading one script property costs almost nothing.
function tick() {
  const pr = PropertiesService.getScriptProperties();
  const nextAt = Number(pr.getProperty('NEXT_AT') || 0), retries = pr.getProperty('RETRY_POSTS');
  if (Date.now() < nextAt && (!retries || retries === '[]')) return;
  const lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) return;
  try {
    CFG_CACHE = null;
    try { flushRetries_(); } catch (e) { log_('system', 'ERROR (retries)', String(e && e.stack || e)); }
    const C = cfg_(), t = Date.now();
    let T = stateGet_();
    if (!T) {
      const close = when_(C.SIGNUP_CLOSE, C);
      if (close && t >= close) drawBracket_();
      try { flushLog_(); } catch (e) { }
      T = stateGet_();
      // Sign-ups snapshot themselves as they come in; nothing else happens until sign-ups close.
      if (!T) { pr.setProperty('NEXT_AT', String(close && t < close ? Math.min(close, t + 30 * 60000) : t + 5 * 60000)); return; }
    }
    if (T.done) { try { flushLog_(); } catch (e) { } pr.setProperty('NEXT_AT', String(t + 6 * 3600e3)); return; }
    let changed = false;
    try { changed = detect_(T, C) || changed; } catch (e) { log_('system', 'ERROR (detect)', String(e && e.stack || e)); }
    changed = postDue_(T, C) || changed;
    changed = deadlines_(T, C) || changed;
    changed = waves_(T, C) || changed;
    if (!T.done && champion_(T)) { crown_(T, C); changed = true; }
    if (changed) stateSet_(T);
    if (changed || !pr.getProperty('NEXT_AT')) snapshot_(T);
    try { flushLog_(); } catch (e) { }
    pr.setProperty('NEXT_AT', String(nextWork_(T, C)));
  } finally { lock.releaseLock(); }
}
// When the clock next has something to do: a wave starting, a result airing, a deadline, or (while a match
// is open with no game found yet) a look at SmallBall every 2 minutes.
function nextWork_(T, C) {
  const t = Date.now(), soon = [t + 30 * 60000];
  if (T.done) return t + 6 * 3600e3;
  const w = currentWave_(C, t); soon.push(waveStart_(C, Math.max(1, w + 1)));
  for (const m of T.matches) {
    if (m.winner || m.void) continue;
    if (m.pend) soon.push(m.pend.airs);
    else if (m.openAt && !m.flag) { soon.push(t + 2 * 60000); soon.push(m.deadline); }
  }
  return Math.max(t + 50000, Math.min.apply(null, soon.filter((x) => x > t - 1)));
}
// Anything that changes the tournament from outside the clock wakes it on its next minute.
function wake_() { try { PropertiesService.getScriptProperties().deleteProperty('NEXT_AT'); } catch (e) { } }
function waveStart_(C, w) { return when_(C.START, C) + (w - 1) * waveMs_(C); }
function waveMs_(C) { return Math.max(15, Number(C.WAVE_MINUTES) || 60) * 60000; }
function currentWave_(C, t) { const s = when_(C.START, C); return t < s ? 0 : Math.floor((t - s) / waveMs_(C)) + 1; }

function drawBracket_() {
  const C = cfg_(), E = entrants_().rows.filter((r) => r.Status !== 'Withdrawn' && norm_(r.ClubID));
  if (E.length < 2) {
    if (!PropertiesService.getScriptProperties().getProperty('TOO_FEW_POSTED')) {
      PropertiesService.getScriptProperties().setProperty('TOO_FEW_POSTED', '1');
      post_('😬 Only ' + E.length + ' club' + (E.length === 1 ? '' : 's') + ' signed up for the **' + esc_(C.TOURNEY_NAME) + '**, so there\'s no bracket yet. Sign-ups stay open: as soon as a second club joins, the bracket is drawn.' + linksLine_(C));
    }
    return;
  }
  const T = createTournament_(E, C);
  stateSet_(T);
  const et = entrants_(); et.rows.forEach((r) => { const s = T.seeds.find((x) => x.club === Number(r.ClubID)); if (s) { r.Seed = s.seed; writeRow_(et, r); } });
  try { if (norm_(C.FORM_ID)) FormApp.openById(norm_(C.FORM_ID)).setAcceptingResponses(false).setCustomClosedFormMessage('Sign-ups are closed. Follow the bracket in Discord!'); } catch (e) { }
  log_('system', 'Bracket drawn', T.seeds.length + ' clubs · ' + T.fmt);
  const Em = entrantMap_(), start = when_(C.START, C);
  const firsts = T.matches.filter((m) => !m.winner && !m.void && sideClub_(T, m.a) > 0 && sideClub_(T, m.b) > 0);
  post_('# 🏆 The ' + esc_(C.TOURNEY_NAME) + ' bracket is set!\n' +
    '**' + T.seeds.length + ' clubs · ' + (T.fmt === 'double' ? 'double elimination (two losses and you\'re out)' : 'single elimination') + ' · BigLeague games only**\n\n' +
    '**Seeds**\n' + T.seeds.map((s) => s.seed + '. ' + tag_(Em[s.club]) + ' · ' + clubTxt_(Em[s.club])).join('\n') + '\n\n' +
    '**How it works**\n> Matches go in waves of ' + Math.round(waveMs_(C) / 60000) + ' minutes, starting ' + ts_(start) + ' (' + tsR_(start) + ').\n' +
    '> When your match opens you\'ll be tagged here. Start a **BigLeague** game against your opponent\'s club ID before the wave ends: either club can start it.\n' +
    '> The script finds the game on SmallBall by itself. Results post once the game has aired: **no spoilers**.\n' +
    '> No game by the end of the wave: ' + (lc_(C.NO_SHOW) === 'commish' ? 'the organizer decides.' : 'the higher seed moves on.') + ' A tie: ' + (lc_(C.TIE_RULE) === 'higher seed' ? 'the higher seed moves on.' : 'play it again.') + '\n\n' +
    '**Wave 1** (' + firsts.length + ' match' + (firsts.length === 1 ? '' : 'es') + '):\n' + firsts.map((m) => '• ' + nameOf_(Em, T, sideClub_(T, m.a)) + ' vs ' + nameOf_(Em, T, sideClub_(T, m.b))).join('\n') +
    (T.matches.some((m) => m.bye && m.bracket === 'W' && m.round === 1) ? '\n-# Top seeds with a bye wait for the next wave.' : '') + linksLine_(C));
}

// Open the matches that are ready, at each wave's start. A match opens only once both clubs are known
// from results already posted (so nobody learns a result early from the bracket).
function waves_(T, C) {
  const t = Date.now(), w = currentWave_(C, t);
  if (!w || w <= (T.wave || 0)) return false;
  const ws = waveStart_(C, w), end = ws + waveMs_(C), E = entrantMap_(), opened = [];
  for (const m of T.matches) {
    if (m.winner || m.void || m.openAt) continue;
    const a = sideClub_(T, m.a), b = sideClub_(T, m.b);
    if (!(a > 0 && b > 0)) continue;
    m.openAt = ws; m.deadline = Math.max(end, t + waveMs_(C) * 0.75); m.wave = w; opened.push(m);   // opened late (a slow trigger)? still a fair window
  }
  T.wave = w;
  const live = T.matches.filter((m) => m.openAt && !m.winner && !m.void && m.wave < w);
  if (!opened.length && !live.length) return true;
  const line = (m) => {
    const a = sideClub_(T, m.a), b = sideClub_(T, m.b);
    return '**' + esc_(m.label) + '**\n> ' + nameOf_(E, T, a) + ' · club ID `' + a + '`\n> vs ' + nameOf_(E, T, b) + ' · club ID `' + b + '`';
  };
  const due = opened.length ? opened[0].deadline : end;
  post_('## 🔔 Wave ' + w + ' is on! Play before ' + ts_(due) + ' (' + tsR_(due) + ')\n' +
    (opened.length ? opened.map(line).join('\n') : '*No new matches this wave.*') +
    (live.length ? '\n\n⏳ Still to play: ' + live.map((m) => esc_(m.label)).join(', ') : '') +
    '\n-# Start a BigLeague game against your opponent\'s club ID. Either club can start it. The script finds it on SmallBall.' + linksLine_(C));
  log_('system', 'Wave ' + w, opened.map((m) => m.id).join(', ') || 'nothing new');
  return true;
}

// Find each open match's game on SmallBall. The result is held until the game has aired.
function detect_(T, C) {
  const open = T.matches.filter((m) => m.openAt && !m.winner && !m.void && !m.pend && !m.flag);
  if (!open.length) return false;
  const kinds = norm_(C.ALLOWED_KINDS || 'big').split(',').map(lc_).filter(String), E = entrantMap_();
  let changed = false;
  for (const m of open) {
    const a = sideClub_(T, m.a), b = sideClub_(T, m.b);
    let rows; try { rows = clubGames_(a); } catch (e) { log_('system', 'SmallBall error', String(e.message || e)); continue; }
    const used = [].concat.apply([], T.matches.map((x) => x.used || []));   // a game counts for one match only
    const hits = rows.filter((g) => {
      const ft = Date.parse(g.finished_at), ids = [String(g.away_team_id), String(g.home_team_id)];
      return ids.indexOf(String(a)) >= 0 && ids.indexOf(String(b)) >= 0 && kinds.indexOf(lc_(g.kind)) >= 0 &&
        ft >= m.openAt - 120000 && ft <= m.deadline && used.indexOf(String(g.game_id)) < 0 && g.away_runs != null && g.home_runs != null;
    }).sort((x, y) => Date.parse(x.finished_at) - Date.parse(y.finished_at));
    if (!hits.length) continue;
    const g = hits[0], aAway = String(g.away_team_id) === String(a);
    const ra = Number(aAway ? g.away_runs : g.home_runs), rb = Number(aAway ? g.home_runs : g.away_runs);
    const airs = Date.parse(g.finished_at) + Math.max(0, Number(C.POST_DELAY_MINUTES) || 0) * 60000;
    m.pend = { gid: String(g.game_id), ra, rb, airs };
    m.used = (m.used || []).concat(String(g.game_id));   // this match's own games (the global list is built fresh each time)
    log_('system', 'Game found', m.id + ' game ' + g.game_id);
    post_('📡 **Game found** for ' + esc_(m.label) + ': ' + esc_(plainName_(E, a)) + ' vs ' + esc_(plainName_(E, b)) + ' · game `' + g.game_id + '`. The result posts ' + ts_(airs) + ', once it has aired. (No score here: no spoilers.)\n📺 Watch it live: <' + watchUrl_(g.game_id) + '>');
    changed = true;
  }
  return changed;
}

// Results whose game has aired: post them and move the bracket on.
function postDue_(T, C) {
  const t = Date.now(), E = entrantMap_();
  let changed = false;
  for (const m of T.matches) {
    if (!m.pend || m.pend.airs > t || m.winner) continue;
    const a = sideClub_(T, m.a), b = sideClub_(T, m.b), p = m.pend;
    if (p.ra === p.rb) {
      m.pend = null;
      if (lc_(C.TIE_RULE) === 'higher seed') { finish_(T, m, seedOf_(T, a) < seedOf_(T, b) ? a : b, p, 'tie'); post_(resultText_(T, m, E, C, '🤝 A ' + p.ra + '–' + p.rb + ' tie, so the higher seed moves on.')); }
      else {
        m.deadline = Math.max(m.deadline, t + 30 * 60000);
        post_('🤝 **' + esc_(m.label) + '** ended in a **' + p.ra + '–' + p.rb + ' tie** (game `' + p.gid + '`). Play it again: ' + nameOf_(E, T, a) + ' vs ' + nameOf_(E, T, b) + '. New deadline ' + ts_(m.deadline) + '.' + linksLine_(C));
      }
      changed = true; continue;
    }
    finish_(T, m, p.ra > p.rb ? a : b, p, '');
    post_(resultText_(T, m, E, C, ''));
    changed = true;
  }
  return changed;
}
function finish_(T, m, winner, p, how) {
  const a = sideClub_(T, m.a), b = sideClub_(T, m.b);
  m.winner = winner; m.loser = winner === a ? b : a; m.how = how || '';
  if (p) { m.gid = p.gid; m.score = winner === a ? [p.ra, p.rb] : [p.rb, p.ra]; }
  m.pend = null; m.doneAt = Date.now();
  settle_(T);
  log_('system', 'Result', m.id + ': ' + winner + ' over ' + m.loser + (m.score ? ' ' + m.score.join('-') : '') + (how ? ' (' + how + ')' : ''));
}
function lossesOf_(T, club) { return T.matches.filter((m) => m.loser === club && !m.bye).length; }
function resultText_(T, m, E, C, note) {
  const w = m.winner, l = m.loser, out = T.fmt === 'double' ? lossesOf_(T, l) >= 2 || m.id === 'GF2' || (m.id === 'GF' && T.matches.find((x) => x.id === 'GF2' && x.void)) : true;
  let s = '🏆 **' + esc_(m.label) + '**: ' + nameOf_(E, T, w) + ' beats ' + nameOf_(E, T, l) + (m.score ? ' **' + m.score[0] + '–' + m.score[1] + '**' : '') + (m.gid ? ' · game `' + m.gid + '`' : '') + '.';
  if (note) s += '\n' + note;
  if (m.id === 'GF' && T.matches.find((x) => x.id === 'GF2' && !x.void && !x.winner)) s += '\n🔥 The losers-bracket champ wins the first grand final! **Bracket reset:** one more game decides it all.';
  else if (out && !champion_(T)) s += '\n💀 ' + esc_(plainName_(E, l)) + ' is out.' ;
  else if (!out && T.fmt === 'double') s += '\n⬇️ ' + esc_(plainName_(E, l)) + ' drops to the losers bracket.';
  const next = T.matches.find((x) => !x.winner && !x.void && (sideClub_(T, x.a) === w || sideClub_(T, x.b) === w));
  if (next && !champion_(T)) s += '\n➡️ ' + esc_(plainName_(E, w)) + ' plays next in the **' + esc_(next.label) + '**, which opens at the next wave.';
  return s + linksLine_(C);
}

// The end of a wave: no game, no result.
function deadlines_(T, C) {
  const t = Date.now(), E = entrantMap_();
  let changed = false;
  for (const m of T.matches) {
    if (!m.openAt || m.winner || m.void || m.pend || m.flag || t < m.deadline) continue;
    const a = sideClub_(T, m.a), b = sideClub_(T, m.b);
    if (lc_(C.NO_SHOW) === 'commish') {
      m.flag = true; changed = true;
      post_('⏰ **' + esc_(m.label) + '**: no game between ' + esc_(plainName_(E, a)) + ' and ' + esc_(plainName_(E, b)) + ' this wave. The organizer will decide.');
      log_('system', 'No-show (commish)', m.id);
      continue;
    }
    const w = seedOf_(T, a) < seedOf_(T, b) ? a : b;
    finish_(T, m, w, null, 'no-show');
    post_(resultText_(T, m, E, C, '⏰ No game was played before the deadline, so the higher seed moves on.'));
    changed = true;
  }
  return changed;
}
function crown_(T, C) {
  const E = entrantMap_(), c = champion_(T); T.done = Date.now();
  const runner = (() => { const f = T.matches.filter((m) => m.bracket === 'F' || m.id === T.final).filter((m) => m.winner && !m.void).pop(); return f ? f.loser : null; })();
  const lossless = lossesOf_(T, c) === 0;
  post_('# 👑 ' + esc_(plainName_(E, c)) + ' wins the ' + esc_(C.TOURNEY_NAME) + '!\n' +
    tag_(E[c]) + ' (#' + seedOf_(T, c) + ' seed) takes it' + (lossless ? ' without a single loss' : ' the hard way, out of the losers bracket') + '. 🎉' +
    (runner ? '\n🥈 Runner-up: ' + tag_(E[runner]) + ' (*' + esc_(plainName_(E, runner)) + '*)' : '') +
    (norm_(C.PRIZES) ? '\n🎁 Prizes: ' + esc_(C.PRIZES) : '') + '\nThanks for playing, everybody! 🐶' + linksLine_(C));
  log_('system', 'Champion', String(c));
}

// ===================== The live bracket: a snapshot the web page reads =====================
function snapshot_(T) {
  T = T || stateGet_();
  const C = cfg_(), E = entrantMap_(), et = entrants_().rows.filter((r) => r.Status !== 'Withdrawn');
  const club = (id) => { if (!(id > 0)) return null; const e = E[id]; return e ? { id, n: norm_(e.Club), o: norm_(e.Discord), s: T ? seedOf_(T, id) : 0, st: norm_(e.Stars) } : { id, n: 'Club ' + id }; };
  const snap = {
    name: norm_(C.TOURNEY_NAME), updated: Date.now(), prizes: norm_(C.PRIZES), form: norm_(C.FORM_LINK),
    signupClose: when_(C.SIGNUP_CLOSE, C), start: when_(C.START, C), waveMin: Math.round(waveMs_(C) / 60000), tz: tz_(C),
    entrants: et.map((r) => ({ n: norm_(r.Club), o: norm_(r.Discord), id: Number(r.ClubID), st: norm_(r.Stars) })),
  };
  if (!T) {
    // The bracket we're aiming for: today's sign-ups in seed order, the rest "open spots". Placeholders are -1000-k.
    const ord = seededEntrants_(et, C), size = Math.max(Number(C.PREVIEW_SIZE) || 16, pow2_(ord.length));
    const ids = ord.map((r) => Number(r.ClubID)); for (let k = ids.length; k < size; k++) ids.push(-1000 - k);
    const P = lc_(C.FORMAT) === 'single' ? buildSingle_(ids, {}) : buildDouble_(ids, lc_(C.GRAND_FINAL_RESET) !== 'no');
    const Tp = { seeds: ids.map((c, i) => ({ club: c, seed: i + 1 })), matches: P.matches };
    const pc = (id) => id == null ? null : id <= -1000 ? { id, n: 'Open spot', s: -999 - id, open: true } : (() => { const e = E[id]; return e ? { id, n: norm_(e.Club), o: norm_(e.Discord), s: seedOf_(Tp, id), st: norm_(e.Stars) } : null; })();
    // Put the live bracket's link on the sign-up form once the web app is deployed.
    try { const url = boardUrl_(C), pr = PropertiesService.getScriptProperties();
      if (url && norm_(C.FORM_ID) && pr.getProperty('FORM_LINKED') !== url) { FormApp.openById(norm_(C.FORM_ID)).setDescription(FORM_DESC + '\n\n📋 The bracket preview and who\'s in: ' + url); pr.setProperty('FORM_LINKED', url); } } catch (e) { }
    snap.preview = { size, filled: ord.length, fmt: lc_(C.FORMAT) === 'single' ? 'single' : 'double', seeding: lc_(C.SEEDING) || 'signup',
      matches: P.matches.map((m) => ({ id: m.id, b: m.bracket, r: m.round, l: m.label, a: pc(sideClub_(Tp, m.a)), z: pc(sideClub_(Tp, m.b)), v: false })) };
  }
  if (T) {
    snap.fmt = T.fmt; snap.wave = T.wave || 0; snap.done = !!T.done; snap.champ = T.done ? club(champion_(T)) : null;
    snap.seeds = T.seeds.map((s) => club(s.club));
    // Only what Discord has been told: a match's winner shows once its result posted; a pending game shows as "game found".
    snap.matches = T.matches.map((m) => ({ id: m.id, b: m.bracket, r: m.round, l: m.label, a: club(sideClub_(T, m.a)), z: club(sideClub_(T, m.b)),
      byeA: sideClub_(T, m.a) === BYE, byeZ: sideClub_(T, m.b) === BYE, w: m.winner > 0 ? m.winner : null, sc: m.score || null, how: m.how || '', bye: !!m.bye, v: !!m.void,
      open: !!m.openAt && !m.winner && !m.void, dl: m.deadline || 0, g: m.pend ? m.pend.gid : (m.gid || ''), live: !!m.pend, flag: !!m.flag }));
  }
  sheet_(SHEETS.BOARD).getRange(1, 1).setValue(JSON.stringify(snap));
  ghPush_(snap);
  // A readable Matches tab for the organizer.
  if (T) {
    const sh = sheet_(SHEETS.MATCHES, ['ID', 'Match', 'Club A', 'Club B', 'Status', 'Winner', 'Score', 'Game', 'Opens', 'Deadline']);
    const rows = T.matches.filter((m) => !m.void).map((m) => { const a = sideClub_(T, m.a), b = sideClub_(T, m.b);
      return [m.id, m.label, a > 0 ? plainName_(E, a) : a === BYE ? 'bye' : 'TBD', b > 0 ? plainName_(E, b) : b === BYE ? 'bye' : 'TBD',
        m.winner ? (m.bye ? 'Bye' : m.how ? 'Done (' + m.how + ')' : 'Done') : m.flag ? 'Needs the organizer' : m.pend ? 'Game found, airing' : m.openAt ? 'Open' : 'Waiting',
        m.winner > 0 ? plainName_(E, m.winner) : '', m.score ? m.score.join('-') : '', m.pend ? m.pend.gid : m.gid || '', m.openAt ? new Date(m.openAt) : '', m.deadline ? new Date(m.deadline) : '']; });
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 10).clearContent();
    if (rows.length) sh.getRange(2, 1, rows.length, 10).setValues(rows);
  }
}


// ===================== The bracket on GitHub Pages =====================
// The token lives in Script Properties (never on a tab). Each change to the bracket is saved as one small JSON
// file in the repo; the page next to it reads that file. Nothing is sent when the bracket hasn't changed.
function ghPush_(snap, force) {
  const pr = PropertiesService.getScriptProperties(), tok = pr.getProperty('GITHUB_TOKEN');
  if (!tok) return false;
  const C = cfg_(), repo = norm_(C.GITHUB_REPO) || 'slipnsliders/smallball-tools', path = norm_(C.GITHUB_PATH) || 'docs/brawl/bracket.json';
  const body = JSON.stringify(snap), key = JSON.stringify(Object.assign({}, snap, { updated: 0 }));
  const hash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, key + repo + path, Utilities.Charset.UTF_8));
  if (!force && pr.getProperty('GH_HASH') === hash) return true;
  const api = 'https://api.github.com/repos/' + repo + '/contents/' + path.split('/').map(encodeURIComponent).join('/');
  const headers = { Authorization: 'Bearer ' + tok, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  for (let attempt = 0; attempt < 2; attempt++) {
    let sha = null;
    const g = UrlFetchApp.fetch(api, { headers, muteHttpExceptions: true });
    if (g.getResponseCode() === 200) try { sha = JSON.parse(g.getContentText()).sha; } catch (e) { }
    else if (g.getResponseCode() !== 404) { log_('system', 'GitHub read failed', g.getResponseCode() + ' ' + g.getContentText().slice(0, 200)); return false; }
    const payload = { message: 'Bracket update: ' + (snap.name || 'tournament'), content: Utilities.base64Encode(body, Utilities.Charset.UTF_8) };
    if (sha) payload.sha = sha;
    const r = UrlFetchApp.fetch(api, { method: 'put', headers, contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true });
    const code = r.getResponseCode();
    if (code === 200 || code === 201) { pr.setProperty('GH_HASH', hash); return true; }
    if (code !== 409 && code !== 422) { log_('system', 'GitHub save failed', code + ' ' + r.getContentText().slice(0, 200)); return false; }
  }
  return false;
}
function ghPageUrl_(C) {
  const repo = (norm_(C.GITHUB_REPO) || 'slipnsliders/smallball-tools').split('/'), path = norm_(C.GITHUB_PATH) || 'docs/brawl/bracket.json';
  const dir = path.replace(/^docs\//, '').replace(/[^/]*$/, '');
  return 'https://' + repo[0].toLowerCase() + '.github.io/' + repo[1] + '/' + dir;
}
function adminConnectGithub() {
  withUi_((ui) => {
    const r = ui.prompt('Connect the GitHub bracket page',
      'Paste a GitHub fine-grained token with "Contents: Read and write" on ' + (norm_(cfg_().GITHUB_REPO) || 'slipnsliders/smallball-tools') + ' only.\n' +
      'It is kept in the script\'s private settings, not on any tab. Leave it blank and click OK to disconnect.', ui.ButtonSet.OK_CANCEL);
    if (r.getSelectedButton() !== ui.Button.OK) return '';
    const pr = PropertiesService.getScriptProperties(), tok = norm_(r.getResponseText());
    if (!tok) { pr.deleteProperty('GITHUB_TOKEN'); pr.deleteProperty('GH_HASH'); return 'GitHub disconnected.'; }
    pr.setProperty('GITHUB_TOKEN', tok); pr.deleteProperty('GH_HASH');
    const C = cfg_(), url = ghPageUrl_(C);
    snapshot_(stateGet_());
    if (!pr.getProperty('GH_HASH')) return 'GitHub didn\'t accept that token. Check it has Contents: Read and write on the repo, then try again (the Log tab has the details).';
    setCfg_('BOARD_LINK', url);
    snapshot_(stateGet_());   // so the form's description picks up the new link
    return 'Connected! The live bracket is at ' + url + ' (give GitHub a minute the first time). Discord posts now link there.';
  });
}

// ===================== Web page =====================
function doGet(e) {
  const demo = e && e.parameter && e.parameter.demo;
  let snap = demo ? demoSnap_() : null;
  if (!snap) { const v = sheet_(SHEETS.BOARD).getRange(1, 1).getValue(); try { snap = JSON.parse(v || '{}'); } catch (x) { snap = {}; } }
  const safe = JSON.stringify(snap).replace(/</g, '\\u003c');
  const html = BRACKET_HTML_.replace('__DATA__', function () { return safe; });   // a function, so "$" in names stays as is
  return HtmlService.createHtmlOutput(html).setTitle((snap.name || 'SmallBall Tournament') + ' · bracket')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ===================== Organizer menu =====================
function onOpen() {
  SpreadsheetApp.getUi().createMenu('🏆 Tournament')
    .addItem('Set up / repair (form, tabs, triggers)', 'setup')
    .addItem('🔄 Check SmallBall now', 'adminCheckNow')
    .addItem('✅ Settle a match by hand', 'adminSettle')
    .addItem('↩️ Undo a match result', 'adminUndo')
    .addItem('📣 Post the bracket to Discord', 'adminPostBracket')
    .addItem('🎲 Draw the bracket now (close sign-ups early)', 'adminDrawNow')
    .addItem('🧪 Test the Discord webhook', 'adminTestWebhook')
    .addItem('🐙 Connect the GitHub bracket page', 'adminConnectGithub')
    .addSeparator()
    .addItem('🧹 Start over (clear the bracket, keep sign-ups)', 'adminResetBracket')
    .addToUi();
}
function withUi_(fn) {
  const ui = SpreadsheetApp.getUi();
  try { const msg = fn(ui); if (msg) ui.alert(msg); } catch (e) { ui.alert('Problem: ' + (e.message || e)); }
}
function setup() {
  const ss = ss_(); PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  const sh = sheet_(SHEETS.CONFIG, ['Key', 'Value', 'Notes']), have = {};
  sh.getRange('B:B').setNumberFormat('@');   // keep times as typed (before writing them)
  sh.getDataRange().getValues().slice(1).forEach((r) => { have[norm_(r[0])] = true; });
  Object.keys(DEFAULTS).forEach((k) => { if (!have[k]) sh.appendRow([k, DEFAULTS[k][0], DEFAULTS[k][1]]); });
  sheet_(SHEETS.ENTRANTS, ENTRANT_COLS).getRange('C:C').setNumberFormat('@');
  [SHEETS.MATCHES, SHEETS.LOG, SHEETS.STATE, SHEETS.BOARD].forEach((n) => sheet_(n, n === SHEETS.LOG ? ['Time', 'Actor', 'Action', 'Details'] : null));
  sheet_(SHEETS.ROSTER, ROSTER_COLS).getRange('C:C').setNumberFormat('@');
  CFG_CACHE = null; const C = cfg_();
  // The sign-up form
  let form = null;
  try { if (norm_(C.FORM_ID)) form = FormApp.openById(norm_(C.FORM_ID)); } catch (e) { form = null; }
  if (!form) {
    form = FormApp.create(norm_(C.TOURNEY_NAME) + ' · sign-up');
    form.setDescription(FORM_DESC)
      .setCollectEmail(true).setAllowResponseEdits(true).setLimitOneResponsePerUser(false)
      .setConfirmationMessage('Got it! Watch the tournament channel in Discord: your sign-up shows there within a minute (or a red ❌ if something needs fixing).');
    form.addTextItem().setTitle(Q.DISCORD);
    form.addTextItem().setTitle(Q.DISCORD_ID).setHelpText('Discord → Settings → Advanced → Developer Mode on, then right-click your name → Copy User ID. A long number. Optional.');
    form.addTextItem().setTitle(Q.OWNER);
    form.addTextItem().setTitle(Q.CLUB);
    form.addTextItem().setTitle(Q.CLUB_ID).setHelpText('The number on your club page.');
    form.addTextItem().setTitle(Q.STARS).setHelpText('Optional, for seeding and the bracket.');
    try { form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId()); } catch (e) { }
    setCfg_('FORM_ID', form.getId());
    if (!norm_(C.FORM_LINK)) setCfg_('FORM_LINK', form.getPublishedUrl());
  }
  // Returning players: every box optional (blank = from your record). Also brings an older form up to date.
  try { form.setDescription(FORM_DESC).setCollectEmail(true); form.getItems(FormApp.ItemType.TEXT).forEach((it) => it.asTextItem().setRequired(false)); } catch (e) { }
  // Triggers: the form, and the one-minute clock
  ScriptApp.getProjectTriggers().forEach((t) => { if (['onTourneyFormSubmit', 'tick'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('onTourneyFormSubmit').forForm(form).onFormSubmit().create();
  ScriptApp.newTrigger('tick').timeBased().everyMinutes(1).create();
  wake_();
  log_('organizer', 'Setup', 'Form ' + form.getId());
  snapshot_();
  try { SpreadsheetApp.getUi().alert('Set up ✅\n\nSign-up form: ' + form.getPublishedUrl() + '\n\nNext: paste your Discord webhook into Config, then Deploy → New deployment → Web app for the live bracket.'); } catch (e) { }
}
function adminCheckNow() { withUi_(() => { wake_(); tick(); const T = stateGet_(); return T ? 'Checked. Wave ' + (T.wave || 0) + (T.done ? ' · finished' : '') + '. See the Matches tab.' : 'Checked. No bracket yet: it\'s drawn when sign-ups close.'; }); }
function adminDrawNow() { withUi_((ui) => { if (stateGet_()) return 'The bracket is already drawn.'; if (ui.alert('Close sign-ups and draw the bracket now?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return ''; drawBracket_(); snapshot_(); return stateGet_() ? 'Bracket drawn and posted.' : 'Not enough clubs yet.'; }); }
function adminPostBracket() { withUi_(() => { const T = stateGet_(); if (!T) return 'No bracket yet.'; post_(bracketText_(T)); return 'Posted.'; }); }
function bracketText_(T) {
  const C = cfg_(), E = entrantMap_(), L = ['🗂️ **' + esc_(C.TOURNEY_NAME) + ' · where it stands**'];
  const sec = (title, list) => { if (!list.length) return; L.push('\n**' + title + '**'); list.forEach((m) => { const a = sideClub_(T, m.a), b = sideClub_(T, m.b);
    L.push((m.winner ? '✅ ' : m.openAt ? '🔴 ' : '▫️ ') + esc_(m.label) + ': ' + (a > 0 ? esc_(plainName_(E, a)) : 'TBD') + ' vs ' + (b > 0 ? esc_(plainName_(E, b)) : 'TBD') + (m.winner > 0 ? ' → **' + esc_(plainName_(E, m.winner)) + '**' + (m.score ? ' ' + m.score.join('–') : '') : '')); }); };
  const real = T.matches.filter((m) => !m.void && !m.bye);
  sec('Winners bracket', real.filter((m) => m.bracket === 'W'));
  sec('Losers bracket', real.filter((m) => m.bracket === 'L'));
  sec('Grand final', real.filter((m) => m.bracket === 'F'));
  return L.join('\n') + linksLine_(C);
}
function adminSettle() {
  withUi_((ui) => {
    const T = stateGet_(); if (!T) return 'No bracket yet.';
    const E = entrantMap_(), open = T.matches.filter((m) => !m.winner && !m.void && sideClub_(T, m.a) > 0 && sideClub_(T, m.b) > 0);
    if (!open.length) return 'No match is waiting for a result.';
    const list = open.map((m) => m.id + ': ' + m.label + ' · ' + plainName_(E, sideClub_(T, m.a)) + ' (' + sideClub_(T, m.a) + ') vs ' + plainName_(E, sideClub_(T, m.b)) + ' (' + sideClub_(T, m.b) + ')').join('\n');
    const r1 = ui.prompt('Settle a match', list + '\n\nType: MATCH-ID WINNER-CLUB-ID [score like 5-3]\ne.g. WR1M2 640335 5-3', ui.ButtonSet.OK_CANCEL);
    if (r1.getSelectedButton() !== ui.Button.OK) return '';
    const parts = norm_(r1.getResponseText()).split(/\s+/), m = open.find((x) => x.id === parts[0]);
    if (!m) return 'No open match ' + parts[0] + '.';
    const w = Number(parts[1]), a = sideClub_(T, m.a), b = sideClub_(T, m.b);
    if (w !== a && w !== b) return 'The winner must be ' + a + ' or ' + b + '.';
    const sc = /^(\d+)-(\d+)$/.exec(parts[2] || ''), p = sc ? { gid: '', ra: w === a ? +sc[1] : +sc[2], rb: w === a ? +sc[2] : +sc[1] } : null;
    m.flag = false; finish_(T, m, w, p, 'organizer');
    post_(resultText_(T, m, E, cfg_(), '🧑‍⚖️ Settled by the organizer.'));
    if (champion_(T) && !T.done) crown_(T, cfg_());
    stateSet_(T); snapshot_(T); wake_(); return 'Settled ' + m.id + '.';
  });
}
function adminUndo() {
  withUi_((ui) => {
    const T = stateGet_(); if (!T) return 'No bracket yet.';
    const E = entrantMap_(), done = T.matches.filter((m) => m.winner > 0 && !m.bye);
    const r1 = ui.prompt('Undo a result', done.map((m) => m.id + ': ' + m.label + ' → ' + plainName_(E, m.winner)).join('\n') + '\n\nType the match ID. Matches that came after it are cleared too.', ui.ButtonSet.OK_CANCEL);
    if (r1.getSelectedButton() !== ui.Button.OK) return '';
    const m = done.find((x) => x.id === norm_(r1.getResponseText())); if (!m) return 'No such finished match.';
    // Clear this match and everything that depends on it.
    const clear = (id) => { T.matches.forEach((x) => { if ((x.a.from === id || x.b.from === id || x.resetOf === id) && (x.winner || x.openAt || x.void || x.pend)) { clear(x.id); } if (x.a.from === id || x.b.from === id || x.resetOf === id) { delete x.winner; delete x.loser; delete x.score; delete x.gid; delete x.how; delete x.bye; delete x.void; delete x.pend; delete x.openAt; delete x.deadline; delete x.flag; } }); };
    clear(m.id); delete m.winner; delete m.loser; delete m.score; delete m.gid; delete m.how; m.pend = null; m.flag = false; delete T.done;
    m.deadline = Math.max(m.deadline || 0, Date.now() + waveMs_(cfg_()));
    settle_(T); stateSet_(T); snapshot_(T); wake_();
    post_('↩️ The organizer reopened **' + esc_(m.label) + '**.' + linksLine_(cfg_()));
    return 'Reopened ' + m.id + '.';
  });
}
function adminTestWebhook() { withUi_(() => { post_('🧪 Test from the **' + esc_(cfg_().TOURNEY_NAME) + '** script: the webhook works!' + linksLine_(cfg_())); return 'Sent. Check Discord.'; }); }
function adminResetBracket() {
  withUi_((ui) => {
    if (ui.alert('Clear the bracket and every result? Sign-ups stay. Type nothing; just confirm.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return '';
    stateSet_(null); PropertiesService.getScriptProperties().deleteProperty('TOO_FEW_POSTED');
    try { const C = cfg_(); if (norm_(C.FORM_ID)) FormApp.openById(norm_(C.FORM_ID)).setAcceptingResponses(true); } catch (e) { }
    const sh = sheet_(SHEETS.MATCHES); if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
    snapshot_(null); wake_(); log_('organizer', 'Reset', 'bracket cleared');
    return 'Cleared. The bracket is drawn again when sign-ups close (or with "Draw the bracket now").';
  });
}

// ===================== Demo data for ?demo=1 =====================
function demoSnap_() {
  const names = [['Leming Satellites', 'philipgonzales3', 9], ['The Usual Suspects', 'rgbartley', 9], ['Terrapin Station', 'slipnsliders', 9], ['Flying Lavender Zebras', 'ArchHen', 9], ['Tide Pride', 'evil slip', 8], ['Teton Sliders', 'Slip', 3]];
  const ents = names.map((x, i) => ({ Club: x[0], Discord: x[1], ClubID: 1000 + i, Stars: x[2], Joined: new Date(2026, 10, 25, 8, i), Status: 'In' }));
  const C = { SEEDING: 'signup', FORMAT: 'double', GRAND_FINAL_RESET: 'yes' };
  const T = createTournament_(ents, C), byId = {}; ents.forEach((e) => { byId[e.ClubID] = e; });
  // Play the first few real matches: the higher seed wins, with one upset.
  let gid = 6990;
  for (let k = 0; k < 6; k++) {
    const m = T.matches.find((x) => !x.winner && !x.void && sideClub_(T, x.a) > 0 && sideClub_(T, x.b) > 0); if (!m) break;
    const a = sideClub_(T, m.a), b = sideClub_(T, m.b), hi = seedOf_(T, a) < seedOf_(T, b) ? a : b, w = k === 2 ? (hi === a ? b : a) : hi;
    m.winner = w; m.loser = w === a ? b : a; m.score = [4 + (k % 3), k % 3]; m.gid = String(++gid); settle_(T);
  }
  const live = T.matches.find((x) => !x.winner && !x.void && sideClub_(T, x.a) > 0 && sideClub_(T, x.b) > 0);
  const now = Date.now();
  const club = (id) => (id > 0 ? { id, n: byId[id].Club, o: byId[id].Discord, s: seedOf_(T, id), st: String(byId[id].Stars) } : null);
  return { name: 'Black Friday Brawl (demo)', updated: now, prizes: 'SmallBall Tickets and pictures of dogs', signupClose: now - 864e5, start: now - 3 * 36e5, waveMin: 60, fmt: T.fmt, wave: 4, done: false,
    entrants: ents.map((e) => ({ n: e.Club, o: e.Discord, id: e.ClubID, st: String(e.Stars) })), seeds: T.seeds.map((s) => club(s.club)),
    matches: T.matches.map((m) => ({ id: m.id, b: m.bracket, r: m.round, l: m.label, a: club(sideClub_(T, m.a)), z: club(sideClub_(T, m.b)), byeA: sideClub_(T, m.a) === BYE, byeZ: sideClub_(T, m.b) === BYE,
      w: m.winner > 0 ? m.winner : null, sc: m.score || null, how: '', bye: !!m.bye, v: !!m.void, open: !m.winner && !m.void && sideClub_(T, m.a) > 0 && sideClub_(T, m.b) > 0, dl: now + 25 * 60000, g: live && m.id === live.id ? '7012' : '', live: !!live && m.id === live.id, flag: false })) };
}

// ===================== The bracket page =====================
const BRACKET_HTML_ = `<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Oswald:wght@400;600&display=swap" rel="stylesheet">
<style>
:root{--bg:#0E1B33;--panel:#15274a;--edge:#2b4170;--ink:#F4EBD9;--muted:#9fb0cf;--red:#C8102E;--gold:#ffd166;--green:#34d399}
*{box-sizing:border-box}body{margin:0;background:var(--bg) repeating-linear-gradient(135deg,rgba(255,255,255,.02) 0 1px,transparent 1px 14px);color:var(--ink);font:15px/1.4 Oswald,system-ui,sans-serif}
.bb{font-family:"Bebas Neue",Oswald,sans-serif;letter-spacing:.04em}
header{padding:18px 22px 8px;display:flex;flex-wrap:wrap;gap:12px 24px;align-items:end;justify-content:space-between}
h1{margin:0;font-size:46px;line-height:.95}h1 small{display:block;font-size:17px;color:var(--gold);letter-spacing:.12em}
.meta{color:var(--muted);font-size:14px;text-align:right}.meta b{color:var(--ink)}
.btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;justify-content:flex-end}
.btn{background:var(--panel);border:1px solid var(--edge);color:var(--ink);border-radius:999px;padding:7px 14px;font:600 13px Oswald,sans-serif;cursor:pointer;text-decoration:none}
.btn.go{background:var(--red);border-color:var(--red)}
.champ{margin:8px 22px;padding:14px 18px;border-radius:12px;background:linear-gradient(90deg,rgba(200,16,46,.5),rgba(255,209,102,.2));box-shadow:0 0 0 2px var(--gold) inset;font-size:22px}
.sec{padding:6px 22px 18px}.sec h2{margin:10px 0 8px;font-size:28px;color:var(--gold)}
.cols{display:flex;gap:14px;overflow-x:auto;padding-bottom:8px}
.col{display:flex;flex-direction:column;justify-content:space-around;gap:10px;min-width:210px}
.col h3{margin:0 0 2px;font:600 12px Oswald,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.m{background:var(--panel);border:1px solid var(--edge);border-radius:10px;overflow:hidden}
.m.bye{opacity:.5}.m.open{border-color:var(--red);box-shadow:0 0 0 1px var(--red)}.m.live{border-color:var(--gold);box-shadow:0 0 0 1px var(--gold)}
.m .lab{font-size:11px;color:var(--muted);padding:4px 9px 2px;display:flex;justify-content:space-between;gap:8px}
.m .s{display:grid;grid-template-columns:24px 1fr auto;gap:6px;align-items:center;padding:5px 9px;border-top:1px solid rgba(255,255,255,.05)}
.m .s .sd{font-size:12px;color:var(--muted);text-align:right}.m .s .n{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.m .s .n small{color:var(--muted);margin-left:5px}
.m .s.w{background:rgba(52,211,153,.12)}.m .s.w .n{font-weight:600}.m .s.l .n{opacity:.5;text-decoration:line-through}
.m .s .sc{font-weight:600;min-width:16px;text-align:right}.m .tbd{color:var(--muted);font-style:italic}
.m .ft{font-size:11px;padding:3px 9px 5px;color:var(--gold)}.m .ft a{color:var(--gold)}
.pv{background:var(--panel);border:1px dashed var(--gold);border-radius:12px;padding:12px 16px;font-size:16px}.pv span{color:var(--muted);font-size:14px}.pv .btn{margin-left:8px}
.m .s.openspot .n{color:#6f84ab}
.ents{display:flex;flex-wrap:wrap;gap:8px}.ents span{background:var(--panel);border:1px solid var(--edge);border-radius:999px;padding:5px 12px}
.empty{color:var(--muted);padding:20px 22px}
footer{color:var(--muted);font-size:12px;padding:14px 22px 26px}
</style></head><body><div id="app"></div>
<script>
var D=__DATA__;
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function t(ms){return new Date(ms).toLocaleString([],{weekday:'short',hour:'numeric',minute:'2-digit'})}
function side(c,bye,m,isA){
  if(bye)return '<div class="s"><span class="sd"></span><span class="n tbd">bye</span><span></span></div>';
  if(!c)return '<div class="s"><span class="sd"></span><span class="n tbd">TBD</span><span></span></div>';
  if(c.open)return '<div class="s openspot"><span class="sd">'+c.s+'</span><span class="n tbd">Open spot</span><span></span></div>';
  var cls=m.w?(m.w===c.id?' w':' l'):'',sc=m.sc&&m.w?(m.w===c.id?m.sc[0]:m.sc[1]):'';
  return '<div class="s'+cls+'"><span class="sd">'+(c.s||'')+'</span><span class="n">'+esc(c.n)+'<small>'+esc(c.o||'')+(c.st!==''&&c.st!=null?' · '+esc(c.st)+'★':'')+'</small></span><span class="sc">'+sc+'</span></div>';
}
function box(m){
  var st=m.v?'':m.bye?'':m.w?(m.how==='no-show'?'No-show: higher seed on':m.how==='organizer'?'Settled by the organizer':m.how==='tie'?'Tie: higher seed on':''):m.live?'📡 Game found · result once it airs':m.flag?'Waiting on the organizer':m.open?'🔴 Open · play by '+t(m.dl):'';
  var ft=m.g?(st?st+' · ':'')+'<a href="https://play.smallball.com/training?watch='+esc(m.g)+'" target="_blank">📺 game '+esc(m.g)+'</a>':st;
  return '<div class="m'+(m.live?' live':m.open?' open':'')+(m.byeA||m.byeZ?' bye':'')+'"><div class="lab"><span>'+esc(m.l||m.id)+'</span></div>'+side(m.a,m.byeA,m,true)+side(m.z,m.byeZ,m,false)+(ft?'<div class="ft">'+ft+'</div>':'')+'</div>';
}
function cols(list,name){
  var rs={};list.forEach(function(m){(rs[m.r]=rs[m.r]||[]).push(m)});
  return '<div class="cols">'+Object.keys(rs).sort(function(a,b){return a-b}).map(function(r){var ms=rs[r].filter(function(m){return !m.v&&!(m.bye&&m.byeA&&m.byeZ)&&!(m.b==='L'&&(m.byeA||m.byeZ))});if(!ms.length)return'';return '<div class="col"><h3>'+esc(name(r,ms))+'</h3>'+ms.map(box).join('')+'</div>'}).join('')+'</div>';
}
function render(){
  var h='<header><div><h1 class="bb"><small>SMALLBALL TOURNAMENT</small>'+esc(D.name||'Tournament')+'</h1></div><div class="meta">';
  if(!D.matches){h+=(D.signupClose?'Sign-ups close <b>'+t(D.signupClose)+'</b><br>':'')+(D.start?'Wave 1 <b>'+t(D.start)+'</b>':'');}
  else h+=(D.done?'<b>Finished</b>':'Wave <b>'+(D.wave||0)+'</b> · '+(D.waveMin||60)+'-minute waves')+'<br>'+(D.fmt==='double'?'Double elimination':'Single elimination')+' · '+(D.seeds||[]).length+' clubs';
  h+='<div class="btns">'+(D.form&&!D.matches?'<a class="btn go" href="'+esc(D.form)+'" target="_blank">📝 Sign up</a>':'')+(D.matches?'<button class="btn" onclick="png()">📷 Save as image</button>':'')+'</div></div></header>';
  if(D.champ)h+='<div class="champ bb">👑 '+esc(D.champ.n)+' wins the '+esc(D.name)+'!'+(D.prizes?' <span style="font-size:15px;font-family:Oswald">🎁 '+esc(D.prizes)+'</span>':'')+'</div>';
  if(!D.matches&&D.preview){
    var P=D.preview,sd={signup:'sign-up order (the sooner you sign up, the higher your seed)',stars:'stars, most first',random:'a random draw when sign-ups close'}[P.seeding]||'sign-up order';
    h+='<div class="sec"><div class="pv"><b>Bracket preview</b> · '+P.filled+' of '+P.size+' spots filled · seeded by '+esc(sd)+'.<br><span>This is the bracket we\u2019re building toward. The real one is drawn when sign-ups close'+(D.signupClose?' ('+t(D.signupClose)+')':'')+', sized to who\u2019s in.</span>'+(D.form?' <a class="btn go" href="'+esc(D.form)+'" target="_blank">📝 Grab a spot</a>':'')+'</div></div>';
    var PW=P.matches.filter(function(m){return m.b==='W'}),PL=P.matches.filter(function(m){return m.b==='L'}),PF=P.matches.filter(function(m){return m.b==='F'});
    h+='<div class="sec"><h2 class="bb">'+(P.fmt==='double'?'Winners bracket':'Bracket')+'</h2>'+cols(PW,function(r,ms){return ms[0].l.split(' · ')[0]})+'</div>';
    if(PL.length)h+='<div class="sec"><h2 class="bb">Losers bracket</h2>'+cols(PL,function(r,ms){return ms[0].l.split(' · ')[0]})+'</div>';
    if(PF.length)h+='<div class="sec"><h2 class="bb">Grand final</h2><div class="cols">'+PF.map(function(m){return '<div class="col">'+box(m)+'</div>'}).join('')+'</div></div>';
  }
  if(!D.matches){
    h+='<div class="sec"><h2 class="bb">Signed up · '+(D.entrants||[]).length+'</h2>'+((D.entrants||[]).length?'<div class="ents">'+D.entrants.map(function(e){return '<span>'+esc(e.n)+' <small style="color:var(--muted)">'+esc(e.o)+(e.st!==''?' · '+esc(e.st)+'★':'')+'</small></span>'}).join('')+'</div>':'<div class="empty">Nobody yet. Be the first!</div>')+'</div>';
  } else {
    var W=D.matches.filter(function(m){return m.b==='W'}),L=D.matches.filter(function(m){return m.b==='L'}),F=D.matches.filter(function(m){return m.b==='F'&&!m.v});
    var wr=Math.max.apply(null,W.map(function(m){return m.r})),lr=Math.max.apply(null,L.map(function(m){return m.r}).concat([0]));
    h+='<div class="sec"><h2 class="bb">'+(D.fmt==='double'?'Winners bracket':'Bracket')+'</h2>'+cols(W,function(r,ms){return ms[0].l.split(' · ')[0]})+'</div>';
    if(L.length)h+='<div class="sec"><h2 class="bb">Losers bracket</h2>'+cols(L,function(r,ms){return ms[0].l.split(' · ')[0]})+'</div>';
    if(F.length)h+='<div class="sec"><h2 class="bb">Grand final</h2><div class="cols">'+F.map(function(m){return '<div class="col">'+box(m)+'</div>'}).join('')+'</div></div>';
  }
  h+='<footer>Updated '+t(D.updated||Date.now())+' · refreshes every minute · results show once each game has aired (no spoilers) · read-only on SmallBall</footer>';
  document.getElementById('app').innerHTML=h;
}
// A picture of the whole bracket, drawn on a canvas (no outside services).
function png(){
  var secs=[],W=D.matches.filter(function(m){return m.b==='W'}),L=D.matches.filter(function(m){return m.b==='L'}),F=D.matches.filter(function(m){return m.b==='F'&&!m.v});
  function group(list){var rs={};list.filter(function(m){return !m.v&&!(m.bye&&m.byeA&&m.byeZ)&&!(m.b==='L'&&(m.byeA||m.byeZ))}).forEach(function(m){(rs[m.r]=rs[m.r]||[]).push(m)});return Object.keys(rs).sort(function(a,b){return a-b}).map(function(r){return rs[r]})}
  secs.push([D.fmt==='double'?'WINNERS BRACKET':'BRACKET',group(W)]);if(L.length)secs.push(['LOSERS BRACKET',group(L)]);if(F.length)secs.push(['GRAND FINAL',[F]]);
  var BW=230,BH=64,GX=24,GY=12,PAD=28,y=110,maxCols=0,heights=[];
  secs.forEach(function(s){maxCols=Math.max(maxCols,s[1].length);var most=Math.max.apply(null,s[1].map(function(c){return c.length}));heights.push(40+most*(BH+GY))});
  var cw=PAD*2+maxCols*(BW+GX),ch=y+heights.reduce(function(a,b){return a+b},0)+(D.champ?60:0)+30;
  var c=document.createElement('canvas'),k=2;c.width=cw*k;c.height=ch*k;var x=c.getContext('2d');x.scale(k,k);
  x.fillStyle='#0E1B33';x.fillRect(0,0,cw,ch);
  x.fillStyle='#ffd166';x.font='600 14px Oswald, sans-serif';x.fillText('SMALLBALL TOURNAMENT',PAD,40);
  x.fillStyle='#F4EBD9';x.font='40px "Bebas Neue", Oswald, sans-serif';x.fillText(D.name||'Tournament',PAD,80);
  x.fillStyle='#9fb0cf';x.font='13px Oswald, sans-serif';x.fillText((D.done?'Final':'Wave '+(D.wave||0))+' · '+new Date().toLocaleString(),cw-PAD-260,80);
  if(D.champ){x.fillStyle='#C8102E';x.fillRect(PAD,y-6,cw-PAD*2,44);x.fillStyle='#ffd166';x.font='28px "Bebas Neue", Oswald, sans-serif';x.fillText('👑 '+D.champ.n+' wins!',PAD+14,y+26);y+=60}
  secs.forEach(function(s,si){
    x.fillStyle='#ffd166';x.font='24px "Bebas Neue", Oswald, sans-serif';x.fillText(s[0],PAD,y+22);
    var top=y+36,colsH=heights[si]-40;
    s[1].forEach(function(col,ci){
      var cx=PAD+ci*(BW+GX),step=colsH/col.length;
      col.forEach(function(m,mi){
        var by=top+mi*step+(step-BH)/2;
        x.fillStyle='#15274a';x.strokeStyle=m.open?'#C8102E':m.live?'#ffd166':'#2b4170';x.lineWidth=1.5;
        x.beginPath();x.rect(cx,by,BW,BH);x.fill();x.stroke();
        x.fillStyle='#9fb0cf';x.font='10px Oswald, sans-serif';x.fillText((m.l||m.id).slice(0,40),cx+8,by+12);
        [[m.a,m.byeA,0],[m.z,m.byeZ,1]].forEach(function(p){
          var cc=p[0],ry=by+18+p[2]*22,won=m.w&&cc&&m.w===cc.id;
          if(won){x.fillStyle='rgba(52,211,153,.18)';x.fillRect(cx+1,ry,BW-2,22)}
          x.fillStyle=cc?(m.w&&!won?'#7b8aa8':'#F4EBD9'):'#7b8aa8';x.font=(won?'600 ':'')+'13px Oswald, sans-serif';
          x.fillText(p[1]?'bye':cc?((cc.s?cc.s+'  ':'')+cc.n).slice(0,28):'TBD',cx+8,ry+16);
          if(m.sc&&m.w&&cc){x.textAlign='right';x.fillText(String(m.w===cc.id?m.sc[0]:m.sc[1]),cx+BW-8,ry+16);x.textAlign='left'}
        });
      });
    });
    y+=heights[si];
  });
  x.fillStyle='#9fb0cf';x.font='11px Oswald, sans-serif';x.fillText('Results show once each game has aired · read-only on SmallBall',PAD,ch-12);
  var url=c.toDataURL('image/png');
  try{var a=document.createElement('a');a.download=(D.name||'bracket').replace(/[^a-z0-9]+/gi,'-')+'.png';a.href=url;document.body.appendChild(a);a.click();a.remove();}catch(e){}
  var o=document.getElementById('shot')||document.createElement('div');o.id='shot';
  o.style.cssText='position:fixed;inset:0;background:rgba(5,10,20,.92);z-index:9;overflow:auto;padding:18px;text-align:center';
  o.innerHTML='<p style="margin:0 0 10px">📷 Here\\u2019s the bracket. If it didn\\u2019t download, right-click it (or long-press on a phone) and save it, then post it in Discord. <button class="btn" onclick="this.closest(\\'#shot\\').remove()">Close</button></p><img style="max-width:100%;border-radius:8px" src="'+url+'">';
  document.body.appendChild(o);
}
render();
if(!/demo=1/.test(location.search))setTimeout(function(){location.reload()},60000);
</script></body></html>`;
