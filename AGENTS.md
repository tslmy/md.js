# AGENTS

This repository runs a compact TypeScript + Three.js simulator. AGENTs should treat it as a self-contained engine + visualization project where the **engine logic is compiled via `tsc` and all tests import from the emitted `built/` artifacts**. Before touching tests, ensure the build output is current.

## Quick context
- md.js is a browser-based molecular-dynamics playground: random particles move under Lennard-Jones, gravity, and Coulomb forces inside a periodic box while Three.js renders instanced spheres, arrows, and HUD data.
- Engine vs visuals: `src/engine/SimulationEngine.ts` drives simulation state and emits events (`frame`, `diagnostics`, `config`, `error`, `stateReallocated`, `wrap`). Visual/UI modules (`src/init.ts`, `src/script.ts`, `src/visual/`) mirror that state into Three.js instanced meshes.
- SimulationState is a Structure-of-Arrays (`positions`, `velocities`, `forces`, `masses`, `charges`). Positions are flattened 3N arrays; read/write them via engine APIs or `window.__mdjs?.simState` when debugging in the browser.
- Neighbor strategies live in `src/core/simulation/neighborList.ts`: `cell` (default) uses uniform linked cells, `naive` sweeps unordered pairs. Switch strategy at runtime with `engine.updateConfig({ neighbor: { strategy: 'naive' } })`.
- Periodic boundary conditions affect physics: wrapping + minimum-image displacement come from `src/core/pbc.ts`, and ghost visuals sit alongside the main box for intuition.

## Status & expectations
- This is a hobbyist project with no paying customers depending on it. AGENTs can move quickly, propose bold changes, and treat failures as low-risk experiments—just snapshot `built/` before major fixes for reproducibility.

## Commands

### Core build & dev
- `npm install` – installs pinned dependencies (`typescript`, `vitest`, `puppeteer`, `serve`, etc.). Run this once per machine or after `package-lock` changes.
- `npm run build` – emits runnable JavaScript into `built/` via `tsc`. This is the canonical artifact that tests, dev server, and netlify rely on.
- `npm run dev` – nodemon watches `src/` and reruns `npm run build` before `npx serve -l 8000 .`. Good for local tweaks that need browser previews (auto-rebuild + static server).
- `npm run start` – same as dev but without file watching; builds once then serves.
- `npm run clean` – removes `built/` contents to force a clean compile next time.

### Typecheck & lint
- `npm run typecheck` – runs `tsc --noEmit` with strict settings (aligns with `tsconfig.json`).
- `npx eslint "src/**/*.{ts,js}" "tests/**/*.{ts,js}"` – use this (with `--fix` when safe) to match `.eslintrc.yml` (it extends `standard-ts` with a few off rules). Pre-commit already runs the eslint hook, but AGENTs should run it manually when pushing.

### Testing (full suite)
- `npm test` – fast `vitest run`. **Always run `npm run build` right before** (tests import `.js` outputs) unless the caller explicitly says built artifacts already match source.
- `npm run test:watch` – vitest watch mode, helpful when iterating on a single spec.
- `npm run test:cov` – vitest with coverage and V8 instrumentation; outputs `coverage/lcov-report/` and a raw `coverage/lcov.info`.
- `npm run cov:open` – convenience command to open the generated coverage HTML after `test:cov`.

### Single-test workflow (vital for AGENT automation)
- `npx vitest run tests/<name>.test.ts` – runs only that test file against the built JS. Always pair with a fresh `npm run build` (or `npm run watch` if editing same file) to avoid stale artifacts.
- Example: to rerun gravity/force invariants, execute `npm run build && npx vitest run tests/forces.test.ts --runInBand`.
- For browser harness smoke tests that need a server plug: keep Python 3 available (`python3 -m http.server 8000` is the same server vitest spawns) and ensure port 8000 is free before running `tests/browser.test.ts`.

### Headless/browser test notes
- `tests/browser.test.ts` spins up a local server (`serve`) and uses Puppeteer. Confirm `python3` exists and port `8000` is idle; vitest will fail otherwise.
- Add `--runInBand` for flaky browser tests to avoid overlapping Puppeteer launches.

## Code Style Guidelines

