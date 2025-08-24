/**
 * Engine persistence utilities.
 *
 * These functions intentionally capture *only* the simulation domain state – no
 * visualization or HUD specific data. The snapshot is a plain JSON‑serializable
 * object (typed arrays flattened) suitable for localStorage or postMessage.
 */
import type { EngineConfig } from '../config/types.js'
import { SimulationEngine } from '../SimulationEngine.js'

/** Serialized representation of engine core state. */
export interface EngineSnapshot {
  /** Snapshot schema version (increment when layout changes). */
  version: 1
  /** Deep clone of the engine configuration at snapshot time. */
  config: EngineConfig
  /** Simulation time. */
  time: number
  /** Flattened particle positions (xyz * N). */
  positions: number[]
  /** Flattened particle velocities (xyz * N). */
  velocities: number[]
  /** Per-particle masses (length N). */
  masses: number[]
  /** Per-particle charges (length N). */
  charges: number[]
  /** Escaped flags (length N, 0|1). */
  escaped: number[]
  /** Optional per-particle trajectory position buffers (flattened xyz * maxTrajectoryLength). */
  trajectories?: number[][]
  /** Optional max trajectory length used when capturing trajectories (informational). */
  maxTrajectoryLength?: number
}

/** Capture a snapshot of the current engine state (copying arrays).
 * @param engine The simulation engine
 * @param opts Optional extras (visual layer data) – kept optional so core callers remain unaffected.
 */
export function snapshot(engine: SimulationEngine, opts?: { trajectories?: number[][]; maxTrajectoryLength?: number }): EngineSnapshot {
  const st = engine.getState()
  const N = st.N
  const base: EngineSnapshot = {
    version: 1 as const,
    config: engine.getConfig(),
    time: st.time,
    positions: Array.from(st.positions.subarray(0, 3 * N)),
    velocities: Array.from(st.velocities.subarray(0, 3 * N)),
    masses: Array.from(st.masses.subarray(0, N)),
    charges: Array.from(st.charges.subarray(0, N)),
    escaped: Array.from(st.escaped.subarray(0, N))
  }
  if (opts?.trajectories && opts.trajectories.length) {
    base.trajectories = opts.trajectories
    if (opts.maxTrajectoryLength) base.maxTrajectoryLength = opts.maxTrajectoryLength
  }
  return base
}

/**
 * Create a new engine from a prior snapshot. Caller can then call run().
 * Assumes snapshot integrity was previously validated.
 */
export function hydrate(snap: EngineSnapshot): SimulationEngine {
  if (snap.version !== 1) throw new Error('Unsupported snapshot version ' + String((snap as { version: number }).version))
  const eng = new SimulationEngine(snap.config)
  eng.seed({
    positions: Float32Array.from(snap.positions),
    velocities: Float32Array.from(snap.velocities),
    masses: Float32Array.from(snap.masses),
    charges: Float32Array.from(snap.charges)
  })
  // Copy escaped flags directly (engine getState returns live reference)
  const st = eng.getState()
  if (snap.escaped?.length === st.escaped.length) {
    for (let i = 0; i < st.escaped.length; i++) st.escaped[i] = snap.escaped[i] as 0 | 1
  }
  eng.setTime(snap.time)
  return eng
}

// NOTE: This module intentionally does not touch browser storage. See `storage.ts` for
// localStorage integration helpers to avoid coupling core snapshot logic to a host API.

// (Removed deprecated configFromSettings helper; construct EngineConfig via fromSettings directly where needed.)
