import { settings } from './settings.js'
import { init, ifMobileDevice, toggle } from './init.js'
import { saveState } from './stateStorage.js'
import type { SavedState } from './stateStorage.js'
import * as THREE from 'three'
import { Particle } from './particleSystem.js'
// New SoA simulation core imports
import { createState, type SimulationState } from './core/simulation/state.js'
import { Simulation } from './core/simulation/Simulation.js'
import { VelocityVerlet } from './core/simulation/integrators.js'
import { LennardJones } from './core/forces/lennardJones.js'
import { Gravity } from './core/forces/gravity.js'
import { Coulomb } from './core/forces/coulomb.js'
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
let particleSystem: THREE.Points | undefined
// New SoA simulation objects
let simulation: Simulation | undefined
let simState: SimulationState | undefined

const particles: Particle[] = []
let time = 0
let lastSnapshotTime = 0

// Expose minimal state for headless smoke tests (non-production usage)
declare global {
  interface Window { __mdjs?: { particles: Particle[]; settings: typeof settings; simState?: SimulationState } }
}

/**
 * el: the DOM element you'd like to test for visibility.
 */
function isVisible(el: HTMLElement | null): boolean {
  return !!el && window.getComputedStyle(el).display !== 'none'
}

// Legacy force application removed in favor of SoA simulation core.

function rescaleForceScaleBar(particles: Particle[]): number {
  const forceStrengths: number[] = particles.filter(particle => !particle.isEscaped).map(particle => particle.force.length())
  const highestForceStrengthPresent = Math.max(...forceStrengths)
  const arrowScaleForForces = settings.unitArrowLength / highestForceStrengthPresent
  const forceEl = document.getElementById('force')
  if (forceEl) forceEl.style.width = `${arrowScaleForForces * 1000000}px`
  return arrowScaleForForces
}

function rescaleVelocityScaleBar(particles: Particle[]): number {
  const speeds: number[] = particles.filter(particle => !particle.isEscaped).map(particle => particle.velocity.length())
  const highestSpeedPresent = Math.max(...speeds)
  const arrowScaleForVelocities =
    settings.unitArrowLength / highestSpeedPresent
  const velEl = document.getElementById('velocity')
  if (velEl) velEl.style.width = `${arrowScaleForVelocities * 1000000}px`
  return arrowScaleForVelocities
}

// Helpers to reduce complexity
function updateArrowHelper(arrow: THREE.ArrowHelper, from: THREE.Vector3, vector: THREE.Vector3, scale: number): void {
  const lengthToScale = settings.if_proportionate_arrows_with_vectors ? vector.length() * scale : settings.unitArrowLength
  arrow.setLength(
    settings.if_limitArrowsMaxLength && lengthToScale > settings.maxArrowLength
      ? settings.maxArrowLength
      : lengthToScale
  )
  arrow.position.copy(from)
  const dir = vector.lengthSq() === 0 ? _unitX : _tmpDir.copy(vector).normalize()
  arrow.setDirection(dir)
}

function updateTrajectoryBuffer(p: Particle, trajectory: THREE.BufferAttribute, maxLen: number): void {
  for (let j = 0; j < maxLen - 1; j++) trajectory.copyAt(j, trajectory, j + 1)
  trajectory.setXYZ(maxLen - 1, p.position.x, p.position.y, p.position.z)
  trajectory.needsUpdate = true
}

function updateHudRow(i: number, p: Particle): void {
  const thisSpeed = p.velocity.length()
  const row = document.querySelector<HTMLElement>(`#tabularInfo > tbody > tr:nth-child(${i + 1})`)
  if (!row) return
  const speedEl = row.querySelector<HTMLElement>('.speed'); if (speedEl) speedEl.textContent = `${Math.round(thisSpeed * 100) / 100}`
  const keEl = row.querySelector<HTMLElement>('.kineticEnergy'); if (keEl) keEl.textContent = `${Math.round(thisSpeed * thisSpeed * p.mass * 50) / 100}`
  const tfEl = row.querySelector<HTMLElement>('.TotalForceStrength'); if (tfEl) tfEl.textContent = `${Math.round(p.force.length() * 100) / 100}`
}

