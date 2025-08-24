import * as THREE from 'three'
// @ts-expect-error external import map module (no types)
import { OrbitControls } from 'OrbitControls'
// @ts-expect-error external import map module (no types)
import { DeviceOrientationControls } from 'DeviceOrientationControls'
// @ts-expect-error external import map module (no types)
import Stats from 'Stats'
// @ts-expect-error external import map module (no types)
import { StereoEffect } from 'StereoEffect'
import { originalSpaceBoundaryX, originalSpaceBoundaryY, originalSpaceBoundaryZ, resetSettingsToDefaults, settings as liveSettings } from './settings.js'
import { drawBox } from './drawingHelpers.js'
import { resetWorld, clearStoredSnapshot, saveUserSettings } from './engine/persistence/storage.js'
import { seedParticles } from './particleSystem.js'
// @ts-expect-error external import map module (no types)
import * as dat from 'dat.gui'
import type { Particle } from './particleSystem.js'

// Narrow settings type (duck typed from settings.ts export)
type SettingsLike = typeof liveSettings

const ifMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

function fullscreen(): void {
  const b = document.body as HTMLElement & { msRequestFullscreen?: () => void; mozRequestFullScreen?: () => void; webkitRequestFullscreen?: () => void }
  if (b.requestFullscreen) b.requestFullscreen()
  else if (b.msRequestFullscreen) b.msRequestFullscreen()
  else if (b.mozRequestFullScreen) b.mozRequestFullScreen()
  else if (b.webkitRequestFullscreen) b.webkitRequestFullscreen()
}

