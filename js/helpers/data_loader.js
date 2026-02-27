// data_loader.js
// Simple data loading and TSV parsing module. Exposes DataLoader.loadTSV(url)
(function () {
    function parseTSV(text) {
        var lines = (text || '').trim().split(/\r?\n/);
        if (!lines || lines.length === 0) return [];
        var header = lines[0].split('\t');
        var rows = lines.slice(1);
        return rows.map(function (line) {
            var parts = line.split('\t');
            var word = (parts[0] || '').replace(/^"|"$/g, '');
            var time = parseFloat(parts[1]);
            var filler = parts[2] ? (parts[2].trim() === '1' || parts[2].trim() === 'true') : false;
            return { word: word, time: time, filler: filler, min: Math.floor(time / 60) };
        });
    }

    function loadTSV(url) {
        return fetch(url).then(function (r) { return r.text(); }).then(function (text) {
            return parseTSV(text);
        });
    }

    window.DataLoader = {
        parseTSV: parseTSV,
        loadTSV: loadTSV
    };

    // Shared preprocess helper: normalize rows into the shape sketches expect.
    // Accepts an array of objects {word, time, filler, min} (as returned by parseTSV)
    // and returns an array with guaranteed types and an index property.
    window.DataLoader.preprocess = function (data) {
        data = data || [];
        return data.map(function (d, i) {
            return {
                word: (d.word || '').replace(/^"|"$/g, ''),
                filler: !!d.filler,
                time: +d.time || 0,
                min: (typeof d.min === 'number') ? d.min : Math.floor((+d.time || 0) / 60),
                index: i
            };
        });
    };

    // Parse CSV with quoted fields (handles commas inside quotes)
    function parseCSV(text) {
        var lines = (text || '').trim().split(/\r?\n/);
        if (!lines || lines.length === 0) return { header: [], rows: [] };
        var header = parseCSVLine(lines[0]);
        var rows = lines.slice(1).map(function (line) {
            var values = parseCSVLine(line);
            var obj = {};
            header.forEach(function (key, i) {
                obj[key] = values[i] !== undefined ? values[i] : '';
            });
            return obj;
        });
        return { header: header, rows: rows };
    }

    function parseCSVLine(line) {
        var out = [];
        var i = 0;
        while (i < line.length) {
            if (line[i] === '"') {
                i += 1;
                var end = line.indexOf('"', i);
                if (end === -1) end = line.length;
                out.push(line.slice(i, end).replace(/""/g, '"'));
                i = end + 1;
                if (line[i] === ',') i += 1;
            } else {
                var comma = line.indexOf(',', i);
                if (comma === -1) {
                    out.push(line.slice(i).trim());
                    break;
                }
                out.push(line.slice(i, comma).trim());
                i = comma + 1;
            }
        }
        return out;
    }

    function loadCSV(url) {
        return fetch(url).then(function (r) { return r.text(); }).then(function (text) {
            return parseCSV(text);
        });
    }

    window.DataLoader.parseCSV = parseCSV;
    window.DataLoader.loadCSV = loadCSV;
})();
