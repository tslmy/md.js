import { Color, Vector3, Line, Scene, BufferGeometry, BufferAttribute, LineBasicMaterial } from 'three'
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

// Store initial velocities separately for seeding the SoA simulation state (optional legacy path).
export const initialVelocities: number[] = [] // flat array length 3 * particleCount (may remain empty)

interface AddParticleOpts {
  color: Color
  position: Vector3
  velocity: Vector3
  mass: number
  charge: number
  particles: Particle[]
  scene: Scene
  showTrajectory: boolean
  maxTrajectoryLength: number
}
function addParticle(opts: AddParticleOpts): void {
  const { color, position, velocity, mass, charge, particles, scene, showTrajectory, maxTrajectoryLength } = opts
  let trajectory: Line | null = null
  if (showTrajectory) {
    trajectory = makeTrajectory(color, position, maxTrajectoryLength)
    scene.add(trajectory)
  }
  const particle = new Particle(color, position, mass, charge, trajectory)
  particles.push(particle)
  initialVelocities.push(velocity.x, velocity.y, velocity.z)
  const tableRow = document.createElement('tr')
  const particleColumn = document.createElement('td')
  particleColumn.classList.add('particle')
  particleColumn.innerText = '⬤'
  particleColumn.style.color = color.getStyle()
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

function makeClonePositionsList(
  x: number,
  y: number,
  z: number
): Vector3[] {
  return [
    new Vector3(2 * x, 0, 0),
    new Vector3(-2 * x, 0, 0),
    new Vector3(0, 2 * y, 0),
    new Vector3(0, -2 * y, 0),
    new Vector3(0, 0, 2 * z),
    new Vector3(0, 0, -2 * z),
    new Vector3(2 * x, 0, 2 * z),
    new Vector3(-2 * x, 0, 2 * z),
    new Vector3(2 * x, 0, -2 * z),
    new Vector3(-2 * x, 0, -2 * z),
    new Vector3(0, 2 * y, 2 * z),
    new Vector3(0, -2 * y, 2 * z),
    new Vector3(0, 2 * y, -2 * z),
    new Vector3(0, -2 * y, -2 * z),
    new Vector3(2 * x, 2 * y, 0),
    new Vector3(-2 * x, 2 * y, 0),
    new Vector3(2 * x, -2 * y, 0),
    new Vector3(-2 * x, -2 * y, 0),
    new Vector3(2 * x, 2 * y, 2 * z),
    new Vector3(-2 * x, 2 * y, 2 * z),
    new Vector3(2 * x, -2 * y, 2 * z),
    new Vector3(-2 * x, -2 * y, 2 * z),
    new Vector3(2 * x, 2 * y, -2 * z),
    new Vector3(-2 * x, 2 * y, -2 * z),
    new Vector3(2 * x, -2 * y, -2 * z),
    new Vector3(-2 * x, -2 * y, -2 * z)
  ]
}

/**
 *  Make objects that will contain the trajectory points.
 * See <http://stackoverflow.com/questions/31399856/drawing-a-line-with-three-js-dynamically>.
 */
function makeTrajectory(color: Color, position: Vector3, maxLen: number): Line {
  const geom = new BufferGeometry()
  const pts = new Float32Array(maxLen * 3)
  const cols = new Float32Array(maxLen * 3)
  geom.setAttribute('position', new BufferAttribute(pts, 3))
  geom.setAttribute('color', new BufferAttribute(cols, 3))
  const white = new Color('#FFFFFF')
  for (let i = 0; i < maxLen; i++) {
    const t = (maxLen - i) / maxLen
    const c = color.clone().lerp(white, t)
      ; (geom.attributes.color as BufferAttribute).setXYZ(i, c.r, c.g, c.b)
      ; (geom.attributes.position as BufferAttribute).setXYZ(i, position.x, position.y, position.z)
  }
  return new Line(geom, new LineBasicMaterial({ linewidth: 1, vertexColors: true }))
}

/** Seed particle metadata (positions/colors/mass/charge + HUD rows & optional trajectories).
 *  No legacy THREE.Points cloud or clone sprites are created (instanced spheres handle rendering).
 */
function seedParticles(particles: Particle[], scene: Scene, settings: Settings): void {
  if (settings.if_makeSun) {
    addParticle({
      color: new Color(0, 0, 0),
      position: new Vector3(0, 0, 0),
      velocity: new Vector3(0, 0, 0),
      mass: settings.sunMass,
      charge: 0,
      particles,
      scene,
      showTrajectory: settings.if_showTrajectory,
      maxTrajectoryLength: settings.maxTrajectoryLength
    })
  }
  for (let i = particles.length; i < settings.particleCount; i++) {
    let position: Vector3
    let velocity: Vector3
    if (settings.if_makeSun) {
      position = new Vector3(
        random(-settings.spaceBoundaryX, settings.spaceBoundaryX),
        random(-settings.spaceBoundaryY, settings.spaceBoundaryY),
        random(-settings.spaceBoundaryZ, settings.spaceBoundaryZ)
      )
      const r = position.length()
      const vy = Math.sqrt((settings.G * particles[0].mass) / r)
      velocity = new Vector3(0, vy, 0)
      if (i % 2 === 0) velocity.negate()
    } else {
      position = new Vector3(
        random(-settings.spaceBoundaryX, settings.spaceBoundaryX),
        random(-settings.spaceBoundaryY, settings.spaceBoundaryY),
        random(-settings.spaceBoundaryZ, settings.spaceBoundaryZ)
      )
      velocity = new Vector3(0, 0, 0)
    }
    addParticle({
      color: new Color(Math.random(), Math.random(), Math.random()),
      position,
      velocity,
      mass: random(settings.massLowerBound, settings.massUpperBound),
      charge: sample<number>(settings.availableCharges),
      particles,
      scene,
      showTrajectory: settings.if_showTrajectory,
      maxTrajectoryLength: settings.maxTrajectoryLength
    })
  }
  try { (window as unknown as { initialVelocities?: number[] }).initialVelocities = initialVelocities } catch { /* ignore */ }
}


function random(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

function sample<Type>(l: Type[]): Type {
  return l[~~(Math.random() * l.length)]
}

export { seedParticles, makeClonePositionsList, Particle }
