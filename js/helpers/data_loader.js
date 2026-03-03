// data_loader.js
// Fetch + parse utilities.
// Exposes:
// - DataLoader.loadTSV(url)
// - DataLoader.loadCSVPick(url, pickCols)  // faster: only keeps selected columns
// - DataLoader.preprocessCollisions(rows)

(function () {
  function parseTSV(text) {
    var lines = (text || '').trim().split(/\r?\n/);
    if (!lines || lines.length === 0) return [];
    var rows = lines.slice(1);
    return rows.map(function (line) {
      var parts = line.split('\t');
      var word = (parts[0] || '').replace(/^"|"$/g, '');
      var time = parseFloat(parts[1]);
      var filler = parts[2] ? (parts[2].trim() === '1' || parts[2].trim() === 'true') : false;
      return { word: word, time: time, filler: filler, min: Math.floor(time / 60) };
    });
  }

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
    // If you open index.html as file://, fetch will fail.
    if (window.location && window.location.protocol === 'file:') {
      return Promise.reject(new Error(
        "You're opening the page as file://. Run a local server (VSCode Live Server or `python3 -m http.server`) so fetch() can read CSVs."
      ));
    }

    return fetch(url).then(function (r) {
      return r.text();
    });
  }

  function loadTSV(url) {
    return loadText(url).then(function (text) {
      return parseTSV(text);
    });
  }

  // Fast CSV picker: only returns an array of objects with the requested columns.
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

  window.DataLoader = {
    parseTSV: parseTSV,
    loadTSV: loadTSV,
    loadCSVPick: loadCSVPick
  };

  // Collisions normalize (Stop 1 needs only gridX/gridY and crosswalk_count)
  window.DataLoader.preprocessCollisions = function (rows) {
    rows = rows || [];
    var out = [];

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i] || {};

      var gx = parseInt(r.gridX, 10);
      var gy = parseInt(r.gridY, 10);
      if (isNaN(gx) || isNaN(gy)) continue;

      var cw = 0;
      if (r.crosswalk_count !== undefined && r.crosswalk_count !== '') {
        cw = parseInt(r.crosswalk_count, 10);
        if (isNaN(cw)) cw = 0;
      }

      out.push({ gridX: gx, gridY: gy, crosswalk_count: cw });
    }

    return out;
  };
})();