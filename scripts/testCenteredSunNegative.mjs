// Negative test: when centering is disabled, the first particle should drift (distance grows beyond tolerance)
/* eslint-disable no-undef */
import { spawn, execFileSync } from 'node:child_process'
import puppeteer from 'puppeteer'

async function main () {
  console.log('[center-neg] Build...')
  execFileSync('npm', ['run', 'build', '--silent'], { stdio: 'inherit' })
  const port = 8125
  console.log('[center-neg] Start server...')
  const server = spawn('python', ['-m', 'http.server', String(port), '--directory', '.'], { stdio: 'ignore' })
  const cleanup = async (code = 0) => { try { server.kill() } catch { /* ignore */ } process.exit(code) }
  await new Promise(r => setTimeout(r, 800))
  const browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'load', timeout: 15000 })
  // Disable centering in-page
  await page.evaluate(() => { if (window.__mdjs) window.__mdjs.settings.if_ReferenceFrame_movesWithSun = false })
  const start = await page.evaluate(() => {
    const api = window.__mdjs
    const p0 = api?.particles?.[0]
    if (!p0) return null
    return { x: p0.position.x, y: p0.position.y, z: p0.position.z }
  })
  if (!start) {
    console.error('[center-neg] FAIL: no initial particle 0')
    await browser.close(); await cleanup(1)
  }
  // Let simulation run (longer for Verlet which can conserve better and may show slower drift)
  await new Promise(r => setTimeout(r, 1600))
  const after = await page.evaluate(() => {
    const api = window.__mdjs
    const p0 = api?.particles?.[0]
    if (!p0) return null
    return { x: p0.position.x, y: p0.position.y, z: p0.position.z }
  })
  if (!after) {
    console.error('[center-neg] FAIL: no final particle 0')
    await browser.close(); await cleanup(1)
  }
  const distStart = Math.hypot(start.x, start.y, start.z)
  const distAfter = Math.hypot(after.x, after.y, after.z)
  if (distAfter <= distStart + 5e-4) { // tighter threshold, still expect increase
    console.error(`[center-neg] FAIL: sun still centered or insufficient drift distStart=${distStart} distAfter=${distAfter}`)
    await browser.close(); await cleanup(1)
  }
  console.log(`[center-neg] PASS: dist increased ${distStart} -> ${distAfter}`)
  await browser.close(); await cleanup(0)
}

main().catch(e => { console.error('[center-neg] ERROR', e); process.exit(1) })
