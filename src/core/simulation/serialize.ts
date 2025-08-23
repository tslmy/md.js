import { createState, type SimulationState } from './state.js'

export interface SerializedSimulationState {
  N: number
  time: number
  positions: number[]
  velocities: number[]
  forces: number[]
  masses: number[]
  charges: number[]
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
