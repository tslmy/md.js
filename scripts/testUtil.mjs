export function assert(cond, msg) { if (!cond) { console.error('[assert] FAIL:', msg); process.exit(1) } }
export function approx(a, b, eps = 1e-6) { return Math.abs(a - b) < eps }
// Deterministic LCG
export function makeLCG(seed = 1) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff }
}
