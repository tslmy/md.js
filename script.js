import { settings, initializeGuiControls } from "./settings.js";
import { drawBox } from "./drawing_helpers.js";
import { saveState } from "./stateStorage.js";

import * as THREE from "three";
import { OrbitControls } from "OrbitControls";
import { DeviceOrientationControls } from "DeviceOrientationControls";
import Stats from "Stats";
import { StereoEffect } from "StereoEffect";
import {
  createParticleSystem,
  makeClonePositionsList,
} from "./particleSystem.js";
// global variables
let camera;
let scene;
let renderer;
let effect;
let controls;
let element;
let container;
let temperaturePanel;
let stats;

let maxTemperature = 0;
let particleSystem;

const ifMobileDevice =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
const ifRun = true;
let particles = [];
const particlePositions = [];
const particleForces = [];
const particleVelocities = [];
const particleMasses = [];
const particleCharges = [];
const arrowVelocities = [];
const arrowForces = [];
const trajectoryGeometries = [];
const trajectoryLines = [];
const particleProperties = [
  particlePositions,
  particleVelocities,
  particleForces,
  particleMasses,
  particleCharges,
  arrowVelocities,
  arrowForces,
  trajectoryGeometries,
  trajectoryLines,
];
const totalMass = 0;
let time = 0;
let lastSnapshotTime = 0;
const snapshotDuration = settings.dt;
/**
 * el: the DOM element you'd like to test for visibility.
 */
function isVisible(el) {
  return el.offsetParent !== null;
}

function updateClonesPositions(
  spaceBoundaryX,
  spaceBoundaryY,
  spaceBoundaryZ,
  group
) {
  const clonePositions = makeClonePositionsList(
    spaceBoundaryX,
    spaceBoundaryY,
    spaceBoundaryZ
  );
  for (i = 0; i < 26; i++) {
    group.children[i + 1].position.set(
      clonePositions[i][0],
      clonePositions[i][1],
      clonePositions[i][2]
    );
  }
}

