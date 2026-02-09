import { describe, it, expect } from 'vitest'
import { assignPath } from '../../built/util/objectPath.js'

describe('assignPath', () => {
  it('sets a top-level property', () => {
    const obj = {}
    assignPath(obj, 'foo', 42)
    expect(obj).toEqual({ foo: 42 })
  })

  it('sets a nested property, creating intermediate objects', () => {
    const obj = {}
    assignPath(obj, 'world.box.x', 5)
    expect(obj).toEqual({ world: { box: { x: 5 } } })
  })

  it('sets a deeply nested property', () => {
    const obj = {}
    assignPath(obj, 'a.b.c.d.e', 'deep')
    expect(obj).toEqual({ a: { b: { c: { d: { e: 'deep' } } } } })
  })

  it('overwrites an existing value at the path', () => {
    const obj = { world: { box: { x: 10 } } }
    assignPath(obj, 'world.box.x', 20)
    expect(obj.world.box.x).toBe(20)
  })

  it('creates intermediate objects even if existing value is non-object', () => {
    const obj = { world: 'string' as unknown }
    assignPath(obj, 'world.box.x', 5)
    expect(obj).toEqual({ world: { box: { x: 5 } } })
  })

  it('creates intermediate objects when existing value is null', () => {
    const obj = { world: null as unknown }
    assignPath(obj, 'world.box.x', 5)
    expect(obj).toEqual({ world: { box: { x: 5 } } })
  })

  it('preserves sibling properties when setting nested path', () => {
    const obj = { world: { box: { x: 1, y: 2 } } }
    assignPath(obj, 'world.box.z', 3)
    expect(obj).toEqual({ world: { box: { x: 1, y: 2, z: 3 } } })
  })

  it('handles numeric string keys in path', () => {
    const obj = {}
    assignPath(obj, 'array.0.value', 123)
    expect(obj).toEqual({ array: { '0': { value: 123 } } })
  })

  it('assigns various value types correctly', () => {
    const obj = {}
    assignPath(obj, 'a', null)
    assignPath(obj, 'b', undefined)
    assignPath(obj, 'c', true)
    assignPath(obj, 'd', [1, 2, 3])
    assignPath(obj, 'e', { nested: 'object' })
    expect(obj).toEqual({
      a: null,
      b: undefined,
      c: true,
      d: [1, 2, 3],
      e: { nested: 'object' }
    })
  })
})
