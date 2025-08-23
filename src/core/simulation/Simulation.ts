import { SimulationState, zeroForces } from './state.js'
import { Integrator } from './integrators.js'
import { ForceField, ForceContext } from '../forces/forceInterfaces.js'

export interface SimulationConfig {
  dt: number
  cutoff: number
}

export class Simulation {
  /** Per-force decomposition of the instantaneous force vector (flattened xyz per particle). */
  private perForce!: Float32Array[]
  /** Scratch buffer used while isolating each force contribution without editing individual force plugins. */
  private baseForces!: Float32Array
  constructor(
    public readonly state: SimulationState,
    private readonly integrator: Integrator,
  private readonly forces: ForceField[],
    private readonly config: SimulationConfig
  ) {}

  private ensureBuffers(): void {
    if (!this.perForce || this.perForce.length !== this.forces.length) {
      this.perForce = this.forces.map(() => new Float32Array(this.state.forces.length))
    }
    if (!this.baseForces || this.baseForces.length !== this.state.forces.length) {
      this.baseForces = new Float32Array(this.state.forces.length)
    }
  }

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

  step(): void {
  const { dt } = this.config
  const recomputeForces = () => this.computeForcesDetailed()
    // Initial force computation (Euler requires only once; Verlet will call back for second pass)
    recomputeForces()
    this.integrator.step(this.state, dt, recomputeForces)
  }

  addForce(f: ForceField): void { this.forces.push(f) }

  getForces(): ForceField[] { return this.forces }

  /** Return mapping of force name -> per-particle force contribution array (length 3N). */
  getPerForceContributions(): Record<string, Float32Array> {
    this.ensureBuffers()
    const map: Record<string, Float32Array> = {}
    for (let i = 0; i < this.forces.length; i++) map[this.forces[i].name] = this.perForce[i]
    return map
  }
}
