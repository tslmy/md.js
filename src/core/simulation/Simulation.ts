import { SimulationState, zeroForces } from './state.js'
import { Integrator } from './integrators.js'
import { ForceField, ForceContext } from '../forces/forceInterfaces.js'

export interface SimulationConfig {
  dt: number
  cutoff: number
}

export class Simulation {
  constructor(
    public readonly state: SimulationState,
    private readonly integrator: Integrator,
    private readonly forces: ForceField[],
    private readonly config: SimulationConfig
  ) {}

  step(): void {
    const { dt, cutoff } = this.config
    const recomputeForces = () => {
      zeroForces(this.state)
      const ctx: ForceContext = { cutoff }
      for (const f of this.forces) f.apply(this.state, ctx)
    }
    // Initial force computation (Euler requires only once; Verlet will call back for second pass)
    recomputeForces()
    this.integrator.step(this.state, dt, recomputeForces)
  }

  addForce(f: ForceField): void { this.forces.push(f) }
}