const _tmpDir = new THREE.Vector3()
const _unitX = new THREE.Vector3(1, 0, 0)

function updateFromSimulation(arrowScaleForForces: number, arrowScaleForVelocities: number, frameOffset: THREE.Vector3): void {
  if (!simulation || !simState || !particleSystem) return
  const { positions, velocities, forces } = simState
  const hudVisible = isVisible(document.querySelector('#hud'))
  const needsTrajectoryShift = settings.if_showTrajectory && (time - lastSnapshotTime > settings.dt)
  for (let i = 0; i < particles.length; i++) {
    applyParticleVisualUpdate(
      i,
      positions,
      velocities,
      forces,
      { f: arrowScaleForForces, v: arrowScaleForVelocities },
      { hudVisible, needsTrajectoryShift, frameOffset }
    )
  }
  particleSystem.geometry.attributes.position.needsUpdate = true
}

interface ArrowScales { f: number; v: number }
interface VisualCtx { hudVisible: boolean; needsTrajectoryShift: boolean; frameOffset: THREE.Vector3 }
function applyParticleVisualUpdate(i: number, positions: Float32Array, velocities: Float32Array, forces: Float32Array, scales: ArrowScales, ctx: VisualCtx): void {
  const p = particles[i]
  if (p.isEscaped) return
  const i3 = 3 * i
  p.position.set(positions[i3] - ctx.frameOffset.x, positions[i3 + 1] - ctx.frameOffset.y, positions[i3 + 2] - ctx.frameOffset.z)
  p.velocity.set(velocities[i3], velocities[i3 + 1], velocities[i3 + 2])
  p.force.set(forces[i3], forces[i3 + 1], forces[i3 + 2])
  if (particleSystem) particleSystem.geometry.attributes.position.setXYZ(i, p.position.x, p.position.y, p.position.z)
  const trajectoryAttr = (settings.if_showTrajectory && p.trajectory)
    ? p.trajectory.geometry.getAttribute('position') as THREE.BufferAttribute
    : null
  if (settings.if_use_periodic_boundary_condition) {
    applyPbc(p.position, trajectoryAttr, settings.maxTrajectoryLength, settings.spaceBoundaryX, settings.spaceBoundaryY, settings.spaceBoundaryZ)
  }
  if (settings.if_showArrows) {
    updateArrowHelper(p.velocityArrow, p.position, p.velocity, scales.f)
    updateArrowHelper(p.forceArrow, p.position, p.force, scales.v)
  }
  if (trajectoryAttr && ctx.needsTrajectoryShift) updateTrajectoryBuffer(p, trajectoryAttr, settings.maxTrajectoryLength)
  if (ctx.hudVisible) updateHudRow(i, p)
}

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

function animate(): void {
  time += settings.dt
  // Step SoA simulation
  if (simulation) simulation.step()
  // Copy SoA results back & update visual elements
  const arrowScaleForForces = rescaleForceScaleBar(particles)
  const arrowScaleForVelocities = rescaleVelocityScaleBar(particles)
  const frameOffset = (settings.if_ReferenceFrame_movesWithSun && simState)
    ? new THREE.Vector3(simState.positions[0], simState.positions[1], simState.positions[2])
    : new THREE.Vector3(0, 0, 0)
  updateFromSimulation(arrowScaleForForces, arrowScaleForVelocities, frameOffset)
  if (settings.if_showTrajectory && time - lastSnapshotTime > settings.dt) {
    lastSnapshotTime = time
  }
  statistics(temperaturePanel, maxTemperature)
  update()
  render(renderer, effect)
  if (settings.ifRun) requestAnimationFrame(animate)
  stats.update()
}
function calculateTemperature(): number {
  let temperature = 0
  particles.filter(particle => !particle.isEscaped).forEach(particle => {
    temperature +=
      particle.mass *
      particle.velocity.length() ** 2
  })
  temperature *= 1 / settings.kB / (3 * settings.particleCount - 3)
  if (temperature > maxTemperature) {
    maxTemperature = temperature
  }
  return temperature
}

