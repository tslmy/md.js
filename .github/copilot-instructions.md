## Quick context (one‑paragraph)

md.js is a compact browser molecular‑dynamics demo split into a physics engine (SoA state, integrators, forces, neighbor strategies) and a Three.js visualization/UI layer. The TypeScript sources live in `src/`; compiled JS is emitted to `built/` by `tsc`. Tests in `tests/` currently import from `built/` (not `src/`) for deterministic, runnable JS in Node/V8.

## What to know first (big picture)

- Engine vs Visuals: `src/engine/SimulationEngine.ts` drives simulation state and emits events (`frame`, `diagnostics`, `config`, `error`, `stateReallocated`, `wrap`). Visualization and UI (`src/init.ts`, `src/script.ts`, `src/visual/`) subscribe to those events and mirror the SoA into instanced meshes.
- Core data shape: `SimulationState` is a Structure‑of‑Arrays (flat typed arrays: `positions`, `velocities`, `forces`, `masses`, `charges`). Positions are flattened 3N arrays: x = positions[3*i], y = positions[3*i+1], z = positions[3*i+2]. Modify via engine APIs or during tests via `window.__mdjs.simState` (browser debug surface).
- Pair iteration is abstracted: see `src/core/forces/forceInterfaces.ts` + `src/core/simulation/neighborList.ts`. Two strategies exist: `cell` (default, linked‑cell) and `naive` (O(N²)). Use `engine.updateConfig({ neighbor: { strategy: 'naive' } })` to switch at runtime.
- Periodic boundary conditions (PBC) are physics‑affecting: wrapping + minimum‑image displacement are applied inside the core (`src/core/pbc.ts`). Visual ghost copies live in the renderer for intuition.

## Build / test / dev workflows (commands you will use)

- Install deps: `npm install`
- Build (emit runnable JS used by tests): `npm run build` (runs `tsc` -> output `built/`).
- Dev loop (auto‑rebuild + static server): `npm run dev` (nodemon rebuilds and runs `serve -l 8000 .`).
- Run tests: prefer this sequence locally: `npm run build` then `npm test`. The test harness imports from `built/`; running `vitest` without a fresh build can run against stale JS.
- Headless/browser tests require Python 3 (tests spawn `python -m http.server`) and Puppeteer (devDependency). If browser tests fail, ensure `python3` is available and port 8000 is free.
- Typecheck: `npm run typecheck`. Fast watch compile: `npm run watch`.

## Repo‑specific conventions and patterns

- Strict TS + explicit exported types. Prefer adding or updating type exports when changing engine public surfaces.
- Forces: implement side‑effect free algorithms that only accumulate into `state.forces` (see files in `src/core/forces/`). Avoid other global mutations.
- Neighbor strategies implement `NeighborListStrategy` (look at `src/core/simulation/neighborList.ts`). Tests compare pair counts by constructing an engine from `built/engine/config.js` and `built/engine/SimulationEngine.js`.
- Persistence: snapshots saved to `localStorage` under key `mdJsEngineSnapshot` (engine/persistence/storage.ts). Each module (except math-only `core`) has its own `persist.ts`.
- Tests import built JS (e.g. `built/engine/SimulationEngine.js`); keep `built/` in sync with `src/` before running tests.

## Integration points & external dependencies

- Three.js (visuals): `three` dependency + example controls loaded via CDN in `index.html`.
- Puppeteer + python http.server used for browser smoke tests (`tests/browser.test.ts`).
- `serve` (npm) used for local static hosting (scripts). `nodemon` is used for auto‑rebuild in `dev`.

## Small examples agents should use

- Read positions (browser debug surface):

  const positions = window.__mdjs?.simState?.positions
  const x0 = positions[0], y0 = positions[1], z0 = positions[2]

- Switch neighbor strategy at runtime:

  engine.updateConfig({ neighbor: { strategy: 'naive' } })

- Clear persisted engine snapshot:

  localStorage.removeItem('mdJsEngineSnapshot')

## Files you will commonly edit or inspect

- Core engine & API: `src/engine/SimulationEngine.ts`, `src/engine/config.ts`, `src/engine/settingsSync.ts`
- Physics kernels: `src/core/` (see `integrators.ts`, `state.ts`, `pbc.ts`, `forces/`)
- Neighbor lists: `src/core/simulation/neighborList.ts`
- Visualization & wiring: `src/init.ts`, `src/script.ts`, `src/visual/InstancedSpheres.ts`, `src/visual/InstancedArrows.ts`
- Tests: `tests/` (note imports from `built/`)

## Quick pitfalls & tips for automated edits

- Always run `npm run build` before modifying tests or running `npm test` locally. Many tests import compiled `built/` artifacts.
- Keep changes to the SoA layout backwards compatible: tests and many visualizers expect exact buffer shapes and ordering.
- Don't assume a bundler: project is compiled with `tsc` to `built/` and served as static files; avoid adding bundler-only features without adding build steps.

If anything here is unclear or you'd like more examples (eg. how to add a new force plugin or add worker offload), tell me which area to expand and I'll iterate.
