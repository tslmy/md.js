/**
 * Engine persistence utilities.
 *
 * These functions intentionally capture *only* the simulation domain state – no
 * visualization or HUD specific data. The snapshot is a plain JSON‑serializable
 * object (typed arrays flattened) suitable for localStorage or postMessage.
 */
import type { EngineConfig } from './config/types.js'
import { SimulationEngine } from './SimulationEngine.js'
import { lsGet, lsRemove, lsSet } from '../util/storage.js'
const KEY = 'mdJsEngineSnapshot'

/** Serialized representation of engine core state. */
interface EngineSnapshot {
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
}

interface LoadResult {
  /** Hydrated engine instance (not started). */
  engine: SimulationEngine
  /** Raw snapshot used for hydration (for UI display / diff). */
  snapshot: EngineSnapshot
}

/** Capture a snapshot of the current engine state (copying arrays).
 * @param engine The simulation engine
 * @param opts Optional extras (visual layer data) – kept optional so core callers remain unaffected.
 */
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
    charges: Array.from(st.charges.subarray(0, N)),
    escaped: Array.from(st.escaped.subarray(0, N))
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
  // Copy escaped flags directly (engine getState returns live reference)
  const st = eng.getState()
  if (snap.escaped?.length === st.escaped.length) {
    for (let i = 0; i < st.escaped.length; i++) st.escaped[i] = snap.escaped[i] as 0 | 1
  }
  eng.setTime(snap.time)
  return eng
}
/** Serialize and persist the current engine snapshot into localStorage. */
export function saveToLocal(engine: SimulationEngine): void {
  try { lsSet(KEY, snapshot(engine)) } catch (e) { console.warn('Failed to save engine snapshot:', e) }
}

/** Attempt to load and hydrate a previously stored snapshot; returns null if absent or invalid. */
export function loadEngineFromLocal(): LoadResult | null {
  const snap = lsGet<EngineSnapshot>(KEY)
  if (!snap) return null
  if (snap.version !== 1) { console.warn('Unsupported snapshot version; ignoring'); return null }
  try { return { engine: hydrate(snap), snapshot: snap } } catch (e) { console.warn('Failed to hydrate snapshot:', e); return null }
}
/** Remove the stored snapshot (no-op if absent). */

export function clearEngineSnapshotInLocal(): void { lsRemove(KEY) }
