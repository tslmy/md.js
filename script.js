//===============options and settings:
var particleCount = 5;
var maxTrajectoryLength = 500;
var spaceBoundaryX = 5;
var spaceBoundaryY = 5;
var spaceBoundaryZ = 5;
var dt = 0.01;
var availableCharges = [-3, -2, -1, 0, 1, 2, 3];
var d_min = 0.02;
var sunMass = 500;
//toggles for functions:
var if_use_periodic_boundary_condition = true;
var if_apply_LJpotential = true;
var if_apply_gravitation = true;
var if_apply_coulombForce = true;
var if_ReferenceFrame_movesWithSun = true;
var if_makeSun = true;
var if_showUniverseBoundary = true;
var if_showTrajectory = true;
var if_useFog = false;
//physical constants -- be the god!
var EPSILON = 1;
var DELTA = 0.02;
var G = 0.08;
var K = 0.1;
var max_arrow_length = 2;
//====================================
//global variables
var camera, scene, renderer;
var effect, controls;
var element, container;
var if_mobileDevice =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent);
var geometry, material, mesh, particleMaterial, trajectoryMaterial;
var particleColors = [];
var particlePositions = [];
var particleForces = [];
var particleVelocities = [];
var particleMasses = [];
var particleCharges = [];
var arrowVelocities = [];
var arrowForces = [];
var trajectoryGeometries = [];
var trajectoryLines = [];
var totalMass = 0;
var time = 0;
var lastSnapshotTime = 0;
var snapshotDuration = 2 * dt;
//local storage functions:
function save(name, obj) {
    localStorage.setItem(name, JSON.stringify(obj));
};

function saveState() {
    save('particleCount', particleCount);
    save('particleColors', particleColors);
    save('particlePositions', particlePositions);
    save('particleForces', particleForces);
    save('particleVelocities', particleVelocities);
    save('particleMasses', particleMasses);
    save('particleCharges', particleCharges);
    save('time', time);
    save('lastSnapshotTime', lastSnapshotTime);
    /*console.log('particleColors', particleColors);
    console.log('particlePositions', particlePositions);
    console.log('particleForces', particleForces);
    console.log('particleVelocities', particleVelocities);
    console.log('particleMasses', particleMasses);
    console.log('particleCharges', particleCharges);
    console.log('time', time);
    console.log('lastSnapshotTime', lastSnapshotTime);*/
};

function clearState() {
    localStorage.removeItem('particleColors');
    localStorage.removeItem('particlePositions');
    localStorage.removeItem('particleForces');
    localStorage.removeItem('particleVelocities');
    localStorage.removeItem('particleMasses');
    localStorage.removeItem('particleCharges');
    localStorage.removeItem('time');
    localStorage.removeItem('lastSnapshotTime');
    window.onbeforeunload = null;
    location.reload();
};
//js fixes and helper functions:
function drawArrow(i, arrowStack, propertyStack) {
    //var vector_from = new THREE.Vector3().copy(from_particle);
    //var vector_direction = new THREE.Vector3().copy(vector);
    if (propertyStack == particleForces) {
        rescalingFactor = 0.0001;
    } else if (propertyStack == particleVelocities) {
        rescalingFactor = 0.02;
    } else {
        console.log('unrecognized propertyStack', propertyStack);
        rescalingFactor = 1;
    }
    var vector = propertyStack[i];
    var vector_from = particlePositions[i];
    //var vector_to = new THREE.Vector3().addVectors(vector_from, vector_direction);
    var vector_length = vector.length() * rescalingFactor;
    if (vector_length > max_arrow_length) {
        vector_length = max_arrow_length
    };
    var vector_direction = new THREE.Vector3().copy(vector).normalize();
    var arrow = arrowStack[i];
    arrow.position.copy(vector_from);
    arrow.setLength(vector_length);
    arrow.setDirection(vector_direction);
}

function generateTexture() {
    //credit: http://jsfiddle.net/7yDGy/1/
    // draw a circle in the center of the canvas
    var size = 32;
    // create canvas
    var canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    // get context
    var context = canvas.getContext('2d');
    // draw circle
    var centerX = size / 2;
    var centerY = size / 2;
    var radius = size / 2;
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
    context.fillStyle = "#fff";
    context.fill();
    return canvas;
}

