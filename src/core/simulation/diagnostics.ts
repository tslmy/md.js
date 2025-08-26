import { SimulationState } from './state.js'
import { ForceField } from '../forces/forceInterfaces.js'

/**
 * Snapshot of high‑level physical metrics for a simulation state.
 * All values are derived from current buffers; function is side‑effect free.
 *  - kinetic:   KE = 1/2 Σ m_i |v_i|^2
 *  - potential: Σ over active forcefield potentials (recomputed each call; O(F * pairCount)).
 *  - total:     KE + PE
 *  - temperature: Equipartition (classical, 3 translational DOF per particle) KE = (f/2) k_B T with f = 3N − 3
 *                 (subtract 3 to remove center‑of‑mass momentum modes so drifting bulk motion does not inflate T).
 *  - extrema: max |v| and |F| for adaptive UI scaling (arrow normalization) and quick stability heuristics.
 *
 * Potential energy cost remark: At present each ForceField with a `potential` implementation iterates pairs again.
 * For large N one can:
 *  - Share the pair loop (accumulate multiple potentials / forces simultaneously), or
 *  - Cache per‑pair intermediate scalars (e.g. 1/r^2) in a scratch buffer reused by forces.
 * Given demo scale the clarity > micro‑performance trade was chosen.
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
 * Internal helper: single pass over all particles to accumulate kinetic energy
 * and discover max |v| and |F|. Kept separate so alternative diagnostics (e.g.
 * streaming / incremental) can reuse this logic.
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
 * the same O(N^2) pair iterator with cutoff as force accumulation (or periodic
 * variant if implemented). Periodic Ewald forces provide their own potential.
 * NOTE: This duplicates pair iteration per force and is intentionally simple
 * for an initial diagnostics step (can be optimized by sharing pair loops later).
 */
function computePotential(state: SimulationState, forces: ForceField[], _cutoff: number): number {
  let pot = 0
  for (const f of forces) if (f.potential) pot += f.potential(state, { cutoff: _cutoff })
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
