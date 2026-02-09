import { describe, it, expect } from 'vitest'
import { createState } from '../src/core/simulation/state'
import { forEachPair } from '../src/core/forces/forceInterfaces'

const noPbc = { enabled: false, box: { x: 0, y: 0, z: 0 } }

function collectPairs(state: ReturnType<typeof createState>, cutoff: number) {
  const pairs: Array<{ i: number; j: number }> = []
  forEachPair(state, cutoff, (i, j) => { pairs.push({ i, j }) }, noPbc)
  return pairs
}

describe('pair enumeration', () => {
  it('enumerates unique pairs and respects cutoff', () => {
    const N = 5
    const state = createState({ particleCount: N, box: { x: 0, y: 0, z: 0 }, dt: 0, cutoff: 0 })
    for (let i = 0; i < N; i++) {
      const i3 = 3 * i
      state.positions[i3] = i
    }
    const allPairs: Array<{ i: number; j: number }> = []
    forEachPair(state, 100, (i, j) => { allPairs.push({ i, j }) }, noPbc)
    expect(allPairs.length).toBe(N * (N - 1) / 2)
    expect(allPairs.every(p => p.i < p.j)).toBe(true)
    const keys = new Set(allPairs.map(p => `${p.i}-${p.j}`))
    expect(keys.size).toBe(allPairs.length)
    const neighborPairs = collectPairs(state, 1.5)
    expect(neighborPairs.length).toBe(N - 1)
  })
})
