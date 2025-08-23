import { SimulationState, index3 } from '../simulation/state.js'
import { ForceContext, ForceField, forEachPair } from './forceInterfaces.js'

/**
 * Lennard-Jones force (short-range repulsion + weak longer-range attraction).
 * Intuition for non-physics maintainers:
 *  - At very short distance particles repel strongly (prevents overlap).
 *  - At moderate distance there's a mild attraction (models van der Waals bonding tendency).
 *  - Beyond the cutoff we ignore interaction to save time.
 * Parameters:
 *  - epsilon: depth of the potential well (overall interaction strength).
 *  - sigma: distance where potential crosses zero (~"size" of particle core).
 * Implementation details:
 *  - Uses a standard analytical derivative giving the vector force without computing expensive roots repeatedly.
 */

export interface LennardJonesParams { epsilon: number; sigma: number }

export class LennardJones implements ForceField {
  readonly name = 'lennardJones'
  constructor(private readonly params: LennardJonesParams) {}
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