function drawBox() {
    geometry = new THREE.BoxGeometry(2 * spaceBoundaryX, 2 * spaceBoundaryY, 2 *
        spaceBoundaryZ);
    material = new THREE.MeshBasicMaterial({
        color: 0xaaaaaa,
        wireframe: true,
        opacity: .8
    });
    //add this object to the scene
    mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    //add a light to the scene
    /*light = new THREE.AmbientLight( 0x222222 );
                  scene.add( light );*/
}

function createParticleSystem() {
    function addParticle(colorH, colorS, colorL, positionX, positionY, positionZ,
        velocityX, velocityY, velocityZ, forceX, forceY, forceZ, thisMass,
        thisCharge) {
        // make colors (http://jsfiddle.net/J7zp4/200/)
        var thisColor = new THREE.Color();
        thisColor.setHSL(colorH, colorS, colorL);
        particleColors.push(thisColor);
        // Create the vertex
        var thisPosition = new THREE.Vector3(positionX, positionY, positionZ);
        particlePositions.push(thisPosition);
        // Add the vertex to the geometry
        particles.vertices.push(thisPosition);
        // make velocity
        var thisVelocity = new THREE.Vector3(velocityX, velocityY, velocityZ);
        particleVelocities.push(thisVelocity);
        // make force
        var thisForce = new THREE.Vector3(forceX, forceY, forceZ);
        particleForces.push(thisForce);
        // mass
        particleMasses.push(thisMass);
        totalMass += thisMass;
        // charge
        particleCharges.push(thisCharge);
        //add two arrows
        var arrow = new THREE.ArrowHelper(new THREE.Vector3(), new THREE.Vector3(),
            1, 0x0055aa);
        scene.add(arrow);
        arrowVelocities.push(arrow);
        var arrow = new THREE.ArrowHelper(new THREE.Vector3(), new THREE.Vector3(),
            1, 0x555555);
        scene.add(arrow);
        arrowForces.push(arrow);
        //add trajectories. See <http://stackoverflow.com/questions/31399856/drawing-a-line-with-three-js-dynamically>
        if (if_showTrajectory) {
            var thisGeometry = new THREE.BufferGeometry();
            trajectoryGeometries.push(thisGeometry);
            // attributes
            var point = new Float32Array(maxTrajectoryLength * 3); // 3 vertices per point
            thisGeometry.addAttribute('position', new THREE.BufferAttribute(point, 3));
            for (var i = 0; i < maxTrajectoryLength; i++) thisGeometry.attributes.position
                .setXYZ(i, thisPosition.x, thisPosition.y, thisPosition.z);
            var thisTrajectoryColor = thisColor.clone();
            thisTrajectoryColor.offsetHSL(0, -0.5, 0.2);
            thisTrajectoryMaterial = new THREE.LineBasicMaterial({
                color: thisTrajectoryColor,
                linewidth: .5
            });
            var thisTrajectory = new THREE.Line(thisGeometry, thisTrajectoryMaterial);
            trajectoryLines.push(thisTrajectory);
            scene.add(thisTrajectory);
        }
    }
    // Particles are just individual vertices in a geometry
    // Create the geometry that will hold all of the vertices
    var particles = new THREE.Geometry();
    var texture = new THREE.Texture(generateTexture());
    texture.needsUpdate = true; // important
    particleMaterial = new THREE.PointsMaterial({ //http://jsfiddle.net/7yDGy/1/
        map: texture,
        blending: THREE.NormalBlending, // required
        depthTest: false, // required
        transparent: true,
        opacity: 0.9,
        size: .3,
        vertexColors: THREE.VertexColors
    });
    // Create the vertices and add them to the particles geometry
    function loadState() {
        console.log('Loading particleCount...');
        previous_particleCount = JSON.parse(localStorage.getItem('particleCount'));
        if (previous_particleCount == null) {
            console.log('Failed.');
            return false;
        };
        console.log('Loading particleColors...');
        previous_particleColors = JSON.parse(localStorage.getItem('particleColors'));
        if (previous_particleColors == null) {
            console.log('Failed.');
            return false;
        };
        console.log('Loading particlePositions...');
        previous_particlePositions = JSON.parse(localStorage.getItem('particlePositions'));
        if (previous_particlePositions == null) {
            console.log('Failed.');
            return false;
        };
        console.log('Loading particleForces...');
        previous_particleForces = JSON.parse(localStorage.getItem('particleForces'));
        if (previous_particleForces == null) {
            console.log('Failed.');
            return false;
        };
        console.log('Loading particleVelocities...');
        previous_particleVelocities = JSON.parse(localStorage.getItem('particleVelocities'));
        if (previous_particleVelocities == null) {
            console.log('Failed.');
            return false;
        };
        console.log('Loading particleMasses...');
        previous_particleMasses = JSON.parse(localStorage.getItem('particleMasses'));
        if (previous_particleMasses == null) {
            console.log('Failed.');
            return false;
        };
        console.log('Loading particleCharges...');
        previous_particleCharges = JSON.parse(localStorage.getItem('particleCharges'));
        if (previous_particleCharges == null) {
            console.log('Failed.');
            return false;
        };
        console.log('Loading time...');
        previous_time = JSON.parse(localStorage.getItem('time'));
        if (previous_time == null) {
            console.log('Failed.');
            return false;
        };
        console.log('Loading lastSnapshotTime...');
        previous_lastSnapshotTime = JSON.parse(localStorage.getItem('lastSnapshotTime'));
        if (previous_lastSnapshotTime == null) {
            console.log('Failed.');
            return false;
        };
        console.log('Successfully loaded all variables.');
        return true;
    };
    // Create the vertices and add them to the particles geometry
    if (loadState()) {
        console.log('State from previous session loaded.');
        // Initialize the particleSystem with the info stored from localStorage.

        if (previous_particleCount > particleCount) {
            particleCountToRead = particleCount;
        } else {
            particleCountToRead = previous_particleCount;
        };
        for (var i = 0; i < particleCountToRead; i++) {
            var tempColor = new THREE.Color();
            tempColor.set(previous_particleColors[i]);
            tempColorInHSL = tempColor.getHSL();
            addParticle(
                colorH = tempColorInHSL.h,
                colorS = tempColorInHSL.s,
                colorL = tempColorInHSL.l,
                positionX = previous_particlePositions[i].x,
                positionY = previous_particlePositions[i].y,
                positionZ = previous_particlePositions[i].z,
                velocityX = previous_particleVelocities[i].x,
                velocityY = previous_particleVelocities[i].y,
                velocityZ = previous_particleVelocities[i].z,
                forceX = previous_particleForces[i].x,
                forceY = previous_particleForces[i].y,
                forceZ = previous_particleForces[i].z,
                thisMass = previous_particleMasses[i],
                thisCharge = previous_particleCharges[i])
        };
        var particleCountToAdd = particleCount - previous_particleCount;
        if (particleCountToAdd<0) {
            console.log("Dropping",-particleCountToAdd,"particles stored, since we only need",particleCount,"particles this time.");
        } else if (particleCountToAdd>0) {
            console.log("md.js will be creating only",particleCountToAdd,"particles from scratch, since",previous_particleCount,"has been loaded from previous browser session.");
        };
        time = previous_time;
        lastSnapshotTime = previous_lastSnapshotTime;
    } else {
        console.log('Creating new universe.');
        var particleCountToAdd = particleCount;
        console.log("md.js will be creating all",particleCount,"particles from scratch.");
        //create a sun:
        if (if_makeSun) addParticle(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, sunMass, 0); //always make the sun the first particle, please.
    };
    //now, no matter how many particles has been pre-defined (e.g. the Sun) and how many are loaded from previous session, add particles till particleCount is met:
    for (var i = particlePositions.length; i < particleCount; i++) {
        if (if_makeSun) {
            var this_x = _.random(-spaceBoundaryX, spaceBoundaryX, true);
            var this_y = 0;
            var this_z = _.random(-spaceBoundaryZ, spaceBoundaryZ, true);
            var this_r = Math.sqrt(this_x * this_x + this_y * this_y + this_z * this_z);
            var this_vx = 0;
            var this_vy = Math.sqrt(G * particleMasses[0] / this_r);
            var this_vz = 0;
            if (i % 2 == 0) this_vy *= -1;
        } else {
            var this_x = _.random(-spaceBoundaryX, spaceBoundaryX, true);
            var this_y = _.random(-spaceBoundaryY, spaceBoundaryY, true);
            var this_z = _.random(-spaceBoundaryZ, spaceBoundaryZ, true);
            var this_r = Math.sqrt(this_x * this_x + this_y * this_y + this_z * this_z);
            var this_vx = 0;
            var this_vy = 0;
            var this_vz = 0;
        };
        addParticle(Math.random(), 1.0, 0.5, this_x, this_y, this_z, this_vx,
            this_vy, this_vz, 0, 0, 0, _.random(16, 20, true), _.sample(
                availableCharges));
    };
    particles.colors = particleColors;
    // Create the material that will be used to render each vertex of the geometry
    // Create the particle system
    particleSystem = new THREE.Points(particles, particleMaterial);
    return particleSystem;
};

