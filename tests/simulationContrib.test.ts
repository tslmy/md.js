import { describe, it, expect } from 'vitest'
import { createState } from '../built/core/simulation/state.js'
import { Simulation } from '../built/core/simulation/Simulation.js'
import { VelocityVerlet, EulerIntegrator } from '../built/core/simulation/integrators.js'
import { LennardJones } from '../built/core/forces/lennardJones.js'
import { Gravity } from '../built/core/forces/gravity.js'
import { Coulomb } from '../built/core/forces/coulomb.js'

const noPbc = { enabled: false, box: { x: 0, y: 0, z: 0 } }

describe('Simulation per-force contributions', () => {
  it('provides decomposed force arrays summing to net force', () => {
    const state = createState({ particleCount: 3, box: { x: 5, y: 5, z: 5 }, dt: 0.01, cutoff: 10 })
    // simple placement
    for (let i = 0; i < state.N; i++) {
      const i3 = 3 * i
      state.positions[i3] = i * 1.1
      state.masses[i] = 1 + i * 0.5
      state.charges[i] = (i - 1)
    }
    const forces = [
      new LennardJones({ epsilon: 0.5, sigma: 1 }),
      new Gravity({ G: 0.2 }),
      new Coulomb({ K: 0.3 })
    ]
    const sim = new Simulation(state, VelocityVerlet, forces, { dt: 0.01, cutoff: 10, pbc: noPbc })
    sim.step()
    const net = state.forces.slice()
    const contrib = sim.getPerForceContributions()
    // Sum per-force contributions
    const sum = new Float32Array(net.length)
    for (const arr of Object.values(contrib)) {
      for (let i = 0; i < sum.length; i++) sum[i] += arr[i]
    }
    for (let i = 0; i < net.length; i++) {
      expect(Math.abs(sum[i] - net[i])).toBeLessThan(1e-6)
    }
  })

  it('Euler vs Verlet diverging energy (qualitative)', () => {
    const N = 4
    const params = { particleCount: N, box: { x: 6, y: 6, z: 6 }, dt: 0.01, cutoff: 4.5 }
    const baseState = createState(params)
    for (let i = 0; i < N; i++) {
      const i3 = 3 * i
      baseState.positions[i3] = i * 1.2
      baseState.masses[i] = 1
    }
    function cloneState() {
      const s = createState(params)
      s.positions.set(baseState.positions)
      s.masses.set(baseState.masses)
      return s
    }
    const lj = new LennardJones({ epsilon: 1, sigma: 1 })
    const euler = new Simulation(cloneState(), EulerIntegrator, [lj], { dt: 0.01, cutoff: 4.5, pbc: noPbc })
    const verlet = new Simulation(cloneState(), VelocityVerlet, [lj], { dt: 0.01, cutoff: 4.5, pbc: noPbc })

    function kinetic(st: ReturnType<typeof createState>) {
      let ke = 0; for (let i = 0; i < N; i++) { const i3 = 3 * i; const vx = st.velocities[i3]; const vy = st.velocities[i3+1]; const vz = st.velocities[i3+2]; ke += 0.5 * st.masses[i]*(vx*vx+vy*vy+vz*vz) } return ke
    }

    for (let s = 0; s < 40; s++) { euler.step(); verlet.step() }
    const keEuler = kinetic(euler.state)
    const keVerlet = kinetic(verlet.state)
    // Expect Euler to have inflated KE more than Verlet (loose inequality)
    expect(keEuler).toBeGreaterThanOrEqual(keVerlet * 0.9)
  })
})
