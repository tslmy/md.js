"use strict";

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
  particles,
  particleColors,
  particlePositions,
  particleVelocities,
  particleForces,
  particleMasses,
  totalMass,
  particleCharges,
  scene,
  arrowVelocities,
  arrowForces,
  trajectoryLines
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
  const arrow1 = new THREE.ArrowHelper(
    new THREE.Vector3(),
    new THREE.Vector3(),
    1,
    0x0055aa
  );
  scene.add(arrow1);
  arrowVelocities.push(arrow1);
  const arrow2 = new THREE.ArrowHelper(
    new THREE.Vector3(),
    new THREE.Vector3(),
    1,
    0x555555
  );
  scene.add(arrow2);
  arrowForces.push(arrow2);
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

function makeClonePositionsList(
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
    [-2 * spaceBoundaryX, -2 * spaceBoundaryY, -2 * spaceBoundaryZ],
  ];
}

function createParticleSystem(group) {
  // Particles are just individual vertices in a geometry
  // Create the geometry that will hold all of the vertices
  const particles = new THREE.Geometry();
  const texture = new THREE.Texture(generateTexture());
  texture.needsUpdate = true; // important
  const particleMaterial = new THREE.PointsMaterial({
    // http://jsfiddle.net/7yDGy/1/
    map: texture,
    blending: THREE.NormalBlending, // required
    depthTest: false, // required
    transparent: true,
    // opacity: 0.9,
    size: 0.3,
    vertexColors: THREE.VertexColors,
  });
  const particleMaterialForClones = new THREE.PointsMaterial({
    // http://jsfiddle.net/7yDGy/1/
    map: texture,
    blending: THREE.NormalBlending, // required
    depthTest: false, // required
    transparent: true,
    opacity: 0.3,
    size: 0.3,
    vertexColors: THREE.VertexColors,
  });

  // Create the vertices and add them to the particles geometry
  if (loadState()) {
    console.log("State from previous session loaded.");
    // Initialize the particleSystem with the info stored from localStorage.
    let particleCountToRead = 0;
    if (
      previous_particleCount < particleCount ||
      if_override_particleCount_setting_with_lastState
    ) {
      particleCountToRead = previous_particleCount;
    } else {
      particleCountToRead = particleCount;
    }
    for (let i = 0; i < particleCountToRead; i++) {
      const tempColor = new THREE.Color();
      tempColor.set(previous_particleColors[i]);
      const tempColorInHSL = tempColor.getHSL();
      addParticle(
        tempColorInHSL.h,
        tempColorInHSL.s,
        tempColorInHSL.l,
        previous_particlePositions[i].x,
        previous_particlePositions[i].y,
        previous_particlePositions[i].z,
        previous_particleVelocities[i].x,
        previous_particleVelocities[i].y,
        previous_particleVelocities[i].z,
        previous_particleForces[i].x,
        previous_particleForces[i].y,
        previous_particleForces[i].z,
        previous_particleMasses[i],
        previous_particleCharges[i],
        particles,
        particleColors,
        particlePositions,
        particleVelocities,
        particleForces,
        particleMasses,
        totalMass,
        particleCharges,
        scene,
        arrowVelocities,
        arrowForces,
        trajectoryLines
      );
    }
    let particleCountToAdd = particleCount - previous_particleCount;
    if (particleCountToAdd < 0) {
      console.log(
        "Dropping",
        -particleCountToAdd,
        "particles stored, since we only need",
        particleCount,
        "particles this time."
      );
    } else if (particleCountToAdd > 0) {
      console.log(
        "md.js will be creating only",
        particleCountToAdd,
        "particles from scratch, since",
        previous_particleCount,
        "has been loaded from previous browser session."
      );
    }
    time = previous_time;
    lastSnapshotTime = previous_lastSnapshotTime;
  } else {
    console.log("Creating new universe.");
    let particleCountToAdd = particleCount;
    console.log(
      "md.js will be creating all",
      particleCount,
      "particles from scratch."
    );
    // create a sun:
    if (if_makeSun)
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
        sunMass,
        0,
        particles,
        particleColors,
        particlePositions,
        particleVelocities,
        particleForces,
        particleMasses,
        totalMass,
        particleCharges,
        scene,
        arrowVelocities,
        arrowForces,
        trajectoryLines
      ); // always make the sun the first particle, please.
  }
  // now, no matter how many particles has been pre-defined (e.g. the Sun) and how many are loaded from previous session, add particles till particleCount is met:
  for (var i = particlePositions.length; i < particleCount; i++) {
    if (if_makeSun) {
      var this_x = _.random(-spaceBoundaryX, spaceBoundaryX, true);
      var this_y = 0;
      var this_z = _.random(-spaceBoundaryZ, spaceBoundaryZ, true);
      var this_r = Math.sqrt(
        this_x * this_x + this_y * this_y + this_z * this_z
      );
      var this_vx = 0;
      var this_vy = Math.sqrt((G * particleMasses[0]) / this_r);
      var this_vz = 0;
      if (i % 2 == 0) this_vy *= -1;
    } else {
      var this_x = _.random(-spaceBoundaryX, spaceBoundaryX, true);
      var this_y = _.random(-spaceBoundaryY, spaceBoundaryY, true);
      var this_z = _.random(-spaceBoundaryZ, spaceBoundaryZ, true);
      var this_r = Math.sqrt(
        this_x * this_x + this_y * this_y + this_z * this_z
      );
      var this_vx = 0;
      var this_vy = 0;
      var this_vz = 0;
    }
    addParticle(
      Math.random(),
      1.0,
      0.5,
      this_x,
      this_y,
      this_z,
      this_vx,
      this_vy,
      this_vz,
      0,
      0,
      0,
      _.random(16, 20, true),
      _.sample(availableCharges),
      particles,
      particleColors,
      particlePositions,
      particleVelocities,
      particleForces,
      particleMasses,
      totalMass,
      particleCharges,
      scene,
      arrowVelocities,
      arrowForces,
      trajectoryLines
    );
  }
  particles.colors = particleColors;
  // Create the material that will be used to render each vertex of the geometry
  // Create the particle system
  const particleSystem = new THREE.Points(particles, particleMaterial);
  particleSystem.position.set(0, 0, 0);
  group.add(particleSystem);

  let clone;
  const clonePositions = makeClonePositionsList(
    spaceBoundaryX,
    spaceBoundaryY,
    spaceBoundaryZ
  );
  const cloneTemplate = particleSystem.clone();
  cloneTemplate.material = particleMaterialForClones;
  clonePositions.forEach((clonePosition) => {
    clone = cloneTemplate.clone();
    clone.position.set(clonePosition[0], clonePosition[1], clonePosition[2]);
    group.add(clone);
  });
  return particleSystem;
}
