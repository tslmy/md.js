// Test serialize/hydrate round-trip fidelity.
import { createState } from '../built/core/simulation/state.js'
import { serializeState, hydrateState } from '../built/core/simulation/serialize.js'
import { assert, makeLCG } from './testUtil.mjs'

const N = 7
const lcg = makeLCG(123)
const state = createState({ particleCount: N, box: { x: 0, y: 0, z: 0 }, dt: 0.01, cutoff: 5 })
for (let i = 0; i < N; i++) {
  const i3 = 3 * i
  state.positions[i3] = (lcg() * 2 - 1)
  state.positions[i3 + 1] = (lcg() * 2 - 1)
  state.positions[i3 + 2] = (lcg() * 2 - 1)
  state.velocities[i3] = (lcg() * 2 - 1) * 0.1
  state.velocities[i3 + 1] = (lcg() * 2 - 1) * 0.1
  state.velocities[i3 + 2] = (lcg() * 2 - 1) * 0.1
  state.masses[i] = 1 + lcg()
  state.charges[i] = Math.round((lcg() * 6) - 3)
  state.escaped[i] = (lcg() > 0.7) ? 1 : 0
}
state.time = 42.5

const snap = serializeState(state)
const clone = hydrateState(snap)

function arraysEqual(a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}
assert(clone.N === state.N, 'N mismatch')
assert(clone.time === state.time, 'time mismatch')
assert(arraysEqual(clone.positions, state.positions), 'positions mismatch')
assert(arraysEqual(clone.velocities, state.velocities), 'velocities mismatch')
assert(arraysEqual(clone.forces, state.forces), 'forces mismatch')
assert(arraysEqual(clone.masses, state.masses), 'masses mismatch')
assert(arraysEqual(clone.charges, state.charges), 'charges mismatch')
assert(arraysEqual(clone.escaped, state.escaped), 'escaped mismatch')
console.log('[persist] PASS: serialize/hydrate round-trip')
