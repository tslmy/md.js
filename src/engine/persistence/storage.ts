/**
 * Browser storage helpers built atop engine snapshot persistence.
 *
 * Keeps localStorage concerns out of core snapshot logic so the core remains
 * platform-agnostic (could later persist to IndexedDB, postMessage, etc.).
 */
import { snapshot, hydrate, type EngineSnapshot } from './persist.js'
import { SimulationEngine } from '../SimulationEngine.js'
import { settings } from '../../settings.js'

const KEY = 'mdJsEngineSnapshot'
const SETTINGS_KEY = 'mdJsUserSettings'

// We now persist the full settings object (JSON-serializable fields only) for broader config retention.
// Backward compatibility: if an older (subset) object is found, we still map its fields.

/** Persist current UI settings (full object). */
export function saveUserSettings(): void {
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
export function loadUserSettings(): boolean {
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

/** Serialize and persist the current engine snapshot into localStorage. */
export function saveToLocal(engine: SimulationEngine): void {
  try {
    const snap = snapshot(engine)
    localStorage.setItem(KEY, JSON.stringify(snap))
  } catch (e) {
    console.warn('Failed to save engine snapshot:', e)
  }
}

export interface LoadResult {
  /** Hydrated engine instance (not started). */
  engine: SimulationEngine
  /** Raw snapshot used for hydration (for UI display / diff). */
  snapshot: EngineSnapshot
}

/** Attempt to load and hydrate a previously stored snapshot; returns null if absent or invalid. */
export function loadFromLocal(): LoadResult | null {
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  try {
    const snap = JSON.parse(raw) as EngineSnapshot
    if (snap.version !== 1) {
      console.warn('Unsupported snapshot version; ignoring')
      return null
    }
    return { engine: hydrate(snap), snapshot: snap }
  } catch (e) {
    console.warn('Failed to parse stored engine snapshot:', e)
    return null
  }
}

/** Remove the stored snapshot (no-op if absent). */
export function clearStoredSnapshot(): void {
  localStorage.removeItem(KEY)
}

/** Trigger a client-side download of the current snapshot as prettified JSON. */
export function downloadSnapshot(engine: SimulationEngine): void {
  const data = JSON.stringify(snapshot(engine), null, 2)
  const a = document.createElement('a')
  a.href = 'data:application/json,' + encodeURIComponent(data)
  a.download = new Date().toISOString() + '-mdjs-snapshot.json'
  a.click()
}

/**
 * Clear any persisted engine snapshot (and legacy state key) then hard-reload the page
 * to construct a fresh universe. Mirrors previous `clearState` behavior.
 */
export function resetWorld(): void {
  try {
  // Persist current (possibly tweaked) settings so after reload we build a fresh world using them.
  saveUserSettings()
    clearStoredSnapshot()
    // Remove legacy key for users upgrading mid-session
    localStorage.removeItem('mdJsState')
  } catch (e) {
    console.warn('Failed clearing stored snapshot(s):', e)
  }
  // Prevent saving the soon-to-be-discarded state during reload
  try { window.onbeforeunload = null } catch { /* ignore */ }
  location.reload()
}
