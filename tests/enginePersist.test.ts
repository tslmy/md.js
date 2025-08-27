import { describe, it, expect } from 'vitest'
import { SimulationEngine } from '../src/engine/SimulationEngine'
import { buildEngineConfig } from '../src/engine/config'
import { snapshot, hydrate } from '../src/engine/persist'
import { settings } from '../src/control/settings'

describe('engine snapshot/hydrate', () => {
  it('round-trips sample state', () => {
    const cfg = buildEngineConfig(settings)
    const engine = new SimulationEngine(cfg)
    const st = engine.getState()
    for (let i = 0; i < st.N; i++) {
      const i3 = 3 * i
      st.positions[i3] = i * 0.1
      st.velocities[i3 + 1] = 0.01 * i
      st.masses[i] = 1
    }
    for (let s = 0; s < 5; s++) engine.step()
    const snap = snapshot(engine)
    expect(snap.time).toBeGreaterThan(0)
    const engine2 = hydrate(snap)
    const st2 = engine2.getState()
    for (let i = 0; i < Math.min(5, st.N); i++) {
      const i3 = 3 * i
      const dx = Math.abs(st.positions[i3] - st2.positions[i3])
      const dy = Math.abs(st.velocities[i3 + 1] - st2.velocities[i3 + 1])
      expect(dx).toBeLessThan(1e-9)
      expect(dy).toBeLessThan(1e-9)
    }
  })
})
