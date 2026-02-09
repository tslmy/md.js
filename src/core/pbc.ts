/**
 * Periodic boundary condition (PBC) helpers centralizing wrap & minimum-image logic.
 * Box dimensions are expressed as half-lengths (i.e. valid coordinate range is [-L, L]).
 */

export interface HalfBox { x: number; y: number; z: number }

// Global periodic boundary configuration (single source of truth).
let _pbcEnabled = false
let _pbcBox: HalfBox = { x: 0, y: 0, z: 0 }

/** Configure global periodic boundary settings (half box extents + enabled flag). */
export function configurePBC(box: HalfBox, enabled: boolean): void {
    _pbcEnabled = enabled
    _pbcBox = { x: box.x, y: box.y, z: box.z }
}

/** Current periodic boundary configuration. */
export function currentPBC(): { enabled: boolean; box: HalfBox } {
    return { enabled: _pbcEnabled, box: _pbcBox }
}

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

/** Convenience: standalone minimum image for a single coordinate. */
export function minimumImageCoord(v: number, half: number): number { return minimumImageDisplacement(v, half) }

/**
 * Apply minimum‑image mapping to an absolute position (component-wise, single adjustment per axis).
 * Differs from {@link wrapPoint}: wrapPoint may apply multiple ±2L translations if coordinate drifted far;
 * this helper assumes |coord| ≲ few*L and is meant for display-space adjustment / reference frame math.
 */
export function minimumImagePoint<T extends { x: number; y: number; z: number }>(p: T, box: HalfBox): T {
    p.x = minimumImageCoord(p.x, box.x)
    p.y = minimumImageCoord(p.y, box.y)
    p.z = minimumImageCoord(p.z, box.z)
    return p
}

/** Apply minimum-image convention to raw displacement components in place and return tuple. */
export function minimumImageVector(dxdyz: { dx: number; dy: number; dz: number }, box: HalfBox): { dx: number; dy: number; dz: number } {
    dxdyz.dx = minimumImageDisplacement(dxdyz.dx, box.x)
    dxdyz.dy = minimumImageDisplacement(dxdyz.dy, box.y)
    dxdyz.dz = minimumImageDisplacement(dxdyz.dz, box.z)
    return dxdyz
}
