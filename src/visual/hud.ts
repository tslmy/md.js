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
 *  - Uses Bootstrap 5 for table styling and badges.
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
  private selectedRow: number | null = null
  private sortColumn: string | null = null
  private sortAscending = true
  private particleData: ParticleDynamicData[] = []
  private onParticleClick?: (particleIndex: number) => void
  private onParticleSelect?: (particleIndex: number | null) => void

  constructor(private readonly particleCount: number, private readonly colors: Color[]) {
    const tbody = document.querySelector('#tabularInfo > tbody')
    if (!tbody) return

    // Initialize particle data storage
    this.particleData = Array(particleCount).fill(null).map(() => ({
      mass: 0, charge: 0, vx: 0, vy: 0, vz: 0, fx: 0, fy: 0, fz: 0
    }))

    // Setup column sorting
    this.setupColumnSorting()

    for (let i = 0; i < this.particleCount; i++) {
      const row = document.createElement('tr')
      row.dataset.particleIndex = String(i)
      row.style.cursor = 'pointer'

      // Row click for selection
      row.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.particle-focus-btn')) return
        this.selectRow(i)
      })

      // color / particle cell
      const pCell = document.createElement('td')
      pCell.className = 'particle text-center position-relative'
      const badge = document.createElement('span')
      badge.className = 'badge rounded-pill fs-5 particle-focus-btn'
      badge.textContent = '⬤'
      badge.style.backgroundColor = '#' + this.colors[i].getHexString()
      badge.style.color = '#' + this.colors[i].getHexString()
      badge.style.cursor = 'pointer'
      badge.title = 'Click to focus camera on this particle'

      // Particle badge click for camera focus
      badge.addEventListener('click', (e) => {
        e.stopPropagation()
        if (this.onParticleClick) this.onParticleClick(i)
      })

      pCell.appendChild(badge)
      row.appendChild(pCell)

      // metric cells
      const sparkRow: SparkCell[] = []
      for (const m of this.metricList) {
        const td = document.createElement('td')
        td.className = m.id
        if (m.type === 'spark') {
          const sc = createSparkCell()
          sc.span.classList.add('val', 'text-dark', 'small', 'd-block', 'mb-1', 'fw-semibold')
          sc.span.dataset.metricId = m.id
          td.appendChild(sc.span)
          td.appendChild(sc.canvas)
          sparkRow.push(sc)
        } else {
          td.className += ' text-center'
          td.dataset.metricId = m.id
        }

        // Add tooltip on hover
        td.addEventListener('mouseenter', (e) => {
          this.showTooltip(e.currentTarget as HTMLElement, i, m.id)
        })
        td.addEventListener('mouseleave', () => {
          this.hideTooltip()
        })

        row.appendChild(td)
      }
      tbody.appendChild(row)
      this.rows[i] = row
      this.sparkCells[i] = sparkRow
    }
  }

  setParticleClickHandler(handler: (particleIndex: number) => void): void {
    this.onParticleClick = handler
  }

  setParticleSelectHandler(handler: (particleIndex: number | null) => void): void {
    this.onParticleSelect = handler
  }

  private selectRow(index: number): void {
    // Deselect previous
    if (this.selectedRow !== null) {
      this.rows[this.selectedRow]?.classList.remove('table-active')
    }

    // Select new
    if (this.selectedRow === index) {
      this.selectedRow = null
      if (this.onParticleSelect) this.onParticleSelect(null)
    } else {
      this.selectedRow = index
      this.rows[index]?.classList.add('table-active')
      if (this.onParticleSelect) this.onParticleSelect(index)
    }
  }

  private setupColumnSorting(): void {
    const thead = document.querySelector('#tabularInfo > thead > tr')
    if (!thead) return

    const headers = thead.querySelectorAll('th')
    headers.forEach((th, index) => {
      if (index === 0) return // Skip particle column

      th.style.cursor = 'pointer'
      th.style.userSelect = 'none'
      th.title = 'Click to sort'

      const metricId = ['mass', 'charge', 'speed', 'kineticEnergy', 'LJForceStrength',
                        'GravitationForceStrength', 'CoulombForceStrength', 'TotalForceStrength'][index - 1]

      th.addEventListener('click', () => {
        if (this.sortColumn === metricId) {
          this.sortAscending = !this.sortAscending
        } else {
          this.sortColumn = metricId
          this.sortAscending = true
        }
        this.sortTable()
        this.updateSortIndicators()
      })
    })
  }

  private sortTable(): void {
    if (!this.sortColumn) return

    const tbody = document.querySelector('#tabularInfo > tbody')
    if (!tbody) return

    const indices = Array.from({ length: this.particleCount }, (_, i) => i)
    indices.sort((a, b) => {
      const dataA = this.particleData[a]
      const dataB = this.particleData[b]
      let valA = 0, valB = 0

      if (this.sortColumn === 'mass') {
        valA = dataA.mass; valB = dataB.mass
      } else if (this.sortColumn === 'charge') {
        valA = dataA.charge; valB = dataB.charge
      } else if (this.sortColumn === 'speed') {
        valA = Math.hypot(dataA.vx, dataA.vy, dataA.vz)
        valB = Math.hypot(dataB.vx, dataB.vy, dataB.vz)
      } else if (this.sortColumn === 'kineticEnergy') {
        valA = 0.5 * (dataA.vx ** 2 + dataA.vy ** 2 + dataA.vz ** 2) * dataA.mass
        valB = 0.5 * (dataB.vx ** 2 + dataB.vy ** 2 + dataB.vz ** 2) * dataB.mass
      } else if (this.sortColumn === 'TotalForceStrength') {
        valA = Math.hypot(dataA.fx, dataA.fy, dataA.fz)
        valB = Math.hypot(dataB.fx, dataB.fy, dataB.fz)
      }

      return this.sortAscending ? valA - valB : valB - valA
    })

    indices.forEach(idx => tbody.appendChild(this.rows[idx]))
  }

  private updateSortIndicators(): void {
    const thead = document.querySelector('#tabularInfo > thead > tr')
    if (!thead) return

    const headers = thead.querySelectorAll('th')
    const metricIds = ['particle', 'mass', 'charge', 'speed', 'kineticEnergy', 'LJForceStrength',
                       'GravitationForceStrength', 'CoulombForceStrength', 'TotalForceStrength']

    headers.forEach((th: HTMLTableHeaderCellElement, index: number) => {
      const text = th.textContent?.replace(' ↑', '').replace(' ↓', '') || ''
      if (metricIds[index] === this.sortColumn) {
        th.textContent = text + (this.sortAscending ? ' ↑' : ' ↓')
      } else {
        th.textContent = text
      }
    })
  }

  private tooltip: HTMLDivElement | null = null

  private showTooltip(element: HTMLElement, particleIndex: number, metricId: string): void {
    const data = this.particleData[particleIndex]
    if (!data) return

    let content = `<strong>Particle ${particleIndex}</strong><br>`

    if (metricId === 'mass') {
      content += `Mass: ${formatMassCharge(data.mass)}`
    } else if (metricId === 'charge') {
      content += `Charge: ${formatCharge(data.charge)}`
    } else if (metricId === 'speed') {
      const speed = Math.hypot(data.vx, data.vy, data.vz)
      content += `Speed: ${formatDynamic(speed)}<br>`
      content += `vx: ${formatDynamic(data.vx)}<br>`
      content += `vy: ${formatDynamic(data.vy)}<br>`
      content += `vz: ${formatDynamic(data.vz)}`
    } else if (metricId === 'kineticEnergy') {
      const ke = 0.5 * (data.vx ** 2 + data.vy ** 2 + data.vz ** 2) * data.mass
      content += `Kinetic Energy: ${formatDynamic(ke)}`
    } else if (metricId.includes('Force')) {
      const totalF = Math.hypot(data.fx, data.fy, data.fz)
      content += `Total Force: ${formatDynamic(totalF)}<br>`
      content += `fx: ${formatDynamic(data.fx)}<br>`
      content += `fy: ${formatDynamic(data.fy)}<br>`
      content += `fz: ${formatDynamic(data.fz)}`
    }

    if (!this.tooltip) {
      this.tooltip = document.createElement('div')
      this.tooltip.className = 'hud-tooltip'
      this.tooltip.style.cssText = `
        position: absolute;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        z-index: 10000;
        pointer-events: none;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        max-width: 200px;
      `
      document.body.appendChild(this.tooltip)
    }

    this.tooltip.innerHTML = content
    this.tooltip.style.display = 'block'

    const rect = element.getBoundingClientRect()
    this.tooltip.style.left = rect.left + rect.width / 2 - this.tooltip.offsetWidth / 2 + 'px'
    this.tooltip.style.top = rect.top - this.tooltip.offsetHeight - 8 + 'px'
  }

  private hideTooltip(): void {
    if (this.tooltip) {
      this.tooltip.style.display = 'none'
    }
  }

  update(i: number, data: ParticleDynamicData): void {
    const row = this.rows[i]
    if (!row) return

    // Store data for sorting and tooltips
    this.particleData[i] = { ...data }

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
    if (!td) return
    // Special handling for charge to use Bootstrap badges
    if (metricId === 'charge') {
      const charge = parseFloat(text)
      td.innerHTML = ''
      if (!isNaN(charge)) {
        const badge = document.createElement('span')
        badge.className = 'badge'
        if (charge > 0) {
          badge.classList.add('bg-danger')
          badge.textContent = text
        } else if (charge < 0) {
          badge.classList.add('bg-primary')
          badge.textContent = text
        } else {
          badge.classList.add('bg-secondary')
          badge.textContent = '0'
        }
        td.appendChild(badge)
      } else {
        td.textContent = text
      }
    } else {
      td.textContent = text
    }
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
    this.canvas.className = 'd-block'
    this.canvas.style.width = '60px'
    this.canvas.style.height = '18px'
    this.span = document.createElement('span')
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
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#0d6efd'; ctx.beginPath() // Bootstrap primary blue
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
