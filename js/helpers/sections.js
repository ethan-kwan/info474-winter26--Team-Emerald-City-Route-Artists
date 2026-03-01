// sections.js
// Orchestrator: loads data, starts the p5 sketch, and wires scroll -> visual state
(function () {
  function displayData() {
    var defaults = {
      containerSelector: '#graphic',
      stepSelector: '.step',
      visSelector: '#vis',
      showAt: 0,
      trigger: 'center',
      visHiddenClass: 'vis-hidden',
      visVisibleClass: 'vis-visible'
    };

    var cfg = Object.assign({}, defaults, window.ScrollDemoConfig || {});

    // Ensure the vis element starts hidden according to configured class
    try {
      var visStartEl = document.querySelector(cfg.visSelector);
      if (visStartEl && (cfg.showAt || 0) > 0) {
        visStartEl.classList.add(cfg.visHiddenClass);
      }
    } catch (e) { }

    (function callStartP5WithRetry(attempts) {
      attempts = typeof attempts === 'number' ? attempts : 3;

      if (typeof startP5 === 'function') {
        try {
          var api = startP5();

          if (api && api.ready && typeof api.ready.then === 'function') {
            api.ready.then(function () {
              try {
                if (api && api.setState) window.__sketchAPI = api;
              } catch (e) { }
            }).catch(function () {
              if (api && api.setState) window.__sketchAPI = api;
            });
          } else {
            if (api && api.setState) window.__sketchAPI = api;
          }

          var ScrollerCtor = window.Scroller;
          if (!ScrollerCtor) return;

          var sc = new ScrollerCtor(cfg.containerSelector, cfg.stepSelector, cfg.trigger);

          var VisualControllerCtor = window.VisualController;
          var visualController = null;
          if (VisualControllerCtor) {
            visualController = new VisualControllerCtor({ visSelector: cfg.visSelector, showAt: cfg.showAt });
          }

          sc.on('active', function (index) {
            // ONLY show the active step (no background steps)
            var stepEls = document.querySelectorAll(cfg.stepSelector);
            stepEls.forEach(function (el, i) {
              if (i === index) el.classList.add('is-active');
              else el.classList.remove('is-active');
            });

            var mappedIndex = index;
            try {
              var stepEl = (sc.steps && sc.steps[index]) ? sc.steps[index] : stepEls[index];
              if (stepEl && stepEl.dataset && stepEl.dataset.activeIndex !== undefined) {
                var parsed = parseInt(stepEl.dataset.activeIndex, 10);
                if (!isNaN(parsed)) mappedIndex = parsed;
              }
            } catch (e) { }

            if (window.__sketchAPI && window.__sketchAPI.setState) {
              window.__sketchAPI.setState({ activeIndex: mappedIndex });
            }

            if (visualController) visualController.handleActive(mappedIndex);
          });

          sc.on('progress', function (index, progress) {
            var mappedIndex = index;
            try {
              var stepEls = document.querySelectorAll(cfg.stepSelector);
              var stepEl = (sc.steps && sc.steps[index]) ? sc.steps[index] : stepEls[index];
              if (stepEl && stepEl.dataset && stepEl.dataset.activeIndex !== undefined) {
                var parsed = parseInt(stepEl.dataset.activeIndex, 10);
                if (!isNaN(parsed)) mappedIndex = parsed;
              }
            } catch (e) { }

            if (window.__sketchAPI && window.__sketchAPI.setState) {
              window.__sketchAPI.setState({ progress: progress, activeIndex: mappedIndex });
            }

            if (visualController) visualController.handleProgress(mappedIndex, progress);
          });

        } catch (err) {
          console.error('sections: startP5 threw an error', err);
        }
      } else if (attempts > 0) {
        setTimeout(function () { callStartP5WithRetry(attempts - 1); }, 200);
      }
    })(3);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', displayData);
  } else {
    displayData();
  }
})();