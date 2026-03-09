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