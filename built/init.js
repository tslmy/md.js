import * as THREE from 'three';
import { OrbitControls } from 'OrbitControls';
import { DeviceOrientationControls } from 'DeviceOrientationControls';
import Stats from 'Stats';
import { StereoEffect } from 'StereoEffect';
import { originalSpaceBoundaryX, originalSpaceBoundaryY, originalSpaceBoundaryZ } from './settings.js';
import { drawBox } from './drawingHelpers.js';
import { clearState } from './stateStorage.js';
import { makeClonePositionsList, createParticleSystem, particleMaterialForClones } from './particleSystem.js';
import * as dat from 'dat.gui';
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
function init(settings, particles, time, lastSnapshotTime, simState) {
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
    const particleSystem = createParticleSystem(group, particles, scene, time, lastSnapshotTime, settings, simState);
    console.log("3D object 'group' created: ", group);
    scene.add(group);
    console.log(particles);
    // enable settings
    initializeGuiControls(settings, group, boxMesh);
    // initialize the camera
    const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 1, 1000000);
    camera.position.set(0, 2, 10);
    scene.add(camera);
    // initialize renderer
    const renderer = new THREE.WebGLRenderer({
        alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    let effect;
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
    // State persistence handled in TypeScript (script.ts) to include full particle data.
    return [scene, particleSystem, camera, renderer, controls, stats, temperaturePanel, effect];
}
function updateClonesPositions(spaceBoundaryX, spaceBoundaryY, spaceBoundaryZ, group) {
    const clonePositions = makeClonePositionsList(spaceBoundaryX, spaceBoundaryY, spaceBoundaryZ);
    for (let i = 0; i < 26; i++) {
        group.children[i + 1].position.set(clonePositions[i].x, clonePositions[i].y, clonePositions[i].z);
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
function initializeGuiControls(settings, group, boxMesh) {
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
        .onChange(() => {
        particleMaterialForClones.visible = settings.if_use_periodic_boundary_condition;
    });
    const guiFolderSize = guiFolderBoundary.addFolder('Custom size');
    guiFolderSize
        .add(settings, 'spaceBoundaryX')
        .name('Size, X')
        .onChange(function () {
        if (boxMesh) {
            boxMesh.scale.x = settings.spaceBoundaryX / originalSpaceBoundaryX;
        }
        updateClonesPositions(settings.spaceBoundaryX, settings.spaceBoundaryY, settings.spaceBoundaryZ, group);
    });
    guiFolderSize
        .add(settings, 'spaceBoundaryY')
        .name('Size, Y')
        .onChange(function () {
        if (boxMesh) {
            boxMesh.scale.y = settings.spaceBoundaryY / originalSpaceBoundaryY;
        }
        updateClonesPositions(settings.spaceBoundaryX, settings.spaceBoundaryY, settings.spaceBoundaryZ, group);
    });
    guiFolderSize
        .add(settings, 'spaceBoundaryZ')
        .name('Size, Z')
        .onChange(function () {
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
    const guiFolderTrajectories = guiFolderPlotting.addFolder('Particle trajectories');
    guiFolderTrajectories.add(settings, 'if_showTrajectory').name('Trace');
    guiFolderTrajectories
        .add(settings, 'maxTrajectoryLength')
        .name('Length')
        .onChange(function () { });
    const guiFolderArrows = guiFolderPlotting.addFolder('Arrows for forces and velocities');
    guiFolderArrows
        .add(settings, 'if_showArrows')
        .name('Show arrows')
        .onChange(function () {
        // Visibility now managed by instanced arrow system (updated in script.ts)
    });
    guiFolderArrows.add(settings, 'if_limitArrowsMaxLength').name('Limit length');
    guiFolderArrows.add(settings, 'maxArrowLength').name('Max length');
    guiFolderArrows.add(settings, 'arrowMagnitudeMultiplier', 0.1, 20, 0.1).name('Mag multiplier');
    guiFolderArrows.add(settings, 'unitArrowLength').name('Unit length');
    guiFolderArrows
        .add(settings, 'if_showMapscale')
        .name('Show scales')
        .onChange(() => { toggle('.mapscale'); });
    guiFolderArrows
        .add(settings, 'if_proportionate_arrows_with_vectors')
        .name('Proportionate arrows with vectors');
    const guiFolderRenderMode = guiFolderPlotting.addFolder('Render mode');
    guiFolderRenderMode.add(settings, 'if_renderSpheres').name('Use spheres');
    guiFolderRenderMode.add(settings, 'sphereBaseRadius', 0.01, 1, 0.01).name('Sphere radius');
    guiFolderPlotting.open();
    const commands = {
        stop: () => {
            settings.ifRun = false;
        },
        toggleHUD: () => {
            toggle('#hud');
        },
        clearState
    };
    const guiFolderCommands = gui.addFolder('Commands'); // controls, buttons
    guiFolderCommands.add(commands, 'clearState').name('New world');
    guiFolderCommands.add(commands, 'stop').name('Halt');
    gui.add(commands, 'toggleHUD').name('Show Detail HUD');
    guiFolderCommands.open();
    gui.remember(this);
    gui.close();
}
function toggle(selector) {
    const element = document.querySelector(selector);
    if (element.style.display === 'none') {
        element.style.display = 'block';
    }
    else {
        element.style.display = 'none';
    }
}
export { init, ifMobileDevice, toggle };
//# sourceMappingURL=init.js.map
