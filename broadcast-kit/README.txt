(Renamed from the Tournament Kit in 0.8.0. Your settings and queue carry over: remove the old Tournament Kit in chrome://extensions before loading this one.)

📻 RADIO UPDATES (0.9.4)
  Score updates at every change of half-inning (or after each full inning), read straight off the
  scoreboard. No more dead air: between plays the booth keeps talking (the situation, who's hot, the pitch
  count, the fastest pitch, booth banter, lore). New booth settings: Score updates, Situation (inning, outs
  and score before every batter or now and then), Dead air (Some quiet / Steady / Nonstop) and Mack
  (home-team homer or down the middle), plus "📋 How the show goes" in the radio panel.
  The same radio is in the SmallBall Club Kit (1.25.1+), for games you watch in the site's own player.

SmallBall Broadcast Kit
========================
A watch-along multiview for play.smallball.com: put up to four games on screen at once in SmallBall's
own game player, start them together on a countdown, and keep the results hidden until you've watched.

Read-only. It never plays, trains, changes lineups or saves anything on SmallBall. It reads game lists
and opens the site's own player (the same page as the Watch buttons). Owners play their own games.

INSTALL (Chrome, Edge, Brave)
  1. Unzip somewhere you'll keep it. The folder holds manifest.json.
  2. Open chrome://extensions and turn on Developer mode (top right).
  3. Load unpacked, pick the folder, then refresh play.smallball.com.
  It works alongside the SmallBall Club Kit; they're separate extensions.

USING IT
  The red  📺 Broadcast  button (bottom left) opens the broadcast. Its number is games waiting to watch.
  Tournament clubs  Follow clubs by number. New games they play from then on join the queue by
                    themselves (checked about once a minute while play.smallball.com is open), with
                    no scores shown.
  Add games         Type game numbers, or Browse a club's recent games and add them with ＋.
  Queue             On air puts a game on a tile. ✕ removes it from the queue.
  Layout            Single, 2×2, or Main + 3 (⤢ makes a tile the main one).
  Start             A 5-second countdown, then every tile starts at once. Restart together does it again.
  Speed             1× / 2× / 4× sets every tile's player speed at once.
  ✓ Done            Marks a game watched and takes it off the air. ✕ on a tile sends it back unwatched.
  Esc or Close      Leaves the broadcast (playing tiles stop).

📺 STREAM MODE (new in 0.9.0): SBSN, the SmallBall Sports Network
  The 📺 Stream Mode button turns the broadcast into a TV screen for OBS or StreamYard to capture.
  The kit's buttons disappear and the on-air game fills the window, with:
    Score bug      SBSN, both clubs, the score, inning, outs and count, copied from the game's own
                   scoreboard. Tournament games show their round (🏆 Quarterfinal · Match 2).
    Captions       What Mack, Dewey and the guest are saying, so the call works with the sound off.
    Ticker         BigLeague top 10, the First League leader, days left in the season, and what's up
                   next. Records of clubs with games still waiting in the queue are left off.
    Segment cards  Trivia (with a thinking clock), Around the BigLeague, Tales from the Dugout and the
                   seventh-inning stretch pop up beside the game while the booth does them.
    Auto-pilot     When the game ends it's marked watched, a "Next on SBSN" screen shows the next
                   unwatched game in the queue (tournament games first), and it goes on the air. With
                   nothing queued, a "right back" screen waits until a followed club plays.
  Clicking Stream Mode also turns the radio on (it needs that click to be allowed to talk).
  Esc, or the button that appears at the top right on hover, comes back to the controls.
  Still read-only: it only watches games, and talks about skills only for your own clubs.

  Streaming it: in OBS add a Window Capture of this Chrome window and make sure Desktop Audio moves
  when the booth talks. On Windows the booth's voices are Microsoft voices on the laptop, so OBS hears
  them. Sharing just a Chrome tab (StreamYard) may carry the organ but not the voices: share the whole
  screen with system audio, or use OBS. Make the Chrome window full screen (F11) for a clean picture.

🎙 BOOTH (play-by-play and transcripts)
  SmallBall's player writes a play-by-play as the game plays, plus highlights with how rare they are
  ("1 in 40 games"). The Booth gathers those from every tile into one live feed, newest first, each line
  tagged with its game, highlights marked 📣. It only records what the tiles have already shown, so no
  spoilers. Copy transcripts / Download gives each game's full play-by-play in order, with "Top 3rd" /
  "Bottom 3rd" breaks, ready to paste into Discord. Restart together starts those games' transcripts over.

📻 THE SHOW (0.8)
  The booth is entertainment first now. Booth style "The show" (the default) calls the highlights (hits,
  runs, homers, big strikeouts), a pitch now and then and every full count, skips most routine outs, and
  fills the game with quips and stories. Between half-innings it runs segments:
    after the 2nd, 4th and 8th   a SmallBall story, a little two-man bit from the old days
    after the 3rd and 6th        SmallBall Trivia: a question, a pause to think, a wrong guess from Dewey, the answer
    middle of the 5th            Around the BigLeague: the top three, the First League leader, days left
    middle of the 7th            the seventh inning stretch, with the organ
  A hit or a run always cuts in ahead of the story. Booth style "Play-by-play" brings back the fuller call.

🏆 TOURNAMENT KIT HAND-OFF
  With the Tournament Kit installed, its clubs join your watch list and its games land in the queue with
  their round label (🏆 Semifinal · Match 1). Watching a game here is what reveals it in the Tournament
  Kit's spoiler-safe bracket.

📻 RADIO (the game, called out loud)
  A booth calls one tile's game through your speakers, in step with the picture:
  Mack Ramsey      Play-by-play. A shameless homer for the home team who has no time for the visitors.
  Dewey Seeds      Color. Jokes, hot-hitter notes, the radar gun, strikeout streaks.
  A guest          One per game, joining after the first half, and roasted by the regulars: Chet the
                   quiz-show host (answers everything in the form of a question), Brock the retired
                   quarterback (wellness habits nobody asked about), or Gary the analyst (states the
                   obvious). Original characters.
  What it watches on the scoreboard: the park and starting pitchers at the open, who's due up between
  halves, each batter's lineup spot, star rating and hits today, every pitch and the count, the radar gun
  (and the fastest pitch of the day), errors on the line score, the game's home run and pitch totals, the
  score and the final. Stars are public, so the booth roasts them freely. Skill numbers on the batter card
  (POW / CON / RUN) are only mentioned for clubs you own.
  The booth knows its SmallBall: lore from the Home Plate News archive (2002–2009 and the relaunch) and
  the SmallBall Library. Park scouting at the open, exhibition / ProLeague / good-match notes, the no-
  bullpen tired-arm talk late in games, blowout callbacks, and old stories between innings: the trainer
  wars, Free DT Fridays, Zz's, spawners, frogging, the Commish and his New York 9, First League legends.
  How it stays in sync: the booth reads the player's own scoreboard, so it calls each pitch as the count
  changes ("Ball two, two and one"), shouts "Swung on..." at contact, gives the result when the play is
  over, and reads the score the moment it changes and the final when the game ends. Every line has a
  shelf life: stale lines are skipped and a big play cuts a joke off, so the call doesn't drift behind.
  (SmallBall's player has no pause, and the kit doesn't touch the game clock.) Everything it says is
  already on screen, so the radio can never spoil what's coming.
  📻 Radio          Turns it on (your browser needs that click before it may talk). Press it before Start
                    to get the welcome.
  📻 on a tile      Puts that game on the radio. Otherwise the radio follows the main tile (or the first).
  ⚙ next to Radio   A voice for Mack, Dewey and the guest; which guests can drop by; Quips Off / Some /
                    Lots; Pitch calls Auto / Every pitch / Off; volume; organ; Test the booth.
  Pitch calls on Auto: every pitch at 1×, just the big counts at 2×, results only at 4×.
  Words at the bottom but no sound? Open ⚙ and press Test the booth. The panel says what went wrong.
  If a voice goes silent (Chrome's online "Google" voices sometimes do), the booth resets Chrome's speech
  engine, replays the line on a voice installed on your computer, and keeps using that one.
  If every voice fails, the booth switches to captions only (🔇) and tells you so: that means the
  computer's own text-to-speech is down, not the kit. Restart Chrome (on a Chromebook, restart the
  Chromebook), check a voice speaks in the system's text-to-speech settings, then press Test the booth.
  Voices are your browser's own text-to-speech: nothing is sent anywhere. Transcripts (Copy / Download
  in the Booth) include the 🎙 lines the booth said about each play. The ballpark's own crowd noise is
  the Crowd button inside each tile.

SPOILER SHIELD (on by default)
  Games in your queue or on air that you haven't watched get their scores blurred on SmallBall's own
  pages (club games lists). Club Kit dashboard cards are left as is:
  skip them if you're avoiding spoilers. Click a blurred score to peek. Not covered yet: the site's
  season tables and the Club Kit's Pitching / Compare / Training tools, so steer clear of those until
  you've watched.

Everything is kept in this browser only (localStorage on play.smallball.com).
