/**
 * ⛰️ HOLD THE HILL — SmallBall ladder (v3.8: 🥊 Start-the-game links in Discord that open SmallBall on your opponent with your club checked, clickable club IDs on the board; v3.7: a cleaner form with 🥊 Charge the Hill up top, 🤝 head-to-head wagers (straight up, odds or run line, up to 250 BB a side), The Hustler award, commish fines that split a cheater's Brawl Bucks across the league; v3.6: the Hill Board lives on GitHub Pages (fast, and old board links forward there), tidy Discord links; v3.5: Hill Board and form links on the big posts, Discord posts that get blocked are retried instead of lost, v3.4: Who can I charge?, v3.3: the Ace on top of the Climb, v3.2.1: sturdier Discord posting, Check SmallBall now, 1-minute checks, Discord ID update, louder rejections, callout test, club IDs everywhere, 📣 callouts fix, rejections posted in Discord, overlapping charges, launch reset, watch links, betting-close wording, everything sportsbook in #sportsbook, preseason matchup lines, #sportsbook channel, 🔮 matchup lines, bet option fix, #hill-log, form link on the board, 🤖 auto-reporting, stars from the form, star-gap odds, scaled upset bonus, ♠️ Ace futures, demo board, 🎰 Hill Sportsbook + My bets, season start date, 1-hour charges, daily Brawl points, open mound, The Bench Clearer Cup)
 * Google Sheets + Google Form + Discord webhook engine
 * Version 1.1
 *
 * Hill Board: a live web page (see the bottom of this file). Deploy → New deployment → Web app,
 *   Execute as: Me, Who has access: Anyone. Share that URL.
 *
 * v1.1 (built with what the SmallBall chat knows about the game):
 *   - No accept step: SmallBall challenges are just played. Declaring a challenge starts the clock.
 *   - One "Report my game" step: game ID, game type and score together. The challenger's report
 *     settles it once the game has aired; the defender only reports to dispute it.
 *   - Ties happen in SmallBall. TIE_RULE in Config: HOLD (defender/Ace keeps it, no points) or REPLAY.
 *   - Game types that count are set in Config (ALLOWED_KINDS).
 *   - Results post after the game has aired (POST_DELAY_MINUTES), so nobody gets spoiled.
 *   - SmallBall's game record needs a login (it answers 401 signed out), so the script can't read
 *     games itself; matching reports settle it, mismatches go to the commish.
 *
 * SETUP (once):
 *   1. Create a blank Google Sheet.
 *   2. Extensions → Apps Script. Delete the starter code, paste this whole file, save.
 *   3. Run `setup` (approve the permissions it asks for).
 *   4. In the new "Config" tab, paste your Discord webhook URL next to DISCORD_WEBHOOK_URL.
 *   5. Players → select the first Ace's row → menu ⛰️ Hold the Hill → Crown selected player as Ace.
 *
 * Everything players do goes through the one form. The script checks every rule,
 * updates the tabs, and posts results/standings to Discord. Anything it can't settle
 * on its own lands in the Challenges tab with Status = Review for the commish.
 */

// ───────────────────────────── Constants ─────────────────────────────

const SHEETS = {
  CONFIG: 'Config',
  PLAYERS: 'Players',
  CHALLENGES: 'Challenges',
  MATCHES: 'Matches',
  REIGNS: 'Reigns',
  PAYOUTS: 'Payouts',
  LINES: 'Lines',
  STARS: 'Stars',
  BETS: 'Bets',
  WAGERS: 'Wagers',
  LEDGER: 'Ledger',
  LOG: 'Log',
};

const HEADERS = {
  Config: ['Key', 'Value', 'Notes'],
  Players: ['Email', 'Discord', 'DiscordID', 'OwnerID', 'Club', 'ClubID', 'Status', 'Rank', 'Joined',
    'Wins', 'Losses', 'CareerPts', 'Defenses', 'Reigns', 'BestReignPts'],
  Challenges: ['ID', 'Type', 'Status', 'Challenger', 'ChallengerName', 'Defender', 'DefenderName',
    'Created', 'AcceptedAt', 'Deadline', 'GameID', 'GameKind', 'FirstReport', 'ChallengerReport', 'DefenderReport', 'CommishScore', 'Notes'],
  Matches: ['MatchID', 'Date', 'Season', 'ChallengeID', 'Type', 'GameID', 'Winner', 'WinnerEmail',
    'Loser', 'LoserEmail', 'WinnerRuns', 'LoserRuns', 'Margin', 'Outcome', 'Points', 'Source'],
  Reigns: ['Reign', 'Season', 'Email', 'Discord', 'Club', 'Start', 'End', 'Defenses', 'ReignPts', 'EndedBy', 'Revenge'],
  Payouts: ['Day', 'Season', 'Email', 'Discord', 'Spot', 'Pts'],
  Lines: ['ChallengeID', 'Season', 'Opened', 'Closes', 'Status', 'Away', 'AwayEmail', 'Home', 'HomeEmail', 'AwayML', 'HomeML', 'Fav', 'FavRL', 'DogRL', 'Total', 'OverOdds', 'UnderOdds', 'Result'],
  Stars: ['ClubID', 'Club', 'Stars', 'Source', 'Updated'],
  Bets: ['BetID', 'Placed', 'Season', 'Email', 'Bettor', 'ChallengeID', 'Market', 'Pick', 'Odds', 'Stake', 'Status', 'Profit'],
  Wagers: ['WagerID', 'Season', 'Offered', 'Status', 'Maker', 'MakerName', 'MakerClubID', 'Taker', 'TakerName', 'TakerClubID', 'Terms', 'Line',
    'MakerStake', 'TakerStake', 'Expires', 'AcceptedAt', 'Deadline', 'GameID', 'MakerRuns', 'TakerRuns', 'AirsAt', 'Winner', 'Settled', 'Notes'],
  Ledger: ['Date', 'Season', 'Email', 'Player', 'Amount', 'Reason'],
  Log: ['Time', 'Actor', 'Action', 'Details'],
};

// Columns kept as plain text so Sheets never turns IDs into numbers or "5-3" into a date.
const TEXT_COLUMNS = ['MakerClubID', 'TakerClubID', 'Line', 'Value', 'Day', 'DiscordID', 'OwnerID', 'ClubID', 'GameID', 'ChallengerReport', 'DefenderReport', 'CommishScore'];

const DEFAULTS = {
  DISCORD_WEBHOOK_URL: ['', 'Discord channel → Edit Channel → Integrations → Webhooks → New Webhook → Copy URL'],
  SEASON: [1, 'Current season number'],
  SEASON_START: ['2026-11-27 00:00', 'When the season opens, Mountain time (YYYY-MM-DD HH:MM). Clubs can register before this; charges and Brawl points start here.'],
  SEASON_END: ['2026-12-23 23:59', 'When the season ends, Mountain time (YYYY-MM-DD HH:MM). New charges lock then; charges already made can still be played and reported.'],
  FORM_LINK: ['https://tinyurl.com/holdthehillsb', 'Link to the Hill form, shown as a button on the Hill Board'],
  GITHUB_REPO: ['slipnsliders/smallball-tools', 'Optional: the GitHub repo that hosts the Hill Board (owner/repo). Connect it from the Hill menu'],
  GITHUB_PATH: ['docs/hill/board.json', 'Where the board data goes in that repo (the page sits next to it)'],
  BOARD_LINK: ['', 'Link to the live Hill Board for Discord posts (a short link is nice). Blank = the web app link, found on its own'],
  BOOK_WEBHOOK_URL: ['', 'Optional: a webhook for a #sportsbook channel. Bets and the daily odds board post there instead of the main feed'],
  BOOK_ODDS_EVERY_HOURS: [1, 'How often the odds board posts to the sportsbook channel, in hours (only when something changed)'],
  NUDGES: ['TRUE', 'Callouts that nudge idle clubs to charge (TRUE/FALSE)'],
  NUDGE_HOURS: ['11,17,21', 'Hours (Mountain, 0-23) the callouts can post'],
  NUDGE_IDLE_HOURS: [24, 'A club gets called out after this many hours without charging'],
  NUDGE_MAX: [3, 'Most clubs called out at a time'],
  TALK_WEBHOOK_URL: ['', 'Optional: a webhook for #trash-talk. Callouts post there instead of the main feed'],
  POST_REJECTIONS: ['TRUE', 'Post rejected form submissions in Discord with the reason, tagging the player (TRUE/FALSE)'],
  HELP_WEBHOOK_URL: ['', 'Optional: a webhook for #hill-help. Rejected submissions post there instead of the main feed'],
  LOG_WEBHOOK_URL: ['', 'Optional: a webhook for a PRIVATE commish channel (#hill-log). Every Log line goes there, batched every 5 minutes'],
  AUTO_DETECT: ['TRUE', 'Find Hill games on SmallBall automatically (TRUE/FALSE). Hand reports still work'],
  UPSET_POINTS: ['5,25,75', 'Upset bonus Brawl points when a lower-star club wins, by star gap: 1★, 2★, 3★ or more'],
  BUSH_MAX_STARS: [7, 'Best of the Bush award: clubs with this many stars or fewer'],
  BOOK_ON: ['TRUE', 'Sportsbook on (TRUE/FALSE). Play money only'],
  BOOK_BANKROLL: [1000, 'Brawl Bucks every player starts the season with'],
  BOOK_WINDOW_MIN: [0, 'Minutes after a charge that betting on it stays open (0 = bets lock at the charge; matchup lines carry the action)'],
  BOOK_HOLD_HOURS: [48, 'Matchup bets: refunded if that charge is not played within this many hours'],
  BOOK_VIG: [0.045, 'House edge built into the odds (0.045 = 4.5%)'],
  BOOK_POST_BETS: ['TRUE', 'Post each bet in Discord (TRUE/FALSE)'],
  WAGER_ON: ['TRUE', 'Head-to-head wagers on (TRUE/FALSE). Needs the sportsbook on'],
  WAGER_MAX: [250, 'Most Brawl Bucks either side can put on one head-to-head wager'],
  WAGER_OFFER_HOURS: [24, 'Hours a wager offer stays open for the other player to accept'],
  WAGER_PLAY_HOURS: [48, 'Hours after a wager is accepted to play the game that settles it (else everyone is refunded)'],
  WAGER_KINDS: ['big', 'Game types that can settle a wager, comma separated: big, pro, exhibition'],
  PRIZES: ['SmallBall Tickets and pictures of dogs', 'Shown on the board and in the awards post'],
  CHALLENGE_REACH: [3, 'How many spots above you that you can challenge'],
  MATCH_HOURS: [1, 'Hours after a challenge is declared to start the game and report it'],
  TIE_RULE: ['HOLD', 'HOLD = a tie keeps the defender (or the Ace) in place, no points; REPLAY = play another game'],
  ALLOWED_KINDS: ['big', 'Game types that count, comma separated: big, pro, exhibition'],
  POST_DELAY_MINUTES: [25, 'Wait this long after the first report before posting a result (official games air about 22 minutes). 0 = right away'],
  COOLDOWN_HOURS: [24, 'Hours before the same two players can play each other again'],
  BASE_REWARD: [10, 'Points for the first defense'],
  DOUBLE_UNTIL: [6, 'Defense reward doubles through this defense, then stays flat'],
  REVENGE_THRESHOLD: [500, "Reign points needed to earn the Ace's Revenge"],
  REVENGE_DECLARE_HOURS: [12, "Hours a dethroned Ace has to declare the Ace's Revenge"],
  EX_ACE_RANK: [3, 'Ladder spot a dethroned Ace drops to'],
  MOUND_OPEN_MAX: [5, 'Open mound: only #1 can charge the Ace at first; each day with no title charge opens it one more spot, down to this spot'],
  DAILY_POINTS: ['10,5,4,3,2,2,1,1,1,1,1', 'Brawl points paid once a day for where you sit: the Ace, then #1, #2, #3 … (comma separated)'],
  LADDER_POST_SIZE: [15, 'How many contenders to show in Discord standings'],
  EMAIL_REJECTIONS: ['TRUE', 'Email players when a submission is rejected (TRUE/FALSE)'],
  FORM_ID: ['', 'Set by setup — do not edit'],
  STATE_REVENGE_EX_ACE: ['', 'Managed by script'],
  STATE_REVENGE_MARGIN: ['', 'Managed by script'],
  STATE_REVENGE_DEADLINE: ['', 'Managed by script'],
  STATE_LAST_TITLE_ACTIVITY: ['', 'Managed by script'],
  STATE_SEASON_OPENED: ['', 'Managed by script'],
  STATE_AUTO_STATUS: ['', 'Managed by script: last auto-report check'],
  STATE_SEASON_BUZZER: ['', 'Managed by script'],
  STATE_LAST_PAYDAY: ['', 'Managed by script'],
  STATE_MOUND_OPEN_TO: ['', 'Managed by script'],
  STATE_SEASON_CLOSED: ['', 'Managed by script'],
};

const ACTIONS = {
  REGISTER: '📝 Register my club (new players start here)',
  CHALLENGE: '🥊 CHARGE THE HILL (challenge someone above you)',
  REPORT: '📋 Report my game (only if the Hill missed it)',
  REVENGE: "🔥 Declare the Ace's Revenge (dethroned Ace only)",
  BET: '🎰 Place a bet (Sportsbook, play money)',
  DISCORD_ID: '🔔 Update my Discord ID (get tagged for alerts)',
  REACH: '🔎 Who can I charge? (your list posts in #hill-help)',
  WAGER: '🤝 Wager an opponent (head-to-head Brawl Bucks)',
  WAGER_REPLY: '🤝 Answer a wager (accept, decline or cancel)',
};

const Q = {
  ACTION: 'What do you want to do?',
  DISCORD: 'Discord username',
  DISCORD_ID: 'Discord user ID (optional, for @mentions)',
  OWNER: 'SmallBall Owner Name',
  CLUB: 'Club Name',
  CLUB_ID: 'Club ID # (only 1 team per owner)',
  OPPONENT: 'Opponent',
  GAME_ID: 'SmallBall game ID',
  KIND: 'Game type',
  MY_RUNS: "My club's runs",
  OPP_RUNS: "Opponent's runs",
  CONFIRM_REVENGE: 'Confirm revenge',
  BET: 'Your bet',
  STAKE: 'Stake (Brawl Bucks)',
  STARS: 'Club stars (0-10, shown on your SmallBall club page)',
  MY_ID: 'Your numeric Discord user ID',
  W_OPP: 'Opponent club ID (who you are wagering)',
  W_STAKE: 'Your stake (Brawl Bucks)',
  W_TERMS: 'Terms',
  W_ODDS: 'Odds (only for an odds bet, like 2-1)',
  W_RUNS: 'Runs (only for a run-line bet)',
  W_ID: 'Wager # (from the Discord post, like W-0003)',
  W_REPLY: 'Your answer',
};

const ACE_CHOICE = '♠ THE ACE (charge the mound: title shot, #1 contender, or lower when the mound is open)';
const OPEN = ['Pending', 'Accepted', 'Started', 'Review'];
const BOOK_HELP = 'Play money only: everyone starts the season with 1,000 Brawl Bucks. 🔮 Matchup bets: bet on a charge before it happens. Betting on that matchup closes the moment the charge is made, and the bet is refunded if it isn\'t played within 48 hours. ♠️ Futures: back your own club to finish as the Ace. In a matchup yourself? You can only bet on yourself. Bets settle once the game has aired.';
const FORM_CONFIRM = 'Got it! Check Discord in about a minute: ✅ it posts in #hill-feed (bets in #sportsbook) if it went through, or ❌ a red REJECTED post (and an email) tells you exactly what to fix. Nothing either way after 5 minutes? Ask in #hill-help.';
const NO_LINES = 'No open lines right now. Lines open when someone charges the hill.';
const KINDS = { 'BigLeague': 'big', 'Pro League': 'pro', 'Exhibition': 'exhibition' };

// ───────────────────────────── Small helpers ─────────────────────────────

