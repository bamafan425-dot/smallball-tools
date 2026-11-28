/**
 * ⛰️ HOLD THE HILL — SmallBall ladder (v3.35: 🎰 sportsbook rework: matchups are moneyline only, 🌙 daily Ace-at-midnight bets, 🎲 daily fun props, ⚾ player props (homers, pitcher Ks) from box scores; v3.34: 🐕 an empty Farm doghouse fills itself with Farm #1; v3.33: 🐕 the Farm Ace is now the Farm Dog (posts, form, board), Farm-only owners show in the Brawl Bucks wallet list; v3.32: recovery after losing at the Ace defaults to 42 minutes (0.7 h); v3.31: Hill games pay Brawl Bucks with no daily limit (PAID_GAMES_PER_DAY 0 = no limit); v3.30: the ⏳ title-shot clock data now reaches the main board; v3.29: ⏳ the open mound counts down to the next title-shot spot (4h 20m a spot by default); v3.28: every Discord post ends with a ━━━ break line; three title-charge items: 💥 Brass Knuckles as a Knockout Punch, 🔁 Mulligan, 💰 Bounty Hunter; v3.27: clean Discord posts (Game found: the two clubs, watch link, when it's over): one @member · Club · ID line per club (club and ID link to the team page), results and charges lead with those lines, standings list the climb the same way, every post carries the leaderboard link; v3.26: 🏁 Fresh start stamps Opening Day, leaves clubs that moved ladders where they went and puts BOTTOM_CLUBS (the commish's own) last; the board shows each player's biggest bet right now; and the board page throws a 24-hour Opening Day party; v3.25: fixes from lithodora's review: a charge names the exact club first (owners with several Farm clubs), moved-down clubs can register back on the Hill after a call-up, Farm-only owners can shop, bet, vote and wager from the shared wallet, and Farm games count toward the daily streak; v3.24: 🏁 Fresh start: one menu item wipes both ladders' results and every Brawl Bucks wallet, re-ranks both by sign-up order, and crowns the tournament champion's owner as the Ace if they're on the Hill; v3.23: Discord times say "(your time)", Mountain times say MT; the Farm Hill is an open ladder, no reach limit, cooldowns, recovery, Bell or margins; v3.22: the Farm Hill is for clubs at 6★ and under (10-star scale), owners can put several young clubs on it, smaller clubs register onto it by themselves, ⬇️ move-down tool; v3.21: 🌱 the Farm Hill, a second ladder on the same engine (shared Brawl Bucks wallet, same Master Form, its own Ace, mound and Bell, call-ups when a club outgrows it); v3.20: 🩹 a failed charge at the Ace drops you to #5 and you recover 2 hours (3 if the Ace wore Brass Knuckles) before you can charge anyone; v3.19: pre-fill link worked out hourly outside the lock; dashboard waits longer for a busy check; v3.18: pre-filled charge links for the Club Kit (⚔️ Charge this club); v3.17: 🎛️ Commish dashboard (Sheet menu: settings in plain words, live status, Ring/Skip/Pause the Bell); v3.16: 🔔 The Bell (a few random one-hour windows a week when anyone can charge the Ace: win by 3+ for the title, less = #1 contender; Ace bounty + 48 h shield); v3.15: faster open mound (#2 can charge the Ace after 8 hours, then one more spot a day, never widening overnight); v3.14: "Master Form" and "Live Hold the Hill Leaderboard" everywhere; v3.13: 🏟️ The Bleacher Vote (players' season award); v3.12: no betting on yourself (wagers are for that), tuned Brawl Bucks pay and item prices, 3 paid Hill games a day, 🛒 shop channel, The Sharp = betting winnings, 🔥 The Grinder award, 250 BB bet ceiling; v3.11: bets capped at 4.2% of your Brawl Bucks, head-to-head wagers 4.2% (10% with the commish's OK); v3.10: 🪜 Ladder Jump+, 🔥 Hill streaks (daily Brawl Bucks for playing, growing every day in a row, milestones), 🌧️ Rain Delay item, +15 charge bonus; v3.9: 🛒 Brawl Bucks items (🥊 Brass Knuckles, 🧽 Margin Eraser, 🪜 Ladder Jump), Brawl Bucks for every Hill game, title charges can need a margin; v3.8: 🥊 Start-the-game links in Discord that open SmallBall on your opponent with your club checked, clickable club IDs on the board; v3.7: a cleaner form with 🥊 Charge the Hill up top, 🤝 head-to-head wagers (straight up, odds or run line, up to 250 BB a side), The Hustler award, commish fines that split a cheater's Brawl Bucks across the league; v3.6: the HtH Leaderboard lives on GitHub Pages (fast, and old board links forward there), tidy Discord links; v3.5: HtH Leaderboard and form links on the big posts, Discord posts that get blocked are retried instead of lost, v3.4: Who can I charge?, v3.3: the Ace on top of the Climb, v3.2.1: sturdier Discord posting, Check SmallBall now, 1-minute checks, Discord ID update, louder rejections, callout test, club IDs everywhere, 📣 callouts fix, rejections posted in Discord, overlapping charges, launch reset, watch links, betting-close wording, everything sportsbook in #sportsbook, preseason matchup lines, #sportsbook channel, 🔮 matchup lines, bet option fix, #hill-log, form link on the board, 🤖 auto-reporting, stars from the form, star-gap odds, scaled upset bonus, ♠️ Ace futures, demo board, 🎰 Hill Sportsbook + My bets, season start date, 1-hour charges, daily Brawl points, open mound, The Bench Clearer Cup)
 * Google Sheets + Google Form + Discord webhook engine
 * Version 1.1
 *
 * HtH Leaderboard: a live web page (see the bottom of this file). Deploy → New deployment → Web app,
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
  ITEMS: 'Items',
  VOTES: 'Votes',
  STREAKS: 'Streaks',
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
  Items: ['Date', 'Season', 'Email', 'Player', 'Item', 'Action', 'Price', 'ChallengeID', 'Notes'],
  Streaks: ['Email', 'Player', 'Streak', 'Best', 'LastPlayed', 'Season'],
  Votes: ['Date', 'Season', 'Email', 'Voter', 'Pick', 'PickEmail'],
  Log: ['Time', 'Actor', 'Action', 'Details'],
};

// Columns kept as plain text so Sheets never turns IDs into numbers or "5-3" into a date.
const TEXT_COLUMNS = ['MakerClubID', 'TakerClubID', 'Line', 'Value', 'Day', 'DiscordID', 'OwnerID', 'ClubID', 'GameID', 'ChallengerReport', 'DefenderReport', 'CommishScore'];

const DEFAULTS = {
  DISCORD_WEBHOOK_URL: ['', 'Discord channel → Edit Channel → Integrations → Webhooks → New Webhook → Copy URL'],
  SEASON: [1, 'Current season number'],
  SEASON_START: ['2026-11-27 00:00', 'When the season opens, Mountain time (YYYY-MM-DD HH:MM). Clubs can register before this; charges and Brawl points start here.'],
  SEASON_END: ['2026-12-23 23:59', 'When the season ends, Mountain time (YYYY-MM-DD HH:MM). New charges lock then; charges already made can still be played and reported.'],
  FORM_LINK: ['https://tinyurl.com/holdthehillsb', 'Link to the Master Form, shown as a button on the HtH Leaderboard'],
  GITHUB_REPO: ['slipnsliders/smallball-tools', 'Optional: the GitHub repo that hosts the HtH Leaderboard (owner/repo). Connect it from the Hill menu'],
  GITHUB_PATH: ['docs/hill/board.json', 'Where the board data goes in that repo (the page sits next to it)'],
  BOARD_LINK: ['', 'Link to the live HtH Leaderboard for Discord posts (a short link is nice). Blank = the web app link, found on its own'],
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
  BET_MAX_PCT: [4.2, 'Most you can put on one sportsbook bet, as a % of your Brawl Bucks right now'],
  BET_MAX_FLAT: [250, 'And never more than this many Brawl Bucks on one bet or wager (a commish-OK big wager can go past it)'],
  SHOP_WEBHOOK_URL: ['', 'Discord webhook for the 🛒 shop channel (purchases, items used, refunds). Blank = they post in the sportsbook channel'],
  VOTE_DAYS: [7, 'The 🏟️ Bleacher Vote opens this many days before the season ends'],
  PAID_GAMES_PER_DAY: [0, 'How many Hill games a day pay Brawl Bucks per player. 0 = no limit: every game pays'],
  WAGER_MAX_PCT: [4.2, 'Most either side can put on one head-to-head wager, as a % of their Brawl Bucks right now'],
  WAGER_BIG_PCT: [10, 'With the commish\'s OK (menu: 🤝 Allow a big wager), a head-to-head wager can go up to this %'],
  WAGER_OFFER_HOURS: [24, 'Hours a wager offer stays open for the other player to accept'],
  WAGER_PLAY_HOURS: [48, 'Hours after a wager is accepted to play the game that settles it (else everyone is refunded)'],
  ITEMS_ON: ['FALSE', 'Brawl Bucks items shop on (TRUE/FALSE). Needs the sportsbook on. The 🛒 menu item turns it on'],
  ITEM_PRICES: ['knuckles:250,eraser:200,jump:150,jumpplus:300,rain:100', 'Item prices in Brawl Bucks: Brass Knuckles, Margin Eraser, Ladder Jump, Ladder Jump+, Rain Delay'],
  ITEM_ACE_X: [2, 'The Ace pays this many times the price for an item'],
  ITEM_COOLDOWN_HOURS: [24, 'Hours between items for each player'],
  PLAY_BUCKS: ['played:10,win:25,charge:10', 'Brawl Bucks for a Hill game: both clubs get played, the winner also gets win, the challenger also gets charge'],
  STREAK_BUCKS: ['day:15,step:5,max:40', 'Daily 🔥 Hill streak pay: day = any day you play a Hill game; +step more for each day in a row (day 2 +5, day 3 +10 …), up to max extra a day'],
  STREAK_MILESTONES: ['3:25,7:75,14:150,21:250,28:400', 'One-time streak bonuses: days:BB'],
  STATE_LAST_STREAK_DAY: ['', 'Managed by script'],
  WAGER_KINDS: ['big', 'Game types that can settle a wager, comma separated: big, pro, exhibition'],
  BOTTOM_CLUBS: ['8897', 'Club IDs that start at the bottom of their ladder after a 🏁 Fresh start (the commish\'s own clubs), comma separated'],
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
  ACE_LOSS_RANK: [5, '🩹 Lose a charge at the Ace (title, Bell or revenge) and you drop to this spot (or one spot, if you were already lower)'],
  ACE_LOSS_REST_HOURS: [0.7, '🩹 After losing a charge at the Ace: hours of recovery before you can charge anyone (0.7 = 42 minutes)'],
  ACE_LOSS_REST_KNUCKLES_HOURS: [3, '🩹 The same, when the Ace was wearing Brass Knuckles'],
  MOUND_OPEN_MAX: [5, 'Open mound: only #1 can charge the Ace at first; with no title charge it opens one more spot at a time, down to this spot'],
  MOUND_FIRST_HOURS: ['4:20', 'Open mound: time with no title charge before #2 can charge the Ace too (hours, or H:MM like 4:20)'],
  MOUND_STEP_HOURS: ['4:20', 'Open mound: after that, time for each further spot (#3, #4...) (hours, or H:MM like 4:20)'],
  BELL_PER_WEEK: [3, '🔔 The Bell: open-mound windows a week (0 = off). While it rings, anyone on the climb can charge the Ace'],
  BELL_MINUTES: [60, '🔔 The Bell: how long each window lasts'],
  BELL_WEEKDAY: ['06:30-08:00, 11:30-13:00, 21:00-22:30', '🔔 The Bell: Mountain-time windows it can ring in, Mon–Fri'],
  BELL_WEEKEND: ['08:00-10:00, 13:00-15:00, 21:00-22:30', '🔔 The Bell: Mountain-time windows it can ring in, Sat–Sun'],
  BELL_GAP_HOURS: [36, '🔔 The Bell: at least this many hours between rings'],
  BELL_WARN_MINUTES: [30, '🔔 The Bell: heads-up post this many minutes before it rings'],
  BELL_MARGIN: [3, '🔔 The Bell: win by this much to take the title. A smaller win makes you the #1 contender'],
  BELL_SHIELD_HOURS: [48, '🔔 The Bell: after the Ace beats a Bell charge, no Bell rings for this long'],
  BELL_BOUNTY: [50, '🔔 The Bell: Brawl Bucks to the Ace for beating a Bell charge'],
  BELL_ROLE_ID: ['', '🔔 The Bell: Discord role ID to ping when it rings (an opt-in "Mound Alerts" role). Blank = no ping'],
  STATE_BELL_NEXT: ['', 'Managed by script'],
  STATE_BELL_WARNED: ['', 'Managed by script'],
  STATE_BELL_UNTIL: ['', 'Managed by script'],
  STATE_BELL_USED: ['', 'Managed by script'],
  STATE_BELL_SHIELD: ['', 'Managed by script'],
  MOUND_QUIET: ['22:30-06:30', 'Open mound: the mound never opens wider during these Mountain hours (it waits for morning). Blank = any time'],
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
// 🌱 Farm Hill settings, and a Farm copy of every STATE_ key (its own Ace, revenge, Bell and open mound).
DEFAULTS.FARM_ON = ['true', '🌱 Farm Hill on (true/false): the ladder for clubs at or under FARM_MAX_STARS; Hold the Hill is for clubs above it'];
DEFAULTS.FARM_MAX_STARS = [6, '🌱 Farm Hill: clubs at or under this many stars (the 1–10 star rating on the club page) play on the Farm; above it, Hold the Hill. A Farm club that grows past it is called up'];
Object.keys(DEFAULTS).filter(function (k) { return /^STATE_/.test(k); }).forEach(function (k) { DEFAULTS['FARM_' + k] = [DEFAULTS[k][0], '🌱 Farm Hill: ' + DEFAULTS[k][1]]; });

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
  SHOP: '🛒 Brawl Bucks shop (buy an item)',
  VOTE: '🏟️ The Bleacher Vote (season award)',
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
  ITEM: 'Item to buy',
  USE_ITEM: 'Use an item on this charge?',
  VOTE: 'Your Bleacher Vote',
  LADDER: 'Which ladder?',
  MY_CLUB: 'Charging with (your Farm club ID, only if you have several)',
};

const ACE_CHOICE = '♠ THE ACE (charge the mound: title shot, #1 contender, or lower when the mound is open)';
const OPEN = ['Pending', 'Accepted', 'Started', 'Review'];
const BOOK_HELP = 'Play money only: everyone starts the season with the same stack of Brawl Bucks (see the Leaderboard). 🔮 Matchup bets: bet on a charge before it happens. Betting on that matchup closes the moment the charge is made, and the bet is refunded if it isn\'t played within 48 hours. ♠️ Futures: pick who finishes the season as the Ace. Max bet: a share of your Brawl Bucks right now (the Leaderboard shows yours). No betting on yourself or your own games: that\'s what 🤝 head-to-head wagers are for. Bets settle once the game has aired.';
const FORM_CONFIRM = 'Got it! Check Discord in about a minute: ✅ it posts in #hill-feed (bets in #sportsbook) if it went through, or ❌ a red REJECTED post (and an email) tells you exactly what to fix. Nothing either way after 5 minutes? Ask in #hill-help.';
const NO_LINES = 'No open lines right now. Lines open when someone charges the hill.';
const KINDS = { 'BigLeague': 'big', 'Pro League': 'pro', 'Exhibition': 'exhibition' };

// ───────────────────────────── 🌱 Two ladders: the Hill and the Farm Hill ─────────────────────────────
// The same engine runs both. LAD_ says which one the code is working on: '' = the main Hill, 'farm' = the Farm Hill.
// Each ladder has its own Players, Challenges, Matches, Reigns and Payouts tabs (the Farm's start with "Farm ") and
// its own STATE_ settings (FARM_STATE_...): Ace, revenge, Bell, open mound. Everything tied to the owner is shared:
// Brawl Bucks wallet, streaks, items, bets, wagers and votes. Farm charges are F-0001, F-0002...
let LAD_ = '';
const PER_LAD_ = { Players: 1, Challenges: 1, Matches: 1, Reigns: 1, Payouts: 1 };
const LADS_ = ['', 'farm'];
function isFarm_() { return LAD_ === 'farm'; }
// Farm clubs are keyed "email#clubId" so an owner can have several; the Brawl Bucks wallet, items and item
// cooldowns always go by the account (the part before #).
function acct_(e) { return String(e == null ? '' : e).split('#')[0]; }
function farmKey_(email, clubId) { return lc_(acct_(email)) + '#' + norm_(clubId).replace(/\D/g, ''); }
function ladTab_(name) { return isFarm_() && PER_LAD_[name] ? 'Farm ' + name : name; }
function withLad_(lad, fn) { const prev = LAD_; LAD_ = lad || ''; try { return fn(); } finally { LAD_ = prev; } }
function farmReady_() { try { return !!SpreadsheetApp.getActive().getSheetByName('Farm Players') && lc_(withLad_('', cfg_).FARM_ON) !== 'false'; } catch (e) { return false; } }
// Runs fn on each ladder that is set up; one ladder failing never stops the other.
function eachLad_(fn) {
  LADS_.forEach(function (l) {
    if (l === 'farm' && !farmReady_()) return;
    try { withLad_(l, fn); } catch (e) { log_('system', 'ERROR (' + (l || 'hill') + ')', String(e && e.stack || e)); }
  });
}
const FARM_ACE_CHOICE = '🌱 🐕 THE FARM DOG (charge the Farm Dog for the top of the Farm: title shot, any time)';
const FARM_ACE_OLD = '🌱 THE FARM ACE (charge the Farm mound: title shot, #1 contender, or lower when the mound is open)';   // older forms and Club Kit links
function isAceChoice_(s) { return s === aceChoice_() || (isFarm_() && s === FARM_ACE_OLD); }
function aceChoice_() { return isFarm_() ? FARM_ACE_CHOICE : ACE_CHOICE; }
const LADDER_CHOICES = ['⛰️ Hold the Hill (7★ and up)', '🌱 Farm Hill (6★ and under)'];
const ladLabel_ = () => (isFarm_() ? '🌱 Farm Hill' : '⛰️ Hold the Hill');

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
function ts_(d) { return '<t:' + Math.floor(new Date(d).getTime() / 1000) + ':f> (your time)'; }   // Discord shows each reader their own time zone; say so
function rel_(d) { return '<t:' + Math.floor(new Date(d).getTime() / 1000) + ':R>'; }
function tag_(p) {
  const id = norm_(p.DiscordID).replace(/\D/g, '');
  return id ? '<@' + id + '>' : '**' + esc_(p.Discord) + '**';
}
// The one club line every post uses: @member · Club · ID (the club and the ID open its SmallBall team page).
const teamUrl_ = (id) => 'https://play.smallball.com/#/team/' + norm_(id);
function clubLink_(p) { const nm = esc_(p.Club).replace(/[\[\]]/g, ''); return norm_(p.ClubID) ? '[' + nm + '](<' + teamUrl_(p.ClubID) + '>)' : nm; }
function idLink_(p) { return norm_(p.ClubID) ? '[' + norm_(p.ClubID) + '](<' + teamUrl_(p.ClubID) + '>)' : ''; }
function line_(p, ping) { if (!p) return 'TBD'; const id = idLink_(p); return (ping ? tag_(p) : '**@' + esc_(p.Discord) + '**') + ' · **' + clubLink_(p) + '**' + (id ? ' · ' + id : ''); }
function who_(p) { return line_(p, true); }
function nm_(p) { return '**' + esc_(p ? p.Club : '?') + '**'; }   // the short form for the story under a post's club lines

function parseScore_(v) {
  const m = norm_(v).match(/^(\d+)\D+(\d+)$/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

// ───────────────────────────── Sheet tables ─────────────────────────────

function sheet_(name) {
  const tab = ladTab_(name), sh = SpreadsheetApp.getActive().getSheetByName(tab);
  if (!sh) fail_('Missing tab "' + tab + '". Run setup' + (isFarm_() ? ' (or 🌱 Set up the Farm Hill)' : '') + '.');
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
  if (isFarm_()) Object.keys(c).forEach(function (k) { if (/^STATE_/.test(k)) c[k] = c['FARM_' + k]; });
  // 🌱 The Farm Hill is the open ladder: charge anyone above you (the Farm Dog included) at any time, no
  // rematch cooldowns, no recovery after a failed title charge, no Bell (the mound is always open), just win.
  if (isFarm_()) { c.CHALLENGE_REACH = 999; c.COOLDOWN_HOURS = 0; c.ACE_LOSS_REST_HOURS = 0; c.ACE_LOSS_REST_KNUCKLES_HOURS = 0; c.BELL_PER_WEEK = 0; }
  return c;
}

function setCfg_(key, val) {
  if (isFarm_() && /^STATE_/.test(key)) key = 'FARM_' + key;
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
  { key: 'sharp', icon: '💰', name: 'The Sharp', what: 'Most Brawl Bucks won betting the sportsbook' },
  { key: 'grinder', icon: '🔥', name: 'The Grinder', what: 'Longest 🔥 Hill streak (days in a row with a Hill game)' },
  { key: 'hustler', icon: '🤝', name: 'The Hustler', what: 'Most Brawl Bucks won head-to-head (wagers)' },
  { key: 'bleacher', icon: '🏟️', name: 'The Bleacher Vote', what: 'Voted by the players: who made the season the most fun' },
];

// ── Open mound: only #1 can charge the Ace; with no title charge, #2 joins after MOUND_FIRST_HOURS (8),
//    then one more spot every MOUND_STEP_HOURS (24), down to MOUND_OPEN_MAX. It never widens overnight (MOUND_QUIET).
function lastTitle_(C) {
  let t;
  if (C.STATE_LAST_TITLE_ACTIVITY) t = new Date(C.STATE_LAST_TITLE_ACTIVITY);
  else { const reign = currentReign_(readTable_(SHEETS.REIGNS)); t = reign ? new Date(reign.Start) : now_(); }
  const st = seasonStart_(C);
  return st && st > t ? st : t;   // the open-mound clock never starts before the season does
}
function moundQuiet_(C) {
  const m = norm_(C.MOUND_QUIET).match(/^(\d{1,2}):?(\d{2})\s*-\s*(\d{1,2}):?(\d{2})$/);
  if (!m) return false;
  const hm = Utilities.formatDate(now_(), 'America/Denver', 'HH:mm').split(':');
  const t = Number(hm[0]) * 60 + Number(hm[1]), a = Number(m[1]) * 60 + Number(m[2]), b = Number(m[3]) * 60 + Number(m[4]);
  return a <= b ? (t >= a && t < b) : (t >= a || t < b);
}
// Hours from a setting: 4.5, or H:MM like 4:20.
function hrsOf_(v, dflt) { const t = norm_(v), m = t.match(/^(\d+):(\d{2})$/); const h = m ? Number(m[1]) + Number(m[2]) / 60 : Number(t); return h > 0 ? h : dflt; }
const fmtHrs_ = (h) => { const m = Math.round(h * 60); return Math.floor(m / 60) + 'h' + (m % 60 ? ' ' + (m % 60) + 'm' : ''); };
// When the next spot opens (null once it's as wide as it gets). Overnight (MOUND_QUIET) it waits for morning.
function moundNextAt_(C) {
  if (isFarm_()) return null;
  const to = moundOpenTo_(C), max = Number(C.MOUND_OPEN_MAX) || 1; if (to >= max) return null;
  const first = hrsOf_(C.MOUND_FIRST_HOURS, 4 + 1 / 3), step = hrsOf_(C.MOUND_STEP_HOURS, 4 + 1 / 3);
  let at = new Date(lastTitle_(C).getTime() + 3600000 * (first + step * (to - 1)));
  if (at < now_()) at = now_();   // due now: it's waiting out the night
  const q = norm_(C.MOUND_QUIET).match(/^(\d{1,2}):?(\d{2})\s*-\s*(\d{1,2}):?(\d{2})$/);
  if (q) {
    const hm = Utilities.formatDate(at, 'America/Denver', 'HH:mm').split(':'), t = Number(hm[0]) * 60 + Number(hm[1]);
    const a = Number(q[1]) * 60 + Number(q[2]), b = Number(q[3]) * 60 + Number(q[4]);
    const inQ = a <= b ? (t >= a && t < b) : (t >= a || t < b);
    if (inQ) { let wait = b - t; if (wait <= 0) wait += 1440; at = new Date(Math.ceil((at.getTime() + wait * 60000) / 60000) * 60000); }
  }
  return at;
}
function moundRaw_(C) {
  const h = (now_() - lastTitle_(C)) / 3600000, first = hrsOf_(C.MOUND_FIRST_HOURS, 4 + 1 / 3), step = hrsOf_(C.MOUND_STEP_HOURS, 4 + 1 / 3);
  const to = h < first ? 1 : 2 + Math.floor((h - first) / step);
  return Math.max(1, Math.min(Number(C.MOUND_OPEN_MAX) || 1, to));
}
function moundOpenTo_(C) {
  if (isFarm_()) return 999;   // 🌱 the Farm mound is always open
  const raw = moundRaw_(C), was = Math.max(1, Number(C.STATE_MOUND_OPEN_TO) || 1);
  return raw > was && moundQuiet_(C) ? was : raw;   // overnight it holds where it was; it widens in the morning
}
// ── 🔔 The Bell: a few random one-hour windows a week, at sane Mountain hours, when anyone on the climb can
//    charge the Ace. Win by BELL_MARGIN to take the hill; a smaller win makes you the #1 contender. Beat a Bell
//    charge and the Ace earns BELL_BOUNTY Brawl Bucks and a BELL_SHIELD_HOURS break from the Bell.
function bellState_(C) {
  const t = now_(), until = C.STATE_BELL_UNTIL ? new Date(C.STATE_BELL_UNTIL) : null, next = C.STATE_BELL_NEXT ? new Date(C.STATE_BELL_NEXT) : null;
  const warn = (Number(C.BELL_WARN_MINUTES) || 30) * 60000;
  return { on: Number(C.BELL_PER_WEEK) > 0, open: !!(until && until > t), until: until, used: !!norm_(C.STATE_BELL_USED), next: next,
    soon: !!(next && next - t <= warn && next > t), shield: C.STATE_BELL_SHIELD && new Date(C.STATE_BELL_SHIELD) > t ? new Date(C.STATE_BELL_SHIELD) : null };
}
function bellWindows_(C, d) {   // [[startMin, endMin], ...] for that Mountain day
  const dow = Number(Utilities.formatDate(d, 'America/Denver', 'u'));   // 1 = Mon … 7 = Sun
  return norm_(dow >= 6 ? C.BELL_WEEKEND : C.BELL_WEEKDAY).split(',').map(function (x) {
    const m = x.trim().match(/^(\d{1,2}):?(\d{2})\s*-\s*(\d{1,2}):?(\d{2})$/);
    return m ? [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])] : null;
  }).filter(Boolean);
}
function bellFits_(C, d) {   // can a Bell start at d and finish inside the same window?
  const hm = Utilities.formatDate(d, 'America/Denver', 'HH:mm').split(':'), t = Number(hm[0]) * 60 + Number(hm[1]), len = Number(C.BELL_MINUTES) || 60;
  return bellWindows_(C, d).some(function (w) { return t >= w[0] && t + len <= w[1]; });
}
function bellPick_(C, from) {   // a random 15-minute start between from and ~2 average gaps later
  const per = Math.max(1, Number(C.BELL_PER_WEEK) || 3), avg = 168 / per, gap = Number(C.BELL_GAP_HOURS) || 0;
  const span = Math.max(12, 2 * Math.max(0, avg - gap)) * 3600000;
  const q = 15 * 60000, start = new Date(Math.ceil(from.getTime() / q) * q);
  for (let tries = 0; tries < 4; tries++) {
    const ok = [];
    for (let x = start.getTime(); x <= start.getTime() + span * (tries + 1); x += q) { const d = new Date(x); if (bellFits_(C, d)) ok.push(d); }
    if (ok.length) return ok[Math.floor(Math.random() * ok.length)];
  }
  return null;
}
function bellTxt_(C) { return 'win by **' + (Number(C.BELL_MARGIN) || 3) + '+** to take the hill; a smaller win makes you the **#1 contender**'; }
function bellTick_(C) {
  const t = now_(), B = bellState_(C), pt = players_(), ace = ace_(pt);
  if (!B.on) { if (C.STATE_BELL_NEXT || C.STATE_BELL_UNTIL) { setCfg_('STATE_BELL_NEXT', ''); setCfg_('STATE_BELL_UNTIL', ''); setCfg_('STATE_BELL_WARNED', ''); } return; }
  if (B.until && !B.open) {   // closing time
    const used = norm_(C.STATE_BELL_USED);
    setCfg_('STATE_BELL_UNTIL', ''); setCfg_('STATE_BELL_USED', ''); setCfg_('STATE_BELL_NEXT', '');
    post_(used ? '🔔 The Bell is done. One challenger answered it; that fight plays out as charged.' : '🔕 The Bell is done. Nobody answered it' + (ace ? ': ' + esc_(ace.Discord) + ' rests easy.' : '.'));
    C = cfg_();
  }
  if (B.open) return;
  const blocked = !ace || !seasonOpen_(C) || seasonOver_(C) || !!C.STATE_REVENGE_EX_ACE;
  let next = C.STATE_BELL_NEXT ? new Date(C.STATE_BELL_NEXT) : null;
  const lastEnd = B.until || null, gap = (Number(C.BELL_GAP_HOURS) || 0) * 3600000;
  const earliest = new Date(Math.max(t.getTime() + 6 * 3600000, lastEnd ? lastEnd.getTime() + gap : 0, B.shield ? B.shield.getTime() : 0));
  if (!next || (B.shield && next < B.shield)) {
    if (blocked) return;
    next = bellPick_(C, earliest);
    if (next) { setCfg_('STATE_BELL_NEXT', next.toISOString()); setCfg_('STATE_BELL_WARNED', ''); }
    return;
  }
  const warn = (Number(C.BELL_WARN_MINUTES) || 30) * 60000;
  if (!blocked && t >= new Date(next.getTime() - warn) && norm_(C.STATE_BELL_WARNED) !== next.toISOString() && t < next) {
    setCfg_('STATE_BELL_WARNED', next.toISOString());
    post_('🔔 **The Bell rings at ' + ts_(next) + '.** For ' + (Number(C.BELL_MINUTES) || 60) + ' minutes, anyone on the climb can charge ♠ ' + who_(ace) + ': ' + bellTxt_(C) + '.');
  }
  if (t >= next) {
    setCfg_('STATE_BELL_NEXT', ''); setCfg_('STATE_BELL_WARNED', '');
    if (blocked) return;   // no Ace, revenge pending or season closed: skip this one, the next gets picked
    const until = new Date(t.getTime() + (Number(C.BELL_MINUTES) || 60) * 60000);
    setCfg_('STATE_BELL_UNTIL', until.toISOString()); setCfg_('STATE_BELL_USED', '');
    const role = norm_(C.BELL_ROLE_ID).replace(/\D/g, '');
    post_((role ? '<@&' + role + '> ' : '') + '🔔🔔 **THE BELL! THE MOUND IS OPEN TO EVERYONE** until ' + ts_(until) + '.\n' +
      'Anyone on the climb can charge ♠ ' + who_(ace) + ' (' + clubIdTxt_(ace) + '). First one in gets the shot: ' + bellTxt_(C) + '.\n' +
      '📝 Pick **♠ THE ACE** on the Master Form' + (norm_(C.FORM_LINK) ? ': <' + norm_(C.FORM_LINK) + '>' : '.'));
  }
}
function moundNext_(C) {   // words for when the next spot opens, e.g. "#2 joins in about 5 hours"
  const to = moundOpenTo_(C), max = Number(C.MOUND_OPEN_MAX) || 1;
  if (to >= max) return '';
  const at = moundNextAt_(C); if (!at) return '';
  return '#' + (to + 1) + ' gets a title shot ' + ts_(at) + ' (' + rel_(at) + ') if nobody charges the Ace first.';
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
function climbKey_() { return (isFarm_() ? 'CLIMB_F' : 'CLIMB_S') + cfg_().SEASON; }
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
    // The Sharp: sportsbook winnings only (activity pay, items and wagers don't count)
    const prof = {}; readTable_(SHEETS.BETS).rows.forEach(function (x) { if (String(x.Season) === season && (x.Status === 'Won' || x.Status === 'Lost')) { const e = lc_(x.Email); prof[e] = (prof[e] || 0) + num_(x.Profit); } });
    const sp = Object.keys(prof).filter(function (e) { return byEmail[e] && prof[e] > 0; }).map(function (e) { return { email: e, v: prof[e] }; }).sort(function (a, b) { return b.v - a.v; });
    out.sharp = sp.length ? Object.assign(nm(sp[0].email), { value: '+' + sp[0].v + ' BB betting' }) : null;
    out.bookTable = sh.slice(0, 5).map(function (x) { return Object.assign(nm(x.email), { bank: x.v }); });
    const hu = Object.keys(bk.hustle || {}).filter(function (e) { return byEmail[e] && bk.hustle[e] > 0; }).map(function (e) { return { email: e, v: bk.hustle[e] }; })
      .sort(function (a, b) { return b.v - a.v; });
    out.hustler = hu.length ? Object.assign(nm(hu[0].email), { value: '+' + hu[0].v + ' BB head-to-head' }) : null;
  } catch (e) { out.sharp = null; out.bookTable = []; out.hustler = null; }
  try {
    const sk = streakTable_(C).t.rows.filter(function (r) { return String(r.Season) === season && byEmail[lc_(r.Email)] && num_(r.Best) > 1; })
      .sort(function (a, b) { return num_(b.Best) - num_(a.Best) || num_(b.Streak) - num_(a.Streak); });
    out.grinder = sk.length ? Object.assign(nm(sk[0].Email), { value: num_(sk[0].Best) + ' days in a row' }) : null;
  } catch (e) { out.grinder = null; }
  try { out.bleacher = bleacherAward_(C, nm); } catch (e) { out.bleacher = null; }
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
// 🩹 Recovery after a failed charge at the Ace: no charging anyone until it's over. Kept in script properties.
function rests_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(isFarm_() ? 'FARM_REST' : 'HILL_REST') || '{}'); } catch (e) { return {}; } }
function restUntil_(email) { if (isFarm_()) return null;   // 🌱 no recovery on the Farm (old rests from before 3.23 don't count either)
  const r = rests_()[lc_(email)]; return r && new Date(r) > now_() ? new Date(r) : null; }
function setRest_(email, hours) {
  const r = rests_(), now = now_();
  Object.keys(r).forEach(function (k) { if (new Date(r[k]) <= now) delete r[k]; });
  if (hours > 0) r[lc_(email)] = hoursFrom_(now, hours).toISOString(); else delete r[lc_(email)];
  PropertiesService.getScriptProperties().setProperty(isFarm_() ? 'FARM_REST' : 'HILL_REST', JSON.stringify(r));
  return hours > 0 ? new Date(r[lc_(email)]) : null;
}
// A charge at the Ace that failed: down to ACE_LOSS_RANK (or one spot if already lower), then recovery.
function aceLoss_(lad, ch, c, C, extra) {
  if (/🔁/.test(String(c.Notes || ''))) {   // 🔁 Mulligan: no slide, no recovery, and no rematch wait with the Ace
    const P = PropertiesService.getScriptProperties(); let m = {}; try { m = JSON.parse(P.getProperty('MULLIGAN_FREE' + (isFarm_() ? '_FARM' : '')) || '{}'); } catch (e) { }
    m[lc_(ch.Email)] = Date.now() + 72 * 3600e3; P.setProperty('MULLIGAN_FREE' + (isFarm_() ? '_FARM' : ''), JSON.stringify(m));
    extra.push('🔁 **Mulligan!** ' + esc_(ch.Discord) + ' keeps their spot, needs no recovery, and can charge the Ace again as soon as the mound lets them.');
    return;
  }
  if (isFarm_()) { extra.push('🌱 ' + esc_(ch.Discord) + ' keeps their spot on the Farm. Charge again whenever you like.'); return; }   // the Farm has no slide and no recovery
  const cur = lad.indexOf(ch) + 1, to = Math.max(Number(C.ACE_LOSS_RANK) || 5, cur + 1);
  if (cur > 0) insertAt_(lad, ch, to);
  const kn = /🥊/.test(String(c.Notes || '')) && !/🧽/.test(String(c.Notes || ''));
  const hrs = Number(kn ? C.ACE_LOSS_REST_KNUCKLES_HOURS : C.ACE_LOSS_REST_HOURS) || 0;
  const until = setRest_(ch.Email, hrs);
  extra.push('🩹 ' + esc_(ch.Discord) + ' limps off the mound' + (cur > 0 ? ' to **#' + Math.min(to, lad.length) + '**' : '') +
    (until ? ' and is recovering' + (kn ? ' from the 🥊 Brass Knuckles' : '') + ': no charges until ' + ts_(until) + '.' : '.'));
}

// Owner-level actions (shop, bets, votes, wagers) use the shared wallet, so an owner on either ladder counts.
// Farm rows are keyed email#clubId: they come back with the plain account email.
function ownerRows_() {
  const main = players_().rows.filter(function (p) { return p.Status === 'Active'; });
  let farm = [];
  if (farmReady_()) try { farm = withLad_('farm', function () { return players_().rows.filter(function (p) { return p.Status === 'Active'; }); })
    .map(function (p) { const c = Object.assign({}, p, { Email: acct_(p.Email), _lad: 'farm' }); delete c._row; return c; }); } catch (e) { }
  return { rows: main.concat(farm) };
}
function ownerMe_(email) {
  const me = ownerRows_().rows.find(function (p) { return lc_(acct_(p.Email)) === lc_(acct_(email)); });
  if (me) return me;
  return activeMe_(players_(), email);   // same messages as before (not registered / not active)
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
function needFor_(gap) { gap = Number(gap) || 1; return gap <= 1 || isFarm_() ? 1 : gap + 1; }   // 🌱 the Farm: any win counts
function needOf_(c) { const m = /Must win by (\d+)/.exec(String(c.Notes || '')); return m ? Number(m[1]) : 1; }

function newChallenge_(ct, type, status, ch, df, deadline, note) {
  const c = {
    ID: (isFarm_() ? 'F-' : 'C-') + pad_(ct.rows.length + 1), Type: type, Status: status,
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
// Farm posts say so up front (sportsbook and shop posts are shared, so they don't).
function farmDog_(s) {   // 🐕 on the Farm, the Ace is the Farm Dog
  return String(s).replace(/🌱 Farm Ace/g, '🐕 Farm Dog').replace(/Farm Ace/g, 'Farm Dog').replace(/♠ THE ACE/g, '🐕 THE FARM DOG').replace(/NEW ACE!/g, 'NEW FARM DOG! 🐕')
    .replace(/(?<!Farm )\bAce's\b/g, "Farm Dog's").replace(/(?<!Farm )\bAce\b/g, 'Farm Dog').replace(/(?<!FARM )\bACE\b/g, 'FARM DOG');
}
function ladPost_(content, where) { if (isFarm_() && where !== 'book' && where !== 'shop') content = farmDog_(content); return isFarm_() && where !== 'book' && where !== 'shop' && !/^🌱/.test(content) ? '🌱 **FARM HILL** · ' + content : content; }
const POST_BREAK_ = '━━━━━━━━━━━━━━━━━━━━━━';
function post_(content, where) {
  content = ladPost_(content, where);
  try { if (where !== 'help' && content.indexOf('Hold the Hill Leaderboard') < 0 && content.indexOf('HtH Leaderboard') < 0) { const b = norm_(cfg_().BOARD_LINK) || 'https://slipnsliders.github.io/smallball-tools/hill/'; content += '\n📊 [Live HtH Leaderboard](<' + b + '>)'; } } catch (e) { }
  content = content.replace(/\s+$/, '') + '\n' + POST_BREAK_;   // a clean break, so one announcement doesn't run into the next
  snapshotBoard_();   // the HtH Leaderboard shows what Discord has been told
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
      payload: JSON.stringify({ content: text, username: name, allowed_mentions: { parse: ['users', 'roles'] } }) });
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
  if (where === 'shop') return norm_(C.SHOP_WEBHOOK_URL) || norm_(C.BOOK_WEBHOOK_URL) || norm_(C.DISCORD_WEBHOOK_URL);
  return (where === 'book' && norm_(C.BOOK_WEBHOOK_URL)) || (where === 'talk' && norm_(C.TALK_WEBHOOK_URL)) || (where === 'help' && norm_(C.HELP_WEBHOOK_URL)) || norm_(C.DISCORD_WEBHOOK_URL);
}
function senderFor_(where) { return where === 'shop' ? 'Hill Shop' : where === 'book' ? 'Hill Sportsbook' : where === 'talk' ? 'The Hill Heckler' : where === 'help' ? 'Hill Help' : 'Hold the Hill'; }
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
  if (board) bits.push('📊 [Live Hold the Hill Leaderboard](<' + board + '>)');
  if (form) bits.push('📝 [Master Form](<' + form + '>): charge, report, bet');
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
    s += '♠️ **The Ace**\n> ' + line_(ace, false) + '\n';
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
    s += '> #' + p.Rank + ' ' + line_(p, false) + ' · ' + num_(p.Wins) + '-' + num_(p.Losses) + '\n';
  });
  if (lad.length > C.LADDER_POST_SIZE) s += '…and ' + (lad.length - C.LADDER_POST_SIZE) + ' more on the ladder\n';
  return s + linksLine_(C);
}

function notifyReject_(sub, msg) {
  let C;
  try { C = cfg_(); } catch (e) { return; }
  if (String(C.EMAIL_REJECTIONS).toUpperCase() !== 'TRUE' || !sub.email) return;
  try {
    MailApp.sendEmail(acct_(sub.email), '❌ Hold the Hill: your ' + (actionOf_(sub.action) || 'form').replace(/\s*\(.*$/, '').toLowerCase() + ' did NOT go through',
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
  if (/\bshop\b|buy an item/.test(l)) return ACTIONS.SHOP;
  if (/bleacher|\bvote\b/.test(l)) return ACTIONS.VOTE;
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
  try { const p = findBy_(players_(), acct_(sub.email)); if (p) who = tag_(p); } catch (e) { }
  if (!who) { const d = norm_(sub.f && sub.f[Q.DISCORD]); who = d ? '**' + esc_(d) + '**' : 'Someone'; }
  const a = actionOf_(sub.action);
  const kind = a === ACTIONS.REGISTER ? ACTION_SHORT.Register : a === ACTIONS.CHALLENGE ? ACTION_SHORT.Charge : a === ACTIONS.REPORT ? ACTION_SHORT.Report :
    a === ACTIONS.REVENGE ? ACTION_SHORT.Revenge : a === ACTIONS.BET ? ACTION_SHORT.Bet : a === ACTIONS.REACH ? ACTION_SHORT.Reach :
    a === ACTIONS.WAGER ? ACTION_SHORT.Wager : a === ACTIONS.WAGER_REPLY ? ACTION_SHORT.WagerReply : 'form';
  const why = String(msg).replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '(email hidden)');
  const url = norm_(C.HELP_WEBHOOK_URL) || norm_(C.DISCORD_WEBHOOK_URL);
  // Recent rejections also show on the HtH Leaderboard for an hour
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
        '\n\n🔁 **Fix it and send the form again:** ' + (norm_(C.FORM_LINK || '') ? '[Master Form](<' + norm_(C.FORM_LINK) + '>)' : 'the Master Form'),
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
    const onLad = function (lad, fn) { return withLad_(lad, function () { return fn(sub, cfg_()); }); };
    switch (actionOf_(sub.action)) {
      case ACTIONS.REGISTER: onLad(/farm|🌱/i.test(norm_(sub.f[Q.LADDER])) ? 'farm' : '', doRegister_); break;
      case ACTIONS.CHALLENGE: if (/^🌱/.test(norm_(sub.f[Q.OPPONENT]))) withLad_('farm', function () { doChallenge_(farmSub_(sub, 'charge'), cfg_()); }); else onLad('', doChallenge_); break;
      case ACTIONS.REPORT: if (reportLad_(sub.email) === 'farm') withLad_('farm', function () { doReport_(farmSub_(sub, 'report'), cfg_()); }); else onLad('', doReport_); break;
      case ACTIONS.REVENGE: if (revengeLad_(sub.email) === 'farm') withLad_('farm', function () { doRevenge_(Object.assign({}, sub, { email: cfg_().STATE_REVENGE_EX_ACE }), cfg_()); }); else onLad('', doRevenge_); break;
      case ACTIONS.BET: doBet_(sub, C); break;
      case ACTIONS.DISCORD_ID: doDiscordId_(sub, C); if (farmReady_()) withLad_('farm', function () { myFarm_(sub.email, true).forEach(function (r) { try { doDiscordId_(Object.assign({}, sub, { email: r.Email }), cfg_()); } catch (e) { if (!(e instanceof HillError)) throw e; } }); }); break;
      case ACTIONS.REACH: reachBoth_(sub); break;
      case ACTIONS.WAGER: doWager_(sub, C); break;
      case ACTIONS.WAGER_REPLY: doWagerReply_(sub, C); break;
      case ACTIONS.SHOP: doShop_(sub, C); break;
      case ACTIONS.VOTE: doVote_(sub, C); break;
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
  const out = [], itOn = itemsOn_(C), inv = itOn ? inventory_(C) : {};
  // 🛒 Brass Knuckles waiting on a target (they go on unless that player is cooling down)
  const kn = function (p) { return itOn && holds_(inv, p.Email, 'knuckles') > 0 && !itemCooling_(C, p.Email) ? ' 🥊 *(wearing Brass Knuckles: +1 run)*' : ''; };
  if (ace && ace !== me) {
    const openTo = moundOpenTo_(C), busy = ct.rows.some(function (c) { return c.Type !== 'Ladder' && OPEN.indexOf(c.Status) >= 0; });
    const Bw = bellState_(C);
    if (Number(me.Rank) > openTo && Bw.open && !Bw.used && !Bw.shield) out.push('🔔 **The Bell is ringing** until ' + ts_(Bw.until) + ': ♠ **The Ace**, ' + esc_(ace.Discord) + ' · ' + clubIdTxt_(ace) + ': ' + bellTxt_(C) +
      (busy ? ' ⏳ *(a title fight is already on: wait for it)*' : ''));
    if (Number(me.Rank) <= openTo) out.push('♠ **The Ace**, ' + esc_(ace.Discord) + ' · ' + esc_(ace.Club) + ' · ' + clubIdTxt_(ace) + (kn(ace) ? ': **title shot, win by 2+**' + kn(ace) : ': **title shot, just win**') +
      (busy ? ' ⏳ *(a title fight is already on: wait for it)*' : revengeOpen ? " ⏳ *(the Ace's Revenge is pending)*" : ''));
  }
  const myRest = restUntil_(me.Email);
  if (myRest) out.push('🩹 **Recovering** from your last charge at the Ace: you can charge again after ' + Utilities.formatDate(myRest, 'America/Denver', 'EEE h:mm a') + ' MT.');
  ladder_(pt).forEach(function (p) {
    const gap = Number(me.Rank) - Number(p.Rank);
    const jump = itOn && gap === reach + 1;
    if (p === me || gap < 1 || (gap > reach && !jump) || p.Status !== 'Active') return;
    let need = needFor_(gap); const full = need;
    let os = null; try { os = starsOf_(p); } catch (e) { }
    const sg = ms != null && os != null ? Math.max(0, os - ms) : 0;
    if (sg) need = Math.max(1, need - sg);
    if (kn(p)) need += 1;
    const why = [];
    if (openFor_(ct, p.Email)) why.push('in a fight right now');
    if (revengeOpen && lc_(p.Email) === exAce) why.push("Ace's Revenge window open");
    let cool = null; try { cool = inCooldown_(me.Email, p.Email, C); } catch (e) { }
    if (cool) why.push('rematch after ' + Utilities.formatDate(cool, 'America/Denver', 'EEE h:mm a') + ' MT');
    out.push('**#' + p.Rank + '** ' + esc_(p.Discord) + ' · ' + esc_(p.Club) + ' · ' + clubIdTxt_(p) + (norm_(p.ClubID) ? ' [scout](<https://play.smallball.com/#/team/' + norm_(p.ClubID) + '>)' : '') + ': ' +
      (need > 1 ? '**win by ' + need + '+**' : '**just win**') + (sg && need < full ? ' *(Giant Killer: ' + sg + '★ underdog discount)*' : '') + kn(p) + (jump ? ' 🪜 *(Ladder Jump only; with Ladder Jump+ just win)*' : '') +
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
      '\n🥊 Charge on the ' + (norm_(C.FORM_LINK || '') ? '[Master Form](<' + norm_(C.FORM_LINK) + '>)' : 'Master Form') + ' first. Your Start-the-game link comes in the charge post. A game played before you charge doesn\'t count.';
  }
  log_(sub.email, 'Reach check', me.Discord + ' #' + me.Rank);
  post_(msg, 'help');
}

// Which ladder a report or revenge is about: the one where this player has the open charge (or the revenge).
// This account's Farm clubs (active only, unless all).
function myFarm_(email, all) { return players_().rows.filter(function (p) { return lc_(acct_(p.Email)) === lc_(acct_(email)) && (all || p.Status === 'Active'); }); }
// Which of my Farm clubs a charge or report is for: the club ID on the form, else the only one that fits.
function farmSub_(sub, what) {
  const mine = myFarm_(sub.email);
  if (!mine.length) fail_('This Google account has no club on the Farm Hill. Register a 6★-or-under club on the Master Form first.');
  const want = norm_(sub.f[Q.MY_CLUB]).replace(/\D/g, '');
  let pick = null;
  if (want) { pick = mine.find(function (p) { return norm_(p.ClubID) === want; }); if (!pick) fail_('Club ' + want + ' is not one of your Farm clubs (' + mine.map(function (p) { return p.Club + ' ' + p.ClubID; }).join(', ') + ').'); }
  else if (mine.length === 1) pick = mine[0];
  else {
    const ct = challenges_();
    let fits = mine;
    if (what === 'report') fits = mine.filter(function (p) { return openFor_(ct, p.Email); });
    else {
      const opp = norm_(sub.f[Q.OPPONENT]), pt = players_(), tgt = pt.rows.find(function (p) { return lc_(oppLabel_(p)) === lc_(opp); });
      const C = cfg_(), reach = Number(C.CHALLENGE_REACH) || 3, openTo = moundOpenTo_(C), B = bellState_(C);
      fits = mine.filter(function (p) {
        if (openFor_(ct, p.Email) || restUntil_(p.Email) || Number(p.Rank) === 0) return false;
        if (opp === FARM_ACE_CHOICE || opp === FARM_ACE_OLD) return Number(p.Rank) <= openTo || (B.open && !B.used && !B.shield);
        const gap = tgt ? Number(p.Rank) - Number(tgt.Rank) : 0; return gap >= 1 && gap <= reach + 1;
      });
    }
    if (fits.length === 1) pick = fits[0];
    else fail_('You have ' + mine.length + ' Farm clubs' + (fits.length ? ' and ' + fits.length + ' of them could ' + what + ' this one' : '') + ': put the club ID in "Charging with" (' + mine.map(function (p) { return p.Club + ' ' + p.ClubID; }).join(', ') + ').');
  }
  return Object.assign({}, sub, { email: pick.Email });
}
function reportLad_(email) {
  if (!farmReady_()) return '';
  const has = function (lad) { return withLad_(lad, function () { const ct = challenges_(); const rows = lad ? myFarm_(email) : [findBy_(players_(), email)].filter(Boolean); let best = null; rows.forEach(function (me) { const c = openFor_(ct, me.Email); if (c && (!best || new Date(c.Created) > new Date(best.Created))) best = c; }); return best; }); };
  const a = has(''), b = has('farm');
  if (b && (!a || new Date(b.Created) > new Date(a.Created))) return 'farm';
  return '';
}
function revengeLad_(email) { return farmReady_() && lc_(acct_(withLad_('farm', cfg_).STATE_REVENGE_EX_ACE)) === lc_(acct_(email)) ? 'farm' : ''; }
// "Who can I charge?" answers for every ladder the player is on.
function reachBoth_(sub) {
  let done = 0, err = null;
  LADS_.forEach(function (l) {
    if (l === 'farm' && !farmReady_()) return;
    try { withLad_(l, function () { (l ? myFarm_(sub.email) : [findBy_(players_(), sub.email)].filter(Boolean)).forEach(function (me) { doReach_(Object.assign({}, sub, { email: me.Email }), cfg_()); done++; }); }); } catch (e) { if (e instanceof HillError) err = e; else throw e; }
  });
  if (!done) { if (err) throw err; fail_('This Google account is not registered on the Hill or the Farm Hill yet. Register your club first, then ask again.'); }
}
// A club's stars (0–100) from its public SmallBall page.
// A club's star rating (the 1–10 stars on its SmallBall page; star10 in the club data). SmallBall only shows
// club data to someone signed in, so this uses the connected login (🔑 Connect SmallBall). Without one (or if
// it fails), it falls back to the stars the player gave on the Master Form (Stars tab), then to `typed`.
function clubStars_(clubId, typed) {
  const id = norm_(clubId).replace(/\D/g, ''), sp = PropertiesService.getScriptProperties(), ck = sp.getProperty('SB_COOKIE');
  if (ck && !sp.getProperty('SB_BAD')) {
    try {
      const r = UrlFetchApp.fetch('https://play.smallball.com/teams/' + encodeURIComponent(id) + '/profile', { muteHttpExceptions: true, headers: { Accept: 'application/json', Cookie: ck } });
      const code = r.getResponseCode();
      if (code === 401 || code === 403) { sp.setProperty('SB_BAD', String(Date.now())); log_('system', 'SmallBall login expired', 'Star checks use the form until you reconnect (🔑 Connect SmallBall).'); }
      else if (code === 200) { const d = JSON.parse(r.getContentText()); const n = Number(d.star10 != null ? d.star10 : Math.round(Number(d.stars) / 10)); if (isFinite(n)) return { stars: n, name: norm_(d.name), src: 'smallball' }; }
    } catch (e) { }
  }
  const m = starsMap_(); if (id in m) return { stars: m[id], name: '', src: 'form' };
  const t = Number(String(typed == null ? '' : typed).replace(/[^\d]/g, ''));
  return String(typed == null ? '' : typed).trim() !== '' && t >= 0 && t <= 10 ? { stars: t, name: '', src: 'form' } : null;
}
// 🔑 Lets the Hill read club star ratings (SmallBall only shows them to someone signed in). Read-only.
function sbCookieFrom_(txt) {
  const t = String(txt || '').trim();
  const m = /-H\s+\$?['"]cookie:\s*([^'"]+)['"]/i.exec(t) || /-b\s+\$?['"]([^'"]+)['"]/i.exec(t) || /["']cookie["']\s*:\s*["']([^"']+)["']/i.exec(t);
  return (m ? m[1] : t.replace(/^cookie:\s*/i, '')).trim();
}
function adminConnectSmallBall() {
  const ui = SpreadsheetApp.getUi(), pr = PropertiesService.getScriptProperties();
  const r = ui.prompt('🔑 Connect SmallBall (star ratings)',
    'SmallBall only shows a club\'s star rating to someone logged in. Paste your SmallBall login here and the Hill reads star ratings with it (read-only, nothing else) for the 🌱 Farm Hill line. It is kept in the script\'s private settings, not on any tab.\n\n' +
    'On play.smallball.com (logged in) press Ctrl+Shift+I → Network tab → reload the page → right-click any row → Copy → Copy as cURL, then paste the whole thing here.\n\nLeave it blank and click OK to disconnect.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const v = sbCookieFrom_(r.getResponseText());
  if (!v) { pr.deleteProperty('SB_COOKIE'); pr.deleteProperty('SB_BAD'); ui.alert('Disconnected. Star checks use the stars players give on the Master Form.'); return; }
  pr.setProperty('SB_COOKIE', v); pr.deleteProperty('SB_BAD');
  const t = clubStars_('1064');
  ui.alert(t && t.src === 'smallball' ? '✅ Connected: club 1064 reads as ' + t.stars + '★.' : '❌ That login did not work. Copy it again while logged in to SmallBall and paste it in.');
}
// The Farm line in stars out of 10 (a value over 10 is left over from the first 0–100 draft: use 6).
function farmMax_(C) { const n = Number(C.FARM_MAX_STARS); return n >= 1 && n <= 10 ? n : 6; }
function p0_(club, clubId) { return { Club: club, ClubID: clubId }; }
function farmStarsMap_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('FARM_STARS') || '{}'); } catch (e) { return {}; } }
// 🌱 Farm sign-up: a second club, at or under FARM_MAX_STARS, locked at sign-up. The first club on an empty Farm holds it.
function doRegisterFarm_(sub, C) {
  if (lc_(C.FARM_ON) === 'false') fail_('The Farm Hill is closed right now.');
  const f = sub.f, pt = players_();
  const discord = norm_(f[Q.DISCORD]), did = norm_(f[Q.DISCORD_ID]).replace(/\D/g, ''), owner = norm_(f[Q.OWNER]), club = norm_(f[Q.CLUB]), clubId = norm_(f[Q.CLUB_ID]).replace(/\D/g, '');
  if (!discord || !owner || !club || !clubId) fail_('Discord username, owner ID, club name and club ID are all required.');
  const key = farmKey_(sub.email, clubId), ex = findBy_(pt, key);
  if (pt.rows.some(function (p) { return lc_(p.ClubID) === lc_(clubId) && p.Status === 'Active'; })) fail_('Club ' + clubId + ' is already on the Farm Hill.');
  const main = withLad_('', function () { return players_().rows; });
  if (main.some(function (p) { return lc_(p.ClubID) === lc_(clubId) && p.Status === 'Active'; })) fail_('Club ' + clubId + ' is on Hold the Hill. A club plays on one ladder.');
  const st = clubStars_(clubId, f[Q.STARS]);
  if (!st) fail_('Could not read the star rating for club ' + clubId + '. Put your club\'s stars (0-10, on its club page) in the Club stars box and try again.');
  try { setStars_(p0_(club, clubId), st.stars, st.src); } catch (e) { }
  const max = farmMax_(C);
  if (st.stars > max) fail_('Club ' + clubId + ' is ' + st.stars + '★. The Farm Hill is for clubs at ' + max + '★ or under: this one is ready for Hold the Hill.');
  const sp = PropertiesService.getScriptProperties(), fm = farmStarsMap_(); fm[clubId] = st.stars; sp.setProperty('FARM_STARS', JSON.stringify(fm));
  const empty = !ace_(pt) && !ladder_(pt).length;
  const rank = empty ? 0 : ladder_(pt).length + 1;
  const p = { Email: key, Discord: discord, DiscordID: did, OwnerID: owner, Club: club, ClubID: clubId,
    Status: 'Active', Rank: rank, Joined: now_(), Wins: 0, Losses: 0, CareerPts: 0, Defenses: 0, Reigns: 0, BestReignPts: 0 };
  if (ex) { Object.assign(ex, p); writeRow_(pt, ex); } else appendObj_(SHEETS.PLAYERS, p);
  trackClimb_([p]);
  log_(sub.email, 'Register (Farm)', discord + ' / ' + club + ' (' + clubId + ', ' + st.stars + '★) at ' + (empty ? 'Ace' : '#' + rank));
  if (empty) {
    const pt2 = players_(), me = findBy_(pt2, key);
    startReign_(me, false, C); savePlayers_(pt2); setCfg_('STATE_LAST_TITLE_ACTIVITY', now_().toISOString());
    post_('🆕 ' + who_(p) + ' (' + st.stars + '★) is the first club on the Farm and **holds the Farm mound** as the first 🐕 Farm Dog. Come and take it.');
  } else post_('🆕 ' + who_(p) + ' (' + st.stars + '★) joins the Farm Hill at **#' + rank + '**.' + (myFarm_(sub.email).length > 1 ? ' (' + esc_(discord) + ' now has ' + myFarm_(sub.email).length + ' clubs on the Farm.)' : ''));
  refreshFormChoices();
}
// 📣 Call-ups: a Farm club that grows past FARM_MAX_STARS leaves the Farm (hourly, a few clubs at a time).
function farmCallUps_() {
  const C = cfg_(), max = farmMax_(C), sp = PropertiesService.getScriptProperties();
  const pt = players_(), ct = challenges_(), fm = farmStarsMap_();
  const act = pt.rows.filter(function (p) { return p.Status === 'Active' && hasRank_(p) && norm_(p.ClubID); });
  if (!act.length) return;
  let at = Number(sp.getProperty('FARM_CU_AT') || 0) % act.length;
  const pick = act.slice(at, at + 8).concat(at + 8 > act.length ? act.slice(0, at + 8 - act.length) : []).slice(0, Math.min(8, act.length));
  sp.setProperty('FARM_CU_AT', String(at + pick.length));
  pick.forEach(function (p) {
    const st = clubStars_(norm_(p.ClubID)); if (!st || st.src !== 'smallball') return;
    fm[norm_(p.ClubID)] = st.stars;
    if (st.stars <= max || openFor_(ct, p.Email)) return;
    const pt2 = players_(), me = findBy_(pt2, p.Email); if (!me) return;
    const wasAce = ace_(pt2) === me;
    if (wasAce) endReign_('Called up');
    const pt3 = players_(), m3 = findBy_(pt3, p.Email);
    m3.Status = 'Called up'; m3.Rank = '';
    setLadder_(ladder_(pt3)); savePlayers_(pt3);
    log_('system', 'Farm call-up', m3.Discord + ' (' + st.stars + '★)');
    post_('📣 **CALLED UP!** ' + who_(m3) + ' has grown to **' + st.stars + '★**, past the Farm\'s ' + max + '★ line, and graduates from the Farm Hill' + (wasAce ? ' as the reigning 🐕 Farm Dog (the Farm mound is open: the commish crowns the next one)' : '') + '. Ready for Hold the Hill: register it on the Master Form (⛰️ Hold the Hill).');
    refreshFormChoices();
  });
  sp.setProperty('FARM_STARS', JSON.stringify(fm));
}
function doRegister_(sub, C) {
  if (isFarm_()) return doRegisterFarm_(sub, C);
  const f = sub.f;
  const pt = players_();
  if (farmReady_() && withLad_('farm', function () { return players_().rows.some(function (p) { return lc_(p.ClubID) === lc_(norm_(f[Q.CLUB_ID])) && p.Status === 'Active'; }); })) fail_('Club ' + norm_(f[Q.CLUB_ID]) + ' is on the Farm Hill. A club plays on one ladder.');
  if (farmReady_() && norm_(f[Q.CLUB_ID])) {   // Hold the Hill is for clubs above the Farm line: smaller clubs go to the Farm
    const st = clubStars_(norm_(f[Q.CLUB_ID]).replace(/\D/g, ''), f[Q.STARS]);
    if (st && st.stars <= farmMax_(C)) return withLad_('farm', function () { return doRegisterFarm_(sub, cfg_()); });
  }
  const discord = norm_(f[Q.DISCORD]);
  const did = norm_(f[Q.DISCORD_ID]).replace(/\D/g, '');
  const owner = norm_(f[Q.OWNER]);
  const club = norm_(f[Q.CLUB]);
  const clubId = norm_(f[Q.CLUB_ID]);
  if (!discord || !owner || !club || !clubId) fail_('Discord username, owner ID, club name and club ID are all required.');
  const ex = findBy_(pt, sub.email);
  // Back from the Farm (moved down, then called up): reactivate the old Hill row at the bottom of the ladder.
  if (ex && /moved to farm/i.test(ex.Status)) {
    ex.Status = 'Active'; ex.Rank = ladder_(pt).length + 1; ex.Discord = discord; ex.OwnerID = owner; ex.Club = club; ex.ClubID = clubId; if (did) ex.DiscordID = did;
    writeRow_(pt, ex); trackClimb_([ex]);
    try { setStars_(ex, f[Q.STARS], 'form'); } catch (e) { }
    log_(sub.email, 'Register (back from the Farm)', discord + ' / ' + club + ' (' + clubId + ') at #' + ex.Rank);
    post_('📣 ' + who_(ex) + ' is back on the Hill from the 🌱 Farm, starting at **#' + ex.Rank + '**.');
    refreshFormChoices(); return;
  }
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
  const resting = restUntil_(me.Email);
  if (resting) fail_('🩹 You are still recovering from your last charge at the Ace. You can charge again after ' + Utilities.formatDate(resting, 'America/Denver', 'EEE h:mm a') + ' MT.');
  const ace = ace_(pt);
  if (ace === me) fail_('The Ace defends the hill and does not issue challenges.');
  const revengeOpen = !!C.STATE_REVENGE_EX_ACE;
  const exAce = revengeOpen ? lc_(C.STATE_REVENGE_EX_ACE) : '';
  if (revengeOpen && lc_(me.Email) === exAce) fail_("You have the Ace's Revenge pending. Declare it, or wait for the window to close, before issuing ladder challenges.");

  const choice = norm_(sub.f[Q.OPPONENT]);
  const pick = itemKeyOf_(sub.f[Q.USE_ITEM]);
  let type, opp, need = 1, gap = 0, viaBell = false;
  if (isAceChoice_(choice)) {
    if (!ace) fail_(isFarm_() ? '🐕 The doghouse is empty: there is no Farm Dog right now. The commish will crown one.' : 'There is no Ace right now. The commish will crown one.');
    const openTo = moundOpenTo_(C), B = bellState_(C);
    if (Number(me.Rank) > openTo) {
      if (B.open && !B.used && !B.shield) viaBell = true;
      else fail_('The mound is open to ' + (openTo === 1 ? 'the #1 contender only' : '#1–#' + openTo) + ' right now. You are #' + me.Rank + '. ' + moundNext_(C) +
        (B.open && B.used ? ' 🔔 The Bell rang, but someone already answered it.' : ''));
    }
    if (ct.rows.some(function (c) { return c.Type !== 'Ladder' && OPEN.indexOf(c.Status) >= 0; })) fail_('Someone is already charging the mound. Wait for that fight to settle.');
    if (revengeOpen) fail_("The Ace's Revenge is pending. Title challenges reopen once it is settled.");
    type = 'Title'; opp = ace;
  } else {
    // The exact club label first (an owner can have several Farm clubs), then the Discord name, then the old "rank · name" labels.
    opp = pt.rows.find(function (p) { return lc_(oppLabel_(p)) === lc_(choice); }) ||
      pt.rows.find(function (p) { return lc_(p.Discord) === lc_(choice); }) ||
      pt.rows.find(function (p) { return lc_(choice.split(' · ')[1] || '') === lc_(p.Discord); });
    if (!opp || opp.Status !== 'Active') fail_('Opponent "' + choice + '" was not found or is not active.');
    if (opp === me) fail_("You can't challenge yourself.");
    if (opp === ace) fail_('To challenge the Ace, choose the ♠ THE ACE option.');
    if (revengeOpen && lc_(opp.Email) === exAce) fail_("The dethroned Ace can't be challenged while their Ace's Revenge window is open.");
    gap = Number(me.Rank) - Number(opp.Rank);
    if (gap < 1) fail_('You can only challenge players ranked above you (you are #' + me.Rank + ', they are #' + opp.Rank + ').');
    const jumping = (pick === 'jump' || pick === 'jumpplus') && itemsOn_(C) && gap === Number(C.CHALLENGE_REACH) + 1;
    if (gap > C.CHALLENGE_REACH && !jumping) fail_((gap === Number(C.CHALLENGE_REACH) + 1 && itemsOn_(C) ? '🪜 A Ladder Jump gets you one spot further. ' : '') + 'You can challenge up to ' + C.CHALLENGE_REACH + ' spots above you (you are #' + me.Rank + ', they are #' + opp.Rank + ').');
    type = 'Ladder';
    need = needFor_(gap);
  }
  const theirs = openFor_(ct, opp.Email);
  if (theirs) fail_(opp.Discord + ' is already in an open challenge. Try again once it is settled.');
  let mullFree = false;
  if (type === 'Title') { try { const m = JSON.parse(PropertiesService.getScriptProperties().getProperty('MULLIGAN_FREE' + (isFarm_() ? '_FARM' : '')) || '{}'); mullFree = (m[lc_(me.Email)] || 0) > Date.now(); } catch (e) { } }
  const cool = mullFree ? null : inCooldown_(me.Email, opp.Email, C);
  if (cool) fail_('You and ' + opp.Discord + ' played recently. Rematch allowed after ' + cool.toUTCString() + '.');

  let ms = null, os = null;
  try { ms = starsOf_(me); os = starsOf_(opp); } catch (e) { }
  const starGap = ms != null && os != null ? Math.max(0, os - ms) : 0, fullNeed = need;
  if (type === 'Ladder' && starGap) need = Math.max(1, need - starGap);
  const needBefore = need, IT = chargeItems_(C, me, opp, type, gap, need, pick);   // 🛒 Brawl Bucks items (may buy on the spot)
  need = IT.need;
  if (viaBell) need = Math.max(need, Number(C.BELL_MARGIN) || 3);   // 🔔 the Bell's margin; items can't go under it
  const deadline = hoursFrom_(now_(), C.MATCH_HOURS);
  const note = [viaBell ? '🔔 Bell' : '', need > 1 ? 'Must win by ' + need + '+' : '', ms != null && os != null ? 'Stars ' + ms + 'v' + os : '', IT.notes.length ? 'Items ' + IT.notes.join(' ') : ''].filter(Boolean).join(' · ');
  const c = newChallenge_(ct, type, 'Accepted', me, opp, deadline, note);
  if (viaBell) setCfg_('STATE_BELL_USED', c.ID);
  useItems_(C, IT.used, c.ID);
  const itemTxt = IT.post.length ? '\n' + IT.post.join('\n') + (need !== needBefore || IT.notes.length ? ' ' + esc_(me.Discord) + ' needs ' + (need > 1 ? '**' + need + '+ runs**' : '**any win**') + '.' : '') : '';
  log_(sub.email, 'Challenge', c.ID + ' ' + type + ': ' + me.Discord + ' → ' + opp.Discord + (IT.notes.length ? ' (items ' + IT.notes.join(' ') + ')' : ''));
  const lineTxt = openLine_(c, me, opp, C);
  try { if (bookOn_(C)) { const Lc = readTable_(SHEETS.LINES).rows.filter(function (x) { return x.ChallengeID === c.ID; })[0]; betsClosedPost_(c, me, opp, Lc); } } catch (e) { }
  try { potTick_(true); } catch (e) { }
  if (type === 'Title') {
    post_('👑 **' + esc_(me.Discord).toUpperCase() + ' CHARGES THE MOUND!**\n> ⚔️ ' + line_(me, true) + ' · ' + (Number(me.Rank) === 1 ? '#1 contender' : viaBell ? 'from #' + me.Rank + ', answering 🔔 THE BELL' : 'from #' + me.Rank + ', through the open mound') + '\n> ♠️ ' + line_(opp, true) + ' · the Ace\n' +
      nm_(me) + ' is coming for the hill.' + (viaBell ? ' 🔔 Bell rules: win by **' + need + '+** to take the hill; a smaller win makes ' + esc_(me.Discord) + ' the **#1 contender**.' : '') + itemTxt + '\n🎯 **' + esc_(me.Discord) + ', start a BigLeague game vs ' + clubIdTxt_(opp) + ' (' + esc_(opp.Club) + ') within the hour.** You\'re the visitor. Nothing to report: the Hill finds it.' + ' Deadline ' + ts_(deadline) + '.' + startLine_(me, opp) + lineTxt);
  } else {
    post_('🥊 **New charge** · #' + me.Rank + ' charges #' + opp.Rank + '\n> ⚔️ ' + line_(me, true) + ' · #' + me.Rank + '\n> 🛡️ ' + line_(opp, true) + ' · #' + opp.Rank + '\nBenches clear. ' +
      (ms != null && os != null ? '(' + starTag_(ms) + ' vs ' + starTag_(os) + ') ' : '') +
      (starGap && fullNeed > need ? '🗡️ Giant Killer rule: down ' + starGap + '★, so ' + esc_(me.Discord) + ' needs ' + (need > 1 ? 'only **' + need + '+ runs**' : '**any win**') + ' instead of ' + fullNeed + '+. ' :
        needBefore > 1 ? 'Reaching ' + (Number(me.Rank) - Number(opp.Rank)) + ' spots up, ' + esc_(me.Discord) + ' must win by **' + needBefore + '+ runs** to climb. ' : '') + itemTxt +
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
      headline = '😤 ' + nm_(ch) + ' beats ' + nm_(df) + ' ' + scoreTxt + ' but needed to win by **' + need + '+** reaching that high. ' +
        nm_(df) + ' keeps **#' + defRank + '**. Nobody moves.';
    } else if (chWins && Number(ch.Rank) < defRank) {   // another result already moved them past each other
      outcome = 'Won, already above: no change';
      headline = '📈 ' + nm_(ch) + ' beats ' + nm_(df) + ' ' + scoreTxt + '. Other results already put ' + nm_(ch) + ' above them, so nobody moves.';
    } else if (chWins) {
      insertAt_(lad, ch, defRank);
      outcome = ch.Discord + ' takes #' + defRank;
      headline = '📈 ' + nm_(ch) + ' beats ' + nm_(df) + ' ' + scoreTxt + ' and climbs to **#' + defRank + '**.';
    } else {
      dropOne_(lad, ch);
      outcome = df.Discord + ' holds #' + defRank;
      headline = '🧱 ' + nm_(df) + ' holds **#' + defRank + '**, beating ' + nm_(ch) + ' ' + scoreTxt + '.';
    }
    setLadder_(lad);
  } else if (c.Type === 'Title') {
    const rt = readTable_(SHEETS.REIGNS);
    const reign = currentReign_(rt);
    if (!reign) fail_('No active reign on file. The commish should crown the Ace again.');
    const tNeed = needOf_(c), isBell = /🔔 Bell/.test(String(c.Notes || ''));
    if (isBell && chWins && !forfeit && margin < tNeed) {   // 🔔 a Bell win that's too small: #1 contender, the Ace keeps the hill
      if (Number(ch.Rank) !== 1) { removeFrom_(lad, ch); insertAt_(lad, ch, 1); }
      setLadder_(lad);
      outcome = 'Bell: won by ' + margin + ', needed ' + tNeed + '+: #1 contender';
      headline = '🔔 ' + nm_(ch) + ' answers the Bell and beats ' + nm_(df) + ' ' + scoreTxt + '! Not by **' + tNeed + '+**, so ♠️ ' + nm_(df) +
        ' keeps the hill, but ' + esc_(ch.Discord) + ' jumps to **#1 contender**.';
    } else if (chWins && !forfeit && margin < tNeed) {   // 🥊 Brass Knuckles on the Ace: a win that's too small is a failed charge
      aceLoss_(lad, ch, c, C, extra);
      setLadder_(lad);
      outcome = 'Won by ' + margin + ', needed ' + tNeed + '+: the Ace holds';
      headline = '🥊 ' + nm_(ch) + ' beats ' + nm_(df) + ' ' + scoreTxt + ' but needed to win by **' + tNeed + '+** through the Brass Knuckles. ' +
        '♠️ ' + nm_(df) + ' keeps the hill, no points.';
    } else if (!chWins) {
      const n = num_(reign.Defenses) + 1;
      points = reward_(n, C);
      const before = num_(reign.ReignPts);
      reign.Defenses = n;
      reign.ReignPts = before + points;
      writeRow_(rt, reign);
      df.CareerPts = num_(df.CareerPts) + points;
      df.Defenses = num_(df.Defenses) + 1;
      df.BestReignPts = Math.max(num_(df.BestReignPts), reign.ReignPts);
      aceLoss_(lad, ch, c, C, extra);
      setLadder_(lad);
      outcome = 'Defense #' + n + ' (+' + points + ')';
      headline = '♠️ **The Ace holds the hill!** ' + nm_(df) + ' beats ' + nm_(ch) + ' ' + scoreTxt +
        '. Defense #' + n + ', **+' + points + '** pts (reign total ' + reign.ReignPts + ').';
      if (isBell) {
        const bounty = Number(C.BELL_BOUNTY) || 0, sh = hoursFrom_(now_(), Number(C.BELL_SHIELD_HOURS) || 0);
        if (bounty) ledger_(C, df, bounty, '🔔 Bell defense bounty (' + c.ID + ')');
        setCfg_('STATE_BELL_SHIELD', sh.toISOString());
        extra.push('🔔 Bell defense: ' + (bounty ? '**+' + bounty + ' BB** bounty, and ' : '') + '🛡️ no Bell rings again until ' + ts_(sh) + '.');
      }
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
      const ko = !forfeit && /💥/.test(String(c.Notes || '')) && margin >= 4;   // 💥 Knockout Punch: the old Ace goes to the bottom
      insertAt_(lad, df, ko ? lad.length + 1 : C.EX_ACE_RANK);
      setLadder_(lad);
      startReign_(ch, false, C);
      if (ko) extra.push('💥 **KNOCKOUT!** ' + esc_(ch.Discord) + "'s Knockout Punch lands by " + margin + ': ' + esc_(df.Discord) + ' drops to the bottom of the ladder, with no Ace\'s Revenge.');
      else if (/💥/.test(String(c.Notes || '')) && !forfeit) extra.push('💥 The Knockout Punch needed a 4+ run win. ' + esc_(df.Discord) + ' stays on their feet.');
      if (/💰/.test(String(c.Notes || ''))) { const bb = Math.max(25, Math.round(num_(reign.ReignPts) * 0.25)); ledger_(C, ch, bb, '💰 Bounty Hunter (' + c.ID + ')'); extra.push('💰 **Bounty collected:** ' + esc_(ch.Discord) + ' pockets **' + bb + ' BB** from the old reign.'); }
      outcome = forfeit ? 'Takes the hill by forfeit' : 'Takes the hill';
      headline = '👑 **NEW ACE!** ' + nm_(ch) + ' takes the hill from ' + nm_(df) + ' ' + scoreTxt + '. ' +
        esc_(df.Discord) + "'s reign ends at " + num_(reign.Defenses) + ' defense(s), ' + oldPts + ' pts.';
      if (!forfeit && !ko && oldPts >= C.REVENGE_THRESHOLD) {
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
      headline = "🔥 **THE ACE'S REVENGE!** " + nm_(ch) + ' beats ' + nm_(df) + ' ' + scoreTxt +
        ' and takes the hill back. A new reign begins.';
    } else {
      aceLoss_(lad, ch, c, C, extra);
      setLadder_(lad);
      outcome = chWins ? 'Revenge fell short (won by ' + margin + ', needed more than ' + need + ')' : 'Revenge denied';
      headline = chWins
        ? '😤 ' + nm_(ch) + ' wins ' + scoreTxt + ' but needed to win by more than ' + need + '. ' + nm_(df) + ' keeps the hill.'
        : '♠️ ' + nm_(df) + ' turns back the revenge, ' + scoreTxt + ', and keeps the hill.';
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
    MatchID: (isFarm_() ? 'FM-' : 'M-') + pad_(mt.rows.length + 1), Date: now_(), Season: C.SEASON, ChallengeID: c.ID, Type: c.Type,
    GameID: c.GameID, Winner: W.Discord, WinnerEmail: W.Email, Loser: L.Discord, LoserEmail: L.Email,
    WinnerRuns: forfeit ? '' : Math.max(cr, dr), LoserRuns: forfeit ? '' : Math.min(cr, dr),
    Margin: margin, Outcome: outcome, Points: points, Source: source,
  });
  log_('system', 'Result', c.ID + ' ' + c.Type + ': ' + outcome + ' [' + source + ']');
  if (!forfeit) { try { const ub = upsetBonus_(c, W, L, chWins); if (ub) extra.push(ub); } catch (e) { log_('system', 'Upset error', String(e)); } }
  const bk = bookSettle_(c, forfeit ? 0 : cr, forfeit ? 0 : dr, forfeit);
  if (bk) extra.push(bk);
  try { const pk = potSettle_(c, cr, dr, forfeit); if (pk) extra.push(pk); } catch (e) { log_('system', 'Matchup settle error', String(e)); }
  if (!forfeit) { try { const pb = payPlay_(C, c, W, L, false); if (pb) extra.push(pb); } catch (e) { log_('system', 'Play bucks error', String(e)); } }
  try { payoutPost_(c, cr, dr, forfeit); } catch (e) { }
  // Clean top: what it was, the final, then one line per club (winner first), then the story.
  const top = (c.Type === 'Title' ? '♠️ **Title fight**' : c.Type === 'Revenge' ? "🔥 **The Ace's Revenge**" : '⛰️ **Hill result**') + ' · ' + (forfeit ? 'by forfeit' : 'final **' + Math.max(cr, dr) + '–' + Math.min(cr, dr) + '**') + (norm_(c.GameID) ? ' · game `' + norm_(c.GameID) + '`' : '') +
    '\n> ✅ ' + line_(W, true) + '\n> ❌ ' + line_(L, true) + '\n';
  postResult_(c, top + headline + (extra.length ? '\n' + extra.join('\n') : ''));
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
    MatchID: (isFarm_() ? 'FM-' : 'M-') + pad_(mt.rows.length + 1), Date: now_(), Season: C.SEASON, ChallengeID: c.ID, Type: c.Type,
    GameID: c.GameID, Winner: df.Discord, WinnerEmail: df.Email, Loser: ch.Discord, LoserEmail: ch.Email,
    WinnerRuns: runs, LoserRuns: runs, Margin: 0, Outcome: 'Tie: ' + df.Discord + ' holds', Points: 0, Source: source,
  });
  log_('system', 'Tie (hold)', c.ID + ' ' + score);
  const head = c.Type === 'Ladder' ? '🤝 ' + who_(ch) + ' and ' + who_(df) + ' tie ' + score + '. ' + esc_(df.Discord) + ' holds **#' + df.Rank + '**.'
    : c.Type === 'Revenge' ? "🤝 The Ace's Revenge ends in a " + score + ' tie. ' + who_(df) + ' keeps the hill.'
    : '🤝 ' + who_(df) + ' and ' + who_(ch) + ' tie ' + score + '. **The Ace holds the hill** (a tie earns no defense points).';
  const bk = bookSettle_(c, runs, runs, false);
  let pk = ''; try { pk = potSettle_(c, runs, runs, false); } catch (e) { }
  let pb = ''; try { pb = payPlay_(C, c, df, ch, true); } catch (e) { }
  try { payoutPost_(c, runs, runs, false); } catch (e) { }
  postResult_(c, head + (bk ? '\n' + bk : '') + (pk ? '\n' + pk : '') + (pb ? '\n' + pb : ''));
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
  q.push({ at: at, text: text, where: where || '', lad: LAD_ });
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
    '📺 Games found, waiting to air: ' + after.found + (next ? ' (next post ' + Utilities.formatDate(new Date(next), 'America/Denver', 'h:mm a') + ' MT)' : ''),
    '',
    'Last SmallBall check: ' + (C.STATE_AUTO_STATUS || 'not yet'),
    'HtH Leaderboard and odds refreshed.'];
  ui.alert(lines.join('\n'));
}

