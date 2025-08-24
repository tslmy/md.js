import { settings } from './settings.js';
import { init, ifMobileDevice, toggle } from './init.js';
import { saveToLocal, loadFromLocal } from './engine/persistence/storage.js';
import * as THREE from 'three';
// New SoA simulation core imports
import { createState } from './core/simulation/state.js';
// Experimental engine
import { SimulationEngine } from './engine/SimulationEngine.js';
import { fromSettings } from './engine/config/types.js';
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
let engine;
let simState;
let lastDiagnostics;
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
// ArrowHelpers removed; future instanced arrow system will centralize vector -> transform logic.
function updateTrajectoryBuffer(p, trajectory, maxLen) {
    for (let j = 0; j < maxLen - 1; j++)
        trajectory.copyAt(j, trajectory, j + 1);
    trajectory.setXYZ(maxLen - 1, p.position.x, p.position.y, p.position.z);
    trajectory.needsUpdate = true;
}
function updateHudRow(i, d) {
    const row = document.querySelector(`#tabularInfo > tbody > tr:nth-child(${i + 1})`);
    if (!row)
        return;
    const rnd = (v) => `${Math.round(v * 100) / 100}`;
    const speed2 = d.vx * d.vx + d.vy * d.vy + d.vz * d.vz;
    const speed = Math.sqrt(speed2);
    const forceMag = Math.hypot(d.fx, d.fy, d.fz);
    const set = (cls, val) => { const el = row.querySelector(cls); if (el)
        el.textContent = val; };
    set('.speed', rnd(speed));
    set('.kineticEnergy', rnd(speed2 * d.mass * 0.5));
    set('.TotalForceStrength', rnd(forceMag));
    if (!d.perForce)
        return;
    const classMap = {
        lennardJones: '.LJForceStrength',
        gravity: '.GravitationForceStrength',
        coulomb: '.CoulombForceStrength'
    };
    const i3 = 3 * i;
    for (const [name, arr] of Object.entries(d.perForce)) {
        const cls = classMap[name];
        if (!cls)
            continue;
        const mag = Math.hypot(arr[i3], arr[i3 + 1], arr[i3 + 2]);
        set(cls, rnd(mag));
    }
}
const _tmpDir = new THREE.Vector3();
const _tmpFrom = new THREE.Vector3();
function updateFromSimulation(_arrowScaleForces, _arrowScaleForVelocities, frameOffset) {
    if (!engine || !simState || !particleSystem)
        return;
    const hudVisible = isVisible(document.querySelector('#hud'));
    const needsTrajectoryShift = settings.if_showTrajectory && (time - lastSnapshotTime > settings.dt);
    const posAttr = particleSystem.geometry.attributes.position;
    const perForce = engine.getPerForceContributions();
    for (let i = 0; i < particles.length; i++)
        updateOneParticle(i, posAttr, hudVisible, needsTrajectoryShift, frameOffset, perForce);
    posAttr.needsUpdate = true;
}
function updateOneParticle(i, posAttr, hudVisible, needsTrajectoryShift, frameOffset, perForce) {
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
    // We'll update p.position after applying frame offset / PBC so tests & UI see displayed coordinates.
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
    // Mirror final (display) position for tests & capture
    p.position.set(px, py, pz);
    if (hudVisible)
        updateHudRow(i, { mass: masses[i] || 1, vx, vy, vz, fx, fy, fz, perForce });
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
/**
 * Advance simulation one timestep and update visual + diagnostic layers.
 * Split from animate() to keep the frame logic testable and reduce complexity warnings.
 */
function applyVisualUpdates() {
    const arrowScaleForces = rescaleForceScaleBarFromState(simState);
    const arrowScaleVel = rescaleVelocityScaleBarFromState(simState);
    const frameOffset = computeFrameOffset();
    updateFromSimulation(arrowScaleForces, arrowScaleVel, frameOffset);
    if (settings.if_showTrajectory && time - lastSnapshotTime > settings.dt)
        lastSnapshotTime = time;
    statistics(temperaturePanel, maxTemperature);
    update();
    render(renderer, effect);
    stats.update();
}
/**
 * Determine the frame offset based on the selected reference frame mode.
 *  - fixed: origin remains at (0,0,0)
 *  - sun: subtract position of particle 0
 *  - com: subtract instantaneous center-of-mass (translational DOF removal)
 */
function computeFrameOffset() {
    if (!simState)
        return new THREE.Vector3(0, 0, 0);
    if (settings.referenceFrameMode === 'sun' && simState.N > 0) {
        return new THREE.Vector3(simState.positions[0], simState.positions[1], simState.positions[2]);
    }
    if (settings.referenceFrameMode === 'com') {
        const { masses, positions, N } = simState;
        let mx = 0, my = 0, mz = 0, mTot = 0;
        for (let i = 0; i < N; i++) {
            const i3 = 3 * i;
            const m = masses[i] || 1;
            mx += m * positions[i3];
            my += m * positions[i3 + 1];
            mz += m * positions[i3 + 2];
            mTot += m;
        }
        if (mTot > 0)
            return new THREE.Vector3(mx / mTot, my / mTot, mz / mTot);
    }
    return new THREE.Vector3(0, 0, 0);
}
/**
 * Compute & expose latest diagnostics snapshot (energy, temperature, extrema).
 */
// Diagnostics now provided via engine events; legacy function removed.
function calculateTemperature() {
    if (!simState)
        return 0;
    const { velocities, masses, N } = simState;
    let sum = 0;
    for (let i = 0; i < N; i++) {
        const i3 = 3 * i;
        const vx = velocities[i3], vy = velocities[i3 + 1], vz = velocities[i3 + 2];
        sum += (masses[i] || 1) * (vx * vx + vy * vy + vz * vz);
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
    // Attempt to hydrate engine first (if snapshot present) BEFORE building visual particle system.
    const loaded = loadFromLocal();
    if (loaded) {
        engine = loaded.engine;
        // Mirror loaded config into settings (best-effort) – future: migrate settings <-> engine properly.
        settings.particleCount = loaded.snapshot.config.world.particleCount;
        settings.spaceBoundaryX = loaded.snapshot.config.world.box.x;
        settings.spaceBoundaryY = loaded.snapshot.config.world.box.y;
        settings.spaceBoundaryZ = loaded.snapshot.config.world.box.z;
        settings.dt = loaded.snapshot.config.runtime.dt;
        settings.cutoffDistance = loaded.snapshot.config.runtime.cutoff;
        time = loaded.snapshot.time;
    }
    const values = init(settings, particles, time, lastSnapshotTime);
    scene = values[0];
    particleSystem = values[1];
    camera = values[2];
    renderer = values[3];
    controls = values[4];
    stats = values[5];
    temperaturePanel = values[6];
    effect = values[7];
    if (!engine) {
        // Fresh run: construct engine from particles
        simState = createState({
            particleCount: settings.particleCount,
            box: { x: settings.spaceBoundaryX, y: settings.spaceBoundaryY, z: settings.spaceBoundaryZ },
            dt: settings.dt,
            cutoff: settings.cutoffDistance
        });
        for (let i = 0; i < particles.length; i++) {
            const i3 = 3 * i;
            simState.positions[i3] = particles[i].position.x;
            simState.positions[i3 + 1] = particles[i].position.y;
            simState.positions[i3 + 2] = particles[i].position.z;
            const maybe = window?.initialVelocities || [];
            simState.velocities[i3] = maybe[i3] || 0;
            simState.velocities[i3 + 1] = maybe[i3 + 1] || 0;
            simState.velocities[i3 + 2] = maybe[i3 + 2] || 0;
            simState.masses[i] = particles[i].mass;
            simState.charges[i] = particles[i].charge;
        }
        engine = new SimulationEngine(fromSettings(settings));
        engine.seed({ positions: simState.positions, velocities: simState.velocities, masses: simState.masses, charges: simState.charges });
        simState = engine.getState();
    }
    else {
        simState = engine.getState();
    }
    engine.on('frame', ({ time: t }) => { time = t; applyVisualUpdates(); });
    engine.on('diagnostics', (d) => { lastDiagnostics = d; if (window.__mdjs)
        window.__mdjs.diagnostics = d; });
    engine.run({ useRaf: true });
    // Expose handle for automated headless tests
    // Expose simulation state (read-only for tests; mutation not supported outside test harness)
    window.__mdjs = { particles, settings, simState, diagnostics: lastDiagnostics };
    // Install full-state persistence handler (overrides placeholder in init.js)
    window.onbeforeunload = () => { if (engine)
        saveToLocal(engine); };
    // bind keyboard event:
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            toggle('#hud');
        }
    });
});
// Legacy captureState removed – engine snapshot now covers persistence.
//# sourceMappingURL=script.js.map
