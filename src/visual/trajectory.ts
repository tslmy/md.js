import { Vector3, Line, Color, BufferAttribute, Scene } from 'three'
import { newTrajectory } from './drawingHelpers.js'
import { settings } from '../control/settings.js'
import type { SimulationState } from '../core/simulation/state.js'

/**
 * Array storing per-particle trajectory Line objects (index-aligned with particles).
 * Entries stay allocated (possibly null) across toggles so indices remain stable.
 */
export const trajectories: (Line | null)[] = []
let lastSnapshotTime = 0

/**
 * Return true if it's time to append a new point to each trajectory buffer.
 * Gate condition: feature enabled AND dt has elapsed since the last snapshot.
 */
export function shouldShiftTrajectory(currentTime: number): boolean {
    return settings.if_showTrajectory && (currentTime - lastSnapshotTime > settings.dt)
}

/** Record the time at which we last appended trajectory points. */
export function markTrajectorySnapshot(t: number): void {
    lastSnapshotTime = t
}

/**
 * Ensure the trajectory placeholders exist and (re)create / toggle visibility
 * according to the current settings flag. Creation is lazy & idempotent.
 */
export function ensureTrajectories(state: SimulationState, colors: Color[], scene: Scene): void {
    allocatePlaceholders(state)
    if (settings.if_showTrajectory) showAndCreate(state, colors, scene)
    else hideAll()
}

/** Allocate null placeholders once so indices remain stable through feature toggles. */
function allocatePlaceholders(state: SimulationState): void {
    if (trajectories.length !== 0) return
    for (let i = 0; i < state.N; i++) trajectories.push(null)
}

/** Create missing Line objects (if any) and mark all trajectories visible. */
function showAndCreate(state: SimulationState, colors: Color[], scene: Scene): void {
    for (let i = 0; i < state.N; i++) {
        trajectories[i] ??= newTrajectory(i, state.positions, colors, scene, settings.maxTrajectoryLength)
        const line = trajectories[i]
        if (line) line.visible = true
    }
}

/** Hide (but do not dispose) all existing trajectory lines. */
function hideAll(): void {
    for (const t of trajectories) { if (t) t.visible = false }
}


/**
 * Append the newest position to a fixed-length buffer by shifting existing
 * entries left one slot (simple O(n) ring substitute given modest lengths).
 */
export function updateTrajectoryBuffer(pos: Vector3, trajectory: BufferAttribute, maxLen: number): void {
    for (let j = 0; j < maxLen - 1; j++) trajectory.copyAt(j, trajectory, j + 1)
    trajectory.setXYZ(maxLen - 1, pos.x, pos.y, pos.z)
    trajectory.needsUpdate = true
}
