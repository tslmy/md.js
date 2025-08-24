import { describe, it, expect } from 'vitest'
import { createState } from '../built/core/simulation/state.js'
import { serializeState, hydrateState } from '../built/core/simulation/serialize.js'

function arraysEqual(a: Float32Array|Uint8Array, b: Float32Array|Uint8Array) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

describe('state serialize/hydrate', () => {
  it('round-trips', () => {
    const N = 7
    let seed = 123
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xffffffff }
    const state = createState({ particleCount: N, box: { x: 0, y: 0, z: 0 }, dt: 0.01, cutoff: 5 })
    for (let i = 0; i < N; i++) {
      const i3 = 3 * i
      state.positions[i3] = (rand() * 2 - 1)
      state.positions[i3 + 1] = (rand() * 2 - 1)
      state.positions[i3 + 2] = (rand() * 2 - 1)
      state.velocities[i3] = (rand() * 2 - 1) * 0.1
      state.velocities[i3 + 1] = (rand() * 2 - 1) * 0.1
      state.velocities[i3 + 2] = (rand() * 2 - 1) * 0.1
      state.masses[i] = 1 + rand()
      state.charges[i] = Math.round((rand() * 6) - 3)
      state.escaped[i] = (rand() > 0.7) ? 1 : 0
    }
    state.time = 42.5
    const snap = serializeState(state)
    const clone = hydrateState(snap)
    expect(clone.N).toBe(state.N)
    expect(clone.time).toBe(state.time)
    expect(arraysEqual(clone.positions, state.positions)).toBe(true)
    expect(arraysEqual(clone.velocities, state.velocities)).toBe(true)
    expect(arraysEqual(clone.forces, state.forces)).toBe(true)
    expect(arraysEqual(clone.masses, state.masses)).toBe(true)
    expect(arraysEqual(clone.charges, state.charges)).toBe(true)
    expect(arraysEqual(clone.escaped, state.escaped)).toBe(true)
  })
})
