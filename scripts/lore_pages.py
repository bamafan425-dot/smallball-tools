"""Make the index.html for every SmallBall Lore story.

Each story lives in docs/lore/<slug>/story.json (or docs/lore/people/<slug>/story.json).
Run:  python3 scripts/lore_pages.py
It writes a small index.html next to each story.json that loads ../story.js,
so adding a story is: make a folder, drop in story.json, run this script.
"""
import html, json, pathlib

LORE = pathlib.Path(__file__).resolve().parent.parent / "docs" / "lore"

PAGE = """<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} · SmallBall Lore</title>
<meta name="description" content="{desc}">
<meta property="og:title" content="{title} · SmallBall Lore"><meta property="og:description" content="{desc}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=Barlow:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{up}../assets/site.css"><link rel="stylesheet" href="{up}story.css">
</head><body><div class="seam"></div>
<div class="wrap"><nav><div style="display:flex;align-items:center;gap:10px"><a class="back" href="{up}">← Lore</a><a class="brand" href="{up}../">⚾ SmallBall ToolKits</a></div>
<div class="navlinks"><a href="{up}../club-kit/">Club Kit</a><a href="{up}../broadcast-kit/">Broadcast Kit</a><a href="{up}../tournaments/">Tournaments</a><a href="{up}../hold-the-hill/">Hold the Hill</a><a class="lore" href="{up}"><span class="ball">⚾</span>SmallBall Lore</a></div></nav></div>
<main id="app"><p class="wrap st-load">Loading the story…</p></main>
<footer><div class="wrap">SmallBall Lore is fan-made and unofficial. · <a href="{up}">All lore</a> · <a href="{up}#submit">Add lore</a> · <a href="{up}../">⚾ SmallBall ToolKits</a></div></footer>
<script src="{up}story.js"></script>
</body></html>
"""

def main():
    for sj in sorted(LORE.glob("**/story.json")):
        story = json.loads(sj.read_text())
        depth = len(sj.parent.relative_to(LORE).parts)
        up = "../" * depth
        page = PAGE.format(title=html.escape(story["title"] + (" " + story.get("titleAccent", "") if story.get("titleAccent") else "")),
                           desc=html.escape(story.get("dek", "")[:200]), up=up)
        (sj.parent / "index.html").write_text(page)
        print("wrote", sj.parent.relative_to(LORE))

if __name__ == "__main__":
    main()
