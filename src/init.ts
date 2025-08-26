import * as THREE from 'three'
// @ts-expect-error external import map module (no types)
import { OrbitControls } from 'OrbitControls'
// @ts-expect-error external import map module (no types)
import { DeviceOrientationControls } from 'DeviceOrientationControls'
// @ts-expect-error external import map module (no types)
import Stats from 'Stats'
// @ts-expect-error external import map module (no types)
import { StereoEffect } from 'StereoEffect'
import { drawBox } from './visual/drawingHelpers.js'
import { initHud } from './visual/coloringAndDataSheet.js'
import { initializeGuiControls } from './control/panel.js'
import { settings as liveSettings } from './control/settings.js'

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

export interface InitResult {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  controls: OrbitControls
  stats: Stats
  temperaturePanel: { update: (t: number, max: number) => void }
  effect?: StereoEffect
  boxMesh: THREE.Object3D | null
}

export function init(settings: SettingsLike, colors: THREE.Color[]): InitResult {
  const scene = new THREE.Scene()
  if (settings.if_useFog) scene.fog = new THREE.Fog(0xffffff, 0, 20)
  // Optional wireframe box
  let boxMesh: THREE.Object3D | null = null
  if (settings.if_showUniverseBoundary) {
    boxMesh = drawBox(settings.spaceBoundaryX, settings.spaceBoundaryY, settings.spaceBoundaryZ, scene)
      // Preserve original dimensions for later proportional scaling (panel resets / changes)
      ; (boxMesh as THREE.Object3D & { userData: { initialBounds?: { x: number; y: number; z: number } } }).userData.initialBounds = {
        x: settings.spaceBoundaryX,
        y: settings.spaceBoundaryY,
        z: settings.spaceBoundaryZ
      }
  }
  scene.add(new THREE.AmbientLight(0xffffff, 0.35))
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8); dirLight.position.set(5, 10, 7); scene.add(dirLight)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x222233, 0.4))

  initHud(settings.particleCount, colors, settings.if_makeSun)

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
  return { scene, camera, renderer, controls, stats, temperaturePanel, effect, boxMesh }
}

function resize(camera: THREE.PerspectiveCamera, effect: StereoEffect | undefined, renderer: THREE.WebGLRenderer): void {
  const width = document.body.offsetWidth
  const height = document.body.offsetHeight
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
  if (ifMobileDevice && effect) effect.setSize(width, height)
}


export { ifMobileDevice }