### Formatting & ESLint
- The project extends `standard-ts` via `.eslintrc.yml`. That means no semicolons, indent with two spaces, single quotes, and consistent spacing around `=>`. Resist adding custom formatting tools—`npm run build` + `npx eslint --fix` keeps files aligned.
- Keep `built/` ignored (`.eslintignore` via `.eslintrc`/`.gitignore`). Never copy lint output into commits.

### Imports & module resolution
- All local imports target `.js` files even in `src/` because `tsconfig.json` and `package.json` use ES modules with `type: module`. AGENTs must preserve the `.js` extension when importing between TS files (e.g., `import { foo } from '../core/foo.js'`).
- Prefer `import type` when only types are required to avoid runtime import overhead. Follow existing patterns: `import { createState, type SimulationState } from '../core/simulation/state.js'`.
- Order imports roughly as: 1) external deps (`three`, `vitest`, etc.), 2) project-level helpers (engine/state), 3) adjacent sibling modules (visual/ or control/). Group related paths together with blank lines.

### TypeScript & typing
- TS is strict; exported APIs should have explicit return types and parameter annotations. Use `type` aliases for shape definitions (see `config/types.ts`) and prefer `interface` only when open extensions are needed.
- When declaring private helpers, keep them `function` declarations (not arrow) if hoisting is helpful; otherwise, arrow functions on assignments are acceptable—just keep style consistent with surrounding code.
- Favor `Readonly` helpers for config fixtures, but ensure runtime mutation of SoA state is still possible where required (state arrays are `Float32Array` etc.).

### Naming conventions
- Classes and constructors use PascalCase (e.g., `SimulationEngine`, `NeighborListStrategy`).
- Functions, helpers, and variables use camelCase. Boolean flags in `settings.ts` use `if_` prefixes (e.g., `if_showTrajectory`) for alignment with the UI toggles—mirror that naming when you add new flags.
- Constants that reflect physical constants (G, K, EPSILON) use uppercase or camelCase depending on context but keep names short and descriptive.

### Error handling
- Wrap risky operations (filesystem, simulation steps, DOM touch points) in `try/catch`. Emit errors via the established event system (`engine.emit('error', e)`) rather than logging to console directly.
- When catching, cast to `Error` (`catch (e) { this.emitter.emit('error', e as Error) }`) so downstream handlers can read `message`/`stack` safely. Avoid swallowing exceptions; pause the engine on fatal errors.

### Architecture & state discipline
- The core engine uses a Structure-of-Arrays (`SimulationState`). Force fields only mutate `state.forces` (see `src/core/forces`). They should not touch visual state or global config. Keep them pure functions that accumulate pairwise forces.
- Simulation step order: zero forces → evaluate each enabled force → integrator half-step → recalc forces → integrator finish → wrap positions if PBC is on → emit events (frame, diagnostics). AGENTs should not reorder this pipeline.
- Neighbor strategies must implement `NeighborListStrategy`. The engine currently toggles between `cell` (default) and `naive`. If adding new strategies, respect `rebuildEveryStep` and the explicit `activateNeighborStrategy` call sequence.

### Visual & UI layers
- Visual modules under `src/visual` and `src/control` are tightly coupled to DOM state. Keep UI wiring files DOM-capable (no pure-node-only code) and avoid introducing global state.
- HUD / trajectory helpers in `wrapMarkers.ts`, `trajectory.ts`, etc., expect instanced buffers; update only via their exported APIs.

## Persistence & tooling cross-checks
- Persistence snapshots live in `localStorage` under `mdJsEngineSnapshot` (see `engine/persistence/storage.ts`). Clearing that key is safe for testing.
- Settings persistence is in `control/persist.ts`; each module is responsible for its own storage, so don’t centralize persistence logic unless necessary.
- `serve`, `nodemon`, and `puppeteer` are devDependencies; do not add them to dependencies unless absolutely required.

## Automation hints
- Pre-commit is enabled (`.pre-commit-config.yaml`). `check-added-large-files`, `eslint --fix`, and other hooks run automatically when the user commits. AGENTs must ensure their edits pass ESLint (and optionally run `npm test`).
- Keep `package-lock.json` in sync when adding/removing dependencies. `npm install` rewrites the lock by default; stage both `package.json` and `package-lock.json` updates.

## Cursor rules
- There are no `.cursor` or `.cursorrules` directories/files in this repo at the moment. Default to the guidance in this document.

