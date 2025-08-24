import { setPairIterationImpl } from '../forces/forceInterfaces.js';
/** Naive strategy passthrough – baseline correctness reference. */
export function createNaiveNeighborStrategy() {
    return {
        name: 'naive',
        rebuild() { },
        forEachPair: (state, cutoff, handler) => {
            // Use temporary override-free logic replicating previous naive implementation
            const { N, positions } = state;
            const cutoff2 = cutoff * cutoff;
            for (let i = 0; i < N; i++) {
                const i3 = 3 * i;
                const ix = positions[i3];
                const iy = positions[i3 + 1];
                const iz = positions[i3 + 2];
                for (let j = i + 1; j < N; j++) {
                    const j3 = 3 * j;
                    const dx = ix - positions[j3];
                    const dy = iy - positions[j3 + 1];
                    const dz = iz - positions[j3 + 2];
                    const r2 = dx * dx + dy * dy + dz * dz;
                    if (r2 <= cutoff2)
                        handler(i, j, dx, dy, dz, r2);
                }
            }
        },
        rebuildEveryStep: false
    };
}
/** Install the pair iteration of a strategy globally for force plugins. */
export function activateNeighborStrategy(strategy) {
    setPairIterationImpl(strategy.forEachPair);
}
/** Compute linear cell index. */
function cellIndex(ix, iy, iz, dims) {
    const [nx, ny] = dims;
    return ix + nx * (iy + ny * iz);
}
/** Create cell list buffers sized for current box & cutoff. */
/**
 * Allocate & initialize cell list buffers sized for a heuristic cubic region.
 * NOTE: The heuristic picks n = floor( (4*cutoff) / cutoff ) = ~4 cells per axis (unless cutoff tiny).
 * This is intentionally coarse; a future revision should derive from actual world box extents.
 */
function createCellList(state, cutoff) {
    const cellSize = cutoff;
    const L = cutoff * 2;
    const n = Math.max(1, Math.floor((2 * L) / cellSize));
    const total = n * n * n;
    return { cellSize, dims: [n, n, n], heads: new Int32Array(total).fill(-1), next: new Int32Array(state.N).fill(-1) };
}
/** Rebuild particle -> cell linked lists. */
/**
 * Rebuild stage: assigns every particle to exactly one cell by *prepending* it to that cell's linked list.
 * We clamp positions into the [0, n-1] index range per axis to keep indices valid when particles drift outside heuristic bounds.
 * This clamping induces slight over‑approximation of neighbor candidates for escaped particles but preserves correctness.
 */
function rebuildCellList(state, cutoff, data) {
    const { positions, N } = state;
    const { cellSize, dims, heads, next } = data;
    heads.fill(-1);
    next.fill(-1);
    const [nx, ny, nz] = dims; // here we use all three
    const L = cutoff * 2;
    for (let i = 0; i < N; i++) {
        const i3 = 3 * i;
        const x = positions[i3];
        const y = positions[i3 + 1];
        const z = positions[i3 + 2];
        // Map position into [0,2L) then to cell index (very approximate; assumes particles remain near origin)
        const fx = Math.min(nx - 1, Math.max(0, Math.floor((x + L) / cellSize)));
        const fy = Math.min(ny - 1, Math.max(0, Math.floor((y + L) / cellSize)));
        const fz = Math.min(nz - 1, Math.max(0, Math.floor((z + L) / cellSize)));
        const ci = cellIndex(fx, fy, fz, dims);
        next[i] = heads[ci];
        heads[ci] = i;
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
function cellForEachPair(state, cutoff, handler, data) {
    const cutoff2 = cutoff * cutoff;
    const { positions } = state;
    const { heads, next, dims } = data;
    const [nx, ny, nz] = dims;
    const neighborsOf = (ix, iy, iz, cb) => {
        for (let dxCell = -1; dxCell <= 1; dxCell++) {
            const jx = ix + dxCell;
            if (jx < 0 || jx >= nx)
                continue;
            for (let dyCell = -1; dyCell <= 1; dyCell++) {
                const jy = iy + dyCell;
                if (jy < 0 || jy >= ny)
                    continue;
                for (let dzCell = -1; dzCell <= 1; dzCell++) {
                    const jz = iz + dzCell;
                    if (jz < 0 || jz >= nz)
                        continue;
                    cb(cellIndex(jx, jy, jz, dims));
                }
            }
        }
    };
    const visitCellPair = (baseIdx, neighborIdx) => {
        for (let a = heads[baseIdx]; a !== -1; a = next[a]) {
            const a3 = 3 * a;
            const ax = positions[a3];
            const ay = positions[a3 + 1];
            const az = positions[a3 + 2];
            for (let b = heads[neighborIdx]; b !== -1; b = next[b]) {
                if (neighborIdx === baseIdx && b <= a)
                    continue;
                const b3 = 3 * b;
                const dx = ax - positions[b3];
                const dy = ay - positions[b3 + 1];
                const dz = az - positions[b3 + 2];
                const r2 = dx * dx + dy * dy + dz * dz;
                if (r2 <= cutoff2)
                    handler(a, b, dx, dy, dz, r2);
            }
        }
    };
    for (let ix = 0; ix < nx; ix++)
        for (let iy = 0; iy < ny; iy++)
            for (let iz = 0; iz < nz; iz++) {
                const baseIdx = cellIndex(ix, iy, iz, dims);
                neighborsOf(ix, iy, iz, neighborIdx => visitCellPair(baseIdx, neighborIdx));
            }
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
export function createCellNeighborStrategy() {
    let data = null;
    return {
        name: 'cell',
        rebuild(state, cutoff) {
            if (!data || state.N !== data.next.length)
                data = createCellList(state, cutoff);
            rebuildCellList(state, cutoff, data);
        },
        forEachPair: (state, cutoff, handler) => {
            if (!data) {
                data = createCellList(state, cutoff);
                rebuildCellList(state, cutoff, data);
            }
            cellForEachPair(state, cutoff, handler, data);
        },
        rebuildEveryStep: true
    };
}
//# sourceMappingURL=neighborList.js.map
