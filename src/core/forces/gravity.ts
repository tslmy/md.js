import { SimulationState, index3 } from '../simulation/state.js'
import { ForceField, ForceContext, forEachPair } from './forceInterfaces.js'

/**
 * Simple pairwise Newtonian gravity with optional Plummer‑like softening.
 *
 * Characteristics:
 *  - Always attractive (pulls particles together).
 *  - Force magnitude ∝ G * m_i * m_j / r^2 (component form uses 1/r^3 with displacement vector).
 *  - Potential energy ∝ -G * m_i * m_j / r.
 *
 * Softening ("gravitational softening"):
 *  - To avoid singular 1/r^2 spikes (numerically destabilizing with finite dt), we replace r^2 with r^2 + ε^2.
 *  - This mimics a Plummer sphere core and caps the maximum acceleration at ~ G m / ε^2 instead of letting it diverge.
 *  - ε (passed as `softening`) is chosen by the engine as ~0.15 × the average inter‑particle spacing: (Volume/N)^{1/3}.
 *    This keeps large‑scale forces nearly unchanged while preventing extreme close‑encounter kicks when particles are
 *    randomly seeded very near the sun / each other.
 *  - Setting softening = 0 restores the exact Newtonian form.
 *
 * Parameters:
 *  - G: tuned constant (simulation units; not real G).
 *  - softening (optional): length scale ε ≥ 0. Force uses r^2+ε^2; potential uses 1/sqrt(r^2+ε^2).
 *
 * Notes:
 *  - Interplay with Lennard‑Jones: If LJ repulsion is active at very short range, softening can be smaller; however a
 *    modest ε still improves stability when dt is not aggressively small.
 *  - Energy: Softening changes the true physical potential; for diagnostic comparisons ensure the same ε is used.
 */

export interface GravityParams { G: number; softening?: number }

export class Gravity implements ForceField {
  readonly name = 'gravity'
  constructor(private readonly params: GravityParams) {}
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
