// viz_conclusion.js
// Stop 6: Recap of each visualization, conclusion, and practical advice for Seattle drivers.
(function () {
  window.VizConclusion = {
    _layout: function (p) {
      var pad = 14;
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

      p.push();
      p.noStroke();
      p.fill(255);
      p.rect(0, 0, p.width, L.topBannerH + 12);
      p.pop();

      // Title
      p.push();
      p.fill(18);
      p.textAlign(p.LEFT, p.TOP);
      p.textSize(20);
      p.text("Stop 6 - Recap & conclusion", L.left, 14);
      p.fill(90);
      p.textSize(12);
      p.text("A summary of insights from the route and practical advice for driving in Seattle.", L.left, 44);
      p.pop();

      var cardX = L.left;
      var cardW = L.w;
      var ix = cardX + 16;
      var iw = cardW - 32;
      var lineH = 18;
      var sectionGap = 20;
      var y = L.top + 12;

      // ----- Recap: What we learned -----
      var recapH = 200;
      p.push();
      p.noStroke();
      p.fill(255, 255, 255, 200);
      p.rect(cardX, y, cardW, recapH, 12);
      p.fill(18);
      p.textAlign(p.LEFT, p.TOP);
      p.textSize(14);
      p.text("Recap: What we learned", ix, y + 14);
      p.fill(60);
      p.textSize(11);
      var recapY = y + 36;
      p.text("Stop 1 - Where crashes cluster: A heatmap shows crash density across the city. Hotspots concentrate along major corridors (e.g. I-5, downtown, Aurora). Filter by year, severity, mode (ped/bike), and time to see where risk is highest.", ix, recapY, iw, 52);
      recapY += 56;
      p.text("Stop 2 - What's driving risk: Charts compare how weather, road condition, and light condition relate to crash severity. Conditions like dark or wet roads often associate with a higher share of serious outcomes.", ix, recapY, iw, 38);
      recapY += 42;
      p.text("Stop 3 - Who is affected: Stacked bars break down pedestrian-involved, bike-involved, and other crashes by severity (PDO, Injury, Serious, Fatal). Vulnerable users often show a higher proportion of serious outcomes.", ix, recapY, iw, 38);
      recapY += 42;
      p.text("Stop 4 - When risk peaks: Time-of-day and day-of-week charts show when crashes are most frequent. Late-night hours and Fridays stand out as high-risk periods.", ix, recapY, iw, 32);
      recapY += 36;
      p.text("Stop 5 - Road context: Crashes per 100 street segments by speed limit (normalized) show that mid-range speeds (35–45 mph) concentrate the most crashes; 45 mph roads are especially notable.", ix, recapY, iw, 32);
      p.pop();
      y += recapH + sectionGap;

      // ----- Conclusion -----
      var conclH = 88;
      p.push();
      p.noStroke();
      p.fill(255, 255, 255, 200);
      p.rect(cardX, y, cardW, conclH, 12);
      p.fill(18);
      p.textAlign(p.LEFT, p.TOP);
      p.textSize(14);
      p.text("Conclusion", ix, y + 14);
      p.fill(60);
      p.textSize(11);
      p.text(
        "Crash risk in Seattle is not random: it concentrates in certain places (hotspots and major roads), at certain times (late night and weekends), and under certain conditions (dark, wet, or inattentive driving). " +
        "Roads with moderate to high speed limits (35–45 mph) see the most crashes per mile of road, and vulnerable road users bear a disproportionate share of serious harm. " +
        "Together, this suggests that small changes in where, when, and how we drive can meaningfully reduce risk for everyone.",
        ix, y + 38, iw, conclH - 44
      );
      p.pop();
      y += conclH + sectionGap;

      // ----- Practical advice for Seattle drivers -----
      var adviceH = 200;
      p.push();
      p.noStroke();
      p.fill(255, 255, 255, 200);
      p.rect(cardX, y, cardW, adviceH, 12);
      p.fill(18);
      p.textAlign(p.LEFT, p.TOP);
      p.textSize(14);
      p.text("Practical advice for Seattle drivers", ix, y + 14);
      p.fill(60);
      p.textSize(11);
      var ay = y + 38;
      p.text("- Plan around hotspots: When you can, avoid or slow down through known high-crash corridors (downtown, I-5 exits, Aurora, and busy arterials).", ix, ay, iw, 36);
      ay += 40;
      p.text("- Time your trip: Late-night and Friday driving carry higher crash rates. If you can, travel during lower-risk hours or allow extra following distance and focus during peak-risk times.", ix, ay, iw, 40);
      ay += 44;
      p.text("- Respect conditions: Rain and darkness increase severity. Use headlights, slow down, and increase following distance in bad weather or at night.", ix, ay, iw, 36);
      ay += 40;
      p.text("- Watch for people: Pedestrian and bike-involved crashes often have worse outcomes. In dense or mixed-use areas, slow down, avoid distractions, and expect people at crosswalks and bike lanes.", ix, ay, iw, 40);
      ay += 44;
      p.text("- Ease off on faster roads: 35–45 mph roads see the most crashes per segment. Obey speed limits, avoid speeding through these zones, and stay alert for conflicts and merging traffic.", ix, ay, iw, 36);
      p.pop();
    }
  };
})();
