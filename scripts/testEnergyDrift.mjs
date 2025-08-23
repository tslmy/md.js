// Check approximate energy conservation over several steps with Velocity Verlet and LJ only.
import { createState } from '../built/core/simulation/state.js'
import { Simulation } from '../built/core/simulation/Simulation.js'
import { VelocityVerlet } from '../built/core/simulation/integrators.js'
import { LennardJones } from '../built/core/forces/lennardJones.js'

function potentialLJ(epsilon, sigma, r2) {
  const sr2 = (sigma * sigma) / r2
  const sr6 = sr2 * sr2 * sr2
  const sr12 = sr6 * sr6
  return 4 * epsilon * (sr12 - sr6)
}

const N = 8
const dt = 0.003
const steps = 400
const epsilon = 1, sigma = 1
const state = createState({ particleCount: N, box: { x: 6, y: 6, z: 6 }, dt, cutoff: 4.5 })
let seed = 7
function rand() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000 }
for (let i = 0; i < N; i++) {
  const i3 = 3 * i
  state.positions[i3] = (rand() * 2 - 1) * 2
  state.positions[i3 + 1] = (rand() * 2 - 1) * 2
  state.positions[i3 + 2] = (rand() * 2 - 1) * 2
  state.velocities[i3] = (rand() * 2 - 1) * 0.2
  state.velocities[i3 + 1] = (rand() * 2 - 1) * 0.2
  state.velocities[i3 + 2] = (rand() * 2 - 1) * 0.2
  state.masses[i] = 1
}

const sim = new Simulation(state, VelocityVerlet, [new LennardJones({ epsilon, sigma })], { dt, cutoff: 4.5 })

function kinetic() {
  let ke = 0
  for (let i = 0; i < N; i++) {
    const i3 = 3 * i
    const vx = state.velocities[i3], vy = state.velocities[i3+1], vz = state.velocities[i3+2]
    ke += 0.5 * state.masses[i] * (vx*vx + vy*vy + vz*vz)
  }
  return ke
}

function potential() {
  let pe = 0
  for (let i = 0; i < N; i++) {
    const i3 = 3 * i
    const ix = state.positions[i3], iy = state.positions[i3+1], iz = state.positions[i3+2]
    for (let j = i+1; j < N; j++) {
      const j3 = 3 * j
      const dx = ix - state.positions[j3]
      const dy = iy - state.positions[j3+1]
      const dz = iz - state.positions[j3+2]
      const r2 = dx*dx + dy*dy + dz*dz
      if (r2 === 0 || r2 > (4.5*4.5)) continue
      pe += potentialLJ(epsilon, sigma, r2)
    }
  }
  return pe
}

// Initial force build via first step call (Simulation handles it internally)
let initialEnergy
for (let s = 0; s < steps; s++) {
  sim.step()
  const e = kinetic() + potential()
  if (s === 0) initialEnergy = e
}
const finalEnergy = kinetic() + potential()
const drift = Math.abs(finalEnergy - initialEnergy) / Math.abs(initialEnergy)
if (drift > 0.05) { // 5% tolerance for toy simulator
  console.error('[energy] FAIL: energy drift', drift)
  process.exit(1)
}
console.log('[energy] PASS: relative drift', drift.toExponential(2))
