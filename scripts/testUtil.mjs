import http from 'node:http'

export function assert(cond, msg) { if (!cond) { console.error('[assert] FAIL:', msg); process.exit(1) } }
export function approx(a, b, eps = 1e-6) { return Math.abs(a - b) < eps }
// Deterministic LCG
export function makeLCG(seed = 1) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff }
}

/**
 * Poll for server readiness by checking if it responds to HTTP requests
 * @param {number} port - Server port to check
 * @param {number} maxRetries - Maximum number of retries (default: 20)
 * @param {number} retryDelay - Delay between retries in ms (default: 100)
 * @returns {Promise<void>} Resolves when server is ready, rejects on timeout
 */
export async function waitForServer(port, maxRetries = 20, retryDelay = 100) {
  for (let i = 0; i < maxRetries; i++) {
    const ready = await new Promise(resolve => {
      const req = http.request({ method: 'HEAD', host: 'localhost', port, path: '/index.html' }, res => {
        resolve(res.statusCode >= 200 && res.statusCode < 500)
      })
      req.on('error', () => resolve(false))
      req.setTimeout(1000, () => { req.destroy(); resolve(false) })
      req.end()
    })
    if (ready) return
    await new Promise(r => setTimeout(r, retryDelay))
  }
  throw new Error(`Server on port ${port} did not become ready after ${maxRetries} retries`)
}