// Runs every minute. Light work every minute (find games, settle, post what's due); the rest every 5 minutes.
function flushPosts() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;   // another run is still going; the next minute will catch up
  try {
    const props = PropertiesService.getScriptProperties();
    const t = now_().getTime();
    eachLad_(function () {
      let anyOpen = true;
      try { anyOpen = challenges_().rows.some(function (c) { return OPEN.indexOf(c.Status) >= 0; }); } catch (e) { }
      if (!anyOpen) return;
      try { autoDetect_(); } catch (err) { log_('system', 'ERROR (auto-detect)', String(err && err.stack || err)); }
      try { settleChallengerReports_(); } catch (err) { log_('system', 'ERROR (settle)', String(err && err.stack || err)); }
    });
    try { if (farmReady_()) withLad_('farm', farmDogAuto_); } catch (err) { log_('system', 'ERROR (farm dog)', String(err && err.stack || err)); }
    try { flushRetries_(); } catch (err) { log_('system', 'ERROR (retries)', String(err && err.stack || err)); }
    let q = []; try { q = JSON.parse(props.getProperty('POST_QUEUE') || '[]'); } catch (e) { q = []; }
    const due = q.filter(function (x) { return x.at <= t; });
    if (due.length) {
      props.setProperty('POST_QUEUE', JSON.stringify(q.filter(function (x) { return x.at > t; })));
      due.forEach(function (x) { withLad_(x.lad || '', function () { post_(x.where === 'book' ? x.text : x.text + '\n\n' + standingsText_(), x.where); }); });
    }
    if (t - Number(props.getProperty('FLUSH5_AT') || 0) >= 290000) {
      props.setProperty('FLUSH5_AT', String(t));
      eachLad_(tick_);
      try { bookChoicesTick_(); } catch (err) { log_('system', 'ERROR (book)', String(err && err.stack || err)); }
      try { dayTick_(); } catch (err) { log_('system', 'ERROR (daily book)', String(err && err.stack || err)); }
      try { wagersTick_(); } catch (err) { log_('system', 'ERROR (wagers)', String(err && err.stack || err)); }
      try { flushLog_(); } catch (err) { }
    }
  } finally { lock.releaseLock(); }
}

