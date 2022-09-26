import { settings } from './settings.js'
import { init, ifMobileDevice } from './init.js'
import _ from 'lodash'
import * as THREE from 'three'
import { makeClonePositionsList } from './particleSystem.js'
// global variables
let camera
let scene
let renderer
let effect
let controls
let temperaturePanel
let stats
let maxTemperature = 0
let particleSystem
const particles = []
let time = 0
let lastSnapshotTime = 0
/**
 * el: the DOM element you'd like to test for visibility.
 */
function isVisible (el) {
  return el.offsetParent !== null
}
function applyForce (particles, i, j, func) {
  const thisPosition = particles[i].position
  const thatPosition = particles[j].position
  const rOriginal = new THREE.Vector3().subVectors(thisPosition, thatPosition) // relative displacement
  let r
  let clonePositions
  // ====== populate the array "particleJClones" ======
  if (settings.if_use_periodic_boundary_condition) {
    clonePositions = makeClonePositionsList(settings.spaceBoundaryX, settings.spaceBoundaryY, settings.spaceBoundaryZ)
    clonePositions.push([0, 0, 0])
  } else {
    clonePositions = [[0, 0, 0]]
  }
  // ==================================================
  // force due to j in this cell:
  for (const thatPositionDisplacement of clonePositions) {
    // (don't use "for-in" loops!)
    r = rOriginal.clone()
    // (possibly) displace shift the end of this vector from particle j to one of its clones:
    r.x -= thatPositionDisplacement[0]
    r.y -= thatPositionDisplacement[1]
    r.z -= thatPositionDisplacement[2]
    const d = r.length() // calculate distance between particles i and j (with j may being a clone)
    if (d < settings.cutoffDistance) {
      r.setLength(func(i, j, d)) // use calculated "force strength" as vector length
      particles[i].force.sub(r)
      particles[j].force.add(r)
    }
  }
  return r // return the calculated force for further investigation.
}
function computeForces (particles, particleCount = 8, shouldUpdateHud = false) {
  // remove all forces first.
  particles.forEach((particle) => particle.force.set(0, 0, 0))
  for (let i = 0; i < particleCount; i++) {
    // initialize total force counters:
    let thisLJForceStrength = 0
    let thisGravitationForceStrength = 0
    let thisCoulombForceStrength = 0
    // process interactions:
    for (let j = i + 1; j < particleCount; j++) {
      // generate all forces:
      if (settings.if_apply_LJpotential) {
        // Use Lennard-Jones potential
        // V = 4*epsilon*((delta/d)^12 - (delta/d)^6)
        // F = 4*epsilon*(-12/d*(delta/d)^12 + 6/d*(delta/d)^6) r/|r|
        const thisLJForce = applyForce(particles, i, j, (i, j, d) => {
          let d6 = settings.DELTA / d
          if (d6 < 0.5) {
            d6 = 0.5 // what kind of socery is this??
          }
          d6 = d6 * d6 * d6
          d6 = d6 * d6
          return 4 * settings.EPSILON * (6 / d) * (-2 * d6 * d6 + d6)
        })
        thisLJForceStrength += thisLJForce.length()
      }
      if (settings.if_apply_gravitation) {
        // Use gravitational potential
        // -> F = GMm/(d*d) r/|r|
        const thisGravitationForce = applyForce(particles, i, j, (i, j, d) => {
          // Use d_min to prevent high potential when particles are close
          // to avoid super high accelerations in poor time resolution
          if (d < settings.d_min) {
            console.log('particle', i, ',', j, 'too near for gravitation.')
            d = settings.d_min
          }
          return (settings.G * particles[i].mass * particles[j].mass) / (d * d)
        })
        thisGravitationForceStrength += thisGravitationForce.length()
      }
      if (settings.if_apply_coulombForce) {
        // Use gravitational potential
        // -> F = GMm/(d*d) r/|r|
        const thisCoulombForce = applyForce(particles, i, j, (i, j, d) => {
          // Use d_min to prevent high potential when particles are close
          // to avoid super high accelerations in poor time resolution
          if (d < settings.d_min) {
            console.log('particle', i, ',', j, 'too near for coulomb force.')
            d = settings.d_min
          }
          return ((-settings.K * particles[i].charge * particles[j].charge) / (d * d))
        })
        thisCoulombForceStrength += thisCoulombForce.length()
      }
    }
    if (shouldUpdateHud) {
      const $thisRow = $('#tabularInfo > tbody > tr:nth-child(' + (i + 1) + ')')
      $('.LJForceStrength', $thisRow).text(Math.round(thisLJForceStrength * 100) / 100)
      $('.GravitationForceStrength', $thisRow).text(Math.round(thisGravitationForceStrength * 100) / 100)
      $('.CoulombForceStrength', $thisRow).text(Math.round(thisCoulombForceStrength * 100) / 100)
    }
  }
}
function rescaleForceScaleBar (particles) {
  const highestForcePresent = _.max(_.map(particles, (particle) => particle.force.length()))
  const arrowScaleForForces = settings.unitArrowLength / highestForcePresent
  $('.mapscale#force').width(arrowScaleForForces * 1000000)
  return arrowScaleForForces
}
function rescaleVelocityScaleBar (particles) {
  const highestVelocityPresent = _.max(_.map(particles, (particle) => particle.velocity.length()))
  const arrowScaleForVelocities = settings.unitArrowLength / highestVelocityPresent
  $('.mapscale#velocity').width(arrowScaleForVelocities * 10000)
  return arrowScaleForVelocities
}
function animateOneParticle (i, arrowScaleForForces, arrowScaleForVelocities) {
  // shorthands
  const thisPosition = particles[i].position
  const thisVelocity = particles[i].velocity
  const thisMass = particles[i].mass
  // ======================== now update eveything user could see ========================
  // update velocities according to force:
  thisVelocity.addScaledVector(particles[i].force, settings.dt / particles[i].mass) // v = v + f/m·dt
  const thisSpeed = thisVelocity.length() // vector -> scalar
  // update positions according to velocity:
  thisPosition.addScaledVector(thisVelocity, settings.dt) // x = x + v·dt
  particleSystem.geometry.attributes.position.setXYZ(i, thisPosition.x, thisPosition.y, thisPosition.z)
  const trajectoryPositions = settings.if_showTrajectory
    ? particles[i].trajectory.geometry.attributes.position
    : null
    // Check if this particle hit a boundary of the universe (i.e. cell walls). If so, perioidic boundary condition (PBC) might be applied:
  if (settings.if_use_periodic_boundary_condition) {
    applyPbc(thisPosition, trajectoryPositions, settings.maxTrajectoryLength, settings.spaceBoundaryX, settings.spaceBoundaryY, settings.spaceBoundaryZ)
  }
  // let's see whether the camera should trace something (i.e. the reference frame should be moving), defined by user
  // update arrows: (http://jsfiddle.net/pardo/bgyem42v/3/)
  function updateArrow (arrow, from, vector, scale) {
    const lengthToScale = settings.if_proportionate_arrows_with_vectors
      ? vector.length() * scale
      : settings.unitArrowLength
    arrow.setLength(settings.if_limitArrowsMaxLength &&
            lengthToScale > settings.maxArrowLength
      ? settings.maxArrowLength
      : lengthToScale)
    arrow.position.copy(from)
    arrow.setDirection(new THREE.Vector3().copy(vector).normalize())
  }
  if (settings.if_showArrows) {
    updateArrow(particles[i].velocityArrow, particles[i].position, particles[i].velocity, arrowScaleForForces)
    updateArrow(particles[i].forceArrow, particles[i].position, particles[i].force, arrowScaleForVelocities)
  }
  // update trajectories:
  if (settings.if_showTrajectory) {
    if (time - lastSnapshotTime > settings.dt) {
      for (let j = 0; j < settings.maxTrajectoryLength - 1; j++) {
        trajectoryPositions.copyAt(j, trajectoryPositions, j + 1)
      }
      trajectoryPositions.setXYZ(settings.maxTrajectoryLength - 1, particles[i].position.x, particles[i].position.y, particles[i].position.z)
      trajectoryPositions.needsUpdate = true
    }
  }
  // update HUD, if visible:
  if (isVisible($('#hud'))) {
    const $thisRow = $('#tabularInfo > tbody > tr:nth-child(' + (i + 1) + ')')
    $('.speed', $thisRow).text(Math.round(thisSpeed * 100) / 100)
    $('.kineticEnergy', $thisRow).text(Math.round(thisSpeed * thisSpeed * thisMass * 50) / 100)
    $('.TotalForceStrength', $thisRow).text(particles[i].force
      ? Math.round(particles[i].force.length() * 100) / 100
      : '0')
  }
  if (settings.if_constant_temperature) {
    const currentTemperature = calculateTemperature()
    const scaleFactor = Math.sqrt(settings.targetTemperature / currentTemperature)
    _.forEach(particles, function (particle) {
      particle.velocity.multiplyScalar(scaleFactor)
    })
  }
  const ifThisParticleEscaped = settings.if_use_periodic_boundary_condition &&
        thisSpeed > settings.escapeSpeed &&
        (Math.abs(thisPosition.x) >= 0.9 * settings.spaceBoundaryX ||
            Math.abs(thisPosition.y) >= 0.9 * settings.spaceBoundaryY ||
            Math.abs(thisPosition.z) >= 0.9 * settings.spaceBoundaryZ)
  if (ifThisParticleEscaped) {
    console.log('Particle ', i, ' escaped with speed', thisSpeed, '.')
    // remove this particle from all lists:
    settings.particleCount -= 1
    particleSystem.geometry.attributes.color.setXYZ(i, 0, 0, 0)
    particleSystem.geometry.attributes.color.needsUpdate = true
    _.pullAt(particles, i)
  }
}
function applyPbc (thisPosition, trajectoryPositions, maxTrajectoryLength, spaceBoundaryX, spaceBoundaryY, spaceBoundaryZ) {
  while (thisPosition.x < -spaceBoundaryX) {
    thisPosition.x += 2 * spaceBoundaryX
    if (trajectoryPositions !== null) {
      for (let j = 0; j < maxTrajectoryLength; j++) {
        trajectoryPositions.setX(j, trajectoryPositions.getX(j) + 2 * spaceBoundaryX)
      }
    }
  }
  while (thisPosition.x > spaceBoundaryX) {
    thisPosition.x -= 2 * spaceBoundaryX
    if (trajectoryPositions !== null) {
      for (let j = 0; j < maxTrajectoryLength; j++) {
        trajectoryPositions.setX(j, trajectoryPositions.getX(j) - 2 * spaceBoundaryX)
      }
    }
  }
  while (thisPosition.y < -spaceBoundaryY) {
    thisPosition.y += 2 * spaceBoundaryY
    if (trajectoryPositions !== null) {
      for (let j = 0; j < maxTrajectoryLength; j++) {
        trajectoryPositions.setY(j, trajectoryPositions.getY(j) + 2 * spaceBoundaryY)
      }
    }
  }
  while (thisPosition.y > spaceBoundaryY) {
    thisPosition.y -= 2 * spaceBoundaryY
    if (trajectoryPositions !== null) {
      for (let j = 0; j < maxTrajectoryLength; j++) {
        trajectoryPositions.setY(j, trajectoryPositions.getY(j) - 2 * spaceBoundaryY)
      }
    }
  }
  while (thisPosition.z < -spaceBoundaryZ) {
    thisPosition.z += 2 * spaceBoundaryZ
    if (trajectoryPositions !== null) {
      for (let j = 0; j < maxTrajectoryLength; j++) {
        trajectoryPositions.setZ(j, trajectoryPositions.getZ(j) + 2 * spaceBoundaryZ)
      }
      trajectoryPositions.needsUpdate = true
    }
  }
  while (thisPosition.z > spaceBoundaryZ) {
    thisPosition.z -= 2 * spaceBoundaryZ
    if (trajectoryPositions !== null) {
      for (let j = 0; j < maxTrajectoryLength; j++) {
        trajectoryPositions.setZ(j, trajectoryPositions.getZ(j) - 2 * spaceBoundaryZ)
      }
    }
  }
  if (trajectoryPositions !== null) {
    trajectoryPositions.needsUpdate = true
  }
}
function animate () {
  time += settings.dt
  computeForces(particles, settings.particleCount, isVisible($('#hud')))
  const arrowScaleForForces = rescaleForceScaleBar(particles)
  const arrowScaleForVelocities = rescaleVelocityScaleBar(particles)
  for (let i = 0; i < settings.particleCount; i++) {
    animateOneParticle(i, arrowScaleForForces, arrowScaleForVelocities)
  }
  if (settings.if_showTrajectory &&
        time - lastSnapshotTime > settings.dt) {
    lastSnapshotTime = time
  }
  if (settings.if_ReferenceFrame_movesWithSun) {
    for (const i in particles) {
      particles[i].position.sub(particles[0].position)
    }
  }
  // =============================== now the rendering ==================================
  // flag to the particle system that we've changed its vertices.
  particleSystem.geometry.attributes.position.needsUpdate = true
  // draw this frame
  statistics(temperaturePanel, maxTemperature)
  update()
  render()
  // set up the next call
  if (settings.ifRun) {
    requestAnimationFrame(animate)
  }
  stats.update()
}
function calculateTemperature () {
  let temperature = 0
  for (let i = 0; i < settings.particleCount; i++) {
    temperature +=
            particles[i].mass *
                particles[i].velocity.length() *
                particles[i].velocity.length()
  }
  temperature *= 1 / settings.kB / (3 * settings.particleCount - 3)
  if (temperature > maxTemperature) {
    maxTemperature = temperature
  }
  return temperature
}
function statistics (temperaturePanel, maxTemperature) {
  const temperature = calculateTemperature()
  temperaturePanel.update(temperature, maxTemperature)
}
function update () {
  // resize();
  camera.updateProjectionMatrix()
  controls.update()
}
function render () {
  if (ifMobileDevice) {
    effect.render(scene, camera)
  } else {
    renderer.render(scene, camera)
  }
}
// when document is ready:
$(() => {
  console.log('Ready.')
  const values = init(settings, particles, time, lastSnapshotTime)
  scene = values[0]
  particleSystem = values[1]
  camera = values[2]
  renderer = values[3]
  controls = values[4]
  stats = values[5]
  temperaturePanel = values[6]
  animate()
  // bind keyboard event:
  document.onkeydown = (e) => {
    switch (e.keyCode) {
      case 9:
        $('#hud').toggle()
        break
    }
  }
})
