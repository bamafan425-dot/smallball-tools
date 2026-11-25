// SmallBall Club Kit: stadium skins. Runs in SmallBall's game player pages before the player starts.
// The player draws each park from a picture built into the page (a JPEG per park number). When it loads a
// park's picture and you've saved a skin for that park in the Club Kit (⚙ → Stadium skins), this hands the
// player your image instead. Nothing is sent anywhere: skins live in this browser only.
(() => {
  let skins = {};
  try {
    if (localStorage.getItem("sbx-skins-off") === "1") return;
    skins = JSON.parse(localStorage.getItem("sbx-skins") || "{}") || {};
  } catch (_) { return; }
  if (!Object.keys(skins).length) return;
  const desc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  if (!desc || !desc.set) return;
  let txt = null;
  // Which park a built-in picture belongs to: find it in the page's own script and read the park number
  // written just before it ({2:"data:image/jpeg…", 3:"…", …}).
  function parkOf(v) {
    try {
      // JPEGs of the same size start alike, so match on the end of the picture, which is unique.
      const tail = v.slice(-400);
      for (let pass = 0; pass < 2; pass++) {
        if (txt === null || pass === 1) txt = Array.from(document.scripts).map((s) => s.textContent).join("\n");
        const i = txt.indexOf(tail);
        if (i >= 0) { const start = i + tail.length - v.length; const m = /[,{]\s*(\d{1,2})\s*:\s*["'`]$/.exec(txt.slice(Math.max(0, start - 12), start)); return m ? m[1] : null; }
      }
    } catch (_) {}
    return null;
  }
  Object.defineProperty(HTMLImageElement.prototype, "src", {
    configurable: true, enumerable: desc.enumerable,
    get() { return desc.get.call(this); },
    set(v) {
      if (typeof v === "string" && v.length > 20000 && v.startsWith("data:image/")) {
        const id = parkOf(v);
        if (id && skins[id] && skins[id].src) v = skins[id].src;
      }
      desc.set.call(this, v);
    }
  });
})();
