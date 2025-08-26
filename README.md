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

![mdjs demo 720p](https://github.com/user-attachments/assets/a52df2cd-2e53-4bde-a967-6ca7e53da101)

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
* [Periodic boundary conditions][pbc] (wrap in x/y/z) – physical position wrapping + minimum‑image forces, with semi‑transparent ghost copies for the 26 neighbor cells.
* Configurable world size, particle count, masses, charges, timestep `dt`, cutoff radius.
* Optional constant temperature mode (simple velocity rescale, off by default).
* Trajectories with fading color gradients.
* “Follow the sun” reference frame toggle.
* Force & velocity HUD table (speed, KE, total force magnitude per particle).
* Live arrow scaling & optional capping of maximum arrow length.
* Local persistence: full snapshot saved to `localStorage` on unload and restored next load.

## Architecture Overview

The code base separates a **physics engine** (data + force/integration pipeline) from the **visualization layer** (Three.js scene graph + HUD) via an event boundary.

For a concise catalog of engine classes, events and extension points see: [Simulation Engine API](src/README.md).

### Simulation Core (`src/core/`)

This module is responsible for the physics computation.

To physicists/chemists without a programming background, the most relevant part is perhaps the `force/` folder. It hosts scripts that each defines a force field (Lennard‑Jones, gravity, and Coulomb). When PBC is enabled, gravity and coulomb calculations are replaced with Ewald summations. LJ potential, however, is employed as-is, assuming that the cut-off distance is way smaller than half the extent of the bounding box.

At any given timestep, instantaneous quantities of all particles (namely, velocities, positions, and forces) are described by a `SimulationState`. An integrator then iterates through all force fields to update the velocities and the positions at each timestep. That's the basic idea of all simulation software of molecular dynamics.

In the `simulation/` subdirectory:

* `Simulation.ts` – Low‑level timestep driver used internally by the high‑level engine.
* At each timestep, the computation involves many considerations, each of which may be implemented with different strategies:
  * `integrators.ts` – Integrator strategies (currently Explicit Euler & Velocity Verlet). Verlet is the default for better energy behavior.
  * `neighborList.ts` – Neighbor list strategies (naive O(N²) and uniform cell list) with periodic indexing + minimum‑image support when PBC active.
* Several scripts are used during **initialization** of simulations:
  * `seeding.ts` - Responsible for randomly picking physical quantities for a particle during the initialization of a simulation. Note that non-physical properties, such as color, is not within the scope of `core/`.
  * `orbitInit.ts` - When randomly generating a new simulation with a "sun particle", we may initialize other particles with velocities that make them orbiting around the "sun". This is eye-candy only, merely for giving some visually-pleasing trajectories. Stability of this little "solar system" is not guaranteed.
* `diagnostics.ts` - At times, you may want to look at numbers rather than flying spheres. This script derives all the quantities that does not affect simulation but may be informational to a user. They include potential energies, kinetic energies, temperature, etc. These numerical data are then emitted to `coloringAndDataSheet.ts`, which renders a "heads-up display" (HUD) table.
* `state.ts` – Structure‑of‑Arrays (`positions`, `velocities`, `forces`, `masses`, `charges`, flags). Functions: `createState`, `zeroForces`.
* `serialize.ts` – Serialize / hydrate typed arrays to plain objects (future: use for cross‑tab sharing or worker offloading).

### Orchestration Engine (`src/engine/`)

The engine drives the simulation to evolve and emits "please render graphics" events to the visualization layer.

* `SimulationEngine.ts` – High‑level orchestrator: owns mutable SoA state, rebuilds force plugin list on config changes, emits `frame` & `diagnostics` events, and shields the rest of the app from direct mutation.
* `config.ts` – Defines configuration options (and provide configurability) of everything that may affect how a simulation unfolds.
* `settingsSync.ts` - Binds configuration changes bidirectionally across the simulation and the GUI control pane. This allows you to change physical constants or change computation strategies on-the-fly.
* `persist.ts` – Snapshot / hydrate utilities (JSON‑serializable) for future cross‑tab or worker scenarios.

### Visualization & UI Layer

This layer is made up of several modules and some top-level scripts. The top-level scripts in `src/` are:

* `init.ts` – Scene bootstrap: lights, camera, renderer, GUI.
* `script.ts` – Runtime wiring: calls `init.ts`, constructs / hydrates engine, mirrors SoA state into instanced meshes, HUD & persistence.

A "control and settings" module sits under `src/control/`:

* `panel.ts` - Intializes a panel UI and wires controls to corresponding settings (such as physical constants and feature toggles) & commands (such as re-initializing the world and halting a simulation mid-way).
* `settings.ts` – Central tweakable parameters + feature flags; intentionally verbose / “kitchen sink” for experimentation.
* `persist.ts` - Stores and loads settings.

A rendering module is located at `src/visual/`:

* `coloringAndDataSheet.ts` - Seeds colors for particles and adds rows to the HUD/Data Sheet. You can toggle on/off the HUD by pressing the `tab` key.  
  <img width="800" alt="image" src="https://github.com/user-attachments/assets/7b025de5-2902-4c55-ad51-b7cda8cc12b1" />
* Several visual-aid features are available:
  * `wrapMarkers.ts` - When PBC is applied, the simulation is bound by a box. Any particle attempting to cross this box will be wrapped ("teleported") to the opposite face. To facilitate visual intuition, a transient ring marker will be drawn on the exit point and another on the entry point. The visual style is inspired by [the video game series, _Portal_](https://en.wikipedia.org/wiki/Portal_(series)).
    <img width="415" height="131" alt="image" src="https://github.com/user-attachments/assets/7c4fd7e5-621a-4dc4-aea4-ebffcc7a2400" />
  * `trajectory.ts` - As particle moves in space, a trajectory traces its path. This file manages that.  
    <img width="700" alt="image" src="https://github.com/user-attachments/assets/eae89324-8adb-4a72-920f-78212d8ceca5" />
  * `arrows.ts` - Two arrows stick out from each particle. One indicates the velocity, the other net force. This script handles that.  
    <img width="380" alt="image" src="https://github.com/user-attachments/assets/d7fdfbc8-27df-4dda-b308-2b4e865ce118" />
* There are several scripts that deals with how THREE.js draws things:
  * `InstancedSpheres.ts` – Batched instanced sphere renderer (primary + PBC clone copies for visualization).
  * `InstancedArrows.ts` – Batched instanced arrows (velocity & net force) with per‑frame normalization & capping.
  * `drawingHelpers.ts` - Helper functions that plot boxes and lines.
* `persist.ts` - Stores and loads information about visual aids, such as trejectories and particle colors. Note that velocity & net force arrows are not persisted, because they can be derived from simulation state data that are persisted in the engine module.

### Public (Test) Surface

When running in a browser the following is exposed for **debug & automated smoke tests only** (not a stable API):

```js
window.__mdjs = {
  particles, // visual metadata (color, mass, charge, trajectory) – positions now live only in simState
  settings,  // live settings object
  simState,  // authoritative SoA state (positions, velocities, forces, masses, charges)
  diagnostics // last diagnostics snapshot (optional)
}

// NOTE: Particle objects no longer have a `position` Vector3. Read/write world coordinates via simState.positions:
// const { positions } = window.__mdjs.simState; const x0 = positions[0]; const y0 = positions[1]; const z0 = positions[2]
```

### Simulation Step (Velocity Verlet + PBC)

1. Zero force accumulator arrays.
2. For each enabled force, iterate unordered pairs within cutoff (neighbor strategy) using minimum‑image displacement if PBC enabled; accumulate antisymmetric forces.
3. Integrator first pass: advance positions + half‑step velocities.
4. Recompute forces at new (possibly wrapped) positions.
5. Integrator second pass: finish velocity update.
6. Wrap positions back into primary box ([-Lx,Lx], etc.) if PBC active.
7. Visualization updates instanced meshes and renders semi‑transparent ghost copies for spatial context.

### Periodic Boundary Conditions

Enabling `if_use_periodic_boundary_condition` (UI) / `runtime.pbc` (engine) now affects PHYSICS, not just visuals:

* Positions: wrapped after every integration step.
* Forces: use minimum‑image convention (component folded into (−L, L]).
* Neighbor lists: cell strategy performs periodic cell indexing & minimum‑image deltas without duplicate pair inflation.
* Visuals: 26 ghost cell images rendered at 50% opacity.

Guideline: choose cutoff ≤ min(box half‑lengths) so minimum‑image is unambiguous.

## Getting Started

Run locally:

```bash
git clone https://github.com/tslmy/md.js.git
cd md.js
npm install
npm start   # builds then serves via 'serve'
# open http://127.0.0.1:8000/
```

For iterative development with auto‑rebuild + restart you can use:

```bash
npm run dev  # rebuilds on changes then restarts static server
```

Under the hood this uses the off‑the‑shelf `serve` package (no custom server code). You can still use any other static server.

### Dev Workflow Commands

```bash
npm run build       # tsc compile -> built/
npm run watch       # incremental rebuild
npm run typecheck   # strict type checking (no emit)
npm test            # run vitest suite (headless + browser harness)
npm run test:cov    # full test suite + v8 coverage report
npm run clean       # remove build output
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

Vitest suite lives in `tests/` and covers:

* Force symmetry & correctness (`forces.test.ts`, `pairs.test.ts`).
* Neighbor list strategies & cell sizing (`neighbor*.test.ts`).
* Engine config validation & persistence (`configValidation.test.ts`, `persistence.test.ts`, `enginePersist.test.ts`).
* Energy / diagnostics drift (`energy.test.ts`).
* Browser harness smoke (`browser.test.ts`) ensuring particles advance & HUD wiring.
* Contribution / integration surfaces (`simulationContrib.test.ts`, `engine.test.ts`).

Run `npm test` for fast feedback; `npm run test:cov` emits coverage to `coverage/lcov-report/`.

## Persistence Details

On `beforeunload` the engine emits a compact JSON snapshot (`EngineSnapshot`) saved to `localStorage` under `mdJsEngineSnapshot` via `engine/persistence/storage.ts`. The snapshot contains:

* Config (forces enabled, constants, dt, cutoff, world size)
* Time
* Positions, velocities (flattened 3N arrays) and masses, charges (N each)

On load, `loadFromLocal()` attempts to hydrate the engine. If parsing or version validation fails, a fresh universe is created. To clear stored state:

```js
localStorage.removeItem('mdJsEngineSnapshot')
```

All modules, except the stateless math-only module `core`, has a `persist.ts` that is responsible for its own data persistence.

## Contributing

Ideas / PRs welcome. Low‑friction areas:

* Add new integrators (e.g. leapfrog, RK4 for comparison) – implement the `Integrator` interface.
* Add additional force fields (e.g. harmonic bonds) – implement `ForceField` and append in `script.ts` when enabled.
* Performance: introduce cell / neighbor lists replacing O(N²) in `forEachPair`.
* WebWorker offload for force computation – serialize/hydrate state via `serialize.ts`.
* UI polish / responsive layout / VR ergonomics.
* Further typing & refactors (e.g. optional WebWorker offload) are welcome; the older THREE.Points path has already been removed in favor of instanced rendering.

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
const engine = new SimulationEngine(fromSettings(settings)) // includes runtime.pbc derived from settings.if_use_periodic_boundary_condition
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

* Always rebuilds every step (no displacement tracking / Verlet “skin” yet).
* Fixed cell size = cutoff (no tuning factor yet).
* Assumes orthorhombic axis‑aligned box for minimum‑image math.

Recently addressed:

* Periodic indexing + minimum‑image force distances implemented.
* Grid sizing derives from world box extents.

Planned improvements: displacement‑tracked rebuild cadence, adaptive (skin) shell, tuned cell size factor, micro‑benchmark harness (pair counts & timings), off‑main‑thread force pipeline.
