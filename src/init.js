
import * as THREE from 'three'
import { OrbitControls } from 'OrbitControls'
import { DeviceOrientationControls } from 'DeviceOrientationControls'
import Stats from 'Stats'
import { StereoEffect } from 'StereoEffect'
import { originalSpaceBoundaryX, originalSpaceBoundaryY, originalSpaceBoundaryZ, resetSettingsToDefaults } from './settings.js'
import { drawBox } from './drawingHelpers.js'
import { resetWorld, clearStoredSnapshot, saveUserSettings } from './engine/persistence/storage.js'
import {
  makeClonePositionsList
  ,
  createParticleSystem, particleMaterialForClones
} from './particleSystem.js'

import * as dat from 'dat.gui'

const ifMobileDevice =
/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
  navigator.userAgent
)

function fullscreen () {
  if (document.body.requestFullscreen) {
    document.body.requestFullscreen()
  } else if (document.body.msRequestFullscreen) {
    document.body.msRequestFullscreen()
  } else if (document.body.mozRequestFullScreen) {
    document.body.mozRequestFullScreen()
  } else if (document.body.webkitRequestFullscreen) {
    document.body.webkitRequestFullscreen()
  }
}
function init (settings,
  particles,
  time,
  lastSnapshotTime) {
  // initialize the scene
  const scene = new THREE.Scene()
  //    configure the scene:
  if (settings.if_useFog) {
    scene.fog = new THREE.Fog(0xffffff, 0, 20)
  }
  //    define objects:
  let boxMesh = null
  if (settings.if_showUniverseBoundary) {
    boxMesh = drawBox(
      settings.spaceBoundaryX,
      settings.spaceBoundaryY,
      settings.spaceBoundaryZ,
      scene
    )
  }
  const group = new THREE.Object3D()
  const particleSystem = createParticleSystem(
    group,
    particles,
    scene,
    time,
    lastSnapshotTime,
    settings
  )
  console.log("3D object 'group' created: ", group)
  scene.add(group)
  console.log(particles)
  // enable settings GUI
  initializeGuiControls(settings, group, boxMesh)
  // initialize the camera
  const camera = new THREE.PerspectiveCamera(
    90,
    window.innerWidth / window.innerHeight,
    1,
    1000000
  )
  camera.position.set(0, 2, 10)
  scene.add(camera)
  // initialize renderer
  const renderer = new THREE.WebGLRenderer({
    alpha: true
  })
  renderer.setSize(window.innerWidth, window.innerHeight)
  let effect
  if (ifMobileDevice) {
    effect = new StereoEffect(renderer)
  }
  const element = renderer.domElement
  document.body.appendChild(element)
  // activate plugins:
  const controls = new OrbitControls(camera, element) // this is for non-VR devices
  function setOrientationControls (e) {
    if (!e.alpha) {
      return
    }
    const controls = new DeviceOrientationControls(camera, true)
    controls.connect()
    controls.update()
    element.addEventListener('click', fullscreen, false)
    window.removeEventListener(
      'deviceorientation',
      setOrientationControls,
      true
    )
  }
  window.addEventListener('deviceorientation', setOrientationControls, true)
  // add stat
  const stats = new Stats()
  const temperaturePanel = stats.addPanel(new Stats.Panel('Temp.', '#ff8', '#221'))
  stats.showPanel(2)
  document.body.append(stats.domElement)
  // add event listeners
  window.addEventListener('resize', () => { resize(camera, effect, renderer) }, false)
  setTimeout(() => { resize(camera, effect, renderer) }, 1)
  // State persistence handled in TypeScript (script.ts) to include full particle data.
  return [scene, particleSystem, camera, renderer, controls, stats, temperaturePanel, effect]
}