## Agent checklist (keep this short!)
1. Build with `npm run build` before touching any tests or running them.
2. Lint with `npx eslint` and typecheck with `npm run typecheck` when touching shared/business logic.
3. Respect `.js` extensions on imports and keep force/state mutations within permitted modules.
4. Use the event API (`SimulationEngine.on`) for cross-module communication rather than global variables.
5. Run the relevant test or `npx vitest run tests/<file>.test.ts` for targeted changes.

If you hit unexpected issues, describe the error and state of `built/` when reporting back so future AGENTs can reproduce it effortlessly.

## Testing & verification hints
- When iterating on a single test file, run `npm run build` first then `npx vitest run tests/<name>.test.ts --runInBand`. Keep `--runInBand` handy for tests touching Puppeteer/`serve` to avoid port conflicts.
- Keep `built/` checked for freshness: if you edit `src/`, the `tests/` suite may still import stale JS. `npm run build` before every `npm test` is mandatory unless another helper already rebuilt.
- Browser harness tests expect a working `serve` install (`devDependency serve`) and `python3`. Vitest will spawn `python3 -m http.server 8000`; ensure nothing else is listening on 8000.
- Use `npm run test:cov` when adding critical behavior or wanting V8 coverage reporting. Run `npm run cov:open` afterwards to inspect the HTML report.
- `npm run dev` is the fastest local preview loop; it rebuilds automatically and restarts `serve`. Stop it before running manual tests.

## Architecture reminders
- The physics engine (see `src/core/` and `src/engine/`) is isolated from the DOM. Keep outfit changes (persistence, UI wiring, Three.js) outside the engine or expose well-defined hooks/events.
- `SimulationState` is a Structure-of-Arrays (`positions`, `velocities`, `forces`, `masses`, `charges`, etc.) published via `engine.getState()`. Mutate state only through engine/integration APIs unless a test explicitly seeds buffers before `step()`.
- Force plugins (`src/core/forces/*.ts`) should only touch `state.forces`. Share helper math via `canonical.ts` or other `src/util/` modules but never import visualization modules there.
- `SimulationEngine` reconstructs force + integrator pipelines on runtime config changes. If you add new runtime config fields, wire them through `config.ts`, `settings.ts`, and `settingsSync.ts` to keep UI + persistence consistent.
- The run loop zeroes force accumulators, applies neighbors, advances integrators, wraps positions (PBC), emits `frame` + `diagnostics`, and then loops. Keep this order; tests rely on telemetry emitted via `frame` events.

## Neighbor & force toolchain
- Neighbor list implementations (`cell`, `naive`) live under `src/core/simulation/neighborList.ts`. `createCellNeighborStrategy` is the default; it rebuilds every step and expects periodic box parameters from `configurePBC`.
- If you add a new neighbor strategy, implement `NeighborListStrategy`, expose `rebuildEveryStep`, and call `activateNeighborStrategy` when toggling.
- Force constructors take runtime constants/softening values derived from `world.box` and `runtime.cutoff`. Derive helper values (softening length, Ewald parameters) before instantiating; avoid hardcoding numbers within each plugin.
- Coulomb + gravity switch to Ewald versions when `runtime.pbc` is true. Mirror this logic when extending forces or adding new long-range interactions.

## Visualization, UI & persistence plumbing
- Visualization modules under `src/visual/` expect instanced buffers (positions, colors, normals) and rely on `wrapMarkers`, `trajectory`, and `drawingHelpers`. Don’t mutate `engine` state inside these helpers.
- `src/control/` houses settings/panel wiring. Each module has its own `persist.ts`; load/save logic should remain localized to that namespace (engine persistence, control persistence, visual persistence).
- Visual state (colors, trajectory entries) syncs to `window.__mdjs` when running in the browser. If you add new UI controls, replicate the sync logic to keep the debug surface consistent.
- `settingsSync.ts` is the bridge between UI toggles and engine config patches. Keep this file lean: it should map UI flags (e.g., `if_showTrajectory`) to config updates and persist them via `control/persist.ts`.

## Debugging & persistence tips
- The engine persists snapshots to `localStorage` under `mdJsEngineSnapshot`. Clearing this key is safe for testing or when you need to reset state: `localStorage.removeItem('mdJsEngineSnapshot')`.
- When tests or dev builds fail after `tsc`, inspect `built/` vs `src/` to confirm they match. Confirm `tsconfig.json` paths (ES modules) and ensure there are no stale `built/` artifacts lying around.
- Pre-commit hooks (`.pre-commit-config.yaml`) run lint/fix hooks plus general hygiene checks. They rely on pinned ESLint versions; keep `.pre-commit-config.yaml` in sync with `package.json` if you bump ESLint.
- If you add new dependencies, update both `package.json` and `package-lock.json`, then run `npm install` locally to regenerate lockfiles, and stage both files together.

