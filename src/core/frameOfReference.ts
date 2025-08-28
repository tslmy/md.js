import { Vector3 } from 'three'
import type { SimulationState } from './simulation/state.js'
import type { SettingsObject } from '../control/settingsSchema.js'

/**
 * Determine the frame offset based on the selected reference frame mode.
 *  - fixed: origin remains at (0,0,0)
 *  - sun: subtract position of particle 0
 *  - com: subtract instantaneous center-of-mass (translational DOF removal)
 */
export function computeFrameOffset(simState: SimulationState | undefined, settings: SettingsObject): Vector3 {
    if (!simState) return new Vector3(0, 0, 0)
    const direct = (settings as unknown as Record<string, unknown>).referenceFrameMode as string | undefined
    const mode = (direct && typeof direct === 'string') ? direct.toLowerCase() : undefined
    if (mode === 'sun' && simState.N > 0) return new Vector3(simState.positions[0], simState.positions[1], simState.positions[2])
    if (mode === 'com') {
        const { masses, positions, N } = simState
        let mx = 0, my = 0, mz = 0, mTot = 0
        for (let i = 0; i < N; i++) {
            const i3 = 3 * i; const m = (masses[i] ?? 1)
            mx += m * positions[i3]; my += m * positions[i3 + 1]; mz += m * positions[i3 + 2]; mTot += m
        }
        if (mTot > 0) return new Vector3(mx / mTot, my / mTot, mz / mTot)
    }
    return new Vector3(0, 0, 0)
}

/**
 * Recompute the display-space (reference-frame shifted) positions array.
 * Does not mutate the engine's authoritative `SimulationState.positions` buffer.
 */
export function updateDisplayPositions(simState: SimulationState | undefined, frameOffset: Vector3, out?: Float32Array): Float32Array {
    if (!simState) return out ?? new Float32Array(0)
    if (!out || out.length !== simState.positions.length) {
        out = new Float32Array(simState.positions.length)
    }
    const src = simState.positions
    for (let i = 0; i < simState.N; i++) {
        const i3 = 3 * i
        out[i3] = src[i3] - frameOffset.x
        out[i3 + 1] = src[i3 + 1] - frameOffset.y
        out[i3 + 2] = src[i3 + 2] - frameOffset.z
    }
    return out
}
