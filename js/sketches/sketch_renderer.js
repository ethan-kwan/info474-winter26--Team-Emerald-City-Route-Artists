// sketch_renderer.js

// Responsible for rendering the main words grid and filler-related highlights
(function () {
    window.Renderer = {

        setData: function (manager) {
            var self = this;

            manager.offsetX = (manager.margin && manager.margin.left) || 20;
            manager.offsetY = (manager.margin && manager.margin.top) || 0;

            function computeLayout(data) {
                manager.data = data;
            }

            computeLayout([]);
            return Promise.resolve(manager.data);
        },

        draw: function (p, manager, ai, progress) {
            try { console.log('Renderer: drawing title, ai=', ai); } catch (e) { }

            // Handle title screens for early steps (keep titles in same sketch file)
            if (ai === 0 || ai === 1) {
                // draw a subtle background so it's obvious where the title is rendered
                var cx = manager.offsetX + manager.width / 2;
                var cy = manager.height / 3;
                p.push();

                p.fill(0);
                p.textAlign(p.CENTER, p.CENTER);
                p.textSize(48);
                p.text(ai === 0 ? 'INFO 474' : 'Final Project', cx, cy);
                p.pop();
                return;
            }

            // simple scatter plot with random positions
            if (ai >= 4) {

            }

            // simple bar plot with month in y-axis and random count in x-axis
            if (ai === 7) {

            }
        }
    };
})();
