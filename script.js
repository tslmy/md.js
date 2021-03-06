// Load packages
fallback.load({
    jQuery: ['//ajax.googleapis.com/ajax/libs/jquery/3.2.1/jquery.min.js',
             'node_modules/jquery/dist/jquery.min.js'],

    THREE: ['//cdn.rawgit.com/mrdoob/three.js/master/build/three.min.js',
            'node_modules/three/build/three.min.js'],

    OrbitControls: ['//cdn.rawgit.com/mrdoob/three.js/master/examples/js/controls/OrbitControls.js',
                    'node_modules/three/examples/js/controls/OrbitControls.js'],

    lodash: ['//cdn.jsdelivr.net/lodash/4.13.1/lodash.min.js',
             'node_modules/lodash/lodash.min.js'],

    stats: ['//cdn.rawgit.com/mrdoob/three.js/master/examples/js/libs/stats.min.js', 
            'node_modules/stats.js/build/stats.min.js'], 

    StereoEffect: ['//cdn.rawgit.com/mrdoob/three.js/master/examples/js/effects/StereoEffect.js', 
                   'node_modules/three/examples/js/effects/StereoEffect.js'], 

    DeviceOrientationControls: ['//cdn.rawgit.com/mrdoob/three.js/master/examples/js/controls/DeviceOrientationControls.js', 
                                'node_modules/three/examples/js/controls/DeviceOrientationControls.js'], 

    'dat.gui': ['//cdn.rawgit.com/dataarts/dat.gui/master/build/dat.gui.min.js', 
                'modules/dat.gui.min.js'], 

    strftime: ['//cdn.rawgit.com/samsonjs/strftime/8a06a301/strftime-min.js', 
               'node_modules/strftime/strftime-min.js']
}, {
    shim: {
            'OrbitControls': ['THREE'],
            'stats': ['THREE'],
            'StereoEffect': ['THREE'],
            'DeviceOrientationControls': ['THREE']
        },
});

//global variables
var camera, scene, renderer;
var effect, controls;
var element, container;
var if_mobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
var ifRun = true;
var geometry, material, particleMaterial, trajectoryMaterial;
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
var particleProperties = [
    particlePositions,
    particleVelocities,
    particleForces,
    particleMasses,
    particleCharges,
    //particleColors,
    arrowVelocities,
    arrowForces,
    trajectoryGeometries,
    trajectoryLines
];
var totalMass = 0;
var time = 0;
var lastSnapshotTime = 0;
var snapshotDuration = dt;
var strongestForcePresent = 1;
var fastestVelocityPresent = 1;
// ============= js fixes and helper functions =============
//Where el is the DOM element you'd like to test for visibility
function isVisible(el) {
    return (el.offsetParent !== null)
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
    boxGeometry = new THREE.BoxGeometry(2 * spaceBoundaryX, 2 * spaceBoundaryY, 2 *
        spaceBoundaryZ);
    boxMaterial = new THREE.MeshBasicMaterial({
        color: 0xaaaaaa,
        wireframe: true,
        opacity: .8
    });
    //add this object to the scene
    boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
    scene.add(boxMesh);
    //add a light to the scene
    /*light = new THREE.AmbientLight( 0x222222 );
                  scene.add( light );*/
}

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
        var white = new THREE.Color('#FFFFFF');
        // attributes
        var points = new Float32Array(maxTrajectoryLength * 3); // 3 vertices per point
        var colors = new Float32Array(maxTrajectoryLength * 3); // 3 vertices per point
        thisGeometry.addAttribute('position', new THREE.BufferAttribute(points, 3));
        thisGeometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
        for (var i = 0; i < maxTrajectoryLength; i++) { //for each vertex of this trajectory:
            var interpolationFactor = (maxTrajectoryLength - i) / maxTrajectoryLength; //calculate for how many percent should the color of this vertex be diluted/bleached.
            var thisVertexColor = thisColor.clone().lerp(white, interpolationFactor); //make the bleached color object by cloning the particle's color and then lerping it with the white color.
            thisGeometry.attributes.color.setXYZ(i, thisVertexColor.r, thisVertexColor.g, thisVertexColor.b); //assign this color to this vertex
            thisGeometry.attributes.position.setXYZ(i, thisPosition.x, thisPosition.y, thisPosition.z); //put this(every) vertex to the same place as the particle started
        };
        trajectoryGeometries.push(thisGeometry); //finished preparing the geometry for this trajectory
        thisTrajectoryMaterial = new THREE.LineBasicMaterial({
            linewidth: .5,
            vertexColors: THREE.VertexColors
        });
        var thisTrajectory = new THREE.Line(thisGeometry, thisTrajectoryMaterial); //, THREE.LinePieces);
        trajectoryLines.push(thisTrajectory);
        scene.add(thisTrajectory);
    }
    $('#tabularInfo > tbody').append('<tr>\
        <td class="particle" style="\
            color: hsl('+(colorH*360)+','+(colorS*100)+'%,'+(colorL*100)+'%)">&#x2B24;</td>\
        <td class="mass">'+ Math.round(thisMass * 10) / 10 +'</td>\
        <td class="charge">'+ Math.round(thisCharge * 10) / 10 +'</td>\
        <td class="speed"></td>\
        <td class="kineticEnergy"></td>\
        <td class="LJForceStrength"></td>\
        <td class="GravitationForceStrength"></td>\
        <td class="CoulombForceStrength"></td>\
        <td class="TotalForceStrength"></td>\
    </tr>');
}

