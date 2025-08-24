/**
 * Engine configuration types & lightweight runtime guards.
 *
 * This is an initial scaffold for the future higher‑level SimulationEngine.
 * It intentionally mirrors a subset of the existing `settings.ts` shape but
 * remains decoupled so we can evolve internal naming & validation without
 * disturbing the UI / legacy path. Later we will introduce a schema (zod or
 * custom) plus versioned migrations. For now we keep it minimal and rely on
 * TypeScript + a couple of runtime assertions.
 *
 * NOTE: This module is **internal / experimental** and not yet consumed by the
 * existing test scripts (which still directly build `Simulation`). It is safe
 * to iterate rapidly here.
 */

export interface EngineForcesConfig {
  /** Enable Lennard‑Jones force. */
  lennardJones: boolean
  /** Enable Newtonian gravity. */
  gravity: boolean
  /** Enable Coulomb / electrostatics. */
  coulomb: boolean
}

export interface EnginePhysicalConstants {
  /** Depth of Lennard-Jones potential well. */
  epsilon: number
  /** Distance at which LJ potential is zero (σ). */
  sigma: number
  /** Gravitational constant (scaled units). */
  G: number
  /** Coulomb constant (scaled units). */
  K: number
  /** Boltzmann constant for temperature derivation. */
  kB: number
}

export interface EngineRuntimeConfig {
  /** Target (base) integration timestep. */
  dt: number
  /** Pairwise distance cutoff (world units). */
  cutoff: number
  /** Integrator selection (defaults to velocityVerlet). */
  integrator?: 'velocityVerlet' | 'euler'
}

export interface EngineWorldConfig {
  /** Number of particles allocated. */
  particleCount: number
  /** Box extents (currently informational; boundary logic WIP). */
  box: { x: number; y: number; z: number }
}

export interface EngineNeighborConfig {
  /** Strategy name. Implemented: 'naive', 'cell'. Planned: 'verlet'. */
  strategy?: 'naive' | 'cell'
}

/** Composite config passed to SimulationEngine constructor. */
export interface EngineConfig {
  world: EngineWorldConfig
  runtime: EngineRuntimeConfig
  forces: EngineForcesConfig
  constants: EnginePhysicalConstants
  neighbor?: EngineNeighborConfig
}

/** Minimal runtime validation. Throws if a required numeric field is NaN. */
export function validateEngineConfig(cfg: EngineConfig): void {
  const nums: Array<[string, number]> = [
    ['dt', cfg.runtime.dt],
    ['cutoff', cfg.runtime.cutoff],
    ['epsilon', cfg.constants.epsilon],
    ['sigma', cfg.constants.sigma],
    ['G', cfg.constants.G],
    ['K', cfg.constants.K],
    ['kB', cfg.constants.kB]
  ]
  for (const [name, v] of nums) {
    if (!Number.isFinite(v) || v <= 0) throw new Error(`Invalid numeric config '${name}': ${v}`)
  }
  if (cfg.world.particleCount <= 0) throw new Error('particleCount must be > 0')
  if (cfg.runtime.integrator && cfg.runtime.integrator !== 'velocityVerlet' && cfg.runtime.integrator !== 'euler') {
    throw new Error('Unsupported integrator ' + cfg.runtime.integrator)
  }
  if (cfg.neighbor?.strategy && !['naive', 'cell'].includes(cfg.neighbor.strategy)) throw new Error('Unsupported neighbor strategy ' + cfg.neighbor.strategy)
}

/** Shape of the mutable UI `settings` object. */
interface SettingsLike {
  particleCount: number
  spaceBoundaryX: number; spaceBoundaryY: number; spaceBoundaryZ: number
  dt: number; cutoffDistance: number
  if_apply_LJpotential?: boolean
  if_apply_gravitation?: boolean
  if_apply_coulombForce?: boolean
  EPSILON: number; DELTA: number; G: number; K: number; kB: number
  integrator?: 'velocityVerlet' | 'euler'
  neighborStrategy?: 'naive' | 'cell'
}

/**
 * Convert the UI `settings` object into an EngineConfig. This is a thin mapping
 * layer isolating the engine from the sprawling kitchen‑sink settings object.
 */
export function fromSettings(settings: SettingsLike): EngineConfig {
  const runtime: EngineRuntimeConfig = { dt: settings.dt, cutoff: settings.cutoffDistance }
  if (settings.integrator) runtime.integrator = settings.integrator
  return {
    world: { particleCount: settings.particleCount, box: { x: settings.spaceBoundaryX, y: settings.spaceBoundaryY, z: settings.spaceBoundaryZ } },
    runtime,
    forces: {
      lennardJones: !!settings.if_apply_LJpotential,
      gravity: !!settings.if_apply_gravitation,
      coulomb: !!settings.if_apply_coulombForce
    },
    constants: {
      epsilon: settings.EPSILON,
      sigma: settings.DELTA,
      G: settings.G,
      K: settings.K,
      kB: settings.kB
    },
    neighbor: settings.neighborStrategy ? { strategy: settings.neighborStrategy } : undefined
  }
}
