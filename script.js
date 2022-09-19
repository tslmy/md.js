// global variables
let camera;
let scene;
let renderer;
let effect;
let controls;
let element;
let container;
const ifMobileDevice =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
let ifRun = true;
let geometry;
let material;
let particleMaterial;
let trajectoryMaterial;
const particleColors = [];
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
  // particleColors,
  arrowVelocities,
  arrowForces,
  trajectoryGeometries,
  trajectoryLines,
];
let totalMass = 0;
let time = 0;
let lastSnapshotTime = 0;
const snapshotDuration = dt;
const strongestForcePresent = 1;
const fastestVelocityPresent = 1;

/**
 * el: the DOM element you'd like to test for visibility.
 */
function isVisible(el) {
  return el.offsetParent !== null;
}

// import { generateTexture } from "./utils.js";

function addParticle(
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
  particles
) {
  // make colors (http://jsfiddle.net/J7zp4/200/)
  const thisColor = new THREE.Color();
  thisColor.setHSL(colorH, colorS, colorL);
  particleColors.push(thisColor);
  // Create the vertex
  const thisPosition = new THREE.Vector3(positionX, positionY, positionZ);
  particlePositions.push(thisPosition);
  // Add the vertex to the geometry
  particles.vertices.push(thisPosition);
  // make velocity
  const thisVelocity = new THREE.Vector3(velocityX, velocityY, velocityZ);
  particleVelocities.push(thisVelocity);
  // make force
  const thisForce = new THREE.Vector3(forceX, forceY, forceZ);
  particleForces.push(thisForce);
  // mass
  particleMasses.push(thisMass);
  totalMass += thisMass;
  // charge
  particleCharges.push(thisCharge);
  // add two arrows
  var arrow = new THREE.ArrowHelper(
    new THREE.Vector3(),
    new THREE.Vector3(),
    1,
    0x0055aa
  );
  scene.add(arrow);
  arrowVelocities.push(arrow);
  var arrow = new THREE.ArrowHelper(
    new THREE.Vector3(),
    new THREE.Vector3(),
    1,
    0x555555
  );
  scene.add(arrow);
  arrowForces.push(arrow);
  // add trajectories.
  if (if_showTrajectory) {
    const thisTrajectory = makeTrajectory(thisColor, thisPosition);
    trajectoryLines.push(thisTrajectory);
    scene.add(thisTrajectory);
  }
  // Make the HUD table.
  $("#tabularInfo > tbody").append(
    '<tr>\
        <td class="particle" style="\
            color: hsl(' +
      colorH * 360 +
      "," +
      colorS * 100 +
      "%," +
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
  );
}

/**
 *  Make objects that will contain the trajectory points.
 * See <http://stackoverflow.com/questions/31399856/drawing-a-line-with-three-js-dynamically>.
 */
function makeTrajectory(thisColor, thisPosition) {
  const thisGeometry = new THREE.BufferGeometry();
  const white = new THREE.Color("#FFFFFF");
  // attributes
  const points = new Float32Array(maxTrajectoryLength * 3); // 3 vertices per point
  const colors = new Float32Array(maxTrajectoryLength * 3); // 3 vertices per point
  thisGeometry.addAttribute("position", new THREE.BufferAttribute(points, 3));
  thisGeometry.addAttribute("color", new THREE.BufferAttribute(colors, 3));
  for (let i = 0; i < maxTrajectoryLength; i++) {
    // for each vertex of this trajectory:
    // calculate for how many percent should the color of this vertex be diluted/bleached.
    const interpolationFactor = (maxTrajectoryLength - i) / maxTrajectoryLength;
    // make the bleached color object by cloning the particle's color and then lerping it with the white color.
    const thisVertexColor = thisColor.clone().lerp(white, interpolationFactor);
    // assign this color to this vertex
    thisGeometry.attributes.color.setXYZ(
      i,
      thisVertexColor.r,
      thisVertexColor.g,
      thisVertexColor.b
    );
    // put this(every) vertex to the same place as the particle started
    thisGeometry.attributes.position.setXYZ(
      i,
      thisPosition.x,
      thisPosition.y,
      thisPosition.z
    );
  }
  trajectoryGeometries.push(thisGeometry);
  // finished preparing the geometry for this trajectory
  thisTrajectoryMaterial = new THREE.LineBasicMaterial({
    linewidth: 0.5,
    vertexColors: THREE.VertexColors,
  });
  return new THREE.Line(thisGeometry, thisTrajectoryMaterial);
}

