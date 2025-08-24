/**
 * Construction parameters for a new {@link SimulationState}.
 *
 * These are a distilled subset of higher level engine configuration values
 * required to size the core structure-of-arrays (SoA) buffers. Only data that
 * influences allocation lives here so the state object stays lightweight and
 * decoupled from user / UI settings concerns.
 */
export interface SimulationParams {
  /** Number of particles to allocate (N). */
  particleCount: number
  /** World / box extents (currently informational – forces may adopt later). */
  box: { x: number; y: number; z: number }
  /** Base integration timestep (seconds or arbitrary time units). */
  dt: number
  /** Pairwise interaction cutoff distance (world units). */
  cutoff: number
}

/**
 * Mutable structure-of-arrays holding the instantaneous state for all
 * particles. Each vector quantity is flattened xyz per particle (length 3N).
 *
 * Buffers are intentionally plain typed arrays for maximal performance and to
 * ease transfer / serialization. Higher level helpers (e.g. diagnostics) work
 * directly with these arrays without introducing wrapper classes.
 */
export interface SimulationState {
  /** Particle count (immutable after allocation). */
  N: number
  /** Accumulated simulation time. */
  time: number
  /** Particle positions (xyz * N). */
  positions: Float32Array // length 3N
  /** Particle velocities (xyz * N). */
  velocities: Float32Array // length 3N
  /** Force accumulator (xyz * N). Reset to 0 each integration step prior to force accumulation. */
  forces: Float32Array // length 3N (accumulator)
  /** Per-particle masses (length N). Mass defaults to 1 if zero/unset in integrators. */
  masses: Float32Array // length N
  /** Per-particle electrostatic charge (length N). */
  charges: Float32Array // length N
  /** Escape flags (0|1) for domain boundary logic (future use). */
  escaped: Uint8Array // 0|1 flags
}

/**
 * Allocate a fresh {@link SimulationState} (or partially seed from an existing
 * snapshot). Provided `seedData` buffers must already be the correct length;
 * otherwise new arrays are allocated.
 *
 * @param params Allocation parameters (particle count, dt, etc.).
 * @param seedData Optional existing buffers or time to copy/borrow.
 * @returns Fully initialized state object with typed arrays of correct size.
 */
export function createState(params: SimulationParams, seedData?: Partial<SimulationState>): SimulationState {
  const { particleCount } = params
  const N = particleCount
  const f32 = (n: number, existing?: Float32Array) => existing && existing.length === n ? existing : new Float32Array(n)
  const u8 = (n: number, existing?: Uint8Array) => existing && existing.length === n ? existing : new Uint8Array(n)
  return {
    N,
    time: seedData?.time ?? 0,
    positions: f32(3 * N, seedData?.positions),
    velocities: f32(3 * N, seedData?.velocities),
    forces: f32(3 * N, seedData?.forces),
    masses: f32(N, seedData?.masses),
    charges: f32(N, seedData?.charges),
    escaped: u8(N, seedData?.escaped)
  }
}

/**
 * Reset the force accumulator vector to zero (must be done before applying
 * force fields for a new integration step).
 */
export function zeroForces(state: SimulationState): void {
  state.forces.fill(0)
}

/**
 * Compute the starting flat-array index for particle i in a 3-vector field.
 * Equivalent to `i * 3` – provided for readability at call sites.
 */
export function index3(i: number): number { return 3 * i }

/**
 * Populate a freshly created SimulationState's positions / masses / charges from
 * provided arrays of vectors & scalar properties. Extra entries are ignored; missing
 * ones leave remaining state entries at their defaults (0 position, mass=0, charge=0).
 *
 * @param state Target simulation state (typically just created by createState()).
 * @param seed Object containing parallel arrays. Each array length should be >= N to fully seed.
 */
export function seedInitialState(state: SimulationState, seed: { positions?: { x: number; y: number; z: number }[]; masses?: number[]; charges?: number[] }): void {
  const { N } = state
  const posSrc = seed.positions
  if (posSrc) {
    for (let i = 0; i < N && i < posSrc.length; i++) {
      const i3 = 3 * i
      const p = posSrc[i]
      state.positions[i3] = p.x
      state.positions[i3 + 1] = p.y
      state.positions[i3 + 2] = p.z
    }
  }
  const mSrc = seed.masses
  if (mSrc) {
    for (let i = 0; i < N && i < mSrc.length; i++) state.masses[i] = mSrc[i]
  }
  const cSrc = seed.charges
  if (cSrc) {
    for (let i = 0; i < N && i < cSrc.length; i++) state.charges[i] = cSrc[i]
  }
}

// (Removed transitional seeded position registry; positions now generated directly via generatePositions during initialization.)
