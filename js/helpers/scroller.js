// scroller.js
(function () {
  function Scroller(containerSelector, stepSelector, trigger) {
    this.container = document.querySelector(containerSelector) || document.body;
    this.steps = Array.prototype.slice.call(document.querySelectorAll(stepSelector));
    this.sectionPositions = [];
    this.trigger = trigger || 'top';
    this.currentIndex = -1;
    this.onActive = function () { };
    this.onProgress = function () { };

    var self = this;

    this.resize = function () {
      self.sectionPositions = [];
      self.steps.forEach(function (el) {
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
      var triggerY;
      if (self.trigger === 'center') {
        triggerY = window.pageYOffset + (window.innerHeight / 2);
      } else {
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

      var elem = self.steps[sectionIndex];
      var rect = elem.getBoundingClientRect();
      var elemTop = rect.top + window.pageYOffset;
      var elemHeight = rect.height || 1;
      var rawSectionProgress = (triggerY - elemTop) / elemHeight;
      var progress = Math.max(0, Math.min(1, rawSectionProgress));
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