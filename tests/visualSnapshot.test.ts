import { describe, it, expect } from 'vitest'
import { Color, Vector3, Line, BufferAttribute } from 'three'
import { makeTrajectory } from '../built/drawingHelpers.js'
import { captureVisualData, applyVisualData } from '../built/engine/persistence/visual.js'

// Minimal Particle-like shape for test (align with src/particleSystem.ts)
class FakeParticle {
    color: Color; position: Vector3; mass: number; charge: number; trajectory: Line | null
    constructor(color: Color, position: Vector3, trajectory: Line | null) {
        this.color = color; this.position = position; this.mass = 1; this.charge = 0; this.trajectory = trajectory
    }
}

function buildParticles(count: number, len: number) {
    const particles: FakeParticle[] = []
    for (let i = 0; i < count; i++) {
        const traj = makeTrajectory(new Color(1, 0, 0), new Vector3(i, 0, 0), len)
        particles.push(new FakeParticle(new Color(1, 0, 0), new Vector3(i, 0, 0), traj))
    }
    return particles
}

describe('visual snapshot (trajectories)', () => {
    it('captures and reapplies trajectory data', () => {
        const particles = buildParticles(3, 4)
        // mutate some points so not all identical
        const attr0 = particles[0].trajectory!.geometry.getAttribute('position') as BufferAttribute
        attr0.setXYZ(1, 10, 11, 12)
        const snap = captureVisualData(particles as unknown as import('../built/particleSystem.js').Particle[])
        expect(snap).not.toBeNull()
        if (!snap) return
        // Wipe trajectories then reapply
        const attr1 = particles[0].trajectory!.geometry.getAttribute('position') as BufferAttribute
        attr1.setXYZ(1, 0, 0, 0)
        applyVisualData(snap, particles as unknown as import('../built/particleSystem.js').Particle[])
        const attr2 = particles[0].trajectory!.geometry.getAttribute('position') as BufferAttribute
        expect([attr2.getX(1), attr2.getY(1), attr2.getZ(1)]).toEqual([10, 11, 12])
    })
})
