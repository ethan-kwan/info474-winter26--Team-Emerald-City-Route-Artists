// viz_affected.js
// Stop 3: Who is affected?
// Stacked bars by road user group (Ped / Bike / Other) split by outcome severity.
// Interactions: hover tooltip + click to pin, metric toggle (percent/count), year + time filters.

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
    // If both are true, we bucket as Pedestrian (most vulnerable) to avoid double counting.
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
    return [
      state.affectYear || "all",
      state.affectTime || "all"
    ].join("|");
  }

  window.VizAffected = {
    _layout: function (p) {
      var pad = 18;
      var topBannerH = 110;
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

      // compute max for count scaling
      var maxTotal = 1;
      Object.keys(groups).forEach(function (g) {
        if (groups[g].total > maxTotal) maxTotal = groups[g].total;
      });

      var agg = {
        ready: true,
        total: total,
        groups: groups,
        maxTotal: maxTotal
      };

      manager.data.affectedCache[key] = agg;
      return agg;
    },

    draw: function (p, manager) {
      var layout = this._layout(p);

      // reset pinned if filters changed
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

      // Title + filter summary
      p.push();
      p.fill(18);
      p.textAlign(p.LEFT, p.TOP);
      p.textSize(18);
      p.text("Stop 3 — Who is affected?", layout.left, 18);

      p.fill(90);
      p.textSize(12);

      var fYear = (manager.state.affectYear === "all") ? "All years" : ("Year " + manager.state.affectYear);
      var fTime = (manager.state.affectTime === "all") ? "All day" : manager.state.affectTime;
      var metric = manager.state.affectMetric || "percent";

      p.text("Filters: " + fYear + " · " + fTime + " — showing " + agg.total + " crashes", layout.left, 42);
      p.text("Hover a segment for details. Click to pin. Metric: " + (metric === "count" ? "Count" : "Percent"), layout.left, 62);
      p.pop();

      // Main panel
      p.push();
      p.noStroke();
      p.fill(230);
      p.rect(layout.left, layout.top, layout.w, layout.h, 14);
      p.pop();

      // Chart layout
      var chartPad = 22;
      var x0 = layout.left + chartPad;
      var y0 = layout.top + chartPad;
      var cw = layout.w - chartPad * 2;
      var ch = layout.h - chartPad * 2;

      var labelW = Math.min(220, cw * 0.28);
      var barX = x0 + labelW;
      var barWMax = cw - labelW - 16;

      var groupsOrder = ["Pedestrian-involved", "Bike-involved", "Other crashes"];
      var bucketOrder = ["PDO", "Injury", "Serious", "Fatal"];

      // Color palette
      var colPDO = [210, 210, 210, 255];
      var colInj = [140, 205, 255, 235];
      var colSer = [0, 140, 255, 235];
      var colFat = [255, 90, 90, 240];

      function fillBucket(b) {
        if (b === "PDO") p.fill(colPDO[0], colPDO[1], colPDO[2], colPDO[3]);
        if (b === "Injury") p.fill(colInj[0], colInj[1], colInj[2], colInj[3]);
        if (b === "Serious") p.fill(colSer[0], colSer[1], colSer[2], colSer[3]);
        if (b === "Fatal") p.fill(colFat[0], colFat[1], colFat[2], colFat[3]);
      }

      // Legend
      p.push();
      p.textAlign(p.LEFT, p.CENTER);
      p.textSize(12);
      var lx = x0;
      var ly = y0 - 6;

      var legend = [
        { k: "PDO", c: colPDO },
        { k: "Injury", c: colInj },
        { k: "Serious", c: colSer },
        { k: "Fatal", c: colFat }
      ];

      for (var li = 0; li < legend.length; li++) {
        var item = legend[li];
        var bx = lx + li * 120;
        p.noStroke();
        p.fill(item.c[0], item.c[1], item.c[2], item.c[3]);
        p.rect(bx, ly, 14, 14, 3);

        p.fill(60);
        p.text(item.k, bx + 20, ly + 7);
      }
      p.pop();

      // Draw bars + build hover hitboxes
      var rowH = Math.min(84, ch / (groupsOrder.length + 0.4));
      var startY = y0 + 22;

      var hitboxes = [];

      for (var gi = 0; gi < groupsOrder.length; gi++) {
        var gname = groupsOrder[gi];
        var g = agg.groups[gname];

        var y = startY + gi * rowH;
        var barH = 26;

        // labels
        p.push();
        p.fill(18);
        p.textAlign(p.LEFT, p.CENTER);
        p.textSize(13);
        p.text(gname, x0, y + barH / 2);

        p.fill(90);
        p.textSize(11);
        var severe = (g.Serious + g.Fatal);
        var severePct = g.total ? Math.round((severe / g.total) * 100) : 0;
        p.text("Serious+Fatal: " + severePct + "%", x0, y + barH / 2 + 18);
        p.pop();

        // compute bar width
        var total = Math.max(1, g.total);
        var baseW = (metric === "count")
          ? (g.total / agg.maxTotal) * barWMax
          : barWMax;

        // background
        p.push();
        p.noStroke();
        p.fill(255, 255, 255, 170);
        p.rect(barX, y, barWMax, barH, 10);
        p.pop();

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
          p.rect(curX, y, segW, barH, 10);
          p.pop();

          hitboxes.push({
            group: gname,
            bucket: b,
            x: curX,
            y: y,
            w: segW,
            h: barH,
            count: cnt,
            total: g.total,
            severe: (g.Serious + g.Fatal),
            topType: topKey(g.topTypes)
          });

          curX += segW;
        }

        // bar right label (counts)
        p.push();
        p.fill(60);
        p.textAlign(p.RIGHT, p.CENTER);
        p.textSize(12);
        p.text(g.total + " crashes", barX + barWMax, y + barH / 2);
        p.pop();
      }

      // Hover/pin detection
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
      if (!active) return;

      // highlight active segment
      p.push();
      p.noFill();
      p.stroke(18, 18, 18, 190);
      p.strokeWeight(2);
      p.rect(active.x, active.y, active.w, active.h, 10);
      p.pop();

      // Tooltip
      var tipW = 360;
      var tipH = 180;

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
      p.pop();

      var pct = active.total ? Math.round((active.count / active.total) * 100) : 0;
      var severePct2 = active.total ? Math.round((active.severe / active.total) * 100) : 0;

      p.push();
      p.fill(18);
      p.textAlign(p.LEFT, p.TOP);
      p.textSize(13);
      p.text((manager._affectPinned ? "Pinned" : "Hover") + " — " + active.group, tipX + 14, tipY + 12);

      p.fill(60);
      p.textSize(12);
      p.text("Segment: " + active.bucket, tipX + 14, tipY + 38);

      p.text("Count: " + active.count, tipX + 14, tipY + 60);
      p.text("Share of this group: " + pct + "%", tipX + 14, tipY + 78);

      p.text("Serious+Fatal share (group): " + severePct2 + "%", tipX + 14, tipY + 100);

      var tt = active.topType ? active.topType : "(unknown)";
      p.text("Most common crash type (group): " + tt, tipX + 14, tipY + 122);

      p.fill(90);
      p.textSize(11);
      p.text("Insight: compare how ‘Serious’ + ‘Fatal’ changes by road user type.", tipX + 14, tipY + 148);

      p.fill(90);
      p.textSize(11);
      p.text("Click to pin/unpin.", tipX + 14, tipY + 164);
      p.pop();
    }
  };
})();