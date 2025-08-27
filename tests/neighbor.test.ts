import { describe, it, expect } from 'vitest'
import { SimulationEngine } from '../built/engine/SimulationEngine.js'
import { buildEngineConfig } from '../built/engine/config.js'
import { settings } from '../built/control/settings.js'
import { forEachPair, setPairIterationImpl } from '../built/core/forces/forceInterfaces.js'

describe('neighbor naive strategy', () => {
  it('matches manual pair enumeration count', () => {
    const cfg = buildEngineConfig(settings)
    cfg.world.particleCount = 6
    cfg.forces.gravity = false
    cfg.forces.coulomb = false
    cfg.runtime.dt = 0.0001
    cfg.neighbor = { strategy: 'naive' }
    const engine = new SimulationEngine(cfg)
    const st = engine.getState()
    for (let i = 0; i < st.N; i++) {
      const i3 = 3 * i
      st.positions[i3] = i * 0.1
      st.positions[i3 + 1] = 0
      st.positions[i3 + 2] = 0
      st.masses[i] = 1
    }
    let countStrategy = 0
    forEachPair(st, cfg.runtime.cutoff, () => { countStrategy++ })
    // Override with naive impl for cross-check
    setPairIterationImpl((state, cutoff, handler) => {
      const cutoff2 = cutoff * cutoff
      const { N, positions } = state
      for (let i = 0; i < N; i++) {
        const i3 = 3 * i
        const ix = positions[i3]; const iy = positions[i3 + 1]; const iz = positions[i3 + 2]
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
    let countManual = 0
    forEachPair(st, cfg.runtime.cutoff, () => { countManual++ })
    expect(countManual).toBe(countStrategy)
  })
})
