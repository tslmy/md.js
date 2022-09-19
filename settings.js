const _spaceBoundary = 5

const originalSpaceBoundaryX = _spaceBoundary
const originalSpaceBoundaryY = _spaceBoundary
const originalSpaceBoundaryZ = _spaceBoundary

const dt = 0.01
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
  dt,
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
  ifRun: true,
  // physical constants -- be the god!
  EPSILON: 1,
  DELTA: 0.02,
  G: 0.08,
  K: 0.1,
  kB: 6.02
}

export {
  settings,
  originalSpaceBoundaryX,
  originalSpaceBoundaryY,
  originalSpaceBoundaryZ
}
