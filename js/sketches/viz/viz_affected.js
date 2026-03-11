/* =========================================
   js/sketches/viz/viz_affected.js
   ========================================= */
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
  function groupFor(d) {
    if (d.isPed) return "Pedestrian";
    if (d.isBike) return "Cyclist";
    return "Vehicle / Other";
  }
  function bucketFor(d) {
    var sev = (d.severity || "").toLowerCase();
    if ((d.fatalities || 0) > 0 || sev.indexOf("fatal") >= 0) return "Fatal";
    if ((d.serious || 0) > 0 || sev.indexOf("serious") >= 0) return "Serious";
    if ((d.injuries || 0) > 0 || sev.indexOf("injury") >= 0) return "Injury";
    return "PDO";
  }
  
  function describeBucket(b) {
    if (b === "PDO") return "Property Damage Only: No reported physical injuries, only vehicle or structural damage.";
    if (b === "Injury") return "Minor/Evident Injury: Physical pain or non-disabling injuries reported.";
    if (b === "Serious") return "Serious Injury: Life-altering or disabling injuries requiring immediate hospitalization.";
    if (b === "Fatal") return "Fatal: The crash resulted in at least one death.";
    return b;
  }

  function topKeyUpdate(map, key) {
    if (!key || key === "Unknown" || key === "NULL") return;
    map[key] = (map[key] || 0) + 1;
  }
  
  function getTopKeys(map, n) {
    var keys = Object.keys(map || {});
    keys.sort(function(a, b) { return map[b] - map[a]; });
    return keys.slice(0, n);
  }

  function makeAggKey(state) {
    return [state.affectYear || "all", state.affectTime || "all"].join("|");
  }

  function pct(n, d) {
    if (!d) return 0;
    return Math.round((n / d) * 100);
  }

  function formatTimeBucket(tb) {
    if (tb === "Morning") return "Morning (5A-10A)";
    if (tb === "Midday") return "Midday (11A-3P)";
    if (tb === "Evening") return "Evening (4P-8P)";
    if (tb === "Night") return "Night (9P-4A)";
    return "Unknown";
  }

  window.VizAffected = {
    _layout: function (p) {
      var pad = 18;
      var topBannerH = 140; 
      var left = pad;
      var top = pad + topBannerH;
      var w = p.width - pad * 2;
      var h = p.height - top - pad;
      return { left: left, top: top, w: w, h: h, pad: pad, topBannerH: topBannerH };
    },

    _computeAgg: function (manager) {
      manager.data = manager.data || {};
      manager.data.affectedCache = manager.data.affectedCache || {};
      var key = makeAggKey(manager.state);
      if (manager.data.affectedCache[key]) return manager.data.affectedCache[key];

      var all = manager.data.collisionsAll || [];
      if (!all.length) {
        manager.data.affectedCache[key] = { ready: false };
        return manager.data.affectedCache[key];
      }
      var yearFilter = manager.state.affectYear || "all";
      var timeFilter = manager.state.affectTime || "all";
      
      var groups = {
        "Pedestrian":      { PDO: 0, Injury: 0, Serious: 0, Fatal: 0, total: 0, times: {}, streets: {} },
        "Cyclist":         { PDO: 0, Injury: 0, Serious: 0, Fatal: 0, total: 0, times: {}, streets: {} },
        "Vehicle / Other": { PDO: 0, Injury: 0, Serious: 0, Fatal: 0, total: 0, times: {}, streets: {} }
      };

      for (var i = 0; i < all.length; i++) {
        var d = all[i];
        if (yearFilter !== "all" && String(d.year) !== String(yearFilter)) continue;
        if (!timeMatch(d.hour, timeFilter)) continue;

        var g = groupFor(d);
        var b = bucketFor(d);
        groups[g][b] += 1;
        groups[g].total += 1;
        
        var h = d.hour;
        var tb = "Night";
        if (h >= 5 && h <= 10) tb = "Morning";
        else if (h >= 11 && h <= 15) tb = "Midday";
        else if (h >= 16 && h <= 20) tb = "Evening";
        topKeyUpdate(groups[g].times, tb);
        
        // Grab street name for location tracking
        var st = d.streetName || d.location || d.address || "Unknown Location";
        topKeyUpdate(groups[g].streets, st);
      }

      Object.keys(groups).forEach(function (g) {
        groups[g].peakTime = getTopKeys(groups[g].times, 1)[0] || "Unknown";
        
        // Get top 3 streets
        groups[g].topStreets = getTopKeys(groups[g].streets, 3).map(function(k) {
          return { name: k, count: groups[g].streets[k] };
        });
      });

      var agg = { ready: true, groups: groups, maxTotal: 1, total: all.length };
      Object.keys(groups).forEach(function(k) { if(groups[k].total > agg.maxTotal) agg.maxTotal = groups[k].total; });
      manager.data.affectedCache[key] = agg;
      return agg;
    },

    draw: function (p, manager) {
      var L = this._layout(p);
      var agg = this._computeAgg(manager);
      if (!agg || !agg.ready) return;

      p.background(248, 249, 252);
      
      // Header Banner
      p.push(); 
      p.noStroke(); p.fill(255); p.rect(0, 0, p.width, L.topBannerH + 18); 
      p.pop();

      // Filter Strings
      var fYear = (manager.state.affectYear === "all") ? "All years" : ("Year " + manager.state.affectYear);
      var fTime = (manager.state.affectTime === "all") ? "All day" : manager.state.affectTime;
      var fMode = manager.state.filterMode === "all" || !manager.state.filterMode ? "All modes" : manager.state.filterMode;
      var fSev = manager.state.filterSeverity === "all" || !manager.state.filterSeverity ? "All severities" : manager.state.filterSeverity;

      // Titles & Context
      p.push();
      p.fill(18); p.textAlign(p.LEFT, p.TOP); p.textSize(22); p.textStyle(p.BOLD);
      p.text("Stop 3 — Who bears the most risk?", L.left, 18);
      
      p.fill(110); p.textSize(12); p.textStyle(p.NORMAL);
      p.text("Filters: " + fYear + " · " + fSev + " · " + fMode + " · " + fTime + " — showing " + agg.total.toLocaleString() + " crashes.", L.left, 46);
      
      p.fill(70); p.textSize(13); 
      p.text("Context: Vehicles provide structural armor for their occupants. Pedestrians and cyclists do not have this protection. This reveals the 'vulnerability gap' by comparing outcomes.", L.left, 68, L.w - 10, 60);
      p.pop();

      // Main Background
      p.push(); p.noStroke(); p.fill(235); p.rect(L.left, L.top, L.w, L.h, 16); p.pop();

      var x0 = L.left + 26, y0 = L.top + 26;
      var cw = L.w - 52, ch = L.h - 52;
      
      // CARDS AREA: Pushed to 76% height to accommodate multi-line street text
      var cardAreaH = ch * 0.76; 
      var gap = 18;
      var cardW = (cw - (gap * 2)) / 3;

      var groupsOrder = ["Pedestrian", "Cyclist", "Vehicle / Other"];
      var bucketOrder = ["PDO", "Injury", "Serious", "Fatal"];
      var hitboxes = [];

      for (var gi = 0; gi < groupsOrder.length; gi++) {
        var gname = groupsOrder[gi], g = agg.groups[gname];
        var cx = x0 + (gi * (cardW + gap));
        var severe = (g.Serious + g.Fatal);
        var severePct = pct(severe, Math.max(1, g.total));

        // Card Base
        p.fill(255); p.noStroke(); p.rect(cx, y0, cardW, cardAreaH, 16);

        // Header
        p.textAlign(p.CENTER, p.TOP); p.fill(40); p.textSize(17); p.textStyle(p.BOLD);
        p.text(gname, cx + cardW/2, y0 + 16);
        p.fill(severePct > 10 ? [210, 50, 60] : 100); p.textSize(40);
        p.text(severePct + "%", cx + cardW/2, y0 + 38);
        p.fill(120); p.textSize(11); p.textStyle(p.NORMAL);
        p.text("Serious/Fatal Rate", cx + cardW/2, y0 + 82);

        // Vertical Bars
        var barBottom = y0 + cardAreaH - 185; 
        var maxBarH = cardAreaH - 300; 
        var barW = 75;
        var bx = cx + (cardW / 2) - (barW / 2);
        var totalHeight = maxBarH;

        var curY = barBottom;
        for (var bi = 0; bi < bucketOrder.length; bi++) {
          var b = bucketOrder[bi], cnt = g[b] || 0;
          var segH = (cnt / Math.max(1, g.total)) * totalHeight;
          if (segH < 1 && cnt > 0) segH = 2;
          if (segH < 1) continue;
          curY -= segH;
          p.noStroke();
          if (b === "PDO") p.fill(220); else if (b === "Injury") p.fill(120, 180, 220);
          else if (b === "Serious") p.fill(240, 130, 70); else p.fill(210, 50, 60);
          p.rect(bx, curY, barW, segH);
          p.stroke(255); p.strokeWeight(2); p.line(bx, curY+segH, bx+barW, curY+segH);
          
          hitboxes.push({ group: gname, bucket: b, x: bx, y: curY, w: barW, h: segH, count: cnt, total: g.total, severe: severe });
        }

        // Card Footer: Data Insights & Locations
        p.noStroke(); p.textAlign(p.CENTER, p.TOP);
        p.fill(120); p.textSize(11);
        p.text(g.total.toLocaleString() + " crashes", cx + cardW/2, barBottom + 12);
        p.fill(severePct > 10 ? [210, 50, 60] : 80); p.textStyle(p.BOLD);
        p.text(severe.toLocaleString() + " severe injuries", cx + cardW/2, barBottom + 28);
        p.fill(100); p.textStyle(p.NORMAL); p.textSize(10);
        p.text("Peak: " + formatTimeBucket(g.peakTime), cx + cardW/2, barBottom + 46);
        
        // High Injury Streets
        p.fill(40); p.textStyle(p.BOLD); p.text("Top Incident Locations:", cx + cardW/2, barBottom + 72);
        p.textStyle(p.NORMAL); p.fill(100); p.textSize(10);
        
        var streetY = barBottom + 88;
        for (var s = 0; s < g.topStreets.length; s++) {
          var stObj = g.topStreets[s];
          if (!stObj) continue;
          
          // Removed the count per the user request
          var stTxt = (s+1) + ". " + stObj.name; 
          
          // Use bounding box so long street names wrap naturally without cutting off
          p.text(stTxt, cx + 10, streetY, cardW - 20, 28); 
          streetY += 26; 
        }
      }

      // Legend
      var legendY = y0 + cardAreaH + 12;
      var legend = [{ k: "PDO (Property Damage)", c: [220, 222, 228] }, { k: "Minor Injury", c: [120, 180, 220] }, { k: "Serious Injury", c: [240, 130, 70] }, { k: "Fatal", c: [210, 50, 60] }];
      p.push(); p.textAlign(p.LEFT, p.CENTER); p.textSize(11); var lx = x0;
      for (var li = 0; li < legend.length; li++) {
        p.fill(255, 180); p.rect(lx, legendY, p.textWidth(legend[li].k)+30, 22, 999);
        p.fill(legend[li].c); p.rect(lx + 8, legendY + 6, 10, 10, 2);
        p.fill(60); p.text(legend[li].k, lx + 22, legendY + 11); lx += p.textWidth(legend[li].k)+38;
      }
      p.pop();

      // Tooltip logic
      var hover = null;
      for (var h = 0; h < hitboxes.length; h++) {
        var hb = hitboxes[h];
        if (p.mouseX >= hb.x && p.mouseX <= hb.x + hb.w && p.mouseY >= hb.y && p.mouseY <= hb.y + hb.h) hover = hb;
      }
      if (p.mouseIsPressed && !manager._prevMousePressedAffect) manager._affectPinned = hover;
      manager._prevMousePressedAffect = p.mouseIsPressed;
      var active = manager._affectPinned || hover;

      if (active) {
        p.push();
        var tipW = 340, tipH = 150;
        
        // Ensure tooltip stays securely within canvas bounds
        var tipX = clamp(p.mouseX + 15, 10, p.width - tipW - 10);
        var tipY = clamp(p.mouseY - tipH - 15, 10, p.height - tipH - 10);
        
        // Draw tooltip background
        p.fill(255, 250); p.stroke(200); p.strokeWeight(1); 
        p.rect(tipX, tipY, tipW, tipH, 12);
        
        // FORCE left/top alignment for tooltip text, resetting whatever the cards used
        p.noStroke(); p.textAlign(p.LEFT, p.TOP); 
        p.fill(18); p.textStyle(p.BOLD); p.textSize(14);
        p.text((manager._affectPinned ? "📌 Pinned: " : "") + active.group + " - " + active.bucket, tipX + 15, tipY + 15);
        
        p.textStyle(p.NORMAL); p.fill(60); p.textSize(12);
        p.text(describeBucket(active.bucket), tipX + 15, tipY + 40, tipW - 30, 40);
        
        var segPct = pct(active.count, Math.max(1, active.total));
        p.text("Volume: " + active.count.toLocaleString() + " crashes (" + segPct + "%)", tipX + 15, tipY + 90);
        
        p.fill(120); p.textSize(11); 
        p.text("Click to pin. Change filters to update data.", tipX + 15, tipY + 115);
        p.pop();
      }

      // Narrative Panel
      var panelY = legendY + 38;
      var pedRisk = pct(agg.groups["Pedestrian"].Serious + agg.groups["Pedestrian"].Fatal, Math.max(1, agg.groups["Pedestrian"].total));
      var vehRisk = pct(agg.groups["Vehicle / Other"].Serious + agg.groups["Vehicle / Other"].Fatal, Math.max(1, agg.groups["Vehicle / Other"].total));
      var mult = vehRisk > 0 ? (pedRisk / vehRisk).toFixed(1) : "N/A";

      p.push(); // Wrap inside a push to ensure alignment settings do not leak
      p.noStroke();
      p.fill(255, 180); p.rect(x0, panelY, cw, 90, 16);
      
      // Explicitly force left-alignment so the text doesn't slide off the left edge
      p.textAlign(p.LEFT, p.TOP);
      p.fill(18); p.textStyle(p.BOLD); p.textSize(15); 
      p.text("The Vulnerability Gap", x0 + 18, panelY + 18);
      
      p.textStyle(p.NORMAL); p.fill(40); p.textSize(13);
      p.text("A pedestrian is " + mult + "x more likely to be seriously injured than a vehicle occupant. Focus safety improvements on the high-incident streets listed in the cards above.", x0 + 18, panelY + 42, cw - 36);
      p.pop();
    }
  };
})();