## Reporting & knowledge sharing
- Mention `built/` status when opening issues or PRs (e.g., "Compiled with `npm run build` before tests. Built artifacts currently match source."). It helps future AGENTs and maintainers reproduce states quickly.
- Use inline comments sparingly; prefer self-documenting helpers and assertive type names. When hooking cross-module events, emit descriptive event names and keep listeners scoped to `SimulationEngine` or `panel.ts` instead of leaking global functions.
- Need to document a new pattern? Add a short README snippet under `src/README.md` or expand this `AGENTS.md` so future AGENTs find the guidance.

## Testing & verification hints
- When iterating on a single test file, run `npm run build` first then `npx vitest run tests/<name>.test.ts --runInBand`. Keep `--runInBand` handy for tests touching Puppeteer/`serve` to avoid port conflicts.
- Keep `built/` checked for freshness: if you edit `src/`, the `tests/` suite may still import stale JS. `npm run build` before every `npm test` is mandatory unless another helper already rebuilt.
- Browser harness tests expect a working `serve` install (`devDependency serve`) and `python3`. Vitest will spawn `python3 -m http.server 8000`; ensure nothing else is listening on 8000.
- Use `npm run test:cov` when adding critical behavior or wanting V8 coverage reporting. Run `npm run cov:open` afterwards to inspect the HTML report.
- `npm run dev` is the fastest local preview loop; it rebuilds automatically and restarts `serve`. Stop it before running manual tests.

## Architecture reminders
- The physics engine (see `src/core/` and `src/engine/`) is isolated from the DOM. Keep outfit changes (persistence, UI wiring, Three.js) outside the engine or expose well-defined hooks/events.
- `SimulationState` is a Structure-of-Arrays (`positions`, `velocities`, `forces`, `masses`, `charges`, etc.) published via `engine.getState()`. Mutate state only through engine/integration APIs unless a test explicitly seeds buffers before `step()`.
- Force plugins (`src/core/forces/*.ts`) should only touch `state.forces`. Share helper math via `canonical.ts` or other `src/util/` modules but never import visualization modules there.
- `SimulationEngine` reconstructs force + integrator pipelines on runtime config changes. If you add new runtime config fields, wire them through `config.ts`, `settings.ts`, and `settingsSync.ts` to keep UI + persistence consistent.
- The run loop zeroes force accumulators, applies neighbors, advances integrators, wraps positions (PBC), emits `frame` + `diagnostics`, and then loops. Keep this order; tests rely on telemetry emitted via `frame` events.

## Neighbor & force toolchain
- Neighbor list implementations (`cell`, `naive`) live under `src/core/simulation/neighborList.ts`. `createCellNeighborStrategy` is the default; it rebuilds every step and expects periodic box parameters from `configurePBC`.
- If you add a new neighbor strategy, implement `NeighborListStrategy`, expose `rebuildEveryStep`, and call `activateNeighborStrategy` when toggling.
- Force constructors take runtime constants/softening values derived from `world.box` and `runtime.cutoff`. Derive helper values (softening length, Ewald parameters) before instantiating; avoid hardcoding numbers within each plugin.
- Coulomb + gravity switch to Ewald versions when `runtime.pbc` is true. Mirror this logic when extending forces or adding new long-range interactions.

## Visualization, UI & persistence plumbing
- Visualization modules under `src/visual/` expect instanced buffers (positions, colors, normals) and rely on `wrapMarkers`, `trajectory`, and `drawingHelpers`. Don’t mutate `engine` state inside these helpers.
- `src/control/` houses settings/panel wiring. Each module has its own `persist.ts`; load/save logic should remain localized to that namespace (engine persistence, control persistence, visual persistence).
- Visual state (colors, trajectory entries) syncs to `window.__mdjs` when running in the browser. If you add new UI controls, replicate the sync logic to keep the debug surface consistent.
- `settingsSync.ts` is the bridge between UI toggles and engine config patches. Keep this file lean: it should map UI flags (e.g., `if_showTrajectory`) to config updates and persist them via `control/persist.ts`.

