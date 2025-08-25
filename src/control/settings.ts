const _spaceBoundary = 5

const originalSpaceBoundaryX = _spaceBoundary
const originalSpaceBoundaryY = _spaceBoundary
const originalSpaceBoundaryZ = _spaceBoundary

const dt = 0.01
/**
 * Mutable runtime settings (UI tweaks these directly).
 * This object intentionally remains permissive; engine config is derived and validated separately.
 */
const settings = {
  // ===============options and settings:
  /** Total number of particles including optional sun. */
  particleCount: 20,
  /** Max points stored per trajectory ring buffer. */
  maxTrajectoryLength: 200,
  /** Normalization length used to scale force/velocity arrows each frame. */
  unitArrowLength: 0.1,
  /** Cap for arrow length when limiting is enabled. */
  maxArrowLength: 2,
  spaceBoundaryX: originalSpaceBoundaryX,
  spaceBoundaryY: originalSpaceBoundaryY,
  spaceBoundaryZ: originalSpaceBoundaryZ,
  /** Distance cutoff (world units) for pair interactions. */
  cutoffDistance: _spaceBoundary * 2,
  massLowerBound: 16,
  massUpperBound: 20,
  availableCharges: [-3, -2, -1, 0, 1, 2, 3],
  dt,
  sunMass: 500,
  targetTemperature: 100,
  // (removed unused d_min, escapeSpeed)
  // toggles for Plotting:
  /** Enable periodic boundary condition wrapping (and ghost render clones). */
  if_use_periodic_boundary_condition: true,
  // (removed if_override_particleCount_setting_with_lastState)
  if_apply_LJpotential: true,
  if_apply_gravitation: true,
  if_apply_coulombForce: true,
  // Advanced algorithm selections (experimental)
  integrator: 'velocityVerlet' as 'velocityVerlet' | 'euler',
  neighborStrategy: 'cell' as 'naive' | 'cell',
  // referenceFrameMode: 'fixed' | 'sun' | 'com'
  referenceFrameMode: 'sun',
  if_makeSun: true,
  if_showUniverseBoundary: true,
  if_showTrajectory: true,
  if_showArrows: true,
  if_showMapscale: true,
  if_useFog: false,
  if_limitArrowsMaxLength: true,
  if_constant_temperature: false,
  // (removed unused flags: if_proportionate_arrows_with_vectors, ifRun)
  // physical constants -- be the god!
  EPSILON: 1,
  DELTA: 0.02,
  G: 0.08,
  K: 0.1,
  kB: 6.02,
  // Ewald parameters (optional; auto if left undefined). Tweaks performance / accuracy of Coulomb & Gravity under PBC.
  ewaldAlpha: undefined as number | undefined,
  ewaldKMax: undefined as number | undefined
}

// Deep clone baseline defaults for reset.
const _defaultSettings = JSON.parse(JSON.stringify(settings)) as typeof settings

/** Reset all mutable settings back to their original default values. */
function resetSettingsToDefaults(): void {
  const fresh = JSON.parse(JSON.stringify(_defaultSettings)) as typeof settings
  Object.assign(settings, fresh)
}

/** Get a deep-cloned snapshot of the original default settings. */
function getDefaultSettingsSnapshot(): typeof settings {
  return JSON.parse(JSON.stringify(_defaultSettings)) as typeof settings
}

export {
  settings,
  originalSpaceBoundaryX,
  originalSpaceBoundaryY,
  originalSpaceBoundaryZ,
  resetSettingsToDefaults,
  getDefaultSettingsSnapshot
}
