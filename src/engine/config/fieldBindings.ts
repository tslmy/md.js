import type { EngineConfig } from './types.js'

/** Descriptor mapping a legacy settings key to EngineConfig path segments. */
export interface FieldBinding {
  /** Key on legacy `settings` object. */
  key: string
  /** Path inside EngineConfig (dot separated). Example: 'world.particleCount'. */
  path: string
  /** Optional transform when reading from settings -> engine (e.g. boolean coercion). */
  toEngine?(v: unknown): unknown
  /** Optional transform settings <- engine. */
  fromEngine?(v: unknown): unknown
  /** Participate in auto push (write accessor wrapping). */
  auto?: boolean
}

/** Declarative table for all synchronized fields. */
export const FIELD_BINDINGS: FieldBinding[] = [
  { key: 'particleCount', path: 'world.particleCount', auto: true },
  { key: 'spaceBoundaryX', path: 'world.box.x', auto: true },
  { key: 'spaceBoundaryY', path: 'world.box.y', auto: true },
  { key: 'spaceBoundaryZ', path: 'world.box.z', auto: true },
  { key: 'dt', path: 'runtime.dt', auto: true },
  { key: 'cutoffDistance', path: 'runtime.cutoff', auto: true },
  { key: 'if_apply_LJpotential', path: 'forces.lennardJones', toEngine: v => !!v, fromEngine: v => !!v, auto: true },
  { key: 'if_apply_gravitation', path: 'forces.gravity', toEngine: v => !!v, fromEngine: v => !!v, auto: true },
  { key: 'if_apply_coulombForce', path: 'forces.coulomb', toEngine: v => !!v, fromEngine: v => !!v, auto: true },
  { key: 'EPSILON', path: 'constants.epsilon', auto: true },
  { key: 'DELTA', path: 'constants.sigma', auto: true },
  { key: 'G', path: 'constants.G', auto: true },
  { key: 'K', path: 'constants.K', auto: true },
  { key: 'kB', path: 'constants.kB', auto: true }
]

/** Auto-push key list derived from bindings. */
export const AUTO_PUSH_KEYS = FIELD_BINDINGS.filter(b => b.auto).map(b => b.key) as readonly string[]

/** Get value at dot-path inside EngineConfig (shallow traversal). */
export function pick(cfg: EngineConfig, path: string): unknown {
  const segments = path.split('.')
  let acc: unknown = cfg
  for (const seg of segments) {
    if (acc == null || typeof acc !== 'object') return undefined
    // Indexing into generic object
    acc = (acc as Record<string, unknown>)[seg]
  }
  return acc
}

/** Set value at dot-path inside a partial EngineConfig object (creating nested objects). */
export function assignPath(root: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.')
  let obj: Record<string, unknown> = root
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]
    const next = obj[p]
    if (next == null || typeof next !== 'object') {
      const created: Record<string, unknown> = {}
      obj[p] = created
      obj = created
    } else {
      obj = next as Record<string, unknown>
    }
  }
  obj[parts[parts.length - 1]] = value
}
