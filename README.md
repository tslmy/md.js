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

The code base intentionally separates **simulation core (data + physics)** from **visualization (Three.js scene graph)**.

### 1. Simulation Core (Structure‑of‑Arrays)

Located under `src/core/simulation` & `src/core/forces`:

* `state.ts` – Structure‑of‑Arrays (`positions`, `velocities`, `forces`, `masses`, `charges`, flags). Functions: `createState`, `zeroForces`.
* `Simulation.ts` – Orchestrates a timestep: clears forces, applies each `ForceField`, delegates numeric integration.
* `integrators.ts` – Integrator strategies (currently Explicit Euler & Velocity Verlet). Verlet is the default for better energy behavior.
* `forces/*.ts` – Individual `ForceField` implementations (Lennard‑Jones, Gravity, Coulomb) composed at runtime. Each uses a naïve O(N²) pair loop with an early distance cutoff. Optimization path: spatial hashing / cell lists / neighbor lists.
* `serialize.ts` – Serialize / hydrate typed arrays to plain objects (future: use for cross‑tab sharing or worker offloading).

### 2. Visualization & UI Layer

* `particleSystem.ts` – Builds particles, trajectories, ghost clones (for PBC visualization), HUD rows, and mirrors simulation data into Three.js constructs.
* `script.ts` – Entry point: initializes scene (delegates to `init.js`), seeds SoA state from legacy object instances, configures enabled forces, drives animation loop, rescales arrows & HUD each frame, handles persistence.
* `settings.ts` – Central tweakable parameters + feature flags; deliberately verbose / “kitchen sink” for experimentation.
* `stateStorage.ts` – Browser `localStorage` persistence (simple versioned schema checking).

### 3. Public (Test) Surface

When running in a browser the following is exposed for **debug & automated smoke tests only** (not a stable API):

```js
window.__mdjs = {
  particles,  // legacy OO particle objects (positions, velocities, forces)
  settings,   // live settings object
  simState    // SoA arrays (positions, velocities, forces, masses, charges)
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
  stateStorage.ts    (persistence)
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

On `beforeunload` a snapshot of every particle (color, position, velocity, force, mass, charge) and timestamps is stored in `localStorage` under `mdJsState`. On next load, a lightweight validation step guards against malformed data before rehydration; missing or invalid data triggers a fresh universe.

Remove persisted state manually via DevTools:

```js
localStorage.removeItem('mdJsState')
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

### Experimental Engine Refactor (In Progress)

An incremental `SimulationEngine` scaffold now lives under `src/engine/` alongside a draft configuration module. It currently wraps the existing `Simulation` class and emits `frame` events while we migrate responsibilities out of `script.ts`. This layer will evolve to own:

* Plugin registry (forces, thermostats, constraints)
* Neighbor list strategy abstraction
* Worker bridge & message protocol
* Versioned config + persistence schema
* Diagnostics / profiling emission

Early adopters can experiment:

```ts
import { SimulationEngine } from './engine/SimulationEngine.js'
import { legacySettingsToEngineConfig } from './engine/config/types.js'
import { settings } from './settings.js'

const engine = new SimulationEngine(legacySettingsToEngineConfig(settings))
engine.on('frame', ({ time, state }) => {
  // Read-only usage of typed arrays
  // console.log('t', time, state.positions[0])
})
engine.run()
```

Nothing in the legacy path depends on this yet; it is safe to ignore until the migration reaches a stable milestone.
