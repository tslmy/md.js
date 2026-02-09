/**
 * Physics calculation utilities.
 * @module util/physics
 */

/**
 * Computes a softening length based on average particle spacing.
 *
 * Softening is used in gravitational and electrostatic force calculations
 * to prevent singularities when particles get very close. The softening
 * length is typically a small fraction (10-15%) of the average inter-particle
 * distance.
 *
 * @param particleCount - Number of particles in the simulation
 * @param box - Half-widths of the simulation box { x, y, z }
 * @param factor - Scaling factor (default: 0.15 for gravity, 0.1 for Coulomb)
 * @returns Softening length in simulation units
 *
 * @example
 * // For gravity force
 * const softening = computeSofteningLength(1000, { x: 10, y: 10, z: 10 }, 0.15)
 *
 * // For Coulomb force
 * const softening = computeSofteningLength(1000, { x: 10, y: 10, z: 10 }, 0.1)
 */
export function computeSofteningLength(
  particleCount: number,
  box: { x: number; y: number; z: number },
  factor: number = 0.15
): number {
  const N = Math.max(1, particleCount)
  const volume = (2 * box.x) * (2 * box.y) * (2 * box.z)
  const spacing = Math.cbrt(volume / N)
  return factor * spacing
}
