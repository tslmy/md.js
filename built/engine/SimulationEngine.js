import { Simulation } from '../core/simulation/Simulation.js';
import { createState } from '../core/simulation/state.js';
import { VelocityVerlet } from '../core/simulation/integrators.js';
import { LennardJones } from '../core/forces/lennardJones.js';
import { Gravity } from '../core/forces/gravity.js';
import { Coulomb } from '../core/forces/coulomb.js';
import { validateEngineConfig } from './config/types.js';
import { computeDiagnostics } from '../core/simulation/diagnostics.js';
/**
 * Lightweight event emitter (internal). Kept minimal to avoid pulling in a dependency.
 */
// Allow any object type as event map (keys mapped to payload types) without requiring index signature.
// We purposefully avoid enforcing Record<string, unknown> to keep declaration simple while still type-safe for declared keys.
class Emitter {
    constructor() {
        this.listeners = {};
    }
    on(event, fn) {
        const list = this.listeners[event] ?? [];
        list.push(fn);
        this.listeners[event] = list;
        return () => {
            const current = this.listeners[event];
            if (!current)
                return;
            this.listeners[event] = current.filter(f => f !== fn);
        };
    }
    emit(event, payload) {
        const arr = this.listeners[event];
        if (!arr)
            return;
        for (const fn of arr)
            fn(payload);
    }
}
/**
 * Experimental high‑level orchestrator for the existing Simulation.
 *
 * Design intent:
 *  - Provide an eventual drop‑in replacement for ad‑hoc logic currently in `script.ts`.
 *  - Abstract force enabling, config updates & frame emission.
 *  - Keep zero behavior change for the legacy path while we migrate.
 *
 * Current limitations (to be addressed in subsequent phases):
 *  - No worker offload or neighbor list abstraction yet.
 *  - Force plugins are reconstructed on each config change (cheap for now).
 *  - Diagnostics not emitted (will integrate existing computeDiagnostics soon).
 */
export class SimulationEngine {
    constructor(cfg) {
        this.stepCount = 0;
        this.emitter = new Emitter();
        this.running = false;
        this.rafId = null;
        this.intervalId = null;
        /** Emit diagnostics each step (will become configurable). */
        this.diagnosticsEvery = 1;
        /** Subscribe to engine events. Returns an unsubscribe function. */
        this.on = this.emitter.on.bind(this.emitter);
        validateEngineConfig(cfg);
        this.config = cfg;
        this.state = createState({
            particleCount: cfg.world.particleCount,
            box: cfg.world.box,
            dt: cfg.runtime.dt,
            cutoff: cfg.runtime.cutoff
        });
        this.sim = this.buildSimulation();
    }
    /** Direct access for transitional code (read‑only usage only). */
    getState() { return this.state; }
    /** Current configuration snapshot (clone to discourage external mutation). */
    getConfig() { return JSON.parse(JSON.stringify(this.config)); }
    /** Build a Simulation instance corresponding to current config & enabled forces. */
    buildSimulation() {
        const forces = [];
        if (this.config.forces.lennardJones)
            forces.push(new LennardJones({ epsilon: this.config.constants.epsilon, sigma: this.config.constants.sigma }));
        if (this.config.forces.gravity)
            forces.push(new Gravity({ G: this.config.constants.G }));
        if (this.config.forces.coulomb)
            forces.push(new Coulomb({ K: this.config.constants.K }));
        return new Simulation(this.state, VelocityVerlet, forces, { dt: this.config.runtime.dt, cutoff: this.config.runtime.cutoff });
    }
    /** Perform one integration step. Emits a frame event. */
    step() {
        try {
            this.sim.step();
            this.stepCount++;
            this.emitter.emit('frame', { time: this.state.time, state: this.state, step: this.stepCount });
            if (this.stepCount % this.diagnosticsEvery === 0) {
                const d = computeDiagnostics(this.state, this.sim.getForces(), { cutoff: this.config.runtime.cutoff, kB: this.config.constants.kB });
                this.emitter.emit('diagnostics', d);
            }
        }
        catch (e) {
            this.pause();
            this.emitter.emit('error', e);
        }
    }
    /** Start continuous stepping. Idempotent. */
    run(opts = {}) {
        if (this.running)
            return;
        this.running = true;
        const useRaf = opts.useRaf !== false && typeof requestAnimationFrame === 'function';
        if (useRaf) {
            const loop = () => {
                if (!this.running)
                    return;
                this.step();
                this.rafId = requestAnimationFrame(loop);
            };
            this.rafId = requestAnimationFrame(loop);
        }
        else {
            const interval = opts.intervalMs ?? Math.max(1, Math.round(this.config.runtime.dt * 1000));
            this.intervalId = setInterval(() => this.step(), interval);
        }
    }
    /** Pause continuous stepping (manual `step()` still allowed). */
    pause() {
        if (!this.running)
            return;
        this.running = false;
        if (this.rafId != null)
            cancelAnimationFrame(this.rafId);
        if (this.intervalId != null)
            clearInterval(this.intervalId);
        this.rafId = null;
        this.intervalId = null;
    }
    /** Patch configuration & rebuild force plugins / integration params. */
    updateConfig(patch) {
        // Shallow merge on top levels only (good enough for early phase).
        this.config = {
            ...this.config,
            ...patch,
            world: { ...this.config.world, ...(patch.world || {}) },
            runtime: { ...this.config.runtime, ...(patch.runtime || {}) },
            forces: { ...this.config.forces, ...(patch.forces || {}) },
            constants: { ...this.config.constants, ...(patch.constants || {}) }
        };
        validateEngineConfig(this.config);
        // Currently we do NOT recreate state; only forces & dt/cutoff are applied.
        this.sim = this.buildSimulation();
        this.emitter.emit('config', this.getConfig());
    }
    /** Return active ForceField instances (read-only usage). */
    getForces() { return this.sim.getForces(); }
    /** Per-force decomposition (proxy to underlying Simulation). */
    getPerForceContributions() { return this.sim.getPerForceContributions(); }
    /** Set simulation time (used during hydration). */
    setTime(t) { this.state.time = t; }
    /** Seed initial state arrays (positions, velocities, masses, charges). Call before run(). */
    seed(p) {
        if (p.positions)
            this.state.positions.set(p.positions.subarray(0, this.state.positions.length));
        if (p.velocities)
            this.state.velocities.set(p.velocities.subarray(0, this.state.velocities.length));
        if (p.masses)
            this.state.masses.set(p.masses.subarray(0, this.state.masses.length));
        if (p.charges)
            this.state.charges.set(p.charges.subarray(0, this.state.charges.length));
    }
}
//# sourceMappingURL=SimulationEngine.js.map