class HillError extends Error {}
function fail_(msg) { throw new HillError(msg); }
function now_() { return new Date(); }
function hoursFrom_(d, h) { return new Date(d.getTime() + h * 3600000); }
function norm_(s) { return String(s === null || s === undefined ? '' : s).trim(); }
function lc_(s) { return norm_(s).toLowerCase(); }
function num_(v) { return Number(v || 0); }
function pad_(n) { return ('000' + n).slice(-4); }
function hasRank_(p) { return p.Rank !== '' && p.Rank !== null && p.Rank !== undefined; }
function esc_(s) { return norm_(s).replace(/([*_~`|\\>])/g, '\\$1'); }
function ts_(d) { return '<t:' + Math.floor(new Date(d).getTime() / 1000) + ':f>'; }
function rel_(d) { return '<t:' + Math.floor(new Date(d).getTime() / 1000) + ':R>'; }
function tag_(p) {
  const id = norm_(p.DiscordID).replace(/\D/g, '');
  return id ? '<@' + id + '>' : '**' + esc_(p.Discord) + '**';
}
function who_(p) { return tag_(p) + ' (*' + esc_(p.Club) + '*)'; }

function parseScore_(v) {
  const m = norm_(v).match(/^(\d+)\D+(\d+)$/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

// ───────────────────────────── Sheet tables ─────────────────────────────

function sheet_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) fail_('Missing tab "' + name + '". Run setup.');
  return sh;
}

function readTable_(name) {
  const sh = sheet_(name);
  const vals = sh.getDataRange().getValues();
  const headers = vals[0];
  const rows = [];
  vals.slice(1).forEach(function (r, i) {
    if (r.every(function (v) { return v === '' || v === null; })) return;
    const o = { _row: i + 2 };
    headers.forEach(function (h, j) { o[h] = r[j]; });
    rows.push(o);
  });
  return { sh: sh, headers: headers, rows: rows };
}

function rowValues_(headers, o) {
  return headers.map(function (h) { return o[h] === undefined || o[h] === null ? '' : o[h]; });
}

function writeRow_(t, o) {
  t.sh.getRange(o._row, 1, 1, t.headers.length).setValues([rowValues_(t.headers, o)]);
}

function appendObj_(name, o) {
  const sh = sheet_(name);
  sh.appendRow(rowValues_(HEADERS[name], o));
}

function log_(actor, action, details) {
  try { appendObj_(SHEETS.LOG, { Time: now_(), Actor: actor, Action: action, Details: details }); } catch (e) { /* never block on logging */ }
  if (/^Discord/.test(action)) return;   // copies of feed posts don't need repeating
  try {
    const props = PropertiesService.getScriptProperties();
    let q = []; try { q = JSON.parse(props.getProperty('LOG_QUEUE') || '[]'); } catch (e) { q = []; }
    q.push(Utilities.formatDate(now_(), 'America/Denver', 'M/d h:mm a') + ' · **' + action + '** · ' + actor + ' · ' + String(details).slice(0, 300));
    props.setProperty('LOG_QUEUE', JSON.stringify(q.slice(-60)));
  } catch (e) { }
}
// Sends queued Log lines to the private #hill-log webhook (every 5 minutes, in messages under Discord's limit).
function flushLog_() {
  const props = PropertiesService.getScriptProperties();
  let q = []; try { q = JSON.parse(props.getProperty('LOG_QUEUE') || '[]'); } catch (e) { q = []; }
  if (!q.length) return;
  const url = norm_(cfg_().LOG_WEBHOOK_URL);
  props.setProperty('LOG_QUEUE', '[]');
  if (!url) return;
  let msg = '';
  const send = function (m) {
    try { UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({ username: 'Hill Log', content: m, allowed_mentions: { parse: [] } }) }); } catch (e) { }
  };
  q.forEach(function (line) { if (msg.length + line.length + 1 > 1900) { send(msg); msg = ''; } msg += (msg ? '\n' : '') + line; });
  if (msg) send(msg);
}

// ───────────────────────────── Config ─────────────────────────────

function cfg_() {
  const t = readTable_(SHEETS.CONFIG);
  const c = {};
  Object.keys(DEFAULTS).forEach(function (k) { c[k] = DEFAULTS[k][0]; });
  t.rows.forEach(function (r) {
    if (!r.Key || !(r.Key in DEFAULTS)) return;
    const def = DEFAULTS[r.Key][0];
    if (typeof def === 'number') c[r.Key] = (r.Value === '' || r.Value === null) ? def : Number(r.Value);
    else c[r.Key] = r.Value instanceof Date ? r.Value.toISOString() : norm_(r.Value);
  });
  return c;
}

function setCfg_(key, val) {
  const t = readTable_(SHEETS.CONFIG);
  const r = t.rows.find(function (x) { return x.Key === key; });
  if (r) { r.Value = val; writeRow_(t, r); }
  else appendObj_(SHEETS.CONFIG, { Key: key, Value: val, Notes: (DEFAULTS[key] || ['', ''])[1] });
}

function clearRevenge_() {
  setCfg_('STATE_REVENGE_EX_ACE', '');
  setCfg_('STATE_REVENGE_MARGIN', '');
  setCfg_('STATE_REVENGE_DEADLINE', '');
}

// ───────────────────────────── Players, ladder, reigns ─────────────────────────────

function players_() { return readTable_(SHEETS.PLAYERS); }
function challenges_() { return readTable_(SHEETS.CHALLENGES); }
function findBy_(t, email) { return t.rows.find(function (p) { return lc_(p.Email) === lc_(email); }); }
function ace_(pt) { return pt.rows.find(function (p) { return p.Status === 'Active' && hasRank_(p) && Number(p.Rank) === 0; }); }
function ladder_(pt) {
  return pt.rows.filter(function (p) { return p.Status === 'Active' && hasRank_(p) && Number(p.Rank) > 0; })
    .sort(function (a, b) { return Number(a.Rank) - Number(b.Rank); });
}
function setLadder_(arr) { arr.forEach(function (p, i) { p.Rank = i + 1; }); }
function savePlayers_(pt) { pt.rows.forEach(function (p) { writeRow_(pt, p); }); trackClimb_(pt.rows); }

// ───────────────────────────── Season, Cup and awards ─────────────────────────────

const AWARDS = [
  { key: 'ace', icon: '♠️', name: 'Season Ace', what: 'On the mound when the season ends' },
  { key: 'cup', icon: '🏆', name: 'The Bench Clearer Cup', what: 'Most Brawl points all season: defenses plus daily pay' },
  { key: 'longest', icon: '👑', name: 'Longest Reign', what: 'Most days on the mound in one reign' },
  { key: 'iron', icon: '🛡️', name: 'Iron Mound', what: 'Most title defenses in one reign' },
  { key: 'climber', icon: '📈', name: 'Biggest Climber', what: 'Most spots climbed from their lowest spot' },
  { key: 'haymaker', icon: '💥', name: 'Haymaker', what: 'Biggest winning margin' },
  { key: 'brawler', icon: '🥊', name: 'Brawler', what: 'Most charges thrown, win or lose' },
  { key: 'giant', icon: '🗡️', name: 'Giant Killer', what: 'Biggest star-gap upset of the season' },
  { key: 'bush', icon: '🌱', name: 'Best of the Bush', what: 'Most Brawl points among lower-star clubs' },
  { key: 'sharp', icon: '💰', name: 'The Sharp', what: 'Biggest Brawl Bucks bankroll (sportsbook)' },
  { key: 'hustler', icon: '🤝', name: 'The Hustler', what: 'Most Brawl Bucks won head-to-head (wagers)' },
];

// ── Open mound: only #1 can charge the Ace, then one more spot opens each day nobody charges.
function lastTitle_(C) {
  let t;
  if (C.STATE_LAST_TITLE_ACTIVITY) t = new Date(C.STATE_LAST_TITLE_ACTIVITY);
  else { const reign = currentReign_(readTable_(SHEETS.REIGNS)); t = reign ? new Date(reign.Start) : now_(); }
  const st = seasonStart_(C);
  return st && st > t ? st : t;   // the open-mound clock never starts before the season does
}
function moundOpenTo_(C) {
  const days = Math.floor((now_() - lastTitle_(C)) / 86400000);
  return Math.max(1, Math.min(Number(C.MOUND_OPEN_MAX) || 1, 1 + days));
}

// ── Daily Brawl points: paid once a day (just after midnight Mountain) for the day before, by spot.
function dailyTable_(C) { return norm_(C.DAILY_POINTS).split(/[\s,]+/).filter(Boolean).map(Number); }
function payFor_(C, rank) { const t = dailyTable_(C); return Number(t[Number(rank)] || 0); }   // rank 0 = the Ace
function denverDay_(d) { return Utilities.formatDate(d, 'America/Denver', 'yyyy-MM-dd'); }
function payday_() {
  const C = cfg_();
  const yesterday = denverDay_(new Date(now_().getTime() - 86400000));
  if (!C.STATE_LAST_PAYDAY) { setCfg_('STATE_LAST_PAYDAY', yesterday); return; }   // first run: start paying from today
  if (String(C.STATE_LAST_PAYDAY) >= yesterday) return;
  const end = seasonEnd_(C), st = seasonStart_(C);
  if (end && yesterday > denverDay_(end)) { setCfg_('STATE_LAST_PAYDAY', yesterday); return; }   // no pay after the season
  if (st && yesterday < denverDay_(st)) { setCfg_('STATE_LAST_PAYDAY', yesterday); return; }     // or before it opens
  const pt = players_();
  const rows = [];
  pt.rows.forEach(function (p) {
    if (p.Status !== 'Active' || !hasRank_(p)) return;
    const pts = payFor_(C, p.Rank);
    if (pts > 0) rows.push([yesterday, C.SEASON, p.Email, p.Discord, Number(p.Rank) === 0 ? 'Ace' : '#' + p.Rank, pts]);
  });
  if (rows.length) { const sh = sheet_(SHEETS.PAYOUTS); sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows); }
  setCfg_('STATE_LAST_PAYDAY', yesterday);
  log_('system', 'Payday', yesterday + ': ' + rows.length + ' clubs paid');
}
// Brawl points this season per email: defense points from reigns + daily pay.
function hillPoints_(C) {
  const season = String(C.SEASON), tot = {}, first = {};
  const add = function (e, n, t) { e = lc_(e); tot[e] = (tot[e] || 0) + n; if (t && (!first[e] || t < first[e])) first[e] = t; };
  readTable_(SHEETS.REIGNS).rows.forEach(function (x) { if (String(x.Season) === season) add(x.Email, num_(x.ReignPts), new Date(x.Start).getTime()); });
  readTable_(SHEETS.PAYOUTS).rows.forEach(function (x) { if (String(x.Season) === season) add(x.Email, num_(x.Pts), new Date(x.Day).getTime()); });
  return { tot: tot, first: first };
}

function seasonStart_(C) { return parseWhen_(C.SEASON_START); }
function seasonOpen_(C) { const st = seasonStart_(C); return !st || now_() >= st; }
function seasonEnd_(C) { return parseWhen_(C.SEASON_END); }
function parseWhen_(raw) {
  const v = norm_(raw);
  if (!v) return null;
  if (/T/.test(v)) return new Date(v);   // Sheets turned it into a date
  try { return Utilities.parseDate(v, 'America/Denver', v.length > 10 ? 'yyyy-MM-dd HH:mm' : 'yyyy-MM-dd'); } catch (e) { return null; }
}
function seasonOver_(C) { const e = seasonEnd_(C); return !!(e && now_() >= e); }
function lockIfOver_(C) {
  if (!seasonOpen_(C)) fail_('Season ' + C.SEASON + ' opens ' + Utilities.formatDate(seasonStart_(C), 'America/Denver', "EEE MMM d 'at' h:mm a") + ' Mountain. You can register now; charges open then.');
  if (seasonOver_(C)) fail_('Season ' + C.SEASON + ' is over: no new charges. Watch Discord for the awards.');
}

// Lowest and highest spot each club has held this season (the Ace counts as spot 0), for Biggest Climber.
function climbKey_() { return 'CLIMB_S' + cfg_().SEASON; }
function trackClimb_(rows) {
  const props = PropertiesService.getScriptProperties();
  const key = climbKey_();
  let m = {}; try { m = JSON.parse(props.getProperty(key) || '{}'); } catch (e) { m = {}; }
  let changed = false;
  rows.forEach(function (p) {
    if (p.Status !== 'Active' || !hasRank_(p)) return;
    const r = Number(p.Rank), e = lc_(p.Email);
    const x = m[e] || { low: r, climb: 0, at: Date.now() };
    if (!m[e]) changed = true;
    if (r > x.low) { x.low = r; changed = true; }
    if (x.low - r > x.climb) { x.climb = x.low - r; x.at = Date.now(); changed = true; }   // best climb from their lowest spot so far
    m[e] = x;
  });
  if (changed) props.setProperty(key, JSON.stringify(m));
}

// Works out the leader of every award. Ties go to whoever got there first.
function awards_() {
  const C = cfg_();
  const season = String(C.SEASON);
  const end = seasonEnd_(C);
  const cap = end && now_() > end ? end : now_();
  const pt = players_();
  const byEmail = {}; pt.rows.forEach(function (p) { byEmail[lc_(p.Email)] = p; });
  const nm = function (email) { const p = byEmail[lc_(email)]; return p ? { name: norm_(p.Discord), club: norm_(p.Club), email: lc_(p.Email) } : null; };
  const out = {};
  const ace = ace_(pt);
  out.ace = ace ? Object.assign(nm(ace.Email), { value: 'On the mound' }) : null;

  const reigns = readTable_(SHEETS.REIGNS).rows.filter(function (x) { return String(x.Season) === season; });
  // The Bench Clearer Cup: defense points + daily pay; tie → whoever started scoring first
  const hp = hillPoints_(C);
  const cupRows = Object.keys(hp.tot).map(function (e) { return { email: e, pts: hp.tot[e], first: hp.first[e] || 0 }; })
    .filter(function (x) { return byEmail[x.email]; })
    .sort(function (a, b) { return b.pts - a.pts || a.first - b.first; });
  out.cupTable = cupRows.slice(0, 5).map(function (x) { return Object.assign(nm(x.email) || { name: '?' }, { pts: x.pts }); });
  out.cup = cupRows.length && cupRows[0].pts > 0 ? Object.assign(nm(cupRows[0].email), { value: cupRows[0].pts + ' pts' }) : null;

  const best = function (list, score, label) {   // list is in time order, so the first max wins ties
    let top = null, v = -1;
    list.forEach(function (x) { const s = score(x); if (s > v) { v = s; top = x; } });
    return top && v > 0 ? { x: top, v: v, label: label(v) } : null;
  };
  const days = function (x) { return Math.floor(((x.End ? new Date(x.End) : cap) - new Date(x.Start)) / 86400000); };
  let b = best(reigns, days, function (v) { return v + (v === 1 ? ' day' : ' days'); });
  out.longest = b ? Object.assign(nm(b.x.Email), { value: b.label }) : null;
  b = best(reigns, function (x) { return num_(x.Defenses); }, function (v) { return v + (v === 1 ? ' defense' : ' defenses'); });
  out.iron = b ? Object.assign(nm(b.x.Email), { value: b.label }) : null;

  let cm = {}; try { cm = JSON.parse(PropertiesService.getScriptProperties().getProperty('CLIMB_S' + season) || '{}'); } catch (e) { cm = {}; }
  const climbs = Object.keys(cm).filter(function (e) { return byEmail[e] && byEmail[e].Status === 'Active'; })
    .map(function (e) { return { email: e, v: num_(cm[e].climb), at: cm[e].at }; })
    .sort(function (a, b) { return b.v - a.v || a.at - b.at; });
  out.climber = climbs.length && climbs[0].v > 0 ? Object.assign(nm(climbs[0].email), { value: '+' + climbs[0].v + (climbs[0].v === 1 ? ' spot' : ' spots') }) : null;

  const matches = readTable_(SHEETS.MATCHES).rows.filter(function (m) { return String(m.Season) === season; });
  b = best(matches.filter(function (m) { return m.Margin !== '' && m.Margin !== null; }), function (m) { return num_(m.Margin); },
    function (v) { return 'won by ' + v; });
  out.haymaker = b ? Object.assign(nm(b.x.WinnerEmail), { value: b.label + ' (' + b.x.WinnerRuns + '-' + b.x.LoserRuns + ')' }) : null;

  const ids = {}; matches.forEach(function (m) { if (m.ChallengeID) ids[m.ChallengeID] = true; });
  const thrown = {}, firstAt = {};
  challenges_().rows.forEach(function (c) {
    if (!ids[c.ID] || /Mandatory defense/.test(String(c.Notes))) return;   // a forced title shot isn't a charge thrown
    const e = lc_(c.Challenger);
    thrown[e] = (thrown[e] || 0) + 1;
    firstAt[e] = firstAt[e] || new Date(c.Created).getTime();
  });
  const br = Object.keys(thrown).map(function (e) { return { email: e, v: thrown[e] }; })
    .sort(function (a, b) { return b.v - a.v || firstAt[a.email] - firstAt[b.email]; });
  try {
    const bk = bankrolls_(C);
    const sh = Object.keys(bk.bank).filter(function (e) { return byEmail[e]; }).map(function (e) { return { email: e, v: bk.bank[e] }; })
      .sort(function (a, b) { return b.v - a.v; });
    out.sharp = sh.length ? Object.assign(nm(sh[0].email), { value: sh[0].v + ' BB' }) : null;
    out.bookTable = sh.slice(0, 5).map(function (x) { return Object.assign(nm(x.email), { bank: x.v }); });
    const hu = Object.keys(bk.hustle || {}).filter(function (e) { return byEmail[e] && bk.hustle[e] > 0; }).map(function (e) { return { email: e, v: bk.hustle[e] }; })
      .sort(function (a, b) { return b.v - a.v; });
    out.hustler = hu.length ? Object.assign(nm(hu[0].email), { value: '+' + hu[0].v + ' BB head-to-head' }) : null;
  } catch (e) { out.sharp = null; out.bookTable = []; out.hustler = null; }
  try {
    const ups = readTable_(SHEETS.PAYOUTS).rows.filter(function (x) { return String(x.Season) === season && /^Upset/.test(String(x.Spot)); });
    let gk = null; ups.forEach(function (x) { if (!gk || num_(x.Pts) > num_(gk.Pts)) gk = x; });
    out.giant = gk ? Object.assign(nm(gk.Email) || { name: norm_(gk.Discord) }, { value: String(gk.Spot).replace('Upset ', '') + ' (+' + gk.Pts + ')' }) : null;
    const cap = Number(C.BUSH_MAX_STARS) || 7, stars = {};
    readTable_(SHEETS.STARS).rows.forEach(function (x) { stars[norm_(x.ClubID)] = num_(x.Stars); });
    const bush = cupRows.filter(function (x) { const p = byEmail[x.email]; const st = p ? stars[norm_(p.ClubID)] : 0; return st && st <= cap; });
    out.bush = bush.length && bush[0].pts > 0 ? Object.assign(nm(bush[0].email), { value: bush[0].pts + ' pts (' + stars[norm_(byEmail[bush[0].email].ClubID)] + '★)' }) : null;
  } catch (e) { out.giant = null; out.bush = null; }
  out.brawler = br.length ? Object.assign(nm(br[0].email), { value: br[0].v + (br[0].v === 1 ? ' charge' : ' charges') }) : null;
  return out;
}

function awardsText_(final) {
  const C = cfg_();
  const a = awards_();
  const lines = AWARDS.map(function (w) {
    const x = a[w.key];
    return w.icon + ' **' + (w.key === 'ace' ? 'Season ' + C.SEASON + ' Ace' : w.name) + '**: ' + (x ? esc_(x.name) + ' (*' + esc_(x.club) + '*) · ' + x.value : '*nobody*');
  });
  return (final ? '# 🏆 HOLD THE HILL · SEASON ' + C.SEASON + ' AWARDS\n' : '🏆 **Season ' + C.SEASON + ' award race**\n') +
    lines.join('\n') + (C.PRIZES ? '\n\n🎁 Prizes: ' + esc_(C.PRIZES) : '') + linksLine_(C);
}

// Called hourly. At the buzzer: lock charges and say so. Once every charge in flight is settled and aired
// (or MATCH_HOURS after the buzzer, whichever comes first), post the final awards.
function seasonTick_() {
  const C = cfg_();
  if (!C.STATE_SEASON_OPENED && seasonStart_(C) && seasonOpen_(C) && !seasonOver_(C)) {
    setCfg_('STATE_SEASON_OPENED', now_().toISOString());
    log_('system', 'Season open', 'Season ' + C.SEASON);
    post_('🔔 **Season ' + C.SEASON + ' of Hold the Hill is OPEN!** Charges are live and Brawl points start paying tonight at midnight. Charge the mound. 🥊\n\n' + standingsText_());
  }
  if (C.STATE_SEASON_CLOSED || !seasonOver_(C)) return;
  const end = seasonEnd_(C);
  if (!C.STATE_SEASON_BUZZER) {
    setCfg_('STATE_SEASON_BUZZER', now_().toISOString());
    log_('system', 'Season buzzer', 'Season ' + C.SEASON);
    post_('🔔 **FINAL BUZZER! Season ' + C.SEASON + ' of Hold the Hill is over.** No new charges. ' +
      'Charges already made can still be played and reported; the awards post once they are settled.');
  }
  const open = challenges_().rows.some(function (c) { return OPEN.indexOf(c.Status) >= 0; });
  let queued = []; try { queued = JSON.parse(PropertiesService.getScriptProperties().getProperty('POST_QUEUE') || '[]'); } catch (e) { queued = []; }
  const late = now_() > hoursFrom_(end, C.MATCH_HOURS + 1);
  if ((open || queued.length) && !late) return;
  setCfg_('STATE_SEASON_CLOSED', now_().toISOString());
  log_('system', 'Season closed', 'Season ' + C.SEASON);
  try { settleFutures_(C); } catch (e) { log_('system', 'Futures settle error', String(e)); }
  post_(awardsText_(true));
}

function adminCloseSeason() {
  const ui0 = SpreadsheetApp.getUi();
  if (ui0.alert('Close the season NOW?', 'This ends the season, locks charges, pays out futures and posts the final awards to Discord. It is meant for the end of the season.', ui0.ButtonSet.YES_NO) !== ui0.Button.YES) return;
  withUi_(function () {
    const C = cfg_();
    if (C.STATE_SEASON_CLOSED) return 'Season ' + C.SEASON + ' is already closed.';
    if (!seasonOver_(C)) setCfg_('SEASON_END', Utilities.formatDate(now_(), 'America/Denver', 'yyyy-MM-dd HH:mm'));
    setCfg_('STATE_SEASON_BUZZER', C.STATE_SEASON_BUZZER || now_().toISOString());
    setCfg_('STATE_SEASON_CLOSED', now_().toISOString());
    try { settleFutures_(C); } catch (e) { log_('system', 'Futures settle error', String(e)); }
    post_(awardsText_(true));
    return 'Season ' + C.SEASON + ' closed and the awards were posted.';
  });
}
function adminPostAwardRace() { withUi_(function () { post_(awardsText_(false)); return 'Award race posted.'; }); }

// New season: bump SEASON, clear the season flags, set SEASON_END. The ladder and Ace carry over.
function adminStartNextSeason() {
  withUi_(function () {
    const C = cfg_();
    const n = Number(C.SEASON) + 1;
    setCfg_('SEASON', n);
    setCfg_('STATE_SEASON_BUZZER', '');
    setCfg_('STATE_SEASON_CLOSED', '');
    setCfg_('STATE_SEASON_OPENED', '');
    setCfg_('SEASON_START', '');
    setCfg_('SEASON_END', '');
    const pt = players_(); trackClimb_(pt.rows);
    const reign = currentReign_(readTable_(SHEETS.REIGNS));
    if (reign) {   // the sitting Ace starts a fresh reign in the new season so the Cup starts at zero
      const ace = ace_(pt);
      endReign_('Season ' + C.SEASON + ' ended');
      if (ace) startReign_(ace, false, cfg_());
    }
    post_('🌱 **Season ' + n + ' of Hold the Hill is open.** The ladder carries over. Charge the hill.');
    return 'Season ' + n + ' started. Set SEASON_START and SEASON_END in Config.';
  });
}

function removeFrom_(arr, p) { const i = arr.indexOf(p); if (i >= 0) arr.splice(i, 1); }
function insertAt_(arr, p, rank) {
  removeFrom_(arr, p);
  const i = Math.max(0, Math.min(arr.length, rank - 1));
  arr.splice(i, 0, p);
}
function dropOne_(arr, p) {
  const i = arr.indexOf(p);
  if (i >= 0 && i < arr.length - 1) { arr[i] = arr[i + 1]; arr[i + 1] = p; }
}

function activeMe_(pt, email) {
  const me = findBy_(pt, email);
  if (!me) fail_('This Google account is not registered yet. Pick "' + ACTIONS.REGISTER + '" first.');
  if (me.Status !== 'Active') fail_('Your account is ' + me.Status + '. Contact the commish.');
  return me;
}

function openFor_(ct, email) {
  return ct.rows.find(function (c) {
    return OPEN.indexOf(c.Status) >= 0 && (lc_(c.Challenger) === lc_(email) || lc_(c.Defender) === lc_(email));
  });
}

function currentReign_(rt) {
  return rt.rows.slice().reverse().find(function (r) { return !r.End; });
}

function startReign_(p, revenge, C) {
  const rt = readTable_(SHEETS.REIGNS);
  appendObj_(SHEETS.REIGNS, {
    Reign: rt.rows.length + 1, Season: C.SEASON, Email: p.Email, Discord: p.Discord, Club: p.Club,
    Start: now_(), End: '', Defenses: 0, ReignPts: 0, EndedBy: '', Revenge: revenge ? 'Yes' : '',
  });
  p.Reigns = num_(p.Reigns) + 1;
  return rt.rows.length + 1;
}

function endReign_(endedBy) {
  const rt = readTable_(SHEETS.REIGNS);
  const r = currentReign_(rt);
  if (r) { r.End = now_(); r.EndedBy = endedBy; writeRow_(rt, r); }
  return r;
}

function reward_(n, C) {
  const k = Math.min(n, C.DOUBLE_UNTIL);
  return C.BASE_REWARD * Math.pow(2, k - 1);
}

function inCooldown_(a, b, C) {
  if (!C.COOLDOWN_HOURS) return null;
  const mt = readTable_(SHEETS.MATCHES);
  let last = 0;
  mt.rows.forEach(function (m) {
    const pair = (lc_(m.WinnerEmail) === lc_(a) && lc_(m.LoserEmail) === lc_(b)) ||
      (lc_(m.WinnerEmail) === lc_(b) && lc_(m.LoserEmail) === lc_(a));
    if (pair) last = Math.max(last, new Date(m.Date).getTime());
  });
  if (!last) return null;
  const until = new Date(last + C.COOLDOWN_HOURS * 3600000);
  return until > now_() ? until : null;
}

// Reach higher, win bigger: 1 spot up = just win; 2+ spots up = win by (spots + 1) or more.
function needFor_(gap) { gap = Number(gap) || 1; return gap <= 1 ? 1 : gap + 1; }
function needOf_(c) { const m = /Must win by (\d+)/.exec(String(c.Notes || '')); return m ? Number(m[1]) : 1; }

function newChallenge_(ct, type, status, ch, df, deadline, note) {
  const c = {
    ID: 'C-' + pad_(ct.rows.length + 1), Type: type, Status: status,
    Challenger: ch.Email, ChallengerName: ch.Discord, Defender: df.Email, DefenderName: df.Discord,
    Created: now_(), AcceptedAt: status === 'Accepted' ? now_() : '', Deadline: deadline,
    GameID: '', ChallengerReport: '', DefenderReport: '', CommishScore: '', Notes: note || '',
  };
  appendObj_(SHEETS.CHALLENGES, c);
  return c;
}

// ───────────────────────────── Discord ─────────────────────────────

// Sportsbook posts (bets, daily odds) go to BOOK_WEBHOOK_URL if it's set, otherwise to the main feed.
function postBook_(content) { return post_(content, 'book'); }
function post_(content, where) {
  snapshotBoard_();   // the Hill Board shows what Discord has been told
  let C;
  try { C = cfg_(); } catch (e) { return; }
  const url = webhookFor_(C, where);
  if (!url) { log_('system', 'Discord (no webhook set)', content); return; }
  const chunks = [];
  let s = content;
  while (s.length > 1900) { const cut = s.lastIndexOf('\n', 1900); const at = cut > 0 ? cut : 1900; chunks.push(s.slice(0, at)); s = s.slice(at); }
  chunks.push(s);
  const name = senderFor_(where);
  chunks.forEach(function (chunk) {
    try {
      const code = sendChunk_(url, name, chunk);
      if (code === 429 || code >= 500 || code === 0) queueRetry_(chunk, where, code);   // Discord is blocking us for a bit: try again in a minute
    } catch (e) { queueRetry_(chunk, where, 0); }
  });
}
// One message to one webhook. Returns the HTTP code (0 = it never got there).
function sendChunk_(url, name, chunk) {
  const send = function (text) {
    return UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({ content: text, username: name, allowed_mentions: { parse: ['users'] } }) });
  };
  let res, code;
  try { res = send(chunk); code = res.getResponseCode(); } catch (e) { log_('system', 'Discord error', String(e)); return 0; }
  // 429 from Discord itself says how long to wait. "error code: 1015" is Cloudflare blocking Google's servers for a
  // few minutes: waiting a second won't help, so that one goes straight to the retry queue.
  for (let tries = 0; code === 429 && tries < 2 && !/1015/.test(res.getContentText()); tries++) {
    let wait = 1.5; try { wait = Number(JSON.parse(res.getContentText()).retry_after) || 1.5; } catch (e) { }
    Utilities.sleep(Math.min(8, wait + 0.25) * 1000);
    res = send(chunk); code = res.getResponseCode();
  }
  if (code >= 400 && code !== 429 && code < 500) {   // Discord didn't like the formatting: send a plain version
    const plain = chunk.replace(/\[([^\]]*)\]\(<?([^)>]+)>?\)/g, '$1 $2').replace(/`/g, '');
    if (plain !== chunk) { res = send(plain); code = res.getResponseCode(); }
  }
  if (code >= 300) log_('system', 'Discord error ' + code + (code === 429 || code >= 500 ? ' (will retry)' : ''), String(res.getContentText()).slice(0, 80) + ' · ' + chunk.slice(0, 120));
  return code;
}
function webhookFor_(C, where) {
  return (where === 'book' && norm_(C.BOOK_WEBHOOK_URL)) || (where === 'talk' && norm_(C.TALK_WEBHOOK_URL)) || (where === 'help' && norm_(C.HELP_WEBHOOK_URL)) || norm_(C.DISCORD_WEBHOOK_URL);
}
function senderFor_(where) { return where === 'book' ? 'Hill Sportsbook' : where === 'talk' ? 'The Hill Heckler' : where === 'help' ? 'Hill Help' : 'Hold the Hill'; }
// Blocked posts wait here and go out on the next minute's check, backing off up to 10 minutes, for up to 6 hours.
function queueRetry_(chunk, where, code) {
  const props = PropertiesService.getScriptProperties();
  let q = []; try { q = JSON.parse(props.getProperty('RETRY_POSTS') || '[]'); } catch (e) { q = []; }
  q.push({ text: chunk, where: where || '', n: 0, first: Date.now(), at: Date.now() + 60000 });
  props.setProperty('RETRY_POSTS', JSON.stringify(q.slice(-40)));
}
function flushRetries_() {
  const props = PropertiesService.getScriptProperties();
  let q = []; try { q = JSON.parse(props.getProperty('RETRY_POSTS') || '[]'); } catch (e) { q = []; }
  if (!q.length) return;
  const C = cfg_(), t = Date.now(), keep = [];
  let sent = 0, blocked = false;
  q.forEach(function (x) {
    if (blocked || x.at > t || sent >= 5) { keep.push(x); return; }
    const url = webhookFor_(C, x.where); if (!url) return;
    const code = sendChunk_(url, senderFor_(x.where), x.text);
    if (code >= 200 && code < 300) { sent++; log_('system', 'Discord retry sent', x.text.slice(0, 120)); return; }
    if (code === 429 || code >= 500 || code === 0) {
      blocked = true;   // still blocked: leave the rest for later, in order
      if (t - x.first > 6 * 3600e3) { log_('system', 'Discord gave up', x.text.slice(0, 300)); return; }
      x.n++; x.at = t + Math.min(10, Math.pow(2, x.n)) * 60000; keep.push(x); return;
    }
    // any other error: Discord refused this message for good (already logged)
  });
  props.setProperty('RETRY_POSTS', JSON.stringify(keep));
}

// The last result, posted again (for when Discord dropped it).
function adminRepostLast() {
  withUi_(function () {
    const ms = readTable_(SHEETS.MATCHES).rows; if (!ms.length) return 'No results yet.';
    const m = ms[ms.length - 1];
    post_('🔁 **Result** (posting again): **' + esc_(m.Winner) + '** over **' + esc_(m.Loser) + '**' + (m.WinnerRuns !== '' ? ', ' + m.WinnerRuns + '–' + m.LoserRuns : '') +
      (m.GameID ? ' · game `' + m.GameID + '`' : '') + '\n> ' + esc_(m.Outcome) + (num_(m.Points) ? ' · +' + num_(m.Points) + ' pts' : '') + '\n\n' + standingsText_());
    return 'Posted ' + m.MatchID + ' to the feed again.';
  });
}

// 📊 Live board · 📝 form: the footer on the big posts (results, standings, a new Ace, the season opening, callouts).
function linksLine_(C) {
  C = C || cfg_();
  let board = norm_(C.BOARD_LINK || '');
  if (!board) try { board = ScriptApp.getService().getUrl() || ''; } catch (e) { board = ''; }
  const form = norm_(C.FORM_LINK || ''), bits = [];
  if (board) bits.push('📊 [Live Hill Board](<' + board + '>)');
  if (form) bits.push('📝 [Hill form](<' + form + '>): charge, report, bet');
  return bits.length ? '\n' + bits.join(' · ') : '';
}
function standingsText_() {
  const C = cfg_();
  const pt = players_();
  const ace = ace_(pt);
  const lad = ladder_(pt);
  const reign = currentReign_(readTable_(SHEETS.REIGNS));
  let s = '⛰️ **HOLD THE HILL · Season ' + C.SEASON + '**\n';
  if (ace && reign) {
    s += '♠️ **The Ace:** ' + who_(ace) + '\n';
    s += '> Reign #' + reign.Reign + ' · ' + num_(reign.Defenses) + ' defense(s) · ' + num_(reign.ReignPts) +
      ' reign pts · next defense worth **' + reward_(num_(reign.Defenses) + 1, C) + '**\n';
  } else {
    s += '♠️ **The Ace:** *vacant*\n';
  }
  if (C.STATE_REVENGE_EX_ACE) {
    const ex = findBy_(pt, C.STATE_REVENGE_EX_ACE);
    if (ex) s += "🔥 Ace's Revenge pending: " + esc_(ex.Discord) + ' must win by more than ' + C.STATE_REVENGE_MARGIN + '\n';
  }
  s += '\n**Contenders**\n';
  if (!lad.length) s += '*Nobody on the ladder yet.*\n';
  lad.slice(0, C.LADDER_POST_SIZE).forEach(function (p) {
    s += p.Rank + '. ' + esc_(p.Discord) + ' · *' + esc_(p.Club) + '* (' + num_(p.Wins) + '-' + num_(p.Losses) + ')\n';
  });
  if (lad.length > C.LADDER_POST_SIZE) s += '…and ' + (lad.length - C.LADDER_POST_SIZE) + ' more on the ladder\n';
  return s + linksLine_(C);
}

function notifyReject_(sub, msg) {
  let C;
  try { C = cfg_(); } catch (e) { return; }
  if (String(C.EMAIL_REJECTIONS).toUpperCase() !== 'TRUE' || !sub.email) return;
  try {
    MailApp.sendEmail(sub.email, '❌ Hold the Hill: your ' + (actionOf_(sub.action) || 'form').replace(/\s*\(.*$/, '').toLowerCase() + ' did NOT go through',
      'Your "' + (sub.action || 'form') + '" submission was not accepted:\n\n' + msg +
      '\n\nFix it and submit the form again. Questions? Ask the commish in Discord.');
  } catch (e) { log_('system', 'Email error', String(e)); }
}

// ───────────────────────────── Form submissions ─────────────────────────────

function onHillFormSubmit(e) {
  const resp = e.response;
  const f = {};
  resp.getItemResponses().forEach(function (ir) { f[ir.getItem().getTitle()] = ir.getResponse(); });
  // Forgiving match, so renaming a question on the form doesn't break sign-ups
  const ALIAS = [[/^smallball owner/i, Q.OWNER], [/^club id/i, Q.CLUB_ID], [/^club name/i, Q.CLUB], [/^discord user ?name/i, Q.DISCORD], [/^discord user id/i, Q.DISCORD_ID], [/^club stars/i, Q.STARS]];
  Object.keys(f).forEach(function (k) { ALIAS.forEach(function (a) { if (a[0].test(norm_(k)) && !(a[1] in f)) f[a[1]] = f[k]; }); });
  handleSubmission_({ email: resp.getRespondentEmail(), action: f[Q.ACTION], f: f });
}

// Forgiving match for the action choice, so renaming it on the form ("Charge the hill/Issue challenge") still works.
function actionOf_(raw) {
  const v = norm_(raw);
  for (const k in ACTIONS) if (ACTIONS[k] === v) return v;
  const l = v.toLowerCase();
  if (/discord id|tagged|my id/.test(l)) return ACTIONS.DISCORD_ID;
  if (/who can i|in reach|reach/.test(l)) return ACTIONS.REACH;
  if (/answer a wager|accept|decline/.test(l)) return ACTIONS.WAGER_REPLY;
  if (/wager|head-to-head/.test(l)) return ACTIONS.WAGER;
  if (/revenge/.test(l)) return ACTIONS.REVENGE;
  if (/\bbet\b|sportsbook/.test(l)) return ACTIONS.BET;
  if (/report/.test(l)) return ACTIONS.REPORT;
  if (/charge|challenge/.test(l)) return ACTIONS.CHALLENGE;
  if (/register|sign ?up/.test(l)) return ACTIONS.REGISTER;
  return v;
}

// A rejected form posts in Discord too (people miss emails). Tags the player when we know their Discord ID.
// Goes to HELP_WEBHOOK_URL (#hill-help) if set, otherwise the main feed. Never shows emails.
const ACTION_SHORT = { Reach: '🔎 reach check', Register: '📝 sign-up', Charge: '🥊 charge', Report: '📋 game report', Revenge: "🔥 Ace's Revenge", Bet: '🎰 bet', Wager: '🤝 wager', WagerReply: '🤝 wager answer' };
function rejectPost_(sub, msg) {
  const C = cfg_();
  if (lc_(C.POST_REJECTIONS) === 'false') return;
  let who = '';
  try { const p = findBy_(players_(), sub.email); if (p) who = tag_(p); } catch (e) { }
  if (!who) { const d = norm_(sub.f && sub.f[Q.DISCORD]); who = d ? '**' + esc_(d) + '**' : 'Someone'; }
  const a = actionOf_(sub.action);
  const kind = a === ACTIONS.REGISTER ? ACTION_SHORT.Register : a === ACTIONS.CHALLENGE ? ACTION_SHORT.Charge : a === ACTIONS.REPORT ? ACTION_SHORT.Report :
    a === ACTIONS.REVENGE ? ACTION_SHORT.Revenge : a === ACTIONS.BET ? ACTION_SHORT.Bet : a === ACTIONS.REACH ? ACTION_SHORT.Reach :
    a === ACTIONS.WAGER ? ACTION_SHORT.Wager : a === ACTIONS.WAGER_REPLY ? ACTION_SHORT.WagerReply : 'form';
  const why = String(msg).replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '(email hidden)');
  const url = norm_(C.HELP_WEBHOOK_URL) || norm_(C.DISCORD_WEBHOOK_URL);
  // Recent rejections also show on the Hill Board for an hour
  try {
    const props = PropertiesService.getScriptProperties();
    let rj = []; try { rj = JSON.parse(props.getProperty('REJECTS') || '[]'); } catch (e) { rj = []; }
    rj.push({ at: now_().toISOString(), who: who.replace(/<@\d+>/, '').replace(/\*/g, '') || 'Someone', kind: kind, why: why.slice(0, 200) });
    props.setProperty('REJECTS', JSON.stringify(rj.slice(-8)));
  } catch (e) { }
  if (!url) return;
  const ping = /<@\d+>/.test(who) ? who : '';
  const body = { username: 'Hill Help', allowed_mentions: { parse: ['users'] },
    content: (ping ? ping + ' ' : '') + '❌ **REJECTED**',
    embeds: [{ color: 0xC8102E, title: '❌ ' + kind.replace(/^\S+\s/, '').toUpperCase() + " DIDN'T GO THROUGH",
      description: '**' + who.replace(/<@\d+>/, 'You').replace(/\*/g, '') + '**, the Hill turned this one away:\n\n> ' + why.replace(/\n+/g, '\n> ') +
        '\n\n🔁 **Fix it and send the form again:** ' + (norm_(C.FORM_LINK || '') ? '[Hill form](<' + norm_(C.FORM_LINK) + '>)' : 'the Hill form'),
      footer: { text: 'Nothing was changed. Questions? #hill-help' } }] };
  try {
    const res = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify(body) });
    if (res.getResponseCode() >= 300) post_('⚠️ ' + who + ', your ' + kind + " didn't go through.\n> " + why);
  } catch (e) { post_('⚠️ ' + who + ', your ' + kind + " didn't go through.\n> " + why); }
  try { snapshotBoard_(); } catch (e) { }
}

function handleSubmission_(sub) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (!sub.email) fail_('No verified email came through with the form. The commish needs to set the form to collect verified emails.');
    const C = cfg_();
    switch (actionOf_(sub.action)) {
      case ACTIONS.REGISTER: doRegister_(sub, C); break;
      case ACTIONS.CHALLENGE: doChallenge_(sub, C); break;
      case ACTIONS.REPORT: doReport_(sub, C); break;
      case ACTIONS.REVENGE: doRevenge_(sub, C); break;
      case ACTIONS.BET: doBet_(sub, C); break;
      case ACTIONS.DISCORD_ID: doDiscordId_(sub, C); break;
      case ACTIONS.REACH: doReach_(sub, C); break;
      case ACTIONS.WAGER: doWager_(sub, C); break;
      case ACTIONS.WAGER_REPLY: doWagerReply_(sub, C); break;
      default: fail_('Unknown action.');
    }
  } catch (err) {
    if (err instanceof HillError) {
      log_(sub.email, 'Rejected', (sub.action || '?') + ': ' + err.message);
      notifyReject_(sub, err.message);
      try { rejectPost_(sub, err.message); } catch (e) { }
    } else {
      log_(sub.email, 'ERROR', (sub.action || '?') + ': ' + String(err && err.stack || err));
      notifyReject_(sub, 'Something went wrong on our end. The commish can see the error in the Log tab.');
      try { rejectPost_(sub, 'Something went wrong on our end. The commish has been flagged.'); } catch (e) { }
    }
  } finally {
    lock.releaseLock();
  }
}

const ID_HELP = 'Lets the Hill @tag you in Discord for charges, results, callouts and anything that needs fixing. ' +
  'To find it: Discord → Settings → Advanced → turn on Developer Mode, then right-click (or long-press) your own name → Copy User ID. It is a long number like 123456789012345678.';
function doDiscordId_(sub, C) {
  const pt = players_();
  const me = findBy_(pt, sub.email);
  if (!me) fail_('This Google account is not registered on the Hill yet. Register your club first.');
  const id = norm_(sub.f[Q.MY_ID]).replace(/\D/g, '');
  if (!/^\d{15,21}$/.test(id)) fail_('That is not a Discord user ID. It is a long number (17-19 digits), not your username. ' + ID_HELP);
  me.DiscordID = id;
  writeRow_(pt, me);
  log_(sub.email, 'Discord ID', me.Discord + ' → ' + id);
  post_('🔔 <@' + id + '> you\'re all set: the Hill will tag you for charges, results, callouts and anything that needs fixing.');
}

// 🔎 Who can I charge? Same rules as a real charge, nothing changed. Posts the list in #hill-help, tagging them.
function reachList_(me, C, pt, ct) {
  const reach = Number(C.CHALLENGE_REACH) || 3, ace = ace_(pt);
  const revengeOpen = !!C.STATE_REVENGE_EX_ACE, exAce = revengeOpen ? lc_(C.STATE_REVENGE_EX_ACE) : '';
  const ms = (function () { try { return starsOf_(me); } catch (e) { return null; } })();
  const out = [];
  if (ace && ace !== me) {
    const openTo = moundOpenTo_(C), busy = ct.rows.some(function (c) { return c.Type !== 'Ladder' && OPEN.indexOf(c.Status) >= 0; });
    if (Number(me.Rank) <= openTo) out.push('♠ **The Ace**, ' + esc_(ace.Discord) + ' · ' + esc_(ace.Club) + ' · ' + clubIdTxt_(ace) + ': **title shot, just win**' +
      (busy ? ' ⏳ *(a title fight is already on: wait for it)*' : revengeOpen ? " ⏳ *(the Ace's Revenge is pending)*" : ''));
  }
  ladder_(pt).forEach(function (p) {
    const gap = Number(me.Rank) - Number(p.Rank);
    if (p === me || gap < 1 || gap > reach || p.Status !== 'Active') return;
    let need = needFor_(gap); const full = need;
    let os = null; try { os = starsOf_(p); } catch (e) { }
    const sg = ms != null && os != null ? Math.max(0, os - ms) : 0;
    if (sg) need = Math.max(1, need - sg);
    const why = [];
    if (openFor_(ct, p.Email)) why.push('in a fight right now');
    if (revengeOpen && lc_(p.Email) === exAce) why.push("Ace's Revenge window open");
    let cool = null; try { cool = inCooldown_(me.Email, p.Email, C); } catch (e) { }
    if (cool) why.push('rematch after ' + Utilities.formatDate(cool, 'America/Denver', 'EEE h:mm a') + ' MT');
    out.push('**#' + p.Rank + '** ' + esc_(p.Discord) + ' · ' + esc_(p.Club) + ' · ' + clubIdTxt_(p) + (norm_(p.ClubID) ? ' [scout](<https://play.smallball.com/#/team/' + norm_(p.ClubID) + '>)' : '') + ': ' +
      (need > 1 ? '**win by ' + need + '+**' : '**just win**') + (sg && need < full ? ' *(Giant Killer: ' + sg + '★ underdog discount)*' : '') +
      (why.length ? ' ⏳ *(' + why.join(', ') + ')*' : ''));
  });
  return out;
}
function doReach_(sub, C) {
  const pt = players_(), ct = challenges_();
  const me = findBy_(pt, sub.email);
  if (!me) fail_('This Google account is not registered on the Hill yet. Register your club first, then ask again.');
  if (me.Status !== 'Active') fail_('Your club is not active on the Hill right now. Ask the commish.');
  const ace = ace_(pt);
  let msg;
  if (ace === me) {
    const openTo = moundOpenTo_(C), ch = ladder_(pt).filter(function (p) { return Number(p.Rank) <= openTo; });
    msg = '🔎 ' + tag_(me) + ", you're **the Ace**. You don't charge anybody: you hold the hill. " +
      'Who can charge you right now: ' + (ch.length ? ch.map(function (p) { return '#' + p.Rank + ' ' + esc_(p.Discord); }).join(', ') : 'nobody yet') + '.';
  } else {
    const mine = openFor_(ct, me.Email), list = reachList_(me, C, pt, ct);
    msg = '🔎 ' + tag_(me) + ", you're **#" + me.Rank + '** on the Climb' + (mine ? ' (and already in a fight: finish it before your next charge)' : '') + '. ' +
      (list.length ? 'In reach right now:\n' + list.map(function (x) { return '• ' + x; }).join('\n') : 'Nobody is in reach right now.') +
      '\n🥊 Charge on the ' + (norm_(C.FORM_LINK || '') ? '[Hill form](<' + norm_(C.FORM_LINK) + '>)' : 'Hill form') + ' first. Your Start-the-game link comes in the charge post. A game played before you charge doesn\'t count.';
  }
  log_(sub.email, 'Reach check', me.Discord + ' #' + me.Rank);
  post_(msg, 'help');
}

function doRegister_(sub, C) {
  const f = sub.f;
  const pt = players_();
  const discord = norm_(f[Q.DISCORD]);
  const did = norm_(f[Q.DISCORD_ID]).replace(/\D/g, '');
  const owner = norm_(f[Q.OWNER]);
  const club = norm_(f[Q.CLUB]);
  const clubId = norm_(f[Q.CLUB_ID]);
  if (!discord || !owner || !club || !clubId) fail_('Discord username, owner ID, club name and club ID are all required.');
  const ex = findBy_(pt, sub.email);
  if (ex) fail_('This Google account is already registered as ' + ex.Discord + ' (' + ex.Club + '). One club per owner.');
  if (pt.rows.some(function (p) { return lc_(p.Discord) === lc_(discord); })) fail_('The Discord name "' + discord + '" is already registered.');
  if (pt.rows.some(function (p) { return lc_(p.OwnerID) === lc_(owner); })) fail_('SmallBall owner ' + owner + ' already has a declared club. One club per owner.');
  if (pt.rows.some(function (p) { return lc_(p.ClubID) === lc_(clubId); })) fail_('Club ' + clubId + ' is already registered.');
  const rank = ladder_(pt).length + 1;
  const p = {
    Email: sub.email, Discord: discord, DiscordID: did, OwnerID: owner, Club: club, ClubID: clubId,
    Status: 'Active', Rank: rank, Joined: now_(), Wins: 0, Losses: 0, CareerPts: 0, Defenses: 0, Reigns: 0, BestReignPts: 0,
  };
  appendObj_(SHEETS.PLAYERS, p);
  trackClimb_([p]);
  try { setStars_(p, f[Q.STARS], 'form'); } catch (e) { }
  log_(sub.email, 'Register', discord + ' / ' + club + ' (' + clubId + ') at #' + rank);
  post_('🆕 ' + who_(p) + ' steps onto the Hill at **#' + rank + '**.');
  refreshFormChoices();
}

function doChallenge_(sub, C) {
  const pt = players_();
  const ct = challenges_();
  lockIfOver_(C);
  const me = activeMe_(pt, sub.email);
  const mine = openFor_(ct, me.Email);
  if (mine) fail_('You already have an open challenge (' + mine.ID + ', ' + mine.Status + '). One at a time.');
  const ace = ace_(pt);
  if (ace === me) fail_('The Ace defends the hill and does not issue challenges.');
  const revengeOpen = !!C.STATE_REVENGE_EX_ACE;
  const exAce = revengeOpen ? lc_(C.STATE_REVENGE_EX_ACE) : '';
  if (revengeOpen && lc_(me.Email) === exAce) fail_("You have the Ace's Revenge pending. Declare it, or wait for the window to close, before issuing ladder challenges.");

  const choice = norm_(sub.f[Q.OPPONENT]);
  let type, opp, need = 1;
  if (choice === ACE_CHOICE) {
    if (!ace) fail_('There is no Ace right now. The commish will crown one.');
    const openTo = moundOpenTo_(C);
    if (Number(me.Rank) > openTo) fail_('The mound is open to ' + (openTo === 1 ? 'the #1 contender only' : '#1–#' + openTo) + ' right now. You are #' + me.Rank + '. It opens one more spot each day nobody charges.');
    if (ct.rows.some(function (c) { return c.Type !== 'Ladder' && OPEN.indexOf(c.Status) >= 0; })) fail_('Someone is already charging the mound. Wait for that fight to settle.');
    if (revengeOpen) fail_("The Ace's Revenge is pending. Title challenges reopen once it is settled.");
    type = 'Title'; opp = ace;
  } else {
    opp = pt.rows.find(function (p) { return lc_(p.Discord) === lc_(choice) || lc_(oppLabel_(p)) === lc_(choice) || lc_(choice.split(' · ')[1] || '') === lc_(p.Discord); });
    if (!opp || opp.Status !== 'Active') fail_('Opponent "' + choice + '" was not found or is not active.');
    if (opp === me) fail_("You can't challenge yourself.");
    if (opp === ace) fail_('To challenge the Ace, choose the ♠ THE ACE option.');
    if (revengeOpen && lc_(opp.Email) === exAce) fail_("The dethroned Ace can't be challenged while their Ace's Revenge window is open.");
    const gap = Number(me.Rank) - Number(opp.Rank);
    if (gap < 1) fail_('You can only challenge players ranked above you (you are #' + me.Rank + ', they are #' + opp.Rank + ').');
    if (gap > C.CHALLENGE_REACH) fail_('You can challenge up to ' + C.CHALLENGE_REACH + ' spots above you (you are #' + me.Rank + ', they are #' + opp.Rank + ').');
    type = 'Ladder';
    need = needFor_(gap);
  }
  const theirs = openFor_(ct, opp.Email);
  if (theirs) fail_(opp.Discord + ' is already in an open challenge. Try again once it is settled.');
  const cool = inCooldown_(me.Email, opp.Email, C);
  if (cool) fail_('You and ' + opp.Discord + ' played recently. Rematch allowed after ' + cool.toUTCString() + '.');

  let ms = null, os = null;
  try { ms = starsOf_(me); os = starsOf_(opp); } catch (e) { }
  const starGap = ms != null && os != null ? Math.max(0, os - ms) : 0, fullNeed = need;
  if (type === 'Ladder' && starGap) need = Math.max(1, need - starGap);
  const deadline = hoursFrom_(now_(), C.MATCH_HOURS);
  const note = [need > 1 ? 'Must win by ' + need + '+' : '', ms != null && os != null ? 'Stars ' + ms + 'v' + os : ''].filter(Boolean).join(' · ');
  const c = newChallenge_(ct, type, 'Accepted', me, opp, deadline, note);
  log_(sub.email, 'Challenge', c.ID + ' ' + type + ': ' + me.Discord + ' → ' + opp.Discord);
  const lineTxt = openLine_(c, me, opp, C);
  try { if (bookOn_(C)) { const Lc = readTable_(SHEETS.LINES).rows.filter(function (x) { return x.ChallengeID === c.ID; })[0]; betsClosedPost_(c, me, opp, Lc); } } catch (e) { }
  try { potTick_(true); } catch (e) { }
  if (type === 'Title') {
    post_('👑 **' + esc_(me.Discord).toUpperCase() + ' CHARGES THE MOUND!** ' + who_(me) + (Number(me.Rank) === 1 ? ', the #1 contender,' : ', from #' + me.Rank + ' through the open mound,') + ' is coming for the hill. ' + tag_(opp) +
      ' holds it.' + '\n🎯 **' + esc_(me.Discord) + ', start a BigLeague game vs ' + clubIdTxt_(opp) + ' (' + esc_(opp.Club) + ') within the hour.** You\'re the visitor. Nothing to report: the Hill finds it.' + ' Deadline ' + ts_(deadline) + '.' + startLine_(me, opp) + lineTxt);
  } else {
    post_('🥊 ' + who_(me) + ' (#' + me.Rank + ') charges the hill at ' + who_(opp) + ' (#' + opp.Rank + ')! Benches clear. ' +
      (ms != null && os != null ? '(' + starTag_(ms) + ' vs ' + starTag_(os) + ') ' : '') +
      (starGap && fullNeed > need ? '🗡️ Giant Killer rule: down ' + starGap + '★, so ' + esc_(me.Discord) + ' needs ' + (need > 1 ? 'only **' + need + '+ runs**' : '**any win**') + ' instead of ' + fullNeed + '+. ' :
        need > 1 ? 'Reaching ' + (Number(me.Rank) - Number(opp.Rank)) + ' spots up, ' + esc_(me.Discord) + ' must win by **' + need + '+ runs** to climb. ' : '') +
      '\n🎯 **' + esc_(me.Discord) + ', start a BigLeague game vs ' + clubIdTxt_(opp) + ' (' + esc_(opp.Club) + ') within the hour.** You\'re the visitor. Nothing to report: the Hill finds it.' + ' Deadline ' + ts_(deadline) + '.' + startLine_(me, opp) + lineTxt);
  }
}

