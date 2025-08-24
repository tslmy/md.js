import { describe, it, expect } from 'vitest'
import { createState } from '../built/core/simulation/state.js'
import { Simulation } from '../built/core/simulation/Simulation.js'
import { EulerIntegrator } from '../built/core/simulation/integrators.js'
import { Gravity } from '../built/core/forces/gravity.js'
import { Coulomb } from '../built/core/forces/coulomb.js'
import { LennardJones } from '../built/core/forces/lennardJones.js'

const params = { particleCount: 2, box: { x: 5, y: 5, z: 5 }, dt: 0.01, cutoff: 10 }

describe('forces', () => {
  it('gravity + coulomb symmetry & non-zero', () => {
    const state = createState(params)
    state.positions.set([0,0,0, 2,0,0])
    state.masses.set([2, 3])
    state.charges.set([+1, -1])
    const grav = new Gravity({ G: 1 })
    const coul = new Coulomb({ K: 1 })
    const sim = new Simulation(state, EulerIntegrator, [grav, coul], { dt: params.dt, cutoff: params.cutoff })
    sim.step()
    const fx0 = state.forces[0]
    const fx1 = state.forces[3]
    expect(Math.abs(fx0 + fx1)).toBeLessThan(1e-6)
    expect(fx0).not.toBe(0)
  })
  it('lennard-jones pair antisymmetry', () => {
    const state = createState(params)
    state.positions.set([0,0,0, 1.5,0,0])
    state.masses.set([1,1])
    const lj = new LennardJones({ epsilon: 1, sigma: 1 })
    const sim = new Simulation(state, EulerIntegrator, [lj], { dt: params.dt, cutoff: params.cutoff })
    sim.step()
    const fx0 = state.forces[0]; const fx1 = state.forces[3]
    expect(fx0).not.toBe(0)
    expect(fx0).toBeCloseTo(-fx1, 6)
  })
})
