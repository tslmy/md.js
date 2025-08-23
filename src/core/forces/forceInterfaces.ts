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
 * Naive O(N^2) pair iterator with distance cutoff.
 * For each i<j pair inside cutoff^2 calls the handler once.
 * Future optimization path: replace with cell / neighbor list to cut complexity toward O(N).
 */
export function forEachPair(state: SimulationState, cutoff: number, handler: PairHandler): void {
  const { N, positions } = state
  const cutoff2 = cutoff * cutoff
  for (let i = 0; i < N; i++) {
    const i3 = index3(i)
    const ix = positions[i3]
    const iy = positions[i3 + 1]
    const iz = positions[i3 + 2]
    for (let j = i + 1; j < N; j++) {
      const j3 = index3(j)
      const dx = ix - positions[j3]
      const dy = iy - positions[j3 + 1]
      const dz = iz - positions[j3 + 2]
      const r2 = dx * dx + dy * dy + dz * dz
      if (r2 <= cutoff2) handler(i, j, dx, dy, dz, r2)
    }
  }
}