function statistics(panel: { update: (t: number, max: number) => void }, maxTemperature: number): void {
  const temperature = calculateTemperature()
  panel.update(temperature, maxTemperature)
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

  const values = init(settings,
    particles,
    time,
    lastSnapshotTime)

  scene = values[0]
  particleSystem = values[1] as THREE.Points
  camera = values[2]
  renderer = values[3]
  controls = values[4]
  stats = values[5]
  temperaturePanel = values[6]
  effect = values[7]

  // Build SoA simulation state from existing particle objects
  simState = createState({
    particleCount: settings.particleCount,
    box: { x: settings.spaceBoundaryX, y: settings.spaceBoundaryY, z: settings.spaceBoundaryZ },
    dt: settings.dt,
    cutoff: settings.cutoffDistance
  })
  // Seed arrays
  for (let i = 0; i < particles.length; i++) {
    const i3 = 3 * i
    simState.positions[i3] = particles[i].position.x
    simState.positions[i3 + 1] = particles[i].position.y
    simState.positions[i3 + 2] = particles[i].position.z
    simState.velocities[i3] = particles[i].velocity.x
    simState.velocities[i3 + 1] = particles[i].velocity.y
    simState.velocities[i3 + 2] = particles[i].velocity.z
    simState.masses[i] = particles[i].mass
    simState.charges[i] = particles[i].charge
  }
  const forcePlugins = []
  if (settings.if_apply_LJpotential) forcePlugins.push(new LennardJones({ epsilon: settings.EPSILON, sigma: settings.DELTA }))
  if (settings.if_apply_gravitation) forcePlugins.push(new Gravity({ G: settings.G }))
  if (settings.if_apply_coulombForce) forcePlugins.push(new Coulomb({ K: settings.K }))
  simulation = new Simulation(simState, VelocityVerlet, forcePlugins, { dt: settings.dt, cutoff: settings.cutoffDistance })

  animate()
  // Expose handle for automated headless tests
  // Expose simulation state (read-only for tests; mutation not supported outside test harness)
  window.__mdjs = { particles, settings, simState }
  // Install full-state persistence handler (overrides placeholder in init.js)
  window.onbeforeunload = () => {
    try {
      const snapshot: SavedState = captureState()
      saveState(snapshot)
    } catch (e) {
      console.log('Failed to persist state:', e)
    }
  }
  // bind keyboard event:
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      toggle('#hud')
    }
  })
})

// Build a complete snapshot matching SavedState interface for persistence.
function captureState(): SavedState {
  const particleCount = particles.length
  const particleColors: number[] = []
  const particlePositions: number[] = []
  const particleForces: Array<{ x: number, y: number, z: number }> = []
  const particleVelocities: Array<{ x: number, y: number, z: number }> = []
  const particleMasses: number[] = []
  const particleCharges: number[] = []
  for (const p of particles) {
    particleColors.push(p.color.r, p.color.g, p.color.b)
    particlePositions.push(p.position.x, p.position.y, p.position.z)
    particleForces.push({ x: p.force.x, y: p.force.y, z: p.force.z })
    particleVelocities.push({ x: p.velocity.x, y: p.velocity.y, z: p.velocity.z })
    particleMasses.push(p.mass)
    particleCharges.push(p.charge)
  }
  return {
    particleCount,
    particleColors,
    particlePositions,
    particleForces,
    particleVelocities,
    particleMasses,
    particleCharges,
    time,
    lastSnapshotTime
  }
}
