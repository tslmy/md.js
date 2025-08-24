/**
 * Browser storage helpers built atop engine snapshot persistence.
 *
 * Keeps localStorage concerns out of core snapshot logic so the core remains
 * platform-agnostic (could later persist to IndexedDB, postMessage, etc.).
 */
import { snapshot, hydrate, type EngineSnapshot } from './persist.js'
import { SimulationEngine } from '../SimulationEngine.js'

const KEY = 'mdJsEngineSnapshot'

export function saveToLocal(engine: SimulationEngine): void {
  try {
    const snap = snapshot(engine)
    localStorage.setItem(KEY, JSON.stringify(snap))
  } catch (e) {
    console.warn('Failed to save engine snapshot:', e)
  }
}

export interface LoadResult {
  engine: SimulationEngine
  snapshot: EngineSnapshot
}

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

export function clearStoredSnapshot(): void {
  localStorage.removeItem(KEY)
}

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
