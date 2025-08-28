// Minimal, focused ambient declarations for third-party packages that are not
// available as proper @types packages in this repo. Prefer installing real
// types from npm when possible; these are lightweight shims to remove
// import-map-era stubs.

declare module 'Stats' {
    export default class Stats {
        dom: HTMLElement
        addPanel(panel: unknown): unknown
        update(): void
        showPanel(id: number): void
        static Panel: new (name: string, fg: string, bg: string) => unknown
        // convenience proxy used by older code
        readonly domElement: HTMLElement
    }
}

declare module 'dat.gui' {
    export interface GUIController {
        name(n: string): GUIController
        onChange(cb: () => void): GUIController
        updateDisplay(): void
    }
    export class GUI {
        addFolder(name: string): GUI
        add(target: object, prop: string, options?: unknown): GUIController
        destroy(): void
        close(): void
        open(): void
        domElement: HTMLElement
    }
    export default GUI
}

declare module 'OrbitControls' {
    import { Camera, MOUSE, Object3D } from 'three'
    export class OrbitControls extends Object3D {
        constructor(camera: Camera, domElement?: HTMLElement)
        update(): void
        static MOUSE: typeof MOUSE
    }
}

declare module 'DeviceOrientationControls' {
    import { Camera } from 'three'
    export class DeviceOrientationControls {
        constructor(camera: Camera, listen?: boolean)
        connect(): void
        update(): void
    }
}

declare module 'StereoEffect' {
    import { WebGLRenderer, Scene, Camera } from 'three'
    export class StereoEffect {
        constructor(renderer: WebGLRenderer)
        render(scene: Scene, camera: Camera): void
        setSize(w: number, h: number): void
    }
}
