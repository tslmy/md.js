import { settings } from './control/settings.js'
import { init, ifMobileDevice } from './init.js'
import { toggle } from './control/panel.js'
import { saveToLocal, loadEngineFromLocal } from './engine/persist.js'
import { loadSettingsFromLocal, saveSettingsToLocal } from './control/persist.js'
import { saveVisualDataToLocal, loadVisualDataFromLocal } from './visual/persist.js'
import { Scene, Camera, PerspectiveCamera, WebGLRenderer, Color, Vector3, BufferAttribute } from 'three'
// New SoA simulation core imports
import { createState, seedInitialState, type SimulationState } from './core/simulation/state.js'
import { generateMassesCharges, generatePositions } from './core/simulation/seeding.js'
import type { Diagnostics } from './core/simulation/diagnostics.js'
// Experimental engine
import { SimulationEngine } from './engine/SimulationEngine.js'
import { fromSettings } from './engine/config/types.js'
import { initSettingsSync, pushSettingsToEngine, registerAutoPush, AUTO_PUSH_KEYS } from './engine/settingsSync.js'
import { InstancedSpheres } from './visual/InstancedSpheres.js'
import { trajectories, ensureTrajectories, shouldShiftTrajectory, markTrajectorySnapshot, updateTrajectoryBuffer, applyPbc } from './visual/trajectory.js'
import { createArrows, updateScaleBars, finalizeArrows, type ArrowSet } from './visual/arrows.js'
import { getHud } from './visual/coloringAndDataSheet.js'
import { computeCircularOrbitVelocity } from './core/simulation/orbitInit.js'

// global variables
interface StereoEffectLike { render(scene: Scene, camera: Camera): void; setSize?(w: number, h: number): void }
interface ControlsLike { update(): void }
interface StatsLike { update(): void }
interface TemperaturePanelLike { update(t: number, max: number): void }

let camera: PerspectiveCamera
let scene: Scene
let renderer: WebGLRenderer
let effect: StereoEffectLike | undefined
let controls: ControlsLike | undefined
let temperaturePanel: TemperaturePanelLike
let stats: StatsLike
let maxTemperature = 0
// New SoA simulation objects
let engine: SimulationEngine | undefined
let simState: SimulationState | undefined
let lastDiagnostics: Diagnostics | undefined
// Batched per-particle arrows managed via arrows module
let arrows: ArrowSet | undefined
let sphereMesh: InstancedSpheres | undefined
let sphereCloneMesh: InstancedSpheres | undefined

// Array of per-particle colors.
const colors: Color[] = []
// Trajectories managed in visual/trajectory.ts
let time = 0

// Expose minimal state for headless smoke tests (non-production usage)
declare global { interface Window { __mdjs?: { colors: Color[]; settings: typeof settings; simState?: SimulationState; diagnostics?: Diagnostics }; __pauseEngine?: () => void } }

/**
 * el: the DOM element you'd like to test for visibility.
 */
function isVisible(el: HTMLElement | null): boolean {
  return !!el && window.getComputedStyle(el).display !== 'none'
}


const _tmpDir = new Vector3()
const _tmpFrom = new Vector3()


function updateFromSimulation(frameOffset: Vector3): void {
  if (!engine || !simState) return
  const hudVisible = isVisible(document.querySelector('#hud'))
  const needsTrajectoryShift = shouldShiftTrajectory(time)
  const perForce = engine.getPerForceContributions()
  for (let i = 0; i < colors.length; i++) updateOneParticle(i, hudVisible, needsTrajectoryShift, frameOffset, perForce)
  if (sphereMesh && simState) updateSpheres(frameOffset)
}

function updateOneParticle(i: number, hudVisible: boolean, needsTrajectoryShift: boolean, frameOffset: Vector3, perForce: Record<string, Float32Array>): void {
  if (!simState) return
  const { positions, velocities, forces, masses, charges } = simState
  // Prefer authoritative escaped flag from core state over legacy per-Particle flag.
  if (simState.escaped && simState.escaped[i] === 1) return
  const i3 = 3 * i
  let px = positions[i3] - frameOffset.x
  let py = positions[i3 + 1] - frameOffset.y
  let pz = positions[i3 + 2] - frameOffset.z
  // We'll update p.position after applying frame offset / PBC so tests & UI see displayed coordinates.
  const traj = settings.if_showTrajectory ? trajectories[i] : null
  const trajectoryAttr = (settings.if_showTrajectory && traj)
    ? traj.geometry.getAttribute('position') as BufferAttribute
    : null
  if (settings.if_use_periodic_boundary_condition) {
    _tmpDir.set(px, py, pz)
    applyPbc(_tmpDir, trajectoryAttr, settings.maxTrajectoryLength, settings.spaceBoundaryX, settings.spaceBoundaryY, settings.spaceBoundaryZ)
    px = _tmpDir.x; py = _tmpDir.y; pz = _tmpDir.z
    // position updated in particle only; point sprite removed
  }
  if (trajectoryAttr && needsTrajectoryShift) updateTrajectoryBuffer(_tmpFrom.set(px, py, pz), trajectoryAttr, settings.maxTrajectoryLength)
  const vx = velocities[i3], vy = velocities[i3 + 1], vz = velocities[i3 + 2]
  const fx = forces[i3], fy = forces[i3 + 1], fz = forces[i3 + 2]
  // Store final (display) position for tests & capture
  // (no longer caching display-space positions)
  if (hudVisible) getHud()?.update(i, { mass: masses[i] || 1, charge: charges[i] || 0, vx, vy, vz, fx, fy, fz, perForce })
}