function allowedKinds_(C) { return norm_(C.ALLOWED_KINDS).toLowerCase().split(/[\s,]+/).filter(Boolean); }

// One step: the game ID, its type and the score. The first report locks in the game ID ("first game counts":
// one game per challenge); the other player's report has to name the same game. Matching scores settle it.
function doReport_(sub, C) {
  const pt = players_();
  const ct = challenges_();
  const me = activeMe_(pt, sub.email);
  const c = openFor_(ct, me.Email);
  if (!c) fail_('You have no open challenge.');
  if (c.Status === 'Review') fail_('This challenge is with the commish for review.');
  if (/Auto-detected/.test(String(c.Notes))) fail_('Already done: game ' + c.GameID + ' was picked up from SmallBall automatically. The result posts once it has aired.');
  const gid = norm_(sub.f[Q.GAME_ID]).replace(/[\s#]+/g, '');
  if (!/^\d+$/.test(gid)) fail_('SmallBall game IDs are numbers (for example 6496). Copy it from the game list.');
  const kind = KINDS[norm_(sub.f[Q.KIND])] || '';
  if (allowedKinds_(C).indexOf(kind) < 0) fail_('That game type does not count in Hold the Hill. Allowed: ' + allowedKinds_(C).join(', ') + '.');
  let my = norm_(sub.f[Q.MY_RUNS]), op = norm_(sub.f[Q.OPP_RUNS]);
  if (!/^\d+$/.test(my) || !/^\d+$/.test(op)) fail_('Runs must be whole numbers.');
  const chP = findBy_(pt, c.Challenger), dfP = findBy_(pt, c.Defender);
  const official = chP && dfP && norm_(chP.ClubID) && norm_(dfP.ClubID) ? checkGame_(gid, chP, dfP) : null;
  if (official) {   // SmallBall's own score wins over what was typed
    if (allowedKinds_(C).indexOf(official.kind) < 0) fail_('Game ' + gid + ' is a ' + official.kind + ' game on SmallBall, which does not count in Hold the Hill.');
    const meCh = lc_(c.Challenger) === lc_(me.Email);
    my = String(meCh ? official.away_runs : official.home_runs); op = String(meCh ? official.home_runs : official.away_runs);
  }
  if (!c.GameID) {
    const usedC = ct.rows.some(function (x) { return x !== c && norm_(x.GameID) === gid; });
    const usedM = readTable_(SHEETS.MATCHES).rows.some(function (m) { return norm_(m.GameID) === gid; });
    if (usedC || usedM) fail_('Game ' + gid + ' has already been used. Every challenge needs its own game.');
    c.GameID = gid; c.GameKind = kind; c.FirstReport = now_(); c.Status = 'Started';
  } else if (norm_(c.GameID) !== gid) {
    c.Status = 'Review';
    c.Notes = (c.Notes ? c.Notes + ' · ' : '') + 'Players reported different games: ' + c.GameID + ' and ' + gid;
    writeRow_(ct, c);
    post_('⚠️ ' + esc_(c.ChallengerName) + ' and ' + esc_(c.DefenderName) + ' reported different game IDs. The commish will review.');
    return;
  }
  const isCh = lc_(c.Challenger) === lc_(me.Email);
  const score = isCh ? my + '-' + op : op + '-' + my; // always challenger-defender
  if (isCh) c.ChallengerReport = score; else c.DefenderReport = score;
  const other = parseScore_(isCh ? c.DefenderReport : c.ChallengerReport);
  log_(sub.email, 'Report', c.ID + ' game ' + gid + ' ' + score + ' (challenger-defender)');
  if (!other) {
    writeRow_(ct, c);
    const opp = findBy_(pt, isCh ? c.Defender : c.Challenger);
    if (isCh) {
      // The challenger's report is enough. It settles once the game has aired (POST_DELAY_MINUTES), unless the
      // defender reports a different score before then, which sends it to the commish.
      const at = hoursFrom_(new Date(c.FirstReport || now_()), num_(C.POST_DELAY_MINUTES) / 60);
      post_('🎲 ' + tag_(me) + ' reported game `' + gid + '` vs ' + tag_(opp) + '. The result posts once it has aired, ' + rel_(at) +
        '. ' + esc_(opp.Discord) + ', only report it if the score is wrong. (No score here: no spoilers.)');
    } else {
      post_('🎲 ' + tag_(me) + ' reported game `' + gid + '` vs ' + tag_(opp) + '. ' + esc_(opp.Discord) + ', as the challenger, your report settles it: report it by ' + ts_(c.Deadline) + '.');
    }
    return;
  }
  const mine = parseScore_(score);
  if (other[0] === mine[0] && other[1] === mine[1]) {
    writeRow_(ct, c);
    finalize_(ct, c, mine[0], mine[1], 'auto');
  } else {
    c.Status = 'Review';
    c.Notes = 'Scores disagree: challenger says ' + c.ChallengerReport + ', defender says ' + c.DefenderReport;
    writeRow_(ct, c);
    post_('⚠️ Score reports for ' + esc_(c.ChallengerName) + ' vs ' + esc_(c.DefenderName) + ' (game `' + c.GameID + '`) do not match. The commish will review.');
  }
}

function doRevenge_(sub, C) {
  const pt = players_();
  const ct = challenges_();
  const me = activeMe_(pt, sub.email);
  lockIfOver_(C);
  if (!C.STATE_REVENGE_EX_ACE || lc_(C.STATE_REVENGE_EX_ACE) !== lc_(me.Email)) fail_("You don't have an Ace's Revenge available.");
  if (!C.STATE_REVENGE_DEADLINE) fail_("You've already declared the Ace's Revenge.");
  if (new Date(C.STATE_REVENGE_DEADLINE) < now_()) fail_("Your Ace's Revenge window has closed.");
  const ace = ace_(pt);
  if (!ace) fail_('There is no Ace to challenge.');
  if (openFor_(ct, me.Email)) fail_('You already have an open challenge.');
  if (openFor_(ct, ace.Email)) fail_('The Ace is in an open challenge. Contact the commish.');
  const deadline = hoursFrom_(now_(), C.MATCH_HOURS);
  const c = newChallenge_(ct, 'Revenge', 'Accepted', me, ace, deadline, 'Must win by more than ' + C.STATE_REVENGE_MARGIN);
  setCfg_('STATE_REVENGE_DEADLINE', '');
  log_(sub.email, 'Revenge declared', c.ID);
  post_("🔥 **THE ACE'S REVENGE!** " + who_(me) + ' wants the hill back from ' + who_(ace) + '. ' +
    esc_(me.Discord) + ' must win by **more than ' + C.STATE_REVENGE_MARGIN + '** run(s).\n🎯 **Start a BigLeague game vs ' + clubIdTxt_(ace) + ' (' + esc_(ace.Club) + ') within the hour.** You\'re the visitor. Deadline ' + ts_(deadline) + '.' + openLine_(c, me, ace, C));
}

// ───────────────────────────── Finalizing a result ─────────────────────────────

function finalize_(ct, c, cr, dr, source) {
  const C = cfg_();
  const pt = players_();
  const ch = findBy_(pt, c.Challenger);
  const df = findBy_(pt, c.Defender);
  if (!ch || !df) fail_('Player record missing for challenge ' + c.ID);
  const forfeit = source === 'forfeit';
  if (!forfeit && cr === dr) return tie_(ct, c, cr, source, C, pt, ch, df);
  const chWins = forfeit ? true : cr > dr;
  const W = chWins ? ch : df, L = chWins ? df : ch;
  const margin = forfeit ? '' : Math.abs(cr - dr);
  const scoreTxt = forfeit ? 'by forfeit' : Math.max(cr, dr) + '-' + Math.min(cr, dr);
  const lad = ladder_(pt);
  const extra = [];
  let outcome = '', points = 0, headline = '';

  if (c.Type === 'Ladder') {
    const defRank = Number(df.Rank);
    const need = needOf_(c);
    if (chWins && !forfeit && margin < need) {
      outcome = 'Won by ' + margin + ', needed ' + need + '+: no change';
      headline = '😤 ' + who_(ch) + ' beats ' + who_(df) + ' ' + scoreTxt + ' but needed to win by **' + need + '+** reaching that high. ' +
        who_(df) + ' keeps **#' + defRank + '**. Nobody moves.';
    } else if (chWins && Number(ch.Rank) < defRank) {   // another result already moved them past each other
      outcome = 'Won, already above: no change';
      headline = '📈 ' + who_(ch) + ' beats ' + who_(df) + ' ' + scoreTxt + '. Other results already put ' + who_(ch) + ' above them, so nobody moves.';
    } else if (chWins) {
      insertAt_(lad, ch, defRank);
      outcome = ch.Discord + ' takes #' + defRank;
      headline = '📈 ' + who_(ch) + ' beats ' + who_(df) + ' ' + scoreTxt + ' and climbs to **#' + defRank + '**.';
    } else {
      dropOne_(lad, ch);
      outcome = df.Discord + ' holds #' + defRank;
      headline = '🧱 ' + who_(df) + ' holds **#' + defRank + '**, beating ' + who_(ch) + ' ' + scoreTxt + '.';
    }
    setLadder_(lad);
  } else if (c.Type === 'Title') {
    const rt = readTable_(SHEETS.REIGNS);
    const reign = currentReign_(rt);
    if (!reign) fail_('No active reign on file. The commish should crown the Ace again.');
    if (!chWins) {
      const n = num_(reign.Defenses) + 1;
      points = reward_(n, C);
      const before = num_(reign.ReignPts);
      reign.Defenses = n;
      reign.ReignPts = before + points;
      writeRow_(rt, reign);
      df.CareerPts = num_(df.CareerPts) + points;
      df.Defenses = num_(df.Defenses) + 1;
      df.BestReignPts = Math.max(num_(df.BestReignPts), reign.ReignPts);
      dropOne_(lad, ch);
      setLadder_(lad);
      outcome = 'Defense #' + n + ' (+' + points + ')';
      headline = '♠️ **The Ace holds the hill!** ' + who_(df) + ' beats ' + who_(ch) + ' ' + scoreTxt +
        '. Defense #' + n + ', **+' + points + '** pts (reign total ' + reign.ReignPts + ').';
      if (before < C.REVENGE_THRESHOLD && reign.ReignPts >= C.REVENGE_THRESHOLD) {
        extra.push('🛡️ ' + esc_(df.Discord) + ' has passed ' + C.REVENGE_THRESHOLD + " reign points and earned the **Ace's Revenge** if dethroned.");
      }
    } else {
      const oldPts = num_(reign.ReignPts);
      reign.End = now_();
      reign.EndedBy = forfeit ? 'Forfeit to ' + ch.Discord : ch.Discord;
      writeRow_(rt, reign);
      removeFrom_(lad, ch);
      ch.Rank = 0;
      insertAt_(lad, df, C.EX_ACE_RANK);
      setLadder_(lad);
      startReign_(ch, false, C);
      outcome = forfeit ? 'Takes the hill by forfeit' : 'Takes the hill';
      headline = '👑 **NEW ACE!** ' + who_(ch) + ' takes the hill from ' + who_(df) + ' ' + scoreTxt + '. ' +
        esc_(df.Discord) + "'s reign ends at " + num_(reign.Defenses) + ' defense(s), ' + oldPts + ' pts.';
      if (!forfeit && oldPts >= C.REVENGE_THRESHOLD) {
        const dl = hoursFrom_(now_(), C.REVENGE_DECLARE_HOURS);
        setCfg_('STATE_REVENGE_EX_ACE', df.Email);
        setCfg_('STATE_REVENGE_MARGIN', String(margin));
        setCfg_('STATE_REVENGE_DEADLINE', dl.toISOString());
        extra.push('🔥 ' + tag_(df) + " has earned the **Ace's Revenge**: declare it by " + ts_(dl) +
          ' and win by more than ' + margin + ' to take the hill back.');
      }
    }
    setCfg_('STATE_LAST_TITLE_ACTIVITY', now_().toISOString());
  } else if (c.Type === 'Revenge') {
    const need = num_(C.STATE_REVENGE_MARGIN);
    if (chWins && margin > need) {
      const r = endReign_("Ace's Revenge by " + ch.Discord);
      removeFrom_(lad, ch);
      ch.Rank = 0;
      insertAt_(lad, df, 1);
      setLadder_(lad);
      startReign_(ch, true, C);
      outcome = "Ace's Revenge: reclaims the hill";
      headline = "🔥 **THE ACE'S REVENGE!** " + who_(ch) + ' beats ' + who_(df) + ' ' + scoreTxt +
        ' and takes the hill back. A new reign begins.';
    } else {
      dropOne_(lad, ch);
      setLadder_(lad);
      outcome = chWins ? 'Revenge fell short (won by ' + margin + ', needed more than ' + need + ')' : 'Revenge denied';
      headline = chWins
        ? '😤 ' + who_(ch) + ' wins ' + scoreTxt + ' but needed to win by more than ' + need + '. ' + who_(df) + ' keeps the hill.'
        : '♠️ ' + who_(df) + ' turns back the revenge, ' + scoreTxt + ', and keeps the hill.';
    }
    clearRevenge_();
    setCfg_('STATE_LAST_TITLE_ACTIVITY', now_().toISOString());
  }

  W.Wins = num_(W.Wins) + 1;
  L.Losses = num_(L.Losses) + 1;
  savePlayers_(pt);

  c.Status = forfeit ? 'Forfeit' : 'Done';
  if (forfeit) c.Notes = (c.Notes ? c.Notes + ' · ' : '') + 'Not accepted in time';
  writeRow_(ct, c);

  const mt = readTable_(SHEETS.MATCHES);
  appendObj_(SHEETS.MATCHES, {
    MatchID: 'M-' + pad_(mt.rows.length + 1), Date: now_(), Season: C.SEASON, ChallengeID: c.ID, Type: c.Type,
    GameID: c.GameID, Winner: W.Discord, WinnerEmail: W.Email, Loser: L.Discord, LoserEmail: L.Email,
    WinnerRuns: forfeit ? '' : Math.max(cr, dr), LoserRuns: forfeit ? '' : Math.min(cr, dr),
    Margin: margin, Outcome: outcome, Points: points, Source: source,
  });
  log_('system', 'Result', c.ID + ' ' + c.Type + ': ' + outcome + ' [' + source + ']');
  if (!forfeit) { try { const ub = upsetBonus_(c, W, L, chWins); if (ub) extra.push(ub); } catch (e) { log_('system', 'Upset error', String(e)); } }
  const bk = bookSettle_(c, forfeit ? 0 : cr, forfeit ? 0 : dr, forfeit);
  if (bk) extra.push(bk);
  try { const pk = potSettle_(c, cr, dr, forfeit); if (pk) extra.push(pk); } catch (e) { log_('system', 'Matchup settle error', String(e)); }
  try { payoutPost_(c, cr, dr, forfeit); } catch (e) { }
  postResult_(c, headline + (extra.length ? '\n' + extra.join('\n') : ''));
}

// Ties happen in SmallBall. HOLD: the defender (or the Ace) keeps the spot, nobody moves, no points.
// REPLAY: the challenge stays open and the two play another game (a new game ID).
function tie_(ct, c, runs, source, C, pt, ch, df) {
  const score = runs + '-' + runs;
  if (lc_(C.TIE_RULE) === 'replay') {
    c.Notes = (c.Notes ? c.Notes + ' · ' : '') + 'Tied ' + score + ' in game ' + c.GameID + ', replay';
    c.GameID = ''; c.GameKind = ''; c.FirstReport = ''; c.ChallengerReport = ''; c.DefenderReport = ''; c.CommishScore = '';
    c.Status = 'Accepted'; c.Deadline = hoursFrom_(now_(), C.MATCH_HOURS);
    writeRow_(ct, c);
    log_('system', 'Tie (replay)', c.ID + ' ' + score);
    post_('🤝 ' + who_(ch) + ' and ' + who_(df) + ' need a replay. Play a new game and report it by ' + ts_(c.Deadline) + '.');
    return;
  }
  if (c.Type === 'Revenge') clearRevenge_();
  if (c.Type !== 'Ladder') setCfg_('STATE_LAST_TITLE_ACTIVITY', now_().toISOString());
  c.Status = 'Done'; c.Notes = (c.Notes ? c.Notes + ' · ' : '') + 'Tie ' + score + ': defender holds';
  writeRow_(ct, c);
  const mt = readTable_(SHEETS.MATCHES);
  appendObj_(SHEETS.MATCHES, {
    MatchID: 'M-' + pad_(mt.rows.length + 1), Date: now_(), Season: C.SEASON, ChallengeID: c.ID, Type: c.Type,
    GameID: c.GameID, Winner: df.Discord, WinnerEmail: df.Email, Loser: ch.Discord, LoserEmail: ch.Email,
    WinnerRuns: runs, LoserRuns: runs, Margin: 0, Outcome: 'Tie: ' + df.Discord + ' holds', Points: 0, Source: source,
  });
  log_('system', 'Tie (hold)', c.ID + ' ' + score);
  const head = c.Type === 'Ladder' ? '🤝 ' + who_(ch) + ' and ' + who_(df) + ' tie ' + score + '. ' + esc_(df.Discord) + ' holds **#' + df.Rank + '**.'
    : c.Type === 'Revenge' ? "🤝 The Ace's Revenge ends in a " + score + ' tie. ' + who_(df) + ' keeps the hill.'
    : '🤝 ' + who_(df) + ' and ' + who_(ch) + ' tie ' + score + '. **The Ace holds the hill** (a tie earns no defense points).';
  const bk = bookSettle_(c, runs, runs, false);
  let pk = ''; try { pk = potSettle_(c, runs, runs, false); } catch (e) { }
  try { payoutPost_(c, runs, runs, false); } catch (e) { }
  postResult_(c, head + (bk ? '\n' + bk : '') + (pk ? '\n' + pk : ''));
}

// Results wait until the game has aired (POST_DELAY_MINUTES after the first report), then post with the
// standings as they are at that moment. A queue in the script's properties; flushPosts runs every 5 minutes.
function postResult_(c, text, where) {
  const C = cfg_();
  const first = c && c.FirstReport ? new Date(c.FirstReport).getTime() : 0;
  const at = first ? first + num_(C.POST_DELAY_MINUTES) * 60000 : 0;
  if (!at || at <= now_().getTime()) { post_(where === 'book' ? text : text + '\n\n' + standingsText_(), where); return; }
  const props = PropertiesService.getScriptProperties();
  let q = []; try { q = JSON.parse(props.getProperty('POST_QUEUE') || '[]'); } catch (e) { q = []; }
  q.push({ at: at, text: text, where: where || '' });
  props.setProperty('POST_QUEUE', JSON.stringify(q));
  log_('system', 'Result queued', 'posts at ' + new Date(at).toISOString());
}

// A challenger's report stands on its own once the game has aired, unless the defender disputed it.
function settleChallengerReports_() {
  const C = cfg_();
  const ct = challenges_();
  const t = now_().getTime();
  ct.rows.filter(function (c) { return c.Status === 'Started' && parseScore_(c.ChallengerReport) && !norm_(c.DefenderReport) && c.FirstReport; }).forEach(function (c) {
    if (new Date(c.FirstReport).getTime() + num_(C.POST_DELAY_MINUTES) * 60000 > t) return;
    const s = parseScore_(c.ChallengerReport);
    try { finalize_(challenges_(), Object.assign(c, {}), s[0], s[1], /Auto-detected/.test(String(c.Notes)) ? 'SmallBall (auto)' : 'challenger report'); }
    catch (e) { log_('system', 'ERROR (settle)', c.ID + ': ' + String(e && e.stack || e)); }
  });
}

// ⛰️ menu: do everything the timed checks do, right now, and say what happened.
function adminCheckNow() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const count = function () {
    const rows = challenges_().rows;
    return { open: rows.filter(function (c) { return c.Status === 'Accepted'; }).length,
      found: rows.filter(function (c) { return c.Status === 'Started'; }).length,
      done: rows.filter(function (c) { return c.Status === 'Done'; }).length };
  };
  const before = count();
  let qb = 0; try { qb = JSON.parse(props.getProperty('POST_QUEUE') || '[]').length; } catch (e) { }
  props.deleteProperty('FLUSH5_AT');   // run the 5-minute jobs too
  try { flushPosts(); } catch (e) { ui.alert('Error: ' + e); return; }
  try { potTick_(true); } catch (e) { }
  try { futuresTick_(true); } catch (e) { }
  try { snapshotBoard_(); } catch (e) { }
  const after = count();
  let qa = 0, next = null;
  try { const q = JSON.parse(props.getProperty('POST_QUEUE') || '[]'); qa = q.length; q.forEach(function (x) { if (!next || x.at < next) next = x.at; }); } catch (e) { }
  const C = cfg_();
  const lines = [
    '🔄 Checked SmallBall.',
    '📡 Games found just now: ' + Math.max(0, after.found - before.found + (after.done - before.done)),
    '🏁 Results settled just now: ' + Math.max(0, after.done - before.done),
    '📨 Posts sent from the queue: ' + Math.max(0, qb - qa + Math.max(0, after.done - before.done) * 0),
    '',
    '⏳ Charges still waiting for a game: ' + after.open,
    '📺 Games found, waiting to air: ' + after.found + (next ? ' (next post ' + Utilities.formatDate(new Date(next), 'America/Denver', 'h:mm a') + ')' : ''),
    '',
    'Last SmallBall check: ' + (C.STATE_AUTO_STATUS || 'not yet'),
    'Hill Board and odds refreshed.'];
  ui.alert(lines.join('\n'));
}

// Runs every minute. Light work every minute (find games, settle, post what's due); the rest every 5 minutes.
function flushPosts() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;   // another run is still going; the next minute will catch up
  try {
    const props = PropertiesService.getScriptProperties();
    const t = now_().getTime();
    let anyOpen = true;
    try { anyOpen = challenges_().rows.some(function (c) { return OPEN.indexOf(c.Status) >= 0; }); } catch (e) { }
    if (anyOpen) {
      try { autoDetect_(); } catch (err) { log_('system', 'ERROR (auto-detect)', String(err && err.stack || err)); }
      try { settleChallengerReports_(); } catch (err) { log_('system', 'ERROR (settle)', String(err && err.stack || err)); }
    }
    try { flushRetries_(); } catch (err) { log_('system', 'ERROR (retries)', String(err && err.stack || err)); }
    let q = []; try { q = JSON.parse(props.getProperty('POST_QUEUE') || '[]'); } catch (e) { q = []; }
    const due = q.filter(function (x) { return x.at <= t; });
    if (due.length) {
      props.setProperty('POST_QUEUE', JSON.stringify(q.filter(function (x) { return x.at > t; })));
      due.forEach(function (x) { post_(x.where === 'book' ? x.text : x.text + '\n\n' + standingsText_(), x.where); });
    }
    if (t - Number(props.getProperty('FLUSH5_AT') || 0) >= 290000) {
      props.setProperty('FLUSH5_AT', String(t));
      try { tick_(); } catch (err) { log_('system', 'ERROR (deadlines)', String(err && err.stack || err)); }
      try { bookChoicesTick_(); } catch (err) { log_('system', 'ERROR (book)', String(err && err.stack || err)); }
      try { wagersTick_(); } catch (err) { log_('system', 'ERROR (wagers)', String(err && err.stack || err)); }
      try { flushLog_(); } catch (err) { }
    }
  } finally { lock.releaseLock(); }
}

function voidChallenge_(ct, c, why) {
  const bk = bookSettle_(c, 0, 0, true);
  if (bk) why += ' ' + bk;
  try { const pk = potSettle_(c, 0, 0, true); if (pk) why += ' ' + pk; } catch (e) { }
  c.Status = 'Void';
  c.Notes = (c.Notes ? c.Notes + ' · ' : '') + why;
  writeRow_(ct, c);
  log_('system', 'Void', c.ID + ': ' + why);
  if (c.Type === 'Revenge') {
    clearRevenge_();
    post_("🕳️ The Ace's Revenge (" + esc_(c.ChallengerName) + ' vs ' + esc_(c.DefenderName) + ') is void: ' + why + '. The Ace keeps the hill.');
  } else {
    post_('🕳️ Challenge ' + esc_(c.ChallengerName) + ' vs ' + esc_(c.DefenderName) + ' is void: ' + why + '.');
  }
}

// ───────────────────────────── Hourly deadline check ─────────────────────────────

function hourlyTick() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { payday_(); tick_(); seasonTick_(); futuresTick_(); starsDaily_(); potExpire_(); potTick_(); oddsBoardTick_(); nudgeTick_(); }
  catch (err) { log_('system', 'ERROR (hourly)', String(err && err.stack || err)); }
  finally { lock.releaseLock(); }
}

function tick_() {
  const t = now_();
  const ct = challenges_();
  ct.rows.filter(function (c) { return ['Pending', 'Accepted', 'Started'].indexOf(c.Status) >= 0; }).forEach(function (c) {
    if (!c.Deadline || new Date(c.Deadline) > t) return;
    if (c.Status === 'Pending') {
      finalize_(ct, c, null, null, 'forfeit');   // only challenges made by v1.0 can still be Pending
    } else if (c.Status === 'Accepted') {
      voidChallenge_(ct, c, 'no game was reported before the deadline');
    } else {
      const a = parseScore_(c.ChallengerReport), b = parseScore_(c.DefenderReport);
      const one = a && !b ? a : (b && !a ? b : null);
      if (one) {
        c.Notes = (c.Notes ? c.Notes + ' · ' : '') + 'Only one player reported; their score stands';
        finalize_(ct, c, one[0], one[1], 'single report');
      } else if (!a && !b) {
        c.Status = 'Review';
        c.Notes = (c.Notes ? c.Notes + ' · ' : '') + 'No scores reported by the deadline';
        writeRow_(ct, c);
        log_('system', 'Review', c.ID + ' no scores reported');
      }
    }
  });

  // Revenge window that was never declared
  let C = cfg_();
  if (C.STATE_REVENGE_EX_ACE && C.STATE_REVENGE_DEADLINE && new Date(C.STATE_REVENGE_DEADLINE) < t) {
    const ex = findBy_(players_(), C.STATE_REVENGE_EX_ACE);
    clearRevenge_();
    log_('system', 'Revenge expired', C.STATE_REVENGE_EX_ACE);
    post_("⌛ The Ace's Revenge window for " + esc_(ex ? ex.Discord : 'the former Ace') + ' has closed. Title challenges are open again.');
  }

  // Open mound: announce each time it opens one more spot
  C = cfg_();
  const pt0 = players_();
  if (ace_(pt0) && seasonOpen_(C) && !seasonOver_(C) && !C.STATE_REVENGE_EX_ACE) {
    const to = moundOpenTo_(C);
    const was = Number(C.STATE_MOUND_OPEN_TO || 1);
    const titleOpen = challenges_().rows.some(function (c) { return c.Type !== 'Ladder' && OPEN.indexOf(c.Status) >= 0; });
    if (to !== was) {
      setCfg_('STATE_MOUND_OPEN_TO', to);
      if (to > was && !titleOpen) {
        const lad = ladder_(pt0);
        const who = lad.filter(function (p) { return Number(p.Rank) <= to; }).map(function (p) { return tag_(p); }).join(', ');
        post_('⏰ **The mound is open to #1–#' + to + '.** Nobody has charged the Ace in ' + (to - 1) + (to === 2 ? ' day' : ' days') +
          '. ' + who + ': any of you can charge the hill. Any win takes it.');
      }
    }
  }
}

// ───────────────────────────── Commish tools ─────────────────────────────

function crownAce_(email, actor) {
  const C = cfg_();
  const pt = players_();
  const ct = challenges_();
  const p = findBy_(pt, email);
  if (!p || p.Status !== 'Active') fail_('That player is not active.');
  const cur = ace_(pt);
  if (cur === p) fail_(p.Discord + ' is already the Ace.');
  if (openFor_(ct, p.Email) || (cur && openFor_(ct, cur.Email))) fail_('Settle or void the open challenges involving this player and the current Ace first.');
  const lad = ladder_(pt);
  if (cur) { endReign_('Commish'); insertAt_(lad, cur, 1); }
  removeFrom_(lad, p);
  p.Rank = 0;
  setLadder_(lad);
  startReign_(p, false, C);
  savePlayers_(pt);
  clearRevenge_();
  setCfg_('STATE_LAST_TITLE_ACTIVITY', now_().toISOString());
  log_(actor || 'commish', 'Crown Ace', p.Discord);
  post_('👑 ' + who_(p) + ' is crowned **the Ace**. The hill is theirs to hold.\n\n' + standingsText_());
}

function suspendPlayer_(email, actor) {
  const pt = players_();
  const ct = challenges_();
  const p = findBy_(pt, email);
  if (!p) fail_('Player not found.');
  ct.rows.filter(function (c) { return OPEN.indexOf(c.Status) >= 0 && (lc_(c.Challenger) === lc_(email) || lc_(c.Defender) === lc_(email)); })
    .forEach(function (c) { voidChallenge_(ct, c, 'player suspended'); });
  const wasAce = ace_(pt) === p;
  if (wasAce) endReign_('Suspended');
  const pt2 = players_();
  const p2 = findBy_(pt2, email);
  p2.Status = 'Suspended';
  p2.Rank = '';
  setLadder_(ladder_(pt2));
  savePlayers_(pt2);
  log_(actor || 'commish', 'Suspend', p2.Discord + (wasAce ? ' (was Ace, hill now vacant)' : ''));
  refreshFormChoices();
}

function selectedRow_(sheetName) {
  const sh = SpreadsheetApp.getActiveSheet();
  if (sh.getName() !== sheetName) fail_('Select a row on the ' + sheetName + ' tab first.');
  const row = sh.getActiveRange().getRow();
  if (row < 2) fail_('Select a data row, not the header.');
  return row;
}

function withUi_(fn) {
  const ui = SpreadsheetApp.getUi();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { const msg = fn(); if (msg) ui.alert(msg); }
  catch (err) { ui.alert(err instanceof HillError ? err.message : 'Error: ' + err); }
  finally { lock.releaseLock(); }
}

function adminCrownAce() {
  withUi_(function () {
    const row = selectedRow_(SHEETS.PLAYERS);
    const p = players_().rows.find(function (r) { return r._row === row; });
    if (!p) fail_('No player on that row.');
    crownAce_(p.Email, Session.getActiveUser().getEmail());
    return p.Discord + ' is now the Ace.';
  });
}

function adminFinalizeSelected() {
  withUi_(function () {
    const row = selectedRow_(SHEETS.CHALLENGES);
    const ct = challenges_();
    const c = ct.rows.find(function (r) { return r._row === row; });
    if (!c || OPEN.indexOf(c.Status) < 0) fail_('Select an open challenge (Pending, Accepted, Started or Review).');
    const s = parseScore_(c.CommishScore);
    if (!s) fail_('Type the final score in CommishScore as challenger-defender, for example 5-3.');
    log_(Session.getActiveUser().getEmail() || 'commish', 'Commish ruling', c.ID + ' ' + c.CommishScore);
    finalize_(ct, c, s[0], s[1], 'commish');
    return 'Finalized ' + c.ID + '.';
  });
}

function adminVoidSelected() {
  withUi_(function () {
    const row = selectedRow_(SHEETS.CHALLENGES);
    const ct = challenges_();
    const c = ct.rows.find(function (r) { return r._row === row; });
    if (!c || OPEN.indexOf(c.Status) < 0) fail_('Select an open challenge.');
    voidChallenge_(ct, c, 'voided by the commish');
    return 'Voided ' + c.ID + '.';
  });
}

function adminSuspendSelected() {
  withUi_(function () {
    const row = selectedRow_(SHEETS.PLAYERS);
    const p = players_().rows.find(function (r) { return r._row === row; });
    if (!p) fail_('No player on that row.');
    const wasAce = ace_(players_()) && lc_(ace_(players_()).Email) === lc_(p.Email);
    suspendPlayer_(p.Email, Session.getActiveUser().getEmail());
    return p.Discord + ' suspended.' + (wasAce ? ' The hill is vacant: crown a new Ace.' : '');
  });
}

function adminPostStandings() {
  withUi_(function () { post_(standingsText_()); return 'Standings posted.'; });
}

