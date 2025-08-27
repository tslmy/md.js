import { describe, it, expect } from 'vitest'
import { SimulationEngine } from '../built/engine/SimulationEngine.js'
import { buildEngineConfig } from '../built/engine/config.js'
import { settings } from '../built/control/settings.js'
import { forEachPair, setPairIterationImpl } from '../built/core/forces/forceInterfaces.js'

describe('neighbor cell strategy', () => {
  it('cell vs naive pair counts and runtime switch', () => {
    const cfg = buildEngineConfig(settings)
    cfg.world.particleCount = 12
    cfg.forces.gravity = false
    cfg.forces.coulomb = false
    cfg.neighbor = { strategy: 'cell' }
    const engine = new SimulationEngine(cfg)
    const st = engine.getState()
    let idx = 0
    for (let x = 0; x < 3; x++) for (let y = 0; y < 2; y++) for (let z = 0; z < 2 && idx < st.N; z++) {
      const i3 = 3 * idx
      st.positions[i3] = x * 0.05
      st.positions[i3 + 1] = y * 0.05
      st.positions[i3 + 2] = z * 0.05
      idx++
    }
    let cellPairs = 0
    forEachPair(st, cfg.runtime.cutoff, () => { cellPairs++ })
    setPairIterationImpl((state, cutoff, handler) => {
      const { positions, N } = state
      const cutoff2 = cutoff * cutoff
      for (let i = 0; i < N; i++) {
        const i3 = 3 * i
        const ix = positions[i3], iy = positions[i3 + 1], iz = positions[i3 + 2]
        for (let j = i + 1; j < N; j++) {
          const j3 = 3 * j
          const dx = ix - positions[j3]
          const dy = iy - positions[j3 + 1]
          const dz = iz - positions[j3 + 2]
          const r2 = dx * dx + dy * dy + dz * dz
          if (r2 <= cutoff2) handler(i, j, dx, dy, dz, r2)
        }
      }
    })
    let naivePairs = 0
    forEachPair(st, cfg.runtime.cutoff, () => { naivePairs++ })
    expect(cellPairs).toBe(naivePairs)
    engine.updateConfig({ neighbor: { strategy: 'naive' } })
    engine.step()
  })
})
