// viz_conclusion.js
// Stop 6: Recap of each visualization, conclusion, and practical advice for Seattle drivers.
(function () {
  window.VizConclusion = {
    _clickDebounce: false, // Prevents multiple rapid fires on a single click

    _layout: function (p) {
      var pad = 24; 
      var topBannerH = 72;
      var left = pad;
      var top = pad + topBannerH;
      var w = p.width - pad * 2;
      var h = p.height - top - pad;
      return { pad: pad, topBannerH: topBannerH, left: left, top: top, w: w, h: h };
    },

    draw: function (p, manager) {
      var L = this._layout(p);
      
      p.background(248, 249, 252);

      // --- Header Banner ---
      p.push();
      p.noStroke();
      p.fill(255);
      p.rect(0, 0, p.width, L.topBannerH);
      p.stroke(230);
      p.line(0, L.topBannerH, p.width, L.topBannerH); 

      p.fill(18);
      p.textAlign(p.LEFT, p.TOP);
      p.textSize(20);
      p.text("Stop 6 - Recap & conclusion", L.left, 14);
      p.fill(90);
      p.textSize(12);
      p.text("A summary of key metrics and actionable advice for navigating Seattle safely.", L.left, 44);
      p.pop();

      var startX = L.left;
      var y = L.top + 16;
      var mainW = L.w;

      p.push();
      p.textAlign(p.LEFT, p.TOP);

      // --- SECTION 1: DATA-RICH RECAP CARDS ---
      p.fill(18);
      p.textSize(16);
      p.text("The Route: Key Metrics by Stop", startX, y);
      y += 32;

      // Notice the added 'stepIndex' to link to your HTML data-active-index
      var recaps = [
        { stepIndex: 1, s: "Stop 1", t: "Where crashes cluster", d: "Hotspots concentrate along major corridors like I-5, downtown, and Aurora.", stat: "26,138 Total Crashes", c: [66, 133, 244] }, 
        { stepIndex: 2, s: "Stop 2", t: "What's driving risk", d: "Conditions like dark or wet roads associate with higher serious outcomes.", stat: "6.6% Severe in Dark", c: [234, 67, 53] }, 
        { stepIndex: 3, s: "Stop 3", t: "Who is affected", d: "Pedestrians and cyclists show a massive vulnerability gap.", stat: "13x Risk for Pedestrians", c: [251, 188, 4] }, 
        { stepIndex: 4, s: "Stop 4", t: "When risk peaks", d: "Late-night hours and Fridays stand out as specific high-risk time periods.", stat: "5,807 Midnight Crashes", c: [52, 168, 83] }, 
        { stepIndex: 5, s: "Stop 5", t: "Road context", d: "Mid-range speeds (35–45 mph) concentrate the most crashes per segment.", stat: "45 mph = Highest Rate", c: [142, 36, 170] } 
      ];

      var gap = 16;
      var cols = mainW > 900 ? 3 : 2; 
      var cardW = (mainW - (cols - 1) * gap) / cols;
      var cardH = 120; 

      // 1. Calculate the center points of all cards for the "Road"
      var cardCenters = [];
      for (var i = 0; i < recaps.length; i++) {
        var col = i % cols;
        var row = Math.floor(i / cols);
        var cx = startX + col * (cardW + gap);
        var cy = y + row * (cardH + gap);
        cardCenters.push({ x: cx + cardW / 2, y: cy + cardH / 2, rx: cx, ry: cy });
      }

      // 2. Draw the "Road" connecting the stops (Behind the cards)
      p.push();
      p.noFill();
      // Base asphalt layer
      p.stroke(200, 205, 215);
      p.strokeWeight(12);
      p.strokeJoin(p.ROUND);
      p.beginShape();
      for (var k = 0; k < cardCenters.length; k++) {
        p.vertex(cardCenters[k].x, cardCenters[k].y);
      }
      p.endShape();
      
      // Dashed center line layer
      p.stroke(255);
      p.strokeWeight(2);
      p.drawingContext.setLineDash([8, 8]); // Native HTML canvas dashing
      p.beginShape();
      for (var k = 0; k < cardCenters.length; k++) {
        p.vertex(cardCenters[k].x, cardCenters[k].y);
      }
      p.endShape();
      p.drawingContext.setLineDash([]); // Reset dash so it doesn't affect cards
      p.pop();

      // 3. Draw the Cards
      var isAnyHovered = false;

      for (var i = 0; i < recaps.length; i++) {
        var center = cardCenters[i];
        var cx = center.rx;
        var cy = center.ry;

        var isHover = p.mouseX > cx && p.mouseX < cx + cardW && p.mouseY > cy && p.mouseY < cy + cardH;

        if (isHover) {
          isAnyHovered = true;
          p.fill(252, 254, 255);
          p.stroke(recaps[i].c[0], recaps[i].c[1], recaps[i].c[2]); 
          
          // --- CLICK HANDLING ---
          if (p.mouseIsPressed && !this._clickDebounce) {
            this._clickDebounce = true;
            // Find the section in the HTML sidebar and scroll to it
            var targetSection = document.querySelector('section[data-active-index="' + recaps[i].stepIndex + '"]');
            if (targetSection) {
              targetSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        } else {
          p.fill(255);
          p.stroke(225);
        }
        
        p.rect(cx, cy, cardW, cardH, 8);

        // Color accent line
        p.noStroke();
        p.fill(recaps[i].c[0], recaps[i].c[1], recaps[i].c[2]);
        p.rect(cx, cy, 5, cardH, 8, 0, 0, 8);

        // Stop Number
        p.fill(140);
        p.textSize(11);
        p.text(recaps[i].s, cx + 18, cy + 14);

        // Title
        p.fill(18);
        p.textSize(14);
        p.text(recaps[i].t, cx + 18, cy + 30);

        // Key Metric
        p.fill(recaps[i].c[0], Math.max(0, recaps[i].c[1]-30), Math.max(0, recaps[i].c[2]-30)); 
        p.textSize(12);
        p.textStyle(p.BOLD);
        p.text(recaps[i].stat, cx + 18, cy + 50);
        p.textStyle(p.NORMAL);

        // Description
        p.fill(80);
        p.textSize(11);
        p.textLeading(15);
        p.text(recaps[i].d, cx + 18, cy + 68, cardW - 30, 40);

        // Action Link
        p.fill(isHover ? 18 : 160);
        p.textSize(10);
        p.text("Return to Stop →", cx + 18, cy + cardH - 20);
      }

      // Change cursor to pointer if hovering over any clickable card
      if (isAnyHovered) {
        p.cursor(p.HAND);
      } else {
        p.cursor(p.ARROW);
      }

      // Reset debounce when mouse is released
      if (!p.mouseIsPressed) {
        this._clickDebounce = false;
      }

      var numRows = Math.ceil(recaps.length / cols);
      y += numRows * (cardH + gap) + 24;

      // --- SECTION 2: CONCLUSION BANNER ---
      var conclH = 90;
      p.fill(240, 246, 255); 
      p.stroke(210, 228, 255);
      p.rect(startX, y, mainW, conclH, 8);

      p.noStroke();
      p.fill(30, 90, 180); 
      p.textSize(14);
      p.textStyle(p.BOLD);
      p.text("The Destination: The Bottom Line", startX + 24, y + 16);
      p.textStyle(p.NORMAL);

      p.fill(40, 50, 70);
      p.textSize(13);
      p.textLeading(20);
      var conclusionText = "Crash risk in Seattle is predictable: it concentrates on 35–45 mph arterials, peaks late at night, and disproportionately harms vulnerable users in dark/wet conditions. Targeted infrastructure changes and driver awareness in these specific contexts can meaningfully reduce city-wide risk.";
      p.text(conclusionText, startX + 24, y + 38, mainW - 48, conclH - 45);

      y += conclH + 32;

      // --- SECTION 3: PRACTICAL ADVICE ---
      p.fill(18);
      p.textSize(16);
      p.text("Practical Advice for Drivers", startX, y);
      y += 32;

      var advice = [
        { t: "Plan around hotspots", d: "Avoid or slow down through downtown, I-5 exits, and Aurora Ave." },
        { t: "Time your trip", d: "Allow extra distance and caution during late-night and Friday peaks." },
        { t: "Respect conditions", d: "Use headlights and increase following distance heavily in rain or dark." },
        { t: "Watch for people", d: "Expect pedestrians at crosswalks; remember they face 13x higher risk." },
        { t: "Ease off on arterials", d: "Strictly obey speed limits on 35–45 mph roads—the highest risk zones." }
      ];

      var advCols = 2;
      var advCardW = (mainW - gap) / advCols;
      var advCardH = 75;

      for (var j = 0; j < advice.length; j++) {
        var acol = j % advCols;
        var arow = Math.floor(j / advCols);
        var ax = startX + acol * (advCardW + gap);
        var ay = y + arow * (advCardH + gap);

        p.fill(255);
        p.stroke(225);
        p.rect(ax, ay, advCardW, advCardH, 8);

        // Warning/Alert Icon Proxy (Orange Triangle)
        p.noStroke();
        p.fill(251, 140, 0); 
        p.triangle(ax + 24, ay + 20, ax + 19, ay + 29, ax + 29, ay + 29);

        p.fill(18);
        p.textSize(13);
        p.textStyle(p.BOLD);
        p.text(advice[j].t, ax + 38, ay + 17);
        p.textStyle(p.NORMAL);

        p.fill(80);
        p.textSize(12);
        p.textLeading(16);
        p.text(advice[j].d, ax + 38, ay + 36, advCardW - 50, advCardH - 45);
      }

      p.pop();
    }
  };
})();