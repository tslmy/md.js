import { describe, it, expect } from 'vitest'
import {
  applyPairwiseForce,
  computePairwisePotential,
  makeSoftenedForceCoefficient,
  makeSoftenedPotential,
  type ForceCoefficient,
  type PotentialFunction
} from '../../../built/core/forces/forceHelpers.js'

describe('forceHelpers', () => {
  describe('applyPairwiseForce', () => {
    it('should apply force symmetrically to both particles', () => {
      const forces = new Float32Array(6) // 2 particles, 3 components each
      const coefficientFn: ForceCoefficient = () => 2.0 // constant coefficient

      // Particle 0 at origin, particle 1 at (3, 4, 0), separation = 5
      applyPairwiseForce(forces, 0, 1, 3, 4, 0, 25, coefficientFn, 1, 1)

      // Expected force: coeff * (dx, dy, dz) = 2 * (3, 4, 0) = (6, 8, 0)
      expect(forces[0]).toBeCloseTo(6, 10)
      expect(forces[1]).toBeCloseTo(8, 10)
      expect(forces[2]).toBeCloseTo(0, 10)

      // Newton's third law: particle 1 gets opposite force
      expect(forces[3]).toBeCloseTo(-6, 10)
      expect(forces[4]).toBeCloseTo(-8, 10)
      expect(forces[5]).toBeCloseTo(0, 10)
    })

    it('should handle zero separation gracefully', () => {
      const forces = new Float32Array(6)
      const coefficientFn: ForceCoefficient = () => 1.0

      applyPairwiseForce(forces, 0, 1, 0, 0, 0, 0, coefficientFn, 1, 1)

      // All forces should remain zero
      expect(forces.every(f => f === 0)).toBe(true)
    })

    it('should accumulate forces when called multiple times', () => {
      const forces = new Float32Array(6)
      const coefficientFn: ForceCoefficient = () => 1.0

      // First call
      applyPairwiseForce(forces, 0, 1, 1, 0, 0, 1, coefficientFn, 1, 1)
      expect(forces[0]).toBeCloseTo(1, 10)

      // Second call should accumulate
      applyPairwiseForce(forces, 0, 1, 1, 0, 0, 1, coefficientFn, 1, 1)
      expect(forces[0]).toBeCloseTo(2, 10)
    })

    it('should use coefficient function with particle properties', () => {
      const forces = new Float32Array(6)
      // Coefficient proportional to product of properties
      const coefficientFn: ForceCoefficient = (propI, propJ) => propI * propJ

      applyPairwiseForce(forces, 0, 1, 1, 0, 0, 1, coefficientFn, 2, 3)

      // Expected: 2 * 3 * (1, 0, 0) = (6, 0, 0)
      expect(forces[0]).toBeCloseTo(6, 10)
      expect(forces[1]).toBeCloseTo(0, 10)
      expect(forces[2]).toBeCloseTo(0, 10)
    })

    it('should handle negative coefficients (attractive forces)', () => {
      const forces = new Float32Array(6)
      const coefficientFn: ForceCoefficient = () => -1.0 // attractive

      applyPairwiseForce(forces, 0, 1, 2, 0, 0, 4, coefficientFn, 1, 1)

      // Negative coefficient reverses force direction
      expect(forces[0]).toBeCloseTo(-2, 10)
      expect(forces[3]).toBeCloseTo(2, 10)
    })
  })

  describe('computePairwisePotential', () => {
    it('should calculate potential energy from distance', () => {
      const potentialFn: PotentialFunction = (propI, propJ, r) => -propI * propJ / r

      const V = computePairwisePotential(4, potentialFn, 2, 3)

      // Expected: -2 * 3 / sqrt(4) = -6 / 2 = -3
      expect(V).toBeCloseTo(-3, 10)
    })

    it('should return zero for zero separation', () => {
      const potentialFn: PotentialFunction = (propI, propJ, r) => propI * propJ / r

      const V = computePairwisePotential(0, potentialFn, 1, 1)

      expect(V).toBe(0)
    })

    it('should handle positive potentials (repulsive)', () => {
      const potentialFn: PotentialFunction = (propI, propJ, r) => propI * propJ / r

      const V = computePairwisePotential(9, potentialFn, 2, 4)

      // Expected: 2 * 4 / sqrt(9) = 8 / 3 ≈ 2.667
      expect(V).toBeCloseTo(8 / 3, 10)
    })
  })

  describe('makeSoftenedForceCoefficient', () => {
    it('should create coefficient function with no softening', () => {
      const coeffFn = makeSoftenedForceCoefficient(1.0, 0)

      // Test at r = 2: 1 / r³ = 1 / 8 = 0.125
      const coeff = coeffFn(1, 1, 2, 4)
      expect(coeff).toBeCloseTo(0.125, 10)
    })

    it('should apply softening to prevent singularity', () => {
      const softening = 1.0
      const coeffFn = makeSoftenedForceCoefficient(1.0, softening)

      // At r = 0 with ε = 1: 1 / (0 + 1)^(3/2) = 1
      const coeffAtZero = coeffFn(1, 1, 0, 0)
      expect(coeffAtZero).toBeCloseTo(1.0, 10)

      // At r = 1 with ε = 1: 1 / (1 + 1)^(3/2) = 1 / 2^(3/2) ≈ 0.3536
      const coeffAtOne = coeffFn(1, 1, 1, 1)
      expect(coeffAtOne).toBeCloseTo(1 / Math.pow(2, 1.5), 10)
    })

    it('should scale with prefactor', () => {
      const G = 6.674
      const coeffFn = makeSoftenedForceCoefficient(-G, 0)

      // Test at r = 3 with masses 2 and 5: -G * 2 * 5 / 27
      const coeff = coeffFn(2, 5, 3, 9)
      expect(coeff).toBeCloseTo(-G * 10 / 27, 10)
    })

    it('should handle particle properties correctly', () => {
      const coeffFn = makeSoftenedForceCoefficient(1.0, 0)

      // Different particle properties
      const coeff = coeffFn(3, 4, 2, 4)
      expect(coeff).toBeCloseTo(3 * 4 * 0.125, 10) // 12 * 1/8 = 1.5
    })

    it('should return zero for zero softened distance', () => {
      const coeffFn = makeSoftenedForceCoefficient(1.0, 0)

      const coeff = coeffFn(1, 1, 0, 0)
      expect(coeff).toBe(0)
    })
  })

  describe('makeSoftenedPotential', () => {
    it('should create potential function with no softening', () => {
      const potentialFn = makeSoftenedPotential(1.0, 0)

      // At r = 4: 1 / r = 1 / 2 = 0.5
      const V = potentialFn(1, 1, 2, 4)
      expect(V).toBeCloseTo(0.5, 10)
    })

    it('should apply softening to prevent singularity', () => {
      const softening = 1.0
      const potentialFn = makeSoftenedPotential(1.0, softening)

      // At r = 0 with ε = 1: 1 / sqrt(0 + 1) = 1
      const VatZero = potentialFn(1, 1, 0, 0)
      expect(VatZero).toBeCloseTo(1.0, 10)

      // At r = 3 with ε = 1: 1 / sqrt(9 + 1) = 1 / sqrt(10)
      const VatThree = potentialFn(1, 1, 3, 9)
      expect(VatThree).toBeCloseTo(1 / Math.sqrt(10), 10)
    })

    it('should scale with prefactor and properties', () => {
      const K = 8.99
      const potentialFn = makeSoftenedPotential(K, 0)

      // K * q1 * q2 / r with q1=2, q2=3, r=5
      const V = potentialFn(2, 3, 5, 25)
      expect(V).toBeCloseTo(K * 6 / 5, 10)
    })

    it('should return zero for zero softened distance', () => {
      const potentialFn = makeSoftenedPotential(1.0, 0)

      const V = potentialFn(1, 1, 0, 0)
      expect(V).toBe(0)
    })
  })

  describe('integration: gravity-like force', () => {
    it('should reproduce gravity force calculation', () => {
      const G = 1.0
      const softening = 0.1
      const forces = new Float32Array(6)

      const coeffFn = makeSoftenedForceCoefficient(-G, softening)

      // Two particles: m1=2, m2=3 separated by (3, 4, 0) -> r=5, r²=25
      applyPairwiseForce(forces, 0, 1, 3, 4, 0, 25, coeffFn, 2, 3)

      // s² = 25 + 0.01 = 25.01, s = 5.001, invR3 = 1/(25.01 * 5.001)
      // coeff = -1 * 2 * 3 * invR3 ≈ -0.04797
      const s2 = 25 + 0.1 * 0.1
      const s = Math.sqrt(s2)
      const expectedCoeff = -G * 2 * 3 / (s2 * s)

      expect(forces[0]).toBeCloseTo(expectedCoeff * 3, 8)
      expect(forces[1]).toBeCloseTo(expectedCoeff * 4, 8)
      expect(forces[2]).toBeCloseTo(0, 10)
    })
  })

  describe('integration: coulomb-like force', () => {
    it('should reproduce coulomb force calculation', () => {
      const K = 8.99
      const softening = 0.05
      const forces = new Float32Array(6)

      const coeffFn = makeSoftenedForceCoefficient(K, softening)

      // Two charges: q1=1, q2=-1 separated by (1, 0, 0) -> r=1, r²=1
      applyPairwiseForce(forces, 0, 1, 1, 0, 0, 1, coeffFn, 1, -1)

      // s² = 1 + 0.0025 = 1.0025, coeff = K * 1 * (-1) / (s² * sqrt(s²))
      const s2 = 1 + 0.05 * 0.05
      const s = Math.sqrt(s2)
      const expectedCoeff = K * 1 * (-1) / (s2 * s)

      expect(forces[0]).toBeCloseTo(expectedCoeff, 6)
      expect(forces[3]).toBeCloseTo(-expectedCoeff, 6)
    })
  })
})
