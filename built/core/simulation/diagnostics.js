/**
 * Compute kinetic energy and per-particle extrema in a single pass.
 * Returns totals to avoid repeated iteration over N.
 */
function computeKineticAndExtrema(state) {
    const { velocities, forces, masses, N } = state;
    let ke = 0;
    let maxSpeed = 0;
    let maxForce = 0;
    for (let i = 0; i < N; i++) {
        const i3 = 3 * i;
        const vx = velocities[i3], vy = velocities[i3 + 1], vz = velocities[i3 + 2];
        const speed2 = vx * vx + vy * vy + vz * vz;
        ke += 0.5 * (masses[i] || 1) * speed2;
        const speed = Math.sqrt(speed2);
        if (speed > maxSpeed)
            maxSpeed = speed;
        const fx = forces[i3], fy = forces[i3 + 1], fz = forces[i3 + 2];
        const fmag = Math.hypot(fx, fy, fz);
        if (fmag > maxForce)
            maxForce = fmag;
    }
    return { kinetic: ke, maxSpeed, maxForceMag: maxForce };
}
/**
 * Recompute total potential energy for currently enabled force fields using
 * the same O(N^2) pair iterator with cutoff as force accumulation.
 * NOTE: This duplicates pair iteration per force and is intentionally simple
 * for an initial diagnostics step (can be optimized by sharing pair loops later).
 */
function computePotential(state, forces, _cutoff) {
    let pot = 0;
    for (const f of forces) {
        // ForceField interface marks potential as optional; skip if absent
        if (f.potential)
            pot += f.potential(state, { cutoff: _cutoff });
    }
    return pot;
}
/**
 * Produce a Diagnostics snapshot for the given state & active force fields.
 * Pure function: does not mutate state.
 */
export function computeDiagnostics(state, forces, params) {
    const { kinetic, maxSpeed, maxForceMag } = computeKineticAndExtrema(state);
    const potential = computePotential(state, forces, params.cutoff);
    const temperature = kinetic * 2 / params.kB / (3 * state.N - 3); // from KE = (3N-3)/2 kB T
    const total = kinetic + potential;
    return { time: state.time, kinetic, potential, total, temperature, maxSpeed, maxForceMag };
}
//# sourceMappingURL=diagnostics.js.map