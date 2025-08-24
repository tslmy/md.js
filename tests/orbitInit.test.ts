import { describe, it, expect } from 'vitest'
import { computeCircularOrbitVelocity } from '../built/core/simulation/orbitInit.js'

// Basic physics helpers for test clarity
function dot(ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
    return ax * bx + ay * by + az * bz
}
function mag(ax: number, ay: number, az: number) { return Math.hypot(ax, ay, az) }

describe('computeCircularOrbitVelocity', () => {
    it('returns zero velocity for near-zero radius', () => {
        const v = computeCircularOrbitVelocity(0, 0, 0, 10, 0.5)
        expect(v).toEqual({ vx: 0, vy: 0, vz: 0 })
    })
    it('produces perpendicular velocity in XY plane', () => {
        const Msun = 500; const G = 0.08
        const rx = 2, ry = 3, rz = 0
        const { vx, vy, vz } = computeCircularOrbitVelocity(rx, ry, rz, Msun, G)
        // Check perpendicular: v · r ≈ 0
        const d = dot(rx, ry, rz, vx, vy, vz)
        expect(Math.abs(d)).toBeLessThan(1e-10)
        // Speed matches sqrt(GM/r)
        const r = Math.hypot(rx, ry, rz)
        const expected = Math.sqrt(G * Msun / r)
        expect(Math.abs(mag(vx, vy, vz) - expected)).toBeLessThan(1e-10)
    })
    it('handles point near z-axis by picking +X tangent', () => {
        const Msun = 100; const G = 0.2
        const rx = 1e-12, ry = 2e-12, rz = 4
        const { vx, vy, vz } = computeCircularOrbitVelocity(rx, ry, rz, Msun, G)
        // Velocity should be ~ along +X (vy≈0) given rx, ry tiny
        expect(Math.abs(vy)).toBeLessThan(1e-6)
        expect(vx).toBeGreaterThan(0)
        // Magnitude check
        const expected = Math.sqrt(G * Msun / Math.hypot(rx, ry, rz))
        expect(Math.abs(mag(vx, vy, vz) - expected)).toBeLessThan(1e-10)
    })
})
