(function () {
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  function bucketFor(d) {
    var sev = (d.severity || "").toLowerCase();
    if ((d.fatalities || 0) > 0 || sev.indexOf("fatal") >= 0) return "Fatal";
    if ((d.serious || 0) > 0 || sev.indexOf("serious") >= 0) return "Serious";
    if ((d.injuries || 0) > 0 || sev.indexOf("injury") >= 0) return "Injury";
    return "PDO";
  }

  function pct1(n, d) {
    if (!d) return 0;
    return Math.round((n / d) * 1000) / 10;
  }

  function makeKey(state) {
    state = state || {};
    return (state.timeYear || "all") + "|" + (state.timeSeverity || "all");
  }

  function dowLabel(i) {
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i] || "";
  }

  function hourLabel(h) {
    if (h === 0) return "12a";
    if (h < 12) return h + "a";
    if (h === 12) return "12p";
    return (h - 12) + "p";
  }

  function niceTicks(maxVal) {
    if (maxVal <= 0) return [0];
    var step = Math.pow(10, Math.floor(Math.log10(maxVal)));
    var m = maxVal / step;
    if (m > 5) step *= 2;
    else if (m <= 2) step /= 2;
    var ticks = [];
    var t = 0;
    while (t <= maxVal * 1.01) {
      ticks.push(t);
      t += step;
    }
    if (ticks.length < 2) ticks.push(step);
    return ticks;
  }

  var axisW = 48;

  function isInWedge(mx, my, cx, cy, r1, r2, a1, a2) {
    var dx = mx - cx;
    var dy = my - cy;
    var r = Math.sqrt(dx * dx + dy * dy);
    if (r < r1 - 1 || r > r2 + 1) return false;
    var ang = Math.atan2(dy, dx);
    function norm(a) {
      while (a < 0) a += 2 * Math.PI;
      while (a >= 2 * Math.PI) a -= 2 * Math.PI;
      return a;
    }
    a1 = norm(a1);
    a2 = norm(a2);
    ang = norm(ang);
    if (a1 <= a2) return ang >= a1 - 0.02 && ang <= a2 + 0.02;
    return ang >= a1 - 0.02 || ang <= a2 + 0.02;
  }

  window.VizTime = {
    _layout: function (p) {
      var pad = 18;
      var topBannerH = 92;

      var left = pad;
      var top = pad + topBannerH;
      var w = p.width - pad * 2;
      var h = p.height - top - pad;

      return { pad: pad, topBannerH: topBannerH, left: left, top: top, w: w, h: h };
    },

    _computeAgg: function (manager) {
      manager.data = manager.data || {};
      manager.data.timeCache = manager.data.timeCache || {};

      var key = makeKey(manager.state);
      if (manager.data.timeCache[key]) return manager.data.timeCache[key];

      var all = manager.data.collisionsAll || [];
      var state = manager.state || {};
      var timeYear = state.timeYear || "all";
      var timeSeverity = state.timeSeverity || "all";

      // Filter by year
      if (timeYear && timeYear !== "all") {
        var yearStr = String(timeYear);
        var byYear = [];
        for (var yi = 0; yi < all.length; yi++) {
          if (String(all[yi].year) === yearStr) byYear.push(all[yi]);
        }
        all = byYear;
      }

      // Filter by severity (bucket label: Fatal, Serious, Injury, PDO)
      if (timeSeverity && timeSeverity !== "all") {
        var sevLabel = timeSeverity.charAt(0).toUpperCase() + timeSeverity.slice(1).toLowerCase();
        if (sevLabel === "Pdo") sevLabel = "PDO";
        if (sevLabel === "Serious") sevLabel = "Serious";
        if (sevLabel === "Injury") sevLabel = "Injury";
        if (sevLabel === "Fatal") sevLabel = "Fatal";
        var bySev = [];
        for (var si = 0; si < all.length; si++) {
          if (bucketFor(all[si]) === sevLabel) bySev.push(all[si]);
        }
        all = bySev;
      }

      if (!all.length) {
        manager.data.timeCache[key] = { ready: false };
        return manager.data.timeCache[key];
      }

      var hours = [];
      for (var h = 0; h < 24; h++) {
        hours.push({ h: h, PDO: 0, Injury: 0, Serious: 0, Fatal: 0, total: 0 });
      }

      var dows = [];
      for (var d = 0; d < 7; d++) {
        dows.push({ d: d, PDO: 0, Injury: 0, Serious: 0, Fatal: 0, total: 0 });
      }

      var totalAll = 0;
      var severeAll = 0;

      for (var i = 0; i < all.length; i++) {
        var row = all[i];
        var b = bucketFor(row);

        // hour histogram
        if (row.hour !== null && row.hour !== undefined && !isNaN(row.hour)) {
          var hh = Math.max(0, Math.min(23, row.hour));
          hours[hh][b] += 1;
          hours[hh].total += 1;
        }

        // day-of-week histogram
        if (row.dow !== null && row.dow !== undefined && !isNaN(row.dow)) {
          var dd = Math.max(0, Math.min(6, row.dow));
          dows[dd][b] += 1;
          dows[dd].total += 1;
        }

        totalAll += 1;
        if (b === "Serious" || b === "Fatal") severeAll += 1;
      }

      var maxHourTotal = 1;
      var maxDowTotal = 1;
      var peakHour = 0;
      var peakDow = 0;

      for (var j = 0; j < hours.length; j++) {
        if (hours[j].total > maxHourTotal) { maxHourTotal = hours[j].total; peakHour = hours[j].h; }
      }
      for (var k = 0; k < dows.length; k++) {
        if (dows[k].total > maxDowTotal) { maxDowTotal = dows[k].total; peakDow = dows[k].d; }
      }

      // hour with highest severe share (avoid empty)
      var worstSevHour = peakHour;
      var worstSevHourPct = -1;
      for (var q = 0; q < hours.length; q++) {
        var t = hours[q].total;
        if (!t) continue;
        var sev = (hours[q].Serious + hours[q].Fatal);
        var pSev = sev / t;
        if (pSev > worstSevHourPct) { worstSevHourPct = pSev; worstSevHour = hours[q].h; }
      }

      var agg = {
        ready: true,
        totalAll: totalAll,
        severeAll: severeAll,
        severeAllPct: pct1(severeAll, Math.max(1, totalAll)),
        hours: hours,
        dows: dows,
        maxHourTotal: maxHourTotal,
        maxDowTotal: maxDowTotal,
        peakHour: peakHour,
        peakDow: peakDow,
        worstSevHour: worstSevHour,
        worstSevHourPct: Math.max(0, worstSevHourPct)
      };

      manager.data.timeCache[key] = agg;
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

      // Sync filter state from DOM so charts always reflect sidebar dropdowns
      var yearEl = document.getElementById("time-year");
      var severityEl = document.getElementById("time-severity");
      if (yearEl && manager.state) manager.state.timeYear = yearEl.value || "all";
      if (severityEl && manager.state) manager.state.timeSeverity = severityEl.value || "all";

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

      // Reset pinned on first use
      if (manager._timePinned === undefined) manager._timePinned = null;
      if (manager._prevMousePressedTime === undefined) manager._prevMousePressedTime = false;

      // title + subtitle
      p.push();
      p.fill(18);
      p.textAlign(p.LEFT, p.TOP);
      p.textSize(22);
      p.textStyle(p.BOLD);
      p.text("Stop 4 — When does risk peak?", L.left, 18);
      p.textStyle(p.NORMAL);
      p.fill(110);
      p.textSize(12);
      p.text(
        "Time-of-day and day-of-week patterns. Bars are stacked by severity (PDO, Injury, Serious, Fatal).",
        L.left, 48
      );
      p.fill(120);
      p.textSize(11);
      var fYear = (manager.state && manager.state.timeYear !== "all") ? ("Year " + manager.state.timeYear) : "All years";
      var fSev = (manager.state && manager.state.timeSeverity !== "all") ? manager.state.timeSeverity : "All severities";
      p.text("Filters: " + fYear + " · " + fSev + " — showing " + (agg.totalAll || 0).toLocaleString() + " crashes.", L.left, 68);
      p.pop();

      // main panel
      p.push();
      p.noStroke();
      p.fill(235);
      p.rect(L.left, L.top, L.w, L.h, 16);
      p.pop();

      var pad = 18;
      var x0 = L.left + pad;
      var y0 = L.top + pad;
      var cw = L.w - pad * 2;
      var ch = L.h - pad * 2;

      // Two chart cards side by side (flex), then "What to notice" panel on the right
      var colGap = 10;
      var leftColW = Math.floor(cw * 0.61);
      var rightColW = cw - leftColW - colGap;

      var cardGap = 16;
      var cardW = Math.floor((leftColW - cardGap) / 2);
      var cardH = ch;

      var card1X = x0;
      var card1Y = y0;
      var card2X = x0 + cardW + cardGap;
      var card2Y = y0;

      var panelX = x0 + leftColW + colGap;
      var panelY = y0;
      var panelW = rightColW;
      var panelH = ch;

      function drawCard(x, y, w, h, title) {
        p.push();
        p.noStroke();
        p.fill(255, 255, 255, 190);
        p.rect(x, y, w, h, 16);
        p.fill(18);
        p.textAlign(p.LEFT, p.TOP);
        p.textSize(14);
        p.text(title, x + 16, y + 14);
        p.pop();
      }

      drawCard(card1X, card1Y, cardW, cardH, "Crashes by hour (time of day)");
      drawCard(card2X, card2Y, cardW, cardH, "Crashes by day of week");
      drawCard(panelX, panelY, panelW, panelH, "What to notice");

      var colPDO = [214, 214, 214, 255];
      var colInj = [160, 215, 255, 240];
      var colSer = [0, 140, 255, 240];
      var colFat = [255, 90, 90, 245];
      var bucketOrder = ["PDO", "Injury", "Serious", "Fatal"];

      function fillBucket(b) {
        if (b === "PDO") p.fill(colPDO[0], colPDO[1], colPDO[2], colPDO[3]);
        if (b === "Injury") p.fill(colInj[0], colInj[1], colInj[2], colInj[3]);
        if (b === "Serious") p.fill(colSer[0], colSer[1], colSer[2], colSer[3]);
        if (b === "Fatal") p.fill(colFat[0], colFat[1], colFat[2], colFat[3]);
      }

      var chart1LeftPad = 12;

      var hitboxes = [];

      // -------------------------
      // Chart 1: by hour (radial / clock)
      // -------------------------
      (function drawByHour() {
        var chartX = card1X + chart1LeftPad;
        var chartY = card1Y + 42;
        var chartW = cardW - chart1LeftPad * 2;
        var chartH = cardH - 42;
        var cx = chartX + chartW / 2;
        var cy = chartY + chartH / 2;
        var innerR = 20;
        var maxR = Math.min(chartW, chartH) / 2 - 10;
        var maxBarLen = maxR - innerR;

        // clock circle outline
        p.push();
        p.noFill();
        p.stroke(0, 0, 0, 18);
        p.strokeWeight(1);
        p.ellipse(cx, cy, innerR * 2, innerR * 2);
        p.ellipse(cx, cy, maxR * 2, maxR * 2);
        p.pop();

        var bars = agg.hours;
        var n = bars.length;
        var step = (2 * Math.PI) / n;
        var gap = step * 0.12;
        var halfWidth = (step - gap) / 2;

        for (var i = 0; i < n; i++) {
          var it = bars[i];
          var centerAng = (i / n) * 2 * Math.PI - Math.PI / 2;
          var a1 = centerAng - halfWidth;
          var a2 = centerAng + halfWidth;
          var barLen = (it.total / Math.max(1, agg.maxHourTotal)) * maxBarLen;
          if (barLen < 1) barLen = 0;

          var r0 = innerR;
          for (var bi = 0; bi < bucketOrder.length; bi++) {
            var b = bucketOrder[bi];
            var cnt = it[b] || 0;
            if (!cnt || !it.total) continue;
            var segLen = (cnt / it.total) * barLen;
            if (segLen < 1.5) continue;
            var r1 = r0 + segLen;

            p.push();
            p.noStroke();
            fillBucket(b);
            p.beginShape();
            p.vertex(cx + r0 * Math.cos(a1), cy + r0 * Math.sin(a1));
            p.vertex(cx + r1 * Math.cos(a1), cy + r1 * Math.sin(a1));
            p.vertex(cx + r1 * Math.cos(a2), cy + r1 * Math.sin(a2));
            p.vertex(cx + r0 * Math.cos(a2), cy + r0 * Math.sin(a2));
            p.endShape(p.CLOSE);
            p.pop();

            hitboxes.push({
              chart: "hour",
              hour: it.h,
              bucket: b,
              cx: cx, cy: cy, r1: r0, r2: r1, a1: a1, a2: a2,
              count: cnt,
              total: it.total,
              severe: it.Serious + it.Fatal
            });

            r0 = r1;
          }

          if (it.h % 3 === 0 || it.h === 0) {
            var labelR = maxR + 16;
            var lx = cx + labelR * Math.cos(centerAng);
            var ly = cy + labelR * Math.sin(centerAng);
            p.push();
            p.noStroke();
            p.fill(120);
            p.textAlign(p.CENTER, p.CENTER);
            p.textSize(10);
            p.text(hourLabel(it.h), lx, ly);
            p.pop();
          }
        }

        p.push();
        p.noStroke();
        p.fill(60);
        p.textAlign(p.CENTER, p.TOP);
        p.textSize(11);
        p.text("Time of day (hour)", cx, chartY + chartH + 10);
        p.pop();
      })();

      // -------------------------
      // Chart 2: by day-of-week
      // -------------------------
      (function drawByDow() {
        var chartX = card2X + 12;
        var chartY = card2Y + 40;
        var chartW = cardW - 24 - axisW;
        var chartH = cardH - 46;
        var barAreaX = chartX + axisW;

        // y-axis
        var yTicks = niceTicks(agg.maxDowTotal);
        p.push();
        p.stroke(0, 0, 0, 22);
        p.strokeWeight(1);
        p.line(barAreaX, chartY, barAreaX, chartY + chartH);
        p.line(barAreaX, chartY + chartH, barAreaX + chartW, chartY + chartH);
        p.noStroke();
        p.fill(100);
        p.textAlign(p.RIGHT, p.CENTER);
        p.textSize(10.5);
        for (var ti = 0; ti < yTicks.length; ti++) {
          var val = yTicks[ti];
          var yy = chartY + chartH - (val / Math.max(1, agg.maxDowTotal)) * chartH;
          if (yy < chartY - 2) continue;
          p.text(String(val), barAreaX - 8, yy);
        }
        p.textAlign(p.RIGHT, p.CENTER);
        p.textSize(11);
        p.fill(60);
        p.text("Crashes", barAreaX - 8, chartY + chartH / 2);
        p.pop();

        var bars = agg.dows;
        var n = bars.length;
        var gap = 10;
        var barW = (chartW - (n - 1) * gap) / n;
        barW = Math.max(16, Math.min(46, barW));

        for (var i = 0; i < n; i++) {
          var it = bars[i];
          var bx = barAreaX + i * (barW + gap);
          var baseH = (it.total / Math.max(1, agg.maxDowTotal)) * chartH;

          var curY = chartY + chartH;
          for (var bi = 0; bi < bucketOrder.length; bi++) {
            var b = bucketOrder[bi];
            var cnt = it[b] || 0;
            if (!cnt || !it.total) continue;
            var segH = (cnt / it.total) * baseH;
            if (segH < 0.8) continue;

            curY -= segH;
            p.push();
            p.noStroke();
            fillBucket(b);
            p.rect(bx, curY, barW, segH, 3);
            p.pop();

            hitboxes.push({
              chart: "dow",
              dow: it.d,
              bucket: b,
              x: bx, y: curY, w: barW, h: segH,
              count: cnt,
              total: it.total,
              severe: it.Serious + it.Fatal
            });
          }

          p.push();
          p.noStroke();
          p.fill(120);
          p.textAlign(p.CENTER, p.TOP);
          p.textSize(11);
          p.text(dowLabel(it.d), bx + barW / 2, chartY + chartH + 8);
          p.pop();
        }
        p.push();
        p.noStroke();
        p.fill(60);
        p.textAlign(p.CENTER, p.TOP);
        p.textSize(11);
        p.text("Day of week", barAreaX + chartW / 2, chartY + chartH + 26);
        p.pop();
      })();

      // Severity legend at bottom of charts (left column) — inside gray box
      var pillH = 22;
      var legendY = y0 + ch - pillH - 12;
      var legend = [
        { k: "PDO", c: colPDO },
        { k: "Injury", c: colInj },
        { k: "Serious", c: colSer },
        { k: "Fatal", c: colFat }
      ];
      p.push();
      p.textAlign(p.LEFT, p.CENTER);
      p.textSize(11);
      var lx = x0 + 12;
      var pillW = 72;
      for (var li = 0; li < legend.length; li++) {
        var it = legend[li];
        p.noStroke();
        p.fill(255, 255, 255, 210);
        p.rect(lx, legendY, pillW, pillH, 6);
        p.fill(it.c[0], it.c[1], it.c[2], it.c[3]);
        p.rect(lx + 8, legendY + 6, 10, 10, 3);
        p.fill(60);
        p.text(it.k, lx + 24, legendY + pillH / 2);
        lx += pillW + 10;
      }
      p.pop();

      function findHover(mx, my) {
        for (var i = hitboxes.length - 1; i >= 0; i--) {
          var hb = hitboxes[i];
          if (hb.r1 !== undefined) {
            if (isInWedge(mx, my, hb.cx, hb.cy, hb.r1, hb.r2, hb.a1, hb.a2)) return hb;
          } else {
            if (mx >= hb.x && mx <= hb.x + hb.w && my >= hb.y && my <= hb.y + hb.h) return hb;
          }
        }
        return null;
      }

      var hover = findHover(p.mouseX, p.mouseY);
      var justPressed = p.mouseIsPressed && !manager._prevMousePressedTime;
      if (justPressed) {
        if (manager._timePinned) manager._timePinned = null;
        else if (hover) manager._timePinned = hover;
      }
      manager._prevMousePressedTime = p.mouseIsPressed;

      var active = manager._timePinned || hover;

      if (active) {
        if (active.r1 !== undefined) {
          p.push();
          p.noFill();
          p.stroke(18, 18, 18, 190);
          p.strokeWeight(2);
          p.beginShape();
          p.vertex(active.cx + active.r1 * Math.cos(active.a1), active.cy + active.r1 * Math.sin(active.a1));
          p.vertex(active.cx + active.r2 * Math.cos(active.a1), active.cy + active.r2 * Math.sin(active.a1));
          p.vertex(active.cx + active.r2 * Math.cos(active.a2), active.cy + active.r2 * Math.sin(active.a2));
          p.vertex(active.cx + active.r1 * Math.cos(active.a2), active.cy + active.r1 * Math.sin(active.a2));
          p.endShape(p.CLOSE);
          p.pop();
        } else {
          p.push();
          p.noFill();
          p.stroke(18, 18, 18, 190);
          p.strokeWeight(2);
          p.rect(active.x, active.y, active.w, active.h, 6);
          p.pop();
        }

        var tipW = 220;
        var tipH = 88;
        var ax = manager._timePinned
          ? (active.r1 !== undefined
            ? (active.cx + (active.r1 + active.r2) / 2 * Math.cos((active.a1 + active.a2) / 2))
            : (active.x + active.w / 2))
          : p.mouseX;
        var ay = manager._timePinned
          ? (active.r1 !== undefined
            ? (active.cy + (active.r1 + active.r2) / 2 * Math.sin((active.a1 + active.a2) / 2))
            : (active.y + active.h / 2))
          : p.mouseY;
        var tipMaxX = Math.min(x0 + cw - tipW - 16, panelX - tipW - 8);
        var tipX = clamp(ax + 12, x0 + 16, tipMaxX);
        var tipY = clamp(ay - tipH - 12, y0 + 16, y0 + ch - tipH - 16);

        var segPct = pct1(active.count, Math.max(1, active.total));
        var sevPct = pct1(active.severe, Math.max(1, active.total));

        var title = (active.chart === "hour")
          ? (hourLabel(active.hour) + " · " + active.bucket)
          : (dowLabel(active.dow) + " · " + active.bucket);

        p.push();
        p.noStroke();
        p.fill(0, 0, 0, 12);
        p.rect(tipX + 3, tipY + 4, tipW, tipH, 14);
        p.pop();

        p.push();
        p.noStroke();
        p.fill(220, 222, 228, 238);
        p.rect(tipX, tipY, tipW, tipH, 14);

        p.fill(18);
        p.textAlign(p.LEFT, p.TOP);
        p.textSize(13);
        p.text((manager._timePinned ? "Pinned" : "Hover") + " — " + title, tipX + 14, tipY + 12);
        p.fill(60);
        p.textSize(12);
        p.text("Count: " + active.count + " crashes (" + segPct.toFixed(1) + "% of bar)", tipX + 14, tipY + 36);
        p.text("Serious+Fatal: " + sevPct.toFixed(1) + "%", tipX + 14, tipY + 56);
        p.fill(90);
        p.textSize(11);
        p.text("Click to pin/unpin.", tipX + 14, tipY + 76);
        p.pop();
      }

      // What to notice (right panel)
      (function drawInsights() {
        var ix = panelX + 16;
        var iy = panelY + 46;
        var iw = panelW - 32;
        var ih = panelH - 62;

        p.push();
        p.fill(18);
        p.textAlign(p.LEFT, p.TOP);
        p.textSize(12.5);
        p.text("Quick takeaways", ix, iy);

        p.fill(60);
        p.textSize(13);
        var line1 = "Peak crash volume hour: " + hourLabel(agg.peakHour) + " (" + agg.hours[agg.peakHour].total + " crashes).";
        var line2 = "Highest severe-share hour: " + hourLabel(agg.worstSevHour) + " (" + (agg.worstSevHourPct * 100).toFixed(1) + "% severe).";
        var line3 = "Peak crash volume day: " + dowLabel(agg.peakDow) + " (" + agg.dows[agg.peakDow].total + " crashes).";
        var note = "*Note: There may be reporting issues in the crash time field. The midnight (12 a.m.) count may be inflated if some crashes without a recorded time were entered as 12 a.m. This is not explicitly stated in the dataset, but inferred by our team—use discernment when interpreting this peak.";
        var line4 = "The crash data shows that the highest number of crashes occurs at midnight (12 a.m.), with 5,807 crashes, indicating that late-night hours may be a particularly risky time for driving. However, while midnight has the most crashes overall, 2 a.m. has the highest proportion of severe crashes, with 8.7% classified as severe, suggesting that crashes occurring later in the night may be more dangerous. In terms of weekly patterns, Friday experiences the most crashes (4,282), which could reflect increased travel and nighttime activity at the end of the workweek. Together, these patterns suggest that late-night hours and the start of the weekend are key periods of elevated crash risk.";

        p.text(line1, ix, iy + 26);
        p.text(line2, ix, iy + 50);
        p.text(line3, ix, iy + 74);
        p.fill(120);
        p.textSize(10.5);
        p.text(note, ix, iy + 96, iw, 44);

        p.fill(60);
        p.textSize(12);
        p.text(line4, ix, iy + 144, iw, ih - 144);
        p.pop();
      })();
    }
  };
})();

