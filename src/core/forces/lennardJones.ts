import { SimulationState, index3 } from '../simulation/state.js'
import { ForceContext, ForceField, forEachPair } from './forceInterfaces.js'

// F magnitude from Lennard-Jones: F = 24 * epsilon * (2*(sigma/r)^12 - (sigma/r)^6) / r
// We'll use settings names epsilon (EPSILON) & sigma (DELTA) analogously later.

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
}
