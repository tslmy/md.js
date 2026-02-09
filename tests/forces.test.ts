import { describe, it, expect } from 'vitest'
import { createState } from '../src/core/simulation/state'
import { Simulation } from '../src/core/simulation/Simulation'
import { EulerIntegrator } from '../src/core/simulation/integrators'
import { Gravity } from '../src/core/forces/gravity'
import { Coulomb } from '../src/core/forces/coulomb'
import { LennardJones } from '../src/core/forces/lennardJones'

const params = { particleCount: 2, box: { x: 5, y: 5, z: 5 }, dt: 0.01, cutoff: 10 }
const noPbc = { enabled: false, box: { x: 0, y: 0, z: 0 } }

describe('forces', () => {
  it('gravity + coulomb symmetry & non-zero', () => {
    const state = createState(params)
    state.positions.set([0, 0, 0, 2, 0, 0])
    state.masses.set([2, 3])
    state.charges.set([+1, -1])
    const grav = new Gravity({ G: 1 })
    const coul = new Coulomb({ K: 1 })
    const sim = new Simulation(state, EulerIntegrator, [grav, coul], { dt: params.dt, cutoff: params.cutoff, pbc: noPbc })
    sim.step()
    const fx0 = state.forces[0]
    const fx1 = state.forces[3]
    expect(Math.abs(fx0 + fx1)).toBeLessThan(1e-6)
    expect(fx0).not.toBe(0)
  })
  it('lennard-jones pair antisymmetry', () => {
    const state = createState(params)
    state.positions.set([0, 0, 0, 1.5, 0, 0])
    state.masses.set([1, 1])
    const lj = new LennardJones({ epsilon: 1, sigma: 1 })
    const sim = new Simulation(state, EulerIntegrator, [lj], { dt: params.dt, cutoff: params.cutoff, pbc: noPbc })
    sim.step()
    const fx0 = state.forces[0]; const fx1 = state.forces[3]
    expect(fx0).not.toBe(0)
    expect(fx0).toBeCloseTo(-fx1, 6)
  })
})
