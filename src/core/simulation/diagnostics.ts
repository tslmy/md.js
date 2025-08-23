import { SimulationState } from './state.js'
import { ForceField } from '../forces/forceInterfaces.js'

/**
 * Snapshot of high‑level physical metrics for a simulation state.
 * All values are derived from the SoA buffers; no side effects.
 *  - kinetic: 1/2 Σ m v^2
 *  - potential: sum over enabled force field potentials (approximate; recomputed fresh each call)
 *  - total: kinetic + potential
 *  - temperature: derived from equipartition KE = (3N-3)/2 kB T (subtracting 3 for momentum DOF)
 *  - maxSpeed / maxForceMag: per-particle extrema (useful for UI scaling & stability diagnostics)
 */
export interface Diagnostics {
  /** Simulation time (same units as dt accumulation). */
  time: number
  /** Total kinetic energy. */
  kinetic: number
  /** Total potential energy (sum of active force field contributions). */
  potential: number
  /** kinetic + potential */
  total: number
  /** Instantaneous temperature estimate. */
  temperature: number
  /** Maximum particle speed (|v|). */
  maxSpeed: number
  /** Maximum force magnitude (|F|). */
  maxForceMag: number
}

/** Parameters needed for diagnostics derivations. */
interface DiagnosticsParams { cutoff: number; kB: number }

/**
 * Compute kinetic energy and per-particle extrema in a single pass.
 * Returns totals to avoid repeated iteration over N.
 */
function computeKineticAndExtrema(state: SimulationState): { kinetic: number; maxSpeed: number; maxForceMag: number } {
  const { velocities, forces, masses, N } = state
  let ke = 0
  let maxSpeed = 0
  let maxForce = 0
  for (let i = 0; i < N; i++) {
    const i3 = 3 * i
    const vx = velocities[i3], vy = velocities[i3 + 1], vz = velocities[i3 + 2]
    const speed2 = vx * vx + vy * vy + vz * vz
    ke += 0.5 * (masses[i] || 1) * speed2
    const speed = Math.sqrt(speed2)
    if (speed > maxSpeed) maxSpeed = speed
    const fx = forces[i3], fy = forces[i3 + 1], fz = forces[i3 + 2]
    const fmag = Math.hypot(fx, fy, fz)
    if (fmag > maxForce) maxForce = fmag
  }
  return { kinetic: ke, maxSpeed, maxForceMag: maxForce }
}

/**
 * Recompute total potential energy for currently enabled force fields using
 * the same O(N^2) pair iterator with cutoff as force accumulation.
 * NOTE: This duplicates pair iteration per force and is intentionally simple
 * for an initial diagnostics step (can be optimized by sharing pair loops later).
 */
function computePotential(state: SimulationState, forces: ForceField[], _cutoff: number): number {
  let pot = 0
  for (const f of forces) {
    // ForceField interface marks potential as optional; skip if absent
    if (f.potential) pot += f.potential(state, { cutoff: _cutoff })
  }
  return pot
}

/**
 * Produce a Diagnostics snapshot for the given state & active force fields.
 * Pure function: does not mutate state.
 */
export function computeDiagnostics(state: SimulationState, forces: ForceField[], params: DiagnosticsParams): Diagnostics {
  const { kinetic, maxSpeed, maxForceMag } = computeKineticAndExtrema(state)
  const potential = computePotential(state, forces, params.cutoff)
  const temperature = kinetic * 2 / params.kB / (3 * state.N - 3) // from KE = (3N-3)/2 kB T
  const total = kinetic + potential
  return { time: state.time, kinetic, potential, total, temperature, maxSpeed, maxForceMag }
}
