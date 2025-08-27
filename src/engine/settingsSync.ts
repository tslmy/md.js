/**
 * Two-way synchronization helpers between mutable `settings` object
 * and the new SimulationEngine configuration/state.
 *
 * Design goals:
 *  - Allow user tweaking controls on the GUI to patch engine live.
 *  - Reflect engine-driven structural changes (e.g. particle count resize)
 *    back into the settings object so UI stays consistent.
 */
import { SimulationEngine } from './SimulationEngine.js'
import { type EngineConfig } from './config.js'
import { settings } from '../control/settings.js'
import { getAutoEngineBindings } from '../control/settingsSchema.js'

// Guard to avoid recursive push->engine->config event->pull->property set->push loops.
let suppressAutoPush = false

// Derive binding descriptors straight from unified SETTINGS_SCHEMA (single source of truth)
// Reuse exported helper for auto engine bindings (deduping schema traversal logic)
const BINDINGS = getAutoEngineBindings()

/** Keys that participate in automatic push/pull with the engine (wrapped setters). */
export const AUTO_PUSH_KEYS = BINDINGS.map(b => b.key) as readonly string[]
export type AutoPushKey = (typeof AUTO_PUSH_KEYS)[number]

// Utility: get value at dot path
function pick(cfg: EngineConfig, path: string): unknown {
    const segs = path.split('.')
    let cur: unknown = cfg
    for (const s of segs) {
        if (cur == null || typeof cur !== 'object') return undefined
        cur = (cur as Record<string, unknown>)[s]
    }
    return cur
}
// Utility: assign value creating intermediate objects
function assignPath(root: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split('.')
    let obj: Record<string, unknown> = root
    for (let i = 0; i < parts.length - 1; i++) {
        const p = parts[i]
        let next = obj[p]
        if (next == null || typeof next !== 'object') { next = {}; obj[p] = next }
        obj = next as Record<string, unknown>
    }
    obj[parts[parts.length - 1]] = value
}


/**
 * Build a shallow EngineConfig patch from current settings object and apply via engine.updateConfig.
 * Skips work if an internal pull operation is in progress (suppressAutoPush flag).
 */
export function pushSettingsToEngine(engine: SimulationEngine): void {
    if (suppressAutoPush) return
    const patch: Partial<EngineConfig> = {}
    for (const b of BINDINGS) {
        const val = settings[b.key as keyof typeof settings]
        assignPath(patch as unknown as Record<string, unknown>, b.path, val)
    }
    engine.updateConfig(patch)
}

/**
 * Reflect engine config values back into settings (one-way). Used when engine applies a patch or resizes state.
 * Temporarily disables auto-push to avoid feedback loops.
 */
export function pullEngineConfigToSettings(cfg: EngineConfig): void {
    suppressAutoPush = true
    try {
        for (const b of BINDINGS) (settings as unknown as Record<string, unknown>)[b.key] = pick(cfg, b.path)
    } finally {
        suppressAutoPush = false
    }
}

/** Initialize bidirectional settings <-> engine synchronization (install config listener). */
export function initSettingsSync(engine: SimulationEngine): void {
    // Initial pull to update legacy settings reference (engine likely created from them already)
    pullEngineConfigToSettings(engine.getConfig())
    // Listen for engine config patches
    engine.on('config', cfg => { pullEngineConfigToSettings(cfg) })
}

/**
 * Monkey-patch selected settings properties with accessor descriptors so that mutation triggers a (debounced) push.
 * Debounce prevents excessive engine rebuilds while dragging sliders.
 */
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
        let value = settings[k as keyof typeof settings]
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
