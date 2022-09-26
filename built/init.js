import * as THREE from 'three';
import { OrbitControls } from 'OrbitControls';
import { DeviceOrientationControls } from 'DeviceOrientationControls';
import Stats from 'Stats';
import { StereoEffect } from 'StereoEffect';
import { originalSpaceBoundaryX, originalSpaceBoundaryY, originalSpaceBoundaryZ } from './settings.js';
import { drawBox } from './drawingHelpers.js';
import { saveState, clearState } from './stateStorage.js';
import * as dat from 'dat.gui';
import { createParticleSystem, particleMaterialForClones } from './particleSystem.js';
const ifMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
function fullscreen() {
    if (document.body.requestFullscreen) {
        document.body.requestFullscreen();
    }
    else if (document.body.msRequestFullscreen) {
        document.body.msRequestFullscreen();
    }
    else if (document.body.mozRequestFullScreen) {
        document.body.mozRequestFullScreen();
    }
    else if (document.body.webkitRequestFullscreen) {
        document.body.webkitRequestFullscreen();
    }
}
let effect;
function init(settings, particles, time, lastSnapshotTime) {
    // initialize the scene
    const scene = new THREE.Scene();
    //    configure the scene:
    if (settings.if_useFog) {
        scene.fog = new THREE.Fog(0xffffff, 0, 20);
    }
    //    define objects:
    let boxMesh = null;
    if (settings.if_showUniverseBoundary) {
        boxMesh = drawBox(settings.spaceBoundaryX, settings.spaceBoundaryY, settings.spaceBoundaryZ, scene);
    }
    const group = new THREE.Object3D();
    const particleSystem = createParticleSystem(group, particles, scene, time, lastSnapshotTime, settings);
    const particlesGeometry = particleSystem.geometry;
    scene.add(group);
    console.log(particles);
    // enable settings
    initializeGuiControls(settings, group);
    // initialize the camera
    const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 1, 1000000);
    camera.position.set(0, 2, 10);
    scene.add(camera);
    // initialize renderer
    const renderer = new THREE.WebGLRenderer({
        alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(4); // enhance resolution
    if (ifMobileDevice) {
        effect = new StereoEffect(renderer);
    }
    const element = renderer.domElement;
    document.body.appendChild(element);
    // activate plugins:
    const controls = new OrbitControls(camera, element); // this is for non-VR devices
    function setOrientationControls(e) {
        if (!e.alpha) {
            return;
        }
        const controls = new DeviceOrientationControls(camera, true);
        controls.connect();
        controls.update();
        element.addEventListener('click', fullscreen, false);
        window.removeEventListener('deviceorientation', setOrientationControls, true);
    }
    window.addEventListener('deviceorientation', setOrientationControls, true);
    // add stat
    const stats = new Stats();
    const temperaturePanel = stats.addPanel(new Stats.Panel('Temp.', '#ff8', '#221'));
    stats.showPanel(2);
    document.body.append(stats.domElement);
    // add event listeners
    window.addEventListener('resize', () => { resize(camera, effect, renderer); }, false);
    setTimeout(() => { resize(camera, effect, renderer); }, 1);
    window.onbeforeunload = () => {
        saveState({
            particleCount: settings.particleCount,
            time,
            lastSnapshotTime
        });
    };
    return [scene, particleSystem, camera, renderer, controls, stats, temperaturePanel];
}
function updateClonesPositions(spaceBoundaryX, spaceBoundaryY, spaceBoundaryZ, group) {
    const clonePositions = makeClonePositionsList(spaceBoundaryX, spaceBoundaryY, spaceBoundaryZ);
    for (let i = 0; i < 26; i++) {
        group.children[i + 1].position.set(clonePositions[i][0], clonePositions[i][1], clonePositions[i][2]);
    }
}
function resize(camera, effect, renderer) {
    const width = document.body.offsetWidth;
    const height = document.body.offsetHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    if (ifMobileDevice)
        effect.setSize(width, height);
}
function initializeGuiControls(settings, group) {
    // Enable the GUI Controls powered by "dat.gui.min.js":
    const gui = new dat.GUI();
    const guiFolderWorld = gui.addFolder('World building');
    guiFolderWorld.add(settings, 'if_constant_temperature').name('Constant T');
    guiFolderWorld.add(settings, 'targetTemperature').name('Target temp.');
    const guiFolderParameters = guiFolderWorld.addFolder('Parameters'); // toggles for parameters:
    guiFolderParameters.add(settings, 'particleCount');
    guiFolderParameters.add(settings, 'dt');
    const guiFolderConstants = guiFolderWorld.addFolder('Physical Constants'); // physical constants -- be the god!
    guiFolderConstants.add(settings, 'EPSILON');
    guiFolderConstants.add(settings, 'DELTA');
    guiFolderConstants.add(settings, 'G');
    guiFolderConstants.add(settings, 'K');
    const guiFolderBoundary = guiFolderWorld.addFolder('Universe boundary');
    guiFolderBoundary.add(settings, 'if_showUniverseBoundary');
    guiFolderBoundary
        .add(settings, 'if_use_periodic_boundary_condition')
        .name('Use PBC')
        .onChange((value) => {
        particleMaterialForClones.visible = value;
    });
    const guiFolderSize = guiFolderBoundary.addFolder('Custom size');
    guiFolderSize
        .add(settings, 'spaceBoundaryX')
        .name('Size, X')
        .onChange(function (value) {
        if (boxMesh) {
            boxMesh.scale.x = settings.spaceBoundaryX / originalSpaceBoundaryX;
        }
        updateClonesPositions(settings.spaceBoundaryX, settings.spaceBoundaryY, settings.spaceBoundaryZ, group);
    });
    guiFolderSize
        .add(settings, 'spaceBoundaryY')
        .name('Size, Y')
        .onChange(function (value) {
        if (boxMesh) {
            boxMesh.scale.y = settings.spaceBoundaryY / originalSpaceBoundaryY;
        }
        updateClonesPositions(settings.spaceBoundaryX, settings.spaceBoundaryY, settings.spaceBoundaryZ, group);
    });
    guiFolderSize
        .add(settings, 'spaceBoundaryZ')
        .name('Size, Z')
        .onChange(function (value) {
        if (boxMesh) {
            boxMesh.scale.z = settings.spaceBoundaryZ / originalSpaceBoundaryZ;
        }
        updateClonesPositions(settings.spaceBoundaryX, settings.spaceBoundaryY, settings.spaceBoundaryZ, group);
    });
    const guiFolderForces = guiFolderWorld.addFolder('Forcefields to apply');
    guiFolderForces.add(settings, 'if_apply_LJpotential').name('LJ potential');
    guiFolderForces.add(settings, 'if_apply_gravitation').name('Gravitation');
    guiFolderForces.add(settings, 'if_apply_coulombForce').name('Coulomb Force');
    guiFolderWorld.open();
    const guiFolderPlotting = gui.addFolder('Plotting'); // toggles for Plotting:
    // guiFolderPlotting.add(settings, "if_override_particleCount_setting_with_lastState").name("");
    guiFolderPlotting
        .add(settings, 'if_ReferenceFrame_movesWithSun')
        .name('Center the sun');
    // guiFolderPlotting.add(settings, "if_makeSun");
    // guiFolderPlotting.add(settings, "if_useFog");
    const guiFolderTrajectories = guiFolderPlotting.addFolder('Particle trajectories');
    guiFolderTrajectories.add(settings, 'if_showTrajectory').name('Trace');
    guiFolderTrajectories
        .add(settings, 'maxTrajectoryLength')
        .name('Length')
        .onChange(function (value) { }); // TODO
    const guiFolderArrows = guiFolderPlotting.addFolder('Arrows for forces and velocities');
    guiFolderArrows
        .add(settings, 'if_showArrows')
        .name('Show arrows')
        .onChange(function (value) {
        arrowForces.forEach(a => a.visible = value);
        arrowVelocities.forEach(a => a.visible = value);
    });
    guiFolderArrows.add(settings, 'if_limitArrowsMaxLength').name('Limit length');
    guiFolderArrows.add(settings, 'maxArrowLength').name('Max length');
    guiFolderArrows.add(settings, 'unitArrowLength').name('Unit length');
    guiFolderArrows
        .add(settings, 'if_showMapscale')
        .name('Show scales')
        .onChange(function (value) {
        $('.mapscale').toggle();
    });
    guiFolderArrows
        .add(settings, 'if_proportionate_arrows_with_vectors')
        .name('Proportionate arrows with vectors');
    guiFolderPlotting.open();
    const guiFolderCommands = gui.addFolder('Commands'); // controls, buttons
    guiFolderCommands.add(commands, 'clearState').name('New world');
    guiFolderCommands.add(commands, 'stop').name('Halt');
    gui.add(commands, 'toggleHUD').name('Show Detail HUD');
    guiFolderCommands.open();
    gui.remember(this);
    gui.close();
}
const commands = {
    stop: () => {
        settings.ifRun = false;
    },
    toggleHUD: function () {
        $('#hud').toggle();
    },
    clearState
};
export { init, ifMobileDevice };