function init(settings) {
  // enable settings
  initializeGuiControls(settings);
  // initialize the scene
  scene = new THREE.Scene();
  //    configure the scene:
  if (settings.if_useFog) {
    scene.fog = new THREE.Fog(0xffffff, 0, 20);
  }
  //    define objects:
  if (settings.if_showUniverseBoundary) {
    drawBox(
      settings.spaceBoundaryX,
      settings.spaceBoundaryY,
      settings.spaceBoundaryZ,
      scene
    );
  }
  const group = new THREE.Object3D();
  particleSystem = createParticleSystem(
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
  );
  particles = particleSystem.geometry;
  scene.add(group);
  // initialize the camera
  camera = new THREE.PerspectiveCamera(
    90,
    window.innerWidth / window.innerHeight,
    1,
    1000000
  );
  camera.position.set(0, 2, 10);
  scene.add(camera);
  // initialize renderer
  renderer = new THREE.WebGLRenderer({
    alpha: true,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(4); // enhance resolution
  if (ifMobileDevice) effect = new StereoEffect(renderer);
  element = renderer.domElement;
  container = document.body;
  container.appendChild(element);
  // activate plugins:
  controls = new OrbitControls(camera, element); // this is for non-VR devices
  function setOrientationControls(e) {
    if (!e.alpha) {
      return;
    }
    controls = new DeviceOrientationControls(camera, true);
    controls.connect();
    controls.update();
    element.addEventListener("click", fullscreen, false);
    window.removeEventListener(
      "deviceorientation",
      setOrientationControls,
      true
    );
  }
  window.addEventListener("deviceorientation", setOrientationControls, true);
  // add stat
  stats = new Stats();
  temperaturePanel = stats.addPanel(new Stats.Panel("Temp.", "#ff8", "#221"));
  stats.showPanel(2);
  container.append(stats.domElement);
  // add event listeners
  window.addEventListener("resize", resize, false);
  setTimeout(resize, 1);
  window.onbeforeunload = () => {
    saveState({
      particleCount: settings.particleCount,
      particleColors: particles.getAttribute("color").array,
      particlePositions: particles.getAttribute("position").array,
      particleForces,
      particleVelocities,
      particleMasses,
      particleCharges,
      time,
      lastSnapshotTime,
    });
  };
}

function applyForce(i, j, func) {
  const thisPosition = particlePositions[i];
  const thatPosition = particlePositions[j];
  const rOriginal = new THREE.Vector3().subVectors(thisPosition, thatPosition); // relative displacement
  let r;
  let clonePositions;
  // ====== populate the array "particleJClones" ======
  if (settings.if_use_periodic_boundary_condition) {
    clonePositions = makeClonePositionsList(
      settings.spaceBoundaryX,
      settings.spaceBoundaryY,
      settings.spaceBoundaryZ
    );
    clonePositions.push([0, 0, 0]);
  } else {
    clonePositions = [[0, 0, 0]];
  }
  // ==================================================
  // force due to j in this cell:
  for (const thatPositionDisplacement of clonePositions) {
    // (don't use "for-in" loops!)
    r = rOriginal.clone();
    // (possibly) displace shift the end of this vector from particle j to one of its clones:
    r.x -= thatPositionDisplacement[0];
    r.y -= thatPositionDisplacement[1];
    r.z -= thatPositionDisplacement[2];
    const d = r.length(); // calculate distance between particles i and j (with j may being a clone)
    if (d < settings.cutoffDistance) {
      r.setLength(func(i, j, d)); // use calculated "force strength" as vector length
      particleForces[i].sub(r);
      particleForces[j].add(r);
    }
  }
  return r; // return the calculated force for further investigation.
}

function computeForces(
  particleForces,
  particleCount = 8,
  shouldUpdateHud = false
) {
  // remove all forces first.
  particleForces.forEach((particleForce) => particleForce.set(0, 0, 0));
  for (let i = 0; i < particleCount; i++) {
    // initialize total force counters:
    let thisLJForceStrength = 0;
    let thisGravitationForceStrength = 0;
    let thisCoulombForceStrength = 0;
    // process interactions:
    for (let j = i + 1; j < particleCount; j++) {
      // generate all forces:
      if (settings.if_apply_LJpotential) {
        // Use Lennard-Jones potential
        // V = 4*epsilon*((delta/d)^12 - (delta/d)^6)
        // F = 4*epsilon*(-12/d*(delta/d)^12 + 6/d*(delta/d)^6) r/|r|
        const thisLJForce = applyForce(i, j, (i, j, d) => {
          let d6 = settings.DELTA / d;
          if (d6 < 0.5) {
            d6 = 0.5; // what kind of socery is this??
          }
          d6 = d6 * d6 * d6;
          d6 = d6 * d6;
          return 4 * settings.EPSILON * (6 / d) * (-2 * d6 * d6 + d6);
        });
        thisLJForceStrength += thisLJForce.length();
      }
      if (settings.if_apply_gravitation) {
        // Use gravitational potential
        // -> F = GMm/(d*d) r/|r|
        const thisGravitationForce = applyForce(i, j, (i, j, d) => {
          // Use d_min to prevent high potential when particles are close
          // to avoid super high accelerations in poor time resolution
          if (d < settings.d_min) {
            console.log("particle", i, ",", j, "too near for gravitation.");
            d = settings.d_min;
          }
          return (settings.G * particleMasses[i] * particleMasses[j]) / (d * d);
        });
        thisGravitationForceStrength += thisGravitationForce.length();
      }
      if (settings.if_apply_coulombForce) {
        // Use gravitational potential
        // -> F = GMm/(d*d) r/|r|
        const thisCoulombForce = applyForce(i, j, (i, j, d) => {
          // Use d_min to prevent high potential when particles are close
          // to avoid super high accelerations in poor time resolution
          if (d < settings.d_min) {
            console.log("particle", i, ",", j, "too near for coulomb force.");
            d = settings.d_min;
          }
          return (
            (-settings.K * particleCharges[i] * particleCharges[j]) / (d * d)
          );
        });
        thisCoulombForceStrength += thisCoulombForce.length();
      }
    }
    if (shouldUpdateHud) {
      const $thisRow = $(
        "#tabularInfo > tbody > tr:nth-child(" + (i + 1) + ")"
      );
      $(".LJForceStrength", $thisRow).text(
        Math.round(thisLJForceStrength * 100) / 100
      );
      $(".GravitationForceStrength", $thisRow).text(
        Math.round(thisGravitationForceStrength * 100) / 100
      );
      $(".CoulombForceStrength", $thisRow).text(
        Math.round(thisCoulombForceStrength * 100) / 100
      );
    }
  }
}

function rescaleForceScaleBar(particleForces) {
  const highestForcePresent = _.max(
    _.map(particleForces, (vector) => vector.length())
  );
  const arrowScaleForForces = settings.unitArrowLength / highestForcePresent;
  $(".mapscale#force").width(arrowScaleForForces * 1000000);
  return arrowScaleForForces;
}

function rescaleVelocityScaleBar(particleVelocities) {
  const highestVelocityPresent = _.max(
    _.map(particleVelocities, (vector) => vector.length())
  );
  const arrowScaleForVelocities =
    settings.unitArrowLength / highestVelocityPresent;
  $(".mapscale#velocity").width(arrowScaleForVelocities * 10000);
  return arrowScaleForVelocities;
}

function animateOneParticle(i, arrowScaleForForces, arrowScaleForVelocities) {
  // shorthands
  const thisPosition = particlePositions[i];
  const thisVelocity = particleVelocities[i];
  const thisMass = particleMasses[i];
  // ======================== now update eveything user could see ========================
  // update velocities according to force:
  thisVelocity.addScaledVector(
    particleForces[i],
    settings.dt / particleMasses[i]
  ); // v = v + f/m·dt
  const thisSpeed = thisVelocity.length(); // vector -> scalar
  const ifThisParticleEscaped =
    settings.if_use_periodic_boundary_condition &&
    thisSpeed > settings.escapeSpeed &&
    (Math.abs(thisPosition.x) >= 0.9 * settings.spaceBoundaryX ||
      Math.abs(thisPosition.y) >= 0.9 * settings.spaceBoundaryY ||
      Math.abs(thisPosition.z) >= 0.9 * settings.spaceBoundaryZ);
  if (ifThisParticleEscaped) {
    console.log("Particle ", i, " escaped with speed", thisSpeed, ".");
    // remove this particle from all lists:
    settings.particleCount -= 1;
    particles.attributes.color.setXYZ(i, 0, 0, 0);
    particles.attributes.color.needsUpdate = true;
    _.forEach(particleProperties, function (array) {
      _.pullAt(array, i);
    });
  } else {
    // update positions according to velocity:
    thisPosition.addScaledVector(thisVelocity, settings.dt); // x = x + v·dt
    particles.attributes.position.setXYZ(
      i,
      thisPosition.x,
      thisPosition.y,
      thisPosition.z
    );
    const lineNodePositions = settings.if_showTrajectory
      ? trajectoryLines[i].geometry.attributes.position
      : null;
    // Check if this particle hit a boundary of the universe (i.e. cell walls). If so, perioidic boundary condition (PBC) might be applied:
    if (settings.if_use_periodic_boundary_condition) {
      applyPbc(
        thisPosition,
        lineNodePositions,
        settings.maxTrajectoryLength,
        settings.spaceBoundaryX,
        settings.spaceBoundaryY,
        settings.spaceBoundaryZ
      );
    }
    // let's see whether the camera should trace something (i.e. the reference frame should be moving), defined by user
    // update arrows: (http://jsfiddle.net/pardo/bgyem42v/3/)
    function updateArrow(arrow, from, vector, scale) {
      const lengthToScale = settings.if_proportionate_arrows_with_vectors
        ? vector.length() * scale
        : unitArrowLength;
      arrow.setLength(
        settings.if_limitArrowsMaxLength &&
          lengthToScale > settings.maxArrowLength
          ? settings.maxArrowLength
          : lengthToScale
      );
      arrow.position.copy(from);
      arrow.setDirection(new THREE.Vector3().copy(vector).normalize());
    }
    if (settings.if_showArrows) {
      updateArrow(
        arrowVelocities[i],
        particlePositions[i],
        particleVelocities[i],
        arrowScaleForForces
      );
      updateArrow(
        arrowForces[i],
        particlePositions[i],
        particleForces[i],
        arrowScaleForVelocities
      );
    }
    // update trajectories:
    if (settings.if_showTrajectory) {
      if (time - lastSnapshotTime > settings.snapshotDuration) {
        for (let j = 0; j < settings.maxTrajectoryLength - 1; j++) {
          lineNodePositions.copyAt(j, lineNodePositions, j + 1);
        }
        lineNodePositions.setXYZ(
          j,
          particlePositions[i].x,
          particlePositions[i].y,
          particlePositions[i].z
        );
        lineNodePositions.needsUpdate = true;
      }
    }
  }
  // update HUD, if visible:
  if (isVisible($("#hud"))) {
    const $thisRow = $("#tabularInfo > tbody > tr:nth-child(" + (i + 1) + ")");
    $(".speed", $thisRow).text(Math.round(thisSpeed * 100) / 100);
    $(".kineticEnergy", $thisRow).text(
      Math.round(thisSpeed * thisSpeed * thisMass * 50) / 100
    );
    $(".TotalForceStrength", $thisRow).text(
      particleForces[i]
        ? Math.round(particleForces[i].length() * 100) / 100
        : "0"
    );
  }
  if (settings.if_constant_temperature) {
    const currentTemperature = calculateTemperature();
    scaleFactor = Math.sqrt(targetTemperature / currentTemperature);
    _.forEach(particleVelocities, function (velocity) {
      velocity.multiplyScalar(scaleFactor);
    });
  }
}

function applyPbc(
  thisPosition,
  lineNodePositions,
  maxTrajectoryLength,
  spaceBoundaryX,
  spaceBoundaryY,
  spaceBoundaryZ
) {
  while (thisPosition.x < -spaceBoundaryX) {
    thisPosition.x += 2 * spaceBoundaryX;
    if (lineNodePositions !== null) {
      for (let j = 0; j < maxTrajectoryLength; j++) {
        lineNodePositions.setX(
          j,
          lineNodePositions.getX(j) + 2 * spaceBoundaryX
        );
      }
      lineNodePositions.needsUpdate = true;
    }
  }
  while (thisPosition.x > spaceBoundaryX) {
    thisPosition.x -= 2 * spaceBoundaryX;
    if (lineNodePositions !== null) {
      for (let j = 0; j < maxTrajectoryLength; j++) {
        lineNodePositions.setX(
          j,
          lineNodePositions.getX(j) - 2 * spaceBoundaryX
        );
      }
      lineNodePositions.needsUpdate = true;
    }
  }
  while (thisPosition.y < -spaceBoundaryY) {
    thisPosition.y += 2 * spaceBoundaryY;
    if (lineNodePositions !== null) {
      for (let j = 0; j < maxTrajectoryLength; j++) {
        lineNodePositions.setY(
          j,
          lineNodePositions.getY(j) + 2 * spaceBoundaryY
        );
      }
      lineNodePositions.needsUpdate = true;
    }
  }
  while (thisPosition.y > spaceBoundaryY) {
    thisPosition.y -= 2 * spaceBoundaryY;
    if (lineNodePositions !== null) {
      for (let j = 0; j < maxTrajectoryLength; j++) {
        lineNodePositions.setY(
          j,
          lineNodePositions.getY(j) - 2 * spaceBoundaryY
        );
      }
      lineNodePositions.needsUpdate = true;
    }
  }
  while (thisPosition.z < -spaceBoundaryZ) {
    thisPosition.z += 2 * spaceBoundaryZ;
    if (lineNodePositions !== null) {
      for (let j = 0; j < maxTrajectoryLength; j++) {
        lineNodePositions.setZ(
          j,
          lineNodePositions.getZ(j) + 2 * spaceBoundaryZ
        );
      }
      lineNodePositions.needsUpdate = true;
    }
  }
  while (thisPosition.z > spaceBoundaryZ) {
    thisPosition.z -= 2 * spaceBoundaryZ;
    if (lineNodePositions !== null) {
      for (let j = 0; j < maxTrajectoryLength; j++) {
        lineNodePositions.setZ(
          j,
          lineNodePositions.getZ(j) - 2 * spaceBoundaryZ
        );
      }
      lineNodePositions.needsUpdate = true;
    }
  }
}

function animate() {
  time += settings.dt;
  computeForces(particleForces, settings.particleCount, isVisible($("#hud")));
  const arrowScaleForForces = rescaleForceScaleBar(particleForces);
  const arrowScaleForVelocities = rescaleVelocityScaleBar(particleVelocities);
  for (let i = 0; i < settings.particleCount; i++) {
    animateOneParticle(i, arrowScaleForForces, arrowScaleForVelocities);
  }
  if (
    settings.if_showTrajectory &&
    time - lastSnapshotTime > snapshotDuration
  ) {
    lastSnapshotTime = time;
  }
  if (settings.if_ReferenceFrame_movesWithSun) {
    for (const i in particlePositions) {
      particlePositions[i].sub(particlePositions[0]);
    }
  }
  // =============================== now the rendering ==================================
  // flag to the particle system that we've changed its vertices.
  particleSystem.geometry.attributes.position.needsUpdate = true;
  // draw this frame
  statistics();
  update();
  render();
  // set up the next call
  if (ifRun) {
    requestAnimationFrame(animate);
  }
  stats.update();
}
function resize() {
  const width = container.offsetWidth;
  const height = container.offsetHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  if (ifMobileDevice) effect.setSize(width, height);
}
function calculateTemperature() {
  let temperature = 0;
  for (let i = 0; i < settings.particleCount; i++) {
    temperature +=
      particleMasses[i] *
      particleVelocities[i].length() *
      particleVelocities[i].length();
  }
  temperature *= 1 / settings.kB / (3 * settings.particleCount - 3);
  if (temperature > maxTemperature) {
    maxTemperature = temperature;
  }
  return temperature;
}

function statistics() {
  const temperature = calculateTemperature();
  temperaturePanel.update(temperature, maxTemperature);
}

function update() {
  // resize();
  camera.updateProjectionMatrix();
  controls.update();
}

function render() {
  if (ifMobileDevice) {
    effect.render(scene, camera);
  } else {
    renderer.render(scene, camera);
  }
}

function fullscreen() {
  if (container.requestFullscreen) {
    container.requestFullscreen();
  } else if (container.msRequestFullscreen) {
    container.msRequestFullscreen();
  } else if (container.mozRequestFullScreen) {
    container.mozRequestFullScreen();
  } else if (container.webkitRequestFullscreen) {
    container.webkitRequestFullscreen();
  }
}

// when document is ready:
$(() => {
  console.log("Ready.");
  init(settings);
  animate();
  // bind keyboard event:
  document.onkeydown = (e) => {
    switch (e.keyCode) {
      case 9:
        toggleHUD();
        break;
    }
  };
});
