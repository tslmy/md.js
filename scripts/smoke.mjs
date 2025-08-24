// Headless smoke test for md.js
import { spawn, execFileSync } from 'node:child_process'
import net from 'node:net'
import http from 'node:http'
import puppeteer from 'puppeteer'

async function main () {
  console.log('[smoke] Building project...')
  execFileSync('npm', ['run', 'build', '--silent'], { stdio: 'inherit' })

  console.log('[smoke] Starting static server...')
  // Find a free port (attempt starting at 8123)
  async function findPort (start = 8123) {
    const attempt = (p) => new Promise((resolve) => {
      const srv = net.createServer()
      srv.once('error', () => resolve(0))
      srv.listen(p, () => { srv.close(() => resolve(p)) })
    })
    for (let p = start; p < start + 50; p++) {
      const got = await attempt(p)
      if (got) return got
    }
    throw new Error('No free port found')
  }
  const port = await findPort()
  const server = spawn('python', ['-m', 'http.server', String(port), '--directory', '.'], { stdio: 'ignore' })

  const cleanup = async (code = 0) => {
    try { server.kill() } catch { /* ignore */ }
    process.exit(code)
  }

  // Poll for server readiness
  async function waitForServer (retries = 40) {
    for (let i = 0; i < retries; i++) {
      const ok = await new Promise(resolve => {
        const req = http.request({ method: 'HEAD', host: 'localhost', port, path: '/index.html' }, res => {
          resolve(res.statusCode >= 200 && res.statusCode < 500)
        })
        req.on('error', () => resolve(false))
        req.end()
      })
      if (ok) return
      await new Promise(r => setTimeout(r, 250))
    }
    throw new Error('Server did not become ready')
  }
  await waitForServer()

  const browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  const consoleMessages = []
  page.on('console', msg => consoleMessages.push(msg.text()))

  console.log('[smoke] Loading page...')
  await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'load', timeout: 20000 })

  // Pull initial state
  const initial = await page.evaluate(() => {
    const api = (typeof globalThis !== 'undefined' && globalThis.__mdjs) ? globalThis.__mdjs : undefined
    return {
      present: !!api,
      count: api?.particles?.length ?? 0,
      firstPositions: api?.particles?.slice(0, 5).map(p => ({ x: p.position.x, y: p.position.y, z: p.position.z })) ?? []
    }
  })
  if (!initial.present) {
    console.error('[smoke] FAIL: __mdjs handle not present')
    await browser.close(); await cleanup(1)
  }
  console.log(`[smoke] Particle count: ${initial.count}`)
  if (initial.count === 0) {
    console.error('[smoke] FAIL: zero particles')
    await browser.close(); await cleanup(1)
  }

  // Let simulation advance a few frames
  await new Promise(r => setTimeout(r, 500))
  const after = await page.evaluate(() => {
    const api = (typeof globalThis !== 'undefined' && globalThis.__mdjs) ? globalThis.__mdjs : undefined
    return api?.particles?.slice(0, 5).map(p => ({ x: p.position.x, y: p.position.y, z: p.position.z })) ?? []
  })
  const moved = initial.firstPositions.some((p, i) => {
    const q = after[i]
    if (!q) return false
    const dx = Math.abs(p.x - q.x)
    const dy = Math.abs(p.y - q.y)
    const dz = Math.abs(p.z - q.z)
    return dx + dy + dz > 1e-6
  })
  if (!moved) {
    console.error('[smoke] FAIL: Particles did not move')
    await browser.close(); await cleanup(1)
  }
  console.log('[smoke] Motion detected.')

  // Trigger persistence by navigating away and back (reload triggers beforeunload)
  await page.reload({ waitUntil: 'load' })
  await new Promise(r => setTimeout(r, 300))
  // Inspect localStorage and engine time to ensure snapshot loaded (time > 0 or key exists)
  const persisted = await page.evaluate(() => {
    const key = 'mdJsEngineSnapshot'
    const raw = localStorage.getItem(key)
    const time = (globalThis.__mdjs?.simState?.time) || 0
    return { hasKey: !!raw, time }
  })
  if (!persisted.hasKey) {
    console.error('[smoke] FAIL: engine snapshot key missing after reload')
    await browser.close(); await cleanup(1)
  }
  console.log('[smoke] Persistence verified (time=' + persisted.time.toFixed(3) + ').')

  await browser.close()
  console.log('[smoke] PASS')
  await cleanup(0)
}

main().catch(err => {
  console.error('[smoke] ERROR:', err)
  process.exit(1)
})
