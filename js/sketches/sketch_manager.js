function startP5() {
  var localRenderer;
  localRenderer = window.Renderer;

  function SketchManager() {
    this.margin = { top: 0, left: 0, bottom: 0, right: 0 };

    this.state = {
      activeIndex: 0,
      progress: 0,

      openViz: false,
      openVizFor: null,

      // NEW filters (Stop 1)
      filterYear: 'all',
      filterSeverity: 'all',
      filterMode: 'all',
      filterTime: 'all',

      affectYear: 'all',
      affectTime: 'all',
      affectMetric: 'percent',
      affectPinResetToken: 0,

      // pin reset token so filters can clear pinned tooltip
      pinResetToken: 0
    };

    this.data = {
      collisionsAll: [],
      bounds: null,
      loadError: null,
      hotspotAggCache: {}
    };

    this._computeSize = function () {
      var parent = document.getElementById('vis');
      var parentW = parent ? parent.clientWidth : window.innerWidth;

      var maxW = 1200;
      var w = Math.max(360, Math.min(maxW, parentW));
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

    if (s.openViz !== undefined) this.state.openViz = !!s.openViz;
    if (s.openVizFor !== undefined) this.state.openVizFor = s.openVizFor;

    if (s.filterYear !== undefined) this.state.filterYear = s.filterYear;
    if (s.filterSeverity !== undefined) this.state.filterSeverity = s.filterSeverity;
    if (s.filterMode !== undefined) this.state.filterMode = s.filterMode;
    if (s.filterTime !== undefined) this.state.filterTime = s.filterTime;

    if (s.pinResetToken !== undefined) this.state.pinResetToken = s.pinResetToken;

    if (s.affectYear !== undefined) this.state.affectYear = s.affectYear;
    if (s.affectTime !== undefined) this.state.affectTime = s.affectTime;
    if (s.affectMetric !== undefined) this.state.affectMetric = s.affectMetric;
    if (s.affectPinResetToken !== undefined) this.state.affectPinResetToken = s.affectPinResetToken;
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