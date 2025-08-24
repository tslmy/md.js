// Test the cell neighbor strategy produces same pair count as naive and can be switched at runtime.
import { SimulationEngine } from '../built/engine/SimulationEngine.js'
import { legacySettingsToEngineConfig } from '../built/engine/config/types.js'
import { settings } from '../built/settings.js'
import { forEachPair, setPairIterationImpl } from '../built/core/forces/forceInterfaces.js'

function fail(msg) { console.error('[neighbor-cell] FAIL:', msg); process.exit(1) }

// Build engine with cell strategy
const cfg = legacySettingsToEngineConfig(settings)
cfg.world.particleCount = 12
cfg.forces.gravity = false
cfg.forces.coulomb = false
cfg.neighbor = { strategy: 'cell' }

const engine = new SimulationEngine(cfg)
const st = engine.getState()
// Place particles on a 3D grid inside small region
let idx = 0
for (let x = 0; x < 3; x++) for (let y = 0; y < 2; y++) for (let z = 0; z < 2 && idx < st.N; z++) {
  const i3 = 3 * idx
  st.positions[i3] = x * 0.05
  st.positions[i3+1] = y * 0.05
  st.positions[i3+2] = z * 0.05
  idx++
}

let cellPairs = 0
forEachPair(st, cfg.runtime.cutoff, () => { cellPairs++ })

// Force use of naive via explicit override
setPairIterationImpl((state, cutoff, handler) => {
  const { positions, N } = state
  const cutoff2 = cutoff * cutoff
  for (let i = 0; i < N; i++) {
    const i3 = 3 * i
    const ix = positions[i3], iy = positions[i3+1], iz = positions[i3+2]
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
let naivePairs = 0
forEachPair(st, cfg.runtime.cutoff, () => { naivePairs++ })
if (cellPairs !== naivePairs) fail('Pair count mismatch cell=' + cellPairs + ' naive=' + naivePairs)

// Switch to naive via config update and ensure no crash
engine.updateConfig({ neighbor: { strategy: 'naive' } })
engine.step() // should work

console.log('[neighbor-cell] PASS: pair count', cellPairs, 'config switch OK')