function updateSpheres(frameOffset: Vector3): void {
  if (!simState || !sphereMesh) return
  renderPrimarySpheres(frameOffset)
  renderCloneSpheres(frameOffset)
}

function renderPrimarySpheres(frameOffset: Vector3): void {
  if (!simState || !sphereMesh) return
  const { positions, masses, N, escaped } = simState
  const tmpPos = new Vector3()
  for (let i = 0; i < N; i++) {
    if (escaped && escaped[i] === 1) { sphereMesh.update(i, tmpPos.set(0, -9999, 0), 0.0001, new Color(0x333333)); continue }
    const i3 = 3 * i
    tmpPos.set(positions[i3] - frameOffset.x, positions[i3 + 1] - frameOffset.y, positions[i3 + 2] - frameOffset.z)
    const m = masses[i] || 1
    const radius = 0.08 * Math.cbrt(m / 10)
    sphereMesh.update(i, tmpPos, radius, colors[i] || new Color(0xffffff))
  }
  sphereMesh.commit()
}

function renderCloneSpheres(frameOffset: Vector3): void {
  if (!simState || !sphereCloneMesh) return
  const visible = settings.if_use_periodic_boundary_condition
  sphereCloneMesh.setVisible(visible)
  if (!visible) return
  const { positions, masses, N, escaped } = simState
  const cloneOffsets = makeClonePositionsList(settings.spaceBoundaryX, settings.spaceBoundaryY, settings.spaceBoundaryZ)
  const clonePos = new Vector3()
  let baseIndex = 0
  for (const offset of cloneOffsets) {
    for (let i = 0; i < N; i++) {
      if (escaped && escaped[i] === 1) { sphereCloneMesh.update(baseIndex + i, clonePos.set(0, -9999, 0), 0.0001, new Color(0x333333)); continue }
      const i3 = 3 * i
      clonePos.set(
        positions[i3] - frameOffset.x + offset.x,
        positions[i3 + 1] - frameOffset.y + offset.y,
        positions[i3 + 2] - frameOffset.z + offset.z
      )
      const m = masses[i] || 1
      const radius = 0.08 * Math.cbrt(m / 10)
      sphereCloneMesh.update(baseIndex + i, clonePos, radius, colors[i] || new Color(0xffffff))
    }
    baseIndex += N
  }
  sphereCloneMesh.commit()
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
  if (arrows) finalizeArrows(arrows, simState, lastDiagnostics, frameOffset)
  if (shouldShiftTrajectory(time)) markTrajectorySnapshot(time)
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
function computeFrameOffset(): Vector3 {
  if (!simState) return new Vector3(0, 0, 0)
  if (settings.referenceFrameMode === 'sun' && simState.N > 0) {
    return new Vector3(simState.positions[0], simState.positions[1], simState.positions[2])
  }
  if (settings.referenceFrameMode === 'com') {
    const { masses, positions, N } = simState
    let mx = 0, my = 0, mz = 0, mTot = 0
    for (let i = 0; i < N; i++) {
      const i3 = 3 * i; const m = masses[i] || 1
      mx += m * positions[i3]; my += m * positions[i3 + 1]; mz += m * positions[i3 + 2]; mTot += m
    }
    if (mTot > 0) return new Vector3(mx / mTot, my / mTot, mz / mTot)
  }
  return new Vector3(0, 0, 0)
}


function update(): void {
  // (removed stale resize comment)
  camera.updateProjectionMatrix()
  if (controls) controls.update()
}

function render(renderer: WebGLRenderer, effect: StereoEffectLike | undefined): void {
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
  loadSettingsFromLocal()
  const loaded = loadEngineFromLocal()
  if (loaded) {
    console.log('Engine loaded from localStorage.')
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

  const values = init(settings, colors)
  scene = values[0]
  // values[1] was a legacy placeholder (always null) – removed
  camera = values[2]
  renderer = values[3]
  controls = values[4]
  stats = values[5]
  temperaturePanel = values[6]
  effect = values[7]

  if (!engine) {
    console.log('No engine found, creating a new one.')
    // Fresh run: construct engine from particles
    simState = createState({
      particleCount: settings.particleCount,
      box: { x: settings.spaceBoundaryX, y: settings.spaceBoundaryY, z: settings.spaceBoundaryZ },
      dt: settings.dt,
      cutoff: settings.cutoffDistance
    })
    // Reintroduce randomized mass / charge seeding (core SoA ownership)
    const { masses: seedMasses, charges: seedCharges } = generateMassesCharges({
      N: simState.N,
      massLower: settings.massLowerBound,
      massUpper: settings.massUpperBound,
      chargeOptions: settings.availableCharges,
      sunMass: settings.sunMass,
      makeSun: settings.if_makeSun
    })
    const seedPositions = generatePositions({
      N: simState.N,
      bounds: { x: settings.spaceBoundaryX, y: settings.spaceBoundaryY, z: settings.spaceBoundaryZ },
      makeSun: settings.if_makeSun
    })
    seedInitialState(simState, { positions: seedPositions, masses: seedMasses, charges: seedCharges })
    // If a central "sun" is requested, assign approximate circular orbit velocities
    // for all other particles instead of leaving them at rest. This reduces the
    // extreme radial infall + sling ejection that occurs when starting from zero
    // velocity near a 1/r^2 singular attraction.
    if (settings.if_makeSun && simState.N > 1) {
      console.log('Seeding circular orbit velocities for particles.')
      const Msun = simState.masses[0] || settings.sunMass || 1
      const G = settings.G
      const pos = simState.positions
      const vel = simState.velocities
      for (let i = 1; i < simState.N; i++) {
        const i3 = 3 * i
        const { vx, vy, vz } = computeCircularOrbitVelocity(pos[i3], pos[i3 + 1], pos[i3 + 2], Msun, G)
        vel[i3] = vx; vel[i3 + 1] = vy; vel[i3 + 2] = vz
      }
    }
    engine = new SimulationEngine(fromSettings(settings))
    engine.seed({ positions: simState.positions, velocities: simState.velocities, masses: simState.masses, charges: simState.charges })
  }
  simState = engine.getState()
  initSettingsSync(engine)
  // Auto-push: wrap selected mutable settings with setters triggering engine.updateConfig
  registerAutoPush(engine, AUTO_PUSH_KEYS)
  engine.on('frame', ({ time: t }) => { time = t; applyVisualUpdates() })
  engine.on('diagnostics', (d) => { lastDiagnostics = d; if (window.__mdjs) window.__mdjs.diagnostics = d })
  engine.run({ useRaf: true })
  // Create arrow visualizers once state & scene are ready
  if (simState) {
    // Ensure trajectories created/hidden per settings
    ensureTrajectories(simState, colors, scene)
    arrows = createArrows(simState.N, scene)
    sphereMesh = new InstancedSpheres(simState.N, { baseRadius: 0.1 })
    sphereMesh.addTo(scene)
    // Clone spheres (26 neighbor cells)
    const cloneOffsets = makeClonePositionsList(settings.spaceBoundaryX, settings.spaceBoundaryY, settings.spaceBoundaryZ)
    sphereCloneMesh = new InstancedSpheres(simState.N * cloneOffsets.length, { baseRadius: 0.1 })
    sphereCloneMesh.addTo(scene)
    // Hide any legacy point-sprite based objects (main + periodic clones) to avoid lingering dots.
    scene.traverse(obj => { if ((obj as unknown as { isPoints?: boolean }).isPoints) obj.visible = false })
    // Initialize sphere transforms/colors immediately
    updateSpheres(new Vector3(0, 0, 0))
    // Attempt to restore persisted visual data (colors always; trajectories only if enabled)
    loadVisualDataFromLocal(settings.if_showTrajectory ? trajectories : [], colors)
  }
  // Expose handle for automated headless tests
  // Expose simulation state (read-only for tests; mutation not supported outside test harness)
  window.__mdjs = { colors: colors, settings, simState, diagnostics: lastDiagnostics }
  window.__pauseEngine = () => { engine?.pause() }
  // Install full-state persistence handler (overrides placeholder in init.js)
  window.onbeforeunload = () => {
    try { saveSettingsToLocal() } catch { /* ignore */ }
    if (engine) {
      // Collect trajectory buffers (if any) for persistence
      // Always persist colors (and trajectories if present) regardless of toggle state
      saveVisualDataToLocal(trajectories, colors)
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
