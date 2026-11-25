SmallBall Tournament Kit
========================
Run a SmallBall tournament from a Google Form sign-up. The kit pulls the sign-ups, builds the bracket in
any of eight formats, reads results from the real games between the two clubs, and sends the clubs and
games to the Broadcast Kit for the watch-along. Read-only on SmallBall: it never starts, plays, trains or
saves anything there. Owners play their own matches as usual.

INSTALL (Chrome, Edge or Brave on a computer)
  1. Unzip. 2. chrome://extensions → Developer mode on → Load unpacked → pick the SmallBall-Tournament-Kit
  folder. 3. Reload play.smallball.com. A gold 🏆 Tournament button sits above the red 📺 Broadcast button.
  Install the Broadcast Kit too if you want the watch-along hand-off.

SIGN-UPS
  Your Google Form saves answers to a responses sheet. In that sheet: File → Share → Publish to web →
  pick the responses tab and "Comma-separated values (.csv)" → Publish, and paste the link on the
  Sign-ups tab. Pull sign-ups any time to bring in new ones. Columns are matched by name: the club
  number, the owner's SmallBall name, Discord, and the form's own Timestamp (sign-up order). Every club
  is checked on SmallBall; a bad number shows "Club not found". You can also add a club by hand.

FORMATS
  Single elimination      Lose once and you're out. Byes go to the top seeds.
  Double elimination      Winners and losers brackets, with an optional bracket reset in the grand final.
  Round robin             Everybody plays everybody. Ties broken by head to head, then run difference.
  Groups, then knockout   Round-robin groups (3–6 clubs, seeds snaked so groups are even), then the top
                          1–3 of each group into a single-elimination bracket.
  Swiss                   Nobody's knocked out. Each round pairs clubs with the same record, no rematches.
                          Auto rounds = enough to find a clear winner. Great for big chats.
  King of the Hill        The top seed holds the hill and every other club gets one shot, in seed order.
                          Win and you take the hill. Whoever holds it at the end is champion; the
                          longest reign gets bragging rights.
  The Gauntlet            The bottom seeds play first and the winner climbs, seed by seed, to the top
                          seed in the final. Rewards the top seeds, makes heroes of the underdogs.
  Survivor                Single elimination, but the draw is redone at random every round.

SERIES, SEEDING, GAMES
  Series: one game (the usual), best of 3, 5 or 7, with optional longer semifinals and final.
  Seeding: sign-up order (the classic, the way it was done back in the day), stars high to low,
  underdogs first, or a random draw.
  Games that count: any game, exhibitions only, or official games only. Park Roulette gives every match
  a random park, for exhibitions (the challenger picks the park on SmallBall).

RESULTS
  The kit looks for games between the two clubs played after the tournament started (after the match
  opened, for later rounds) and moves the winner on. It checks every minute or so while the page is
  open, or press "Check for results now". A tie doesn't count; replay it. You can always settle a match
  by hand, and undo it.

WATCH-ALONG
  Spoiler-safe bracket (on by default): a result, and anything it decides, stays hidden (🙈) until its
  game has been watched in the Broadcast Kit. The Share text follows the same rule. The Matches tab is
  the organizer's view and shows who plays next.
  With "Send to the Broadcast Kit" on, every tournament club joins the Broadcast Kit's watch list and
  every tournament game lands in its queue with its round label (🏆 Semifinal · Match 1).

SHARE
  The Share tab writes a Discord-ready post: who's up now, results so far (spoiler-tagged if unwatched),
  and the seeds. Each match also has "Copy the call-out" for pinging the two owners.

NEW IN 1.1.0
  Auto-scan    The kit looks for tournament games every 45 seconds or so while any SmallBall tab is
               open, even in the background. A game counts as soon as either club starts it.
  Game IDs     Each match lists its games (#6496, click to watch). Matches → 📋 Copy game IDs copies
               every tournament game so far, ready to paste into the Broadcast Kit's Add games box.
               The Share text lists them too.
  Share the    Share → 📋 Copy bracket code copies the whole tournament as one line of text. Anyone with
  bracket      the Tournament Kit pastes it into Share → Load a bracket code and gets the same bracket.
               Their copy keeps itself up to date from the games on SmallBall, with results hidden
               until they've watched them.
