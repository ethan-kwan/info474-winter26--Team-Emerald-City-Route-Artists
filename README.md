## Scroll-demo (p5.js scrollytelling template)

A minimal scaffold for building scroll-driven p5.js visuals. Keep things simple: HTML sections in `index.html` drive the visual state exposed by `js/helpers/sections.js`.

Top-level folders (high level)
- `index.html` — page with sections that drive the scroll state.
- `css/` — styles for layout and the visualization container.
- `data/` — static data files (e.g., `words.tsv`).
- `js/helpers/` — small utilities: data loading, scroller, and visual controller.
- `js/sketches/` — sketch runtime and renderers:

	- `sketch_manager.js` — p5 lifecycle and public API (startP5, setState, setData, ready).
	- `sketch_renderer.js` — delegator that calls small per-viz modules.
	- `examples/` — example renderer(s) (e.g., `examples/sketch_grid.js`).
	- `viz/` — per-visual files (e.g., `viz_title.js`, `viz_scatter.js`, `viz_bar.js`).

Quick start
1. Run a local static server from the repo root:
	 ```bash
	 python3 -m http.server 8000
	 ```
2. Open http://localhost:8000 and scroll through the sections to see the visuals.

Deploy
- You can publish this repo with GitHub Pages (use a `gh-pages` branch or the `docs/` folder) or any static host.

Contributing / notes
- Keep the script order in `index.html`: helpers → optional viz modules/examples → `sketch_renderer.js` → `sketch_manager.js`.
- Add new visuals by creating a file under `js/sketches/viz/` that exposes `window.YourViz.draw(p, manager, ai, progress)` and include it before `sketch_renderer.js`.

That's it — the repo is intentionally small so you can swap in your own visuals quickly.

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
	- `sections.js` — orchestrator: starts the sketch and wires scroller -> sketch API (dataset-agnostic).
- `js/sketches/` — rendering code (pluggable renderers):
	- `sketch_manager.js` — p5 lifecycle and manager (data-agnostic). Exposes `startP5()` which returns an API object. The API exposes a `ready` Promise that resolves when data/layout are ready.
	- `examples/sketch_grid.js` — an example grid renderer (moved to `js/sketches/examples/sketch_grid.js`). This file registers a `window.TemplateRenderer` (an example implementation). A small shim remains at `js/sketches/sketch_grid.js` that warns about the move to preserve compatibility with old imports.
	- `viz/` — small per-visual modules (optional). Examples provided:
		- `viz_title.js` — title screens (active indexes 0 and 1)
		- `viz_scatter.js` — data-agnostic scatter example
		- `viz_bar.js` — simple bar chart example (active index 7)
	  These files are loaded before `sketch_renderer.js` and `sketch_renderer` delegates draw calls to them when present.

Key APIs and contracts
- Configuration: set `window.ScrollDemoConfig` in `index.html` (or via `data-` attributes on `#graphic`). Important keys:
	- `dataUrl` — path to TSV data (default `data/words.tsv`).
	- `containerSelector`, `stepSelector`, `visSelector` — DOM selectors.
	- `showAt` — numeric index where the visual should become visible (0-based). A value of `0` is honored.
	- `trigger` — `'center'` or `'top'` to control scroller trigger position.

- Data loading and preprocessing:
	- `js/helpers/data_loader.js` exposes `DataLoader.loadTSV(url)` and `DataLoader.preprocess(data)`.
	- `Renderer.setData(manager, rawData)` — the renderer contract for preprocessing and layout. The example grid renderer implements this behavior (see `js/sketches/examples/sketch_grid.js` as `TemplateRenderer`). Implementations should call `DataLoader.preprocess` and compute layout (x/y positions, rows/cols) and cached aggregates (e.g., `_fillerIndices`, `_totalFillers`) on the `manager` object. `Renderer.setData` may return a Promise when it performs async loads; callers can await it.

- Renderer contract (globally exposed):
	- `window.Renderer.setData(manager, rawData)` — preprocess and attach layout/data to the manager.
	- `window.Renderer.draw(p, manager, activeIndex, progress)` — called each p5 frame to draw visuals based on current state.

Note on visual organization
- This project uses a small delegator (`js/sketches/sketch_renderer.js`) that calls into optional per-viz modules under `js/sketches/viz/` when available. If you add new visual modules, expose a global object with a `draw(p, manager, ai, progress)` function and load the script before `sketch_renderer.js` in `index.html`.

Note: `Renderer.setData` may return a Promise when it performs an async load (e.g., when given a URL or when loading the default TSV). The sketch manager exposes an `api.ready` Promise that resolves once data/layout are available.

- Sketch API (returned by `startP5` and exposed as `window.__sketchAPI`):
	- `setState({ activeIndex, progress })` — update active step and transition progress.
	- `setData(data)` — delegate to `Renderer.setData` to update underlying data (layout remains stable unless renderer recomputes it).
	- `p5` — the raw p5 instance (mostly for advanced debugging).
	- `data` — reference to processed data on the manager. Note that `data` may be populated asynchronously after `api.ready` resolves.
	- `ready` — a Promise that resolves to the API object once data/layout are available. Consumers that need immediate access to processed data should await `api.ready` before reading `api.data`.
