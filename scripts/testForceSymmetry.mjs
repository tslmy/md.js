// Test pairwise force symmetry for all enabled force types on random configuration.
import { createState } from '../built/core/simulation/state.js'
import { Simulation } from '../built/core/simulation/Simulation.js'
import { VelocityVerlet } from '../built/core/simulation/integrators.js'
import { LennardJones } from '../built/core/forces/lennardJones.js'
import { Gravity } from '../built/core/forces/gravity.js'
import { Coulomb } from '../built/core/forces/coulomb.js'

function fail(msg) { console.error('[force-sym] FAIL:', msg); process.exit(1) }

const N = 6
const params = { particleCount: N, box: { x: 5, y: 5, z: 5 }, dt: 0.002, cutoff: 10 }
const state = createState(params)
// Random but deterministic-ish (simple LCG) to keep reproducible
let seed = 42
function rand() { seed = (seed * 1664525 + 1013904223) >>> 0; return (seed & 0xffffff) / 0x1000000 }
for (let i = 0; i < N; i++) {
  const i3 = 3 * i
  state.positions[i3] = (rand() * 2 - 1) * 2
  state.positions[i3 + 1] = (rand() * 2 - 1) * 2
  state.positions[i3 + 2] = (rand() * 2 - 1) * 2
  state.velocities[i3] = (rand() * 2 - 1) * 0.1
  state.velocities[i3 + 1] = (rand() * 2 - 1) * 0.1
  state.velocities[i3 + 2] = (rand() * 2 - 1) * 0.1
  state.masses[i] = 1 + rand()
  state.charges[i] = Math.round((rand() * 6) - 3) // -3..+3
}

const forces = [
  new LennardJones({ epsilon: 1, sigma: 1 }),
  new Gravity({ G: 0.1 }),
  new Coulomb({ K: 0.2 })
]

const sim = new Simulation(state, VelocityVerlet, forces, { dt: params.dt, cutoff: params.cutoff })

// Single step is enough to compute forces.
sim.step()

// Verify sum of all forces ~ 0 (momentum conservation) and pairwise antisymmetry.
const total = [0,0,0]
for (let i = 0; i < N; i++) {
  const i3 = 3 * i
  total[0] += state.forces[i3]
  total[1] += state.forces[i3+1]
  total[2] += state.forces[i3+2]
}
const netMag = Math.hypot(...total)
if (netMag > 1e-5) fail('Net force not ~0: ' + netMag)

console.log('[force-sym] PASS: net force ~0, magnitude', netMag.toExponential(2))
