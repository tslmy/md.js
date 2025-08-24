import { settings } from './control/settings.js'
import { init, ifMobileDevice } from './init.js'
import { toggle } from './control/panel.js'
import { saveToLocal, loadEngineFromLocal } from './engine/persistence/storage.js'
import { loadUserSettings, saveUserSettings } from './control/persistence/persist.js'
import { saveVisualDataToLocal, loadVisualDataFromLocal } from './visual/persistence/visual.js'
import * as THREE from 'three'
import { Particle } from './particleSystem.js'
// New SoA simulation core imports
import { createState, type SimulationState } from './core/simulation/state.js'
import type { Diagnostics } from './core/simulation/diagnostics.js'
// Experimental engine
import { SimulationEngine } from './engine/SimulationEngine.js'
import { fromSettings } from './engine/config/types.js'
import { initSettingsSync, pushSettingsToEngine, registerAutoPush, AUTO_PUSH_KEYS } from './engine/settingsSync.js'
import { InstancedArrows } from './visual/three/InstancedArrows.js'
import { InstancedSpheres } from './visual/three/InstancedSpheres.js'
import { Vector3 } from 'three'

// global variables
interface StereoEffectLike { render(scene: THREE.Scene, camera: THREE.Camera): void; setSize?(w: number, h: number): void }
interface ControlsLike { update(): void }
interface StatsLike { update(): void }
interface TemperaturePanelLike { update(t: number, max: number): void }

let camera: THREE.PerspectiveCamera
let scene: THREE.Scene
let renderer: THREE.WebGLRenderer
let effect: StereoEffectLike | undefined
let controls: ControlsLike | undefined
let temperaturePanel: TemperaturePanelLike
let stats: StatsLike
let maxTemperature = 0
// Legacy THREE.Points based sprite system removed (replaced by instanced spheres)
// (legacy particleSystem removed)
// New SoA simulation objects
let engine: SimulationEngine | undefined
let simState: SimulationState | undefined
let lastDiagnostics: Diagnostics | undefined
// Batched per-particle arrows (velocity = blue, force = red)
let velArrows: InstancedArrows | undefined
let forceArrows: InstancedArrows | undefined
let sphereMesh: InstancedSpheres | undefined
let sphereCloneMesh: InstancedSpheres | undefined

const particles: Particle[] = []
let time = 0
let lastSnapshotTime = 0

// Expose minimal state for headless smoke tests (non-production usage)
declare global {
  interface Window {
    __mdjs?: { particles: Particle[]; settings: typeof settings; simState?: SimulationState; diagnostics?: Diagnostics }
    __pauseEngine?: () => void
  }
}

/**
 * el: the DOM element you'd like to test for visibility.
 */
function isVisible(el: HTMLElement | null): boolean {
  return !!el && window.getComputedStyle(el).display !== 'none'
}

// Legacy force application removed in favor of SoA simulation core.

// Scaling now derives from diagnostics (maxSpeed & maxForceMag) avoiding per-frame full scans.
function updateScaleBars(diag: Diagnostics | undefined): void {
  if (!diag) return
  const forceScale = diag.maxForceMag > 0 ? settings.unitArrowLength / diag.maxForceMag : 1
  const velScale = diag.maxSpeed > 0 ? settings.unitArrowLength / diag.maxSpeed : 1
  const forceEl = document.getElementById('force')
  if (forceEl) forceEl.style.width = `${forceScale * 1000000}px`
  const velEl = document.getElementById('velocity')
  if (velEl) velEl.style.width = `${velScale * 1000000}px`
}

// ArrowHelpers removed; future instanced arrow system will centralize vector -> transform logic.

function updateTrajectoryBuffer(p: Particle, trajectory: THREE.BufferAttribute, maxLen: number): void {
  for (let j = 0; j < maxLen - 1; j++) trajectory.copyAt(j, trajectory, j + 1)
  trajectory.setXYZ(maxLen - 1, p.position.x, p.position.y, p.position.z)
  trajectory.needsUpdate = true
}

