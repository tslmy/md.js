import { describe, it, expect } from 'vitest'
import { wrapPositionsWithTracking, formatWrapRecords, logWrapEvents } from '../../../built/core/pbc/wrapping.js'

describe('wrapPositionsWithTracking', () => {
  it('should not wrap particles already inside the box', () => {
    const positions = new Float32Array([
      0, 0, 0, // Particle 0 at origin
      1, 2, 3, // Particle 1 inside box
      -1, -2, -3 // Particle 2 inside box
    ])
    const N = 3
    const box = { x: 5, y: 5, z: 5 }

    const result = wrapPositionsWithTracking(positions, N, box)

    expect(result.wrappedCount).toBe(0)
    expect(result.records).toHaveLength(0)
    // Positions should be unchanged
    expect(positions[0]).toBe(0)
    expect(positions[1]).toBe(0)
    expect(positions[2]).toBe(0)
    expect(positions[3]).toBe(1)
    expect(positions[4]).toBe(2)
    expect(positions[5]).toBe(3)
  })

  it('should wrap particle outside positive x boundary', () => {
    const positions = new Float32Array([
      6, 0, 0 // Particle 0 outside +x boundary (box extends to x=5)
    ])
    const N = 1
    const box = { x: 5, y: 5, z: 5 }

    const result = wrapPositionsWithTracking(positions, N, box)

    expect(result.wrappedCount).toBe(1)
    expect(result.records).toHaveLength(1)

    const record = result.records[0]
    expect(record.i).toBe(0)
    expect(record.rawX).toBe(6)
    expect(record.rawY).toBe(0)
    expect(record.rawZ).toBe(0)

    // Should wrap to -4 (6 - 10)
    expect(positions[0]).toBe(-4)
    expect(positions[1]).toBe(0)
    expect(positions[2]).toBe(0)

    expect(record.dx).toBe(-10) // Displacement
    expect(record.dy).toBe(0)
    expect(record.dz).toBe(0)

    expect(record.surfaces).toHaveLength(1)
    expect(record.surfaces[0]).toEqual({ axis: 'x', sign: 1 }) // Exited through +x

    expect(record.crossings).toHaveLength(1)
    expect(record.crossings[0].axis).toBe('x')
    expect(record.crossings[0].sign).toBe(1)
    expect(record.crossings[0].exit).toEqual({ x: 5, y: 0, z: 0 }) // Exit at +x boundary
    expect(record.crossings[0].entry).toEqual({ x: -5, y: 0, z: 0 }) // Enter at -x boundary
  })

  it('should wrap particle outside negative y boundary', () => {
    const positions = new Float32Array([
      0, -6, 0 // Particle outside -y boundary
    ])
    const N = 1
    const box = { x: 5, y: 5, z: 5 }

    const result = wrapPositionsWithTracking(positions, N, box)

    expect(result.wrappedCount).toBe(1)
    const record = result.records[0]

    expect(positions[1]).toBe(4) // -6 + 10 = 4
    expect(record.dy).toBe(10)
    expect(record.surfaces[0]).toEqual({ axis: 'y', sign: -1 }) // Exited through -y
    expect(record.crossings[0].exit).toEqual({ x: 0, y: -5, z: 0 })
    expect(record.crossings[0].entry).toEqual({ x: 0, y: 5, z: 0 })
  })

  it('should handle multiple axis crossings (corner wrap)', () => {
    const positions = new Float32Array([
      6, 7, -8 // Particle outside in all three directions
    ])
    const N = 1
    const box = { x: 5, y: 5, z: 5 }

    const result = wrapPositionsWithTracking(positions, N, box)

    expect(result.wrappedCount).toBe(1)
    const record = result.records[0]

    expect(positions[0]).toBe(-4) // 6 - 10
    expect(positions[1]).toBe(-3) // 7 - 10
    expect(positions[2]).toBe(2) // -8 + 10

    expect(record.surfaces).toHaveLength(3)
    expect(record.crossings).toHaveLength(3)

    // Check all three crossings occurred
    const axes = record.crossings.map(c => c.axis).sort()
    expect(axes).toEqual(['x', 'y', 'z'])
  })

  it('should handle multiple particles with some wrapping', () => {
    const positions = new Float32Array([
      0, 0, 0, // Particle 0: no wrap
      6, 0, 0, // Particle 1: wrap x
      0, -6, 0, // Particle 2: wrap y
      1, 1, 1 // Particle 3: no wrap
    ])
    const N = 4
    const box = { x: 5, y: 5, z: 5 }

    const result = wrapPositionsWithTracking(positions, N, box)

    expect(result.wrappedCount).toBe(2)
    expect(result.records).toHaveLength(2)

    // Check particle indices
    expect(result.records[0].i).toBe(1)
    expect(result.records[1].i).toBe(2)
  })

  it('should handle large excursions (multiple box lengths)', () => {
    const positions = new Float32Array([
      25, 0, 0 // Particle 2.5 box lengths away
    ])
    const N = 1
    const box = { x: 5, y: 5, z: 5 }

    const result = wrapPositionsWithTracking(positions, N, box)

    expect(result.wrappedCount).toBe(1)
    // wrapIntoBox uses while loop to bring into range
    // 25 > 5, so: 25-10=15, 15>5 so 15-10=5, 5 is not > 5, so stops at 5
    expect(positions[0]).toBe(5)
  })

  it('should handle zero-sized box dimension', () => {
    const positions = new Float32Array([
      1, 0, 0
    ])
    const N = 1
    const box = { x: 5, y: 0, z: 5 } // y dimension is zero (degenerate case)

    const result = wrapPositionsWithTracking(positions, N, box)

    // Should not crash, but behavior with zero box is undefined
    // Just verify it doesn't throw
    expect(result).toBeDefined()
  })

  it('should correctly identify exit/entry points for visualization', () => {
    const positions = new Float32Array([
      6, 3, 2 // Particle exits through +x plane
    ])
    const N = 1
    const box = { x: 5, y: 10, z: 10 }

    const result = wrapPositionsWithTracking(positions, N, box)

    const crossing = result.records[0].crossings[0]

    // Exit point should be on the +x boundary (x=5), preserving y,z
    expect(crossing.exit).toEqual({ x: 5, y: 3, z: 2 })

    // Entry point should be on the -x boundary (x=-5), with wrapped y,z
    expect(crossing.entry.x).toBe(-5)
    expect(crossing.entry.y).toBe(3)
    expect(crossing.entry.z).toBe(2)
  })
})

