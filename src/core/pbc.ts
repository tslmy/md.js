/**
 * Periodic boundary condition (PBC) helpers centralizing wrap & minimum-image logic.
 * Box dimensions are expressed as half-lengths (i.e. valid coordinate range is [-L, L]).
 */

export interface HalfBox { x: number; y: number; z: number }

/** Wrap a scalar coordinate into [-half, half] (handles large excursions with while loop). */
export function wrapIntoBox(v: number, half: number): number {
    const span = 2 * half
    // Use while instead of modulo to preserve floating precision & handle negative values cleanly.
    while (v < -half) v += span
    while (v > half) v -= span
    return v
}

/** Minimum-image displacement component (single adjustment; assumes |d| <= few * half). */
export function minimumImageDisplacement(d: number, half: number): number {
    const span = 2 * half
    if (d > half) return d - span
    if (d < -half) return d + span
    return d
}

/** Wrap all coordinates of a point into box in-place (returns tuple for convenience). */
export function wrapPoint<T extends { x: number; y: number; z: number }>(p: T, box: HalfBox): T {
    p.x = wrapIntoBox(p.x, box.x)
    p.y = wrapIntoBox(p.y, box.y)
    p.z = wrapIntoBox(p.z, box.z)
    return p
}

/**
 * Apply minimum‑image convention to a 3D vector in place (component-wise, single adjustment per axis).
 *
 * Use cases:
 *  - Displacement vectors (dx, dy, dz) between particles in PBC
 *  - Display-space positions for visualization (assumes |coord| ≲ few*L)
 *
 * Note: For absolute particle positions that may have drifted far, use {@link wrapPoint} instead
 * (wrapPoint handles multiple ±2L translations, minimumImageVec3 assumes |coord| is near box).
 *
 * @param v Vector object with x, y, z properties (mutated in place)
 * @param box Half-box extents
 * @returns The same vector object (for chaining)
 */
export function minimumImageVec3<T extends { x: number; y: number; z: number }>(v: T, box: HalfBox): T {
    v.x = minimumImageDisplacement(v.x, box.x)
    v.y = minimumImageDisplacement(v.y, box.y)
    v.z = minimumImageDisplacement(v.z, box.z)
    return v
}

/**
 * Return the 26 translation vectors corresponding to neighboring image cells (±x, ±y, ±z combinations excluding origin).
 * Used purely for visualization (ghost copies); physics uses minimum‑image without instantiating clones.
 * NOTE: Order is arbitrary but stable; consumers relying on specific ordering should document why.
 */
export function makeClonePositionsList(x: number, y: number, z: number): Array<{ x: number; y: number; z: number }> {
    return [
        { x: 2 * x, y: 0, z: 0 },
        { x: -2 * x, y: 0, z: 0 },
        { x: 0, y: 2 * y, z: 0 },
        { x: 0, y: -2 * y, z: 0 },
        { x: 0, y: 0, z: 2 * z },
        { x: 0, y: 0, z: -2 * z },
        { x: 2 * x, y: 0, z: 2 * z },
        { x: -2 * x, y: 0, z: 2 * z },
        { x: 2 * x, y: 0, z: -2 * z },
        { x: -2 * x, y: 0, z: -2 * z },
        { x: 0, y: 2 * y, z: 2 * z },
        { x: 0, y: -2 * y, z: 2 * z },
        { x: 0, y: 2 * y, z: -2 * z },
        { x: 0, y: -2 * y, z: -2 * z },
        { x: 2 * x, y: 2 * y, z: 0 },
        { x: -2 * x, y: 2 * y, z: 0 },
        { x: 2 * x, y: -2 * y, z: 0 },
        { x: -2 * x, y: -2 * y, z: 0 },
        { x: 2 * x, y: 2 * y, z: 2 * z },
        { x: -2 * x, y: 2 * y, z: 2 * z },
        { x: 2 * x, y: -2 * y, z: 2 * z },
        { x: -2 * x, y: -2 * y, z: 2 * z },
        { x: 2 * x, y: 2 * y, z: -2 * z },
        { x: -2 * x, y: 2 * y, z: -2 * z },
        { x: 2 * x, y: -2 * y, z: -2 * z },
        { x: -2 * x, y: -2 * y, z: -2 * z }
    ]
}

// Backward-compatibility alias (deprecated - use minimumImageVec3 instead)
/** @deprecated Use {@link minimumImageVec3} instead */
export const minimumImagePoint = minimumImageVec3
