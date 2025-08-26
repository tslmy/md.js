/**
 * This script is responsible for initializing the control panel GUI.
 */
// @ts-expect-error external import map module (no types)
import { GUI } from 'dat.gui'
import { Object3D } from 'three'

import { resetSettingsToDefaults, settings as liveSettings, SETTINGS_SCHEMA } from './settings.js'
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
    interface Controller { onChange?(cb: () => void): Controller; name(n: string): Controller; updateDisplay?(): void }
    const controllers: Record<string, Controller> = {}
    const folders: Record<string, GUI> = {}
    const LABEL: Record<string, string> = {
        world: 'World', runtime: 'Runtime', forces: 'Forces', constants: 'Constants', boundary: 'Boundary', ewald: 'Ewald', advanced: 'Advanced',
        visual: 'Visual', trajectories: 'Trajectories', arrows: 'Arrows', ui: 'UI'
    }
    const folder = (g: string) => folders[g] || (folders[g] = gui.addFolder(LABEL[g] || g))
    const initialBounds = (boxMesh as Object3D & { userData?: { initialBounds?: { x: number; y: number; z: number } } })?.userData?.initialBounds
    const add = (d: (typeof SETTINGS_SCHEMA)[number]) => {
        if (!(d.key in settings)) return
        const val = (settings as Record<string, unknown>)[d.key]
        if (Array.isArray(val)) return
        const f = folder(d.group)
        const name = d.control?.label || d.key
        let c: Controller
        if (d.control?.type === 'select' && d.control.options) c = f.add(settings, d.key, d.control.options).name(name)
        else c = f.add(settings, d.key).name(name)
        controllers[d.key] = c
        // Generic numeric clamp & step enforcement (skip selects / booleans)
        if (d.control?.type !== 'select' && typeof (settings as Record<string, unknown>)[d.key] === 'number' && (d.control?.min !== undefined || d.control?.max !== undefined || d.control?.step !== undefined)) {
            c.onChange?.(() => {
                let v = (settings as Record<string, unknown>)[d.key] as number
                if (typeof v !== 'number' || Number.isNaN(v)) return
                if (d.control?.min !== undefined && v < d.control.min) v = d.control.min
                if (d.control?.max !== undefined && v > d.control.max) v = d.control.max
                if (d.control?.step !== undefined && d.control.step > 0) {
                    const k = Math.round(v / d.control.step)
                    v = k * d.control.step
                }
                if (v !== (settings as Record<string, unknown>)[d.key]) {
                    (settings as Record<string, unknown>)[d.key] = v
                    c.updateDisplay?.()
                }
            })
        }
    }
    for (const d of SETTINGS_SCHEMA) add(d)
    // Clamp + scaling hooks
    const clampCutoff = () => {
        const maxHalf = Math.min(Number(settings.spaceBoundaryX), Number(settings.spaceBoundaryY), Number(settings.spaceBoundaryZ))
        if (Number(settings.cutoffDistance) > maxHalf) settings.cutoffDistance = maxHalf as unknown as number
        if (Number(settings.cutoffDistance) <= 0) settings.cutoffDistance = (maxHalf * 0.1) as unknown as number
        controllers.cutoffDistance?.updateDisplay?.()
    }
    const scaleHandler = (axis: 'spaceBoundaryX' | 'spaceBoundaryY' | 'spaceBoundaryZ', dim: 'x' | 'y' | 'z') => () => {
        if (!boxMesh || !initialBounds) return
        (boxMesh.scale as Record<'x' | 'y' | 'z', number>)[dim] = Number(settings[axis]) / initialBounds[dim]
        clampCutoff()
    }
    controllers.spaceBoundaryX?.onChange?.(scaleHandler('spaceBoundaryX', 'x'))
    controllers.spaceBoundaryY?.onChange?.(scaleHandler('spaceBoundaryY', 'y'))
    controllers.spaceBoundaryZ?.onChange?.(scaleHandler('spaceBoundaryZ', 'z'))
    controllers.cutoffDistance?.onChange?.(clampCutoff)
    controllers.if_showMapscale?.onChange?.(() => { toggle('.mapscale') })
    // Optional: open key folders
    folders.world?.open(); folders.visual?.open()
    gui.close()
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
            if (boxMesh && initialBounds) {
                boxMesh.scale.x = Number(settings.spaceBoundaryX) / initialBounds.x
                boxMesh.scale.y = Number(settings.spaceBoundaryY) / initialBounds.y
                boxMesh.scale.z = Number(settings.spaceBoundaryZ) / initialBounds.z
            }
            try { saveSettingsToLocal() } catch (e) { console.warn('Failed saving user settings:', e) }
        }
    }
    // Place command folders at root
    gui.add(commands, 'randomizeParticles').name('New world')
    const cmd = gui.addFolder('Commands')
    cmd.add(commands, 'resetDefaults').name('Reset defaults')
    cmd.add(commands, 'stop').name('Halt')
    gui.add(commands, 'toggleHUD').name('Show Detail HUD')
    cmd.open(); gui.close()
}
