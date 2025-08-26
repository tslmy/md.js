import { Simulation } from '../core/simulation/Simulation.js'
import { createState, type SimulationState } from '../core/simulation/state.js'
import { VelocityVerlet, EulerIntegrator } from '../core/simulation/integrators.js'
import { LennardJones } from '../core/forces/lennardJones.js'
import { Gravity } from '../core/forces/gravity.js'
import { Coulomb } from '../core/forces/coulomb.js'
import { EwaldCoulomb, EwaldGravity } from '../core/forces/ewald.js'
import type { EngineConfig } from './config/types.js'
import { validateEngineConfig } from './config/types.js'
import { computeDiagnostics, type Diagnostics } from '../core/simulation/diagnostics.js'
import type { ForceField } from '../core/forces/forceInterfaces.js'
import { createNaiveNeighborStrategy, activateNeighborStrategy, type NeighborListStrategy, createCellNeighborStrategy } from '../core/neighbor/neighborList.js'
import { configurePBC, wrapIntoBox } from '../core/pbc.js'

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
  /** Fired after position wrapping when one or more particles crossed a periodic boundary. */
  wrap: { wraps: WrapRecord[] }
}

type WrapSurface = { axis: 'x' | 'y' | 'z'; sign: 1 | -1 }
export interface WrapCrossing {
  axis: 'x' | 'y' | 'z'
  sign: 1 | -1 // sign of exiting surface (+L or -L) (same convention as existing surfaces array)
  exit: { x: number; y: number; z: number } // point placed on plane where particle left box (before teleport)
  entry: { x: number; y: number; z: number } // corresponding point on opposite plane where it re-enters (after wrap)
}
type WrapRecord = { i: number; dx: number; dy: number; dz: number; surfaces: WrapSurface[]; rawX: number; rawY: number; rawZ: number; crossings: WrapCrossing[] }

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
    if (this.config.forces.gravity) {
      // Derive a softening length ~ 0.15 * average inter-particle spacing to tame singularity
      const N = Math.max(1, this.config.world.particleCount)
      const box = this.config.world.box
      const volume = (2 * box.x) * (2 * box.y) * (2 * box.z)
      const spacing = Math.cbrt(volume / N)
      const softening = 0.15 * spacing
      if (this.config.runtime.pbc) {
        const Lmin = 2 * Math.min(box.x, box.y, box.z)
        const alpha = this.config.runtime.ewaldAlpha ?? (5 / Lmin)
        const kMax = this.config.runtime.ewaldKMax ?? 3
        forces.push(new EwaldGravity(this.config.constants.G, { alpha, kMax }))
      } else {
        forces.push(new Gravity({ G: this.config.constants.G, softening }))
      }
    }
    if (this.config.forces.coulomb) {
      // Use a slightly smaller softening for Coulomb (repulsion often prevents extreme overlap)
      const N = Math.max(1, this.config.world.particleCount)
      const box = this.config.world.box
      const volume = (2 * box.x) * (2 * box.y) * (2 * box.z)
      const spacing = Math.cbrt(volume / N)
      const softening = 0.1 * spacing
      if (this.config.runtime.pbc) {
        const Lmin = 2 * Math.min(box.x, box.y, box.z)
        const alpha = this.config.runtime.ewaldAlpha ?? (5 / Lmin)
        const kMax = this.config.runtime.ewaldKMax ?? 3
        forces.push(new EwaldCoulomb(this.config.constants.K, { alpha, kMax }))
      } else {
        forces.push(new Coulomb({ K: this.config.constants.K, softening }))
      }
    }
    const integrator = this.config.runtime.integrator === 'euler' ? EulerIntegrator : VelocityVerlet
    const sim = new Simulation(this.state, integrator, forces, { dt: this.config.runtime.dt, cutoff: this.config.runtime.cutoff })
    // Update periodic box parameters for force minimum-image distances.
    configurePBC(this.config.world.box, !!this.config.runtime.pbc)
    return sim
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
      // Apply periodic wrapping to physical positions (teleport) if enabled.
      if (this.config.runtime.pbc) this.wrapPositions()
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

  /** Minimum-image like wrap: keep each coordinate inside [-box.a, box.a]. */
  private wrapPositions(): void {
    /**
     * Periodic boundary handler.
     *
     * For each particle coordinate (x,y,z) we "teleport" it back into the
     * simulation box interval [-L,L] along every axis independently using
     * `wrapIntoBox` (which performs a fast centered modulo). A record is
     * accumulated when any component changes so downstream consumers (e.g.
     * trajectory stitching or visual effects) can react to boundary crossings.
     *
     * Implementation notes:
     *  - We iterate linearly once over N particles (O(N)).
     *  - For each particle we store the raw (pre‑wrap) position and the
     *    displacement vector (dx,dy,dz) applied by wrapping.
     *  - For every axis whose displacement is non‑zero we add a surface
     *    descriptor { axis, sign } where sign = +1 if it exited through the
     *    +L plane (raw > +L) and -1 if through the -L plane (raw < -L).
     *  - We also construct a "crossings" entry containing:
     *       exit: point on the plane the particle left (replace that axis with ±L)
     *       entry: corresponding wrapped point (same as final coordinate with that axis set to ∓L before displacement)
     *    This gives enough information to reconstruct a continuous path or to
     *    spawn visual markers on both faces.
     *  - If no particles wrap we avoid emitting the 'wrap' event.
     *
     * Side effects:
     *  - Mutates `state.positions` in place.
     *  - Emits 'wrap' with an array of per‑particle records when at least one
     *    particle crossed a boundary.
     *
     * Invariants / assumptions:
     *  - Box extents are symmetric about the origin; half‑lengths are stored
     *    in `config.world.box` as positive numbers (x,y,z).
     *  - Positions may drift arbitrarily far; wrapping brings them back into
     *    the closed interval [-L, L]. (If extremely far, multiple ±2L hops are
     *    collapsed into a single wrap since only final modulo result matters.)
     */
    const { positions, N } = this.state
    const { box } = this.config.world
    const wraps: WrapRecord[] = []
    const recordWrap = (i: number, rawX: number, rawY: number, rawZ: number, x: number, y: number, z: number) => {
      const dx = x - rawX; const dy = y - rawY; const dz = z - rawZ
      if (dx === 0 && dy === 0 && dz === 0) return
      const surfaces: Array<WrapSurface> = []
      const crossings: WrapCrossing[] = []
      const add = (axis: 'x' | 'y' | 'z', disp: number, half: number) => {
        if (disp === 0) return
        const sign: 1 | -1 = disp < 0 ? 1 : -1
        surfaces.push({ axis, sign })
        const exit = { x: rawX, y: rawY, z: rawZ }
        if (axis === 'x') exit.x = sign * half
        else if (axis === 'y') exit.y = sign * half
        else exit.z = sign * half
        const entry = { x, y, z }
        if (axis === 'x') entry.x = -sign * half
        else if (axis === 'y') entry.y = -sign * half
        else entry.z = -sign * half
        crossings.push({ axis, sign, exit, entry })
      }
      add('x', dx, this.config.world.box.x)
      add('y', dy, this.config.world.box.y)
      add('z', dz, this.config.world.box.z)
      wraps.push({ i, dx, dy, dz, surfaces, rawX, rawY, rawZ, crossings })
    }
    for (let i = 0; i < N; i++) {
      const base = 3 * i
      const rawX = positions[base]
      const rawY = positions[base + 1]
      const rawZ = positions[base + 2]
      const x = wrapIntoBox(rawX, box.x)
      const y = wrapIntoBox(rawY, box.y)
      const z = wrapIntoBox(rawZ, box.z)
      positions[base] = x; positions[base + 1] = y; positions[base + 2] = z
      recordWrap(i, rawX, rawY, rawZ, x, y, z)
    }
    if (wraps.length) {
      this.emitter.emit('wrap', { wraps })
      const formatNumber = (v: number) => {
        if (Math.abs(v) < 1e-6) return '0'
        if (Number.isInteger(v)) return v.toString()
        return v.toFixed(3)
      }
      const formatDisp = (dx: number, dy: number, dz: number) => `(${formatNumber(dx)}, ${formatNumber(dy)}, ${formatNumber(dz)})`
      const lines = wraps.map(w => {
        const exits = w.surfaces.map(s => `${s.sign > 0 ? '+' : '-'}${s.axis}`)
        const entries = w.surfaces.map(s => `${s.sign > 0 ? '-' : '+'}${s.axis}`)
        const dispStr = formatDisp(w.dx, w.dy, w.dz)
        if (w.surfaces.length === 1) {
          return `particle ${w.i} exited via the ${exits[0]} plane; wrapped to the ${entries[0]} plane by moving ${dispStr}.`
        } else {
          return `particle ${w.i} exited via planes ${exits.join(', ')}; wrapped to opposite planes ${entries.join(', ')} by moving ${dispStr}.`
        }
      })
      console.log(`[wrap] ${wraps.length} particle(s) crossed periodic boundary\n` + lines.join('\n'))
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
    // Refresh periodic box config (box or pbc flag may have changed)
    configurePBC(this.config.world.box, !!this.config.runtime.pbc)
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
