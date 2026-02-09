import { SimulationState, index3 } from './state.js'
import { ensureFloat32Array } from '../../util/arrays.js'

/**
 * Integrators advance the simulation state in time using current forces.
 *
 * Background (high level, non-physics wording):
 *  - Particles have positions (where they are) and velocities (how fast & which direction they move).
 *  - Forces act like pushes / pulls. Given a force and a particle's mass we derive acceleration (push strength per mass).
 *  - An integrator uses the forces to update velocities & positions over a small timestep dt.
 *  - Different integrators trade implementation simplicity vs. numerical stability (how well they conserve energy over time).
 *
 * Contract:
 *  - Implementations MUST advance state.time by exactly dt.
 *  - They MAY invoke `recomputeForces` 0+ times (Verlet variants need 1 extra pass).
 *  - They MUST leave `state.forces` containing the last evaluated force field sum.
 */
export interface Integrator {
  step(state: SimulationState, dt: number, recomputeForces: () => void): void
}

/**
 * Explicit Euler integrator.
 * Simple: updates velocity using current force, then position using updated velocity.
 * Pros: minimal code.
 * Cons: poor energy conservation & stability; accumulates drift quickly.
 * We keep this mostly for quick A/B testing and pedagogical clarity.
 */
export const EulerIntegrator: Integrator = {
  step(state, dt) {
    const { N, positions, velocities, forces, masses } = state
    for (let i = 0; i < N; i++) {
      const i3 = index3(i)
      const invM = 1 / (masses[i] || 1)
      velocities[i3] += forces[i3] * invM * dt
      velocities[i3 + 1] += forces[i3 + 1] * invM * dt
      velocities[i3 + 2] += forces[i3 + 2] * invM * dt
      positions[i3] += velocities[i3] * dt
      positions[i3 + 1] += velocities[i3 + 1] * dt
      positions[i3 + 2] += velocities[i3 + 2] * dt
    }
    state.time += dt
  }
}

/**
 * Velocity Verlet integrator (a symplectic method) – preferred for MD-like systems.
 * Conceptual steps:
 * 1. Use current acceleration to predict new position (full dt) and advance velocity half a step.
 * 2. Recompute forces (thus new acceleration) at the new position.
 * 3. Finish the velocity update with the new acceleration half step.
 * Why better than Euler: time-reversible & symplectic -> significantly improved conservation of invariants (like total energy) for conservative forces, so systems do not "heat up" or "cool down" artificially as fast.
 * Complexity note: requires a second force computation per step (already encapsulated via callback here).
 */
// Reused scratch buffer for VelocityVerlet (grown lazily). Module scoped so all
// simulations share (small) allocations rather than per-step churn.
let vvScratch: Float32Array | null = null

export const VelocityVerlet: Integrator = {
  step(state, dt, recomputeForces) {
    const { N, positions, velocities, forces, masses } = state
    const dt2 = dt * dt
    const needed = N * 3
    if (!vvScratch || vvScratch.length !== needed) vvScratch = ensureFloat32Array(needed)
    const a0 = vvScratch
    // 1. Use current forces to advance positions and half-step velocities
    for (let i = 0; i < N; i++) {
      const i3 = index3(i)
      const invM = 1 / (masses[i] || 1)
      const ax = forces[i3] * invM
      const ay = forces[i3 + 1] * invM
      const az = forces[i3 + 2] * invM
      a0[i3] = ax; a0[i3 + 1] = ay; a0[i3 + 2] = az
      positions[i3] += velocities[i3] * dt + 0.5 * ax * dt2
      positions[i3 + 1] += velocities[i3 + 1] * dt + 0.5 * ay * dt2
      positions[i3 + 2] += velocities[i3 + 2] * dt + 0.5 * az * dt2
      velocities[i3] += 0.5 * ax * dt
      velocities[i3 + 1] += 0.5 * ay * dt
      velocities[i3 + 2] += 0.5 * az * dt
    }
    // 2. Recompute forces with updated positions
    recomputeForces()
    // 3. Complete velocity update with new accelerations
    for (let i = 0; i < N; i++) {
      const i3 = index3(i)
      const invM = 1 / (masses[i] || 1)
      const axNew = forces[i3] * invM
      const ayNew = forces[i3 + 1] * invM
      const azNew = forces[i3 + 2] * invM
      velocities[i3] += 0.5 * axNew * dt
      velocities[i3 + 1] += 0.5 * ayNew * dt
      velocities[i3 + 2] += 0.5 * azNew * dt
    }
    state.time += dt
  }
}
