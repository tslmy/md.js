import { SimulationState, index3 } from '../simulation/state.js'
import { ForceContext, ForceField, forEachPair } from './forceInterfaces.js'

/**
 * Lennard‑Jones 12‑6 potential.
 *
 * Intuition for non-physics maintainers:
 *  - At very short distance particles repel strongly (prevents overlap).
 *  - At moderate distance there's a mild attraction (models van der Waals bonding tendency).
 *  - Beyond the cutoff we ignore interaction to save time.
 *
 *  V(r) = 4 ε [ (σ / r)^12 − (σ / r)^6 ]
 *  F(r) = − dV/dr  (directed along displacement vector)
 *        = 24 ε [ 2 (σ/r)^12 − (σ/r)^6 ] / r^2  * (dx,dy,dz)
 * (The 1/r^2 factor shown here already appears after simplifying -(d/dr)( (σ/r)^n ) patterns and multiplying by unit vector.)
 *
 * Physical intuition (in reduced units):
 *  - r << σ : strong repulsion (Pauli exclusion mimic) ~ (σ/r)^12 term dominates.
 *  - r ≈ 1.122σ (minimum) : attractive and lowest potential.
 *  - r >> σ : weak attraction tails off ~ (σ/r)^6 (dispersion / van der Waals).
 *
 * Parameters:
 *  - epsilon: depth of the potential well (overall interaction strength).
 *  - sigma: distance where potential crosses zero (~"size" of particle core).
 * Implementation details:
 *  - Uses a standard analytical derivative giving the vector force without computing expensive roots repeatedly.
 *
 * Implementation notes:
 *  - We compute sr2 = (σ^2)/r^2 then sr6 = sr2^3, sr12 = sr6^2 to avoid repeated pow().
 *  - Force magnitude coefficient: 24 ε (2 sr12 − sr6) / r^2, multiplied by displacement components.
 *  - We early exit on r2 === 0 to avoid division by zero (overlapping particles). Overlap is rare and usually corrected by
 *    repulsive acceleration next steps; resolving via position shift is left as future work / constraints.
 *  - This implementation does not shift or truncate the potential at cutoff (i.e. V(r_cut) ≠ 0). For stability-sensitive
 *    long runs one could apply a tail correction or shifted-force variant (documented but not yet needed here).
 */

export interface LennardJonesParams { epsilon: number; sigma: number }

export class LennardJones implements ForceField {
  readonly name = 'lennardJones'
  constructor(private readonly params: LennardJonesParams) { }
  apply(state: SimulationState, ctx: ForceContext): void {
    const { epsilon, sigma } = this.params
    const { forces } = state
    forEachPair(state, ctx.cutoff, (i, j, dx, dy, dz, r2) => {
      if (r2 === 0) return
      const i3 = index3(i)
      const j3 = index3(j)
      const invR2 = 1 / r2
      const sr2 = (sigma * sigma) * invR2
      const sr6 = sr2 * sr2 * sr2
      const sr12 = sr6 * sr6
      const coeff = 24 * epsilon * (2 * sr12 - sr6) * invR2 // already /r^2, multiply by vector components
      const fx = coeff * dx
      const fy = coeff * dy
      const fz = coeff * dz
      forces[i3] += fx
      forces[i3 + 1] += fy
      forces[i3 + 2] += fz
      forces[j3] -= fx
      forces[j3 + 1] -= fy
      forces[j3 + 2] -= fz
    })
  }
  /** Total Lennard-Jones potential energy: Σ 4ε[(σ/r)^12 - (σ/r)^6] over unique pairs within cutoff. */
  potential(state: SimulationState, ctx: ForceContext): number {
    const { epsilon, sigma } = this.params
    let V = 0
    forEachPair(state, ctx.cutoff, (i, j, dx, dy, dz, r2) => {
      if (r2 === 0) return
      const invR2 = 1 / r2
      const sr2 = (sigma * sigma) * invR2
      const sr6 = sr2 * sr2 * sr2
      const sr12 = sr6 * sr6
      V += 4 * epsilon * (sr12 - sr6)
    })
    return V
  }
}
