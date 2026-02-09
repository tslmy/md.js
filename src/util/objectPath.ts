/**
 * Utility for setting nested object properties via dot-notation paths.
 * @module util/objectPath
 */

/**
 * Assigns a value to a nested path in an object, creating intermediate
 * objects as needed.
 *
 * @example
 * const obj = {}
 * assignPath(obj, 'world.box.x', 5)
 * // obj is now { world: { box: { x: 5 } } }
 *
 * @param root - The root object to modify
 * @param path - Dot-separated path (e.g., "world.box.x")
 * @param value - The value to assign at the path
 */
export function assignPath(
  root: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const parts = path.split('.')
  let obj: Record<string, unknown> = root

  // Navigate to the parent object, creating intermediates as needed
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]
    let next = obj[p]
    if (next == null || typeof next !== 'object') {
      next = {}
      obj[p] = next
    }
    obj = next as Record<string, unknown>
  }

  // Set the final property
  obj[parts[parts.length - 1]] = value
}
