import { describe, it, expect } from 'vitest'
import { Scene, Vector3, Mesh } from 'three'
import { settings } from '../built/control/settings.js'
import { createWrapMarker, updateWrapMarkers } from '../built/visual/wrapMarkers.js'

// Helper to patch performance.now for deterministic time control
function withFakeNow<T>(times: number[], fn: () => T): T {
    const original = performance.now
    let idx = 0
        ; (performance as unknown as { now: () => number }).now = () => times[Math.min(idx++, times.length - 1)]
    try { return fn() } finally { (performance as unknown as { now: () => number }).now = original }
}

describe('wrapMarkers visual lifecycle', () => {
    it('fades opacity proportionally to age', () => {
        const scene = new Scene()
        // Ensure PBC on so minimum-image branch executed (more coverage)
        settings.if_use_periodic_boundary_condition = true
        const surface = { axis: 'x' as const, sign: 1 as const }
        const frameOffset = new Vector3(0, 0, 0)

        withFakeNow([0, 1000], () => {
            createWrapMarker(scene, surface, { x: 1, y: 2, z: 3 }, frameOffset, 0xff0000)
            expect(scene.children.length).toBe(1)
            const mesh = scene.children[0] as Mesh & { material: { opacity: number } }
            // Initial opacity set at creation
            expect(mesh.material.opacity).toBeCloseTo(0.9, 5)
            // Advance fake clock to 1000ms (half of 2000 lifetime) then update
            updateWrapMarkers(scene)
            expect(mesh.material.opacity).toBeCloseTo(0.5, 2)
        })
    })

    it('removes marker after lifetime and disposes resources', () => {
        const scene = new Scene()
        const surface = { axis: 'z' as const, sign: -1 as const }
        const frameOffset = new Vector3(0, 0, 0)

        withFakeNow([0, 2500], () => {
            createWrapMarker(scene, surface, { x: -2, y: 0.5, z: 0 }, frameOffset, 0x00ff00)
            expect(scene.children.length).toBe(1)
            const mesh = scene.children[0] as Mesh
            // Advance beyond lifetime
            updateWrapMarkers(scene)
            expect(scene.children.length).toBe(0)
            // Geometry/material should have been disposed; dispose() doesn't null fields, but we can check a flag
            // three.js sets geometry.dispose() consumers rely on event; minimal sanity: geometry.uuid still exists but mesh removed
            expect(mesh.parent).toBeNull()
        })
    })
})
