/**
 * Browser storage helpers built atop engine snapshot persistence.
 *
 * Keeps localStorage concerns out of core snapshot logic so the core remains
 * platform-agnostic (could later persist to IndexedDB, postMessage, etc.).
 */
import { snapshot, hydrate, type EngineSnapshot } from './persist.js'
import { SimulationEngine } from '../SimulationEngine.js'

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
export function loadEngineFromLocal(): LoadResult | null {
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
export function clearEngineSnapshotInLocal(): void {
  localStorage.removeItem(KEY)
}