function voidChallenge_(ct, c, why) {
  const bk = bookSettle_(c, 0, 0, true);
  if (bk) why += ' ' + bk;
  try { const pk = potSettle_(c, 0, 0, true); if (pk) why += ' ' + pk; } catch (e) { }
  const ib = refundItems_(cfg_(), c); if (ib) why += ' ' + ib;
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

// ───────────────────────────── 🛒 Brawl Bucks items ─────────────────────────────
// Buy an item from the shop (the Master Form) and hold it until you need it. Prices are set when you buy:
// the Ace pays more (ITEM_ACE_X), so suiting up on the way up is the smart play.
//   🥊 Brass Knuckles (defense): used by itself on the next charge against you. The challenger needs 1 more run
//      (a title charge needs a 2-run win).
//   🧽 Margin Eraser (offense): pick it on the charge form. Win your charge by any amount. It cancels Brass Knuckles.
//   🪜 Ladder Jump (offense): pick it on the charge form. Charge one spot further than the normal reach.
// One item per side per charge; each player can use one item every ITEM_COOLDOWN_HOURS. Items used on a charge that
// gets voided come back. Purchases and items in play are public: they post in Discord and show on the HtH Leaderboard.
// Every Hill game also pays Brawl Bucks (PLAY_BUCKS), so you don't have to bet to afford items.
const ITEMS = {
  knuckles: { icon: '🥊', name: 'Brass Knuckles', kind: 'defense or title charge', what: 'On the next charge against you, the challenger needs 1 more run (a title charge needs a 2-run win). Or throw them on your own charge at the Ace as a 💥 Knockout Punch: take the hill by 4+ and the old Ace drops to the bottom of the ladder with no Ace\'s Revenge' },
  eraser: { icon: '🧽', name: 'Margin Eraser', kind: 'offense', what: 'Win your charge by any amount. Cancels Brass Knuckles' },
  jump: { icon: '🪜', name: 'Ladder Jump', kind: 'offense', what: 'Charge one spot further than the normal reach' },
  jumpplus: { icon: '🪜', name: 'Ladder Jump+', kind: 'offense', what: 'Charge one spot further than the normal reach, and any win will do' },
  mulligan: { icon: '🔁', name: 'Mulligan', kind: 'title charge', what: 'Charge the Ace with it and a loss doesn\'t count against you: no slide down the ladder, no recovery, and no wait to charge the Ace again once the mound lets you' },
  bounty: { icon: '💰', name: 'Bounty Hunter', kind: 'title charge', what: 'Charge the Ace with it and take the hill: you collect 25% of the old Ace\'s reign points as Brawl Bucks (25 BB at least)' },
  rain: { icon: '🌧️', name: 'Rain Delay', kind: 'streak', what: 'Saves your 🔥 Hill streak once, on a day you don\'t play' },
};
const itemLabel_ = (k) => ITEMS[k].icon + ' ' + ITEMS[k].name;
function itemsOn_(C) { return /^true$/i.test(norm_(C.ITEMS_ON)) && lc_(C.BOOK_ON) !== 'false'; }   // Farm games pay and use items too, even without a Farm sportsbook
function itemPrices_(C) {
  const out = { knuckles: 250, eraser: 200, jump: 150, jumpplus: 300, rain: 100, mulligan: 200, bounty: 150 };
  norm_(C.ITEM_PRICES).split(/[\s,]+/).forEach(function (kv) { const m = /^(\w+):(\d+)$/.exec(kv); if (m && out[m[1]] != null) out[m[1]] = Number(m[2]); });
  return out;
}
const aceX_ = (C) => Math.max(1, Number(C.ITEM_ACE_X) || 2);
function priceFor_(C, key, isAce) { return Math.round(itemPrices_(C)[key] * (isAce ? aceX_(C) : 1)); }
function itemKeyOf_(txt) { const l = lc_(txt); return /mulligan/.test(l) ? 'mulligan' : /bounty/.test(l) ? 'bounty' : /knuckle|knockout/.test(l) ? 'knuckles' : /eraser/.test(l) ? 'eraser' : /jump\s*(\+|plus)/.test(l) ? 'jumpplus' : /jump/.test(l) ? 'jump' : /rain|delay/.test(l) ? 'rain' : ''; }
// What each player holds this season: bought - used + refunded.
function inventory_(C) {
  const season = String(C.SEASON), inv = {};
  try {
    readTable_(SHEETS.ITEMS).rows.forEach(function (x) {
      if (String(x.Season) !== season) return;
      const e = lc_(x.Email), k = norm_(x.Item); if (!ITEMS[k]) return;
      if (!inv[e]) { inv[e] = {}; Object.keys(ITEMS).forEach(function (q) { inv[e][q] = 0; }); }
      inv[e][k] += x.Action === 'Bought' || x.Action === 'Refunded' ? 1 : x.Action === 'Used' ? -1 : 0;
    });
  } catch (e) { }
  return inv;
}
const holds_ = (inv, email, key) => ((inv[lc_(acct_(email))] || {})[key] || 0);
// When this player last used an item (refunded uses don't count).
function lastItemUse_(C, email) {
  const season = String(C.SEASON), refunded = {}; let last = 0;
  const rows = readTable_(SHEETS.ITEMS).rows.filter(function (x) { return String(x.Season) === season && lc_(x.Email) === lc_(email); });
  rows.forEach(function (x) { if (x.Action === 'Refunded') refunded[x.ChallengeID + ':' + x.Item] = true; });
  rows.forEach(function (x) { if (x.Action === 'Used' && x.Item !== 'rain' && !refunded[x.ChallengeID + ':' + x.Item]) last = Math.max(last, new Date(x.Date).getTime()); });
  return last;
}
function itemCooling_(C, email) {
  const h = Number(C.ITEM_COOLDOWN_HOURS) || 24, last = lastItemUse_(C, acct_(email));
  return last && now_().getTime() - last < h * 3600e3 ? new Date(last + h * 3600e3) : null;
}
function itemRow_(C, p, key, action, price, cid, note) {
  appendObj_(SHEETS.ITEMS, { Date: now_(), Season: C.SEASON, Email: acct_(p.Email), Player: p.Discord, Item: key, Action: action, Price: price || '', ChallengeID: cid || '', Notes: note || '' });
}
function ledger_(C, p, amount, reason) {
  appendObj_(SHEETS.LEDGER, { Date: now_(), Season: C.SEASON, Email: acct_(p.Email), Player: p.Discord, Amount: amount, Reason: reason });
}
// Buy one item (from the shop, or on the spot when charging with an item you don't hold yet).
function buyItem_(C, p, key, isAce) {
  const price = priceFor_(C, key, isAce), bank = bankOf_(bankrolls_(C), p.Email);
  if (bank < price) fail_(itemLabel_(key) + ' costs ' + price + ' BB' + (isAce ? ' for the Ace' : '') + ' and you have ' + bank + ' BB.');
  ledger_(C, p, -price, 'Bought ' + itemLabel_(key) + (isAce ? ' (Ace price)' : ''));
  itemRow_(C, p, key, 'Bought', price, '', isAce ? 'Ace price' : '');
  return price;
}
function doShop_(sub, C) {
  if (!itemsOn_(C)) fail_('The Brawl Bucks shop is closed right now.');
  const pt = players_(), me = ownerMe_(sub.email), key = itemKeyOf_(sub.f[Q.ITEM]);
  if (!key) fail_('Pick an item to buy.');
  const ace = ace_(pt), isAce = !!ace && lc_(ace.Email) === lc_(me.Email);
  const price = buyItem_(C, me, key, isAce), inv = inventory_(C), n = holds_(inv, me.Email, key);
  log_(sub.email, 'Item bought', key + ' for ' + price);
  post_('🛒 ' + who_(me) + ' buys ' + itemLabel_(key) + ' for **' + price + ' BB**' + (isAce ? ' (Ace price)' : '') + '. Holding ' + n + '.' +
    (key === 'knuckles' ? '\n-# 🥊 Brass Knuckles go on by themselves at the next charge against them: the challenger needs 1 more run.' :
      key === 'rain' ? '\n-# 🌧️ The Rain Delay kicks in by itself the first day they miss, and the 🔥 streak lives on.' : '\n-# They pick it on the charge form when they charge.'), 'shop');
}
// At charge time: work out which items are in play and what the challenger needs. Throws for a bad pick.
// Returns { need, notes: [...], used: [[player, key, bought]], post: '...' }.
function chargeItems_(C, me, opp, type, gap, need, pick) {
  const out = { need: need, notes: [], used: [], post: [] };
  if (!itemsOn_(C)) { if (pick) fail_('Items are switched off right now: charge without one.'); return out; }
  const inv = inventory_(C);
  if (pick === 'knuckles' && type !== 'Title') fail_('Brass Knuckles go on by themselves when someone charges you. On a charge of your own they only work at the Ace, as a 💥 Knockout Punch.');
  if ((pick === 'mulligan' || pick === 'bounty') && type !== 'Title') fail_('The ' + ITEMS[pick].name + ' is for a charge at the Ace.');
  if (pick === 'rain') fail_('The Rain Delay saves your streak by itself on a day you miss. Buy it in the 🛒 shop; nothing to pick here.');
  const isJump = pick === 'jump' || pick === 'jumpplus';
  if (isJump && type !== 'Ladder') fail_('The ' + ITEMS[pick].name + ' is for ladder charges, not the mound.');
  if (isJump && gap !== Number(C.CHALLENGE_REACH) + 1) fail_('The Ladder Jump is for charging exactly ' + (Number(C.CHALLENGE_REACH) + 1) + ' spots up. This charge is in reach without it.');
  // The defender's Brass Knuckles (one per charge, if they're not cooling down)
  let knuckles = false;
  if (type !== 'Revenge' && holds_(inv, opp.Email, 'knuckles') > 0 && !itemCooling_(C, opp.Email)) knuckles = true;
  if (pick === 'eraser' && !knuckles && need <= 1) fail_('The Margin Eraser would do nothing here: you only need to win this one. Save it.');
  if (pick) {
    const cool = itemCooling_(C, me.Email);
    if (cool) fail_('You used an item in the last ' + (Number(C.ITEM_COOLDOWN_HOURS) || 24) + ' hours. Your next one is ready ' + cool.toUTCString() + '.');
    let bought = false;
    if (holds_(inv, me.Email, pick) < 1) { buyItem_(C, me, pick, false); bought = true; }
    out.used.push([me, pick, bought]);
  }
  if (knuckles) { out.used.push([opp, 'knuckles', false]); out.need += 1; out.notes.push('🥊 ' + opp.Discord); out.post.push('🥊 ' + tag_(opp) + ' is wearing **Brass Knuckles**: +1 run.'); }
  if (pick === 'eraser') { out.need = 1; out.notes.push('🧽 ' + me.Discord); out.post.push('🧽 ' + esc_(me.Discord) + ' swings the **Margin Eraser**: ' + (knuckles ? 'the Brass Knuckles are knocked off, and ' : '') + 'any win will do.'); }
  if (pick === 'jumpplus') { out.need = knuckles ? 2 : 1; out.notes.push('🪜+ ' + me.Discord); out.post.push('🪜 ' + esc_(me.Discord) + ' uses a **Ladder Jump+** to reach ' + gap + ' spots up: ' + (knuckles ? 'the Brass Knuckles still count, so 2+ runs.' : 'any win will do.')); }
  if (pick === 'knuckles') { out.notes.push('💥 ' + me.Discord); out.post.push('💥 ' + esc_(me.Discord) + ' slips on the **Brass Knuckles** for a **Knockout Punch**: take the hill by **4+** and the old Ace drops to the bottom, with no Ace\'s Revenge.'); }
  if (pick === 'mulligan') { out.notes.push('🔁 ' + me.Discord); out.post.push('🔁 ' + esc_(me.Discord) + ' has a **Mulligan**: lose this one and it doesn\'t count against them.'); }
  if (pick === 'bounty') { out.notes.push('💰 ' + me.Discord); out.post.push('💰 ' + esc_(me.Discord) + ' is a **Bounty Hunter**: take the hill and 25% of the reign goes in their pocket.'); }
  if (pick === 'jump') { out.notes.push('🪜 ' + me.Discord); out.post.push('🪜 ' + esc_(me.Discord) + ' uses a **Ladder Jump** to reach ' + gap + ' spots up.'); }
  return out;
}
function useItems_(C, used, cid) {
  used.forEach(function (u) { itemRow_(C, u[0], u[1], 'Used', '', cid, u[2] ? 'Bought on the spot' : ''); });
  if (used.length) try { post_('🎯 ' + cid + ': ' + used.map(function (u) { return esc_(u[0].Discord) + ' ' + (u[2] ? 'buys and uses' : 'uses') + ' ' + itemLabel_(u[1]) + (u[2] ? ' (' + priceFor_(C, u[1], false) + ' BB)' : ''); }).join(' · ') + '.', 'shop'); } catch (e) { }
}
// A voided charge gives its items back.
function refundItems_(C, c) {
  try {
    const pt = players_(), rows = readTable_(SHEETS.ITEMS).rows.filter(function (x) { return x.ChallengeID === c.ID; });
    const back = rows.filter(function (x) { return x.Action === 'Used' && !rows.some(function (y) { return y.Action === 'Refunded' && y.Item === x.Item && lc_(y.Email) === lc_(x.Email); }); });
    back.forEach(function (x) { const p = findBy_(pt, x.Email); if (p) itemRow_(C, p, x.Item, 'Refunded', '', c.ID, 'Charge voided'); });
    if (back.length) try { post_('↩️ ' + c.ID + ' was voided: ' + back.map(function (x) { return esc_(x.Player) + ' gets ' + itemLabel_(x.Item) + ' back'; }).join(' · ') + '.', 'shop'); } catch (e) { }
    return back.length ? '🛒 Items used on it go back to their owners.' : '';
  } catch (e) { return ''; }
}
// Brawl Bucks for playing: every Hill game pays both clubs, the winner gets more.
function playBucks_(C) {
  const out = { played: 10, win: 25, charge: 10 };
  norm_(C.PLAY_BUCKS).split(/[\s,]+/).forEach(function (kv) { const m = /^(\w+):(\d+)$/.exec(kv); if (m && out[m[1]] != null) out[m[1]] = Number(m[2]); });
  return out;
}
function gamesToday_(C, email) {
  const season = String(C.SEASON), day = denverDay_(now_()); let n = 0;
  readTable_(SHEETS.MATCHES).rows.forEach(function (m) {
    if (String(m.Season) !== season || !m.Date || denverDay_(new Date(m.Date)) !== day) return;
    if (lc_(m.WinnerEmail) === lc_(email) || (lc_(m.Source) !== 'forfeit' && lc_(m.LoserEmail) === lc_(email))) n++;
  });
  return n;
}
function payPlay_(C, c, W, L, tie) {
  if (!itemsOn_(C)) return '';   // launches with the shop
  // Only the first PAID_GAMES_PER_DAY Hill games a day pay each player (this game is already in Matches)
  const maxRaw = String(C.PAID_GAMES_PER_DAY == null ? '' : C.PAID_GAMES_PER_DAY).trim(), maxDay = maxRaw === '' ? 0 : Number(maxRaw) || 0, capped = [];
  // 0 = no limit: every Hill game pays
  const okW = maxDay > 0 ? gamesToday_(C, W.Email) <= maxDay : true, okL = maxDay > 0 ? (!L || gamesToday_(C, L.Email) <= maxDay) : true;
  if (!okW) capped.push(W.Discord); if (L && !okL) capped.push(L.Discord);
  if (!okW && !okL) return '-# 💵 No Brawl Bucks for this one: ' + capped.map(esc_).join(' and ') + ' already got paid for ' + maxDay + ' Hill games today.';
  const L0 = L; if (!okL) L = null;
  const note = capped.length ? ' (' + capped.map(esc_).join(', ') + ': ' + maxDay + ' paid games today already)' : '';
  if (!okW) { const pb0 = playBucks_(C), chg0 = c.Type !== 'Revenge' && lc_(L0.Email) === lc_(c.Challenger) ? pb0.charge : 0; ledger_(C, L0, pb0.played + chg0, 'Played ' + c.ID); return '💵 +' + (pb0.played + chg0) + ' BB to ' + esc_(L0.Discord) + ' for playing' + note + '.'; }
  const pb = playBucks_(C);
  if (!pb.played && !pb.win) return '';
  // The challenger also gets the charge bonus for picking the fight (ladder and title charges, not revenge)
  const chg = c.Type !== 'Revenge' && pb.charge ? pb.charge : 0, isCh = function (p) { return p && lc_(p.Email) === lc_(c.Challenger); };
  const amt = function (p, base) { return base + (isCh(p) ? chg : 0); };
  const tail = chg && (isCh(W) || isCh(L)) ? ' (incl. +' + chg + ' for the charge)' : '';
  if (tie) { ledger_(C, W, amt(W, pb.played), 'Played ' + c.ID); if (L) ledger_(C, L, amt(L, pb.played), 'Played ' + c.ID); return '💵 +' + pb.played + ' BB ' + (L ? 'each ' : 'to ' + esc_(W.Discord) + ' ') + 'for playing' + (chg ? ', +' + chg + ' more to the challenger' : '') + note + '.'; }
  ledger_(C, W, amt(W, pb.played + pb.win), 'Won ' + c.ID); if (L && amt(L, pb.played)) ledger_(C, L, amt(L, pb.played), 'Played ' + c.ID);
  return '💵 +' + amt(W, pb.played + pb.win) + ' BB to ' + esc_(W.Discord) + (L && amt(L, pb.played) ? ', +' + amt(L, pb.played) + ' BB to ' + esc_(L.Discord) : '') + ' for playing' + tail + note + '.';
}
function itemBoard_(C) {
  const pt = players_(), inv = inventory_(C), p = itemPrices_(C), holders = [];
  pt.rows.forEach(function (x) { if (x.Status !== 'Active') return; const h = inv[lc_(x.Email)]; if (!h) return;
    const list = Object.keys(ITEMS).filter(function (k) { return h[k] > 0; }).map(function (k) { return { k: k, n: h[k] }; });
    if (list.length) holders.push({ name: norm_(x.Discord), club: norm_(x.Club), items: list, cool: !!itemCooling_(C, x.Email) }); });
  return { prices: p, aceX: aceX_(C), cooldown: Number(C.ITEM_COOLDOWN_HOURS) || 24, play: playBucks_(C), items: Object.keys(ITEMS).map(function (k) { return { k: k, icon: ITEMS[k].icon, name: ITEMS[k].name, kind: ITEMS[k].kind, what: ITEMS[k].what, price: p[k] }; }), holders: holders };
}
const SHOP_HELP_ = function (C) {
  const p = itemPrices_(C);
  return 'Spend Brawl Bucks on an item and hold it until you need it. The Ace pays ' + aceX_(C) + '× the price, so stock up on the way up.\n\n' +
    Object.keys(ITEMS).map(function (k) { return itemLabel_(k) + ' · ' + p[k] + ' BB: ' + ITEMS[k].what + '.'; }).join('\n') +
    '\n\nCharge items (Margin Eraser, Ladder Jumps, and at the Ace: Knockout Punch, Mulligan, Bounty Hunter): pick them on the charge form when you charge (you can buy on the spot there too). Brass Knuckles you hold also go on by themselves when someone charges you.\n' +
    'One item per side per charge, and one item per player every ' + (Number(C.ITEM_COOLDOWN_HOURS) || 24) + ' hours. Items used on a charge that gets voided come back.';
};
const USE_ITEM_CHOICES_ = ['No item', '🧽 Margin Eraser (win by any amount)', '🪜 Ladder Jump (charge one spot further)', '🪜 Ladder Jump+ (charge one spot further, any win)',
  '💥 Brass Knuckles: Knockout Punch (at the Ace: win by 4+ and they drop to the bottom)', '🔁 Mulligan (at the Ace: a loss doesn\'t count)', '💰 Bounty Hunter (at the Ace: take the hill, take 25% of the reign)'];
function shopChoices_(C) { const p = itemPrices_(C); return Object.keys(ITEMS).map(function (k) { return itemLabel_(k) + ' · ' + p[k] + ' BB (' + ITEMS[k].kind + ')'; }); }
// Adds the 🛒 shop section and the "use an item" question on the charge section. Safe to run again (it updates prices).
function ensureItemsForm_(form) {
  const C = cfg_();
  let pS = form.getItems(FormApp.ItemType.PAGE_BREAK).find(function (p) { return p.getTitle() === ACTIONS.SHOP; });
  if (!pS) {
    pS = form.addPageBreakItem().setTitle(ACTIONS.SHOP);
    pS.setGoToPage(FormApp.PageNavigationType.SUBMIT);
    form.addMultipleChoiceItem().setTitle(Q.ITEM).setChoiceValues(shopChoices_(C)).setRequired(true);
  }
  pS = pS.asPageBreakItem ? pS.asPageBreakItem() : pS; pS.setHelpText(SHOP_HELP_(C));
  const shopQ = form.getItems(FormApp.ItemType.MULTIPLE_CHOICE).find(function (i) { return i.getTitle() === Q.ITEM; });
  if (shopQ) shopQ.asMultipleChoiceItem().setChoiceValues(shopChoices_(C));
  // The charge section: "Use an item?" right after the opponent question.
  const all = form.getItems(), opp = all.find(function (i) { return i.getTitle() === Q.OPPONENT; });
  const useQ = all.find(function (i) { return i.getTitle() === Q.USE_ITEM; });
  if (useQ) useQ.asMultipleChoiceItem().setChoiceValues(USE_ITEM_CHOICES_);
  if (opp && !useQ) {
    const it = form.addMultipleChoiceItem().setTitle(Q.USE_ITEM).setChoiceValues(USE_ITEM_CHOICES_).setRequired(false)
      .setHelpText('Optional. Use one you bought in the 🛒 shop, or buy it right here (Margin Eraser ' + itemPrices_(C).eraser + ' BB, Ladder Jump ' + itemPrices_(C).jump + ' BB). Brass Knuckles are defense and go on by themselves.');
    form.moveItem(it.getIndex(), opp.getIndex() + 1);
  }
  try { form.setTitle('Hold the Hill · Master Form').setDescription(MASTER_DESC_); } catch (e) { }
  // Stake limits are a % of your bankroll now: refresh the stake boxes' help (and drop the old fixed wager cap).
  try { const pb = form.getItems(FormApp.ItemType.PAGE_BREAK).find(function (p) { return p.getTitle() === ACTIONS.BET; }); if (pb) pb.asPageBreakItem().setHelpText(BOOK_HELP); } catch (e) { }
  form.getItems(FormApp.ItemType.TEXT).forEach(function (it) {
    const t = it.getTitle();
    if (t === Q.W_STAKE) it.asTextItem().setHelpText('Up to ' + pctOf_(C.WAGER_MAX_PCT, 4.2) + '% of your Brawl Bucks (' + pctOf_(C.WAGER_BIG_PCT, 10) + '% with the commish\'s OK).')
      .setValidation(FormApp.createTextValidation().requireWholeNumber().setHelpText('A whole number of Brawl Bucks').build());
    if (t === Q.STAKE) it.asTextItem().setHelpText('Up to ' + pctOf_(C.BET_MAX_PCT, 4.2) + '% of your Brawl Bucks per bet.');
  });
  const action = form.getItems(FormApp.ItemType.MULTIPLE_CHOICE).find(function (i) { return i.getTitle() === Q.ACTION; });
  if (!action) return;
  const mc = action.asMultipleChoiceItem(), old = mc.getChoices();
  if (old.some(function (ch) { return ch.getValue() === ACTIONS.SHOP; })) return;
  const choices = old.map(function (ch) {
    const pg = ch.getGotoPage(); if (pg) return mc.createChoice(ch.getValue(), pg);
    const nav = ch.getPageNavigationType(); return mc.createChoice(ch.getValue(), nav || FormApp.PageNavigationType.CONTINUE);
  });
  choices.push(mc.createChoice(ACTIONS.SHOP, pS));
  mc.setChoices(choices);
}
function adminAddItems() {
  withUi_(function () {
    ensureSheets_(SpreadsheetApp.getActive());
    const C = cfg_();
    if (!/^true$/i.test(norm_(C.ITEMS_ON))) setCfg_('ITEMS_ON', 'TRUE');
    const form = FormApp.openById(cfg_().FORM_ID);
    ensureItemsForm_(form);
    ensureTidyForm_(form);
    return 'The 🛒 Brawl Bucks shop is on the form, and the charge section asks "' + Q.USE_ITEM + '". Prices are in Config (ITEM_PRICES, ITEM_ACE_X); the Items and Ledger tabs hold the records. Re-run this after changing prices.';
  });
}

// ───────────────────────────── 🔥 Hill streaks (Brawl Bucks for being active) ─────────────────────────────
// Once a day the Hill looks back at yesterday (Mountain time). Played a Hill game (a charge, a defense, a title
// fight or a revenge; a no-show doesn't count for the one who didn't show)? That's a day played: +day BB, plus
// a streak bonus that grows every day in a row (+step per day, up to max), plus milestone bonuses.
// Missed a day? The streak ends, unless you hold a 🌧️ Rain Delay (used up by itself) or you're the Ace: the Ace
// can't charge anybody, so the Ace's streak waits (no pay, no break) until someone charges.
function kv_(raw, base) { const out = Object.assign({}, base); norm_(raw).split(/[\s,]+/).forEach(function (x) { const m = /^(\w+):(\d+)$/.exec(x); if (m) out[m[1]] = Number(m[2]); }); return out; }
function streakCfg_(C) { return kv_(C.STREAK_BUCKS, { day: 15, step: 5, max: 40 }); }
function milestones_(C) { const m = kv_(C.STREAK_MILESTONES, {}), out = {}; Object.keys(m).forEach(function (k) { if (/^\d+$/.test(k)) out[Number(k)] = m[k]; }); return out; }
function streakPay_(C, n) {
  const S = streakCfg_(C), ms = milestones_(C);
  return { day: S.day, bonus: Math.min(S.max, S.step * Math.max(0, n - 1)), milestone: ms[n] || 0 };
}
function playedOn_(C, day) {
  const season = String(C.SEASON), out = {};
  readTable_(SHEETS.MATCHES).rows.forEach(function (m) {
    if (String(m.Season) !== season || !m.Date || denverDay_(new Date(m.Date)) !== day) return;
    out[lc_(acct_(m.WinnerEmail))] = true;
    if (lc_(m.Source) !== 'forfeit') out[lc_(acct_(m.LoserEmail))] = true;
  });
  return out;
}
function streakTable_(C) {
  const t = readTable_(SHEETS.STREAKS), by = {};
  t.rows.forEach(function (r) { if (String(r.Season) === String(C.SEASON)) by[lc_(r.Email)] = r; });
  return { t: t, by: by };
}
function streakDay_() {
  const C = cfg_();
  if (!itemsOn_(C)) return;
  const yesterday = denverDay_(new Date(now_().getTime() - 86400000));
  if (!C.STATE_LAST_STREAK_DAY) { setCfg_('STATE_LAST_STREAK_DAY', yesterday); return; }   // first run: count from today
  let last = String(C.STATE_LAST_STREAK_DAY), guard = 0;
  while (last < yesterday && guard++ < 7) {   // catch up a few missed days if the clock was down
    const d = new Date(Date.parse(last + 'T12:00:00Z') + 86400000), day = d.toISOString().slice(0, 10);
    const st = seasonStart_(C), end = seasonEnd_(C);
    if (!(st && day < denverDay_(st)) && !(end && day > denverDay_(end))) streakOne_(C, day);
    setCfg_('STATE_LAST_STREAK_DAY', day); last = day;
  }
}
function streakOne_(C, day) {
  // One streak per owner across both ladders: a Hill game or a Farm game that day both count.
  const ace = ace_(players_()), played = playedOn_(C, day), ST = streakTable_(C), inv = inventory_(C);
  if (farmReady_()) try { const fp = withLad_('farm', function () { return playedOn_(cfg_(), day); }); Object.keys(fp).forEach(function (k) { played[k] = true; }); } catch (e) { }
  const seen = {}, owners = ownerRows_().rows.filter(function (p) { const k = lc_(acct_(p.Email)); if (seen[k]) return false; seen[k] = true; return true; });
  const paid = [], ended = [], saved = [], waiting = [];
  owners.forEach(function (p) {
    if (p.Status !== 'Active') return;
    const e = lc_(p.Email); let r = ST.by[e];
    if (played[e]) {
      if (!r) { r = { Email: p.Email, Player: p.Discord, Streak: 0, Best: 0, LastPlayed: '', Season: C.SEASON }; ST.t.rows.push(r); ST.by[e] = r; }
      r.Streak = num_(r.Streak) + 1; r.Best = Math.max(num_(r.Best), r.Streak); r.LastPlayed = day; r.Player = p.Discord;
      const pay = streakPay_(C, r.Streak), tot = pay.day + pay.bonus + pay.milestone;
      ledger_(C, p, tot, 'Day played ' + day + ' (🔥 ' + r.Streak + (pay.milestone ? ', milestone' : '') + ')');
      paid.push({ p: p, n: r.Streak, tot: tot, ms: pay.milestone });
    } else if (r && num_(r.Streak) > 0) {
      if (ace && lc_(ace.Email) === lc_(p.Email)) waiting.push({ p: p, n: num_(r.Streak) });
      else if (holds_(inv, p.Email, 'rain') > 0) { itemRow_(C, p, 'rain', 'Used', '', '', 'Saved a ' + r.Streak + '-day streak on ' + day); saved.push({ p: p, n: num_(r.Streak) }); }
      else { ended.push({ p: p, n: num_(r.Streak) }); r.Streak = 0; }
    }
  });
  writeStreaks_(ST.t);
  if (!paid.length && !ended.length && !saved.length) return;
  paid.sort(function (a, b) { return b.n - a.n || b.tot - a.tot; });
  const L = ['🔥 **Hill streaks · ' + day + '**'];
  if (paid.length) L.push('💵 ' + paid.map(function (x) { return esc_(x.p.Discord) + ' +' + x.tot + (x.n > 1 ? ' (🔥' + x.n + ')' : '') + (x.ms ? ' 🏅' : ''); }).join(' · '));
  paid.filter(function (x) { return x.ms; }).forEach(function (x) { L.push('🏅 ' + tag_(x.p) + ' hits a **' + x.n + '-day streak**: +' + x.ms + ' BB bonus!'); });
  saved.forEach(function (x) { L.push('🌧️ Rain Delay! ' + esc_(x.p.Discord) + "'s " + x.n + '-day streak lives on.'); });
  waiting.forEach(function (x) { L.push('♠ ' + esc_(x.p.Discord) + "'s " + x.n + '-day streak waits on the mound (the Ace can\'t charge).'); });
  ended.forEach(function (x) { if (x.n >= 2) L.push('💔 ' + esc_(x.p.Discord) + "'s " + x.n + '-day streak is over.'); });
  const onLine = paid.filter(function (x) { return x.n >= 2; }).map(function (x) { return esc_(x.p.Discord) + ' (' + x.n + ')'; });
  if (onLine.length) L.push('-# On the line today: ' + onLine.join(', ') + '. Play a Hill game today to keep it going.');
  postBook_(L.join('\n'));
  log_('system', 'Streaks', day + ': ' + paid.length + ' paid, ' + ended.length + ' ended, ' + saved.length + ' saved');
}
function writeStreaks_(t) {
  t.rows.forEach(function (r) { if (r._row) writeRow_(t, r); else { appendObj_(SHEETS.STREAKS, r); } });
}
function streakBoard_(C) {
  const ST = streakTable_(C), pt = ownerRows_();
  const list = ST.t.rows.filter(function (r) { const p = findBy_(pt, r.Email); return String(r.Season) === String(C.SEASON) && p && p.Status === 'Active' && (num_(r.Streak) > 0 || num_(r.Best) > 1); })
    .map(function (r) { return { name: norm_(r.Player), n: num_(r.Streak), best: num_(r.Best), last: norm_(r.LastPlayed) }; })
    .sort(function (a, b) { return b.n - a.n || b.best - a.best; }).slice(0, 12);
  const S = streakCfg_(C);
  return { list: list, day: S.day, step: S.step, max: S.max, ms: milestones_(C) };
}

// ───────────────────────────── 🏟️ The Bleacher Vote (People's Choice) ─────────────────────────────
// The last VOTE_DAYS days of the season, every active Hill player gets one vote on the form for whoever made the
// season the most fun. No voting for yourself; voting again replaces your vote. The count stays secret until the
// season ends; ties go to whoever got there first.
function voteWindow_(C) {
  const end = seasonEnd_(C); if (!end) return null;
  return { open: new Date(end.getTime() - (Number(C.VOTE_DAYS) || 7) * 86400e3), close: end };
}
function voteNote_(C) {
  const w = voteWindow_(C); if (!w) return 'Voted by the players at the end of the season';
  const t = now_(), f = function (d) { return Utilities.formatDate(d, 'America/Denver', 'MMM d'); };
  if (t < w.open) return '🗳️ Voting opens ' + f(w.open);
  if (t < w.close) return '🗳️ Voting open · closes ' + f(w.close);
  return 'Votes are in';
}
function doVote_(sub, C) {
  const pt = players_(), me = ownerMe_(sub.email), w = voteWindow_(C), t = now_();
  if (!w) fail_('The Bleacher Vote opens near the end of the season.');
  if (t < w.open) fail_('The Bleacher Vote opens ' + Utilities.formatDate(w.open, 'America/Denver', 'EEE MMM d') + ' (the last ' + (Number(C.VOTE_DAYS) || 7) + ' days of the season).');
  if (t >= w.close) fail_('The Bleacher Vote is closed for this season.');
  const pick = norm_(sub.f[Q.VOTE]);
  const who = pt.rows.find(function (p) { return p.Status === 'Active' && (lc_(p.Discord) === lc_(pick) || lc_(voteLabel_(p)) === lc_(pick)); });
  if (!who) fail_('Pick a Hill player from the list.');
  if (who && lc_(acct_(who.Email)) === lc_(acct_(me.Email))) fail_("No voting for yourself. Pick whoever made this season the most fun.");
  appendObj_(SHEETS.VOTES, { Date: t, Season: C.SEASON, Email: me.Email, Voter: me.Discord, Pick: who.Discord, PickEmail: who.Email });
  log_(sub.email, 'Bleacher Vote', 'voted');
  post_('🏟️ ' + esc_(me.Discord) + ' cast a **Bleacher Vote**. Votes stay secret until the season wrap-up.', 'help');
}
const voteLabel_ = (p) => norm_(p.Discord) + ' · ' + norm_(p.Club);
function bleacherAward_(C, nm) {
  if (!seasonOver_(C)) return null;   // secret until the season ends
  const season = String(C.SEASON), last = {};
  readTable_(SHEETS.VOTES).rows.forEach(function (v) { if (String(v.Season) === season) last[lc_(v.Email)] = v; });   // latest vote per voter
  const tally = {}, reached = {};
  Object.keys(last).map(function (k) { return last[k]; }).sort(function (a, b) { return new Date(a.Date) - new Date(b.Date); }).forEach(function (v) {
    const e = lc_(v.PickEmail); tally[e] = (tally[e] || 0) + 1; reached[e + ':' + tally[e]] = new Date(v.Date).getTime();
  });
  const top = Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a] || reached[a + ':' + tally[a]] - reached[b + ':' + tally[b]]; })[0];
  const x = top ? nm(top) : null;
  return x ? Object.assign(x, { value: tally[top] + (tally[top] === 1 ? ' vote' : ' votes') }) : null;
}
function ensureVoteForm_(form) {
  let pV = form.getItems(FormApp.ItemType.PAGE_BREAK).find(function (p) { return p.getTitle() === ACTIONS.VOTE; });
  if (!pV) {
    pV = form.addPageBreakItem().setTitle(ACTIONS.VOTE);
    pV.setGoToPage(FormApp.PageNavigationType.SUBMIT);
    form.addListItem().setTitle(Q.VOTE).setChoiceValues(['(the player list fills in)']).setRequired(true);
  }
  pV = pV.asPageBreakItem ? pV.asPageBreakItem() : pV;
  pV.setHelpText('Season award, voted by the players: who made this season the most fun? Trash talk, big charges, good sport, whatever you liked. Open the last ' + (Number(cfg_().VOTE_DAYS) || 7) + ' days of the season. One vote each (voting again replaces it), not yourself. The count stays secret until the season wrap-up.');
  refreshVoteChoices_(form);
  const action = form.getItems(FormApp.ItemType.MULTIPLE_CHOICE).find(function (i) { return i.getTitle() === Q.ACTION; });
  if (!action) return;
  const mc = action.asMultipleChoiceItem(), old = mc.getChoices();
  if (old.some(function (ch) { return ch.getValue() === ACTIONS.VOTE; })) return;
  const choices = old.map(function (ch) {
    const pg = ch.getGotoPage(); if (pg) return mc.createChoice(ch.getValue(), pg);
    const nav = ch.getPageNavigationType(); return mc.createChoice(ch.getValue(), nav || FormApp.PageNavigationType.CONTINUE);
  });
  choices.push(mc.createChoice(ACTIONS.VOTE, pV));
  mc.setChoices(choices);
}
function refreshVoteChoices_(form) {
  const it = form.getItems(FormApp.ItemType.LIST).find(function (i) { return i.getTitle() === Q.VOTE; });
  if (!it) return;
  const names = players_().rows.filter(function (p) { return p.Status === 'Active'; }).map(voteLabel_).sort(function (a, b) { return a.localeCompare(b); });
  if (names.length) it.asListItem().setChoiceValues(names);
}
// 🌱 Adds the Farm tabs, the "Which ladder?" question on the Register page, and the Farm clubs in the Opponent list.
function ensureFarmForm_(form) {
  let q = form.getItems(FormApp.ItemType.MULTIPLE_CHOICE).find(function (i) { return i.getTitle() === Q.LADDER; });
  if (!q) {
    q = form.addMultipleChoiceItem().setTitle(Q.LADDER);
    const after = form.getItems().find(function (i) { return i.getTitle() === Q.CLUB_ID; });
    if (after) form.moveItem(q.getIndex(), after.getIndex() + 1);
  }
  const mc = q.asMultipleChoiceItem ? q.asMultipleChoiceItem() : q;
  mc.setChoiceValues(LADDER_CHOICES).setRequired(false)
    .setHelpText('Hold the Hill is for clubs above ' + farmMax_(cfg_()) + '★; the 🌱 Farm Hill is for clubs at ' + farmMax_(cfg_()) + '★ and under (the star rating on the club page, checked when you sign up, so a smaller club lands on the Farm by itself). One Hold the Hill club per owner; on the Farm, put in as many young clubs as you like (one sign-up each). One Brawl Bucks wallet.');
  const cid = form.getItems().find(function (i) { return i.getTitle() === Q.CLUB_ID; });
  if (cid) try { cid.setHelpText('One Hold the Hill club per owner. On the 🌱 Farm Hill you can register as many young clubs as you like (one form per club).'); } catch (e) { }
  if (!form.getItems().some(function (i) { return i.getTitle() === Q.MY_CLUB; })) {
    const mc2 = form.addTextItem().setTitle(Q.MY_CLUB).setRequired(false)
      .setHelpText('Only for the 🌱 Farm Hill, and only if you have more than one Farm club: the club ID you are charging (or reporting) with. Leave it blank otherwise.');
    const opp = form.getItems().find(function (i) { return i.getTitle() === Q.OPPONENT; });
    if (opp) form.moveItem(mc2.getIndex(), opp.getIndex() + 1);
  }
}
function adminSetupFarm() {
  withUi_(function () {
    const ss = SpreadsheetApp.getActive();
    ensureSheets_(ss);
    withLad_('farm', function () { ensureSheets_(ss); });
    const C = cfg_();
    if (C.FORM_ID) { const form = FormApp.openById(C.FORM_ID); ensureFarmForm_(form); }
    refreshFormChoices();
    snapshotBoard_();
    return '🌱 The Farm Hill is set up: Farm tabs in the Sheet, "Which ladder?" on the Register page of the Master Form, and Farm clubs in the Opponent list as they sign up. Clubs at ' + (farmMax_(C)) + '★ or under can join; the first one in holds the Farm mound.';
  });
}
// 🌱 Moves every Hold the Hill club at or under the Farm line down to the Farm (skips clubs in an open charge).
// Order is kept: the highest-ranked mover is placed first; on an empty Farm the first one holds the Farm mound.
function moveDownToFarm_() {
  const C = cfg_(), max = farmMax_(C), moved = [], skipped = [];
  if (!farmReady_()) fail_('Set up the Farm Hill first (🌱 Set up the Farm Hill).');
  const pt = players_(), ct = challenges_(), ace = ace_(pt);
  const cand = (ace ? [ace] : []).concat(ladder_(pt)).filter(function (p) { return p.Status === 'Active' && norm_(p.ClubID); });
  cand.forEach(function (p) {
    const st = clubStars_(norm_(p.ClubID)); if (!st || st.stars > max) return;
    if (openFor_(ct, p.Email)) { skipped.push(p.Discord + ' (in an open charge)'); return; }
    const fkey = farmKey_(p.Email, p.ClubID), onFarm = withLad_('farm', function () { return findBy_(players_(), fkey); });
    // off the Hill
    const pt2 = players_(), me = findBy_(pt2, p.Email), wasAce = ace_(pt2) === me;
    if (wasAce) endReign_('Moved to the Farm');
    const pt3 = players_(), m3 = findBy_(pt3, p.Email), oldRank = wasAce ? 'the Ace' : '#' + m3.Rank;
    m3.Status = 'Moved to Farm'; m3.Rank = '';
    setLadder_(ladder_(pt3)); savePlayers_(pt3);
    // onto the Farm
    withLad_('farm', function () {
      const sp = PropertiesService.getScriptProperties(), fm = farmStarsMap_(); fm[norm_(p.ClubID)] = st.stars; sp.setProperty('FARM_STARS', JSON.stringify(fm));
      const fpt = players_(), empty = !ace_(fpt) && !ladder_(fpt).length, rank = empty ? 0 : ladder_(fpt).length + 1;
      const row = { Email: fkey, Discord: p.Discord, DiscordID: p.DiscordID, OwnerID: p.OwnerID, Club: p.Club, ClubID: p.ClubID, Status: 'Active', Rank: rank, Joined: now_(), Wins: 0, Losses: 0, CareerPts: 0, Defenses: 0, Reigns: 0, BestReignPts: 0 };
      if (onFarm) { Object.assign(onFarm, row); writeRow_(fpt, onFarm); } else appendObj_(SHEETS.PLAYERS, row);
      trackClimb_([row]);
      if (empty) { const f2 = players_(), m = findBy_(f2, fkey); startReign_(m, false, cfg_()); savePlayers_(f2); setCfg_('STATE_LAST_TITLE_ACTIVITY', now_().toISOString()); }
      post_('⬇️ ' + who_(row) + ' (' + st.stars + '★) moves from Hold the Hill (' + oldRank + ') to the Farm Hill, the ladder for clubs at ' + max + '★ and under' + (empty ? ', and as the first club down **holds the Farm mound**: the first 🐕 Farm Dog.' : ', starting at **#' + rank + '**.') + ' Grow past ' + max + '★ and you get called back up.');
    });
    log_('commish', 'Moved to Farm', p.Discord + ' (' + st.stars + '★) from ' + oldRank);
    moved.push(p.Discord + ' (' + st.stars + '★, was ' + oldRank + ')');
  });
  if (moved.length) { refreshFormChoices(); snapshotBoard_(); }
  return { moved: moved, skipped: skipped };
}
function adminMoveDownToFarm() {
  withUi_(function () {
    if (Number(cfg_().FARM_MAX_STARS) > 10) setCfg_('FARM_MAX_STARS', 6);
    const r = moveDownToFarm_();
    return (r.moved.length ? '🌱 Moved to the Farm: ' + r.moved.join(', ') + '.' : 'No Hold the Hill club is at ' + farmMax_(cfg_()) + '★ or under.') + (r.skipped.length ? ' Skipped: ' + r.skipped.join(', ') + '.' : '');
  });
}
function adminAddVote() {
  withUi_(function () {
    ensureSheets_(SpreadsheetApp.getActive());
    const form = FormApp.openById(cfg_().FORM_ID);
    ensureVoteForm_(form);
    ensureTidyForm_(form);
    const w = voteWindow_(cfg_());
    return '🏟️ The Bleacher Vote is on the form.' + (w ? ' Voting is open ' + Utilities.formatDate(w.open, 'America/Denver', 'MMM d') + ' to ' + Utilities.formatDate(w.close, 'America/Denver', 'MMM d') + '; votes before that get a polite ❌.' : '');
  });
}

