import { settings } from './settings.js'
const SETTINGS_KEY = 'mdJsUserSettings'

// We now persist the full settings object (JSON-serializable fields only) for broader config retention.
// Backward compatibility: if an older (subset) object is found, we still map its fields.

/** Persist current UI settings (full object). */
export function saveSettingsToLocal(): void {
    try {
        const clone: Record<string, unknown> = {}
        const src: Record<string, unknown> = settings as unknown as Record<string, unknown>
        for (const k of Object.keys(src)) {
            const v = src[k]
            if (typeof v !== 'function') clone[k] = v
        }
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({ __v: 2, data: clone }))
    } catch { /* ignore */ }
}

/** Load persisted settings into mutable settings object (if present). */
export function loadSettingsFromLocal(): boolean {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY)
        if (!raw) return false
        const parsed = JSON.parse(raw)
        let data: unknown
        if (parsed && parsed.__v === 2 && parsed.data) {
            data = parsed.data
        } else {
            // Legacy subset layout
            data = parsed
        }
        if (!data) return false
        if (data && typeof data === 'object') Object.assign(settings, data as Record<string, unknown>)
        return true
    } catch { return false }
}

/** Clear persisted settings from localStorage. */
export function clearSettingsInLocal(): void {
    try {
        localStorage.removeItem(SETTINGS_KEY)
    } catch { /* ignore */ }
}
