/**
 * Utilities for generating initial per-particle scalar properties (masses & charges).
 *
 * Kept separate from UI `settings` object so the core remains decoupled; callers
 * must explicitly provide parameter values. A pluggable RNG is accepted to allow
 * deterministic test seeding when desired.
 */

export interface MassChargeSeedOptions {
    /** Number of particles (N). */
    N: number
    /** Inclusive lower bound for random mass generation. */
    massLower: number
    /** Inclusive upper bound for random mass generation. */
    massUpper: number
    /** Discrete set of allowed charge values to sample uniformly. */
    chargeOptions: number[]
    /** If `makeSun` true, mass assigned to particle 0 (overrides random). */
    sunMass?: number
    /** Whether to treat particle 0 as a special massive body. */
    makeSun?: boolean
    /** Optional RNG returning [0,1). Defaults to Math.random. */
    rng?: () => number
}

export interface MassChargeSeedResult { masses: number[]; charges: number[] }

/**
 * Generate randomized masses (uniform in [massLower, massUpper]) and charges
 * (uniform discrete over `chargeOptions`). Particle 0 may be overridden as a
 * "sun" mass if requested.
 */
export function generateMassesCharges(opts: MassChargeSeedOptions): MassChargeSeedResult {
    const { N, massLower, massUpper, chargeOptions, sunMass, makeSun, rng = Math.random } = opts
    const masses = new Array<number>(N)
    const charges = new Array<number>(N)
    const span = Math.max(0, massUpper - massLower)
    for (let i = 0; i < N; i++) {
        masses[i] = massLower + rng() * span
        // Uniform discrete selection
        if (chargeOptions.length > 0) {
            const idx = Math.floor(rng() * chargeOptions.length) % chargeOptions.length
            charges[i] = chargeOptions[idx]
        } else {
            charges[i] = 0
        }
    }
    if (makeSun && N > 0 && typeof sunMass === 'number') {
        masses[0] = sunMass
    }
    return { masses, charges }
}

// ---------------- Position generation ----------------
export interface PositionSeedOptions {
    /** Number of particles to generate (N). Includes sun if makeSun true. */
    N: number
    /** Half-extent bounds in each axis. */
    bounds: { x: number; y: number; z: number }
    /** Whether to include a sun at index 0 (0,0,0). */
    makeSun?: boolean
    /** RNG for reproducibility. */
    rng?: () => number
}

export function generatePositions(opts: PositionSeedOptions): { x: number; y: number; z: number }[] {
    const { N, bounds, makeSun, rng = Math.random } = opts
    const out: { x: number; y: number; z: number }[] = new Array(N)
    let start = 0
    if (makeSun && N > 0) {
        out[0] = { x: 0, y: 0, z: 0 }
        start = 1
    }
    for (let i = start; i < N; i++) {
        out[i] = {
            x: (rng() * 2 - 1) * bounds.x,
            y: (rng() * 2 - 1) * bounds.y,
            z: (rng() * 2 - 1) * bounds.z
        }
    }
    return out
}