// ───────────────────────────── Hourly deadline check ─────────────────────────────

function hourlyTick() {
  try { prefillInfo_(cfg_()); } catch (e) { }   // outside the lock: works out the pre-filled charge link once
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { eachLad_(payday_); try { streakDay_(); } catch (e) { log_('system', 'ERROR (streaks)', String(e && e.stack || e)); } eachLad_(tick_); try { if (farmReady_()) withLad_('farm', farmCallUps_); } catch (e) { log_('system', 'ERROR (call-ups)', String(e && e.stack || e)); } seasonTick_(); futuresTick_(); starsDaily_(); potExpire_(); potTick_(); oddsBoardTick_(); nudgeTick_(); }
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

  // 🔔 The Bell
  try { bellTick_(cfg_()); } catch (e) { log_('system', 'Bell error', String(e && e.message || e)); }

  // Open mound: announce each time it opens one more spot
  C = cfg_();
  const pt0 = players_();
  if (!isFarm_() && ace_(pt0) && seasonOpen_(C) && !seasonOver_(C) && !C.STATE_REVENGE_EX_ACE) {
    const to = moundOpenTo_(C);
    const was = Number(C.STATE_MOUND_OPEN_TO || 1);
    const titleOpen = challenges_().rows.some(function (c) { return c.Type !== 'Ladder' && OPEN.indexOf(c.Status) >= 0; });
    if (to !== was) {
      setCfg_('STATE_MOUND_OPEN_TO', to);
      if (to > was && !titleOpen) {
        const lad = ladder_(pt0);
        const who = lad.filter(function (p) { return Number(p.Rank) <= to; }).map(function (p) { return tag_(p); }).join(', ');
        const hrs = Math.round((now_() - lastTitle_(C)) / 3600000);
        post_('⏰ **The mound is open to #1–#' + to + '.** Nobody has charged the Ace in ' + (hrs < 48 ? hrs + ' hours' : Math.floor(hrs / 24) + ' days') +
          '. ' + who + ': any of you can charge the hill. Any win takes it. ' + moundNext_(C));
      }
    }
  }
}

// ───────────────────────────── Commish tools ─────────────────────────────

function crownAce_(email, actor, note) {
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
  post_((note ? note(p) : '👑 ' + who_(p) + ' is crowned **the Ace**. The hill is theirs to hold.') + '\n\n' + standingsText_());
}

// 🐕 An empty doghouse fills itself: when the Farm has no Farm Dog, Farm #1 moves in (once they have no open charge).
function farmDogAuto_() {
  if (!isFarm_()) return;
  const pt = players_(); if (ace_(pt)) return;
  const top = ladder_(pt)[0]; if (!top) return;
  if (openFor_(challenges_(), top.Email)) return;
  crownAce_(top.Email, 'auto (empty doghouse)', function (p) { return '🐕 **NEW FARM DOG!** The doghouse was empty, so Farm #1 ' + who_(p) + ' moves in. Anyone on the Farm can charge the Farm Dog, any time. Come take it.'; });
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
  lock.waitLock(150000);   // the 1-minute check can take a while; wait for it instead of failing
  try { const msg = fn(); if (msg) ui.alert(msg); }
  catch (err) { ui.alert(err instanceof HillError ? err.message : 'Error: ' + err); }
  finally { lock.releaseLock(); }
}

