// viz_hotspots.js
// Stop 1 heatmap (gridX/gridY aggregation) + hover tooltip.

(function () {
  function key(gx, gy) { return gx + "|" + gy; }

  window.VizHotspots = {
    init: function (manager) {
      manager.data = manager.data || {};
      if (manager.data.collisionsAgg) return;

      manager.data.collisionsAgg = {
        counts: {},
        crosswalks: {},
        minGX: 0, maxGX: 0, minGY: 0, maxGY: 0,
        maxCount: 1,
        ready: false
      };
    },

    setCollisions: function (manager, collisionsRows) {
      this.init(manager);

      var agg = manager.data.collisionsAgg;
      agg.counts = {};
      agg.crosswalks = {};
      agg.maxCount = 1;

      var minGX = Infinity, maxGX = -Infinity;
      var minGY = Infinity, maxGY = -Infinity;

      for (var i = 0; i < collisionsRows.length; i++) {
        var r = collisionsRows[i];
        var gx = r.gridX;
        var gy = r.gridY;

        if (gx < minGX) minGX = gx;
        if (gx > maxGX) maxGX = gx;
        if (gy < minGY) minGY = gy;
        if (gy > maxGY) maxGY = gy;

        var k = key(gx, gy);
        agg.counts[k] = (agg.counts[k] || 0) + 1;

        var cw = r.crosswalk_count || 0;
        if (agg.crosswalks[k] === undefined) agg.crosswalks[k] = cw;
        else agg.crosswalks[k] = Math.max(agg.crosswalks[k], cw);

        if (agg.counts[k] > agg.maxCount) agg.maxCount = agg.counts[k];
      }

      if (minGX === Infinity) {
        minGX = 0; maxGX = 0; minGY = 0; maxGY = 0;
      }

      agg.minGX = minGX;
      agg.maxGX = maxGX;
      agg.minGY = minGY;
      agg.maxGY = maxGY;
      agg.ready = true;
    },

    _layout: function (p) {
      var pad = 18;
      var topBannerH = 92;
      var left = pad;
      var top = pad + topBannerH;
      var w = p.width - pad * 2;
      var h = p.height - top - pad;
      return { left: left, top: top, w: w, h: h, pad: pad, topBannerH: topBannerH };
    },

    _hoverCell: function (p, manager, layout) {
      var agg = manager.data.collisionsAgg;
      if (!agg || !agg.ready) return null;

      var cols = (agg.maxGX - agg.minGX + 1);
      var rows = (agg.maxGY - agg.minGY + 1);
      if (cols <= 0 || rows <= 0) return null;

      var cellW = layout.w / cols;
      var cellH = layout.h / rows;

      var mx = p.mouseX;
      var my = p.mouseY;

      if (mx < layout.left || mx > layout.left + layout.w) return null;
      if (my < layout.top || my > layout.top + layout.h) return null;

      var col = Math.floor((mx - layout.left) / cellW);
      var row = Math.floor((my - layout.top) / cellH);

      var gx = agg.minGX + col;
      var gy = agg.maxGY - row; // flip vertical for screen coordinates

      return { gx: gx, gy: gy, col: col, row: row, cellW: cellW, cellH: cellH };
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

      p.push();
      p.fill(18);
      p.textAlign(p.LEFT, p.TOP);
      p.textSize(18);
      p.text("Stop 1 — Where do crashes cluster?", layout.left, 18);

      p.fill(90);
      p.textSize(12);
      p.text("Darker squares = more crashes in that grid cell. Hover to inspect.", layout.left, 48);
      p.pop();

      // Handle load errors nicely
      if (manager.data && manager.data.loadError) {
        p.push();
        p.fill(30);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(14);

        var msg =
          "Couldn't load the CSV.\n\n" +
          manager.data.loadError +
          "\n\nFix: run with Live Server or `python3 -m http.server`.";
        p.text(msg, p.width / 2, p.height / 2);
        p.pop();
        return;
      }

      var agg = manager.data && manager.data.collisionsAgg ? manager.data.collisionsAgg : null;
      if (!agg || !agg.ready) {
        p.push();
        p.fill(80);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(16);
        p.text("Loading collisions…", p.width / 2, p.height / 2);
        p.pop();
        return;
      }

      var cols = (agg.maxGX - agg.minGX + 1);
      var rows = (agg.maxGY - agg.minGY + 1);
      var cellW = layout.w / cols;
      var cellH = layout.h / rows;

      // Background
      p.push();
      p.noStroke();
      p.fill(235);
      p.rect(layout.left, layout.top, layout.w, layout.h, 10);
      p.pop();

      // Grid heatmap
      p.push();
      p.noStroke();
      for (var gx = agg.minGX; gx <= agg.maxGX; gx++) {
        for (var gy = agg.minGY; gy <= agg.maxGY; gy++) {
          var k = key(gx, gy);
          var c = agg.counts[k] || 0;

          var t = (agg.maxCount <= 0) ? 0 : (c / agg.maxCount);
          var shade = Math.floor(245 - (t * 200)); // 245..45
          shade = Math.max(35, Math.min(245, shade));

          var col = (gx - agg.minGX);
          var row = (agg.maxGY - gy);

          var x = layout.left + col * cellW;
          var y = layout.top + row * cellH;

          p.fill(shade);
          p.rect(x, y, cellW, cellH);
        }
      }
      p.pop();

      // Legend
      p.push();
      var legX = layout.left;
      var legY = layout.top - 22;
      var legW = Math.min(220, layout.w * 0.30);
      var legH = 10;

      for (var i = 0; i < legW; i++) {
        var tt = i / (legW - 1);
        var shade2 = Math.floor(245 - (tt * 200));
        shade2 = Math.max(35, Math.min(245, shade2));
        p.stroke(shade2);
        p.line(legX + i, legY, legX + i, legY + legH);
      }

      p.noStroke();
      p.fill(90);
      p.textSize(11);
      p.textAlign(p.LEFT, p.BOTTOM);
      p.text("Low", legX, legY - 2);
      p.textAlign(p.RIGHT, p.BOTTOM);
      p.text("High", legX + legW, legY - 2);
      p.pop();

      // Hover tooltip
      var hover = this._hoverCell(p, manager, layout);
      if (hover) {
        var hk = key(hover.gx, hover.gy);
        var count = agg.counts[hk] || 0;
        var cw = agg.crosswalks[hk] || 0;

        var hx = layout.left + hover.col * hover.cellW;
        var hy = layout.top + hover.row * hover.cellH;

        p.push();
        p.noFill();
        p.stroke(0, 140, 255);
        p.strokeWeight(3);
        p.rect(hx, hy, hover.cellW, hover.cellH);
        p.pop();

        var tipW = 240;
        var tipH = 74;
        var tipX = Math.min(p.width - tipW - 16, hx + 12);
        var tipY = Math.max(16 + layout.topBannerH, hy - tipH - 12);

        p.push();
        p.noStroke();
        p.fill(255);
        p.rect(tipX, tipY, tipW, tipH, 10);

        p.fill(18);
        p.textAlign(p.LEFT, p.TOP);
        p.textSize(12);
        p.text("Grid (" + hover.gx + ", " + hover.gy + ")", tipX + 12, tipY + 10);

        p.fill(60);
        p.text("Crashes: " + count, tipX + 12, tipY + 32);
        p.text("Crosswalks (joined): " + cw, tipX + 12, tipY + 50);
        p.pop();
      }
    }
  };
})();