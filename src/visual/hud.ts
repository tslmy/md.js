/**
 * HUD (Heads-Up Display) & per-particle data sheet utilities.
 *
 * Responsibilities:
 *  - Build table rows per particle (color swatch + scalar metrics).
 *  - Maintain tiny inline sparklines (rolling ~30s history) for dynamic metrics.
 *  - Render adaptive-precision numeric values alongside the sparklines.
 *  - Provide lightweight adaptive autoscaling (immediate grow, damped decay) for each metric.
 *
 * Design Notes:
 *  - Intentionally framework-agnostic & independent of THREE.js so it can be tested in isolation.
 *  - Sparklines are custom (minimal) to avoid bundling friction from external CJS libs.
 *  - Each sparkline keeps a bounded ring buffer (SPARK_CAP) and re-renders only when a new
 *    sample is accepted (>= SAMPLE_INTERVAL_MS since last sample).
 */

import { Color } from 'three'

/** Simplified HUD refactor: encapsulated in HudTable class (no backward-compatible exports). */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ParticleDynamicData {
  mass: number
  charge: number
  vx: number; vy: number; vz: number
  fx: number; fy: number; fz: number
  perForce?: Record<string, Float32Array>
}

export class HudTable {
  private readonly rows: HTMLTableRowElement[] = []
  private readonly sparkCells: SparkCell[][] = [] // [particle][metricIndex]
  private readonly metricList = METRICS
  constructor(private readonly particleCount: number, private readonly colors: Color[]) {
    const tbody = document.querySelector('#tabularInfo > tbody')
    if (!tbody) return
    for (let i = 0; i < this.particleCount; i++) {
      const row = document.createElement('tr')
      // color / particle cell
      const pCell = document.createElement('td')
      pCell.className = 'particle'
      pCell.textContent = '⬤'
      pCell.style.color = '#' + this.colors[i].getHexString()
      row.appendChild(pCell)
      // metric cells
      const sparkRow: SparkCell[] = []
      for (const m of this.metricList) {
        const td = document.createElement('td'); td.className = m.id
        if (m.type === 'spark') {
          const sc = createSparkCell()
          sc.span.classList.add('val')
          td.appendChild(sc.span)
          td.appendChild(sc.canvas)
          sparkRow.push(sc)
        }
        row.appendChild(td)
      }
      tbody.appendChild(row)
      this.rows[i] = row
      this.sparkCells[i] = sparkRow
    }
  }
  update(i: number, data: ParticleDynamicData): void {
    const row = this.rows[i]
    if (!row) return
    const speed2 = data.vx * data.vx + data.vy * data.vy + data.vz * data.vz
    const speed = Math.sqrt(speed2)
    const ke = 0.5 * speed2 * data.mass
    const totalF = Math.hypot(data.fx, data.fy, data.fz)
    // Static-ish
    this.setCell(i, 'mass', formatMassCharge(data.mass))
    this.setCell(i, 'charge', formatCharge(data.charge))
    // Dynamics
    this.setMetric(i, 'speed', speed)
    this.setMetric(i, 'kineticEnergy', ke)
    this.setMetric(i, 'TotalForceStrength', totalF)
    if (data.perForce) this.updatePerForce(i, data.perForce)
  }
  private setCell(i: number, metricId: string, text: string): void {
    const row = this.rows[i]; if (!row) return
    const td = row.querySelector<HTMLTableCellElement>('td.' + metricId)
    if (td) td.textContent = text
  }
  private setMetric(i: number, metricId: SparkMetricId, value: number): void {
    const metricIndex = SPARK_METRIC_INDEX[metricId]
    const sparkCell = this.sparkCells[i][metricIndex]
    if (!sparkCell) return
    const now = performance.now()
    sparkCell.update(value, now)
  }
  private updatePerForce(i: number, perForce: Record<string, Float32Array>): void {
    const i3 = 3 * i
    const map: Record<string, SparkMetricId> = {
      lennardJones: 'LJForceStrength',
      gravity: 'GravitationForceStrength',
      coulomb: 'CoulombForceStrength'
    }
    for (const [name, arr] of Object.entries(perForce)) {
      const metric = map[name]; if (!metric) continue
      const mag = Math.hypot(arr[i3], arr[i3 + 1], arr[i3 + 2])
      this.setMetric(i, metric, mag)
    }
  }
}