// ───────────────────────────── Setup ─────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi().createMenu('⛰️ Hold the Hill')
    .addItem('Setup / repair', 'setup')
    .addSeparator()
    .addItem('Crown selected player as Ace', 'adminCrownAce')
    .addItem('Finalize selected challenge (uses CommishScore)', 'adminFinalizeSelected')
    .addItem('Void selected challenge', 'adminVoidSelected')
    .addItem('Suspend selected player', 'adminSuspendSelected')
    .addItem('⚖️ Fine selected player (unfair wagering)', 'adminFineSelected')
    .addSeparator()
    .addItem('Post standings to Discord', 'adminPostStandings')
    .addItem('Post the award race to Discord', 'adminPostAwardRace')
    .addItem('🔄 Check SmallBall now (find games, post results)', 'adminCheckNow')
    .addItem('🔁 Re-post the last result to Discord', 'adminRepostLast')
    .addItem('📣 Send callouts now', 'adminNudgeNow')
    .addItem('🧪 Test callouts (everyone, ignores the rules)', 'adminNudgeTest')
    .addItem('🧹 Reset for launch (wipe all results)', 'adminResetForLaunch')
    .addItem('Update the odds now (matchups and Ace futures)', 'adminRunFutures')
    .addItem('Post the odds board to the sportsbook channel', 'adminPostOdds')
    .addSeparator()
    .addItem('Close the season now (posts awards)', 'adminCloseSeason')
    .addItem('Start the next season', 'adminStartNextSeason')
    .addSeparator()
    .addItem('Update the Hill Board now', 'adminRefreshBoard')
    .addItem('Run deadline check now', 'hourlyTick')
    .addItem('Refresh form opponent list', 'refreshFormChoices')
    .addItem('🔎 Add "Who can I charge?" to the form', 'adminAddReach')
    .addItem('🤝 Add head-to-head wagers to the form', 'adminAddWagers')
    .addItem('🥊 Tidy up the form (emoji labels, Charge first)', 'adminTidyForm')
    .addItem('🐙 Connect the GitHub Hill Board', 'adminConnectGithub')
    .addToUi();
}

function setup() {
  const ss = SpreadsheetApp.getActive();
  ensureSheets_(ss);
  const C = cfg_();
  let form = null;
  if (C.FORM_ID) { try { form = FormApp.openById(C.FORM_ID); } catch (e) { form = null; } }
  if (!form) {
    form = buildForm_(ss);
    setCfg_('FORM_ID', form.getId());
  }
  try { ensureBookForm_(form); } catch (e) { log_('commish', 'Book form error', String(e)); }
  try { ensureStarsForm_(form); } catch (e) { log_('commish', 'Stars form error', String(e)); }
  try { form.setConfirmationMessage(FORM_CONFIRM); } catch (e) { }
  try { ensureIdForm_(form); } catch (e) { log_('commish', 'ID form error', String(e)); }
  try { ensureReachForm_(form); } catch (e) { log_('commish', 'Reach form error', String(e)); }
  try { ensureWagerForm_(form); } catch (e) { log_('commish', 'Wager form error', String(e)); }
  try { ensureTidyForm_(form); } catch (e) { log_('commish', 'Tidy form error', String(e)); }
  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (['onHillFormSubmit', 'hourlyTick', 'flushPosts'].indexOf(tr.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(tr);
  });
  ScriptApp.newTrigger('onHillFormSubmit').forForm(form).onFormSubmit().create();
  ScriptApp.newTrigger('hourlyTick').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('flushPosts').timeBased().everyMinutes(1).create();
  refreshFormChoices();
  onOpen();
  log_('commish', 'Setup', 'Form ' + form.getId());
  try {
    SpreadsheetApp.getUi().alert('Hold the Hill is set up.\n\nPlayer form link (share in Discord):\n' + form.getPublishedUrl() +
      '\n\nNext: paste your Discord webhook URL in Config, then crown the first Ace.');
  } catch (e) { /* running from the editor */ }
}

function ensureSheets_(ss) {
  Object.keys(HEADERS).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const h = HEADERS[name];
    const first = sh.getRange(1, 1, 1, h.length).getValues()[0];
    if (first.every(function (v) { return v === ''; })) {
      sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
    h.forEach(function (col, i) {
      if (TEXT_COLUMNS.indexOf(col) >= 0) sh.getRange(1, i + 1, sh.getMaxRows(), 1).setNumberFormat('@');
    });
  });
  const t = readTable_(SHEETS.CONFIG);
  Object.keys(DEFAULTS).forEach(function (k) {
    if (!t.rows.some(function (r) { return r.Key === k; })) {
      appendObj_(SHEETS.CONFIG, { Key: k, Value: DEFAULTS[k][0], Notes: DEFAULTS[k][1] });
    }
  });
}

function buildForm_(ss) {
  const form = FormApp.create('Hold the Hill · SmallBall');
  form.setDescription('The official form for Hold the Hill, the SmallBall ladder where the Ace holds the mound.\n' +
    'Pick what you want to do, fill in that one section, and submit. If it checks out, it posts in Discord. ' +
    'If not, you get an email explaining why.');
  try { form.setEmailCollectionType(FormApp.EmailCollectionType.VERIFIED); }
  catch (e) { form.setCollectEmail(true); }
  form.setConfirmationMessage(FORM_CONFIRM);
  form.setShowLinkToRespondAgain(true);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  const action = form.addMultipleChoiceItem().setTitle(Q.ACTION).setRequired(true);
  const SUBMIT = FormApp.PageNavigationType.SUBMIT;
  const whole = FormApp.createTextValidation().requireWholeNumber().setHelpText('Whole number').build();

  const pReg = form.addPageBreakItem().setTitle(ACTIONS.REGISTER)
    .setHelpText('One club per owner. This Google account becomes your Hold the Hill identity. You start at the bottom of the ladder.');
  form.addTextItem().setTitle(Q.DISCORD).setRequired(true);
  form.addTextItem().setTitle(Q.DISCORD_ID)
    .setHelpText('Lets the bot @mention you. Discord → Settings → Advanced → turn on Developer Mode, then right-click your name → Copy User ID.');
  form.addTextItem().setTitle(Q.OWNER).setRequired(true);
  form.addTextItem().setTitle(Q.CLUB).setRequired(true);
  form.addTextItem().setTitle(Q.CLUB_ID).setRequired(true);
  form.addTextItem().setTitle(Q.STARS).setRequired(true)
    .setValidation(FormApp.createTextValidation().requireNumberBetween(0, 10).setHelpText('A number from 0 to 10').build());

  const pCh = form.addPageBreakItem().setTitle(ACTIONS.CHALLENGE)
    .setHelpText('Charge anyone up to 3 spots above you. 1 spot up: just win. 2 spots up: win by 3+. 3 spots up: win by 4+. Only #1 can charge THE ACE at first; each day nobody does, one more spot opens, down to #5. Any win takes the mound. One open challenge at a time. No accepting needed: once you declare it, you start the game in SmallBall as the visitor and report the game ID and score. The defender only reports to dispute.');
  pCh.setGoToPage(SUBMIT);
  form.addListItem().setTitle(Q.OPPONENT).setChoiceValues([ACE_CHOICE]).setRequired(true);

  const pRep = form.addPageBreakItem().setTitle(ACTIONS.REPORT)
    .setHelpText("The challenger starts the game in SmallBall as the visitor, at the defender's park. Once it has been played, the challenger reports it here (the defender only reports if the score is wrong): " +
      'the game ID from the game list, the game type and the final score. The first game played is the one that counts, and ties count (see the rules). ' +
      'Results post in Discord once the game has aired, so nobody gets spoiled.');
  pRep.setGoToPage(SUBMIT);
  form.addTextItem().setTitle(Q.GAME_ID).setRequired(true).setValidation(whole);
  form.addMultipleChoiceItem().setTitle(Q.KIND).setChoiceValues(Object.keys(KINDS)).setRequired(true);
  form.addTextItem().setTitle(Q.MY_RUNS).setRequired(true).setValidation(whole);
  form.addTextItem().setTitle(Q.OPP_RUNS).setRequired(true).setValidation(whole);

  const pRev = form.addPageBreakItem().setTitle(ACTIONS.REVENGE)
    .setHelpText('Only for a dethroned Ace who earned it (500+ reign points). You must win the rematch by MORE runs than you lost by.');
  pRev.setGoToPage(SUBMIT);
  form.addCheckboxItem().setTitle(Q.CONFIRM_REVENGE).setChoiceValues(['I want the hill back']).setRequired(true);

  action.setChoices([
    action.createChoice(ACTIONS.REGISTER, pReg),
    action.createChoice(ACTIONS.CHALLENGE, pCh),
    action.createChoice(ACTIONS.REPORT, pRep),
    action.createChoice(ACTIONS.REVENGE, pRev),
  ]);
  ensureBookForm_(form);
  return form;
}

// Opponent list on the form: "#2 · philipgonzales3 · Leming Satellites · club ID 640335"
function oppLabel_(p) { return '#' + p.Rank + ' · ' + norm_(p.Discord) + ' · ' + norm_(p.Club) + (norm_(p.ClubID) ? ' · club ID ' + norm_(p.ClubID) : ''); }

// A link that opens SmallBall on the opponent's page with the big Play button. sbx_as tells the Club Kit which
// of your clubs should be picked (it shows a banner and a one-click switch); without the kit the page still works.
function playLink_(meClubId, oppClubId) {
  return 'https://play.smallball.com/' + (norm_(meClubId) ? '?sbx_as=' + encodeURIComponent(norm_(meClubId)) : '') + '#/team/' + encodeURIComponent(norm_(oppClubId));
}
function startLine_(me, opp) {
  if (!norm_(opp.ClubID)) return '';
  return '\n👉 **[Start the game in SmallBall](<' + playLink_(me.ClubID, opp.ClubID) + '>)** · check **YOUR CLUB** (top of the page) says *' + esc_(me.Club) + '*, then hit **Play** (not Exhibition).';
}
function clubIdTxt_(p) { return norm_(p.ClubID) ? '**club ID `' + norm_(p.ClubID) + '`**' : '*(no club ID on file)*'; }

function refreshFormChoices() {
  const C = cfg_();
  if (!C.FORM_ID) return;
  let form;
  try { form = FormApp.openById(C.FORM_ID); } catch (e) { return; }
  const item = form.getItems(FormApp.ItemType.LIST).find(function (i) { return i.getTitle() === Q.OPPONENT; });
  if (!item) return;
  const names = players_().rows.filter(function (p) { return p.Status === 'Active' && hasRank_(p) && Number(p.Rank) > 0; })
    .sort(function (a, b) { return Number(a.Rank) - Number(b.Rank); })
    .map(function (p) { return oppLabel_(p); });
  item.asListItem().setChoiceValues([ACE_CHOICE].concat(names));
  try { item.setHelpText('Each club shows its ladder spot and SmallBall club ID. After you charge, start a BigLeague game in SmallBall against that club ID, as the visitor, within the hour. The Hill finds the game by itself.'); } catch (e) { }
  const bi = form.getItems(FormApp.ItemType.LIST).find(function (i) { return i.getTitle() === Q.BET; });
  if (bi) {
    let opts = [];
    try { openLines_().forEach(function (L) { opts = opts.concat(betChoices_(L).map(function (o) { return o.label; })); }); } catch (e) { opts = []; }
    try { const C1 = cfg_(); if (seasonOpen_(C1)) potCurrent_().forEach(function (L) { opts = opts.concat(potChoices_(L).map(function (o) { return o.label; })); }); } catch (e) { }
    try { const C0 = cfg_(); if (seasonOpen_(C0) && !seasonOver_(C0)) opts = opts.concat(futChoices_().map(function (o) { return o.label; })); } catch (e) { }
    bi.asListItem().setChoiceValues(opts.length ? opts : [NO_LINES]);
  }
}

// ───────────────────────────── 🎰 Hill Sportsbook (play money: Brawl Bucks) ─────────────────────────────
// Every charge gets a line: moneyline, run line (±1.5) and an over/under. Players bet Brawl Bucks on the form.
// Betting closes BOOK_WINDOW_MIN after the charge or as soon as the game is reported, whichever is first.
// Players in the game may only bet on themselves (moneyline or run line), never against themselves or on the total.
// Odds come only from Hill results this season (runs scored and allowed), pulled toward an average club early on.

function bookOn_(C) { return lc_(C.BOOK_ON) !== 'false'; }
function phi_(x) {   // standard normal CDF
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}
function invPhi_(p) {   // inverse normal CDF (Acklam)
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const lo = 0.02425, hi = 1 - lo;
  let q, r;
  if (p < lo) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
  if (p > hi) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
  q = p - 0.5; r = q * q;
  return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
}
function american_(q) {   // implied probability (with vig) → American odds, rounded to 5
  q = Math.max(0.03, Math.min(0.97, q));
  const o = q >= 0.5 ? -100 * q / (1 - q) : 100 * (1 - q) / q;
  return Math.round(o / 5) * 5 || 100;
}
function fmtOdds_(o) { o = Number(o); return o > 0 ? '+' + o : '−' + Math.abs(o); }
function profit_(stake, odds) { odds = Number(odds); return Math.floor(odds > 0 ? stake * odds / 100 : stake * 100 / Math.abs(odds)); }

// Runs per game for/against in Hill games this season, with 5 phantom average games so early lines stay sane.
function strength_(email, matches) {
  const PRIOR = 5, AVG = 4.5;
  let rs = PRIOR * AVG, ra = PRIOR * AVG, g = PRIOR;
  matches.forEach(function (m) {
    if (m.WinnerRuns === '' || m.WinnerRuns === null) return;
    const w = lc_(m.WinnerEmail) === lc_(email), l = lc_(m.LoserEmail) === lc_(email);
    if (!w && !l) return;
    rs += num_(w ? m.WinnerRuns : m.LoserRuns); ra += num_(w ? m.LoserRuns : m.WinnerRuns); g++;
  });
  const rpg = rs / g, rapg = ra / g, e = 1.83;
  return { rs: rpg, ra: rapg, g: g - PRIOR, pyth: Math.pow(rpg, e) / (Math.pow(rpg, e) + Math.pow(rapg, e)) };
}

// Chance the visitor (challenger) beats the home club. Star gap sets the starting point (from 6,624 official
// games, Nov 20-25: lower-star club wins 40% at a 1★ gap, 14% at 2★, 2% at 3★, ~0% beyond); Hill runs take over
// as games pile up. No home edge: in same-tier games the club that starts wins 49.9%.
const STAR_LOW_WIN = [0.5, 0.40, 0.14, 0.02, 0.01];
function starProb_(sa, sh) {
  if (sa == null || sh == null) return null;
  const g = Math.min(Math.abs(sa - sh), STAR_LOW_WIN.length - 1), low = STAR_LOW_WIN[g];
  return sa < sh ? low : sa > sh ? 1 - low : 0.5;
}
function winProb_(A, H, sa, sh, games) {
  const a = A.pyth, b = H.pyth;
  const pr = (a - a * b) / (a + b - 2 * a * b);
  const ps = starProb_(sa, sh);
  if (ps == null) return Math.max(0.15, Math.min(0.85, pr));
  const w = games / (games + 10);   // weight on Hill results grows with games played
  return Math.max(0.01, Math.min(0.99, w * pr + (1 - w) * ps));
}
const STAR_MARGIN_BUMP = [0, 1.5, 4, 8, 12, 30];   // extra runs for the higher-star club, by gap

function makeLine_(c, ch, df, C) {
  const season = String(C.SEASON);
  const matches = readTable_(SHEETS.MATCHES).rows.filter(function (m) { return String(m.Season) === season; });
  const A = strength_(ch.Email, matches), H = strength_(df.Email, matches);
  const sm = starsMap_(), sa = sm[norm_(ch.ClubID)], sh = sm[norm_(df.ClubID)];
  const games = Math.min(A.g, H.g);
  const pAway = winProb_(A, H, sa == null ? null : sa, sh == null ? null : sh, games);
  const vig = 1 + (Number(C.BOOK_VIG) || 0);
  const favAway = pAway >= 0.5, pf = favAway ? pAway : 1 - pAway;
  const gapS = sa != null && sh != null ? Math.min(Math.abs(sa - sh), STAR_MARGIN_BUMP.length - 1) : 0;
  const SD = 4.2 + 1.5 * gapS, mu = 0.5 + SD * invPhi_(Math.min(0.995, pf)), pCover = phi_((mu - 1.5) / SD);
  const total = Math.floor((A.rs + H.ra) / 2 + (H.rs + A.ra) / 2 + STAR_MARGIN_BUMP[gapS] * (1 - games / (games + 10))) + 0.5;
  const L = {
    ChallengeID: c.ID, Season: C.SEASON, Opened: now_(), Closes: new Date(now_().getTime() + (Number(C.BOOK_WINDOW_MIN) || 10) * 60000),
    Status: 'Open', Away: norm_(ch.Discord), AwayEmail: ch.Email, Home: norm_(df.Discord), HomeEmail: df.Email,
    AwayML: american_(pAway * vig), HomeML: american_((1 - pAway) * vig), Fav: favAway ? 'away' : 'home',
    FavRL: american_(pCover * vig), DogRL: american_((1 - pCover) * vig), Total: total,
    OverOdds: american_(0.5 * vig), UnderOdds: american_(0.5 * vig), Result: '',
  };
  appendObj_(SHEETS.LINES, L);
  return L;
}
function lineText_(L) {
  const fav = L.Fav === 'away' ? L.Away : L.Home, dog = L.Fav === 'away' ? L.Home : L.Away;
  return '\n🎰 **The line:** ' + esc_(L.Away) + ' ' + fmtOdds_(L.AwayML) + ' · ' + esc_(L.Home) + ' ' + fmtOdds_(L.HomeML) +
    ' │ ' + esc_(fav) + ' −1.5 (' + fmtOdds_(L.FavRL) + '), ' + esc_(dog) + ' +1.5 (' + fmtOdds_(L.DogRL) + ')' +
    ' │ O/U ' + L.Total + ' (' + fmtOdds_(L.OverOdds) + ').' + (new Date(L.Closes) > now_() ? ' Betting closes ' + rel_(L.Closes) + '.' : ' 🔒 Betting is locked: matchup bets made before the charge ride on this game.');
}
function openLine_(c, ch, df, C) {
  if (!bookOn_(C)) return '';
  try { const L = makeLine_(c, ch, df, C); refreshFormChoices(); return lineText_(L); }
  catch (e) { log_('system', 'Book line error', String(e)); return ''; }
}

// The bet choices on the form: one per side of every open market.
function betChoices_(L) {
  const fav = L.Fav === 'away' ? L.Away : L.Home, dog = L.Fav === 'away' ? L.Home : L.Away;
  const favSide = L.Fav, dogSide = L.Fav === 'away' ? 'home' : 'away';
  const id = L.ChallengeID;
  return [
    { label: id + ' · ' + L.Away + ' to win (' + fmtOdds_(L.AwayML) + ')', market: 'ML', pick: 'away', odds: L.AwayML },
    { label: id + ' · ' + L.Home + ' to win (' + fmtOdds_(L.HomeML) + ')', market: 'ML', pick: 'home', odds: L.HomeML },
    { label: id + ' · ' + fav + ' −1.5 runs (' + fmtOdds_(L.FavRL) + ')', market: 'RL', pick: favSide, odds: L.FavRL },
    { label: id + ' · ' + dog + ' +1.5 runs (' + fmtOdds_(L.DogRL) + ')', market: 'RL', pick: dogSide, odds: L.DogRL },
    { label: id + ' · Over ' + L.Total + ' runs (' + fmtOdds_(L.OverOdds) + ')', market: 'TOTAL', pick: 'over', odds: L.OverOdds },
    { label: id + ' · Under ' + L.Total + ' runs (' + fmtOdds_(L.UnderOdds) + ')', market: 'TOTAL', pick: 'under', odds: L.UnderOdds },
  ];
}
function openLines_() {
  const ct = challenges_();
  const live = {}; ct.rows.forEach(function (c) { live[c.ID] = c.Status; });
  const t = now_();
  return readTable_(SHEETS.LINES).rows.filter(function (L) {
    return L.Status === 'Open' && new Date(L.Closes) > t && live[L.ChallengeID] === 'Accepted';
  });
}
function bankrolls_(C) {
  const season = String(C.SEASON), base = Number(C.BOOK_BANKROLL) || 1000, bank = {}, bets = {};
  readTable_(SHEETS.BETS).rows.forEach(function (b) {
    if (String(b.Season) !== season) return;
    const e = lc_(b.Email);
    if (!(e in bank)) { bank[e] = base; bets[e] = 0; }
    bets[e]++;
    if (b.Status === 'Open') bank[e] -= num_(b.Stake);
    else if (b.Status === 'Won' || b.Status === 'Lost') bank[e] += num_(b.Profit);
  });
  // Head-to-head wagers: an offer holds the maker's stake; an accepted wager holds both; a settled one moves the loser's stake.
  const hustle = {}, seat = function (e) { if (!(e in bank)) { bank[e] = base; bets[e] = 0; } if (!(e in hustle)) hustle[e] = 0; };
  try {
    readTable_(SHEETS.WAGERS).rows.forEach(function (w) {
      if (String(w.Season) !== season) return;
      const m = lc_(w.Maker), k = lc_(w.Taker), ms = num_(w.MakerStake), ts = num_(w.TakerStake);
      seat(m); seat(k);
      if (w.Status === 'Offered') bank[m] -= ms;
      else if (w.Status === 'Accepted' || w.Status === 'Airing') { bank[m] -= ms; bank[k] -= ts; }
      else if (w.Status === 'Settled') {
        if (lc_(w.Winner) === m) { bank[m] += ts; bank[k] -= ts; hustle[m] += ts; hustle[k] -= ts; }
        else { bank[k] += ms; bank[m] -= ms; hustle[k] += ms; hustle[m] -= ms; }
      }
    });
  } catch (e) { }
  // Commish fines and the league's share of them
  try {
    readTable_(SHEETS.LEDGER).rows.forEach(function (x) {
      if (String(x.Season) !== season) return;
      const e = lc_(x.Email); seat(e); bank[e] += num_(x.Amount);
    });
  } catch (e) { }
  return { bank: bank, bets: bets, base: base, hustle: hustle };
}

function doBet_(sub, C) {
  if (!bookOn_(C)) fail_('The sportsbook is closed.');
  const pt = players_();
  const me = activeMe_(pt, sub.email);
  const label = norm_(sub.f[Q.BET]);
  const stake = Math.floor(Number(norm_(sub.f[Q.STAKE]).replace(/[^\d]/g, '')));
  if (/^🔮 /.test(label)) {
    if (doPotBet_(sub, C, me, label, stake)) return;
    fail_('Those matchup odds have moved since you loaded the form. Reload it and pick again.');
  }
  let pick = null, L = null;
  readTable_(SHEETS.LINES).rows.forEach(function (x) {
    betChoices_(x).forEach(function (o) { if (o.label === label) { pick = o; L = x; } });
  });
  if (!pick && /^♠️ FUTURES/.test(label)) {
    lockIfOver_(C);
    const f = futChoices_().find(function (o) { return o.label === label; });
    if (!f) fail_('Those futures odds have moved since you loaded the form. Reload it and pick again.');
    if (f.pick !== lc_(me.Email)) fail_('Futures: you can only back your own club to finish as the Ace.');
    if (!(stake >= 1)) fail_('Enter a stake of at least 1 Brawl Buck.');
    const brf = bankrolls_(C), havef = (lc_(me.Email) in brf.bank) ? brf.bank[lc_(me.Email)] : brf.base;
    if (stake > havef) fail_('You only have ' + havef + ' Brawl Bucks available.');
    const btf = readTable_(SHEETS.BETS);
    appendObj_(SHEETS.BETS, { BetID: 'B-' + pad_(btf.rows.length + 1), Placed: now_(), Season: C.SEASON, Email: me.Email, Bettor: norm_(me.Discord),
      ChallengeID: 'FUT-S' + C.SEASON, Market: 'FUT', Pick: f.pick, Odds: f.odds, Stake: stake, Status: 'Open', Profit: '' });
    log_(sub.email, 'Bet', 'Futures ' + f.odds + ' x' + stake);
    if (lc_(C.BOOK_POST_BETS) !== 'false') betAnnounce_(me.Discord, stake, me.Discord + ' to finish Season ' + C.SEASON + ' as the Ace', f.odds, '♠️ Season Ace futures', true);
    return;
  }
  if (!pick) fail_('That bet is not on the board. Pick one from the list.');
  if (!openLines_().some(function (x) { return x.ChallengeID === L.ChallengeID; })) fail_('Betting on ' + L.ChallengeID + ' is closed.');
  const mine = lc_(me.Email) === lc_(L.AwayEmail) ? 'away' : lc_(me.Email) === lc_(L.HomeEmail) ? 'home' : '';
  if (mine && (pick.market === 'TOTAL' || pick.pick !== mine)) fail_("You're in this game: you can only bet on yourself to win or cover. No totals, and never against yourself.");
  if (!(stake >= 1)) fail_('Enter a stake of at least 1 Brawl Buck.');
  const br = bankrolls_(C), have = (lc_(me.Email) in br.bank) ? br.bank[lc_(me.Email)] : br.base;
  if (stake > have) fail_('You only have ' + have + ' Brawl Bucks available.');
  const bt = readTable_(SHEETS.BETS);
  const bet = { BetID: 'B-' + pad_(bt.rows.length + 1), Placed: now_(), Season: C.SEASON, Email: me.Email, Bettor: norm_(me.Discord),
    ChallengeID: L.ChallengeID, Market: pick.market, Pick: pick.pick, Odds: pick.odds, Stake: stake, Status: 'Open', Profit: '' };
  appendObj_(SHEETS.BETS, bet);
  log_(sub.email, 'Bet', bet.BetID + ' ' + label + ' x' + stake);
  if (lc_(C.BOOK_POST_BETS) !== 'false') {
    betAnnounce_(me.Discord, stake, label.replace(/^C-\d+ · /, '').replace(/ \([−+]\d+\)$/, ''), pick.odds, L.Away + ' @ ' + L.Home, !!mine);
  }
}

// Public summary of every bettor this season for the board's "My bets" lookup (no emails).
function bookBoard_(C) {
  const season = String(C.SEASON);
  const lines = {}; readTable_(SHEETS.LINES).rows.forEach(function (L) { lines[L.ChallengeID] = L; });
  const desc = function (b) {
    if (b.Market === 'PML') { const ps = {}; players_().rows.forEach(function (p) { ps[lc_(p.Email)] = norm_(p.Discord); }); const m = /^POT:(.+)>(.+)$/.exec(b.ChallengeID) || []; return '🔮 ' + (ps[m[1]] || '?') + ' @ ' + (ps[m[2]] || '?') + ': ' + (b.Pick === 'away' ? ps[m[1]] : ps[m[2]]) + ' wins'; }
    const L = lines[b.ChallengeID]; if (b.Market === 'FUT') return 'Season Ace futures: ' + b.Bettor; if (!L) return b.ChallengeID;
    const side = b.Pick === 'away' ? L.Away : b.Pick === 'home' ? L.Home : '';
    const sign = b.Pick === L.Fav ? '−1.5' : '+1.5';
    if (b.Market === 'PML') { const m = /^POT:(.+)>(.+)$/.exec(b.ChallengeID) || []; return '🔮 ' + (b.Pick === 'away' ? 'challenger' : 'defender') + ' wins'; }
    if (b.Market === 'FUT') return b.Bettor + ' finishes as the Ace';
    return b.Market === 'ML' ? side + ' to win' : b.Market === 'RL' ? side + ' ' + sign : (b.Pick === 'over' ? 'Over ' : 'Under ') + L.Total;
  };
  const br = bankrolls_(C), people = {}, hits = [];
  readTable_(SHEETS.BETS).rows.forEach(function (b) {
    if (String(b.Season) !== season) return;
    const e = lc_(b.Email);
    const x = people[e] || (people[e] = { name: norm_(b.Bettor), bank: br.bank[e], w: 0, l: 0, p: 0, open: [], done: [] });
    const item = { what: desc(b), game: b.ChallengeID, odds: Number(b.Odds), stake: num_(b.Stake) };
    if (b.Status === 'Open') { item.toWin = profit_(item.stake, item.odds); x.open.push(item); return; }
    item.res = b.Status; item.profit = num_(b.Profit);
    if (b.Status === 'Won') { x.w++; hits.push({ name: x.name, what: item.what, odds: item.odds, profit: item.profit, game: b.ChallengeID }); }
    else if (b.Status === 'Lost') x.l++; else x.p++;
    x.done.push(item);
  });
  const list = Object.keys(people).map(function (k) { const x = people[k]; x.done = x.done.slice(-8).reverse(); return x; })
    .sort(function (a, b) { return b.bank - a.bank; });
  return { bettors: list, hits: hits.slice(-5).reverse(), base: br.base };
}

// Settles every open bet on a challenge. ar/hr = away (challenger) and home (defender) runs; void = refund all.
function bookSettle_(c, ar, hr, isVoid) {
  try {
    const bt = readTable_(SHEETS.BETS);
    const lt = readTable_(SHEETS.LINES);
    const L = lt.rows.find(function (x) { return x.ChallengeID === c.ID && x.Status !== 'Settled'; });
    if (L) { L.Status = 'Settled'; L.Result = isVoid ? 'void' : ar + '-' + hr; writeRow_(lt, L); }
    const open = bt.rows.filter(function (b) { return b.ChallengeID === c.ID && b.Status === 'Open'; });
    if (!open.length) return '';
    let best = null;
    open.forEach(function (b) {
      const stake = num_(b.Stake);
      let res;
      if (isVoid) res = 'Void';
      else if (b.Market === 'ML') res = ar === hr ? 'Push' : ((ar > hr) === (b.Pick === 'away') ? 'Won' : 'Lost');
      else if (b.Market === 'RL') {
        const favIsPick = L ? b.Pick === L.Fav : true;
        const diff = b.Pick === 'away' ? ar - hr : hr - ar;
        res = favIsPick ? (diff >= 2 ? 'Won' : 'Lost') : (diff >= -1 ? 'Won' : 'Lost');
      } else {
        const T = L ? Number(L.Total) : 9.5;
        res = ((ar + hr > T) === (b.Pick === 'over')) ? 'Won' : 'Lost';
      }
      b.Status = res;
      b.Profit = res === 'Won' ? profit_(stake, b.Odds) : res === 'Lost' ? -stake : 0;
      writeRow_(bt, b);
      if (res === 'Won' && (!best || b.Profit > best.Profit)) best = b;
    });
    if (isVoid) return '🎰 ' + open.length + ' bet(s) refunded.';
    const won = open.filter(function (b) { return b.Status === 'Won'; }).length;
    return '🎰 **Book:** ' + open.length + ' bet(s) settled, ' + won + ' winner(s)' +
      (best ? '. Biggest hit: **' + esc_(best.Bettor) + '** +' + best.Profit + ' BB.' : '. The house cleans up.');
  } catch (e) { log_('system', 'Book settle error', String(e)); return ''; }
}

// Keeps the form's bet list in step with the open lines (checked every 5 minutes).
function bookChoicesTick_() {
  const C = cfg_();
  if (!bookOn_(C)) return;
  const sig = openLines_().map(function (L) { return L.ChallengeID; }).join(',');
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('BOOK_SIG') === sig) return;
  props.setProperty('BOOK_SIG', sig);
  refreshFormChoices();
}

// Adds the sportsbook page to an existing form (run by setup; safe to run again).
// Adds the "Update my Discord ID" page to the form (run by setup; safe to run again).
function ensureIdForm_(form) {
  const pages = form.getItems(FormApp.ItemType.PAGE_BREAK);
  let pId = pages.find(function (p) { return p.getTitle() === ACTIONS.DISCORD_ID; });
  if (!pId) {
    pId = form.addPageBreakItem().setTitle(ACTIONS.DISCORD_ID).setHelpText(ID_HELP);
    pId.setGoToPage(FormApp.PageNavigationType.SUBMIT);   // the section before it ends the form
    form.addTextItem().setTitle(Q.MY_ID).setHelpText(ID_HELP).setRequired(true)
      .setValidation(FormApp.createTextValidation().requireTextMatchesPattern('^\\s*\\d{15,21}\\s*$').setHelpText('A long number, not your username').build());
  } else pId = pId.asPageBreakItem();
  const action = form.getItems(FormApp.ItemType.MULTIPLE_CHOICE).find(function (i) { return i.getTitle() === Q.ACTION; });
  if (action) {
    const mc = action.asMultipleChoiceItem(), old = mc.getChoices();
    if (!old.some(function (ch) { return /discord id/i.test(ch.getValue()); })) {
      const choices = old.map(function (ch) {
        const pg = ch.getGotoPage(); if (pg) return mc.createChoice(ch.getValue(), pg);
        const nav = ch.getPageNavigationType(); return mc.createChoice(ch.getValue(), nav || FormApp.PageNavigationType.CONTINUE);
      });
      choices.push(mc.createChoice(ACTIONS.DISCORD_ID, pId));
      mc.setChoices(choices);
    }
  }
  const reg = form.getItems().find(function (i) { return /^discord user id/i.test(i.getTitle()); });
  if (reg) try { reg.setHelpText('Optional but recommended. ' + ID_HELP); } catch (e) { }
}

// Adds "🔎 Who can I charge?" to the form's action question: pick it and submit, nothing else to fill in (run by setup).
function ensureReachForm_(form) {
  const action = form.getItems(FormApp.ItemType.MULTIPLE_CHOICE).find(function (i) { return i.getTitle() === Q.ACTION; });
  if (!action) return;
  const mc = action.asMultipleChoiceItem(), old = mc.getChoices();
  if (old.some(function (ch) { return /who can i charge/i.test(ch.getValue()); })) return;
  const choices = old.map(function (ch) {
    const pg = ch.getGotoPage(); if (pg) return mc.createChoice(ch.getValue(), pg);
    const nav = ch.getPageNavigationType(); return mc.createChoice(ch.getValue(), nav || FormApp.PageNavigationType.CONTINUE);
  });
  choices.push(mc.createChoice(ACTIONS.REACH, FormApp.PageNavigationType.SUBMIT));
  mc.setChoices(choices);
}
function adminAddReach() { withUi_(function () { const form = FormApp.openById(cfg_().FORM_ID); ensureReachForm_(form); return 'Added "' + ACTIONS.REACH + '" to the form. Pick it, press Submit, and the list posts in #hill-help (or the feed).'; }); }

// Adds the club-stars question to an existing form, right after the club ID question (run by setup).
function ensureStarsForm_(form) {
  const items = form.getItems();
  if (items.some(function (i) { return /^club stars/i.test(i.getTitle()); })) return;
  const idItem = items.find(function (i) { return /^club id/i.test(i.getTitle()); });
  const it = form.addTextItem().setTitle(Q.STARS).setRequired(true)
    .setValidation(FormApp.createTextValidation().requireNumberBetween(0, 10).setHelpText('A number from 0 to 10').build());
  if (idItem) form.moveItem(it.getIndex(), idItem.getIndex() + 1);
}

