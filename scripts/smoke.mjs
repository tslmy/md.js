// Headless smoke test for md.js
import { spawn, execFileSync } from 'node:child_process'
import puppeteer from 'puppeteer'

async function main () {
  console.log('[smoke] Building project...')
  execFileSync('npm', ['run', 'build', '--silent'], { stdio: 'inherit' })

  console.log('[smoke] Starting static server...')
  const port = 8123
  const server = spawn('python', ['-m', 'http.server', String(port), '--directory', '.'], { stdio: 'inherit' })

  const cleanup = async (code = 0) => {
    try { server.kill() } catch {}
    process.exit(code)
  }

  // Give server a moment
  await new Promise(r => setTimeout(r, 800))

  const browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  const consoleMessages = []
  page.on('console', msg => consoleMessages.push(msg.text()))

  console.log('[smoke] Loading page...')
  await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'load', timeout: 15000 })

  // Pull initial state
  const initial = await page.evaluate(() => {
    const api = window.__mdjs
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
    const api = window.__mdjs
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

  // Trigger persistence by reloading (onbeforeunload should have saved state)
  await page.reload({ waitUntil: 'load' })
  // Allow loadState logging
  await new Promise(r => setTimeout(r, 300))
  const loadedMsg = consoleMessages.find(m => m.includes('State from previous session loaded.'))
  if (!loadedMsg) {
    console.error('[smoke] FAIL: Did not detect persistence load message')
    await browser.close(); await cleanup(1)
  }
  console.log('[smoke] Persistence verified.')

  await browser.close()
  console.log('[smoke] PASS')
  await cleanup(0)
}

main().catch(err => {
  console.error('[smoke] ERROR:', err)
  process.exit(1)
})
