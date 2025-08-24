// Verify neighbor list scaffold (naive) matches direct O(N^2) pair enumeration.
import { SimulationEngine } from '../built/engine/SimulationEngine.js'
import { fromSettings } from '../built/engine/config/types.js'
import { settings } from '../built/settings.js'
import { forEachPair, setPairIterationImpl } from '../built/core/forces/forceInterfaces.js'

function fail(msg) { console.error('[neighbor] FAIL:', msg); process.exit(1) }

const cfg = fromSettings(settings)
cfg.world.particleCount = 6
cfg.forces.gravity = false
cfg.forces.coulomb = false
cfg.runtime.dt = 0.0001

const engine = new SimulationEngine(cfg)
// Seed deterministic line
const st = engine.getState()
for (let i = 0; i < st.N; i++) {
  const i3 = 3 * i
  st.positions[i3] = i * 0.1
  st.positions[i3+1] = 0
  st.positions[i3+2] = 0
  st.velocities[i3] = st.velocities[i3+1] = st.velocities[i3+2] = 0
  st.masses[i] = 1
}

// Count pairs via API (current strategy already active)
let countStrategy = 0
forEachPair(st, cfg.runtime.cutoff, () => { countStrategy++ })

// Install explicit naive impl (duplicate logic) to cross-check
setPairIterationImpl((state, cutoff, handler) => {
  const cutoff2 = cutoff * cutoff
  const { N, positions } = state
  for (let i = 0; i < N; i++) {
    const i3 = 3 * i
    const ix = positions[i3]; const iy = positions[i3+1]; const iz = positions[i3+2]
    for (let j = i + 1; j < N; j++) {
      const j3 = 3 * j
      const dx = ix - positions[j3]
      const dy = iy - positions[j3+1]
      const dz = iz - positions[j3+2]
      const r2 = dx*dx + dy*dy + dz*dz
      if (r2 <= cutoff2) handler(i,j,dx,dy,dz,r2)
    }
  }
})

let countNaive = 0
forEachPair(st, cfg.runtime.cutoff, () => { countNaive++ })
if (countNaive !== countStrategy) fail('Pair counts mismatch ' + countStrategy + ' vs ' + countNaive)

console.log('[neighbor] PASS: naive strategy pair count =', countStrategy)
