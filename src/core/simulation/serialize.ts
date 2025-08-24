import { createState, type SimulationState } from './state.js'

/**
 * Plain JSON-friendly snapshot of a {@link SimulationState}. All typed arrays
 * are flattened into regular JS number arrays so the structure can be
 * serialized (e.g. structured clone, postMessage, localStorage) without
 * transferring ownership of the original buffers.
 */
export interface SerializedSimulationState {
  /** Particle count. */
  N: number
  /** Simulation time. */
  time: number
  /** Flattened positions (xyz * N). */
  positions: number[]
  /** Flattened velocities (xyz * N). */
  velocities: number[]
  /** Flattened forces (xyz * N). */
  forces: number[]
  /** Per-particle masses (length N). */
  masses: number[]
  /** Per-particle charges (length N). */
  charges: number[]
  /** Escape flags (length N). */
  escaped: number[]
}

/** Convert typed-array state into plain JSON-friendly object. */
export function serializeState(state: SimulationState): SerializedSimulationState {
  return {
    N: state.N,
    time: state.time,
    positions: Array.from(state.positions),
    velocities: Array.from(state.velocities),
    forces: Array.from(state.forces),
    masses: Array.from(state.masses),
    charges: Array.from(state.charges),
    escaped: Array.from(state.escaped)
  }
}

/** Reconstruct a SimulationState (fresh typed arrays) from serialized snapshot. */
export function hydrateState(s: SerializedSimulationState): SimulationState {
  const params = { particleCount: s.N, box: { x: 0, y: 0, z: 0 }, dt: 0, cutoff: 0 }
  const state = createState(params)
  state.time = s.time
  state.positions.set(s.positions)
  state.velocities.set(s.velocities)
  state.forces.set(s.forces)
  state.masses.set(s.masses)
  state.charges.set(s.charges)
  state.escaped.set(s.escaped)
  return state
}
