# md.js – Molecular Dynamics in the Browser

[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
![ts](https://badgen.net/badge/-/TypeScript/blue?icon=typescript&label)
[![pre-commit](https://img.shields.io/badge/pre--commit-enabled-brightgreen?logo=pre-commit&logoColor=white)](https://github.com/pre-commit/pre-commit)
[![pre-commit.ci status](https://results.pre-commit.ci/badge/github/tslmy/md.js/main.svg)](https://results.pre-commit.ci/latest/github/tslmy/md.js/main)
[![Netlify Status](https://api.netlify.com/api/v1/badges/4b928847-32c8-456a-912d-f502d3e3c2c0/deploy-status)](https://app.netlify.com/sites/mdjs/deploys)

A VR-ready [molecular dynamics](https://en.wikipedia.org/wiki/Molecular_dynamics) demo that you can [watch right away][dm].

Designed be a teaching tool for entry-level physics and chemistry courses, this program follows these principles:

* **3D and VR ready.** Designed to be used with smartphone-based VR headsets[^1], the view will render in Side-by-Side (SBS) mode and gyro-controlled when when opened from a smartphone browser in landscape mode.
* **Zero setup.** No need to install anything; just open a webpage. No need to load model files; particles are randomly generated upon first visit, and they start moving immediately.
* **Variety over accuracy.** Play with different force fields that normally wouldn't make sense together in the real world.
* **Hackable.** Tweak physical constants live, watch particles orbit a heavyweight “sun”, enable / disable force fields... This is your playground.

[^1]: which simply mounts a phone to your head, making them much more [affordable](https://www.amazon.com/Cell-Phone-VR-Headsets/b?ie=UTF8&node=14775002011) than standalone types and more budget-friendly to students.

## Quick Demo

![Demo animation](https://media0.giphy.com/media/boyW0pDMJDWqyLv96Z/giphy.gif)

What am I looking at?

* **Default setup.** In a square box, serveral particles spawn. They have randomized mass, electric charge, and starting position. Starting in stillness, these particles will start to move, obeying different force fields all at once: Coulomb force, gravity, and LJ potential.
* To help you track a particular one, particles are randomly colored and traced with a fading tail.
* [Periodic boundary condition (PBC)][pbc] is used to simulate this system's behavior as if it were part of an infinite, repeating pattern. Outside of the box space, "ghost" images of the particles are rendered with slight transparentcy to give visual intuitions.
* Two arrows stick out from each particle. One indicates the velocity, the other combined force. Their lengths are auto‑normalized per frame. All toggles & numeric inputs live in the on‑screen control pane.
* **About "the sun".** By default, the camera's reference frame is fixed on a heavy, black particle. Nicknamed "the sun", this special particle will appear centered forever.
  * Heavy in mass, "the sun" tends to attract neighboring particles to revolve around itself. These particles may eventually get too close to "the sun" and get "expelled" from the little "solar system", shooting out of the box with great speed, which is a fun scene to watch.
  * Disable “Center the sun” to see its recoil motion, or disable the sun entirely and let chaos ensue.

[dm]: https://mdjs.netlify.app/
[pbc]: https://en.wikipedia.org/wiki/Periodic_boundary_conditions

## Feature Highlights

* Multiple pairwise force fields (individually toggleable):
  * Lennard‑Jones (ε, σ)
  * Newtonian gravitation (G)
  * Coulomb / electrostatics (K, integer charges)
* [Periodic boundary conditions][pbc] (wrap in x/y/z) – visualized via ghost copies.
* Configurable world size, particle count, masses, charges, timestep `dt`, cutoff radius.
* Optional constant temperature mode (simple velocity rescale, off by default).
* Trajectories with fading color gradients.
* “Follow the sun” reference frame toggle.
* Force & velocity HUD table (speed, KE, total force magnitude per particle).
* Live arrow scaling & optional capping of maximum arrow length.
* Local persistence: full snapshot saved to `localStorage` on unload and restored next load.

## Architecture Overview

The code base separates a **physics engine** (data + force/integration pipeline) from the **visualization layer** (Three.js scene graph + HUD) via an event boundary.

### 1. Simulation Core (Structure‑of‑Arrays)

Located under `src/core/simulation` & `src/core/forces`:

* `state.ts` – Structure‑of‑Arrays (`positions`, `velocities`, `forces`, `masses`, `charges`, flags). Functions: `createState`, `zeroForces`.
* `Simulation.ts` – Low‑level timestep driver used internally by the high‑level engine.
* `integrators.ts` – Integrator strategies (currently Explicit Euler & Velocity Verlet). Verlet is the default for better energy behavior.
* `forces/*.ts` – Individual `ForceField` implementations (Lennard‑Jones, Gravity, Coulomb) composed at runtime. Each uses a naïve O(N²) pair loop with an early distance cutoff. Optimization path: spatial hashing / cell lists / neighbor lists.
* `serialize.ts` – Serialize / hydrate typed arrays to plain objects (future: use for cross‑tab sharing or worker offloading).

### 2. Engine Orchestration

* `engine/SimulationEngine.ts` – High‑level orchestrator: owns mutable SoA state, rebuilds force plugin list on config changes, emits `frame` & `diagnostics` events, and shields the rest of the app from direct mutation.
* `engine/persistence/persist.ts` – Snapshot / hydrate utilities (JSON‑serializable) for future cross‑tab or worker scenarios.

### 3. Visualization & UI Layer

* `particleSystem.ts` – Builds particles, trajectories, ghost clones (for PBC visualization), HUD rows, and mirrors simulation data into Three.js constructs.
* `script.ts` – Entry point: initializes scene (delegates to `init.js`), seeds state, subscribes to engine events to mirror SoA data into Three.js buffers, updates HUD & persistence.
* `settings.ts` – Central tweakable parameters + feature flags; deliberately verbose / “kitchen sink” for experimentation.
* Legacy `stateStorage.ts` fully removed; engine snapshot persistence (`src/engine/persistence/{persist,storage}.ts`) now also records escaped flags.

### 4. Public (Test) Surface

When running in a browser the following is exposed for **debug & automated smoke tests only** (not a stable API):

```js
window.__mdjs = {
  particles, // legacy visual particle objects (positions/colors for HUD & trajectories)
  settings,  // live settings object
  simState,  // authoritative SoA state (positions, velocities, forces, masses, charges)
  diagnostics // last diagnostics snapshot (optional)
}
```

### Simulation Step (Velocity Verlet)

1. Zero force accumulator arrays.
2. For each enabled force, loop unordered pairs (i<j) within the cutoff and accumulate antisymmetric forces.
3. Integrator first pass: advance positions + half‑step velocities.
4. Recompute forces at new positions.
5. Integrator second pass: finish velocity update.
6. Visualization layer copies the updated SoA arrays into Three.js buffers and rescales arrows.

## Getting Started

Run locally:

```bash
git clone https://github.com/tslmy/md.js.git
cd md.js
npm install
npm start   # builds then serves via Python http.server
# then open http://127.0.0.1:8000/
```

Any static server works; module scripts require HTTP (not file://). You can also just run:

```bash
python -m http.server --directory .
```

### Dev Workflow Commands

```bash
npm run build       # tsc compile -> built/
npm run watch       # incremental rebuild
npm run typecheck   # strict type checking (no emit)
npm test            # run aggregated test suite
npm run test:cov    # full test suite + c8 coverage report
npm run smoke       # quick headless Puppeteer sanity test
npm run clean       # remove build output
```

### File Layout (selected)

```text
src/
  core/
    simulation/ (state, integrators, driver, serialization)
    forces/     (coulomb, gravity, lennardJones, interfaces)
  particleSystem.ts  (Three.js particle + trajectory construction)
  script.ts          (runtime wiring & main loop)
  settings.ts        (central config)
  engine/persistence/persist.ts    (engine snapshot serializer)
  engine/persistence/storage.ts    (browser localStorage helpers)
```

## Configuration & Tuning

Key tunables (see `settings.ts`):

* `particleCount` – total particles (including optional sun).
* `dt` – timestep (simulation stability vs. speed trade‑off).
* `cutoffDistance` – pair evaluation radius (lower = faster, less accurate for long‑range forces).
* Force constants: `EPSILON`, `DELTA` (LJ ε & σ), `G` (gravity), `K` (Coulomb), `kB` (Boltzmann constant for temperature estimate).
* Display flags: `if_showTrajectory`, `if_showArrows`, `if_useFog`, etc.
* Physics flags: `if_makeSun`, `if_use_periodic_boundary_condition`, `if_constant_temperature`.

Hot‑reloading values via the UI updates behavior immediately; persisted snapshots capture resulting masses/charges/velocities.

## Tests & Quality Gates

Test scripts (see `scripts/`):

* `smoke` – Headless Puppeteer: particles move, persistence log appears.
* `forcestest` / `force-sym` – Validate force computation, antisymmetry, zero net force.
* `energy` – Track energy drift (numerical stability sanity check).
* `pairs` – Pair iteration correctness.
* `centerstest` & negative variant – Behavior of “center the sun” reference frame.
* `persist` – Save / restore end‑to‑end.
* `coretest` – Core simulation unit style checks.

Aggregate runner (`npm test`) executes all and reports PASS/FAIL summary. Coverage (`npm run test:cov`) generates `coverage/lcov-report/`.

## Persistence Details

On `beforeunload` the engine emits a compact JSON snapshot (`EngineSnapshot`) saved to `localStorage` under `mdJsEngineSnapshot` via `engine/persistence/storage.ts`. The snapshot contains:

* Config (forces enabled, constants, dt, cutoff, world size)
* Time
* Positions, velocities (flattened 3N arrays) and masses, charges (N each)

On load, `loadFromLocal()` attempts to hydrate the engine. If parsing or version validation fails, a fresh universe is created. To clear stored state:

```js
localStorage.removeItem('mdJsEngineSnapshot')
```

## Contributing

Ideas / PRs welcome. Low‑friction areas:

* Add new integrators (e.g. leapfrog, RK4 for comparison) – implement the `Integrator` interface.
* Add additional force fields (e.g. harmonic bonds) – implement `ForceField` and append in `script.ts` when enabled.
* Performance: introduce cell / neighbor lists replacing O(N²) in `forEachPair`.
* WebWorker offload for force computation – serialize/hydrate state via `serialize.ts`.
* UI polish / responsive layout / VR ergonomics.
* Typing & cleanup: remove legacy OO duplication once SoA path fully drives rendering.

Coding conventions:

* TypeScript strict mode; prefer explicit types for exported APIs.
* Keep force implementations side‑effect free except for accumulating into `state.forces`.
* Avoid premature abstractions; small helpers > deep class hierarchies.

## Roadmap Sketch

* Spatial acceleration structure (cell list or Verlet neighbor list).
* Off‑main‑thread simulation loop (Web Worker + transferable buffers).
* Configurable thermostat (e.g. Berendsen / Langevin) instead of simple velocity scaling.
* Basic energy diagnostics panel (potential, kinetic, total vs. time graph).
* Save / load presets (JSON export + import UI).
* Optional bundler (Vite / esbuild) if code splitting or asset pipeline grows.

### Engine Extension Points

Pluggable pieces (current & roadmap):

* Forces (implement `ForceField` – accumulate pair forces, optional potential)
* Integrators (`Integrator` interface)
* Thermostats / constraints (future hook points before/after integration)
* Neighbor list strategy (future: replace naive O(N²) pair iterator)
* Persistence / remote execution (worker bridge planned)

Example minimal usage (already what `script.ts` does):

```ts
import { SimulationEngine } from './engine/SimulationEngine.js'
import { fromSettings } from './engine/config/types.js'
import { settings } from './settings.js'
const engine = new SimulationEngine(fromSettings(settings))
engine.on('frame', f => {/* update visuals */})
engine.on('diagnostics', d => {/* show energy, temperature */})
engine.run()
```

### Neighbor List Strategies

The engine can swap the pair iteration backend used by all force fields:

* `cell` (default) – experimental uniform linked‑cell grid. Partitions space into cubic cells of edge ≈ cutoff and only inspects the 27 neighboring cells per particle. For roughly uniform densities this trends toward O(N) scaling.
* `naive` – classic O(N²) loop over unordered pairs with early distance cutoff (kept as a correctness reference & for very small N).

Configuration (when constructing or patching engine config):

```ts
const cfg = fromSettings(settings)
cfg.neighbor = { strategy: 'naive' } // optional; default is 'cell'
const engine = new SimulationEngine(cfg)

// Switch at runtime:
engine.updateConfig({ neighbor: { strategy: 'naive' } }) // or switch back to cell
```

Current limitations of `cell`:

* Heuristic cubic bounding box (no explicit world extents yet); particles wandering far are clamped to edge cells (still correct, a bit more pair work near edges).
* Always rebuilds every step (no Verlet “skin” optimization yet).
* No periodic wrapping; adding PBC requires mapping neighbor lookups across opposite faces.

Planned improvements: configurable box, rebuild cadence based on max displacement, optional Verlet shell, and a benchmarking harness to report pair counts & timings.
