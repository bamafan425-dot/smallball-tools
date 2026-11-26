# 🏆 SmallBall Tournament (script)

A Google Sheet + Form + Apps Script that runs a SmallBall tournament **on its own**, even when the organizer is away:

- **Sign-ups** on a Google Form it makes for you. Bad entries get a red ❌ in Discord with the reason.
- **Returning players sign up with a blank form:** the form knows them by their Google sign-in and fills in their Discord, ID, owner name, club and stars from last time (or from your Hold the Hill sheet).
- **A bracket preview** while sign-ups are open: the 16-club bracket you're aiming for, with sign-ups in their seeds and "Open spot" for the rest.
- **The bracket** is drawn when sign-ups close: double or single elimination, seeded by sign-up order, stars or a random draw.
- **Waves:** matches open at fixed times (every 60 minutes by default) and owners get @tagged with their opponent's club ID.
- **Results find themselves:** the script reads SmallBall's public game list every minute, finds the game between the two clubs, and posts the result **once the game has aired** (no spoilers), with a watch link while it airs.
- **No-shows and ties** are handled automatically (higher seed moves on; ties replay), so the tournament never stalls.
- **A live bracket page** anyone can open, with a 📷 *Save as image* button for posting the bracket.
- **The organizer's menu:** settle or undo a match, draw early, post the bracket, test the webhook.
- **Tournament Central (v2.0):** one Sheet runs tournament after tournament. **🆕 New tournament** saves the finished one, reopens the same form under the new name, gives it its own page, adds it to the [🏆 Tournaments page](https://slipnsliders.github.io/smallball-tools/tournaments/) and posts the announcement.
- **✅ Health check:** one click checks the webhooks, the form, the triggers, the GitHub key and the Hill Sheet, and it runs by itself 6 hours before sign-ups close (problems go to your private log channel).

![The live bracket](bracket-demo.png)

## Run one
1. Make a new Google Sheet → **Extensions → Apps Script**, paste [`SmallBallTournament.gs`](SmallBallTournament.gs), Save.
2. Run **setup** once and approve. It makes the sign-up form, the tabs, the triggers and a 🏆 Tournament menu.
3. In **Config**: paste a Discord webhook URL, set `TOURNEY_NAME`, `SIGNUP_CLOSE`, `START` and `WAVE_MINUTES`.
4. **Deploy → New deployment → Web app** (Execute as: Me · Who has access: Anyone) for the live bracket. Add `?demo=1` to see sample data.
5. Share the form link. That's it.

Read-only on SmallBall: it never plays, trains or saves anything there.

## The next tournament (about 2 minutes)
1. When the last one has finished, pick **🏆 Tournament → 🆕 New tournament…**
2. Fill in the name, when sign-ups close and Wave 1 starts, minutes per match, format, game types, stars, max clubs and prizes. Paste a different channel's webhook only if this one should post somewhere else.
3. Click **Start it**. The script:
   - saves who played and who won to the **History** tab, and leaves the finished bracket up at its own link;
   - clears the bracket tabs (the **Roster** stays, so returning players still sign up with a blank form);
   - renames and reopens the **same sign-up form** (same link as before);
   - makes the new bracket page at `/t/<name>/` and adds it to the Tournaments page;
   - posts the sign-ups-open announcement, then shows the ✅ health check.
4. Pin the post in Discord.

It won't start a new one while a tournament is being played. A tournament that never got played can be replaced (tick *Replace it*).

**Two at once?** File → Make a copy of the Sheet (the form and script come along), run **Set up / repair**, connect GitHub and paste the webhook, then 🆕 New tournament in the copy.
