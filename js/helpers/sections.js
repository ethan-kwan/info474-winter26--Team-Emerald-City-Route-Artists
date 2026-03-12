/* =========================================
   js/helpers/sections.js
   ========================================= */
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

    window.__vizUI = { open: false, stop: null };
    window.__activeStop = 0;

    window.__vizFilters = { street: '', year: 'all', severity: 'all', mode: 'all', time: 'all', pinResetToken: 0 };
    window.__driverFilters = { factor: 'weather', year: 'all', mode: 'all', time: 'all', scope: 'all' };
    window.__affectFilters = { year: 'all', time: 'all', pinResetToken: 0 };
    window.__timeFilters = { year: 'all', severity: 'all' };

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
          filterStreet: window.__vizFilters.street,
          filterYear: window.__vizFilters.year,
          filterSeverity: window.__vizFilters.severity,
          filterMode: window.__vizFilters.mode,
          filterTime: window.__vizFilters.time,
          pinResetToken: window.__vizFilters.pinResetToken
        });
      }
    }

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
          affectMetric: 'percent',
          affectPinResetToken: window.__affectFilters.pinResetToken
        });
      }
    }

    function pushStop4FiltersToSketch() {
      if (window.__sketchAPI && window.__sketchAPI.setState) {
        window.__sketchAPI.setState({
          timeYear: window.__timeFilters.year,
          timeSeverity: window.__timeFilters.severity
        });
      }
    }

    function pushAllFiltersToSketch() {
      pushStop1FiltersToSketch();
      pushStop2FiltersToSketch();
      pushStop3FiltersToSketch();
      pushStop4FiltersToSketch();
    }

    function setVizOpen(open, stop) {
      window.__vizUI.open = !!open;
      window.__vizUI.stop = open ? stop : null;

      document.body.classList.toggle('viz-open-stop1', window.__vizUI.open && window.__vizUI.stop === 1);
      document.body.classList.toggle('viz-open-stop2', window.__vizUI.open && window.__vizUI.stop === 2);
      document.body.classList.toggle('viz-open-stop3', window.__vizUI.open && window.__vizUI.stop === 3);
      document.body.classList.toggle('viz-open-stop4', window.__vizUI.open && window.__vizUI.stop === 4);
      document.body.classList.toggle('viz-open-stop5', window.__vizUI.open && window.__vizUI.stop === 5);
      document.body.classList.toggle('viz-open-stop6', window.__vizUI.open && window.__vizUI.stop === 6);

      if (window.__sketchAPI && window.__sketchAPI.setState) {
        window.__sketchAPI.setState({
          openViz: window.__vizUI.open,
          openVizFor: window.__vizUI.stop
        });
      }

      updateToggleButtons();
      pushAllFiltersToSketch();
    }

    function wireControls(id, stateObj, pushFn) {
      var container = document.getElementById(id);
      if (!container) return;
      function handleControlEvent(e) {
          if (e.target.id) {
              var key = e.target.id.split('-')[1];
              stateObj[key] = e.target.value;
          }
          if(stateObj.pinResetToken !== undefined) stateObj.pinResetToken += 1;
          pushFn();
      }
      container.addEventListener('change', handleControlEvent);
      container.addEventListener('input', handleControlEvent);
    }

    wireControls('viz-controls-stop1', window.__vizFilters, pushStop1FiltersToSketch);
    wireControls('viz-controls-stop2', window.__driverFilters, pushStop2FiltersToSketch);
    wireControls('viz-controls-stop3', window.__affectFilters, pushStop3FiltersToSketch);
    wireControls('viz-controls-stop4', window.__timeFilters, pushStop4FiltersToSketch);

    try {
      var visStartEl = document.querySelector(cfg.visSelector);
      if (visStartEl && (cfg.showAt || 0) > 0) {
        visStartEl.classList.add(cfg.visHiddenClass);
      }
    } catch (e) { }

    document.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('[data-viz-toggle]') : null;
      if (!btn) return;
      e.preventDefault();
      var stop = parseInt(btn.getAttribute('data-viz-toggle'), 10);
      if (isNaN(stop)) return;
      var isOpen = window.__vizUI.open && window.__vizUI.stop === stop;
      setVizOpen(!isOpen, isOpen ? null : stop);
    });

    (function callStartP5WithRetry(attempts) {
      attempts = typeof attempts === 'number' ? attempts : 3;

      if (typeof startP5 === 'function') {
        try {
          var api = startP5();
          if (api && api.ready && typeof api.ready.then === 'function') {
            api.ready.then(function () {
              try { if (api && api.setState) window.__sketchAPI = api; } catch (e) { }
              updateToggleButtons();
              pushAllFiltersToSketch();
            }).catch(function () {});
          } else {
            if (api && api.setState) window.__sketchAPI = api;
          }

          var ScrollerCtor = window.Scroller;
          if (!ScrollerCtor) return;

          var sc = new ScrollerCtor(cfg.containerSelector, cfg.stepSelector, cfg.trigger);
          var VisualControllerCtor = window.VisualController;
          var visualController = VisualControllerCtor ? new VisualControllerCtor({ visSelector: cfg.visSelector, showAt: cfg.showAt }) : null;

          sc.on('active', function (index) {
            var stepEls = document.querySelectorAll(cfg.stepSelector);
            stepEls.forEach(function (el, i) {
              if (i === index) el.classList.add('is-active');
              else el.classList.remove('is-active');
            });

            var mappedIndex = index;
            try {
              var stepEl = stepEls[index];
              if (stepEl && stepEl.dataset && stepEl.dataset.activeIndex !== undefined) {
                mappedIndex = parseInt(stepEl.dataset.activeIndex, 10);
              }
            } catch (e) { }

            window.__activeStop = mappedIndex;
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
              var stepEl = stepEls[index];
              if (stepEl && stepEl.dataset && stepEl.dataset.activeIndex !== undefined) {
                mappedIndex = parseInt(stepEl.dataset.activeIndex, 10);
              }
            } catch (e) { }

            // Seatbelt HTML Animation logic during step 0
            if (mappedIndex === 0) {
              var pBelt = Math.min(1, Math.max(0, progress * 2.5)); 
              var leftEl = document.getElementById('belt-left');
              var rightEl = document.getElementById('belt-right');
              var txtEl = document.getElementById('buckle-text');
              
              if (leftEl) leftEl.style.transform = 'translateX(' + (pBelt * 125) + 'px)';
              if (rightEl) rightEl.style.transform = 'translateX(' + (-pBelt * 125) + 'px)';
              if (txtEl) txtEl.style.opacity = pBelt > 0.95 ? 1 : 0;
            }

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
