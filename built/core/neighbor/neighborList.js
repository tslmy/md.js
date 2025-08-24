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
//# sourceMappingURL=neighborList.js.map