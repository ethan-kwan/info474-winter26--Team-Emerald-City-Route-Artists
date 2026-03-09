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
    var sev = (d.severity || "").toLowerCase();
    if ((d.fatalities || 0) > 0) return true;
    if ((d.serious || 0) > 0) return true;
    if (sev.indexOf("fatal") >= 0) return true;
    if (sev.indexOf("serious") >= 0) return true;
    return false;
  }

  function pct1(n, d) {
    if (!d) return 0;
    return Math.round((n / d) * 1000) / 10;
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

  // Helper for dynamic volume axis
  function niceMax(val) {
    if (val === 0) return 10;
    var p = Math.pow(10, Math.floor(Math.log10(val)));
    var frac = val / p;
    if (frac <= 2) return 2 * p;
    if (frac <= 5) return 5 * p;
    return 10 * p;
  }

  window.VizDrivers = {
    _layout: function (p) {
      var pad = 18;
      var topBannerH = 170; // Increased to fit context paragraph

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
      var scope = manager.state.driverScope || "all";
      var factor = manager.state.driverFactor || "weather";

      var meta = factorMeta(factor);
      var fieldKey = meta.key;

      var totalSlice = 0;
      var severeInSlice = 0;
      var recorded = 0;
      var missing = 0;

      var catMap = {}; 

      for (var i = 0; i < all.length; i++) {
        var d = all[i];

        if (yearFilter !== "all" && String(d.year) !== String(yearFilter)) continue;
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

      var items = [];
      Object.keys(catMap).forEach(function (k) { items.push(catMap[k]); });

      // Calculate sorting value and flag 'junk' categories
      items.forEach(function(it) {
        it.isJunk = (it.cat.toLowerCase().indexOf("unknown") >= 0 || it.cat === "Other");
        if (scope === "severe") {
          it.valForSort = it.count;
        } else {
          it.valForSort = it.severe / Math.max(1, it.count);
        }
      });

      // Sort by Impact (Value Descending), pushing 'Unknown' to the bottom
      items.sort(function (a, b) {
        if (a.isJunk !== b.isJunk) return (a.isJunk ? 1 : 0) - (b.isJunk ? 1 : 0);
        if (b.valForSort !== a.valForSort) return b.valForSort - a.valForSort;
        return b.count - a.count; // Tie-breaker
      });

      // Keep top 6, aggregate rest into "Other"
      var topK = 6;
      var shown = items.slice(0, topK);
      var rest = items.slice(topK);

      if (rest.length) {
        var other = { cat: "Other", count: 0, severe: 0, isJunk: true };
        for (var r = 0; r < rest.length; r++) {
          other.count += rest[r].count;
          other.severe += rest[r].severe;
        }
        if (other.count > 0) shown.push(other);
      }

      var metricLabel = (scope === "severe") ? "Share of severe crashes" : "Serious+Fatal rate";
      var denomForShare = Math.max(1, recorded); 
      var maxVal = 0;
      var maxVol = 0;

      for (var s = 0; s < shown.length; s++) {
        var it = shown[s];

        if (scope === "severe") {
          it.value = pct1(it.count, denomForShare);
          it.valueText = it.value.toFixed(1) + "%";
        } else {
          it.value = pct1(it.severe, Math.max(1, it.count));
          it.valueText = it.value.toFixed(1) + "%";
        }

        if (it.value > maxVal) maxVal = it.value;
        if (it.count > maxVol) maxVol = it.count;
      }

      var axisMax = (scope === "severe") ? 100 : Math.max(6, niceCeil(maxVal, 2));
      axisMax = clamp(axisMax, 4, 100);
      var volAxisMax = niceMax(maxVol);

      var coveragePct = totalSlice ? Math.round((recorded / totalSlice) * 100) : 0;
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
        volAxisMax: volAxisMax,
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
      
      // ==========================================
      // TITLE & CONTEXT EXPLANATION
      // ==========================================
      p.push();
      p.fill(18);
      p.textAlign(p.LEFT, p.TOP);
      p.textSize(22);
      p.textStyle(p.BOLD);
      p.text("Stop 2 — Do conditions change severity?", L.left, 18);

      p.fill(70);
      p.textSize(13);
      p.textStyle(p.NORMAL);
      var contextText = "Context: 'Severity Risk' measures the likelihood that a crash will result in serious injury or death. " +
                        "However, looking at risk alone can be misleading if only a few crashes occur. By plotting Risk directly against Total Volume, " +
                        "we can identify conditions that are both highly dangerous and highly frequent.";
      p.text(contextText, L.left, 50, L.w - 10, 60); // Using bounding box to wrap text

      p.fill(120);
      p.textSize(11);
      p.text(
        "Factor: " + agg.factorTitle + "  |  Filters: " + fYear + " · " + fMode + " · " + fTime + " · " + fScope +
        "  |  Coverage: " + agg.coveragePct + "% recorded.",
        L.left, 125
      );
      p.pop();

      // main panel background
      p.push();
      p.noStroke();
      p.fill(235);
      p.rect(L.left, L.top, L.w, L.h, 16);
      p.pop();

      // chart panel areas
      var pad = 26;
      var x0 = L.left + pad;
      var y0 = L.top + pad;
      var cw = L.w - pad * 2;
      var ch = L.h - pad * 2;

      // Dynamic height distribution so both charts fit without squishing
      var itemsCount = agg.items.length;
      var chartsAreaH = ch * 0.70; 
      var rowH = Math.min(36, chartsAreaH / (itemsCount * 2)); // Dynamic sizing
      rowH = clamp(rowH, 20, 36);
      var barH = rowH * 0.55;

      var chart1StartY = y0 + 55;
      var chart2StartY = chart1StartY + (itemsCount * rowH) + 60;

      // Draw Chart Area Background
      var totalChartBgH = (chart2StartY + (itemsCount * rowH)) - y0;
      p.push();
      p.noStroke();
      p.fill(255, 255, 255, 190);
      p.rect(x0, y0, cw, totalChartBgH, 16);
      p.pop();

      // Common Layout Variables
      var labelW = Math.min(270, cw * 0.30);
      var barX = x0 + 18 + labelW;
      var barW = cw - labelW - 60;
      var best = null;

      // ==========================================
      // CHART 1: SEVERITY RATE (Risk)
      // ==========================================
      p.push();
      p.fill(18);
      p.textAlign(p.LEFT, p.CENTER);
      p.textSize(14);
      p.textStyle(p.BOLD);
      p.text("1. Severity Risk (" + agg.metricLabel + ")", x0 + 18, chart1StartY - 30);
      p.pop();

      var axisMax = agg.axisMax;
      var ticks1 = (manager.state.driverScope === "severe") ? [0, 25, 50, 75, 100] : [0, axisMax / 2, axisMax];

      // Tick Grid + Average Baseline
      p.push();
      p.stroke(0, 0, 0, 18);
      p.strokeWeight(1);
      for (var ti = 0; ti < ticks1.length; ti++) {
        var t = ticks1[ti] / Math.max(1, axisMax);
        var gx = barX + t * barW;
        p.line(gx, chart1StartY - 10, gx, chart1StartY + (itemsCount * rowH) - 10);

        p.noStroke();
        p.fill(120);
        p.textAlign(p.CENTER, p.BOTTOM);
        p.textSize(10);
        p.text(ticks1[ti].toFixed(0) + "%", gx, chart1StartY - 14);
        p.stroke(0, 0, 0, 18);
      }

      if (manager.state.driverScope !== "severe" && agg.overallSevPct > 0) {
        var avgX = barX + (agg.overallSevPct / Math.max(1, axisMax)) * barW;
        if (p.drawingContext.setLineDash) p.drawingContext.setLineDash([4, 4]);
        p.stroke(220, 80, 80, 150); 
        p.line(avgX, chart1StartY - 10, avgX, chart1StartY + (itemsCount * rowH) - 10);
        if (p.drawingContext.setLineDash) p.drawingContext.setLineDash([]); 

        p.noStroke();
        p.fill(220, 80, 80);
        p.textAlign(p.CENTER, p.BOTTOM);
        p.textSize(10);
        p.text("Avg: " + agg.overallSevPct.toFixed(1) + "%", avgX, chart1StartY - 14);
      }
      p.pop();

      // Chart 1 Rows
      for (var i = 0; i < itemsCount; i++) {
        var it = agg.items[i];
        var y1 = chart1StartY + i * rowH;

        var isHero = (i === 0 && !it.isJunk);
        if (isHero) best = it;

        p.push();
        p.fill(it.isJunk ? 140 : 40);
        p.textAlign(p.LEFT, p.CENTER);
        p.textSize(12);
        if (isHero) p.textStyle(p.BOLD);
        p.text(shorten(it.cat, 34), x0 + 18, y1 + barH / 2);
        p.pop();

        var bw1 = (it.value / Math.max(1, axisMax)) * barW;
        p.push();
        p.noStroke();
        if (isHero) p.fill(240, 90, 70, 230); // Coral 
        else if (it.isJunk) p.fill(180, 180, 180, 150); // Gray
        else p.fill(80, 140, 220, 200); // Blue
        p.rect(barX, y1, Math.max(0, bw1), barH, 3);
        p.pop();

        p.push();
        p.fill(it.isJunk ? 140 : (isHero ? 200 : 80));
        if (isHero) p.fill(220, 60, 40);
        p.textAlign(p.LEFT, p.CENTER);
        p.textSize(11);
        if (isHero) p.textStyle(p.BOLD);
        p.text(it.valueText, barX + bw1 + 6, y1 + barH / 2);
        p.pop();
      }

      // ==========================================
      // CHART 2: TOTAL CRASH VOLUME (Frequency)
      // ==========================================
      p.push();
      p.fill(18);
      p.textAlign(p.LEFT, p.CENTER);
      p.textSize(14);
      p.textStyle(p.BOLD);
      p.text("2. Total Crash Volume (Frequency)", x0 + 18, chart2StartY - 30);
      p.pop();

      var ticks2 = [0, agg.volAxisMax / 2, agg.volAxisMax];

      // Tick Grid
      p.push();
      p.stroke(0, 0, 0, 18);
      p.strokeWeight(1);
      for (var ti2 = 0; ti2 < ticks2.length; ti2++) {
        var t2 = ticks2[ti2] / Math.max(1, agg.volAxisMax);
        var gx2 = barX + t2 * barW;
        p.line(gx2, chart2StartY - 10, gx2, chart2StartY + (itemsCount * rowH) - 10);

        p.noStroke();
        p.fill(120);
        p.textAlign(p.CENTER, p.BOTTOM);
        p.textSize(10);
        p.text(ticks2[ti2].toLocaleString(), gx2, chart2StartY - 14);
        p.stroke(0, 0, 0, 18);
      }
      p.pop();

      // Chart 2 Rows
      var highestVolumeItem = agg.items.slice().sort((a,b) => b.count - a.count)[0];

      for (var j = 0; j < itemsCount; j++) {
        var it2 = agg.items[j];
        var y2 = chart2StartY + j * rowH;
        var isVolHero = (it2 === highestVolumeItem && !it2.isJunk);

        p.push();
        p.fill(it2.isJunk ? 140 : 40);
        p.textAlign(p.LEFT, p.CENTER);
        p.textSize(12);
        p.text(shorten(it2.cat, 34), x0 + 18, y2 + barH / 2);
        p.pop();

        var bw2 = (it2.count / Math.max(1, agg.volAxisMax)) * barW;
        p.push();
        p.noStroke();
        if (isVolHero) p.fill(40, 160, 140, 230); // Prominent Teal for highest volume
        else if (it2.isJunk) p.fill(180, 180, 180, 150);
        else p.fill(140, 190, 180, 180); // Muted Teal
        p.rect(barX, y2, Math.max(0, bw2), barH, 3);
        p.pop();

        p.push();
        p.fill(it2.isJunk ? 140 : (isVolHero ? 30 : 80));
        p.textAlign(p.LEFT, p.CENTER);
        p.textSize(11);
        if (isVolHero) p.textStyle(p.BOLD);
        p.text(it2.count.toLocaleString() + " crashes", barX + bw2 + 6, y2 + barH / 2);
        p.pop();
      }

      // ==========================================
      // WHAT TO NOTICE PANEL (Dynamic Narrative)
      // ==========================================
      var panelY = y0 + totalChartBgH + 16;
      var panelH = Math.max(100, ch - (panelY - y0) - 8);

      p.push();
      p.noStroke();
      p.fill(255, 255, 255, 185);
      p.rect(x0, panelY, cw, panelH, 16);

      p.fill(18);
      p.textAlign(p.LEFT, p.TOP);
      p.textSize(15);
      p.textStyle(p.BOLD);
      p.text("What the data is telling us", x0 + 16, panelY + 16);
      p.textStyle(p.NORMAL);

      p.fill(40);
      p.textSize(13);

      if (best && highestVolumeItem) {
        if (best.cat === highestVolumeItem.cat) {
          // Condition is both highest volume AND highest risk
          p.text(
            "Critical Alert: '" + best.cat + "' is simultaneously the most frequent AND the most dangerous condition in this data slice.",
            x0 + 16, panelY + 44
          );
          p.fill(80);
          p.textSize(12);
          p.text(
            "Actionable Insight: Prioritizing interventions targeting this specific condition will yield the highest possible impact on overall community safety.",
            x0 + 16, panelY + 68
          );
        } else {
          // Split narrative: High risk vs High Volume
          p.text(
            "While '" + best.cat + "' presents the highest per-crash danger (" + best.valueText + "), the vast majority of incidents " +
            "actually happen during '" + highestVolumeItem.cat + "' conditions (" + highestVolumeItem.count.toLocaleString() + " total crashes).",
            x0 + 16, panelY + 44, cw - 32, 40
          );
          
          p.fill(80);
          p.textSize(12);
          p.text(
            "Actionable Insight: A comprehensive safety plan must prioritize visibility/lighting for high-risk conditions, " +
            "while fundamentally redesigning physical infrastructure to reduce volume in everyday conditions.",
            x0 + 16, panelY + 84, cw - 32, 40
          );
        }
      }

      p.pop();
    }
  };
})();

