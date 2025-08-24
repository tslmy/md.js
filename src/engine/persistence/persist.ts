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
  version: 1
  config: EngineConfig
  time: number
  /** Flat arrays (length 3N or N). */
  positions: number[]
  velocities: number[]
  masses: number[]
  charges: number[]
}

/** Capture a snapshot of the current engine state (copying arrays). */
export function snapshot(engine: SimulationEngine): EngineSnapshot {
  const st = engine.getState()
  const N = st.N
  return {
    version: 1 as const,
    config: engine.getConfig(),
    time: st.time,
    positions: Array.from(st.positions.subarray(0, 3 * N)),
    velocities: Array.from(st.velocities.subarray(0, 3 * N)),
    masses: Array.from(st.masses.subarray(0, N)),
    charges: Array.from(st.charges.subarray(0, N))
  }
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
  eng.setTime(snap.time)
  return eng
}

// NOTE: This module intentionally does not touch browser storage. See `storage.ts` for
// localStorage integration helpers to avoid coupling core snapshot logic to a host API.

// (Removed deprecated configFromSettings helper; construct EngineConfig via fromSettings directly where needed.)
