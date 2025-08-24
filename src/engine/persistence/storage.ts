/**
 * Browser storage helpers built atop engine snapshot persistence.
 *
 * Keeps localStorage concerns out of core snapshot logic so the core remains
 * platform-agnostic (could later persist to IndexedDB, postMessage, etc.).
 */
import { snapshot, hydrate, type EngineSnapshot } from './persist.js'
import { SimulationEngine } from '../SimulationEngine.js'
import { saveUserSettings } from '../../control/persistence/persist.js'

const KEY = 'mdJsEngineSnapshot'


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

/**
 * Clear any persisted engine snapshot (and legacy state key) then hard-reload the page
 * to construct a fresh universe. Mirrors previous `clearState` behavior.
 */
export function resetWorld(): void {
  try {
    // Persist current (possibly tweaked) settings so after reload we build a fresh world using them.
    saveUserSettings()
    clearStoredSnapshot()
  } catch (e) {
    console.warn('Failed clearing stored snapshot(s):', e)
  }
  // Prevent saving the soon-to-be-discarded state during reload
  try { window.onbeforeunload = null } catch { /* ignore */ }
  location.reload()
}
