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

  function severityMatch(sevText, filter) {
    sevText = (sevText || '').toLowerCase();
    if (filter === 'fatal') return sevText.indexOf('fatal') >= 0;
    if (filter === 'serious') return sevText.indexOf('serious') >= 0;
    if (filter === 'injury') return (sevText.indexOf('injury') >= 0 && sevText.indexOf('serious') < 0);
    if (filter === 'pdo') return (sevText.indexOf('property') >= 0 || sevText.indexOf('damage') >= 0);
    return true;
  }

  function modeMatch(d, filter) {
    if (filter === 'all') return true;
    if (filter === 'ped') return !!d.isPed;
    if (filter === 'bike') return !!d.isBike;
    return true;
  }

  function formatPct(n, d) {
    if (!d) return "0%";
    return Math.round((n / d) * 100) + "%";
  }

  function parsePrimaryStreet(location) {
    location = (location || '').trim();
    if (!location) return '';
    var betweenIdx = location.indexOf(' BETWEEN ');
    if (betweenIdx >= 0) return location.slice(0, betweenIdx).trim();
    var andIdx = location.indexOf(' AND ');
    if (andIdx >= 0) return location.slice(0, andIdx).trim();
    var ampIdx = location.indexOf(' & ');
    if (ampIdx >= 0) return location.slice(0, ampIdx).trim();
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

  function makeAggKey(state) {
    return [
      state.filterYear || 'all',
      state.filterSeverity || 'all',
      state.filterMode || 'all',
      state.filterTime || 'all'
    ].join('|');
  }

  function mapInc(map, key) {
    if (!key) return;
    map[key] = (map[key] || 0) + 1;
  }

  function topN(map, n) {
    var arr = [];
    Object.keys(map || {}).forEach(function (k) {
      arr.push({ key: k, count: map[k] });
    });
    arr.sort(function (a, b) { return b.count - a.count; });
    return arr.slice(0, n || 5);
  }

  function shorten(s, maxLen) {
    s = (s || '').trim();
    maxLen = maxLen || 22;
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen - 1) + "…";
  }

  function topKUpdate(list, key, K) {
    if (!key) return;
    K = K || 5;

    for (var i = 0; i < list.length; i++) {
      if (list[i].key === key) {
        list[i].count += 1;
        return;
      }
    }

    if (list.length < K) {
      list.push({ key: key, count: 1 });
      return;
    }

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

  function clampPan(view, map) {
    var minTx = map.w - map.w * view.scale;
    var minTy = map.h - map.h * view.scale;
    view.tx = clamp(view.tx, minTx, 0);
    view.ty = clamp(view.ty, minTy, 0);
  }

  window.VizHotspots = {
    _layout: function (p) {
      var pad = 14;
      var topBannerH = 84;

      var left = pad;
      var top = pad + topBannerH;
      var w = p.width - pad * 2;
      var h = p.height - top - pad;

      var sidebarW = (w >= 1100) ? 300 : 0;
      var gap = (sidebarW > 0) ? 12 : 0;
      var mapW = w - sidebarW - gap;

      var map = { left: left, top: top, w: mapW, h: h };
      var side = (sidebarW > 0) ? { left: left + mapW + gap, top: top, w: sidebarW, h: h } : null;

      return { pad: pad, topBannerH: topBannerH, map: map, side: side, left: left };
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

      var cols = 190;
      var rows = 190;

      var minX = bounds.minX, maxX = bounds.maxX;
      var minY = bounds.minY, maxY = bounds.maxY;

      var dx = (maxX - minX) || 1;
      var dy = (maxY - minY) || 1;

      var cellMap = {};
      var maxCount = 1;

      var summary = {
        total: 0,
        injuries: 0,
        serious: 0,
        fatal: 0,
        ped: 0,
        bike: 0,
        speeding: 0,
        inattn: 0,
        underinfl: 0,
        streets: {},
        types: {}
      };

      var samplePts = [];
      var sampleTarget = 2200;
      var seen = 0;

      function getCell(ix, iy) {
        var k = ix + "|" + iy;
        var c = cellMap[k];
        if (!c) {
          c = cellMap[k] = {
            ix: ix,
            iy: iy,
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

      var yearFilter = manager.state.filterYear || 'all';
      var sevFilter = manager.state.filterSeverity || 'all';
      var modeFilter = manager.state.filterMode || 'all';
      var timeFilter = manager.state.filterTime || 'all';

      for (var i = 0; i < all.length; i++) {
        var d = all[i];

        if (yearFilter !== 'all') {
          if (String(d.year) !== String(yearFilter)) continue;
        }
        if (!severityMatch(d.severity, sevFilter)) continue;
        if (!modeMatch(d, modeFilter)) continue;
        if (!timeMatch(d.hour, timeFilter)) continue;

        summary.total += 1;
        summary.injuries += (d.injuries || 0);
        summary.serious += (d.serious || 0);
        summary.fatal += (d.fatalities || 0);

        if (d.isPed) summary.ped += 1;
        if (d.isBike) summary.bike += 1;
        if (d.speeding) summary.speeding += 1;
        if (d.inattn) summary.inattn += 1;
        if (d.underinfl) summary.underinfl += 1;

        var street = parsePrimaryStreet(d.location);
        mapInc(summary.streets, street || "(Unknown street)");
        mapInc(summary.types, d.collisionType || "(Unknown type)");

        var nx = (d.x - minX) / dx;
        var ny = (d.y - minY) / dy;
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

        if ((d.crosswalk_count || 0) > cell.maxCrosswalk) {
          cell.maxCrosswalk = d.crosswalk_count || 0;
        }

        topKUpdate(cell.topStreets, street, 5);
        topKUpdate(cell.topTypes, d.collisionType, 5);
        topKUpdate(cell.topSev, d.severity, 4);
        topKUpdate(cell.topLoc, d.location, 3);
        topKUpdate(cell.topHour, (d.hour !== null && d.hour !== undefined) ? String(d.hour) : '', 4);

        if (cell.count > maxCount) maxCount = cell.count;

        seen += 1;
        if (samplePts.length < sampleTarget) {
          samplePts.push({ x: d.x, y: d.y });
        } else {
          var r = Math.floor(Math.random() * seen);
          if (r < sampleTarget) samplePts[r] = { x: d.x, y: d.y };
        }
      }

      var cells = [];
      var counts = [];
      var lookup = {};

      Object.keys(cellMap).forEach(function (k) {
        var c = cellMap[k];
        cells.push(c);
        counts.push(c.count);
        lookup[c.ix + "|" + c.iy] = c;
      });

      counts.sort(function (a, b) { return a - b; });

      var severe = summary.serious + summary.fatal;
      summary.severe = severe;
      summary.severePct = summary.total ? Math.round((severe / summary.total) * 100) : 0;
      summary.topStreets = topN(summary.streets, 5);
      summary.topTypes = topN(summary.types, 1);

      var agg = {
        ready: true,
        cols: cols,
        rows: rows,
        minX: minX,
        maxX: maxX,
        minY: minY,
        maxY: maxY,
        dx: dx,
        dy: dy,
        maxCount: Math.max(1, maxCount),
        cells: cells,
        countsSorted: counts,
        samplePts: samplePts,
        _cellLookup: lookup,
        summary: summary
      };

      manager.data.hotspotAggCache[key] = agg;
      return agg;
    },

    _yearSeries: function (manager) {
      manager.data.hotspotYearSeriesCache = manager.data.hotspotYearSeriesCache || {};

      var key = [
        manager.state.filterSeverity || 'all',
        manager.state.filterMode || 'all',
        manager.state.filterTime || 'all'
      ].join('|');

      if (manager.data.hotspotYearSeriesCache[key]) {
        return manager.data.hotspotYearSeriesCache[key];
      }

      var all = manager.data.collisionsAll || [];
      var sevFilter = manager.state.filterSeverity || 'all';
      var modeFilter = manager.state.filterMode || 'all';
      var timeFilter = manager.state.filterTime || 'all';

      var years = [2022, 2023, 2024, 2025, 2026];
      var counts = {
        2022: 0,
        2023: 0,
        2024: 0,
        2025: 0,
        2026: 0
      };

      for (var i = 0; i < all.length; i++) {
        var d = all[i];
        var y = Number(d.year);

        if (years.indexOf(y) < 0) continue;
        if (!severityMatch(d.severity, sevFilter)) continue;
        if (!modeMatch(d, modeFilter)) continue;
        if (!timeMatch(d.hour, timeFilter)) continue;

        counts[y] += 1;
      }

      var maxVal = 1;
      var series = [];

      for (var j = 0; j < years.length; j++) {
        var yr = years[j];
        var val = counts[yr] || 0;
        if (val > maxVal) maxVal = val;

        series.push({
          year: yr,
          value: val
        });
      }

      var out = {
        years: years,
        series: series,
        maxVal: maxVal
      };

      manager.data.hotspotYearSeriesCache[key] = out;
      return out;
    },

    _percentileLabel: function (countsSorted, count) {
      if (!countsSorted || !countsSorted.length) return "";
      var n = countsSorted.length;
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

    _cellCenterBase: function (agg, map, ix, iy) {
      var cx = (ix + 0.5) / agg.cols;
      var cy = (iy + 0.5) / agg.rows;

      var baseX = cx * map.w;
      var baseY = (1 - cy) * map.h;

      return { x: baseX, y: baseY };
    },

    _mouseToBase: function (p, manager, map) {
      var view = manager._hotspotView || { scale: 1, tx: 0, ty: 0 };
      var bx = (p.mouseX - (map.left + view.tx)) / view.scale;
      var by = (p.mouseY - (map.top + view.ty)) / view.scale;
      return { x: bx, y: by };
    },

    _hoverCell: function (p, manager, agg, map) {
      var b = this._mouseToBase(p, manager, map);
      if (b.x < 0 || b.x > map.w) return null;
      if (b.y < 0 || b.y > map.h) return null;

      var nx = b.x / map.w;
      var nyInv = b.y / map.h;
      nx = clamp(nx, 0, 0.999999);
      nyInv = clamp(nyInv, 0, 0.999999);

      var ix = Math.floor(nx * agg.cols);
      var iy = Math.floor((1 - nyInv) * agg.rows);

      var k = ix + "|" + iy;
      return agg._cellLookup[k] ? agg._cellLookup[k] : null;
    },

    _screenFromBase: function (manager, map, baseX, baseY) {
      var view = manager._hotspotView || { scale: 1, tx: 0, ty: 0 };
      return {
        x: map.left + view.tx + baseX * view.scale,
        y: map.top + view.ty + baseY * view.scale
      };
    },

    _handlePanAndDoubleClick: function (p, manager, map) {
      manager._hotspotView = manager._hotspotView || { scale: 1, tx: 0, ty: 0 };
      var view = manager._hotspotView;

      if (manager._hotspotPrevPressed === undefined) manager._hotspotPrevPressed = false;
      var justPressed = p.mouseIsPressed && !manager._hotspotPrevPressed;
      var justReleased = !p.mouseIsPressed && manager._hotspotPrevPressed;
      manager._hotspotPrevPressed = p.mouseIsPressed;

      if (justPressed) {
        var inside =
          p.mouseX >= map.left && p.mouseX <= map.left + map.w &&
          p.mouseY >= map.top && p.mouseY <= map.top + map.h;

        manager._hotspotDragging = !!inside;
        manager._hotspotLastMouse = { x: p.mouseX, y: p.mouseY };

        var now = Date.now();
        var last = manager._hotspotLastClickTs || 0;
        if ((now - last) < 320 && inside) {
          view.scale = 1;
          view.tx = 0;
          view.ty = 0;
          manager._hotspotDragging = false;
        }
        manager._hotspotLastClickTs = now;
      }

      if (p.mouseIsPressed && manager._hotspotDragging) {
        var prev = manager._hotspotLastMouse || { x: p.mouseX, y: p.mouseY };
        var dx = p.mouseX - prev.x;
        var dy = p.mouseY - prev.y;
        manager._hotspotLastMouse = { x: p.mouseX, y: p.mouseY };

        view.tx += dx;
        view.ty += dy;

        var minTx = map.w - map.w * view.scale;
        var minTy = map.h - map.h * view.scale;
        var slop = 18;
        view.tx = clamp(view.tx, minTx - slop, 0 + slop);
        view.ty = clamp(view.ty, minTy - slop, 0 + slop);
      }

      if (justReleased) {
        manager._hotspotDragging = false;
        clampPan(view, map);
      }
    },

    _applyZoom: function (manager, map, factor) {
      manager._hotspotView = manager._hotspotView || { scale: 1, tx: 0, ty: 0 };
      var view = manager._hotspotView;

      var oldScale = view.scale;
      var newScale = clamp(oldScale * factor, 1.0, 7.0);

      var cx = map.w / 2;
      var cy = map.h / 2;

      var baseX = (cx - view.tx) / oldScale;
      var baseY = (cy - view.ty) / oldScale;

      view.scale = newScale;
      view.tx = cx - baseX * newScale;
      view.ty = cy - baseY * newScale;

      clampPan(view, map);
    },

    draw: function (p, manager) {
      var L = this._layout(p);

      manager._hotspotView = manager._hotspotView || { scale: 1, tx: 0, ty: 0 };
      var view = manager._hotspotView;

      p.background(248, 249, 252);

      p.push();
      p.noStroke();
      p.fill(255);
      p.rect(0, 0, p.width, L.topBannerH + 8);
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

      if (manager._pinResetSeen !== manager.state.pinResetToken) {
        manager._pinResetSeen = manager.state.pinResetToken;
        manager._pinnedCellKey = null;
      }

      p.push();
      p.fill(18);
      p.textAlign(p.LEFT, p.TOP);
      p.textSize(16);
      p.text("Stop 1 — Crash density", L.left, 14);

      p.fill(90);
      p.textSize(11);
      var filtersLine =
        "Filters: " +
        (manager.state.filterYear === 'all' ? "All years" : ("Year " + manager.state.filterYear)) + " · " +
        (manager.state.filterSeverity === 'all' ? "All severities" : manager.state.filterSeverity) + " · " +
        (manager.state.filterMode === 'all' ? "All modes" : manager.state.filterMode) + " · " +
        (manager.state.filterTime === 'all' ? "All day" : manager.state.filterTime) +
        " — showing " + (agg.summary.total || 0) + " crashes";
      p.text(filtersLine, L.left, 34);

      p.text("Drag to pan · Double-click to reset · Zoom with + / −", L.left, 50);
      p.pop();

      p.push();
      p.noStroke();
      p.fill(231);
      p.rect(L.map.left, L.map.top, L.map.w, L.map.h, 14);
      if (L.side) {
        p.fill(240);
        p.rect(L.side.left, L.side.top, L.side.w, L.side.h, 14);
      }
      p.pop();

      this._handlePanAndDoubleClick(p, manager, L.map);

      p.push();
      p.translate(L.map.left + view.tx, L.map.top + view.ty);
      p.scale(view.scale);

      p.push();
      p.stroke(255, 255, 255, 65);
      p.strokeWeight(1);
      for (var sp = 0; sp < agg.samplePts.length; sp++) {
        var pt = agg.samplePts[sp];
        var nx = (pt.x - agg.minX) / agg.dx;
        var ny = (pt.y - agg.minY) / agg.dy;
        nx = clamp(nx, 0, 1);
        ny = clamp(ny, 0, 1);
        var x = nx * L.map.w;
        var y = (1 - ny) * L.map.h;
        p.point(x, y);
      }
      p.pop();

      var maxCount = Math.max(1, agg.maxCount);
      var cellW = L.map.w / agg.cols;
      var cellH = L.map.h / agg.rows;
      var baseR = Math.max(cellW, cellH);

      p.push();
      p.noStroke();
      for (var ci = 0; ci < agg.cells.length; ci++) {
        var c = agg.cells[ci];
        var t = Math.log(1 + c.count) / Math.log(1 + maxCount);
        t = clamp(t, 0, 1);

        var center = this._cellCenterBase(agg, L.map, c.ix, c.iy);

        // 1. Better scaling: a power scale often provides better visual contrast than log
        var tVis = Math.pow(c.count / maxCount, 0.5); 
        tVis = clamp(tVis, 0, 1);

        // 2. Reduce the overlapping radii
        var rOuter = (baseR * 2.0) / view.scale; 
        var rInner = (baseR * 1.0) / view.scale; 

        // 3. Multi-hue color scale (Blue -> Red) for better density reading
        var r = Math.floor(0 + (255 * tVis));
        var g = Math.floor(140 * (1 - tVis) + 50 * tVis);
        var b = Math.floor(255 * (1 - tVis));

        // 4. Sharper alpha drop-off so low-density areas fade into the background
        var aOuter = Math.floor(2 + 150 * tVis); // Lower base opacity
        var aInner = Math.floor(10 + 220 * tVis);

        p.fill(r, g, b, aOuter);
        p.ellipse(center.x, center.y, rOuter, rOuter);

        p.fill(r, g, b, aInner);
        p.ellipse(center.x, center.y, rInner, rInner);
      }
      p.pop();

      p.pop();

      p.push();
      var legX = L.map.left;
      var legY = L.map.top - 20;
      var legW = Math.min(240, L.map.w * 0.4);
      var legH = 9;

      for (var px = 0; px < legW; px++) {
        var tt = px / Math.max(1, legW - 1);
        var alpha = 30 + Math.floor(180 * tt);
        p.stroke(0, 90, 200, alpha);
        p.line(legX + px, legY, legX + px, legY + legH);
      }

      p.noStroke();
      p.fill(90);
      p.textSize(10);
      p.textAlign(p.LEFT, p.BOTTOM);
      p.text("Low", legX, legY - 2);
      p.textAlign(p.RIGHT, p.BOTTOM);
      p.text("High", legX + legW, legY - 2);
      p.pop();

            if (L.side) {
        var s = agg.summary || {};
        var yearSeries = this._yearSeries(manager);

        var cardX = L.side.left + 12;
        var cardY = L.side.top + 12;
        var cardW = L.side.w - 24;
        var cardH = L.side.h - 24;

        var innerPad = 16;
        var contentX = cardX + innerPad;
        var contentW = cardW - innerPad * 2;

        var btnReset = { x: contentX, y: cardY + 10, w: contentW, h: 30 };
        var btnMinus = { x: contentX, y: btnReset.y + btnReset.h + 12, w: (contentW - 8) / 2, h: 30 };
        var btnPlus = { x: btnMinus.x + btnMinus.w + 8, y: btnMinus.y, w: btnMinus.w, h: 30 };

        function inRect(mx, my, r) {
          return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
        }

        var hoverReset = inRect(p.mouseX, p.mouseY, btnReset);
        var hoverMinus = inRect(p.mouseX, p.mouseY, btnMinus);
        var hoverPlus = inRect(p.mouseX, p.mouseY, btnPlus);

        if (manager._qsPrevPressed === undefined) manager._qsPrevPressed = false;
        var justPressed = p.mouseIsPressed && !manager._qsPrevPressed;
        manager._qsPrevPressed = p.mouseIsPressed;

        if (justPressed) {
          if (hoverReset) {
            view.scale = 1;
            view.tx = 0;
            view.ty = 0;
          }
          if (hoverMinus) {
            this._applyZoom(manager, L.map, 1 / 1.25);
          }
          if (hoverPlus) {
            this._applyZoom(manager, L.map, 1.25);
          }
        }

        p.push();
        p.noStroke();
        p.fill(255, 255, 255, 238);
        p.rect(cardX, cardY, cardW, cardH, 14);

        p.fill(hoverReset ? 0 : 18, hoverReset ? 120 : 140, 255, hoverReset ? 230 : 215);
        p.rect(btnReset.x, btnReset.y, btnReset.w, btnReset.h, 11);
        p.fill(255);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(11);
        p.text("Reset view", btnReset.x + btnReset.w / 2, btnReset.y + btnReset.h / 2);

        p.fill(hoverMinus ? 30 : 255, hoverMinus ? 150 : 255, hoverMinus ? 255 : 255, 220);
        p.rect(btnMinus.x, btnMinus.y, btnMinus.w, btnMinus.h, 11);
        p.fill(hoverMinus ? 255 : 18);
        p.textSize(14);
        p.text("−", btnMinus.x + btnMinus.w / 2, btnMinus.y + btnMinus.h / 2);

        p.fill(hoverPlus ? 30 : 255, hoverPlus ? 150 : 255, hoverPlus ? 255 : 255, 220);
        p.rect(btnPlus.x, btnPlus.y, btnPlus.w, btnPlus.h, 11);
        p.fill(hoverPlus ? 255 : 18);
        p.text("+", btnPlus.x + btnPlus.w / 2, btnPlus.y + btnPlus.h / 2);

        p.fill(90);
        p.textSize(10);
        p.textAlign(p.LEFT, p.TOP);
        p.text("Zoom: " + view.scale.toFixed(2) + "×", contentX, btnPlus.y + btnPlus.h + 10);

        var y = btnPlus.y + btnPlus.h + 34;

        p.fill(18);
        p.textSize(13);
        p.text("Quick stats", contentX, y);
        y += 24;

        p.fill(60);
        p.textSize(11);
        p.text("Total crashes: " + (s.total || 0), contentX, y);
        y += 18;
        p.text("Serious + Fatal: " + (s.severe || 0) + " (" + (s.severePct || 0) + "%)", contentX, y);
        y += 28;

        p.fill(18);
        p.textSize(12);
        p.text("Crash trend (2022–2026)", contentX, y - 10);
        y += 12;

        var chart = {
          x: contentX,
          y: y,
          w: contentW,
          h: 112
        };

        p.noFill();
        p.stroke(225);
        p.strokeWeight(1);
        p.rect(chart.x, chart.y, chart.w, chart.h, 10);

        var padL = 34;
        var padR = 10;
        var padT = 12;
        var padB = 24;

        var innerX = chart.x + padL;
        var innerY = chart.y + padT;
        var innerW = chart.w - padL - padR;
        var innerH = chart.h - padT - padB;

        p.stroke(210);
        p.strokeWeight(1);

        for (var g = 0; g < 4; g++) {
          var gy = innerY + (innerH * g / 3);
          p.line(innerX, gy, innerX + innerW, gy);
        }

        p.stroke(160);
        p.line(innerX, innerY + innerH, innerX + innerW, innerY + innerH);

        p.noStroke();
        p.fill(110);
        p.textSize(9);
        p.textAlign(p.RIGHT, p.CENTER);

        for (var gy2 = 0; gy2 < 4; gy2++) {
          var frac = 1 - (gy2 / 3);
          var valLabel = Math.round(yearSeries.maxVal * frac);
          var yLabel = innerY + (innerH * gy2 / 3);
          p.text(String(valLabel), innerX - 6, yLabel);
        }

        var pts = [];
        for (var si = 0; si < yearSeries.series.length; si++) {
          var item = yearSeries.series[si];
          var px2 = innerX + (yearSeries.series.length === 1 ? innerW / 2 : (innerW * si / (yearSeries.series.length - 1)));
          var py2 = innerY + innerH - ((item.value / Math.max(1, yearSeries.maxVal)) * innerH);
          pts.push({ x: px2, y: py2, year: item.year, value: item.value });
        }

        p.noFill();
        p.stroke(0, 90, 200, 220);
        p.strokeWeight(2.5);
        p.beginShape();
        for (var pi = 0; pi < pts.length; pi++) {
          p.vertex(pts[pi].x, pts[pi].y);
        }
        p.endShape();

        p.noStroke();
        p.fill(0, 90, 200, 220);
        for (var pi2 = 0; pi2 < pts.length; pi2++) {
          p.circle(pts[pi2].x, pts[pi2].y, 7);
        }

        p.fill(80);
        p.textSize(9);
        p.textAlign(p.CENTER, p.TOP);
        for (var xi = 0; xi < pts.length; xi++) {
          p.text(String(pts[xi].year), pts[xi].x, innerY + innerH + 6);
        }

        p.textSize(9);
        p.textAlign(p.CENTER, p.BOTTOM);
        for (var vi = 0; vi < pts.length; vi++) {
          p.text(String(pts[vi].value), pts[vi].x, pts[vi].y - 6);
        }

        y = chart.y + chart.h + 34;

        p.fill(18);
        p.textSize(12);
        p.text("Top streets", contentX + 20, y);
        y += 20;

        p.fill(60);
        p.textSize(11);
        p.textAlign(p.LEFT, p.TOP);

        var topStreets = s.topStreets || [];
        for (var i2 = 0; i2 < Math.min(5, topStreets.length); i2++) {
          var it = topStreets[i2];
          p.text((i2 + 1) + ". " + shorten(it.key, 18) + " (" + it.count + ")", contentX, y);
          y += 15;
        }

        y += 10;
        p.fill(90);
        p.textSize(10);
        p.text(
          "Note: 2026 may look lower if the dataset only includes part of the year.",
          contentX,
          y,
          contentW,
          40
        );

        p.pop();
      }

      var hoverCell = this._hoverCell(p, manager, agg, L.map);

      if (manager._prevMousePressedHotspot === undefined) manager._prevMousePressedHotspot = false;
      var justPressed2 = p.mouseIsPressed && !manager._prevMousePressedHotspot;
      manager._prevMousePressedHotspot = p.mouseIsPressed;

      var clickInsideMap =
        p.mouseX >= L.map.left && p.mouseX <= L.map.left + L.map.w &&
        p.mouseY >= L.map.top && p.mouseY <= L.map.top + L.map.h;

      if (justPressed2 && clickInsideMap) {
        if (manager._pinnedCellKey) manager._pinnedCellKey = null;
        else if (hoverCell) manager._pinnedCellKey = hoverCell.ix + "|" + hoverCell.iy;
      }

      var active = null;
      if (manager._pinnedCellKey && agg._cellLookup[manager._pinnedCellKey]) {
        active = agg._cellLookup[manager._pinnedCellKey];
      } else {
        active = hoverCell;
      }

      if (!active) return;

      var centerBase = this._cellCenterBase(agg, L.map, active.ix, active.iy);
      var centerScreen = this._screenFromBase(manager, L.map, centerBase.x, centerBase.y);

      p.push();
      p.noFill();
      p.stroke(0, 90, 200, 220);
      p.strokeWeight(3);
      p.ellipse(centerScreen.x, centerScreen.y, 18, 18);
      p.pop();

      var pinned = !!manager._pinnedCellKey;

      var tipW = 390;
      var tipH = 230;

      var anchorX = pinned ? centerScreen.x : p.mouseX;
      var anchorY = pinned ? centerScreen.y : p.mouseY;

      var rightLimit = L.side ? (L.side.left - 16) : (p.width - 16);
      var tipX = clamp(anchorX + 16, 16, rightLimit - tipW);
      var tipY = clamp(anchorY - tipH - 16, L.topBannerH + 14, p.height - tipH - 16);

      p.push();
      p.noStroke();
      p.fill(0, 0, 0, 12);
      p.rect(tipX + 3, tipY + 4, tipW, tipH, 14);
      p.fill(220, 222, 228, 238);
      p.rect(tipX, tipY, tipW, tipH, 14);
      p.pop();

      var streets = topKSorted(active.topStreets);
      var types = topKSorted(active.topTypes);
      var sevs = topKSorted(active.topSev);
      var locs = topKSorted(active.topLoc);
      var hours = topKSorted(active.topHour);

      var topStreet = streets.length ? streets[0].key : "";
      var topLoc = locs.length ? locs[0].key : "";
      var cross = parseCrossStreets(topLoc);
      var pctLabel = this._percentileLabel(agg.countsSorted, active.count);

      p.push();
      p.fill(18);
      p.textAlign(p.LEFT, p.TOP);

      p.textSize(13);
      p.text(pinned ? "Hotspot summary (pinned)" : "Hotspot summary", tipX + 14, tipY + 12);

      p.fill(90);
      p.textSize(11);
      p.text(pctLabel, tipX + 14, tipY + 32);

      p.fill(18);
      p.textSize(12);
      p.text("Primary street: " + (topStreet || "(unknown)"), tipX + 14, tipY + 54);

      p.fill(60);
      p.textSize(11);
      if (topLoc) p.text("Example block: " + topLoc, tipX + 14, tipY + 72);
      if (cross) p.text("Cross streets: " + cross, tipX + 14, tipY + 88);

      p.fill(18);
      p.textSize(12);
      p.text("Crashes: " + active.count, tipX + 14, tipY + 110);

      p.fill(60);
      p.textSize(11);
      p.text("Injuries: " + active.injuries + "   Serious: " + active.serious + "   Fatal: " + active.fatalities, tipX + 14, tipY + 126);

      p.text(
        "Ped-involved: " + active.ped + " (" + formatPct(active.ped, active.count) + ")" +
        "   Bike-involved: " + active.bike + " (" + formatPct(active.bike, active.count) + ")",
        tipX + 14, tipY + 142
      );

      p.text(
        "Flags: Speeding " + formatPct(active.speeding, active.count) +
        " · Inattention " + formatPct(active.inattn, active.count) +
        " · Under influence " + formatPct(active.underinfl, active.count),
        tipX + 14, tipY + 158
      );

      p.text("Crosswalks in cell (max): " + active.maxCrosswalk, tipX + 14, tipY + 174);

      var typeLine = types.length ? (types[0].key || "(unknown)") : "(unknown)";
      var sevLine = sevs.length ? (sevs[0].key || "(unknown)") : "(unknown)";
      var hourLine = hours.length ? (hours[0].key + ":00") : "(unknown)";

      p.text("Most common type: " + typeLine, tipX + 14, tipY + 192);
      p.text("Most common severity: " + sevLine + "   ·   Common hour: " + hourLine, tipX + 14, tipY + 208);

      p.pop();
    }
  };
})();