function ensureBookForm_(form) {
  const pages = form.getItems(FormApp.ItemType.PAGE_BREAK);
  let pBet = pages.find(function (p) { return p.getTitle() === ACTIONS.BET; });
  if (!pBet) {
    const pb = form.addPageBreakItem().setTitle(ACTIONS.BET)
      .setHelpText(BOOK_HELP);
    pb.setGoToPage(FormApp.PageNavigationType.SUBMIT);
    form.addListItem().setTitle(Q.BET).setChoiceValues([NO_LINES]).setRequired(true);
    form.addTextItem().setTitle(Q.STAKE).setRequired(true)
      .setValidation(FormApp.createTextValidation().requireWholeNumber().setHelpText('Whole number of Brawl Bucks').build());
    pBet = pb;
  }
  pBet = pBet.asPageBreakItem ? pBet.asPageBreakItem() : pBet;
  try { pBet.setHelpText(BOOK_HELP); } catch (e) { }
  // Make sure the first question offers "Place a bet", keeping every other choice exactly where it already goes.
  const action = form.getItems(FormApp.ItemType.MULTIPLE_CHOICE).find(function (i) { return i.getTitle() === Q.ACTION; });
  if (!action) return;
  const mc = action.asMultipleChoiceItem();
  const old = mc.getChoices();
  if (old.some(function (ch) { return /\bbet\b|sportsbook/i.test(ch.getValue()); })) return;
  const choices = old.map(function (ch) {
    const pg = ch.getGotoPage();
    if (pg) return mc.createChoice(ch.getValue(), pg);
    const nav = ch.getPageNavigationType();
    return nav ? mc.createChoice(ch.getValue(), nav) : mc.createChoice(ch.getValue(), FormApp.PageNavigationType.CONTINUE);
  });
  choices.push(mc.createChoice(ACTIONS.BET, pBet));
  mc.setChoices(choices);
}


// ───────────────────────────── 🗡️ Star tiers: Giant Killer rule, upset bonus, underdog awards ─────────────────────────────
// Stars come from the sign-up form (SmallBall only shows them to signed-in owners, so the script can't look them up).
// The Stars tab keeps one row per club: fix any wrong number there by hand (Source "commish").
function setStars_(p, raw, source) {
  const v = Number(String(raw == null ? '' : raw).replace(/[^\d]/g, ''));
  const id = norm_(p.ClubID);
  if (!id || String(raw).trim() === '' || !(v >= 0 && v <= 10)) return null;
  const t = readTable_(SHEETS.STARS);
  const row = t.rows.find(function (x) { return norm_(x.ClubID) === id; });
  if (row) { if (lc_(row.Source) === 'commish') return num_(row.Stars); row.Stars = v; row.Source = source; row.Updated = now_(); row.Club = norm_(p.Club); writeRow_(t, row); }
  else appendObj_(SHEETS.STARS, { ClubID: id, Club: norm_(p.Club), Stars: v, Source: source, Updated: now_() });
  return v;
}
function starsMap_() {
  const m = {};
  try { readTable_(SHEETS.STARS).rows.forEach(function (x) { if (x.Stars !== '' && x.Stars !== null) m[norm_(x.ClubID)] = num_(x.Stars); }); } catch (e) { }
  return m;
}
function starsOf_(p) { const m = starsMap_(), id = norm_(p.ClubID); return id in m ? m[id] : null; }
function starsDaily_() { }
function starsNote_(c) { const m = /Stars (\d+)v(\d+)/.exec(String(c.Notes || '')); return m ? { ch: Number(m[1]), df: Number(m[2]) } : null; }
function starTag_(n) { return n != null ? n + '★' : '?★'; }

// Upset bonus: the winner had fewer stars → +UPSET_POINTS per star of difference, logged as Brawl points.
function upsetBonus_(c, W, L, chWins) {
  const st = starsNote_(c); if (!st) return '';
  const ws = chWins ? st.ch : st.df, ls = chWins ? st.df : st.ch;
  if (!(ws != null && ls != null && ls > ws)) return '';
  const C = cfg_(), tbl = String(C.UPSET_POINTS || '5,25,75').split(/[\s,]+/).map(Number);
  const pts = Number(tbl[Math.min(ls - ws, tbl.length) - 1]) || 0;
  if (!pts) return '';
  appendObj_(SHEETS.PAYOUTS, { Day: denverDay_(now_()), Season: C.SEASON, Email: W.Email, Discord: W.Discord, Spot: 'Upset ' + ws + '★>' + ls + '★', Pts: pts });
  return (ls - ws >= 3 ? '🗡️🗡️🗡️ **LEGENDARY GIANT KILLER!** ' : ls - ws === 2 ? '🗡️ **GIANT KILLER!** ' : '💥 **Upset!** ') + 'A ' + ws + '★ takes down a ' + ls + '★: ' + esc_(W.Discord) + ' banks **+' + pts + ' Brawl points**.';
}

// ───────────────────────────── 🤖 Auto-reporting from SmallBall's public game lists ─────────────────────────────
// SmallBall's per-club game list is public (no sign-in). Every 5 minutes the script looks at each open charge:
// the first official game with the challenger as visitor and the defender as home, started after the charge
// and before its deadline, is the Hill game. Its score is kept quiet until POST_DELAY_MINUTES after the game,
// so nothing is spoiled. Manual reports still work, and are checked against the same list.
function clubGames_(clubId) {
  const r = UrlFetchApp.fetch('https://play.smallball.com/games/all?club=' + encodeURIComponent(clubId),
    { muteHttpExceptions: true, headers: { Accept: 'application/json' } });
  const code = r.getResponseCode();
  if (code !== 200) throw new Error('SmallBall answered ' + code);
  const d = JSON.parse(r.getContentText());
  return d.rows || [];
}
function usedGameIds_(ct, except) {
  const used = {};
  ct.rows.forEach(function (x) { if (x !== except && norm_(x.GameID)) used[norm_(x.GameID)] = true; });
  readTable_(SHEETS.MATCHES).rows.forEach(function (m) { if (norm_(m.GameID)) used[norm_(m.GameID)] = true; });
  return used;
}
function autoDetect_() {
  const C = cfg_();
  if (lc_(C.AUTO_DETECT) === 'false') return;
  const ct = challenges_();
  const open = ct.rows.filter(function (c) { return c.Status === 'Accepted' || (c.Status === 'Started' && !norm_(c.ChallengerReport)); });
  if (!open.length) return;
  const pt = players_();
  const kinds = allowedKinds_(C);
  open.forEach(function (c) {
    const ch = findBy_(pt, c.Challenger), df = findBy_(pt, c.Defender);
    if (!ch || !df || !norm_(ch.ClubID) || !norm_(df.ClubID)) return;
    let rows;
    try { rows = clubGames_(norm_(ch.ClubID)); setCfg_('STATE_AUTO_STATUS', 'OK ' + now_().toISOString()); }
    catch (e) { setCfg_('STATE_AUTO_STATUS', 'Error ' + now_().toISOString() + ': ' + String(e.message || e)); return; }
    const from = new Date(c.Created).getTime() - 120000, to = new Date(c.Deadline).getTime();
    const used = usedGameIds_(ct, c);
    const hits = rows.filter(function (g) {
      const t = Date.parse(g.finished_at);
      return String(g.away_team_id) === norm_(ch.ClubID) && String(g.home_team_id) === norm_(df.ClubID) &&
        kinds.indexOf(g.kind) >= 0 && t >= from && t <= to && !used[String(g.game_id)] && g.away_runs != null;
    }).sort(function (a, b) { return Date.parse(a.finished_at) - Date.parse(b.finished_at); });
    if (!hits.length) return;
    const g = hits[0];
    if (c.GameID && norm_(c.GameID) !== String(g.game_id)) {   // someone reported a different game by hand
      c.Status = 'Review';
      c.Notes = (c.Notes ? c.Notes + ' · ' : '') + 'SmallBall shows game ' + g.game_id + ' but ' + c.GameID + ' was reported';
      writeRow_(ct, c);
      post_('⚠️ ' + esc_(c.ChallengerName) + ' vs ' + esc_(c.DefenderName) + ': the reported game does not match SmallBall. The commish will review.');
      return;
    }
    c.GameID = String(g.game_id); c.GameKind = g.kind;
    c.ChallengerReport = g.away_runs + '-' + g.home_runs;   // challenger is the visitor
    c.DefenderReport = '';
    c.FirstReport = new Date(g.finished_at);
    c.Status = 'Started';
    c.Notes = (c.Notes ? c.Notes + ' · ' : '') + 'Auto-detected';
    writeRow_(ct, c);
    try { voidLateBets_(c, g.finished_at); } catch (e) { }
    log_('system', 'Auto-detected', c.ID + ' game ' + g.game_id + ' (' + g.kind + ')');
    const airs = new Date(Date.parse(g.finished_at) + num_(C.POST_DELAY_MINUTES) * 60000);
    post_('📡 **Game found:** game `' + g.game_id + '` · ' + esc_(c.ChallengerName) + ' @ ' + esc_(c.DefenderName) +
      '. Nothing to report: the result posts ' + ts_(airs) + ', once it has aired. (No score here: no spoilers.)\n📺 Watch it live: <https://play.smallball.com/training?watch=' + g.game_id + '>');
  });
}
// For hand reports: look the game up in the challenger's public list. Returns the row, or null if it can't be checked.
function checkGame_(gid, ch, df) {
  try {
    const g = clubGames_(norm_(ch.ClubID)).find(function (x) { return String(x.game_id) === String(gid); });
    if (!g) return null;
    if (String(g.away_team_id) !== norm_(ch.ClubID) || String(g.home_team_id) !== norm_(df.ClubID))
      fail_('Game ' + gid + ' is not ' + ch.Discord + ' (visitor) vs ' + df.Discord + ' (home) on SmallBall. The challenger starts the game as the visitor.');
    return g;
  } catch (e) { if (/is not .* on SmallBall/.test(String(e.message))) throw e; return null; }
}

// ───────────────────────────── 📣 Nudges: callouts that get clubs charging ─────────────────────────────
// A few times a day (NUDGE_HOURS, Mountain), the Hill calls out clubs that haven't charged in a while and tells
// them exactly who they can charge, with the line. Clubs with a title shot get the mound callout. Each club is
// nudged at most once a day. Goes to TALK_WEBHOOK_URL (#trash-talk) if set, otherwise the main feed.
const NUDGE_LADDER = [
  '🥊 Hey {who}, you\'ve been parked at **#{r}** for {idle}. {t} is right there. Win and you\'re **#{tr}**. ({odds})',
  '🪑 {who}, the bench is getting cold. You can charge {list} right now.',
  '🛎️ Knock knock, {who}. **#{tr} {tname}** has been running their mouth. Go shut it. ({odds})',
  '👀 {who}, we see you sitting at #{r}. {t} sees you too. Charge or get charged.',
  '📈 Free real estate, {who}: in reach right now: {list}. The ladder doesn\'t climb itself, you bum.',
  '🧢 {who}, {idle} without a charge? Your glove\'s gathering dust. {t} is waiting. ({odds})',
];
const NUDGE_MOUND = [
  '♠️ {who}, the mound is open to **YOU**. **{ace}** has held it for {held}. Charge it before somebody else does, you bum.',
  '🏔️ {who}: title shot, right now, no line to wait in. **{ace}** is up there looking comfortable. ({odds})',
  '🔥 {who}, you\'ve got a title shot and you\'re sitting on it? **{ace}** thanks you for the free Brawl points.',
];
const NUDGE_ACE = [
  '♠️ **{ace}** has held the hill for {held} and nobody has laid a glove on them. {who}: what are we doing?',
  '😴 {held} of peace on the mound. **{ace}** is collecting 10 Brawl points a night for free. {who}, the mound is open to you.',
];
function fill_(tpl, v) { return tpl.replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? v[k] : m; }); }
function ago_(ms) { const h = Math.max(0, Math.floor(ms / 3600e3)); return h >= 48 ? Math.floor(h / 24) + ' days' : h >= 24 ? '1 day' : h + ' hours'; }
function nudgeTick_(force, test) {
  const C = cfg_();
  if (lc_(C.NUDGES) === 'false') return 'Callouts are off (NUDGES is FALSE in Config).';
  if (!test && (!seasonOpen_(C) || seasonOver_(C))) return 'Callouts only run during the season (check SEASON_START and SEASON_END).';
  const props = PropertiesService.getScriptProperties(), now = now_(), t = now.getTime();
  const hour = Number(Utilities.formatDate(now, 'America/Denver', 'H')), slot = denverDay_(now) + '@' + hour;
  const hours = String(C.NUDGE_HOURS || '11,17,21').split(/[\s,]+/).map(Number);
  if (!force && (hours.indexOf(hour) < 0 || props.getProperty('NUDGE_SLOT') === slot)) return '';
  props.setProperty('NUDGE_SLOT', slot);
  let last = {}; try { last = JSON.parse(props.getProperty('NUDGED') || '{}'); } catch (e) { last = {}; }
  const idleH = String(C.NUDGE_IDLE_HOURS).trim() === '' || isNaN(Number(C.NUDGE_IDLE_HOURS)) ? 24 : Number(C.NUDGE_IDLE_HOURS);
  const idleMs = idleH * 3600e3;
  const pt = players_(), ace = ace_(pt), ct = challenges_();
  const busy = {}, lastCharge = {};
  ct.rows.forEach(function (c) {
    if (OPEN.indexOf(c.Status) >= 0) { busy[lc_(c.Challenger)] = true; busy[lc_(c.Defender)] = true; }
    const e = lc_(c.Challenger), tc = new Date(c.Created).getTime(); if (!lastCharge[e] || tc > lastCharge[e]) lastCharge[e] = tc;
  });
  const lines = potCurrent_();
  const out = [];
  const titleIdle = ace ? t - lastTitle_(C).getTime() : 0;
  const calledOut = {};
  // Title callout first, if the mound has been quiet a day or more
  if (ace && (test || (titleIdle >= 24 * 3600e3 && !busy[lc_(ace.Email)]))) {
    const shots = lines.filter(function (L) { return L.title && !busy[L.chEmail]; });
    if (shots.length) {
      const whoAll = shots.map(function (L) { return tag_(findBy_(pt, L.chEmail)); }).join(', ');
      shots.forEach(function (L) { calledOut[L.chEmail] = true; last[L.chEmail] = t; });
      out.push(fill_(pickOne_(NUDGE_ACE), { ace: esc_(ace.Discord), held: ago_(titleIdle), who: whoAll }));
    }
  }
  const cands = ladder_(pt).filter(function (p) {
    const e = lc_(p.Email);
    if (!test && (busy[e] || calledOut[e] || (last[e] && t - last[e] < 22 * 3600e3))) return false;
    if (test) return !calledOut[e] && lines.some(function (L) { return L.chEmail === e; });
    const since = Math.max(lastCharge[e] || 0, new Date(p.Joined).getTime() || 0);
    return t - since >= idleMs && lines.some(function (L) { return L.chEmail === e; });
  }).sort(function (a, b) { return (lastCharge[lc_(a.Email)] || 0) - (lastCharge[lc_(b.Email)] || 0); })
    .slice(0, Number(C.NUDGE_MAX) || 3);
  cands.forEach(function (p) {
    const e = lc_(p.Email), mine = lines.filter(function (L) { return L.chEmail === e; });
    const since = Math.max(lastCharge[e] || 0, new Date(p.Joined).getTime() || 0);
    const title = mine.find(function (L) { return L.title; });
    const pick = title || mine.slice().sort(function (a, b) { return a.dfRank - b.dfRank; })[0];
    const dfP = findBy_(pt, pick.dfEmail), dfId = dfP && norm_(dfP.ClubID) ? ', ID `' + norm_(dfP.ClubID) + '`' : '';
    const v = { who: tag_(p), r: p.Rank, idle: ago_(t - since), t: '**' + esc_(pick.df) + '** (#' + pick.dfRank + dfId + ')', tname: esc_(pick.df), tr: pick.dfRank,
      odds: 'you ' + fmtOdds_(pick.aml), list: mine.map(function (L) { return '**' + esc_(L.df) + '**' + (L.title ? ' ♠️' : ' (#' + L.dfRank + ')'); }).join(', '),
      ace: ace ? esc_(ace.Discord) : '', held: ace ? ago_(titleIdle) : '' };
    out.push(fill_(pickOne_(title ? NUDGE_MOUND : NUDGE_LADDER), v));
    last[e] = t;
  });
  if (!test) props.setProperty('NUDGED', JSON.stringify(last));
  if (out.length) post_((test ? '🧪 *Test run: ignore* · ' : '') + '📣 **CALLOUTS**\n' + out.join('\n') + linksLine_(C), 'talk');
  return out.length ? out.length + ' callout(s) posted' + (norm_(C.TALK_WEBHOOK_URL) ? ' in the trash-talk channel.' : ' in the main feed (TALK_WEBHOOK_URL is empty).')
    : 'Nobody was due: every club has charged within ' + idleH + ' hours, is in an open charge, was called out in the last day, or has no one in reach.';
}
function adminNudgeTest() { withUi_(function () { potTick_(true); return nudgeTick_(true, true) || 'Done.'; }); }
function adminNudgeNow() { withUi_(function () { potTick_(true); return nudgeTick_(true) || 'Done.'; }); }

// ───────────────────────────── 🧹 Launch reset ─────────────────────────────
// Wipes every result, charge, reign, bet, line, payout and log line, and the script's saved state.
// Keeps the Players tab (who signed up), their stars and Config settings. Ladder is rebuilt in sign-up
// order: #1 = first to sign up. Nobody is the Ace afterwards: crown one from the menu.
function adminResetForLaunch() {
  const ui = SpreadsheetApp.getUi();
  const ans = ui.prompt('🧹 Reset for launch',
    'This erases ALL charges, results, reigns, bets, lines, Brawl points and the Log, and resets every club\'s record to 0-0.\n' +
    'Kept: the Players tab (in sign-up order), Stars and your Config settings.\n\nType RESET to go ahead.', ui.ButtonSet.OK_CANCEL);
  if (ans.getSelectedButton() !== ui.Button.OK || norm_(ans.getResponseText()) !== 'RESET') { ui.alert('Nothing was changed.'); return; }
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.getActive();
    [SHEETS.CHALLENGES, SHEETS.MATCHES, SHEETS.REIGNS, SHEETS.PAYOUTS, SHEETS.LINES, SHEETS.BETS, SHEETS.LOG].forEach(function (n) {
      const sh = ss.getSheetByName(n); if (!sh) return;
      const last = sh.getLastRow(); if (last > 1) sh.deleteRows(2, last - 1);
    });
    const board = ss.getSheetByName(BOARD_TAB); if (board) board.getRange('A1').setValue('{}');
    // Players: everyone active, records zeroed, ranked by sign-up time (no Ace).
    const pt = players_();
    const keep = pt.rows.filter(function (p) { return p.Status !== 'Removed'; })
      .sort(function (a, b) { return new Date(a.Joined) - new Date(b.Joined); });
    keep.forEach(function (p, i) {
      p.Status = 'Active'; p.Rank = i + 1;
      p.Wins = 0; p.Losses = 0; p.CareerPts = 0; p.Defenses = 0; p.Reigns = 0; p.BestReignPts = 0;
      writeRow_(pt, p);
    });
    // Config state the script manages
    Object.keys(DEFAULTS).forEach(function (k) { if (/^STATE_/.test(k)) setCfg_(k, ''); });
    // Saved script state (queues, odds, climb tracking…). Triggers and settings are left alone.
    const props = PropertiesService.getScriptProperties();
    ['NUDGED', 'NUDGE_SLOT', 'POST_QUEUE', 'LOG_QUEUE', 'FUTURES', 'FUT_DAY', 'FUT_POSTED', 'POT_LINES', 'ODDS_AT', 'ODDS_SIG', 'ODDS_DAY', 'BOOK_SIG', 'STARS_DAY']
      .forEach(function (k) { props.deleteProperty(k); });
    Object.keys(props.getProperties()).forEach(function (k) { if (/^CLIMB_S/.test(k)) props.deleteProperty(k); });
    trackClimb_(players_().rows);
    log_('commish', 'Launch reset', keep.length + ' clubs kept, ranked by sign-up');
    try { snapshotBoard_(); } catch (e) { }
    ui.alert('🧹 Done. ' + keep.length + ' clubs kept, ranked #1-#' + keep.length + ' by sign-up order, all at 0-0.\n\n' +
      'Next: crown the Ace from the ⛰️ menu, check SEASON_START, COOLDOWN_HOURS and BOOK_WINDOW_MIN in Config, then run "Update the odds now".');
  } finally { lock.releaseLock(); }
}


// ───────────────────────────── 🤝 Head-to-head wagers (Brawl Bucks, player vs player) ─────────────────────────────
// One player offers a wager on the form (stake up to WAGER_MAX a side; straight up, odds or a run line); the other
// accepts on the form. The next allowed game between their two clubs within WAGER_PLAY_HOURS settles it, once it
// has aired. No house cut: the loser's stake goes to the winner. Ties on straight-up and odds wagers, and no game
// in time, refund both sides. Offers hold the maker's stake; accepted wagers hold both (see bankrolls_).
const WAGER_TERMS = {
  even: 'Straight up: we both risk the same',
  giveOdds: 'Odds: I give odds (I risk more than they do)',
  getOdds: 'Odds: I get odds (they risk more than I do)',
  giveRuns: 'Run line: I give runs (I must win by this many or more)',
  getRuns: 'Run line: I get runs (I win unless I lose by this many or more)',
};
const WAGER_REPLIES = ['✅ Accept', '❌ Decline', '🗑️ Cancel my own offer'];
const WAGER_WARN = '⚠️ Fair play: throwing games, fake wagers to slide Brawl Bucks to a friend, or any other funny business gets your Brawl Bucks taken and split among the rest of the league. Extreme cases get expelled from the Hill.';
const WAGER_LIVE = ['Offered', 'Accepted', 'Airing'];
function wagerOn_(C) { return bookOn_(C) && lc_(C.WAGER_ON) !== 'false'; }
function wagerMax_(C) { return Number(C.WAGER_MAX) || 250; }
function wagerHelp_(C) {
  return 'Bet Brawl Bucks straight against another Hill player: up to ' + wagerMax_(C) + ' BB a side, on your terms (straight up, odds or a run line). ' +
    'They accept on this form. The next BigLeague game between your two clubs within ' + (Number(C.WAGER_PLAY_HOURS) || 48) + ' hours of accepting settles it, once it has aired. ' +
    'No house cut: the winner takes the loser\'s stake. A tie (straight up or odds) or no game in time = everyone gets their bucks back. ' + WAGER_WARN;
}
function bankOf_(br, email) { const e = lc_(email); return e in br.bank ? br.bank[e] : br.base; }
function wagerId_(raw) {
  const m = /(\d+)/.exec(norm_(raw));
  return m ? 'W-' + pad_(Number(m[1])) : '';
}
function parseOdds_(raw) {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(?:-|:|\/|to)\s*(\d+(?:\.\d+)?)\s*$/i.exec(norm_(raw));
  if (!m) return null;
  let a = Number(m[1]), b = Number(m[2]);
  if (!(a > 0 && b > 0)) return null;
  if (a < b) { const x = a; a = b; b = x; }   // "1-2" means the same as "2-1"
  return { a: a, b: b, txt: a + '-' + b };
}
// Short terms for posts and the board, from the maker's side.
function wagerTerms_(w) {
  const n = esc_(w.MakerName), L = norm_(w.Line);
  switch (w.Terms) {
    case 'giveOdds': return n + ' gives ' + L + ' odds';
    case 'getOdds': return n + ' gets ' + L + ' odds';
    case 'giveRuns': return n + ' gives ' + L + (L === '1' ? ' run' : ' runs') + ' (must win by ' + L + '+)';
    case 'getRuns': return n + ' gets ' + L + (L === '1' ? ' run' : ' runs') + ' (wins unless losing by ' + L + '+)';
    default: return 'straight up';
  }
}
// Who wins, from the maker's runs minus the taker's. null = refund (a tie on a straight-up or odds wager).
function wagerWinner_(w, margin) {
  const n = num_(w.Line);
  if (w.Terms === 'giveRuns') return margin >= n ? 'maker' : 'taker';
  if (w.Terms === 'getRuns') return margin > -n ? 'maker' : 'taker';
  return margin > 0 ? 'maker' : margin < 0 ? 'taker' : null;
}
function wagerPair_(w, a, b) {
  return (lc_(w.Maker) === lc_(a) && lc_(w.Taker) === lc_(b)) || (lc_(w.Maker) === lc_(b) && lc_(w.Taker) === lc_(a));
}

function doWager_(sub, C) {
  if (!wagerOn_(C)) fail_('Head-to-head wagers are off right now.');
  if (!seasonOpen_(C)) fail_('Wagers open when the season starts.');
  if (seasonOver_(C)) fail_('The season is over: no new wagers.');
  const pt = players_(), me = activeMe_(pt, sub.email);
  if (!norm_(me.ClubID)) fail_('Your club ID is missing from the Hill. Register again with it first.');
  const oppId = norm_(sub.f[Q.W_OPP]).replace(/\D/g, '');
  if (!oppId) fail_("Enter your opponent's club ID (it's next to their name on the Hill Board).");
  const opp = pt.rows.find(function (p) { return p.Status === 'Active' && norm_(p.ClubID) === oppId; });
  if (!opp) fail_('No active Hill player has club ID ' + oppId + '. Both of you need to be on the Hill.');
  if (lc_(opp.Email) === lc_(me.Email)) fail_("You can't wager against yourself.");
  const max = wagerMax_(C);
  const stake = Math.floor(Number(norm_(sub.f[Q.W_STAKE]).replace(/[^\d]/g, '')));
  if (!(stake >= 1)) fail_('Enter a stake of at least 1 Brawl Buck.');
  if (stake > max) fail_('The most anyone can put on a wager is ' + max + ' Brawl Bucks.');
  const label = norm_(sub.f[Q.W_TERMS]);
  const terms = Object.keys(WAGER_TERMS).find(function (k) { return WAGER_TERMS[k] === label; }) || 'even';
  let ms = stake, ts = stake, line = '';
  if (terms === 'giveOdds' || terms === 'getOdds') {
    const o = parseOdds_(sub.f[Q.W_ODDS]);
    if (!o) fail_('For an odds bet, enter the odds like 2-1 (whoever gives the odds risks 2 for every 1).');
    line = o.txt;
    if (terms === 'giveOdds') ts = Math.max(1, Math.round(stake * o.b / o.a));
    else {
      ts = Math.round(stake * o.a / o.b);
      if (ts > max) fail_('At ' + o.txt + ' they would risk ' + ts + ' BB, over the ' + max + ' BB limit. Lower your stake to ' + Math.floor(max * o.b / o.a) + ' or less.');
    }
  }
  if (terms === 'giveRuns' || terms === 'getRuns') {
    const n = Math.floor(Number(norm_(sub.f[Q.W_RUNS]).replace(/[^\d]/g, '')));
    if (!(n >= 1 && n <= 20)) fail_('For a run-line bet, enter the runs as a whole number from 1 to 20.');
    line = String(n);
  }
  const br = bankrolls_(C), have = bankOf_(br, me.Email);
  if (ms > have) fail_('You only have ' + have + ' Brawl Bucks free (stakes on open bets and wagers are held until they settle).');
  const wt = readTable_(SHEETS.WAGERS);
  const going = wt.rows.find(function (w) { return WAGER_LIVE.indexOf(w.Status) >= 0 && wagerPair_(w, me.Email, opp.Email); });
  if (going) fail_('You two already have a wager going (' + going.WagerID + '). Settle that one first.');
  const mine = wt.rows.filter(function (w) { return w.Status === 'Offered' && lc_(w.Maker) === lc_(me.Email); }).length;
  if (mine >= 3) fail_('You already have 3 offers waiting on an answer. Cancel one or wait for them to be answered.');
  const exp = hoursFrom_(now_(), Number(C.WAGER_OFFER_HOURS) || 24);
  const w = { WagerID: 'W-' + pad_(wt.rows.length + 1), Season: C.SEASON, Offered: now_(), Status: 'Offered',
    Maker: me.Email, MakerName: norm_(me.Discord), MakerClubID: norm_(me.ClubID), Taker: opp.Email, TakerName: norm_(opp.Discord), TakerClubID: norm_(opp.ClubID),
    Terms: terms, Line: line, MakerStake: ms, TakerStake: ts, Expires: exp, AcceptedAt: '', Deadline: '', GameID: '', MakerRuns: '', TakerRuns: '',
    AirsAt: '', Winner: '', Settled: '', Notes: '' };
  appendObj_(SHEETS.WAGERS, w);
  log_(sub.email, 'Wager offered', w.WagerID + ' vs ' + opp.Discord + ' · ' + terms + (line ? ' ' + line : '') + ' · ' + ms + '/' + ts);
  const form = norm_(C.FORM_LINK);
  postBook_('🤝 **WAGER OFFERED · `' + w.WagerID + '`**\n' + who_(me) + ' puts **' + ms + ' BB** on beating ' + who_(opp) + ' · ' + wagerTerms_(w) +
    (ts !== ms ? '\n> ' + esc_(opp.Discord) + ' would risk **' + ts + ' BB** to win **' + ms + ' BB**' : '') +
    '\n' + tag_(opp) + ': answer on the ' + (form ? '[Hill form](<' + form + '>)' : 'Hill form') + ' → *🤝 Answer a wager* · wager # `' + w.WagerID + '`. Open until ' + ts_(exp) + '.' +
    '\n-# Your next BigLeague game against each other settles it, once it airs. Funny business costs you your Brawl Bucks.');
}

function doWagerReply_(sub, C) {
  if (!wagerOn_(C)) fail_('Head-to-head wagers are off right now.');
  const pt = players_(), me = activeMe_(pt, sub.email);
  const id = wagerId_(sub.f[Q.W_ID]);
  if (!id) fail_('Enter the wager # from the Discord post, like W-0003.');
  const wt = readTable_(SHEETS.WAGERS);
  const w = wt.rows.find(function (x) { return x.WagerID === id; });
  if (!w) fail_('There is no wager ' + id + '.');
  const ans = norm_(sub.f[Q.W_REPLY]), maker = findBy_(pt, w.Maker), taker = findBy_(pt, w.Taker);
  const isMaker = lc_(me.Email) === lc_(w.Maker), isTaker = lc_(me.Email) === lc_(w.Taker);
  if (w.Status !== 'Offered') fail_(id + ' is already ' + String(w.Status).toLowerCase() + '.');
  if (/cancel/i.test(ans)) {
    if (!isMaker) fail_('Only ' + w.MakerName + ' can cancel ' + id + '.');
    w.Status = 'Cancelled'; w.Notes = 'Cancelled by the maker'; writeRow_(wt, w);
    log_(sub.email, 'Wager cancelled', id);
    postBook_('🗑️ ' + esc_(w.MakerName) + ' pulled wager `' + id + '` off the table.');
    return;
  }
  if (!isTaker) fail_('Only ' + w.TakerName + ' can answer ' + id + '.' + (isMaker ? ' (To pull your own offer, pick "' + WAGER_REPLIES[2] + '".)' : ''));
  if (new Date(w.Expires) <= now_()) { w.Status = 'Expired'; writeRow_(wt, w); fail_(id + ' expired before you answered.'); }
  if (/decline/i.test(ans)) {
    w.Status = 'Declined'; writeRow_(wt, w);
    log_(sub.email, 'Wager declined', id);
    postBook_('❌ ' + esc_(w.TakerName) + ' passed on wager `' + id + '` from ' + esc_(w.MakerName) + '.');
    return;
  }
  if (!maker || maker.Status !== 'Active') fail_(w.MakerName + " isn't active on the Hill anymore, so " + id + ' is off.');
  const ts = num_(w.TakerStake), br = bankrolls_(C), have = bankOf_(br, me.Email);
  if (ts > have) fail_('Accepting ' + id + ' takes ' + ts + ' Brawl Bucks and you only have ' + have + ' free.');
  const dl = hoursFrom_(now_(), Number(C.WAGER_PLAY_HOURS) || 48);
  w.Status = 'Accepted'; w.AcceptedAt = now_(); w.Deadline = dl; writeRow_(wt, w);
  log_(sub.email, 'Wager accepted', id);
  postBook_('✅ **IT\'S ON · `' + id + '`** · ' + (maker ? who_(maker) : esc_(w.MakerName)) + ' vs ' + who_(me) + ' · ' + wagerTerms_(w) +
    ' · **' + num_(w.MakerStake) + ' BB' + (num_(w.MakerStake) !== ts ? ' vs ' + ts + ' BB' : ' each') + '**' +
    '\n> The next BigLeague game between club `' + norm_(w.MakerClubID) + '` and club `' + norm_(w.TakerClubID) + '` before ' + ts_(dl) + ' settles it. Either club can host. It pays out once the game has aired.' +
    '\n👉 Start it: [' + esc_(w.MakerName) + '](<' + playLink_(w.MakerClubID, w.TakerClubID) + '>) · [' + esc_(w.TakerName) + '](<' + playLink_(w.TakerClubID, w.MakerClubID) + '>) · check YOUR CLUB before you hit **Play**.');
}

// Every 5 minutes: expire old offers, find the game for accepted wagers, settle the ones that have aired.
function wagersTick_() {
  const C = cfg_();
  if (!wagerOn_(C)) return;
  let wt; try { wt = readTable_(SHEETS.WAGERS); } catch (e) { return; }
  const t = now_().getTime(), live = wt.rows.filter(function (w) { return WAGER_LIVE.indexOf(w.Status) >= 0; });
  if (!live.length) return;
  const pt = players_(), kinds = norm_(C.WAGER_KINDS || 'big').toLowerCase().split(/[\s,]+/).filter(Boolean);
  const person = function (email, name) { const p = findBy_(pt, email); return p ? tag_(p) : '**' + esc_(name) + '**'; };
  const used = {}; wt.rows.forEach(function (w) { if (norm_(w.GameID)) used[norm_(w.GameID)] = w.WagerID; });
  live.forEach(function (w) {
    if (w.Status === 'Offered') {
      if (new Date(w.Expires).getTime() <= t) {
        w.Status = 'Expired'; writeRow_(wt, w);
        postBook_('⌛ Wager `' + w.WagerID + '` (' + esc_(w.MakerName) + ' vs ' + esc_(w.TakerName) + ') expired. Nobody took it.');
      }
      return;
    }
    if (w.Status === 'Accepted') {
      let rows = null;
      try { rows = clubGames_(norm_(w.MakerClubID)); } catch (e) { rows = null; }
      if (rows) {
        const mc = norm_(w.MakerClubID), tc = norm_(w.TakerClubID);
        const from = new Date(w.AcceptedAt).getTime(), to = new Date(w.Deadline).getTime();   // only a game finished after both sides were in counts
        const hits = rows.filter(function (g) {
          const ft = Date.parse(g.finished_at), a = String(g.away_team_id), h = String(g.home_team_id);
          return ((a === mc && h === tc) || (a === tc && h === mc)) && kinds.indexOf(g.kind) >= 0 && ft >= from && ft <= to &&
            g.away_runs != null && !(used[String(g.game_id)] && used[String(g.game_id)] !== w.WagerID);
        }).sort(function (x, y) { return Date.parse(x.finished_at) - Date.parse(y.finished_at); });
        if (hits.length) {
          const g = hits[0], makerAway = String(g.away_team_id) === mc;
          w.GameID = String(g.game_id); used[w.GameID] = w.WagerID;
          w.MakerRuns = makerAway ? g.away_runs : g.home_runs; w.TakerRuns = makerAway ? g.home_runs : g.away_runs;
          w.AirsAt = new Date(Date.parse(g.finished_at) + num_(C.POST_DELAY_MINUTES) * 60000);
          w.Status = 'Airing'; writeRow_(wt, w);
          log_('system', 'Wager game found', w.WagerID + ' game ' + g.game_id);
          postBook_('📡 Wager `' + w.WagerID + '`: game `' + g.game_id + '` found. It pays out ' + ts_(w.AirsAt) + ', once it has aired. (No score here: no spoilers.)');
          return;
        }
      }
      if (new Date(w.Deadline).getTime() <= t) {
        w.Status = 'Refunded'; w.Notes = 'No game in time'; writeRow_(wt, w);
        postBook_('↩️ Wager `' + w.WagerID + '` refunded: no BigLeague game between ' + esc_(w.MakerName) + ' and ' + esc_(w.TakerName) + ' in time. Everybody gets their bucks back.');
      }
      return;
    }
    if (w.Status === 'Airing' && new Date(w.AirsAt).getTime() <= t) {
      const mr = num_(w.MakerRuns), tr = num_(w.TakerRuns), side = wagerWinner_(w, mr - tr);
      const score = esc_(w.MakerName) + ' ' + mr + ', ' + esc_(w.TakerName) + ' ' + tr;
      w.Settled = now_();
      if (!side) {
        w.Status = 'Refunded'; w.Notes = 'Tie'; writeRow_(wt, w);
        postBook_('🤝 Wager `' + w.WagerID + '` is a push: ' + score + '. Bucks back to both.');
        return;
      }
      const mWin = side === 'maker', amt = mWin ? num_(w.TakerStake) : num_(w.MakerStake);
      w.Status = 'Settled'; w.Winner = mWin ? w.Maker : w.Taker; writeRow_(wt, w);
      log_('system', 'Wager settled', w.WagerID + ' → ' + (mWin ? w.MakerName : w.TakerName) + ' +' + amt);
      postBook_('💸 **WAGER `' + w.WagerID + '` PAYS OUT** · ' + (mWin ? person(w.Maker, w.MakerName) : person(w.Taker, w.TakerName)) + ' takes **' + amt + ' BB** from ' +
        (mWin ? person(w.Taker, w.TakerName) : person(w.Maker, w.MakerName)) + '.\n> Final: ' + score + ' · ' + wagerTerms_(w));
    }
  });
}

