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

/** Apply minimum-image mapping to a displacement vector components (not absolute position). */
export function minimumImageVec<T extends { x: number; y: number; z: number }>(d: T, box: HalfBox): T {
    d.x = minimumImageDisplacement(d.x, box.x)
    d.y = minimumImageDisplacement(d.y, box.y)
    d.z = minimumImageDisplacement(d.z, box.z)
    return d
}

/** Return a fresh array of 26 neighbor cell offsets for periodic clone rendering. */
export function makeClonePositionsList(x: number, y: number, z: number) {
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

/** Convenience: standalone minimum image for a single coordinate. */
export function minimumImageCoord(v: number, half: number): number { return minimumImageDisplacement(v, half) }
