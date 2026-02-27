// sketch_renderer.js

// Responsible for rendering the main visualization based on the current active index
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

            // Load collisions CSV and aggregate by year for placeholder viz
            manager.collisionsByYear = [];
            var dataUrl = 'data/master_collisions_crosswalks_2022_2026.csv';
            var loadPromise = (window.DataLoader && window.DataLoader.loadCSV)
                ? window.DataLoader.loadCSV(dataUrl).then(function (result) {
                    var rows = (result && result.rows) ? result.rows : [];
                    var yearCounts = {};
                    rows.forEach(function (row) {
                        var yearVal = row.Year || row.INCDATE || '';
                        var year = null;
                        if (yearVal) {
                            var parts = String(yearVal).split(/[/\s-]/);
                            for (var i = 0; i < parts.length; i++) {
                                var n = parseInt(parts[i], 10);
                                if (n >= 2020 && n <= 2030) { year = n; break; }
                            }
                        }
                        if (year) {
                            yearCounts[year] = (yearCounts[year] || 0) + 1;
                        }
                    });
                    var years = Object.keys(yearCounts).map(Number).sort(function (a, b) { return a - b; });
                    manager.collisionsByYear = years.map(function (y) { return { year: y, count: yearCounts[y] }; });
                    manager.collisionsData = rows;
                  }).catch(function (err) {
                    console.warn('Collisions data not loaded (copy CSV to data/):', err);
                  })
                : Promise.resolve();

            return loadPromise.then(function () { return manager.data; });
        },

        draw: function (p, manager, ai, progress) {
            try { console.log('Renderer: delegating draw, ai=', ai); } catch (e) { }

            if (ai === 0 || ai === 1) {
                window.VizTitle.draw(p, manager, ai, progress);
                return;
            }

            if (ai === 4) {
                if (window.VizCollisions) window.VizCollisions.draw(p, manager, ai, progress);
                return;
            }

            if (ai >= 5 && ai < 7) {
                window.VizScatter.draw(p, manager, ai, progress);
                return;
            }

            if (ai === 7) {
                window.VizBar.draw(p, manager, ai, progress);
                return;
            }
        }
    };
})();
