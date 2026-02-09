import type { HalfBox } from '../pbc.js'
import { wrapIntoBox } from '../pbc.js'

/**
 * Describes which periodic boundary surface(s) a particle crossed.
 */
export interface WrapSurface {
  axis: 'x' | 'y' | 'z'
  sign: 1 | -1 // +1 if exited through +L plane, -1 if through -L plane
}

/**
 * Detailed information about a single boundary crossing along one axis.
 */
export interface WrapCrossing {
  axis: 'x' | 'y' | 'z'
  sign: 1 | -1
  exit: { x: number; y: number; z: number } // Point on plane where particle left box
  entry: { x: number; y: number; z: number } // Corresponding point on opposite plane where it re-enters
}

/**
 * Complete record of a particle's wrap event across periodic boundaries.
 * Exported for use by SimulationEngine and event consumers.
 */
export interface WrapRecord {
  i: number // Particle index
  dx: number // x-displacement applied by wrapping
  dy: number // y-displacement applied by wrapping
  dz: number // z-displacement applied by wrapping
  surfaces: WrapSurface[] // Which surfaces were crossed
  rawX: number // Original x-position before wrap
  rawY: number // Original y-position before wrap
  rawZ: number // Original z-position before wrap
  crossings: WrapCrossing[] // Detailed crossing information per axis
}

/**
 * Result of wrapping positions into periodic box.
 */
export interface WrapResult {
  wrappedCount: number // Number of particles that wrapped
  records: WrapRecord[] // Detailed records for each wrapped particle
}

/**
 * Wraps particle positions into periodic box [-L, L] along each axis and tracks crossings.
 *
 * This is a pure function that performs the wrapping logic without side effects.
 * The caller is responsible for:
 * - Mutating the actual positions array
 * - Emitting events
 * - Logging wrap information
 *
 * Implementation:
 * - Iterates over N particles (O(N))
 * - For each particle, wraps coordinates independently per axis
 * - Tracks which boundary surfaces were crossed
 * - Constructs crossing records with exit/entry points for visualization
 *
 * @param positions - Flattened Float32Array of particle positions (3N components)
 * @param N - Number of particles
 * @param box - Half-lengths of periodic box (x, y, z)
 * @returns WrapResult containing count and detailed records of wrapped particles
 */
export function wrapPositionsWithTracking(
  positions: Float32Array,
  N: number,
  box: HalfBox
): WrapResult {
  const records: WrapRecord[] = []

  for (let i = 0; i < N; i++) {
    const base = 3 * i
    const rawX = positions[base]
    const rawY = positions[base + 1]
    const rawZ = positions[base + 2]

    const x = wrapIntoBox(rawX, box.x)
    const y = wrapIntoBox(rawY, box.y)
    const z = wrapIntoBox(rawZ, box.z)

    // Update positions in-place
    positions[base] = x
    positions[base + 1] = y
    positions[base + 2] = z

    // Calculate displacement
    const dx = x - rawX
    const dy = y - rawY
    const dz = z - rawZ

    // Skip if no wrapping occurred
    if (dx === 0 && dy === 0 && dz === 0) continue

    // Build surface and crossing records
    const surfaces: WrapSurface[] = []
    const crossings: WrapCrossing[] = []

    const addCrossing = (
      axis: 'x' | 'y' | 'z',
      disp: number,
      half: number,
      rawPos: { x: number; y: number; z: number },
      wrappedPos: { x: number; y: number; z: number }
    ): void => {
      if (disp === 0) return

      // If displacement is negative, particle moved in -axis direction,
      // meaning it exited through +L plane (sign = +1)
      const sign: 1 | -1 = disp < 0 ? 1 : -1
      surfaces.push({ axis, sign })

      // Exit point: place on the plane the particle left
      const exit = { ...rawPos }
      exit[axis] = sign * half

      // Entry point: place on the opposite plane where it re-enters
      const entry = { ...wrappedPos }
      entry[axis] = -sign * half

      crossings.push({ axis, sign, exit, entry })
    }

    addCrossing('x', dx, box.x, { x: rawX, y: rawY, z: rawZ }, { x, y, z })
    addCrossing('y', dy, box.y, { x: rawX, y: rawY, z: rawZ }, { x, y, z })
    addCrossing('z', dz, box.z, { x: rawX, y: rawY, z: rawZ }, { x, y, z })

    records.push({ i, dx, dy, dz, surfaces, rawX, rawY, rawZ, crossings })
  }

  return {
    wrappedCount: records.length,
    records
  }
}

/**
 * Format a number for console output (handles tiny values, integers, and decimals).
 */
function formatNumber(v: number): string {
  if (Math.abs(v) < 1e-6) return '0'
  if (Number.isInteger(v)) return v.toString()
  return v.toFixed(3)
}

/**
 * Format a displacement vector for console output.
 */
function formatDisplacement(dx: number, dy: number, dz: number): string {
  return `(${formatNumber(dx)}, ${formatNumber(dy)}, ${formatNumber(dz)})`
}

/**
 * Generate human-readable log messages for wrap records.
 *
 * @param records - Wrap records to format
 * @returns Array of formatted log messages
 */
export function formatWrapRecords(records: WrapRecord[]): string[] {
  return records.map(w => {
    const exits = w.surfaces.map(s => `${s.sign > 0 ? '+' : '-'}${s.axis}`)
    const entries = w.surfaces.map(s => `${s.sign > 0 ? '-' : '+'}${s.axis}`)
    const dispStr = formatDisplacement(w.dx, w.dy, w.dz)

    if (w.surfaces.length === 1) {
      return `particle ${w.i} exited via the ${exits[0]} plane; wrapped to the ${entries[0]} plane by moving ${dispStr}.`
    } else {
      return `particle ${w.i} exited via planes ${exits.join(', ')}; wrapped to opposite planes ${entries.join(', ')} by moving ${dispStr}.`
    }
  })
}

/**
 * Log wrap events to console with formatted messages.
 *
 * If more than 5 particles wrapped, only log the count to avoid spam.
 *
 * @param records - Wrap records to log
 */
export function logWrapEvents(records: WrapRecord[]): void {
  if (records.length === 0) return

  if (records.length <= 5) {
    const lines = formatWrapRecords(records)
    console.log(`[wrap] ${records.length} particle(s) crossed periodic boundary\n` + lines.join('\n'))
  } else {
    console.log(`[wrap] ${records.length} particle(s) crossed periodic boundary (omitting details)`)
  }
}