function adminCrownAce() {
  withUi_(function () {
    if (SpreadsheetApp.getActiveSheet().getName() === 'Farm Players') return withLad_('farm', function () {
      const row = SpreadsheetApp.getActiveSheet().getActiveRange().getRow();
      const p = players_().rows.find(function (r) { return r._row === row; });
      if (!p) fail_('No player on that row.');
      crownAce_(p.Email, Session.getActiveUser().getEmail());
      return p.Discord + ' is now the 🐕 Farm Dog.';
    });
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
    .addItem('🎛️ Commish dashboard', 'adminDashboard')
    .addSeparator()
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
    .addItem('🏁 Fresh start (both ladders + Brawl Bucks, tournament champ = Ace)', 'adminFreshStart')
    .addItem('Update the odds now (matchups, daily book, Ace futures)', 'adminRunFutures')
    .addItem('🌙 Post today\'s board to the sportsbook', 'adminPostDayBoard')
    .addItem('Post the odds board to the sportsbook channel', 'adminPostOdds')
    .addSeparator()
    .addItem('Close the season now (posts awards)', 'adminCloseSeason')
    .addItem('Start the next season', 'adminStartNextSeason')
    .addSeparator()
    .addItem('Update the HtH Leaderboard now', 'adminRefreshBoard')
    .addItem('Run deadline check now', 'hourlyTick')
    .addItem('Refresh form opponent list', 'refreshFormChoices')
    .addItem('🔎 Add "Who can I charge?" to the form', 'adminAddReach')
    .addItem('🤝 Add head-to-head wagers to the form', 'adminAddWagers')
    .addItem('🛒 Add the Brawl Bucks items shop to the form', 'adminAddItems')
    .addItem('🤝 Allow a big wager (commish OK, up to 10%)', 'adminBigWager')
    .addItem('🏟️ Add the Bleacher Vote to the form', 'adminAddVote')
    .addItem('🌱 Set up the Farm Hill', 'adminSetupFarm')
    .addItem('⬇️ Move 6★-and-under clubs to the Farm', 'adminMoveDownToFarm')
    .addItem('🔑 Connect SmallBall (star ratings)', 'adminConnectSmallBall')
    .addItem('🥊 Tidy up the form (emoji labels, Charge first)', 'adminTidyForm')
    .addItem('🐙 Connect the GitHub HtH Leaderboard', 'adminConnectGithub')
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
    if (isFarm_() && !PER_LAD_[name]) return;
    let sh = ss.getSheetByName(ladTab_(name));
    if (!sh) sh = ss.insertSheet(ladTab_(name));
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
  if (isFarm_()) return;
  const t = readTable_(SHEETS.CONFIG);
  Object.keys(DEFAULTS).forEach(function (k) {
    if (!t.rows.some(function (r) { return r.Key === k; })) {
      appendObj_(SHEETS.CONFIG, { Key: k, Value: DEFAULTS[k][0], Notes: DEFAULTS[k][1] });
    }
  });
}

const MASTER_DESC_ = '📝 The Master Form: the one form for everything on Hold the Hill, the SmallBall ladder where the Ace holds the mound. Sign up, charge, report a game, bet, wager, shop and vote, all right here.\n' +
    'Pick what you want to do, fill in that one section, and submit. If it checks out, it posts in Discord. ' +
    'If not, you get an email explaining why.';
function buildForm_(ss) {
  const form = FormApp.create('Hold the Hill · Master Form');
  form.setDescription(MASTER_DESC_);
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
    .setHelpText('Charge anyone up to 3 spots above you. 1 spot up: just win. 2 spots up: win by 3+. 3 spots up: win by 4+. Only #1 can charge THE ACE at first; if nobody does, #2 joins after 8 hours, then one more spot each day, down to #5 (never overnight). Any win takes the mound. One open challenge at a time. No accepting needed: once you declare it, you start the game in SmallBall as the visitor and report the game ID and score. The defender only reports to dispute.');
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
// The Master Form's pre-filled charge link: the "entry.N" names of the action and opponent questions, worked out
// once per form (cached) so the Club Kit and the leaderboard can open the form with a charge already filled in.
function prefillCached_(C) {   // the snapshot only ever reads the cache (never opens the form while holding the lock)
  try { const c = JSON.parse(PropertiesService.getScriptProperties().getProperty('PREFILL_INFO') || 'null'); if (c && c.v === 2 && c.formId === norm_(C.FORM_ID)) return c.info; } catch (e) { }
  return null;
}
function prefillInfo_(C) {
  const props = PropertiesService.getScriptProperties(), cached = prefillCached_(C);
  if (cached) return cached;
  try {
    const form = FormApp.openById(C.FORM_ID), items = form.getItems();
    const act = items.find(function (i) { return i.getTitle() === Q.ACTION; }), opp = items.find(function (i) { return i.getTitle() === Q.OPPONENT; });
    if (!act || !opp) return null;
    const mc = items.find(function (i) { return i.getTitle() === Q.MY_CLUB; });
    let rs = form.createResponse()
      .withItemResponse(act.asMultipleChoiceItem().createResponse(ACTIONS.CHALLENGE))
      .withItemResponse(opp.asListItem().createResponse(ACE_CHOICE));
    if (mc) rs = rs.withItemResponse(mc.asTextItem().createResponse('424242'));
    const url = rs.toPrefilledUrl();
    const ent = {};
    url.replace(/entry\.(\d+)=([^&]*)/g, function (m, id, v) { ent[decodeURIComponent(v.replace(/\+/g, ' '))] = 'entry.' + id; return m; });
    const info = { url: url.split('?')[0], action: ent[ACTIONS.CHALLENGE] || '', charge: ACTIONS.CHALLENGE, opp: ent[ACE_CHOICE] || '', ace: ACE_CHOICE, club: ent['424242'] || '', farmAce: FARM_ACE_CHOICE };
    if (!info.action || !info.opp) return null;
    props.setProperty('PREFILL_INFO', JSON.stringify({ v: 2, formId: norm_(C.FORM_ID), info: info }));
    return info;
  } catch (e) { return null; }
}
function oppLabel_(p) { return (isFarm_() ? '🌱 ' : '') + '#' + p.Rank + ' · ' + norm_(p.Discord) + ' · ' + norm_(p.Club) + (norm_(p.ClubID) ? ' · club ID ' + norm_(p.ClubID) : ''); }

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
  let farm = [];
  try { if (farmReady_()) farm = withLad_('farm', function () { const pt = players_(); return (ace_(pt) ? [FARM_ACE_CHOICE] : []).concat(pt.rows.filter(function (p) { return p.Status === 'Active' && hasRank_(p) && Number(p.Rank) > 0; }).sort(function (a, b) { return Number(a.Rank) - Number(b.Rank); }).map(function (p) { return oppLabel_(p); })); }); } catch (e) { farm = []; }
  item.asListItem().setChoiceValues([ACE_CHOICE].concat(names, farm));
  try { refreshVoteChoices_(form); } catch (e) { }
  try { item.setHelpText('Each club shows its ladder spot and SmallBall club ID. After you charge, start a BigLeague game in SmallBall against that club ID, as the visitor, within the hour. The Hill finds the game by itself.'); } catch (e) { }
  const bi = form.getItems(FormApp.ItemType.LIST).find(function (i) { return i.getTitle() === Q.BET; });
  if (bi) {
    let opts = [];
    try { openLines_().forEach(function (L) { opts = opts.concat(betChoices_(L).map(function (o) { return o.label; })); }); } catch (e) { opts = []; }
    try { const C1 = cfg_(); if (seasonOpen_(C1)) potCurrent_().forEach(function (L) { opts = opts.concat(potChoices_(L).map(function (o) { return o.label; })); }); } catch (e) { }
    try { const C0 = cfg_(); if (seasonOpen_(C0) && !seasonOver_(C0)) opts = opts.concat(futChoices_().map(function (o) { return o.label; })); } catch (e) { }
    try { const C2 = cfg_(); if (bookOn_(C2) && seasonOpen_(C2) && !seasonOver_(C2)) opts = opts.concat(dayChoices_(dayBook_(), C2).map(function (o) { return o.label; })); } catch (e) { }
    bi.asListItem().setChoiceValues(opts.length ? opts : [NO_LINES]);
  }
}

// ───────────────────────────── 🎰 Hill Sportsbook (play money: Brawl Bucks) ─────────────────────────────
// Every charge gets a line: moneyline, run line (±1.5) and an over/under. Players bet Brawl Bucks on the form.
// Betting closes BOOK_WINDOW_MIN after the charge or as soon as the game is reported, whichever is first.
// Players in the game may only bet on themselves (moneyline or run line), never against themselves or on the total.
// Odds come only from Hill results this season (runs scored and allowed), pulled toward an average club early on.

function bookOn_(C) { return !isFarm_() && lc_(C.BOOK_ON) !== 'false'; }   // no sportsbook on the Farm (yet)
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
  return '\n🎰 **The line:** ' + esc_(L.Away) + ' ' + fmtOdds_(L.AwayML) + ' · ' + esc_(L.Home) + ' ' + fmtOdds_(L.HomeML) + '.' + (new Date(L.Closes) > now_() ? ' Betting closes ' + rel_(L.Closes) + '.' : ' 🔒 Betting is locked: matchup bets made before the charge ride on this game.');
}
function openLine_(c, ch, df, C) {
  if (!bookOn_(C)) return '';
  try { const L = makeLine_(c, ch, df, C); const pr = propsOpen_(c, ch, df, C); refreshFormChoices(); return lineText_(L) + pr; }
  catch (e) { log_('system', 'Book line error', String(e)); return ''; }
}

// The bet choices on the form: one per side of every open market.
function betChoices_(L) {
  const fav = L.Fav === 'away' ? L.Away : L.Home, dog = L.Fav === 'away' ? L.Home : L.Away;
  const favSide = L.Fav, dogSide = L.Fav === 'away' ? 'home' : 'away';
  const id = L.ChallengeID;
  // Simple: moneyline only, plus ⚾ player props when SmallBall box scores are connected.
  return [
    { label: id + ' · ' + L.Away + ' to win (' + fmtOdds_(L.AwayML) + ')', market: 'ML', pick: 'away', odds: L.AwayML },
    { label: id + ' · ' + L.Home + ' to win (' + fmtOdds_(L.HomeML) + ')', market: 'ML', pick: 'home', odds: L.HomeML },
  ].concat(propsFor_(id).map(function (p) { return { label: id + ' · ' + p.label + ' (' + fmtOdds_(p.odds) + ')', market: 'PROP', pick: p.k, odds: p.odds }; }));
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
  const me = ownerMe_(sub.email);
  const label = norm_(sub.f[Q.BET]);
  const stake = Math.floor(Number(norm_(sub.f[Q.STAKE]).replace(/[^\d]/g, '')));
  if (stake >= 1) { const cap = betCap_(C, me.Email); if (stake > cap) fail_('The most you can bet right now is **' + cap + ' BB** (' + pctOf_(C.BET_MAX_PCT, 4.2) + '% of your Brawl Bucks, ' + flat_(C) + ' BB max). Bet that or less.'); }
  if (/^🔮 /.test(label)) {
    if (doPotBet_(sub, C, me, label, stake)) return;
    fail_('Those matchup odds have moved since you loaded the form. Reload it and pick again.');
  }
  if (doDayBet_(sub, C, me, label, stake)) return;
  let pick = null, L = null;
  readTable_(SHEETS.LINES).rows.forEach(function (x) {
    betChoices_(x).forEach(function (o) { if (o.label === label) { pick = o; L = x; } });
  });
  if (!pick && /^♠️ FUTURES/.test(label)) {
    lockIfOver_(C);
    const f = futChoices_().find(function (o) { return o.label === label; });
    if (!f) fail_('Those futures odds have moved since you loaded the form. Reload it and pick again.');
    if (f.pick === lc_(me.Email)) fail_('Futures: No betting on yourself or your own games: that’s what 🤝 head-to-head wagers are for.');
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
  if (mine) fail_("You're in this game. No betting on yourself or your own games: that's what 🤝 head-to-head wagers are for.");
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
// 💰 Brawl Bucks wallets for the HtH Leaderboard: everyone's balance, 🔥 streak and items held. Public on purpose; no
// emails and no bet-by-bet history.
function walletBoard_(C) {
  const pt = players_(), br = bankrolls_(C), inv = itemsOn_(C) ? inventory_(C) : {}, ST = itemsOn_(C) ? streakTable_(C).by : {};
  const ace = ace_(pt), seen = {};
  // every owner with a wallet: Hill clubs first, then owners who are only on the 🌱 Farm
  return ownerRows_().rows.filter(function (p) { const k = lc_(acct_(p.Email)); if (seen[k]) return false; seen[k] = 1; return true; }).map(function (p) {
    const e = lc_(p.Email), h = inv[e] || {}, r = ST[e];
    const items = Object.keys(ITEMS).filter(function (k) { return h[k] > 0; }).map(function (k) { return ITEMS[k].icon + (h[k] > 1 ? '×' + h[k] : ''); });
    return { name: norm_(p.Discord), club: norm_(p.Club) + (p._lad === 'farm' ? ' 🌱' : ''), bank: e in br.bank ? br.bank[e] : br.base, streak: r ? num_(r.Streak) : 0, best: r ? num_(r.Best) : 0, items: items, cool: itemsOn_(C) && !!itemCooling_(C, p.Email), ace: p === ace };
  }).sort(function (a, b) { return b.bank - a.bank; });
}
function bookBoard_(C) {
  const season = String(C.SEASON);
  const lines = {}; readTable_(SHEETS.LINES).rows.forEach(function (L) { lines[L.ChallengeID] = L; });
  const desc = function (b) {
    if (b.Market === 'PML') { const ps = {}; players_().rows.forEach(function (p) { ps[lc_(p.Email)] = norm_(p.Discord); }); const m = /^POT:(.+)>(.+)$/.exec(b.ChallengeID) || []; return '🔮 ' + (ps[m[1]] || '?') + ' @ ' + (ps[m[2]] || '?') + ': ' + (b.Pick === 'away' ? ps[m[1]] : ps[m[2]]) + ' wins'; }
    if (b.Market === 'DACE') { const nm = {}; ownerRows_().rows.forEach(function (p) { nm[lc_(acct_(p.Email))] = norm_(p.Discord); }); return '🌙 ' + (b.Pick === 'field' ? 'Anyone else' : (nm[lc_(b.Pick)] || '?')) + ' is the Ace at midnight'; }
    if (b.Market === 'DPROP') { const k = String(b.Pick).split(':'), pq = DAY_PROPS.find(function (x) { return x.key === k[0]; }); return '🎲 ' + (pq ? pq.q : k[0]) + ': ' + String(k[1] || '').toUpperCase(); }
    const L = lines[b.ChallengeID]; if (b.Market === 'FUT') return 'Season Ace futures: ' + b.Bettor; if (!L) return b.ChallengeID;
    const side = b.Pick === 'away' ? L.Away : b.Pick === 'home' ? L.Home : '';
    const sign = b.Pick === L.Fav ? '−1.5' : '+1.5';
    if (b.Market === 'PML') { const m = /^POT:(.+)>(.+)$/.exec(b.ChallengeID) || []; return '🔮 ' + (b.Pick === 'away' ? 'challenger' : 'defender') + ' wins'; }
    if (b.Market === 'FUT') return b.Bettor + ' finishes as the Ace';
    if (b.Market === 'PROP') { const pp = propsFor_(b.ChallengeID).find(function (x) { return x.k === b.Pick; }); return pp ? pp.label : 'Player prop'; }
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
    if (!isVoid) try { propsSettle_(c, bt, open); } catch (e) { log_('system', 'Props settle error', String(e)); }
    open.forEach(function (b) {
      if (b.Market === 'PROP' && b.Status !== 'Open') { if (b.Status === 'Won' && (!best || b.Profit > best.Profit)) best = b; return; }
      const stake = num_(b.Stake);
      let res;
      if (isVoid) res = 'Void';
      else if (b.Market === 'ML') res = ar === hr ? 'Push' : ((ar > hr) === (b.Pick === 'away') ? 'Won' : 'Lost');
      else if (b.Market === 'PROP') res = 'Void';
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
    let chP = null, dfP = null; try { const pt2 = players_(); chP = findBy_(pt2, c.Challenger); dfP = findBy_(pt2, c.Defender); } catch (e) { }
    post_('📡 **Game found**' + (c.Type === 'Title' ? ' · ♠️ title fight' : '') + '\n> ⚾ ' + (chP ? line_(chP, false) : '**' + esc_(c.ChallengerName) + '**') + '\n> ⚾ ' + (dfP ? line_(dfP, false) : '**' + esc_(c.DefenderName) + '**') +
      '\n📺 [Watch it live](<https://play.smallball.com/training?watch=' + g.game_id + '>)\n🏁 Game\'s over ' + ts_(airs) + '. The result posts then (no spoilers).');
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


// ───────────────────────────── 🏁 Fresh start (after a tournament) ─────────────────────────────
// Both ladders and every wallet start over: all charges, results, reigns, payouts, bets, lines, wagers, items,
// streaks, votes and the Log are erased; every club goes back to 0-0, ranked by sign-up order (first in = #1).
// Then the tournament champion's owner is crowned the Ace: their club on the Hill (the champion club itself if
// it's there, else that owner's first-signed-up Hill club); if they're only on the Farm Hill, they're the Farm Dog.
// 🎉 One-off: the Opening Day post for the Hill feed (run from the editor after 🏁 Fresh start). Names in bold, no pings.
function postOpeningDay() {
  const C = cfg_(), pt = players_(), A = ace_(pt), lad = ladder_(pt);
  const line = (p) => '**@' + esc_(p.Discord) + '** · **' + esc_(p.Club) + '** · ' + norm_(p.ClubID);
  let farm = [];
  try { if (farmReady_()) farm = withLad_('farm', function () { const fp = players_(); const fa = ace_(fp); return (fa ? [fa] : []).concat(ladder_(fp)); }); } catch (e) { }
  const board = norm_(C.BOARD_LINK) || 'https://slipnsliders.github.io/smallball-tools/hill/', form = norm_(C.FORM_LINK);
  const msg = '# 🎉 OPENING DAY · Hold the Hill Season ' + norm_(C.SEASON) + ' is LIVE!\n' +
    'Fresh season, clean slate: every record is **0-0**, every wallet holds **' + (Number(C.BOOK_BANKROLL) || 1000).toLocaleString() + ' Brawl Bucks**, and the hill is up for grabs.\n\n' +
    '**♠ On the mound**\n> ' + (A ? line(A) : 'Nobody yet: the hill is open!') + '\n\n' +
    '**⛰️ The Climb**\n' + lad.map(function (p) { return '> #' + p.Rank + ' ' + line(p); }).join('\n') + '\n\n' +
    (farm.length ? '**🌱 The Farm**\n' + farm.map(function (p) { return '> ' + (Number(p.Rank) === 0 ? '♠ ' : '#' + p.Rank + ' ') + line(p); }).join('\n') + '\n\n' : '') +
    '## ⚾ Come charge the mound!\n' +
    '> Charge up to **' + (Number(C.CHALLENGE_REACH) || 3) + ' spots** above you. Win and you take their spot; beat the Ace and the hill is yours.\n' +
    '> Every Hill game pays Brawl Bucks, and a 🔥 daily streak pays more. Bet the 🎰 Sportsbook and 🤝 wager head-to-head (up to ' + pctOf_(C.BET_MAX_PCT, 4.2) + '% of your Brawl Bucks).\n' +
    (form ? '📝 [Charge on the Master Form](<' + form + '>)\n' : '') +
    '📊 [Live HtH Leaderboard](<' + board + '>): the Opening Day party runs all day 🎆';
  post_(msg);
}

function adminFreshStart() {
  const ui = SpreadsheetApp.getUi();
  const ans = ui.prompt('🏁 Fresh start',
    'This erases EVERYTHING on both ladders (⛰️ Hold the Hill and 🌱 Farm Hill): charges, results, reigns, payouts, bets, lines, wagers, items, streaks, votes, every Brawl Bucks wallet and the Log. Every club goes back to 0-0, ranked by sign-up order.\n' +
    'Kept: who signed up (Players tabs), Stars and Config.\n\nType RESET and the tournament champion\'s club ID (example: RESET 189501). Their owner starts as the Ace if they\'re on the Hill. Just RESET = no Ace.', ui.ButtonSet.OK_CANCEL);
  const txt = norm_(ans.getResponseText());
  if (ans.getSelectedButton() !== ui.Button.OK || !/^RESET\b/.test(txt)) { ui.alert('Nothing was changed.'); return; }
  const champId = (txt.match(/\d{2,}/) || [''])[0];
  // Who owns the champion club (SmallBall owner name), for matching their Hill club.
  let champOwner = '';
  if (champId) { const sp = PropertiesService.getScriptProperties(), ck = sp.getProperty('SB_COOKIE');
    try { const r = UrlFetchApp.fetch('https://play.smallball.com/teams/' + champId + '/profile', { muteHttpExceptions: true, headers: Object.assign({ Accept: 'application/json' }, ck ? { Cookie: ck } : {}) });
      if (r.getResponseCode() === 200) champOwner = lc_(JSON.parse(r.getContentText()).owner_nick); } catch (e) { } }
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  let kept = {}, ace = null;
  try {
    const ss = SpreadsheetApp.getActive();
    const wipe = (n) => { const sh = ss.getSheetByName(n); if (!sh) return; const last = sh.getLastRow(); if (last > 1) sh.deleteRows(2, last - 1); };
    [SHEETS.LINES, SHEETS.BETS, SHEETS.LOG, SHEETS.WAGERS, SHEETS.LEDGER, SHEETS.ITEMS, SHEETS.VOTES, SHEETS.STREAKS].forEach(wipe);
    const board = ss.getSheetByName(BOARD_TAB); if (board) board.getRange('A1').setValue('{}');
    LADS_.forEach(function (l) {
      if (l === 'farm' && !farmReady_()) return;
      withLad_(l, function () {
        [SHEETS.CHALLENGES, SHEETS.MATCHES, SHEETS.REIGNS, SHEETS.PAYOUTS].forEach(function (n) { wipe(ladTab_(n)); });
        const pt = players_();
        // A club that moved ladders stays where it went: 'Moved to Farm' rows sit out the Hill, 'Called up' rows sit out the Farm.
        const bottom = norm_(cfg_().BOTTOM_CLUBS).split(/[\s,]+/).filter(String), low = function (p) { return bottom.indexOf(norm_(p.ClubID)) >= 0 ? 1 : 0; };
        const keep = pt.rows.filter(function (p) { return p.Status !== 'Removed' && p.Status !== 'Moved to Farm' && p.Status !== 'Called up'; })
          .sort(function (a, b) { return (low(a) - low(b)) || (new Date(a.Joined) - new Date(b.Joined)); });   // BOTTOM_CLUBS last, then sign-up order
        keep.forEach(function (p, i) { p.Status = 'Active'; p.Rank = i + 1; p.Wins = 0; p.Losses = 0; p.CareerPts = 0; p.Defenses = 0; p.Reigns = 0; p.BestReignPts = 0; writeRow_(pt, p); });
        Object.keys(DEFAULTS).forEach(function (k) { if (/^STATE_/.test(k)) setCfg_(k, ''); });
        kept[l || 'hill'] = keep.length;
        if (!ace && (champId || champOwner)) {
          const mine = keep.filter(function (p) { return norm_(p.ClubID) === champId || (champOwner && lc_(p.OwnerID) === champOwner); });
          const pick = mine.find(function (p) { return norm_(p.ClubID) === champId; }) || mine[0];
          if (pick) ace = { lad: l, email: pick.Email, name: pick.Discord, club: pick.Club };
        }
      });
    });
    const props = PropertiesService.getScriptProperties();
    ['NUDGED', 'NUDGE_SLOT', 'POST_QUEUE', 'LOG_QUEUE', 'FUTURES', 'FUT_DAY', 'FUT_POSTED', 'POT_LINES', 'ODDS_AT', 'ODDS_SIG', 'ODDS_DAY', 'BOOK_SIG', 'STARS_DAY', 'HILL_REST', 'FARM_REST', 'BIG_WAGER_OK']
      .forEach(function (k) { props.deleteProperty(k); });
    Object.keys(props.getProperties()).forEach(function (k) { if (/^CLIMB_[SF]/.test(k)) props.deleteProperty(k); });
    LADS_.forEach(function (l) { if (l === 'farm' && !farmReady_()) return; withLad_(l, function () { trackClimb_(players_().rows); }); });
    props.setProperty('OPENING_DAY', new Date().toISOString());   // 🎉 the board's Opening Day page runs for 24 hours from here
    log_('commish', 'Fresh start', JSON.stringify(kept) + (champId ? ' · champion club ' + champId : ''));
  } finally { lock.releaseLock(); }
  let crowned = '';
  if (ace) { try { withLad_(ace.lad, function () { crownAce_(ace.email, 'commish'); }); crowned = '\n\n👑 ' + ace.name + ' (' + ace.club + ') starts as the ' + (ace.lad === 'farm' ? '🐕 Farm Dog' : 'Ace') + '.'; } catch (e) { crowned = '\n\nCouldn\'t crown the Ace: ' + (e.message || e); } }
  else if (champId) crowned = '\n\nThe champion club ' + champId + (champOwner ? ' (owner ' + champOwner + ')' : '') + ' isn\'t on either ladder, so nobody is the Ace yet: crown one from the menu.';
  try { snapshotBoard_(); } catch (e) { }
  ui.alert('🏁 Fresh start done. ⛰️ ' + (kept.hill || 0) + ' clubs' + (kept.farm != null ? ', 🌱 ' + kept.farm + ' Farm clubs' : '') + ', ranked by sign-up order, all at 0-0, every wallet at zero.' + crowned +
    '\n\nNext: check SEASON_START, then run "Update the odds now".');
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
function pctOf_(v, d) { const n = Number(v); return n > 0 ? n : d; }
// The most someone can stake right now: a % of their free Brawl Bucks (never under 5, never over what they have).
function stakeCap_(C, email, pct) { const have = bankOf_(bankrolls_(C), email); return Math.max(0, Math.min(have, Math.max(5, Math.floor(have * pct / 100)))); }
const flat_ = (C) => pctOf_(C.BET_MAX_FLAT, 250);
function betCap_(C, email) { return Math.min(flat_(C), stakeCap_(C, email, pctOf_(C.BET_MAX_PCT, 4.2))); }
// Big wagers: the commish gives a player a one-time OK (24 hours) to go up to WAGER_BIG_PCT on their next wager.
function bigOk_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('BIG_WAGER_OK') || '{}'); } catch (e) { return {}; } }
function hasBigOk_(email) { const o = bigOk_(), t = o[lc_(email)]; return !!t && t > now_().getTime(); }
function useBigOk_(email) { const o = bigOk_(); delete o[lc_(email)]; PropertiesService.getScriptProperties().setProperty('BIG_WAGER_OK', JSON.stringify(o)); }
function wagerNormalCap_(C, email) { return Math.min(flat_(C), stakeCap_(C, email, pctOf_(C.WAGER_MAX_PCT, 4.2))); }
function wagerCap_(C, email) { const n = wagerNormalCap_(C, email); return hasBigOk_(email) ? Math.max(n, stakeCap_(C, email, pctOf_(C.WAGER_BIG_PCT, 10))) : n; }   // a big-wager OK never lowers the limit
function wagerMax_(C) { return pctOf_(C.WAGER_MAX_PCT, 4.2) + '% of your Brawl Bucks'; }
function adminBigWager() {
  withUi_(function (ui) {
    const C = cfg_(), r = ui.prompt('🤝 Allow a big wager', 'Club ID or Discord name of the player. Their next head-to-head wager (offer or accept) in the next 24 hours can go up to ' + pctOf_(C.WAGER_BIG_PCT, 10) + '% of their Brawl Bucks instead of ' + pctOf_(C.WAGER_MAX_PCT, 4.2) + '%.', ui.ButtonSet.OK_CANCEL);
    if (r.getSelectedButton() !== ui.Button.OK) return '';
    const v = lc_(r.getResponseText()), pt = players_();
    const p = pt.rows.find(function (x) { return x.Status === 'Active' && (norm_(x.ClubID) === v || lc_(x.Discord) === v); });
    if (!p) return 'No active Hill player with that club ID or Discord name.';
    const o = bigOk_(); o[lc_(p.Email)] = now_().getTime() + 24 * 3600e3; PropertiesService.getScriptProperties().setProperty('BIG_WAGER_OK', JSON.stringify(o));
    log_('commish', 'Big wager OK', p.Discord);
    try { postBook_('🤝 The commish OKs a **big wager** for ' + who_(p) + ': up to ' + pctOf_(C.WAGER_BIG_PCT, 10) + '% of their Brawl Bucks (' + wagerCap_(C, p.Email) + ' BB right now) on their next head-to-head, for 24 hours.'); } catch (e) { }
    return p.Discord + ' can wager up to ' + wagerCap_(C, p.Email) + ' BB (' + pctOf_(C.WAGER_BIG_PCT, 10) + '%) on their next head-to-head in the next 24 hours.';
  });
}
function wagerHelp_(C) {
  return 'Bet Brawl Bucks straight against another Hill player: up to ' + wagerMax_(C) + ' a side (more with the commish\'s OK), on your terms (straight up, odds or a run line). ' +
    'They accept on this form. The next BigLeague game between your two clubs within ' + (Number(C.WAGER_PLAY_HOURS) || 48) + ' hours of accepting settles it, once it has aired. ' +
    'No house cut: the winner takes the loser\'s stake. A tie (straight up or odds) or no game in time = everyone gets their bucks back. ' + WAGER_WARN;
}
function bankOf_(br, email) { const e = lc_(acct_(email)); return e in br.bank ? br.bank[e] : br.base; }
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
  const pt = ownerRows_(), me = ownerMe_(sub.email);
  if (!norm_(me.ClubID)) fail_('Your club ID is missing from the Hill. Register again with it first.');
  const oppId = norm_(sub.f[Q.W_OPP]).replace(/\D/g, '');
  if (!oppId) fail_("Enter your opponent's club ID (it's next to their name on the HtH Leaderboard).");
  const opp = pt.rows.find(function (p) { return p.Status === 'Active' && norm_(p.ClubID) === oppId; });
  if (!opp) fail_('No active Hill player has club ID ' + oppId + '. Both of you need to be on the Hill.');
  if (lc_(opp.Email) === lc_(me.Email)) fail_("You can't wager against yourself.");
  const max = wagerCap_(C, me.Email), big = hasBigOk_(me.Email);
  const stake = Math.floor(Number(norm_(sub.f[Q.W_STAKE]).replace(/[^\d]/g, '')));
  if (!(stake >= 1)) fail_('Enter a stake of at least 1 Brawl Buck.');
  if (stake > max) fail_('The most you can put on a wager right now is **' + max + ' BB** (' + (big ? pctOf_(C.WAGER_BIG_PCT, 10) + '% with the commish\'s OK' : pctOf_(C.WAGER_MAX_PCT, 4.2) + '% of your Brawl Bucks; up to ' + pctOf_(C.WAGER_BIG_PCT, 10) + '% with the commish\'s OK') + ').');
  const oppMax = wagerCap_(C, opp.Email);
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
      if (ts > oppMax) fail_('At ' + o.txt + ' they would risk ' + ts + ' BB, over their ' + oppMax + ' BB limit. Lower your stake to ' + Math.floor(oppMax * o.b / o.a) + ' or less.');
    }
  }
  if (terms === 'giveRuns' || terms === 'getRuns') {
    const n = Math.floor(Number(norm_(sub.f[Q.W_RUNS]).replace(/[^\d]/g, '')));
    if (!(n >= 1 && n <= 20)) fail_('For a run-line bet, enter the runs as a whole number from 1 to 20.');
    line = String(n);
  }
  const br = bankrolls_(C), have = bankOf_(br, me.Email);
  if (ms > have) fail_('You only have ' + have + ' Brawl Bucks free (stakes on open bets and wagers are held until they settle).');
  if (ts > oppMax) fail_('That would have ' + opp.Discord + ' risk ' + ts + ' BB, over their limit of ' + oppMax + ' BB right now. Lower the stake.');
  if (big && ms > wagerNormalCap_(C, me.Email)) useBigOk_(me.Email);
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
    '\n' + tag_(opp) + ': answer on the ' + (form ? '[Master Form](<' + form + '>)' : 'Master Form') + ' → *🤝 Answer a wager* · wager # `' + w.WagerID + '`. Open until ' + ts_(exp) + '.' +
    '\n-# Your next BigLeague game against each other settles it, once it airs. Funny business costs you your Brawl Bucks.');
}

function doWagerReply_(sub, C) {
  if (!wagerOn_(C)) fail_('Head-to-head wagers are off right now.');
  const pt = ownerRows_(), me = ownerMe_(sub.email);
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
  const tcap = wagerCap_(C, me.Email);
  if (ts > tcap) fail_('Accepting ' + id + ' takes ' + ts + ' BB, over your limit of ' + tcap + ' BB right now (' + pctOf_(C.WAGER_MAX_PCT, 4.2) + '% of your Brawl Bucks; up to ' + pctOf_(C.WAGER_BIG_PCT, 10) + '% with the commish\'s OK).');
  if (hasBigOk_(me.Email) && ts > wagerNormalCap_(C, me.Email)) useBigOk_(me.Email);
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

// For the HtH Leaderboard (names only, no emails).
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
  return { max: wagerMax_(C), pct: pctOf_(C.WAGER_MAX_PCT, 4.2), big: pctOf_(C.WAGER_BIG_PCT, 10), flat: flat_(C), open: rows.filter(function (w) { return w.Status === 'Offered'; }).map(pub),
    live: rows.filter(function (w) { return w.Status === 'Accepted' || w.Status === 'Airing'; }).map(pub), done: [] };   // no settled history on the public board
}

function ensureWagerForm_(form) {
  const C = cfg_();
  const pages = form.getItems(FormApp.ItemType.PAGE_BREAK);
  let pW = pages.find(function (p) { return p.getTitle() === ACTIONS.WAGER; });
  if (!pW) {
    pW = form.addPageBreakItem().setTitle(ACTIONS.WAGER).setHelpText(wagerHelp_(C));
    pW.setGoToPage(FormApp.PageNavigationType.SUBMIT);
    form.addTextItem().setTitle(Q.W_OPP).setHelpText("Their club ID number. It's next to their name on the HtH Leaderboard.").setRequired(true)
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
const ACTION_ORDER = ['CHALLENGE', 'REACH', 'REPORT', 'REVENGE', 'BET', 'WAGER', 'WAGER_REPLY', 'SHOP', 'VOTE', 'REGISTER', 'DISCORD_ID'];
const CHARGE_HELP = '🥊 Pick who you are charging. You can charge anyone up to 3 spots above you: 1 spot up, just win. 2 spots up, win by 3+. 3 spots up, win by 4+. ' +
  'Only #1 can charge ♠ THE ACE at first; if nobody does, #2 joins after 8 hours, then one more spot each day, down to #5 (never overnight). Any win takes the mound. 🔔 When the Bell rings (a few random hours a week), anyone can charge the Ace: win by 3+ for the title, less makes you #1 contender.\n\n' +
  'After you submit: start the game in SmallBall as the VISITOR at their park, BigLeague. No report needed: the Hill finds the game on its own and posts the result once it has aired. One open charge at a time.';
const CHARGE_ITEMS_HELP = '\n\n🛒 Items (optional, Brawl Bucks): 🧽 Margin Eraser = any win will do. 🪜 Ladder Jump = charge one spot past your reach (win by 5+); 🪜 Ladder Jump+ = the same, and any win will do. If the player you charge wears 🥊 Brass Knuckles, you need 1 more run (2+ against the Ace), unless you swing the Eraser.';
function ensureTidyForm_(form) {
  const items = form.getItems();
  const action = items.find(function (i) { return i.getTitle() === Q.ACTION && i.getType() === FormApp.ItemType.MULTIPLE_CHOICE; });
  if (!action) return 'No "' + Q.ACTION + '" question on the form.';
  // Rename each section to its action's label (so the section header matches the choice).
  form.getItems(FormApp.ItemType.PAGE_BREAK).forEach(function (it) {
    const pb = it.asPageBreakItem(), canon = actionOf_(pb.getTitle());
    if (Object.keys(ACTIONS).some(function (k) { return ACTIONS[k] === canon; }) && pb.getTitle() !== canon) pb.setTitle(canon);
    if (canon === ACTIONS.CHALLENGE) pb.setHelpText(CHARGE_HELP + (itemsOn_(cfg_()) ? CHARGE_ITEMS_HELP : ''));
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
  appendObj_(SHEETS.LEDGER, { Date: now_(), Season: C.SEASON, Email: acct_(p.Email), Player: norm_(p.Discord), Amount: -amt, Reason: why });
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
  if (!prev.length) { postBook_('🔮 **The board is up!** ' + lines.length + ' matchup lines posted' + pre + '. Lock in before the charge. Every line is on the HtH Leaderboard and the Master Form.'); return; }
  postBook_('🆕 **New line' + (fresh.length > 1 ? 's' : '') + ' on the board**' + pre + '\n' + fresh.slice(0, 15).map(function (x) {
    return (x.title ? '♠️ ' : '🔮 ') + '**' + esc_(x.ch) + '** ' + fmtOdds_(x.aml) + ' @ **' + esc_(x.df) + '** ' + fmtOdds_(x.hml);
  }).join('\n') + (fresh.length > 15 ? '\n…and ' + (fresh.length - 15) + ' more on the HtH Leaderboard.' : ''));
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
    postBook_('♠️ **Season Ace futures are live!**\n' + rows.slice(0, 5).map(function (x, i) { return (i + 1) + '. **' + esc_(x.name) + '** ' + fmtOdds_(x.odds) + ' (' + x.pct + '%)'; }).join('\n') + '\nBet on who finishes as the Ace on the Master Form (not yourself).');
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
  if (mine) fail_("You're in that matchup. No betting on yourself or your own games: that's what 🤝 head-to-head wagers are for.");
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
  let t = '# 🎰 HILL SPORTSBOOK · ' + Utilities.formatDate(now_(), 'America/Denver', 'EEE MMM d · h a') + ' MT' + (seasonOpen_(C) ? '' : ' · PREVIEW') + '\n*Play money. Bet on the Master Form. Matchup bets lock at the charge and come back if it isn\'t played in ' + (Number(C.BOOK_HOLD_HOURS) || 48) + ' hours.*\n';
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
// ───────────────────────────── 🌙 The daily book (resets at midnight Mountain) ─────────────────────────────
// Simple bets, lots of them: who's the Ace at midnight, plus Yes/No fun props about the day on the Hill.
// A prop bet only counts games charged AFTER the bet was placed (no betting on a game you're already watching),
// and the Ace market shuts while a title charge is live. YES bets pay the moment it happens; NO bets at midnight.
const DAY_PROPS = [
  { key: 'newace', q: '👑 A new Ace before midnight', prior: 0.45 },
  { key: 'shutout', q: '🧹 A shutout on the Hill', prior: 0.35 },
  { key: 'ten', q: '💥 Somebody scores 10+ in a Hill game', prior: 0.4 },
  { key: 'onerun', q: '🤏 A one-run Hill game', prior: 0.5 },
  { key: 'knucks', q: '🥊 Brass Knuckles get thrown', prior: 0.3 },
];
function dayMidnight_(day) {   // the midnight (Mountain) that ends `day` (yyyy-MM-dd)
  const p = day.split('-').map(Number), probe = new Date(Date.UTC(p[0], p[1] - 1, p[2] + 1, 12));
  const z = Utilities.formatDate(probe, 'America/Denver', 'Z'), off = (z[0] === '-' ? 1 : -1) * (Number(z.slice(1, 3)) * 60 + Number(z.slice(3, 5)));
  return new Date(Date.UTC(p[0], p[1] - 1, p[2] + 1, 0, off));
}
function dayStart_(day) { const p = day.split('-').map(Number); return dayMidnight_(Utilities.formatDate(new Date(Date.UTC(p[0], p[1] - 1, p[2] - 1, 12)), 'UTC', 'yyyy-MM-dd')); }
// Which props hit for games CHARGED in [since, until) with results in by `until`.
function dayData_() { return { ch: challenges_().rows, m: readTable_(SHEETS.MATCHES).rows, r: readTable_(SHEETS.REIGNS).rows, i: readTable_(SHEETS.ITEMS).rows }; }
function dayHits_(C, since, until, DD) {
  DD = DD || dayData_();
  const season = String(C.SEASON), hit = {}, made = {};
  DD.ch.forEach(function (c) { made[c.ID] = c.Created ? new Date(c.Created) : null; });
  DD.m.forEach(function (m) {
    if (String(m.Season) !== season || m.WinnerRuns === '' || m.WinnerRuns === null) return;
    const at = made[m.ChallengeID] || new Date(m.Date);
    if (at < since || at >= until || new Date(m.Date) >= until) return;
    const w = num_(m.WinnerRuns), l = num_(m.LoserRuns);
    if (l === 0) hit.shutout = true; if (w >= 10) hit.ten = true; if (w - l === 1) hit.onerun = true;
  });
  DD.r.forEach(function (r) { const s = new Date(r.Start); if (String(r.Season) === season && s >= since && s < until) hit.newace = true; });
  DD.i.forEach(function (x) { const d = new Date(x.Date); if (String(x.Season) === season && x.Item === 'knuckles' && x.Action === 'Used' && d >= since && d < until) hit.knucks = true; });
  return hit;
}
// How often each prop has hit on a full day this season, pulled toward a sensible prior early on.
function dayRates_(C) {
  const st = seasonStart_(C) || new Date(now_().getTime() - 86400e3), today = denverDay_(now_()), out = {}, cnt = {};
  let days = 0; const DD = dayData_();
  for (let d = denverDay_(st); d < today && days < 60; ) {
    const h = dayHits_(C, dayStart_(d), dayMidnight_(d), DD); days++;
    DAY_PROPS.forEach(function (p) { if (h[p.key]) cnt[p.key] = (cnt[p.key] || 0) + 1; });
    d = denverDay_(new Date(dayMidnight_(d).getTime() + 3600e3));
  }
  DAY_PROPS.forEach(function (p) { out[p.key] = ((cnt[p.key] || 0) + 3 * p.prior) / (days + 3); });
  return out;
}
// Share of the day's action still to come: games are spread over 8 AM – midnight.
function dayLeft_(day) { const end = dayMidnight_(day).getTime(), t = now_().getTime(); return Math.max(0.05, Math.min(1, (end - t) / (16 * 3600e3))); }
function makeDayBook_(C) {
  const day = denverDay_(now_()), f = dayLeft_(day), vig = 1 + (Number(C.BOOK_VIG) || 0);
  const pt = players_(), ace = ace_(pt), lad = ladder_(pt), season = String(C.SEASON);
  const matches = readTable_(SHEETS.MATCHES).rows.filter(function (m) { return String(m.Season) === season; });
  const sm = starsMap_();
  // 🌙 Ace at midnight: title charges per day so far, each contender's chance to take the mound.
  const titles = matches.filter(function (m) { return /Title|Revenge|Bell/i.test(m.Type); }).length, st = seasonStart_(C);
  const daysIn = Math.max(1, (now_() - (st || now_())) / 86400e3), lam = (titles + 3 * 3) / (daysIn + 3);
  const W = [3, 2, 1.5, 1, 0.8, 0.6], cons = [];
  if (ace) {
    const H = strength_(ace.Email, matches);
    lad.slice(0, Math.max(1, Number(C.MOUND_OPEN_MAX) || 5)).forEach(function (p, i) {
      const A = strength_(p.Email, matches), sa = sm[norm_(p.ClubID)], sh = sm[norm_(ace.ClubID)];
      const pw = winProb_(A, H, sa == null ? null : sa, sh == null ? null : sh, Math.min(A.g, H.g));
      cons.push({ p: p, w: (W[i] || 0.5) * pw });
    });
  }
  const tw = cons.reduce(function (a, x) { return a + x.w; }, 0) || 1, wsum = W.slice(0, cons.length).reduce(function (a, b) { return a + b; }, 0) || 1;
  const pHold = ace ? Math.exp(-lam * f * tw / wsum) : 0, rest = 1 - pHold;
  const aceRows = [];
  if (ace) aceRows.push({ email: lc_(ace.Email), name: norm_(ace.Discord), club: norm_(ace.Club), hold: true, pct: pHold });
  cons.forEach(function (x) { aceRows.push({ email: lc_(x.p.Email), name: norm_(x.p.Discord), club: norm_(x.p.Club), rank: Number(x.p.Rank), pct: rest * 0.9 * x.w / tw }); });
  if (ace) aceRows.push({ email: 'field', name: 'Anyone else', club: 'the rest of the ladder', pct: rest * 0.1 });
  aceRows.forEach(function (r) { r.odds = american_(Math.max(0.02, r.pct) * vig); r.pct = Math.round(r.pct * 1000) / 10; });
  const R = dayRates_(C);
  const props = DAY_PROPS.map(function (p) { const q = 1 - Math.pow(1 - R[p.key], f); return { key: p.key, q: p.q, pct: Math.round(q * 1000) / 10, yes: american_(q * vig), no: american_((1 - q) * vig) }; });
  return { day: day, at: now_().toISOString(), ends: dayMidnight_(day).toISOString(), ace: aceRows, props: props };
}
function dayBook_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('DAY_BOOK') || 'null'); } catch (e) { return null; } }
function dayPrevBook_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('DAY_BOOK_PREV') || 'null'); } catch (e) { return null; } }
function titleLive_() { return challenges_().rows.some(function (c) { return OPEN.indexOf(c.Status) >= 0 && /Title|Revenge|Bell/i.test(c.Type); }); }
function dayChoices_(B, C) {
  if (!B) return [];
  const out = [], dead = dayDecided_(B);
  if (!titleLive_()) B.ace.forEach(function (r) { out.push({ label: '🌙 TONIGHT · ' + (r.email === 'field' ? 'Anyone else' : r.name) + (r.hold ? ' holds the mound' : '') + ' is the Ace at midnight (' + fmtOdds_(r.odds) + ')', market: 'DACE', pick: r.email, odds: r.odds, name: r.name }); });
  B.props.forEach(function (p) {
    if (dead[p.key]) return;
    out.push({ label: '🎲 TODAY · ' + p.q + ': YES (' + fmtOdds_(p.yes) + ')', market: 'DPROP', pick: p.key + ':yes', odds: p.yes });
    out.push({ label: '🎲 TODAY · ' + p.q + ': NO (' + fmtOdds_(p.no) + ')', market: 'DPROP', pick: p.key + ':no', odds: p.no });
  });
  return out;
}
// Props that already hit today: their market closes (YES bets were paid).
function dayDecided_(B) { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('DAY_DONE_' + B.day) || '{}'); } catch (e) { return {}; } }
function doDayBet_(sub, C, me, label, stake) {
  if (!/^(🌙|🎲) /.test(label)) return false;
  const B = dayBook_(); let o = dayChoices_(B, C).find(function (x) { return x.label === label; });
  if (!o) { const P = dayPrevBook_(); if (P && B && P.day === B.day) o = dayChoices_(P, C).find(function (x) { return x.label === label; }); }
  if (!o) fail_(/^🌙/.test(label) && titleLive_() ? 'A title charge is live: the 🌙 Ace-at-midnight bets reopen as soon as it\'s settled.' : 'That one is off the board (it already happened, or the day rolled over). Reload the form and pick again.');
  lockIfOver_(C);
  if (o.market === 'DACE' && o.pick === lc_(me.Email)) fail_('No betting on yourself: that\'s what 🤝 head-to-head wagers are for.');
  if (o.market === 'DPROP' && o.pick === 'newace:yes') { const ace = ace_(players_()); if (ace && lc_(ace.Email) === lc_(me.Email)) fail_('The Ace can\'t bet on a new Ace. Nice try.'); }
  if (!(stake >= 1)) fail_('Enter a stake of at least 1 Brawl Buck.');
  const br = bankrolls_(C), have = (lc_(me.Email) in br.bank) ? br.bank[lc_(me.Email)] : br.base;
  if (stake > have) fail_('You only have ' + have + ' Brawl Bucks available.');
  const bt = readTable_(SHEETS.BETS);
  appendObj_(SHEETS.BETS, { BetID: 'B-' + pad_(bt.rows.length + 1), Placed: now_(), Season: C.SEASON, Email: me.Email, Bettor: norm_(me.Discord),
    ChallengeID: 'DAY:' + B.day, Market: o.market, Pick: o.pick, Odds: o.odds, Stake: stake, Status: 'Open', Profit: '' });
  log_(sub.email, 'Bet', label + ' x' + stake);
  if (lc_(C.BOOK_POST_BETS) !== 'false') betAnnounce_(me.Discord, stake, label.replace(/^(🌙|🎲) (TONIGHT|TODAY) · /, '').replace(/ \([−+]\d+\)$/, ''), o.odds, o.market === 'DACE' ? '🌙 Ace at midnight' : '🎲 Daily prop', false);
  return true;
}
function payBet_(bt, b, res) { b.Status = res; b.Profit = res === 'Won' ? profit_(num_(b.Stake), b.Odds) : res === 'Lost' ? -num_(b.Stake) : 0; writeRow_(bt, b); }
// Hourly and after every result: pay YES props that just hit, settle yesterday at midnight, roll the book.
function dayTick_(force) {
  const C = cfg_();
  if (!bookOn_(C) || pendingQueue_() || !seasonOpen_(C)) return;
  const sp = PropertiesService.getScriptProperties(), today = denverDay_(now_()), bt = readTable_(SHEETS.BETS);
  // 1) YES props: each bet looks only at games charged after it was placed.
  const open = bt.rows.filter(function (b) { return b.Market === 'DPROP' && b.Status === 'Open'; });
  const DD = dayData_();
  open.forEach(function (b) {
    const day = String(b.ChallengeID).slice(4), key = String(b.Pick).split(':')[0], yes = /:yes$/.test(b.Pick);
    const end = dayMidnight_(day), closed = now_() >= end;
    const h = dayHits_(C, new Date(b.Placed), end, DD);
    if (h[key]) payBet_(bt, b, yes ? 'Won' : 'Lost');
    else if (closed) payBet_(bt, b, yes ? 'Lost' : 'Won');
  });
  // mark today's decided props (closes them on the form) and say so once
  const dk = 'DAY_DONE_' + today, was = (function () { try { return JSON.parse(sp.getProperty(dk) || '{}'); } catch (e) { return {}; } })();
  const fresh = Object.keys(dayHits_(C, dayStart_(today), dayMidnight_(today), DD)).filter(function (k) { return !was[k]; });
  fresh.forEach(function (k) { was[k] = 1; }); if (fresh.length) sp.setProperty(dk, JSON.stringify(was));
  if (fresh.length && lc_(C.BOOK_POST_BETS) !== 'false') {
    const paid = open.filter(function (b) { return b.Status === 'Won' && /:yes$/.test(b.Pick); });
    postBook_('🎲 **It happened!** ' + fresh.map(function (k) { const p = DAY_PROPS.find(function (x) { return x.key === k; }); return p ? p.q : k; }).join(' · ') +
      (paid.length ? '\n💸 YES bets cash: ' + paid.map(function (b) { return '**' + esc_(b.Bettor) + '** +' + b.Profit + ' BB'; }).join(', ') : '') + '\n-# That prop is off the board for the rest of today.');
  }
  // 2) 🌙 Ace at midnight for any finished day
  const aceOpen = bt.rows.filter(function (b) { return b.Market === 'DACE' && b.Status === 'Open'; });
  const byDay = {}; aceOpen.forEach(function (b) { const d = String(b.ChallengeID).slice(4); if (d < today) (byDay[d] = byDay[d] || []).push(b); });
  Object.keys(byDay).forEach(function (d) {
    const mid = dayMidnight_(d), season = String(C.SEASON);
    const r = readTable_(SHEETS.REIGNS).rows.filter(function (x) { return String(x.Season) === season && new Date(x.Start) < mid && (!x.End || new Date(x.End) >= mid); }).pop();
    const who = r ? lc_(r.Email) : '', B = byDay[d], book = dayBook_(), names = {};
    ((book && book.day === d ? book.ace : []) || []).forEach(function (x) { names[x.email] = 1; });
    let won = 0;
    B.forEach(function (b) { const hit = b.Pick === who || (b.Pick === 'field' && who && !names[who]); payBet_(bt, b, hit ? 'Won' : 'Lost'); if (hit) won++; });
    if (lc_(C.BOOK_POST_BETS) !== 'false') postBook_('🌙 **Ace at midnight (' + d + '):** ' + (r ? esc_(r.Discord) + ' (' + esc_(r.Club) + ')' : 'nobody') + '. ' + B.length + ' bet(s), ' + won + ' winner(s).');
  });
  // 3) roll or refresh the book
  const B0 = dayBook_();
  if (force || !B0 || B0.day !== today || now_() - new Date(B0.at) > 55 * 60e3) {
    const nb = makeDayBook_(C);
    if (B0 && B0.day === today) sp.setProperty('DAY_BOOK_PREV', JSON.stringify(B0)); else sp.deleteProperty('DAY_BOOK_PREV');
    sp.setProperty('DAY_BOOK', JSON.stringify(nb));
    if ((!B0 || B0.day !== today)) sp.deleteProperty('DAY_POSTED');
    refreshFormChoices();
  }
  // 4) morning board post (first run after 8 AM)
  const hr = Number(Utilities.formatDate(now_(), 'America/Denver', 'H'));
  if (hr >= 8 && sp.getProperty('DAY_POSTED') !== today) { sp.setProperty('DAY_POSTED', today); try { postBook_(dayBoardText_(dayBook_())); } catch (e) { } }
}
function dayBoardText_(B) {
  if (!B) return '';
  const D = dayDecided_(B);
  return '## 🌙 Today\'s board · ' + Utilities.formatDate(new Date(B.ends.replace(/T.*/, 'T12:00:00Z')), 'America/Denver', 'EEE MMM d') + '\n' +
    '**Who\'s the Ace at midnight?**\n' + B.ace.map(function (r) { return '> ' + (r.hold ? '♠ ' : r.email === 'field' ? '🎲 ' : '#' + r.rank + ' ') + '**' + esc_(r.name) + '** ' + fmtOdds_(r.odds) + (r.hold ? ' (holds)' : ''); }).join('\n') +
    '\n**🎲 Fun props (YES / NO)**\n' + B.props.map(function (p) { return '> ' + p.q + ': ' + (D[p.key] ? '✅ already hit' : 'YES ' + fmtOdds_(p.yes) + ' · NO ' + fmtOdds_(p.no)); }).join('\n') +
    '\n-# Bet on the Master Form. Props only count games charged after your bet. YES pays the moment it happens, NO pays at midnight. Odds move every hour.';
}

