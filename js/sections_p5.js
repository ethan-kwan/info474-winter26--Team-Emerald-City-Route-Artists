// sections_p5.js
// Loads data (TSV), initializes the p5 sketch, and implements scrolling logic without D3.

(function () {
    // Parse TSV simple implementation
    function parseTSV(text) {
        var lines = text.trim().split(/\r?\n/);
        if (lines.length === 0) return [];
        var header = lines[0].split('\t');
        var rows = lines.slice(1);
        return rows.map(function (line) {
            var parts = line.split('\t');
            // some words are quoted; remove surrounding quotes
            var word = (parts[0] || '').replace(/^"|"$/g, '');
            var time = parseFloat(parts[1]);
            var filler = parts[2] ? (parts[2].trim() === '1' || parts[2].trim() === 'true') : false;
            return { word: word, time: time, filler: filler, min: Math.floor(time / 60) };
        });
    }

    // Highlight steps and compute active index/progress
    function Scroller(containerSelector, stepSelector) {
        this.container = document.querySelector(containerSelector) || document.body;
        this.steps = Array.prototype.slice.call(document.querySelectorAll(stepSelector));
        this.sectionPositions = [];
        this.containerStart = 0;
        this.currentIndex = -1;
        this.onActive = function () { };
        this.onProgress = function () { };

        var self = this;
        this.resize = function () {
            self.sectionPositions = [];
            var startPos = null;
            self.steps.forEach(function (el, i) {
                var top = el.getBoundingClientRect().top + window.pageYOffset;
                if (i === 0) startPos = top;
                self.sectionPositions.push(top - startPos);
            });
            self.containerStart = (self.container.getBoundingClientRect().top + window.pageYOffset) || 0;
        };

        this.position = function () {
            var pos = window.pageYOffset - 10 - self.containerStart;
            // find sectionIndex similar to d3.bisect
            var sectionIndex = 0;
            for (var i = 0; i < self.sectionPositions.length; i++) {
                if (pos >= self.sectionPositions[i]) sectionIndex = i;
                else break;
            }
            sectionIndex = Math.min(self.sectionPositions.length - 1, sectionIndex);

            if (self.currentIndex !== sectionIndex) {
                self.currentIndex = sectionIndex;
                self.onActive(sectionIndex);
            }

            var prevIndex = Math.max(sectionIndex - 1, 0);
            var prevTop = self.sectionPositions[prevIndex];
            var denom = (self.sectionPositions[sectionIndex] - prevTop) || 1;
            var progress = (pos - prevTop) / denom;
            progress = Math.max(0, Math.min(1, progress));
            self.onProgress(sectionIndex, progress);
        };

        // bind events
        window.addEventListener('resize', this.resize);
        window.addEventListener('scroll', this.position);
        // initialize
        setTimeout(function () { self.resize(); self.position(); }, 50);
    }

    Scroller.prototype.on = function (action, cb) {
        if (action === 'active') this.onActive = cb;
        if (action === 'progress') this.onProgress = cb;
        return this;
    };

    // Load TSV and start sketch
    function displayData() {
        fetch('data/words.tsv')
            .then(function (r) { return r.text(); })
            .then(function (text) {
                var data = parseTSV(text);
                console.log('sections_p5: loaded data, rows=', data.length);

                // ensure basic p5 state exists
                window.p5State = window.p5State || { activeIndex: 0, progress: 0 };

                // Start p5 sketch with retries if startP5 isn't defined yet
                (function callStartP5WithRetry(attempts) {
                    attempts = typeof attempts === 'number' ? attempts : 3;
                    if (typeof startP5 === 'function') {
                        try {
                            console.log('sections_p5: calling startP5 (attempts left)', attempts);
                            var api = startP5(data);
                            // if the sketch returned an API, keep a reference to it
                            if (api && api.setState) {
                                window.__sketchAPI = api;
                            }
                            window.__sections_p5_startCalled = true;
                            console.log('sections_p5: startP5 invoked successfully');
                        } catch (err) {
                            console.error('sections_p5: startP5 threw an error', err);
                        }
                    } else if (attempts > 0) {
                        console.warn('sections_p5: startP5 not ready, retrying in 200ms (attempts left)', attempts);
                        setTimeout(function () { callStartP5WithRetry(attempts - 1); }, 200);
                    } else {
                        console.error('sections_p5: startP5 not available after retries — p5 visual will not start');
                    }
                })(3);

                // Setup scroller to update p5 state
                var sc = new Scroller('#graphic', '.step');
                console.log('sections_p5: scroller created, steps=', sc.steps.length);

                sc.on('active', function (index) {
                    // highlight steps
                    document.querySelectorAll('.step').forEach(function (el, i) {
                        el.style.opacity = (i === index) ? '1' : '0.1';
                    });

                    // prefer the returned sketch API, fallback to global p5State
                    if (window.__sketchAPI && window.__sketchAPI.setState) {
                        window.__sketchAPI.setState({ activeIndex: index });
                    } else {
                        window.p5State.activeIndex = index;
                    }
                });

                sc.on('progress', function (index, progress) {
                    if (window.__sketchAPI && window.__sketchAPI.setState) {
                        window.__sketchAPI.setState({ progress: progress });
                    } else {
                        window.p5State.progress = progress;
                    }
                });
            })
            .catch(function (err) {
                console.error('Failed to load data/words.tsv', err);
            });
    }

    // run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', displayData);
    } else {
        displayData();
    }
})();
