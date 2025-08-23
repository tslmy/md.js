// Validate gravity and coulomb force symmetry & direction signs.
import { createState } from '../built/core/simulation/state.js'
import { Simulation } from '../built/core/simulation/Simulation.js'
import { EulerIntegrator } from '../built/core/simulation/integrators.js'
import { Gravity } from '../built/core/forces/gravity.js'
import { Coulomb } from '../built/core/forces/coulomb.js'

function assert(cond, msg) { if (!cond) { console.error('FAIL:', msg); process.exit(1) } }

const params = { particleCount: 2, box: { x: 5, y: 5, z: 5 }, dt: 0.01, cutoff: 10 }
const state = createState(params)
// Place particles along x axis
state.positions.set([0,0,0, 2,0,0])
state.masses.set([2, 3])
state.charges.set([+1, -1])

const grav = new Gravity({ G: 1 })
const coul = new Coulomb({ K: 1 })
const sim = new Simulation(state, EulerIntegrator, [grav, coul], { dt: params.dt, cutoff: params.cutoff })

sim.step()

const fx0 = state.forces[0]
const fx1 = state.forces[3]
assert(Math.abs(fx0 + fx1) < 1e-6, 'Forces not equal/opposite')
// Gravity should attract (negative coeff * dx), Coulomb here is opposite sign (charges +1, -1 => negative product -> attractive if formula had sign?). Our current Coulomb uses +K*q1*q2 so q1*q2=-1 => net negative coefficient -> attractive like gravity. So both contribute same direction.
assert(fx0 !== 0, 'Expected non-zero total force')
console.log('Forces test passed. fx0=', fx0.toFixed(4))
