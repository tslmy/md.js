const _spaceBoundary = 5;
const originalSpaceBoundaryX = _spaceBoundary;
const originalSpaceBoundaryY = _spaceBoundary;
const originalSpaceBoundaryZ = _spaceBoundary;
const dt = 0.01;
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
    d_min: 0,
    dt,
    sunMass: 500,
    targetTemperature: 100,
    escapeSpeed: _spaceBoundary * 2,
    // toggles for Plotting:
    /** Enable periodic boundary condition wrapping (and ghost render clones). */
    if_use_periodic_boundary_condition: true,
    if_override_particleCount_setting_with_lastState: true,
    if_apply_LJpotential: true,
    if_apply_gravitation: true,
    if_apply_coulombForce: true,
    // referenceFrameMode: 'fixed' | 'sun' | 'com'
    referenceFrameMode: 'sun',
    if_makeSun: true,
    if_showUniverseBoundary: true,
    if_showTrajectory: true,
    if_showArrows: true,
    if_showMapscale: true,
    if_useFog: true,
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
};
export { settings, originalSpaceBoundaryX, originalSpaceBoundaryY, originalSpaceBoundaryZ };
//# sourceMappingURL=settings.js.map