// ───────────────────────────── ⚾ Player props (box scores; needs 🔑 Connect SmallBall) ─────────────────────────────
// When a charge's line opens: the two best home run bats on each club "to homer" and each pitcher "to strike out
// N+". Odds from career numbers. Settled from SmallBall's box score; refunded if the box can't be read.
function sbAuthed_(path) {
  const sp = PropertiesService.getScriptProperties(), ck = sp.getProperty('SB_COOKIE');
  if (!ck || sp.getProperty('SB_BAD')) return null;
  const r = UrlFetchApp.fetch('https://play.smallball.com' + path, { muteHttpExceptions: true, headers: { Accept: 'application/json', Cookie: ck } });
  const code = r.getResponseCode();
  if (code === 401 || code === 403) { sp.setProperty('SB_BAD', String(Date.now())); log_('system', 'SmallBall login expired', 'Player props and star checks are off until you reconnect (🔑 Connect SmallBall).'); return null; }
  return code === 200 ? JSON.parse(r.getContentText()) : null;
}
function lineup_(clubId) {
  const d = sbAuthed_('/teams/' + encodeURIComponent(norm_(clubId).replace(/\D/g, '')) + '/profile'); if (!d || !d.roster) return null;
  const ro = d.roster, at = function (i) { return ro.find(function (r) { return r.slot === i; }) || ro[i]; };
  const fp = d.field_pos || [], bo = d.batting_order || [];
  const bats = bo.map(function (k) { return at(fp[k]); }).filter(Boolean), P = at(fp[0]);
  return { bats: bats, pitcher: P };
}
function propsMake_(c, ch, df, C) {
  const vig = 1 + (Number(C.BOOK_VIG) || 0), out = [];
  const A = lineup_(ch.ClubID), H = lineup_(df.ClubID); if (!A || !H) return [];
  const hrP = function (b) { const k = b.career || {}, ab = num_(k.at_bats), hr = num_(k.home_runs); return ab >= 30 ? 1 - Math.pow(1 - hr / ab, 4.2) : 0; };
  [[A, ch, 'away'], [H, df, 'home']].forEach(function (x) {
    x[0].bats.slice().sort(function (a, b) { return hrP(b) - hrP(a); }).slice(0, 2).forEach(function (b) {
      const p = hrP(b); if (p < 0.05) return;
      out.push({ k: 'hr:' + b.player_id, side: x[2], label: '⚾ ' + norm_(b.name) + ' (' + norm_(x[1].Club) + ') homers', odds: american_(p * vig) });
    });
  });
  [[A, H, ch, 'away'], [H, A, df, 'home']].forEach(function (x) {
    const P = x[0].pitcher; if (!P) return;
    const rate = x[1].bats.reduce(function (s, b) { const k = b.career || {}, ab = num_(k.at_bats); return s + (ab >= 20 ? num_(k.strikeouts) / ab : 0.2); }, 0) / Math.max(1, x[1].bats.length);
    const mu = rate * 36, N = Math.max(3, Math.floor(mu) + 1);
    let cdf = 0, t = Math.exp(-mu); for (let i = 0; i < N; i++) { cdf += t; t *= mu / (i + 1); }
    out.push({ k: 'k' + N + ':' + x[3], side: x[3], label: '🔥 ' + norm_(P.name) + ' (' + norm_(x[2].Club) + ') strikes out ' + N + '+', odds: american_((1 - cdf) * vig) });
  });
  return out;
}
function propsAll_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('PROPS') || '{}'); } catch (e) { return {}; } }
function propsFor_(cid) { return propsAll_()[cid] || []; }
function propsOpen_(c, ch, df, C) {
  try {
    const list = propsMake_(c, ch, df, C); if (!list.length) return '';
    const all = propsAll_(), keep = {}; Object.keys(all).slice(-12).forEach(function (k) { keep[k] = all[k]; }); keep[c.ID] = list;
    PropertiesService.getScriptProperties().setProperty('PROPS', JSON.stringify(keep));
    return '\n⚾ **Props:** ' + list.map(function (p) { return p.label.replace(/ \([^)]*\)/, '') + ' ' + fmtOdds_(p.odds); }).join(' · ');
  } catch (e) { log_('system', 'Props error', String(e)); return ''; }
}
function propsSettle_(c, bt, open) {
  const mine = open.filter(function (b) { return b.Market === 'PROP'; }); if (!mine.length) return 0;
  let box = null; try { if (norm_(c.GameID)) box = sbAuthed_('/games/' + encodeURIComponent(norm_(c.GameID))); } catch (e) { }
  const P = box && box.result && box.result.players, RO = box && box.rosters;
  mine.forEach(function (b) {
    if (!P || !RO) return payBet_(bt, b, 'Void');
    const k = String(b.Pick);
    if (/^hr:/.test(k)) { const s = P[k.slice(3)]; return payBet_(bt, b, s ? (num_(s.hr) >= 1 ? 'Won' : 'Lost') : 'Void'); }
    const m = /^k(\d+):(away|home)$/.exec(k); if (!m) return payBet_(bt, b, 'Void');
    const opp = m[2] === 'away' ? 'home' : 'away', ids = (RO[opp] && RO[opp].player_ids) || [];
    const ks = ids.reduce(function (s, id) { return s + num_((P[id] || {}).k); }, 0);
    payBet_(bt, b, ks >= Number(m[1]) ? 'Won' : 'Lost');
  });
  return mine.length;
}

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
function adminRunFutures() { withUi_(function () { futuresTick_(true); potTick_(true); dayTick_(true); return 'Futures, the daily book and matchup lines updated.'; }); }
function adminPostDayBoard() { withUi_(function () { dayTick_(true); postBook_(dayBoardText_(dayBook_())); return 'Today\'s board posted.'; }); }

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

// ───────────────────────────── HtH Leaderboard (web page) ─────────────────────────────
// A live scoreboard anyone can open: Deploy → New deployment → Web app → Execute as: Me, Who has access:
// Anyone. It shows only what has already been posted publicly (a snapshot taken at every Discord post, held
// back while a result is still waiting for its game to air), and never emails. It refreshes every minute.

const BOARD_TAB = 'Board';

function snapshotBoard_() { withLad_('', snapshotMain_); }
function snapshotMain_() {
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
    try { if (bookOn_(C)) bookOpen = openLines_().map(function (L) { return { id: L.ChallengeID, away: L.Away, home: L.Home, aml: L.AwayML, hml: L.HomeML, fav: L.Fav, closes: iso(L.Closes), props: propsFor_(L.ChallengeID).map(function (p) { return { l: p.label, o: p.odds }; }) }; }); } catch (e) { bookOpen = []; }
    let rjs = []; try { rjs = JSON.parse(PropertiesService.getScriptProperties().getProperty('REJECTS') || '[]').filter(function (x) { return now_() - new Date(x.at) < 3600e3; }); } catch (e) { rjs = []; }
    const snap = Object.assign({}, prev, { betRule: { base: Number(C.BOOK_BANKROLL) || 1000, pct: pctOf_(C.BET_MAX_PCT, 4.2), flat: flat_(C) }, openingDay: PropertiesService.getScriptProperties().getProperty('OPENING_DAY') || '', rejects: rjs, pot: (bookOn_(C) ? potCurrent_() : []).map(function (L) { return { ch: L.ch, df: L.df, t: L.title, a: L.aml, h: L.hml, cr: L.chRank }; }), formLink: norm_(C.FORM_LINK), prefill: prefillCached_(C), bookOn: bookOn_(C), bookOpen: bookOpen, bell: (function () { const B = bellState_(C); return B.on ? { open: B.open && !B.used, answered: B.open && B.used, until: iso(B.until), soon: B.soon, next: B.soon ? iso(B.next) : '', margin: Number(C.BELL_MARGIN) || 3, shield: iso(B.shield) } : null; })(), moundOpenTo: moundOpenTo_(C), moundNextAt: (function () { try { const a = moundNextAt_(C); return a ? a.toISOString() : ''; } catch (e) { return ''; } })(), moundMax: Number(C.MOUND_OPEN_MAX) || 1, moundFirst: fmtHrs_(hrsOf_(C.MOUND_FIRST_HOURS, 4 + 1 / 3)), moundStep: fmtHrs_(hrsOf_(C.MOUND_STEP_HOURS, 4 + 1 / 3)), reach: Number(C.CHALLENGE_REACH) || 3, daily: dailyTable_(C), season: C.SEASON, seasonStart: ss0 ? ss0.toISOString() : '', seasonEnd: se ? se.toISOString() : '', seasonClosed: !!C.STATE_SEASON_CLOSED, prizes: norm_(C.PRIZES), updated: new Date().toISOString(), charges: open });
    if (!pending.length || !prev.ladder) {   // a result still waiting to air keeps the standings as they were
      const pt = players_();
      const pub = function (p) { const rs = restUntil_(p.Email); return { name: norm_(p.Discord), club: norm_(p.Club), clubId: norm_(p.ClubID), opt: Number(p.Rank) > 0 ? oppLabel_(p) : '', rest: rs ? rs.toISOString() : '', rank: p.Rank, w: num_(p.Wins), l: num_(p.Losses), defenses: num_(p.Defenses), reigns: num_(p.Reigns), best: num_(p.BestReignPts), pts: num_(p.CareerPts) }; };
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
        snap.awards = AWARDS.map(function (w) { const x = aw[w.key]; return { icon: w.icon, name: w.key === 'ace' ? 'Season ' + C.SEASON + ' Ace' : w.name, what: w.what, who: x ? x.name : '', club: x ? x.club : '', value: x ? x.value : '', note: w.key === 'bleacher' ? voteNote_(C) : '' }; });
        snap.cup = aw.cupTable.map(function (x) { return { name: x.name, club: x.club, pts: x.pts }; });
        snap.bank = null;
        try { snap.wallet = walletBoard_(C); } catch (e) { snap.wallet = null; }
        snap.wagers = wagerOn_(C) ? wagerBoard_(C) : null;
        try { snap.items = itemsOn_(C) ? itemBoard_(C) : null; } catch (e) { snap.items = null; }
        try { snap.streaks = itemsOn_(C) ? streakBoard_(C) : null; } catch (e) { snap.streaks = null; }
        if (bookOn_(C)) { try { const DB = dayBook_(); snap.day = DB ? { day: DB.day, at: DB.at, ends: DB.ends, props: DB.props, done: dayDecided_(DB), live: titleLive_(), ace: DB.ace.map(function (r) { return { name: r.name, club: r.club, rank: r.rank, hold: !!r.hold, field: r.email === 'field', pct: r.pct, odds: r.odds }; }) } : null;   /* no emails on the public board */ } catch (e) { snap.day = null; } snap.book = null; const fu = futures_(); snap.futures = fu ? { at: fu.at, rows: fu.rows.map(function (x) { return { name: x.name, club: x.club, rank: x.rank, pct: x.pct, odds: x.odds, move: x.move }; }) } : null; }
      } catch (e) { log_('system', 'Awards error', String(e)); }
    }
    try { snap.farm = farmReady_() ? withLad_('farm', farmSnap_) : null; } catch (e) { log_('system', 'Farm board error', String(e)); }
    sh.getRange('A1').setValue(JSON.stringify(snap));
    ghPush_(snap);
  } catch (e) { log_('system', 'Board snapshot error', String(e)); }
}


