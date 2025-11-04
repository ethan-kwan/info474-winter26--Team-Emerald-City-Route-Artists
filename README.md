
## Scrollytelling demo (refactored)

This repository is a scroll-driven visualization demo. It was refactored away from D3 rendering and now uses p5.js for rendering and small, focused helper modules for scrolling and data loading.

High-level architecture
- `index.html` — page content and configuration (see `window.ScrollDemoConfig`).
- `css/` — styles including layout and classes that show/hide the visualization.
- `data/` — source data (`words.tsv`).
- `js/helpers/` — small utility modules:
	- `data_loader.js` — TSV parser and `DataLoader.preprocess(data)` helper.
	- `scroller.js` — computes active step index and progress; configurable `trigger` ('center' | 'top').
	- `visual_controller.js` — controls when `#vis` should be visible (uses `showAt`).
	- `sections.js` — orchestrator: loads data, starts the sketch, wires scroller -> sketch API.
- `js/sketches/` — rendering code (pluggable renderers):
	- `sketch.js` — p5 lifecycle and manager (data-agnostic). Exposes `startP5(rawData)` which returns `window.__sketchAPI`.
	- `sketch_grid.js` — the grid renderer (registered globally as `window.Renderer`).

Key APIs and contracts
- Configuration: set `window.ScrollDemoConfig` in `index.html` (or via `data-` attributes on `#graphic`). Important keys:
	- `dataUrl` — path to TSV data (default `data/words.tsv`).
	- `containerSelector`, `stepSelector`, `visSelector` — DOM selectors.
	- `showAt` — numeric index where the visual should become visible (0-based). A value of `0` is honored.
	- `trigger` — `'center'` or `'top'` to control scroller trigger position.

- Data loading and preprocessing:
	- `js/helpers/data_loader.js` exposes `DataLoader.loadTSV(url)` and `DataLoader.preprocess(data)`.
	- `Renderer.setData(manager, rawData)` (implemented in `sketch_grid.js`) calls `DataLoader.preprocess` and computes layout (x/y positions, rows/cols) and cached aggregates (e.g., `_fillerIndices`, `_totalFillers`) on the `manager` object.

- Renderer contract (globally exposed):
	- `window.Renderer.setData(manager, rawData)` — preprocess and attach layout/data to the manager.
	- `window.Renderer.draw(p, manager, activeIndex, progress)` — called each p5 frame to draw visuals based on current state.

- Sketch API (returned by `startP5` and exposed as `window.__sketchAPI`):
	- `setState({ activeIndex, progress })` — update active step and transition progress.
	- `setData(data)` — delegate to `Renderer.setData` to update underlying data (layout remains stable unless renderer recomputes it).
	- `p5` — the raw p5 instance (mostly for advanced debugging).
	- `data` — reference to processed data on the manager.

Notes about behavior and development
- The code now fails fast for missing modules: `Renderer.setData`, `Renderer.draw`, and `DataLoader.preprocess` are required and will throw helpful errors if not present. This removes silent fallbacks and makes load-order issues obvious.
- The visual show/hide logic is controlled by `visual_controller.js` and honors a configured `showAt` (including `0`).
- The scroller supports a `trigger` option: set it to `'center'` so early steps (indices 0/1) activate when they reach the vertical center of the viewport.
- Titles had a short sticky window applied (700ms) to avoid flicker during rapid activeIndex changes. You can tune this in `js/sketches/sketch_grid.js`.

Developer quick checks
- Hard-reload after edits: Cmd+Shift+R (or disable cache) to ensure scripts load in the right order.
- Console checks:
	- `!!window.DataLoader && typeof window.DataLoader.preprocess === 'function'`
	- `!!window.Renderer && typeof window.Renderer.setData === 'function'`
	- `!!window.__sketchAPI && typeof window.__sketchAPI.setState === 'function'`
- If you see an explicit error like `Renderer.setData is required...`, verify script order in `index.html` — helpers must be included before sketches, and the renderer must be loaded before `sketch.js`.

Deprecated code
- Original D3-based sources (if you need to inspect them) live in `js/deprecated/`.

If you'd like, I can add a short CONTRIBUTING or DEV_NOTES document with step-by-step dev/run instructions and common troubleshooting tips.

