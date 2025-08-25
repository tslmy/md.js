/**
 * This script is responsible for initializing the control panel GUI.
 */
// @ts-expect-error external import map module (no types)
import { GUI } from 'dat.gui'
import { Object3D } from 'three'

import { originalSpaceBoundaryX, originalSpaceBoundaryY, originalSpaceBoundaryZ, resetSettingsToDefaults, settings as liveSettings } from './settings.js'
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
    const ensureProp = <K extends keyof SettingsLike>(key: K, fallback: number) => {
        if (!(key in settings)) {
            (settings as Record<string, unknown>)[key as string] = fallback
            console.debug('[panel] Injected missing settings key', key, '=>', fallback)
        } else if ((settings as Record<string, unknown>)[key as string] == null) {
            // Normalize null/undefined to a numeric fallback so sliders work.
            ; (settings as Record<string, unknown>)[key as string] = fallback
        }
    }
    const Lmin = Math.min(settings.spaceBoundaryX, settings.spaceBoundaryY, settings.spaceBoundaryZ) || 1
    // Heuristic defaults: alpha ~ 5/Lmin, kMax modest integer for starter performance.
    ensureProp('ewaldAlpha' as keyof SettingsLike, 5 / Lmin)
    ensureProp('ewaldKMax' as keyof SettingsLike, 6)
    const gui = new GUI(); _activeGui = gui
    const guiFolderWorld = gui.addFolder('World building')
    guiFolderWorld.add(settings, 'if_constant_temperature').name('Constant T')
    guiFolderWorld.add(settings, 'targetTemperature').name('Target temp.')
    const guiFolderParameters = guiFolderWorld.addFolder('Parameters')
    guiFolderParameters.add(settings, 'particleCount')
    guiFolderParameters.add(settings, 'dt')
    // Enforce LJ cutoff not exceeding half-box length (minimum of half-lengths) for physical correctness under PBC.
    const cutoffController = guiFolderParameters.add(settings, 'cutoffDistance').name('Cutoff')
    const clampCutoff = () => {
        const maxHalf = Math.min(settings.spaceBoundaryX, settings.spaceBoundaryY, settings.spaceBoundaryZ)
        if (settings.cutoffDistance > maxHalf) settings.cutoffDistance = maxHalf
        if (settings.cutoffDistance <= 0) settings.cutoffDistance = maxHalf * 0.1 // arbitrary small positive default
        cutoffController.updateDisplay()
    }
    cutoffController.onChange(clampCutoff)
    guiFolderParameters.add(settings, 'integrator', { 'Velocity Verlet': 'velocityVerlet', 'Euler': 'euler' }).name('Integrator')
    guiFolderParameters.add(settings, 'neighborStrategy', { 'Cell': 'cell', 'Naive': 'naive' }).name('Neighbor list')
    const guiFolderConstants = guiFolderWorld.addFolder('Physical Constants')
    guiFolderConstants.add(settings, 'EPSILON')
    guiFolderConstants.add(settings, 'DELTA')
    guiFolderConstants.add(settings, 'G')
    guiFolderConstants.add(settings, 'K')
    guiFolderConstants.add(settings, 'kB').name('kB')
    const guiFolderEwald = guiFolderWorld.addFolder('Ewald (PBC long-range)')
    try {
        guiFolderEwald.add(settings, 'ewaldAlpha').name('Alpha').onChange(() => { /* engine auto-push will rebuild forces */ })
    } catch (e) {
        console.error('Failed adding ewaldAlpha controller; settings keys present?', e, settings)
    }
    try {
        guiFolderEwald.add(settings, 'ewaldKMax').name('kMax').onChange(() => { /* engine auto-push will rebuild forces */ })
    } catch (e) {
        console.error('Failed adding ewaldKMax controller; settings keys present?', e, settings)
    }
    const guiFolderBoundary = guiFolderWorld.addFolder('Universe boundary')
    guiFolderBoundary.add(settings, 'if_showUniverseBoundary')
    guiFolderBoundary.add(settings, 'if_use_periodic_boundary_condition').name('Use PBC')
    const guiFolderSize = guiFolderBoundary.addFolder('Custom size')
    const wrapBoxChange = (axis: 'spaceBoundaryX' | 'spaceBoundaryY' | 'spaceBoundaryZ', update: () => void) => () => { update(); clampCutoff(); cutoffController.updateDisplay() }
    guiFolderSize.add(settings, 'spaceBoundaryX').name('Size, X').onChange(wrapBoxChange('spaceBoundaryX', () => { if (boxMesh) boxMesh.scale.x = settings.spaceBoundaryX / originalSpaceBoundaryX }))
    guiFolderSize.add(settings, 'spaceBoundaryY').name('Size, Y').onChange(wrapBoxChange('spaceBoundaryY', () => { if (boxMesh) boxMesh.scale.y = settings.spaceBoundaryY / originalSpaceBoundaryY }))
    guiFolderSize.add(settings, 'spaceBoundaryZ').name('Size, Z').onChange(wrapBoxChange('spaceBoundaryZ', () => { if (boxMesh) boxMesh.scale.z = settings.spaceBoundaryZ / originalSpaceBoundaryZ }))
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
                boxMesh.scale.x = settings.spaceBoundaryX / originalSpaceBoundaryX
                boxMesh.scale.y = settings.spaceBoundaryY / originalSpaceBoundaryY
                boxMesh.scale.z = settings.spaceBoundaryZ / originalSpaceBoundaryZ
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