// For the Hill Board (names only, no emails).
function wagerBoard_(C) {
  let rows = []; try { rows = readTable_(SHEETS.WAGERS).rows.filter(function (w) { return String(w.Season) === String(C.SEASON); }); } catch (e) { rows = []; }
  const iso = function (d) { return d ? new Date(d).toISOString() : ''; };
  const pub = function (w) {
    const mw = lc_(w.Winner) === lc_(w.Maker);
    return { id: w.WagerID, m: norm_(w.MakerName), t: norm_(w.TakerName), terms: wagerTerms_(w).replace(/\\/g, ''), ms: num_(w.MakerStake), ts: num_(w.TakerStake),
      st: w.Status, exp: iso(w.Expires), dl: iso(w.Deadline), airs: iso(w.AirsAt),
      win: w.Status === 'Settled' ? (mw ? norm_(w.MakerName) : norm_(w.TakerName)) : '', amt: w.Status === 'Settled' ? (mw ? num_(w.TakerStake) : num_(w.MakerStake)) : 0 };
  };
  const done = rows.filter(function (w) { return w.Status === 'Settled' || (w.Status === 'Refunded' && norm_(w.AcceptedAt)); });
  return { max: wagerMax_(C), open: rows.filter(function (w) { return w.Status === 'Offered'; }).map(pub),
    live: rows.filter(function (w) { return w.Status === 'Accepted' || w.Status === 'Airing'; }).map(pub), done: done.slice(-8).reverse().map(pub) };
}

function ensureWagerForm_(form) {
  const C = cfg_();
  const pages = form.getItems(FormApp.ItemType.PAGE_BREAK);
  let pW = pages.find(function (p) { return p.getTitle() === ACTIONS.WAGER; });
  if (!pW) {
    pW = form.addPageBreakItem().setTitle(ACTIONS.WAGER).setHelpText(wagerHelp_(C));
    pW.setGoToPage(FormApp.PageNavigationType.SUBMIT);
    form.addTextItem().setTitle(Q.W_OPP).setHelpText("Their club ID number. It's next to their name on the Hill Board.").setRequired(true)
      .setValidation(FormApp.createTextValidation().requireWholeNumber().setHelpText('The club ID number').build());
    form.addTextItem().setTitle(Q.W_STAKE).setHelpText('What you put up, ' + 1 + ' to ' + wagerMax_(C) + ' Brawl Bucks.').setRequired(true)
      .setValidation(FormApp.createTextValidation().requireNumberBetween(1, wagerMax_(C)).setHelpText('A whole number from 1 to ' + wagerMax_(C)).build());
    form.addMultipleChoiceItem().setTitle(Q.W_TERMS).setChoiceValues(Object.keys(WAGER_TERMS).map(function (k) { return WAGER_TERMS[k]; })).setRequired(true);
    form.addTextItem().setTitle(Q.W_ODDS).setHelpText('Like 2-1: whoever gives the odds risks 2 for every 1. Leave blank otherwise.');
    form.addTextItem().setTitle(Q.W_RUNS).setHelpText('A whole number of runs, like 2. Leave blank otherwise.');
  }
  pW = pW.asPageBreakItem ? pW.asPageBreakItem() : pW;
  try { pW.setHelpText(wagerHelp_(C)); } catch (e) { }
  let pR = form.getItems(FormApp.ItemType.PAGE_BREAK).find(function (p) { return p.getTitle() === ACTIONS.WAGER_REPLY; });
  if (!pR) {
    pR = form.addPageBreakItem().setTitle(ACTIONS.WAGER_REPLY)
      .setHelpText('Got called out? Take it or leave it. Made an offer nobody has answered yet? You can pull it here. ' + WAGER_WARN);
    pR.setGoToPage(FormApp.PageNavigationType.SUBMIT);
    form.addTextItem().setTitle(Q.W_ID).setRequired(true);
    form.addMultipleChoiceItem().setTitle(Q.W_REPLY).setChoiceValues(WAGER_REPLIES).setRequired(true);
  }
  pR = pR.asPageBreakItem ? pR.asPageBreakItem() : pR;
  const action = form.getItems(FormApp.ItemType.MULTIPLE_CHOICE).find(function (i) { return i.getTitle() === Q.ACTION; });
  if (!action) return;
  const mc = action.asMultipleChoiceItem(), old = mc.getChoices();
  if (old.some(function (ch) { return /wager/i.test(ch.getValue()); })) return;
  const choices = old.map(function (ch) {
    const pg = ch.getGotoPage(); if (pg) return mc.createChoice(ch.getValue(), pg);
    const nav = ch.getPageNavigationType(); return mc.createChoice(ch.getValue(), nav || FormApp.PageNavigationType.CONTINUE);
  });
  choices.push(mc.createChoice(ACTIONS.WAGER, pW));
  choices.push(mc.createChoice(ACTIONS.WAGER_REPLY, pR));
  mc.setChoices(choices);
}

// The order and look of the first question on the form. Tidy-up renames the old choices and their sections to
// these labels, keeps every choice pointing at its own section, and puts 🥊 Charge the Hill first.
const ACTION_ORDER = ['CHALLENGE', 'REACH', 'REPORT', 'REVENGE', 'BET', 'WAGER', 'WAGER_REPLY', 'REGISTER', 'DISCORD_ID'];
const CHARGE_HELP = '🥊 Pick who you are charging. You can charge anyone up to 3 spots above you: 1 spot up, just win. 2 spots up, win by 3+. 3 spots up, win by 4+. ' +
  'Only #1 can charge ♠ THE ACE at first; each day nobody does, one more spot opens, down to #5. Any win takes the mound.\n\n' +
  'After you submit: start the game in SmallBall as the VISITOR at their park, BigLeague. No report needed: the Hill finds the game on its own and posts the result once it has aired. One open charge at a time.';
function ensureTidyForm_(form) {
  const items = form.getItems();
  const action = items.find(function (i) { return i.getTitle() === Q.ACTION && i.getType() === FormApp.ItemType.MULTIPLE_CHOICE; });
  if (!action) return 'No "' + Q.ACTION + '" question on the form.';
  // Rename each section to its action's label (so the section header matches the choice).
  form.getItems(FormApp.ItemType.PAGE_BREAK).forEach(function (it) {
    const pb = it.asPageBreakItem(), canon = actionOf_(pb.getTitle());
    if (Object.keys(ACTIONS).some(function (k) { return ACTIONS[k] === canon; }) && pb.getTitle() !== canon) pb.setTitle(canon);
    if (canon === ACTIONS.CHALLENGE) pb.setHelpText(CHARGE_HELP);
  });
  const mc = action.asMultipleChoiceItem(), old = mc.getChoices(), byCanon = {}, extra = [];
  old.forEach(function (ch) {
    const canon = actionOf_(ch.getValue());
    const pg = ch.getGotoPage(), nav = ch.getPageNavigationType();
    const make = function (label) { return pg ? mc.createChoice(label, pg) : mc.createChoice(label, nav || FormApp.PageNavigationType.CONTINUE); };
    if (Object.keys(ACTIONS).some(function (k) { return ACTIONS[k] === canon; }) && !byCanon[canon]) byCanon[canon] = make(canon);
    else extra.push(make(ch.getValue()));
  });
  const ordered = ACTION_ORDER.map(function (k) { return byCanon[ACTIONS[k]]; }).filter(Boolean);
  mc.setChoices(ordered.concat(extra));
  mc.setHelpText('🥊 Want to climb? Pick CHARGE THE HILL. New here? Register your club first (bottom of the list).');
  return 'Form tidied: ' + ordered.length + ' options, 🥊 Charge the Hill first.';
}
function adminTidyForm() { withUi_(function () { return ensureTidyForm_(FormApp.openById(cfg_().FORM_ID)); }); }
function adminAddWagers() {
  withUi_(function () {
    ensureSheets_(SpreadsheetApp.getActive());
    const form = FormApp.openById(cfg_().FORM_ID);
    ensureWagerForm_(form);
    ensureTidyForm_(form);
    return 'Head-to-head wagers are on the form: "' + ACTIONS.WAGER + '" and "' + ACTIONS.WAGER_REPLY + '". New Wagers and Ledger tabs hold the records.';
  });
}

// Commish ruling: take Brawl Bucks from a player (a number, or ALL) and split them evenly across every other active
// player; void their open wagers; optionally expel them. Recorded in the Ledger tab.
function finePlayer_(email, amountRaw, reason, expel, actor) {
  const C = cfg_(), pt = players_(), p = findBy_(pt, email);
  if (!p) fail_('Player not found.');
  try {
    const wt = readTable_(SHEETS.WAGERS);
    wt.rows.filter(function (w) { return WAGER_LIVE.indexOf(w.Status) >= 0 && (lc_(w.Maker) === lc_(email) || lc_(w.Taker) === lc_(email)); })
      .forEach(function (w) { w.Status = 'Cancelled'; w.Notes = 'Voided by commish ruling'; writeRow_(wt, w); });
  } catch (e) { }
  const have = bankOf_(bankrolls_(C), email);
  const amt = /^all$/i.test(norm_(amountRaw)) ? have : Math.min(have, Math.floor(Number(norm_(amountRaw).replace(/[^\d]/g, ''))));
  if (!(amt > 0)) fail_(p.Discord + ' has no Brawl Bucks to take (balance ' + have + ').');
  const others = pt.rows.filter(function (x) { return x.Status === 'Active' && lc_(x.Email) !== lc_(email); })
    .sort(function (x, y) { return (hasRank_(x) ? Number(x.Rank) : 999) - (hasRank_(y) ? Number(y.Rank) : 999); });
  const share = others.length ? Math.floor(amt / others.length) : 0, rem = others.length ? amt - share * others.length : 0;
  const why = 'Commish ruling: unfair wagering' + (norm_(reason) ? ' (' + norm_(reason) + ')' : '');
  appendObj_(SHEETS.LEDGER, { Date: now_(), Season: C.SEASON, Email: p.Email, Player: norm_(p.Discord), Amount: -amt, Reason: why });
  others.forEach(function (x, i) {
    const give = share + (i < rem ? 1 : 0);
    if (give > 0) appendObj_(SHEETS.LEDGER, { Date: now_(), Season: C.SEASON, Email: x.Email, Player: norm_(x.Discord), Amount: give, Reason: 'Share of ' + norm_(p.Discord) + "'s fine" });
  });
  if (expel) {
    suspendPlayer_(p.Email, actor);
    const pt2 = players_(), p2 = findBy_(pt2, p.Email); p2.Status = 'Expelled'; writeRow_(pt2, p2);
  }
  log_(actor || 'commish', 'Fine', p.Discord + ' -' + amt + ' BB split ' + others.length + ' ways' + (expel ? ' · expelled' : '') + (reason ? ' · ' + reason : ''));
  const msg = '⚖️ **COMMISH RULING** · ' + tag_(p) + ' loses **' + amt + ' BB** for unfair wagering' + (norm_(reason) ? ': ' + esc_(reason) : '') + '.' +
    (others.length ? '\n> Split across the league: **+' + share + (rem ? '–' + (share + 1) : '') + ' BB** each to ' + others.length + ' players.' : '') +
    (expel ? '\n🚫 **' + esc_(p.Discord) + ' is expelled from the Hill.**' : '') + '\n-# ' + WAGER_WARN;
  post_(msg); postBook_(msg);
  try { snapshotBoard_(); } catch (e) { }
  return p.Discord + ' fined ' + amt + ' BB (split ' + others.length + ' ways)' + (expel ? ' and expelled.' : '.');
}
function adminFineSelected() {
  const ui = SpreadsheetApp.getUi();
  let p;
  try {
    const row = selectedRow_(SHEETS.PLAYERS);
    p = players_().rows.find(function (r) { return r._row === row; });
    if (!p) fail_('No player on that row.');
  } catch (err) { ui.alert(err instanceof HillError ? err.message : 'Error: ' + err); return; }
  const a = ui.prompt('Fine ' + p.Discord + ' for unfair wagering', 'How many Brawl Bucks to take? A number, or ALL. They are split evenly across every other active player.', ui.ButtonSet.OK_CANCEL);
  if (a.getSelectedButton() !== ui.Button.OK || !norm_(a.getResponseText())) return;
  const r = ui.prompt('Reason (shown in Discord)', 'Short and factual, like "threw a game to pay a friend".', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const ex = ui.alert('Expel ' + p.Discord + ' from the Hill too?', 'Only for extreme cases. They come off the ladder and can\'t play.', ui.ButtonSet.YES_NO);
  withUi_(function () { return finePlayer_(p.Email, a.getResponseText(), r.getResponseText(), ex === ui.Button.YES, Session.getActiveUser().getEmail()); });
}

// ───────────────────────────── 🎰 Sportsbook channel announcements ─────────────────────────────
function pickOne_(a) { return a[Math.floor(Math.random() * a.length)]; }
// A bet slip, announced with some flavor.
function betAnnounce_(name, stake, pickTxt, odds, extra, selfBet) {
  const win = profit_(stake, odds), o = fmtOdds_(odds);
  let C; try { C = cfg_(); } catch (e) { C = {}; }
  const whale = stake >= 500 || stake >= (Number(C.BOOK_BANKROLL) || 1000) / 2;
  const longshot = Number(odds) >= 300;
  const n = '**' + esc_(name) + '**', p = '**' + esc_(pickTxt) + '**';
  let line;
  if (whale) line = pickOne_(['🚨🐋 **WHALE ALERT!** ' + n + ' drops **' + stake + ' BB** on ' + p + ' (' + o + '). To win **' + win + '**.',
    '🐋 Big money walks in. ' + n + ' slams **' + stake + ' BB** on ' + p + ' at ' + o + '. Pays **' + win + '**.']);
  else if (longshot) line = pickOne_(['🦄 **Longshot!** ' + n + ' takes ' + p + ' at **' + o + '**: ' + stake + ' BB to win **' + win + '**.',
    '🎯 Dreamer at the window. ' + n + ' puts ' + stake + ' BB on ' + p + ' (**' + o + '**). Cash it and it pays **' + win + '**.']);
  else if (selfBet) line = pickOne_(['🫡 ' + n + ' backs themselves: ' + stake + ' BB on ' + p + ' (' + o + '). To win ' + win + '.',
    '💪 Put your money where your mound is. ' + n + ' bets ' + stake + ' BB on ' + p + ' (' + o + ').']);
  else line = pickOne_(['🎰 ' + n + ' slides **' + stake + ' BB** across the counter on ' + p + ' (' + o + '). To win ' + win + '.',
    '🧾 Ticket printed! ' + n + ' · ' + stake + ' BB · ' + p + ' ' + o + ' → pays ' + win + '.',
    '💸 ' + n + ' likes ' + p + ': ' + stake + ' BB at ' + o + ', to win ' + win + '.',
    '📝 Action! ' + n + ' takes ' + p + ' for ' + stake + ' BB (' + o + ').']);
  postBook_(line + (extra ? '\n-# ' + extra : ''));
}
// After the game airs: the payout window in #sportsbook (queued with the result, so no spoilers).
function payoutPost_(c, ar, hr, isVoid) {
  const key = potKey_(c.Challenger, c.Defender), made = new Date(c.Created).getTime();
  const done = readTable_(SHEETS.BETS).rows.filter(function (b) {
    return (b.ChallengeID === c.ID || (b.ChallengeID === key && new Date(b.Placed).getTime() <= made)) && b.Status !== 'Open';
  });
  if (!done.length) return;
  const winners = done.filter(function (b) { return b.Status === 'Won'; }).sort(function (a, b) { return num_(b.Profit) - num_(a.Profit); });
  const losers = done.filter(function (b) { return b.Status === 'Lost'; });
  const house = losers.reduce(function (t, b) { return t + num_(b.Stake); }, 0) - winners.reduce(function (t, b) { return t + num_(b.Profit); }, 0);
  let t = '💵 **PAYOUT WINDOW** · ' + esc_(c.ChallengerName) + ' @ ' + esc_(c.DefenderName) + (isVoid ? ' (void)' : ' · final ' + ar + '-' + hr) + '\n';
  if (isVoid) t += '↩️ ' + done.length + ' bet(s) refunded.';
  else {
    t += winners.length ? winners.slice(0, 6).map(function (b) { return '✅ **' + esc_(b.Bettor) + '** +' + b.Profit + ' BB'; }).join('\n') : '🧹 Nobody cashed. Clean sweep for the house.';
    if (losers.length) t += '\n❌ ' + losers.length + ' ticket' + (losers.length === 1 ? '' : 's') + ' torn up.';
    t += '\n🏦 House ' + (house >= 0 ? 'wins ' + house : 'pays out ' + Math.abs(house)) + ' BB on this one.';
  }
  postResult_(c, t, 'book');
}

// The charge is in: betting on that matchup is closed.
function betsClosedPost_(c, ch, df, L) {
  const key = potKey_(c.Challenger, c.Defender), t = new Date(c.Created).getTime();
  let n = 0, bb = 0, onCh = 0;
  readTable_(SHEETS.BETS).rows.forEach(function (b) {
    if (b.Status !== 'Open' || new Date(b.Placed).getTime() > t) return;
    if (b.ChallengeID !== key && b.ChallengeID !== c.ID) return;
    n++; bb += num_(b.Stake); if (b.Pick === 'away') onCh += num_(b.Stake);
  });
  let txt = '🔔 **BETTING CLOSED** · ' + esc_(ch.Discord) + ' @ ' + esc_(df.Discord) + (c.Type !== 'Ladder' ? ' ♠️ **TITLE FIGHT**' : '') + '\n';
  txt += n ? '💰 **' + n + ' bet' + (n === 1 ? '' : 's') + '** riding, **' + bb + ' BB** in action (' + Math.round(onCh / bb * 100) + '% on ' + esc_(ch.Discord) + ').' : '😶 Nobody got a bet down. The house shrugs.';
  if (L) txt += '\nClosing line: ' + esc_(L.Away) + ' ' + fmtOdds_(L.AwayML) + ' · ' + esc_(L.Home) + ' ' + fmtOdds_(L.HomeML) + ' · O/U ' + L.Total;
  txt += '\nPayouts post once the game has aired. 📺';
  postBook_(txt);
}
// New matchups that just became possible (ladder moved, new club signed up).
function newLinesPost_(prev, lines, C) {
  const had = {}; prev.forEach(function (x) { had[x.key] = true; });
  const fresh = lines.filter(function (x) { return !had[x.key]; });
  if (!fresh.length) return;
  const pre = !seasonOpen_(C) ? ' *(preview: betting opens at kickoff)*' : '';
  if (!prev.length) { postBook_('🔮 **The board is up!** ' + lines.length + ' matchup lines posted' + pre + '. Lock in before the charge. Every line is on the Hill Board and the Hill form.'); return; }
  postBook_('🆕 **New line' + (fresh.length > 1 ? 's' : '') + ' on the board**' + pre + '\n' + fresh.slice(0, 15).map(function (x) {
    return (x.title ? '♠️ ' : '🔮 ') + '**' + esc_(x.ch) + '** ' + fmtOdds_(x.aml) + ' @ **' + esc_(x.df) + '** ' + fmtOdds_(x.hml);
  }).join('\n') + (fresh.length > 15 ? '\n…and ' + (fresh.length - 15) + ' more on the Hill Board.' : ''));
}
// Futures: announce when someone moves 5+ points since the last futures post.
function futuresMovesPost_(rows) {
  const props = PropertiesService.getScriptProperties();
  let last = {}; try { last = JSON.parse(props.getProperty('FUT_POSTED') || '{}'); } catch (e) { last = {}; }
  const first = !Object.keys(last).length;
  const movers = rows.filter(function (x) { return last[x.email] != null && Math.abs(x.pct - last[x.email]) >= 5; });
  const save = {}; rows.forEach(function (x) { save[x.email] = x.pct; });
  if (first) {
    props.setProperty('FUT_POSTED', JSON.stringify(save));
    postBook_('♠️ **Season Ace futures are live!**\n' + rows.slice(0, 5).map(function (x, i) { return (i + 1) + '. **' + esc_(x.name) + '** ' + fmtOdds_(x.odds) + ' (' + x.pct + '%)'; }).join('\n') + '\nBack your own club on the Hill form.');
    return;
  }
  if (!movers.length) return;
  props.setProperty('FUT_POSTED', JSON.stringify(save));
  postBook_('📈 **Futures on the move**\n' + movers.slice(0, 8).map(function (x) {
    const d = Math.round((x.pct - last[x.email]) * 10) / 10;
    return (d > 0 ? '🔥 ' : '🧊 ') + '**' + esc_(x.name) + '** ' + (d > 0 ? '▲' : '▼') + Math.abs(d) + ' pts → ' + x.pct + '% (' + fmtOdds_(x.odds) + ')';
  }).join('\n'));
}

// ───────────────────────────── 🔮 Matchup lines (bet before the charge) ─────────────────────────────
// Every charge that could happen right now gets a moneyline: each club vs everyone it can reach, and the
// clubs with a title shot vs the Ace. Bets lock the moment that charge is made (before any game exists, so
// nobody can bet on a result they already know). A bet whose matchup isn't played within BOOK_HOLD_HOURS
// is voided and refunded. Odds refresh every hour; a bet keeps the odds it was placed at.
function potKey_(chEmail, dfEmail) { return 'POT:' + lc_(chEmail) + '>' + lc_(dfEmail); }
function potLines_(C) {
  const pt = players_(), ace = ace_(pt), lad = ladder_(pt);
  const season = String(C.SEASON), reach = Number(C.CHALLENGE_REACH) || 3;
  const matches = readTable_(SHEETS.MATCHES).rows.filter(function (m) { return String(m.Season) === season; });
  const sm = starsMap_(), vig = 1 + (Number(C.BOOK_VIG) || 0);
  const openTo = ace ? moundOpenTo_(C) : 0;
  const busy = {}; challenges_().rows.forEach(function (c) { if (OPEN.indexOf(c.Status) >= 0) busy[potKey_(c.Challenger, c.Defender)] = true; });
  const out = [];
  const add = function (ch, df, title) {
    const key = potKey_(ch.Email, df.Email);
    if (busy[key]) return;   // already charged: betting on it is locked
    const A = strength_(ch.Email, matches), H = strength_(df.Email, matches);
    const sa = sm[norm_(ch.ClubID)], sh = sm[norm_(df.ClubID)];
    const p = winProb_(A, H, sa == null ? null : sa, sh == null ? null : sh, Math.min(A.g, H.g));
    out.push({ key: key, title: title, ch: norm_(ch.Discord), df: norm_(df.Discord), chEmail: lc_(ch.Email), dfEmail: lc_(df.Email),
      chRank: Number(ch.Rank), dfRank: Number(df.Rank), aml: american_(p * vig), hml: american_((1 - p) * vig) });
  };
  lad.forEach(function (p) {
    const r = Number(p.Rank);
    lad.forEach(function (q) { const g = r - Number(q.Rank); if (g >= 1 && g <= reach) add(p, q, false); });
    if (ace && r <= openTo) add(p, ace, true);
  });
  return out;
}
function potChoices_(L) {
  const pre = '🔮 ' + L.ch + ' @ ' + L.df + (L.title ? ' (title)' : '') + ' · ';
  return [{ label: pre + L.ch + ' wins (' + fmtOdds_(L.aml) + ')', pick: 'away', odds: L.aml },
          { label: pre + L.df + ' wins (' + fmtOdds_(L.hml) + ')', pick: 'home', odds: L.hml }];
}
// Hourly (and after results): recompute, store, refresh the form. Held while a result waits to air.
function potTick_(force) {
  const C = cfg_();
  if (!bookOn_(C) || (!force && pendingQueue_())) return;
  let lines = [];
  if (!seasonOver_(C)) lines = potLines_(C);   // shown before kickoff too; bets only open once the season does
  try { newLinesPost_(potCurrent_(), lines, C); } catch (e) { }
  PropertiesService.getScriptProperties().setProperty('POT_LINES', JSON.stringify({ at: now_().toISOString(), lines: lines }));
  refreshFormChoices();
  try { snapshotBoard_(); } catch (e) { }
}
function potCurrent_() { try { return (JSON.parse(PropertiesService.getScriptProperties().getProperty('POT_LINES') || '{}').lines) || []; } catch (e) { return []; } }

function doPotBet_(sub, C, me, label, stake) {
  let pick = null, L = null;
  potCurrent_().forEach(function (x) { potChoices_(x).forEach(function (o) { if (o.label === label) { pick = o; L = x; } }); });
  if (!pick) return false;
  lockIfOver_(C);
  const open = challenges_().rows.some(function (c) { return OPEN.indexOf(c.Status) >= 0 && potKey_(c.Challenger, c.Defender) === L.key; });
  if (open) fail_('That charge has already been made, so betting on it is locked.');
  const mine = lc_(me.Email) === L.chEmail ? 'away' : lc_(me.Email) === L.dfEmail ? 'home' : '';
  if (mine && pick.pick !== mine) fail_("You're in that matchup: you can only bet on yourself.");
  if (!(stake >= 1)) fail_('Enter a stake of at least 1 Brawl Buck.');
  const br = bankrolls_(C), have = (lc_(me.Email) in br.bank) ? br.bank[lc_(me.Email)] : br.base;
  if (stake > have) fail_('You only have ' + have + ' Brawl Bucks available.');
  const bt = readTable_(SHEETS.BETS);
  appendObj_(SHEETS.BETS, { BetID: 'B-' + pad_(bt.rows.length + 1), Placed: now_(), Season: C.SEASON, Email: me.Email, Bettor: norm_(me.Discord),
    ChallengeID: L.key, Market: 'PML', Pick: pick.pick, Odds: pick.odds, Stake: stake, Status: 'Open', Profit: '' });
  log_(sub.email, 'Bet', 'Matchup ' + L.ch + ' @ ' + L.df + ' ' + pick.pick + ' ' + pick.odds + ' x' + stake);
  const hold = Number(C.BOOK_HOLD_HOURS) || 48;
  if (lc_(C.BOOK_POST_BETS) !== 'false')
    betAnnounce_(me.Discord, stake, (pick.pick === 'away' ? L.ch : L.df) + ' to win', pick.odds, '🔮 ' + L.ch + ' @ ' + L.df + (L.title ? ' (title)' : '') + ' · refunded if not played within ' + hold + ' hours', !!mine);
  return true;
}
// Settles matchup bets made before this charge. Called with the challenge's result (or void).
function potSettle_(c, ar, hr, isVoid) {
  const bt = readTable_(SHEETS.BETS), key = potKey_(c.Challenger, c.Defender), made = new Date(c.Created).getTime();
  let n = 0, won = 0;
  bt.rows.forEach(function (b) {
    if (b.Market !== 'PML' || b.Status !== 'Open' || b.ChallengeID !== key || new Date(b.Placed).getTime() > made) return;
    n++;
    if (isVoid || ar === hr) { b.Status = isVoid ? 'Void' : 'Push'; b.Profit = 0; }
    else { const w = (ar > hr) === (b.Pick === 'away'); b.Status = w ? 'Won' : 'Lost'; b.Profit = w ? profit_(num_(b.Stake), b.Odds) : -num_(b.Stake); if (w) won++; }
    writeRow_(bt, b);
  });
  return n ? (isVoid ? '🔮 ' + n + ' matchup bet(s) refunded.' : '🔮 ' + n + ' matchup bet(s) settled, ' + won + ' winner(s).') : '';
}
// Hourly: refund matchup bets older than BOOK_HOLD_HOURS whose charge never happened.
function potExpire_() {
  const C = cfg_(), hold = (Number(C.BOOK_HOLD_HOURS) || 48) * 3600e3, t = now_().getTime();
  const open = {}; challenges_().rows.forEach(function (c) { if (OPEN.indexOf(c.Status) >= 0) open[potKey_(c.Challenger, c.Defender)] = true; });
  const bt = readTable_(SHEETS.BETS);
  let n = 0;
  bt.rows.forEach(function (b) {
    if (b.Market !== 'PML' || b.Status !== 'Open' || open[b.ChallengeID]) return;
    if (t - new Date(b.Placed).getTime() < hold) return;
    b.Status = 'Void'; b.Profit = 0; writeRow_(bt, b); n++;
  });
  if (n) log_('system', 'Matchup bets expired', n + ' refunded');
}
// Once a day: the odds board in the sportsbook channel (matchup lines + Ace futures). Held while a result waits to air.
function oddsBoardText_(C) {
  const L = potCurrent_(), f = futures_();
  let t = '# 🎰 HILL SPORTSBOOK · ' + Utilities.formatDate(now_(), 'America/Denver', 'EEE MMM d · h a') + (seasonOpen_(C) ? '' : ' · PREVIEW') + '\n*Play money. Bet on the Hill form. Matchup bets lock at the charge and come back if it isn\'t played in ' + (Number(C.BOOK_HOLD_HOURS) || 48) + ' hours.*\n';
  if (L.length) {
    t += '\n**🔮 Matchup lines**\n' + L.map(function (x) {
      return (x.title ? '♠️ ' : '') + '**' + esc_(x.ch) + '** ' + fmtOdds_(x.aml) + ' @ **' + esc_(x.df) + '** ' + fmtOdds_(x.hml);
    }).join('\n') + '\n';
  } else t += '\n*No matchup lines right now.*\n';
  if (f && f.rows && f.rows.length) {
    t += '\n**♠️ Season ' + C.SEASON + ' Ace futures**\n' + f.rows.slice(0, 8).map(function (x, i) {
      const mv = x.move > 0 ? ' ▲' + x.move : x.move < 0 ? ' ▼' + Math.abs(x.move) : '';
      return (i + 1) + '. **' + esc_(x.name) + '** ' + fmtOdds_(x.odds) + ' (' + x.pct + '%' + mv + ')';
    }).join('\n') + '\n';
  }
  try {
    const br = bankrolls_(C), byE = {}; players_().rows.forEach(function (p) { byE[lc_(p.Email)] = norm_(p.Discord); });
    const top = Object.keys(br.bank).sort(function (a, b) { return br.bank[b] - br.bank[a]; }).slice(0, 5);
    if (top.length) t += '\n**💰 Bankrolls**\n' + top.map(function (e, i) { return (i + 1) + '. ' + esc_(byE[e] || '?') + ' · ' + br.bank[e] + ' BB'; }).join('\n');
  } catch (e) { }
  return t + linksLine_(C);
}
function oddsBoardTick_() {
  const C = cfg_();
  if (!bookOn_(C) || C.STATE_SEASON_CLOSED || pendingQueue_()) return;
  const props = PropertiesService.getScriptProperties(), every = (Number(C.BOOK_ODDS_EVERY_HOURS) || 1) * 3600e3;
  const last = Number(props.getProperty('ODDS_AT') || 0), t = now_().getTime();
  if (t - last < every - 120000) return;
  const text = oddsBoardText_(C), sig = text.replace(/^# .*\n/, '');   // skip if nothing changed since the last board
  if (props.getProperty('ODDS_SIG') === sig) return;
  props.setProperty('ODDS_AT', String(t)); props.setProperty('ODDS_SIG', sig);
  postBook_(text);
}
function adminPostOdds() { withUi_(function () { potTick_(true); postBook_(oddsBoardText_(cfg_())); return 'Odds board posted.'; }); }

// When a game is found: refund any bet on that charge placed after the game started (SmallBall time).
function voidLateBets_(c, startedAt) {
  const bt = readTable_(SHEETS.BETS), t = new Date(startedAt).getTime();
  bt.rows.forEach(function (b) {
    if (b.ChallengeID === c.ID && b.Status === 'Open' && new Date(b.Placed).getTime() > t) { b.Status = 'Void'; b.Profit = 0; writeRow_(bt, b); }
  });
}

// ───────────────────────────── ♠️ Season Ace futures ─────────────────────────────
// Odds for each club to finish the season as the Ace. Every hour the script plays out the rest of the season
// 2,000 times with simplified Hill rules (charge rate from this season, win chances from Hill runs, margins,
// the Ace drop) and counts how often each club ends on the mound. Players can only back their own club.
function pendingQueue_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('POST_QUEUE') || '[]').length > 0; } catch (e) { return false; } }

