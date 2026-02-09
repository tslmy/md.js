import { describe, it, expect } from 'vitest'
import { magnitudeSquared, magnitude, radiusFromMass, normalize } from '../../built/util/vectorMath.js'

describe('magnitudeSquared', () => {
  it('computes squared magnitude correctly', () => {
    expect(magnitudeSquared(3, 4, 0)).toBe(25)
    expect(magnitudeSquared(1, 1, 1)).toBe(3)
    expect(magnitudeSquared(0, 0, 0)).toBe(0)
  })

  it('handles negative components', () => {
    expect(magnitudeSquared(-3, -4, 0)).toBe(25)
    expect(magnitudeSquared(-1, 2, -2)).toBe(9)
  })

  it('handles floating point values', () => {
    expect(magnitudeSquared(0.5, 0.5, 0.5)).toBeCloseTo(0.75, 10)
  })
})

describe('magnitude', () => {
  it('computes magnitude correctly', () => {
    expect(magnitude(3, 4, 0)).toBe(5)
    expect(magnitude(1, 0, 0)).toBe(1)
    expect(magnitude(0, 0, 0)).toBe(0)
  })

  it('handles 3D vectors', () => {
    expect(magnitude(1, 1, 1)).toBeCloseTo(Math.sqrt(3), 10)
    expect(magnitude(2, 2, 1)).toBeCloseTo(3, 10)
  })

  it('handles negative components', () => {
    expect(magnitude(-3, -4, 0)).toBe(5)
  })
})

describe('radiusFromMass', () => {
  it('returns reference radius for reference mass', () => {
    expect(radiusFromMass(10)).toBeCloseTo(0.08, 10)
  })

  it('scales radius by cube root of mass ratio', () => {
    // 8x mass should give 2x radius (cbrt(8) = 2)
    expect(radiusFromMass(80)).toBeCloseTo(0.16, 10)

    // 1/8 mass should give 1/2 radius
    expect(radiusFromMass(10 / 8)).toBeCloseTo(0.04, 10)
  })

  it('handles custom reference values', () => {
    const radius = radiusFromMass(20, 20, 0.1)
    expect(radius).toBeCloseTo(0.1, 10)

    const radius2 = radiusFromMass(160, 20, 0.1)
    expect(radius2).toBeCloseTo(0.2, 10)  // 8x mass = 2x radius
  })

  it('handles edge cases', () => {
    expect(radiusFromMass(0)).toBe(0)
    expect(radiusFromMass(1, 10)).toBeCloseTo(0.08 * Math.cbrt(0.1), 10)
  })

  it('maintains volume proportionality', () => {
    const r1 = radiusFromMass(10)
    const r2 = radiusFromMass(80)

    // Volume is proportional to r^3
    // If mass increases 8x, radius should increase 2x, so volume increases 8x
    const vol1 = (4/3) * Math.PI * r1 ** 3
    const vol2 = (4/3) * Math.PI * r2 ** 3

    expect(vol2 / vol1).toBeCloseTo(8, 5)
  })
})

describe('normalize', () => {
  it('normalizes vectors to unit length', () => {
    const [nx, ny, nz] = normalize(3, 4, 0)
    expect(nx).toBeCloseTo(0.6, 10)
    expect(ny).toBeCloseTo(0.8, 10)
    expect(nz).toBe(0)

    // Verify it's unit length
    expect(magnitude(nx, ny, nz)).toBeCloseTo(1, 10)
  })

  it('handles already normalized vectors', () => {
    const [nx, ny, nz] = normalize(1, 0, 0)
    expect(nx).toBe(1)
    expect(ny).toBe(0)
    expect(nz).toBe(0)
  })

  it('returns zero vector for zero input', () => {
    const [nx, ny, nz] = normalize(0, 0, 0)
    expect(nx).toBe(0)
    expect(ny).toBe(0)
    expect(nz).toBe(0)
  })

  it('handles 3D vectors', () => {
    const [nx, ny, nz] = normalize(1, 1, 1)
    const expected = 1 / Math.sqrt(3)
    expect(nx).toBeCloseTo(expected, 10)
    expect(ny).toBeCloseTo(expected, 10)
    expect(nz).toBeCloseTo(expected, 10)

    expect(magnitude(nx, ny, nz)).toBeCloseTo(1, 10)
  })

  it('handles negative components', () => {
    const [nx, ny, nz] = normalize(-3, -4, 0)
    expect(nx).toBeCloseTo(-0.6, 10)
    expect(ny).toBeCloseTo(-0.8, 10)
    expect(nz).toBe(0)
  })

  it('handles very small vectors without underflow', () => {
    const [nx, ny, nz] = normalize(1e-10, 1e-10, 1e-10)
    const expected = 1 / Math.sqrt(3)
    expect(nx).toBeCloseTo(expected, 5)
    expect(ny).toBeCloseTo(expected, 5)
    expect(nz).toBeCloseTo(expected, 5)
  })
})
