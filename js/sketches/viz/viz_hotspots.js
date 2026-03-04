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

  // Space-saving topK per-cell
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

  // -----------------------
  // NEW: crash-type glossary
  // -----------------------
  function crashTypeGlossary() {
    return [
      { key: "Angles", desc: "Two vehicles collide at an angle (often at intersections / turning conflicts)." },
      { key: "Rear Ended", desc: "One vehicle hits the back of another (often stop-and-go / following too closely)." },
      { key: "Sideswipe", desc: "Vehicles scrape sides while traveling parallel or changing lanes." },
      { key: "Head On", desc: "Front-to-front impact (often wrong-way / centerline crossing)." },
      { key: "Left Turn", desc: "Crash involves a left-turn conflict (turning vehicle vs through traffic)." },
      { key: "Right Turn", desc: "Crash involves a right-turn conflict (often at corners / merges)." },
      { key: "Parked Car", desc: "Moving vehicle hits a parked vehicle." },
      { key: "Pedestrian", desc: "Vehicle-pedestrian collision (crosswalks, mid-block crossings)." },
      { key: "Cyclist", desc: "Vehicle-bicycle collision (bike lanes, crossings, dooring)." }
    ];
  }

  function glossaryLookup() {
    var list = crashTypeGlossary();
    var map = {};
    for (var i = 0; i < list.length; i++) {
      map[(list[i].key || "").toLowerCase()] = list[i].desc;
    }
    return map;
  }

  // -----------------------
  // Viz
  // -----------------------
  window.VizHotspots = {
    _layout: function (p) {
      var pad = 18;
      var topBannerH = 106;

      var left = pad;
      var top = pad + topBannerH;
      var w = p.width - pad * 2;
      var h = p.height - top - pad;

      var sidebarW = (w >= 980) ? 380 : 0;
      var gap = (sidebarW > 0) ? 14 : 0;
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

        if ((d.crosswalk_count || 0) > cell.maxCrosswalk) cell.maxCrosswalk = d.crosswalk_count || 0;

        topKUpdate(cell.topStreets, street, 5);
        topKUpdate(cell.topTypes, d.collisionType, 5);
        topKUpdate(cell.topSev, d.severity, 4);
        topKUpdate(cell.topLoc, d.location, 3);
        topKUpdate(cell.topHour, (d.hour !== null && d.hour !== undefined) ? String(d.hour) : '', 4);

        if (cell.count > maxCount) maxCount = cell.count;

        // sample points
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
        minX: minX, maxX: maxX,
        minY: minY, maxY: maxY,
        dx: dx, dy: dy,
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

        // allow slight slop
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

      // zoom around map center (stable + simple)
      var oldScale = view.scale;
      var newScale = clamp(oldScale * factor, 1.0, 7.0);

      var cx = map.w / 2;
      var cy = map.h / 2;

      // base coord at center before zoom
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

      // Header strip
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

      // reset pinned if filters changed
      if (manager._pinResetSeen !== manager.state.pinResetToken) {
        manager._pinResetSeen = manager.state.pinResetToken;
        manager._pinnedCellKey = null;
      }

      // Title
      p.push();
      p.fill(18);
      p.textAlign(p.LEFT, p.TOP);
      p.textSize(18);
      p.text("Stop 1 — Crash density (zoom + pan)", L.left, 18);

      p.fill(90);
      p.textSize(12);
      var filtersLine =
        "Filters: " +
        (manager.state.filterYear === 'all' ? "All years" : ("Year " + manager.state.filterYear)) + " · " +
        (manager.state.filterSeverity === 'all' ? "All severities" : manager.state.filterSeverity) + " · " +
        (manager.state.filterMode === 'all' ? "All modes" : manager.state.filterMode) + " · " +
        (manager.state.filterTime === 'all' ? "All day" : manager.state.filterTime) +
        " — showing " + (agg.summary.total || 0) + " crashes";
      p.text(filtersLine, L.left, 42);

      p.text("Drag to pan · Double-click to reset · Use zoom buttons (+ / −)", L.left, 62);
      p.pop();

      // Panels
      p.push();
      p.noStroke();
      p.fill(230);
      p.rect(L.map.left, L.map.top, L.map.w, L.map.h, 14);
      if (L.side) {
        p.fill(240);
        p.rect(L.side.left, L.side.top, L.side.w, L.side.h, 14);
      }
      p.pop();

      // Pan / dblclick
      this._handlePanAndDoubleClick(p, manager, L.map);

      // Draw map with transform
      p.push();
      p.translate(L.map.left + view.tx, L.map.top + view.ty);
      p.scale(view.scale);

      // skeleton
      p.push();
      p.stroke(255, 255, 255, 70);
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

      // heat
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

        // ✅ FIX: keep dot size constant on screen by dividing by view.scale
        var rOuter = (baseR * 3.8) / view.scale;
        var rInner = (baseR * 1.6) / view.scale;

        var a1 = 10 + Math.floor(70 * t);
        p.fill(0, 140, 255, a1);
        p.ellipse(center.x, center.y, rOuter, rOuter);

        var a2 = 28 + Math.floor(170 * t);
        p.fill(0, 90, 200, a2);
        p.ellipse(center.x, center.y, rInner, rInner);
      }
      p.pop();

      p.pop(); // end transform

      // Legend
      p.push();
      var legX = L.map.left;
      var legY = L.map.top - 24;
      var legW = Math.min(260, L.map.w * 0.45);
      var legH = 10;

      for (var px = 0; px < legW; px++) {
        var tt = px / Math.max(1, legW - 1);
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

      // Sidebar + buttons
      if (L.side) {
        var s = agg.summary || {};
        var glossary = glossaryLookup();

        // define buttons
        var btnReset = { x: L.side.left + 18, y: L.side.top + 18, w: L.side.w - 36, h: 34 };
        var btnMinus = { x: L.side.left + 18, y: btnReset.y + btnReset.h + 12, w: (L.side.w - 44) / 2, h: 34 };
        var btnPlus  = { x: btnMinus.x + btnMinus.w + 8, y: btnMinus.y, w: btnMinus.w, h: btnMinus.h };

        function inRect(mx, my, r) {
          return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
        }

        var hoverReset = inRect(p.mouseX, p.mouseY, btnReset);
        var hoverMinus = inRect(p.mouseX, p.mouseY, btnMinus);
        var hoverPlus = inRect(p.mouseX, p.mouseY, btnPlus);

        // click handling (edge)
        if (manager._qsPrevPressed === undefined) manager._qsPrevPressed = false;
        var justPressed = p.mouseIsPressed && !manager._qsPrevPressed;
        manager._qsPrevPressed = p.mouseIsPressed;

        if (justPressed) {
          if (hoverReset) { view.scale = 1; view.tx = 0; view.ty = 0; }
          if (hoverMinus) { this._applyZoom(manager, L.map, 1 / 1.25); }
          if (hoverPlus)  { this._applyZoom(manager, L.map, 1.25); }
        }

        // card
        p.push();
        p.noStroke();
        p.fill(255, 255, 255, 235);
        p.rect(L.side.left + 12, L.side.top + 12, L.side.w - 24, L.side.h - 24, 14);

        // Reset button
        p.fill(hoverReset ? 0 : 18, hoverReset ? 120 : 140, 255, hoverReset ? 230 : 215);
        p.rect(btnReset.x, btnReset.y, btnReset.w, btnReset.h, 12);
        p.fill(255);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(12);
        p.text("Reset view", btnReset.x + btnReset.w / 2, btnReset.y + btnReset.h / 2);

        // +/- buttons
        p.fill(hoverMinus ? 30 : 255, hoverMinus ? 150 : 255, hoverMinus ? 255 : 255, 220);
        p.rect(btnMinus.x, btnMinus.y, btnMinus.w, btnMinus.h, 12);
        p.fill(hoverMinus ? 255 : 18);
        p.textSize(14);
        p.text("−", btnMinus.x + btnMinus.w / 2, btnMinus.y + btnMinus.h / 2);

        p.fill(hoverPlus ? 30 : 255, hoverPlus ? 150 : 255, hoverPlus ? 255 : 255, 220);
        p.rect(btnPlus.x, btnPlus.y, btnPlus.w, btnPlus.h, 12);
        p.fill(hoverPlus ? 255 : 18);
        p.text("+", btnPlus.x + btnPlus.w / 2, btnPlus.y + btnPlus.h / 2);

        // zoom readout
        p.fill(90);
        p.textSize(11);
        p.textAlign(p.LEFT, p.TOP);
        p.text("Zoom: " + view.scale.toFixed(2) + "×", L.side.left + 24, btnPlus.y + btnPlus.h + 10);

        // stats
        var y = btnPlus.y + btnPlus.h + 34;

        p.fill(18);
        p.textSize(14);
        p.text("Quick stats (filtered)", L.side.left + 24, y);
        y += 26;

        p.fill(60);
        p.textSize(12);
        p.text("Total crashes: " + (s.total || 0), L.side.left + 24, y); y += 18;
        p.text("Serious+Fatal: " + (s.severe || 0) + " (" + (s.severePct || 0) + "%)", L.side.left + 24, y); y += 18;

        var topType = (s.topTypes && s.topTypes[0]) ? s.topTypes[0].key : "(Unknown type)";
        p.text("Most common type: " + shorten(topType, 26), L.side.left + 24, y); y += 22;

        // NEW: crash type key / glossary
        p.fill(18);
        p.textSize(13);
        p.text("Crash type key:", L.side.left + 24, y);
        y += 18;

        p.fill(70);
        p.textSize(11);

        var keyList = crashTypeGlossary();
        for (var ki = 0; ki < keyList.length; ki++) {
          var kitem = keyList[ki];
          if (y > (L.side.top + L.side.h - 120)) break; // don't overflow
          p.text("- " + kitem.key + ": " + kitem.desc, L.side.left + 24, y);
          y += 16;
        }

        y += 10;
        p.fill(90);
        p.textSize(12);
        p.text("Top streets:", L.side.left + 24, y); y += 18;

        p.fill(60);
        p.textSize(12);
        var topStreets = s.topStreets || [];
        for (var i = 0; i < Math.min(5, topStreets.length); i++) {
          var it = topStreets[i];
          p.text((i + 1) + ". " + shorten(it.key, 24) + " (" + it.count + ")", L.side.left + 24, y);
          y += 18;
        }

        y += 10;
        p.fill(90);
        p.textSize(11);
        p.text("Tip: zoom in to inspect corridors like Aurora Ave N.", L.side.left + 24, y);

        p.pop();
      }

      // Tooltip / pin
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
      if (manager._pinnedCellKey && agg._cellLookup[manager._pinnedCellKey]) active = agg._cellLookup[manager._pinnedCellKey];
      else active = hoverCell;

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
      var tipY = clamp(anchorY - tipH - 16, L.topBannerH + 18, p.height - tipH - 16);

      // shadow + box (semi-transparent gray)
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