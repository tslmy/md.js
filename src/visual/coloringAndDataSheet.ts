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
