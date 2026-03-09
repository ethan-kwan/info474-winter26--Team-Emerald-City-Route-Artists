(function () {
  function Scroller(containerSelector, stepSelector, trigger) {
    this.container = document.querySelector(containerSelector) || document.body;
    this.steps = Array.prototype.slice.call(document.querySelectorAll(stepSelector));
    this.sectionPositions = [];
    this.sectionHeights = [];
    this.sectionBoundaries = [];
    this.trigger = trigger || 'top';
    this.currentIndex = -1;
    this.onActive = function () { };
    this.onProgress = function () { };
    this.displayProgress = 0;
    
    var self = this;

    this.resize = function () {
      self.sectionPositions = [];
      self.sectionHeights = [];
      self.sectionBoundaries = [];

      self.steps.forEach(function (el) {
        var rect = el.getBoundingClientRect();
        var top = rect.top + window.pageYOffset;
        var height = Math.max(1, rect.height);

        self.sectionPositions.push(top);
        self.sectionHeights.push(height);
      });

      for (var i = 0; i < self.sectionPositions.length - 1; i++) {
        var currentTop = self.sectionPositions[i];
        var nextTop = self.sectionPositions[i + 1];
        self.sectionBoundaries.push((currentTop + nextTop) / 2);
      }
    };

    this.position = function () {
      var viewportAnchor = window.innerHeight * 0.52;
      var triggerY = window.pageYOffset + viewportAnchor;

      var sectionIndex = 0;

      for (var i = 0; i < self.sectionBoundaries.length; i++) {
        if (triggerY >= self.sectionBoundaries[i]) {
          sectionIndex = i + 1;
        } else {
          break;
        }
      }

      sectionIndex = Math.max(0, Math.min(self.steps.length - 1, sectionIndex));

      /* Stronger hysteresis so tiny scrolls do not immediately swap stops */
      if (self.currentIndex !== -1 && sectionIndex !== self.currentIndex) {
        var movingForward = sectionIndex > self.currentIndex;
        var buffer = 160;

        if (movingForward) {
          var forwardBoundary = self.sectionBoundaries[self.currentIndex];
          if (
            forwardBoundary !== undefined &&
            triggerY < forwardBoundary + buffer
          ) {
            sectionIndex = self.currentIndex;
          }
        } else {
          var backwardBoundary = self.sectionBoundaries[sectionIndex];
          if (
            backwardBoundary !== undefined &&
            triggerY > backwardBoundary - buffer
          ) {
            sectionIndex = self.currentIndex;
          }
        }
      }

      if (self.currentIndex !== sectionIndex) {
        self.currentIndex = sectionIndex;
        self.onActive(sectionIndex);
      }

      var elemTop = self.sectionPositions[sectionIndex];
      var elemHeight = self.sectionHeights[sectionIndex] || 1;

      var progressStart = elemTop + window.innerHeight * 0.18;
      var progressEnd = elemTop + elemHeight - window.innerHeight * 0.22;
      var rawSectionProgress = (triggerY - progressStart) / Math.max(1, progressEnd - progressStart);
      var progress = Math.max(0, Math.min(1, rawSectionProgress));

      self.onProgress(sectionIndex, progress);
    };

    window.addEventListener('resize', this.resize);
    window.addEventListener('scroll', this.position);

    setTimeout(function () {
      self.resize();
      self.position();
    }, 50);
  }

  Scroller.prototype.on = function (action, cb) {
    if (action === 'active') this.onActive = cb;
    if (action === 'progress') this.onProgress = cb;
    return this;
  };

  window.Scroller = Scroller;
})();