// sketch_grid.js
// Responsible for rendering the main words grid and filler-related highlights

(function () {
    window.TemplateRenderer = {
        // setData: accept either an array of preloaded rows or a URL string
        // If a URL (or no data) is provided, attempt to load via DataLoader.loadTSV
        // then preprocess and compute layout. This keeps data-loading inside
        // the renderer / data_loader and out of `sections`.
        setData: function (manager, rawData) {
            var self = this;

            function computeLayout(data) {
                data = window.DataLoader.preprocess(data || []);
                manager.data = data;

                // default grid params (grid-specific details live here)
                manager.squareSize = manager.squareSize || 6;
                manager.squarePad = manager.squarePad || 2;
                manager.numPerRow = Math.floor((manager.width || 600) / (manager.squareSize + manager.squarePad));
                manager.offsetX = (manager.margin && manager.margin.left) || 20;
                manager.offsetY = (manager.margin && manager.margin.top) || 0;

                // compute positions
                data.forEach(function (d, i) {
                    d.col = i % manager.numPerRow;
                    d.x = manager.offsetX + d.col * (manager.squareSize + manager.squarePad);
                    d.row = Math.floor(i / manager.numPerRow);
                    d.y = manager.offsetY + d.row * (manager.squareSize + manager.squarePad);
                });

                manager._fillerIndices = data.reduce(function (acc, w, idx) { if (w.filler) acc.push(idx); return acc; }, []);
                manager._totalFillers = manager._fillerIndices.length;

                // expose for quick dev inspection
                try { if (window.__sketchAPI) window.__sketchAPI.data = manager.data; } catch (e) { }
            }

            // If rawData is a string, treat it as a URL to fetch
            if (typeof rawData === 'string' && rawData.length > 0) {
                if (!window.DataLoader || typeof window.DataLoader.loadTSV !== 'function') {
                    return Promise.reject(new Error('DataLoader.loadTSV required to load data from URL. Ensure js/helpers/data_loader.js is loaded.'));
                }
                return window.DataLoader.loadTSV(rawData).then(function (rows) {
                    computeLayout(rows);
                    return manager.data;
                }).catch(function (err) {
                    console.error('Template Renderer: failed to load data from', rawData, err);
                    computeLayout([]);
                    return manager.data;
                });
            }

            // If no rawData provided, attempt to load from config or default path
            if (!rawData || (Array.isArray(rawData) && rawData.length === 0)) {
                var cfgUrl = (window.ScrollDemoConfig && window.ScrollDemoConfig.dataUrl) ? window.ScrollDemoConfig.dataUrl : null;
                var defaultUrl = cfgUrl || 'data/words.tsv';
                if (window.DataLoader && typeof window.DataLoader.loadTSV === 'function') {
                    return window.DataLoader.loadTSV(defaultUrl).then(function (rows) {
                        computeLayout(rows);
                        return manager.data;
                    }).catch(function (err) {
                        console.error('Template Renderer: failed to load default data from', defaultUrl, err);
                        computeLayout([]);
                        return manager.data;
                    });
                }
            }

            // Otherwise assume rawData is an array-like structure and compute synchronously
            computeLayout(rawData || []);
            return Promise.resolve(manager.data);
        },

        draw: function (p, manager, ai, progress) {
            try { console.log('Template Renderer: drawing title, ai=', ai); } catch (e) { }

            // Handle title screens for early steps (keep titles in same sketch file)
            if (ai === 0 || ai === 1) {
                // draw a subtle background so it's obvious where the title is rendered
                var cx = manager.offsetX + manager.width / 2;
                var cy = manager.height / 3;
                p.push();
                p.noStroke();
                p.fill(255, 255, 160, 140);
                var w = 420;
                var h = 120;
                p.rect(cx - w / 2, cy - h / 2, w, h, 6);

                p.fill(0);
                p.textAlign(p.CENTER, p.CENTER);
                p.textSize(48);
                p.text(ai === 0 ? '2013' : 'Filler Words', cx, cy);
                p.pop();
                return;
            }

            // Draw grid base squares in a single pass (light gray)
            p.fill(220);
            for (var i = 0, n = manager.data.length; i < n; i++) {
                var d = manager.data[i];
                p.rect(d.x, d.y, manager.squareSize, manager.squareSize);
            }

            // Highlight filler squares using cached indices (faster loop)
            if (ai >= 3) {
                p.fill(0, 150, 140);
                for (var fi = 0; fi < manager._fillerIndices.length; fi++) {
                    var idx = manager._fillerIndices[fi];
                    var wd = manager.data[idx];
                    p.rect(wd.x, wd.y, manager.squareSize, manager.squareSize);
                }
            }

            // Show aggregated count
            if (ai >= 4) {
                var totalFillers = manager._totalFillers || 0;
                p.fill(0);
                p.textAlign(p.CENTER, p.CENTER);
                p.textSize(40);
                var cx = manager.offsetX + manager.width / 2;
                var cy = manager.offsetY + manager.height / 3;
                p.text(totalFillers, cx, cy);
                p.textSize(16);
                p.text('Filler Words', cx, cy + 40);
            }

            // Cough coloring via progress
            if (ai === 7) {
                var t = Math.max(0, Math.min(1, progress));
                for (var k = 0; k < manager.data.length; k++) {
                    var wd = manager.data[k];
                    if (wd.filler && wd.min >= 14) {
                        var r = Math.floor(0 + (255 - 0) * t);
                        var g = Math.floor(128 - (128 * t));
                        var b = Math.floor(120 - (120 * t));
                        p.fill(r, g, b);
                        p.rect(wd.x, wd.y, manager.squareSize, manager.squareSize);
                    }
                }
            }
        }
    };
})();
