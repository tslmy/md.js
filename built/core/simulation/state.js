// Initial Structure-of-Arrays (SoA) state representation for incremental refactor.
// Does not yet integrate with existing rendering; acts as a parallel model.
export function createState(params, seedData) {
    const { particleCount } = params;
    const N = particleCount;
    const f32 = (n, existing) => existing && existing.length === n ? existing : new Float32Array(n);
    const u8 = (n, existing) => existing && existing.length === n ? existing : new Uint8Array(n);
    return {
        N,
        time: seedData?.time ?? 0,
        positions: f32(3 * N, seedData?.positions),
        velocities: f32(3 * N, seedData?.velocities),
        forces: f32(3 * N, seedData?.forces),
        masses: f32(N, seedData?.masses),
        charges: f32(N, seedData?.charges),
        escaped: u8(N, seedData?.escaped)
    };
}
export function zeroForces(state) {
    state.forces.fill(0);
}
export function index3(i) { return 3 * i; }
