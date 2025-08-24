import { Simulation } from '../core/simulation/Simulation.js'
import { createState, type SimulationState } from '../core/simulation/state.js'
import { VelocityVerlet, EulerIntegrator } from '../core/simulation/integrators.js'
import { LennardJones } from '../core/forces/lennardJones.js'
import { Gravity } from '../core/forces/gravity.js'
import { Coulomb } from '../core/forces/coulomb.js'
import type { EngineConfig } from './config/types.js'
import { validateEngineConfig } from './config/types.js'
import { computeDiagnostics, type Diagnostics } from '../core/simulation/diagnostics.js'
import type { ForceField } from '../core/forces/forceInterfaces.js'
import { createNaiveNeighborStrategy, activateNeighborStrategy, type NeighborListStrategy, createCellNeighborStrategy } from '../core/neighbor/neighborList.js'

/**
 * Lightweight event emitter (internal). Kept minimal to avoid pulling in a dependency.
 */
// Allow any object type as event map (keys mapped to payload types) without requiring index signature.
// We purposefully avoid enforcing Record<string, unknown> to keep declaration simple while still type-safe for declared keys.
class Emitter<Events extends { [K in keyof Events]: unknown }> {
  private listeners: { [K in keyof Events]?: Array<(payload: Events[K]) => void> } = {}
  on<K extends keyof Events>(event: K, fn: (payload: Events[K]) => void): () => void {
    const list = this.listeners[event] ?? []
    list.push(fn)
    this.listeners[event] = list
    return () => {
      const current = this.listeners[event]
      if (!current) return
      this.listeners[event] = current.filter(f => f !== fn)
    }
  }
  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const arr = this.listeners[event]
    if (!arr) return
    for (const fn of arr) fn(payload)
  }
}

/** Public event payloads emitted by SimulationEngine. */
interface EngineEvents {
  /** Fired after each successful integration step with a shallow frame snapshot. */
  frame: { time: number; state: SimulationState; step: number }
  /** Diagnostics sample (energy, temperature, extrema). */
  diagnostics: Diagnostics
  /** Fired when a configuration patch has been applied. */
  config: EngineConfig
  /** Fatal error inside the step loop (engine will auto‑pause). */
  error: Error
  /** Fired after internal state buffers are reallocated due to particle count resize. */
  stateReallocated: SimulationState
}

/** Options controlling run loop behavior. */
export interface EngineRunOptions {
  /** If true use `requestAnimationFrame` (browser only); else fixed setInterval fallback. */
  useRaf?: boolean
  /** Fixed tick interval ms when not using RAF. */
  intervalMs?: number
}

/**
 * High-level orchestration layer around the low-level {@link Simulation}.
 *
 * Responsibilities:
 *  - Own the authoritative {@link EngineConfig} and apply config patches.
 *  - Construct & rebuild force field plugins / integrator when configuration changes.
 *  - Manage a run loop (RAF or setInterval) and emit frame / diagnostics events.
 *  - Bridge neighbor list strategy selection.
 *
 * The engine deliberately keeps rendering, UI and persistence concerns in
 * separate modules (see `persistence/`). It aims to be host/runtime agnostic.
 */
export class SimulationEngine {
  private config: EngineConfig
  // State becomes mutable reference so we can swap on particle count resize.
  private state: SimulationState
  private sim: Simulation
  private stepCount = 0
  private readonly emitter = new Emitter<EngineEvents>()
  private running = false
  private rafId: number | null = null
  private intervalId: ReturnType<typeof setInterval> | null = null
  /** Emit diagnostics each step (will become configurable). */
  private readonly diagnosticsEvery = 1
  /** Active neighbor list strategy (currently naive only). */
  private neighborStrategy: NeighborListStrategy

