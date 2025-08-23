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
        zeroForces(this.state);
        const ctx = { cutoff };
        for (const f of this.forces)
            f.apply(this.state, ctx);
        this.integrator.step(this.state, dt);
    }
    addForce(f) { this.forces.push(f); }
}
