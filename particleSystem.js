'use strict'

import _ from 'lodash'
import * as THREE from 'three'
import { generateTexture } from './drawing_helpers.js'
import { loadState, previousState } from './stateStorage.js'
const texture = new THREE.Texture(generateTexture())
texture.needsUpdate = true // important
const particleMaterialForClones = new THREE.PointsMaterial({
  // http://jsfiddle.net/7yDGy/1/
  map: texture,
  blending: THREE.NormalBlending, // required
  depthTest: false, // required
  transparent: true,
  opacity: 0.3,
  size: 0.3,
  vertexColors: true
})

function addParticle (
  colorH,
  colorS,
  colorL,
  positionX,
  positionY,
  positionZ,
  velocityX,
  velocityY,
  velocityZ,
  forceX,
  forceY,
  forceZ,
  thisMass,
  thisCharge,
  particles,
  particlePositions,
  particleVelocities,
  particleForces,
  particleMasses,
  totalMass,
  particleCharges,
  scene,
  arrowVelocities,
  arrowForces,
  shouldShowTrajectory,
  trajectoryLines,
  maxTrajectoryLength,
  trajectoryGeometries
) {
  // Create the vertex
  const thisPosition = new THREE.Vector3(positionX, positionY, positionZ)
  particlePositions.push(thisPosition)
  // Add the vertex to the geometry
  particles.attributes.position.setXYZ(
    particlePositions.length - 1,
    positionX,
    positionY,
    positionZ
  )
  // TODO: Is BufferAttribute using HSL for color? Verify this.
  particles.attributes.color.setXYZ(
    particlePositions.length - 1,
    colorH,
    colorS,
    colorL
  )
  // make velocity
  const thisVelocity = new THREE.Vector3(velocityX, velocityY, velocityZ)
  particleVelocities.push(thisVelocity)
  // make force
  const thisForce = new THREE.Vector3(forceX, forceY, forceZ)
  particleForces.push(thisForce)
  // mass
  particleMasses.push(thisMass)
  totalMass += thisMass
  // charge
  particleCharges.push(thisCharge)
  // add two arrows
  const arrow1 = new THREE.ArrowHelper(
    new THREE.Vector3(),
    new THREE.Vector3(),
    1,
    0x0055aa
  )
  scene.add(arrow1)
  arrowVelocities.push(arrow1)
  const arrow2 = new THREE.ArrowHelper(
    new THREE.Vector3(),
    new THREE.Vector3(),
    1,
    0x555555
  )
  scene.add(arrow2)
  arrowForces.push(arrow2)
  // add trajectories.
  // make colors (http://jsfiddle.net/J7zp4/200/)
  const thisColor = new THREE.Color()
  thisColor.setHSL(
    particles.attributes.color.getX(particlePositions.length - 1),
    particles.attributes.color.getY(particlePositions.length - 1),
    particles.attributes.color.getZ(particlePositions.length - 1)
  )
  if (shouldShowTrajectory) {
    const thisTrajectory = makeTrajectory(
      thisColor,
      thisPosition,
      maxTrajectoryLength,
      trajectoryGeometries
    )
    trajectoryLines.push(thisTrajectory)
    scene.add(thisTrajectory)
  }
  // Make the HUD table.
  $('#tabularInfo > tbody').append(
    '<tr>\
          <td class="particle" style="\
              color: hsl(' +
      colorH * 360 +
      ',' +
      colorS * 100 +
      '%,' +
      colorL * 100 +
      '%)">&#x2B24;</td>\
          <td class="mass">' +
      Math.round(thisMass * 10) / 10 +
      '</td>\
          <td class="charge">' +
      Math.round(thisCharge * 10) / 10 +
      '</td>\
          <td class="speed"></td>\
          <td class="kineticEnergy"></td>\
          <td class="LJForceStrength"></td>\
          <td class="GravitationForceStrength"></td>\
          <td class="CoulombForceStrength"></td>\
          <td class="TotalForceStrength"></td>\
      </tr>'
  )
}

