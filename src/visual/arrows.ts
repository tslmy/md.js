import { Vector3, Scene } from 'three'
import { settings } from '../control/settings.js'
import type { Diagnostics } from '../core/simulation/diagnostics.js'
import type { SimulationState } from '../core/simulation/state.js'
import { InstancedArrows } from './InstancedArrows.js'

/** Container for both velocity and force arrow instanced meshes. */
export interface ArrowSet {
    vel: InstancedArrows
    force: InstancedArrows
}

/** Create (but don't necessarily show) velocity (blue) & force (red) arrow sets. */
export function createArrows(N: number, scene: Scene): ArrowSet {
    const vel = new InstancedArrows(N, { color: 0x0066ff })
    const force = new InstancedArrows(N, { color: 0xff3300 })
    vel.addTo(scene); force.addTo(scene)
    vel.setVisible(settings.if_showArrows)
    force.setVisible(settings.if_showArrows)
    return { vel, force }
}

/**
 * Update DOM HUD scale bars giving user context for relative vector lengths.
 * We scale bars linearly with 1 / maxMagnitude so the longest arrow corresponds to unit UI length.
 */
export function updateScaleBars(diag: Diagnostics | undefined): void {
    if (!diag) return
    const forceScale = diag.maxForceMag > 0 ? settings.unitArrowLength / diag.maxForceMag : 1
    const velScale = diag.maxSpeed > 0 ? settings.unitArrowLength / diag.maxSpeed : 1
    const forceEl = document.getElementById('force')
    if (forceEl) forceEl.style.width = `${forceScale * 1000000}px`
    const velEl = document.getElementById('velocity')
    if (velEl) velEl.style.width = `${velScale * 1000000}px`
}

/**
 * Stage per-particle velocity & force arrows for current frame.
 * Applies reference frame offset and normalizes lengths relative to frame extrema (diag.maxSpeed / diag.maxForceMag).
 */
export function updateArrows(state: SimulationState, diag: Diagnostics, frameOffset: Vector3, arrows: ArrowSet): void {
    const { positions, velocities, forces, N, escaped } = state
    const { vel, force } = arrows
    const velNorm = diag.maxSpeed > 0 ? settings.unitArrowLength / diag.maxSpeed : 1
    const forceNorm = diag.maxForceMag > 0 ? settings.unitArrowLength / diag.maxForceMag : 1
    const limit = settings.if_limitArrowsMaxLength
    const maxLen = settings.maxArrowLength
    const tmpOrigin = new Vector3()
    const tmpVec = new Vector3()
    for (let i = 0; i < N; i++) {
        const i3 = 3 * i
        if (escaped && escaped[i] === 1) {
            vel.update(i, tmpOrigin.set(0, -9999, 0), tmpVec.set(0, 0, 0), 0.000001)
            force.update(i, tmpOrigin.set(0, -9999, 0), tmpVec.set(0, 0, 0), 0.000001)
            continue
        }
        const px = positions[i3] - frameOffset.x
        const py = positions[i3 + 1] - frameOffset.y
        const pz = positions[i3 + 2] - frameOffset.z
        tmpOrigin.set(px, py, pz)
        tmpVec.set(velocities[i3], velocities[i3 + 1], velocities[i3 + 2])
        let vLen = tmpVec.length() * velNorm
        if (limit && vLen > maxLen) vLen = maxLen
        vel.update(i, tmpOrigin, tmpVec, vLen)
        tmpVec.set(forces[i3], forces[i3 + 1], forces[i3 + 2])
        let fLen = tmpVec.length() * forceNorm
        if (limit && fLen > maxLen) fLen = maxLen
        force.update(i, tmpOrigin, tmpVec, fLen)
    }
}

/**
 * High-level arrow update entry point called from frame loop.
 * Hides meshes when prerequisites (state, diagnostics, user toggle) are absent to avoid rendering stale transforms.
 */
export function finalizeArrows(arrows: ArrowSet, state: SimulationState | undefined, diag: Diagnostics | undefined, frameOffset: Vector3): void {
    const show = settings.if_showArrows && state && diag
    if (!show) {
        arrows.vel.setVisible(false)
        arrows.force.setVisible(false)
        return
    }
    updateArrows(state, diag, frameOffset, arrows)
    arrows.vel.setVisible(true)
    arrows.force.setVisible(true)
    arrows.vel.commit(); arrows.force.commit()
}