function createParticleSystem() {
    // Particles are just individual vertices in a geometry
    // Create the geometry that will hold all of the vertices
    group = new THREE.Object3D();
    particles = new THREE.Geometry();
    texture = new THREE.Texture(generateTexture());
    texture.needsUpdate = true; // important
    particleMaterial = new THREE.PointsMaterial({ //http://jsfiddle.net/7yDGy/1/
        map: texture,
        blending: THREE.NormalBlending, // required
        depthTest: false, // required
        transparent: true,
        //opacity: 0.9,
        size: .3,
        vertexColors: THREE.VertexColors
    });
    particleMaterialForClones = new THREE.PointsMaterial({ //http://jsfiddle.net/7yDGy/1/
        map: texture,
        blending: THREE.NormalBlending, // required
        depthTest: false, // required
        transparent: true,
        opacity: 0.3,
        size: .3,
        vertexColors: THREE.VertexColors
    });
    // Create the vertices and add them to the particles geometry
    if (loadState()) {
        console.log('State from previous session loaded.');
        // Initialize the particleSystem with the info stored from localStorage.

        if (previous_particleCount < particleCount || if_override_particleCount_setting_with_lastState) {
            particleCountToRead = previous_particleCount;
        } else {
            particleCountToRead = particleCount;
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
        if (particleCountToAdd < 0) {
            console.log("Dropping", -particleCountToAdd, "particles stored, since we only need", particleCount, "particles this time.");
        } else if (particleCountToAdd > 0) {
            console.log("md.js will be creating only", particleCountToAdd, "particles from scratch, since", previous_particleCount, "has been loaded from previous browser session.");
        };
        time = previous_time;
        lastSnapshotTime = previous_lastSnapshotTime;
    } else {
        console.log('Creating new universe.');
        var particleCountToAdd = particleCount;
        console.log("md.js will be creating all", particleCount, "particles from scratch.");
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
    particleSystem.position.set(0, 0, 0);
    group.add(particleSystem);

    var clone;
    var clonePositions = makeClonePositionsList();
    var cloneTemplate = particleSystem.clone();
    cloneTemplate.material = particleMaterialForClones;
    for (i = 0; i < 26; i++) {
        clone = cloneTemplate.clone();
        clone.position.set(clonePositions[i][0], clonePositions[i][1], clonePositions[i][2]);
        group.add(clone);
    }

    return group;
};

function updateClonesPositions() {
    var clonePositions = makeClonePositionsList();
    for (i = 0; i < 26; i++) {
        group.children[i + 1].position.set(clonePositions[i][0], clonePositions[i][1], clonePositions[i][2]);
    }
};

function makeClonePositionsList() {
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
    ];
};

/*function addParticleOnTheFly() {
    particleCount += 1;
    var this_x = _.random(-spaceBoundaryX, spaceBoundaryX, true);
    var this_y = _.random(-spaceBoundaryY, spaceBoundaryY, true);
    var this_z = _.random(-spaceBoundaryZ, spaceBoundaryZ, true);
    var this_r = Math.sqrt(this_x * this_x + this_y * this_y + this_z * this_z);
    var this_vx = 0;
    var this_vy = 0;
    var this_vz = 0;
    addParticle(Math.random(), 1.0, 0.5, this_x, this_y, this_z, this_vx,
        this_vy, this_vz, 0, 0, 0, _.random(16, 20, true), _.sample(
            availableCharges));
}
function removeParticleOnTheFly() {
    particleCount -= 1;
    //TODO
}*/

function init() {
    initializeGuiControls(); //enable settings
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
    temperaturePanel = stats.addPanel(new Stats.Panel('Temp.', '#ff8', '#221'));
    stats.showPanel(2);
    container.append(stats.domElement);
    //add event listeners
    window.addEventListener('resize', resize, false);
    setTimeout(resize, 1);
    window.onbeforeunload = saveState;
}

function applyForce(i, j, func) {
    var thisPosition = particlePositions[i];
    var thatPosition = particlePositions[j];
    var rOriginal = new THREE.Vector3().subVectors(thisPosition, thatPosition); //relative displacement
    var r;
    //====== populate the array "particleJClones" ======
    if (if_use_periodic_boundary_condition) {
        var clonePositions = makeClonePositionsList();
        clonePositions.push([0, 0, 0]);
    } else {
        var clonePositions = [
            [0, 0, 0]
        ];
    };
    //==================================================
    //force due to j in this cell:
    for (thatPositionDisplacement of clonePositions) { // (don't use "for-in" loops!)
        r = rOriginal.clone();
        //(possibly) displace shift the end of this vector from particle j to one of its clones:
        r.x -= thatPositionDisplacement[0];
        r.y -= thatPositionDisplacement[1];
        r.z -= thatPositionDisplacement[2];
        var d = r.length(); //calculate distance between particles i and j (with j may being a clone)
        if (d < cutoffDistance) {
            r.setLength(func(i, j, d)); //use calculated "force strength" as vector length
            particleForces[i].sub(r);
            particleForces[j].add(r);
        };
    };
    return r; //return the calculated force for further investigation.
};

function animate() {
    time += dt;
    //for (var i in arrows) {scene.remove(arrows[i])}; //remove all existing arrows
    for (i of particleForces) i.set(0, 0, 0); //remove all forces first
    for (var i = 0; i < particleCount; i++) {
        //initialize total force counters:
        thisLJForceStrength = 0;
        thisGravitationForceStrength = 0;
        thisCoulombForceStrength = 0;
        //process interactions:
        for (var j = i + 1; j < particleCount; j++) {
            //generate all forces:
            if (if_apply_LJpotential) {
                // Use Lennard-Jones potential
                // V = 4*epsilon*((delta/d)^12 - (delta/d)^6)
                // F = 4*epsilon*(-12/d*(delta/d)^12 + 6/d*(delta/d)^6) r/|r|
                thisLJForce = applyForce(i, j, function(i, j, d) {
                    var d6 = (DELTA / d);
                    if (d6 < 0.5) d6 = 0.5; //what kind of socery is this??
                    d6 = d6 * d6 * d6;
                    d6 = d6 * d6;
                    return 4 * EPSILON * (6 / d) * (-2 * d6 * d6 + d6);
                });
                thisLJForceStrength += thisLJForce.length();
            };
            if (if_apply_gravitation) {
                //Use gravitational potential
                //-> F = GMm/(d*d) r/|r|
                thisGravitationForce = applyForce(i, j, function(i, j, d) {
                    // Use d_min to prevent high potential when particles are close
                    // to avoid super high accelerations in poor time resolution
                    if (d < d_min) {
                        console.log('particle', i, ',', j, 'too near for gravitation.');
                        d = d_min;
                    };
                    return (G * particleMasses[i] * particleMasses[j] / (d * d));
                });
                thisGravitationForceStrength += thisGravitationForce.length();
            };
            if (if_apply_coulombForce) {
                //Use gravitational potential
                //-> F = GMm/(d*d) r/|r|
                thisCoulombForce = applyForce(i, j, function(i, j, d) {
                    // Use d_min to prevent high potential when particles are close
                    // to avoid super high accelerations in poor time resolution
                    if (d < d_min) {
                        console.log('particle', i, ',', j, 'too near for coulomb force.');
                        d = d_min;
                    };
                    return -K * particleCharges[i] * particleCharges[j] / (d * d);
                });
                thisCoulombForceStrength += thisCoulombForce.length();
            };
        };
        if (isVisible($("#hud"))) {
            $thisRow = $('#tabularInfo > tbody > tr:nth-child('+(i+1)+')');
            $('.LJForceStrength', $thisRow).text((Math.round(thisLJForceStrength * 100) / 100));
            $('.GravitationForceStrength', $thisRow).text((Math.round(thisGravitationForceStrength * 100) / 100));
            $('.CoulombForceStrength', $thisRow).text((Math.round(thisCoulombForceStrength * 100) / 100));
        }
    };
    //statistics:
    highestForcePresent = _.max(_.map(particleForces, function(vector) {
        return vector.length(); }));
    arrowScaleForForces = unitArrowLength / highestForcePresent;
    $(".mapscale#force").width(arrowScaleForForces * 1000000);
    highestVelocityPresent = _.max(_.map(particleVelocities, function(vector) {
        return vector.length(); }));
    arrowScaleForVelocities = unitArrowLength / highestVelocityPresent;
    $(".mapscale#velocity").width(arrowScaleForVelocities * 10000);
    for (var i = 0; i < particleCount; i++) {
        //shorthands
        thisPosition = particlePositions[i];
        thisVelocity = particleVelocities[i];
        //======================== now update eveything user could see ========================
        //update velocities according to force:
        thisVelocity.addScaledVector(particleForces[i], dt / particleMasses[i]); //v = v + f/m·dt
        thisSpeed = thisVelocity.length(); //vector -> scalar
        if (if_use_periodic_boundary_condition && thisSpeed > escapeSpeed && (Math.abs(thisPosition.x) >= 0.9 * spaceBoundaryX || Math.abs(thisPosition.y) >= 0.9 * spaceBoundaryY || Math.abs(thisPosition.z) >= 0.9 * spaceBoundaryZ)) {
            console.log('Particle ', i, ' escaped with speed', thisSpeed, '.');
            //remove this particle from all lists:
            particleCount -= 1;
            particles.colors[i].offsetHSL(0, -.1, .1);
            particles.colorsNeedUpdate = true;
            _.forEach(particleProperties, function(array) { _.pullAt(array, i) });
            ifThisParticleEscaped = true;
        } else {
            ifThisParticleEscaped = false;
            //update positions according to velocity:
            thisPosition.addScaledVector(thisVelocity, dt); //x = x + v·dt
            //Check if this particle hit a boundary of the universe (i.e. cell walls). If so, perioidic boundary condition (PBC) might be applied:
            if (if_use_periodic_boundary_condition) {
                while (thisPosition.x < -spaceBoundaryX) {
                    thisPosition.x += 2 * spaceBoundaryX;
                    if (if_showTrajectory) {
                        var lineNodePositions = trajectoryLines[i].geometry.attributes.position; //fisrt, make a short-hand
                        for (var j = 0; j < maxTrajectoryLength; j++) {
                            lineNodePositions.setX(j, lineNodePositions.getX(j) + 2 * spaceBoundaryX);
                        };
                        lineNodePositions.needsUpdate = true;
                    };
                };
                while (thisPosition.x > spaceBoundaryX) {
                    thisPosition.x -= 2 * spaceBoundaryX;
                    if (if_showTrajectory) {
                        var lineNodePositions = trajectoryLines[i].geometry.attributes.position; //fisrt, make a short-hand
                        for (var j = 0; j < maxTrajectoryLength; j++) {
                            lineNodePositions.setX(j, lineNodePositions.getX(j) - 2 * spaceBoundaryX);
                        };
                        lineNodePositions.needsUpdate = true;
                    };
                };
                while (thisPosition.y < -spaceBoundaryY) {
                    thisPosition.y += 2 * spaceBoundaryY;
                    if (if_showTrajectory) {
                        var lineNodePositions = trajectoryLines[i].geometry.attributes.position; //fisrt, make a short-hand
                        for (var j = 0; j < maxTrajectoryLength; j++) {
                            lineNodePositions.setY(j, lineNodePositions.getY(j) + 2 * spaceBoundaryY);
                        };
                        lineNodePositions.needsUpdate = true;
                    };
                };
                while (thisPosition.y > spaceBoundaryY) {
                    thisPosition.y -= 2 * spaceBoundaryY;
                    if (if_showTrajectory) {
                        var lineNodePositions = trajectoryLines[i].geometry.attributes.position; //fisrt, make a short-hand
                        for (var j = 0; j < maxTrajectoryLength; j++) {
                            lineNodePositions.setY(j, lineNodePositions.getY(j) - 2 * spaceBoundaryY);
                        };
                        lineNodePositions.needsUpdate = true;
                    };
                };
                while (thisPosition.z < -spaceBoundaryZ) {
                    thisPosition.z += 2 * spaceBoundaryZ;
                    if (if_showTrajectory) {
                        var lineNodePositions = trajectoryLines[i].geometry.attributes.position; //fisrt, make a short-hand
                        for (var j = 0; j < maxTrajectoryLength; j++) {
                            lineNodePositions.setZ(j, lineNodePositions.getZ(j) + 2 * spaceBoundaryZ);
                        };
                        lineNodePositions.needsUpdate = true;
                    };
                };
                while (thisPosition.z > spaceBoundaryZ) {
                    thisPosition.z -= 2 * spaceBoundaryZ;
                    if (if_showTrajectory) {
                        var lineNodePositions = trajectoryLines[i].geometry.attributes.position; //fisrt, make a short-hand
                        for (var j = 0; j < maxTrajectoryLength; j++) {
                            lineNodePositions.setZ(j, lineNodePositions.getZ(j) - 2 * spaceBoundaryZ);
                        };
                        lineNodePositions.needsUpdate = true;
                    };
                };
            };
            // let's see whether the camera should trace something (i.e. the reference frame should be moving), defined by user 
            //update arrows: (http://jsfiddle.net/pardo/bgyem42v/3/)
            function updateArrow(arrow, from, vector, scale) {
                var lengthToScale = if_proportionate_arrows_with_vectors ? vector.length() * scale : unitArrowLength;
                arrow.setLength(if_limitArrowsMaxLength && lengthToScale > maxArrowLength ? maxArrowLength : lengthToScale);
                arrow.position.copy(from);
                arrow.setDirection(new THREE.Vector3().copy(vector).normalize());
            }
            if (if_showArrows) {
                updateArrow(arrow = arrowVelocities[i],
                    from = particlePositions[i],
                    vector = particleVelocities[i],
                    scale = arrowScaleForForces);
                updateArrow(arrow = arrowForces[i],
                    from = particlePositions[i],
                    vector = particleForces[i],
                    scale = arrowScaleForVelocities);
            };
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
        //update HUD, if visible:
        if (isVisible($("#hud"))) {
            $thisRow = $('#tabularInfo > tbody > tr:nth-child('+(i+1)+')');
            $('.speed', $thisRow).text((Math.round(thisSpeed * 100) / 100));
            $('.kineticEnergy', $thisRow).text((Math.round(thisSpeed*thisSpeed*thisMass * 50) / 100));
            $('.TotalForceStrength', $thisRow).text(particleForces[i]? (Math.round(particleForces[i].length() * 100) / 100): "0");
        }
        if (if_constant_temperature) {
            var currentTemperature = calculateTemperature();
            scaleFactor = Math.sqrt(targetTemperature/currentTemperature);
            _.forEach(particleVelocities,function(velocity){velocity.multiplyScalar(scaleFactor)});
        }
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
    statistics();
    update();
    render();
    //set up the next call
    if (ifRun) {
        requestAnimationFrame(animate);
    };
    stats.update();
}

function resize() {
    var width = container.offsetWidth;
    var height = container.offsetHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    if (if_mobileDevice) effect.setSize(width, height);
}
var maxTemperature = 0;

function calculateTemperature() {
    var temperature = 0;
    for (var i = 0; i < particleCount; i++) {
        temperature += particleMasses[i] * particleVelocities[i].length() * particleVelocities[i].length();
    };
    temperature *= 1 / kB / (3 * particleCount - 3);
    if (temperature > maxTemperature) {
        maxTemperature = temperature;
    };
    return temperature;
}

function statistics() {
    var temperature = calculateTemperature();
    temperaturePanel.update(temperature, maxTemperature);
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

function stop() {
    ifRun = false;
};

function toggleHUD() {
    $("#hud").toggle();
}
//now execute this script:
fallback.ready(function() { //when packages are fully loaded:
    console.log("Packages loaded.");
    $().ready(function() {  //when document is ready:
        console.log("Ready.");
        init();
        animate();
        //bind keyboard event:
        document.onkeydown = function(e) {
            switch (e.keyCode) {
                case 9:
                    toggleHUD();
                    break;
            }
        };
    });
});

