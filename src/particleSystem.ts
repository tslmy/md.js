import * as THREE from 'three'
import { generateTexture } from './drawingHelpers.js'
import { loadState, previousState } from './stateStorage.js'
// Type alias for settings shape (imported dynamically); avoids circular dep.
type Settings = typeof import('./settings.js').settings
const texture = new THREE.Texture(generateTexture())
texture.needsUpdate = true // important
const particleMaterialForClones = new THREE.PointsMaterial({
  // http://jsfiddle.net/7yDGy/1/
  map: texture,
  size: 0.2,
  alphaTest: 0.5,
  vertexColors: true
})

const columnNames = ['speed', 'kineticEnergy', 'LJForceStrength', 'GravitationForceStrength', 'CoulombForceStrength', 'TotalForceStrength']

class Particle {
  color: THREE.Color
  position: THREE.Vector3
  force: THREE.Vector3
  velocity: THREE.Vector3
  mass: number
  charge: number
  velocityArrow: THREE.ArrowHelper
  forceArrow: THREE.ArrowHelper
  trajectory: THREE.Line | null
  isEscaped: boolean = false

  constructor(
    color: THREE.Color,
    position: THREE.Vector3,
    force: THREE.Vector3,
    velocity: THREE.Vector3,
    mass: number,
    charge: number,
  trajectory: THREE.Line | null
  ) {
    this.color = color
    this.position = position
    this.force = force
    this.velocity = velocity
    this.mass = mass
    this.charge = charge
    this.trajectory = trajectory
    this.isEscaped = false
    // Add arrows.
    this.velocityArrow = new THREE.ArrowHelper(
      new THREE.Vector3(),
      new THREE.Vector3(),
      1,
      0x0055aa
    )
    this.forceArrow = new THREE.ArrowHelper(
      new THREE.Vector3(),
      new THREE.Vector3(),
      1,
      0xaa5555
    )
  }
}

function addParticle(
  color: THREE.Color,
  position: THREE.Vector3,
  velocity: THREE.Vector3,
  force: THREE.Vector3,
  thisMass: number,
  thisCharge: number,
  particles: Particle[],
  particlesGeometry: THREE.BufferGeometry,
  scene: THREE.Scene,
  shouldShowTrajectory: boolean,
  maxTrajectoryLength: number
): void {
  // Create the vertex
  // Add the vertex to the geometry
  particlesGeometry.attributes.position.setXYZ(
    particles.length,
    position.x,
    position.y,
    position.z
  )
  particlesGeometry.attributes.color.setXYZ(
    particles.length,
    color.r, color.g, color.b
  )

  // add trajectories.

  let thisTrajectory: THREE.Line | null = null
  if (shouldShowTrajectory) {
    // make colors (http://jsfiddle.net/J7zp4/200/)
    thisTrajectory = makeTrajectory(
      color,
      position,
      maxTrajectoryLength
    )
    scene.add(thisTrajectory)
  }

  const particle = new Particle(
    color,
    position,
    force,
    velocity,
    thisMass,
    thisCharge,
    thisTrajectory
  )
  particles.push(particle)

  scene.add(particle.velocityArrow)
  scene.add(particle.forceArrow)
  // Make the HUD table.
  const tableRow = document.createElement('tr')
  const particleColumn = document.createElement('td')
  particleColumn.classList.add('particle')
  particleColumn.innerText = '⬤'
  particleColumn.style.color = color.getStyle()
  tableRow.appendChild(particleColumn)
  const massColumn = document.createElement('td')
  massColumn.classList.add('mass')
  massColumn.innerText = `${Math.round(thisMass * 10) / 10}`
  tableRow.appendChild(massColumn)
  const chargeColumn = document.createElement('td')
  chargeColumn.classList.add('mass')
  chargeColumn.innerText = `${Math.round(thisCharge * 10) / 10}`
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
): THREE.Vector3[] {
  return [
    new THREE.Vector3(2 * x, 0, 0),
    new THREE.Vector3(-2 * x, 0, 0),
    new THREE.Vector3(0, 2 * y, 0),
    new THREE.Vector3(0, -2 * y, 0),
    new THREE.Vector3(0, 0, 2 * z),
    new THREE.Vector3(0, 0, -2 * z),
    new THREE.Vector3(2 * x, 0, 2 * z),
    new THREE.Vector3(-2 * x, 0, 2 * z),
    new THREE.Vector3(2 * x, 0, -2 * z),
    new THREE.Vector3(-2 * x, 0, -2 * z),
    new THREE.Vector3(0, 2 * y, 2 * z),
    new THREE.Vector3(0, -2 * y, 2 * z),
    new THREE.Vector3(0, 2 * y, -2 * z),
    new THREE.Vector3(0, -2 * y, -2 * z),
    new THREE.Vector3(2 * x, 2 * y, 0),
    new THREE.Vector3(-2 * x, 2 * y, 0),
    new THREE.Vector3(2 * x, -2 * y, 0),
    new THREE.Vector3(-2 * x, -2 * y, 0),
    new THREE.Vector3(2 * x, 2 * y, 2 * z),
    new THREE.Vector3(-2 * x, 2 * y, 2 * z),
    new THREE.Vector3(2 * x, -2 * y, 2 * z),
    new THREE.Vector3(-2 * x, -2 * y, 2 * z),
    new THREE.Vector3(2 * x, 2 * y, -2 * z),
    new THREE.Vector3(-2 * x, 2 * y, -2 * z),
    new THREE.Vector3(2 * x, -2 * y, -2 * z),
    new THREE.Vector3(-2 * x, -2 * y, -2 * z)
  ]
}

