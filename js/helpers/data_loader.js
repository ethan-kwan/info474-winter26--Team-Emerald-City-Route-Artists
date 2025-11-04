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
})();
