import * as THREE from 'three'
import { OrbitControls } from 'OrbitControls'
import { DeviceOrientationControls } from 'DeviceOrientationControls'
import Stats from 'Stats'
import { StereoEffect } from 'StereoEffect'
import { drawBox } from './visual/drawingHelpers.js'
import { initHud } from './visual/hud.js'
import { initializeGuiControls } from './control/panel.js'
import { generateParticleColors } from './visual/colors.js'
import { SettingsObject } from './control/settingsSchema.js'


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

export function init(settings: SettingsObject, colors: THREE.Color[]): InitResult {
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

  // Ensure we have enough particle colors.
  if (colors.length < settings.particleCount) {
    const needed = generateParticleColors(settings.particleCount, settings.if_makeSun, colors.length)
    colors.push(...needed)
  }

  initHud(settings.particleCount, colors)

  const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 1, 1_000_000)
  camera.position.set(0, 2, 10)
  scene.add(camera)

  const renderer = new THREE.WebGLRenderer({ alpha: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  let effect: StereoEffect | undefined
  if (ifMobileDevice) effect = new StereoEffect(renderer)
  const element = renderer.domElement
  document.body.appendChild(element)

  let controls: OrbitControls | DeviceOrientationControls = new OrbitControls(camera, element)
  if (ifMobileDevice && typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
    // iOS 13+ requires permission for device orientation
    function enableDeviceOrientation() {
      controls = new DeviceOrientationControls(camera, true)
      controls.connect(); controls.update()
      element.addEventListener('click', fullscreen, false)
      console.log('[md.js] DeviceOrientationControls enabled')
    }
    // Only show overlay if permission API exists
    type DeviceOrientationEventWithPermission = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> }
    const DeviceOrientationEventTyped = window.DeviceOrientationEvent as DeviceOrientationEventWithPermission | undefined
    if (typeof DeviceOrientationEventTyped?.requestPermission === 'function') {
      // Create overlay button
      const overlay = document.createElement('div')
      overlay.style.position = 'fixed'
      overlay.style.top = '0'
      overlay.style.left = '0'
      overlay.style.width = '100vw'
      overlay.style.height = '100vh'
      overlay.style.background = 'rgba(0,0,0,0.85)'
      overlay.style.display = 'flex'
      overlay.style.alignItems = 'center'
      overlay.style.justifyContent = 'center'
      overlay.style.zIndex = '9999'
      overlay.innerHTML = '<button style="font-size:2rem;padding:1em 2em;border-radius:1em;border:none;background:#fff;color:#222;">Enable Motion Controls</button>'
      document.body.appendChild(overlay)
      overlay.querySelector('button')?.addEventListener('click', () => {
        DeviceOrientationEventTyped!.requestPermission!().then((response) => {
          if (response === 'granted') {
            enableDeviceOrientation()
            overlay.remove()
          } else {
            overlay.innerHTML = '<div style="color:#fff;font-size:1.5rem;text-align:center;">Permission denied.\nReload to try again.</div>'
          }
        }).catch((err: unknown) => {
          overlay.innerHTML = '<div style="color:#fff;font-size:1.5rem;text-align:center;">Error requesting permission.<br>' + String(err) + '</div>'
        })
      })
    } else {
      // Non-iOS: enable on first deviceorientation event
      function setOrientationControls(e: DeviceOrientationEvent): void {
        if (!e.alpha) return
        window.removeEventListener('deviceorientation', setOrientationControls, true)
        enableDeviceOrientation()
      }
      window.addEventListener('deviceorientation', setOrientationControls, true)
    }
  }

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
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(width, height)
  if (ifMobileDevice && effect) effect.setSize(width, height)
}


export { ifMobileDevice }
