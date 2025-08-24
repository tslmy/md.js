import { describe, it, expect } from 'vitest'
import { SimulationEngine } from '../built/engine/SimulationEngine.js'
import { fromSettings } from '../built/engine/config/types.js'
import { settings } from '../built/settings.js'

// These tests exercise engine config patching & diagnostics emission.

describe('SimulationEngine', () => {
  it('config patch toggles gravity & integrator', () => {
    const cfg = fromSettings(settings)
    cfg.world.particleCount = 3
    cfg.forces.gravity = false
    cfg.forces.coulomb = false
    const engine = new SimulationEngine(cfg)
    const count0 = engine.getForces().length
  engine.updateConfig({ forces: { gravity: true, lennardJones: cfg.forces.lennardJones, coulomb: cfg.forces.coulomb } })
    const count1 = engine.getForces().length
    expect(count1).toBe(count0 + 1)
  engine.updateConfig({ runtime: { integrator: 'euler', dt: cfg.runtime.dt, cutoff: cfg.runtime.cutoff } })
    const t0 = engine.getState().time
    engine.step()
    expect(engine.getState().time).toBeGreaterThan(t0)
  })
  it('emits diagnostics', () => {
    const cfg = fromSettings(settings)
    cfg.world.particleCount = 4
    const engine = new SimulationEngine(cfg)
    const st = engine.getState()
    for (let i = 0; i < st.N; i++) {
      const i3 = 3 * i
      st.positions[i3] = i * 0.2
      st.velocities[i3+1] = 0.01
      st.masses[i] = 1
    }
  let diag: { kinetic: number; temperature: number; maxSpeed: number } | null = null
  engine.on('diagnostics', (d: unknown) => { if (!diag) diag = d as { kinetic: number; temperature: number; maxSpeed: number } })
    for (let s = 0; s < 3; s++) engine.step()
    expect(diag).not.toBeNull()
  expect(Number.isFinite(diag!.kinetic)).toBe(true)
  expect(Number.isFinite(diag!.temperature)).toBe(true)
  expect('maxSpeed' in diag!).toBe(true)
  })
})