function simFutures_(C) {
  const pt = players_();
  const ace = ace_(pt);
  const lad = ladder_(pt);
  if (!ace && !lad.length) return null;
  const end = seasonEnd_(C), st = seasonStart_(C);
  const t0 = st && now_() < st ? st : now_();
  const daysLeft = end ? Math.max(0, (end - t0) / 86400000) : 28;
  const season = String(C.SEASON);
  const matches = readTable_(SHEETS.MATCHES).rows.filter(function (m) { return String(m.Season) === season; });
  const opened = st ? Math.max(1, (now_() - st) / 86400000) : 7;
  const rate = Math.max(2, matches.length / opened);   // charges per day
  const titleShare = matches.length >= 6 ? Math.max(0.15, matches.filter(function (m) { return m.Type !== 'Ladder'; }).length / matches.length) : 0.3;
  const order0 = (ace ? [ace] : []).concat(lad);
  const strength = {}, starOf = {}, sm = starsMap_();
  order0.forEach(function (p) { const e = lc_(p.Email); strength[e] = strength_(p.Email, matches); starOf[e] = sm[norm_(p.ClubID)]; });
  const reach = Number(C.CHALLENGE_REACH) || 3, exAce = Number(C.EX_ACE_RANK) || 3, SD = 4.2;
  const pWin = function (ch, df) { const A = strength[ch], H = strength[df]; return winProb_(A, H, starOf[ch] == null ? null : starOf[ch], starOf[df] == null ? null : starOf[df], Math.min(A.g, H.g)); };
  const pBy = function (p, need) { if (need <= 1) return p; const mu = 0.5 + SD * invPhi_(Math.min(0.995, Math.max(0.005, p))); return phi_((mu - (need - 0.5)) / SD); };
  const RUNS = 2000, wins = {};
  const hasAce = !!ace;
  for (let r = 0; r < RUNS; r++) {
    const o = order0.map(function (p) { return lc_(p.Email); });   // o[0] = Ace (if there is one)
    let n = Math.round(rate * daysLeft + (Math.random() - 0.5) * Math.sqrt(rate * daysLeft) * 2);
    while (n-- > 0 && o.length > 1) {
      if (hasAce && Math.random() < titleShare) {
        const k = 1 + Math.floor(Math.random() * Math.min(2, o.length - 1));   // usually #1, sometimes #2 via the open mound
        const ch = o[k];
        if (Math.random() < pWin(ch, o[0])) {
          const old = o[0]; o.splice(k, 1); o[0] = ch; o.splice(Math.min(exAce, o.length), 0, old);
        }
        continue;
      }
      const lo = hasAce ? 2 : 1;
      if (o.length <= lo) continue;
      const ci = lo + Math.floor(Math.random() * (o.length - lo));
      const gap = 1 + Math.floor(Math.random() * Math.min(reach, ci - (hasAce ? 1 : 0)));
      const di = ci - gap;
      if (di < (hasAce ? 1 : 0)) continue;
      const ch = o[ci], p = pWin(ch, o[di]);
      if (Math.random() < pBy(p, needFor_(gap))) { o.splice(ci, 1); o.splice(di, 0, ch); }
      else if (Math.random() > p && ci + 1 < o.length) { o[ci] = o[ci + 1]; o[ci + 1] = ch; }   // lost: drop one
    }
    wins[o[0]] = (wins[o[0]] || 0) + 1;
  }
  const vig = 1 + (Number(C.BOOK_VIG) || 0);
  return order0.map(function (p) {
    const e = lc_(p.Email), share = (wins[e] || 0) / RUNS;
    return { email: e, name: norm_(p.Discord), club: norm_(p.Club), rank: Number(p.Rank), pct: Math.round(share * 1000) / 10,
      odds: american_(Math.max(0.005, share) * vig) };
  }).sort(function (a, b) { return b.pct - a.pct || a.rank - b.rank; });
}

// Hourly: re-run the futures (held while a result is waiting to air, so odds never spoil it).
function futuresTick_(force) {
  const C = cfg_();
  if (!bookOn_(C) || C.STATE_SEASON_CLOSED || (!force && pendingQueue_())) return;
  const f = simFutures_(C);
  if (!f) return;
  const props = PropertiesService.getScriptProperties();
  let prev = {}; try { prev = JSON.parse(props.getProperty('FUT_DAY') || '{}'); } catch (e) { prev = {}; }
  const day = denverDay_(now_());
  if (prev.day !== day) { prev = { day: day, base: {} }; f.forEach(function (x) { prev.base[x.email] = x.pct; }); props.setProperty('FUT_DAY', JSON.stringify(prev)); }
  f.forEach(function (x) { x.move = prev.base[x.email] != null ? Math.round((x.pct - prev.base[x.email]) * 10) / 10 : 0; });
  props.setProperty('FUTURES', JSON.stringify({ at: now_().toISOString(), rows: f }));
  try { futuresMovesPost_(f); } catch (e) { }
  refreshFormChoices();
  try { snapshotBoard_(); } catch (e) { }
}
function futures_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('FUTURES') || 'null'); } catch (e) { return null; } }
function futChoices_() {
  const f = futures_(); if (!f) return [];
  return f.rows.map(function (x) { return { label: '♠️ FUTURES · ' + x.name + ' finishes Season as the Ace (' + fmtOdds_(x.odds) + ')', market: 'FUT', pick: x.email, odds: x.odds, name: x.name }; });
}
// At the season close: pay the futures on the club that ended up on the mound.
function settleFutures_(C) {
  const pt = players_(), ace = ace_(pt), winner = ace ? lc_(ace.Email) : '';
  const bt = readTable_(SHEETS.BETS);
  bt.rows.forEach(function (b) {
    if (b.Market !== 'FUT' || b.Status !== 'Open' || String(b.Season) !== String(C.SEASON)) return;
    b.Status = lc_(b.Pick) === winner ? 'Won' : 'Lost';
    b.Profit = b.Status === 'Won' ? profit_(num_(b.Stake), b.Odds) : -num_(b.Stake);
    writeRow_(bt, b);
  });
}
function adminRunFutures() { withUi_(function () { futuresTick_(true); potTick_(true); return 'Futures and matchup lines updated.'; }); }

// Sample data for a preview of the board: open the board URL with ?demo=1 on the end. Made-up clubs; nothing is saved.
function demoBoard_() {
  const now = Date.now(), H = 3600e3, D = 24 * H, iso = function (ms) { return new Date(ms).toISOString(); };
  const L = [['Bo Knows', 'Bayou Bombers', 14, 6], ['Cy Young Again', 'Cactus Cyclones', 12, 7], ['Dee Gee', 'Desert Gila', 11, 9], ['Moose', 'Moose Lodge 9', 9, 8],
    ['Lefty Lou', 'Louisville Sluggers', 8, 10], ['Tater Tot', 'Idaho Spuds', 7, 9], ['Rook', 'Rookie Mistakes', 4, 11], ['Pine Tar', 'Pine Tar Pirates', 3, 12]];
  return {
    formLink: 'https://tinyurl.com/holdthehillsb', season: 1, updated: iso(now), seasonStart: iso(now - 9 * D), seasonEnd: iso(now + 18 * D), seasonClosed: false, prizes: 'SmallBall Tickets and pictures of dogs',
    moundOpenTo: 2, daily: [10, 5, 4, 3, 2, 2, 1, 1, 1, 1, 1],
    ace: { name: 'Slip', club: 'Terrapin Station', clubId: '8897', rank: 0, w: 16, l: 4, defenses: 4, reigns: 2, best: 150, pts: 190, reign: 3, since: iso(now - 4 * D), rdef: 4, rpts: 150, next: 160, revenge: false },
    ladder: L.map(function (x, i) { return { name: x[0], club: x[1], rank: i + 1, w: x[2], l: x[3], defenses: 0, reigns: 0, best: 0, pts: 0 }; }),
    charges: [{ type: 'Title', ch: 'Bo Knows', df: 'Slip', created: iso(now - 4 * 60e3), deadline: iso(now + 56 * 60e3), status: 'Waiting on the game' },
      { type: 'Ladder', ch: 'Tater Tot', df: 'Dee Gee', created: iso(now - 30 * 60e3), deadline: iso(now + 30 * 60e3), status: 'Game reported' }],
    matches: [
      { date: iso(now - 3 * H), type: 'Title', w: 'Slip', l: 'Cy Young Again', wr: 6, lr: 3, outcome: 'Defense #4 (+80)', pts: 80, game: '7731' },
      { date: iso(now - 6 * H), type: 'Ladder', w: 'Bo Knows', l: 'Dee Gee', wr: 9, lr: 4, outcome: 'Bo Knows takes #1', pts: 0, game: '7702' },
      { date: iso(now - 9 * H), type: 'Ladder', w: 'Moose', l: 'Lefty Lou', wr: 5, lr: 4, outcome: 'Moose takes #4', pts: 0, game: '7688' },
      { date: iso(now - 14 * H), type: 'Ladder', w: 'Lefty Lou', l: 'Rook', wr: 3, lr: 1, outcome: 'Won by 2, needed 3+: no change', pts: 0, game: '7650' },
      { date: iso(now - D), type: 'Title', w: 'Slip', l: 'Bo Knows', wr: 4, lr: 4, outcome: 'Tie: Slip holds', pts: 0, game: '7611' },
      { date: iso(now - 1.4 * D), type: 'Title', w: 'Slip', l: 'Dee Gee', wr: 7, lr: 2, outcome: 'Defense #3 (+40)', pts: 40, game: '7580' }],
    reigns: [{ n: 3, name: 'Slip', club: 'Terrapin Station', start: iso(now - 4 * D), end: '', defenses: 4, pts: 150, endedBy: '', revenge: false },
      { n: 2, name: 'Cy Young Again', club: 'Cactus Cyclones', start: iso(now - 7 * D), end: iso(now - 4 * D), defenses: 2, pts: 30, endedBy: 'Slip', revenge: false },
      { n: 1, name: 'Slip', club: 'Terrapin Station', start: iso(now - 9 * D), end: iso(now - 7 * D), defenses: 1, pts: 10, endedBy: 'Cy Young Again', revenge: false }],
    revenge: null,
    awards: [
      { icon: '♠️', name: 'Season 1 Ace', what: 'On the mound when the season ends', who: 'Slip', club: 'Terrapin Station', value: 'On the mound' },
      { icon: '🏆', name: 'The Bench Clearer Cup', what: 'Most Brawl points all season', who: 'Slip', club: 'Terrapin Station', value: '232 pts' },
      { icon: '👑', name: 'Longest Reign', what: 'Most days on the mound in one reign', who: 'Slip', club: 'Terrapin Station', value: '4 days' },
      { icon: '🛡️', name: 'Iron Mound', what: 'Most title defenses in one reign', who: 'Slip', club: 'Terrapin Station', value: '4 defenses' },
      { icon: '📈', name: 'Biggest Climber', what: 'Most spots climbed from their lowest spot', who: 'Bo Knows', club: 'Bayou Bombers', value: '+6 spots' },
      { icon: '💥', name: 'Haymaker', what: 'Biggest winning margin', who: 'Bo Knows', club: 'Bayou Bombers', value: 'won by 5 (9-4)' },
      { icon: '🥊', name: 'Brawler', what: 'Most charges thrown, win or lose', who: 'Tater Tot', club: 'Idaho Spuds', value: '9 charges' },
      { icon: '💰', name: 'The Sharp', what: 'Biggest Brawl Bucks bankroll (sportsbook)', who: 'Moose', club: 'Moose Lodge 9', value: '1645 BB' }],
    cup: [{ name: 'Slip', club: 'Terrapin Station', pts: 232 }, { name: 'Cy Young Again', club: 'Cactus Cyclones', pts: 96 }, { name: 'Bo Knows', club: 'Bayou Bombers', pts: 44 },
      { name: 'Dee Gee', club: 'Desert Gila', pts: 31 }, { name: 'Moose', club: 'Moose Lodge 9', pts: 18 }],
    futures: { at: iso(now), rows: [{ name: 'Slip', club: 'Terrapin Station', rank: 0, pct: 38.4, odds: 160, move: -4.1 }, { name: 'Bo Knows', club: 'Bayou Bombers', rank: 1, pct: 21.7, odds: 340, move: 6.2 },
      { name: 'Cy Young Again', club: 'Cactus Cyclones', rank: 2, pct: 14.9, odds: 540, move: -1.3 }, { name: 'Dee Gee', club: 'Desert Gila', rank: 3, pct: 9.8, odds: 875, move: -0.6 },
      { name: 'Moose', club: 'Moose Lodge 9', rank: 4, pct: 6.6, odds: 1355, move: 1.1 }, { name: 'Lefty Lou', club: 'Louisville Sluggers', rank: 5, pct: 4.1, odds: 2235, move: 0 },
      { name: 'Tater Tot', club: 'Idaho Spuds', rank: 6, pct: 2.9, odds: 3195, move: 0.4 }, { name: 'Rook', club: 'Rookie Mistakes', rank: 7, pct: 1.0, odds: 9470, move: -0.2 }] },
    bookOn: true,
    bookOpen: [{ id: 'C-0042', away: 'Bo Knows', home: 'Slip', aml: -115, hml: -105, fav: 'away', frl: 130, drl: -155, total: 8.5, ou: -110, closes: iso(now + 6 * 60e3) }],
    bank: [{ name: 'Moose', bank: 1645 }, { name: 'Bo Knows', bank: 1310 }, { name: 'Lefty Lou', bank: 1120 }, { name: 'Slip', bank: 960 }, { name: 'Rook', bank: 415 }],
    book: { base: 1000,
      hits: [{ name: 'Moose', what: 'Moose to win', odds: 210, profit: 420 }, { name: 'Bo Knows', what: 'Bo Knows −1.5', odds: 130, profit: 195 },
        { name: 'Lefty Lou', what: 'Over 8.5', odds: -110, profit: 90 }],
      bettors: [
        { name: 'Moose', bank: 1645, w: 5, l: 2, p: 0, open: [{ what: 'Under 8.5', game: 'C-0042', odds: -110, stake: 200, toWin: 181 }],
          done: [{ what: 'Moose to win', game: 'C-0039', odds: 210, stake: 200, res: 'Won', profit: 420 }, { what: 'Slip to win', game: 'C-0037', odds: -150, stake: 150, res: 'Won', profit: 100 },
            { what: 'Over 9.5', game: 'C-0033', odds: -110, stake: 100, res: 'Lost', profit: -100 }] },
        { name: 'Bo Knows', bank: 1310, w: 3, l: 1, p: 1, open: [{ what: 'Bo Knows to win', game: 'C-0042', odds: -115, stake: 300, toWin: 260 }],
          done: [{ what: 'Bo Knows −1.5', game: 'C-0040', odds: 130, stake: 150, res: 'Won', profit: 195 }, { what: 'Bo Knows to win', game: 'C-0035', odds: 120, stake: 100, res: 'Push', profit: 0 }] },
        { name: 'Rook', bank: 415, w: 1, l: 4, p: 0, open: [], done: [{ what: 'Rook +1.5', game: 'C-0038', odds: -160, stake: 300, res: 'Lost', profit: -300 }] }] },
  };
}

// ───────────────────────────── Hill Board (web page) ─────────────────────────────
// A live scoreboard anyone can open: Deploy → New deployment → Web app → Execute as: Me, Who has access:
// Anyone. It shows only what has already been posted publicly (a snapshot taken at every Discord post, held
// back while a result is still waiting for its game to air), and never emails. It refreshes every minute.

const BOARD_TAB = 'Board';

function snapshotBoard_() {
  try {
    const ss = SpreadsheetApp.getActive();
    let sh = ss.getSheetByName(BOARD_TAB);
    if (!sh) { sh = ss.insertSheet(BOARD_TAB); sh.getRange('A1').setNumberFormat('@'); sh.hideSheet(); }
    let prev = {}; try { prev = JSON.parse(sh.getRange('A1').getValue() || '{}'); } catch (e) { prev = {}; }
    const C = cfg_();
    const iso = function (d) { return d ? new Date(d).toISOString() : ''; };
    const ct = challenges_();
    const open = ct.rows.filter(function (c) { return OPEN.indexOf(c.Status) >= 0; }).map(function (c) {
      return { type: c.Type, ch: norm_(c.ChallengerName), df: norm_(c.DefenderName), created: iso(c.Created), deadline: iso(c.Deadline), status: c.Status === 'Started' ? 'Game reported' : c.Status === 'Review' ? 'With the commish' : 'Waiting on the game' };
    });
    let pending = []; try { pending = JSON.parse(PropertiesService.getScriptProperties().getProperty('POST_QUEUE') || '[]'); } catch (e) { pending = []; }
    const se = seasonEnd_(C), ss0 = seasonStart_(C);
    let bookOpen = [];
    try { if (bookOn_(C)) bookOpen = openLines_().map(function (L) { return { id: L.ChallengeID, away: L.Away, home: L.Home, aml: L.AwayML, hml: L.HomeML, fav: L.Fav, frl: L.FavRL, drl: L.DogRL, total: L.Total, ou: L.OverOdds, closes: iso(L.Closes) }; }); } catch (e) { bookOpen = []; }
    let rjs = []; try { rjs = JSON.parse(PropertiesService.getScriptProperties().getProperty('REJECTS') || '[]').filter(function (x) { return now_() - new Date(x.at) < 3600e3; }); } catch (e) { rjs = []; }
    const snap = Object.assign({}, prev, { rejects: rjs, pot: (bookOn_(C) ? potCurrent_() : []).map(function (L) { return { ch: L.ch, df: L.df, t: L.title, a: L.aml, h: L.hml, cr: L.chRank }; }), formLink: norm_(C.FORM_LINK), bookOn: bookOn_(C), bookOpen: bookOpen, moundOpenTo: moundOpenTo_(C), reach: Number(C.CHALLENGE_REACH) || 3, daily: dailyTable_(C), season: C.SEASON, seasonStart: ss0 ? ss0.toISOString() : '', seasonEnd: se ? se.toISOString() : '', seasonClosed: !!C.STATE_SEASON_CLOSED, prizes: norm_(C.PRIZES), updated: new Date().toISOString(), charges: open });
    if (!pending.length || !prev.ladder) {   // a result still waiting to air keeps the standings as they were
      const pt = players_();
      const pub = function (p) { return { name: norm_(p.Discord), club: norm_(p.Club), clubId: norm_(p.ClubID), rank: p.Rank, w: num_(p.Wins), l: num_(p.Losses), defenses: num_(p.Defenses), reigns: num_(p.Reigns), best: num_(p.BestReignPts), pts: num_(p.CareerPts) }; };
      const ace = ace_(pt), reigns = readTable_(SHEETS.REIGNS).rows, cur = currentReign_(readTable_(SHEETS.REIGNS));
      snap.ace = ace ? Object.assign(pub(ace), cur ? { reign: cur.Reign, since: iso(cur.Start), rdef: num_(cur.Defenses), rpts: num_(cur.ReignPts), next: reward_(num_(cur.Defenses) + 1, C), revenge: cur.Revenge === 'Yes' } : {}) : null;
      snap.ladder = ladder_(pt).map(pub);
      snap.matches = readTable_(SHEETS.MATCHES).rows.slice(-15).reverse().map(function (m) {
        return { date: iso(m.Date), type: m.Type, w: norm_(m.Winner), l: norm_(m.Loser), wr: m.WinnerRuns, lr: m.LoserRuns, outcome: norm_(m.Outcome), pts: num_(m.Points), game: norm_(m.GameID) };
      });
      snap.reigns = reigns.slice().reverse().map(function (r) {
        return { n: r.Reign, name: norm_(r.Discord), club: norm_(r.Club), start: iso(r.Start), end: iso(r.End), defenses: num_(r.Defenses), pts: num_(r.ReignPts), endedBy: norm_(r.EndedBy), revenge: r.Revenge === 'Yes' };
      });
      const exAce = C.STATE_REVENGE_EX_ACE ? findBy_(pt, C.STATE_REVENGE_EX_ACE) : null;
      snap.revenge = exAce ? { name: norm_(exAce.Discord), margin: C.STATE_REVENGE_MARGIN } : null;
      try {
        const aw = awards_();
        snap.awards = AWARDS.map(function (w) { const x = aw[w.key]; return { icon: w.icon, name: w.key === 'ace' ? 'Season ' + C.SEASON + ' Ace' : w.name, what: w.what, who: x ? x.name : '', club: x ? x.club : '', value: x ? x.value : '' }; });
        snap.cup = aw.cupTable.map(function (x) { return { name: x.name, club: x.club, pts: x.pts }; });
        snap.bank = (aw.bookTable || []).map(function (x) { return { name: x.name, bank: x.bank }; });
        snap.wagers = wagerOn_(C) ? wagerBoard_(C) : null;
        if (bookOn_(C)) { snap.book = bookBoard_(C); const fu = futures_(); snap.futures = fu ? { at: fu.at, rows: fu.rows.map(function (x) { return { name: x.name, club: x.club, rank: x.rank, pct: x.pct, odds: x.odds, move: x.move }; }) } : null; }
      } catch (e) { log_('system', 'Awards error', String(e)); }
    }
    sh.getRange('A1').setValue(JSON.stringify(snap));
    ghPush_(snap);
  } catch (e) { log_('system', 'Board snapshot error', String(e)); }
}


// ===================== The Hill Board on GitHub Pages =====================
// The token lives in Script Properties (never on a tab). Each change to the board is saved as one JSON file in the
// repo; the page next to it reads that file. Nothing is sent when the board hasn't changed.
function ghPush_(snap, force) {
  const pr = PropertiesService.getScriptProperties(), tok = pr.getProperty('GITHUB_TOKEN');
  if (!tok) return false;
  const C = cfg_(), repo = norm_(C.GITHUB_REPO) || 'slipnsliders/smallball-tools', path = norm_(C.GITHUB_PATH) || 'docs/hill/board.json';
  const body = JSON.stringify(snap), key = JSON.stringify(Object.assign({}, snap, { updated: 0 }));
  const hash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, key + repo + path, Utilities.Charset.UTF_8));
  if (!force && pr.getProperty('GH_HASH') === hash) return true;
  const api = 'https://api.github.com/repos/' + repo + '/contents/' + path.split('/').map(encodeURIComponent).join('/');
  const headers = { Authorization: 'Bearer ' + tok, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  for (let attempt = 0; attempt < 2; attempt++) {
    let sha = null;
    const g = UrlFetchApp.fetch(api, { headers: headers, muteHttpExceptions: true });
    if (g.getResponseCode() === 200) { try { sha = JSON.parse(g.getContentText()).sha; } catch (e) { } }
    else if (g.getResponseCode() !== 404) { log_('system', 'GitHub read failed', g.getResponseCode() + ' ' + g.getContentText().slice(0, 200)); return false; }
    const payload = { message: 'Hill Board update', content: Utilities.base64Encode(body, Utilities.Charset.UTF_8) };
    if (sha) payload.sha = sha;
    const r = UrlFetchApp.fetch(api, { method: 'put', headers: headers, contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true });
    const code = r.getResponseCode();
    if (code === 200 || code === 201) { pr.setProperty('GH_HASH', hash); return true; }
    if (code !== 409 && code !== 422) { log_('system', 'GitHub save failed', code + ' ' + r.getContentText().slice(0, 200)); return false; }
  }
  return false;
}
function ghPageUrl_(C) {
  const repo = (norm_(C.GITHUB_REPO) || 'slipnsliders/smallball-tools').split('/'), path = norm_(C.GITHUB_PATH) || 'docs/hill/board.json';
  return 'https://' + repo[0].toLowerCase() + '.github.io/' + repo[1] + '/' + path.replace(/^docs\//, '').replace(/[^/]*$/, '');
}
function adminConnectGithub() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('Connect the GitHub Hill Board',
    'Paste a GitHub fine-grained token with "Contents: Read and write" on ' + (norm_(cfg_().GITHUB_REPO) || 'slipnsliders/smallball-tools') + ' only.\n' +
    'It is kept in the script\'s private settings, not on any tab. Leave it blank and click OK to disconnect.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  withUi_(function () {
    const pr = PropertiesService.getScriptProperties(), tok = norm_(r.getResponseText());
    if (!tok) { pr.deleteProperty('GITHUB_TOKEN'); pr.deleteProperty('GH_HASH'); return 'GitHub disconnected. The board stays on the Google web app.'; }
    pr.setProperty('GITHUB_TOKEN', tok); pr.deleteProperty('GH_HASH');
    snapshotBoard_();
    if (!pr.getProperty('GH_HASH')) return 'GitHub didn\'t accept that token. Check it has Contents: Read and write on the repo, then try again (the Log tab has the details).';
    const url = ghPageUrl_(cfg_());
    setCfg_('BOARD_LINK', url);
    return 'Connected! The Hill Board is now at ' + url + ' (give GitHub a minute the first time). Discord posts link there, and the old board link forwards there once you deploy a new version of the web app.';
  });
}

