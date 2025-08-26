import { settings, normalizeSettings } from './settings.js'
import { lsGet, lsRemove, lsSet } from '../util/storage.js'
import { canonicalizeIntegrator, canonicalizeNeighborStrategy, canonicalizeReferenceFrame } from '../util/canonical.js'

const SETTINGS_KEY = 'mdJsUserSettings'
const VERSION = 3 as const

interface StoredSettingsV3 { __v: typeof VERSION; data: Record<string, unknown> }

/**
 * Persist current UI settings (function properties & transient objects stripped).
 * The object is shallow‑cloned; nested structures (arrays) are JSON‑serialized anyway.
 */
export function saveSettingsToLocal(): void {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(settings as Record<string, unknown>)) {
        if (typeof v === 'function') continue
        out[k] = v
    }
    lsSet(SETTINGS_KEY, { __v: VERSION, data: out } satisfies StoredSettingsV3)
}

/** Load persisted settings (if present) and canonicalize derived values. */
export function loadSettingsFromLocal(): boolean {
    const raw = lsGet<unknown>(SETTINGS_KEY)
    if (!raw || typeof raw !== 'object') return false
    const ver = (raw as { __v?: number }).__v
        let data: Record<string, unknown> | undefined
        if (ver === VERSION) {
            data = (raw as { data?: unknown }).data as Record<string, unknown> | undefined
        } else if (ver == null) { // legacy (v2 or earlier) stored object directly
            data = raw as Record<string, unknown>
        }
    if (!data) return false
    Object.assign(settings, data)
    // Canonicalize enum-like string settings via centralized helpers
    ; (settings as Record<string, unknown>).integrator = canonicalizeIntegrator((settings as Record<string, unknown>).integrator)
    ; (settings as Record<string, unknown>).neighborStrategy = canonicalizeNeighborStrategy((settings as Record<string, unknown>).neighborStrategy)
    ; (settings as Record<string, unknown>).referenceFrameMode = canonicalizeReferenceFrame((settings as Record<string, unknown>).referenceFrameMode)
    normalizeSettings(settings)
    return true
}

/** Clear persisted settings from localStorage. */
export function clearSettingsInLocal(): void { lsRemove(SETTINGS_KEY) }
