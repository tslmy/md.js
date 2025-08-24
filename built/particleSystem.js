import * as THREE from 'three';
import { generateTexture } from './drawingHelpers.js';
const texture = new THREE.Texture(generateTexture());
texture.needsUpdate = true; // important
const particleMaterialForClones = new THREE.PointsMaterial({
    // http://jsfiddle.net/7yDGy/1/
    map: texture,
    size: 0.2,
    alphaTest: 0.5,
    vertexColors: true
});
const columnNames = ['speed', 'kineticEnergy', 'LJForceStrength', 'GravitationForceStrength', 'CoulombForceStrength', 'TotalForceStrength'];
class Particle {
    constructor(color, position, mass, charge, trajectory) {
        this.isEscaped = false;
        this.color = color;
        this.position = position;
        this.mass = mass;
        this.charge = charge;
        this.trajectory = trajectory;
        this.isEscaped = false;
    }
}
// Store initial velocities separately for seeding the SoA simulation state.
export const initialVelocities = []; // flat array length 3 * particleCount
function addParticle(opts) {
    const { color, position, velocity, mass, charge, particles, geometry, scene, showTrajectory, maxTrajectoryLength } = opts;
    // Create the vertex
    // Add the vertex to the geometry
    geometry.attributes.position.setXYZ(particles.length, position.x, position.y, position.z);
    geometry.attributes.color.setXYZ(particles.length, color.r, color.g, color.b);
    // add trajectories.
    let thisTrajectory = null;
    if (showTrajectory) {
        // make colors (http://jsfiddle.net/J7zp4/200/)
        thisTrajectory = makeTrajectory(color, position, maxTrajectoryLength);
        scene.add(thisTrajectory);
    }
    const particle = new Particle(color, position, mass, charge, thisTrajectory);
    particles.push(particle);
    // Record initial velocity components for SoA seeding.
    initialVelocities.push(velocity.x, velocity.y, velocity.z);
    // Make the HUD table.
    const tableRow = document.createElement('tr');
    const particleColumn = document.createElement('td');
    particleColumn.classList.add('particle');
    particleColumn.innerText = '⬤';
    particleColumn.style.color = color.getStyle();
    tableRow.appendChild(particleColumn);
    const massColumn = document.createElement('td');
    massColumn.classList.add('mass');
    massColumn.innerText = `${Math.round(mass * 10) / 10}`;
    tableRow.appendChild(massColumn);
    const chargeColumn = document.createElement('td');
    chargeColumn.classList.add('mass');
    chargeColumn.innerText = `${Math.round(charge * 10) / 10}`;
    tableRow.appendChild(chargeColumn);
    for (const columnName of columnNames) {
        const column = document.createElement('td');
        column.classList.add(columnName);
        tableRow.appendChild(column);
    }
    const tbody = document.querySelector('#tabularInfo > tbody');
    if (tbody)
        tbody.appendChild(tableRow);
}
function makeClonePositionsList(x, y, z) {
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
    ];
}
/**
 *  Make objects that will contain the trajectory points.
 * See <http://stackoverflow.com/questions/31399856/drawing-a-line-with-three-js-dynamically>.
 */
function makeTrajectory(thisColor, thisPosition, maxTrajectoryLength) {
    const thisGeometry = new THREE.BufferGeometry();
    const white = new THREE.Color('#FFFFFF');
    // attributes
    const points = new Float32Array(maxTrajectoryLength * 3); // 3 vertices per point
    const colors = new Float32Array(maxTrajectoryLength * 3); // 3 vertices per point
    thisGeometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
    thisGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    for (let i = 0; i < maxTrajectoryLength; i++) {
        // for each vertex of this trajectory:
        // calculate for how many percent should the color of this vertex be diluted/bleached.
        const interpolationFactor = (maxTrajectoryLength - i) / maxTrajectoryLength;
        // make the bleached color object by cloning the particle's color and then lerping it with the white color.
        const thisVertexColor = thisColor.clone().lerp(white, interpolationFactor);
        // assign this color to this vertex
        thisGeometry.attributes.color.setXYZ(i, thisVertexColor.r, thisVertexColor.g, thisVertexColor.b);
        // put this(every) vertex to the same place as the particle started
        thisGeometry.attributes.position.setXYZ(i, thisPosition.x, thisPosition.y, thisPosition.z);
    }
    // finished preparing the geometry for this trajectory
    const thisTrajectoryMaterial = new THREE.LineBasicMaterial({
        linewidth: 1,
        vertexColors: true
    });
    const line = new THREE.Line(thisGeometry, thisTrajectoryMaterial);
    // Attach ring buffer bookkeeping (ignored by Three.js internals, safe to mutate each frame).
    line.userData.trajectoryRing = { write: 0, length: maxTrajectoryLength, count: 0 };
    return line;
}
/**
 * Creates and initializes a particle system in a Three.js scene, including the main particle system and its periodic clones.
 *
 * This function sets up the geometry, material, and positions for a collection of particles, optionally adding a central "sun" particle.
 * It ensures the total number of particles matches the specified count in settings, randomizing positions and velocities as needed.
 * The function also creates clones of the particle system at specified offsets to simulate periodic boundary conditions.
 *
 * This is purely for visual effect and does not affect the underlying physics simulation.
 *
 * @param group - The parent Three.js Object3D to which the particle system and its clones will be added.
 * @param particles - The array to store and manage all Particle objects in the system.
 * @param scene - The Three.js scene where the particle system is rendered.
 * @param time - The current simulation time.
 * @param lastSnapshotTime - The time of the last simulation snapshot.
 * @param settings - Configuration options for the particle system, including particle count, boundaries, and physical constants.
 * @returns The main THREE.Points object representing the particle system.
 */
