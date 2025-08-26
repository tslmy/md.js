import { describe, it, expect } from 'vitest'
import { hydrate, snapshot } from '../built/engine/persistence/persist.js'
import { SimulationEngine } from '../built/engine/SimulationEngine.js'
import { buildEngineConfig } from '../built/engine/config/types.js'
import { settings } from '../built/settings.js'

describe('hydrate snapshot error handling', () => {
  it('rejects unsupported snapshot version', () => {
    const cfg = buildEngineConfig(settings)
    cfg.world.particleCount = 1
    const engine = new SimulationEngine(cfg)
    const good = snapshot(engine)
    const bad = { ...good, version: 99 } as typeof good & { version: number }
    // hydrate should throw due to unsupported version (runtime check on version !== 1)
    expect(() => hydrate(bad as unknown as ReturnType<typeof snapshot>)).toThrow()
  })
})
