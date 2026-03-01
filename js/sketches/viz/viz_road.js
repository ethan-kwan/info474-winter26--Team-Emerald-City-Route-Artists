// viz_road.js
// Road scaffold visualization (Stop cards + car).
// OPTION A: The "big question" header lives in HTML steps,
// so the road viz should NOT render a top header/pill to avoid duplicates.

(function () {
  function clamp01(x) { return Math.max(0, Math.min(1, x)); }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  window.VizRoad = {
    init: function (manager) {
      if (manager._road) return;

      manager._road = {
        stops: [
          { key: 1, t: 0.08, title: "Where do crashes cluster?" },
          { key: 2, t: 0.24, title: "Which hotspots persist?" },
          { key: 3, t: 0.40, title: "Who is affected?" },
          { key: 4, t: 0.58, title: "When does risk peak?" },
          { key: 5, t: 0.76, title: "Road context + safety tools" },
          { key: 6, t: 0.92, title: "Your Route / Safety Plan" }
        ]
      };
    },

    _centerAt: function (manager, t) {
      var w = manager.width || 800;
      var h = manager.height || 700;

      var topPad = 90;
      var botPad = 70;

      var usableH = Math.max(1, h - topPad - botPad);
      var y = topPad + t * usableH;

      var midX = (w / 2);

      var amp1 = Math.min(170, w * 0.22);
      var amp2 = Math.min(80, w * 0.10);

      var x =
        midX +
        amp1 * Math.sin(t * Math.PI * 2.0 - Math.PI / 2) +
        amp2 * Math.sin(t * Math.PI * 4.0);

      return { x: x, y: y };
    },

    _drawBackground: function (p) {
      p.background(248, 249, 252);

      // keep the subtle top strip (no text inside it now)
      p.push();
      p.noStroke();
      p.fill(255, 255, 255, 235);
      p.rect(0, 0, p.width, 100);
      p.pop();
    },

    _drawRoad: function (p, manager) {
      var steps = 140;

      // shadow
      p.push();
      p.noFill();
      p.stroke(0, 0, 0, 14);
      p.strokeWeight(82);
      p.strokeCap(p.ROUND);
      p.beginShape();
      for (var i = 0; i <= steps; i++) {
        var t = i / steps;
        var c = this._centerAt(manager, t);
        p.curveVertex(c.x + 2, c.y + 4);
      }
      p.endShape();
      p.pop();

      // base
      p.push();
      p.noFill();
      p.stroke(28, 28, 34);
      p.strokeWeight(76);
      p.strokeCap(p.ROUND);
      p.beginShape();
      for (var j = 0; j <= steps; j++) {
        var tt = j / steps;
        var cc = this._centerAt(manager, tt);
        p.curveVertex(cc.x, cc.y);
      }
      p.endShape();
      p.pop();

      // dashed line
      p.push();
      p.stroke(245);
      p.strokeWeight(4);
      p.strokeCap(p.ROUND);

      var dashEvery = 0.036;
      var dashLen = 0.02;

      for (var t0 = 0.02; t0 < 0.98; t0 += dashEvery) {
        var a = this._centerAt(manager, t0);
        var b = this._centerAt(manager, Math.min(0.98, t0 + dashLen));
        p.line(a.x, a.y, b.x, b.y);
      }
      p.pop();
    },

    _drawStopMarker: function (p, cx, cy, isActive) {
      p.push();

      p.stroke(isActive ? 0 : 40);
      p.strokeWeight(isActive ? 3 : 2);
      p.fill(255);
      p.ellipse(cx, cy, isActive ? 28 : 24, isActive ? 28 : 24);

      // pump icon
      p.noStroke();
      p.fill(20);
      p.rect(cx - 4, cy - 6, 8, 12, 2);

      p.fill(255);
      p.rect(cx - 2.5, cy - 4.5, 5, 3, 1);

      p.stroke(20);
      p.strokeWeight(2);
      p.noFill();
      p.beginShape();
      p.vertex(cx + 4, cy - 2);
      p.vertex(cx + 9, cy - 2);
      p.vertex(cx + 9, cy + 7);
      p.endShape();

      p.pop();
    },

    _drawStopCard: function (p, manager, stop, isActive, sideLastY) {
      var c = this._centerAt(manager, stop.t);

      var side = (stop.key % 2 === 0) ? -1 : 1;
      var dx = side * Math.min(380, p.width * 0.34);

      var cardW = Math.min(260, Math.max(200, p.width * 0.20));
      var cardH = 70;

      var targetX = c.x + dx;
      var targetY = c.y;

      // avoid overlap on same side
      var minGap = 140;
      if (typeof sideLastY === 'number') {
        if (Math.abs(targetY - sideLastY) < minGap) {
          targetY = sideLastY + minGap;
        }
      }

      var pad = 18;

      var minY = 110 + (cardH / 2);
      var maxY = p.height - pad - (cardH / 2);

      var minX = pad + (cardW / 2);
      var maxX = p.width - pad - (cardW / 2);

      var x = clamp(targetX, minX, maxX);
      var y = clamp(targetY, minY, maxY);

      // connector
      p.push();
      p.stroke(0, 0, 0, 16);
      p.strokeWeight(2);
      p.line(c.x, c.y, x - (side * (cardW * 0.22)), y);
      p.pop();

      // card
      p.push();
      p.noStroke();

      if (isActive) {
        p.fill(0, 140, 255, 18);
        p.rect(x - cardW / 2 - 7, y - cardH / 2 - 7, cardW + 14, cardH + 14, 18);
      }

      p.fill(255);
      p.rect(x - cardW / 2, y - cardH / 2, cardW, cardH, 16);

      p.fill(18);
      p.textAlign(p.LEFT, p.CENTER);
      p.textSize(12);
      p.text("Stop " + stop.key, x - cardW / 2 + 14, y - 14);

      p.fill(90);
      p.textSize(13);
      p.text(stop.title, x - cardW / 2 + 14, y + 12);

      p.pop();

      return { y: y, side: side };
    },

    _drawCar: function (p, manager, tCar) {
      var c = this._centerAt(manager, tCar);

      p.push();
      p.noStroke();

      p.fill(0, 0, 0, 18);
      p.ellipse(c.x + 3, c.y + 4, 24, 24);

      p.fill(0, 140, 255);
      p.ellipse(c.x, c.y, 22, 22);

      p.fill(255, 255, 255, 170);
      p.ellipse(c.x - 5, c.y - 5, 8, 8);

      p.pop();
    },

    // NOTE: Kept for later if you ever want the road to own the header again.
    _drawTopPill: function (p, text) {
      var pillW = Math.min(760, p.width - 40);
      var pillH = 58;

      var x = p.width / 2;
      var y = 40;

      p.push();
      p.noStroke();
      p.fill(255);
      p.rect(x - pillW / 2, y - pillH / 2, pillW, pillH, 20);

      p.fill(18);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(18);
      p.text(text, x, y + 1);
      p.pop();
    },

    draw: function (p, manager, ai, progress) {
      this.init(manager);

      this._drawBackground(p);
      this._drawRoad(p, manager);

      var stops = manager._road.stops;

      var activeStop = Math.max(1, Math.min(6, ai));
      var idx = activeStop - 1;

      // markers
      for (var m = 0; m < stops.length; m++) {
        var pos = this._centerAt(manager, stops[m].t);
        this._drawStopMarker(p, pos.x, pos.y, stops[m].key === activeStop);
      }

      // cards, spaced per-side
      var lastLeftY = null;
      var lastRightY = null;

      for (var i = 0; i < stops.length; i++) {
        var s = stops[i];
        var side = (s.key % 2 === 0) ? -1 : 1;
        var lastY = (side === -1) ? lastLeftY : lastRightY;

        var res = this._drawStopCard(p, manager, s, s.key === activeStop, lastY);

        if (res.side === -1) lastLeftY = res.y;
        else lastRightY = res.y;
      }

      // FIX “1 behind” feel: only move at the END of the step
      var rawP = clamp01(progress || 0);
      var moveP = clamp01((rawP - 0.80) / 0.20);

      var tA = stops[idx].t;
      var tB = (idx < stops.length - 1) ? stops[idx + 1].t : stops[idx].t;
      var tCar = lerp(tA, tB, moveP);

      this._drawCar(p, manager, tCar);
    }
  };
})();