export function init(settings: SettingsLike, particles: Particle[]): [THREE.Scene, null, THREE.PerspectiveCamera, THREE.WebGLRenderer, OrbitControls, Stats, { update: (t: number, max: number) => void }, StereoEffect | undefined] {
  const scene = new THREE.Scene()
  if (settings.if_useFog) scene.fog = new THREE.Fog(0xffffff, 0, 20)
  // Optional wireframe box
  let boxMesh: THREE.Object3D | null = null
  if (settings.if_showUniverseBoundary) {
    boxMesh = drawBox(settings.spaceBoundaryX, settings.spaceBoundaryY, settings.spaceBoundaryZ, scene)
  }
  scene.add(new THREE.AmbientLight(0xffffff, 0.35))
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8); dirLight.position.set(5, 10, 7); scene.add(dirLight)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x222233, 0.4))

  seedParticles(particles, scene, settings) // seed utility expects full settings export shape

  const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 1, 1_000_000)
  camera.position.set(0, 2, 10)
  scene.add(camera)

  const renderer = new THREE.WebGLRenderer({ alpha: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  let effect: StereoEffect | undefined
  if (ifMobileDevice) effect = new StereoEffect(renderer)
  const element = renderer.domElement
  document.body.appendChild(element)

  const controls = new OrbitControls(camera, element)
  function setOrientationControls(e: DeviceOrientationEvent): void {
    if (!e.alpha) return
    const devCtrls = new DeviceOrientationControls(camera, true)
    devCtrls.connect(); devCtrls.update()
    element.addEventListener('click', fullscreen, false)
    window.removeEventListener('deviceorientation', setOrientationControls, true)
  }
  window.addEventListener('deviceorientation', setOrientationControls, true)

  const stats = new Stats()
  const PanelCtor = (Stats as unknown as { Panel: new (n: string, fg: string, bg: string) => unknown }).Panel
  const temperaturePanel = stats.addPanel(new PanelCtor('Temp.', '#ff8', '#221')) as { update: (t: number, max: number) => void }
  stats.showPanel(2)
  document.body.append(stats.domElement)

  window.addEventListener('resize', () => { resize(camera, effect, renderer) }, false)
  setTimeout(() => { resize(camera, effect, renderer) }, 1)

  initializeGuiControls(settings, boxMesh)
  return [scene, null, camera, renderer, controls, stats, temperaturePanel, effect]
}

function resize(camera: THREE.PerspectiveCamera, effect: StereoEffect | undefined, renderer: THREE.WebGLRenderer): void {
  const width = document.body.offsetWidth
  const height = document.body.offsetHeight
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
  if (ifMobileDevice && effect) effect.setSize(width, height)
}

let _activeGui: dat.GUI | null = null
function initializeGuiControls(settings: SettingsLike, boxMesh: THREE.Object3D | null): void {
  try { _activeGui?.destroy(); _activeGui = null } catch { /* ignore */ }
  const gui = new dat.GUI(); _activeGui = gui
  const guiFolderWorld = gui.addFolder('World building')
  guiFolderWorld.add(settings, 'if_constant_temperature').name('Constant T')
  guiFolderWorld.add(settings, 'targetTemperature').name('Target temp.')
  const guiFolderParameters = guiFolderWorld.addFolder('Parameters')
  guiFolderParameters.add(settings, 'particleCount')
  guiFolderParameters.add(settings, 'dt')
  guiFolderParameters.add(settings, 'cutoffDistance').name('Cutoff')
  guiFolderParameters.add(settings, 'integrator', { 'Velocity Verlet': 'velocityVerlet', 'Euler': 'euler' }).name('Integrator')
  guiFolderParameters.add(settings, 'neighborStrategy', { 'Cell': 'cell', 'Naive': 'naive' }).name('Neighbor list')
  const guiFolderConstants = guiFolderWorld.addFolder('Physical Constants')
  guiFolderConstants.add(settings, 'EPSILON')
  guiFolderConstants.add(settings, 'DELTA')
  guiFolderConstants.add(settings, 'G')
  guiFolderConstants.add(settings, 'K')
  guiFolderConstants.add(settings, 'kB').name('kB')
  const guiFolderBoundary = guiFolderWorld.addFolder('Universe boundary')
  guiFolderBoundary.add(settings, 'if_showUniverseBoundary')
  guiFolderBoundary.add(settings, 'if_use_periodic_boundary_condition').name('Use PBC')
  const guiFolderSize = guiFolderBoundary.addFolder('Custom size')
  guiFolderSize.add(settings, 'spaceBoundaryX').name('Size, X').onChange(() => { if (boxMesh) boxMesh.scale.x = settings.spaceBoundaryX / originalSpaceBoundaryX })
  guiFolderSize.add(settings, 'spaceBoundaryY').name('Size, Y').onChange(() => { if (boxMesh) boxMesh.scale.y = settings.spaceBoundaryY / originalSpaceBoundaryY })
  guiFolderSize.add(settings, 'spaceBoundaryZ').name('Size, Z').onChange(() => { if (boxMesh) boxMesh.scale.z = settings.spaceBoundaryZ / originalSpaceBoundaryZ })
  const guiFolderForces = guiFolderWorld.addFolder('Forcefields to apply')
  guiFolderForces.add(settings, 'if_apply_LJpotential').name('LJ potential')
  guiFolderForces.add(settings, 'if_apply_gravitation').name('Gravitation')
  guiFolderForces.add(settings, 'if_apply_coulombForce').name('Coulomb Force')
  guiFolderWorld.open()
  const guiFolderPlotting = gui.addFolder('Plotting')
  guiFolderPlotting.add(settings, 'referenceFrameMode', { 'Fixed': 'fixed', 'Sun': 'sun', 'Center of Mass': 'com' }).name('Reference frame')
  const guiFolderTraj = guiFolderPlotting.addFolder('Particle trajectories')
  guiFolderTraj.add(settings, 'if_showTrajectory').name('Trace')
  guiFolderTraj.add(settings, 'maxTrajectoryLength').name('Length')
  const guiFolderArrows = guiFolderPlotting.addFolder('Arrows for forces and velocities')
  guiFolderArrows.add(settings, 'if_showArrows').name('Show arrows')
  guiFolderArrows.add(settings, 'if_limitArrowsMaxLength').name('Limit length')
  guiFolderArrows.add(settings, 'maxArrowLength').name('Max length')
  guiFolderArrows.add(settings, 'unitArrowLength').name('Unit length')
  guiFolderArrows.add(settings, 'if_showMapscale').name('Show scales').onChange(() => { toggle('.mapscale') })
  const commands = {
    stop: () => { try { (window as unknown as { __pauseEngine?: () => void }).__pauseEngine?.() } catch { /* ignore */ } },
    toggleHUD: () => { toggle('#hud') },
    newWorld: () => { resetWorld() },
    randomizeParticles: () => {
      try { saveUserSettings() } catch { /* ignore */ }
      try { clearStoredSnapshot() } catch { /* ignore */ }
      try { window.onbeforeunload = null } catch { /* ignore */ }
      location.reload()
    },
    resetDefaults: () => {
      resetSettingsToDefaults()
      initializeGuiControls(settings, boxMesh)
      if (boxMesh) {
        boxMesh.scale.x = settings.spaceBoundaryX / originalSpaceBoundaryX
        boxMesh.scale.y = settings.spaceBoundaryY / originalSpaceBoundaryY
        boxMesh.scale.z = settings.spaceBoundaryZ / originalSpaceBoundaryZ
      }
      try { saveUserSettings() } catch { /* ignore */ }
    }
  }
  guiFolderWorld.add(commands, 'randomizeParticles').name('New world')
  const guiFolderCommands = gui.addFolder('Commands')
  guiFolderCommands.add(commands, 'resetDefaults').name('Reset defaults')
  guiFolderCommands.add(commands, 'stop').name('Halt')
  gui.add(commands, 'toggleHUD').name('Show Detail HUD')
  guiFolderCommands.open()
  gui.close()
}

export function toggle(selector: string): void {
  const el = document.querySelector<HTMLElement>(selector)
  if (!el) return
  el.style.display = (el.style.display === 'none') ? 'block' : 'none'
}

export { ifMobileDevice }
