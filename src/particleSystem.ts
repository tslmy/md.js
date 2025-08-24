import { Color, Vector3, Line, Scene } from 'three'
import { makeTrajectory } from './visual/drawingHelpers.js'
// Type alias for settings shape (imported dynamically); avoids circular dep.
type Settings = typeof import('./settings.js').settings

const columnNames = ['speed', 'kineticEnergy', 'LJForceStrength', 'GravitationForceStrength', 'CoulombForceStrength', 'TotalForceStrength']

class Particle {
  color: Color
  position: Vector3
  mass: number
  charge: number
  trajectory: Line | null
  isEscaped: boolean = false

  constructor(
    color: Color,
    position: Vector3,
    mass: number,
    charge: number,
    trajectory: Line | null
  ) {
    this.color = color
    this.position = position
    this.mass = mass
    this.charge = charge
    this.trajectory = trajectory
    this.isEscaped = false
  }
}

function addParticle(
  color: Color,
  position: Vector3,
  mass: number,
  charge: number,
  ctx: {
    particles: Particle[]
    scene: Scene
    showTrajectory: boolean
    maxTrajectoryLength: number
  }
): void {
  const { particles, scene, showTrajectory, maxTrajectoryLength } = ctx
  let trajectory: Line | null = null
  if (showTrajectory) {
    trajectory = makeTrajectory(color, position, maxTrajectoryLength)
    scene.add(trajectory)
  }
  const particle = new Particle(color, position, mass, charge, trajectory)
  particles.push(particle)
  addParticleToTable(color, mass, charge)
}

/**
 * There's a table that displays particle information.
 * This function adds a row to that table for each particle.
 */
function addParticleToTable(color: Color, mass: number, charge: number) {
  const tableRow = document.createElement('tr')
  const particleColumn = document.createElement('td')
  particleColumn.classList.add('particle')
  particleColumn.innerText = '⬤'
  particleColumn.style.color = '#' + color.getHexString()
  tableRow.appendChild(particleColumn)
  const massColumn = document.createElement('td')
  massColumn.classList.add('mass')
  massColumn.innerText = `${Math.round(mass * 10) / 10}`
  tableRow.appendChild(massColumn)
  const chargeColumn = document.createElement('td')
  chargeColumn.classList.add('mass')
  chargeColumn.innerText = `${Math.round(charge * 10) / 10}`
  tableRow.appendChild(chargeColumn)
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
function seedParticles(particles: Particle[], scene: Scene, settings: Settings): void {
  if (settings.if_makeSun) {
    addParticle(
      new Color(0, 0, 0),
      new Vector3(0, 0, 0),
      settings.sunMass,
      0,
      {
        particles,
        scene,
        showTrajectory: settings.if_showTrajectory,
        maxTrajectoryLength: settings.maxTrajectoryLength
      }
    )
  }
  for (let i = particles.length; i < settings.particleCount; i++) {
    const position = new Vector3(
      random(-settings.spaceBoundaryX, settings.spaceBoundaryX),
      random(-settings.spaceBoundaryY, settings.spaceBoundaryY),
      random(-settings.spaceBoundaryZ, settings.spaceBoundaryZ))
    addParticle(
      new Color(Math.random(), Math.random(), Math.random()),
      position,
      random(settings.massLowerBound, settings.massUpperBound),
      sample<number>(settings.availableCharges),
      {
        particles,
        scene,
        showTrajectory: settings.if_showTrajectory,
        maxTrajectoryLength: settings.maxTrajectoryLength
      }
    )
  }
}


function random(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

function sample<Type>(l: Type[]): Type {
  return l[~~(Math.random() * l.length)]
}

export { seedParticles, Particle }
