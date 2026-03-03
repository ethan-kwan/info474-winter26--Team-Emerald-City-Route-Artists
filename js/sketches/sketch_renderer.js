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

      // Only pick the columns we need (much faster)
      return window.DataLoader.loadCSVPick(collisionsUrl, ['gridX', 'gridY', 'crosswalk_count'])
        .then(function (rows) {
          var cleaned = window.DataLoader.preprocessCollisions(rows);
          manager.data.collisionsRaw = cleaned;

          if (window.VizHotspots && window.VizHotspots.setCollisions) {
            window.VizHotspots.setCollisions(manager, cleaned);
          }

          return manager.data;
        })
        .catch(function (err) {
          manager.data.loadError = (err && err.message) ? err.message : String(err);
          console.error("Failed to load collisions CSV:", collisionsUrl, err);
          return manager.data;
        });
    },

    draw: function (p, manager, ai, progress) {
      // Title screen (ai 0)
      if (ai === 0) {
        if (window.VizTitle && window.VizTitle.draw) window.VizTitle.draw(p, manager, ai, progress);
        else p.background(255);
        return;
      }

      // Stops 1..6: DEFAULT is ROAD.
      // Only show a stop’s visualization when the user clicks "Open visualization".
      if (ai >= 1 && ai <= 6) {
        var open = !!manager.state.openViz;
        var openFor = manager.state.openVizFor;

        if (open && openFor === ai) {
          // Stop 1 visualization is implemented
          if (ai === 1) {
            if (window.VizHotspots && window.VizHotspots.draw) {
              window.VizHotspots.draw(p, manager);
            } else {
              drawPlaceholder(p, manager, 1);
            }
            return;
          }

          // Other stops not implemented yet
          drawPlaceholder(p, manager, ai);
          return;
        }

        // Road view
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