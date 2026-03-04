// viz_drivers.js
// Stop 2: Do conditions change severity?
// We compare severity across Weather / Road Condition / Light Condition.
//
// Controls (from HTML/sections.js → manager.state):
// - driverYear: all | 2022..2026
// - driverMode: all | ped | bike
// - driverTime: all | morning | midday | evening | night
// - driverScope: all | severe
// - driverFactor: weather | road | light
//
// Metric logic:
// - Focus = "All crashes": bar = Serious+Fatal rate (%) within each condition category
// - Focus = "Serious+Fatal only": bar = Share (%) of severe crashes that occurred under each condition
//
// Notes:
// - Many rows have missing condition values; we compute on recorded values and report coverage.

(function () {
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  function timeMatch(hour, filter) {
    if (filter === 'all') return true;
    if (hour === null || hour === undefined || isNaN(hour)) return false;
    if (filter === 'morning') return (hour >= 5 && hour <= 10);
    if (filter === 'midday') return (hour >= 11 && hour <= 15);
    if (filter === 'evening') return (hour >= 16 && hour <= 20);
    if (filter === 'night') return (hour >= 21 || hour <= 4);
    return true;
  }

  function modeMatch(d, filter) {
    if (filter === 'all') return true;
    if (filter === 'ped') return !!d.isPed;
    if (filter === 'bike') return !!d.isBike;
    return true;
  }

  function isSevere(d) {
    // "severe" = Serious Injury or Fatal
    var sev = (d.severity || "").toLowerCase();
    if ((d.fatalities || 0) > 0) return true;
    if ((d.serious || 0) > 0) return true;
    if (sev.indexOf("fatal") >= 0) return true;
    if (sev.indexOf("serious") >= 0) return true;
    return false;
  }

  function pct1(n, d) {
    if (!d) return 0;
    return Math.round((n / d) * 1000) / 10; // 1 decimal
  }

  function shorten(s, maxLen) {
    s = (s || '').trim();
    maxLen = maxLen || 28;
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen - 1) + "…";
  }

  function factorMeta(f) {
    if (f === "road") return { key: "roadcond", title: "Road condition" };
    if (f === "light") return { key: "lightcond", title: "Light condition" };
    return { key: "weather", title: "Weather" };
  }

  function readFactorValue(d, factorKey) {
    if (factorKey === "roadcond") return (d.roadcond || "").trim();
    if (factorKey === "lightcond") return (d.lightcond || "").trim();
    return (d.weather || "").trim();
  }

  function makeKey(state) {
    return [
      state.driverYear || "all",
      state.driverMode || "all",
      state.driverTime || "all",
      state.driverScope || "all",
      state.driverFactor || "weather"
    ].join("|");
  }

  function niceCeil(x, step) {
    step = step || 1;
    return Math.ceil(x / step) * step;
  }

  window.VizDrivers = {
    _layout: function (p) {
      var pad = 18;
      var topBannerH = 150;

      var left = pad;
      var top = pad + topBannerH;
      var w = p.width - pad * 2;
      var h = p.height - top - pad;

      return { pad: pad, topBannerH: topBannerH, left: left, top: top, w: w, h: h };
    },

    _computeAgg: function (manager) {
      manager.data.driversCache = manager.data.driversCache || {};

      var key = makeKey(manager.state);
      if (manager.data.driversCache[key]) return manager.data.driversCache[key];

      var all = manager.data.collisionsAll || [];
      if (!all.length) {
        manager.data.driversCache[key] = { ready: false };
        return manager.data.driversCache[key];
      }

      var yearFilter = manager.state.driverYear || "all";
      var modeFilterV = manager.state.driverMode || "all";
      var timeFilter = manager.state.driverTime || "all";
      var scope = manager.state.driverScope || "all"; // all | severe
      var factor = manager.state.driverFactor || "weather";

      var meta = factorMeta(factor);
      var fieldKey = meta.key;

      var totalSlice = 0;       // rows in slice (after year/mode/time + scope)
      var severeInSlice = 0;    // severe rows in slice (only meaningful when scope=all)
      var recorded = 0;         // rows in slice that have a non-empty condition value
      var missing = 0;          // rows in slice missing the condition value

      // per-category
      var catMap = {}; // cat -> { cat, count, severe }

      for (var i = 0; i < all.length; i++) {
        var d = all[i];

        if (yearFilter !== "all") {
          if (String(d.year) !== String(yearFilter)) continue;
        }
        if (!modeMatch(d, modeFilterV)) continue;
        if (!timeMatch(d.hour, timeFilter)) continue;

        var sev = isSevere(d);

        if (scope === "severe" && !sev) continue;

        totalSlice += 1;
        if (sev) severeInSlice += 1;

        var cat = readFactorValue(d, fieldKey);
        if (!cat) { missing += 1; continue; }

        recorded += 1;

        if (!catMap[cat]) catMap[cat] = { cat: cat, count: 0, severe: 0 };
        catMap[cat].count += 1;
        if (sev) catMap[cat].severe += 1;
      }

      // convert to list
      var items = [];
      Object.keys(catMap).forEach(function (k) { items.push(catMap[k]); });

      // sort by count desc for stability
      items.sort(function (a, b) { return b.count - a.count; });

      // keep topK by count, aggregate the rest into "Other"
      var topK = 7;
      var shown = items.slice(0, topK);
      var rest = items.slice(topK);

      if (rest.length) {
        var other = { cat: "Other", count: 0, severe: 0 };
        for (var r = 0; r < rest.length; r++) {
          other.count += rest[r].count;
          other.severe += rest[r].severe;
        }
        if (other.count > 0) shown.push(other);
      }

      // compute values for chart
      // scope=all -> value = severe rate within category
      // scope=severe -> value = share of severe crashes (within recorded severe slice)
      var metricLabel = (scope === "severe") ? "Share of severe crashes" : "Serious+Fatal rate";
      var denomForShare = Math.max(1, recorded); // in severe scope, recorded == severe recorded
      var maxVal = 0;

      for (var s = 0; s < shown.length; s++) {
        var it = shown[s];

        if (scope === "severe") {
          it.value = pct1(it.count, denomForShare); // share of severe crashes
          it.valueText = it.value.toFixed(1) + "%";
          it.subText = it.count + " severe crashes";
        } else {
          it.value = pct1(it.severe, Math.max(1, it.count)); // severe rate within category
          it.valueText = it.value.toFixed(1) + "%";
          it.subText = it.count + " crashes - " + it.severe + " severe";
        }

        if (it.value > maxVal) maxVal = it.value;
      }

      // chart max
      var axisMax = (scope === "severe") ? 100 : Math.max(6, niceCeil(maxVal, 2)); // 6% minimum
      axisMax = clamp(axisMax, 4, 100);

      var coveragePct = totalSlice ? Math.round((recorded / totalSlice) * 100) : 0;

      // overall severe share (only meaningful when scope=all)
      var overallSevPct = (scope === "severe") ? 100 : pct1(severeInSlice, Math.max(1, totalSlice));

      var agg = {
        ready: true,
        factor: factor,
        factorTitle: meta.title,
        metricLabel: metricLabel,
        totalSlice: totalSlice,
        severeInSlice: severeInSlice,
        overallSevPct: overallSevPct,
        recorded: recorded,
        missing: missing,
        coveragePct: coveragePct,
        axisMax: axisMax,
        items: shown
      };

      manager.data.driversCache[key] = agg;
      return agg;
    },

    draw: function (p, manager) {
      var L = this._layout(p);

      p.background(248, 249, 252);

      // header strip
      p.push();
      p.noStroke();
      p.fill(255);
      p.rect(0, 0, p.width, L.topBannerH + 18);
      p.pop();

      if (manager.data && manager.data.loadError) {
        p.push();
        p.fill(30);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(14);
        p.text("Couldn't load the CSV.\n\n" + manager.data.loadError, p.width / 2, p.height / 2);
        p.pop();
        return;
      }

      var agg = this._computeAgg(manager);
      if (!agg || !agg.ready) {
        p.push();
        p.fill(80);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(16);
        p.text("Loading…", p.width / 2, p.height / 2);
        p.pop();
        return;
      }

      var fYear = (manager.state.driverYear === "all") ? "All years" : ("Year " + manager.state.driverYear);
      var fMode = (manager.state.driverMode === "all") ? "All modes" : manager.state.driverMode;
      var fTime = (manager.state.driverTime === "all") ? "All day" : manager.state.driverTime;
      var fScope = (manager.state.driverScope === "severe") ? "Serious+Fatal only" : "All crashes";
      var fFactor = agg.factorTitle;

      // title + subtitle
      p.push();
      p.fill(18);
      p.textAlign(p.LEFT, p.TOP);
      p.textSize(20);
      p.text("Stop 2 — Do conditions change severity?", L.left, 18);

      p.fill(90);
      p.textSize(12);
      p.text(
        "Factor: " + fFactor + " · Filters: " + fYear + " · " + fMode + " · " + fTime + " · " + fScope +
        " — showing " + agg.totalSlice + " crashes",
        L.left, 48
      );

      p.text(
        "Coverage: " + agg.coveragePct + "% recorded (" + agg.recorded + " of " + agg.totalSlice + "). Metric: " + agg.metricLabel + ".",
        L.left, 68
      );
      p.pop();

      // main panel background
      p.push();
      p.noStroke();
      p.fill(235);
      p.rect(L.left, L.top, L.w, L.h, 16);
      p.pop();

      // chart panel
      var pad = 26;
      var x0 = L.left + pad;
      var y0 = L.top + pad;
      var cw = L.w - pad * 2;
      var ch = L.h - pad * 2;

      var chartH = Math.min(420, ch * 0.58);

      p.push();
      p.noStroke();
      p.fill(255, 255, 255, 190);
      p.rect(x0, y0, cw, chartH, 16);
      p.pop();

      // badge
      p.push();
      p.noStroke();
      p.fill(0, 140, 255, 18);
      p.rect(x0 + 14, y0 + 14, 360, 30, 999);

      p.fill(18);
      p.textAlign(p.LEFT, p.CENTER);
      p.textSize(12);

      if (manager.state.driverScope === "severe") {
        p.text("Showing share (%) of severe crashes by condition", x0 + 28, y0 + 14 + 15);
      } else {
        p.text("Overall severe share in this slice: " + agg.overallSevPct.toFixed(1) + "%", x0 + 28, y0 + 14 + 15);
      }
      p.pop();

      // axis settings
      var labelW = Math.min(270, cw * 0.34);
      var barX = x0 + 18 + labelW;
      var barW = cw - labelW - 64;

      var startY = y0 + 70;
      var rowH = 46;
      var barH = 22;

      // ticks
      var axisMax = agg.axisMax;
      var ticks = (manager.state.driverScope === "severe") ? [0, 25, 50, 75, 100] : [0, axisMax / 2, axisMax];

      // tick/grid
      p.push();
      p.stroke(0, 0, 0, 18);
      p.strokeWeight(1);
      for (var ti = 0; ti < ticks.length; ti++) {
        var t = ticks[ti] / Math.max(1, axisMax);
        var gx = barX + t * barW;
        p.line(gx, startY - 18, gx, startY + (agg.items.length * rowH) - 12);

        p.noStroke();
        p.fill(120);
        p.textAlign(p.CENTER, p.BOTTOM);
        p.textSize(11);
        p.text(ticks[ti].toFixed(0) + "%", gx, startY - 22);

        p.stroke(0, 0, 0, 18);
      }
      p.pop();

      // rows
      var best = null;

      for (var i = 0; i < agg.items.length; i++) {
        var it = agg.items[i];
        var y = startY + i * rowH;

        // label
        p.push();
        p.fill(18);
        p.textAlign(p.LEFT, p.CENTER);
        p.textSize(12);
        p.text(shorten(it.cat, 34), x0 + 18, y + barH / 2);
        p.pop();

        // track
        p.push();
        p.noStroke();
        p.fill(245);
        p.rect(barX, y, barW, barH, 999);
        p.pop();

        // bar
        var bw = (it.value / Math.max(1, axisMax)) * barW;
        p.push();
        p.noStroke();
        p.fill(0, 140, 255, 220);
        p.rect(barX, y, Math.max(0, bw), barH, 999);
        p.pop();

        // value label
        p.push();
        p.fill(40);
        p.textAlign(p.LEFT, p.CENTER);
        p.textSize(12);
        p.text(it.valueText, barX + barW + 10, y + barH / 2);
        p.pop();

        // subtext
        p.push();
        p.fill(100);
        p.textAlign(p.LEFT, p.TOP);
        p.textSize(10.5);
        p.text(it.subText, barX, y + barH + 6);
        p.pop();

        // best insight (avoid "Other")
        if (it.cat !== "Other") {
          if (!best || it.value > best.value) best = it;
        }
      }

      // what to notice panel
      var panelY = y0 + chartH + 18;
      var panelH = Math.max(130, ch - (panelY - y0) - 8);

      p.push();
      p.noStroke();
      p.fill(255, 255, 255, 185);
      p.rect(x0, panelY, cw, panelH, 16);

      p.fill(18);
      p.textAlign(p.LEFT, p.TOP);
      p.textSize(14);
      p.text("What to notice", x0 + 16, panelY + 14);

      p.fill(60);
      p.textSize(12);

      if (best) {
        if (manager.state.driverScope === "severe") {
          p.text(
            "Among severe crashes in this slice, the most common recorded condition is " +
              best.cat + " (" + best.valueText + " of severe crashes).",
            x0 + 16, panelY + 42
          );
        } else {
          p.text(
            "In this slice, " + best.cat + " has the highest severe rate (" + best.valueText + "). " +
              "Try switching Light vs Daylight, or Wet vs Dry, to see how the severe rate changes.",
            x0 + 16, panelY + 42
          );
        }
      }

      p.fill(90);
      p.textSize(11);
      p.text(
        "Tip: Use this to justify interventions (e.g., dark-condition severity → lighting + crossings; wet roads → traction + speed calming).",
        x0 + 16, panelY + 88
      );

      p.pop();
    }
  };
})();