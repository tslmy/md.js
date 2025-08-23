import * as THREE from 'three'
import { generateTexture } from './drawingHelpers.js'
import { loadState, previousState } from './stateStorage.js'
import type { SimulationState } from './core/simulation/state.js'
// Type alias for settings shape (imported dynamically); avoids circular dep.
type Settings = typeof import('./settings.js').settings

// Texture & base materials
const texture = new THREE.Texture(generateTexture())
texture.needsUpdate = true
const particleMaterialForClones = new THREE.PointsMaterial({ map: texture, size: 0.2, alphaTest: 0.5, vertexColors: true })

// HUD column names
const columnNames = ['speed', 'kineticEnergy', 'LJForceStrength', 'GravitationForceStrength', 'CoulombForceStrength', 'TotalForceStrength']

// Minimal render facade for a particle. All physics data lives in SimulationState (SoA).
class Particle {
  readonly index: number
  color: THREE.Color
  position: THREE.Vector3 // cached position for Three helpers (updated from SoA each frame)
  velocityArrow: THREE.ArrowHelper
  forceArrow: THREE.ArrowHelper
  trajectory: THREE.Line | null
  isEscaped = false
  constructor(index: number, color: THREE.Color, initialPosition: THREE.Vector3, trajectory: THREE.Line | null) {
    this.index = index
    this.color = color
    this.position = initialPosition.clone()
    this.trajectory = trajectory
    this.velocityArrow = new THREE.ArrowHelper(new THREE.Vector3(), new THREE.Vector3(), 1, 0x0055aa)
    this.forceArrow = new THREE.ArrowHelper(new THREE.Vector3(), new THREE.Vector3(), 1, 0xaa5555)
  }
}

// Internal metadata stored on a trajectory line's userData
interface TrajectoryRingMeta { write: number; length: number; count: number }
interface TrajectoryLine extends THREE.Line { userData: { trajectoryRing?: TrajectoryRingMeta } }

