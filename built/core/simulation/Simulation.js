import { zeroForces } from './state.js';
export class Simulation {
    constructor(state, integrator, forces, config) {
        this.state = state;
        this.integrator = integrator;
        this.forces = forces;
        this.config = config;
    }
    step() {
        const { dt, cutoff } = this.config;
        const recomputeForces = () => {
            zeroForces(this.state);
            const ctx = { cutoff };
            for (const f of this.forces)
                f.apply(this.state, ctx);
        };
        // Initial force computation (Euler requires only once; Verlet will call back for second pass)
        recomputeForces();
        this.integrator.step(this.state, dt, recomputeForces);
    }
    addForce(f) { this.forces.push(f); }
}
//# sourceMappingURL=Simulation.js.map
