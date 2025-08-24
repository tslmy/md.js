/**
 * Utility to compute a tangential velocity approximating a circular orbit
 * around a central mass at the origin under Newtonian gravity.
 *
 * Assumptions / design choices:
 *  - Central mass M located at (0,0,0).
 *  - Particle at position r = (rx, ry, rz).
 *  - We pick a tangential direction in the XY plane when possible to keep
 *    motion visually planar (educational clarity) and ensure v · r = 0.
 *  - If the particle lies almost on the Z axis (rx, ry ~ 0) we default to +X
 *    as the tangential direction.
 *  - Returns (0,0,0) for extremely small radii to avoid NaNs.
 */
export function computeCircularOrbitVelocity(
    rx: number,
    ry: number,
    rz: number,
    Msun: number,
    G: number
): { vx: number; vy: number; vz: number } {
    const r = Math.hypot(rx, ry, rz)
    if (!isFinite(r) || r < 1e-8) return { vx: 0, vy: 0, vz: 0 }
    const rxy = Math.hypot(rx, ry)
    const vmag = Math.sqrt(G * Msun / r)
    let tx: number; let ty: number; const tz = 0
    if (rxy < 1e-10) {
        // Position nearly along z: arbitrary perpendicular axis
        tx = 1; ty = 0
    } else {
        // 2D perpendicular in XY plane rotated +90°: (-y, x) normalized
        tx = -ry / rxy
        ty = rx / rxy
    }
    return { vx: tx * vmag, vy: ty * vmag, vz: tz * vmag }
}