// Once the board lives on GitHub, the old web app link (and any short link to it) forwards there.
function redirectPage_(url) {
  const u = String(url).replace(/"/g, '&quot;');
  return HtmlService.createHtmlOutput('<!doctype html><html><head><meta charset="utf-8"><base target="_top">' +
    '<style>body{margin:0;background:#0E1B33;color:#F4EBD9;font:500 17px/1.5 Oswald,system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;text-align:center}a{display:inline-block;margin-top:14px;background:#C8102E;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600}</style></head>' +
    '<body><div>⛰️ The Hill Board moved to a faster home.<br><a href="' + u + '">Open the Hill Board →</a></div>' +
    '<script>try{window.top.location.replace("' + u + '")}catch(e){}</script></body></html>')
    .setTitle('Hold the Hill · SmallBall').addMetaTag('viewport', 'width=device-width, initial-scale=1').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doGet(e) {
  try { const bl = norm_(cfg_().BOARD_LINK); if (/github\.io/i.test(bl) && !(e && e.parameter && (e.parameter.demo || e.parameter.stay))) return redirectPage_(bl); } catch (err) { }
  let data = '{}';
  if (e && e.parameter && e.parameter.demo) data = JSON.stringify(demoBoard_());   // ?demo=1 → made-up sample data, nothing saved
  else try { const sh = SpreadsheetApp.getActive().getSheetByName(BOARD_TAB); if (sh) data = sh.getRange('A1').getValue() || '{}'; } catch (err) { data = '{}'; }
  const safe = String(data).replace(/</g, '\\u003c');
  const html = BOARD_HTML_.replace('__DATA__', function () { return safe; });
  return HtmlService.createHtmlOutput(html).setTitle('Hold the Hill · SmallBall')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function adminRefreshBoard() { withUi_(function () { snapshotBoard_(); return 'Board updated.'; }); }

const BOARD_HTML_ = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="60">
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Oswald:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}html,body{margin:0}body{background:#0E1B33;color:#F4EBD9;font:500 15px/1.45 Oswald,'Arial Narrow',system-ui,sans-serif;overflow-x:hidden}
.bb{font-family:'Bebas Neue',Impact,'Arial Narrow',sans-serif;font-weight:400;letter-spacing:.04em}
.wrap{max-width:1100px;margin:0 auto;padding:0 16px 70px}
.hero{position:relative;height:322px;overflow:hidden;border-bottom:5px solid #C8102E;background:linear-gradient(180deg,#081226 0%,#122a52 55%,#1d3a2a 100%)}
.hero svg{position:absolute;inset:auto 0 0 0;width:100%;height:100%}
.stars i{position:absolute;width:2px;height:2px;background:#fff;border-radius:50%;opacity:.6;animation:tw 3s infinite}
@keyframes tw{50%{opacity:.15}}
.hero .top{position:absolute;left:0;right:0;top:12px;text-align:center}
.hero h1{margin:0;font-size:clamp(36px,7vw,64px);line-height:.95;text-shadow:3px 3px 0 #C8102E}
.hero .tag{letter-spacing:.3em;font-size:11px;opacity:.8;text-transform:uppercase}
.brand{display:inline-flex;align-items:center;gap:14px}.hero .brand svg.logo{position:static;inset:auto;width:78px;height:78px;flex:none;filter:drop-shadow(0 4px 0 rgba(0,0,0,.45));animation:pop .6s ease-out both}@keyframes pop{from{transform:scale(.6) rotate(-12deg);opacity:0}}
.foot .logo{display:block;width:64px;height:64px;margin:0 auto 8px;opacity:.9}
.flag{position:absolute;left:50%;top:122px;width:94%;transform:translateX(-50%);text-align:center;animation:rise 1s ease-out both}
@keyframes rise{from{opacity:0;transform:translate(-50%,20px)}}
.flag .lab{display:inline-block;background:#C8102E;padding:2px 10px;letter-spacing:.25em;font-size:12px}
.flag .nm{font-size:clamp(34px,6vw,56px);line-height:1;text-shadow:3px 3px 0 #000;margin-top:2px}
.flag .club{opacity:.85;font-size:14px}
.sp{display:inline-block;color:#ffd166;animation:shim 2.4s infinite}@keyframes shim{50%{color:#fff;text-shadow:0 0 18px #ffd166}}
.days{margin-top:8px;display:inline-flex;gap:10px;flex-wrap:wrap;justify-content:center}
.chip{background:rgba(14,27,51,.88);border:2px solid #F4EBD9;padding:3px 10px;box-shadow:0 3px 0 #C8102E;font-size:13px}
.chip b{font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;font-size:22px;color:#ffd166;margin-right:5px;letter-spacing:.03em}
.alert{margin:18px 0 0;background:linear-gradient(90deg,#b45309,#C8102E);padding:12px 16px;font-size:17px;box-shadow:0 4px 0 #000}
h2{font-size:28px;margin:24px 0 10px;display:flex;align-items:center;gap:12px}h2:after{content:"";flex:1;height:3px;background:linear-gradient(90deg,#C8102E,transparent)}
.cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:22px}@media(max-width:820px){.cols{grid-template-columns:1fr}}
.climb{display:flex;flex-direction:column;gap:4px}
.step{display:grid;grid-template-columns:44px 1fr auto;align-items:center;gap:10px;margin-left:calc(var(--i)*10px);background:linear-gradient(90deg,rgba(244,235,217,.12),rgba(244,235,217,.03));border-left:4px solid #334155;padding:5px 12px;animation:slide .5s ease-out both}
@keyframes slide{from{opacity:0;transform:translateX(-20px)}}
.step .rk{font-size:26px;color:#ffd166;line-height:1}.step .who{font-size:17px;line-height:1.1}.step .who small{display:block;opacity:.65;font-size:12px}
.step .wl{font-size:20px;opacity:.9}.step.top{border-left-color:#ffd166;background:linear-gradient(90deg,rgba(255,209,102,.22),rgba(244,235,217,.03))}
.step.ace{grid-template-columns:54px 1fr auto;margin:14px 0 8px;padding:14px 14px 10px;border-left:6px solid #C8102E;background:linear-gradient(90deg,rgba(200,16,46,.55),rgba(255,209,102,.18) 70%,rgba(244,235,217,.04));box-shadow:0 0 0 2px #ffd166 inset,0 0 22px rgba(255,209,102,.35);position:relative;animation:slide .5s ease-out both,glow 2.4s ease-in-out infinite}
@keyframes glow{50%{box-shadow:0 0 0 2px #ffd166 inset,0 0 34px rgba(255,209,102,.6)}}
.step.ace .rk{font-size:40px;color:#ffd166;text-align:center;text-shadow:0 2px 0 #000}.step.ace .who{font-size:24px}.step.ace .who small{font-size:13px;opacity:.85}
.step.ace .tag{position:absolute;left:14px;top:-11px;background:#ffd166;color:#0E1B33;font-size:12px;letter-spacing:.14em;padding:1px 8px}
.step.ace .wl{font-size:15px;text-align:right;line-height:1.15;color:#ffd166}.step.ace .wl b{display:block;font-size:24px;color:#F4EBD9;font-weight:400}
.step.ace.open{background:linear-gradient(90deg,rgba(244,235,217,.1),rgba(244,235,217,.02));box-shadow:0 0 0 2px rgba(255,209,102,.5) inset;animation:slide .5s ease-out both}
.rnote{font-family:Oswald,sans-serif;font-size:12px;opacity:.65;margin:8px 2px 0}
.step .rch{display:block;font-family:Oswald,sans-serif;font-size:11.5px;letter-spacing:.04em;color:#9fd3ff;opacity:.9;margin-top:2px}
.step.shot .who:after{content:"  ♠ title shot open";font-size:12px;color:#ffd166;letter-spacing:.08em}
.fights{display:grid;gap:10px}
.fight{position:relative;background:#F4EBD9;color:#0E1B33;padding:10px 12px 8px;box-shadow:0 4px 0 #C8102E;animation:slide .5s ease-out both}
.fight .kind{position:absolute;right:8px;top:8px;background:#0E1B33;color:#F4EBD9;padding:1px 8px;font-size:11px;letter-spacing:.12em}
.fight.title .kind{background:#C8102E}.fight.rev .kind{background:#b45309}
.fight .vs{font-size:26px;line-height:1.05;padding-right:64px}.fight .vs em{font-style:normal;color:#C8102E;font-size:18px;margin:0 6px}
.fight .meta{display:flex;justify-content:space-between;align-items:center;margin-top:4px;font-size:13px}
.stamp{border:2px solid #C8102E;color:#C8102E;padding:0 8px;transform:rotate(-4deg);display:inline-block;letter-spacing:.1em;font-size:16px}
.empty{opacity:.65;font-style:italic;padding:12px 0}
.results{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px}
.res{background:rgba(244,235,217,.06);border-top:3px solid #C8102E;padding:8px 10px}.res .d{opacity:.6;font-size:12px}
.res .w{font-size:20px;line-height:1.05}.res .s{font-size:18px;color:#ffd166}.res .o{font-size:12px;opacity:.8}
.reigns{display:flex;gap:10px;overflow-x:auto;padding-bottom:8px}
.rg{min-width:160px;background:rgba(244,235,217,.06);border:1px solid rgba(244,235,217,.2);padding:8px 12px}.rg .n{font-size:28px;color:#ffd166;line-height:1}.rg .nm{font-size:19px}.rg .m{font-size:12px;opacity:.75}
.how{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px}
.card{background:linear-gradient(160deg,rgba(36,64,110,.7),rgba(14,27,51,.9));border:2px solid rgba(244,235,217,.22);padding:10px 12px;font-size:14px}
.card h3{margin:0 0 4px;font-size:22px;color:#ffd166}.card p{margin:4px 0;opacity:.9}
.reach{display:flex;flex-direction:column;gap:3px;margin-top:6px}.reach div{padding:2px 8px;background:rgba(244,235,217,.08);font-size:14px}
.reach .ok{background:rgba(34,197,94,.25);border-left:4px solid #22c55e}.reach .me{background:#C8102E}.reach .no{opacity:.45}
.bars{display:flex;align-items:flex-end;gap:5px;height:90px;margin-top:22px}
.bars div{flex:1;background:linear-gradient(180deg,#ffd166,#C8102E);position:relative;animation:grow 1.2s ease-out both;transform-origin:bottom}
@keyframes grow{from{transform:scaleY(0)}}
.bars span{position:absolute;top:-22px;left:0;right:0;text-align:center;font-size:14px;color:#ffd166}.bars i{position:absolute;bottom:-20px;left:0;right:0;text-align:center;font-style:normal;font-size:11px;opacity:.7}
.steps3{display:flex;flex-direction:column;gap:5px;margin-top:4px}.steps3 div{display:flex;gap:10px;align-items:center}.steps3 b{font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;font-size:24px;color:#C8102E;width:18px;flex:none}
.flame{font-size:24px;animation:shim 1.6s infinite}
.tick{position:fixed;left:0;right:0;bottom:0;height:38px;background:#0E1B33;border-top:4px solid #C8102E;display:flex;align-items:center;overflow:hidden;z-index:5}
.tick .lab{flex:none;background:#C8102E;height:100%;display:flex;align-items:center;padding:0 12px;font-size:20px;letter-spacing:.12em}
.tick .run{white-space:nowrap;padding-left:100%;animation:run 60s linear infinite;font-size:17px;letter-spacing:.04em}.tick .run i{font-style:normal;color:#C8102E;margin:0 18px}
@keyframes run{to{transform:translateX(-100%)}}
.foot{margin-top:22px;opacity:.55;font-size:12px;text-align:center}
.rej{margin:14px 0 0;background:rgba(200,16,46,.18);border:2px solid #C8102E;padding:10px 14px}.rej b{font-size:22px;color:#ff6b7d;display:block;margin-bottom:4px}.rej div{font-size:14px;padding:2px 0}.rej small{opacity:.6}
.cta{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;justify-content:center;margin:14px 0 0}.cta a{background:#C8102E;color:#F4EBD9;text-decoration:none;padding:8px 18px;font-family:'Bebas Neue',Impact,sans-serif;font-size:22px;letter-spacing:.04em;box-shadow:0 4px 0 #000}.cta a:hover{background:#e01535}.cta span{font-size:13px;opacity:.75}
.sea{margin:18px 0 0;display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;justify-content:space-between;background:linear-gradient(90deg,#14532d,#0E1B33);border-left:5px solid #ffd166;padding:10px 16px;box-shadow:0 4px 0 #000}
.sea .big{font-size:22px;color:#ffd166}.sea .clk{font-size:26px}
.hw{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:14px}@media(max-width:820px){.hw{grid-template-columns:1fr}}
.cup{background:linear-gradient(180deg,rgba(255,209,102,.16),rgba(244,235,217,.04));border-top:4px solid #ffd166;padding:10px 14px}
.cup h3{margin:0 0 6px;font-size:22px;color:#ffd166}.cup .r{display:grid;grid-template-columns:26px 1fr auto;gap:8px;align-items:center;padding:4px 0;border-bottom:1px solid rgba(244,235,217,.1)}
.cup .r b{font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;font-size:22px;color:#C8102E}.cup .r small{display:block;opacity:.6;font-size:12px}
.aws{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px}
.aw{background:rgba(244,235,217,.07);border-left:4px solid #C8102E;padding:8px 10px}.aw .i{font-size:22px}.aw .t{font-size:18px;color:#ffd166}.aw .w{font-size:19px;line-height:1.1;margin-top:2px}.aw .v,.aw .q{font-size:12px;opacity:.7}
.prize{margin-top:10px;font-size:15px}
.book{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:14px}@media(max-width:820px){.book{grid-template-columns:1fr}}
.ln{background:linear-gradient(90deg,rgba(255,209,102,.12),rgba(244,235,217,.04));border-left:4px solid #ffd166;padding:8px 12px;margin-bottom:8px}
.ln .t{display:flex;justify-content:space-between;font-size:13px;opacity:.75}.ln .g{display:grid;grid-template-columns:1fr auto auto auto;gap:4px 14px;align-items:center;margin-top:4px}
.mine{margin-top:10px;background:rgba(244,235,217,.06);padding:10px 12px}.mine select{background:#0E1B33;color:#F4EBD9;border:1px solid #ffd166;font:inherit;padding:4px 6px;max-width:100%}
.mine .bx{display:flex;gap:14px;flex-wrap:wrap;margin:8px 0;font-size:14px}.mine .bx b{font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;font-size:24px;color:#ffd166;margin-right:4px}
.mine .it{display:flex;justify-content:space-between;gap:8px;font-size:14px;padding:3px 0;border-bottom:1px solid rgba(244,235,217,.08)}.mine .won{color:#4ade80}.mine .lost{color:#f87171}
.hit{font-size:14px;padding:3px 0}.hit b{color:#4ade80}
.fut{margin-top:12px}.fut .r{display:grid;grid-template-columns:30px minmax(0,1fr) 120px 64px 70px;gap:8px;align-items:center;padding:5px 8px;border-bottom:1px solid rgba(244,235,217,.08)}
.fut .r b{font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;font-size:22px;color:#ffd166;text-align:right}.fut .bar{height:8px;background:rgba(244,235,217,.1)}.fut .bar i{display:block;height:8px;background:#ffd166}
.fut .up{color:#4ade80;font-size:13px}.fut .dn{color:#f87171;font-size:13px}.fut small{display:block;opacity:.6;font-size:12px}@media(max-width:600px){.fut .r{grid-template-columns:24px minmax(0,1fr) 60px 56px}.fut .r .bar{display:none}}
.ln .g b{font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;font-size:20px;color:#ffd166}.ln .g span{font-size:15px}
@media(max-width:600px){.brand{flex-direction:column;gap:2px}.hero .brand svg.logo{width:62px;height:62px}.hero{height:340px!important}.flag{top:128px!important}.hero .top{top:8px}.wrap{padding:0 10px 60px}.hero{height:290px}.flag{top:84px}.step{margin-left:calc(var(--i)*4px)}.results{grid-template-columns:1fr 1fr}.res .w{font-size:17px}.fight .vs{font-size:22px}h2{font-size:24px;margin:18px 0 8px}.tick{height:34px}.tick .run{font-size:15px}}
.cid{color:#ffd166;text-decoration:none;border-bottom:1px dotted #ffd166;font-weight:700}.cid:hover{color:#fff}</style></head><body>
<div class="hero"><div class="stars" id="stars"></div>
<svg viewBox="0 0 1200 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
<defs><radialGradient id="lg" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff7d6" stop-opacity=".9"/><stop offset="1" stop-color="#fff7d6" stop-opacity="0"/></radialGradient>
<radialGradient id="mg" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#c98a55"/><stop offset="1" stop-color="#9a5f33"/></radialGradient></defs>
<g fill="#0b1a33"><rect x="70" y="60" width="8" height="150"/><rect x="1122" y="60" width="8" height="150"/></g>
<g fill="#fff3c4"><rect x="46" y="46" width="56" height="18" rx="2"/><rect x="1098" y="46" width="56" height="18" rx="2"/></g>
<circle cx="74" cy="56" r="90" fill="url(#lg)"/><circle cx="1126" cy="56" r="90" fill="url(#lg)"/>
<path d="M-20 205 Q600 120 1220 205 L1220 222 Q600 140 -20 222Z" fill="#14305a"/>
<path d="M-20 222 Q600 140 1220 222 L1220 300 L-20 300Z" fill="#2e7a3d"/>
<g fill="#36894a" opacity=".55"><path d="M80 300 L300 168 L360 166 L180 300Z"/><path d="M420 300 L540 152 L600 151 L540 300Z"/><path d="M660 300 L660 151 L720 152 L780 300Z"/><path d="M1020 300 L840 166 L900 168 L1120 300Z"/></g>
<path d="M600 196 L760 262 L600 330 L440 262Z" fill="#b5764a" opacity=".55"/>
<ellipse cx="600" cy="282" rx="170" ry="44" fill="url(#mg)"/>
<ellipse cx="600" cy="276" rx="120" ry="26" fill="#d39762" opacity=".6"/>
<rect x="578" y="266" width="44" height="7" rx="1" fill="#fff"/>
<g fill="#fff"><rect x="596" y="196" width="10" height="10" transform="rotate(45 601 201)"/><rect x="755" y="257" width="10" height="10" transform="rotate(45 760 262)"/><rect x="435" y="257" width="10" height="10" transform="rotate(45 440 262)"/></g>
</svg>
<div class="top"><div class="brand"><svg class="logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Hold the Hill logo">
<defs>
<path id="arcTop" d="M 76 256 A 180 180 0 0 1 436 256"/>
<path id="arcBot" d="M 96 270 A 162 162 0 0 0 416 270"/>
<radialGradient id="ball" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#e6d9bf"/></radialGradient>
<radialGradient id="shiner" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#2a1640"/><stop offset=".6" stop-color="#5b2a7a"/><stop offset="1" stop-color="#8a3a8f" stop-opacity="0"/></radialGradient>
<linearGradient id="glove" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8273f"/><stop offset="1" stop-color="#9c0b22"/></linearGradient>
</defs>
<circle cx="256" cy="256" r="250" fill="#C8102E"/>
<circle cx="256" cy="256" r="238" fill="#0E1B33"/>
<circle cx="256" cy="256" r="232" fill="none" stroke="#F4EBD9" stroke-width="3"/>
<text font-family="Anton" font-size="44" fill="#F4EBD9" letter-spacing="6"><textPath href="#arcTop" startOffset="50%" text-anchor="middle">HOLD THE HILL</textPath></text>
<g fill="#F4EBD9"><path d="M70 268 l6 12 13 2 -10 9 3 13 -12-6 -12 6 3-13 -10-9 13-2z"/><path d="M442 268 l6 12 13 2 -10 9 3 13 -12-6 -12 6 3-13 -10-9 13-2z"/></g>

<ellipse cx="256" cy="400" rx="150" ry="34" fill="#a5683d"/><ellipse cx="256" cy="394" rx="104" ry="20" fill="#c98a55"/><rect x="236" y="388" width="40" height="7" fill="#fff"/>

<circle cx="236" cy="262" r="112" fill="url(#ball)" stroke="#0E1B33" stroke-width="6"/>
<path d="M150 190 C 186 230, 186 296, 150 336" fill="none" stroke="#C8102E" stroke-width="4"/>
<path d="M150 190 C 186 230, 186 296, 150 336" fill="none" stroke="#C8102E" stroke-width="14" stroke-dasharray="3 10"/>
<path d="M322 190 C 286 230, 286 296, 322 336" fill="none" stroke="#C8102E" stroke-width="4"/>
<path d="M322 190 C 286 230, 286 296, 322 336" fill="none" stroke="#C8102E" stroke-width="14" stroke-dasharray="3 10"/>

<ellipse cx="200" cy="246" rx="34" ry="28" fill="url(#shiner)"/>
<ellipse cx="202" cy="248" rx="11" ry="8" fill="#fff"/><circle cx="205" cy="249" r="5" fill="#0E1B33"/>
<path d="M176 222 L226 234" stroke="#0E1B33" stroke-width="8" stroke-linecap="round"/>

<ellipse cx="268" cy="248" rx="13" ry="10" fill="#fff" stroke="#0E1B33" stroke-width="3"/><circle cx="265" cy="250" r="5.5" fill="#0E1B33"/>
<path d="M246 236 L292 226" stroke="#0E1B33" stroke-width="8" stroke-linecap="round"/>

<path d="M198 296 Q236 318 276 292 L272 306 Q236 330 202 308Z" fill="#fff" stroke="#0E1B33" stroke-width="4" stroke-linejoin="round"/>
<path d="M214 301 L214 316 M228 304 L228 320 M244 304 L244 319 M258 300 L258 314" stroke="#0E1B33" stroke-width="3"/>
<rect x="229" y="304" width="14" height="12" fill="#0E1B33"/>

<g transform="rotate(-28 262 186)"><rect x="232" y="176" width="64" height="20" rx="6" fill="#f2c38f" stroke="#0E1B33" stroke-width="3"/><circle cx="252" cy="186" r="2" fill="#0E1B33"/><circle cx="264" cy="186" r="2" fill="#0E1B33"/><circle cx="276" cy="186" r="2" fill="#0E1B33"/></g>

<g transform="rotate(-12 380 300)">
<rect x="400" y="282" width="80" height="46" rx="8" fill="#F4EBD9" stroke="#0E1B33" stroke-width="5"/>
<path d="M330 262 C 330 228, 372 220, 404 236 C 428 248, 428 292, 412 314 C 396 334, 344 338, 332 314 C 326 300, 326 282, 330 262Z" fill="url(#glove)" stroke="#0E1B33" stroke-width="6"/>
<path d="M352 248 C 368 240, 390 242, 400 254" fill="none" stroke="#ff8a9a" stroke-width="5" stroke-linecap="round" opacity=".8"/>
<path d="M340 296 C 356 284, 376 286, 386 300" fill="none" stroke="#0E1B33" stroke-width="4" stroke-linecap="round"/>
<rect x="398" y="276" width="14" height="58" rx="4" fill="#0E1B33"/>
</g>

<g fill="#ffd166"><path d="M330 196 l8 -22 4 22 18 -12 -10 20 22 2 -22 8 14 16 -20 -8 -2 20 -8 -18z"/></g>
<text x="256" y="462" font-family="Anton" font-size="34" fill="#ffd166" text-anchor="middle" letter-spacing="5">CHARGE THE MOUND</text>
</svg><div class="bb"><h1>Hold the Hill</h1></div></div><div class="tag" id="season"></div></div>
<div class="flag" id="flag"></div></div>
<div class="wrap" id="app"></div>
<div class="tick"><span class="lab bb">⚾ HILL</span><span class="run bb" id="tick"></span></div>
<script>
var D = __DATA__;
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function day(s){return s?new Date(s).toLocaleDateString([],{month:'short',day:'numeric'}):'';}
function when(s){return s?new Date(s).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'';}
function ndays(a,b){return Math.max(0,Math.floor(((b?new Date(b):new Date())-new Date(a))/864e5));}
function left(s){var ms=new Date(s)-new Date();if(ms<=0)return 'Due now';var h=Math.floor(ms/36e5);return h>=24?Math.floor(h/24)+'d '+(h%24)+'h left':h+'h '+Math.floor(ms%36e5/6e4)+'m left';}
var st=document.getElementById('stars');for(var i=0;i<60;i++){var e=document.createElement('i');e.style.left=Math.random()*100+'%';e.style.top=Math.random()*55+'%';e.style.animationDelay=(Math.random()*3)+'s';st.appendChild(e);}
document.getElementById('season').textContent='SmallBall · The Ace holds the mound'+(D.season?' · Season '+D.season:'');
var A=D.ace;
function reachTxt(p,i){var R=D.reach||3,t=[];for(var j=i-1;j>=0&&i-j<=R;j--){var g=i-j;t.push('#'+lad[j].rank+(g>1?' (by '+(g+1)+'+)':''));}
 if(A&&+p.rank<=(D.moundOpenTo||1))t.unshift('♠ Ace');return t.length?'<span class="rch">⤴ Can charge: '+t.join(' · ')+'</span>':'';}
document.getElementById('flag').innerHTML=A?('<span class="lab bb"><span class="sp">♠</span> THE ACE · ON THE MOUND'+(A.revenge?' · REVENGE REIGN':'')+'</span><div class="nm bb">'+esc(A.name)+'</div><div class="club">'+esc(A.club)+(A.clubId?' · #'+esc(A.clubId):'')+'</div><div class="days">'
 +(A.since?'<span class="chip"><b class="cnt" data-n="'+ndays(A.since)+'">0</b>'+(ndays(A.since)===1?'day':'days')+' on the mound</span>':'')+'<span class="chip"><b class="cnt" data-n="'+(A.rdef||0)+'">0</b>defenses</span><span class="chip"><b class="cnt" data-n="'+(A.rpts||0)+'">0</b>reign pts</span><span class="chip"><b>'+(A.next||10)+'</b>next defense</span></div>')
 :('<span class="lab bb">♠ THE ACE</span><div class="nm bb">The hill is open</div><div class="club">The welcome-back tournament champion plants the first flag.</div>');
var h='';
if(D.revenge)h+='<div class="alert bb">🔥 ACE\\'S REVENGE PENDING: '+esc(D.revenge.name)+' must win by more than '+esc(D.revenge.margin)+'</div>';
var lad=D.ladder||[],ch=D.charges||[],ms=D.matches||[],rg=D.reigns||[];
if((D.rejects||[]).length)h+='<div class="rej"><b class="bb">❌ Didn’t go through</b>'+D.rejects.slice().reverse().map(function(x){return '<div><span class="bb">'+esc(x.who)+'</span> · '+esc(x.kind)+' · <i>'+esc(x.why)+'</i> <small>'+when(x.at)+'</small></div>';}).join('')+'<div style="font-size:12px;opacity:.7">Fix it and send the Hill form again. Shows for an hour.</div></div>';
if(D.formLink)h+='<div class="cta"><a href="'+esc(D.formLink)+'" target="_blank" rel="noopener">📝 Hill form</a><span>Sign up · charge the hill · place a bet</span></div>';
if(D.seasonStart&&new Date(D.seasonStart)>new Date()){h+='<div class="sea"><span class="bb big">🎄 SEASON '+esc(D.season)+' · OPENS '+day(D.seasonStart).toUpperCase()+'</span><span>Register now. Charges and Brawl points start at kickoff.</span><span class="bb clk">⏱ '+left(D.seasonStart)+'</span></div>';}
else if(D.seasonEnd){var se=new Date(D.seasonEnd),over=D.seasonClosed||se<=new Date();h+='<div class="sea"><span class="bb big">🎄 SEASON '+esc(D.season)+(D.seasonClosed?' · FINAL':over?' · FINAL BUZZER':'')+'</span><span>'+(over?(D.seasonClosed?'The awards are in.':'No new charges. Charges in flight are being settled.'):'Ends '+when(D.seasonEnd))+'</span>'+(over?'':'<span class="bb clk">⏱ '+left(D.seasonEnd)+'</span>')+'</div>';}
h+='<div class="cols"><div><h2 class="bb">The Climb</h2><div class="climb">'+(A?'<div class="step ace"><span class="tag bb">♠ THE ACE · ON THE MOUND</span><span class="rk bb">👑</span><span class="who bb">'+esc(A.name)+'<small>'+esc(A.club)+(A.clubId?' · <a class="cid" href="https://play.smallball.com/#/team/'+esc(A.clubId)+'" target="_blank" title="Open on SmallBall">ID '+esc(A.clubId)+'</a>':'')+'</small></span><span class="wl bb">'+(A.since?'<b>'+ndays(A.since)+'</b>'+(ndays(A.since)===1?'day':'days')+' up top':'<b>'+(A.rdef||0)+'</b>defenses')+'</span></div>':'<div class="step ace open"><span class="tag bb">♠ THE ACE</span><span class="rk bb">⛰️</span><span class="who bb">The mound is open<small>Win the title fight to plant the flag</small></span><span class="wl bb"></span></div>')+(lad.length?lad.map(function(p,i){return '<div class="step'+(i===0?' top':'')+(+p.rank<=(D.moundOpenTo||1)?' shot':'')+'" style="--i:'+Math.min(i+1,9)+';animation-delay:'+(i*0.06)+'s"><span class="rk bb">#'+esc(p.rank)+'</span><span class="who bb">'+esc(p.name)+'<small>'+esc(p.club)+(p.clubId?' · <a class="cid" href="https://play.smallball.com/#/team/'+esc(p.clubId)+'" target="_blank" title="Open on SmallBall">ID '+esc(p.clubId)+'</a>':'')+'</small>'+reachTxt(p,i)+'</span><span class="wl bb">'+p.w+'-'+p.l+'</span></div>';}).join(''):'<div class="empty">Nobody on the climb yet. Register on the form and you start at the bottom.</div>')+'</div>'+(lad.length?'<div class="rnote">⤴ Who each spot can charge. Underdogs win by less (1 run off per star behind). Pick 🔎 Who can I charge? on the Hill form for your own list in #hill-help.</div>':'')+'</div>';
h+='<div><h2 class="bb">Charging the Hill</h2><div class="fights">'+(ch.length?ch.map(function(c,i){return '<div class="fight '+(c.type==='Title'?'title':c.type==='Revenge'?'rev':'')+'" style="animation-delay:'+(i*0.08)+'s"><span class="kind bb">'+(c.type==='Title'?'TITLE FIGHT':c.type==='Revenge'?'ACE\\'S REVENGE':'LADDER')+'</span><div class="vs bb">🥊 '+esc(c.ch)+'<em>VS</em>'+esc(c.df)+'</div><div class="meta"><span>'+(c.status==='Game reported'?'<span class="stamp bb">GAME REPORTED</span>':esc(c.status))+'</span><span class="bb" style="font-size:20px">⏱ '+left(c.deadline)+'</span></div></div>';}).join(''):'<div class="empty">No charges right now. Somebody charge the hill.</div>')+'</div></div></div>';
h+='<h2 class="bb">Recent results</h2>'+(ms.length?'<div class="results">'+ms.slice(0,9).map(function(m){var tie=m.wr!==''&&m.wr===m.lr;return '<div class="res"><div class="d">'+day(m.date)+' · '+esc(m.type)+(m.game?' · game '+esc(m.game):'')+'</div><div class="w bb">'+esc(m.w)+(tie?' ties ':' over ')+esc(m.l)+'</div>'+(m.wr!==''?'<div class="s bb">'+esc(m.wr)+' – '+esc(m.lr)+'</div>':'')+'<div class="o">'+esc(m.outcome)+(m.pts?' · +'+m.pts+' pts':'')+'</div></div>';}).join('')+'</div>':'<div class="empty">No results yet. They show up here once each game has aired.</div>');
h+='<h2 class="bb">Reigns</h2>'+(rg.length?'<div class="reigns">'+rg.map(function(r){return '<div class="rg"><div class="n bb">#'+esc(r.n)+(r.revenge?' 🔥':'')+'</div><div class="nm bb">'+esc(r.name)+'</div><div class="m">'+esc(r.club)+'</div><div class="m">'+day(r.start)+' – '+(r.end?day(r.end):'now')+' · '+ndays(r.start,r.end)+(ndays(r.start,r.end)===1?' day':' days')+'</div><div class="m">'+r.defenses+' defenses · '+r.pts+' pts'+(r.endedBy?' · ended by '+esc(r.endedBy):'')+'</div></div>';}).join('')+'</div>':'<div class="empty">The first reign starts when the first Ace is crowned.</div>');
if(D.bookOn){var bo=D.bookOpen||[],bk=D.bank||[],fo=function(o){o=+o;return o>0?'+'+o:'−'+Math.abs(o);};
h+='<h2 class="bb">🎰 The Sportsbook</h2><div class="book"><div>'+(bo.length?bo.map(function(L){var fa=L.fav==='away';return '<div class="ln"><div class="t"><span>'+esc(L.id)+' · play money</span><span>Betting closes · '+left(L.closes)+'</span></div><div class="g"><span class="bb">'+esc(L.away)+'</span><b>'+fo(L.aml)+'</b><span>'+(fa?'−1.5 ':'+1.5 ')+'('+fo(fa?L.frl:L.drl)+')</span><span>O '+esc(L.total)+' ('+fo(L.ou)+')</span><span class="bb">'+esc(L.home)+'</span><b>'+fo(L.hml)+'</b><span>'+(fa?'+1.5 ':'−1.5 ')+'('+fo(fa?L.drl:L.frl)+')</span><span>U '+esc(L.total)+' ('+fo(L.ou)+')</span></div></div>';}).join(''):'<div class="empty">Bet on the 🔮 matchup lines below, before the charge. Betting on a matchup closes the moment the charge is made: no peeking at results.</div>')+'<p style="opacity:.75;font-size:13px">Play money only: 1,000 Brawl Bucks each per season. Bet on the Hill form. In the game? You can only bet on yourself.</p></div><div class="cup"><h3 class="bb">💰 Bankrolls</h3>'+(bk.length?bk.map(function(x,i){return '<div class="r"><b>'+(i+1)+'</b><span class="bb">'+esc(x.name)+'</span><span class="bb" style="font-size:20px">'+x.bank+'</span></div>';}).join(''):'<div class="empty">No bets yet.</div>')+'</div></div>';
var BK=D.book||{bettors:[],hits:[]};
h+='<div class="book" style="margin-top:12px"><div class="mine"><h3 class="bb" style="margin:0;color:#ffd166">🎟️ My bets</h3>'+(BK.bettors.length?'<select id="mysel"><option value="">Pick your name…</option>'+BK.bettors.map(function(x,i){return '<option value="'+i+'">'+esc(x.name)+'</option>';}).join('')+'</select><div id="myout" class="empty" style="margin-top:8px">Pick your name to see your balance and bets. Everyone starts with '+(BK.base||1000)+' BB.</div>':'<div class="empty">No bets placed yet this season.</div>')+'</div>'
+'<div class="cup"><h3 class="bb">💸 Big hits</h3>'+(BK.hits.length?BK.hits.map(function(x){return '<div class="hit">'+esc(x.name)+' · '+esc(x.what)+' ('+fo(x.odds)+') <b>+'+x.profit+'</b></div>';}).join(''):'<div class="empty">No winners yet.</div>')+'</div></div>';
var WG=D.wagers;
if(WG){var wrow=function(x,st){return '<div class="r" style="grid-template-columns:62px minmax(0,1fr) auto"><span class="bb" style="opacity:.6;font-size:15px">'+esc(x.id)+'</span><span class="bb">'+esc(x.m)+' <small style="display:inline;opacity:.6">vs</small> '+esc(x.t)+'<small>'+esc(x.terms)+' · '+x.ms+(x.ts!==x.ms?' vs '+x.ts+' BB':' BB each')+'</small></span><b style="text-align:right">'+st+'</b></div>';};
h+='<div class="fut cup"><h3 class="bb">🤝 Head-to-head wagers</h3><div style="font-size:13px;opacity:.7;margin-bottom:6px">Bet Brawl Bucks straight against another Hill player: up to '+(WG.max||250)+' BB a side, straight up, odds or a run line. They accept on the Hill form, and your next BigLeague game against each other settles it once it airs. No house cut. <b style="color:#ffd166">Funny business costs you your bucks (split across the league), and worse.</b></div>'
+(WG.live.length||WG.open.length||WG.done.length?WG.live.map(function(x){return wrow(x,x.st==='Airing'?'📺 Airing':'⚾ Game on · '+left(x.dl));}).join('')+WG.open.map(function(x){return wrow(x,'Open · '+left(x.exp));}).join('')+WG.done.map(function(x){return wrow(x,x.win?'💸 '+esc(x.win)+' +'+x.amt:'↩️ Refunded');}).join(''):'<div class="empty">No wagers yet. Call somebody out on the Hill form.</div>')+'</div>';}
var PO=D.pot||[];
if(PO.length){var pre=D.seasonStart&&new Date(D.seasonStart)>new Date();h+='<div class="fut cup"><h3 class="bb">🔮 Matchup lines'+(pre?' · preview':'')+'</h3><div style="font-size:13px;opacity:.7;margin-bottom:6px">'+(pre?'<b style="color:#ffd166">Betting opens at kickoff.</b> ':'')+'Every charge that could happen right now. Bet on the Hill form before the charge is made: betting locks the moment it is. Not played within 48 hours? Your bet comes back.</div>'
+PO.slice(0,24).map(function(L){return '<div class="r" style="grid-template-columns:minmax(0,1fr) 70px minmax(0,1fr) 70px"><span class="bb">'+esc(L.ch)+(L.t?' <small style="display:inline;color:#ffd166">♠ title</small>':'')+'</span><b>'+fo(L.a)+'</b><span class="bb" style="text-align:right">@ '+esc(L.df)+'</span><b>'+fo(L.h)+'</b></div>';}).join('')+'</div>';}
var FU=D.futures;
if(FU&&FU.rows&&FU.rows.length){var mx=Math.max.apply(null,FU.rows.map(function(x){return x.pct;}))||1;
h+='<div class="fut cup"><h3 class="bb">♠️ Season '+esc(D.season)+' Ace futures</h3><div style="font-size:13px;opacity:.7;margin-bottom:6px">Odds to be on the mound when the season ends. The season is played out 2,000 times every hour. Arrows show the move since midnight. Back your own club on the Hill form.</div>'
+FU.rows.slice(0,10).map(function(x){var mv=x.move>0?'<span class="up">▲ '+x.move+'</span>':x.move<0?'<span class="dn">▼ '+Math.abs(x.move)+'</span>':'<span style="opacity:.4">–</span>';return '<div class="r"><span class="bb" style="font-size:18px;opacity:.7">'+(x.rank===0?'♠':'#'+x.rank)+'</span><span class="bb">'+esc(x.name)+'<small>'+esc(x.club)+' · '+x.pct+'%</small></span><span class="bar"><i style="width:'+Math.round(x.pct/mx*100)+'%"></i></span><b>'+fo(x.odds)+'</b>'+mv+'</div>';}).join('')+'</div>';}
window.__BK=BK;window.__fo=fo;}
var aw=D.awards||[],cp=D.cup||[];
if(aw.length){h+='<h2 class="bb">🏆 Season '+esc(D.season)+' hardware'+(D.seasonClosed?' · final':' · race')+'</h2><div class="hw"><div class="cup"><h3 class="bb">🏆 The Bench Clearer Cup</h3>'+(cp.length?cp.map(function(x,i){return '<div class="r"><b>'+(i+1)+'</b><span class="bb">'+esc(x.name)+'<small>'+esc(x.club)+'</small></span><span class="bb" style="font-size:20px">'+x.pts+'</span></div>';}).join(''):'<div class="empty">No Brawl points yet. The first payday is midnight.</div>')+'</div><div><div class="aws">'+aw.filter(function(a){return a.name!=='The Bench Clearer Cup';}).map(function(a){return '<div class="aw"><div class="i">'+a.icon+'</div><div class="t bb">'+esc(a.name)+'</div><div class="w bb">'+(a.who?esc(a.who):'—')+'</div><div class="v">'+(a.who?esc(a.value):'up for grabs')+'</div><div class="q">'+esc(a.what)+'</div></div>';}).join('')+'</div>'+(D.prizes?'<div class="prize">🎁 <b>Prizes:</b> '+esc(D.prizes)+'</div>':'')+'</div></div>';}
var pts=[10,20,40,80,160,320,320,320];
h+='<h2 class="bb">How the Hill works</h2><div class="how">'
+'<div class="card"><h3 class="bb">🥊 Charge the hill</h3><p>Pick a fight with anyone up to <b>3 spots above you</b>. Reach higher, win bigger.</p><div class="reach"><div class="no">#2 · too far</div><div class="ok">#3 · win by 4+</div><div class="ok">#4 · win by 3+</div><div class="ok">#5 · just win</div><div class="me">#6 · YOU</div></div></div>'
+'<div class="card"><h3 class="bb">⚾ Play it, report it</h3><div class="steps3"><div><b>1</b>Charge on the form. The clock starts.</div><div><b>2</b>The challenger starts the game in SmallBall as the visitor, at the defender\\'s park. The first game counts.</div><div><b>3</b>Nothing to report: the Hill finds the game on SmallBall by itself. Hand reports still work as a backup. Results post once the game has aired: no spoilers.</div></div><p style="opacity:.75;font-size:13px">Win by enough and you take their spot. Win short of the margin and nobody moves. Lose and you drop one. A tie: the defender holds.</p></div>'
+'<div class="card"><h3 class="bb">♠ Points per defense</h3><p>Every title defense pays double the last, up to 320.</p><div class="bars">'+pts.map(function(p,i){return '<div style="height:'+(p/320*100)+'%;animation-delay:'+(i*0.1)+'s"><span>'+p+'</span><i>D'+(i+1)+'</i></div>';}).join('')+'</div><p style="margin-top:28px">Hold it six times and every defense after that is worth 320.</p></div>'
+'<div class="card"><h3 class="bb">⏰ The open mound</h3><p>Only <b>#1</b> can charge the Ace at first. Every day nobody charges, one more spot gets a title shot, down to <b>#5</b>. Any win takes the hill: no margins on the mound.</p><p class="bb" style="font-size:22px;color:#ffd166">Open to '+((D.moundOpenTo||1)===1?'#1':'#1–#'+D.moundOpenTo)+' now</p></div>'
+'<div class="card"><h3 class="bb">📅 Daily Brawl points</h3><p>Every night at midnight, clubs get paid for where they sit:</p><div class="reach">'+(D.daily||[]).slice(0,6).map(function(v,i){return '<div class="ok">'+(i===0?'♠ Ace':'#'+i)+' · '+v+' pts/day</div>';}).join('')+'</div><p style="opacity:.75;font-size:13px">Defense points plus daily pay = Brawl points. Most at the end of the season wins the The Bench Clearer Cup.</p></div>'
+'<div class="card"><h3 class="bb"><span class="flame">🔥</span> The Ace\\'s Revenge</h3><p>An Ace who built <b>500+ reign points</b> and loses the hill gets one shot back, declared within 12 hours.</p><p>The catch: they must win by <b>more runs than they lost by</b>. Lost 5–3? You need a 3-run win.</p><p style="opacity:.75;font-size:13px">A dethroned Ace without revenge drops to #3..</p></div>'
+'</div><div class="foot">'+(D.formLink?'<a href="'+esc(D.formLink)+'" target="_blank" rel="noopener" style="color:#ffd166">📝 Hill form</a> · ':'')+'Updated '+(D.updated?when(D.updated):'never')+' · refreshes every minute · results appear once each game has aired</div>';
document.getElementById('app').innerHTML=h;
var ms0=document.getElementById('mysel');if(ms0){var showMe=function(){var x=window.__BK.bettors[ms0.value],o=document.getElementById('myout'),fo=window.__fo;if(!x){o.className='empty';o.innerHTML='Pick your name to see your balance and bets.';return;}
o.className='';o.innerHTML='<div class="bx"><span><b>'+x.bank+'</b>BB available</span><span><b>'+x.w+'-'+x.l+(x.p?'-'+x.p:'')+'</b>record</span><span><b>'+x.open.length+'</b>open</span></div>'
+(x.open.length?x.open.map(function(b){return '<div class="it"><span>⏳ '+esc(b.game)+' · '+esc(b.what)+' ('+fo(b.odds)+')</span><span>'+b.stake+' to win '+b.toWin+'</span></div>';}).join(''):'')
+(x.done.length?x.done.map(function(b){return '<div class="it"><span>'+esc(b.game)+' · '+esc(b.what)+' ('+fo(b.odds)+')</span><span class="'+(b.res==='Won'?'won':b.res==='Lost'?'lost':'')+'">'+(b.res==='Won'?'+'+b.profit:b.res==='Lost'?b.profit:b.res)+'</span></div>';}).join(''):'');
try{localStorage.setItem('hill-me',x.name);}catch(e){}};
ms0.addEventListener('change',showMe);try{var nm=localStorage.getItem('hill-me');if(nm){window.__BK.bettors.forEach(function(x,i){if(x.name===nm)ms0.value=String(i);});showMe();}}catch(e){}}
var t=[];if(A)t.push('♠ '+A.name+' holds the hill · '+(A.rdef||0)+' defenses');ms.slice(0,8).forEach(function(m){t.push(m.w+(m.wr!==''&&m.wr===m.lr?' ties ':' over ')+m.l+(m.wr!==''?' '+m.wr+'-'+m.lr:''));});ch.forEach(function(c){t.push('🥊 '+c.ch+' charges '+c.df);});if(lad[0])t.push('#1 contender: '+lad[0].name);t.push('Charge the hill: register on the form');
document.getElementById('tick').innerHTML=t.map(esc).join('<i>★</i>');
document.querySelectorAll('.cnt').forEach(function(el){var n=+el.dataset.n,k=0,s=Math.max(1,Math.ceil(n/30));var iv=setInterval(function(){k=Math.min(n,k+s);el.textContent=k;if(k>=n)clearInterval(iv);},30);});
</script></body></html>
`;
