# ⛰️ Hold the Hill

A King-of-the-Hill BigLeague ladder for SmallBall, run from a Google Sheet, a Google Form and Apps Script,
with Discord webhooks and a live Hill Board web page. **Join:** https://discord.gg/DH6KxXHgR

![Hold the Hill](art/HoldTheHill-teaser.png)

## How it plays
- 🧗 One club per owner on a single ladder, the Climb.
- 🥊 Charge up to 3 spots above you (2 up = win by 3+, 3 up = win by 4+). Underdogs win by less (1 run off per star behind).
- 👑 #1 gets the title shot at **the Ace**. The mound opens one more spot each day nobody charges, down to #5.
- 📡 Games are found from SmallBall's public game list and results post only after they air (no spoilers).
- 🏆 Daily Brawl points by ladder spot go toward **The Bench Clearer Cup**, plus season awards.
- 🎰 A play-money sportsbook (Brawl Bucks) with matchup lines and Ace futures.

Rules images: [1](art/HoldTheHill-rules-1.png) · [2](art/HoldTheHill-rules-2.png) · [3](art/HoldTheHill-rules-3.png) · [4](art/HoldTheHill-rules-4.png)

## Run your own
1. Make a new Google Sheet → **Extensions → Apps Script**, paste `HoldTheHill.gs`, Save.
2. Run `setup` once (approve the permissions). It builds the tabs, the Form and the triggers, and adds a **Hold the Hill** menu.
3. Fill in the **Config** tab: Discord webhook URLs (feed, sportsbook, trash talk, help, log), season dates and the rest. Webhook URLs are secrets: they live only in your Sheet, never in this file.
4. **Deploy → New deployment → Web app** (execute as you, anyone can access) for the Hill Board. Add `?demo=1` to the link to see sample data.
5. After pasting a new version of the script, **Deploy → Manage deployments → ✏️ → New version** so the Hill Board picks it up.

Read-only on SmallBall: it reads public game lists and never plays or saves anything.
