// sketch_manager.js

function startP5(rawData) {

    // --- Sketch manager ----------------------------------------------------
    function SketchManager() {
        // core layout settings (canvas size only)
        this.width = 600; // content width (matches original SVG content)
        this.height = 520; // content height
        this.margin = { top: 0, left: 80, bottom: 40, right: 10 };
        this.canvasWidth = this.width + this.margin.left + this.margin.right;
        this.canvasHeight = this.height + this.margin.top + this.margin.bottom;

        // drawing state
        this.state = { activeIndex: 0, progress: 0 };

    // data will be attached by Renderer.setData(manager, data)
    this.data = [];

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


    // set visualization state (called by scroll logic)
    SketchManager.prototype.setState = function (s) {
        if (s.activeIndex !== undefined) this.state.activeIndex = s.activeIndex;
        if (s.progress !== undefined) this.state.progress = s.progress;
    };

    // delegate data handling to Renderer
    SketchManager.prototype.setData = function (newData) {
        if (!window.Renderer || typeof window.Renderer.setData !== 'function') {
            throw new Error('Renderer.setData(manager, data) is required but not found. Ensure js/sketches/sketch_grid.js is loaded before sketch_manager.js.');
        }
        return window.Renderer.setData(this, newData);
    };

    // simple drawing routine, split into helpers for clarity
    SketchManager.prototype.draw = function (p) {
        var ai = this.state.activeIndex || 0;
        var progress = this.state.progress || 0;

        // Require Renderer to be present. Fail fast if missing so missing
        // modules are obvious during development.
        if (!window.Renderer || typeof window.Renderer.draw !== 'function') {
            throw new Error('Renderer.draw is required but not found. Ensure js/sketches/sketch_grid.js is loaded before sketch_manager.js.');
        }

        window.Renderer.draw(p, this, ai, progress);
    };

    // create (or replace) singleton manager and expose API
    if (window.__sketchAPI && window.__sketchAPI.p5) {
        try { window.__sketchAPI.p5.remove(); } catch (e) { }
        window.__sketchAPI = null;
    }
    var manager = new SketchManager();
    // initialize data via Renderer (fail fast if missing)
    if (!window.Renderer || typeof window.Renderer.setData !== 'function') {
        throw new Error('Renderer.setData is required at startup. Ensure js/sketches/sketch_grid.js is loaded before sketch_manager.js.');
    }
    var setDataResult = window.Renderer.setData(manager, rawData || []);

    var api = {
        setState: manager.setState.bind(manager),
        setData: manager.setData.bind(manager),
        p5: manager.p5,
        data: manager.data
    };

    // Expose a `ready` promise so callers can wait until data/layout are ready.
    if (setDataResult && typeof setDataResult.then === 'function') {
        api.ready = setDataResult.then(function () { return api; });
    } else {
        api.ready = Promise.resolve(api);
    }

    // Expose the API globally once ready so consumers (like sections) see
    // the populated data without racing the async load.
    api.ready.then(function () {
        try { window.__sketchAPI = api; } catch (e) { }
    }).catch(function () {
        try { window.__sketchAPI = api; } catch (e) { }
    });

    return api;
}
