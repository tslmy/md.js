import { SimulationState, index3 } from '../simulation/state.js'
import { ForceField, ForceContext, forEachPair } from './forceInterfaces.js'

/**
 * Electrostatic (Coulomb) interaction with optional Plummer‑style softening.
 *  V(r) =  K q_i q_j / sqrt(r^2 + ε^2)    (sign emerges from product of charges)
 *  F(r) =  K q_i q_j (r) / (r^2 + ε^2)^{3/2}
 * Like charges (qiqj > 0) => repulsion; opposite charges => attraction.
 * Softening serves identical numerical purpose as gravity: tame near‑zero separations to avoid huge Δv kicks.
 */
export interface CoulombParams { K: number; softening?: number }

export class Coulomb implements ForceField {
  readonly name = 'coulomb'
  constructor(private readonly params: CoulombParams) { }
  apply(state: SimulationState, ctx: ForceContext): void {
    const { K, softening } = this.params
    const { forces, charges } = state
    const eps2 = softening && softening > 0 ? softening * softening : 0
    forEachPair(state, ctx.cutoff, (i, j, dx, dy, dz, r2) => {
      const s2 = r2 + eps2
      if (s2 === 0) return
      const r = Math.sqrt(s2)
      const invR3 = 1 / (s2 * r)
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
  potential(state: SimulationState, ctx: ForceContext): number {
    const { K, softening } = this.params
    const { charges } = state
    const eps2 = softening && softening > 0 ? softening * softening : 0
    let V = 0
    forEachPair(state, ctx.cutoff, (i, j, dx, dy, dz, r2) => {
      const s2 = r2 + eps2
      if (s2 === 0) return
      V += K * (charges[i] || 0) * (charges[j] || 0) / Math.sqrt(s2)
    })
    return V
  }
}
