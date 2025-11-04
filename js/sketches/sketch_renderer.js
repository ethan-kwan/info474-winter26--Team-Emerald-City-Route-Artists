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
            if (ai >= 4 && ai < 7) {
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
                // Draw 12 horizontal bars (months) with random counts on x-axis.
                // Counts are cached on the manager and regenerated every
                // `barUpdateEvery` frames to avoid changing every draw.
                p.push();
                var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                var left = manager.offsetX || 20;
                var top = manager.offsetY || 0;
                var availW = (manager.width || 600) - 40; // leave some right padding
                var availH = (manager.height || 520) - 20;
                var rowH = availH / months.length;
                var barMaxW = Math.max(60, availW - 120);
                var barUpdateEvery = 60; // regenerate every ~2s at 30fps

                if (!manager._barCounts || (p.frameCount % barUpdateEvery === 0)) {
                    var bc = [];
                    for (var m = 0; m < months.length; m++) {
                        // random 0..1 value
                        bc.push(Math.random());
                    }
                    manager._barCounts = bc;
                }

                var bc = manager._barCounts || [];
                p.noStroke();
                p.textAlign(p.LEFT, p.CENTER);
                p.textSize(12);
                p.fill(0);

                for (var i = 0; i < months.length; i++) {
                    var y = top + i * rowH + rowH / 2;
                    // label
                    p.fill(30);
                    p.text(months[i], left, y);

                    // bar
                    var val = bc[i] || 0;
                    var bw = val * barMaxW;
                    var bx = left + 60; // offset for labels
                    var by = y - (rowH * 0.35);
                    var bh = rowH * 0.7;
                    p.fill(80, 150, 200, 220);
                    p.rect(bx, by, bw, bh, 3);

                    // value text on bar
                    p.fill(255);
                    p.textAlign(p.LEFT, p.CENTER);
                    p.text(Math.round(val * 100), bx + 6, y);
                }
                p.pop();
            }
        }
    };
})();
