/** Neighbor list abstraction scaffold.
 * Current implementation delegates to naive O(N^2) but records structure for future cell lists.
 */
import type { SimulationState } from '../simulation/state.js'
import { setPairIterationImpl, PairIterationImpl } from '../forces/forceInterfaces.js'

export interface NeighborListStrategy {
  /** Human-readable identifier. */
  readonly name: string
  /** Rebuild internal structures given current positions (called each step if strategy requests). */
  rebuild(state: SimulationState, cutoff: number): void
  /** Pair iteration implementation bound to internal structures. */
  forEachPair: PairIterationImpl
  /** If true engine will call rebuild every step; else caller must manage cadence. */
  readonly rebuildEveryStep: boolean
}

/** Naive strategy passthrough – baseline correctness reference. */
export function createNaiveNeighborStrategy(): NeighborListStrategy {
  return {
    name: 'naive',
    rebuild() {/* noop */},
    forEachPair: (state, cutoff, handler) => {
      // Use temporary override-free logic replicating previous naive implementation
      const { N, positions } = state
      const cutoff2 = cutoff * cutoff
      for (let i = 0; i < N; i++) {
        const i3 = 3 * i
        const ix = positions[i3]; const iy = positions[i3 + 1]; const iz = positions[i3 + 2]
        for (let j = i + 1; j < N; j++) {
          const j3 = 3 * j
          const dx = ix - positions[j3]
          const dy = iy - positions[j3 + 1]
          const dz = iz - positions[j3 + 2]
          const r2 = dx * dx + dy * dy + dz * dz
          if (r2 <= cutoff2) handler(i, j, dx, dy, dz, r2)
        }
      }
    },
    rebuildEveryStep: false
  }
}

/** Install the pair iteration of a strategy globally for force plugins. */
export function activateNeighborStrategy(strategy: NeighborListStrategy): void {
  setPairIterationImpl(strategy.forEachPair)
}
