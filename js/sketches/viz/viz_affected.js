// viz_affected.js
// Stop 3: Who is affected?
// Modern stacked bars by group (Ped / Bike / Other) split by severity.
// UX improvements:
// - percent axis + gridlines
// - legend pills
// - clear labels + “Serious+Fatal rate” badge
// - “What to notice” insight panel to reduce empty space
// - cleaner tooltip + click-to-pin
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

  function groupFor(d) {
    if (d.isPed) return "Pedestrian-involved";
    if (d.isBike) return "Bike-involved";
    return "Other crashes";
  }

  function bucketFor(d) {
    var sev = (d.severity || "").toLowerCase();
    if ((d.fatalities || 0) > 0 || sev.indexOf("fatal") >= 0) return "Fatal";
    if ((d.serious || 0) > 0 || sev.indexOf("serious") >= 0) return "Serious";
    if ((d.injuries || 0) > 0 || sev.indexOf("injury") >= 0) return "Injury";
    return "PDO";
  }

  function topKeyUpdate(map, key) {
    if (!key) return;
    map[key] = (map[key] || 0) + 1;
  }

  function topKey(map) {
    var bestK = "";
    var bestV = -1;
    Object.keys(map || {}).forEach(function (k) {
      if (map[k] > bestV) { bestV = map[k]; bestK = k; }
    });
    return bestK;
  }

  function makeAggKey(state) {
    return [state.affectYear || "all", state.affectTime || "all"].join("|");
  }

  function pct(n, d) {
    if (!d) return 0;
    return Math.round((n / d) * 100);
  }

  window.VizAffected = {
    _layout: function (p) {
      var pad = 18;

      // Make more room so HTML controls don't feel like they're “covering” the chart.
      var topBannerH = 150;

      var left = pad;
      var top = pad + topBannerH;
      var w = p.width - pad * 2;
      var h = p.height - top - pad;

      return { left: left, top: top, w: w, h: h, pad: pad, topBannerH: topBannerH };
    },

    _computeAgg: function (manager) {
      manager.data = manager.data || {};
      manager.data.affectedCache = manager.data.affectedCache || {};

      var key = makeAggKey(manager.state);
      if (manager.data.affectedCache[key]) return manager.data.affectedCache[key];

      var all = manager.data.collisionsAll || [];
      if (!all.length) {
        manager.data.affectedCache[key] = { ready: false };
        return manager.data.affectedCache[key];
      }

      var yearFilter = manager.state.affectYear || "all";
      var timeFilter = manager.state.affectTime || "all";

      var groups = {
        "Pedestrian-involved": { PDO: 0, Injury: 0, Serious: 0, Fatal: 0, total: 0, topTypes: {} },
        "Bike-involved":       { PDO: 0, Injury: 0, Serious: 0, Fatal: 0, total: 0, topTypes: {} },
        "Other crashes":       { PDO: 0, Injury: 0, Serious: 0, Fatal: 0, total: 0, topTypes: {} }
      };

      var total = 0;

      for (var i = 0; i < all.length; i++) {
        var d = all[i];

        if (yearFilter !== "all") {
          if (String(d.year) !== String(yearFilter)) continue;
        }
        if (!timeMatch(d.hour, timeFilter)) continue;

        var g = groupFor(d);
        var b = bucketFor(d);

        groups[g][b] += 1;
        groups[g].total += 1;
        total += 1;

        topKeyUpdate(groups[g].topTypes, d.collisionType);
      }

      var maxTotal = 1;
      Object.keys(groups).forEach(function (g) {
        if (groups[g].total > maxTotal) maxTotal = groups[g].total;
      });

      // compute severe rates for callouts
      var rates = {};
      Object.keys(groups).forEach(function (g) {
        var severe = (groups[g].Serious + groups[g].Fatal);
        rates[g] = groups[g].total ? (severe / groups[g].total) : 0;
      });

      var worstGroup = "Pedestrian-involved";
      var worstVal = -1;
      Object.keys(rates).forEach(function (g) {
        if (rates[g] > worstVal) { worstVal = rates[g]; worstGroup = g; }
      });

      var agg = {
        ready: true,
        total: total,
        groups: groups,
        maxTotal: maxTotal,
        rates: rates,
        worstGroup: worstGroup
      };

      manager.data.affectedCache[key] = agg;
      return agg;
    },

    draw: function (p, manager) {
      var layout = this._layout(p);

      // Reset pinned when filters change
      if (manager._affectPinSeen !== manager.state.affectPinResetToken) {
        manager._affectPinSeen = manager.state.affectPinResetToken;
        manager._affectPinned = null;
      }
      if (manager._prevMousePressedAffect === undefined) manager._prevMousePressedAffect = false;

      p.background(248, 249, 252);

      // Header strip
      p.push();
      p.noStroke();
      p.fill(255);
      p.rect(0, 0, p.width, layout.topBannerH + 18);
      p.pop();

      // Load error
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

      var metric = manager.state.affectMetric || "percent";
      var fYear = (manager.state.affectYear === "all") ? "All years" : ("Year " + manager.state.affectYear);
      var fTime = (manager.state.affectTime === "all") ? "All day" : manager.state.affectTime;

      // Title + subtitle (clear hierarchy)
      p.push();
      p.fill(18);
      p.textAlign(p.LEFT, p.TOP);
      p.textSize(20);
      p.text("Stop 3 — Who is affected?", layout.left, 18);

      p.fill(90);
      p.textSize(12);
      p.text("Compare severity outcomes across pedestrians, cyclists, and other crashes.", layout.left, 46);

      p.text(
        "Filters: " + fYear + " · " + fTime +
        " — showing " + agg.total + " crashes · Metric: " + (metric === "count" ? "Count" : "Percent"),
        layout.left, 66
      );

      // Callout “what to notice”
      var severePed = pct(agg.groups["Pedestrian-involved"].Serious + agg.groups["Pedestrian-involved"].Fatal,
                          agg.groups["Pedestrian-involved"].total);
      var severeBike = pct(agg.groups["Bike-involved"].Serious + agg.groups["Bike-involved"].Fatal,
                           agg.groups["Bike-involved"].total);
      var severeOther = pct(agg.groups["Other crashes"].Serious + agg.groups["Other crashes"].Fatal,
                            agg.groups["Other crashes"].total);

      var insight =
        "What to notice: Serious + Fatal share is highest for " + agg.worstGroup +
        " (Ped " + severePed + "% · Bike " + severeBike + "% · Other " + severeOther + "%).";

      p.noStroke();
      p.fill(0, 140, 255, 20);
      p.rect(layout.left, 88, Math.min(920, layout.w), 34, 12);

      p.fill(18);
      p.textSize(12);
      p.text(insight, layout.left + 12, 97);
      p.pop();

      // Main panel background
      p.push();
      p.noStroke();
      p.fill(235);
      p.rect(layout.left, layout.top, layout.w, layout.h, 16);
      p.pop();

      // Chart area
      var chartPad = 26;
      var x0 = layout.left + chartPad;
      var y0 = layout.top + chartPad;
      var cw = layout.w - chartPad * 2;
      var ch = layout.h - chartPad * 2;

      // Make the chart live in the top half (so we can use bottom for explanation)
      var chartH = Math.min(320, ch * 0.48);

      var labelW = Math.min(240, cw * 0.32);
      var barX = x0 + labelW;
      var barWMax = cw - labelW - 16;

      var groupsOrder = ["Pedestrian-involved", "Bike-involved", "Other crashes"];
      var bucketOrder = ["PDO", "Injury", "Serious", "Fatal"];

      // Colors
      var colPDO = [214, 214, 214, 255];
      var colInj = [160, 215, 255, 240];
      var colSer = [0, 140, 255, 240];
      var colFat = [255, 90, 90, 245];

      function fillBucket(b) {
        if (b === "PDO") p.fill(colPDO[0], colPDO[1], colPDO[2], colPDO[3]);
        if (b === "Injury") p.fill(colInj[0], colInj[1], colInj[2], colInj[3]);
        if (b === "Serious") p.fill(colSer[0], colSer[1], colSer[2], colSer[3]);
        if (b === "Fatal") p.fill(colFat[0], colFat[1], colFat[2], colFat[3]);
      }

      // Legend pills (modern)
      (function drawLegend() {
        var lx = x0;
        var ly = y0;

        var legend = [
          { k: "PDO", c: colPDO },
          { k: "Injury", c: colInj },
          { k: "Serious", c: colSer },
          { k: "Fatal", c: colFat }
        ];

        p.push();
        p.textAlign(p.LEFT, p.CENTER);
        p.textSize(12);

        var x = lx;
        for (var i = 0; i < legend.length; i++) {
          var it = legend[i];
          var pillW = 92;
          var pillH = 26;

          p.noStroke();
          p.fill(255, 255, 255, 190);
          p.rect(x, ly, pillW, pillH, 999);

          p.fill(it.c[0], it.c[1], it.c[2], it.c[3]);
          p.rect(x + 10, ly + 8, 10, 10, 3);

          p.fill(60);
          p.text(it.k, x + 26, ly + pillH / 2);
          x += pillW + 10;
        }
        p.pop();
      })();

      // Axis gridlines (percent mode only)
      if (metric !== "count") {
        p.push();
        p.stroke(255, 255, 255, 170);
        p.strokeWeight(1);

        var ticks = [0, 25, 50, 75, 100];
        for (var ti = 0; ti < ticks.length; ti++) {
          var t = ticks[ti] / 100;
          var gx = barX + t * barWMax;
          p.line(gx, y0 + 44, gx, y0 + 44 + chartH);

          p.noStroke();
          p.fill(120);
          p.textAlign(p.CENTER, p.BOTTOM);
          p.textSize(11);
          p.text(ticks[ti] + "%", gx, y0 + 40);
          p.stroke(255, 255, 255, 170);
        }
        p.pop();
      }

      // Draw rows
      var rowH = 86;
      var startY = y0 + 54;

      var hitboxes = [];

      for (var gi = 0; gi < groupsOrder.length; gi++) {
        var gname = groupsOrder[gi];
        var g = agg.groups[gname];

        var y = startY + gi * rowH;
        var barH = 28;

        var severe = (g.Serious + g.Fatal);
        var severePct = pct(severe, g.total);

        // Row label block
        p.push();
        p.fill(18);
        p.textAlign(p.LEFT, p.TOP);
        p.textSize(13);
        p.text(gname, x0, y - 2);

        // “badge”
        var badgeW = 140;
        var badgeH = 22;
        p.noStroke();
        p.fill(0, 0, 0, 12);
        p.rect(x0, y + 18, badgeW, badgeH, 999);

        p.fill(60);
        p.textSize(11);
        p.textAlign(p.LEFT, p.CENTER);
        p.text("Serious+Fatal: " + severePct + "%", x0 + 10, y + 18 + badgeH / 2);
        p.pop();

        // background track
        p.push();
        p.noStroke();
        p.fill(255, 255, 255, 175);
        p.rect(barX, y + 6, barWMax, barH, 999);
        p.pop();

        // base width
        var total = Math.max(1, g.total);
        var baseW = (metric === "count") ? (g.total / agg.maxTotal) * barWMax : barWMax;

        // segments
        var curX = barX;
        for (var bi = 0; bi < bucketOrder.length; bi++) {
          var b = bucketOrder[bi];
          var cnt = g[b] || 0;

          var segW = (cnt / total) * baseW;
          if (segW < 0.5) continue;

          p.push();
          p.noStroke();
          fillBucket(b);
          // no rounding on inner segments, keep it clean
          p.rect(curX, y + 6, segW, barH);
          p.pop();

          // subtle separators
          p.push();
          p.stroke(255, 255, 255, 120);
          p.strokeWeight(1);
          p.line(curX, y + 6, curX, y + 6 + barH);
          p.pop();

          hitboxes.push({
            group: gname,
            bucket: b,
            x: curX,
            y: y + 6,
            w: segW,
            h: barH,
            count: cnt,
            total: g.total,
            severe: severe,
            topType: topKey(g.topTypes)
          });

          curX += segW;
        }

        // endcap rounding by drawing a mask over whole bar
        p.push();
        p.noFill();
        p.stroke(255, 255, 255, 0);
        p.rect(barX, y + 6, baseW, barH, 999);
        p.pop();

        // Right label: total crashes (always)
        p.push();
        p.fill(60);
        p.textAlign(p.RIGHT, p.CENTER);
        p.textSize(12);
        p.text(g.total + " crashes", barX + barWMax, y + 6 + barH / 2);
        p.pop();
      }

      // hover detection
      function findHover(mx, my) {
        for (var i = 0; i < hitboxes.length; i++) {
          var hb = hitboxes[i];
          if (mx >= hb.x && mx <= hb.x + hb.w && my >= hb.y && my <= hb.y + hb.h) return hb;
        }
        return null;
      }

      var hover = findHover(p.mouseX, p.mouseY);

      // click-to-pin
      var justPressed = p.mouseIsPressed && !manager._prevMousePressedAffect;
      if (justPressed) {
        if (manager._affectPinned) manager._affectPinned = null;
        else if (hover) manager._affectPinned = hover;
      }
      manager._prevMousePressedAffect = p.mouseIsPressed;

      var active = manager._affectPinned || hover;
      if (active) {
        // highlight
        p.push();
        p.noFill();
        p.stroke(18, 18, 18, 190);
        p.strokeWeight(2);
        p.rect(active.x, active.y, active.w, active.h, 6);
        p.pop();

        // tooltip (cleaner)
        var tipW = 380;
        var tipH = 176;

        var ax = manager._affectPinned ? (active.x + active.w / 2) : p.mouseX;
        var ay = manager._affectPinned ? (active.y + active.h / 2) : p.mouseY;

        var tipX = clamp(ax + 16, layout.left + 16, layout.left + layout.w - tipW - 16);
        var tipY = clamp(ay - tipH - 16, layout.top + 16, layout.top + layout.h - tipH - 16);

        // shadow
        p.push();
        p.noStroke();
        p.fill(0, 0, 0, 18);
        p.rect(tipX + 3, tipY + 4, tipW, tipH, 14);
        p.pop();

        // box
        p.push();
        p.noStroke();
        p.fill(255);
        p.rect(tipX, tipY, tipW, tipH, 14);

        var segPct = pct(active.count, active.total);
        var severePct2 = pct(active.severe, active.total);
        var tt = active.topType ? active.topType : "(unknown)";

        p.fill(18);
        p.textAlign(p.LEFT, p.TOP);
        p.textSize(13);
        p.text((manager._affectPinned ? "Pinned" : "Hover") + " — " + active.group, tipX + 14, tipY + 12);

        p.fill(60);
        p.textSize(12);
        p.text("Segment: " + active.bucket, tipX + 14, tipY + 38);
        p.text("Count: " + active.count + " (" + segPct + "% of this group)", tipX + 14, tipY + 60);
        p.text("Serious+Fatal rate (group): " + severePct2 + "%", tipX + 14, tipY + 82);

        p.fill(90);
        p.textSize(11);
        p.text("Most common crash type (group): " + tt, tipX + 14, tipY + 108);
        p.text("Click to pin/unpin. Use filters to compare years + times.", tipX + 14, tipY + 130);
        p.pop();
      }

      // Bottom “explain” panel to use space and guide reading
      var panelX = x0;
      var panelY = y0 + 44 + Math.max(320, chartH) + 22;
      var panelW = cw;
      var panelH = Math.min(220, layout.top + layout.h - panelY - 22);

      if (panelH > 120) {
        p.push();
        p.noStroke();
        p.fill(255, 255, 255, 185);
        p.rect(panelX, panelY, panelW, panelH, 16);

        p.fill(18);
        p.textAlign(p.LEFT, p.TOP);
        p.textSize(14);
        p.text("How to read this", panelX + 16, panelY + 14);

        p.fill(60);
        p.textSize(12);
        p.text(
          "Each row is a crash group (pedestrian, bike, or other). The bar shows the share of outcomes.\n" +
          "Focus on the right side (Serious + Fatal) to compare how risky crashes are for different users.\n" +
          "Try switching Year to see whether these patterns change over time.",
          panelX + 16, panelY + 40
        );

        // mini takeaway bullets
        p.fill(18);
        p.textSize(12);
        p.text("Quick takeaways:", panelX + 16, panelY + 110);

        p.fill(60);
        p.text(
          "• Pedestrian-involved crashes usually have the highest severe share.\n" +
          "• Bike-involved crashes often sit in the middle.\n" +
          "• “Other crashes” are most common but typically less severe (more PDO).",
          panelX + 16, panelY + 132
        );

        p.pop();
      }
    }
  };
})();