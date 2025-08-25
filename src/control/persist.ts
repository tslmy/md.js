import { settings } from './settings.js'
import { lsGet, lsRemove, lsSet } from '../util/storage.js'
const SETTINGS_KEY = 'mdJsUserSettings'

// We now persist the full settings object (JSON-serializable fields only) for broader config retention.
// Backward compatibility: if an older (subset) object is found, we still map its fields.

/** Persist current UI settings (full object). */
export function saveSettingsToLocal(): void {
    const clone: Record<string, unknown> = {}
    const src: Record<string, unknown> = settings as unknown as Record<string, unknown>
    for (const k of Object.keys(src)) {
        const v = src[k]
        if (typeof v !== 'function') clone[k] = v
    }
    lsSet(SETTINGS_KEY, { __v: 2, data: clone })
}

/** Load persisted settings into mutable settings object (if present). */
export function loadSettingsFromLocal(): boolean {
    const parsed = lsGet<unknown>(SETTINGS_KEY)
    if (!parsed) return false
    let data: unknown
    if ((parsed as { __v?: number; data?: unknown }).__v === 2 && (parsed as { data?: unknown }).data) {
        data = (parsed as { data: unknown }).data
    } else {
        data = parsed // legacy layout
    }
    if (data && typeof data === 'object') Object.assign(settings, data as Record<string, unknown>)
    return true
}

/** Clear persisted settings from localStorage. */
export function clearSettingsInLocal(): void { lsRemove(SETTINGS_KEY) }
