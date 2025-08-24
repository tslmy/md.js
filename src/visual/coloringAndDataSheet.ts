/**
 * The only script that does not rely on the fact that our 3D rendering is done with THREE.js.
 */

import { Color } from 'three'

const columnNames = ['speed', 'kineticEnergy', 'LJForceStrength', 'GravitationForceStrength', 'CoulombForceStrength', 'TotalForceStrength']

/**
 * There's a table that displays particle information.
 * This function adds a row to that table for each particle.
 */
function addParticleToTable(color: Color) {
  const tableRow = document.createElement('tr')
  const particleColumn = document.createElement('td')
  particleColumn.classList.add('particle')
  particleColumn.innerText = '⬤'
  particleColumn.style.color = '#' + color.getHexString()
  tableRow.appendChild(particleColumn)
  // mass & charge columns removed (HUD now updated from state arrays)
  for (const columnName of columnNames) {
    const column = document.createElement('td')
    column.classList.add(columnName)
    tableRow.appendChild(column)
  }
  const tbody = document.querySelector<HTMLTableSectionElement>('#tabularInfo > tbody')
  if (tbody) tbody.appendChild(tableRow)
}

/**
 * Seed particle color and HUD rows.
 */
export function seedColorsAndPopulateTable(colors: Color[], particleCount: number, ifMakeSun: boolean): void {
  while (colors.length < particleCount) {
    const color = ifMakeSun && colors.length === 0 ? new Color(0, 0, 0) : new Color(Math.random(), Math.random(), Math.random())
    colors.push(color)
    addParticleToTable(color)
  }
}

export function updateHudRow(i: number, d: { mass: number; vx: number; vy: number; vz: number; fx: number; fy: number; fz: number; perForce?: Record<string, Float32Array> }): void {
  const row = document.querySelector<HTMLElement>(`#tabularInfo > tbody > tr:nth-child(${i + 1})`)
  if (!row) return
  const rnd = (v: number) => `${Math.round(v * 100) / 100}`
  const speed2 = d.vx * d.vx + d.vy * d.vy + d.vz * d.vz
  const speed = Math.sqrt(speed2)
  const forceMag = Math.hypot(d.fx, d.fy, d.fz)
  const set = (cls: string, val: string) => { const el = row.querySelector<HTMLElement>(cls); if (el) el.textContent = val }
  set('.speed', rnd(speed))
  set('.kineticEnergy', rnd(speed2 * d.mass * 0.5))
  set('.TotalForceStrength', rnd(forceMag))
  if (!d.perForce) return
  const classMap: Record<string, string> = {
    lennardJones: '.LJForceStrength',
    gravity: '.GravitationForceStrength',
    coulomb: '.CoulombForceStrength'
  }
  const i3 = 3 * i
  for (const [name, arr] of Object.entries(d.perForce)) {
    const cls = classMap[name]
    if (!cls) continue
    const mag = Math.hypot(arr[i3], arr[i3 + 1], arr[i3 + 2])
    set(cls, rnd(mag))
  }
}
