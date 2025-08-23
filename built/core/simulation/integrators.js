import { index3 } from './state.js';
// Basic (existing) explicit Euler for parity baseline.
export const EulerIntegrator = {
    step(state, dt) {
        const { N, positions, velocities, forces, masses } = state;
        for (let i = 0; i < N; i++) {
            const i3 = index3(i);
            const invM = 1 / (masses[i] || 1);
            velocities[i3] += forces[i3] * invM * dt;
            velocities[i3 + 1] += forces[i3 + 1] * invM * dt;
            velocities[i3 + 2] += forces[i3 + 2] * invM * dt;
            positions[i3] += velocities[i3] * dt;
            positions[i3 + 1] += velocities[i3 + 1] * dt;
            positions[i3 + 2] += velocities[i3 + 2] * dt;
        }
        state.time += dt;
    }
};
// Velocity Verlet (better energy behavior) — not yet wired into main app.
export const VelocityVerlet = {
    step(state, dt) {
        const { N, positions, velocities, forces, masses } = state;
        const halfDt = 0.5 * dt;
        const ax = new Array(N);
        const ay = new Array(N);
        const az = new Array(N);
        for (let i = 0; i < N; i++) {
            const i3 = index3(i);
            const invM = 1 / (masses[i] || 1);
            ax[i] = forces[i3] * invM;
            ay[i] = forces[i3 + 1] * invM;
            az[i] = forces[i3 + 2] * invM;
            // first half-step position update
            positions[i3] += velocities[i3] * dt + 0.5 * ax[i] * dt * dt;
            positions[i3 + 1] += velocities[i3 + 1] * dt + 0.5 * ay[i] * dt * dt;
            positions[i3 + 2] += velocities[i3 + 2] * dt + 0.5 * az[i] * dt * dt;
            // provisional half-step velocity
            velocities[i3] += ax[i] * halfDt;
            velocities[i3 + 1] += ay[i] * halfDt;
            velocities[i3 + 2] += az[i] * halfDt;
        }
        // NOTE: caller must recompute forces here for full Verlet (not done yet in this scaffold)
        // After recomputing forces, caller should invoke finalizeVelocityVerlet()
        state.time += dt;
    }
};
export function finalizeVelocityVerlet(state, dt, oldAccelerations) {
    const { N, velocities, forces, masses } = state;
    const halfDt = 0.5 * dt;
    for (let i = 0; i < N; i++) {
        const i3 = index3(i);
        const invM = 1 / (masses[i] || 1);
        const axNew = forces[i3] * invM;
        const ayNew = forces[i3 + 1] * invM;
        const azNew = forces[i3 + 2] * invM;
        velocities[i3] += (axNew - oldAccelerations[i3]) * halfDt;
        velocities[i3 + 1] += (ayNew - oldAccelerations[i3 + 1]) * halfDt;
        velocities[i3 + 2] += (azNew - oldAccelerations[i3 + 2]) * halfDt;
    }
}
