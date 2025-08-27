import { Color } from 'three'

/**
 * Generate a color palette for N particles, with optional sun (black at idx 0).
 * Used for both cold boot and resizing to ensure consistent color logic.
 */
export function generateParticleColors(N: number, makeSun: boolean, start = 0): Color[] {
    const arr: Color[] = []
    for (let i = start; i < N; i++) {
        arr.push((makeSun && i === 0)
            ? new Color(0, 0, 0)
            : new Color(Math.random(), Math.random(), Math.random()))
    }
    return arr
}
