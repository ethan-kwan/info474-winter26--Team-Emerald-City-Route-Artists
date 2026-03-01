// sketch_manager.js
function startP5() {

  var localRenderer;
  localRenderer = window.Renderer;

  function SketchManager() {
    // No margins anymore (full canvas)
    this.margin = { top: 0, left: 0, bottom: 0, right: 0 };

    // drawing state
    this.state = { activeIndex: 0, progress: 0 };

    // data placeholder
    this.data = [];

    // compute size from the #vis container + viewport
    this._computeSize = function () {
      var parent = document.getElementById('vis');
      var parentW = parent ? parent.clientWidth : window.innerWidth;

      // big canvas, but don’t go insane on ultra-wide screens
      var maxW = 1200;
      var w = Math.max(360, Math.min(maxW, parentW));

      // tall enough to feel like a “map”
      var h = Math.max(560, Math.floor(window.innerHeight * 0.88));

      this.width = w;
      this.height = h;
      this.canvasWidth = w;
      this.canvasHeight = h;

      this.offsetX = 0;
      this.offsetY = 0;
    };

    this._computeSize();

    var self = this;
    var sketch = function (p) {
      p.setup = function () {
        var parent = document.getElementById('vis');
        if (parent) parent.innerHTML = '';

        self._computeSize();
        p.createCanvas(self.canvasWidth, self.canvasHeight).parent('vis');
        p.noStroke();
        p.frameRate(30);
      };

      p.draw = function () {
        self.draw(p);
      };

      p.windowResized = function () {
        self._computeSize();
        p.resizeCanvas(self.canvasWidth, self.canvasHeight);
      };
    };

    this.p5 = new p5(sketch);
  }

  SketchManager.prototype.setState = function (s) {
    if (s.activeIndex !== undefined) this.state.activeIndex = s.activeIndex;
    if (s.progress !== undefined) this.state.progress = s.progress;
  };

  SketchManager.prototype.setData = function (newData) {
    return localRenderer.setData(this, newData);
  };

  SketchManager.prototype.draw = function (p) {
    p.background(255);
    var ai = this.state.activeIndex || 0;
    var progress = this.state.progress || 0;
    localRenderer.draw(p, this, ai, progress);
  };

  if (window.__sketchAPI && window.__sketchAPI.p5) {
    try { window.__sketchAPI.p5.remove(); } catch (e) { }
    window.__sketchAPI = null;
  }

  var manager = new SketchManager();

  if (!localRenderer || typeof localRenderer.setData !== 'function') {
    throw new Error('localRenderer.setData is required at startup.');
  }

  var setDataResult = localRenderer.setData(manager);

  var api = {
    setState: manager.setState.bind(manager),
    setData: manager.setData.bind(manager),
    p5: manager.p5,
    data: manager.data
  };

  if (setDataResult && typeof setDataResult.then === 'function') {
    api.ready = setDataResult.then(function () { return api; });
  } else {
    api.ready = Promise.resolve(api);
  }

  api.ready.then(function () {
    try { window.__sketchAPI = api; } catch (e) { }
  }).catch(function () {
    try { window.__sketchAPI = api; } catch (e) { }
  });

  return api;
}