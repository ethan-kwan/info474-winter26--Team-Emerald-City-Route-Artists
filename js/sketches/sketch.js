// sketch.js
// p5 sketch to render the words grid and respond to scroll-driven state
// Exposes startP5(rawData) which initializes the sketch using the data

// Window-level state that other scripts (sections.js) will update
window.p5State = {
    activeIndex: 0,
    progress: 0
};

function startP5(rawData) {
    // Simple module wrapper that returns a small API for controlling the sketch.

    // --- Data preprocessing -------------------------------------------------
    var preprocess = window.DataLoader.preprocess;

    // --- Sketch manager ----------------------------------------------------
    function SketchManager(data) {
        // core layout settings (easy to tweak)
        this.data = preprocess(data);
        this.width = 600; // content width (matches original SVG content)
        this.height = 520; // content height
        this.margin = { top: 0, left: 80, bottom: 40, right: 10 };
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
        var ai = this.state.activeIndex || 0;
        var progress = this.state.progress || 0;

        // Require GridRenderer to be present. Fail fast if missing so missing
        // modules are obvious during development.
        if (!window.GridRenderer || typeof window.GridRenderer.draw !== 'function') {
            throw new Error('GridRenderer.draw is required but not found. Ensure js/sketches/sketch_grid.js is loaded before sketch.js.');
        }

        window.GridRenderer.draw(p, this, ai, progress);
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
