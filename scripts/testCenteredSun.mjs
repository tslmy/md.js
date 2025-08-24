// Test that the first particle (sun) stays near origin when centering enabled.
import { spawn, execFileSync } from 'node:child_process'
import puppeteer from 'puppeteer'
import { waitForServer } from './testUtil.mjs'

async function main () {
  console.log('[center] Build...')
  execFileSync('npm', ['run', 'build', '--silent'], { stdio: 'inherit' })
  const port = 8124
  console.log('[center] Start server...')
  const server = spawn('python', ['-m', 'http.server', String(port), '--directory', '.'], { stdio: 'ignore' })
  const cleanup = async (code = 0) => { try { server.kill() } catch { /* intentionally ignore */ } process.exit(code) }
  
  // Wait for server to be ready instead of fixed delay
  try {
    await waitForServer(port, 15, 200) // 15 retries * 200ms = max 3 seconds
  } catch (err) {
    console.error('[center] FAIL: Server startup timeout')
    await cleanup(1)
  }
  
  const browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'load', timeout: 10000 })
  
  // Let simulation run a bit - reduced from 400ms to 200ms
  await new Promise(r => setTimeout(r, 200))
  const data = await page.evaluate(() => {
    // eslint-disable-next-line no-undef
    const api = window.__mdjs
    if (!api) return null
    const p0 = api.particles[0]
    return { x: p0.position.x, y: p0.position.y, z: p0.position.z }
  })
  if (!data) {
    console.error('[center] FAIL: api unavailable')
    await browser.close(); await cleanup(1)
  }
  const dist = Math.sqrt(data.x * data.x + data.y * data.y + data.z * data.z)
  const tolerance = 1e-2 // since we subtract frame offset each frame
  if (dist > tolerance) {
    console.error(`[center] FAIL: sun not centered dist=${dist}`)
    await browser.close(); await cleanup(1)
  }
  console.log('[center] Sun centered OK (dist=' + dist.toExponential(3) + ')')
  await browser.close(); await cleanup(0)
}

main().catch(e => { console.error('[center] ERROR', e); process.exit(1) })