// The 🌱 Farm Hill's part of the leaderboard: its Ace, ladder, open charges, recent results and its own mound and Bell.
function farmSnap_() {
  const C = cfg_(), pt = players_(), fm = farmStarsMap_();
  const iso = function (d) { return d ? new Date(d).toISOString() : ''; };
  const pub = function (p) { const rs = restUntil_(p.Email); return { name: norm_(p.Discord), club: norm_(p.Club), clubId: norm_(p.ClubID), stars: fm[norm_(p.ClubID)], opt: Number(p.Rank) > 0 ? oppLabel_(p) : '', rest: rs ? rs.toISOString() : '', rank: p.Rank, w: num_(p.Wins), l: num_(p.Losses), defenses: num_(p.Defenses), reigns: num_(p.Reigns), pts: num_(p.CareerPts) }; };
  const ace = ace_(pt), cur = currentReign_(readTable_(SHEETS.REIGNS));
  const B = bellState_(C);
  return {
    max: farmMax_(C), aceChoice: FARM_ACE_CHOICE,
    ace: ace ? Object.assign(pub(ace), cur ? { reign: cur.Reign, since: iso(cur.Start), rdef: num_(cur.Defenses), rpts: num_(cur.ReignPts), next: reward_(num_(cur.Defenses) + 1, C) } : {}) : null,
    ladder: ladder_(pt).map(pub),
    charges: challenges_().rows.filter(function (c) { return OPEN.indexOf(c.Status) >= 0; }).map(function (c) { return { type: c.Type, ch: norm_(c.ChallengerName), df: norm_(c.DefenderName), created: iso(c.Created), deadline: iso(c.Deadline), status: c.Status === 'Started' ? 'Game reported' : c.Status === 'Review' ? 'With the commish' : 'Waiting on the game' }; }),
    matches: readTable_(SHEETS.MATCHES).rows.slice(-10).reverse().map(function (m) { return { date: iso(m.Date), type: m.Type, w: norm_(m.Winner), l: norm_(m.Loser), wr: m.WinnerRuns, lr: m.LoserRuns, outcome: norm_(m.Outcome), game: norm_(m.GameID) }; }),
    calledUp: pt.rows.filter(function (p) { return p.Status === 'Called up'; }).map(function (p) { return { name: norm_(p.Discord), club: norm_(p.Club), clubId: norm_(p.ClubID) }; }),
    moundOpenTo: moundOpenTo_(C), moundNextAt: (function () { try { const a = moundNextAt_(C); return a ? a.toISOString() : ''; } catch (e) { return ''; } })(), moundMax: Number(C.MOUND_OPEN_MAX) || 1,
    moundFirst: fmtHrs_(hrsOf_(C.MOUND_FIRST_HOURS, 4 + 1 / 3)), moundStep: fmtHrs_(hrsOf_(C.MOUND_STEP_HOURS, 4 + 1 / 3)),
    bell: B.on ? { open: B.open && !B.used, answered: B.open && B.used, until: iso(B.until), soon: B.soon, next: B.soon ? iso(B.next) : '', margin: Number(C.BELL_MARGIN) || 3, shield: iso(B.shield) } : null,
  };
}

// ===================== The HtH Leaderboard on GitHub Pages =====================
// The token lives in Script Properties (never on a tab). Each change to the board is saved as one JSON file in the
// repo; the page next to it reads that file. Nothing is sent when the board hasn't changed.
function ghPush_(snap, force) {
  const pr = PropertiesService.getScriptProperties(), tok = pr.getProperty('GITHUB_TOKEN');
  if (!tok || pr.getProperty('GH_BAD')) return false;   // a dead key stays quiet until it's reconnected
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
    else if (g.getResponseCode() === 401 || g.getResponseCode() === 403) { pr.setProperty('GH_BAD', '1'); log_('system', 'GitHub key stopped working', 'GitHub said ' + g.getResponseCode() + '. The live page is paused: make a key (or reuse your current one) and use the menu: 🐙 Connect again.'); return false; }
    else if (g.getResponseCode() !== 404) { log_('system', 'GitHub read failed', g.getResponseCode() + ' ' + g.getContentText().slice(0, 200)); return false; }
    const payload = { message: 'HtH Leaderboard update', content: Utilities.base64Encode(body, Utilities.Charset.UTF_8) };
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
  const r = ui.prompt('Connect the GitHub HtH Leaderboard',
    'Paste a GitHub fine-grained token with "Contents: Read and write" on ' + (norm_(cfg_().GITHUB_REPO) || 'slipnsliders/smallball-tools') + ' only.\n' +
    'It is kept in the script\'s private settings, not on any tab. Leave it blank and click OK to disconnect.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  withUi_(function () {
    const pr = PropertiesService.getScriptProperties(), tok = norm_(r.getResponseText());
    if (!tok) { pr.deleteProperty('GITHUB_TOKEN'); pr.deleteProperty('GH_HASH'); pr.deleteProperty('GH_BAD'); return 'GitHub disconnected. The board stays on the Google web app.'; }
    pr.setProperty('GITHUB_TOKEN', tok); pr.deleteProperty('GH_HASH'); pr.deleteProperty('GH_BAD');
    snapshotBoard_();
    if (!pr.getProperty('GH_HASH')) return 'GitHub didn\'t accept that token. Check it has Contents: Read and write on the repo, then try again (the Log tab has the details).';
    const url = ghPageUrl_(cfg_());
    setCfg_('BOARD_LINK', url);
    return 'Connected! The HtH Leaderboard is now at ' + url + ' (give GitHub a minute the first time). Discord posts link there, and the old board link forwards there once you deploy a new version of the web app.';
  });
}

