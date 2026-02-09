/** Neighbor list abstraction scaffold.
 * Current implementation delegates to naive O(N^2) but records structure for future cell lists.
 */
import type { SimulationState } from './state.js'
import { setPairIterationImpl, PairIterationImpl } from '../forces/forceInterfaces.js'
import { minimumImageDisplacement } from '../pbc.js'
import { magnitudeSquared } from '../../util/vectorMath.js'
import { int32Filled } from '../../util/arrays.js'

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
    rebuild() {/* noop */ },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    forEachPair: (state, cutoff, handler, _pbc) => {
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
          const r2 = magnitudeSquared(dx, dy, dz)
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

// ---------------- Cell (uniform grid) strategy (basic) ----------------

/**
 * Internal structure for the uniform cell (aka "linked‑cell") neighbor list strategy.
 *
 * Design (current minimal version):
 *  - Space is partitioned into a cubic lattice of axis‑aligned cells of edge length ~= cutoff.
 *  - Each cell stores a singly linked list of particle indices (heads[] + next[] arrays) – a classic SoA pattern.
 *  - During pair iteration we only inspect the 27 Moore‑neighborhood (cell itself + adjacent cells),
 *    which guarantees that any pair whose separation r <= cutoff lies either in the same cell or a neighbor cell
 *    (because cell edge >= cutoff, a particle cannot "skip" past a neighbor cell without exceeding the distance).
 *
 * Simplifications / Assumptions (to be revisited):
 *  - We approximate the simulation box as a cube with side length 4*cutoff centered at origin (L = 2*cutoff radius each side).
 *    This keeps code independent from a formal world box for now; out‑of‑range particles are clamped into edge cells.
 *  - No periodic wrapping yet; periodic boundary support will require mapping neighbor lookups across opposite faces.
 *  - Rebuild occurs every step (rebuildEveryStep: true). Later we can support Verlet shell (buffer) to rebuild less often.
 *  - Cell size fixed = cutoff; a tuned factor (e.g. half or using skin distance) could improve balance between cell count and neighbor checks.
 *
 * Complexity:
 *  - Rebuild: O(N) to assign each particle to a cell.
 *  - Pair iteration: O(N + M) where M is number of candidate pairs in 27 neighborhoods.
 *    For roughly uniform density this trends toward linear scaling in N (contrast naive O(N^2)).
 *
 * Memory:
 *  - heads: #cells (Int32 each)
 *  - next: N (Int32 each)
 *  - We intentionally avoid per‑cell dynamic arrays to stay GC‑free.
 */
interface CellListData {
  cellSize: number
  dims: [number, number, number]
  // head indices per cell (linked list), -1 sentinel
  heads: Int32Array
  // linked list next pointer per particle
  next: Int32Array
}

/** Compute linear cell index. */
function cellIndex(ix: number, iy: number, iz: number, dims: [number, number, number]): number {
  const [nx, ny] = dims
  return ix + nx * (iy + ny * iz)
}

/** Create cell list buffers sized for current box & cutoff. */
/**
 * Allocate & initialize cell list buffers sized for a heuristic cubic region.
 * NOTE: The heuristic picks n = floor( (4*cutoff) / cutoff ) = ~4 cells per axis (unless cutoff tiny).
 * This is intentionally coarse; a future revision should derive from actual world box extents.
 */
function createCellList(state: SimulationState, cutoff: number): CellListData {
  const cellSize = cutoff
  const L = cutoff * 2
  const n = Math.max(1, Math.floor((2 * L) / cellSize))
  const total = n * n * n
  return { cellSize, dims: [n, n, n], heads: int32Filled(total, -1), next: int32Filled(state.N, -1) }
}

/** Rebuild particle -> cell linked lists. */
/**
 * Rebuild stage: assigns every particle to exactly one cell by *prepending* it to that cell's linked list.
 * We clamp positions into the [0, n-1] index range per axis to keep indices valid when particles drift outside heuristic bounds.
 * This clamping induces slight over‑approximation of neighbor candidates for escaped particles but preserves correctness.
 */
function rebuildCellList(state: SimulationState, cutoff: number, data: CellListData): void {
  const { positions, N } = state
  const { cellSize, dims, heads, next } = data
  heads.fill(-1)
  next.fill(-1)
  const [nx, ny, nz] = dims // here we use all three
  const L = cutoff * 2
  for (let i = 0; i < N; i++) {
    const i3 = 3 * i
    const x = positions[i3]
    const y = positions[i3 + 1]
    const z = positions[i3 + 2]
    // Map position into [0,2L) then to cell index (very approximate; assumes particles remain near origin)
    const fx = Math.min(nx - 1, Math.max(0, Math.floor((x + L) / cellSize)))
    const fy = Math.min(ny - 1, Math.max(0, Math.floor((y + L) / cellSize)))
    const fz = Math.min(nz - 1, Math.max(0, Math.floor((z + L) / cellSize)))
    const ci = cellIndex(fx, fy, fz, dims)
    next[i] = heads[ci]
    heads[ci] = i
  }
}

/** Iterate pairs using 27-neighborhood. */
/**
 * Iterate candidate pairs by scanning each cell and its 26 neighbors.
 * We enforce an ordering rule to avoid duplicates:
 *   - If neighborIdx === baseIdx we only emit (a,b) with b > a.
 *   - For distinct cells we emit all (a,b) (because each cell pair is visited exactly once in this traversal order).
 *
 * Correctness argument (no missed pairs): For any two particles p,q within distance cutoff, place them in cells Cp,Cq.
 * Because cell edge >= cutoff, either Cp == Cq or Cp and Cq share a face/edge/corner => Cq in Moore neighborhood of Cp.
 * Thus the (Cp neighborhood) scan will encounter q when processing Cp.
 */
function cellForEachPair(state: SimulationState, cutoff: number, handler: (i: number, j: number, dx: number, dy: number, dz: number, r2: number) => void, pbc: import('../forces/forceInterfaces.js').PBCContext, data: CellListData): void {
  const cutoff2 = cutoff * cutoff
  const { positions } = state
  const { heads, next, dims } = data
  const [nx, ny, nz] = dims
  const { enabled: pbcEnabled, box } = pbc
  const usePbc = pbcEnabled && box.x > 0 && box.y > 0 && box.z > 0
  const emitPairsForCells = (baseIdx: number, neighborIdx: number) => {
    for (let a = heads[baseIdx]; a !== -1; a = next[a]) {
      const a3 = 3 * a
      const ax = positions[a3]; const ay = positions[a3 + 1]; const az = positions[a3 + 2]
      for (let b = heads[neighborIdx]; b !== -1; b = next[b]) {
        if (neighborIdx === baseIdx && b <= a) continue
        if (neighborIdx < baseIdx) continue
        const b3 = 3 * b
        let dx = ax - positions[b3]
        let dy = ay - positions[b3 + 1]
        let dz = az - positions[b3 + 2]
        if (usePbc) {
          dx = minimumImageDisplacement(dx, box.x)
          dy = minimumImageDisplacement(dy, box.y)
          dz = minimumImageDisplacement(dz, box.z)
        }
        const r2 = magnitudeSquared(dx, dy, dz)
        if (r2 <= cutoff2) handler(a, b, dx, dy, dz, r2)
      }
    }
  }
  const visitNeighborhood = (ix: number, iy: number, iz: number) => {
    for (let dxCell = -1; dxCell <= 1; dxCell++) {
      let jx = ix + dxCell
      if (usePbc) { jx = (jx + nx) % nx } else if (jx < 0 || jx >= nx) continue
      for (let dyCell = -1; dyCell <= 1; dyCell++) {
        let jy = iy + dyCell
        if (usePbc) { jy = (jy + ny) % ny } else if (jy < 0 || jy >= ny) continue
        for (let dzCell = -1; dzCell <= 1; dzCell++) {
          let jz = iz + dzCell
          if (usePbc) { jz = (jz + nz) % nz } else if (jz < 0 || jz >= nz) continue
          const baseIdx = cellIndex(ix, iy, iz, dims)
          const neighborIdx = cellIndex(jx, jy, jz, dims)
          // Avoid processing self cell 27 times under PBC (only handle center offset once)
          if (neighborIdx === baseIdx && (dxCell !== 0 || dyCell !== 0 || dzCell !== 0)) continue
          emitPairsForCells(baseIdx, neighborIdx)
        }
      }
    }
  }
  for (let ix = 0; ix < nx; ix++)
    for (let iy = 0; iy < ny; iy++)
      for (let iz = 0; iz < nz; iz++)
        visitNeighborhood(ix, iy, iz)
}

/**
 * Factory for the cell neighbor list strategy.
 * Exposed surface mirrors the naive variant so the engine can switch transparently.
 * Future improvements roadmap:
 *  - Periodic boundary wrapping (map neighbor lookups across boundaries)
 *  - Adaptive / user‑provided world box & dynamic reboxing
 *  - Verlet shell (skin) distance to rebuild less frequently (track max displacement)
 *  - SIMD / WASM batch distance checks
 */
export interface CellStrategyOptions {
  /** World half-extents (box.x means simulation spans [-box.x, box.x] on that axis). */
  box?: { x: number; y: number; z: number }
}

/**
 * Create a cell neighbor strategy optionally bound to a world box.
 * If a box is supplied we size the grid from its extents; else fall back to legacy heuristic.
 */
export function createCellNeighborStrategy(opts: CellStrategyOptions = {}): NeighborListStrategy {
  let data: CellListData | null = null
  let lastN = -1
  let lastCutoff = -1
  let lastBoxKey = ''
  /**
   * Ensure internal cell list structure matches current (N, cutoff, box) tuple.
   * Reallocation strategy:
   *  - Full rebuild when: first run, particle count changed, cutoff changed (affects cell edge & counts), or box resized.
   *  - Lightweight resize when only particle count changed (reuse heads[], replace next[] sized to N).
   * Followed by O(N) relink (rebuildCellList).
   */
  function ensure(state: SimulationState, cutoff: number): void {
    const box = opts.box
    const boxKey = box ? `${box.x},${box.y},${box.z}` : 'heuristic'
    // Reallocate if particle count changed or cutoff changed significantly or box resized.
    if (!data || state.N !== lastN || Math.abs(cutoff - lastCutoff) > 1e-9 || boxKey !== lastBoxKey) {
      if (box) {
        // Derive cell counts per axis from real box dimensions (width = 2*extent).
        const widthX = 2 * box.x
        const widthY = 2 * box.y
        const widthZ = 2 * box.z
        const nX = Math.max(1, Math.floor(widthX / cutoff))
        const nY = Math.max(1, Math.floor(widthY / cutoff))
        const nZ = Math.max(1, Math.floor(widthZ / cutoff))
        // Use uniform cell size = cutoff for now (non-uniform might complicate neighbor iteration logic).
        const total = nX * nY * nZ
        data = { cellSize: cutoff, dims: [nX, nY, nZ], heads: int32Filled(total, -1), next: int32Filled(state.N, -1) }
      } else {
        data = createCellList(state, cutoff)
      }
      lastN = state.N; lastCutoff = cutoff; lastBoxKey = boxKey
    } else if (data.next.length !== state.N) {
      // Particle count grew/shrank – reallocate next pointer array (heads size unchanged)
      data.next = int32Filled(state.N, -1)
      lastN = state.N
    }
    rebuildCellList(state, cutoff, data)
  }
  return {
    name: 'cell',
    rebuild(state, cutoff) { ensure(state, cutoff) },
    forEachPair: (state, cutoff, handler, pbc) => { ensure(state, cutoff); if (data) cellForEachPair(state, cutoff, handler, pbc, data) },
    rebuildEveryStep: true
  }
}