/**
 *  Make objects that will contain the trajectory points.
 * See <http://stackoverflow.com/questions/31399856/drawing-a-line-with-three-js-dynamically>.
 */
function makeTrajectory(
  thisColor: THREE.Color,
  thisPosition: THREE.Vector3,
  maxTrajectoryLength: number
): THREE.Line {
  const thisGeometry = new THREE.BufferGeometry()
  const white = new THREE.Color('#FFFFFF')
  // attributes
  const points = new Float32Array(maxTrajectoryLength * 3) // 3 vertices per point
  const colors = new Float32Array(maxTrajectoryLength * 3) // 3 vertices per point
  thisGeometry.setAttribute('position', new THREE.BufferAttribute(points, 3))
  thisGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  for (let i = 0; i < maxTrajectoryLength; i++) {
    // for each vertex of this trajectory:
    // calculate for how many percent should the color of this vertex be diluted/bleached.
    const interpolationFactor = (maxTrajectoryLength - i) / maxTrajectoryLength
    // make the bleached color object by cloning the particle's color and then lerping it with the white color.
    const thisVertexColor = thisColor.clone().lerp(white, interpolationFactor)
    // assign this color to this vertex
    thisGeometry.attributes.color.setXYZ(
      i,
      thisVertexColor.r,
      thisVertexColor.g,
      thisVertexColor.b
    )
    // put this(every) vertex to the same place as the particle started
    thisGeometry.attributes.position.setXYZ(
      i,
      thisPosition.x,
      thisPosition.y,
      thisPosition.z
    )
  }
  // finished preparing the geometry for this trajectory
  const thisTrajectoryMaterial = new THREE.LineBasicMaterial({
    linewidth: 1,
    vertexColors: true
  })
  return new THREE.Line(thisGeometry, thisTrajectoryMaterial)
}
function objectToVector(obj: { x: number, y: number, z: number }): THREE.Vector3 {
  return new THREE.Vector3(obj.x, obj.y, obj.z)
}

