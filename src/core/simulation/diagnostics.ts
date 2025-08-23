import { SimulationState } from './state.js'
import { forEachPair, ForceField } from '../forces/forceInterfaces.js'
import { Gravity } from '../forces/gravity.js'
import { Coulomb } from '../forces/coulomb.js'
import { LennardJones } from '../forces/lennardJones.js'

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
function computePotential(state: SimulationState, forces: ForceField[], cutoff: number): number {
  let pot = 0
  for (const f of forces) {
    if (f instanceof Gravity) {
      const G = (f as unknown as { params: { G: number } }).params.G
      const { masses } = state
      forEachPair(state, cutoff, (i, j, dx, dy, dz, r2) => {
        if (r2 === 0) return
        const r = Math.sqrt(r2)
        pot += -G * (masses[i] || 1) * (masses[j] || 1) / r
      })
    } else if (f instanceof Coulomb) {
      const K = (f as unknown as { params: { K: number } }).params.K
      const { charges } = state
      forEachPair(state, cutoff, (i, j, dx, dy, dz, r2) => {
        if (r2 === 0) return
        const r = Math.sqrt(r2)
        pot += K * (charges[i] || 0) * (charges[j] || 0) / r
      })
    } else if (f instanceof LennardJones) {
      const { epsilon, sigma } = (f as unknown as { params: { epsilon: number; sigma: number } }).params
      forEachPair(state, cutoff, (i, j, dx, dy, dz, r2) => {
        if (r2 === 0) return
        const invR2 = 1 / r2
        const sr2 = (sigma * sigma) * invR2
        const sr6 = sr2 * sr2 * sr2
        const sr12 = sr6 * sr6
        pot += 4 * epsilon * (sr12 - sr6)
      })
    }
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
