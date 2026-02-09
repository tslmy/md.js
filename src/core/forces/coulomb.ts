import { SimulationState } from '../simulation/state.js'
import { ForceField, ForceContext, forEachPair } from './forceInterfaces.js'
import {
  applyPairwiseForce,
  computePairwisePotential,
  makeSoftenedForceCoefficient,
  makeSoftenedPotential
} from './forceHelpers.js'

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
    const { K, softening = 0 } = this.params
    const { forces, charges } = state
    const coeffFn = makeSoftenedForceCoefficient(K, softening)
    forEachPair(state, ctx.cutoff, (i, j, dx, dy, dz, r2) => {
      applyPairwiseForce(forces, i, j, dx, dy, dz, r2, coeffFn, charges[i] || 0, charges[j] || 0)
    })
  }
  potential(state: SimulationState, ctx: ForceContext): number {
    const { K, softening = 0 } = this.params
    const { charges } = state
    const potentialFn = makeSoftenedPotential(K, softening)
    let V = 0
    forEachPair(state, ctx.cutoff, (i, j, dx, dy, dz, r2) => {
      V += computePairwisePotential(r2, potentialFn, charges[i] || 0, charges[j] || 0)
    })
    return V
  }
}