function createParticleSystem(
  group: THREE.Object3D,
  particles: Particle[],
  scene: THREE.Scene,
  time: number,
  lastSnapshotTime: number,
  settings: Settings
): THREE.Points {
  // Particles are just individual vertices in a geometry
  // Create the geometry that will hold all of the vertices
  const particlesGeometry = new THREE.BufferGeometry()
  // https://stackoverflow.com/a/31411794/1147061
  const positions = new Float32Array(settings.particleCount * 3) // 3 vertices per point
  particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const colors = new Float32Array(settings.particleCount * 3) // 3 vertices per point
  particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const particleMaterial = new THREE.PointsMaterial({
    // http://jsfiddle.net/7yDGy/1/
    map: texture,
    blending: THREE.NormalBlending, // required
    depthTest: true,
    transparent: true,
    // opacity: 0.9,
    size: 0.3,
    vertexColors: true
  })
  let particleCountToAdd
  // Create the vertices and add them to the particles geometry
  if (loadState()) {
    console.log('State from previous session loaded.')
    // Initialize the particleSystem with the info stored from localStorage.
    const prev = previousState()
    let particleCountToRead = 0
    if (
      prev.particleCount < settings.particleCount ||
      settings.if_override_particleCount_setting_with_lastState
    ) {
      particleCountToRead = prev.particleCount
    } else {
      particleCountToRead = settings.particleCount
    }
    for (let i = 0; i < particleCountToRead; i++) {
      const color = new THREE.Color(
        prev.particleColors[3 * i],
        prev.particleColors[3 * i + 1],
        prev.particleColors[3 * i + 2])
      addParticle(
        color,
        new THREE.Vector3().fromArray(prev.particlePositions, 3 * i),
        objectToVector(prev.particleVelocities[i]),
        objectToVector(prev.particleForces[i]),
        prev.particleMasses[i],
        prev.particleCharges[i],
        particles,
        particlesGeometry,
        scene,
        settings.if_showTrajectory,
        settings.maxTrajectoryLength
      )
    }
    particleCountToAdd = settings.particleCount - prev.particleCount
    if (particleCountToAdd < 0) {
      console.log(
        'Dropping',
        -particleCountToAdd,
        'particles stored, since we only need',
        settings.particleCount,
        'particles this time.'
      )
    } else if (particleCountToAdd > 0) {
      console.log(
        'md.js will be creating only',
        particleCountToAdd,
        'particles from scratch, since',
    prev.particleCount,
        'has been loaded from previous browser session.'
      )
    }
  time = prev.time
  lastSnapshotTime = prev.lastSnapshotTime
  } else {
    console.log('Creating new universe.')
    console.log(
      'md.js will be creating all',
      settings.particleCount,
      'particles from scratch.'
    )
    // create a sun:
    if (settings.if_makeSun) {
      addParticle(
        new THREE.Color(0, 0, 0),
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0),
        settings.sunMass,
        0,
        particles,
        particlesGeometry,
        scene,
        settings.if_showTrajectory,
        settings.maxTrajectoryLength
      )
    } // always make the sun the first particle, please.
  }
  // now, no matter how many particles has been pre-defined (e.g. the Sun) and how many are loaded from previous session, add particles till particleCount is met:
  for (let i = particles.length; i < settings.particleCount; i++) {
    let r: number
    let position: THREE.Vector3
    let velocity: THREE.Vector3
    if (settings.if_makeSun) {
      // In the case that we want a sun at the center, let's initialize our "planets" on the same horizontal surface. This is done by ensuring that y = 0 for all.
      position = new THREE.Vector3(
        random(-settings.spaceBoundaryX, settings.spaceBoundaryX),
        0,
        random(-settings.spaceBoundaryZ, settings.spaceBoundaryZ)
      )
      r = position.length()
      // The speed in the vertical direction should be the orbital speed.
      // See https://www.physicsclassroom.com/class/circles/Lesson-4/Mathematics-of-Satellite-Motion.
      const vy = Math.sqrt((settings.G * particles[0].mass) / r)
      velocity = new THREE.Vector3(0, vy, 0)
      // Let's also round-robin the orientation of the orbiting motions with each "planet". It's more fun.
      if (i % 2 === 0) {
        velocity.negate()
      }
    } else {
      position = new THREE.Vector3(
        random(-settings.spaceBoundaryX, settings.spaceBoundaryX),
        random(-settings.spaceBoundaryY, settings.spaceBoundaryY),
        random(-settings.spaceBoundaryZ, settings.spaceBoundaryZ)
      )
      r = position.length()
      velocity = new THREE.Vector3(0, 0, 0)
    }
    // Force should always be initialized to zero. It will be computed properly upon first refresh.
    // Don't share this object across particles, though -- The values of their components will vary across particles during simulation.
    const force = new THREE.Vector3(0, 0, 0)
    addParticle(
      new THREE.Color(
        Math.random(),
        Math.random(),
        Math.random()),
      position,
      velocity,
      force,
      random(
        settings.massLowerBound,
        settings.massUpperBound),
      sample<number>(settings.availableCharges),
      particles,
      particlesGeometry,
      scene,
      settings.if_showTrajectory,
      settings.maxTrajectoryLength
    )
  }
  // Create the material that will be used to render each vertex of the geometry
  // Create the particle system
  const particleSystem = new THREE.Points(particlesGeometry, particleMaterial)
  particleSystem.position.set(0, 0, 0)
  group.add(particleSystem)
  console.log('Particle System created:', particleSystem)

  const clonePositions = makeClonePositionsList(
    settings.spaceBoundaryX,
    settings.spaceBoundaryY,
    settings.spaceBoundaryZ
  )
  const cloneTemplate = particleSystem.clone()
  cloneTemplate.material = particleMaterialForClones
  clonePositions.forEach((clonePosition) => {
    const clone = cloneTemplate.clone()
    clone.position.set(clonePosition.x, clonePosition.y, clonePosition.z)
    group.add(clone)
  })
  return particleSystem
}

function random(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

function sample<Type>(l: Type[]): Type {
  return l[~~(Math.random() * l.length)]
}

export {
  createParticleSystem,
  makeClonePositionsList,
  particleMaterialForClones,
  Particle
}