  /**
   * Create a new engine using the provided configuration. Particles are
   * allocated immediately; caller can optionally seed buffers before running.
   */
  constructor(cfg: EngineConfig) {
    validateEngineConfig(cfg)
    this.config = cfg
    this.state = createState({
      particleCount: cfg.world.particleCount,
      box: cfg.world.box,
      dt: cfg.runtime.dt,
      cutoff: cfg.runtime.cutoff
    })
    this.sim = this.buildSimulation()
    // Default to 'cell' strategy unless caller explicitly requests 'naive'.
    const requested = this.config.neighbor?.strategy
    this.neighborStrategy = requested === 'naive'
      ? createNaiveNeighborStrategy()
      : createCellNeighborStrategy({ box: this.config.world.box })
    activateNeighborStrategy(this.neighborStrategy)
  }

  /** Subscribe to engine events. Returns an unsubscribe function. */
  on = this.emitter.on.bind(this.emitter)

  /** Direct access for transitional code (read‑only usage only). */
  getState(): SimulationState { return this.state }

  /** Current configuration snapshot (clone to discourage external mutation). */
  getConfig(): EngineConfig { return JSON.parse(JSON.stringify(this.config)) }

  /** Build a Simulation instance corresponding to current config & enabled forces. */
  private buildSimulation(): Simulation {
    const forces = []
    if (this.config.forces.lennardJones) forces.push(new LennardJones({ epsilon: this.config.constants.epsilon, sigma: this.config.constants.sigma }))
    if (this.config.forces.gravity) forces.push(new Gravity({ G: this.config.constants.G }))
    if (this.config.forces.coulomb) forces.push(new Coulomb({ K: this.config.constants.K }))
    const integrator = this.config.runtime.integrator === 'euler' ? EulerIntegrator : VelocityVerlet
    return new Simulation(this.state, integrator, forces, { dt: this.config.runtime.dt, cutoff: this.config.runtime.cutoff })
  }

  /**
   * Perform a single integration step (even when not running continuously).
   * Emits a frame event.
   * Exceptions during force or integration logic are caught and emitted as an
   * 'error' event; the engine automatically pauses on error.
   */
  step(): void {
    try {
      // Rebuild neighbor list if strategy requires (future strategies may depend on cutoff changes)
      if (this.neighborStrategy.rebuildEveryStep) {
        this.neighborStrategy.rebuild(this.state, this.config.runtime.cutoff)
      }
      this.sim.step()
      this.stepCount++
      this.emitter.emit('frame', { time: this.state.time, state: this.state, step: this.stepCount })
      if (this.stepCount % this.diagnosticsEvery === 0) {
        const d = computeDiagnostics(this.state, this.sim.getForces(), { cutoff: this.config.runtime.cutoff, kB: this.config.constants.kB })
        this.emitter.emit('diagnostics', d)
      }
    } catch (e) {
      this.pause()
      this.emitter.emit('error', e as Error)
    }
  }

  /**
   * Begin continuous stepping. Idempotent: calling when already running is a
   * no-op. Chooses `requestAnimationFrame` by default when available unless
   * explicitly disabled.
   */
  run(opts: EngineRunOptions = {}): void {
    if (this.running) return
    this.running = true
    const useRaf = opts.useRaf !== false && typeof requestAnimationFrame === 'function'
    if (useRaf) {
      const loop = () => {
        if (!this.running) return
        this.step()
        this.rafId = requestAnimationFrame(loop)
      }
      this.rafId = requestAnimationFrame(loop)
    } else {
      const interval = opts.intervalMs ?? Math.max(1, Math.round(this.config.runtime.dt * 1000))
      this.intervalId = setInterval(() => this.step(), interval)
    }
  }

  /** Pause continuous stepping (manual `step()` still allowed). */
  /**
   * Stop continuous stepping. Safe to call multiple times. Manual `step()` is
   * still permitted while paused.
   */
  pause(): void {
    if (!this.running) return
    this.running = false
    if (this.rafId != null) cancelAnimationFrame(this.rafId)
    if (this.intervalId != null) clearInterval(this.intervalId)
    this.rafId = null
    this.intervalId = null
  }

