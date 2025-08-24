import { SimulationEngine } from '../SimulationEngine.js';
/** Capture a snapshot of the current engine state (copying arrays). */
export function snapshot(engine) {
    const st = engine.getState();
    const N = st.N;
    return {
        version: 1,
        config: engine.getConfig(),
        time: st.time,
        positions: Array.from(st.positions.subarray(0, 3 * N)),
        velocities: Array.from(st.velocities.subarray(0, 3 * N)),
        masses: Array.from(st.masses.subarray(0, N)),
        charges: Array.from(st.charges.subarray(0, N))
    };
}
/**
 * Create a new engine from a prior snapshot. Caller can then call run().
 * Assumes snapshot integrity was previously validated.
 */
export function hydrate(snap) {
    if (snap.version !== 1)
        throw new Error('Unsupported snapshot version ' + String(snap.version));
    const eng = new SimulationEngine(snap.config);
    eng.seed({
        positions: Float32Array.from(snap.positions),
        velocities: Float32Array.from(snap.velocities),
        masses: Float32Array.from(snap.masses),
        charges: Float32Array.from(snap.charges)
    });
    eng.setTime(snap.time);
    return eng;
}
// NOTE: This module intentionally does not touch browser storage. See `storage.ts` for
// localStorage integration helpers to avoid coupling core snapshot logic to a host API.
// (Removed deprecated configFromSettings helper; construct EngineConfig via fromSettings directly where needed.)
//# sourceMappingURL=persist.js.map
