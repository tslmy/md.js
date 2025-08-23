import { SimulationState, index3 } from '../simulation/state.js'
import { ForceField, ForceContext, forEachPair } from './forceInterfaces.js'

export interface CoulombParams { K: number }

export class Coulomb implements ForceField {
  readonly name = 'coulomb'
  constructor(private readonly params: CoulombParams) {}
  apply(state: SimulationState, ctx: ForceContext): void {
    const { K } = this.params
    const { forces, charges } = state
    forEachPair(state, ctx.cutoff, (i, j, dx, dy, dz, r2) => {
      if (r2 === 0) return
      const r = Math.sqrt(r2)
      const invR3 = 1 / (r2 * r)
      const coeff = K * (charges[i] || 0) * (charges[j] || 0) * invR3
      const i3 = index3(i)
      const j3 = index3(j)
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
