/**
 * This script is responsible for initializing the control panel GUI.
 */
// @ts-expect-error external import map module (no types)
import { GUI } from 'dat.gui'
import { Object3D } from 'three'

import { originalSpaceBoundaryX, originalSpaceBoundaryY, originalSpaceBoundaryZ, resetSettingsToDefaults, settings as liveSettings } from './settings.js'
import { clearEngineSnapshotInLocal } from '../engine/persistence/storage.js'
import { saveUserSettings } from './persistence/persist.js'
import { clearVisualDataInLocal } from '../visual/persistence/visual.js'

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
    const gui = new GUI(); _activeGui = gui
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
        newWorld: () => {
            try {
                // Persist current (possibly tweaked) settings so after reload we build a fresh world using them.
                saveUserSettings()
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
        randomizeParticles: () => {
            try { saveUserSettings() } catch (e) { console.warn('Failed saving user settings:', e) }
            try { clearEngineSnapshotInLocal() } catch (e) { console.warn('Failed clearing stored snapshot:', e) }
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
            try { saveUserSettings() } catch (e) { console.warn('Failed saving user settings:', e) }
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
