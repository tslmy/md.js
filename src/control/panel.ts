/**
 * This script is responsible for initializing the control panel GUI.
 */
// @ts-expect-error external import map module (no types)
import { GUI } from 'dat.gui'
import { Object3D } from 'three'

import { originalSpaceBoundaryX, originalSpaceBoundaryY, originalSpaceBoundaryZ, resetSettingsToDefaults, settings as liveSettings, SETTINGS_SCHEMA } from './settings.js'
import { clearEngineSnapshotInLocal } from '../engine/persist.js'
import { saveSettingsToLocal } from './persist.js'
import { clearVisualDataInLocal } from '../visual/persist.js'

// Narrow settings type (duck typed from settings.ts export)
type SettingsLike = typeof liveSettings

let _activeGui: GUI | null = null

export function toggle(selector: string): void {
    const el = document.querySelector<HTMLElement>(selector)
    if (!el) return
    el.style.display = (el.style.display === 'none') ? 'block' : 'none'
}

export function initializeGuiControls(settings: SettingsLike, boxMesh: Object3D | null): void {
    try { _activeGui?.destroy(); _activeGui = null } catch { /* ignore */ }
    // Backward compatibility: if persisted settings were saved before new keys (Ewald params) existed,
    // ensure properties are present so dat.GUI can bind controllers without throwing.
    // Migration: persisted settings from versions before Ewald params lack these keys.
    // Some users reported a dat.GUI error: "Object '[object Object]' has no property 'ewaldAlpha'" even though
    // the settings export defines it. To be maximally defensive we re-check *and* define numeric defaults if
    // absent or still undefined so dat.GUI never rejects the controller creation.
    const ensureProp = (key: keyof SettingsLike, fallback: number) => {
        const current = settings[key] as unknown
        if (current == null || typeof current !== 'number') {
            settings[key as string] = fallback
        }
    }
    const Lmin = Math.min(
        Number(settings.spaceBoundaryX),
        Number(settings.spaceBoundaryY),
        Number(settings.spaceBoundaryZ)
    ) || 1
    // Heuristic defaults: alpha ~ 5/Lmin, kMax modest integer for starter performance.
    ensureProp('ewaldAlpha' as keyof SettingsLike, 5 / Lmin)
    ensureProp('ewaldKMax' as keyof SettingsLike, 6)
    const gui = new GUI(); _activeGui = gui
    const guiFolderWorld = gui.addFolder('World & Runtime')
    const guiFolderParameters = guiFolderWorld.addFolder('Core')
    // Build controllers dynamically from schema
    const byGroup = (g: string) => SETTINGS_SCHEMA.filter(d => d.group === g)
    interface Controller { onChange?(cb: () => void): Controller; name(n: string): Controller; updateDisplay?(): void }
    const createdControllers: Record<string, Controller> = {}
    type FolderLike = { add: (obj: object, prop: string, opts?: Record<string, string>) => Controller }
    const addDescriptor = (d: (typeof SETTINGS_SCHEMA)[number], folder: FolderLike) => {
        // Avoid adding duplicate controllers (e.g. boundary size re-added under custom size folder)
        if (createdControllers[d.key]) return
        // Require key present on settings
        if (!(d.key in settings)) return
        const val = (settings as Record<string, unknown>)[d.key]
        // If value is array or object (and not a select control), skip – unsupported primitive for default controller
        // Skip non-primitive values (arrays/objects) unless explicitly handled as select.
        if (Array.isArray(val)) { return }
        // Skip plain objects (non-select) which dat.GUI can't bind directly.
        // Previously filtered generic objects; allowing them now if dat.GUI can derive a controller (rare case)
        const name = d.control?.label || d.key
        let ctrl: Controller
        if (d.control?.type === 'select' && d.control.options) {
            ctrl = folder.add(settings, d.key, d.control.options).name(name)
        } else {
            ctrl = folder.add(settings, d.key).name(name)
        }
        createdControllers[d.key] = ctrl
    }
    for (const d of byGroup('world')) addDescriptor(d, guiFolderParameters)
    for (const d of byGroup('runtime')) addDescriptor(d, guiFolderParameters)
    // Enforce LJ cutoff not exceeding half-box length (minimum of half-lengths) for physical correctness under PBC.
    const cutoffController = createdControllers['cutoffDistance']
    const clampCutoff = () => {
        const maxHalf = Math.min(Number(settings.spaceBoundaryX), Number(settings.spaceBoundaryY), Number(settings.spaceBoundaryZ))
        if (Number(settings.cutoffDistance) > maxHalf) {
            settings.cutoffDistance = maxHalf as unknown as number
        }
        if (Number(settings.cutoffDistance) <= 0) {
            settings.cutoffDistance = (maxHalf * 0.1) as unknown as number
        }
        if (cutoffController?.updateDisplay) cutoffController.updateDisplay()
    }
    cutoffController?.onChange?.(clampCutoff)
    const guiFolderConstants = guiFolderWorld.addFolder('Constants')
    for (const d of byGroup('constants')) addDescriptor(d, guiFolderConstants)
    const guiFolderEwald = guiFolderWorld.addFolder('Ewald')
    for (const d of byGroup('ewald')) addDescriptor(d, guiFolderEwald)
    const guiFolderBoundary = guiFolderWorld.addFolder('Boundary')
    for (const d of byGroup('boundary')) addDescriptor(d, guiFolderBoundary)
    const guiFolderSize = guiFolderBoundary.addFolder('Custom size')
    const wrapBoxChange = (axis: 'spaceBoundaryX' | 'spaceBoundaryY' | 'spaceBoundaryZ', update: () => void) => () => { update(); clampCutoff(); if (cutoffController?.updateDisplay) cutoffController.updateDisplay() }
    guiFolderSize.add(settings, 'spaceBoundaryX').name('Size, X').onChange(wrapBoxChange('spaceBoundaryX', () => { if (boxMesh) boxMesh.scale.x = Number(settings.spaceBoundaryX) / originalSpaceBoundaryX }))
    guiFolderSize.add(settings, 'spaceBoundaryY').name('Size, Y').onChange(wrapBoxChange('spaceBoundaryY', () => { if (boxMesh) boxMesh.scale.y = Number(settings.spaceBoundaryY) / originalSpaceBoundaryY }))
    guiFolderSize.add(settings, 'spaceBoundaryZ').name('Size, Z').onChange(wrapBoxChange('spaceBoundaryZ', () => { if (boxMesh) boxMesh.scale.z = Number(settings.spaceBoundaryZ) / originalSpaceBoundaryZ }))
    const guiFolderForces = guiFolderWorld.addFolder('Forces')
    for (const d of byGroup('forces')) addDescriptor(d, guiFolderForces)
    guiFolderWorld.open()
    const guiFolderPlotting = gui.addFolder('Visual / Plotting')
    for (const d of byGroup('visual')) addDescriptor(d, guiFolderPlotting)
    const guiFolderTraj = guiFolderPlotting.addFolder('Trajectories')
    for (const d of byGroup('trajectories')) addDescriptor(d, guiFolderTraj)
    const guiFolderArrows = guiFolderPlotting.addFolder('Arrows')
    for (const d of byGroup('arrows')) addDescriptor(d, guiFolderArrows)
    if (createdControllers['if_showMapscale']?.onChange) createdControllers['if_showMapscale'].onChange(() => { toggle('.mapscale') })
    const commands = {
        stop: () => { try { (window as unknown as { __pauseEngine?: () => void }).__pauseEngine?.() } catch { /* ignore */ } },
        toggleHUD: () => { toggle('#hud') },
        randomizeParticles: () => {
            try {
                // Persist current (possibly tweaked) settings so after reload we build a fresh world using them.
                saveSettingsToLocal()
                clearVisualDataInLocal()
                clearEngineSnapshotInLocal()
            } catch (e) {
                console.warn('Failed clearing stored snapshot(s):', e)
            }
            // Prevent saving the soon-to-be-discarded state during reload
            try { window.onbeforeunload = null } catch (e) {
                console.warn('Failed clearing onbeforeunload handler, and the soon-to-be-discarded state may be saved:', e)
            }
            location.reload()
        },
        resetDefaults: () => {
            resetSettingsToDefaults()
            initializeGuiControls(settings, boxMesh)
            if (boxMesh) {
                boxMesh.scale.x = Number(settings.spaceBoundaryX) / originalSpaceBoundaryX
                boxMesh.scale.y = Number(settings.spaceBoundaryY) / originalSpaceBoundaryY
                boxMesh.scale.z = Number(settings.spaceBoundaryZ) / originalSpaceBoundaryZ
            }
            try { saveSettingsToLocal() } catch (e) { console.warn('Failed saving user settings:', e) }
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
