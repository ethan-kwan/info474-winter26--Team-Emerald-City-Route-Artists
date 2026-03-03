// viz_hotspots.js
// Stop 1: Smooth heatmap using x/y (looks more like a real map heat layer)
// Tooltip is detailed: top street/block, crash types, severity, injuries, flags, time bucket.
// Filters: year + severity + mode + time (wired via manager.state)
//
// NOTE: True basemap roads like Image 2 needs street geometry or map tiles.
// Here we approximate "street context" via LOCATION + top streets in tooltip.

(function () {
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  // Space-saving topK (Misra–Gries style) for “heavy hitters”
  function topKUpdate(list, key, K) {
    if (!key) return;
    K = K || 5;

    for (var i = 0; i < list.length; i++) {
      if (list[i].key === key) { list[i].count += 1; return; }
    }

    if (list.length < K) {
      list.push({ key: key, count: 1 });
      return;
    }

    // decrement all
    for (var j = list.length - 1; j >= 0; j--) {
      list[j].count -= 1;
      if (list[j].count <= 0) list.splice(j, 1);
    }
  }

  function topKSorted(list) {
    var copy = (list || []).slice();
    copy.sort(function (a, b) { return b.count - a.count; });
    return copy;
  }

  function parsePrimaryStreet(location) {
    location = (location || '').trim();
    if (!location) return '';

    // "AURORA AVE N BETWEEN PROSPECT ST AND HIGHLAND DR"
    var betweenIdx = location.indexOf(' BETWEEN ');
    if (betweenIdx >= 0) return location.slice(0, betweenIdx).trim();

    // intersection-like (common variants)
    var andIdx = location.indexOf(' AND ');
    if (andIdx >= 0) return location.slice(0, andIdx).trim();

    var ampIdx = location.indexOf(' & ');
    if (ampIdx >= 0) return location.slice(0, ampIdx).trim();

    // fallback: first chunk
    return location.split('  ')[0].trim();
  }

  function parseCrossStreets(location) {
    location = (location || '').trim();
    if (!location) return '';

    var betweenIdx = location.indexOf(' BETWEEN ');
    if (betweenIdx >= 0) return location.slice(betweenIdx + ' BETWEEN '.length).trim();

    var andIdx = location.indexOf(' AND ');
    if (andIdx >= 0) return location.slice(andIdx + ' AND '.length).trim();

    var ampIdx = location.indexOf(' & ');
    if (ampIdx >= 0) return location.slice(ampIdx + ' & '.length).trim();

    return '';
  }

  function severityMatch(sevText, filter) {
    sevText = (sevText || '').toLowerCase();

    if (filter === 'fatal') return sevText.indexOf('fatal') >= 0;
    if (filter === 'serious') return sevText.indexOf('serious') >= 0;
    if (filter === 'injury') return (sevText.indexOf('injury') >= 0 && sevText.indexOf('serious') < 0);
    if (filter === 'pdo') return (sevText.indexOf('property') >= 0 || sevText.indexOf('damage') >= 0);

    return true;
  }

  function timeMatch(hour, filter) {
    if (filter === 'all') return true;
    if (hour === null || hour === undefined || isNaN(hour)) return false;

    // morning 5–10, midday 11–15, evening 16–20, night 21–4
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

  function formatPct(n, d) {
    if (d <= 0) return "0%";
    return Math.round((n / d) * 100) + "%";
  }

  function makeAggKey(state) {
    return [
      state.filterYear || 'all',
      state.filterSeverity || 'all',
      state.filterMode || 'all',
      state.filterTime || 'all'
    ].join('|');
  }

  window.VizHotspots = {
    _layout: function (p) {
      var pad = 18;
      var topBannerH = 106;
      var left = pad;
      var top = pad + topBannerH;
      var w = p.width - pad * 2;
      var h = p.height - top - pad;
      return { left: left, top: top, w: w, h: h, pad: pad, topBannerH: topBannerH };
    },

    _ensureAgg: function (manager) {
      manager.data.hotspotAggCache = manager.data.hotspotAggCache || {};

      var key = makeAggKey(manager.state);
      if (manager.data.hotspotAggCache[key]) return manager.data.hotspotAggCache[key];

      var all = manager.data.collisionsAll || [];
      var bounds = manager.data.bounds;

      if (!bounds || !all.length) {
        manager.data.hotspotAggCache[key] = { ready: false, error: "No data loaded." };
        return manager.data.hotspotAggCache[key];
      }

      // bin resolution (tuned for “blobby heatmap”)
      var cols = 190;
      var rows = 190;

      var minX = bounds.minX, maxX = bounds.maxX;
      var minY = bounds.minY, maxY = bounds.maxY;

      var dx = (maxX - minX) || 1;
      var dy = (maxY - minY) || 1;

      // cells stored sparsely in a map
      var cellMap = {}; // "ix|iy" -> cell stats
      var maxCount = 1;

      // small sample for “street skeleton” effect
      var samplePts = [];
      var sampleTarget = 2000;
      var seen = 0;

      function getCell(ix, iy) {
        var k = ix + "|" + iy;
        var c = cellMap[k];
        if (!c) {
          c = cellMap[k] = {
            ix: ix, iy: iy,
            count: 0,
            injuries: 0,
            serious: 0,
            fatalities: 0,
            ped: 0,
            bike: 0,
            speeding: 0,
            inattn: 0,
            underinfl: 0,
            maxCrosswalk: 0,
            topStreets: [],
            topTypes: [],
            topSev: [],
            topLoc: [],
            topHour: []
          };
        }
        return c;
      }

      // Apply filters
      var yearFilter = manager.state.filterYear || 'all';
      var sevFilter = manager.state.filterSeverity || 'all';
      var modeFilter = manager.state.filterMode || 'all';
      var timeFilter = manager.state.filterTime || 'all';

      var totalFiltered = 0;

      for (var i = 0; i < all.length; i++) {
        var d = all[i];

        if (yearFilter !== 'all') {
          if (String(d.year) !== String(yearFilter)) continue;
        }

        if (!severityMatch(d.severity, sevFilter)) continue;
        if (!modeMatch(d, modeFilter)) continue;
        if (!timeMatch(d.hour, timeFilter)) continue;

        totalFiltered += 1;

        // normalized in [0..1]
        var nx = (d.x - minX) / dx;
        var ny = (d.y - minY) / dy;

        // clamp in case of edge weirdness
        nx = clamp(nx, 0, 0.999999);
        ny = clamp(ny, 0, 0.999999);

        var ix = Math.floor(nx * cols);
        var iy = Math.floor(ny * rows);

        var cell = getCell(ix, iy);
        cell.count += 1;

        cell.injuries += (d.injuries || 0);
        cell.serious += (d.serious || 0);
        cell.fatalities += (d.fatalities || 0);

        if (d.isPed) cell.ped += 1;
        if (d.isBike) cell.bike += 1;

        if (d.speeding) cell.speeding += 1;
        if (d.inattn) cell.inattn += 1;
        if (d.underinfl) cell.underinfl += 1;

        if ((d.crosswalk_count || 0) > cell.maxCrosswalk) cell.maxCrosswalk = d.crosswalk_count || 0;

        // heavy hitters
        topKUpdate(cell.topStreets, parsePrimaryStreet(d.location), 5);
        topKUpdate(cell.topTypes, d.collisionType, 5);
        topKUpdate(cell.topSev, d.severity, 4);
        topKUpdate(cell.topLoc, d.location, 3);
        topKUpdate(cell.topHour, (d.hour !== null && d.hour !== undefined) ? String(d.hour) : '', 4);

        if (cell.count > maxCount) maxCount = cell.count;

        // sample points for context (reservoir-ish)
        seen += 1;
        if (samplePts.length < sampleTarget) {
          samplePts.push({ x: d.x, y: d.y });
        } else {
          // occasionally replace
          var r = Math.floor(Math.random() * seen);
          if (r < sampleTarget) samplePts[r] = { x: d.x, y: d.y };
        }
      }

      // flatten cells to array + counts list for percentiles
      var cells = [];
      var counts = [];

      Object.keys(cellMap).forEach(function (k) {
        var c = cellMap[k];
        cells.push(c);
        counts.push(c.count);
      });

      counts.sort(function (a, b) { return a - b; });

      var agg = {
        ready: true,
        cols: cols,
        rows: rows,
        minX: minX, maxX: maxX,
        minY: minY, maxY: maxY,
        dx: dx, dy: dy,
        maxCount: Math.max(1, maxCount),
        cells: cells,
        countsSorted: counts,
        samplePts: samplePts,
        totalFiltered: totalFiltered
      };

      manager.data.hotspotAggCache[key] = agg;
      return agg;
    },

    _percentileLabel: function (countsSorted, count) {
      if (!countsSorted || !countsSorted.length) return "";
      var n = countsSorted.length;

      // find rightmost <= count
      var idx = 0;
      for (var i = 0; i < n; i++) {
        if (countsSorted[i] <= count) idx = i;
        else break;
      }

      var pct = (idx / Math.max(1, n - 1)) * 100;

      if (pct >= 99) return "Top 1% hotspot";
      if (pct >= 95) return "Top 5% hotspot";
      if (pct >= 90) return "Top 10% hotspot";
      if (pct >= 75) return "Top 25% cell";
      return "Lower-density area";
    },

    _screenFromXY: function (agg, layout, x, y) {
      var nx = (x - agg.minX) / agg.dx;
      var ny = (y - agg.minY) / agg.dy;
      nx = clamp(nx, 0, 1);
      ny = clamp(ny, 0, 1);

      // invert Y so “north-ish” is up
      var sx = layout.left + nx * layout.w;
      var sy = layout.top + (1 - ny) * layout.h;

      return { x: sx, y: sy };
    },

    _screenFromCellCenter: function (agg, layout, ix, iy) {
      var cx = (ix + 0.5) / agg.cols;
      var cy = (iy + 0.5) / agg.rows;

      var sx = layout.left + cx * layout.w;
      var sy = layout.top + (1 - cy) * layout.h; // invert

      return { x: sx, y: sy };
    },

    _hoverCell: function (p, agg, layout) {
      var mx = p.mouseX;
      var my = p.mouseY;

      if (mx < layout.left || mx > layout.left + layout.w) return null;
      if (my < layout.top || my > layout.top + layout.h) return null;

      // convert mouse -> normalized
      var nx = (mx - layout.left) / layout.w;
      var nyInv = (my - layout.top) / layout.h;

      nx = clamp(nx, 0, 0.999999);
      nyInv = clamp(nyInv, 0, 0.999999);

      var ix = Math.floor(nx * agg.cols);
      var iy = Math.floor((1 - nyInv) * agg.rows); // invert back

      // find cell in sparse array (small map for quick lookup)
      // build once per draw (cheap)
      var k = ix + "|" + iy;
      return agg._cellLookup && agg._cellLookup[k] ? agg._cellLookup[k] : null;
    },

    draw: function (p, manager) {
      p.background(248, 249, 252);

      var layout = this._layout(p);

      // Header strip
      p.push();
      p.noStroke();
      p.fill(255);
      p.rect(0, 0, p.width, layout.topBannerH + 18);
      p.pop();

      // If load error
      if (manager.data && manager.data.loadError) {
        p.push();
        p.fill(30);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(14);
        p.text(
          "Couldn't load the CSV.\n\n" +
          manager.data.loadError +
          "\n\nFix: run with Live Server or `python3 -m http.server`.",
          p.width / 2, p.height / 2
        );
        p.pop();
        return;
      }

      var agg = this._ensureAgg(manager);
      if (!agg || !agg.ready) {
        p.push();
        p.fill(80);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(16);
        p.text("Loading heatmap…", p.width / 2, p.height / 2);
        p.pop();
        return;
      }

      // build lookup for hover (fast)
      if (!agg._cellLookup) {
        var lookup = {};
        for (var i = 0; i < agg.cells.length; i++) {
          var c = agg.cells[i];
          lookup[c.ix + "|" + c.iy] = c;
        }
        agg._cellLookup = lookup;
      }

      // Title + filter summary
      var yText = 18;

      p.push();
      p.fill(18);
      p.textAlign(p.LEFT, p.TOP);
      p.textSize(18);
      p.text("Stop 1 — Crash density (with street context)", layout.left, yText);

      p.fill(90);
      p.textSize(12);

      var filtersLine =
        "Filters: " +
        (manager.state.filterYear === 'all' ? "All years" : ("Year " + manager.state.filterYear)) + " · " +
        (manager.state.filterSeverity === 'all' ? "All severities" : manager.state.filterSeverity) + " · " +
        (manager.state.filterMode === 'all' ? "All modes" : manager.state.filterMode) + " · " +
        (manager.state.filterTime === 'all' ? "All day" : manager.state.filterTime) +
        "  —  showing " + agg.totalFiltered + " crashes";
      p.text(filtersLine, layout.left, yText + 26);

      p.fill(90);
      p.text("Hover a hotspot for a detailed summary. Click to pin/unpin.", layout.left, yText + 46);
      p.pop();

      // Background panel (map-like)
      p.push();
      p.noStroke();
      p.fill(230);
      p.rect(layout.left, layout.top, layout.w, layout.h, 14);
      p.pop();

      // “Street skeleton” context from sampled points (subtle)
      p.push();
      p.stroke(255, 255, 255, 80);
      p.strokeWeight(1);

      for (var sp = 0; sp < agg.samplePts.length; sp++) {
        var pt = agg.samplePts[sp];
        var sxy = this._screenFromXY(agg, layout, pt.x, pt.y);
        p.point(sxy.x, sxy.y);
      }
      p.pop();

      // Heat layer: draw “blobby” circles (two-pass: halo + core)
      var maxCount = Math.max(1, agg.maxCount);

      var cellW = layout.w / agg.cols;
      var cellH = layout.h / agg.rows;
      var baseR = Math.max(cellW, cellH);

      p.push();
      p.noStroke();

      for (var ci = 0; ci < agg.cells.length; ci++) {
        var c = agg.cells[ci];
        var count = c.count;

        // log scale for contrast
        var t = Math.log(1 + count) / Math.log(1 + maxCount);
        t = clamp(t, 0, 1);

        var center = this._screenFromCellCenter(agg, layout, c.ix, c.iy);

        // halo
        var a1 = 10 + Math.floor(70 * t);
        p.fill(0, 140, 255, a1);
        p.ellipse(center.x, center.y, baseR * 3.8, baseR * 3.8);

        // core
        var a2 = 28 + Math.floor(170 * t);
        p.fill(0, 90, 200, a2);
        p.ellipse(center.x, center.y, baseR * 1.6, baseR * 1.6);
      }
      p.pop();

      // Legend
      p.push();
      var legX = layout.left;
      var legY = layout.top - 24;
      var legW = Math.min(260, layout.w * 0.34);
      var legH = 10;

      for (var px = 0; px < legW; px++) {
        var tt = px / Math.max(1, legW - 1);
        // blend alpha across
        var alpha = 30 + Math.floor(180 * tt);
        p.stroke(0, 90, 200, alpha);
        p.line(legX + px, legY, legX + px, legY + legH);
      }

      p.noStroke();
      p.fill(90);
      p.textSize(11);
      p.textAlign(p.LEFT, p.BOTTOM);
      p.text("Low", legX, legY - 2);
      p.textAlign(p.RIGHT, p.BOTTOM);
      p.text("High", legX + legW, legY - 2);
      p.pop();

      // pin reset (from filter changes)
      if (manager._pinResetSeen !== manager.state.pinResetToken) {
        manager._pinResetSeen = manager.state.pinResetToken;
        manager._pinnedCellKey = null;
      }

      // Determine hover
      var hoverCell = this._hoverCell(p, agg, layout);

      // Click-to-pin (edge-detected)
      var justPressed = p.mouseIsPressed && !manager._prevMousePressed;
      if (justPressed) {
        if (manager._pinnedCellKey) {
          manager._pinnedCellKey = null;
        } else if (hoverCell) {
          manager._pinnedCellKey = hoverCell.ix + "|" + hoverCell.iy;
        }
      }
      manager._prevMousePressed = p.mouseIsPressed;

      var active = null;
      if (manager._pinnedCellKey && agg._cellLookup[manager._pinnedCellKey]) {
        active = agg._cellLookup[manager._pinnedCellKey];
      } else {
        active = hoverCell;
      }

      if (!active) return;

      // Highlight active cell center marker
      var cen = this._screenFromCellCenter(agg, layout, active.ix, active.iy);
      p.push();
      p.noFill();
      p.stroke(0, 90, 200, 220);
      p.strokeWeight(3);
      p.ellipse(cen.x, cen.y, baseR * 2.2, baseR * 2.2);
      p.pop();

      // Tooltip (DETAILED)
      var pinned = !!manager._pinnedCellKey;

      var tipW = 380;
      var tipH = 220;

      var anchorX = pinned ? cen.x : p.mouseX;
      var anchorY = pinned ? cen.y : p.mouseY;

      var tipX = clamp(anchorX + 16, 16, p.width - tipW - 16);
      var tipY = clamp(anchorY - tipH - 16, layout.topBannerH + 18, p.height - tipH - 16);

      // Shadow
      p.push();
      p.noStroke();
      p.fill(0, 0, 0, 18);
      p.rect(tipX + 3, tipY + 4, tipW, tipH, 14);
      p.pop();

      // Box
      p.push();
      p.noStroke();
      p.fill(255);
      p.rect(tipX, tipY, tipW, tipH, 14);
      p.pop();

      // Extract top items
      var streets = topKSorted(active.topStreets);
      var types = topKSorted(active.topTypes);
      var sevs = topKSorted(active.topSev);
      var locs = topKSorted(active.topLoc);
      var hours = topKSorted(active.topHour);

      var topStreet = streets.length ? streets[0].key : "";
      var topLoc = locs.length ? locs[0].key : "";

      var cross = parseCrossStreets(topLoc);

      // Percentile label
      var pctLabel = this._percentileLabel(agg.countsSorted, active.count);

      // Draw tooltip text
      p.push();
      p.fill(18);
      p.textAlign(p.LEFT, p.TOP);

      // Title row
      p.textSize(13);
      var title = pinned ? "Hotspot summary (pinned)" : "Hotspot summary";
      p.text(title, tipX + 14, tipY + 12);

      p.fill(90);
      p.textSize(11);
      p.text(pctLabel, tipX + 14, tipY + 32);

      // Street context
      p.fill(18);
      p.textSize(12);
      if (topStreet) {
        p.text("Primary street: " + topStreet, tipX + 14, tipY + 54);
      } else {
        p.text("Primary street: (unknown)", tipX + 14, tipY + 54);
      }

      p.fill(60);
      p.textSize(11);
      if (topLoc) {
        p.text("Example block: " + topLoc, tipX + 14, tipY + 72);
      }

      if (cross) {
        p.text("Cross streets: " + cross, tipX + 14, tipY + 88);
      }

      // Key metrics
      p.fill(18);
      p.textSize(12);
      p.text("Crashes: " + active.count, tipX + 14, tipY + 110);

      p.fill(60);
      p.textSize(11);
      p.text(
        "Injuries: " + active.injuries +
        "   Serious: " + active.serious +
        "   Fatal: " + active.fatalities,
        tipX + 14, tipY + 126
      );

      // Mode share
      p.text(
        "Ped-involved: " + active.ped + " (" + formatPct(active.ped, active.count) + ")" +
        "   Bike-involved: " + active.bike + " (" + formatPct(active.bike, active.count) + ")",
        tipX + 14, tipY + 142
      );

      // Risk flags
      p.text(
        "Flags: Speeding " + formatPct(active.speeding, active.count) +
        " · Inattention " + formatPct(active.inattn, active.count) +
        " · Under influence " + formatPct(active.underinfl, active.count),
        tipX + 14, tipY + 158
      );

      // Crosswalk context
      p.text("Crosswalks in cell (max): " + active.maxCrosswalk, tipX + 14, tipY + 174);

      // Top crash type + severity + hour
      var typeLine = types.length ? (types[0].key || "(unknown)") : "(unknown)";
      var sevLine = sevs.length ? (sevs[0].key || "(unknown)") : "(unknown)";
      var hourLine = hours.length ? (hours[0].key + ":00") : "(unknown)";

      p.text("Most common type: " + typeLine, tipX + 14, tipY + 190);
      p.text("Most common severity: " + sevLine + "   ·   Common hour: " + hourLine, tipX + 14, tipY + 206);

      p.pop();
    }
  };
})();