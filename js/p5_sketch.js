// p5 sketch to render the words grid and respond to scroll-driven state
// Exposes startP5(rawData) which initializes the sketch using the data

// Window-level state that other scripts (sections.js) will update
window.p5State = {
    activeIndex: 0,
    progress: 0
};

function startP5(rawData) {
    // Simple module wrapper that returns a small API for controlling the sketch.
    // Keeps the p5 code compact and readable for teaching and extension.

    // --- Data preprocessing -------------------------------------------------
    function preprocess(data) {
        data = data || [];
        return data.map(function (d, i) {
            return {
                word: (d.word || '').replace(/^"|"$/g, ''),
                filler: (d.filler === true || d.filler === '1' || d.filler === 1 || d.filler === 'true'),
                time: +d.time,
                min: Math.floor(+d.time / 60),
                index: i
            };
        });
    }

    // --- Sketch manager ----------------------------------------------------
    function SketchManager(data) {
        // core layout settings (easy to tweak)
        this.data = preprocess(data);
        this.width = 600; // content width (matches original SVG content)
        this.height = 520; // content height
        this.margin = { top: 0, left: 20, bottom: 40, right: 10 };
        this.squareSize = 6;
        this.squarePad = 2;
        // use integer number of items per row for predictable wrapping
        this.numPerRow = Math.floor(this.width / (this.squareSize + this.squarePad));
        this.offsetX = this.margin.left;
        this.offsetY = this.margin.top;
        this.canvasWidth = this.width + this.margin.left + this.margin.right;
        this.canvasHeight = this.height + this.margin.top + this.margin.bottom;

        // drawing state
        this.state = { activeIndex: 0, progress: 0 };

        // compute positions and some cached lists used when rendering
        this._computeLayout();

        // create the p5 instance bound to this manager
        var self = this;
        var sketch = function (p) {
            p.setup = function () {
                var parent = document.getElementById('vis');
                parent.innerHTML = '';
                p.createCanvas(self.canvasWidth, self.canvasHeight).parent('vis');
                p.noStroke();
                p.frameRate(30);
            };

            p.draw = function () {
                p.background(255);
                self.draw(p);
            };
        };

        this.p5 = new p5(sketch);
    }

    /**
     * recompute layout positions for current data and size
     */
    SketchManager.prototype._computeLayout = function () {
        this.data.forEach(function (d, i) {
            d.col = i % this.numPerRow;
            d.x = this.offsetX + d.col * (this.squareSize + this.squarePad);
            d.row = Math.floor(i / this.numPerRow);
            // apply top offset so the grid doesn't start at the very top of the canvas
            d.y = this.offsetY + d.row * (this.squareSize + this.squarePad);
        }, this);
        // cache indices of filler words for faster rendering
        this._fillerIndices = this.data.reduce(function (acc, w, idx) { if (w.filler) acc.push(idx); return acc; }, []);
        // cache totals
        this._totalFillers = this._fillerIndices.length;
    };

    /**
     * Replace the data used by the sketch and recompute layout.
     * Useful if you want to load new data without recreating the sketch.
     */
    SketchManager.prototype.setData = function (newData) {
        this.data = preprocess(newData);
        this._computeLayout();
    };

    /**
     * Convenience: expose resize/setData/destroy on the public API as well.
     * Call setData when you need to replace the dataset without recreating the
     * whole p5 instance.
     */

    // set visualization state (called by scroll logic)
    SketchManager.prototype.setState = function (s) {
        if (s.activeIndex !== undefined) this.state.activeIndex = s.activeIndex;
        if (s.progress !== undefined) this.state.progress = s.progress;
    };

    /**
     * Resize the canvas and recompute layout. Call this when the page
     * layout changes (for example, container width changes) so the canvas
     * and grid remain aligned with the text steps.
     * - opts.width: optional new content width (not including margins)
     */
    SketchManager.prototype.resize = function (opts) {
        opts = opts || {};
        if (opts.width) this.width = opts.width;
        // recompute integer items per row and canvas size
        this.numPerRow = Math.floor(this.width / (this.squareSize + this.squarePad));
        this.canvasWidth = this.width + this.margin.left + this.margin.right;
        this.canvasHeight = this.height + this.margin.top + this.margin.bottom;
        // if p5 instance exists, resize its canvas
        try {
            if (this.p5 && this.p5.resizeCanvas) {
                this.p5.resizeCanvas(this.canvasWidth, this.canvasHeight);
            }
        } catch (e) { console.warn('SketchManager.resize: failed to resize canvas', e); }
        this._computeLayout();
    };

    /**
     * Cleanly destroy the p5 instance and free references.
     */
    SketchManager.prototype.destroy = function () {
        try { this.p5 && this.p5.remove && this.p5.remove(); } catch (e) { }
        this.p5 = null;
    };

    // simple drawing routine, split into helpers for clarity
    SketchManager.prototype.draw = function (p) {
        // console.log('SketchManager.prototype.draw > activeIndex', this.state.activeIndex);
        var ai = this.state.activeIndex || 0;
        var progress = this.state.progress || 0;

        // Delegate grid rendering to GridRenderer if present, otherwise fall back
        try {
            if (window.GridRenderer && typeof window.GridRenderer.draw === 'function') {
                window.GridRenderer.draw(p, this, ai, progress);
                return;
            }
        } catch (e) { /* ignore and fall back to inline drawing below */ }

        // Fallback inline grid drawing (original behavior)
        p.fill(220);
        for (var i = 0, n = this.data.length; i < n; i++) {
            var d = this.data[i];
            p.rect(d.x, d.y, this.squareSize, this.squareSize);
        }

        if (ai >= 3) {
            p.fill(0, 150, 140);
            for (var fi = 0; fi < this._fillerIndices.length; fi++) {
                var idx = this._fillerIndices[fi];
                var wd = this.data[idx];
                p.rect(wd.x, wd.y, this.squareSize, this.squareSize);
            }
        }

        if (ai >= 4) {
            var totalFillers = this._totalFillers || 0;
            p.fill(0);
            p.textAlign(p.CENTER, p.CENTER);
            p.textSize(40);
            var cx = this.offsetX + this.width / 2;
            var cy = this.offsetY + this.height / 3;
            p.text(totalFillers, cx, cy);
            p.textSize(16);
            p.text('Filler Words', cx, cy + 40);
        }

        if (ai === 7) {
            var t = Math.max(0, Math.min(1, progress));
            for (var k = 0; k < this.data.length; k++) {
                var wd = this.data[k];
                if (wd.filler && wd.min >= 14) {
                    var r = Math.floor(0 + (255 - 0) * t);
                    var g = Math.floor(128 - (128 * t));
                    var b = Math.floor(120 - (120 * t));
                    p.fill(r, g, b);
                    p.rect(wd.x, wd.y, this.squareSize, this.squareSize);
                }
            }
        }
    };

    // create (or replace) singleton manager and expose API
    if (window.__sketchAPI && window.__sketchAPI.p5) {
        try { window.__sketchAPI.p5.remove(); } catch (e) { }
        window.__sketchAPI = null;
    }
    var manager = new SketchManager(rawData || []);
    var api = {
        setState: manager.setState.bind(manager),
        setData: manager.setData.bind(manager),
        resize: manager.resize.bind(manager),
        destroy: manager.destroy.bind(manager),
        p5: manager.p5,
        data: manager.data
    };
    window.__sketchAPI = api;
    return api;
}
