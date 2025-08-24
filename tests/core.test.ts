import { describe, it, expect } from 'vitest'
import { createState } from '../built/core/simulation/state.js'
import { Simulation } from '../built/core/simulation/Simulation.js'
import { EulerIntegrator } from '../built/core/simulation/integrators.js'
import { LennardJones } from '../built/core/forces/lennardJones.js'

function approx(a: number, b: number, eps = 1e-6) { return Math.abs(a - b) < eps }

describe('core scaffold', () => {
  it('applies LJ force and advances positions', () => {
    const params = { particleCount: 2, box: { x: 5, y: 5, z: 5 }, dt: 0.01, cutoff: 10 }
    const state = createState(params)
    const sigma = 1
    state.positions[0] = 0
    state.positions[1] = 0
    state.positions[2] = 0
    state.positions[3] = 1.5 * sigma
    state.positions[4] = 0
    state.positions[5] = 0
    state.masses[0] = 1
    state.masses[1] = 1
    state.charges[0] = 0
    state.charges[1] = 0

    const lj = new LennardJones({ epsilon: 1, sigma })
    const sim = new Simulation(state, EulerIntegrator, [lj], { dt: params.dt, cutoff: params.cutoff })
    sim.step()
    const fx0 = state.forces[0]
    const fx1 = state.forces[3]
    expect(approx(fx0, -fx1)).toBe(true)
    expect(fx0).not.toBe(0)
    // Euler step should change positions slightly
    expect(state.positions[0]).not.toBe(0)
    expect(state.positions[3]).not.toBe(1.5 * sigma)
  })
})
