/**
 * Typed array allocation and conversion utilities.
 *
 * These helpers consolidate common patterns for managing Float32Array, Int32Array,
 * and Uint8Array buffers throughout the codebase. They support:
 *  - Reusing existing buffers when they have the correct length (avoids reallocation)
 *  - Safe conversions between regular arrays and typed arrays
 *  - Filled array initialization patterns
 */

/**
 * Ensure a Float32Array of the specified length, reusing `existing` if it matches.
 *
 * @param length Desired array length
 * @param existing Optional existing array to reuse if length matches
 * @returns Float32Array of the specified length (either existing or newly allocated)
 *
 * @example
 * // Allocate new array
 * const positions = ensureFloat32Array(300)
 *
 * @example
 * // Reuse existing if length matches, otherwise allocate new
 * state.positions = ensureFloat32Array(3 * N, state.positions)
 */
export function ensureFloat32Array(length: number, existing?: Float32Array): Float32Array {
  return existing && existing.length === length ? existing : new Float32Array(length)
}

/**
 * Ensure a Uint8Array of the specified length, reusing `existing` if it matches.
 *
 * @param length Desired array length
 * @param existing Optional existing array to reuse if length matches
 * @returns Uint8Array of the specified length (either existing or newly allocated)
 */
export function ensureUint8Array(length: number, existing?: Uint8Array): Uint8Array {
  return existing && existing.length === length ? existing : new Uint8Array(length)
}

/**
 * Ensure an Int32Array of the specified length, reusing `existing` if it matches.
 *
 * @param length Desired array length
 * @param existing Optional existing array to reuse if length matches
 * @returns Int32Array of the specified length (either existing or newly allocated)
 */
export function ensureInt32Array(length: number, existing?: Int32Array): Int32Array {
  return existing && existing.length === length ? existing : new Int32Array(length)
}

/**
 * Create a Float32Array filled with a specific value.
 *
 * @param length Array length
 * @param fillValue Value to fill all elements with
 * @returns New Float32Array filled with the specified value
 *
 * @example
 * const masses = float32Filled(100, 1.0) // Array of 100 ones
 */
export function float32Filled(length: number, fillValue: number): Float32Array {
  return new Float32Array(length).fill(fillValue)
}

/**
 * Create an Int32Array filled with a specific value.
 *
 * @param length Array length
 * @param fillValue Value to fill all elements with
 * @returns New Int32Array filled with the specified value
 *
 * @example
 * const heads = int32Filled(1000, -1) // Array of 1000 -1s (empty linked list heads)
 */
export function int32Filled(length: number, fillValue: number): Int32Array {
  return new Int32Array(length).fill(fillValue)
}

/**
 * Create a Uint8Array filled with a specific value.
 *
 * @param length Array length
 * @param fillValue Value to fill all elements with
 * @returns New Uint8Array filled with the specified value
 */
export function uint8Filled(length: number, fillValue: number): Uint8Array {
  return new Uint8Array(length).fill(fillValue)
}

/**
 * Convert a regular array or typed array to Float32Array.
 * If input is already a Float32Array, returns it directly (no copy).
 *
 * @param arr Source array (regular array or typed array)
 * @returns Float32Array containing the same values
 *
 * @example
 * const typed = toFloat32Array([1.5, 2.3, 3.7])
 */
export function toFloat32Array(arr: ArrayLike<number>): Float32Array {
  return arr instanceof Float32Array ? arr : Float32Array.from(arr)
}

/**
 * Convert a regular array or typed array to Int32Array.
 * If input is already an Int32Array, returns it directly (no copy).
 *
 * @param arr Source array (regular array or typed array)
 * @returns Int32Array containing the same values
 */
export function toInt32Array(arr: ArrayLike<number>): Int32Array {
  return arr instanceof Int32Array ? arr : Int32Array.from(arr)
}

/**
 * Convert a regular array or typed array to Uint8Array.
 * If input is already a Uint8Array, returns it directly (no copy).
 *
 * @param arr Source array (regular array or typed array)
 * @returns Uint8Array containing the same values
 */
export function toUint8Array(arr: ArrayLike<number>): Uint8Array {
  return arr instanceof Uint8Array ? arr : Uint8Array.from(arr)
}
