import { describe, it, expect } from 'vitest'
import puppeteer from 'puppeteer'
import http from 'node:http'
import { execFileSync, spawn } from 'node:child_process'
import net from 'node:net'

async function findPort(start = 8123) {
  const attempt = (p: number) => new Promise<number>(resolve => {
    const srv = net.createServer()
    srv.once('error', () => resolve(0))
    srv.listen(p, () => { srv.close(() => resolve(p)) })
  })
  for (let p = start; p < start + 50; p++) {
    const got = await attempt(p)
    if (got) return got
  }
  throw new Error('No free port')
}

async function waitForServer(port: number, retries = 40) {
  for (let i = 0; i < retries; i++) {
    const ok = await new Promise<boolean>(resolve => {
      const req = http.request({ method: 'HEAD', host: 'localhost', port, path: '/index.html' }, res => {
        resolve(res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 500)
      })
      req.on('error', () => resolve(false))
      req.end()
    })
    if (ok) return
    await new Promise(r => setTimeout(r, 200))
  }
  throw new Error('Server not ready')
}

type ParticleLike = { position: { x: number; y: number; z: number } }
type MdJsApi = { particles?: ParticleLike[]; settings?: { referenceFrameMode: string }; simState?: { time: number } }

describe('browser integration', () => {
  it('smoke: page loads, particles move, persistence stores snapshot', async () => {
    execFileSync('npm', ['run', 'build', '--silent'], { stdio: 'inherit' })
    const port = await findPort()
    const server = spawn('python', ['-m', 'http.server', String(port), '--directory', '.'], { stdio: 'ignore' })
    try {
      await waitForServer(port)
  const browser = await puppeteer.launch({ headless: true })
      const page = await browser.newPage()
      await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'load', timeout: 20000 })
      const initial = await page.evaluate(() => {
        const api = (globalThis as unknown as { __mdjs?: MdJsApi }).__mdjs
        const first = (api?.particles || []).slice(0,5).map((p: ParticleLike) => ({ x: p.position.x, y: p.position.y, z: p.position.z }))
        return { count: api?.particles?.length || 0, first }
      })
      expect(initial.count).toBeGreaterThan(0)
      await new Promise(r => setTimeout(r, 500))
      const after = await page.evaluate(() => {
        const api = (globalThis as unknown as { __mdjs?: MdJsApi }).__mdjs
        return (api?.particles || []).slice(0,5).map((p: ParticleLike)=>({x:p.position.x,y:p.position.y,z:p.position.z}))
      })
      const moved = initial.first.some((p, i) => {
        const q = after[i]; if (!q) return false
        return Math.abs(p.x-q.x)+Math.abs(p.y-q.y)+Math.abs(p.z-q.z) > 1e-6
      })
      expect(moved).toBe(true)
      await page.reload({ waitUntil: 'load' })
      await new Promise(r => setTimeout(r, 200))
      const persisted = await page.evaluate(() => {
        const key = 'mdJsEngineSnapshot'
        const raw = localStorage.getItem(key)
        const api = (globalThis as unknown as { __mdjs?: MdJsApi }).__mdjs
        return { hasKey: !!raw, time: api?.simState?.time || 0 }
      })
      expect(persisted.hasKey).toBe(true)
      await browser.close()
    } finally {
      try { server.kill() } catch { /* ignore */ }
    }
  }, 60000)

  it('centered sun vs fixed frame behaviors', async () => {
    execFileSync('npm', ['run', 'build', '--silent'], { stdio: 'inherit' })
    const port = await findPort(8200)
    const server = spawn('python', ['-m', 'http.server', String(port), '--directory', '.'], { stdio: 'ignore' })
    try {
      await waitForServer(port)
  const browser = await puppeteer.launch({ headless: true })
      const page = await browser.newPage()
      await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'load', timeout: 15000 })
      await new Promise(r => setTimeout(r, 400))
      const distCentered = await page.evaluate(() => {
        const api = (globalThis as unknown as { __mdjs?: MdJsApi }).__mdjs
        const p0 = api?.particles?.[0]
        if (!p0) return null
        return Math.hypot(p0.position.x,p0.position.y,p0.position.z)
      })
      expect(distCentered).not.toBeNull()
      expect(distCentered as number).toBeLessThan(0.05)
      // Disable centering and measure drift
      await page.evaluate(() => {
        const api = (globalThis as unknown as { __mdjs?: MdJsApi }).__mdjs
        if (api && api.settings) api.settings.referenceFrameMode = 'fixed'
      })
      const start = await page.evaluate(() => {
        const api = (globalThis as unknown as { __mdjs?: MdJsApi }).__mdjs
        const p0 = api?.particles?.[0]
        if(!p0) return null
        return Math.hypot(p0.position.x,p0.position.y,p0.position.z)
      })
      await new Promise(r => setTimeout(r, 1200))
      const after = await page.evaluate(() => {
        const api = (globalThis as unknown as { __mdjs?: MdJsApi }).__mdjs
        const p0 = api?.particles?.[0]
        if(!p0) return null
        return Math.hypot(p0.position.x,p0.position.y,p0.position.z)
      })
      expect(after).not.toBeNull()
      expect((after as number) - (start as number)).toBeGreaterThan(5e-4)
      await browser.close()
    } finally { try { server.kill() } catch { /* ignore */ } }
  }, 90000)
})