function updateHudRow(i: number, d: { mass: number; vx: number; vy: number; vz: number; fx: number; fy: number; fz: number; perForce?: Record<string, Float32Array> }): void {
  const row = document.querySelector<HTMLElement>(`#tabularInfo > tbody > tr:nth-child(${i + 1})`)
  if (!row) return
  const rnd = (v: number) => `${Math.round(v * 100) / 100}`
  const speed2 = d.vx * d.vx + d.vy * d.vy + d.vz * d.vz
  const speed = Math.sqrt(speed2)
  const forceMag = Math.hypot(d.fx, d.fy, d.fz)
  const set = (cls: string, val: string) => { const el = row.querySelector<HTMLElement>(cls); if (el) el.textContent = val }
  set('.speed', rnd(speed))
  set('.kineticEnergy', rnd(speed2 * d.mass * 0.5))
  set('.TotalForceStrength', rnd(forceMag))
  if (!d.perForce) return
  const classMap: Record<string, string> = {
    lennardJones: '.LJForceStrength',
    gravity: '.GravitationForceStrength',
    coulomb: '.CoulombForceStrength'
  }
  const i3 = 3 * i
  for (const [name, arr] of Object.entries(d.perForce)) {
    const cls = classMap[name]
    if (!cls) continue
    const mag = Math.hypot(arr[i3], arr[i3 + 1], arr[i3 + 2])
    set(cls, rnd(mag))
  }
}

const _tmpDir = new THREE.Vector3()
const _tmpFrom = new THREE.Vector3()

/** Update instanced velocity & force arrows with current SoA state & diagnostics-based scaling. */
function updateArrows(diag: Diagnostics, frameOffset: THREE.Vector3): void {
  if (!simState || !velArrows || !forceArrows) return
  const { positions, velocities, forces, N } = simState
  // Determine scales (unitArrowLength normalized against max mags) with safe fallbacks
  const velNorm = diag.maxSpeed > 0 ? settings.unitArrowLength / diag.maxSpeed : 1
  const forceNorm = diag.maxForceMag > 0 ? settings.unitArrowLength / diag.maxForceMag : 1
  const limit = settings.if_limitArrowsMaxLength
  const maxLen = settings.maxArrowLength
  const tmpOrigin = new THREE.Vector3()
  const tmpVec = new THREE.Vector3()
  for (let i = 0; i < N; i++) {
    const i3 = 3 * i
    // Skip escaped particles (render nothing = zero-length dir)
    if (simState.escaped && simState.escaped[i] === 1) {
      velArrows.update(i, tmpOrigin.set(0, -9999, 0), tmpVec.set(0, 0, 0), 0.000001)
      forceArrows.update(i, tmpOrigin.set(0, -9999, 0), tmpVec.set(0, 0, 0), 0.000001)
      continue
    }
    const px = positions[i3] - frameOffset.x
    const py = positions[i3 + 1] - frameOffset.y
    const pz = positions[i3 + 2] - frameOffset.z
    tmpOrigin.set(px, py, pz)
    // Velocity vector
    tmpVec.set(velocities[i3], velocities[i3 + 1], velocities[i3 + 2])
    let vLen = tmpVec.length() * velNorm
    if (limit && vLen > maxLen) { vLen = maxLen }
    // Update velocity arrow (dir is velocity; scaled length vLen)
    velArrows.update(i, tmpOrigin, tmpVec, vLen)
    // Force vector
    tmpVec.set(forces[i3], forces[i3 + 1], forces[i3 + 2])
    let fLen = tmpVec.length() * forceNorm
    if (limit && fLen > maxLen) { fLen = maxLen }
    forceArrows.update(i, tmpOrigin, tmpVec, fLen)
  }
}

function updateFromSimulation(frameOffset: THREE.Vector3): void {
  if (!engine || !simState) return
  const hudVisible = isVisible(document.querySelector('#hud'))
  const needsTrajectoryShift = settings.if_showTrajectory && (time - lastSnapshotTime > settings.dt)
  const perForce = engine.getPerForceContributions()
  for (let i = 0; i < particles.length; i++) updateOneParticle(i, hudVisible, needsTrajectoryShift, frameOffset, perForce)
  if (sphereMesh && simState) updateSpheres(frameOffset)
}

