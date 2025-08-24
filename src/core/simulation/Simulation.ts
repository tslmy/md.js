import { SimulationState, zeroForces } from './state.js'
import { Integrator } from './integrators.js'
import { ForceField, ForceContext } from '../forces/forceInterfaces.js'

/**
 * Configuration subset needed by the low-level Simulation core.
 * Higher-level orchestration (engine) owns the broader user configuration and
 * passes only the distilled fields required to integrate.
 */
export interface SimulationConfig {
  /** Integration timestep. */
  dt: number
  /** Pairwise force cutoff distance. */
  cutoff: number
}

/**
 * Core simulation loop primitive: holds state arrays, force plugins and an
 * integration scheme. It purposefully has no knowledge of rendering,
 * persistence or scheduling; those concerns live in `SimulationEngine`.
 */
export class Simulation {
  /** Per-force decomposition of the instantaneous force vector (flattened xyz per particle). */
  private perForce!: Float32Array[]
  /** Scratch buffer used while isolating each force contribution without editing individual force plugins. */
  private baseForces!: Float32Array
  constructor(
    /** Mutable simulation state (positions, velocities, etc.). */
    public readonly state: SimulationState,
    /** Chosen integration scheme (Euler, Velocity Verlet, ...). */
    private readonly integrator: Integrator,
    /** Active force field plugins applied each step. */
    private readonly forces: ForceField[],
    /** Scalar parameters (dt, cutoff). */
    private readonly config: SimulationConfig
  ) { }

  private ensureBuffers(): void {
    if (!this.perForce || this.perForce.length !== this.forces.length) {
      this.perForce = this.forces.map(() => new Float32Array(this.state.forces.length))
    }
    if (!this.baseForces || this.baseForces.length !== this.state.forces.length) {
      this.baseForces = new Float32Array(this.state.forces.length)
    }
  }

  /**
   * Recompute the full force vector while also capturing per-force component
   * deltas into `perForce`. This is more expensive than a minimal accumulation
   * but enables UI inspection / debugging of individual contributions.
   */
  private computeForcesDetailed(): void {
    const { cutoff } = this.config
    this.ensureBuffers()
    zeroForces(this.state)
    // Clear per-force arrays
    for (const arr of this.perForce) arr.fill(0)
    const ctx: ForceContext = { cutoff }
    const { forces } = this.state
    for (let k = 0; k < this.forces.length; k++) {
      // Snapshot current accumulated forces
      this.baseForces.set(forces)
      this.forces[k].apply(this.state, ctx)
      const out = this.perForce[k]
      // delta = new - base
      for (let i = 0; i < forces.length; i++) out[i] = forces[i] - this.baseForces[i]
    }
  }

  /**
   * Advance the simulation by one timestep using the configured integrator.
   * Force buffers are (re)computed as required by the integrator.
   */
  step(): void {
    const { dt } = this.config
    const recomputeForces = () => this.computeForcesDetailed()
    // Initial force computation (Euler requires only once; Verlet will call back for second pass)
    recomputeForces()
    this.integrator.step(this.state, dt, recomputeForces)
  }

  /** Dynamically register a new force field (takes effect next step). */
  addForce(f: ForceField): void { this.forces.push(f) }

  /** Return internal array of force plugins (mutable; treat as read-only). */
  getForces(): ForceField[] { return this.forces }

  /** Return mapping of force name -> per-particle force contribution array (length 3N). */
  getPerForceContributions(): Record<string, Float32Array> {
    this.ensureBuffers()
    const map: Record<string, Float32Array> = {}
    for (let i = 0; i < this.forces.length; i++) map[this.forces[i].name] = this.perForce[i]
    return map
  }
}