// Once the board lives on GitHub, the old web app link (and any short link to it) forwards there.
function redirectPage_(url) {
  const u = String(url).replace(/"/g, '&quot;');
  return HtmlService.createHtmlOutput('<!doctype html><html><head><meta charset="utf-8"><base target="_top">' +
    '<style>body{margin:0;background:#0E1B33;color:#F4EBD9;font:500 17px/1.5 Oswald,system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;text-align:center}a{display:inline-block;margin-top:14px;background:#C8102E;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600}</style></head>' +
    '<body><div>⛰️ The HtH Leaderboard moved to a faster home.<br><a href="' + u + '">Open the HtH Leaderboard →</a></div>' +
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

// ───────────────────────────── 🎛️ Commish dashboard ─────────────────────────────
// A panel in the Sheet (menu: 🎛️ Commish dashboard) with the settings people tune most, in plain words, plus live
// status and a few buttons. Only people who can edit the Sheet can open it. Saving writes the Config tab.
const DASH_GROUPS_ = [
  { id: 'bell', title: '🔔 The Bell', blurb: 'A few random one-hour windows a week when anyone on the climb can charge the Ace.', items: [
    { k: 'BELL_PER_WEEK', label: 'Rings a week', t: 'range', min: 0, max: 7, step: 1, unit: '', help: '0 turns the Bell off.' },
    { k: 'BELL_MINUTES', label: 'How long it rings', t: 'range', min: 15, max: 120, step: 15, unit: 'min' },
    { k: 'BELL_MARGIN', label: 'Win by, to take the title', t: 'range', min: 1, max: 6, step: 1, unit: 'runs', help: 'A smaller win makes the challenger #1 contender.' },
    { k: 'BELL_BOUNTY', label: 'Ace bounty for a defense', t: 'range', min: 0, max: 200, step: 10, unit: 'BB' },
    { k: 'BELL_SHIELD_HOURS', label: 'Ace shield after a defense', t: 'range', min: 0, max: 96, step: 6, unit: 'hrs' },
    { k: 'BELL_GAP_HOURS', label: 'At least this long between rings', t: 'range', min: 12, max: 96, step: 6, unit: 'hrs' },
    { k: 'BELL_WARN_MINUTES', label: 'Heads-up before it rings', t: 'range', min: 0, max: 60, step: 5, unit: 'min' },
    { k: 'BELL_WEEKDAY', label: 'Weekday windows (Mon–Fri)', t: 'windows', help: 'Mountain time, like 06:30-08:00, 11:30-13:00' },
    { k: 'BELL_WEEKEND', label: 'Weekend windows (Sat–Sun)', t: 'windows' },
    { k: 'BELL_ROLE_ID', label: 'Discord role to ping', t: 'text', help: 'The role ID of an opt-in "Mound Alerts" role. Blank = no ping.' },
  ] },
  { id: 'mound', title: '⏰ Open mound', blurb: 'Who can charge the Ace when nobody has for a while.', items: [
    { k: 'MOUND_FIRST_HOURS', label: '#2 can charge the Ace after (hours; 4.33 = 4h 20m)', t: 'range', min: 0.5, max: 48, step: 0.0833, unit: 'hrs' },
    { k: 'MOUND_STEP_HOURS', label: 'Then one more spot every (hours; 4.33 = 4h 20m)', t: 'range', min: 0.5, max: 72, step: 0.0833, unit: 'hrs' },
    { k: 'MOUND_OPEN_MAX', label: 'Opens down to spot', t: 'range', min: 1, max: 10, step: 1, unit: '#' },
    { k: 'MOUND_QUIET', label: 'Never opens wider during', t: 'windows', help: 'Mountain time, like 22:30-06:30. Blank = any time.' },
  ] },
  { id: 'ladder', title: '🥊 Ladder & charges', blurb: 'The basic rules of the climb.', items: [
    { k: 'CHALLENGE_REACH', label: 'Charge up to this many spots above you', t: 'range', min: 1, max: 6, step: 1, unit: 'spots' },
    { k: 'MATCH_HOURS', label: 'Time to start the game after a charge', t: 'range', min: 1, max: 6, step: 1, unit: 'hrs' },
    { k: 'COOLDOWN_HOURS', label: 'Rematch cooldown', t: 'range', min: 0, max: 72, step: 6, unit: 'hrs' },
    { k: 'BASE_REWARD', label: 'Points for the first defense', t: 'range', min: 5, max: 50, step: 5, unit: 'pts' },
    { k: 'DOUBLE_UNTIL', label: 'Defense points double through defense #', t: 'range', min: 1, max: 10, step: 1, unit: '' },
    { k: 'REVENGE_THRESHOLD', label: "Reign points to earn the Ace's Revenge", t: 'range', min: 100, max: 1000, step: 50, unit: 'pts' },
    { k: 'EX_ACE_RANK', label: 'A dethroned Ace drops to', t: 'range', min: 1, max: 10, step: 1, unit: '#' },
    { k: 'ACE_LOSS_RANK', label: '🩹 Lose a charge at the Ace: drop to', t: 'range', min: 2, max: 10, step: 1, unit: '#' },
    { k: 'ACE_LOSS_REST_HOURS', label: '🩹 …and recover this long', t: 'range', min: 0, max: 12, step: 0.1, unit: 'hrs' },
    { k: 'ACE_LOSS_REST_KNUCKLES_HOURS', label: '🩹 …or this long if the Ace wore 🥊 Brass Knuckles', t: 'range', min: 0, max: 12, step: 1, unit: 'hrs' },
    { k: 'TIE_RULE', label: 'A tie', t: 'choice', options: [['HOLD', 'Defender holds'], ['REPLAY', 'Play again']] },
    { k: 'FARM_ON', label: '🌱 Farm Hill open', t: 'choice', options: [['true', 'Open'], ['false', 'Closed']] },
    { k: 'FARM_MAX_STARS', label: '🌱 Farm Hill: clubs up to', t: 'range', min: 1, max: 9, step: 1, unit: '★' },
  ] },
  { id: 'bucks', title: '💰 Brawl Bucks', blurb: 'What players earn and what the shop costs.', items: [
    { k: 'PLAY_BUCKS', label: 'Pay for a Hill game', t: 'pairs', parts: [['played', 'Both clubs'], ['win', 'Winner extra'], ['charge', 'Challenger extra']] },
    { k: 'PAID_GAMES_PER_DAY', label: 'Paid Hill games a day (0 = no limit)', t: 'range', min: 0, max: 10, step: 1, unit: 'games' },
    { k: 'STREAK_BUCKS', label: '🔥 Streak pay', t: 'pairs', parts: [['day', 'Any day played'], ['step', '+ per day in a row'], ['max', 'Streak extra tops out at']] },
    { k: 'STREAK_MILESTONES', label: '🔥 Streak milestones', t: 'text', help: 'days:BB, like 3:25,7:75,14:150' },
    { k: 'BOOK_BANKROLL', label: 'Starting Brawl Bucks', t: 'number', min: 0, max: 100000 },
    { k: 'ITEMS_ON', label: '🛒 Items shop', t: 'toggle' },
    { k: 'ITEM_PRICES', label: 'Item prices', t: 'pairs', parts: [['knuckles', '🥊 Brass Knuckles'], ['eraser', '🧽 Margin Eraser'], ['jump', '🪜 Ladder Jump'], ['jumpplus', '🪜 Ladder Jump+'], ['rain', '🌧️ Rain Delay']] },
    { k: 'ITEM_ACE_X', label: 'The Ace pays this many times the price', t: 'range', min: 1, max: 4, step: 0.5, unit: '×' },
    { k: 'ITEM_COOLDOWN_HOURS', label: 'Hours between items', t: 'range', min: 0, max: 72, step: 6, unit: 'hrs' },
  ] },
  { id: 'book', title: '🎰 Sportsbook & wagers', blurb: 'Play-money betting limits.', items: [
    { k: 'BOOK_ON', label: 'Sportsbook', t: 'toggle' },
    { k: 'WAGER_ON', label: 'Head-to-head wagers', t: 'toggle' },
    { k: 'BET_MAX_PCT', label: 'Biggest bet, % of Brawl Bucks', t: 'range', min: 1, max: 100, step: 0.1, unit: '%' },
    { k: 'BET_MAX_FLAT', label: 'Never more than', t: 'range', min: 50, max: 1000, step: 50, unit: 'BB' },
    { k: 'WAGER_MAX_PCT', label: 'Biggest wager, % of Brawl Bucks', t: 'range', min: 1, max: 20, step: 0.1, unit: '%' },
    { k: 'WAGER_BIG_PCT', label: 'With your OK, up to', t: 'range', min: 5, max: 50, step: 1, unit: '%' },
    { k: 'BOOK_POST_BETS', label: 'Post each bet in Discord', t: 'toggle' },
  ] },
  { id: 'discord', title: '📣 Discord', blurb: 'Callouts and posts.', items: [
    { k: 'NUDGES', label: 'Callouts for idle clubs', t: 'toggle' },
    { k: 'NUDGE_HOURS', label: 'Callout hours (0–23, Mountain)', t: 'text', help: 'Like 11,17,21' },
    { k: 'NUDGE_IDLE_HOURS', label: 'Call out after this long idle', t: 'range', min: 6, max: 96, step: 6, unit: 'hrs' },
    { k: 'POST_REJECTIONS', label: 'Post rejected submissions', t: 'toggle' },
    { k: 'LADDER_POST_SIZE', label: 'Contenders shown in standings posts', t: 'range', min: 5, max: 30, step: 1, unit: '' },
  ] },
  { id: 'season', title: '📅 Season', blurb: 'Dates and prizes.', items: [
    { k: 'SEASON_START', label: 'Season opens', t: 'datetime' },
    { k: 'SEASON_END', label: 'Season ends', t: 'datetime' },
    { k: 'VOTE_DAYS', label: '🏟️ Bleacher Vote opens this many days before the end', t: 'range', min: 1, max: 14, step: 1, unit: 'days' },
    { k: 'PRIZES', label: 'Prizes', t: 'text' },
  ] },
];
const DASH_BELL_KEYS_ = ['BELL_PER_WEEK', 'BELL_MINUTES', 'BELL_WEEKDAY', 'BELL_WEEKEND', 'BELL_GAP_HOURS'];
function adminDashboard() {
  const html = HtmlService.createHtmlOutput(DASH_HTML_).setWidth(980).setHeight(720);
  SpreadsheetApp.getUi().showModelessDialog(html, '🎛️ Commish dashboard');
}
function dashFmt_(d) { return d ? Utilities.formatDate(new Date(d), 'America/Denver', "EEE MMM d, h:mm a") + ' MT' : ''; }
function dashStatus_(C) {
  const pt = players_(), ace = ace_(pt), B = bellState_(C);
  return {
    ace: ace ? norm_(ace.Discord) + ' · ' + norm_(ace.Club) : 'No Ace right now',
    mound: moundOpenTo_(C) === 1 ? 'Only #1 can charge the Ace' : '#1–#' + moundOpenTo_(C) + ' can charge the Ace',
    moundNext: moundNext_(C).replace(/\*/g, ''),
    bell: !B.on ? 'Off' + (PropertiesService.getScriptProperties().getProperty('BELL_PAUSED_PER') ? ' (paused)' : '') :
      B.open ? (B.used ? 'Ringing until ' + dashFmt_(B.until) + ' · answered' : 'RINGING until ' + dashFmt_(B.until)) :
      B.next ? 'Next ring: ' + dashFmt_(B.next) : 'Picking the next time…',
    shield: B.shield ? 'Ace shield until ' + dashFmt_(B.shield) : '',
    paused: !!PropertiesService.getScriptProperties().getProperty('BELL_PAUSED_PER'),
    players: ladder_(pt).length + (ace ? 1 : 0),
  };
}
function dashData() {
  const C = cfg_(), vals = {};
  DASH_GROUPS_.forEach(function (g) { g.items.forEach(function (it) { vals[it.k] = C[it.k]; }); });
  return { groups: DASH_GROUPS_, values: vals, status: dashStatus_(C), notes: Object.keys(vals).reduce(function (o, k) { o[k] = (DEFAULTS[k] || ['', ''])[1]; return o; }, {}) };
}
function dashClean_(it, v) {
  const s = String(v == null ? '' : v).trim();
  if (it.t === 'range' || it.t === 'number') {
    const n = Number(s); if (!isFinite(n)) throw new Error(it.label + ': not a number');
    return Math.max(it.min, Math.min(it.max, n));
  }
  if (it.t === 'toggle') return /^(true|1|on|yes)$/i.test(s) ? 'TRUE' : 'FALSE';
  if (it.t === 'choice') { if (!it.options.some(function (o) { return o[0] === s; })) throw new Error(it.label + ': pick one of the options'); return s; }
  if (it.t === 'windows') {
    if (!s) return '';
    s.split(',').forEach(function (w) { if (!/^\s*\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\s*$/.test(w)) throw new Error(it.label + ': "' + w.trim() + '" should look like 06:30-08:00'); });
    return s.split(',').map(function (w) { return w.replace(/\s+/g, ''); }).join(', ');
  }
  if (it.t === 'datetime') { if (!/^\d{4}-\d{2}-\d{2} \d{1,2}:\d{2}$/.test(s)) throw new Error(it.label + ': use YYYY-MM-DD HH:MM'); return s; }
  if (it.t === 'pairs') {
    const out = s.split(',').map(function (x) { const kv = x.split(':'); const n = Number(kv[1]); if (!kv[0] || !isFinite(n)) throw new Error(it.label + ': bad value ' + x); return kv[0].trim() + ':' + Math.max(0, n); });
    return out.join(',');
  }
  return s;
}
function dashSave(changes) {
  const lock = LockService.getScriptLock(); lock.waitLock(150000);
  try {
    const C = cfg_(), who = Session.getActiveUser().getEmail() || 'commish', done = [];
    const byKey = {}; DASH_GROUPS_.forEach(function (g) { g.items.forEach(function (it) { byKey[it.k] = it; }); });
    Object.keys(changes || {}).forEach(function (k) {
      const it = byKey[k]; if (!it) throw new Error('Not a dashboard setting: ' + k);
      const v = dashClean_(it, changes[k]);
      if (String(v) === String(C[k])) return;
      setCfg_(k, it.t === 'range' || it.t === 'number' ? v : (it.t === 'datetime' ? v : v));
      done.push(it.label + ': ' + (C[k] === '' ? '(blank)' : C[k]) + ' → ' + (v === '' ? '(blank)' : v));
      log_(who, 'Dashboard', k + ': ' + C[k] + ' → ' + v);
    });
    if (done.length && Object.keys(changes).some(function (k) { return DASH_BELL_KEYS_.indexOf(k) >= 0; })) {
      const C2 = cfg_(); if (!bellState_(C2).open) { setCfg_('STATE_BELL_NEXT', ''); setCfg_('STATE_BELL_WARNED', ''); try { bellTick_(cfg_()); } catch (e) { } }
    }
    if (done.length) { try { snapshotBoard_(); } catch (e) { } }
    return { done: done, data: dashData() };
  } finally { lock.releaseLock(); }
}
function dashAction(name) {
  const lock = LockService.getScriptLock(); lock.waitLock(150000);
  let msg = '';
  try {
    const props = PropertiesService.getScriptProperties(), who = Session.getActiveUser().getEmail() || 'commish';
    let C = cfg_();
    if (name === 'ring') {
      if (!ace_(players_())) throw new Error('There is no Ace to ring the Bell for.');
      if (bellState_(C).open) throw new Error('The Bell is already ringing.');
      if (Number(C.BELL_PER_WEEK) <= 0) throw new Error('The Bell is off. Resume it (or set Rings a week above 0) first.');
      setCfg_('STATE_BELL_SHIELD', ''); setCfg_('STATE_BELL_WARNED', ''); setCfg_('STATE_BELL_NEXT', new Date(now_().getTime() - 1000).toISOString());
      bellTick_(cfg_());
      msg = '🔔 The Bell is ringing. Discord has the post.';
    } else if (name === 'skip') {
      const B = bellState_(C);
      if (!B.next) throw new Error('No Bell is scheduled right now.');
      const nx = bellPick_(C, new Date(B.next.getTime() + 3 * 3600000));
      setCfg_('STATE_BELL_NEXT', nx ? nx.toISOString() : ''); setCfg_('STATE_BELL_WARNED', '');
      msg = 'Skipped ' + dashFmt_(B.next) + '. ' + (nx ? 'Next ring: ' + dashFmt_(nx) + '.' : '');
    } else if (name === 'pause') {
      if (Number(C.BELL_PER_WEEK) <= 0) throw new Error('The Bell is already off.');
      props.setProperty('BELL_PAUSED_PER', String(C.BELL_PER_WEEK));
      setCfg_('BELL_PER_WEEK', 0); bellTick_(cfg_());
      msg = '⏸️ The Bell is paused. Resume brings back ' + C.BELL_PER_WEEK + ' a week.';
    } else if (name === 'resume') {
      const per = Number(props.getProperty('BELL_PAUSED_PER')) || 3;
      props.deleteProperty('BELL_PAUSED_PER');
      setCfg_('BELL_PER_WEEK', per); bellTick_(cfg_());
      msg = '▶️ The Bell is back: ' + per + ' a week.';
    } else if (name === 'board') {
      snapshotBoard_(); msg = '📊 The Live Hold the Hill Leaderboard is updated.';
    } else throw new Error('Unknown button.');
    log_(who, 'Dashboard', name + ': ' + msg);
    try { snapshotBoard_(); } catch (e) { }
    return { msg: msg, data: dashData() };
  } finally { lock.releaseLock(); }
}
const DASH_HTML_ = `<!DOCTYPE html><html><head><base target="_top"><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;background:#0e1b33;color:#f4ebd9;font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.top{position:sticky;top:0;z-index:5;background:#0e1b33;padding:12px 16px 10px;border-bottom:1px solid rgba(255,255,255,.12)}
.stat{display:flex;flex-wrap:wrap;gap:8px}.chip{background:rgba(255,255,255,.08);border-radius:999px;padding:6px 12px;font-size:13px}.chip b{color:#fde68a}
.chip.hot{background:#facc15;color:#1b1300}.chip.hot b{color:#1b1300}
.acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
button{font:700 13px/1 system-ui,sans-serif;border:0;border-radius:999px;padding:9px 14px;cursor:pointer;background:rgba(255,255,255,.12);color:inherit}
button.gold{background:#facc15;color:#1b1300}button.red{background:#c8102e;color:#fff}button:disabled{opacity:.45;cursor:default}
.tabs{display:flex;flex-wrap:wrap;gap:6px;padding:10px 16px 0}.tabs button{background:transparent;border:1px solid rgba(255,255,255,.2)}.tabs button.on{background:#f4ebd9;color:#0e1b33}
.wrap{padding:12px 16px 90px}.blurb{opacity:.75;margin:2px 0 12px}
.row{display:grid;grid-template-columns:minmax(200px,1.1fr) 2fr;gap:6px 16px;align-items:center;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.04);margin-bottom:6px}
.row.ch{background:rgba(250,204,21,.12);outline:1px solid rgba(250,204,21,.5)}
.row label{font-weight:700}.row .h{grid-column:1/-1;font-size:12px;opacity:.65;margin-top:-2px}
.ctl{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.ctl input[type=range]{flex:1;min-width:160px;accent-color:#facc15}
.val{min-width:72px;font-weight:800;color:#fde68a;text-align:right}
input[type=text],input[type=number],input[type=datetime-local],select{font:inherit;background:#13254a;color:#f4ebd9;border:1px solid rgba(255,255,255,.25);border-radius:8px;padding:6px 9px}
input[type=text]{width:100%}.pair{display:flex;flex-direction:column;gap:2px;font-size:12px}.pair input{width:110px}
.sw{position:relative;width:46px;height:26px;border-radius:999px;background:#475569;cursor:pointer;flex:none}.sw.on{background:#16a34a}.sw::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:left .15s}.sw.on::after{left:23px}
.bar{position:fixed;left:0;right:0;bottom:0;display:flex;gap:10px;align-items:center;padding:10px 16px;background:#13254a;border-top:1px solid rgba(255,255,255,.15)}
.bar .msg{flex:1;font-size:13px}.ok{color:#86efac}.err{color:#fca5a5}
.modal{position:fixed;inset:0;background:rgba(0,0,0,.55);display:none;place-items:center;z-index:9}.modal.on{display:grid}.box{background:#13254a;border-radius:14px;padding:18px;max-width:440px}.box p{margin:0 0 14px}
</style></head><body>
<div class="top"><div class="stat" id="stat">Loading…</div><div class="acts" id="acts"></div></div>
<div class="tabs" id="tabs"></div><div class="wrap" id="wrap"></div>
<div class="bar"><span class="msg" id="msg">Change anything, then press Save. Nothing changes until you do.</span><button id="undo">Undo changes</button><button class="gold" id="save" disabled>Save</button></div>
<div class="modal" id="modal"><div class="box"><p id="mq"></p><div style="display:flex;gap:8px;justify-content:flex-end"><button id="mno">Cancel</button><button class="gold" id="myes">Yes, do it</button></div></div></div>
<script>
var D=null,cur={},tab='bell',busy=false;
function $(id){return document.getElementById(id);}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function load(){google.script.run.withSuccessHandler(function(d){D=d;cur={};render();}).withFailureHandler(fail).dashData();}
function fail(e){busy=false;$('msg').innerHTML='<span class="err">'+esc(e&&e.message||e)+'</span>';setBusy(false);}
function changed(){var n=0;for(var k in cur){if(String(cur[k])!==String(D.values[k]))n++;}return n;}
function val(k){return k in cur?cur[k]:D.values[k];}
function pairsGet(s){var o={};String(s||'').split(',').forEach(function(x){var kv=x.split(':');if(kv[0])o[kv[0].trim()]=kv[1];});return o;}
function dtToInput(s){var m=String(s||'').match(/^(\\d{4}-\\d{2}-\\d{2}) (\\d{1,2}):(\\d{2})/);if(!m)return '';return m[1]+'T'+(m[2].length<2?'0'+m[2]:m[2])+':'+m[3];}
function status(){var s=D.status;var hot=/RINGING/.test(s.bell);
 $('stat').innerHTML='<span class="chip">♠ <b>'+esc(s.ace)+'</b></span><span class="chip">⏰ '+esc(s.mound)+'</span>'+(s.moundNext?'<span class="chip">'+esc(s.moundNext)+'</span>':'')+'<span class="chip'+(hot?' hot':'')+'">🔔 <b>'+esc(s.bell)+'</b></span>'+(s.shield?'<span class="chip">🛡️ '+esc(s.shield)+'</span>':'')+'<span class="chip">'+s.players+' on the Hill</span>';
 $('acts').innerHTML='<button class="gold" data-a="ring">🔔 Ring the Bell now</button><button data-a="skip">⏭️ Skip the next Bell</button>'+(s.paused?'<button data-a="resume">▶️ Resume the Bell</button>':'<button data-a="pause">⏸️ Pause the Bell</button>')+'<button data-a="board">📊 Update the leaderboard</button><button data-a="refresh">🔄 Refresh</button>';
 Array.prototype.forEach.call(document.querySelectorAll('[data-a]'),function(b){b.onclick=function(){act(b.getAttribute('data-a'));};});}
var Q={ring:'Ring the Bell right now? For the next hour anyone on the climb can charge the Ace, and Discord gets the post. It also clears the Ace shield.',skip:'Skip the next scheduled Bell? A new time gets picked after it.',pause:'Pause the Bell? No rings until you resume.',resume:'Turn the Bell back on?',board:'Update the Live Hold the Hill Leaderboard now?'};
function ask(q,yes){$('mq').textContent=q;$('modal').className='modal on';$('myes').onclick=function(){$('modal').className='modal';yes();};$('mno').onclick=function(){$('modal').className='modal';};}
function act(a){if(a==='refresh'){load();return;}ask(Q[a],function(){setBusy(true);$('msg').textContent='Working…';google.script.run.withSuccessHandler(function(r){D=r.data;setBusy(false);status();$('msg').innerHTML='<span class="ok">'+esc(r.msg)+'</span>';}).withFailureHandler(fail).dashAction(a);});}
function setBusy(b){busy=b;Array.prototype.forEach.call(document.querySelectorAll('button'),function(x){if(x.id!=='mno'&&x.id!=='myes')x.disabled=b;});if(!b)$('save').disabled=!changed();}
function render(){status();
 $('tabs').innerHTML=D.groups.map(function(g){return '<button class="'+(g.id===tab?'on':'')+'" data-t="'+g.id+'">'+esc(g.title)+'</button>';}).join('');
 Array.prototype.forEach.call(document.querySelectorAll('[data-t]'),function(b){b.onclick=function(){tab=b.getAttribute('data-t');render();};});
 var g=D.groups.filter(function(x){return x.id===tab;})[0];
 var h='<div class="blurb">'+esc(g.blurb)+'</div>';
 g.items.forEach(function(it){var v=val(it.k),c=(it.k in cur&&String(cur[it.k])!==String(D.values[it.k]));h+='<div class="row'+(c?' ch':'')+'"><label>'+esc(it.label)+'</label><div class="ctl">'+ctl(it,v)+'</div>'+(it.help||D.notes[it.k]?'<div class="h">'+esc(it.help||D.notes[it.k])+'</div>':'')+'</div>';});
 $('wrap').innerHTML=h;wire(g);$('save').disabled=busy||!changed();
 var n=changed();if(n)$('msg').textContent=n+' unsaved change'+(n>1?'s':'')+'. Press Save to keep '+(n>1?'them':'it')+'.';}
function ctl(it,v){
 if(it.t==='range')return '<input type="range" min="'+it.min+'" max="'+it.max+'" step="'+it.step+'" value="'+esc(v)+'" data-k="'+it.k+'"><span class="val">'+esc(v)+' '+esc(it.unit||'')+'</span>';
 if(it.t==='number')return '<input type="number" min="'+it.min+'" max="'+it.max+'" value="'+esc(v)+'" data-k="'+it.k+'">';
 if(it.t==='toggle')return '<div class="sw'+(/^true$/i.test(v)?' on':'')+'" data-k="'+it.k+'" data-sw="1"></div><span>'+(/^true$/i.test(v)?'On':'Off')+'</span>';
 if(it.t==='choice')return '<select data-k="'+it.k+'">'+it.options.map(function(o){return '<option value="'+o[0]+'"'+(o[0]===v?' selected':'')+'>'+esc(o[1])+'</option>';}).join('')+'</select>';
 if(it.t==='datetime')return '<input type="datetime-local" value="'+dtToInput(v)+'" data-k="'+it.k+'" data-dt="1"> <span style="opacity:.7">Mountain time</span>';
 if(it.t==='pairs'){var o=pairsGet(v);return it.parts.map(function(p){return '<span class="pair">'+esc(p[1])+'<input type="number" min="0" value="'+esc(o[p[0]]==null?'':o[p[0]])+'" data-k="'+it.k+'" data-p="'+p[0]+'"></span>';}).join('');}
 return '<input type="text" value="'+esc(v)+'" data-k="'+it.k+'">';}
function wire(g){
 Array.prototype.forEach.call(document.querySelectorAll('#wrap [data-k]'),function(el){var k=el.getAttribute('data-k'),it=g.items.filter(function(x){return x.k===k;})[0];
  if(el.getAttribute('data-sw')){el.onclick=function(){cur[k]=/^true$/i.test(val(k))?'FALSE':'TRUE';render();};return;}
  if(el.getAttribute('data-p')){el.onchange=function(){var o=pairsGet(val(k));o[el.getAttribute('data-p')]=el.value;cur[k]=it.parts.map(function(p){return p[0]+':'+(o[p[0]]==null?0:o[p[0]]);}).concat(Object.keys(o).filter(function(x){return !it.parts.some(function(p){return p[0]===x;});}).map(function(x){return x+':'+o[x];})).join(',');render();};return;}
  if(el.getAttribute('data-dt')){el.onchange=function(){cur[k]=el.value.replace('T',' ');render();};return;}
  if(el.type==='range'){el.oninput=function(){el.nextElementSibling.textContent=el.value+' '+(it.unit||'');};el.onchange=function(){cur[k]=Number(el.value);render();};return;}
  el.onchange=function(){cur[k]=el.type==='number'?Number(el.value):el.value;render();};});}
$('save').onclick=function(){var ch={};for(var k in cur){if(String(cur[k])!==String(D.values[k]))ch[k]=cur[k];}if(!Object.keys(ch).length)return;setBusy(true);$('msg').textContent='Saving…';
 google.script.run.withSuccessHandler(function(r){D=r.data;cur={};setBusy(false);render();$('msg').innerHTML='<span class="ok">✓ Saved: '+esc(r.done.join(' · ')||'nothing changed')+'</span>';}).withFailureHandler(fail).dashSave(ch);};
$('undo').onclick=function(){cur={};render();$('msg').textContent='Changes undone.';};
load();setInterval(function(){if(!busy&&!changed())google.script.run.withSuccessHandler(function(d){D=d;status();}).dashData();},60000);
</script></body></html>`;
function adminRefreshBoard() { try { prefillInfo_(cfg_()); } catch (e) { } withUi_(function () { snapshotBoard_(); return 'Board updated.'; }); }

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
.tabs{position:sticky;top:0;z-index:5;display:flex;gap:6px;flex-wrap:wrap;padding:10px 0 8px;margin-top:6px;background:#0E1B33;border-bottom:2px solid rgba(244,235,217,.12)}
.tabs a{color:#F4EBD9;text-decoration:none;padding:6px 14px;border:2px solid rgba(244,235,217,.25);font-family:'Bebas Neue',Impact,sans-serif;font-size:20px;letter-spacing:.05em}
.tabs a.on{background:#C8102E;border-color:#C8102E}
.pane{display:none}.pane.on{display:block}
.wal{width:100%;border-collapse:collapse;font-size:15px}.wal th{text-align:left;font-weight:500;font-size:12px;letter-spacing:.08em;opacity:.6;padding:4px 8px;text-transform:uppercase}
.wal td{padding:7px 8px;border-top:1px solid rgba(244,235,217,.1)}.wal td.n{font-family:'Bebas Neue',Impact,sans-serif;font-size:20px;letter-spacing:.03em}
.wal td.n small{display:block;font-family:Oswald,sans-serif;font-size:12px;opacity:.6;letter-spacing:0}.wal td.bk{font-family:'Bebas Neue',Impact,sans-serif;font-size:22px;color:#ffd166;text-align:right}
.wal td.r{opacity:.5;width:28px}.wal .it{font-size:18px;white-space:nowrap}
.shop{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px;margin-top:6px}.shop div{background:rgba(244,235,217,.06);border-left:3px solid #ffd166;padding:6px 10px}
.shop b{float:right;color:#ffd166;font-family:'Bebas Neue',Impact,sans-serif;font-size:20px;font-weight:400}.shop small{display:block;opacity:.7;font-size:12px}
.note{font-size:13px;opacity:.72;margin:6px 0}
body{background-color:#0E1B33;background-image:repeating-linear-gradient(90deg,rgba(244,235,217,.022) 0 1px,transparent 1px 26px),radial-gradient(rgba(255,255,255,.035) 1px,transparent 1px);background-size:auto,4px 4px}
.cup{background-image:repeating-linear-gradient(135deg,rgba(255,255,255,.018) 0 2px,transparent 2px 7px),linear-gradient(180deg,rgba(255,209,102,.16),rgba(244,235,217,.04))}
.cup .r{padding:6px 10px;border-bottom:0}.cup .r:nth-child(odd){background:rgba(8,16,32,.38)}.cup .r:nth-child(even){background:rgba(244,235,217,.06)}
.cup .r:hover{background:rgba(255,209,102,.16)}
.cup .r.hd,.cup .r.hd:hover{background:none;font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.6;padding-bottom:2px}.cup .r.hd b{background:none;color:inherit;font-weight:500}
.r.ml{grid-template-columns:minmax(0,1fr) 74px minmax(0,1fr) 74px !important}
.r.ml b{text-align:center;background:rgba(0,0,0,.28);border:1px solid rgba(244,235,217,.12);padding:1px 0;font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;font-size:19px;letter-spacing:.03em}
.fv,.cup .r.ml b.fv{color:#ffd166}.dg,.cup .r.ml b.dg{color:#86efac}
.cup .r.ml.hd b{background:none;border:0;font-family:Oswald,sans-serif;font-size:11px;letter-spacing:.12em;color:inherit}
.wal tr:nth-child(even) td{background:rgba(244,235,217,.055)}.wal tr:nth-child(odd) td{background:rgba(8,16,32,.3)}.wal tr:first-child td{background:none}.wal tr:hover td{background:rgba(255,209,102,.13)}
.wal{border:1px solid rgba(244,235,217,.1)}
.shop div{background-image:repeating-linear-gradient(135deg,rgba(255,255,255,.025) 0 2px,transparent 2px 7px)}.shop div:nth-child(even){background-color:rgba(244,235,217,.1)}
.ln:nth-child(even){background:linear-gradient(90deg,rgba(134,239,172,.12),rgba(244,235,217,.04))}
.res:nth-child(even){background:rgba(244,235,217,.1)}
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
.bell{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;margin:0 0 14px;padding:12px 16px;border-radius:14px;background:linear-gradient(135deg,#3b2a00,#1e1600);border:2px solid #facc15;color:#fde68a}.bell b{font-size:20px;letter-spacing:.04em}.bell span{flex:1 1 260px;color:#f4ebd9}.bell a{background:#facc15;color:#1b1300;font-weight:700;padding:8px 16px;border-radius:999px;text-decoration:none}.bell.on{animation:bellpulse 1.6s ease-in-out infinite}@keyframes bellpulse{50%{box-shadow:0 0 0 6px rgba(250,204,21,.25)}}.cta{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;justify-content:center;margin:14px 0 0}.cta a{background:#C8102E;color:#F4EBD9;text-decoration:none;padding:8px 18px;font-family:'Bebas Neue',Impact,sans-serif;font-size:22px;letter-spacing:.04em;box-shadow:0 4px 0 #000}.cta a:hover{background:#e01535}.cta span{font-size:13px;opacity:.75}
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
<div class="tick"><span class="lab bb" id="ticklab">⚾ HILL</span><span class="run bb" id="tick"></span></div>
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
if((D.rejects||[]).length)h+='<div class="rej"><b class="bb">❌ Didn’t go through</b>'+D.rejects.slice().reverse().map(function(x){return '<div><span class="bb">'+esc(x.who)+'</span> · '+esc(x.kind)+' · <i>'+esc(x.why)+'</i> <small>'+when(x.at)+'</small></div>';}).join('')+'<div style="font-size:12px;opacity:.7">Fix it and send the Master Form again. Shows for an hour.</div></div>';
if(D.formLink)h+='<div class="cta"><a href="'+esc(D.formLink)+'" target="_blank" rel="noopener">📝 Master Form</a><span>The one form for everything: sign up, charge, report, bet, shop</span></div>';
var BL=D.bell;if(BL&&(BL.open||BL.soon||BL.answered))h+='<div class="bell'+(BL.open?' on':'')+'"><b class="bb">'+(BL.open?'🔔 THE BELL IS RINGING':BL.answered?'🔔 THE BELL WAS ANSWERED':'🔔 THE BELL RINGS AT '+esc(when(BL.next)).toUpperCase())+'</b><span>'+(BL.open?'Anyone on the climb can charge the Ace until '+esc(when(BL.until))+'. Win by '+esc(BL.margin)+'+ for the title; a smaller win makes you the #1 contender. First one in.':BL.answered?'A challenger took the shot. Watch for the result.':'For an hour, anyone on the climb can charge the Ace. Win by '+esc(BL.margin)+'+ for the title.')+'</span>'+(BL.open&&D.formLink?'<a href="'+esc(D.formLink)+'" target="_blank" rel="noopener">🔔 Charge the Ace</a>':'')+'</div>';
if(D.seasonStart&&new Date(D.seasonStart)>new Date()){h+='<div class="sea"><span class="bb big">🎄 SEASON '+esc(D.season)+' · OPENS '+day(D.seasonStart).toUpperCase()+'</span><span>Register now. Charges and Brawl points start at kickoff.</span><span class="bb clk">⏱ '+left(D.seasonStart)+'</span></div>';}
else if(D.seasonEnd){var se=new Date(D.seasonEnd),over=D.seasonClosed||se<=new Date();h+='<div class="sea"><span class="bb big">🎄 SEASON '+esc(D.season)+(D.seasonClosed?' · FINAL':over?' · FINAL BUZZER':'')+'</span><span>'+(over?(D.seasonClosed?'The awards are in.':'No new charges. Charges in flight are being settled.'):'Ends '+when(D.seasonEnd))+'</span>'+(over?'':'<span class="bb clk">⏱ '+left(D.seasonEnd)+'</span>')+'</div>';}
h+='<div class="cols"><div><h2 class="bb">The Climb</h2><div class="climb">'+(A?'<div class="step ace"><span class="tag bb">♠ THE ACE · ON THE MOUND</span><span class="rk bb">👑</span><span class="who bb">'+esc(A.name)+'<small>'+esc(A.club)+(A.clubId?' · <a class="cid" href="https://play.smallball.com/#/team/'+esc(A.clubId)+'" target="_blank" title="Open on SmallBall">ID '+esc(A.clubId)+'</a>':'')+'</small></span><span class="wl bb">'+'<b>'+(A.rdef||0)+'</b>'+((A.rdef||0)===1?'defense':'defenses')+'</span></div>':'<div class="step ace open"><span class="tag bb">♠ THE ACE</span><span class="rk bb">⛰️</span><span class="who bb">The mound is open<small>Win the title fight to plant the flag</small></span><span class="wl bb"></span></div>')+(lad.length?lad.map(function(p,i){return '<div class="step'+(i===0?' top':'')+(+p.rank<=(D.moundOpenTo||1)?' shot':'')+'" style="--i:'+Math.min(i+1,9)+';animation-delay:'+(i*0.06)+'s"><span class="rk bb">#'+esc(p.rank)+'</span><span class="who bb">'+esc(p.name)+'<small>'+esc(p.club)+(p.clubId?' · <a class="cid" href="https://play.smallball.com/#/team/'+esc(p.clubId)+'" target="_blank" title="Open on SmallBall">ID '+esc(p.clubId)+'</a>':'')+'</small>'+reachTxt(p,i)+'</span><span class="wl bb">'+p.w+'-'+p.l+'</span></div>';}).join(''):'<div class="empty">Nobody on the climb yet. Register on the form and you start at the bottom.</div>')+'</div>'+(lad.length?'<div class="rnote">⤴ Who each spot can charge. Underdogs win by less (1 run off per star behind). Pick 🔎 Who can I charge? on the Master Form for your own list in #hill-help.</div>':'')+'</div>';
h+='<div><h2 class="bb">Charging the Hill</h2><div class="fights">'+(ch.length?ch.map(function(c,i){return '<div class="fight '+(c.type==='Title'?'title':c.type==='Revenge'?'rev':'')+'" style="animation-delay:'+(i*0.08)+'s"><span class="kind bb">'+(c.type==='Title'?'TITLE FIGHT':c.type==='Revenge'?'ACE\\'S REVENGE':'LADDER')+'</span><div class="vs bb">🥊 '+esc(c.ch)+'<em>VS</em>'+esc(c.df)+'</div><div class="meta"><span>'+(c.status==='Game reported'?'<span class="stamp bb">GAME REPORTED</span>':esc(c.status))+'</span><span class="bb" style="font-size:20px">⏱ '+left(c.deadline)+'</span></div></div>';}).join(''):'<div class="empty">No charges right now. Somebody charge the hill.</div>')+'</div></div></div>';
h+='<h2 class="bb">Recent results</h2>'+(ms.length?'<div class="results">'+ms.slice(0,9).map(function(m){var tie=m.wr!==''&&m.wr===m.lr;return '<div class="res"><div class="d">'+day(m.date)+' · '+esc(m.type)+(m.game?' · game '+esc(m.game):'')+'</div><div class="w bb">'+esc(m.w)+(tie?' ties ':' over ')+esc(m.l)+'</div>'+(m.wr!==''?'<div class="s bb">'+esc(m.wr)+' – '+esc(m.lr)+'</div>':'')+'<div class="o">'+esc(m.outcome)+(m.pts?' · +'+m.pts+' pts':'')+'</div></div>';}).join('')+'</div>':'<div class="empty">No results yet. They show up here once each game has aired.</div>');
h+='<h2 class="bb">Reigns</h2>'+(rg.length?'<div class="reigns">'+rg.map(function(r){return '<div class="rg"><div class="n bb">#'+esc(r.n)+(r.revenge?' 🔥':'')+'</div><div class="nm bb">'+esc(r.name)+'</div><div class="m">'+esc(r.club)+'</div><div class="m">'+day(r.start)+' – '+(r.end?day(r.end):'now')+' · '+ndays(r.start,r.end)+(ndays(r.start,r.end)===1?' day':' days')+'</div><div class="m">'+r.defenses+' defenses · '+r.pts+' pts'+(r.endedBy?' · ended by '+esc(r.endedBy):'')+'</div></div>';}).join('')+'</div>':'<div class="empty">The first reign starts when the first Ace is crowned.</div>');
var F=D.farm;if(F){var FA=F.ace,FL=F.ladder||[],FC=F.charges||[],FM=F.matches||[],FB=F.bell;
h+='<!--TAB:farm--><h2 class="bb">🌱 The Farm Hill</h2><div class="rnote" style="margin-bottom:14px">The ladder for clubs at <b>'+esc(F.max)+'★ and under</b> (Hold the Hill is for bigger clubs). Looser rules: charge anyone above you, the Farm Dog too, whenever you like, and any win counts. Same Master Form, same Brawl Bucks wallet. <b>Bring your young clubs:</b> put as many as you like on the Farm. Grow past '+esc(F.max)+'★ and you get <b>called up</b>.</div>';
if(FB&&(FB.open||FB.soon))h+='<div class="bell'+(FB.open?' on':'')+'"><b class="bb">'+(FB.open?'🔔 THE FARM BELL IS RINGING':'🔔 THE FARM BELL RINGS AT '+esc(when(FB.next)).toUpperCase())+'</b><span>'+(FB.open?'Anyone on the Farm can charge the Farm Dog until '+esc(when(FB.until))+'. Win by '+esc(FB.margin)+'+ for the title.':'For an hour, anyone on the Farm can charge the Farm Dog.')+'</span></div>';
h+='<div class="cols"><div><h2 class="bb">The Farm Climb</h2><div class="climb">'+(FA?'<div class="step ace"><span class="tag bb">🐕 THE FARM DOG</span><span class="rk bb">👑</span><span class="who bb">'+esc(FA.name)+'<small>'+esc(FA.club)+(FA.stars!=null?' · '+esc(FA.stars)+'★':'')+(FA.clubId?' · <a class="cid" href="https://play.smallball.com/#/team/'+esc(FA.clubId)+'" target="_blank">ID '+esc(FA.clubId)+'</a>':'')+'</small></span><span class="wl bb"><b>'+(FA.rdef||0)+'</b>defenses</span></div>':'<div class="step ace open"><span class="tag bb">🐕 THE FARM DOG</span><span class="rk bb">🌱</span><span class="who bb">The Farm mound is open<small>The first club on the Farm holds it</small></span><span class="wl bb"></span></div>')
 +(FL.length?FL.map(function(p,i){return '<div class="step'+(i===0?' top':'')+(+p.rank<=(F.moundOpenTo||1)?' shot':'')+'" style="--i:'+Math.min(i+1,9)+'"><span class="rk bb">#'+esc(p.rank)+'</span><span class="who bb">'+esc(p.name)+'<small>'+esc(p.club)+(p.stars!=null?' · '+esc(p.stars)+'★':'')+(p.clubId?' · <a class="cid" href="https://play.smallball.com/#/team/'+esc(p.clubId)+'" target="_blank">ID '+esc(p.clubId)+'</a>':'')+'</small></span><span class="wl bb">'+p.w+'-'+p.l+'</span></div>';}).join(''):'<div class="empty">Nobody on the Farm climb yet. Register a 6★-or-under club on the Master Form.</div>')+'</div></div>';
h+='<div><h2 class="bb">Charging the Farm</h2><div class="fights">'+(FC.length?FC.map(function(c){return '<div class="fight '+(c.type==='Title'?'title':'')+'"><span class="kind bb">'+(c.type==='Title'?'FARM TITLE FIGHT':c.type==='Revenge'?'REVENGE':'LADDER')+'</span><div class="vs bb">🥊 '+esc(c.ch)+'<em>VS</em>'+esc(c.df)+'</div><div class="meta"><span>'+esc(c.status)+'</span><span class="bb" style="font-size:20px">⏱ '+left(c.deadline)+'</span></div></div>';}).join(''):'<div class="empty">No Farm charges right now.</div>')+'</div>';
h+='<h2 class="bb">Farm results</h2>'+(FM.length?'<div class="results">'+FM.slice(0,8).map(function(m){var tie=m.wr!==''&&m.wr===m.lr;return '<div class="res"><div class="d">'+day(m.date)+' · '+esc(m.type)+(m.game?' · game '+esc(m.game):'')+'</div><div class="w bb">'+esc(m.w)+(tie?' ties ':' over ')+esc(m.l)+'</div>'+(m.wr!==''?'<div class="d">'+esc(m.wr)+'-'+esc(m.lr)+' · '+esc(m.outcome)+'</div>':'')+'</div>';}).join('')+'</div>':'<div class="empty">No Farm games yet.</div>');
if((F.calledUp||[]).length)h+='<h2 class="bb">📣 Called up</h2><div class="results">'+F.calledUp.map(function(p){return '<div class="res"><div class="w bb">'+esc(p.name)+'</div><div class="d">'+esc(p.club)+' graduated to Hold the Hill</div></div>';}).join('')+'</div>';
h+='</div></div>';}
h+='<!--TAB:bucks-->';
var fo=function(o){o=+o;return o>0?'+'+o:'−'+Math.abs(o);};
var WL=D.wallet||[],IT=D.items,SK=D.streaks;
if(WL.length){h+='<h2 class="bb">💰 Brawl Bucks</h2><div class="note">Everyone starts the season with 1,000. Earn more by playing Hill games'+(SK?' and keeping a 🔥 streak':'')+'; spend them on bets, wagers and the shop.</div><table class="wal"><tr><th></th><th>Player</th><th style="text-align:right">BB</th>'+(SK?'<th>🔥</th>':'')+(IT?'<th>Holding</th>':'')+'</tr>'
+WL.map(function(x,i){return '<tr><td class="r">'+(i+1)+'</td><td class="n">'+(x.ace?'♠ ':'')+esc(x.name)+'<small>'+esc(x.club)+'</small></td><td class="bk">'+x.bank+'</td>'+(SK?'<td>'+(x.streak?'🔥 '+x.streak:'<span style="opacity:.35">–</span>')+'</td>':'')+(IT?'<td class="it">'+(x.items.length?x.items.join(' '):'<span style="opacity:.35">–</span>')+(x.cool?' <small style="font-size:11px;opacity:.6">⏳</small>':'')+'</td>':'')+'</tr>';}).join('')+'</table>';}
if(IT){h+='<h2 class="bb">🛒 The shop</h2><div class="note">Buy on the Master Form. The Ace pays '+IT.aceX+'×. One item per side per charge, one per player every '+IT.cooldown+' hours.</div><div class="shop">'+IT.items.map(function(x){return '<div><b>'+x.price+'</b>'+x.icon+' '+esc(x.name)+'<small>'+esc(x.what)+'</small></div>';}).join('')+'</div>';}
if(IT||SK){var msl=SK?Object.keys(SK.ms||{}).map(function(k){return k+'d +'+SK.ms[k];}).join(' · '):'';h+='<div class="note" style="margin-top:12px">💵 <b>Getting paid:</b> every Hill game +'+IT.play.played+' BB, the winner +'+IT.play.win+' more, the challenger +'+(IT.play.charge||0)+(SK?'. 🔥 Any day you play: +'+SK.day+', plus +'+SK.step+' per day in a row (up to +'+SK.max+'). Streak bonuses: '+esc(msl)+'. 🌧️ Rain Delay saves a missed day.':'.')+'</div>';}
h+='<!--TAB:book-->';
if(D.bookOn){var bo=D.bookOpen||[];
h+='<h2 class="bb">🎰 The Sportsbook</h2><div class="book"><div>'+(bo.length?bo.map(function(L){var fa=L.fav==='away';return '<div class="ln"><div class="t"><span>'+esc(L.id)+' · play money</span><span>Betting closes · '+left(L.closes)+'</span></div><div class="g"><span class="bb">'+esc(L.away)+'</span><b>'+fo(L.aml)+'</b><span>'+(fa?'−1.5 ':'+1.5 ')+'('+fo(fa?L.frl:L.drl)+')</span><span>O '+esc(L.total)+' ('+fo(L.ou)+')</span><span class="bb">'+esc(L.home)+'</span><b>'+fo(L.hml)+'</b><span>'+(fa?'+1.5 ':'−1.5 ')+'('+fo(fa?L.drl:L.frl)+')</span><span>U '+esc(L.total)+' ('+fo(L.ou)+')</span></div></div>';}).join(''):'<div class="empty">Bet on the 🔮 matchup lines below, before the charge. Betting on a matchup closes the moment the charge is made: no peeking at results.</div>')+'<p style="opacity:.75;font-size:13px">Play money. Bet on the Master Form: up to 4.2% of your Brawl Bucks (250 tops). No betting on yourself or your own games; that’s what 🤝 wagers are for.</p></div></div>';
var WG=D.wagers;
if(WG){var wrow=function(x,st){return '<div class="r" style="grid-template-columns:62px minmax(0,1fr) auto"><span class="bb" style="opacity:.6;font-size:15px">'+esc(x.id)+'</span><span class="bb">'+esc(x.m)+' <small style="display:inline;opacity:.6">vs</small> '+esc(x.t)+'<small>'+esc(x.terms)+' · '+x.ms+(x.ts!==x.ms?' vs '+x.ts+' BB':' BB each')+'</small></span><b style="text-align:right">'+st+'</b></div>';};
h+='<div class="fut cup"><h3 class="bb">🤝 Head-to-head wagers</h3><div style="font-size:13px;opacity:.7;margin-bottom:6px">Bet Brawl Bucks straight against another Hill player: up to '+(WG.pct||4.2)+'% of your Brawl Bucks a side, '+(WG.flat||250)+' tops ('+(WG.big||10)+'% with the commish’s OK), straight up, odds or a run line. They accept on the Master Form, and your next BigLeague game against each other settles it once it airs. No house cut. <b style="color:#ffd166">Funny business costs you your bucks (split across the league), and worse.</b></div>'
+(WG.live.length||WG.open.length?WG.live.map(function(x){return wrow(x,x.st==='Airing'?'📺 Airing':'⚾ Game on · '+left(x.dl));}).join('')+WG.open.map(function(x){return wrow(x,'Open · '+left(x.exp));}).join(''):'<div class="empty">No wagers on right now. Call somebody out on the Master Form.</div>')+'</div>';}
var FU=D.futures;
if(FU&&FU.rows&&FU.rows.length){var mx=Math.max.apply(null,FU.rows.map(function(x){return x.pct;}))||1;
h+='<div class="fut cup"><h3 class="bb">♠️ Season '+esc(D.season)+' Ace futures</h3><div style="font-size:13px;opacity:.7;margin-bottom:6px">Odds to be on the mound when the season ends. The season is played out 2,000 times every hour. Arrows show the move since midnight. Bet on who finishes as the Ace on the Master Form (anyone but yourself).</div>'
+FU.rows.slice(0,10).map(function(x){var mv=x.move>0?'<span class="up">▲ '+x.move+'</span>':x.move<0?'<span class="dn">▼ '+Math.abs(x.move)+'</span>':'<span style="opacity:.4">–</span>';return '<div class="r"><span class="bb" style="font-size:18px;opacity:.7">'+(x.rank===0?'♠':'#'+x.rank)+'</span><span class="bb">'+esc(x.name)+'<small>'+esc(x.club)+' · '+x.pct+'%</small></span><span class="bar"><i style="width:'+Math.round(x.pct/mx*100)+'%"></i></span><b>'+fo(x.odds)+'</b>'+mv+'</div>';}).join('')+'</div>';}

var PO=D.pot||[];
if(PO.length){var pre=D.seasonStart&&new Date(D.seasonStart)>new Date();h+='<div class="fut cup"><h3 class="bb">🔮 Matchup lines'+(pre?' · preview':'')+'</h3><div style="font-size:13px;opacity:.7;margin-bottom:6px">'+(pre?'<b style="color:#ffd166">Betting opens at kickoff.</b> ':'')+'Every charge that could happen right now. Bet on the Master Form before the charge is made: betting locks the moment it is. Not played within 48 hours? Your bet comes back.</div>'
+'<div class="r ml hd"><span>Charging</span><b>Odds</b><span style="text-align:right">@ Holding</span><b>Odds</b></div>'
+PO.slice(0,24).map(function(L){var oc=function(o){return '<b class="'+(+o<0?'fv':'dg')+'">'+fo(o)+'</b>';};return '<div class="r ml"><span class="bb">'+esc(L.ch)+(L.t?' <small style="display:inline;color:#ffd166">♠ title</small>':'')+'</span>'+oc(L.a)+'<span class="bb" style="text-align:right">@ '+esc(L.df)+'</span>'+oc(L.h)+'</div>';}).join('')+'<div class="note" style="margin-top:8px"><span class="fv">−120</span> favorite · <span class="dg">+150</span> underdog</div></div>';}}
h+='<!--TAB:season-->';
var aw=D.awards||[],cp=D.cup||[];
if(aw.length){h+='<h2 class="bb">🏆 Season '+esc(D.season)+' hardware'+(D.seasonClosed?' · final':' · race')+'</h2><div class="hw"><div class="cup"><h3 class="bb">🏆 The Bench Clearer Cup</h3>'+(cp.length?cp.map(function(x,i){return '<div class="r"><b>'+(i+1)+'</b><span class="bb">'+esc(x.name)+'<small>'+esc(x.club)+'</small></span><span class="bb" style="font-size:20px">'+x.pts+'</span></div>';}).join(''):'<div class="empty">No Brawl points yet. The first payday is midnight.</div>')+'</div><div><div class="aws">'+aw.filter(function(a){return a.name!=='The Bench Clearer Cup';}).map(function(a){return '<div class="aw"><div class="i">'+a.icon+'</div><div class="t bb">'+esc(a.name)+'</div><div class="w bb">'+(a.who?esc(a.who):'—')+'</div><div class="v">'+(a.who?esc(a.value):esc(a.note||'up for grabs'))+'</div><div class="q">'+esc(a.what)+'</div></div>';}).join('')+'</div>'+(D.prizes?'<div class="prize">🎁 <b>Prizes:</b> '+esc(D.prizes)+'</div>':'')+'</div></div>';}
var pts=[10,20,40,80,160,320,320,320];
h+='<!--TAB:how--><h2 class="bb">How the Hill works</h2><div class="how">'
+'<div class="card"><h3 class="bb">🥊 Charge the hill</h3><p>Pick a fight with anyone up to <b>3 spots above you</b>. Reach higher, win bigger.</p><div class="reach"><div class="no">#2 · too far</div><div class="ok">#3 · win by 4+</div><div class="ok">#4 · win by 3+</div><div class="ok">#5 · just win</div><div class="me">#6 · YOU</div></div></div>'
+'<div class="card"><h3 class="bb">⚾ Play it, report it</h3><div class="steps3"><div><b>1</b>Charge on the form. The clock starts.</div><div><b>2</b>The challenger starts the game in SmallBall as the visitor, at the defender\\'s park. The first game counts.</div><div><b>3</b>Nothing to report: the Hill finds the game on SmallBall by itself. Hand reports still work as a backup. Results post once the game has aired: no spoilers.</div></div><p style="opacity:.75;font-size:13px">Win by enough and you take their spot. Win short of the margin and nobody moves. Lose and you drop one. A tie: the defender holds.</p></div>'
+'<div class="card"><h3 class="bb">♠ Points per defense</h3><p>Every title defense pays double the last, up to 320.</p><div class="bars">'+pts.map(function(p,i){return '<div style="height:'+(p/320*100)+'%;animation-delay:'+(i*0.1)+'s"><span>'+p+'</span><i>D'+(i+1)+'</i></div>';}).join('')+'</div><p style="margin-top:28px">Hold it six times and every defense after that is worth 320.</p></div>'
+'<div class="card"><h3 class="bb">⏰ The open mound</h3><p>Only <b>#1</b> can charge the Ace at first. If nobody charges, <b>#2</b> gets a title shot after 8 hours, then one more spot each day, down to <b>#5</b> (it never widens overnight). Any win takes the hill: no margins on the mound.</p><p>🩹 <b>Lose a charge at the Ace</b> (title, Bell or revenge) and you limp back to <b>#5</b>, then recover for <b>2 hours</b> (<b>3</b> if the Ace wore 🥊 Brass Knuckles) before you can charge anyone.</p><p>🔔 <b>The Bell:</b> a few times a week, at random but never at night, the Bell rings for an hour (30-minute heads-up in Discord). While it rings, <b>anyone</b> on the climb can charge the Ace, first one in. Win by <b>3+</b> to take the hill; a smaller win makes you the <b>#1 contender</b> (no injury). If the Ace wins, they earn a <b>50 BB</b> bounty and two days off from the Bell.</p><p class="bb" style="font-size:22px;color:#ffd166">Open to '+((D.moundOpenTo||1)===1?'#1':'#1–#'+D.moundOpenTo)+' now</p></div>'
+'<div class="card"><h3 class="bb">🌱 The Farm Hill</h3><p>The ladder for clubs at <b>6★ and under</b>; Hold the Hill is for 7★ and up. The <b>open ladder</b>: charge anyone above you, the <b>🐕 Farm Dog</b> included, any time. Any win counts, with no rematch cooldowns and no recovery after a missed title charge. Register on the Master Form: a 6★-or-under club lands on the Farm by itself. <b>Bring your young clubs:</b> an owner can put as many as they like on the Farm, all on one Brawl Bucks wallet.</p><p>Grow past 6★ and your club is <b>called up</b> to Hold the Hill.</p></div>'+'<div class="card"><h3 class="bb">📅 Daily Brawl points</h3><p>Every night at midnight, clubs get paid for where they sit:</p><div class="reach">'+(D.daily||[]).slice(0,6).map(function(v,i){return '<div class="ok">'+(i===0?'♠ Ace':'#'+i)+' · '+v+' pts/day</div>';}).join('')+'</div><p style="opacity:.75;font-size:13px">Defense points plus daily pay = Brawl points. Most at the end of the season wins the The Bench Clearer Cup.</p></div>'
+'<div class="card"><h3 class="bb"><span class="flame">🔥</span> The Ace\\'s Revenge</h3><p>An Ace who built <b>500+ reign points</b> and loses the hill gets one shot back, declared within 12 hours.</p><p>The catch: they must win by <b>more runs than they lost by</b>. Lost 5–3? You need a 3-run win.</p><p style="opacity:.75;font-size:13px">A dethroned Ace without revenge drops to #3..</p></div>'
+'</div><div class="foot">'+(D.formLink?'<a href="'+esc(D.formLink)+'" target="_blank" rel="noopener" style="color:#ffd166">📝 Master Form</a> · ':'')+'Updated '+(D.updated?when(D.updated):'never')+' · refreshes every minute · results appear once each game has aired</div>';
var TABS=[['hill','⛰️ The Hill']].concat(D.farm?[['farm','🌱 Farm Hill']]:[],[['bucks','💰 Brawl Bucks'],['book','🎰 Sportsbook'],['season','🏆 Season'],['how','📖 How it works']]),parts=h.split(/<!--TAB:(\w+)-->/),P={hill:parts[0]};for(var q=1;q<parts.length;q+=2)P[parts[q]]=(P[parts[q]]||'')+parts[q+1];
var cur=(location.hash||'').slice(1);if(!P[cur])cur='hill';
document.getElementById('app').innerHTML='<nav class="tabs">'+TABS.filter(function(t){return P[t[0]];}).map(function(t){return '<a href="#'+t[0]+'" data-t="'+t[0]+'"'+(t[0]===cur?' class="on"':'')+'>'+t[1]+'</a>';}).join('')+'</nav>'+TABS.filter(function(t){return P[t[0]];}).map(function(t){return '<section class="pane'+(t[0]===cur?' on':'')+'" id="p-'+t[0]+'">'+P[t[0]]+'</section>';}).join('');
function showTab(k){if(!P[k])k='hill';document.querySelectorAll('.tabs a').forEach(function(a){a.className=a.dataset.t===k?'on':'';});document.querySelectorAll('.pane').forEach(function(x){x.className='pane'+(x.id==='p-'+k?' on':'');});}
window.addEventListener('hashchange',function(){showTab((location.hash||'').slice(1));});
var t=[];if(A)t.push('♠ '+A.name+' holds the hill · '+(A.rdef||0)+' defenses');ms.slice(0,8).forEach(function(m){t.push(m.w+(m.wr!==''&&m.wr===m.lr?' ties ':' over ')+m.l+(m.wr!==''?' '+m.wr+'-'+m.lr:''));});ch.forEach(function(c){t.push('🥊 '+c.ch+' charges '+c.df);});if(lad[0])t.push('#1 contender: '+lad[0].name);t.push('Charge the hill: register on the form');
var FT=(D.futures&&D.futures.rows)||[];
if(FT.length){document.getElementById('ticklab').textContent='♠ ACE ODDS';var fo2=function(o){o=+o;return o>0?'+'+o:'−'+Math.abs(o);};
document.getElementById('tick').innerHTML=FT.map(function(x){var mv=x.move>0?'<span class="up">▲'+x.move+'</span>':x.move<0?'<span class="dn">▼'+Math.abs(x.move)+'</span>':'<span style="opacity:.4;font-size:13px">–</span>';return esc(x.name)+' <b style="color:'+(x.move>0?'#4ade80':x.move<0?'#f87171':'#ffd166')+';font-weight:400">'+fo2(x.odds)+'</b> '+mv;}).join('<i>★</i>');}
else document.getElementById('tick').innerHTML=t.map(esc).join('<i>★</i>');
document.querySelectorAll('.cnt').forEach(function(el){var n=+el.dataset.n,k=0,s=Math.max(1,Math.ceil(n/30));var iv=setInterval(function(){k=Math.min(n,k+s);el.textContent=k;if(k>=n)clearInterval(iv);},30);});
</script></body></html>
`;