function updateOneParticle(i: number, hudVisible: boolean, needsTrajectoryShift: boolean, frameOffset: THREE.Vector3, perForce: Record<string, Float32Array>): void {
  if (!simState) return
  const { positions, velocities, forces, masses } = simState
  const p = particles[i]
  // Prefer authoritative escaped flag from core state over legacy per-Particle flag.
  if (simState.escaped && simState.escaped[i] === 1) return
  const i3 = 3 * i
  let px = positions[i3] - frameOffset.x
  let py = positions[i3 + 1] - frameOffset.y
  let pz = positions[i3 + 2] - frameOffset.z
  // We'll update p.position after applying frame offset / PBC so tests & UI see displayed coordinates.
  const trajectoryAttr = (settings.if_showTrajectory && p.trajectory)
    ? p.trajectory.geometry.getAttribute('position') as THREE.BufferAttribute
    : null
  if (settings.if_use_periodic_boundary_condition) {
    _tmpDir.set(px, py, pz)
    applyPbc(_tmpDir, trajectoryAttr, settings.maxTrajectoryLength, settings.spaceBoundaryX, settings.spaceBoundaryY, settings.spaceBoundaryZ)
    px = _tmpDir.x; py = _tmpDir.y; pz = _tmpDir.z
    // position updated in particle only; point sprite removed
  }
  if (trajectoryAttr && needsTrajectoryShift) updateTrajectoryBuffer({ position: _tmpFrom.set(px, py, pz) } as Particle, trajectoryAttr, settings.maxTrajectoryLength)
  const vx = velocities[i3], vy = velocities[i3 + 1], vz = velocities[i3 + 2]
  const fx = forces[i3], fy = forces[i3 + 1], fz = forces[i3 + 2]
  // Mirror final (display) position for tests & capture
  p.position.set(px, py, pz)
  if (hudVisible) updateHudRow(i, { mass: masses[i] || 1, vx, vy, vz, fx, fy, fz, perForce })
}

function updateSpheres(frameOffset: THREE.Vector3): void {
  if (!simState || !sphereMesh) return
  renderPrimarySpheres(frameOffset)
  renderCloneSpheres(frameOffset)
}

function renderPrimarySpheres(frameOffset: THREE.Vector3): void {
  if (!simState || !sphereMesh) return
  const { positions, masses, N, escaped } = simState
  const tmpPos = new THREE.Vector3()
  for (let i = 0; i < N; i++) {
    if (escaped && escaped[i] === 1) { sphereMesh.update(i, tmpPos.set(0, -9999, 0), 0.0001, new THREE.Color(0x333333)); continue }
    const i3 = 3 * i
    tmpPos.set(positions[i3] - frameOffset.x, positions[i3 + 1] - frameOffset.y, positions[i3 + 2] - frameOffset.z)
    const m = masses[i] || 1
    const radius = 0.08 * Math.cbrt(m / 10)
    sphereMesh.update(i, tmpPos, radius, particles[i]?.color || new THREE.Color(0xffffff))
  }
  sphereMesh.commit()
}

function renderCloneSpheres(frameOffset: THREE.Vector3): void {
  if (!simState || !sphereCloneMesh) return
  const visible = settings.if_use_periodic_boundary_condition
  sphereCloneMesh.setVisible(visible)
  if (!visible) return
  const { positions, masses, N, escaped } = simState
  const cloneOffsets = makeClonePositionsList(settings.spaceBoundaryX, settings.spaceBoundaryY, settings.spaceBoundaryZ)
  const clonePos = new THREE.Vector3()
  let baseIndex = 0
  for (const offset of cloneOffsets) {
    for (let i = 0; i < N; i++) {
      if (escaped && escaped[i] === 1) { sphereCloneMesh.update(baseIndex + i, clonePos.set(0, -9999, 0), 0.0001, new THREE.Color(0x333333)); continue }
      const i3 = 3 * i
      clonePos.set(
        positions[i3] - frameOffset.x + offset.x,
        positions[i3 + 1] - frameOffset.y + offset.y,
        positions[i3 + 2] - frameOffset.z + offset.z
      )
      const m = masses[i] || 1
      const radius = 0.08 * Math.cbrt(m / 10)
      sphereCloneMesh.update(baseIndex + i, clonePos, radius, particles[i]?.color || new THREE.Color(0xffffff))
    }
    baseIndex += N
  }
  sphereCloneMesh.commit()
}

// Removed legacy applyParticleVisualUpdate; loop logic in updateFromSimulation now works directly off SoA arrays.

