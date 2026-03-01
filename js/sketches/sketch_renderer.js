// sketch_renderer.js
// Responsible for rendering the main visualization based on the current active index
(function () {
  window.Renderer = {

    setData: function (manager) {
      manager.offsetX = (manager.margin && manager.margin.left) || 20;
      manager.offsetY = (manager.margin && manager.margin.top) || 0;

      manager.data = [];
      return Promise.resolve(manager.data);
    },

    draw: function (p, manager, ai, progress) {
      // ai === 0 is the hero question screen (canvas will be hidden via showAt:1),
      // but we still keep a safe fallback.
      if (ai === 0) {
        if (window.VizTitle && window.VizTitle.draw) {
          window.VizTitle.draw(p, manager, ai, progress);
        } else {
          p.background(255);
        }
        return;
      }

      // Stops 1..6 -> road scaffold
      if (ai >= 1 && ai <= 6) {
        if (window.VizRoad && window.VizRoad.draw) {
          window.VizRoad.draw(p, manager, ai, progress);
        } else {
          p.background(255);
        }
        return;
      }

      // fallback: keep road visible even if index goes beyond
      if (window.VizRoad && window.VizRoad.draw) {
        window.VizRoad.draw(p, manager, 6, progress);
      } else {
        p.background(255);
      }
    }
  };
})();