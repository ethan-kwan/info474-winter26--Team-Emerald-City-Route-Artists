// viz_streetcontext.js
// Stop 5: Road context — collisions by speed limit (street context).
// Summary table + bar chart (stacked by severity). Data from collisions + Seattle Streets match on LOCATION.
(function () {
  function norm(s) { return (s || '').trim().toUpperCase().replace(/\s+/g, ' '); }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function pct(num, den) { return den ? (Math.round((num / den) * 1000) / 10) + '%' : '0%'; }

  function bucketFor(d) {
    var sev = (d.severity || '').toLowerCase();
    if ((d.fatalities || 0) > 0 || sev.indexOf('fatal') >= 0) return 'Fatal';
    if ((d.serious || 0) > 0 || sev.indexOf('serious') >= 0) return 'Serious';
    if ((d.injuries || 0) > 0 || sev.indexOf('injury') >= 0) return 'Injury';
    return 'PDO';
  }

  function makeKey(state) {
    state = state || {};
    return (state.streetContextYear || 'all') + '|' + (state.streetContextSeverity || 'all');
  }

  window.VizStreetContext = {
    _layout: function (p) {
      var pad = 18;
      // Slightly tighter header so the chart fits without clipping
      var topBannerH = 92;
      var left = pad;
      var top = pad + topBannerH;
      var w = p.width - pad * 2;
      var h = p.height - top - pad;
      return { pad: pad, topBannerH: topBannerH, left: left, top: top, w: w, h: h };
    },

    _computeAgg: function (manager) {
      if (!manager || !manager.data) return { ready: false, items: [], total: 0, matched: 0, pctMatched: 0, maxRatePer100: 0 };
      manager.data.streetContextCache = manager.data.streetContextCache || {};
      var key = makeKey(manager.state);
      if (manager.data.streetContextCache[key]) return manager.data.streetContextCache[key];

      var collisions = manager.data.collisionsAll || [];
      var state = manager.state || {};
      var streetContextYear = state.streetContextYear || 'all';
      var streetContextSeverity = state.streetContextSeverity || 'all';

      // Filter by year
      if (streetContextYear && streetContextYear !== 'all') {
        var yearStr = String(streetContextYear);
        var byYear = [];
        for (var yi = 0; yi < collisions.length; yi++) {
          if (String(collisions[yi].year) === yearStr) byYear.push(collisions[yi]);
        }
        collisions = byYear;
      }

      // Filter by severity (bucket label: Fatal, Serious, Injury, PDO)
      if (streetContextSeverity && streetContextSeverity !== 'all') {
        var sevLabel = streetContextSeverity.charAt(0).toUpperCase() + streetContextSeverity.slice(1).toLowerCase();
        if (sevLabel === 'Pdo') sevLabel = 'PDO';
        if (sevLabel === 'Serious') sevLabel = 'Serious';
        if (sevLabel === 'Injury') sevLabel = 'Injury';
        if (sevLabel === 'Fatal') sevLabel = 'Fatal';
        var bySev = [];
        for (var si = 0; si < collisions.length; si++) {
          if (bucketFor(collisions[si]) === sevLabel) bySev.push(collisions[si]);
        }
        collisions = bySev;
      }

      var lookup = manager.data.streetSpeedByDesc || {};
      var total = collisions.length;
      var matched = 0;
      var bySpeed = {}; // speed -> { PDO, Injury, Serious, Fatal, total }

      for (var i = 0; i < collisions.length; i++) {
        var d = collisions[i];
        var locKey = norm(d.location);
        var speed = locKey ? lookup[locKey] : undefined;
        if (speed === undefined || speed === null) continue;
        matched++;
        var sp = Number(speed);
        if (!bySpeed[sp]) bySpeed[sp] = { PDO: 0, Injury: 0, Serious: 0, Fatal: 0, total: 0 };
        var b = bucketFor(d);
        bySpeed[sp][b]++;
        bySpeed[sp].total++;
      }

      var segmentCountBySpeed = manager.data.streetCountBySpeed || {};
      var speeds = Object.keys(bySpeed).map(Number).sort(function (a, b) { return a - b; });
      var items = speeds.map(function (sp) {
        var o = bySpeed[sp];
        var segCount = Math.max(1, segmentCountBySpeed[sp] || 1);
        var ratePer100 = (o.total / segCount) * 100;
        return {
          speed: sp,
          PDO: o.PDO,
          Injury: o.Injury,
          Serious: o.Serious,
          Fatal: o.Fatal,
          total: o.total,
          segmentCount: segCount,
          ratePer100: ratePer100
        };
      });
      var maxRatePer100 = 0;
      for (var j = 0; j < items.length; j++) {
        if (items[j].ratePer100 > maxRatePer100) maxRatePer100 = items[j].ratePer100;
      }

      var pctMatched = total ? Math.round((matched / total) * 1000) / 10 : 0;
      var result = {
        ready: true,
        total: total,
        matched: matched,
        pctMatched: pctMatched,
        items: items,
        maxRatePer100: maxRatePer100
      };
      manager.data.streetContextCache[key] = result;
      return result;
    },

    draw: function (p, manager) {
      if (!p || !manager) return;
      if (!manager.data) {
        p.background(248, 249, 252);
        p.fill(80);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(14);
        p.text("Loading…", p.width / 2, p.height / 2);
        return;
      }
      if (!manager.state) manager.state = {};

      var L = this._layout(p);
      p.background(248, 249, 252);

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
        p.text("Couldn't load collision data.\n\n" + manager.data.loadError, p.width / 2, p.height / 2);
        p.pop();
        return;
      }

      // Sync filter state from DOM so chart reflects sidebar dropdowns
      var yearEl = document.getElementById('street-year');
      var severityEl = document.getElementById('street-severity');
      if (yearEl && manager.state) manager.state.streetContextYear = yearEl.value || 'all';
      if (severityEl && manager.state) manager.state.streetContextSeverity = severityEl.value || 'all';

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

      // Title + subtitle
      p.push();
      p.fill(18);
      p.textAlign(p.LEFT, p.TOP);
      p.textSize(22);
      p.textStyle(p.BOLD);
      p.text("Stop 5 — Road context: speed limit", L.left, 18);
      p.textStyle(p.NORMAL);
      p.fill(110);
      p.textSize(12);
      p.text(
        "Collisions matched to Seattle street segments by location. Chart: crashes per 100 segments by speed limit, stacked by severity.",
        L.left, 48
      );
      p.fill(120);
      p.textSize(11);
      var fYear = (manager.state && manager.state.streetContextYear !== 'all')
        ? ('Year ' + manager.state.streetContextYear)
        : 'All years';
      var fSev = (manager.state && manager.state.streetContextSeverity !== 'all')
        ? manager.state.streetContextSeverity
        : 'All severities';
      p.text(
        "Filters: " + fYear + " · " + fSev +
          " — showing " + (agg.matched || 0).toLocaleString() +
          " of " + (agg.total || 0).toLocaleString() +
          " collisions (" + (agg.pctMatched || 0) + "% matched).",
        L.left, 68
      );
      p.pop();

      // Quick takeaways card
      var cardX = L.left;
      var cardY = L.top + 8;
      var cardW = L.w;
      var cardH = 158;
      var ix = cardX + 16;
      var iy = cardY + 12;

      p.push();
      p.noStroke();
      p.fill(255, 255, 255, 190);
      p.rect(cardX, cardY, cardW, cardH, 16);

      p.fill(18);
      p.textAlign(p.LEFT, p.TOP);
      p.textSize(14);
      p.text("Quick takeaways", ix, iy);

      p.fill(60);
      p.textSize(11);
      var line1 = "Collisions matched to street data: " + agg.matched + " of " + agg.total + " (" + agg.pctMatched + "%).";
      var line2 = "Crashes are most concentrated on moderate to higher speed roads, especially around 35–45 mph.";
      var line3 = "Within that range, 45 mph roads have the highest crash rate per segment, standing out as the riskiest.";
      var line4 = "Most crashes are injuries or property damage; serious and fatal crashes are rarer but more common at higher speeds.";
      var line5 = "Very low-speed (0–20 mph) and very high-speed (60 mph) roads see far fewer crashes overall.";

      p.text(line1, ix, iy + 24);
      p.text(line2, ix, iy + 44, cardW - 32, 40);
      p.text(line3, ix, iy + 64, cardW - 32, 40);
      p.text(line4, ix, iy + 92, cardW - 32, 40);
      p.text(line5, ix, iy + 120, cardW - 32, 40);
      p.pop();

      // Bar chart
      var chartTop = cardY + cardH + 16;
      var chartH = L.h - (chartTop - L.top) - 12;
      var pad = 22;
      var x0 = L.left + pad;
      var y0 = chartTop + pad;
      var cw = L.w - pad * 2;
      var ch = chartH - pad * 2;
      var axisW = 44;
      var barAreaX = x0 + axisW;
      var barW = cw - axisW - 20;

      p.push();
      p.noStroke();
      p.fill(235);
      p.rect(L.left, chartTop, L.w, chartH, 16);
      p.pop();

      p.push();
      p.fill(18);
      p.textAlign(p.LEFT, p.TOP);
      p.textSize(14);
      p.text("Crashes by speed limit (mph)", x0, chartTop + 10);
      p.pop();

      var colPDO = [214, 214, 214, 255];
      var colInj = [160, 215, 255, 240];
      var colSer = [0, 140, 255, 240];
      var colFat = [255, 90, 90, 245];
      var bucketOrder = ['PDO', 'Injury', 'Serious', 'Fatal'];

      function fillBucket(b) {
        if (b === 'PDO') p.fill(colPDO[0], colPDO[1], colPDO[2], colPDO[3]);
        if (b === 'Injury') p.fill(colInj[0], colInj[1], colInj[2], colInj[3]);
        if (b === 'Serious') p.fill(colSer[0], colSer[1], colSer[2], colSer[3]);
        if (b === 'Fatal') p.fill(colFat[0], colFat[1], colFat[2], colFat[3]);
      }

      // Layout that adapts to container height so nothing clips
      var legendY = chartTop + chartH - pad - 46;
      var startY = y0 + 26;
      var rowCount = Math.max(1, agg.items.length);
      var availRowsH = Math.max(120, (legendY - 14) - startY);
      var rowHeight = Math.floor(availRowsH / rowCount);
      rowHeight = clamp(rowHeight, 26, 38);
      var barHeight = Math.min(24, rowHeight - 12);
      var maxRate = Math.max(0.01, agg.maxRatePer100);
      var hitboxes = [];

      for (var i = 0; i < agg.items.length; i++) {
        var it = agg.items[i];
        var y = startY + i * rowHeight;
        var totalBarW = (it.ratePer100 / maxRate) * barW;
        var rowSevere = (it.Serious || 0) + (it.Fatal || 0);

        p.push();
        p.fill(18);
        p.textAlign(p.LEFT, p.CENTER);
        p.textSize(12);
        p.text(it.speed + " mph", x0, y + barHeight / 2);
        p.pop();

        p.push();
        p.noStroke();
        p.fill(245);
        p.rect(barAreaX, y, barW, barHeight, 999);
        p.pop();

        var curX = barAreaX;
        for (var bi = 0; bi < bucketOrder.length; bi++) {
          var b = bucketOrder[bi];
          var cnt = it[b] || 0;
          if (!cnt || !it.total) continue;
          var segW = (cnt / it.total) * totalBarW;
          if (segW < 1) continue;
          p.push();
          p.noStroke();
          fillBucket(b);
          p.rect(curX, y, segW, barHeight, 2);
          p.pop();
          hitboxes.push({
            x: curX, y: y, w: segW, h: barHeight,
            speed: it.speed, bucket: b, count: cnt, total: it.total,
            severe: rowSevere, ratePer100: it.ratePer100, segmentCount: it.segmentCount
          });
          curX += segW;
        }

        p.push();
        p.fill(70);
        p.textAlign(p.RIGHT, p.CENTER);
        p.textSize(11);
        p.text(it.ratePer100.toFixed(1), barAreaX + barW + 8, y + barHeight / 2);
        p.pop();
      }

      function findHover(mx, my) {
        for (var i = 0; i < hitboxes.length; i++) {
          var hb = hitboxes[i];
          if (mx >= hb.x && mx <= hb.x + hb.w && my >= hb.y && my <= hb.y + hb.h) return hb;
        }
        return null;
      }
      var hover = findHover(p.mouseX, p.mouseY);
      var justPressed = p.mouseIsPressed && !manager._prevMousePressedStreetContext;
      if (justPressed) {
        if (manager._streetContextPinned) manager._streetContextPinned = null;
        else if (hover) manager._streetContextPinned = hover;
      }
      manager._prevMousePressedStreetContext = p.mouseIsPressed;
      var active = manager._streetContextPinned || hover;

      if (active) {
        p.push();
        p.noFill();
        p.stroke(18, 18, 18, 190);
        p.strokeWeight(2);
        p.rect(active.x, active.y, active.w, active.h, 6);
        p.pop();

        var tipW = 320;
        var tipH = 140;
        var ax = manager._streetContextPinned ? (active.x + active.w / 2) : p.mouseX;
        var ay = manager._streetContextPinned ? (active.y + active.h / 2) : p.mouseY;
        var tipX = clamp(ax + 16, L.left + 16, L.left + L.w - tipW - 16);
        var tipY = clamp(ay - tipH - 16, L.top + 16, L.top + L.h - tipH - 16);

        p.push();
        p.noStroke();
        p.fill(0, 0, 0, 12);
        p.rect(tipX + 3, tipY + 4, tipW, tipH, 14);
        p.pop();
        p.push();
        p.noStroke();
        p.fill(220, 222, 228, 238);
        p.rect(tipX, tipY, tipW, tipH, 14);

        var segPct = pct(active.count, active.total);
        var severePct = pct(active.severe, active.total);

        p.fill(18);
        p.textAlign(p.LEFT, p.TOP);
        p.textSize(13);
        p.text((manager._streetContextPinned ? "Pinned" : "Hover") + " — " + active.speed + " mph", tipX + 14, tipY + 12);
        p.fill(60);
        p.textSize(12);
        p.text("Segment: " + active.bucket, tipX + 14, tipY + 36);
        p.text("Count: " + active.count + " (" + segPct + " of this speed)", tipX + 14, tipY + 56);
        p.text("Serious+Fatal (this speed): " + severePct, tipX + 14, tipY + 76);
        p.text("Rate: " + active.ratePer100.toFixed(1) + " crashes per 100 segments", tipX + 14, tipY + 98);
        p.fill(90);
        p.textSize(11);
        p.text("Click to pin/unpin.", tipX + 14, tipY + 120);
        p.pop();
      }

      // Severity legend at bottom (kept inside the gray box)
      var lx = x0;
      var pills = [{ k: 'PDO', c: colPDO }, { k: 'Injury', c: colInj }, { k: 'Serious', c: colSer }, { k: 'Fatal', c: colFat }];
      p.push();
      p.textAlign(p.LEFT, p.CENTER);
      p.textSize(11);
      for (var pi = 0; pi < pills.length; pi++) {
        var pill = pills[pi];
        p.noStroke();
        p.fill(255, 255, 255, 210);
        p.rect(lx, legendY, 72, 20, 999);
        p.fill(pill.c[0], pill.c[1], pill.c[2], pill.c[3]);
        p.rect(lx + 8, legendY + 5, 8, 8, 2);
        p.fill(60);
        p.text(pill.k, lx + 22, legendY + 10);
        lx += 80;
      }
      p.pop();

      p.push();
      p.noStroke();
      p.fill(70);
      p.textAlign(p.LEFT, p.CENTER);
      p.textSize(11);
      p.text("Crashes per 100 segments", x0, legendY + 28);
      p.pop();
    }
  };
})();