function makeClonePositionsList (
  spaceBoundaryX,
  spaceBoundaryY,
  spaceBoundaryZ
) {
  return [
    [2 * spaceBoundaryX, 0, 0],
    [-2 * spaceBoundaryX, 0, 0],
    [0, 2 * spaceBoundaryY, 0],
    [0, -2 * spaceBoundaryY, 0],
    [0, 0, 2 * spaceBoundaryZ],
    [0, 0, -2 * spaceBoundaryZ],
    [2 * spaceBoundaryX, 0, 2 * spaceBoundaryZ],
    [-2 * spaceBoundaryX, 0, 2 * spaceBoundaryZ],
    [2 * spaceBoundaryX, 0, -2 * spaceBoundaryZ],
    [-2 * spaceBoundaryX, 0, -2 * spaceBoundaryZ],
    [0, 2 * spaceBoundaryY, 2 * spaceBoundaryZ],
    [0, -2 * spaceBoundaryY, 2 * spaceBoundaryZ],
    [0, 2 * spaceBoundaryY, -2 * spaceBoundaryZ],
    [0, -2 * spaceBoundaryY, -2 * spaceBoundaryZ],
    [2 * spaceBoundaryX, 2 * spaceBoundaryY, 0],
    [-2 * spaceBoundaryX, 2 * spaceBoundaryY, 0],
    [2 * spaceBoundaryX, -2 * spaceBoundaryY, 0],
    [-2 * spaceBoundaryX, -2 * spaceBoundaryY, 0],
    [2 * spaceBoundaryX, 2 * spaceBoundaryY, 2 * spaceBoundaryZ],
    [-2 * spaceBoundaryX, 2 * spaceBoundaryY, 2 * spaceBoundaryZ],
    [2 * spaceBoundaryX, -2 * spaceBoundaryY, 2 * spaceBoundaryZ],
    [-2 * spaceBoundaryX, -2 * spaceBoundaryY, 2 * spaceBoundaryZ],
    [2 * spaceBoundaryX, 2 * spaceBoundaryY, -2 * spaceBoundaryZ],
    [-2 * spaceBoundaryX, 2 * spaceBoundaryY, -2 * spaceBoundaryZ],
    [2 * spaceBoundaryX, -2 * spaceBoundaryY, -2 * spaceBoundaryZ],
    [-2 * spaceBoundaryX, -2 * spaceBoundaryY, -2 * spaceBoundaryZ]
  ]
}

/**
 *  Make objects that will contain the trajectory points.
 * See <http://stackoverflow.com/questions/31399856/drawing-a-line-with-three-js-dynamically>.
 */
function makeTrajectory (
  thisColor,
  thisPosition,
  maxTrajectoryLength,
  trajectoryGeometries
) {
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
  trajectoryGeometries.push(thisGeometry)
  // finished preparing the geometry for this trajectory
  const thisTrajectoryMaterial = new THREE.LineBasicMaterial({
    linewidth: 0.5,
    vertexColors: true
  })
  return new THREE.Line(thisGeometry, thisTrajectoryMaterial)
}

