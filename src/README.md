# Simulation Engine API

This document collects the public (and semi-public) surface of the physics / engine layer for contributors. The browser build only *intentionally* exposes a tiny unstable debug object on `window.__mdjs`; consumers embedding the library directly should import the TypeScript modules instead.

> Stability: Unless otherwise marked, everything here is **alpha** and may change. The intent of documenting now is to ease contributions & reviews.

## Core Types

- `SimulationState` – Structure-of-Arrays container (positions, velocities, forces, masses, charges, escaped, time, N). The authoritative in‑memory snapshot. Mutated only by integrators / force accumulation.
- `EngineConfig` – High level configuration passed to `SimulationEngine` (world, runtime, forces, constants, neighbor). Built via `buildEngineConfig(settings)` from unified `SETTINGS_SCHEMA`.
- `ForceField` – Interface: `{ name: string; apply(state, ctx): void; potential?(state, ctx): number }`.
- `Integrator` – Interface: `{ step(state, dt, recomputeForces): void }`.

## SimulationEngine

Construction:

```ts
import { SimulationEngine } from './engine/SimulationEngine.js'
import { buildEngineConfig } from './engine/config.js'
import { settings } from './control/settings.js'
const engine = new SimulationEngine(buildEngineConfig(settings))
```

Key methods:

- `on(event, handler)` – Subscribe to engine events. Returns unsubscribe.
- `run({ useRaf = true, intervalMs? })` – Begin continuous stepping.
- `pause()` – Stop continuous stepping (manual `step()` still allowed).
- `step()` – Single integration step (emits a frame + optional diagnostics).
- `updateConfig(patch)` – Shallow patch of `EngineConfig` (rebuilds forces & neighbor strategy; resizes state if particleCount changes).
- `getState()` – Returns the *live* mutable `SimulationState` reference (read‑only usage strongly encouraged). If you need a snapshot, copy the arrays.
- `getConfig()` – Returns a deep clone of current config.
- `seed({ positions?, velocities?, masses?, charges? })` – Shallow copies provided typed arrays into the internal state (lengths are truncated to current N). Use only before running or for deterministic test setup.
- `resizeParticleCount(newN)` – Reallocate SoA buffers, preserving prefix of existing data. Emits `stateReallocated`.
- `getPerForceContributions()` – Map of force name -> Float32Array (length 3N) with per-force force-vector components (diagnostics UI).
- `getForces()` – Current `ForceField[]` list (treat read-only).
- `setTime(t)` – Adjust accumulated simulation time (used during hydrate / persistence restore).

### Events

Event names & payloads (TypeScript interface: `EngineEvents`):

- `frame`: `{ time, state, step }` – After each integration step.
- `diagnostics`: `Diagnostics` – Emitted at a fixed cadence (currently every step) containing kinetic, potential, total energy, temperature, extrema.
- `config`: `EngineConfig` – After a config patch is applied.
- `error`: `Error` – Uncaught error during `step()`; engine auto‑pauses.
- `stateReallocated`: `SimulationState` – After buffers resized (particle count change).
- `wrap`: `{ wraps: WrapRecord[] }` – After periodic boundary wrapping when ≥1 particle was teleported; contains per-particle displacement, surfaces crossed and detailed crossing points (exit/entry) enabling continuous trajectory stitching.

### Neighbor List Strategies

Selected via `config.neighbor.strategy` or later `updateConfig({ neighbor: { strategy: 'cell' } })`.

- `naive` – O(N²) pair iteration; correctness baseline.
- `cell` – Uniform linked‑cell grid sized from box extents; rebuilds every step; supports PBC + minimum‑image.

Internally strategies install their `forEachPair` implementation globally for all forces by calling `activateNeighborStrategy(strategy)`. Force code stays agnostic.

### Periodic Boundary Conditions (PBC)

Enable with `runtime.pbc: true`. Effects:

- Positions wrapped into primary cell `[-Lx,Lx] × [-Ly,Ly] × [-Lz,Lz]` after each step (engine owns this teleport; visual layer reacts through `wrap` event).
- Pair displacements in force accumulation use minimum‑image convention (handled in pair iterator / cell strategy).
- Ewald force implementations (gravity, Coulomb) switch to real + reciprocal space splits when PBC is on.

### Persistence

See `engine/persist.ts`:

- `snapshot(engine)` -> plain object (JSON‑serializable) carrying config, time, flattened arrays.
- `hydrate(snapshot)` -> new `SimulationEngine` with buffers populated.
- `saveToLocal(engine)` / `loadEngineFromLocal()` wrap localStorage under key `mdJsEngineSnapshot`.

### Diagnostics

`computeDiagnostics(state, forces, { cutoff, kB })` returns:

```text
{ time, kinetic, potential, total, temperature, maxSpeed, maxForceMag }
```
Temperature uses equipartition: `KE = (3N-3)/2 kB T` (subtracting 3 center-of-mass momentum DOF).

### Extending

Add a new force:

```ts
class MyForce implements ForceField {
  name = 'myForce'
  apply(state, ctx) { /* accumulate into state.forces */ }
  potential(state, ctx) { /* optional */ return 0 }
}
engine.getForces().push(new MyForce())
```
Or wrap in a config flag and rebuild via `updateConfig` for hot‑toggle.

Add a new integrator: implement `Integrator.step` then allow selection via adding an enum value and handling in `SimulationEngine.buildSimulation()`.

Introduce a new neighbor strategy: implement `NeighborListStrategy` (`rebuild`, `forEachPair`, `rebuildEveryStep`) and expose a factory returning the object. Call `activateNeighborStrategy(strategy)` after construction.

### Reference Frame Helpers

The runtime layer (`script.ts`) derives a frame offset each render (fixed | sun | com) but does **not** mutate the engine positions; tests that need centered coordinates look at the `displayPositions` array (swapped in as `simState.positions` on the debug surface). This keeps physics canonical while enabling ergonomic visualization / assertions.

---

Suggestions / corrections welcome – open a PR or issue.
