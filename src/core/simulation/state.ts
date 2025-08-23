// Initial Structure-of-Arrays (SoA) state representation for incremental refactor.
// Does not yet integrate with existing rendering; acts as a parallel model.

export interface SimulationParams {
  particleCount: number
  box: { x: number; y: number; z: number }
  dt: number
  cutoff: number
}

export interface SimulationState {
  N: number
  time: number
  positions: Float32Array // length 3N
  velocities: Float32Array // length 3N
  forces: Float32Array // length 3N (accumulator)
  masses: Float32Array // length N
  charges: Float32Array // length N
  escaped: Uint8Array // 0|1 flags
}

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

export function zeroForces(state: SimulationState): void {
  state.forces.fill(0)
}

export function index3(i: number): number { return 3 * i }
