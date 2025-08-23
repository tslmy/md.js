import { settings } from './settings.js';
import { init, ifMobileDevice, toggle } from './init.js';
import { saveState } from './stateStorage.js';
import * as THREE from 'three';
import { initialVelocities } from './particleSystem.js';
// New SoA simulation core imports
import { createState } from './core/simulation/state.js';
import { Simulation } from './core/simulation/Simulation.js';
import { VelocityVerlet } from './core/simulation/integrators.js';
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
// Expose placeholder early so headless smoke test can detect handle before async init completes.
if (typeof window !== 'undefined') {
    window.__mdjs = { particles, settings };
}
/**
 * el: the DOM element you'd like to test for visibility.
 */
function isVisible(el) {
    return !!el && window.getComputedStyle(el).display !== 'none';
}
// Legacy force application removed in favor of SoA simulation core.
// Derive arrow scaling directly from SoA state (forces & velocities)
function rescaleForceScaleBarFromState(state) {
    if (!state)
        return 1;
    const { forces, N } = state;
    let maxMag = 0;
    for (let i = 0; i < N; i++) {
        const i3 = 3 * i;
        const mag = Math.hypot(forces[i3], forces[i3 + 1], forces[i3 + 2]);
        if (mag > maxMag)
            maxMag = mag;
    }
    if (maxMag === 0)
        maxMag = 1;
    const scale = settings.unitArrowLength / maxMag;
    const forceEl = document.getElementById('force');
    if (forceEl)
        forceEl.style.width = `${scale * 1000000}px`;
    return scale;
}
function rescaleVelocityScaleBarFromState(state) {
    if (!state)
        return 1;
    const { velocities, N } = state;
    let maxSpeed = 0;
    for (let i = 0; i < N; i++) {
        const i3 = 3 * i;
        const speed = Math.hypot(velocities[i3], velocities[i3 + 1], velocities[i3 + 2]);
        if (speed > maxSpeed)
            maxSpeed = speed;
    }
    if (maxSpeed === 0)
        maxSpeed = 1;
    const scale = settings.unitArrowLength / maxSpeed;
    const velEl = document.getElementById('velocity');
    if (velEl)
        velEl.style.width = `${scale * 1000000}px`;
    return scale;
}
// Helpers to reduce complexity
function updateArrowHelper(arrow, from, vector, scale) {
    // Compute raw length (either proportional to magnitude or fixed unit length)
    let lengthToScale = settings.if_proportionate_arrows_with_vectors ? vector.length() * scale * settings.arrowMagnitudeMultiplier : settings.unitArrowLength;
    // Ensure a small minimum so arrows remain visible when forces / velocities are tiny (or zero after reset)
    const minVisible = 0.2 * settings.unitArrowLength;
    if (lengthToScale < minVisible)
        lengthToScale = minVisible;
    if (settings.if_limitArrowsMaxLength && lengthToScale > settings.maxArrowLength)
        lengthToScale = settings.maxArrowLength;
    arrow.setLength(lengthToScale);
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
function updateHudRow(i, d) {
    const speed = Math.hypot(d.vx, d.vy, d.vz);
    const forceMag = Math.hypot(d.fx, d.fy, d.fz);
    const row = document.querySelector(`#tabularInfo > tbody > tr:nth-child(${i + 1})`);
    if (!row)
        return;
    const speedEl = row.querySelector('.speed');
    if (speedEl)
        speedEl.textContent = `${Math.round(speed * 100) / 100}`;
    const keEl = row.querySelector('.kineticEnergy');
    if (keEl)
        keEl.textContent = `${Math.round(speed * speed * d.mass * 50) / 100}`;
    const tfEl = row.querySelector('.TotalForceStrength');
    if (tfEl)
        tfEl.textContent = `${Math.round(forceMag * 100) / 100}`;
}
const _tmpDir = new THREE.Vector3();
const _unitX = new THREE.Vector3(1, 0, 0);
const _tmpVel = new THREE.Vector3();
const _tmpForce = new THREE.Vector3();
const _tmpFrom = new THREE.Vector3();
function updateFromSimulation(arrowScaleForForces, arrowScaleForVelocities, frameOffset) {
    if (!simulation || !simState || !particleSystem)
        return;
    const hudVisible = isVisible(document.querySelector('#hud'));
    const needsTrajectoryShift = settings.if_showTrajectory && (time - lastSnapshotTime > settings.dt);
    const posAttr = particleSystem.geometry.attributes.position;
    for (let i = 0; i < particles.length; i++)
        updateOneParticle(i, posAttr, hudVisible, needsTrajectoryShift, frameOffset, arrowScaleForForces, arrowScaleForVelocities);
    posAttr.needsUpdate = true;
}
function updateOneParticle(i, posAttr, hudVisible, needsTrajectoryShift, frameOffset, arrowScaleForForces, arrowScaleForVelocities) {
    if (!simState)
        return;
    const { positions, velocities, forces, masses } = simState;
    const p = particles[i];
    if (p.isEscaped)
        return;
    const i3 = 3 * i;
    let px = positions[i3] - frameOffset.x;
    let py = positions[i3 + 1] - frameOffset.y;
    let pz = positions[i3 + 2] - frameOffset.z;
    posAttr.setXYZ(i, px, py, pz);
    const trajectoryAttr = (settings.if_showTrajectory && p.trajectory)
        ? p.trajectory.geometry.getAttribute('position')
        : null;
    if (settings.if_use_periodic_boundary_condition) {
        _tmpDir.set(px, py, pz);
        applyPbc(_tmpDir, trajectoryAttr, settings.maxTrajectoryLength, settings.spaceBoundaryX, settings.spaceBoundaryY, settings.spaceBoundaryZ);
        px = _tmpDir.x;
        py = _tmpDir.y;
        pz = _tmpDir.z;
        posAttr.setXYZ(i, px, py, pz);
    }
    if (trajectoryAttr && needsTrajectoryShift)
        updateTrajectoryBuffer({ position: _tmpFrom.set(px, py, pz) }, trajectoryAttr, settings.maxTrajectoryLength);
    const vx = velocities[i3], vy = velocities[i3 + 1], vz = velocities[i3 + 2];
    const fx = forces[i3], fy = forces[i3 + 1], fz = forces[i3 + 2];
    // Update displayed position only (SoA remains source of truth). Legacy velocity/force mirrors removed.
    p.position.set(px, py, pz);
    if (settings.if_showArrows) {
        _tmpVel.set(vx, vy, vz);
        _tmpForce.set(fx, fy, fz);
        _tmpFrom.set(px, py, pz);
        updateArrowHelper(p.velocityArrow, _tmpFrom, _tmpVel, arrowScaleForVelocities);
        updateArrowHelper(p.forceArrow, _tmpFrom, _tmpForce, arrowScaleForForces);
    }
    if (hudVisible)
        updateHudRow(i, { mass: masses[i] || 1, vx, vy, vz, fx, fy, fz });
}
// Removed legacy applyParticleVisualUpdate; loop logic in updateFromSimulation now works directly off SoA arrays.
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
    if (simulation)
        simulation.step();
    const arrowScaleForForces = rescaleForceScaleBarFromState(simState);
    const arrowScaleForVelocities = rescaleVelocityScaleBarFromState(simState);
    const frameOffset = (settings.if_ReferenceFrame_movesWithSun && simState)
        ? new THREE.Vector3(simState.positions[0], simState.positions[1], simState.positions[2])
        : new THREE.Vector3(0, 0, 0);
    updateFromSimulation(arrowScaleForForces, arrowScaleForVelocities, frameOffset);
    if (settings.if_showTrajectory && time - lastSnapshotTime > settings.dt)
        lastSnapshotTime = time;
    statistics(temperaturePanel, maxTemperature);
    update();
    render(renderer, effect);
    if (settings.ifRun)
        requestAnimationFrame(animate);
    stats.update();
}
function calculateTemperature() {
    if (!simState)
        return 0;
    const { velocities, masses, N } = simState;
    let sum = 0;
    for (let i = 0; i < N; i++) {
        const i3 = 3 * i;
        const vx = velocities[i3];
        const vy = velocities[i3 + 1];
        const vz = velocities[i3 + 2];
        const v2 = vx * vx + vy * vy + vz * vz;
        sum += (masses[i] || 1) * v2;
    }
    const temperature = sum / settings.kB / (3 * settings.particleCount - 3);
    if (temperature > maxTemperature)
        maxTemperature = temperature;
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
        const p = particles[i];
        simState.positions[i3] = p.position.x;
        simState.positions[i3 + 1] = p.position.y;
        simState.positions[i3 + 2] = p.position.z;
        // Seed velocity from initialVelocities captured during particle creation (fallback zero).
        simState.velocities[i3] = initialVelocities[i3] ?? 0;
        simState.velocities[i3 + 1] = initialVelocities[i3 + 1] ?? 0;
        simState.velocities[i3 + 2] = initialVelocities[i3 + 2] ?? 0;
        simState.masses[i] = p.mass;
        simState.charges[i] = p.charge;
    }
    const forcePlugins = [];
    if (settings.if_apply_LJpotential)
        forcePlugins.push(new LennardJones({ epsilon: settings.EPSILON, sigma: settings.DELTA }));
    if (settings.if_apply_gravitation)
        forcePlugins.push(new Gravity({ G: settings.G }));
    if (settings.if_apply_coulombForce)
        forcePlugins.push(new Coulomb({ K: settings.K }));
    simulation = new Simulation(simState, VelocityVerlet, forcePlugins, { dt: settings.dt, cutoff: settings.cutoffDistance });
    animate();
    // Expose handle for automated headless tests
    // Expose simulation state (read-only for tests; mutation not supported outside test harness)
    window.__mdjs = { particles, settings, simState };
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
    // Use SoA arrays as single source of truth for dynamic quantities.
    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        particleColors.push(p.color.r, p.color.g, p.color.b);
        particlePositions.push(p.position.x, p.position.y, p.position.z);
        if (simState) {
            const i3 = 3 * i;
            particleForces.push({ x: simState.forces[i3], y: simState.forces[i3 + 1], z: simState.forces[i3 + 2] });
            particleVelocities.push({ x: simState.velocities[i3], y: simState.velocities[i3 + 1], z: simState.velocities[i3 + 2] });
            particleMasses.push(simState.masses[i]);
            particleCharges.push(simState.charges[i]);
        }
        else { // fallback (should not happen after init)
            particleForces.push({ x: 0, y: 0, z: 0 });
            particleVelocities.push({ x: 0, y: 0, z: 0 });
            particleMasses.push(p.mass);
            particleCharges.push(p.charge);
        }
    }
    return { particleCount, particleColors, particlePositions, particleForces, particleVelocities, particleMasses, particleCharges, time, lastSnapshotTime };
}
