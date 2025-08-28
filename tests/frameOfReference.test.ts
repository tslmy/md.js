import { describe, it, expect } from 'vitest'
import { Vector3 } from 'three'
import { computeFrameOffset, updateDisplayPositions } from '../src/core/frameOfReference'
import type { SimulationState } from '../src/core/simulation/state'
import type { SettingsObject } from '../src/control/settingsSchema'

function makeState(N: number): SimulationState {
    const positions = new Float32Array(3 * N)
    const velocities = new Float32Array(3 * N)
    const masses = new Float32Array(N)
    const charges = new Float32Array(N)
    const escaped = new Uint8Array(N)
    for (let i = 0; i < N; i++) {
        const i3 = 3 * i
        positions[i3] = i * 1.0
        positions[i3 + 1] = i * 2.0
        positions[i3 + 2] = i * 3.0
        masses[i] = i + 1
        velocities[i3] = 0
        velocities[i3 + 1] = 0
        velocities[i3 + 2] = 0
        charges[i] = 0
        escaped[i] = 0
    }
    return { positions, velocities, masses, charges, escaped, N } as unknown as SimulationState
}

describe('frameOfReference', () => {
    it('computeFrameOffset returns particle 0 position when mode sun', () => {
        const s = makeState(3)
        const settings = { referenceFrameMode: 'sun' } as unknown as SettingsObject
        const f = computeFrameOffset(s, settings)
        expect(f).toBeInstanceOf(Vector3)
        expect(f.x).toBeCloseTo(s.positions[0])
        expect(f.y).toBeCloseTo(s.positions[1])
        expect(f.z).toBeCloseTo(s.positions[2])
    })

    it('computeFrameOffset returns center-of-mass for com mode', () => {
        const s = makeState(2)
        // particle 0: pos (0,0,0), mass 1; particle 1: pos (1,2,3), mass 2 => COM = ((0*1 + 1*2)/(3), ...)
        const settings = { referenceFrameMode: 'com' } as unknown as SettingsObject
        const f = computeFrameOffset(s, settings)
        expect(f.x).toBeCloseTo((0 * 1 + 1 * 2) / 3)
        expect(f.y).toBeCloseTo((0 * 1 + 2 * 2) / 3)
        expect(f.z).toBeCloseTo((0 * 1 + 3 * 2) / 3)
    })

    it('updateDisplayPositions creates and populates out buffer', () => {
        const s = makeState(2)
        const offset = new Vector3(1, 1, 1)
        const out = updateDisplayPositions(s, offset)
        expect(out.length).toBe(s.positions.length)
        // positions for particle 1 (index 1): original (1,2,3) -> minus offset = (0,1,2)
        expect(out[3]).toBeCloseTo(0)
        expect(out[4]).toBeCloseTo(1)
        expect(out[5]).toBeCloseTo(2)
    })

    it('updateDisplayPositions reuses provided out buffer when length matches', () => {
        const s = makeState(2)
        const offset = new Vector3(0.5, 0.5, 0.5)
        const buf = new Float32Array(s.positions.length)
        const returned = updateDisplayPositions(s, offset, buf)
        expect(returned).toBe(buf)
        expect(returned[0]).toBeCloseTo(-0.5)
    })

    it('computeFrameOffset returns zero vector for undefined simState', () => {
        const settings = { referenceFrameMode: 'sun' } as unknown as SettingsObject
        const f = computeFrameOffset(undefined, settings)
        expect(f.x).toBe(0)
        expect(f.y).toBe(0)
        expect(f.z).toBe(0)
    })

    it('computeFrameOffset sun mode with N=0 returns zero vector', () => {
        const empty = makeState(0)
        const settings = { referenceFrameMode: 'sun' } as unknown as SettingsObject
        const f = computeFrameOffset(empty, settings)
        expect(f.x).toBe(0)
        expect(f.y).toBe(0)
        expect(f.z).toBe(0)
    })

    it('computeFrameOffset com mode with zero total mass returns zero vector', () => {
        const positions = new Float32Array([1, 2, 3])
        const velocities = new Float32Array(3)
        const masses = new Float32Array([0])
        const charges = new Float32Array(1)
        const escaped = new Uint8Array(1)
        const s = { positions, velocities, masses, charges, escaped, N: 1 } as unknown as SimulationState
        const settings = { referenceFrameMode: 'com' } as unknown as SettingsObject
        const f = computeFrameOffset(s, settings)
        expect(f.x).toBe(0)
        expect(f.y).toBe(0)
        expect(f.z).toBe(0)
    })

    it('updateDisplayPositions reallocates when out buffer length mismatches', () => {
        const s = makeState(2)
        const offset = new Vector3(0, 0, 0)
        const smallBuf = new Float32Array(3) // wrong length
        const returned = updateDisplayPositions(s, offset, smallBuf)
        expect(returned).not.toBe(smallBuf)
        expect(returned.length).toBe(s.positions.length)
    })
})
