import { index3 } from '../simulation/state.js'

/**
 * Force calculation helpers shared across different force field implementations.
 * These utilities extract common pairwise force application patterns to eliminate duplication.
 */

/**
 * Coefficient function type: given particle properties and separation distance,
 * return the force magnitude coefficient.
 *
 * For example:
 * - Gravity: (mi, mj, r) => -G * mi * mj / r³
 * - Coulomb: (qi, qj, r) => K * qi * qj / r³
 * - Softened versions use (r² + ε²)^(3/2) instead of r³
 *
 * The returned coefficient is multiplied by (dx, dy, dz) to get force components.
 */
export type ForceCoefficient = (
  propertyI: number,
  propertyJ: number,
  r: number,
  r2: number
) => number

/**
 * Apply a pairwise force to two particles using Newton's third law symmetry.
 *
 * This helper encapsulates the common pattern:
 * 1. Calculate force coefficient from particle properties and separation
 * 2. Compute force components: fx = coeff * dx, etc.
 * 3. Apply forces symmetrically: F_i += f, F_j -= f
 *
 * @param forces - Force accumulator array (flattened 3N components)
 * @param i - Index of first particle
 * @param j - Index of second particle
 * @param dx - x-component of separation vector (ri - rj)
 * @param dy - y-component of separation vector
 * @param dz - z-component of separation vector
 * @param r2 - Squared distance between particles
 * @param coefficientFn - Function to calculate force magnitude coefficient
 * @param propertyI - Property of particle i (mass, charge, etc.)
 * @param propertyJ - Property of particle j
 */
export function applyPairwiseForce(
  forces: Float32Array,
  i: number,
  j: number,
  dx: number,
  dy: number,
  dz: number,
  r2: number,
  coefficientFn: ForceCoefficient,
  propertyI: number,
  propertyJ: number
): void {
  if (r2 === 0) return

  const r = Math.sqrt(r2)
  const coeff = coefficientFn(propertyI, propertyJ, r, r2)

  const fx = coeff * dx
  const fy = coeff * dy
  const fz = coeff * dz

  const i3 = index3(i)
  const j3 = index3(j)

  // Newton's third law: F_ij = -F_ji
  forces[i3] += fx
  forces[i3 + 1] += fy
  forces[i3 + 2] += fz

  forces[j3] -= fx
  forces[j3 + 1] -= fy
  forces[j3 + 2] -= fz
}

/**
 * Potential function type: given particle properties and separation distance,
 * return the potential energy contribution.
 *
 * For example:
 * - Gravity: (mi, mj, r) => -G * mi * mj / r
 * - Coulomb: (qi, qj, r) => K * qi * qj / r
 * - Softened versions use 1/√(r² + ε²) instead of 1/r
 */
export type PotentialFunction = (
  propertyI: number,
  propertyJ: number,
  r: number,
  r2: number
) => number

/**
 * Accumulate pairwise potential energy contribution.
 *
 * @param r2 - Squared distance between particles
 * @param potentialFn - Function to calculate potential energy
 * @param propertyI - Property of particle i (mass, charge, etc.)
 * @param propertyJ - Property of particle j
 * @returns Potential energy contribution from this pair
 */
export function computePairwisePotential(
  r2: number,
  potentialFn: PotentialFunction,
  propertyI: number,
  propertyJ: number
): number {
  if (r2 === 0) return 0
  const r = Math.sqrt(r2)
  return potentialFn(propertyI, propertyJ, r, r2)
}

/**
 * Create a force coefficient function for unsoftened 1/r² interactions.
 * This is used by Ewald fallback methods when PBC is disabled.
 *
 * Formula: coeff = prefactor * property_i * property_j / r³
 *
 * @param prefactor - Force constant (±G for gravity, K for Coulomb)
 * @returns Force coefficient function
 */
export function makeUnsoftenedForceCoefficient(
  prefactor: number
): ForceCoefficient {
  return (propI: number, propJ: number, r: number, r2: number): number => {
    if (r2 === 0) return 0
    const invR3 = 1 / (r2 * r)
    return prefactor * propI * propJ * invR3
  }
}

/**
 * Create a potential function for unsoftened 1/r interactions.
 * This is used by Ewald fallback methods when PBC is disabled.
 *
 * Formula: V = prefactor * property_i * property_j / r
 *
 * @param prefactor - Potential constant (±G for gravity, K for Coulomb)
 * @returns Potential function
 */
export function makeUnsoftenedPotential(
  prefactor: number
): PotentialFunction {
  return (propI: number, propJ: number, r: number, r2: number): number => {
    if (r2 === 0) return 0
    return prefactor * propI * propJ / r
  }
}

/**
 * Create a force coefficient function for softened 1/r² interactions.
 * This is the common pattern used by gravity and Coulomb forces with Plummer softening.
 *
 * Formula: coeff = prefactor * property_i * property_j / (r² + ε²)^(3/2)
 * where (r² + ε²)^(3/2) = (s2 * √s2) and we compute 1/(s2 * √s2).
 *
 * @param prefactor - Force constant (±G for gravity, K for Coulomb)
 * @param softening - Softening length ε ≥ 0
 * @returns Force coefficient function
 */
export function makeSoftenedForceCoefficient(
  prefactor: number,
  softening: number
): ForceCoefficient {
  const eps2 = softening > 0 ? softening * softening : 0
  return (propI: number, propJ: number, r: number, r2: number): number => {
    const s2 = r2 + eps2
    if (s2 === 0) return 0
    const rSoftened = Math.sqrt(s2)
    const invR3 = 1 / (s2 * rSoftened)
    return prefactor * propI * propJ * invR3
  }
}

/**
 * Create a potential function for softened 1/r interactions.
 * This is the common pattern used by gravity and Coulomb potentials with Plummer softening.
 *
 * Formula: V = prefactor * property_i * property_j / √(r² + ε²)
 *
 * @param prefactor - Potential constant (±G for gravity, K for Coulomb)
 * @param softening - Softening length ε ≥ 0
 * @returns Potential function
 */
export function makeSoftenedPotential(
  prefactor: number,
  softening: number
): PotentialFunction {
  const eps2 = softening > 0 ? softening * softening : 0
  return (propI: number, propJ: number, r: number, r2: number): number => {
    const s2 = r2 + eps2
    if (s2 === 0) return 0
    return prefactor * propI * propJ / Math.sqrt(s2)
  }
}
