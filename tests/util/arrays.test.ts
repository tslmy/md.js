import { describe, it, expect } from 'vitest'
import {
  ensureFloat32Array,
  ensureUint8Array,
  ensureInt32Array,
  float32Filled,
  int32Filled,
  uint8Filled,
  toFloat32Array,
  toInt32Array,
  toUint8Array
} from '../../built/util/arrays.js'

describe('arrays utilities', () => {
  describe('ensureFloat32Array', () => {
    it('allocates new array when no existing array provided', () => {
      const arr = ensureFloat32Array(10)
      expect(arr).toBeInstanceOf(Float32Array)
      expect(arr.length).toBe(10)
    })

    it('reuses existing array if length matches', () => {
      const existing = new Float32Array(10)
      const result = ensureFloat32Array(10, existing)
      expect(result).toBe(existing)
    })

    it('allocates new array if existing length does not match', () => {
      const existing = new Float32Array(10)
      const result = ensureFloat32Array(20, existing)
      expect(result).not.toBe(existing)
      expect(result.length).toBe(20)
    })
  })

  describe('ensureUint8Array', () => {
    it('allocates new array when no existing array provided', () => {
      const arr = ensureUint8Array(10)
      expect(arr).toBeInstanceOf(Uint8Array)
      expect(arr.length).toBe(10)
    })

    it('reuses existing array if length matches', () => {
      const existing = new Uint8Array(10)
      const result = ensureUint8Array(10, existing)
      expect(result).toBe(existing)
    })

    it('allocates new array if existing length does not match', () => {
      const existing = new Uint8Array(10)
      const result = ensureUint8Array(5, existing)
      expect(result).not.toBe(existing)
      expect(result.length).toBe(5)
    })
  })

  describe('ensureInt32Array', () => {
    it('allocates new array when no existing array provided', () => {
      const arr = ensureInt32Array(15)
      expect(arr).toBeInstanceOf(Int32Array)
      expect(arr.length).toBe(15)
    })

    it('reuses existing array if length matches', () => {
      const existing = new Int32Array(15)
      const result = ensureInt32Array(15, existing)
      expect(result).toBe(existing)
    })

    it('allocates new array if existing length does not match', () => {
      const existing = new Int32Array(15)
      const result = ensureInt32Array(30, existing)
      expect(result).not.toBe(existing)
      expect(result.length).toBe(30)
    })
  })

  describe('float32Filled', () => {
    it('creates array filled with specified value', () => {
      const arr = float32Filled(5, 3.14)
      expect(arr).toBeInstanceOf(Float32Array)
      expect(arr.length).toBe(5)
      // Float32 has precision limits, check approximately
      arr.forEach(val => expect(val).toBeCloseTo(3.14, 5))
    })

    it('creates array filled with zeros', () => {
      const arr = float32Filled(3, 0)
      expect(Array.from(arr)).toEqual([0, 0, 0])
    })
  })

  describe('int32Filled', () => {
    it('creates array filled with specified value', () => {
      const arr = int32Filled(4, -1)
      expect(arr).toBeInstanceOf(Int32Array)
      expect(arr.length).toBe(4)
      expect(Array.from(arr)).toEqual([-1, -1, -1, -1])
    })

    it('creates array filled with positive values', () => {
      const arr = int32Filled(3, 42)
      expect(Array.from(arr)).toEqual([42, 42, 42])
    })
  })

  describe('uint8Filled', () => {
    it('creates array filled with specified value', () => {
      const arr = uint8Filled(6, 255)
      expect(arr).toBeInstanceOf(Uint8Array)
      expect(arr.length).toBe(6)
      expect(Array.from(arr)).toEqual([255, 255, 255, 255, 255, 255])
    })

    it('creates array filled with zeros', () => {
      const arr = uint8Filled(2, 0)
      expect(Array.from(arr)).toEqual([0, 0])
    })
  })

  describe('toFloat32Array', () => {
    it('returns same array if already Float32Array', () => {
      const existing = new Float32Array([1.5, 2.5, 3.5])
      const result = toFloat32Array(existing)
      expect(result).toBe(existing)
    })

    it('converts regular array to Float32Array', () => {
      const arr = [1.1, 2.2, 3.3]
      const result = toFloat32Array(arr)
      expect(result).toBeInstanceOf(Float32Array)
      expect(Array.from(result)).toEqual([
        expect.closeTo(1.1, 5),
        expect.closeTo(2.2, 5),
        expect.closeTo(3.3, 5)
      ])
    })

    it('converts other typed arrays to Float32Array', () => {
      const int32 = new Int32Array([10, 20, 30])
      const result = toFloat32Array(int32)
      expect(result).toBeInstanceOf(Float32Array)
      expect(Array.from(result)).toEqual([10, 20, 30])
    })
  })

  describe('toInt32Array', () => {
    it('returns same array if already Int32Array', () => {
      const existing = new Int32Array([1, 2, 3])
      const result = toInt32Array(existing)
      expect(result).toBe(existing)
    })

    it('converts regular array to Int32Array', () => {
      const arr = [10, 20, 30]
      const result = toInt32Array(arr)
      expect(result).toBeInstanceOf(Int32Array)
      expect(Array.from(result)).toEqual([10, 20, 30])
    })

    it('converts Float32Array to Int32Array (truncating)', () => {
      const float32 = new Float32Array([1.9, 2.1, 3.7])
      const result = toInt32Array(float32)
      expect(result).toBeInstanceOf(Int32Array)
      expect(Array.from(result)).toEqual([1, 2, 3])
    })
  })

  describe('toUint8Array', () => {
    it('returns same array if already Uint8Array', () => {
      const existing = new Uint8Array([0, 1, 255])
      const result = toUint8Array(existing)
      expect(result).toBe(existing)
    })

    it('converts regular array to Uint8Array', () => {
      const arr = [0, 128, 255]
      const result = toUint8Array(arr)
      expect(result).toBeInstanceOf(Uint8Array)
      expect(Array.from(result)).toEqual([0, 128, 255])
    })

    it('converts Int32Array to Uint8Array (clamping to byte range)', () => {
      const int32 = new Int32Array([0, 100, 200])
      const result = toUint8Array(int32)
      expect(result).toBeInstanceOf(Uint8Array)
      expect(Array.from(result)).toEqual([0, 100, 200])
    })
  })
})