function init() {
    //initialize the scene
    scene = new THREE.Scene();
    //    configure the scene:
    if (if_useFog) scene.fog = new THREE.Fog(0xffffff, 0, 20);
    //    define objects:
    if (if_showUniverseBoundary) drawBox();
    scene.add(createParticleSystem());
    //initialize the camera
    camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight,
        1, 1000000);
    camera.position.set(0, 2, 10);
    scene.add(camera);
    //initialize renderer
    renderer = new THREE.WebGLRenderer({
        alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(4); //enhance resolution
    if (if_mobileDevice) effect = new THREE.StereoEffect(renderer);
    element = renderer.domElement;
    container = document.body;
    container.appendChild(element);
    //activate plugins:
    controls = new THREE.OrbitControls(camera, element); //this is for non-VR devices
    function setOrientationControls(e) {
        if (!e.alpha) {
            return;
        }
        controls = new THREE.DeviceOrientationControls(camera, true);
        controls.connect();
        controls.update();
        element.addEventListener('click', fullscreen, false);
        window.removeEventListener('deviceorientation', setOrientationControls,
            true);
    }
    window.addEventListener('deviceorientation', setOrientationControls, true);
    //add stat
    stats = new Stats();
    container.appendChild(stats.domElement);
    //add event listeners
    window.addEventListener('resize', resize, false);
    setTimeout(resize, 1);
    window.onbeforeunload = saveState;
}

function animate() {
    time += dt;
    //for (var i in arrows) {scene.remove(arrows[i])}; //remove all existing arrows
    for (var i = 0; i < particleCount; i++) particleForces[i].set(0, 0, 0); //remove all forces first
    for (var i = 0; i < particleCount; i++)
        for (var j = i + 1; j < particleCount; j++) {
            //generate all forces:
            if (if_apply_LJpotential) {
                // Use Lennard-Jones potential
                // V = 4*epsilon*((delta/d)^12 - (delta/d)^6)
                // F = 4*epsilon*(-12/d*(delta/d)^12 + 6/d*(delta/d)^6) r/|r|
                var r = new THREE.Vector3().subVectors(particlePositions[i],
                    particlePositions[j]); //relative displacement
                var d = r.length(); //length
                var d6 = (DELTA / d);
                if (d6 < 0.5) d6 = 0.5; //what kind of socery is this??
                d6 = d6 * d6 * d6;
                d6 = d6 * d6;
                r.setLength(4 * EPSILON * (6 / d) * (-2 * d6 * d6 + d6));
                particleForces[i].sub(r);
                particleForces[j].add(r);
            };
            if (if_apply_gravitation) {
                //Use gravitational potential
                //-> F = GMm/(d*d) r/|r|
                var r = new THREE.Vector3().subVectors(particlePositions[i],
                    particlePositions[j]); //relative displacement
                var d = r.length(); //length
                // Use d_min to prevent high potential when particles are close
                // to avoid super high accelerations in poor time resolution
                if (d < d_min) {
                    console.log('particle', i, ',', j, 'too near.');
                    d = d_min;
                };
                r.setLength(G * particleMasses[i] * particleMasses[j] / (d * d));
                particleForces[i].sub(r);
                particleForces[j].add(r);
            };
            if (if_apply_coulombForce) {
                //Use gravitational potential
                //-> F = GMm/(d*d) r/|r|
                var r = new THREE.Vector3().subVectors(particlePositions[i],
                    particlePositions[j]); //relative displacement
                var d = r.length(); //length
                // Use d_min to prevent high potential when particles are close
                // to avoid super high accelerations in poor time resolution
                if (d < d_min) {
                    console.log('particle', i, ',', j, 'too near.');
                    d = d_min;
                };
                r.setLength(-K * particleCharges[i] * particleCharges[j] / (d * d));
                particleForces[i].sub(r);
                particleForces[j].add(r);
            };
        };
    for (var i = 0; i < particleCount; i++) {
        //======================== now update eveything user could see ========================
        //update velocities according to force:
        particleVelocities[i].addScaledVector(particleForces[i], dt / particleMasses[
            i]); //v = v + f/m·dt
        //update positions according to velocity:
        particlePositions[i].addScaledVector(particleVelocities[i], dt); //x = x + v·dt
        //Check if this particle hit a boundary of the universe (i.e. cell walls). If so, perioidic boundary condition (PBC) might be applied:
        if (if_use_periodic_boundary_condition) {
            while (particlePositions[i].x < -spaceBoundaryX) {
                particlePositions[i].x += 2*spaceBoundaryX;
            };
            while (particlePositions[i].x > spaceBoundaryX) {
                particlePositions[i].x -= 2*spaceBoundaryX;
            };
            while (particlePositions[i].y < -spaceBoundaryY) {
                particlePositions[i].y += 2*spaceBoundaryY;
            };
            while (particlePositions[i].y > spaceBoundaryY) {
                particlePositions[i].y -= 2*spaceBoundaryY;
            };
            while (particlePositions[i].z < -spaceBoundaryZ) {
                particlePositions[i].z += 2*spaceBoundaryZ;
            };
            while (particlePositions[i].z > spaceBoundaryZ) {
                particlePositions[i].z -= 2*spaceBoundaryZ;
            };
        }
        // let's see whether the camera should trace something (i.e. the reference frame should be moving), defined by user 
        //update arrows: (http://jsfiddle.net/pardo/bgyem42v/3/)
        drawArrow(i, arrowVelocities, particleVelocities);
        drawArrow(i, arrowForces, particleForces);
        //update trajectories:
        if (if_showTrajectory) {
            if (time - lastSnapshotTime > snapshotDuration) {
                //fisrt, make a short-hand:
                var lineNodePositions = trajectoryLines[i].geometry.attributes.position;
                for (var j = 0; j < maxTrajectoryLength - 1; j++) {
                    lineNodePositions.copyAt(j, lineNodePositions, j + 1);
                };
                lineNodePositions.setXYZ(j, particlePositions[i].x, particlePositions[i].y,
                    particlePositions[i].z);
                lineNodePositions.needsUpdate = true;
            };
        };
    };
    if (if_showTrajectory && time - lastSnapshotTime > snapshotDuration)
        lastSnapshotTime = time;
    if (if_ReferenceFrame_movesWithSun) {
        for (var i in particlePositions) particlePositions[i].sub(particlePositions[
            0]);
    }
    //=============================== now the rendering ==================================
    // flag to the particle system that we've changed its vertices.
    particleSystem.geometry.verticesNeedUpdate = true;
    //draw this frame
    update();
    render();
    //set up the next call
    requestAnimationFrame(animate);
    stats.update();
}
init();
animate();

function resize() {
    var width = container.offsetWidth;
    var height = container.offsetHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    if (if_mobileDevice) effect.setSize(width, height);
}

function update() {
    //resize();
    camera.updateProjectionMatrix();
    controls.update();
}

function render() {
    if (if_mobileDevice) {
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
