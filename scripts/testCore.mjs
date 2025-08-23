// Simple core scaffold test: builds a tiny simulation, applies LJ once, integrates.
import { createState } from '../built/core/simulation/state.js'
import { Simulation } from '../built/core/simulation/Simulation.js'
import { EulerIntegrator } from '../built/core/simulation/integrators.js'
import { LennardJones } from '../built/core/forces/lennardJones.js'

function approx(a, b, eps = 1e-6) { return Math.abs(a - b) < eps }

// Initialize two particles along x-axis
const params = { particleCount: 2, box: { x: 5, y: 5, z: 5 }, dt: 0.01, cutoff: 10 }
const state = createState(params)
// positions: particle 0 at origin, particle 1 at x=1.5*sigma
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

// One step
sim.step()

// Forces should have acted: equal/opposite along x.
const fx0 = state.forces[0]
const fx1 = state.forces[3]
if (!approx(fx0, -fx1)) {
  console.error('Forces not equal/opposite', fx0, fx1)
  process.exit(1)
}

if (fx0 === 0) {
  console.error('Expected non-zero LJ force')
  process.exit(1)
}

// Positions should have advanced slightly (Euler integration) after force application.
if (state.positions[0] === 0 && state.positions[3] === 1.5 * sigma) {
  console.error('Positions did not change after step (unexpected)')
  process.exit(1)
}

console.log('Core scaffold test passed. Force x0=', fx0.toFixed(4))