// Sketch Manager.js
function startP5() {
  var localRenderer;
  localRenderer = window.Renderer;

  function SketchManager() {
    this.margin = { top: 0, left: 0, bottom: 0, right: 0 };

    this.state = {
      activeIndex: 0,
      progress: 0,

      openViz: false,
      openVizFor: null,

      filterYear: 'all',
      filterSeverity: 'all',
      filterMode: 'all',
      filterTime: 'all',
      pinResetToken: 0,

      driverYear: 'all',
      driverMode: 'all',
      driverTime: 'all',
      driverScope: 'all',
      driverFactor: 'weather',

      affectYear: 'all',
      affectTime: 'all',
      affectMetric: 'percent',
      affectPinResetToken: 0
    };

    this.data = {
      collisionsAll: [],
      bounds: null,
      loadError: null,
      hotspotAggCache: {},
      affectedCache: {},
      driversCache: {}
    };

    this._computeSize = function () {
      var canvasHost = document.getElementById('vis-canvas');
      var hostW = canvasHost ? canvasHost.clientWidth : window.innerWidth;
      var hostH = canvasHost ? canvasHost.clientHeight : window.innerHeight;

      var w = Math.max(360, hostW);
      var h = Math.max(560, hostH);

      this.width = w;
      this.height = h;
      this.canvasWidth = w;
      this.canvasHeight = h;

      this.offsetX = 0;
      this.offsetY = 0;
    };

    this._computeSize();

    var self = this;
    var sketch = function (p) {
      p.setup = function () {
        var canvasHost = document.getElementById('vis-canvas');

        if (canvasHost) {
          canvasHost.innerHTML = '';
        }

        self._computeSize();
        p.createCanvas(self.canvasWidth, self.canvasHeight).parent('vis-canvas');
        p.noStroke();
        p.frameRate(30);
      };

      p.draw = function () {
        self.draw(p);
      };

      p.windowResized = function () {
        self._computeSize();
        p.resizeCanvas(self.canvasWidth, self.canvasHeight);
      };
    };

    this.p5 = new p5(sketch);
  }

  SketchManager.prototype.setState = function (s) {
    if (s.activeIndex !== undefined) this.state.activeIndex = s.activeIndex;
    if (s.progress !== undefined) this.state.progress = s.progress;

    if (s.openViz !== undefined) this.state.openViz = !!s.openViz;
    if (s.openVizFor !== undefined) this.state.openVizFor = s.openVizFor;

    if (s.filterYear !== undefined) this.state.filterYear = s.filterYear;
    if (s.filterSeverity !== undefined) this.state.filterSeverity = s.filterSeverity;
    if (s.filterMode !== undefined) this.state.filterMode = s.filterMode;
    if (s.filterTime !== undefined) this.state.filterTime = s.filterTime;
    if (s.pinResetToken !== undefined) this.state.pinResetToken = s.pinResetToken;

    if (s.driverYear !== undefined) this.state.driverYear = s.driverYear;
    if (s.driverMode !== undefined) this.state.driverMode = s.driverMode;
    if (s.driverTime !== undefined) this.state.driverTime = s.driverTime;
    if (s.driverScope !== undefined) this.state.driverScope = s.driverScope;
    if (s.driverFactor !== undefined) this.state.driverFactor = s.driverFactor;

    if (s.affectYear !== undefined) this.state.affectYear = s.affectYear;
    if (s.affectTime !== undefined) this.state.affectTime = s.affectTime;
    if (s.affectMetric !== undefined) this.state.affectMetric = s.affectMetric;
    if (s.affectPinResetToken !== undefined) this.state.affectPinResetToken = s.affectPinResetToken;
  };

  SketchManager.prototype.setData = function (newData) {
    return localRenderer.setData(this, newData);
  };

  SketchManager.prototype.draw = function (p) {
    p.background(255);
    var ai = this.state.activeIndex || 0;
    var progress = this.state.progress || 0;
    localRenderer.draw(p, this, ai, progress);
  };

  if (window.__sketchAPI && window.__sketchAPI.p5) {
    try {
      window.__sketchAPI.p5.remove();
    } catch (e) {}
    window.__sketchAPI = null;
  }

  var manager = new SketchManager();

  if (!localRenderer || typeof localRenderer.setData !== 'function') {
    throw new Error('localRenderer.setData is required at startup.');
  }

  var setDataResult = localRenderer.setData(manager);

  var api = {
    setState: manager.setState.bind(manager),
    setData: manager.setData.bind(manager),
    p5: manager.p5,
    data: manager.data
  };

  if (setDataResult && typeof setDataResult.then === 'function') {
    api.ready = setDataResult.then(function () {
      return api;
    });
  } else {
    api.ready = Promise.resolve(api);
  }

  api.ready
    .then(function () {
      try {
        window.__sketchAPI = api;
      } catch (e) {}
    })
    .catch(function () {
      try {
        window.__sketchAPI = api;
      } catch (e) {}
    });

  return api;
}