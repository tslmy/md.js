import { zeroForces } from './state.js';
export class Simulation {
    constructor(state, integrator, forces, config) {
        this.state = state;
        this.integrator = integrator;
        this.forces = forces;
        this.config = config;
    }
    ensureBuffers() {
        if (!this.perForce || this.perForce.length !== this.forces.length) {
            this.perForce = this.forces.map(() => new Float32Array(this.state.forces.length));
        }
        if (!this.baseForces || this.baseForces.length !== this.state.forces.length) {
            this.baseForces = new Float32Array(this.state.forces.length);
        }
    }
    computeForcesDetailed() {
        const { cutoff } = this.config;
        this.ensureBuffers();
        zeroForces(this.state);
        // Clear per-force arrays
        for (const arr of this.perForce)
            arr.fill(0);
        const ctx = { cutoff };
        const { forces } = this.state;
        for (let k = 0; k < this.forces.length; k++) {
            // Snapshot current accumulated forces
            this.baseForces.set(forces);
            this.forces[k].apply(this.state, ctx);
            const out = this.perForce[k];
            // delta = new - base
            for (let i = 0; i < forces.length; i++)
                out[i] = forces[i] - this.baseForces[i];
        }
    }
    step() {
        const { dt } = this.config;
        const recomputeForces = () => this.computeForcesDetailed();
        // Initial force computation (Euler requires only once; Verlet will call back for second pass)
        recomputeForces();
        this.integrator.step(this.state, dt, recomputeForces);
    }
    addForce(f) { this.forces.push(f); }
    getForces() { return this.forces; }
    /** Return mapping of force name -> per-particle force contribution array (length 3N). */
    getPerForceContributions() {
        this.ensureBuffers();
        const map = {};
        for (let i = 0; i < this.forces.length; i++)
            map[this.forces[i].name] = this.perForce[i];
        return map;
    }
}
//# sourceMappingURL=Simulation.js.map