function applyPbc(pos: THREE.Vector3, trajectory: THREE.BufferAttribute | null, maxLen: number, bx: number, by: number, bz: number): void {
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

/**
 * Advance simulation one timestep and update visual + diagnostic layers.
 * Split from animate() to keep the frame logic testable and reduce complexity warnings.
 */
function applyVisualUpdates(): void {
  updateScaleBars(lastDiagnostics)
  const frameOffset = computeFrameOffset()
  updateFromSimulation(frameOffset)
  // Update / toggle arrows after particle positions refreshed
  if (settings.if_showArrows && velArrows && forceArrows && simState && lastDiagnostics) {
    updateArrows(lastDiagnostics, frameOffset)
    velArrows.setVisible(true); forceArrows.setVisible(true)
    velArrows.commit(); forceArrows.commit()
  } else {
    if (velArrows) velArrows.setVisible(false)
    if (forceArrows) forceArrows.setVisible(false)
  }
  if (settings.if_showTrajectory && time - lastSnapshotTime > settings.dt) lastSnapshotTime = time
  // Temperature from diagnostics (fallback to 0 if undefined) & track peak
  if (lastDiagnostics) {
    const T = lastDiagnostics.temperature
    if (T > maxTemperature) maxTemperature = T
    temperaturePanel.update(T, maxTemperature)
  }
  update(); render(renderer, effect); stats.update()
}

/**
 * Determine the frame offset based on the selected reference frame mode.
 *  - fixed: origin remains at (0,0,0)
 *  - sun: subtract position of particle 0
 *  - com: subtract instantaneous center-of-mass (translational DOF removal)
 */
function computeFrameOffset(): THREE.Vector3 {
  if (!simState) return new THREE.Vector3(0, 0, 0)
  if (settings.referenceFrameMode === 'sun' && simState.N > 0) {
    return new THREE.Vector3(simState.positions[0], simState.positions[1], simState.positions[2])
  }
  if (settings.referenceFrameMode === 'com') {
    const { masses, positions, N } = simState
    let mx = 0, my = 0, mz = 0, mTot = 0
    for (let i = 0; i < N; i++) {
      const i3 = 3 * i; const m = masses[i] || 1
      mx += m * positions[i3]; my += m * positions[i3 + 1]; mz += m * positions[i3 + 2]; mTot += m
    }
    if (mTot > 0) return new THREE.Vector3(mx / mTot, my / mTot, mz / mTot)
  }
  return new THREE.Vector3(0, 0, 0)
}


function update(): void {
  // (removed stale resize comment)
  camera.updateProjectionMatrix()
  if (controls) controls.update()
}

function render(renderer: THREE.WebGLRenderer, effect: StereoEffectLike | undefined): void {
  if (ifMobileDevice && effect) {
    effect.render(scene, camera)
  } else {
    renderer.render(scene, camera)
  }
}

// when document is ready:
// Source: https://stackoverflow.com/a/9899701/1147061
function docReady(fn: () => void): void {
  // see if DOM is already available
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    // call on next available tick
    setTimeout(fn, 1)
  } else {
    document.addEventListener('DOMContentLoaded', fn)
  }
}
docReady(() => {
  console.log('Ready.')

  // Attempt to hydrate engine first (if snapshot present) BEFORE building visual particle system.
  // Load persisted user settings first so fresh world uses them if no snapshot.
  loadUserSettings()
  const loaded = loadEngineFromLocal()
  if (loaded) {
    engine = loaded.engine
    // Mirror loaded config into settings (best-effort) – future: migrate settings <-> engine properly.
    settings.particleCount = loaded.snapshot.config.world.particleCount
    settings.spaceBoundaryX = loaded.snapshot.config.world.box.x
    settings.spaceBoundaryY = loaded.snapshot.config.world.box.y
    settings.spaceBoundaryZ = loaded.snapshot.config.world.box.z
    settings.dt = loaded.snapshot.config.runtime.dt
    settings.cutoffDistance = loaded.snapshot.config.runtime.cutoff
    time = loaded.snapshot.time
    // Trajectories persisted separately (visual aid) – defer restore after visuals ready.
  }

  const values = init(settings, particles)
  scene = values[0]
  // values[1] was a legacy placeholder (always null) – removed
  camera = values[2]
  renderer = values[3]
  controls = values[4]
  stats = values[5]
  temperaturePanel = values[6]
  effect = values[7]

  if (!engine) {
    // Fresh run: construct engine from particles
    simState = createState({
      particleCount: settings.particleCount,
      box: { x: settings.spaceBoundaryX, y: settings.spaceBoundaryY, z: settings.spaceBoundaryZ },
      dt: settings.dt,
      cutoff: settings.cutoffDistance
    })
    for (let i = 0; i < particles.length; i++) {
      const i3 = 3 * i
      simState.positions[i3] = particles[i].position.x
      simState.positions[i3 + 1] = particles[i].position.y
      simState.positions[i3 + 2] = particles[i].position.z
      simState.masses[i] = particles[i].mass
      simState.charges[i] = particles[i].charge
    }
    engine = new SimulationEngine(fromSettings(settings))
    engine.seed({ positions: simState.positions, velocities: simState.velocities, masses: simState.masses, charges: simState.charges })
    simState = engine.getState()
    initSettingsSync(engine)
    // Auto-push: wrap selected mutable settings with setters triggering engine.updateConfig
    registerAutoPush(engine, AUTO_PUSH_KEYS)
  } else {
    simState = engine.getState()
    initSettingsSync(engine)
    registerAutoPush(engine, AUTO_PUSH_KEYS)
  }
  engine.on('frame', ({ time: t }) => { time = t; applyVisualUpdates() })
  engine.on('diagnostics', (d) => { lastDiagnostics = d; if (window.__mdjs) window.__mdjs.diagnostics = d })
  engine.run({ useRaf: true })
  // Create arrow visualizers once state & scene are ready
  if (simState) {
    velArrows = new InstancedArrows(simState.N, { color: 0x0066ff })
    forceArrows = new InstancedArrows(simState.N, { color: 0xff3300 })
    velArrows.addTo(scene); forceArrows.addTo(scene)
    velArrows.setVisible(settings.if_showArrows)
    forceArrows.setVisible(settings.if_showArrows)
    sphereMesh = new InstancedSpheres(simState.N, { baseRadius: 0.1 })
    sphereMesh.addTo(scene)
    // Clone spheres (26 neighbor cells)
    const cloneOffsets = makeClonePositionsList(settings.spaceBoundaryX, settings.spaceBoundaryY, settings.spaceBoundaryZ)
    sphereCloneMesh = new InstancedSpheres(simState.N * cloneOffsets.length, { baseRadius: 0.1 })
    sphereCloneMesh.addTo(scene)
    // Hide any legacy point-sprite based objects (main + periodic clones) to avoid lingering dots.
    scene.traverse(obj => { if ((obj as unknown as { isPoints?: boolean }).isPoints) obj.visible = false })
    // Initialize sphere transforms/colors immediately
    updateSpheres(new THREE.Vector3(0, 0, 0))
    // Restore visual trajectories if present
    loadVisualDataFromLocal(particles)
  }
  // Expose handle for automated headless tests
  // Expose simulation state (read-only for tests; mutation not supported outside test harness)
  window.__mdjs = { particles, settings, simState, diagnostics: lastDiagnostics }
  window.__pauseEngine = () => { engine?.pause() }
  // Install full-state persistence handler (overrides placeholder in init.js)
  window.onbeforeunload = () => {
    try { saveUserSettings() } catch { /* ignore */ }
    if (engine) {
      // Collect trajectory buffers (if any) for persistence
      if (settings.if_showTrajectory) { saveVisualDataToLocal(particles) }
      saveToLocal(engine)
    }
  }
  // bind keyboard event:
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      toggle('#hud')
    }
    if (e.key === 'p') { // quick dev key: push current settings to engine
      if (engine) pushSettingsToEngine(engine)
    }
  })
})
function makeClonePositionsList(
  x: number,
  y: number,
  z: number
): Vector3[] {
  return [
    new Vector3(2 * x, 0, 0),
    new Vector3(-2 * x, 0, 0),
    new Vector3(0, 2 * y, 0),
    new Vector3(0, -2 * y, 0),
    new Vector3(0, 0, 2 * z),
    new Vector3(0, 0, -2 * z),
    new Vector3(2 * x, 0, 2 * z),
    new Vector3(-2 * x, 0, 2 * z),
    new Vector3(2 * x, 0, -2 * z),
    new Vector3(-2 * x, 0, -2 * z),
    new Vector3(0, 2 * y, 2 * z),
    new Vector3(0, -2 * y, 2 * z),
    new Vector3(0, 2 * y, -2 * z),
    new Vector3(0, -2 * y, -2 * z),
    new Vector3(2 * x, 2 * y, 0),
    new Vector3(-2 * x, 2 * y, 0),
    new Vector3(2 * x, -2 * y, 0),
    new Vector3(-2 * x, -2 * y, 0),
    new Vector3(2 * x, 2 * y, 2 * z),
    new Vector3(-2 * x, 2 * y, 2 * z),
    new Vector3(2 * x, -2 * y, 2 * z),
    new Vector3(-2 * x, -2 * y, 2 * z),
    new Vector3(2 * x, 2 * y, -2 * z),
    new Vector3(-2 * x, 2 * y, -2 * z),
    new Vector3(2 * x, -2 * y, -2 * z),
    new Vector3(-2 * x, -2 * y, -2 * z)
  ]
}
