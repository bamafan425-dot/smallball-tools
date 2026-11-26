// PlayerOptimizer III by Jon2s, built into the SmallBall Club Kit with his blessing.
(function () {
  const sendToExtension = (url, data) => {
    if (data && typeof data === "object" && Array.isArray(data.roster) && data.team_id) {
      window.postMessage({ type: "SMALLBALL_TEAM_DATA", url, payload: data }, "*");
    }
  };

  // Intercept fetch()
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await origFetch.apply(this, args);
    response
      .clone()
      .json()
      .then((data) => sendToExtension(String(args[0]), data))
      .catch(() => {});
    return response;
  };

  // Intercept XMLHttpRequest
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {   // Club Kit: no longer also overwrites window.open (it broke pop-up windows)
    this._sbUrl = url;
    return origOpen.apply(this, arguments);
  };

  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function () {
    this.addEventListener("load", function () {
      try {
        const data = JSON.parse(this.responseText);
        sendToExtension(this._sbUrl, data);
      } catch (_) {}
    });
    return origSend.apply(this, arguments);
  };
})();