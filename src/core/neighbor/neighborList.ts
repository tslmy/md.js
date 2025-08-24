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

// ---------------- Cell (uniform grid) strategy (basic) ----------------

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
function createCellList(state: SimulationState, cutoff: number): CellListData {
  const cellSize = cutoff
  const L = cutoff * 2
  const n = Math.max(1, Math.floor((2 * L) / cellSize))
  const total = n * n * n
  return { cellSize, dims: [n, n, n], heads: new Int32Array(total).fill(-1), next: new Int32Array(state.N).fill(-1) }
}

/** Rebuild particle -> cell linked lists. */
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
function cellForEachPair(state: SimulationState, cutoff: number, handler: (i: number, j: number, dx: number, dy: number, dz: number, r2: number) => void, data: CellListData): void {
  const cutoff2 = cutoff * cutoff
  const { positions } = state
  const { heads, next, dims } = data
  const [nx, ny, nz] = dims
  const neighborsOf = (ix: number, iy: number, iz: number, cb: (neighborIdx: number) => void) => {
    for (let dxCell = -1; dxCell <= 1; dxCell++) {
      const jx = ix + dxCell; if (jx < 0 || jx >= nx) continue
      for (let dyCell = -1; dyCell <= 1; dyCell++) {
        const jy = iy + dyCell; if (jy < 0 || jy >= ny) continue
        for (let dzCell = -1; dzCell <= 1; dzCell++) {
          const jz = iz + dzCell; if (jz < 0 || jz >= nz) continue
          cb(cellIndex(jx, jy, jz, dims))
        }
      }
    }
  }
  const visitCellPair = (baseIdx: number, neighborIdx: number) => {
    for (let a = heads[baseIdx]; a !== -1; a = next[a]) {
      const a3 = 3 * a
      const ax = positions[a3]; const ay = positions[a3 + 1]; const az = positions[a3 + 2]
      for (let b = heads[neighborIdx]; b !== -1; b = next[b]) {
        if (neighborIdx === baseIdx && b <= a) continue
        const b3 = 3 * b
        const dx = ax - positions[b3]
        const dy = ay - positions[b3 + 1]
        const dz = az - positions[b3 + 2]
        const r2 = dx * dx + dy * dy + dz * dz
        if (r2 <= cutoff2) handler(a, b, dx, dy, dz, r2)
      }
    }
  }
  for (let ix = 0; ix < nx; ix++) for (let iy = 0; iy < ny; iy++) for (let iz = 0; iz < nz; iz++) {
    const baseIdx = cellIndex(ix, iy, iz, dims)
    neighborsOf(ix, iy, iz, neighborIdx => visitCellPair(baseIdx, neighborIdx))
  }
}

export function createCellNeighborStrategy(): NeighborListStrategy {
  let data: CellListData | null = null
  return {
    name: 'cell',
    rebuild(state, cutoff) {
      if (!data || state.N !== data.next.length) data = createCellList(state, cutoff)
      rebuildCellList(state, cutoff, data)
    },
    forEachPair: (state, cutoff, handler) => {
      if (!data) {
        data = createCellList(state, cutoff)
        rebuildCellList(state, cutoff, data)
      }
      cellForEachPair(state, cutoff, handler, data)
    },
    rebuildEveryStep: true
  }
}