  /**
   * Shallowly patch the existing configuration and rebuild derived objects
   * (force plugins, neighbor strategy, integrator parameters). Particle arrays
   * are preserved; dt & cutoff changes take effect next step.
   */
  updateConfig(patch: Partial<EngineConfig>): void {
    // Shallow merge on top levels only (good enough for early phase).
    this.config = {
      ...this.config,
      ...patch,
      world: { ...this.config.world, ...(patch.world || {}) },
      runtime: { ...this.config.runtime, ...(patch.runtime || {}) },
      forces: { ...this.config.forces, ...(patch.forces || {}) },
      constants: { ...this.config.constants, ...(patch.constants || {}) }
    }
    validateEngineConfig(this.config)
    // If particle count changed, resize state.
    if (patch.world?.particleCount && patch.world.particleCount !== this.state.N) {
      this.resizeParticleCount(patch.world.particleCount)
    }
    this.sim = this.buildSimulation()
    const boxChanged = !!patch.world?.box
    if ((patch.neighbor?.strategy && patch.neighbor.strategy !== this.neighborStrategy.name) || (boxChanged && this.neighborStrategy.name === 'cell')) {
      // Recreate strategy if type switched, or box changed for cell strategy.
      if (patch.neighbor?.strategy === 'naive') {
        this.neighborStrategy = createNaiveNeighborStrategy()
      } else {
        this.neighborStrategy = createCellNeighborStrategy({ box: this.config.world.box })
      }
      activateNeighborStrategy(this.neighborStrategy)
    }
    this.emitter.emit('config', this.getConfig())
  }

  /** Return active ForceField instances (read-only usage). */
  getForces(): ForceField[] { return this.sim.getForces() }

  /** Per-force decomposition (proxy to underlying Simulation). */
  getPerForceContributions(): Record<string, Float32Array> { return this.sim.getPerForceContributions() }

  /** Set simulation time (used during hydration). */
  setTime(t: number): void { this.state.time = t }

  /**
   * Initialize (or overwrite) core state buffers from external typed arrays.
   * Excess source elements are ignored; missing ones left unchanged. Intended
   * for hydration / custom scenario setup prior to `run()`.
   */
  seed(p: { positions?: Float32Array; velocities?: Float32Array; masses?: Float32Array; charges?: Float32Array }): void {
    // NOTE: We do shallow copies into existing typed arrays; callers keep ownership of source arrays.
    if (p.positions) this.state.positions.set(p.positions.subarray(0, this.state.positions.length))
    if (p.velocities) this.state.velocities.set(p.velocities.subarray(0, this.state.velocities.length))
    if (p.masses) this.state.masses.set(p.masses.subarray(0, this.state.masses.length))
    if (p.charges) this.state.charges.set(p.charges.subarray(0, this.state.charges.length))
  }

  /**
   * Reallocate internal state buffers for a new particle count. Existing per-particle
   * data is copied (truncated or zero-padded). Visual layer must refresh references.
   */
  resizeParticleCount(newCount: number): void {
    if (newCount <= 0) throw new Error('newCount must be > 0')
    if (newCount === this.state.N) return
    const old = this.state
    const copyN = Math.min(old.N, newCount)
    const next = createState({
      particleCount: newCount,
      box: this.config.world.box,
      dt: this.config.runtime.dt,
      cutoff: this.config.runtime.cutoff
    }, { time: old.time })
    next.positions.set(old.positions.subarray(0, copyN * 3))
    next.velocities.set(old.velocities.subarray(0, copyN * 3))
    next.forces.set(old.forces.subarray(0, copyN * 3))
    next.masses.set(old.masses.subarray(0, copyN))
    next.charges.set(old.charges.subarray(0, copyN))
    next.escaped.set(old.escaped.subarray(0, copyN))
    this.config.world.particleCount = newCount
    this.state = next
    this.sim = this.buildSimulation()
    this.emitter.emit('stateReallocated', this.state)
  }
}

export type { EngineConfig } from './config/types.js'
