/**
 * Central helpers for canonicalizing user-provided (string) setting values.
 * Avoids sprinkling ad-hoc toLowerCase + fallback logic across modules.
 */

export type CanonicalValue<T extends readonly string[]> = T[number]

/** Generic canonicalization: lowercase + trim + membership test. */
export function canonicalizeStringOption<T extends readonly string[]>(raw: unknown, allowed: T, fallback: T[number]): T[number] {
  if (typeof raw !== 'string') return fallback
  const norm = raw.trim().toLowerCase()
  for (const v of allowed) if (v.toLowerCase() === norm) return v
  return fallback
}

const INTEGRATORS = ['velocityVerlet', 'euler'] as const
const NEIGHBOR_STRATEGIES = ['cell', 'naive'] as const
const REFERENCE_FRAMES = ['fixed', 'sun', 'com'] as const

export function canonicalizeIntegrator(raw: unknown): typeof INTEGRATORS[number] {
  return canonicalizeStringOption(raw, INTEGRATORS, 'velocityVerlet')
}
export function canonicalizeNeighborStrategy(raw: unknown): typeof NEIGHBOR_STRATEGIES[number] {
  // default to 'cell' (better perf characteristics) – keep existing behavior
  return canonicalizeStringOption(raw, NEIGHBOR_STRATEGIES, 'cell')
}
export function canonicalizeReferenceFrame(raw: unknown): typeof REFERENCE_FRAMES[number] {
  return canonicalizeStringOption(raw, REFERENCE_FRAMES, 'sun')
}

export const ALLOWED = { INTEGRATORS, NEIGHBOR_STRATEGIES, REFERENCE_FRAMES }
