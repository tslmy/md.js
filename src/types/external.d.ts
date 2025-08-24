// Minimal ambient module declarations for import-mapped runtime deps without @types packages.
import * as THREE from 'three'

declare module 'OrbitControls' { export class OrbitControls { constructor(camera: THREE.Camera, domElement: HTMLElement); update(): void } }

declare module 'DeviceOrientationControls' { export class DeviceOrientationControls { constructor(camera: THREE.Camera, listen?: boolean); connect(): void; update(): void } }

declare module 'StereoEffect' { export class StereoEffect { constructor(renderer: THREE.WebGLRenderer); render(scene: THREE.Scene, camera: THREE.Camera): void; setSize(w: number, h: number): void } }

declare module 'Stats' {
  export default class Stats {
    dom: HTMLElement
    addPanel(panel: unknown): unknown // library panel API (kept loose)
    showPanel(id: number): void
    static Panel: new (name: string, fg: string, bg: string) => unknown
  }
}

declare module 'dat.gui' {
  export class GUI {
    addFolder(name: string): GUI
    add(target: object, prop: string, options?: unknown): GUI
    destroy(): void
    close(): void
    open(): void
  }
  export default GUI
}
