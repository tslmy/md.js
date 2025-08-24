import { BufferAttribute } from 'three'
import type { Particle } from '../../particleSystem.js'

/** LocalStorage key for visual (non-engine) data. */
export const VISUAL_SNAPSHOT_KEY = 'mdJsVisualSnapshot'

export interface VisualDataSnapshot {
    version: 1
    /** Trajectory length (# points) per particle. Assumed consistent across all particles that have a trajectory. */
    maxTrajectoryLength: number
    /** Per-particle flattened xyz triples (length = 3 * maxTrajectoryLength). Empty array if particle had no trajectory. */
    trajectories: number[][]
}

/** Capture current trajectory buffer attributes into a serializable snapshot. */
export function captureVisualData(particles: Particle[]): VisualDataSnapshot | null {
    if (!particles.length) return null
    // Find first trajectory to determine length
    let maxLen = 0
    for (const p of particles) {
        if (p.trajectory) { maxLen = (p.trajectory.geometry.getAttribute('position') as BufferAttribute).count; break }
    }
    if (!maxLen) return { version: 1, maxTrajectoryLength: 0, trajectories: particles.map(() => []) }
    const trajectories: number[][] = particles.map(p => {
        if (!p.trajectory) return []
        const attr = p.trajectory.geometry.getAttribute('position') as BufferAttribute
        const out = new Array(attr.count * 3)
        for (let i = 0; i < attr.count; i++) {
            const k = 3 * i
            out[k] = attr.getX(i)
            out[k + 1] = attr.getY(i)
            out[k + 2] = attr.getZ(i)
        }
        return out
    })
    return { version: 1, maxTrajectoryLength: maxLen, trajectories }
}

/** Apply a visual snapshot's trajectory data back onto existing particle trajectories (if compatible). */
export function applyVisualData(snapshot: VisualDataSnapshot, particles: Particle[]): void {
    if (snapshot.version !== 1) return
    const { maxTrajectoryLength, trajectories } = snapshot
    for (let i = 0; i < trajectories.length && i < particles.length; i++) {
        const arr = trajectories[i]
        const p = particles[i]
        if (!p.trajectory || !arr.length) continue
        const attr = p.trajectory.geometry.getAttribute('position') as BufferAttribute
        if (attr.count !== maxTrajectoryLength || arr.length !== 3 * maxTrajectoryLength) continue
        for (let j = 0; j < maxTrajectoryLength; j++) {
            const k = 3 * j
            attr.setXYZ(j, arr[k], arr[k + 1], arr[k + 2])
        }
        attr.needsUpdate = true
    }
}

/** Persist visual data snapshot to localStorage (no-op outside browser). */
export function saveVisualDataToLocal(particles: Particle[]): void {
    try {
        if (typeof localStorage === 'undefined') return
        const snap = captureVisualData(particles)
        if (!snap) return
        localStorage.setItem(VISUAL_SNAPSHOT_KEY, JSON.stringify(snap))
    } catch { /* ignore */ }
}

/** Load and apply visual data snapshot from localStorage if present. */
export function loadVisualDataFromLocal(particles: Particle[]): boolean {
    try {
        if (typeof localStorage === 'undefined') return false
        const raw = localStorage.getItem(VISUAL_SNAPSHOT_KEY)
        // Backward compatibility: migrate older ad-hoc key
        const legacy = localStorage.getItem('mdJsVisualTrajectories')
        if (!raw && legacy) {
            try {
                const parsedLegacy = JSON.parse(legacy) as { maxLen: number; data: number[][] }
                const converted: VisualDataSnapshot = { version: 1, maxTrajectoryLength: parsedLegacy.maxLen, trajectories: parsedLegacy.data }
                applyVisualData(converted, particles)
                localStorage.setItem(VISUAL_SNAPSHOT_KEY, JSON.stringify(converted))
                localStorage.removeItem('mdJsVisualTrajectories')
                return true
            } catch { /* ignore */ }
        }
        if (!raw) return false
        const snap = JSON.parse(raw) as VisualDataSnapshot
        applyVisualData(snap, particles)
        return true
    } catch { return false }
}
