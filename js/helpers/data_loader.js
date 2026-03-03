// data_loader.js
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

  // ✅ IMPORTANT: do NOT use fallback||0 (NaN would turn into 0)
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

  // ✅ Extract a real year from "1/1/2025" or any string containing 4 digits
  function extractYear(v) {
    var s = (v === null || v === undefined) ? '' : String(v);
    var m = s.match(/(\d{4})/);
    return m ? parseInt(m[1], 10) : null;
  }

  window.DataLoader = {
    loadCSVPick: loadCSVPick
  };

  // Collisions normalize for Stop 1
  window.DataLoader.preprocessCollisions = function (rows) {
    rows = rows || [];
    var out = [];

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i] || {};

      var x = toFloat(r.x, NaN);
      var y = toFloat(r.y, NaN);
      if (isNaN(x) || isNaN(y)) continue;

      var yr = extractYear(r.Year); // <-- FIXED
      var hr = toInt(r.Hour, null);

      out.push({
        x: x,
        y: y,
        year: yr,
        hour: hr,

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