describe('formatWrapRecords', () => {
  it('should format single-axis crossing', () => {
    const records = [{
      i: 5,
      dx: -10,
      dy: 0,
      dz: 0,
      surfaces: [{ axis: 'x' as const, sign: 1 as const }],
      rawX: 6,
      rawY: 0,
      rawZ: 0,
      crossings: []
    }]

    const lines = formatWrapRecords(records)

    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('particle 5')
    expect(lines[0]).toContain('exited via the +x plane')
    expect(lines[0]).toContain('wrapped to the -x plane')
    expect(lines[0]).toContain('(-10, 0, 0)')
  })

  it('should format multi-axis crossing', () => {
    const records = [{
      i: 3,
      dx: -10,
      dy: 10,
      dz: 0,
      surfaces: [
        { axis: 'x' as const, sign: 1 as const },
        { axis: 'y' as const, sign: -1 as const }
      ],
      rawX: 6,
      rawY: -6,
      rawZ: 0,
      crossings: []
    }]

    const lines = formatWrapRecords(records)

    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('particle 3')
    expect(lines[0]).toContain('exited via planes +x, -y')
    expect(lines[0]).toContain('wrapped to opposite planes -x, +y')
  })

  it('should format numbers appropriately', () => {
    const records = [{
      i: 0,
      dx: 0.0000001, // Tiny value
      dy: 5, // Integer
      dz: 1.23456, // Decimal
      surfaces: [{ axis: 'y' as const, sign: -1 as const }],
      rawX: 0,
      rawY: 0,
      rawZ: 0,
      crossings: []
    }]

    const lines = formatWrapRecords(records)

    // Tiny values should become "0", integers stay as-is, decimals get .toFixed(3)
    expect(lines[0]).toContain('(0, 5, 1.235)')
  })
})

describe('logWrapEvents', () => {
  it('should not log when no records', () => {
    // Just verify it doesn't throw
    expect(() => logWrapEvents([])).not.toThrow()
  })

  it('should log details for 5 or fewer particles', () => {
    const records = [{
      i: 0,
      dx: -10,
      dy: 0,
      dz: 0,
      surfaces: [{ axis: 'x' as const, sign: 1 as const }],
      rawX: 6,
      rawY: 0,
      rawZ: 0,
      crossings: []
    }]

    // Should log without throwing
    expect(() => logWrapEvents(records)).not.toThrow()
  })

  it('should log summary for more than 5 particles', () => {
    const records = Array.from({ length: 10 }, (_, i) => ({
      i,
      dx: -10,
      dy: 0,
      dz: 0,
      surfaces: [{ axis: 'x' as const, sign: 1 as const }],
      rawX: 6,
      rawY: 0,
      rawZ: 0,
      crossings: []
    }))

    // Should log without throwing
    expect(() => logWrapEvents(records)).not.toThrow()
  })
})
