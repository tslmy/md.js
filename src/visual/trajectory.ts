import { Vector3, Line, Color, BufferAttribute, Scene } from 'three'
import { makeTrajectory } from './drawingHelpers.js'
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
        trajectories[i] ??= buildTrajectory(i, state, colors, scene)
        const line = trajectories[i]
        if (line) line.visible = true
    }
}

/** Hide (but do not dispose) all existing trajectory lines. */
function hideAll(): void {
    for (const t of trajectories) { if (t) t.visible = false }
}

/** Build a new single-particle trajectory line object and add it to the scene. */
function buildTrajectory(i: number, state: SimulationState, colors: Color[], scene: Scene): Line {
    const i3 = 3 * i
    const pos = new Vector3(state.positions[i3], state.positions[i3 + 1], state.positions[i3 + 2])
    const color = colors[i] || new Color(0xffffff)
    const line = makeTrajectory(color, pos, settings.maxTrajectoryLength)
    scene.add(line)
    return line
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

/**
 * Apply periodic boundary conditions to a position. If a trajectory buffer is
 * provided, shift its historical coordinates by the same wrapped displacement
 * to keep the rendered path continuous visually across wraps.
 */
export function applyPbc(pos: Vector3, trajectory: BufferAttribute | null, maxLen: number, bx: number, by: number, bz: number): void {
    const wrapAxis = (axis: 'x' | 'y' | 'z', boundary: number, adjust: (delta: number) => void) => {
        while (pos[axis] < -boundary) { pos[axis] += 2 * boundary; adjust(2 * boundary) }
        while (pos[axis] > boundary) { pos[axis] -= 2 * boundary; adjust(-2 * boundary) }
    }
    const adjustFactory = (setter: (i: number, v: number) => void, getter: (i: number) => number) => (delta: number) => {
        if (!trajectory) return
        for (let j = 0; j < maxLen; j++) setter(j, getter(j) + delta)
        trajectory.needsUpdate = true
    }
    wrapAxis('x', bx, adjustFactory((i, v) => trajectory?.setX(i, v), i => trajectory?.getX(i) ?? 0))
    wrapAxis('y', by, adjustFactory((i, v) => trajectory?.setY(i, v), i => trajectory?.getY(i) ?? 0))
    wrapAxis('z', bz, adjustFactory((i, v) => trajectory?.setZ(i, v), i => trajectory?.getZ(i) ?? 0))
}
