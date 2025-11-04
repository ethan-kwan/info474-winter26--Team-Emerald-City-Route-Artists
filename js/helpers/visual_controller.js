// visual_controller.js
// Controls when the visualization 'pops up' based on scroller active index.
// Emits CustomEvents 'visual:show' and 'visual:hide' on document for low coupling.
(function () {
    function VisualController(opts) {
        opts = opts || {};
        this.visEl = document.querySelector(opts.visSelector || '#vis');
        // predicate(activeIndex) -> boolean whether the visual should be visible
        // Use an explicit check for opts.showAt so a configured 0 is respected
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
        // Hook for future visual transitions; for now we only dispatch an event
        document.dispatchEvent(new CustomEvent('visual:progress', { detail: { index: index, progress: progress } }));
    };

    window.VisualController = VisualController;
})();