let _hud: HudTable | null = null
export function initHud(particleCount: number, colors: Color[]): HudTable {
  _hud = new HudTable(particleCount, colors)
  return _hud
}
export function getHud(): HudTable | null { return _hud }

// ---------------------------------------------------------------------------
// Sparkline implementation (minimal & self-contained)
// ---------------------------------------------------------------------------

type SparkMetricId = 'speed' | 'kineticEnergy' | 'LJForceStrength' | 'GravitationForceStrength' | 'CoulombForceStrength' | 'TotalForceStrength'

interface MetricDescriptor { id: string; type: 'plain' | 'spark' }
const METRICS: MetricDescriptor[] = [
  { id: 'mass', type: 'plain' },
  { id: 'charge', type: 'plain' },
  { id: 'speed', type: 'spark' },
  { id: 'kineticEnergy', type: 'spark' },
  { id: 'LJForceStrength', type: 'spark' },
  { id: 'GravitationForceStrength', type: 'spark' },
  { id: 'CoulombForceStrength', type: 'spark' },
  { id: 'TotalForceStrength', type: 'spark' }
]
const SPARK_METRICS = METRICS.filter(m => m.type === 'spark').map(m => m.id) as SparkMetricId[]
const SPARK_METRIC_INDEX: Record<SparkMetricId, number> = SPARK_METRICS.reduce((acc, id, idx) => { acc[id] = idx; return acc }, {} as Record<SparkMetricId, number>)

const SPARK_CAP = 300
const SAMPLE_INTERVAL_MS = 100

class SparkCell {
  series: number[] = []
  lastSample = 0
  displayMax = 1
  readonly canvas: HTMLCanvasElement
  readonly span: HTMLSpanElement
  private readonly ctx: CanvasRenderingContext2D
  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.width = 60; this.canvas.height = 18
    this.canvas.style.display = 'block'
    this.canvas.style.width = '60px'; this.canvas.style.height = '18px'
    this.span = document.createElement('span')
    this.span.style.display = 'block'
    this.span.style.fontSize = '10px'
    this.span.style.lineHeight = '10px'
    this.span.style.marginBottom = '2px'
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D
  }
  update(v: number, now: number): void {
    if (now - this.lastSample < SAMPLE_INTERVAL_MS) return
    this.lastSample = now
    this.series.push(v)
    if (this.series.length > SPARK_CAP) this.series.shift()
    this.displayMax = adjustDisplayMax(this.series, this.displayMax)
    this.span.textContent = formatDynamic(v)
    drawSpark(this.ctx, this.canvas, this.series, this.displayMax)
  }
}

function createSparkCell(): SparkCell { return new SparkCell() }

function drawSpark(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, data: number[], maxVal: number): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (!data.length) return
  const w = canvas.width; const h = canvas.height; const max = maxVal > 0 ? maxVal : 1
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgb(25, 20, 86)'; ctx.beginPath()
  for (let i = 0; i < data.length; i++) {
    const x = i * (w - 1) / Math.max(1, data.length - 1)
    const y = h - 1 - Math.min(1, data[i] / max) * (h - 1)
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  }
  ctx.stroke()
}

function adjustDisplayMax(series: number[], prev: number): number {
  let rawMax = 0
  for (const v of series) if (v > rawMax) rawMax = v
  if (rawMax <= 0) rawMax = 1
  if (rawMax > prev) return rawMax
  const decay = rawMax < prev * 0.5 ? 0.9 : 0.98
  const next = Math.max(rawMax, prev * decay)
  return next < 1e-6 ? 1 : next
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatMassCharge(v: number): string { return (Math.round(v * 100) / 100).toString() }
function formatCharge(c: number): string {
  if (c === 0) return '0'
  return c > 0 ? `+${c}` : `${c}`
}
function formatDynamic(v: number): string {
  const av = Math.abs(v)
  if (av === 0) return '0'
  if (av >= 1000) return v.toExponential(2)
  if (av >= 10) return v.toFixed(2)
  if (av >= 1) return v.toFixed(3)
  if (av >= 0.01) return v.toFixed(4)
  return v.toExponential(2)
}
