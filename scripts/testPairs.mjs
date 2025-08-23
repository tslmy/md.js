// Test forEachPair unique pair enumeration vs expected count, and cutoff behavior.
import { createState } from '../built/core/simulation/state.js'
import { forEachPair } from '../built/core/forces/forceInterfaces.js'
import { assert } from './testUtil.mjs'

const N = 5
const state = createState({ particleCount: N, box: { x: 0, y: 0, z: 0 }, dt: 0, cutoff: 0 })
// Arrange positions on a line with spacing 1
for (let i = 0; i < N; i++) {
  const i3 = 3 * i
  state.positions[i3] = i
  state.positions[i3 + 1] = 0
  state.positions[i3 + 2] = 0
}

// With large cutoff, expect N*(N-1)/2 pairs
let pairs = []
forEachPair(state, 100, (i, j, dx, dy, dz, r2) => { pairs.push({ i, j, dx, r2 }) })
assert(pairs.length === N * (N - 1) / 2, 'Unexpected pair count full cutoff')
// Ensure ordering i<j
assert(pairs.every(p => p.i < p.j), 'Ordering violated')
// Ensure no duplicates
const keySet = new Set(pairs.map(p => `${p.i}-${p.j}`))
assert(keySet.size === pairs.length, 'Duplicate pairs detected')
// Cutoff 1.5 should only include neighbors with distance 1 (adjacent)
let neighborPairs = []
forEachPair(state, 1.5, (i, j) => { neighborPairs.push({ i, j }) })
assert(neighborPairs.length === (N - 1), 'Neighbor pair count incorrect under cutoff')
console.log('[pairs] PASS: pair enumeration correct')
