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

      // Only pick what we need for Stop 1 (keeps loading fast)
      var cols = [
        'x','y','Year','Month','Hour',
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

          // compute global bounds once (stable “map”)
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
          manager.data.hotspotAggCache = {}; // clear cache on reload

          return manager.data;
        })
        .catch(function (err) {
          manager.data.loadError = (err && err.message) ? err.message : String(err);
          console.error("Failed to load collisions CSV:", collisionsUrl, err);
          return manager.data;
        });
    },

    draw: function (p, manager, ai, progress) {
      if (ai === 0) {
        if (window.VizTitle && window.VizTitle.draw) window.VizTitle.draw(p, manager, ai, progress);
        else p.background(255);
        return;
      }

      if (ai >= 1 && ai <= 6) {
        var open = !!manager.state.openViz;
        var openFor = manager.state.openVizFor;

        if (open && openFor === ai) {
          if (ai === 1) {
            if (window.VizHotspots && window.VizHotspots.draw) {
              window.VizHotspots.draw(p, manager);
            } else {
              drawPlaceholder(p, manager, 1);
            }
            return;
          }

          drawPlaceholder(p, manager, ai);
          return;
        }

        if (window.VizRoad && window.VizRoad.draw) window.VizRoad.draw(p, manager, ai, progress);
        else p.background(255);
        return;
      }

      if (window.VizRoad && window.VizRoad.draw) window.VizRoad.draw(p, manager, 6, progress);
      else p.background(255);
    }
  };
})();