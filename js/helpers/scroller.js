(function () {
  function Scroller(containerSelector, stepSelector, trigger) {
    this.container = document.querySelector(containerSelector) || document.body;
    this.steps = Array.prototype.slice.call(document.querySelectorAll(stepSelector));
    this.sectionPositions = [];
    this.sectionHeights = [];
    this.trigger = trigger || 'top';
    this.currentIndex = -1;
    this.onActive = function () { };
    this.onProgress = function () { };
    this.displayProgress = 0;
    
    var self = this;

    this.resize = function () {
      self.sectionPositions = [];
      self.sectionHeights = [];

      self.steps.forEach(function (el) {
        var rect = el.getBoundingClientRect();
        var top = rect.top + window.pageYOffset;
        var height = Math.max(1, rect.height);

        self.sectionPositions.push(top);
        self.sectionHeights.push(height);
      });

    };

    this.position = function () {
      var viewportAnchor = window.innerHeight * 0.52;
      var triggerY = window.pageYOffset + viewportAnchor;

      var sectionIndex = 0;

      // Activate a section once the viewport anchor has reached that section's top.
      for (var i = 0; i < self.sectionPositions.length; i++) {
        if (triggerY >= self.sectionPositions[i]) sectionIndex = i;
        else break;
      }

      sectionIndex = Math.max(0, Math.min(self.steps.length - 1, sectionIndex));

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
