/* =========================================
   js/helpers/visual_controller.js
   ========================================= */
(function () {
  function VisualController(opts) {
    opts = opts || {};
    this.visEl = document.querySelector(opts.visSelector || '#vis');
    var showAtVal = (typeof opts.showAt === 'number') ? opts.showAt : 2;
    this.predicate = opts.predicate || function (i) { return i >= showAtVal; };
    this._visible = false;
  }

  VisualController.prototype._setVisible = function (visible, detail) {
    if (!this.visEl) return;
    if (visible) {
      this.visEl.classList.remove('vis-hidden');
      this.visEl.classList.add('vis-visible');
      if (!this._visible) document.dispatchEvent(new CustomEvent('visual:show', { detail: detail || {} }));
    } else {
      this.visEl.classList.remove('vis-visible');
      this.visEl.classList.add('vis-hidden');
      if (this._visible) document.dispatchEvent(new CustomEvent('visual:hide', { detail: detail || {} }));
    }
    this._visible = !!visible;
  };

  VisualController.prototype.handleActive = function (activeIndex) {
    var shouldShow = false;
    try { shouldShow = !!this.predicate(activeIndex); } catch (e) { shouldShow = false; }
    this._setVisible(shouldShow, { index: activeIndex });
  };

  VisualController.prototype.handleProgress = function (index, progress) {
    document.dispatchEvent(new CustomEvent('visual:progress', { detail: { index: index, progress: progress } }));
  };

  window.VisualController = VisualController;
})();