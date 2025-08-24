import { Color, Vector3 } from 'three'
import { registerSeedPosition, clearSeedPositions } from './core/simulation/state.js'
// Type alias for settings shape (imported dynamically); avoids circular dep.
type Settings = typeof import('./control/settings.js').settings

const columnNames = ['speed', 'kineticEnergy', 'LJForceStrength', 'GravitationForceStrength', 'CoulombForceStrength', 'TotalForceStrength']

class Particle { constructor(public color: Color) { } }

// (initial positions now tracked centrally in simulation/state via registerSeedPosition)

function addParticle(color: Color, position: Vector3, ctx: { particles: Particle[] }): void {
  const { particles } = ctx
  particles.push(new Particle(color))
  registerSeedPosition(position)
  addParticleToTable(color)
}

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
 * Seed particle metadata (positions/colors/mass/charge + HUD rows & optional trajectories).
 */
function seedParticles(particles: Particle[], settings: Settings): void {
  // reset any prior seeding (e.g. hot reload) to avoid stale growth
  clearSeedPositions()
  if (settings.if_makeSun) {
    addParticle(new Color(0, 0, 0), new Vector3(0, 0, 0), { particles })
  }
  for (let i = particles.length; i < settings.particleCount; i++) {
    const position = new Vector3(
      random(-settings.spaceBoundaryX, settings.spaceBoundaryX),
      random(-settings.spaceBoundaryY, settings.spaceBoundaryY),
      random(-settings.spaceBoundaryZ, settings.spaceBoundaryZ))
    addParticle(new Color(Math.random(), Math.random(), Math.random()), position, { particles })
  }
}


function random(min: number, max: number): number {
  return Math.random() * (max - min) + min
}


export { seedParticles, Particle }
