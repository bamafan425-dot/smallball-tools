// Fetches the sign-up sheet (a published Google Sheet) for the Tournament Kit's page script.
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (!msg || msg.type !== "csv" || !/^https:\/\/docs\.google\.com\//.test(msg.url || "")) return false;
  fetch(msg.url, { credentials: "omit", redirect: "follow" })
    .then(async (r) => reply({ ok: r.ok, status: r.status, text: await r.text() }))
    .catch(() => reply({ ok: false, status: 0 }));
  return true;
});
