function createParticleSystem(group) {
  // Particles are just individual vertices in a geometry
  // Create the geometry that will hold all of the vertices
  const particles = new THREE.Geometry();
  texture = new THREE.Texture(generateTexture());
  texture.needsUpdate = true; // important
  particleMaterial = new THREE.PointsMaterial({
    // http://jsfiddle.net/7yDGy/1/
    map: texture,
    blending: THREE.NormalBlending, // required
    depthTest: false, // required
    transparent: true,
    // opacity: 0.9,
    size: 0.3,
    vertexColors: THREE.VertexColors,
  });
  particleMaterialForClones = new THREE.PointsMaterial({
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

    if (
      previous_particleCount < particleCount ||
      if_override_particleCount_setting_with_lastState
    ) {
      particleCountToRead = previous_particleCount;
    } else {
      particleCountToRead = particleCount;
    }
    for (var i = 0; i < particleCountToRead; i++) {
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
        particles
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
      addParticle(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, sunMass, 0, particles); // always make the sun the first particle, please.
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
      particles
    );
  }
  particles.colors = particleColors;
  // Create the material that will be used to render each vertex of the geometry
  // Create the particle system
  particleSystem = new THREE.Points(particles, particleMaterial);
  particleSystem.position.set(0, 0, 0);
  group.add(particleSystem);

  let clone;
  const clonePositions = makeClonePositionsList();
  const cloneTemplate = particleSystem.clone();
  cloneTemplate.material = particleMaterialForClones;
  clonePositions.forEach((clonePosition) => {
    clone = cloneTemplate.clone();
    clone.position.set(clonePosition[0], clonePosition[1], clonePosition[2]);
    group.add(clone);
  });
  return particles;
}
