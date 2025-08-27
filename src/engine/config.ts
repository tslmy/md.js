/**
 * Engine configuration model (types + construction helpers).
 *
 * Design (post-refactor):
 *  - The whole program has a single authoritative `SETTINGS_SCHEMA`
 *    (see `src/config/settingsSchema.ts`). Each descriptor optionally declares
 *    an `enginePath` (dot path into `EngineConfig`) plus an `auto` flag. Those
 *    flagged entries participate in automatic push/pull with the running
 *    `SimulationEngine` and are also used here to build an initial config.
 *  - `buildEngineConfig(settings)` walks those schema bindings and materializes
 *    a plain `EngineConfig` object (no bespoke manual mapping per field).
 *  - `validateEngineConfig` supplies a thin runtime sanity check (positivity /
 *    finiteness / allowed enums). This intentionally stays minimal; richer
 *    constraints can later be folded back into the schema itself (e.g. adding
 *    `min`, `max`, or enumerated options for every numeric/enum engine-bound
 *    setting) allowing this function to shrink or disappear.
 *
 * Extension:
 *  - To introduce a new engine-affecting setting, add a descriptor with
 *    `enginePath` + `auto: true` in `SETTINGS_SCHEMA`; no engine-side mapping
 *    edits are required unless new structural validation rules are needed.
 *  - If a field demands cross-field validation (e.g. dt * cutoff < some limit)
 *    implement it inside `validateEngineConfig` until a schema-driven solution
 *    exists.
 *
 * Testing:
 *  - Unit tests exercise `validateEngineConfig`; integration tests indirectly
 *    cover `buildEngineConfig` by spinning up a `SimulationEngine` from GUI
 *    settings in `script.ts`.
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
  /** Enable periodic boundary condition wrapping (positions confined to box). */
  pbc?: boolean
  /** Optional Ewald splitting parameter alpha (auto-chosen if omitted). */
  ewaldAlpha?: number
  /** Optional Ewald reciprocal lattice limit (integer kMax, auto if omitted). */
  ewaldKMax?: number
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

/**
 * Minimal runtime validation for `EngineConfig` objects.
 *
 * Current responsibilities (kept intentionally small):
 *  - Ensure required numeric scalars are finite and > 0.
 *  - Enforce allow-lists for `integrator` and `neighbor.strategy`.
 *  - Guard obviously invalid particle counts.
 *
 * Not (yet) handled:
 *  - Cross-field invariants / dimensional consistency.
 *  - Range constraints driven from schema metadata (future enhancement).
 *
 * Throws: Error with a short descriptive message on first failure.
 */
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
  if (cfg.runtime.ewaldAlpha != null) nums.push(['ewaldAlpha', cfg.runtime.ewaldAlpha])
  if (cfg.runtime.ewaldKMax != null) nums.push(['ewaldKMax', cfg.runtime.ewaldKMax])
  for (const [name, v] of nums) {
    if (!Number.isFinite(v) || v <= 0) throw new Error(`Invalid numeric config '${name}': ${v}`)
  }
  if (cfg.world.particleCount <= 0) throw new Error('particleCount must be > 0')
  if (cfg.runtime.integrator && cfg.runtime.integrator !== 'velocityVerlet' && cfg.runtime.integrator !== 'euler') {
    throw new Error('Unsupported integrator ' + cfg.runtime.integrator)
  }
  if (cfg.neighbor?.strategy && !['naive', 'cell'].includes(cfg.neighbor.strategy)) throw new Error('Unsupported neighbor strategy ' + cfg.neighbor.strategy)
}

// New streamlined config constructor: derive entirely from unified SETTINGS_SCHEMA
// eliminating the bespoke mapping above. This reduces duplication and keeps the
// engine config in lock‑step with schema evolutions (single source of truth).
import { getAutoEngineBindings, type SettingsObject } from '../control/settingsSchema.js'

// Minimal path assignment helper (duplicated locally to avoid cross‑module churn)
type MutableEngineConfig = {
  world: Partial<EngineWorldConfig & { box: Partial<EngineWorldConfig['box']> }>
  runtime: Partial<EngineRuntimeConfig>
  forces: Partial<EngineForcesConfig>
  constants: Partial<EnginePhysicalConstants>
  neighbor?: Partial<EngineNeighborConfig>
}

function assignPath(root: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.')
  let obj: Record<string, unknown> = root
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]
    let next = obj[p]
    if (next == null || typeof next !== 'object') { next = {}; obj[p] = next }
    obj = next as Record<string, unknown>
  }
  obj[parts[parts.length - 1]] = value
}

/**
 * Build a fresh `EngineConfig` from a full mutable GUI `settings` object.
 *
 * Implementation details:
 *  - Iterates over auto engine bindings (derived from unified schema).
 *  - Assigns into a lightweight mutable structure (lazily creating nested
 *    objects) then casts to `EngineConfig` after validation.
 *  - Unspecified engine fields remain absent (caller responsibility to ensure
 *    schema covers all required engine inputs).
 */
export function buildEngineConfig(settings: SettingsObject): EngineConfig {
  const cfg: MutableEngineConfig = { world: {}, runtime: {}, forces: {}, constants: {} }
  for (const b of getAutoEngineBindings()) assignPath(cfg as unknown as Record<string, unknown>, b.path, settings[b.key])
  validateEngineConfig(cfg as EngineConfig)
  return cfg as EngineConfig
}
