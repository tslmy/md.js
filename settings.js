// ===============options and settings:
const particleCount = 8;
const maxTrajectoryLength = 200;
const unitArrowLength = .1;
const maxArrowLength = 2;
const _spaceBoundary = 5;
const originalSpaceBoundaryX = _spaceBoundary;
const originalSpaceBoundaryY = _spaceBoundary;
const originalSpaceBoundaryZ = _spaceBoundary;
const spaceBoundaryX = originalSpaceBoundaryX;
const spaceBoundaryY = originalSpaceBoundaryY;
const spaceBoundaryZ = originalSpaceBoundaryZ;
const cutoffDistance = _spaceBoundary*2;
const dt = 0.01;
const availableCharges = [-3, -2, -1, 0, 1, 2, 3];
const d_min = 0;
const sunMass = 500;
const targetTemperature = 100;
const escapeSpeed = _spaceBoundary*2;
// toggles for Plotting:
const if_use_periodic_boundary_condition = true;
const if_override_particleCount_setting_with_lastState = true;
const if_apply_LJpotential = true;
const if_apply_gravitation = true;
const if_apply_coulombForce = true;
const if_ReferenceFrame_movesWithSun = true;
const if_makeSun = true;
const if_showUniverseBoundary = true;
const if_showTrajectory = true;
const if_showArrows = true;
const if_showMapscale = true;
const if_useFog = false;
const if_proportionate_arrows_with_vectors = true;
const if_limitArrowsMaxLength = true;
const if_constant_temperature = false;
// physical constants -- be the god!
const EPSILON = 1;
const DELTA = 0.02;
const G = 0.08;
const K = 0.1;
const kB = 6.02;
function initializeGuiControls() {
  // Enable the GUI Controls powered by "dat.gui.min.js":
  const gui = new dat.GUI();

    	const guiFolderWorld = gui.addFolder('World building');

  guiFolderWorld.add(this, 'if_constant_temperature').name('Constant T');
  guiFolderWorld.add(this, 'targetTemperature').name('Target temp.');

	        const guiFolderParameters = guiFolderWorld.addFolder('Parameters'); // toggles for parameters:
	            guiFolderParameters.add(this, 'particleCount');
	            guiFolderParameters.add(this, 'dt');

	        const guiFolderConstants = guiFolderWorld.addFolder('Physical Constants');// physical constants -- be the god!
	            guiFolderConstants.add(this, 'EPSILON');
	            guiFolderConstants.add(this, 'DELTA');
	            guiFolderConstants.add(this, 'G');
	            guiFolderConstants.add(this, 'K');

  const guiFolderBoundary = guiFolderWorld.addFolder('Universe boundary');
  guiFolderBoundary.add(this, 'if_showUniverseBoundary');
  guiFolderBoundary.add(this, 'if_use_periodic_boundary_condition').name('Use PBC').onChange(function(value) {
    particleMaterialForClones.visible = value;
  });
	            const guiFolderSize = guiFolderBoundary.addFolder('Custom size');
	                guiFolderSize.add(this, 'spaceBoundaryX').name('Size, X').onChange(function(value) {
    if (boxMesh) boxMesh.scale.x = spaceBoundaryX / originalSpaceBoundaryX; updateClonesPositions();
  });
	                guiFolderSize.add(this, 'spaceBoundaryY').name('Size, Y').onChange(function(value) {
    if (boxMesh) boxMesh.scale.y = spaceBoundaryY / originalSpaceBoundaryY; updateClonesPositions();
  });
	                guiFolderSize.add(this, 'spaceBoundaryZ').name('Size, Z').onChange(function(value) {
    if (boxMesh) boxMesh.scale.z = spaceBoundaryZ / originalSpaceBoundaryZ; updateClonesPositions();
  });

  const guiFolderForces = guiFolderWorld.addFolder('Forcefields to apply');
  guiFolderForces.add(this, 'if_apply_LJpotential').name('LJ potential');
  guiFolderForces.add(this, 'if_apply_gravitation').name('Gravitation');
  guiFolderForces.add(this, 'if_apply_coulombForce').name('Coulomb Force');

        	guiFolderWorld.open();

  const guiFolderPlotting = gui.addFolder('Plotting'); // toggles for Plotting:
  // guiFolderPlotting.add(this, "if_override_particleCount_setting_with_lastState").name("");
  guiFolderPlotting.add(this, 'if_ReferenceFrame_movesWithSun').name('Center the sun');

  // guiFolderPlotting.add(this, "if_makeSun");
  // guiFolderPlotting.add(this, "if_useFog");

  const guiFolderTrajectories = guiFolderPlotting.addFolder('Particle trajectories');
            	guiFolderTrajectories.add(this, 'if_showTrajectory').name('Trace');
	        	guiFolderTrajectories.add(this, 'maxTrajectoryLength').name('Length').onChange(function(value) {}); // TODO

  const guiFolderArrows = guiFolderPlotting.addFolder('Arrows for forces and velocities');
  guiFolderArrows.add(this, 'if_showArrows').name('Show arrows').onChange(function(value) {
                	_.each(arrowForces, function(a) {
      a.visible=value;
    });
                	_.each(arrowVelocities, function(a) {
      a.visible=value;
    });
  });
  guiFolderArrows.add(this, 'if_limitArrowsMaxLength').name('Limit length');
  guiFolderArrows.add(this, 'maxArrowLength').name('Max length');
  guiFolderArrows.add(this, 'unitArrowLength').name('Unit length');
  guiFolderArrows.add(this, 'if_showMapscale').name('Show scales').onChange(function(value) {
    $('.mapscale').toggle();
  });
  guiFolderArrows.add(this, 'if_proportionate_arrows_with_vectors').name('Proportionate arrows with vectors');

  guiFolderPlotting.open();

  const guiFolderCommands = gui.addFolder('Commands');// controls, buttons
  guiFolderCommands.add(this, 'clearState').name('New world');
  guiFolderCommands.add(this, 'dump').name('Dump');
  guiFolderCommands.add(this, 'stop').name('Halt');
  guiFolderCommands.open();
  gui.add(this, 'toggleHUD').name('Show Detail HUD');

  gui.remember(this);
  gui.close();
}
