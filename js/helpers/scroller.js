// scroller.js
// Small Scroller abstraction (extracted from sections_p5.js) that computes
// active step index and progress and exposes a lightweight .on(action, cb)
(function () {
    function Scroller(containerSelector, stepSelector, trigger) {
        this.container = document.querySelector(containerSelector) || document.body;
        this.steps = Array.prototype.slice.call(document.querySelectorAll(stepSelector));
        // sectionPositions will store absolute page Y positions (window.pageYOffset + element top)
        this.sectionPositions = [];
        this.trigger = trigger || 'top'; // 'top' or 'center'
        this.currentIndex = -1;
        this.onActive = function () { };
        this.onProgress = function () { };

        var self = this;
        this.resize = function () {
            self.sectionPositions = [];
            self.steps.forEach(function (el) {
                // store absolute positions according to trigger type:
                // - 'center' -> element vertical center
                // - otherwise -> element top
                var rect = el.getBoundingClientRect();
                var top = rect.top + window.pageYOffset;
                if (self.trigger === 'center') {
                    var centerY = top + (rect.height / 2);
                    self.sectionPositions.push(centerY);
                } else {
                    self.sectionPositions.push(top);
                }
            });
        };

        this.position = function () {
            // Determine the Y coordinate (absolute page Y) at which we consider a step "active"
            var triggerY;
            if (self.trigger === 'center') {
                triggerY = window.pageYOffset + (window.innerHeight / 2);
            } else {
                // default to a small offset from top of viewport
                triggerY = window.pageYOffset + 10;
            }

            var sectionIndex = 0;
            for (var i = 0; i < self.sectionPositions.length; i++) {
                if (triggerY >= self.sectionPositions[i]) sectionIndex = i;
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
            var progress = (triggerY - prevTop) / denom;
            progress = Math.max(0, Math.min(1, progress));
            self.onProgress(sectionIndex, progress);
        };

        window.addEventListener('resize', this.resize);
        window.addEventListener('scroll', this.position);
        setTimeout(function () { self.resize(); self.position(); }, 50);
    }

    Scroller.prototype.on = function (action, cb) {
        if (action === 'active') this.onActive = cb;
        if (action === 'progress') this.onProgress = cb;
        return this;
    };

    window.Scroller = Scroller;
})();
