import { describe, it, expect } from 'vitest'
import { validateEngineConfig } from '../src/engine/config'

describe('engine config validation', () => {
  it('rejects invalid numeric values', () => {
    const cfg = {
      world: { particleCount: 2, box: { x: 1, y: 1, z: 1 } },
      runtime: { dt: -0.1, cutoff: 1 },
      forces: { lennardJones: true, gravity: true, coulomb: true },
      constants: { epsilon: 1, sigma: 1, G: 1, K: 1, kB: 1 }
    }
    expect(() => validateEngineConfig(cfg as unknown as import('../src/engine/config').EngineConfig)).toThrow()
  })
  it('rejects unsupported integrator name', () => {
    const cfg = {
      world: { particleCount: 2, box: { x: 1, y: 1, z: 1 } },
      runtime: { dt: 0.01, cutoff: 1, integrator: 'weird' },
      forces: { lennardJones: true, gravity: true, coulomb: true },
      constants: { epsilon: 1, sigma: 1, G: 1, K: 1, kB: 1 }
    }
    expect(() => validateEngineConfig(cfg as unknown as import('../src/engine/config').EngineConfig)).toThrow()
  })
})
