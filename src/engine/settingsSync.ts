import { SimulationEngine } from './SimulationEngine.js'
import { fromSettings, type EngineConfig } from './config/types.js'
import { settings } from '../settings.js'

/**
 * Two-way synchronization helpers between legacy mutable `settings` object
 * (dat.GUI bound) and the new SimulationEngine configuration/state.
 *
 * Design goals:
 *  - Keep legacy UI decoupled from internal engine config structure.
 *  - Allow user tweaking GUI controls to patch engine live.
 *  - Reflect engine-driven structural changes (e.g. particle count resize)
 *    back into the settings object so UI stays consistent.
 *
 * This module is intentionally minimal and can evolve toward a declarative
 * schema + diffing approach later. For now we perform targeted field copies.
 */

/** Apply selected fields from settings into an EngineConfig patch and send to engine. */
export function pushSettingsToEngine(engine: SimulationEngine): void {
    const patch: Partial<EngineConfig> = {
        world: { particleCount: settings.particleCount, box: { x: settings.spaceBoundaryX, y: settings.spaceBoundaryY, z: settings.spaceBoundaryZ } },
        runtime: { dt: settings.dt, cutoff: settings.cutoffDistance },
        forces: {
            lennardJones: !!settings.if_apply_LJpotential,
            gravity: !!settings.if_apply_gravitation,
            coulomb: !!settings.if_apply_coulombForce
        },
        constants: {
            epsilon: settings.EPSILON,
            sigma: settings.DELTA,
            G: settings.G,
            K: settings.K,
            kB: settings.kB
        }
    }
    engine.updateConfig(patch)
}

/** Mirror core engine config changes back into UI settings (subset). */
export function pullEngineConfigToSettings(cfg: EngineConfig): void {
    settings.particleCount = cfg.world.particleCount
    settings.spaceBoundaryX = cfg.world.box.x
    settings.spaceBoundaryY = cfg.world.box.y
    settings.spaceBoundaryZ = cfg.world.box.z
    settings.dt = cfg.runtime.dt
    settings.cutoffDistance = cfg.runtime.cutoff
    settings.if_apply_LJpotential = cfg.forces.lennardJones
    settings.if_apply_gravitation = cfg.forces.gravity
    settings.if_apply_coulombForce = cfg.forces.coulomb
    settings.EPSILON = cfg.constants.epsilon
    settings.DELTA = cfg.constants.sigma
    settings.G = cfg.constants.G
    settings.K = cfg.constants.K
    settings.kB = cfg.constants.kB
}

/** Initialize synchronization: one initial push, then subscribe to engine events. */
export function initSettingsSync(engine: SimulationEngine): void {
    // Initial pull to update legacy settings reference (engine likely created from them already)
    pullEngineConfigToSettings(engine.getConfig())
    // Listen for engine config patches
    engine.on('config', cfg => { pullEngineConfigToSettings(cfg) })
    // On state reallocation reflect particleCount (already in config event also)
    engine.on('stateReallocated', () => { /* no-op; config event covers count */ })
}

/** Construct a brand new engine from current settings (one-way). */
export function createEngineFromSettings(): SimulationEngine {
    const cfg = fromSettings(settings)
    return new SimulationEngine(cfg)
}
