import { describe, it, expect } from 'vitest'
import { hydrate, snapshot } from '../src/engine/persist'
import { SimulationEngine } from '../src/engine/SimulationEngine'
import { buildEngineConfig } from '../src/engine/config'
import { settings } from '../src/control/settings'

describe('hydrate snapshot error handling', () => {
  it('rejects unsupported snapshot version', () => {
    const cfg = buildEngineConfig(settings)
    cfg.world.particleCount = 1
    const engine = new SimulationEngine(cfg)
    const good = snapshot(engine)
    const bad = { ...good, version: 99 } as unknown as ReturnType<typeof snapshot>
    // hydrate should throw due to unsupported version (runtime check on version !== 1)
    expect(() => hydrate(bad as unknown as ReturnType<typeof snapshot>)).toThrow()
  })
})
