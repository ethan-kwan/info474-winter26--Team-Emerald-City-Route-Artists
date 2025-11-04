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

            // simple scatter plot with random positions (data-agnostic)
            if (ai >= 4) {
                // Cache a set of random points on the manager so we don't
                // regenerate every frame. Regenerate only every `updateEvery`
                // frames to slow down redraws and reduce flicker/CPU.
                p.noStroke();
                var cols = manager.width || 600;
                var rows = manager.height || 520;
                var offsetX = (manager.offsetX || 0);
                var offsetY = (manager.offsetY || 0);
                var count = 120;
                var updateEvery = 15; // frames between regenerations (~0.5s at 30fps)

                if (!manager._randomPoints || (p.frameCount % updateEvery === 0)) {
                    var pts = [];
                    for (var i = 0; i < count; i++) {
                        var rx = offsetX + Math.random() * cols;
                        var ry = offsetY + Math.random() * rows;
                        var rsz = 2 + Math.random() * 6;
                        var r = Math.floor(30 + Math.random() * 60);
                        var g = Math.floor(100 + Math.random() * 80);
                        var b = Math.floor(160 + Math.random() * 40);
                        var a = 180;
                        pts.push({ x: rx, y: ry, r: rsz, c: [r, g, b, a] });
                    }
                    manager._randomPoints = pts;
                }
                var pts = manager._randomPoints || [];
                for (var j = 0; j < pts.length; j++) {
                    var ptd = pts[j];
                    var col = ptd.c;
                    p.fill(col[0], col[1], col[2], col[3]);
                    p.ellipse(ptd.x, ptd.y, ptd.r, ptd.r);
                }
            }

            // simple bar plot with month in y-axis and random count in x-axis
            if (ai === 7) {

            }
        }
    };
})();
