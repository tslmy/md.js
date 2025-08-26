import { settings, normalizeSettings } from './settings.js'
import { lsGet, lsRemove, lsSet } from '../util/storage.js'
const SETTINGS_KEY = 'mdJsUserSettings'

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
    Object.assign(settings, extractData(parsed))
    canonicalizeIntegrator()
    canonicalizeNeighborStrategy()
    ensureDefaults()
    normalizeSettings(settings)
    return true
}

function extractData(parsed: unknown): Record<string, unknown> {
    if (parsed && typeof parsed === 'object' && (parsed as { __v?: number }).__v === 2) {
        const data = (parsed as { data?: unknown }).data
        if (data && typeof data === 'object') return data as Record<string, unknown>
    }
    return (parsed && typeof parsed === 'object') ? parsed as Record<string, unknown> : {}
}

function canonicalizeIntegrator(): void {
    const raw = (settings as Record<string, unknown>).integrator
    if (typeof raw !== 'string') return
    const norm = raw.trim().toLowerCase()
        ; (settings as Record<string, unknown>).integrator = (norm === 'euler') ? 'euler' : 'velocityVerlet'
}

function canonicalizeNeighborStrategy(): void {
    const raw = (settings as Record<string, unknown>).neighborStrategy
    if (typeof raw !== 'string') return
    const norm = raw.trim().toLowerCase()
        ; (settings as Record<string, unknown>).neighborStrategy = (norm === 'cell') ? 'cell' : 'naive'
}

function ensureDefaults(): void {
    const s = settings as Record<string, unknown>
    if (typeof s.neighborStrategy !== 'string') s.neighborStrategy = 'cell'
    if (typeof s.referenceFrameMode !== 'string') s.referenceFrameMode = 'sun'
}

/** Clear persisted settings from localStorage. */
export function clearSettingsInLocal(): void { lsRemove(SETTINGS_KEY) }
