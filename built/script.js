import { settings } from './settings.js';
import { init, ifMobileDevice, toggle } from './init.js';
import { saveState } from './stateStorage.js';
import * as THREE from 'three';
import { makeClonePositionsList } from './particleSystem.js';
let camera;
let scene;
let renderer;
let effect;
let controls;
let temperaturePanel;
let stats;
let maxTemperature = 0;
let particleSystem;
const particles = [];
let time = 0;
let lastSnapshotTime = 0;
/**
 * el: the DOM element you'd like to test for visibility.
 */
function isVisible(el) {
    return !!el && window.getComputedStyle(el).display !== 'none';
}
function applyForce(particles, i, j, func) {
    const thisPosition = particles[i].position;
    const thatPosition = particles[j].position;
    const rOriginal = new THREE.Vector3().subVectors(thisPosition, thatPosition); // relative displacement
    let clonePositions;
    // ====== populate the array "particleJClones" ======
    if (settings.if_use_periodic_boundary_condition) {
        clonePositions = makeClonePositionsList(settings.spaceBoundaryX, settings.spaceBoundaryY, settings.spaceBoundaryZ);
        clonePositions.push(new THREE.Vector3(0, 0, 0));
    }
    else {
        clonePositions = [new THREE.Vector3(0, 0, 0)];
    }
    // `forceFromAllClones` accumulates force that i feels from all clones of j.
    const forceFromAllClones = new THREE.Vector3(0, 0, 0);
    clonePositions.forEach((thatPositionDisplacement) => {
        // (possibly) displace shift the end of this vector from particle j to one of its clones:
        const rEffective = new THREE.Vector3().subVectors(rOriginal, thatPositionDisplacement);
        const d = rEffective.length(); // calculate distance between particles i and j (with j may being a clone)
        if (d < settings.cutoffDistance) {
            const forceStrengthFromThisClone = func(i, j, d);
            const forceFromThisClone = rEffective.clone().setLength(forceStrengthFromThisClone);
            particles[i].force.sub(forceFromThisClone);
            particles[j].force.add(forceFromThisClone);
            forceFromAllClones.add(forceFromThisClone);
        }
    });
    return forceFromAllClones;
}
function computeForces(particles, particleCount = 8, shouldUpdateHud = false) {
    // remove all forces first.
    particles.filter(particle => !particle.isEscaped)
        .forEach((particle) => particle.force.set(0, 0, 0));
    for (let i = 0; i < particleCount; i++) {
        if (particles[i].isEscaped) {
            continue;
        }
        // initialize total force counters:
        let thisLJForceStrength = 0;
        let thisGravitationForceStrength = 0;
        let thisCoulombForceStrength = 0;
        // process interactions:
        for (let j = i + 1; j < particleCount; j++) {
            if (particles[j].isEscaped) {
                continue;
            }
            // generate all forces:
            if (settings.if_apply_LJpotential) {
                // Use Lennard-Jones potential
                // V = 4*epsilon*((delta/d)^12 - (delta/d)^6)
                // F = 4*epsilon*(-12/d*(delta/d)^12 + 6/d*(delta/d)^6) r/|r|
                const thisLJForce = applyForce(particles, i, j, (i, j, d) => {
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
                const thisGravitationForce = applyForce(particles, i, j, (i, j, d) => {
                    // Use d_min to prevent high potential when particles are close
                    // to avoid super high accelerations in poor time resolution
                    if (d < settings.d_min) {
                        console.log('particle', i, ',', j, 'too near for gravitation.');
                        d = settings.d_min;
                    }
                    return (settings.G * particles[i].mass * particles[j].mass) / (d * d);
                });
                thisGravitationForceStrength += thisGravitationForce.length();
            }
            if (settings.if_apply_coulombForce) {
                // Use gravitational potential
                // -> F = GMm/(d*d) r/|r|
                const thisCoulombForce = applyForce(particles, i, j, (i, j, d) => {
                    // Use d_min to prevent high potential when particles are close
                    // to avoid super high accelerations in poor time resolution
                    if (d < settings.d_min) {
                        console.log('particle', i, ',', j, 'too near for coulomb force.');
                        d = settings.d_min;
                    }
                    return ((-settings.K * particles[i].charge * particles[j].charge) / (d * d));
                });
                thisCoulombForceStrength += thisCoulombForce.length();
            }
        }
        if (shouldUpdateHud) {
            const $thisRow = document.querySelector(`#tabularInfo > tbody > tr:nth-child(${i + 1})`);
            if ($thisRow) {
                const $LJForceStrength = $thisRow.querySelector('.LJForceStrength');
                if ($LJForceStrength)
                    $LJForceStrength.textContent = `${Math.round(thisLJForceStrength * 100) / 100}`;
                const $GravitationForceStrength = $thisRow.querySelector('.GravitationForceStrength');
                if ($GravitationForceStrength)
                    $GravitationForceStrength.textContent = `${Math.round(thisGravitationForceStrength * 100) / 100}`;
                const $CoulombForceStrength = $thisRow.querySelector('.CoulombForceStrength');
                if ($CoulombForceStrength)
                    $CoulombForceStrength.textContent = `${Math.round(thisCoulombForceStrength * 100) / 100}`;
            }
        }
    }
}
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
function animateOneParticle(i, arrowScaleForForces, arrowScaleForVelocities) {
    if (particles[i].isEscaped) {
        return;
    }
    // ======================== now update eveything user could see ========================
    // update velocities according to force:
    particles[i].velocity.addScaledVector(particles[i].force, settings.dt / particles[i].mass); // v = v + f/m·dt
    const thisSpeed = particles[i].velocity.length(); // vector -> scalar
    // update positions according to velocity:
    particles[i].position.addScaledVector(particles[i].velocity, settings.dt); // x = x + v·dt
    if (!particleSystem)
        return;
    particleSystem.geometry.attributes.position.setXYZ(i, particles[i].position.x, particles[i].position.y, particles[i].position.z);
    const trajectoryPositions = (settings.if_showTrajectory && particles[i].trajectory)
        ? particles[i].trajectory.geometry.attributes.position
        : null;
    // Check if this particle hit a boundary of the universe (i.e. cell walls). If so, perioidic boundary condition (PBC) might be applied:
    if (settings.if_use_periodic_boundary_condition) {
        applyPbc(particles[i].position, trajectoryPositions, settings.maxTrajectoryLength, settings.spaceBoundaryX, settings.spaceBoundaryY, settings.spaceBoundaryZ);
    }
    if (settings.if_showArrows) {
        // let's see whether the camera should trace something (i.e. the reference frame should be moving), defined by user
        // update arrows: (http://jsfiddle.net/pardo/bgyem42v/3/)
        function updateArrow(arrow, from, vector, scale) {
            const lengthToScale = settings.if_proportionate_arrows_with_vectors
                ? vector.length() * scale
                : settings.unitArrowLength;
            arrow.setLength(settings.if_limitArrowsMaxLength &&
                lengthToScale > settings.maxArrowLength
                ? settings.maxArrowLength
                : lengthToScale);
            arrow.position.copy(from);
            arrow.setDirection(new THREE.Vector3().copy(vector).normalize());
        }
        updateArrow(particles[i].velocityArrow, particles[i].position, particles[i].velocity, arrowScaleForForces);
        updateArrow(particles[i].forceArrow, particles[i].position, particles[i].force, arrowScaleForVelocities);
    }
    // update trajectories:
    if (settings.if_showTrajectory && trajectoryPositions) {
        if (time - lastSnapshotTime > settings.dt) {
            for (let j = 0; j < settings.maxTrajectoryLength - 1; j++) {
                trajectoryPositions.copyAt(j, trajectoryPositions, j + 1);
            }
            trajectoryPositions.setXYZ(settings.maxTrajectoryLength - 1, particles[i].position.x, particles[i].position.y, particles[i].position.z);
            trajectoryPositions.needsUpdate = true;
        }
    }
    // update HUD, if visible:
    if (isVisible(document.querySelector('#hud'))) {
        const $thisRow = document.querySelector(`#tabularInfo > tbody > tr:nth-child(${i + 1})`);
        if ($thisRow) {
            const speedEl = $thisRow.querySelector('.speed');
            if (speedEl)
                speedEl.textContent = `${Math.round(thisSpeed * 100) / 100}`;
            const keEl = $thisRow.querySelector('.kineticEnergy');
            if (keEl)
                keEl.textContent = `${Math.round(thisSpeed * thisSpeed * particles[i].mass * 50) / 100}`;
            const tfEl = $thisRow.querySelector('.TotalForceStrength');
            if (tfEl)
                tfEl.textContent = `${particles[i].force ? Math.round(particles[i].force.length() * 100) / 100 : '0'}`;
        }
    }
    if (settings.if_constant_temperature) {
        const currentTemperature = calculateTemperature();
        const scaleFactor = Math.sqrt(settings.targetTemperature / currentTemperature);
        particles.filter(particle => !particle.isEscaped).forEach(particle => particle.velocity.multiplyScalar(scaleFactor));
    }
    const hasThisParticleEscaped = settings.if_use_periodic_boundary_condition &&
        thisSpeed > settings.escapeSpeed &&
        (Math.abs(particles[i].position.x) >= 0.9 * settings.spaceBoundaryX ||
            Math.abs(particles[i].position.y) >= 0.9 * settings.spaceBoundaryY ||
            Math.abs(particles[i].position.z) >= 0.9 * settings.spaceBoundaryZ);
    if (hasThisParticleEscaped) {
        console.log('Particle', i, 'escaped with speed', thisSpeed, '.');
        particles[i].isEscaped = true;
    }
}
function applyPbc(thisPosition, trajectoryPositions, maxTrajectoryLength, spaceBoundaryX, spaceBoundaryY, spaceBoundaryZ) {
    while (thisPosition.x < -spaceBoundaryX) {
        thisPosition.x += 2 * spaceBoundaryX;
        if (trajectoryPositions !== null) {
            for (let j = 0; j < maxTrajectoryLength; j++) {
                trajectoryPositions.setX(j, trajectoryPositions.getX(j) + 2 * spaceBoundaryX);
            }
        }
    }
    while (thisPosition.x > spaceBoundaryX) {
        thisPosition.x -= 2 * spaceBoundaryX;
        if (trajectoryPositions !== null) {
            for (let j = 0; j < maxTrajectoryLength; j++) {
                trajectoryPositions.setX(j, trajectoryPositions.getX(j) - 2 * spaceBoundaryX);
            }
        }
    }
    while (thisPosition.y < -spaceBoundaryY) {
        thisPosition.y += 2 * spaceBoundaryY;
        if (trajectoryPositions !== null) {
            for (let j = 0; j < maxTrajectoryLength; j++) {
                trajectoryPositions.setY(j, trajectoryPositions.getY(j) + 2 * spaceBoundaryY);
            }
        }
    }
    while (thisPosition.y > spaceBoundaryY) {
        thisPosition.y -= 2 * spaceBoundaryY;
        if (trajectoryPositions !== null) {
            for (let j = 0; j < maxTrajectoryLength; j++) {
                trajectoryPositions.setY(j, trajectoryPositions.getY(j) - 2 * spaceBoundaryY);
            }
        }
    }
    while (thisPosition.z < -spaceBoundaryZ) {
        thisPosition.z += 2 * spaceBoundaryZ;
        if (trajectoryPositions !== null) {
            for (let j = 0; j < maxTrajectoryLength; j++) {
                trajectoryPositions.setZ(j, trajectoryPositions.getZ(j) + 2 * spaceBoundaryZ);
            }
            trajectoryPositions.needsUpdate = true;
        }
    }
    while (thisPosition.z > spaceBoundaryZ) {
        thisPosition.z -= 2 * spaceBoundaryZ;
        if (trajectoryPositions !== null) {
            for (let j = 0; j < maxTrajectoryLength; j++) {
                trajectoryPositions.setZ(j, trajectoryPositions.getZ(j) - 2 * spaceBoundaryZ);
            }
        }
    }
    if (trajectoryPositions !== null) {
        trajectoryPositions.needsUpdate = true;
    }
}
function animate() {
    time += settings.dt;
    computeForces(particles, settings.particleCount, isVisible(document.querySelector('#hud')));
    const arrowScaleForForces = rescaleForceScaleBar(particles);
    const arrowScaleForVelocities = rescaleVelocityScaleBar(particles);
    for (let i = 0; i < settings.particleCount; i++) {
        animateOneParticle(i, arrowScaleForForces, arrowScaleForVelocities);
    }
    if (settings.if_showTrajectory &&
        time - lastSnapshotTime > settings.dt) {
        lastSnapshotTime = time;
    }
    if (settings.if_ReferenceFrame_movesWithSun) {
        particles.forEach(i => i.position.sub(particles[0].position));
    }
    // =============================== now the rendering ==================================
    // flag to the particle system that we've changed its vertices.
    if (particleSystem) {
        particleSystem.geometry.attributes.position.needsUpdate = true;
    }
    // draw this frame
    statistics(temperaturePanel, maxTemperature);
    update();
    render(renderer, effect);
    // set up the next call
    if (settings.ifRun) {
        requestAnimationFrame(animate);
    }
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
    // resize();
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
    document.onkeydown = (e) => {
        switch (e.keyCode) {
            case 9:
                toggle('#hud');
                break;
        }
    };
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
