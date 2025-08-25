import { BufferAttribute, Line, Color } from 'three'
import { lsGet, lsRemove, lsSet } from '../util/storage.js'

/** LocalStorage key for visual (non-engine) data. */
export const VISUAL_SNAPSHOT_KEY = 'mdJsVisualSnapshot'

export interface VisualDataSnapshot {
    /** Snapshot schema version. v1: trajectories only. v2: adds colors array. */
    version: 1 | 2
    /** Trajectory length (# points) per particle. Assumed consistent across all particles that have a trajectory. */
    maxTrajectoryLength: number
    /** Per-particle flattened xyz triples (length = 3 * maxTrajectoryLength). Empty array if particle had no trajectory. */
    trajectories: number[][]
    /** (v2+) Per-particle color hex values (0xRRGGBB). */
    colors?: number[]
}

/** Capture current trajectory buffer attributes into a serializable snapshot. */
export function captureVisualData(trajectories: (Line | null)[], colors?: Color[]): VisualDataSnapshot | null {
    if (!trajectories.length) return null
    // Find first trajectory to determine length
    let maxLen = 0
    for (const t of trajectories) {
        if (t) { maxLen = (t.geometry.getAttribute('position') as BufferAttribute).count; break }
    }
    if (!maxLen) {
        const base: VisualDataSnapshot = { version: colors ? 2 : 1, maxTrajectoryLength: 0, trajectories: trajectories.map(() => []) }
        if (colors) base.colors = colors.map(c => c.getHex())
        return base
    }
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
    const snap: VisualDataSnapshot = { version: colors ? 2 : 1, maxTrajectoryLength: maxLen, trajectories: trajectoriesData }
    if (colors) snap.colors = colors.map(c => c.getHex())
    return snap
}

/** Apply a visual snapshot's trajectory data back onto existing particle trajectories (if compatible). */
export function applyVisualData(snapshot: VisualDataSnapshot, targets: (Line | null)[], colors?: Color[]): void {
    if (snapshot.version !== 1 && snapshot.version !== 2) return
    restoreTrajectories(snapshot, targets)
    if (snapshot.version === 2) restoreColors(snapshot, colors, targets)
}

function restoreTrajectories(snapshot: VisualDataSnapshot, targets: (Line | null)[]): void {
    const { maxTrajectoryLength, trajectories } = snapshot
    const cap = Math.min(trajectories.length, targets.length)
    for (let i = 0; i < cap; i++) {
        const arr = trajectories[i]; const t = targets[i]
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

function restoreColors(snapshot: VisualDataSnapshot, colors?: Color[], trajectories?: (Line | null)[]): void {
    if (!colors || !snapshot.colors) return
    const hexes = snapshot.colors
    const cap = Math.min(hexes.length, colors.length)
    for (let i = 0; i < cap; i++) {
        const hex = hexes[i]
        if (!Number.isFinite(hex)) continue
        colors[i].setHex(hex)
        // Update trajectory line material if present
        const mat = trajectories?.[i]?.material as { color?: Color } | undefined
        mat?.color?.setHex(hex)
        try {
            const cell = document.querySelector<HTMLElement>(`#tabularInfo > tbody > tr:nth-child(${i + 1}) > td.particle`)
            if (cell) cell.style.color = '#' + hex.toString(16).padStart(6, '0')
        } catch { /* ignore */ }
    }
}

/** Persist visual data snapshot to localStorage (no-op outside browser). */
export function saveVisualDataToLocal(trajectories: (Line | null)[], colors?: Color[]): void {
    const snap = captureVisualData(trajectories, colors)
    if (!snap) return
    lsSet(VISUAL_SNAPSHOT_KEY, snap)
}

/** Load and apply visual data snapshot from localStorage if present. */
export function loadVisualDataFromLocal(targets: (Line | null)[], colors?: Color[]): boolean {
    const snap = lsGet<VisualDataSnapshot>(VISUAL_SNAPSHOT_KEY)
    if (!snap) return false
    applyVisualData(snap, targets, colors)
    return true
}

/** Clear visual data snapshot from localStorage if present. */
export function clearVisualDataInLocal(): void { lsRemove(VISUAL_SNAPSHOT_KEY) }
