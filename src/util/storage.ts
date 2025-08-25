/** Small wrapper around localStorage with JSON helpers and safe fallbacks.
 * Centralizes try/catch + environment guard so feature modules stay lean.
 */
export function lsAvailable(): boolean {
  try { return typeof localStorage !== 'undefined' } catch { return false }
}

export function lsSet<T>(key: string, value: T): void {
  if (!lsAvailable()) return
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ }
}

export function lsGet<T>(key: string): T | null {
  if (!lsAvailable()) return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch { return null }
}

export function lsRemove(key: string): void {
  if (!lsAvailable()) return
  try { localStorage.removeItem(key) } catch { /* ignore */ }
}
