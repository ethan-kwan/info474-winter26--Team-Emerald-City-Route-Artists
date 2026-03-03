// sketch_renderer.js
(function () {
  function drawPlaceholder(p, manager, stopNum) {
    p.background(248, 249, 252);
    p.push();
    p.noStroke();
    p.fill(255);
    p.rect(p.width / 2 - 240, p.height / 2 - 90, 480, 180, 14);

    p.fill(18);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(18);
    p.text("Stop " + stopNum + " visualization", p.width / 2, p.height / 2 - 20);

    p.fill(90);
    p.textSize(13);
    p.text("Coming soon — this is where the next chart will go.", p.width / 2, p.height / 2 + 20);
    p.pop();
  }

  window.Renderer = {

    setData: function (manager) {
      manager.offsetX = (manager.margin && manager.margin.left) || 20;
      manager.offsetY = (manager.margin && manager.margin.top) || 0;

      var cfg = window.ScrollDemoConfig || {};
      var collisionsUrl = cfg.collisionsUrl || 'data/master_collisions_crosswalks_2022_2026.csv';

      manager.data.loadError = null;

      if (!window.DataLoader || typeof window.DataLoader.loadCSVPick !== 'function') {
        manager.data.loadError = "DataLoader.loadCSVPick missing. Check js/helpers/data_loader.js is loaded.";
        return Promise.resolve(manager.data);
      }

      // Columns needed for Stop 1 + Stop 3
      var cols = [
        'x','y','Year','Hour',
        'LOCATION','COLLISIONTYPE','SEVERITYDESC',
        'INJURIES','SERIOUSINJURIES','FATALITIES',
        'IsPedCrash','IsBikeCrash',
        'SPEEDING','INATTENTIONIND','UNDERINFL',
        'crosswalk_count'
      ];

      return window.DataLoader.loadCSVPick(collisionsUrl, cols)
        .then(function (rows) {
          var cleaned = window.DataLoader.preprocessCollisions(rows);

          manager.data.collisionsAll = cleaned;

          // bounds for Stop 1 heatmap
          var minX = Infinity, maxX = -Infinity;
          var minY = Infinity, maxY = -Infinity;

          for (var i = 0; i < cleaned.length; i++) {
            var d = cleaned[i];
            if (d.x < minX) minX = d.x;
            if (d.x > maxX) maxX = d.x;
            if (d.y < minY) minY = d.y;
            if (d.y > maxY) maxY = d.y;
          }

          manager.data.bounds = { minX: minX, maxX: maxX, minY: minY, maxY: maxY };

          // clear caches when data reloads
          manager.data.hotspotAggCache = {};
          manager.data.affectedCache = {};

          return manager.data;
        })
        .catch(function (err) {
          manager.data.loadError = (err && err.message) ? err.message : String(err);
          console.error("Failed to load collisions CSV:", collisionsUrl, err);
          return manager.data;
        });
    },

    draw: function (p, manager, ai, progress) {
      // Title screen
      if (ai === 0) {
        if (window.VizTitle && window.VizTitle.draw) window.VizTitle.draw(p, manager, ai, progress);
        else p.background(255);
        return;
      }

      // Stops 1..6
      if (ai >= 1 && ai <= 6) {
        var open = !!manager.state.openViz;
        var openFor = manager.state.openVizFor;

        // If user opened this stop's visualization
        if (open && openFor === ai) {

          // Stop 1 heatmap
          if (ai === 1) {
            if (window.VizHotspots && window.VizHotspots.draw) window.VizHotspots.draw(p, manager);
            else drawPlaceholder(p, manager, 1);
            return;
          }

          // Stop 3 affected stacked bars
          if (ai === 3) {
            if (window.VizAffected && window.VizAffected.draw) window.VizAffected.draw(p, manager);
            else drawPlaceholder(p, manager, 3);
            return;
          }

          // Other stops not implemented
          drawPlaceholder(p, manager, ai);
          return;
        }

        // Default route view
        if (window.VizRoad && window.VizRoad.draw) window.VizRoad.draw(p, manager, ai, progress);
        else p.background(255);
        return;
      }

      // Fallback
      if (window.VizRoad && window.VizRoad.draw) window.VizRoad.draw(p, manager, 6, progress);
      else p.background(255);
    }
  };
})();