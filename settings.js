const _spaceBoundary = 5;

const originalSpaceBoundaryX = _spaceBoundary;
const originalSpaceBoundaryY = _spaceBoundary;
const originalSpaceBoundaryZ = _spaceBoundary;

const dt = 0.01;
const settings = {
  // ===============options and settings:
  particleCount: 8,
  maxTrajectoryLength: 200,
  unitArrowLength: 0.1,
  maxArrowLength: 2,
  spaceBoundaryX: originalSpaceBoundaryX,
  spaceBoundaryY: originalSpaceBoundaryY,
  spaceBoundaryZ: originalSpaceBoundaryZ,
  cutoffDistance: _spaceBoundary * 2,
  availableCharges: [-3, -2, -1, 0, 1, 2, 3],
  d_min: 0,
  dt: dt,
  sunMass: 500,
  targetTemperature: 100,
  escapeSpeed: _spaceBoundary * 2,
  // toggles for Plotting:
  if_use_periodic_boundary_condition: true,
  if_override_particleCount_setting_with_lastState: true,
  if_apply_LJpotential: true,
  if_apply_gravitation: true,
  if_apply_coulombForce: true,
  if_ReferenceFrame_movesWithSun: true,
  if_makeSun: true,
  if_showUniverseBoundary: true,
  if_showTrajectory: true,
  if_showArrows: true,
  if_showMapscale: true,
  if_useFog: false,
  if_proportionate_arrows_with_vectors: true,
  if_limitArrowsMaxLength: true,
  if_constant_temperature: false,
  // physical constants -- be the god!
  EPSILON: 1,
  DELTA: 0.02,
  G: 0.08,
  K: 0.1,
  kB: 6.02,
};
function initializeGuiControls(settings) {
  // Enable the GUI Controls powered by "dat.gui.min.js":
  const gui = new dat.GUI();

  const guiFolderWorld = gui.addFolder("World building");

  guiFolderWorld.add(settings, "if_constant_temperature").name("Constant T");
  guiFolderWorld.add(settings, "targetTemperature").name("Target temp.");

  const guiFolderParameters = guiFolderWorld.addFolder("Parameters"); // toggles for parameters:
  guiFolderParameters.add(settings, "particleCount");
  guiFolderParameters.add(settings, "dt");

  const guiFolderConstants = guiFolderWorld.addFolder("Physical Constants"); // physical constants -- be the god!
  guiFolderConstants.add(settings, "EPSILON");
  guiFolderConstants.add(settings, "DELTA");
  guiFolderConstants.add(settings, "G");
  guiFolderConstants.add(settings, "K");

  const guiFolderBoundary = guiFolderWorld.addFolder("Universe boundary");
  guiFolderBoundary.add(settings, "if_showUniverseBoundary");
  guiFolderBoundary
    .add(settings, "if_use_periodic_boundary_condition")
    .name("Use PBC")
    .onChange(function (value) {
      particleMaterialForClones.visible = value;
    });
  const guiFolderSize = guiFolderBoundary.addFolder("Custom size");
  guiFolderSize
    .add(settings, "spaceBoundaryX")
    .name("Size, X")
    .onChange(function (value) {
      if (boxMesh) boxMesh.scale.x = spaceBoundaryX / originalSpaceBoundaryX;
      updateClonesPositions(
        spaceBoundaryX,
        spaceBoundaryY,
        spaceBoundaryZ,
        group
      );
    });
  guiFolderSize
    .add(settings, "spaceBoundaryY")
    .name("Size, Y")
    .onChange(function (value) {
      if (boxMesh) boxMesh.scale.y = spaceBoundaryY / originalSpaceBoundaryY;
      updateClonesPositions(
        spaceBoundaryX,
        spaceBoundaryY,
        spaceBoundaryZ,
        group
      );
    });
  guiFolderSize
    .add(settings, "spaceBoundaryZ")
    .name("Size, Z")
    .onChange(function (value) {
      if (boxMesh) boxMesh.scale.z = spaceBoundaryZ / originalSpaceBoundaryZ;
      updateClonesPositions(
        spaceBoundaryX,
        spaceBoundaryY,
        spaceBoundaryZ,
        group
      );
    });

  const guiFolderForces = guiFolderWorld.addFolder("Forcefields to apply");
  guiFolderForces.add(settings, "if_apply_LJpotential").name("LJ potential");
  guiFolderForces.add(settings, "if_apply_gravitation").name("Gravitation");
  guiFolderForces.add(settings, "if_apply_coulombForce").name("Coulomb Force");

  guiFolderWorld.open();

  const guiFolderPlotting = gui.addFolder("Plotting"); // toggles for Plotting:
  // guiFolderPlotting.add(settings, "if_override_particleCount_setting_with_lastState").name("");
  guiFolderPlotting
    .add(settings, "if_ReferenceFrame_movesWithSun")
    .name("Center the sun");

  // guiFolderPlotting.add(settings, "if_makeSun");
  // guiFolderPlotting.add(settings, "if_useFog");

  const guiFolderTrajectories = guiFolderPlotting.addFolder(
    "Particle trajectories"
  );
  guiFolderTrajectories.add(settings, "if_showTrajectory").name("Trace");
  guiFolderTrajectories
    .add(settings, "maxTrajectoryLength")
    .name("Length")
    .onChange(function (value) {}); // TODO

  const guiFolderArrows = guiFolderPlotting.addFolder(
    "Arrows for forces and velocities"
  );
  guiFolderArrows
    .add(settings, "if_showArrows")
    .name("Show arrows")
    .onChange(function (value) {
      _.each(arrowForces, function (a) {
        a.visible = value;
      });
      _.each(arrowVelocities, function (a) {
        a.visible = value;
      });
    });
  guiFolderArrows.add(settings, "if_limitArrowsMaxLength").name("Limit length");
  guiFolderArrows.add(settings, "maxArrowLength").name("Max length");
  guiFolderArrows.add(settings, "unitArrowLength").name("Unit length");
  guiFolderArrows
    .add(settings, "if_showMapscale")
    .name("Show scales")
    .onChange(function (value) {
      $(".mapscale").toggle();
    });
  guiFolderArrows
    .add(settings, "if_proportionate_arrows_with_vectors")
    .name("Proportionate arrows with vectors");

  guiFolderPlotting.open();

  const guiFolderCommands = gui.addFolder("Commands"); // controls, buttons
  //guiFolderCommands.add(settings, "clearState").name("New world");
  //guiFolderCommands.add(settings, "dump").name("Dump");
  //guiFolderCommands.add(settings, "stop").name("Halt");
  guiFolderCommands.open();
  //gui.add(settings, "toggleHUD").name("Show Detail HUD");

  gui.remember(this);
  gui.close();
}

export { settings, initializeGuiControls };
