// PlayerOptimizer III by Jon2s, built into the SmallBall Club Kit with his blessing.
// Club Kit changes: it runs only while switched on in the kit's ⚙ Features (on to start), and the squad-table
// skill-number columns are left out (the lineup optimizer is unchanged).
if ((() => { try { return JSON.parse(localStorage.getItem("sbx-features") || "{}").optimizer !== false; } catch (_) { return true; } })())
(() => {
  let cachedTeamData = null;
  let suppressInjection = false;

  // 1. Listen for intercepted team JSON payloads (works across all #/team/* IDs)
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.type !== "SMALLBALL_TEAM_DATA") return;
    const payload = event.data.payload;

    document.getElementById("sb-summary-banner")?.remove();

    cachedTeamData = payload;

    if (!payload.mine) {
      document.getElementById("sb-optimizer-bar")?.remove();
      return;
    }

    mountControls();
  });

  const observer = new MutationObserver(() => {
    if (suppressInjection || !cachedTeamData) return;
    if (cachedTeamData.mine) mountControls();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Club Kit: the squad-table skill-number columns (and their sort hooks) are left out; the kit has its own squad view.

  // 3. Inject AUTO-OPTIMIZE button next to the SAVE button
  function mountControls() {
    if (document.getElementById("sb-optimizer-bar")) return;

    const saveBtn = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent.trim().toUpperCase() === "SAVE"
    );
    if (!saveBtn || !saveBtn.parentNode) return;

    const bar = document.createElement("span");
    bar.id = "sb-optimizer-bar";
    bar.style.cssText = "display: inline-flex; align-items: center; gap: 10px; margin-left: 12px;";

    const optBtn = document.createElement("button");
    optBtn.type = "button";
    optBtn.textContent = "AUTO-OPTIMIZE";
    optBtn.style.cssText =
      "padding: 8px 16px; background: #1d4ed8; color: #fff; border: none; border-radius: 20px; font-weight: 700; cursor: pointer; font-size: 13px;";

    optBtn.onclick = () => {
      if (!cachedTeamData?.roster) return;
      applyOptimalLineup(cachedTeamData.roster);
    };

    bar.appendChild(optBtn);
    saveBtn.parentNode.insertBefore(bar, saveBtn.nextSibling);
  }

  // Helper to format stat values cleanly
  const fmt = (n) => (typeof n === "number" ? (Number.isInteger(n) ? String(n) : n.toFixed(1)) : "0");

  // 4. Evaluate players strictly using SmallBall's 7 underlying skill ratings + record detailed reasoning
  function computeLineup(roster) {
    const pool = [...roster];
    const positions = {};
    const positionDetails = [];

    const posConfigs = [
      {
        pos: "P",
        role: "Pitcher",
        formulaText: "P×3.0 + C×0.5",
        fn: (p) => (p.pitch_skill || 0) * 3.0 + (p.catch_skill || 0) * 0.5,
        statSummary: (p) => `P ${fmt(p.pitch_skill)}, C ${fmt(p.catch_skill)}`,
        why: "Highest pitching rating to carry all 9 innings (no bullpen in SmallBall).",
      },
      {
        pos: "C",
        role: "Catcher",
        formulaText: "C×1.5 + T×2.0",
        fn: (p) => (p.catch_skill || 0) * 1.5 + (p.pass_power || 0) * 2.0,
        statSummary: (p) => `C ${fmt(p.catch_skill)}, T ${fmt(p.pass_power)}`,
        why: "Best combination of receiving glove (C) and throwing arm (T) to control baserunners.",
      },
      {
        pos: "SS",
        role: "Shortstop",
        formulaText: "C×1.5 + T×1.8 + R×0.6",
        fn: (p) => (p.catch_skill || 0) * 1.5 + (p.pass_power || 0) * 1.8 + (p.run_speed || 0) * 0.6,
        statSummary: (p) => `C ${fmt(p.catch_skill)}, T ${fmt(p.pass_power)}, R ${fmt(p.run_speed)}`,
        why: "Top remaining infield glove, arm strength for deep throws to 1B, and lateral speed.",
      },
      {
        pos: "CF",
        role: "Center Field",
        formulaText: "R×2.5 + C×1.0 + T×0.8",
        fn: (p) => (p.run_speed || 0) * 2.5 + (p.catch_skill || 0) * 1.0 + (p.pass_power || 0) * 0.8,
        statSummary: (p) => `R ${fmt(p.run_speed)}, C ${fmt(p.catch_skill)}, T ${fmt(p.pass_power)}`,
        why: "Fastest available outfielder to cover center gap territory with solid hands and arm.",
      },
      {
        pos: "3B",
        role: "Third Base",
        formulaText: "C×1.4 + T×1.6",
        fn: (p) => (p.catch_skill || 0) * 1.4 + (p.pass_power || 0) * 1.6,
        statSummary: (p) => `C ${fmt(p.catch_skill)}, T ${fmt(p.pass_power)}`,
        why: "Strong hot-corner glove and throwing power for long throws across the diamond.",
      },
      {
        pos: "2B",
        role: "Second Base",
        formulaText: "C×1.6 + T×1.0 + R×0.5",
        fn: (p) => (p.catch_skill || 0) * 1.6 + (p.pass_power || 0) * 1.0 + (p.run_speed || 0) * 0.5,
        statSummary: (p) => `C ${fmt(p.catch_skill)}, T ${fmt(p.pass_power)}, R ${fmt(p.run_speed)}`,
        why: "Strongest remaining infield glove and quickness for double-play turns.",
      },
      {
        pos: "1B",
        role: "First Base",
        formulaText: "C×2.0 + BP×1.5",
        fn: (p) => (p.catch_skill || 0) * 2.0 + (p.swing_power || 0) * 1.5,
        statSummary: (p) => `C ${fmt(p.catch_skill)}, BP ${fmt(p.swing_power)}`,
        why: "Reliable glove to scoop infield throws paired with middle-order power.",
      },
      {
        pos: "LF",
        role: "Left Field",
        formulaText: "R×1.8 + BC×1.2 + C×0.8",
        fn: (p) => (p.run_speed || 0) * 1.8 + (p.contact_odds || 0) * 1.2 + (p.catch_skill || 0) * 0.8,
        statSummary: (p) => `R ${fmt(p.run_speed)}, BC ${fmt(p.contact_odds)}, C ${fmt(p.catch_skill)}`,
        why: "Outfield speed paired with strong contact ability.",
      },
      {
        pos: "RF",
        role: "Right Field",
        formulaText: "R×1.5 + T×1.2 + C×0.8",
        fn: (p) => (p.run_speed || 0) * 1.5 + (p.pass_power || 0) * 1.2 + (p.catch_skill || 0) * 0.8,
        statSummary: (p) => `R ${fmt(p.run_speed)}, T ${fmt(p.pass_power)}, C ${fmt(p.catch_skill)}`,
        why: "Outfield speed and throwing arm for long throws to 3B and home plate.",
      },
    ];

    posConfigs.forEach((cfg, pickStep) => {
      pool.sort((a, b) => cfg.fn(b) - cfg.fn(a));
      const chosen = pool.shift();
      const runnerUp = pool[0] || null;
      positions[cfg.pos] = chosen;

      if (chosen) {
        const score = cfg.fn(chosen);
        const runnerUpText = runnerUp
          ? `Runner-up in pool: ${runnerUp.name} (${cfg.fn(runnerUp).toFixed(1)} pts)`
          : "Last remaining player";

        positionDetails.push({
          step: pickStep + 1,
          pos: cfg.pos,
          role: cfg.role,
          player: chosen,
          score: score.toFixed(1),
          formulaText: cfg.formulaText,
          statSummary: cfg.statSummary(chosen),
          why: cfg.why,
          runnerUpText,
        });
      }
    });

    positions.B1 = pool[0] || null;
    positions.B2 = pool[1] || null;
    positions.B3 = pool[2] || null;

    const benchDetails = [positions.B1, positions.B2, positions.B3]
      .filter(Boolean)
      .map((p, idx) => ({
        slot: `B${idx + 1}`,
        player: p,
        statSummary: `P ${fmt(p.pitch_skill)}, C ${fmt(p.catch_skill)}, T ${fmt(p.pass_power)}, R ${fmt(p.run_speed)}, BS ${fmt(p.swing_skill)}, BP ${fmt(p.swing_power)}, BC ${fmt(p.contact_odds)}`,
      }));

    // Batting order evaluation with detailed explanations
    const starters = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"]
      .map((pos) => ({ pos, player: positions[pos] }))
      .filter((s) => s.player);

    const nonPitchers = starters.filter((s) => s.pos !== "P");
    const pitcher = starters.find((s) => s.pos === "P");

    const tableSetterScore = (p) =>
      (p.contact_odds || 0) * 3 + (p.run_speed || 0) * 2.5 + (p.swing_skill || 0) * 2;

    const powerRunScore = (p) =>
      (p.swing_power || 0) * 3 +
      (p.swing_skill || 0) * 2.5 +
      (p.contact_odds || 0) * 2 +
      (p.catch_skill || 0) * 0.1;

    nonPitchers.sort((a, b) => tableSetterScore(b.player) - tableSetterScore(a.player));
    const topTwo = nonPitchers.splice(0, 2).map((slot, i) => ({
      ...slot,
      orderRole: i === 0 ? "Leadoff Table-Setter" : "#2 Table-Setter",
      orderReason: `Top on-base/speed score (${tableSetterScore(slot.player).toFixed(1)} pts: BC ${fmt(slot.player.contact_odds)}, R ${fmt(slot.player.run_speed)}, BS ${fmt(slot.player.swing_skill)})`,
    }));

    nonPitchers.sort((a, b) => powerRunScore(b.player) - powerRunScore(a.player));
    const heartAndDepth = nonPitchers.map((slot, i) => {
      const spotNum = i + 3;
      const label =
        spotNum === 3
          ? "#3 Best All-Around Hitter"
          : spotNum === 4
          ? "#4 Cleanup Power"
          : spotNum <= 6
          ? `#${spotNum} Middle-Order Bat`
          : `#${spotNum} Bottom-Order Depth`;
      return {
        ...slot,
        orderRole: label,
        orderReason: `Power/hitting score (${powerRunScore(slot.player).toFixed(1)} pts: BP ${fmt(slot.player.swing_power)}, BS ${fmt(slot.player.swing_skill)}, BC ${fmt(slot.player.contact_odds)})`,
      };
    });

    const battingOrder = [...topTwo, ...heartAndDepth];
    if (pitcher) {
      battingOrder.push({
        ...pitcher,
        orderRole: "#9 Pitcher Spot",
        orderReason: `Starting pitcher bats 9th so top table-setters turn the lineup over`,
      });
    }

    return { positions, positionDetails, benchDetails, battingOrder };
  }

  function setNativeSelectValue(selectEl, newValue) {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLSelectElement.prototype,
      "value"
    )?.set;
    if (!nativeSetter) return;
    nativeSetter.call(selectEl, newValue);
    selectEl.dispatchEvent(new Event("input", { bubbles: true }));
    selectEl.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function getBattingOrderRows() {
    const upButtons = Array.from(document.querySelectorAll("button")).filter(
      (b) => b.textContent.trim() === "▲"
    );
    return upButtons.map((btn) => {
      let el = btn.parentElement;
      while (el && el.parentElement) {
        if (el.querySelectorAll("button").length === 2) return el;
        el = el.parentElement;
      }
      return btn.parentElement;
    });
  }

  // 5. Update DOM dropdowns, sort batting order, and render rich breakdown report
  async function applyOptimalLineup(roster) {
    const { positions, positionDetails, benchDetails, battingOrder } = computeLineup(roster);

    const posOrder = ["1B", "2B", "SS", "3B", "LF", "CF", "RF", "P", "C", "B1", "B2", "B3"];
    const posSelects = Array.from(document.querySelectorAll("select")).filter((sel) =>
      Array.from(sel.options).some((opt) => roster.some((p) => p.name === opt.text.trim()))
    );

    for (let i = 0; i < posOrder.length; i++) {
      const posKey = posOrder[i];
      const targetPlayer = positions[posKey];
      const selectEl = posSelects[i];
      if (!selectEl || !targetPlayer) continue;

      const matchingOption = Array.from(selectEl.options).find(
        (opt) => opt.text.trim() === targetPlayer.name
      );
      if (matchingOption && selectEl.value !== matchingOption.value) {
        setNativeSelectValue(selectEl, matchingOption.value);
        await new Promise((r) => setTimeout(r, 60));
      }
    }

    await new Promise((r) => setTimeout(r, 200));

    for (let targetIndex = 0; targetIndex < battingOrder.length; targetIndex++) {
      const targetName = battingOrder[targetIndex].player.name;
      let attempts = 0;

      while (attempts++ < 15) {
        const rows = getBattingOrderRows();
        const currentIndex = rows.findIndex((row) => row.textContent.includes(targetName));
        if (currentIndex === -1 || currentIndex <= targetIndex) break;

        const upButton = Array.from(rows[currentIndex].querySelectorAll("button")).find(
          (b) => b.textContent.trim() === "▲"
        );
        if (upButton && !upButton.disabled) {
          upButton.click();
          await new Promise((r) => setTimeout(r, 60));
        } else {
          break;
        }
      }
    }

    renderSummaryBanner(positionDetails, benchDetails, battingOrder);
  }

  function renderSummaryBanner(positionDetails, benchDetails, battingOrder) {
    const anchor =
      document.getElementById("sb-optimizer-bar") ||
      Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent.trim().toUpperCase() === "SAVE"
      );

    if (!anchor || !anchor.parentNode) return;

    let banner = document.getElementById("sb-summary-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "sb-summary-banner";
      banner.style.cssText =
        "margin-top: 14px; padding: 16px 18px; background: #ffffff; border: 1px solid #bfdbfe; border-radius: 10px; font-size: 12.5px; color: #1e293b; line-height: 1.5; box-shadow: 0 2px 8px rgba(30, 58, 138, 0.06);";
      anchor.parentNode.insertBefore(banner, anchor.nextSibling);
    }

    const positionRowsHtml = positionDetails
      .map(
        (d) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 6px 8px; font-weight: 800; color: #1d4ed8; white-space: nowrap;">#${d.step} · ${d.pos}</td>
          <td style="padding: 6px 8px; font-weight: 700; color: #0f172a; white-space: nowrap;">${d.player.name}</td>
          <td style="padding: 6px 8px; font-variant-numeric: tabular-nums; white-space: nowrap;"><b>${d.score} pts</b> <span style="color:#64748b;">(${d.formulaText})</span></td>
          <td style="padding: 6px 8px; color: #334155;"><b>[${d.statSummary}]</b> — ${d.why} <span style="color:#64748b;">(${d.runnerUpText})</span></td>
        </tr>`
      )
      .join("");

    const benchRowsHtml = benchDetails
      .map(
        (b) => `
        <div style="padding: 4px 0; border-bottom: 1px dashed #e2e8f0;">
          <b style="color:#475569;">${b.slot}: ${b.player.name}</b> — Raw ratings: <code>${b.statSummary}</code> (outscored at all 9 starting slots by higher-rated specialists)
        </div>`
      )
      .join("");

    const battingRowsHtml = battingOrder
      .map(
        (slot, idx) => `
        <div style="padding: 4px 0; border-bottom: 1px dashed #e2e8f0;">
          <b style="color:#1d4ed8;">${idx + 1}. ${slot.player.name}</b> <span style="color:#64748b;">(${slot.pos})</span> — <b>${slot.orderRole}:</b> ${slot.orderReason}
        </div>`
      )
      .join("");

    banner.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; padding-bottom:10px; border-bottom:2px solid #eff6ff;">
        <div style="font-size: 14px; font-weight: 900; color: #1e3a8a;">
          SmallBall PlayerOptimizer III by Jon2s — Lineup Breakdown
        </div>
        <div style="font-size: 11px; font-weight: 800; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; padding: 3px 10px; border-radius: 999px;">
          REVIEW & CLICK RED "SAVE" BUTTON TO LOCK IN
        </div>
      </div>

      <div style="margin-top: 12px;">
        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #1d4ed8; margin-bottom: 6px;">
          1. Defensive Assignments (Picked in Scarcity Order)
        </div>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #eff6ff; color: #1e3a8a; text-align: left; font-size: 11px; text-transform: uppercase;">
                <th style="padding: 6px 8px;">Order / Pos</th>
                <th style="padding: 6px 8px;">Starter</th>
                <th style="padding: 6px 8px;">Score & Formula</th>
                <th style="padding: 6px 8px;">Key Ratings & Why Chosen</th>
              </tr>
            </thead>
            <tbody>
              ${positionRowsHtml}
            </tbody>
          </table>
        </div>
      </div>

      <div style="margin-top: 14px;">
        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #1d4ed8; margin-bottom: 4px;">
          2. 1–9 Batting Order Rationale
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px;">
          ${battingRowsHtml}
        </div>
      </div>

      <div style="margin-top: 14px;">
        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; margin-bottom: 4px;">
          3. Bench Assignments (B1–B3)
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px;">
          ${benchRowsHtml}
        </div>
      </div>
    `;
  }
})();