// ===============options and settings:
var particleCount = 8;
var maxTrajectoryLength = 200;
var unitArrowLength = .1;
var maxArrowLength = 2;
var _spaceBoundary = 5;
var originalSpaceBoundaryX = _spaceBoundary;
var originalSpaceBoundaryY = _spaceBoundary;
var originalSpaceBoundaryZ = _spaceBoundary;
var spaceBoundaryX = originalSpaceBoundaryX;
var spaceBoundaryY = originalSpaceBoundaryY;
var spaceBoundaryZ = originalSpaceBoundaryZ;
var cutoffDistance = _spaceBoundary*2;
var dt = 0.01;
var availableCharges = [-3, -2, -1, 0, 1, 2, 3];
var d_min = 0;
var sunMass = 500;
var targetTemperature = 100;
var escapeSpeed = _spaceBoundary*2;
// toggles for Plotting:
var if_use_periodic_boundary_condition = true;
var if_override_particleCount_setting_with_lastState = true;
var if_apply_LJpotential = true;
var if_apply_gravitation = true;
var if_apply_coulombForce = true;
var if_ReferenceFrame_movesWithSun = true;
var if_makeSun = true;
var if_showUniverseBoundary = true;
var if_showTrajectory = true;
var if_showArrows = true;
var if_showMapscale = true;
var if_useFog = false;
var if_proportionate_arrows_with_vectors = true;
var if_limitArrowsMaxLength = true;
var if_constant_temperature = false;
// physical constants -- be the god!
var EPSILON = 1;
var DELTA = 0.02;
var G = 0.08;
var K = 0.1;
var kB = 6.02;
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
