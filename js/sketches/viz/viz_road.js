/* =========================================
   js/sketches/viz/viz_road.js
   ========================================= */
(function () {
  function clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }

  function clamp(x, a, b) {
    return Math.max(a, Math.min(b, x));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  window.VizRoad = {
    init: function (manager) {
      if (manager._road) return;

      manager._road = {
        stops: [
            { key: 1, t: 0.01, title: "Where do crashes cluster?" }, // moved up
            { key: 2, t: 0.27, title: "What’s driving risk?" },
            { key: 3, t: 0.40, title: "Who is affected?" },
            { key: 4, t: 0.58, title: "When does risk peak?" },
            { key: 5, t: 0.86, title: "Road context + safety tools" },
            { key: 6, t: 0.91, title: "Your Route / Safety Plan" }
        ]
        };

      manager._roadEnv = { trees: [] };

      for (var i = 0; i < 65; i++) {
        var t = 0.01 + Math.random() * 0.98;

        if (t > 0.95) continue;

        var side = Math.random() > 0.5 ? 1 : -1;
        var offset = 170 + Math.random() * 120;

        manager._roadEnv.trees.push({
          t: t,
          side: side,
          offset: offset,
          size: 24 + Math.random() * 34
        });
      }
    },

    _centerAt: function (manager, t) {
      var w = manager.width || 800;
      var h = manager.height || 700;

      var topPad = 90;
      var botPad = 90;
      var usableH = Math.max(1, h - topPad - botPad);

      var y = topPad + t * usableH;
      var midX = w / 2;

      var amp1 = Math.min(240, w * 0.30);
      var amp2 = Math.min(90, w * 0.12);

      var x = midX +
        amp1 * Math.sin(t * Math.PI * 2.0 - Math.PI / 2) +
        amp2 * Math.sin(t * Math.PI * 3.0);

      return { x: x, y: y };
    },

    _drawBackground: function (p) {
      p.background(238, 242, 246);
    },

    _drawEnvironment: function (p, manager) {
      if (!manager._roadEnv) return;

      p.push();
      p.noStroke();

      for (var i = 0; i < manager._roadEnv.trees.length; i++) {
        var tr = manager._roadEnv.trees[i];
        var pos = this._centerAt(manager, tr.t);
        var next = this._centerAt(manager, Math.min(1, tr.t + 0.01));

        var dx = next.x - pos.x;
        var dy = next.y - pos.y;
        var len = Math.sqrt(dx * dx + dy * dy);

        if (!len) continue;

        var nx = -dy / len * tr.side;
        var ny = dx / len * tr.side;

        var tx = pos.x + nx * tr.offset;
        var ty = pos.y + ny * tr.offset;

        p.fill(0, 0, 0, 10);
        p.ellipse(tx + 6, ty + 8, tr.size * 1.2, tr.size * 0.75);

        p.fill(46, 139, 87, 230);
        p.ellipse(tx, ty, tr.size, tr.size);

        p.fill(34, 110, 60, 220);
        p.ellipse(
          tx + tr.size * 0.1,
          ty - tr.size * 0.1,
          tr.size * 0.58,
          tr.size * 0.58
        );
      }

      p.pop();
    },

    _drawRoad: function (p, manager) {
      var steps = 180;

      p.push();
      p.noFill();
      p.stroke(0, 0, 0, 10);
      p.strokeWeight(140);
      p.strokeCap(p.ROUND);
      p.beginShape();
      for (var j = 0; j <= steps; j++) {
        var tt = j / steps;
        var cc = this._centerAt(manager, tt);
        p.curveVertex(cc.x, cc.y + 6);
      }
      p.endShape();
      p.pop();

      p.push();
      p.noFill();
      p.stroke(42, 45, 52);
      p.strokeWeight(120);
      p.strokeCap(p.ROUND);
      p.beginShape();
      for (var k = 0; k <= steps; k++) {
        var tk = k / steps;
        var ck = this._centerAt(manager, tk);
        p.curveVertex(ck.x, ck.y);
      }
      p.endShape();
      p.pop();

      p.push();
      p.noFill();
      p.stroke(250, 204, 21);
      p.strokeWeight(4);
      p.drawingContext.setLineDash([24, 24]);
      p.beginShape();
      for (var i = 0; i <= steps; i++) {
        var ti = i / steps;
        var ci = this._centerAt(manager, ti);
        p.curveVertex(ci.x, ci.y);
      }
      p.endShape();
      p.drawingContext.setLineDash([]);
      p.pop();
    },

    _drawHouse: function (p, manager) {
      var c = this._centerAt(manager, 1.0);
      var prev = this._centerAt(manager, 0.98);
      var angle = Math.atan2(c.y - prev.y, c.x - prev.x);

      p.push();
      p.translate(c.x - 80, c.y - 80);

      p.push();
      p.rotate(angle);
      p.fill(160, 164, 170);
      p.pop();

      p.translate(0, 88);
      p.scale(1.9);

      p.noStroke();
      p.fill(0, 0, 0, 28);
      p.ellipse(0, 24, 64, 22);

      p.fill(250, 248, 242);
      p.rect(-30, -12, 60, 34, 3);

      p.fill(31, 41, 55);
      p.triangle(-36, -12, 0, -36, 36, -12);
      p.fill(55, 65, 81);
      p.triangle(0, -36, 36, -12, 0, -12);

      p.fill(220, 38, 38);
      p.rect(-8, 4, 16, 18, 2);
      p.fill(255);
      p.ellipse(5, 13, 3, 3);

      p.fill(147, 197, 253);
      p.stroke(100);
      p.strokeWeight(1);
      p.rect(14, -2, 12, 12, 1);
      p.rect(-26, -2, 12, 12, 1);
      p.noStroke();

      p.fill(255);
      p.rect(-18, 28, 36, 12, 3);
      p.fill(18);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(7);
      p.textStyle(p.BOLD);
      p.text("HOME", 0, 34);

      p.pop();
    },

    _drawStopMarker: function (p, manager, stop) {
      var c = this._centerAt(manager, stop.t);
      var prev = this._centerAt(manager, Math.max(0, stop.t - 0.01));

      var dx = c.x - prev.x;
      var dy = c.y - prev.y;
      var len = Math.sqrt(dx * dx + dy * dy);

      if (!len) len = 1;

      var side = (stop.key % 2 === 0) ? -1 : 1;

      var nx = -dy / len * side;
      var ny = dx / len * side;

      var offset = 132;
      var gx = c.x + nx * offset;
      var gy = c.y + ny * offset;

      p.push();
      p.translate(gx, gy);

      p.noStroke();
      p.fill(0, 0, 0, 20);
      p.ellipse(4, 30, 42, 16);

      p.fill(220, 38, 38);
      p.rect(-16, -22, 32, 50, 6);

      p.fill(75, 85, 99);
      p.rect(-16, 18, 32, 10, 0, 0, 6, 6);

      p.fill(255);
      p.rect(-10, -13, 20, 16, 3);

      p.fill(100);
      p.rect(-6, -9, 12, 7, 1);

      p.fill(243, 244, 246);
      p.rect(-10, 7, 20, 9, 2);

      p.noFill();
      p.stroke(55, 65, 81);
      p.strokeWeight(4);
      p.beginShape();
      p.vertex(16, -8);
      p.bezierVertex(28, -8, 28, 18, 16, 18);
      p.endShape();

      p.fill(55, 65, 81);
      p.noStroke();
      p.rect(14, 8, 5, 12, 2);

      p.pop();

      return { x: gx, y: gy, side: side };
    },

    _buildLabelLayout: function (manager, activeStop) {
      var stops = manager._road.stops;
      var layout = {};
      var left = [];
      var right = [];

      for (var i = 0; i < stops.length; i++) {
        var stop = stops[i];
        var c = this._centerAt(manager, stop.t);
        var prev = this._centerAt(manager, Math.max(0, stop.t - 0.01));

        var dx = c.x - prev.x;
        var dy = c.y - prev.y;
        var len = Math.sqrt(dx * dx + dy * dy);
        if (!len) len = 1;

        var side = (stop.key % 2 === 0) ? -1 : 1;
        var nx = -dy / len * side;
        var ny = dx / len * side;

        var markerOffset = 132;
        var gx = c.x + nx * markerOffset;
        var gy = c.y + ny * markerOffset;

        var isActive = stop.key === activeStop;
        var boxW = isActive ? 260 : 150;
        var boxH = isActive ? 74 : 34;
        var labelOffsetX = isActive ? 162 : 108;

        var item = {
          stop: stop,
          side: side,
          markerX: gx,
          markerY: gy,
          cardW: boxW,
          cardH: boxH,
          desiredX: gx + (side * labelOffsetX),
          desiredY: gy - (isActive ? 6 : 2),
          finalX: 0,
          finalY: 0
        };

        if (side < 0) left.push(item);
        else right.push(item);
      }

      function resolveSide(items, canvasW, canvasH) {
        items.sort(function (a, b) {
          return a.desiredY - b.desiredY;
        });

        var margin = 20;
        var minGap = 26;

        for (var i = 0; i < items.length; i++) {
          var it = items[i];

          it.finalX = clamp(
            it.desiredX,
            margin + it.cardW / 2,
            canvasW - margin - it.cardW / 2
          );

          it.finalY = clamp(
            it.desiredY,
            margin + it.cardH / 2,
            canvasH - margin - it.cardH / 2
          );

          if (i > 0) {
            var prevItem = items[i - 1];
            var minY = prevItem.finalY + (prevItem.cardH / 2) + (it.cardH / 2) + minGap;
            if (it.finalY < minY) {
              it.finalY = minY;
            }
          }
        }

        for (var j = items.length - 2; j >= 0; j--) {
          var curr = items[j];
          var nextItem = items[j + 1];
          var maxY = nextItem.finalY - (nextItem.cardH / 2) - (curr.cardH / 2) - minGap;

          var bottomClamp = canvasH - margin - curr.cardH / 2;
          if (nextItem.finalY > canvasH - margin - nextItem.cardH / 2) {
            nextItem.finalY = canvasH - margin - nextItem.cardH / 2;
          }

          if (curr.finalY > maxY) {
            curr.finalY = maxY;
          }

          curr.finalY = clamp(
            curr.finalY,
            margin + curr.cardH / 2,
            bottomClamp
          );
        }

        for (var k = 0; k < items.length; k++) {
          layout[items[k].stop.key] = items[k];
        }
      }

      resolveSide(left, manager.width, manager.height);
      resolveSide(right, manager.width, manager.height);

      if (layout[6]) {
        layout[6].finalY = Math.min(layout[6].finalY, manager.height - 110);
      }

      return layout;
    },

    _drawCompactStopPill: function (p, item) {
      var x = item.markerX;
      var y = item.markerY;
      var targetX = item.finalX;
      var targetY = item.finalY;
      var pillW = item.cardW;
      var pillH = item.cardH;
      var side = item.side;
      var stop = item.stop;

      var anchorX = targetX - (side * pillW / 2);

      p.push();
      p.stroke(0, 0, 0, 18);
      p.strokeWeight(1.5);
      p.line(x, y, anchorX, targetY);
      p.pop();

      p.push();
      p.drawingContext.shadowOffsetX = 0;
      p.drawingContext.shadowOffsetY = 6;
      p.drawingContext.shadowBlur = 18;
      p.drawingContext.shadowColor = 'rgba(0, 0, 0, 0.08)';

      p.fill(255, 248);
      p.noStroke();
      p.rect(targetX - pillW / 2, targetY - pillH / 2, pillW, pillH, 18);

      p.drawingContext.shadowColor = 'transparent';

      p.fill(0, 112, 243);
      p.ellipse(targetX - pillW / 2 + 16, targetY, 10, 10);

      p.fill(17, 24, 39);
      p.textAlign(p.LEFT, p.CENTER);
      p.textStyle(p.BOLD);
      p.textSize(11);
      p.text("STOP " + stop.key, targetX - pillW / 2 + 28, targetY);

      p.pop();
    },

    _drawActiveStopCard: function (p, item) {
      var x = item.markerX;
      var y = item.markerY;
      var targetX = item.finalX;
      var targetY = item.finalY;
      var cardW = item.cardW;
      var cardH = item.cardH;
      var side = item.side;
      var stop = item.stop;

      var anchorX = targetX - (side * cardW / 2);

      p.push();
      p.stroke(0, 0, 0, 22);
      p.strokeWeight(2);
      p.line(x, y, anchorX, targetY);
      p.pop();

      p.push();
      p.drawingContext.shadowOffsetX = 0;
      p.drawingContext.shadowOffsetY = 10;
      p.drawingContext.shadowBlur = 26;
      p.drawingContext.shadowColor = 'rgba(0, 0, 0, 0.10)';

      p.fill(255);
      p.noStroke();
      p.rect(targetX - cardW / 2, targetY - cardH / 2, cardW, cardH, 12);

      p.drawingContext.shadowColor = 'transparent';

      p.fill(0, 112, 243);
      p.rect(targetX - cardW / 2, targetY - cardH / 2, 8, cardH, 12, 0, 0, 12);

      p.fill(0, 112, 243);
      p.textAlign(p.LEFT, p.CENTER);
      p.textStyle(p.BOLD);
      p.textSize(12);
      p.text("STOP " + stop.key, targetX - cardW / 2 + 22, targetY - 15);

      p.fill(17, 24, 39);
      p.textSize(15);
      p.textStyle(p.NORMAL);
      p.text(stop.title, targetX - cardW / 2 + 22, targetY + 9);

      p.fill(255);
      p.stroke(0, 112, 243);
      p.strokeWeight(3);
      p.ellipse(targetX + cardW / 2 - 22, targetY, 12, 12);

      p.noStroke();
      p.fill(0, 112, 243);
      p.ellipse(targetX + cardW / 2 - 22, targetY, 6, 6);

      p.pop();
    },

    _drawCar: function (p, manager, tCar) {
      var c = this._centerAt(manager, tCar);
      var prev = this._centerAt(manager, Math.max(0, tCar - 0.03));
      var next = this._centerAt(manager, Math.min(1, tCar + 0.03));

      var angle = Math.atan2(next.y - prev.y, next.x - prev.x);
      angle += 0.05 * Math.sin(tCar * 10);

      if (!manager._carIcon && !manager._carIconLoading && p.loadImage) {
        manager._carIconLoading = true;
        p.loadImage(
          'assets/car-icon.png',
          function (img) {
            manager._carIcon = img;
            manager._carIconLoading = false;
          },
          function () {
            manager._carIconLoading = false;
          }
        );
      }

      p.push();
      p.translate(c.x, c.y);
      p.rotate(angle);

      p.noStroke();
      p.fill(0, 0, 0, 50);
      p.rect(-30, -16, 70, 40, 10);

      if (manager._carIcon) {
        p.imageMode(p.CENTER);
        p.image(manager._carIcon, 0, 0, 80, 80);
      } else {
        p.fill(220, 38, 38);
        p.rect(-35, -20, 70, 40, 10);

        p.fill(31, 41, 55);
        p.rect(-10, -16, 32, 32, 6);

        p.fill(255, 255, 200);
        p.rect(30, -18, 6, 8, 3);
        p.rect(30, 10, 6, 8, 3);

        p.fill(150, 0, 0);
        p.rect(-35, -18, 4, 8, 2);
        p.rect(-35, 10, 4, 8, 2);
      }

      p.pop();
    },

    draw: function (p, manager, ai, progress) {
      this.init(manager);
      this._drawBackground(p);
      this._drawEnvironment(p, manager);

      var stops = manager._road.stops;
      var activeStop = Math.max(1, Math.min(6, ai));
      var idx = activeStop - 1;

      var rawP = clamp01(progress || 0);
      var moveP = clamp01((rawP - 0.60) / 0.40);

      var tA = stops[idx].t;
      var tB = (idx < stops.length - 1) ? stops[idx + 1].t : stops[idx].t;
      var tCar = lerp(tA, tB, moveP);

      this._drawRoad(p, manager);
      this._drawHouse(p, manager);

      var layout = this._buildLabelLayout(manager, activeStop);

      for (var i = 0; i < stops.length; i++) {
        var stop = stops[i];
        this._drawStopMarker(p, manager, stop);

        var item = layout[stop.key];
        if (!item) continue;

        if (stop.key === activeStop) {
          this._drawActiveStopCard(p, item);
        } else {
          this._drawCompactStopPill(p, item);
        }
      }

      this._drawCar(p, manager, tCar);
    }
  };
})();