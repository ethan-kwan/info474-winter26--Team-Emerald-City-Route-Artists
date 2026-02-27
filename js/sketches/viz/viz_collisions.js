// viz_collisions.js
// Placeholder: bar chart of collision count by year (collisions & crosswalks data)
(function () {
    window.VizCollisions = {
        draw: function (p, manager, ai, progress) {
            p.push();
            var left = manager.offsetX || 20;
            var top = manager.offsetY || 0;
            var w = manager.width || 600;
            var h = manager.height || 520;
            var padding = { left: 50, right: 30, top: 30, bottom: 50 };
            var chartW = w - padding.left - padding.right;
            var chartH = h - padding.top - padding.bottom;

            var byYear = manager.collisionsByYear || [];
            if (byYear.length === 0) {
                p.fill(80);
                p.textAlign(p.CENTER, p.CENTER);
                p.textSize(16);
                p.text('Collisions data by year (placeholder)', left + w / 2, top + h / 2);
                p.textSize(12);
                p.text('Copy master_collisions_crosswalks_2022_2026.csv into data/ to load', left + w / 2, top + h / 2 + 28);
                p.pop();
                return;
            }

            var maxCount = Math.max(1, Math.max.apply(null, byYear.map(function (d) { return d.count; })));
            var barW = Math.max(20, (chartW / byYear.length) - 12);

            p.noStroke();
            p.textAlign(p.CENTER, p.BOTTOM);
            p.textSize(11);
            p.fill(40);

            for (var i = 0; i < byYear.length; i++) {
                var d = byYear[i];
                var x = left + padding.left + i * (chartW / byYear.length) + (chartW / byYear.length - barW) / 2;
                var barH = (d.count / maxCount) * chartH;
                var y = top + padding.top + chartH - barH;

                p.fill(60, 120, 180, 220);
                p.rect(x, y, barW, barH, 4);

                p.fill(30);
                p.text(String(d.year), x + barW / 2, top + padding.top + chartH + 16);
            }

            // Title
            p.textAlign(p.CENTER, p.BOTTOM);
            p.textSize(14);
            p.fill(30);
            p.text('Collisions by year (2022–2026)', left + w / 2, top + padding.top - 8);

            p.pop();
        }
    };
})();
