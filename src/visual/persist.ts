import { BufferAttribute, Line } from 'three'

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
export function captureVisualData(trajectories: (Line | null)[]): VisualDataSnapshot | null {
    if (!trajectories.length) return null
    // Find first trajectory to determine length
    let maxLen = 0
    for (const t of trajectories) {
        if (t) { maxLen = (t.geometry.getAttribute('position') as BufferAttribute).count; break }
    }
    if (!maxLen) return { version: 1, maxTrajectoryLength: 0, trajectories: trajectories.map(() => []) }
    const trajectoriesData: number[][] = trajectories.map(t => {
        if (!t) return []
        const attr = t.geometry.getAttribute('position') as BufferAttribute
        const out = new Array(attr.count * 3)
        for (let i = 0; i < attr.count; i++) {
            const k = 3 * i
            out[k] = attr.getX(i)
            out[k + 1] = attr.getY(i)
            out[k + 2] = attr.getZ(i)
        }
        return out
    })
    return { version: 1, maxTrajectoryLength: maxLen, trajectories: trajectoriesData }
}

/** Apply a visual snapshot's trajectory data back onto existing particle trajectories (if compatible). */
export function applyVisualData(snapshot: VisualDataSnapshot, targets: (Line | null)[]): void {
    if (snapshot.version !== 1) return
    const { maxTrajectoryLength, trajectories } = snapshot
    for (let i = 0; i < trajectories.length && i < targets.length; i++) {
        const arr = trajectories[i]
        const t = targets[i]
        if (!t || arr.length === 0) continue
        const attr = t.geometry.getAttribute('position') as BufferAttribute
        if (attr.count !== maxTrajectoryLength || arr.length !== 3 * maxTrajectoryLength) continue
        for (let j = 0; j < maxTrajectoryLength; j++) {
            const k = 3 * j
            attr.setXYZ(j, arr[k], arr[k + 1], arr[k + 2])
        }
        attr.needsUpdate = true
    }
}

/** Persist visual data snapshot to localStorage (no-op outside browser). */
export function saveVisualDataToLocal(trajectories: (Line | null)[]): void {
    try {
        if (typeof localStorage === 'undefined') return
        const snap = captureVisualData(trajectories)
        if (!snap) return
        localStorage.setItem(VISUAL_SNAPSHOT_KEY, JSON.stringify(snap))
    } catch { /* ignore */ }
}

/** Load and apply visual data snapshot from localStorage if present. */
export function loadVisualDataFromLocal(targets: (Line | null)[]): boolean {
    try {
        if (typeof localStorage === 'undefined') return false
        const raw = localStorage.getItem(VISUAL_SNAPSHOT_KEY)
        if (!raw) return false
        const snap = JSON.parse(raw) as VisualDataSnapshot
        applyVisualData(snap, targets)
        return true
    } catch { return false }
}

/** Clear visual data snapshot from localStorage if present. */
export function clearVisualDataInLocal(): void {
    localStorage.removeItem(VISUAL_SNAPSHOT_KEY)
}
