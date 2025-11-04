// viz_bar.js
// Simple horizontal bar plot visual (12 months) using cached random values.
(function () {
    window.VizBar = {
        draw: function (p, manager, ai, progress) {
            p.push();
            var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            var left = manager.offsetX || 20;
            var top = manager.offsetY || 0;
            var availW = (manager.width || 600) - 40; // leave some right padding
            var availH = (manager.height || 520) - 20;
            var rowH = availH / months.length;
            var barMaxW = Math.max(60, availW - 120);
            var barUpdateEvery = 60; // regenerate every ~2s at 30fps

            if (!manager._barCounts || (p.frameCount % barUpdateEvery === 0)) {
                var bc = [];
                for (var m = 0; m < months.length; m++) bc.push(Math.random());
                manager._barCounts = bc;
            }

            var bc = manager._barCounts || [];
            p.noStroke();
            p.textAlign(p.LEFT, p.CENTER);
            p.textSize(12);

            for (var i = 0; i < months.length; i++) {
                var y = top + i * rowH + rowH / 2;
                p.fill(30);
                p.text(months[i], left, y);

                var val = bc[i] || 0;
                var bw = val * barMaxW;
                var bx = left + 60; // offset for labels
                var by = y - (rowH * 0.35);
                var bh = rowH * 0.7;
                p.fill(80, 150, 200, 220);
                p.rect(bx, by, bw, bh, 3);

                p.fill(255);
                p.textAlign(p.LEFT, p.CENTER);
                p.text(Math.round(val * 100), bx + 6, y);
            }
            p.pop();
        }
    };
})();