function updateClonesPositions() {
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

function init() {
  // enable settings
  initializeGuiControls();
  // initialize the scene
  scene = new THREE.Scene();
  //    configure the scene:
  if (if_useFog) {
    scene.fog = new THREE.Fog(0xffffff, 0, 20);
  }
  //    define objects:
  if (if_showUniverseBoundary) {
    drawBox(spaceBoundaryX, spaceBoundaryY, spaceBoundaryZ, scene);
  }
  const group = new THREE.Object3D();
  particles = createParticleSystem(group);
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
  if (ifMobileDevice) effect = new THREE.StereoEffect(renderer);
  element = renderer.domElement;
  container = document.body;
  container.appendChild(element);
  // activate plugins:
  controls = new THREE.OrbitControls(camera, element); // this is for non-VR devices
  function setOrientationControls(e) {
    if (!e.alpha) {
      return;
    }
    controls = new THREE.DeviceOrientationControls(camera, true);
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
  window.onbeforeunload = saveState;
}

function applyForce(i, j, func) {
  const thisPosition = particlePositions[i];
  const thatPosition = particlePositions[j];
  const rOriginal = new THREE.Vector3().subVectors(thisPosition, thatPosition); // relative displacement
  let r;
  // ====== populate the array "particleJClones" ======
  if (if_use_periodic_boundary_condition) {
    var clonePositions = makeClonePositionsList(
      spaceBoundaryX,
      spaceBoundaryY,
      spaceBoundaryZ
    );
    clonePositions.push([0, 0, 0]);
  } else {
    var clonePositions = [[0, 0, 0]];
  }
  // ==================================================
  // force due to j in this cell:
  for (thatPositionDisplacement of clonePositions) {
    // (don't use "for-in" loops!)
    r = rOriginal.clone();
    // (possibly) displace shift the end of this vector from particle j to one of its clones:
    r.x -= thatPositionDisplacement[0];
    r.y -= thatPositionDisplacement[1];
    r.z -= thatPositionDisplacement[2];
    const d = r.length(); // calculate distance between particles i and j (with j may being a clone)
    if (d < cutoffDistance) {
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
  if_apply_LJpotential = true,
  if_apply_gravitation = true,
  if_apply_coulombForce = true,
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
      if (if_apply_LJpotential) {
        // Use Lennard-Jones potential
        // V = 4*epsilon*((delta/d)^12 - (delta/d)^6)
        // F = 4*epsilon*(-12/d*(delta/d)^12 + 6/d*(delta/d)^6) r/|r|
        const thisLJForce = applyForce(i, j, (i, j, d) => {
          let d6 = DELTA / d;
          if (d6 < 0.5) {
            d6 = 0.5; // what kind of socery is this??
          }
          d6 = d6 * d6 * d6;
          d6 = d6 * d6;
          return 4 * EPSILON * (6 / d) * (-2 * d6 * d6 + d6);
        });
        thisLJForceStrength += thisLJForce.length();
      }
      if (if_apply_gravitation) {
        // Use gravitational potential
        // -> F = GMm/(d*d) r/|r|
        const thisGravitationForce = applyForce(i, j, (i, j, d) => {
          // Use d_min to prevent high potential when particles are close
          // to avoid super high accelerations in poor time resolution
          if (d < d_min) {
            console.log("particle", i, ",", j, "too near for gravitation.");
            d = d_min;
          }
          return (G * particleMasses[i] * particleMasses[j]) / (d * d);
        });
        thisGravitationForceStrength += thisGravitationForce.length();
      }
      if (if_apply_coulombForce) {
        // Use gravitational potential
        // -> F = GMm/(d*d) r/|r|
        const thisCoulombForce = applyForce(i, j, (i, j, d) => {
          // Use d_min to prevent high potential when particles are close
          // to avoid super high accelerations in poor time resolution
          if (d < d_min) {
            console.log("particle", i, ",", j, "too near for coulomb force.");
            d = d_min;
          }
          return (-K * particleCharges[i] * particleCharges[j]) / (d * d);
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
  const arrowScaleForForces = unitArrowLength / highestForcePresent;
  $(".mapscale#force").width(arrowScaleForForces * 1000000);
  return arrowScaleForForces;
}

function rescaleVelocityScaleBar(particleVelocities) {
  const highestVelocityPresent = _.max(
    _.map(particleVelocities, (vector) => vector.length())
  );
  const arrowScaleForVelocities = unitArrowLength / highestVelocityPresent;
  $(".mapscale#velocity").width(arrowScaleForVelocities * 10000);
  return arrowScaleForVelocities;
}

function animate() {
  time += dt;
  computeForces(
    particleForces,
    particleCount,
    if_apply_LJpotential,
    if_apply_gravitation,
    if_apply_coulombForce,
    isVisible($("#hud"))
  );
  const arrowScaleForForces = rescaleForceScaleBar(particleForces);
  const arrowScaleForVelocities = rescaleVelocityScaleBar(particleVelocities);
  for (let i = 0; i < particleCount; i++) {
    // shorthands
    const thisPosition = particlePositions[i];
    const thisVelocity = particleVelocities[i];
    const thisMass = particleMasses[i];
    // ======================== now update eveything user could see ========================
    // update velocities according to force:
    thisVelocity.addScaledVector(particleForces[i], dt / particleMasses[i]); // v = v + f/m·dt
    const thisSpeed = thisVelocity.length(); // vector -> scalar
    if (
      if_use_periodic_boundary_condition &&
      thisSpeed > escapeSpeed &&
      (Math.abs(thisPosition.x) >= 0.9 * spaceBoundaryX ||
        Math.abs(thisPosition.y) >= 0.9 * spaceBoundaryY ||
        Math.abs(thisPosition.z) >= 0.9 * spaceBoundaryZ)
    ) {
      console.log("Particle ", i, " escaped with speed", thisSpeed, ".");
      // remove this particle from all lists:
      particleCount -= 1;
      particles.colors[i].offsetHSL(0, -0.1, 0.1);
      particles.colorsNeedUpdate = true;
      _.forEach(particleProperties, function (array) {
        _.pullAt(array, i);
      });
      ifThisParticleEscaped = true;
    } else {
      ifThisParticleEscaped = false;
      // update positions according to velocity:
      thisPosition.addScaledVector(thisVelocity, dt); // x = x + v·dt
      // Check if this particle hit a boundary of the universe (i.e. cell walls). If so, perioidic boundary condition (PBC) might be applied:
      if (if_use_periodic_boundary_condition) {
        while (thisPosition.x < -spaceBoundaryX) {
          thisPosition.x += 2 * spaceBoundaryX;
          if (if_showTrajectory) {
            var lineNodePositions =
              trajectoryLines[i].geometry.attributes.position; // fisrt, make a short-hand
            for (var j = 0; j < maxTrajectoryLength; j++) {
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
          if (if_showTrajectory) {
            var lineNodePositions =
              trajectoryLines[i].geometry.attributes.position; // fisrt, make a short-hand
            for (var j = 0; j < maxTrajectoryLength; j++) {
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
          if (if_showTrajectory) {
            var lineNodePositions =
              trajectoryLines[i].geometry.attributes.position; // fisrt, make a short-hand
            for (var j = 0; j < maxTrajectoryLength; j++) {
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
          if (if_showTrajectory) {
            var lineNodePositions =
              trajectoryLines[i].geometry.attributes.position; // fisrt, make a short-hand
            for (var j = 0; j < maxTrajectoryLength; j++) {
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
          if (if_showTrajectory) {
            var lineNodePositions =
              trajectoryLines[i].geometry.attributes.position; // fisrt, make a short-hand
            for (var j = 0; j < maxTrajectoryLength; j++) {
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
          if (if_showTrajectory) {
            var lineNodePositions =
              trajectoryLines[i].geometry.attributes.position; // fisrt, make a short-hand
            for (var j = 0; j < maxTrajectoryLength; j++) {
              lineNodePositions.setZ(
                j,
                lineNodePositions.getZ(j) - 2 * spaceBoundaryZ
              );
            }
            lineNodePositions.needsUpdate = true;
          }
        }
      }
      // let's see whether the camera should trace something (i.e. the reference frame should be moving), defined by user
      // update arrows: (http://jsfiddle.net/pardo/bgyem42v/3/)
      function updateArrow(arrow, from, vector, scale) {
        const lengthToScale = if_proportionate_arrows_with_vectors
          ? vector.length() * scale
          : unitArrowLength;
        arrow.setLength(
          if_limitArrowsMaxLength && lengthToScale > maxArrowLength
            ? maxArrowLength
            : lengthToScale
        );
        arrow.position.copy(from);
        arrow.setDirection(new THREE.Vector3().copy(vector).normalize());
      }
      if (if_showArrows) {
        updateArrow(
          (arrow = arrowVelocities[i]),
          (from = particlePositions[i]),
          (vector = particleVelocities[i]),
          (scale = arrowScaleForForces)
        );
        updateArrow(
          (arrow = arrowForces[i]),
          (from = particlePositions[i]),
          (vector = particleForces[i]),
          (scale = arrowScaleForVelocities)
        );
      }
      // update trajectories:
      if (if_showTrajectory) {
        if (time - lastSnapshotTime > snapshotDuration) {
          // fisrt, make a short-hand:
          var lineNodePositions =
            trajectoryLines[i].geometry.attributes.position;
          for (var j = 0; j < maxTrajectoryLength - 1; j++) {
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
      $thisRow = $("#tabularInfo > tbody > tr:nth-child(" + (i + 1) + ")");
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
    if (if_constant_temperature) {
      const currentTemperature = calculateTemperature();
      scaleFactor = Math.sqrt(targetTemperature / currentTemperature);
      _.forEach(particleVelocities, function (velocity) {
        velocity.multiplyScalar(scaleFactor);
      });
    }
  }
  if (if_showTrajectory && time - lastSnapshotTime > snapshotDuration) {
    lastSnapshotTime = time;
  }
  if (if_ReferenceFrame_movesWithSun) {
    for (let i in particlePositions) {
      particlePositions[i].sub(particlePositions[0]);
    }
  }
  // =============================== now the rendering ==================================
  // flag to the particle system that we've changed its vertices.
  particleSystem.geometry.verticesNeedUpdate = true;
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
let maxTemperature = 0;

function calculateTemperature() {
  let temperature = 0;
  for (let i = 0; i < particleCount; i++) {
    temperature +=
      particleMasses[i] *
      particleVelocities[i].length() *
      particleVelocities[i].length();
  }
  temperature *= 1 / kB / (3 * particleCount - 3);
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

function stop() {
  ifRun = false;
}

function toggleHUD() {
  $("#hud").toggle();
}

// when document is ready:
$(() => {
  console.log("Ready.");
  init();
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
