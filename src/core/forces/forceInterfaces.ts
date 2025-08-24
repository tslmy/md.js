import { SimulationState, index3 } from '../simulation/state.js'

/**
 * A ForceField encapsulates one physical interaction rule (e.g. gravity, electrostatics, Lennard-Jones).
 * Implementation rule of thumb for contributors without physics background:
 *  - Read pairwise loops as: for every unique unordered particle pair (i,j) within a certain distance (cutoff) compute a push/pull.
 *  - Add that push to one particle and the opposite to the other (Newton's third law ensures momentum conservation).
 *  - The magnitude formulas (inside specific forces) translate domain constants into numeric coefficients.
 */

export interface ForceField {
  /** Unique short identifier for diagnostics */
  readonly name: string
  /** Accumulate force contributions into state.forces (must only add; never reset arrays here). */
  apply(state: SimulationState, ctx: ForceContext): void
  /** Optional: return total potential energy contribution for current state (pairwise sum). */
  potential?(state: SimulationState, ctx: ForceContext): number
}

export interface ForceContext {
  /** Maximum interaction distance (optimization to skip weak far pairs). */
  cutoff: number
  /** Optional feature flags to gate specialized logic (reserved for future extensions). */
  flags?: Record<string, boolean>
  /** Optional constants bag for experimental force tuning without changing signatures. */
  constants?: Record<string, number>
}

export type PairHandler = (i: number, j: number, dx: number, dy: number, dz: number, r2: number) => void

/**
 * Pair iteration implementation signature.
 * Replaces direct O(N^2) loops so we can later introduce spatial partition acceleration structures.
 */
export type PairIterationImpl = (state: SimulationState, cutoff: number, handler: PairHandler) => void

// Default naive implementation (module-local so tests can still wrap via setter)
// Periodic box (half-lengths) for minimum-image distances (engine configured).
let _pbcEnabled = false
let _bx = 0; let _by = 0; let _bz = 0
export function setPeriodicBox(box: { x: number; y: number; z: number }, enabled: boolean): void {
  _pbcEnabled = enabled; _bx = box.x; _by = box.y; _bz = box.z
}
export function getPeriodicBox(): { enabled: boolean; x: number; y: number; z: number } {
  return { enabled: _pbcEnabled, x: _bx, y: _by, z: _bz }
}

let pairImpl: PairIterationImpl = function naive(state, cutoff, handler) {
  const { N, positions } = state
  const cutoff2 = cutoff * cutoff
  const usePbc = _pbcEnabled
  const bx = _bx, by = _by, bz = _bz
  const spanX = 2 * bx, spanY = 2 * by, spanZ = 2 * bz
  const wrap = (d: number, half: number, span: number) => {
    if (d > half) return d - span
    if (d < -half) return d + span
    return d
  }
  for (let i = 0; i < N; i++) {
    const i3 = index3(i)
    const ix = positions[i3]; const iy = positions[i3 + 1]; const iz = positions[i3 + 2]
    for (let j = i + 1; j < N; j++) {
      const j3 = index3(j)
      let dx = ix - positions[j3]
      let dy = iy - positions[j3 + 1]
      let dz = iz - positions[j3 + 2]
      if (usePbc) {
        dx = wrap(dx, bx, spanX)
        dy = wrap(dy, by, spanY)
        dz = wrap(dz, bz, spanZ)
      }
      const r2 = dx * dx + dy * dy + dz * dz
      if (r2 <= cutoff2) handler(i, j, dx, dy, dz, r2)
    }
  }
}

/** Set the global pair iteration implementation (engine / tests). */
export function setPairIterationImpl(fn: PairIterationImpl): void { pairImpl = fn }

/** Execute the current pair iteration implementation. */
export function forEachPair(state: SimulationState, cutoff: number, handler: PairHandler): void { pairImpl(state, cutoff, handler) }
