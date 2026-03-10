/* =========================================
   js/helpers/data_loader.js
   ========================================= */
(function () {
  function splitCSVLine(line) {
    var res = [];
    var cur = '';
    var inQuotes = false;

    for (var i = 0; i < line.length; i++) {
      var ch = line[i];

      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        res.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    res.push(cur);
    return res;
  }

  function loadText(url) {
    if (window.location && window.location.protocol === 'file:') {
      return Promise.reject(new Error(
        "You're opening the page as file://. Run a local server (VSCode Live Server or `python3 -m http.server`) so fetch() can read CSVs."
      ));
    }
    return fetch(url).then(function (r) { return r.text(); });
  }

  function parseCSVPick(text, pickCols) {
    text = (text || '').replace(/\r/g, '');
    var lines = text.split('\n').filter(function (l) { return l.trim().length > 0; });
    if (!lines.length) return [];

    var header = splitCSVLine(lines[0]).map(function (h) { return (h || '').trim(); });

    var idx = {};
    for (var i = 0; i < pickCols.length; i++) {
      idx[pickCols[i]] = header.indexOf(pickCols[i]);
    }

    var out = [];
    for (var r = 1; r < lines.length; r++) {
      var parts = splitCSVLine(lines[r]);
      var obj = {};
      for (var c = 0; c < pickCols.length; c++) {
        var col = pickCols[c];
        var j = idx[col];
        obj[col] = (j >= 0 && parts[j] !== undefined) ? parts[j] : '';
      }
      out.push(obj);
    }

    return out;
  }

  function loadCSVPick(url, pickCols) {
    return loadText(url).then(function (text) {
      return parseCSVPick(text, pickCols || []);
    });
  }

  function toInt(v, fallback) {
    var n = parseInt(v, 10);
    return isNaN(n) ? fallback : n;
  }

  function toFloat(v, fallback) {
    var n = parseFloat(v);
    return isNaN(n) ? fallback : n;
  }

  function truthy(v) {
    var s = (v === null || v === undefined) ? '' : String(v).trim().toLowerCase();
    return (s === 'y' || s === 'yes' || s === '1' || s === 'true' || s === 't');
  }

  function extractYear(v) {
    var s = (v === null || v === undefined) ? '' : String(v);
    var m = s.match(/(\d{4})/);
    return m ? parseInt(m[1], 10) : null;
  }

  function parseDowFromUSDateTime(v) {
    var s = (v === null || v === undefined) ? '' : String(v).trim();
    if (!s) return null;

    var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i);
    if (!m) return null;

    var month = parseInt(m[1], 10) - 1;
    var day = parseInt(m[2], 10);
    var year = parseInt(m[3], 10);

    var hour = (m[4] !== undefined && m[4] !== null && m[4] !== '') ? parseInt(m[4], 10) : 0;
    var min = (m[5] !== undefined && m[5] !== null && m[5] !== '') ? parseInt(m[5], 10) : 0;
    var sec = (m[6] !== undefined && m[6] !== null && m[6] !== '') ? parseInt(m[6], 10) : 0;
    var ampm = (m[7] || '').toUpperCase();

    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;

    var dt = new Date(year, month, day, hour, min, sec);
    if (!dt || isNaN(dt.getTime())) return null;
    return dt.getDay();
  }

  window.DataLoader = {
    loadCSVPick: loadCSVPick
  };

  window.DataLoader.preprocessCollisions = function (rows) {
    rows = rows || [];
    var out = [];

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i] || {};

      var x = toFloat(r.x, NaN);
      var y = toFloat(r.y, NaN);
      if (isNaN(x) || isNaN(y)) continue;

      var yr = extractYear(r.Year); 
      var hr = toInt(r.Hour, null);
      var dow = parseDowFromUSDateTime(r.INCDTTM);

      out.push({
        x: x,
        y: y,
        year: yr,
        hour: hr,
        dow: dow,

        weather: (r.WEATHER || '').trim(),
        roadcond: (r.ROADCOND || '').trim(),
        lightcond: (r.LIGHTCOND || '').trim(),

        location: (r.LOCATION || '').trim(),
        collisionType: (r.COLLISIONTYPE || '').trim(),
        severity: (r.SEVERITYDESC || '').trim(),

        injuries: toInt(r.INJURIES, 0),
        serious: toInt(r.SERIOUSINJURIES, 0),
        fatalities: toInt(r.FATALITIES, 0),

        isPed: truthy(r.IsPedCrash),
        isBike: truthy(r.IsBikeCrash),

        speeding: truthy(r.SPEEDING),
        inattn: truthy(r.INATTENTIONIND),
        underinfl: truthy(r.UNDERINFL),

        crosswalk_count: toInt(r.crosswalk_count, 0)
      });
    }

    return out;
  };
})();

// Sketch Manager.js
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

      // Stop 1
      filterYear: 'all',
      filterSeverity: 'all',
      filterMode: 'all',
      filterTime: 'all',
      searchStreet: '', // <--- NEW STATE ADDED HERE
      pinResetToken: 0,

      // Stop 2
      driverYear: 'all',
      driverMode: 'all',
      driverTime: 'all',
      driverScope: 'all',
      driverFactor: 'weather',

      // Stop 3
      affectYear: 'all',
      affectTime: 'all',
      affectMetric: 'percent',
      affectPinResetToken: 0
    };

    this.data = {
      collisionsAll: [],
      bounds: null,
      loadError: null,
      hotspotAggCache: {},
      affectedCache: {},
      driversCache: {}
    };

    this._computeSize = function () {
      var canvasHost = document.getElementById('vis-canvas');
      var hostW = canvasHost ? canvasHost.clientWidth : window.innerWidth;
      var hostH = canvasHost ? canvasHost.clientHeight : window.innerHeight;

      var w = Math.max(360, hostW);
      var h = Math.max(560, hostH);

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
        var canvasHost = document.getElementById('vis-canvas');

        if (canvasHost) {
          canvasHost.innerHTML = '';
        }

        self._computeSize();
        p.createCanvas(self.canvasWidth, self.canvasHeight).parent('vis-canvas');
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

    // Stop 1
    if (s.filterYear !== undefined) this.state.filterYear = s.filterYear;
    if (s.filterSeverity !== undefined) this.state.filterSeverity = s.filterSeverity;
    if (s.filterMode !== undefined) this.state.filterMode = s.filterMode;
    if (s.filterTime !== undefined) this.state.filterTime = s.filterTime;
    if (s.searchStreet !== undefined) this.state.searchStreet = s.searchStreet; // <--- UPDATE HANDLER ADDED HERE
    if (s.pinResetToken !== undefined) this.state.pinResetToken = s.pinResetToken;

    // Stop 2
    if (s.driverYear !== undefined) this.state.driverYear = s.driverYear;
    if (s.driverMode !== undefined) this.state.driverMode = s.driverMode;
    if (s.driverTime !== undefined) this.state.driverTime = s.driverTime;
    if (s.driverScope !== undefined) this.state.driverScope = s.driverScope;
    if (s.driverFactor !== undefined) this.state.driverFactor = s.driverFactor;

    // Stop 3
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
    try {
      window.__sketchAPI.p5.remove();
    } catch (e) {}
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
    api.ready = setDataResult.then(function () {
      return api;
    });
  } else {
    api.ready = Promise.resolve(api);
  }

  api.ready
    .then(function () {
      try {
        window.__sketchAPI = api;
      } catch (e) {}
    })
    .catch(function () {
      try {
        window.__sketchAPI = api;
      } catch (e) {}
    });

  return api;
}