## Debugging & persistence tips
- The engine persists snapshots to `localStorage` under `mdJsEngineSnapshot`. Clearing this key is safe for testing or when you need to reset state: `localStorage.removeItem('mdJsEngineSnapshot')`.
- When tests or dev builds fail after `tsc`, inspect `built/` vs `src/` to confirm they match. Confirm `tsconfig.json` paths (ES modules) and ensure there are no stale `built/` artifacts lying around.
- Pre-commit hooks (`.pre-commit-config.yaml`) run lint/fix hooks plus general hygiene checks. They rely on pinned ESLint versions; keep `.pre-commit-config.yaml` in sync with `package.json` if you bump ESLint.
- If you add new dependencies, update both `package.json` and `package-lock.json`, then run `npm install` locally to regenerate lockfiles, and stage both files together.

## Reporting & knowledge sharing
- Mention `built/` status when opening issues or PRs (e.g., "Compiled with `npm run build` before tests. Built artifacts currently match source."). It helps future AGENTs and maintainers reproduce states quickly.
- Use inline comments sparingly; prefer self-documenting helpers and assertive type names. When hooking cross-module events, emit descriptive event names and keep listeners scoped to `SimulationEngine` or `panel.ts` instead of leaking global functions.
- Need to document a new pattern? Add a short README snippet under `src/README.md` or expand this `AGENTS.md` so future AGENTs find the guidance.

## File structure cheat sheet
- `src/core/` – physics kernels, neighbor lists, integrators, PBC helpers. Keep this code engine-only and avoid DOM touches.
- `src/engine/` – config builders, `SimulationEngine`, persistence helpers, and settings sync plumbing. It owns runtime state and orchestrates force/integrator wiring.
- `src/control/` – GUI panel wiring, settings schema, persistence hooks. Controls emit events that drive `settingsSync.ts` updates.
- `src/visual/` – Three.js render helpers, instanced mesh updaters, HUD helpers, and trajectory/wrap indicators. Visual modules subscribe to engine events for data.
- `tests/` – Vitest specs importing from `built/`. Look here to understand expected public behavior; they often seed the engine through snapshots instead of DOM.
- `built/` – output of `npm run build`. Treat it as generated artefacts; do not edit directly but keep the folder clean before commits.

## Deployment & hosting
- Netlify deploys run `npm run build` and serve the emitted `built/` directory along with the static `index.html`. Mention `built/` freshness when opening deployment PRs.
- `netlify.toml` is currently minimal; if you need custom redirects or headers, add them there and verify locally with `npm run start`.
- Browser smoke tests depend on the same static server stack (`serve + python3`). The dev loop (`npm run dev`) mirrors production hosting for quick sanity checks.

## Collaboration best practices
- When adding new physical constants or toggles, expose them through `settings.ts`, persist via `control/persist.ts`, and map them in `settingsSync.ts` so UI + engine stay aligned.
- Preface changes that touch persistence or state initialization with sanity checks in `tests/persistence.test.ts` or engine-level specs; the snapshots travel through JSON serialization, so keep them minimal.
- If you need to reorganize directories, update `tsconfig.json` paths, ensure `built/` output still matches, and rerun `npm run build` before tests.

## Key files & references
- `.eslintrc.yml` – enforces `standard-ts`, disables `no-multi-str` and strict-boolean; align edits with this config.
- `.pre-commit-config.yaml` – lints via ESLint 9 in an isolated env; keep versions synced when upgrading devDeps.
- `tsconfig.json` – strict ES module compiler settings; ensure any new directories are included or referenced via `paths`.
- `tests/global.d.ts` – shared declarations for Vitest targeting `built/`; update if you add globals used by the test harness.
- `netlify.toml` & `README.md` – track hosting expectations and public-facing docs when updating commands or architecture notes.

## Common pitfalls
- Forgetting to rebuild: Vitest pulls fixtures from `built/`; any `src/` edit must be followed by `npm run build` before running tests.
- Missing `.js` extensions on imports: TypeScript won't emit correct paths and runtime imports fail under `type: module`.
- Side effects in forces: only `state.forces` may change; touching other buffers can corrupt diagnostics and rendering.
- Stale persistence snapshots: snapshots are JSON; if you add new fields, version the snapshot or handle missing keys during hydration.
- Browser test flakes: confirm `python3` is available and port `8000` is unused before running `tests/browser.test.ts`.
