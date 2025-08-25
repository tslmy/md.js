import { Mesh, MeshBasicMaterial, RingGeometry, Scene, Vector3 } from 'three'
import { settings } from '../control/settings.js'
import { minimumImageCoord } from '../core/pbc.js'

// Types representing boundary wrap surfaces and crossing events.
export type WrapSurface = { axis: 'x' | 'y' | 'z'; sign: 1 | -1 }
export type WrapCrossing = { axis: 'x' | 'y' | 'z'; sign: 1 | -1; exit: { x: number; y: number; z: number }; entry: { x: number; y: number; z: number } }
export type WrapEventRecord = { i: number; dx: number; dy: number; dz: number; surfaces: WrapSurface[]; rawX: number; rawY: number; rawZ: number; crossings: WrapCrossing[] }
export interface WrapMarker { mesh: Mesh; birth: number }

const wrapMarkers: WrapMarker[] = []
const WRAP_MARKER_LIFETIME = 2_000 // ms
const WRAP_MARKER_RADIUS = 0.4
const WRAP_MARKER_THICKNESS = 0.05

// Shared temp vector to avoid allocations in loops
const _tmpVec = new Vector3()

function minimumImageVec(out: Vector3, x: number, y: number, z: number): Vector3 {
    return out.set(
        minimumImageCoord(x, settings.spaceBoundaryX),
        minimumImageCoord(y, settings.spaceBoundaryY),
        minimumImageCoord(z, settings.spaceBoundaryZ)
    )
}

export function createWrapMarker(
    scene: Scene,
    surface: WrapSurface,
    rawWorld: { x: number; y: number; z: number },
    frameOffset: Vector3,
    color: number
): void {
    const inner = WRAP_MARKER_RADIUS - WRAP_MARKER_THICKNESS
    const geom = new RingGeometry(inner, WRAP_MARKER_RADIUS, 32)
    const mat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: 2 })
    const ring = new Mesh(geom, mat)
    // Position ring flush with boundary plane, centered; orientation depends on axis.
    const bx = settings.spaceBoundaryX
    const by = settings.spaceBoundaryY
    const bz = settings.spaceBoundaryZ
    let half = bx
    if (surface.axis === 'y') half = by
    else if (surface.axis === 'z') half = bz
    const dist = surface.sign * half
    // Convert raw world coords to frame-relative then minimum-image display space so marker aligns with display-wrapped particles.
    const relX = rawWorld.x - frameOffset.x
    const relY = rawWorld.y - frameOffset.y
    const relZ = rawWorld.z - frameOffset.z
    const disp = settings.if_use_periodic_boundary_condition
        ? minimumImageVec(_tmpVec, relX, relY, relZ)
        : _tmpVec.set(relX, relY, relZ)
    if (surface.axis === 'x') {
        ring.position.set(dist, disp.y, disp.z)
        ring.rotation.y = Math.PI / 2
    } else if (surface.axis === 'y') {
        ring.position.set(disp.x, dist, disp.z)
        ring.rotation.x = -Math.PI / 2
    } else { // z
        ring.position.set(disp.x, disp.y, dist)
    }
    scene.add(ring)
    wrapMarkers.push({ mesh: ring, birth: performance.now() })
}

export function updateWrapMarkers(scene: Scene): void {
    const now = performance.now()
    for (let i = wrapMarkers.length - 1; i >= 0; i--) {
        const m = wrapMarkers[i]
        const age = now - m.birth
        if (age > WRAP_MARKER_LIFETIME) {
            scene.remove(m.mesh)
            m.mesh.geometry.dispose()
            if (Array.isArray(m.mesh.material)) m.mesh.material.forEach(mt => mt.dispose())
            else m.mesh.material.dispose()
            wrapMarkers.splice(i, 1)
        } else {
            const t = age / WRAP_MARKER_LIFETIME
            const fade = 1 - t
            const mat = m.mesh.material as MeshBasicMaterial
            mat.opacity = fade
            mat.needsUpdate = true
            // Optional subtle scale pulse
            const scale = 1 + 0.2 * t
            m.mesh.scale.set(scale, scale, scale)
        }
    }
}
