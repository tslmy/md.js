import { index3 } from '../simulation/state.js';
// Naive O(N^2) pair iteration with cutoff (squared) used for initial port.
export function forEachPair(state, cutoff, handler) {
    const { N, positions } = state;
    const cutoff2 = cutoff * cutoff;
    for (let i = 0; i < N; i++) {
        const i3 = index3(i);
        const ix = positions[i3];
        const iy = positions[i3 + 1];
        const iz = positions[i3 + 2];
        for (let j = i + 1; j < N; j++) {
            const j3 = index3(j);
            const dx = ix - positions[j3];
            const dy = iy - positions[j3 + 1];
            const dz = iz - positions[j3 + 2];
            const r2 = dx * dx + dy * dy + dz * dz;
            if (r2 <= cutoff2)
                handler(i, j, dx, dy, dz, r2);
        }
    }
}