function updateClonesPositions (
  spaceBoundaryX,
  spaceBoundaryY,
  spaceBoundaryZ,
  group
) {
  const clonePositions = makeClonePositionsList(
    spaceBoundaryX,
    spaceBoundaryY,
    spaceBoundaryZ
  )
  for (let i = 0; i < 26; i++) {
    group.children[i + 1].position.set(
      clonePositions[i].x,
      clonePositions[i].y,
      clonePositions[i].z
    )
  }
}

function resize (camera, effect, renderer) {
  const width = document.body.offsetWidth
  const height = document.body.offsetHeight
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
  if (ifMobileDevice) effect.setSize(width, height)
}
// (initializeGuiControls is invoked inside init())
function initializeGuiControls (settings, group, boxMesh) {
// Enable the GUI Controls powered by "dat.gui.min.js":
  const gui = new dat.GUI()
  const _allControllers = []
  const remember = (c) => { _allControllers.push(c); return c }

  const guiFolderWorld = gui.addFolder('World building')

  remember(guiFolderWorld.add(settings, 'if_constant_temperature').name('Constant T'))
  remember(guiFolderWorld.add(settings, 'targetTemperature').name('Target temp.'))

  const guiFolderParameters = guiFolderWorld.addFolder('Parameters') // toggles for parameters:
  remember(guiFolderParameters.add(settings, 'particleCount'))
  remember(guiFolderParameters.add(settings, 'dt'))

  const guiFolderConstants = guiFolderWorld.addFolder('Physical Constants') // physical constants -- be the god!
  remember(guiFolderConstants.add(settings, 'EPSILON'))
  remember(guiFolderConstants.add(settings, 'DELTA'))
  remember(guiFolderConstants.add(settings, 'G'))
  remember(guiFolderConstants.add(settings, 'K'))

  const guiFolderBoundary = guiFolderWorld.addFolder('Universe boundary')
  remember(guiFolderBoundary.add(settings, 'if_showUniverseBoundary'))
  remember(guiFolderBoundary
    .add(settings, 'if_use_periodic_boundary_condition')
    .name('Use PBC')
    .onChange(() => {
      particleMaterialForClones.visible = settings.if_use_periodic_boundary_condition
    }))
  const guiFolderSize = guiFolderBoundary.addFolder('Custom size')
  remember(guiFolderSize
    .add(settings, 'spaceBoundaryX')
    .name('Size, X')
  .onChange(function () {
      if (boxMesh) {
        boxMesh.scale.x = settings.spaceBoundaryX / originalSpaceBoundaryX
      }
      updateClonesPositions(
        settings.spaceBoundaryX,
        settings.spaceBoundaryY,
        settings.spaceBoundaryZ,
        group
      )
    }))
  remember(guiFolderSize
    .add(settings, 'spaceBoundaryY')
    .name('Size, Y')
  .onChange(function () {
      if (boxMesh) {
        boxMesh.scale.y = settings.spaceBoundaryY / originalSpaceBoundaryY
      }
      updateClonesPositions(
        settings.spaceBoundaryX,
        settings.spaceBoundaryY,
        settings.spaceBoundaryZ,
        group
      )
    }))
  remember(guiFolderSize
    .add(settings, 'spaceBoundaryZ')
    .name('Size, Z')
  .onChange(function () {
      if (boxMesh) {
        boxMesh.scale.z = settings.spaceBoundaryZ / originalSpaceBoundaryZ
      }
      updateClonesPositions(
        settings.spaceBoundaryX,
        settings.spaceBoundaryY,
        settings.spaceBoundaryZ,
        group
      )
    }))

  const guiFolderForces = guiFolderWorld.addFolder('Forcefields to apply')
  remember(guiFolderForces.add(settings, 'if_apply_LJpotential').name('LJ potential'))
  remember(guiFolderForces.add(settings, 'if_apply_gravitation').name('Gravitation'))
  remember(guiFolderForces.add(settings, 'if_apply_coulombForce').name('Coulomb Force'))

  guiFolderWorld.open()

  const guiFolderPlotting = gui.addFolder('Plotting') // toggles for Plotting:
  // guiFolderPlotting.add(settings, "if_override_particleCount_setting_with_lastState").name("");
  remember(guiFolderPlotting.add(settings, 'referenceFrameMode', { 'Fixed': 'fixed', 'Sun': 'sun', 'Center of Mass': 'com' })
    .name('Reference frame'))

  // (sun & fog toggles managed elsewhere)

  const guiFolderTrajectories = guiFolderPlotting.addFolder(
    'Particle trajectories'
  )
  remember(guiFolderTrajectories.add(settings, 'if_showTrajectory').name('Trace'))
  remember(guiFolderTrajectories
    .add(settings, 'maxTrajectoryLength')
    .name('Length')
  .onChange(function () { /* length change handler TBD */ }))

  const guiFolderArrows = guiFolderPlotting.addFolder(
    'Arrows for forces and velocities'
  )
  remember(guiFolderArrows
    .add(settings, 'if_showArrows')
    .name('Show arrows')
    .onChange(function () { /* instanced arrows handle visibility externally */ }))
  remember(guiFolderArrows.add(settings, 'if_limitArrowsMaxLength').name('Limit length'))
  remember(guiFolderArrows.add(settings, 'maxArrowLength').name('Max length'))
  remember(guiFolderArrows.add(settings, 'unitArrowLength').name('Unit length'))
  remember(guiFolderArrows
    .add(settings, 'if_showMapscale')
    .name('Show scales')
  .onChange(() => { toggle('.mapscale') }))
  remember(guiFolderArrows
    .add(settings, 'if_proportionate_arrows_with_vectors')
    .name('Proportionate arrows with vectors'))

  guiFolderPlotting.open()

  const commands = {
    stop: () => { settings.ifRun = false },
    toggleHUD: () => { toggle('#hud') },
    newWorld: () => { resetWorld() },
    randomizeParticles: () => {
      try { saveUserSettings() } catch { /* ignore */ }
      try { clearStoredSnapshot() } catch { /* ignore */ }
      // Force reload to regenerate particle positions using current settings.
      try { window.onbeforeunload = null } catch { /* ignore */ }
      location.reload()
    },
    resetDefaults: () => {
      resetSettingsToDefaults()
      // Side effects: rescale box & clone positions, PBC visibility
      if (boxMesh) {
        boxMesh.scale.x = settings.spaceBoundaryX / originalSpaceBoundaryX
        boxMesh.scale.y = settings.spaceBoundaryY / originalSpaceBoundaryY
        boxMesh.scale.z = settings.spaceBoundaryZ / originalSpaceBoundaryZ
      }
      particleMaterialForClones.visible = settings.if_use_periodic_boundary_condition
      updateClonesPositions(
        settings.spaceBoundaryX,
        settings.spaceBoundaryY,
        settings.spaceBoundaryZ,
        group
      )
      try { saveUserSettings() } catch { /* ignore */ }
      // Force each controller to pull latest value
      for (const c of _allControllers) { try { c.updateDisplay() } catch { /* ignore */ } }
    }
  }
  // Move New world (randomize) into World building folder
  guiFolderWorld.add(commands, 'randomizeParticles').name('New world')
  const guiFolderCommands = gui.addFolder('Commands')
  guiFolderCommands.add(commands, 'resetDefaults').name('Reset defaults')
  guiFolderCommands.add(commands, 'stop').name('Halt')
  gui.add(commands, 'toggleHUD').name('Show Detail HUD')
  guiFolderCommands.open()

  // gui.remember removed to avoid overwriting programmatic resets.
  gui.close()
}

function toggle (selector) {
  const element = document.querySelector(selector)
  if (element.style.display === 'none') {
    element.style.display = 'block'
  } else {
    element.style.display = 'none'
  }
}

export { init, ifMobileDevice, toggle }
