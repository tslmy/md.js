import { describe, it, expect } from 'vitest'
import { SimulationEngine } from '../built/engine/SimulationEngine.js'
import { fromSettings } from '../built/engine/config/types.js'
import { snapshot, hydrate } from '../built/engine/persistence/persist.js'
import { settings } from '../built/settings.js'

// Simple helper to build dummy trajectory arrays matching particles
function makeDummyTrajectories(N: number, len: number): number[][] {
  const out: number[][] = []
  for (let i = 0; i < N; i++) {
    const arr: number[] = []
    for (let j = 0; j < len; j++) {
      // encode (particle index, step index) in coordinates for validation
      arr.push(i, j, i + j * 0.5)
    }
    out.push(arr)
  }
  return out
}

describe('engine snapshot with trajectories (optional extras)', () => {
  it('includes and preserves injected trajectory arrays', () => {
    const cfg = fromSettings(settings)
    const engine = new SimulationEngine(cfg)
    // step a bit to change time
    for (let s = 0; s < 3; s++) engine.step()
    const N = engine.getState().N
    const trajLen = 5
    const trajectories = makeDummyTrajectories(N, trajLen)
    const snap = snapshot(engine, { trajectories, maxTrajectoryLength: trajLen })
    expect(snap.trajectories).toBeDefined()
    expect(snap.maxTrajectoryLength).toBe(trajLen)
    expect(snap.trajectories?.length).toBe(N)
    // Hydrate engine (core ignores trajectories) and ensure normal fields remain intact
    const engine2 = hydrate(snap)
    expect(engine2.getState().N).toBe(N)
    // Validate trajectory payload integrity (not consumed by hydrate, but kept in snapshot)
    const t0 = snap.trajectories?.[0]
    expect(t0?.slice(0,3)).toEqual([0,0,0])
    const last = snap.trajectories?.[N-1]
    if (last) {
      const expected = [N-1, trajLen-1, (N-1) + (trajLen-1)*0.5]
      const got = last.slice((trajLen-1)*3, (trajLen-1)*3 + 3)
      expect(got).toEqual(expected)
    }
  })
})
