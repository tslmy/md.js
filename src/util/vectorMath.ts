/**
 * Vector mathematics utilities for 3D calculations.
 * @module util/vectorMath
 */

/**
 * Computes the squared magnitude (length squared) of a 3D vector.
 * This is more efficient than computing the full magnitude when you only
 * need to compare distances or when the actual distance isn't needed.
 *
 * @param x - X component
 * @param y - Y component
 * @param z - Z component
 * @returns Squared magnitude (x² + y² + z²)
 *
 * @example
 * const r2 = magnitudeSquared(3, 4, 0)  // returns 25
 */
export function magnitudeSquared(x: number, y: number, z: number): number {
  return x * x + y * y + z * z
}

/**
 * Computes the magnitude (length) of a 3D vector.
 *
 * @param x - X component
 * @param y - Y component
 * @param z - Z component
 * @returns Magnitude √(x² + y² + z²)
 *
 * @example
 * const r = magnitude(3, 4, 0)  // returns 5
 */
export function magnitude(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z)
}

/**
 * Computes a visual radius for a particle based on its mass.
 * Uses a cube-root scaling so that visual volume is proportional to mass.
 *
 * @param mass - Particle mass
 * @param referenceMass - Mass that corresponds to reference radius (default: 10)
 * @param referenceRadius - Base radius for reference mass (default: 0.08)
 * @returns Visual radius for rendering
 *
 * @example
 * const radius = radiusFromMass(10)  // returns 0.08 (reference)
 * const radius = radiusFromMass(80)  // returns 0.16 (8x mass = 2x radius)
 */
export function radiusFromMass(
  mass: number,
  referenceMass: number = 10,
  referenceRadius: number = 0.08
): number {
  return referenceRadius * Math.cbrt(mass / referenceMass)
}

/**
 * Normalizes a 3D vector to unit length.
 * If the vector has zero magnitude, returns the zero vector.
 *
 * @param x - X component
 * @param y - Y component
 * @param z - Z component
 * @returns Normalized vector [x, y, z] with magnitude 1 (or [0,0,0] if input was zero)
 *
 * @example
 * const [nx, ny, nz] = normalize(3, 4, 0)  // returns [0.6, 0.8, 0]
 */
export function normalize(x: number, y: number, z: number): [number, number, number] {
  const mag = Math.sqrt(x * x + y * y + z * z)
  if (mag === 0) return [0, 0, 0]
  return [x / mag, y / mag, z / mag]
}
