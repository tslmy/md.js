import { describe, it, expect } from 'vitest'
import { Color, Vector3, Line, BufferAttribute, Scene } from 'three'
import { newTrajectory } from '../built/visual/drawingHelpers.js'
import { captureVisualData, applyVisualData } from '../built/visual/persist.js'

// Minimal Particle-like shape for test (align with src/particleSystem.ts)
class FakeParticle {
    color: Color; position: Vector3; mass: number; charge: number; trajectory: Line | null
    constructor(color: Color, position: Vector3, trajectory: Line | null) {
        this.color = color; this.position = position; this.mass = 1; this.charge = 0; this.trajectory = trajectory
    }
}

function buildParticles(count: number, len: number) {
    const particles: FakeParticle[] = []
    const scene = new Scene()
    const positions = new Float32Array(count * 3)
    const colors = Array.from({ length: count }, () => new Color(1, 0, 0))
    for (let i = 0; i < count; i++) {
        positions[i * 3] = i
        positions[i * 3 + 1] = 0
        positions[i * 3 + 2] = 0
        const traj = newTrajectory(i, positions, colors, scene, len)
        particles.push(new FakeParticle(colors[i], new Vector3(i, 0, 0), traj))
    }
    return particles
}

describe('visual snapshot (trajectories)', () => {
    it('captures and reapplies trajectory data', () => {
        const particles = buildParticles(3, 4)
        const trajectories = particles.map(p => p.trajectory)
        // mutate some points so not all identical
        const attr0 = trajectories[0]!.geometry.getAttribute('position') as BufferAttribute
        attr0.setXYZ(1, 10, 11, 12)
        const snap = captureVisualData(trajectories)
        expect(snap).not.toBeNull()
        if (!snap) return
        // Wipe trajectories then reapply
        const attr1 = trajectories[0]!.geometry.getAttribute('position') as BufferAttribute
        attr1.setXYZ(1, 0, 0, 0)
        applyVisualData(snap, trajectories)
        const attr2 = trajectories[0]!.geometry.getAttribute('position') as BufferAttribute
        expect([attr2.getX(1), attr2.getY(1), attr2.getZ(1)]).toEqual([10, 11, 12])
    })
})
