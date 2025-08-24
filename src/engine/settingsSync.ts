import { SimulationEngine } from './SimulationEngine.js'
import { type EngineConfig } from './config/types.js'
import { settings } from '../control/settings.js'
import { FIELD_BINDINGS, AUTO_PUSH_KEYS as BINDING_AUTO_KEYS, assignPath, pick } from './config/fieldBindings.js'

// Guard to avoid recursive push->engine->config event->pull->property set->push loops.
let suppressAutoPush = false

/** Keys that participate in automatic push/pull with the engine. */
export const AUTO_PUSH_KEYS = BINDING_AUTO_KEYS
export type AutoPushKey = typeof AUTO_PUSH_KEYS[number]

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
    if (suppressAutoPush) return
    const patch: Partial<EngineConfig> = {}
    for (const b of FIELD_BINDINGS) {
        const raw = (settings as Record<string, unknown>)[b.key]
        const val = b.toEngine ? b.toEngine(raw) : raw
        assignPath(patch as unknown as Record<string, unknown>, b.path, val)
    }
    engine.updateConfig(patch)
}

/** Mirror core engine config changes back into UI settings (subset). */
export function pullEngineConfigToSettings(cfg: EngineConfig): void {
    suppressAutoPush = true
    try {
        for (const b of FIELD_BINDINGS) {
            const v = pick(cfg, b.path)
            const mapped = b.fromEngine ? b.fromEngine(v) : v
                ; (settings as Record<string, unknown>)[b.key] = mapped
        }
    } finally {
        suppressAutoPush = false
    }
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

/** Wire a settings change handler (e.g., from dat.GUI) to automatically push to engine. */
export function registerAutoPush(engine: SimulationEngine, keys: readonly AutoPushKey[]): void {
    // Debounce pushes so slider drags don't spam reconfiguration.
    let t: number | undefined
    const handler = () => {
        if (suppressAutoPush) return
        if (t !== undefined) window.clearTimeout(t)
        t = window.setTimeout(() => { t = undefined; pushSettingsToEngine(engine) }, 50)
    }
    for (const k of keys) {
        if (!(k in settings)) continue
        const desc = Object.getOwnPropertyDescriptor(settings, k)
        if (desc?.set) continue
        let value = (settings as Record<string, unknown>)[k]
        Object.defineProperty(settings, k, {
            configurable: true,
            enumerable: true,
            get() { return value },
            set(v) {
                if (Object.is(value, v)) { value = v; return }
                value = v
                handler()
            }
        })
    }
}
// (Removed unused createEngineFromSettings; engine construction handled in script bootstrap.)
