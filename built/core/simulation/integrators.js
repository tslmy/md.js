import { index3 } from './state.js';
/**
 * Explicit Euler integrator.
 * Simple: updates velocity using current force, then position using updated velocity.
 * Pros: minimal code.
 * Cons: poor energy conservation & stability; accumulates drift quickly.
 * We keep this mostly for quick A/B testing and pedagogical clarity.
 */
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
/**
 * Velocity Verlet integrator (a symplectic method) – preferred for MD-like systems.
 * Conceptual steps:
 * 1. Use current acceleration to predict new position (full dt) and advance velocity half a step.
 * 2. Recompute forces (thus new acceleration) at the new position.
 * 3. Finish the velocity update with the new acceleration half step.
 * Why better than Euler: time-reversible & symplectic -> significantly improved conservation of invariants (like total energy) for conservative forces, so systems do not "heat up" or "cool down" artificially as fast.
 * Complexity note: requires a second force computation per step (already encapsulated via callback here).
 */
export const VelocityVerlet = {
    step(state, dt, recomputeForces) {
        const { N, positions, velocities, forces, masses } = state;
        const dt2 = dt * dt;
        // Allocate scratch for initial accelerations (reuse per step to keep simple)
        const a0 = new Float32Array(N * 3);
        // 1. Use current forces to advance positions and half-step velocities
        for (let i = 0; i < N; i++) {
            const i3 = index3(i);
            const invM = 1 / (masses[i] || 1);
            const ax = forces[i3] * invM;
            const ay = forces[i3 + 1] * invM;
            const az = forces[i3 + 2] * invM;
            a0[i3] = ax;
            a0[i3 + 1] = ay;
            a0[i3 + 2] = az;
            // position(t+dt)
            positions[i3] += velocities[i3] * dt + 0.5 * ax * dt2;
            positions[i3 + 1] += velocities[i3 + 1] * dt + 0.5 * ay * dt2;
            positions[i3 + 2] += velocities[i3 + 2] * dt + 0.5 * az * dt2;
            // v half-step
            velocities[i3] += 0.5 * ax * dt;
            velocities[i3 + 1] += 0.5 * ay * dt;
            velocities[i3 + 2] += 0.5 * az * dt;
        }
        // 2. Recompute forces with updated positions
        recomputeForces();
        // 3. Complete velocity update with new accelerations
        for (let i = 0; i < N; i++) {
            const i3 = index3(i);
            const invM = 1 / (masses[i] || 1);
            const axNew = forces[i3] * invM;
            const ayNew = forces[i3 + 1] * invM;
            const azNew = forces[i3 + 2] * invM;
            velocities[i3] += 0.5 * axNew * dt;
            velocities[i3 + 1] += 0.5 * ayNew * dt;
            velocities[i3 + 2] += 0.5 * azNew * dt;
        }
        state.time += dt;
    }
};
//# sourceMappingURL=integrators.js.map