function createParticleSystem (
  group,
  particlePositions,
  particleVelocities,
  particleForces,
  particleMasses,
  totalMass,
  particleCharges,
  scene,
  arrowVelocities,
  arrowForces,
  trajectoryLines,
  trajectoryGeometries,
  time,
  lastSnapshotTime,
  settings
) {
  // Particles are just individual vertices in a geometry
  // Create the geometry that will hold all of the vertices
  const particles = new THREE.BufferGeometry()
  // https://stackoverflow.com/a/31411794/1147061
  const positions = new Float32Array(settings.particleCount * 3) // 3 vertices per point
  particles.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const colors = new Float32Array(settings.particleCount * 3) // 3 vertices per point
  particles.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const particleMaterial = new THREE.PointsMaterial({
    // http://jsfiddle.net/7yDGy/1/
    map: texture,
    blending: THREE.NormalBlending, // required
    depthTest: false, // required
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
    let particleCountToRead = 0
    if (
      previousState.particleCount < settings.particleCount ||
      settings.if_override_particleCount_setting_with_lastState
    ) {
      particleCountToRead = previousState.particleCount
    } else {
      particleCountToRead = settings.particleCount
    }
    for (let i = 0; i < particleCountToRead; i++) {
      addParticle(
        previousState.particleColors[3 * i],
        previousState.particleColors[3 * i + 1],
        previousState.particleColors[3 * i + 2],
        previousState.particlePositions[3 * i],
        previousState.particlePositions[3 * i + 1],
        previousState.particlePositions[3 * i + 2],
        previousState.particleVelocities[i].x,
        previousState.particleVelocities[i].y,
        previousState.particleVelocities[i].z,
        previousState.particleForces[i].x,
        previousState.particleForces[i].y,
        previousState.particleForces[i].z,
        previousState.particleMasses[i],
        previousState.particleCharges[i],
        particles,
        particlePositions,
        particleVelocities,
        particleForces,
        particleMasses,
        totalMass,
        particleCharges,
        scene,
        arrowVelocities,
        arrowForces,
        settings.if_showTrajectory,
        trajectoryLines,
        settings.maxTrajectoryLength,
        trajectoryGeometries
      )
    }
    particleCountToAdd = settings.particleCount - previousState.particleCount
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
        previousState.particleCount,
        'has been loaded from previous browser session.'
      )
    }
    time = previousState.time
    lastSnapshotTime = previousState.lastSnapshotTime
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
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        settings.sunMass,
        0,
        particles,
        particlePositions,
        particleVelocities,
        particleForces,
        particleMasses,
        totalMass,
        particleCharges,
        scene,
        arrowVelocities,
        arrowForces,
        settings.if_showTrajectory,
        trajectoryLines,
        settings.maxTrajectoryLength,
        trajectoryGeometries
      )
    } // always make the sun the first particle, please.
  }
  // now, no matter how many particles has been pre-defined (e.g. the Sun) and how many are loaded from previous session, add particles till particleCount is met:
  for (let i = particlePositions.length; i < settings.particleCount; i++) {
    let x
    let y
    let z
    let r
    const vx = 0
    let vy
    const vz = 0
    if (settings.if_makeSun) {
      x = _.random(-settings.spaceBoundaryX, settings.spaceBoundaryX, true)
      y = 0
      z = _.random(-settings.spaceBoundaryZ, settings.spaceBoundaryZ, true)
      r = Math.sqrt(x * x + y * y + z * z)
      vy = Math.sqrt((settings.G * particleMasses[0]) / r)
      if (i % 2 === 0) {
        vy *= -1
      }
    } else {
      x = _.random(-settings.spaceBoundaryX, settings.spaceBoundaryX, true)
      y = _.random(-settings.spaceBoundaryY, settings.spaceBoundaryY, true)
      z = _.random(-settings.spaceBoundaryZ, settings.spaceBoundaryZ, true)
      r = Math.sqrt(x * x + y * y + z * z)
      vy = 0
    }
    addParticle(
      Math.random(),
      1.0,
      0.5,
      x,
      y,
      z,
      vx,
      vy,
      vz,
      0,
      0,
      0,
      _.random(16, 20, true),
      _.sample(settings.availableCharges),
      particles,
      particlePositions,
      particleVelocities,
      particleForces,
      particleMasses,
      totalMass,
      particleCharges,
      scene,
      arrowVelocities,
      arrowForces,
      settings.if_showTrajectory,
      trajectoryLines,
      settings.maxTrajectoryLength,
      trajectoryGeometries
    )
  }
  // Create the material that will be used to render each vertex of the geometry
  // Create the particle system
  const particleSystem = new THREE.Points(particles, particleMaterial)
  particleSystem.position.set(0, 0, 0)
  group.add(particleSystem)

  let clone
  const clonePositions = makeClonePositionsList(
    settings.spaceBoundaryX,
    settings.spaceBoundaryY,
    settings.spaceBoundaryZ
  )
  const cloneTemplate = particleSystem.clone()
  cloneTemplate.material = particleMaterialForClones
  clonePositions.forEach((clonePosition) => {
    clone = cloneTemplate.clone()
    clone.position.set(clonePosition[0], clonePosition[1], clonePosition[2])
    group.add(clone)
  })
  return particleSystem
}

export {
  createParticleSystem,
  makeClonePositionsList,
  particleMaterialForClones
}