function createParticleSystem(group, particles, scene, time, lastSnapshotTime, settings) {
    // Particles are just individual vertices in a geometry
    // Create the geometry that will hold all of the vertices
    const particlesGeometry = new THREE.BufferGeometry();
    // https://stackoverflow.com/a/31411794/1147061
    const positions = new Float32Array(settings.particleCount * 3); // 3 vertices per point
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const colors = new Float32Array(settings.particleCount * 3); // 3 vertices per point
    particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const particleMaterial = new THREE.PointsMaterial({
        // http://jsfiddle.net/7yDGy/1/
        map: texture,
        blending: THREE.NormalBlending, // required
        depthTest: true,
        transparent: true,
        // opacity: 0.9,
        size: 0.3,
        vertexColors: true
    });
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
            maxTrajectoryLength: settings.maxTrajectoryLength
        });
    }
    // now, no matter how many particles has been pre-defined (e.g. the Sun) and how many are loaded from previous session, add particles till particleCount is met:
    for (let i = particles.length; i < settings.particleCount; i++) {
        let r;
        let position;
        let velocity;
        if (settings.if_makeSun) {
            // Previously particles were constrained to y=0 plane; now we randomize full 3D position for variety.
            position = new THREE.Vector3(random(-settings.spaceBoundaryX, settings.spaceBoundaryX), random(-settings.spaceBoundaryY, settings.spaceBoundaryY), random(-settings.spaceBoundaryZ, settings.spaceBoundaryZ));
            r = position.length();
            // The speed in the vertical direction should be the orbital speed.
            // See https://www.physicsclassroom.com/class/circles/Lesson-4/Mathematics-of-Satellite-Motion.
            const vy = Math.sqrt((settings.G * particles[0].mass) / r);
            velocity = new THREE.Vector3(0, vy, 0);
            // Let's also round-robin the orientation of the orbiting motions with each "planet". It's more fun.
            if (i % 2 === 0) {
                velocity.negate();
            }
        }
        else {
            position = new THREE.Vector3(random(-settings.spaceBoundaryX, settings.spaceBoundaryX), random(-settings.spaceBoundaryY, settings.spaceBoundaryY), random(-settings.spaceBoundaryZ, settings.spaceBoundaryZ));
            r = position.length();
            velocity = new THREE.Vector3(0, 0, 0);
        }
        // Force should always be initialized to zero. It will be computed properly upon first refresh.
        // Don't share this object across particles, though -- The values of their components will vary across particles during simulation.
        addParticle({
            color: new THREE.Color(Math.random(), Math.random(), Math.random()),
            position,
            velocity,
            mass: random(settings.massLowerBound, settings.massUpperBound),
            charge: sample(settings.availableCharges),
            particles,
            geometry: particlesGeometry,
            scene,
            showTrajectory: settings.if_showTrajectory,
            maxTrajectoryLength: settings.maxTrajectoryLength
        });
    }
    // Create the material that will be used to render each vertex of the geometry
    // Create the particle system
    const particleSystem = new THREE.Points(particlesGeometry, particleMaterial);
    particleSystem.position.set(0, 0, 0);
    group.add(particleSystem);
    console.log('Particle System created:', particleSystem);
    const clonePositions = makeClonePositionsList(settings.spaceBoundaryX, settings.spaceBoundaryY, settings.spaceBoundaryZ);
    const cloneTemplate = particleSystem.clone();
    cloneTemplate.material = particleMaterialForClones;
    clonePositions.forEach((clonePosition) => {
        const clone = cloneTemplate.clone();
        clone.position.set(clonePosition.x, clonePosition.y, clonePosition.z);
        group.add(clone);
    });
    return particleSystem;
}
function random(min, max) {
    return Math.random() * (max - min) + min;
}
function sample(l) {
    return l[~~(Math.random() * l.length)];
}
export { createParticleSystem, makeClonePositionsList, particleMaterialForClones, Particle };
//# sourceMappingURL=particleSystem.js.map
