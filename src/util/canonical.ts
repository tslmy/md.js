/** Tiny central helpers for canonicalizing user-provided string setting values. */
const INTEGRATORS = ['velocityVerlet', 'euler'] as const
const NEIGHBOR_STRATEGIES = ['cell', 'naive'] as const
const REFERENCE_FRAMES = ['fixed', 'sun', 'com'] as const

function makeCanonicalizer<T extends readonly string[]>(allowed: T, fallback: T[number]) {
  const map = new Map<string, T[number]>()
  for (const v of allowed) map.set(v.toLowerCase(), v)
  return (raw: unknown): T[number] => {
    if (typeof raw !== 'string') return fallback
    return map.get(raw.trim().toLowerCase()) ?? fallback
  }
}

export const canonicalizeIntegrator = makeCanonicalizer(INTEGRATORS, 'velocityVerlet')
export const canonicalizeNeighborStrategy = makeCanonicalizer(NEIGHBOR_STRATEGIES, 'cell') // keep default
export const canonicalizeReferenceFrame = makeCanonicalizer(REFERENCE_FRAMES, 'sun')
