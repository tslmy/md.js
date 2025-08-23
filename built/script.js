import { settings } from './settings.js';
import { init, ifMobileDevice, toggle } from './init.js';
import { saveState } from './stateStorage.js';
import * as THREE from 'three';
// New SoA simulation core imports
import { createState } from './core/simulation/state.js';
import { Simulation } from './core/simulation/Simulation.js';
import { EulerIntegrator } from './core/simulation/integrators.js';
import { LennardJones } from './core/forces/lennardJones.js';
import { Gravity } from './core/forces/gravity.js';
import { Coulomb } from './core/forces/coulomb.js';
let camera;
let scene;
let renderer;
let effect;
let controls;
let temperaturePanel;
let stats;
let maxTemperature = 0;
let particleSystem;
// New SoA simulation objects
let simulation;
let simState;
const particles = [];
let time = 0;
let lastSnapshotTime = 0;
/**
 * el: the DOM element you'd like to test for visibility.
 */
function isVisible(el) {
    return !!el && window.getComputedStyle(el).display !== 'none';
}
// Legacy force application removed in favor of SoA simulation core.
function rescaleForceScaleBar(particles) {
    const forceStrengths = particles.filter(particle => !particle.isEscaped).map(particle => particle.force.length());
    const highestForceStrengthPresent = Math.max(...forceStrengths);
    const arrowScaleForForces = settings.unitArrowLength / highestForceStrengthPresent;
    const forceEl = document.getElementById('force');
    if (forceEl)
        forceEl.style.width = `${arrowScaleForForces * 1000000}px`;
    return arrowScaleForForces;
}
function rescaleVelocityScaleBar(particles) {
    const speeds = particles.filter(particle => !particle.isEscaped).map(particle => particle.velocity.length());
    const highestSpeedPresent = Math.max(...speeds);
    const arrowScaleForVelocities = settings.unitArrowLength / highestSpeedPresent;
    const velEl = document.getElementById('velocity');
    if (velEl)
        velEl.style.width = `${arrowScaleForVelocities * 1000000}px`;
    return arrowScaleForVelocities;
}
// Helpers to reduce complexity
function updateArrowHelper(arrow, from, vector, scale) {
    const lengthToScale = settings.if_proportionate_arrows_with_vectors ? vector.length() * scale : settings.unitArrowLength;
    arrow.setLength(settings.if_limitArrowsMaxLength && lengthToScale > settings.maxArrowLength
        ? settings.maxArrowLength
        : lengthToScale);
    arrow.position.copy(from);
    const dir = vector.lengthSq() === 0 ? _unitX : _tmpDir.copy(vector).normalize();
    arrow.setDirection(dir);
}
function updateTrajectoryBuffer(p, trajectory, maxLen) {
    for (let j = 0; j < maxLen - 1; j++)
        trajectory.copyAt(j, trajectory, j + 1);
    trajectory.setXYZ(maxLen - 1, p.position.x, p.position.y, p.position.z);
    trajectory.needsUpdate = true;
}
function updateHudRow(i, p) {
    const thisSpeed = p.velocity.length();
    const row = document.querySelector(`#tabularInfo > tbody > tr:nth-child(${i + 1})`);
    if (!row)
        return;
    const speedEl = row.querySelector('.speed');
    if (speedEl)
        speedEl.textContent = `${Math.round(thisSpeed * 100) / 100}`;
    const keEl = row.querySelector('.kineticEnergy');
    if (keEl)
        keEl.textContent = `${Math.round(thisSpeed * thisSpeed * p.mass * 50) / 100}`;
    const tfEl = row.querySelector('.TotalForceStrength');
    if (tfEl)
        tfEl.textContent = `${Math.round(p.force.length() * 100) / 100}`;
}
const _tmpDir = new THREE.Vector3();
const _unitX = new THREE.Vector3(1, 0, 0);
function updateFromSimulation(arrowScaleForForces, arrowScaleForVelocities, frameOffset) {
    if (!simulation || !simState || !particleSystem)
        return;
    const { positions, velocities, forces } = simState;
    const hudVisible = isVisible(document.querySelector('#hud'));
    const needsTrajectoryShift = settings.if_showTrajectory && (time - lastSnapshotTime > settings.dt);
    for (let i = 0; i < particles.length; i++) {
        applyParticleVisualUpdate(i, positions, velocities, forces, { f: arrowScaleForForces, v: arrowScaleForVelocities }, { hudVisible, needsTrajectoryShift, frameOffset });
    }
    particleSystem.geometry.attributes.position.needsUpdate = true;
}
function applyParticleVisualUpdate(i, positions, velocities, forces, scales, ctx) {
    const p = particles[i];
    if (p.isEscaped)
        return;
    const i3 = 3 * i;
    p.position.set(positions[i3] - ctx.frameOffset.x, positions[i3 + 1] - ctx.frameOffset.y, positions[i3 + 2] - ctx.frameOffset.z);
    p.velocity.set(velocities[i3], velocities[i3 + 1], velocities[i3 + 2]);
    p.force.set(forces[i3], forces[i3 + 1], forces[i3 + 2]);
    if (particleSystem)
        particleSystem.geometry.attributes.position.setXYZ(i, p.position.x, p.position.y, p.position.z);
    const trajectoryAttr = (settings.if_showTrajectory && p.trajectory)
        ? p.trajectory.geometry.getAttribute('position')
        : null;
    if (settings.if_use_periodic_boundary_condition) {
        applyPbc(p.position, trajectoryAttr, settings.maxTrajectoryLength, settings.spaceBoundaryX, settings.spaceBoundaryY, settings.spaceBoundaryZ);
    }
    if (settings.if_showArrows) {
        updateArrowHelper(p.velocityArrow, p.position, p.velocity, scales.f);
        updateArrowHelper(p.forceArrow, p.position, p.force, scales.v);
    }
    if (trajectoryAttr && ctx.needsTrajectoryShift)
        updateTrajectoryBuffer(p, trajectoryAttr, settings.maxTrajectoryLength);
    if (ctx.hudVisible)
        updateHudRow(i, p);
}
function applyPbc(pos, trajectory, maxLen, bx, by, bz) {
    const wrapAxis = (axis, boundary, adjust) => {
        while (pos[axis] < -boundary) {
            pos[axis] += 2 * boundary;
            adjust(2 * boundary);
        }
        while (pos[axis] > boundary) {
            pos[axis] -= 2 * boundary;
            adjust(-2 * boundary);
        }
    };
    const adjustFactory = (setter, getter) => (delta) => {
        if (!trajectory)
            return;
        for (let j = 0; j < maxLen; j++)
            setter(j, getter(j) + delta);
        trajectory.needsUpdate = true;
    };
    wrapAxis('x', bx, adjustFactory((i, v) => trajectory?.setX(i, v), i => trajectory?.getX(i) ?? 0));
    wrapAxis('y', by, adjustFactory((i, v) => trajectory?.setY(i, v), i => trajectory?.getY(i) ?? 0));
    wrapAxis('z', bz, adjustFactory((i, v) => trajectory?.setZ(i, v), i => trajectory?.getZ(i) ?? 0));
}
function animate() {
    time += settings.dt;
    // Step SoA simulation
    if (simulation)
        simulation.step();
    // Copy SoA results back & update visual elements
    const arrowScaleForForces = rescaleForceScaleBar(particles);
    const arrowScaleForVelocities = rescaleVelocityScaleBar(particles);
    const frameOffset = (settings.if_ReferenceFrame_movesWithSun && simState)
        ? new THREE.Vector3(simState.positions[0], simState.positions[1], simState.positions[2])
        : new THREE.Vector3(0, 0, 0);
    updateFromSimulation(arrowScaleForForces, arrowScaleForVelocities, frameOffset);
    if (settings.if_showTrajectory && time - lastSnapshotTime > settings.dt) {
        lastSnapshotTime = time;
    }
    statistics(temperaturePanel, maxTemperature);
    update();
    render(renderer, effect);
    if (settings.ifRun)
        requestAnimationFrame(animate);
    stats.update();
}
function calculateTemperature() {
    let temperature = 0;
    particles.filter(particle => !particle.isEscaped).forEach(particle => {
        temperature +=
            particle.mass *
                particle.velocity.length() ** 2;
    });
    temperature *= 1 / settings.kB / (3 * settings.particleCount - 3);
    if (temperature > maxTemperature) {
        maxTemperature = temperature;
    }
    return temperature;
}
function statistics(panel, maxTemperature) {
    const temperature = calculateTemperature();
    panel.update(temperature, maxTemperature);
}
function update() {
    // (removed stale resize comment)
    camera.updateProjectionMatrix();
    if (controls)
        controls.update();
}
function render(renderer, effect) {
    if (ifMobileDevice && effect) {
        effect.render(scene, camera);
    }
    else {
        renderer.render(scene, camera);
    }
}
// when document is ready:
// Source: https://stackoverflow.com/a/9899701/1147061
function docReady(fn) {
    // see if DOM is already available
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        // call on next available tick
        setTimeout(fn, 1);
    }
    else {
        document.addEventListener('DOMContentLoaded', fn);
    }
}
docReady(() => {
    console.log('Ready.');
    const values = init(settings, particles, time, lastSnapshotTime);
    scene = values[0];
    particleSystem = values[1];
    camera = values[2];
    renderer = values[3];
    controls = values[4];
    stats = values[5];
    temperaturePanel = values[6];
    effect = values[7];
    // Build SoA simulation state from existing particle objects
    simState = createState({
        particleCount: settings.particleCount,
        box: { x: settings.spaceBoundaryX, y: settings.spaceBoundaryY, z: settings.spaceBoundaryZ },
        dt: settings.dt,
        cutoff: settings.cutoffDistance
    });
    // Seed arrays
    for (let i = 0; i < particles.length; i++) {
        const i3 = 3 * i;
        simState.positions[i3] = particles[i].position.x;
        simState.positions[i3 + 1] = particles[i].position.y;
        simState.positions[i3 + 2] = particles[i].position.z;
        simState.velocities[i3] = particles[i].velocity.x;
        simState.velocities[i3 + 1] = particles[i].velocity.y;
        simState.velocities[i3 + 2] = particles[i].velocity.z;
        simState.masses[i] = particles[i].mass;
        simState.charges[i] = particles[i].charge;
    }
    const forcePlugins = [];
    if (settings.if_apply_LJpotential)
        forcePlugins.push(new LennardJones({ epsilon: settings.EPSILON, sigma: settings.DELTA }));
    if (settings.if_apply_gravitation)
        forcePlugins.push(new Gravity({ G: settings.G }));
    if (settings.if_apply_coulombForce)
        forcePlugins.push(new Coulomb({ K: settings.K }));
    simulation = new Simulation(simState, EulerIntegrator, forcePlugins, { dt: settings.dt, cutoff: settings.cutoffDistance });
    animate();
    // Expose handle for automated headless tests
    window.__mdjs = { particles, settings };
    // Install full-state persistence handler (overrides placeholder in init.js)
    window.onbeforeunload = () => {
        try {
            const snapshot = captureState();
            saveState(snapshot);
        }
        catch (e) {
            console.log('Failed to persist state:', e);
        }
    };
    // bind keyboard event:
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            toggle('#hud');
        }
    });
});
// Build a complete snapshot matching SavedState interface for persistence.
function captureState() {
    const particleCount = particles.length;
    const particleColors = [];
    const particlePositions = [];
    const particleForces = [];
    const particleVelocities = [];
    const particleMasses = [];
    const particleCharges = [];
    for (const p of particles) {
        particleColors.push(p.color.r, p.color.g, p.color.b);
        particlePositions.push(p.position.x, p.position.y, p.position.z);
        particleForces.push({ x: p.force.x, y: p.force.y, z: p.force.z });
        particleVelocities.push({ x: p.velocity.x, y: p.velocity.y, z: p.velocity.z });
        particleMasses.push(p.mass);
        particleCharges.push(p.charge);
    }
    return {
        particleCount,
        particleColors,
        particlePositions,
        particleForces,
        particleVelocities,
        particleMasses,
        particleCharges,
        time,
        lastSnapshotTime
    };
}