interface AddParticleOpts {
  color: THREE.Color
  position: THREE.Vector3
  velocity: THREE.Vector3
  mass: number
  charge: number
  particles: Particle[]
  geometry: THREE.BufferGeometry
  scene: THREE.Scene
  showTrajectory: boolean
  maxTrajectoryLength: number
  simState: SimulationState
}
function addParticle(opts: AddParticleOpts): void {
  const { color, position, velocity, mass, charge, particles, geometry, scene, showTrajectory, maxTrajectoryLength, simState } = opts
  const idx = particles.length
  // Seed SoA arrays (single source of truth)
  const i3 = 3 * idx
  simState.positions[i3] = position.x
  simState.positions[i3 + 1] = position.y
  simState.positions[i3 + 2] = position.z
  simState.velocities[i3] = velocity.x
  simState.velocities[i3 + 1] = velocity.y
  simState.velocities[i3 + 2] = velocity.z
  simState.masses[idx] = mass
  simState.charges[idx] = charge
  // Geometry attributes
  geometry.attributes.position.setXYZ(idx, position.x, position.y, position.z)
  geometry.attributes.color.setXYZ(idx, color.r, color.g, color.b)
  // Trajectory (optional)
  let trajectory: THREE.Line | null = null
  if (showTrajectory) {
    trajectory = makeTrajectory(color, position, maxTrajectoryLength)
    scene.add(trajectory)
  }
  const particle = new Particle(idx, color, position, trajectory)
  particles.push(particle)
  scene.add(particle.velocityArrow)
  scene.add(particle.forceArrow)
  // HUD row
  const row = document.createElement('tr')
  const particleCol = document.createElement('td')
  particleCol.classList.add('particle'); particleCol.innerText = '⬤'; particleCol.style.color = color.getStyle(); row.appendChild(particleCol)
  const massCol = document.createElement('td'); massCol.classList.add('mass'); massCol.innerText = `${Math.round(mass * 10) / 10}`; row.appendChild(massCol)
  const chargeCol = document.createElement('td'); chargeCol.classList.add('mass'); chargeCol.innerText = `${Math.round(charge * 10) / 10}`; row.appendChild(chargeCol)
  for (const cName of columnNames) { const c = document.createElement('td'); c.classList.add(cName); row.appendChild(c) }
  const tbody = document.querySelector<HTMLTableSectionElement>('#tabularInfo > tbody'); if (tbody) tbody.appendChild(row)
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
  const line: TrajectoryLine = new THREE.Line(thisGeometry, thisTrajectoryMaterial) as TrajectoryLine
  // Attach ring buffer bookkeeping (ignored by Three.js internals, safe to mutate each frame).
  line.userData.trajectoryRing = { write: 0, length: maxTrajectoryLength, count: 0 }
  return line
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
  settings: Settings,
  simState: SimulationState
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
  if (!populateFromPreviousOrFresh(particles, particlesGeometry, scene, settings, simState)) {
    // fresh world already created inside helper when no previous state
  }
  // now, no matter how many particles has been pre-defined (e.g. the Sun) and how many are loaded from previous session, add particles till particleCount is met:
  for (let i = particles.length; i < settings.particleCount; i++) {
    let position: THREE.Vector3
    let velocity: THREE.Vector3
    if (settings.if_makeSun) {
      // In the case that we want a sun at the center, let's initialize our "planets" on the same horizontal surface. This is done by ensuring that y = 0 for all.
      position = new THREE.Vector3(
        random(-settings.spaceBoundaryX, settings.spaceBoundaryX),
        0,
        random(-settings.spaceBoundaryZ, settings.spaceBoundaryZ)
      )
  const r = position.length()
      // The speed in the vertical direction should be the orbital speed.
      // See https://www.physicsclassroom.com/class/circles/Lesson-4/Mathematics-of-Satellite-Motion.
  const vy = Math.sqrt((settings.G * (simState.masses[0] || 1)) / r)
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
  position.length() // compute length once if needed later (currently unused)
      velocity = new THREE.Vector3(0, 0, 0)
    }
    // Force should always be initialized to zero. It will be computed properly upon first refresh.
    // Don't share this object across particles, though -- The values of their components will vary across particles during simulation.
    addParticle({
      color: new THREE.Color(Math.random(), Math.random(), Math.random()),
      position,
      velocity,
      mass: random(settings.massLowerBound, settings.massUpperBound),
      charge: sample<number>(settings.availableCharges),
      particles,
      geometry: particlesGeometry,
      scene,
      showTrajectory: settings.if_showTrajectory,
      maxTrajectoryLength: settings.maxTrajectoryLength,
      simState
    })
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

function populateFromPreviousOrFresh(particles: Particle[], particlesGeometry: THREE.BufferGeometry, scene: THREE.Scene, settings: Settings, simState: SimulationState): boolean {
  if (loadState()) {
    console.log('State from previous session loaded.')
    const prev = previousState()
    const particleCountToRead = (prev.particleCount < settings.particleCount || settings.if_override_particleCount_setting_with_lastState)
      ? prev.particleCount
      : settings.particleCount
    for (let i = 0; i < particleCountToRead; i++) {
      const color = new THREE.Color(prev.particleColors[3 * i], prev.particleColors[3 * i + 1], prev.particleColors[3 * i + 2])
      addParticle({
        color,
        position: new THREE.Vector3().fromArray(prev.particlePositions, 3 * i),
        velocity: objectToVector(prev.particleVelocities[i]),
        mass: prev.particleMasses[i],
        charge: prev.particleCharges[i],
        particles,
        geometry: particlesGeometry,
        scene,
        showTrajectory: settings.if_showTrajectory,
        maxTrajectoryLength: settings.maxTrajectoryLength,
        simState
      })
    }
    const diff = settings.particleCount - prev.particleCount
    if (diff < 0) console.log('Dropping', -diff, 'particles from stored state (exceeds current target).')
    else if (diff > 0) console.log('Creating only', diff, 'new particles in addition to loaded', prev.particleCount)
    return true
  }
  console.log('Creating new universe. md.js will be creating all', settings.particleCount, 'particles from scratch.')
  if (settings.if_makeSun) {
    addParticle({
      color: new THREE.Color(0, 0, 0),
      position: new THREE.Vector3(0, 0, 0),
      velocity: new THREE.Vector3(0, 0, 0),
      mass: settings.sunMass,
      charge: 0,
      particles,
      geometry: particlesGeometry,
      scene,
      showTrajectory: settings.if_showTrajectory,
      maxTrajectoryLength: settings.maxTrajectoryLength,
      simState
    })
  }
  return false
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
