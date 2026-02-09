import { describe, it, expect } from 'vitest'
import { computeSofteningLength } from '../../built/util/physics.js'

describe('computeSofteningLength', () => {
  it('computes softening for a cubic box with default factor', () => {
    const softening = computeSofteningLength(1000, { x: 10, y: 10, z: 10 })
    // Volume = 8000, spacing = cbrt(8000/1000) = 2, softening = 0.15 * 2 = 0.3
    expect(softening).toBeCloseTo(0.3, 10)
  })

  it('computes softening with custom factor (Coulomb)', () => {
    const softening = computeSofteningLength(1000, { x: 10, y: 10, z: 10 }, 0.1)
    // Softening = 0.1 * 2 = 0.2
    expect(softening).toBeCloseTo(0.2, 10)
  })

  it('handles single particle case', () => {
    const softening = computeSofteningLength(1, { x: 5, y: 5, z: 5 })
    // Volume = 1000, spacing = cbrt(1000/1) = 10, softening = 0.15 * 10 = 1.5
    expect(softening).toBeCloseTo(1.5, 10)
  })

  it('handles zero particles by treating as 1', () => {
    const softening = computeSofteningLength(0, { x: 5, y: 5, z: 5 })
    // Should behave same as N=1
    expect(softening).toBeCloseTo(1.5, 10)
  })

  it('scales correctly with particle count', () => {
    const box = { x: 10, y: 10, z: 10 }
    const softening1000 = computeSofteningLength(1000, box)
    const softening8000 = computeSofteningLength(8000, box)

    // When particle count increases by 8x, spacing decreases by 2x
    // (because cbrt(8) = 2), so softening also decreases by 2x
    expect(softening1000 / softening8000).toBeCloseTo(2, 5)
  })

  it('handles non-cubic boxes correctly', () => {
    const softening = computeSofteningLength(1000, { x: 10, y: 5, z: 2.5 })
    // Volume = (20)(10)(5) = 1000, spacing = cbrt(1000/1000) = 1
    // softening = 0.15 * 1 = 0.15
    expect(softening).toBeCloseTo(0.15, 10)
  })

  it('returns positive value for all valid inputs', () => {
    const softening1 = computeSofteningLength(100, { x: 1, y: 1, z: 1 })
    const softening2 = computeSofteningLength(10000, { x: 20, y: 20, z: 20 })

    expect(softening1).toBeGreaterThan(0)
    expect(softening2).toBeGreaterThan(0)
  })

  it('respects custom scaling factors', () => {
    const box = { x: 10, y: 10, z: 10 }
    const softening015 = computeSofteningLength(1000, box, 0.15)
    const softening030 = computeSofteningLength(1000, box, 0.30)

    expect(softening030).toBeCloseTo(2 * softening015, 10)
  })
})
