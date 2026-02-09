import { describe, it, expect } from 'vitest'
import { SimulationEngine } from '../built/engine/SimulationEngine.js'
import { buildEngineConfig } from '../built/engine/config.js'
import { settings } from '../built/control/settings.js'
import { forEachPair } from '../built/core/forces/forceInterfaces.js'

const noPbc = { enabled: false, box: { x: 0, y: 0, z: 0 } }

describe('cell neighbor strategy box resize', () => {
  it('rebuilds grid when world box dimensions change', () => {
    const cfg = buildEngineConfig(settings)
    cfg.world.particleCount = 10
    cfg.forces.gravity = false
    cfg.forces.coulomb = false
    cfg.neighbor = { strategy: 'cell' }
    const engine = new SimulationEngine(cfg)
    const st = engine.getState()
    // Place particles near positive X edge so a larger box reduces per-cell density.
    for (let i = 0; i < st.N; i++) {
      const i3 = 3 * i
      st.positions[i3] = cfg.runtime.cutoff * 0.9
      st.positions[i3 + 1] = (i % 2) * 0.05
      st.positions[i3 + 2] = 0
      st.masses[i] = 1
    }
    // Step once to build initial neighbor structure.
    engine.step()
    let initialPairs = 0
    forEachPair(st, cfg.runtime.cutoff, () => { initialPairs++ }, noPbc)
    // Enlarge box in X so particles cluster in a smaller relative region; pair count should stay same but rebuild path exercised.
    engine.updateConfig({ world: { ...cfg.world, box: { x: cfg.world.box.x * 2, y: cfg.world.box.y, z: cfg.world.box.z }, particleCount: cfg.world.particleCount } })
    engine.step()
    let afterPairs = 0
    forEachPair(st, cfg.runtime.cutoff, () => { afterPairs++ }, noPbc)
    expect(afterPairs).toBe(initialPairs)
  })
})
