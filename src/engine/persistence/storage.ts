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

interface PersistedSettings {
  particleCount: number
  spaceBoundaryX: number
  spaceBoundaryY: number
  spaceBoundaryZ: number
  cutoffDistance: number
  dt: number
  if_apply_LJpotential: boolean
  if_apply_gravitation: boolean
  if_apply_coulombForce: boolean
  EPSILON: number; DELTA: number; G: number; K: number; kB: number
}

function captureSettings(): PersistedSettings {
  return {
    particleCount: settings.particleCount,
    spaceBoundaryX: settings.spaceBoundaryX,
    spaceBoundaryY: settings.spaceBoundaryY,
    spaceBoundaryZ: settings.spaceBoundaryZ,
    cutoffDistance: settings.cutoffDistance,
    dt: settings.dt,
    if_apply_LJpotential: !!settings.if_apply_LJpotential,
    if_apply_gravitation: !!settings.if_apply_gravitation,
    if_apply_coulombForce: !!settings.if_apply_coulombForce,
    EPSILON: settings.EPSILON,
    DELTA: settings.DELTA,
    G: settings.G,
    K: settings.K,
    kB: settings.kB
  }
}

/** Persist current UI settings (subset used to build a new world). */
export function saveUserSettings(): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(captureSettings())) } catch { /* ignore */ }
}

/** Load persisted settings into mutable settings object (if present). */
export function loadUserSettings(): boolean {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return false
    const data = JSON.parse(raw) as PersistedSettings
    settings.particleCount = data.particleCount
    settings.spaceBoundaryX = data.spaceBoundaryX
    settings.spaceBoundaryY = data.spaceBoundaryY
    settings.spaceBoundaryZ = data.spaceBoundaryZ
    settings.cutoffDistance = data.cutoffDistance
    settings.dt = data.dt
    settings.if_apply_LJpotential = data.if_apply_LJpotential
    settings.if_apply_gravitation = data.if_apply_gravitation
    settings.if_apply_coulombForce = data.if_apply_coulombForce
    settings.EPSILON = data.EPSILON
    settings.DELTA = data.DELTA
    settings.G = data.G
    settings.K = data.K
    settings.kB = data.kB
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
