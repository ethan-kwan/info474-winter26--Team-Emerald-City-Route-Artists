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

    // UI state for "open visualization"
    window.__vizUI = { open: false, stop: null };
    window.__activeStop = 0;

    // ----------------------------
    // Stop 1 filter state
    // ----------------------------
    window.__vizFilters = {
      year: 'all',
      severity: 'all',
      mode: 'all',
      time: 'all',
      pinResetToken: 0
    };

    // ----------------------------
    // ✅ Stop 2 filter state (drivers)
    // ----------------------------
    window.__driverFilters = {
      factor: 'weather',
      year: 'all',
      mode: 'all',
      time: 'all',
      scope: 'all' // all | severe
    };

    // ----------------------------
    // Stop 3 filter state
    // ----------------------------
    window.__affectFilters = {
      year: 'all',
      time: 'all',
      metric: 'percent',
      pinResetToken: 0
    };

    function updateToggleButtons() {
      var btns = document.querySelectorAll('[data-viz-toggle]');
      btns.forEach(function (btn) {
        var stop = parseInt(btn.getAttribute('data-viz-toggle'), 10);
        var isOpen = window.__vizUI.open && window.__vizUI.stop === stop;

        btn.textContent = isOpen ? 'Back to route' : 'Open visualization';
        btn.classList.toggle('is-open', isOpen);
      });
    }

    function pushStop1FiltersToSketch() {
      if (window.__sketchAPI && window.__sketchAPI.setState) {
        window.__sketchAPI.setState({
          filterYear: window.__vizFilters.year,
          filterSeverity: window.__vizFilters.severity,
          filterMode: window.__vizFilters.mode,
          filterTime: window.__vizFilters.time,
          pinResetToken: window.__vizFilters.pinResetToken
        });
      }
    }

    // ✅ Stop 2 → sketch state
    function pushStop2FiltersToSketch() {
      if (window.__sketchAPI && window.__sketchAPI.setState) {
        window.__sketchAPI.setState({
          driverYear: window.__driverFilters.year,
          driverMode: window.__driverFilters.mode,
          driverTime: window.__driverFilters.time,
          driverScope: window.__driverFilters.scope,
          driverFactor: window.__driverFilters.factor
        });
      }
    }

    function pushStop3FiltersToSketch() {
      if (window.__sketchAPI && window.__sketchAPI.setState) {
        window.__sketchAPI.setState({
          affectYear: window.__affectFilters.year,
          affectTime: window.__affectFilters.time,
          affectMetric: window.__affectFilters.metric,
          affectPinResetToken: window.__affectFilters.pinResetToken
        });
      }
    }

    function pushAllFiltersToSketch() {
      pushStop1FiltersToSketch();
      pushStop2FiltersToSketch(); // ✅ NEW
      pushStop3FiltersToSketch();
    }

    function setVizOpen(open, stop) {
      window.__vizUI.open = !!open;
      window.__vizUI.stop = open ? stop : null;

      // body classes (controls visibility)
      document.body.classList.toggle('viz-open-stop1', window.__vizUI.open && window.__vizUI.stop === 1);
      document.body.classList.toggle('viz-open-stop2', window.__vizUI.open && window.__vizUI.stop === 2); // ✅ NEW
      document.body.classList.toggle('viz-open-stop3', window.__vizUI.open && window.__vizUI.stop === 3);

      if (window.__sketchAPI && window.__sketchAPI.setState) {
        window.__sketchAPI.setState({
          openViz: window.__vizUI.open,
          openVizFor: window.__vizUI.stop
        });
      }

      updateToggleButtons();
      pushAllFiltersToSketch();
    }

    // ----------------------------
    // Stop 1 controls
    // ----------------------------
    function readStop1Controls() {
      var yearEl = document.getElementById('filter-year');
      var sevEl = document.getElementById('filter-severity');
      var modeEl = document.getElementById('filter-mode');
      var timeEl = document.getElementById('filter-time');

      if (yearEl) window.__vizFilters.year = yearEl.value || 'all';
      if (sevEl) window.__vizFilters.severity = sevEl.value || 'all';
      if (modeEl) window.__vizFilters.mode = modeEl.value || 'all';
      if (timeEl) window.__vizFilters.time = timeEl.value || 'all';
    }

    function wireStop1Controls() {
      var container = document.getElementById('viz-controls-stop1');
      if (!container) return;

      container.addEventListener('change', function () {
        readStop1Controls();
        window.__vizFilters.pinResetToken += 1; // clear pinned tooltip
        pushStop1FiltersToSketch();
      });

      readStop1Controls();
      pushStop1FiltersToSketch();
    }

    // ----------------------------
    // ✅ Stop 2 controls
    // ----------------------------
    function readStop2Controls() {
      var yearEl = document.getElementById('driver-year');
      var modeEl = document.getElementById('driver-mode');
      var timeEl = document.getElementById('driver-time');
      var scopeEl = document.getElementById('driver-scope');
      var factorEl = document.getElementById('driver-factor');
    
      if (factorEl) window.__driverFilters.factor = factorEl.value || 'weather';
      if (yearEl) window.__driverFilters.year = yearEl.value || 'all';
      if (modeEl) window.__driverFilters.mode = modeEl.value || 'all';
      if (timeEl) window.__driverFilters.time = timeEl.value || 'all';
      if (scopeEl) window.__driverFilters.scope = scopeEl.value || 'all';
    }

    function wireStop2Controls() {
      var container = document.getElementById('viz-controls-stop2');
      if (!container) return;

      container.addEventListener('change', function () {
        readStop2Controls();
        pushStop2FiltersToSketch();
      });

      readStop2Controls();
      pushStop2FiltersToSketch();
    }

    // ----------------------------
    // Stop 3 controls
    // ----------------------------
    function readStop3Controls() {
      var yearEl = document.getElementById('affect-year');
      var timeEl = document.getElementById('affect-time');
      var metricEl = document.getElementById('affect-metric');

      if (yearEl) window.__affectFilters.year = yearEl.value || 'all';
      if (timeEl) window.__affectFilters.time = timeEl.value || 'all';
      if (metricEl) window.__affectFilters.metric = metricEl.value || 'percent';
    }

    function wireStop3Controls() {
      var container = document.getElementById('viz-controls-stop3');
      if (!container) return;

      container.addEventListener('change', function () {
        readStop3Controls();
        window.__affectFilters.pinResetToken += 1; // clear pinned tooltip
        pushStop3FiltersToSketch();
      });

      readStop3Controls();
      pushStop3FiltersToSketch();
    }

    // Hide canvas until showAt
    try {
      var visStartEl = document.querySelector(cfg.visSelector);
      if (visStartEl && (cfg.showAt || 0) > 0) {
        visStartEl.classList.add(cfg.visHiddenClass);
      }
    } catch (e) { }

    // Open/close viz buttons (delegated)
    document.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('[data-viz-toggle]') : null;
      if (!btn) return;

      e.preventDefault();
      var stop = parseInt(btn.getAttribute('data-viz-toggle'), 10);
      if (isNaN(stop)) return;

      var isOpen = window.__vizUI.open && window.__vizUI.stop === stop;
      if (isOpen) setVizOpen(false, null);
      else setVizOpen(true, stop);
    });

    (function callStartP5WithRetry(attempts) {
      attempts = typeof attempts === 'number' ? attempts : 3;

      if (typeof startP5 === 'function') {
        try {
          var api = startP5();

          if (api && api.ready && typeof api.ready.then === 'function') {
            api.ready.then(function () {
              try { if (api && api.setState) window.__sketchAPI = api; } catch (e) { }
              wireStop1Controls();
              wireStop2Controls(); // ✅ NEW
              wireStop3Controls();
              updateToggleButtons();
              pushAllFiltersToSketch();
            }).catch(function () {
              if (api && api.setState) window.__sketchAPI = api;
            });
          } else {
            if (api && api.setState) window.__sketchAPI = api;
            wireStop1Controls();
            wireStop2Controls(); // ✅ NEW
            wireStop3Controls();
            updateToggleButtons();
            pushAllFiltersToSketch();
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
            // only show active step
            var stepEls = document.querySelectorAll(cfg.stepSelector);
            stepEls.forEach(function (el, i) {
              if (i === index) el.classList.add('is-active');
              else el.classList.remove('is-active');
            });

            // map active index
            var mappedIndex = index;
            try {
              var stepEl = (sc.steps && sc.steps[index]) ? sc.steps[index] : stepEls[index];
              if (stepEl && stepEl.dataset && stepEl.dataset.activeIndex !== undefined) {
                var parsed = parseInt(stepEl.dataset.activeIndex, 10);
                if (!isNaN(parsed)) mappedIndex = parsed;
              }
            } catch (e) { }

            window.__activeStop = mappedIndex;

            // entering a new stop defaults back to route
            setVizOpen(false, null);

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