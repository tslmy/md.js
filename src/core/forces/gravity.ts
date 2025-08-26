import { SimulationState, index3 } from '../simulation/state.js'
import { ForceField, ForceContext, forEachPair } from './forceInterfaces.js'

/**
 * Newtonian gravity with optional Plummer softening.
 *  V(r) = − G m_i m_j / sqrt(r^2 + ε^2)
 *  F(r) = − dV/dr * (r̂) = − G m_i m_j (r) / (r^2 + ε^2)^{3/2}
 *
 * Softening motivation:
 *  - Without ε, very small separations create huge accelerations -> integrator must take extremely small dt to remain stable.
 *  - Adding ε approximates extended mass distribution and limits max acceleration ≈ G m / ε^2.
 *  - Chosen ε ≈ 0.15 × mean inter‑particle spacing keeps large‑scale (r >> ε) forces close to true Newtonian.
 *  - Setting softening = 0 restores the exact Newtonian form.
 *
 * Parameters:
 *  - G: tuned constant (simulation units; not real G).
 *  - softening (optional): length scale ε ≥ 0. Force uses r^2+ε^2; potential uses 1/sqrt(r^2+ε^2).
 *
 * Implementation detail: we reuse s2 = r^2 + ε^2 then r = sqrt(s2) and compute 1/(s2 * r) to obtain 1/r^3 like factor.
 */

export interface GravityParams { G: number; softening?: number }

export class Gravity implements ForceField {
  readonly name = 'gravity'
  constructor(private readonly params: GravityParams) { }
  apply(state: SimulationState, ctx: ForceContext): void {
    const { G, softening } = this.params
    const { forces, masses } = state
    const eps2 = softening && softening > 0 ? softening * softening : 0
    forEachPair(state, ctx.cutoff, (i, j, dx, dy, dz, r2) => {
      const s2 = r2 + eps2
      if (s2 === 0) return
      const r = Math.sqrt(s2)
      const invR3 = 1 / (s2 * r)
      const mProd = (masses[i] || 1) * (masses[j] || 1)
      // Attractive: negative coefficient times displacement components.
      const coeff = -G * mProd * invR3
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
    const { G, softening } = this.params
    const { masses } = state
    const eps2 = softening && softening > 0 ? softening * softening : 0
    let V = 0
    forEachPair(state, ctx.cutoff, (i, j, dx, dy, dz, r2) => {
      const s2 = r2 + eps2
      if (s2 === 0) return
      V += -G * (masses[i] || 1) * (masses[j] || 1) / Math.sqrt(s2)
    })
    return V
  }
}
