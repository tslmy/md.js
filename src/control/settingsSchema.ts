/** Unified settings schema to dedupe defaults, GUI metadata, and engine binding. */
export type SettingDescriptor = {
    key: string
    default: unknown
    /** High-level grouping for GUI. */
    group: 'world' | 'runtime' | 'forces' | 'constants' | 'boundary' | 'ewald' | 'visual' | 'arrows' | 'trajectories' | 'ui' | 'advanced'
    /** Optional EngineConfig dot path. */
    enginePath?: string
    /** Participate in auto push to engine. */
    auto?: boolean
    /** GUI metadata. */
    control?: {
        type?: 'number' | 'boolean' | 'select'
        /** Display label override. */
        label?: string
        /** Select options (value -> label). */
        options?: Record<string, string>
        min?: number; max?: number; step?: number
    }
}

// Central list. Adding a new setting: append descriptor here only.
export const SETTINGS_SCHEMA: SettingDescriptor[] = [
    { key: 'particleCount', default: 20 as const, group: 'world', enginePath: 'world.particleCount', auto: true, control: { type: 'number' } },
    { key: 'maxTrajectoryLength', default: 200 as const, group: 'trajectories', control: { type: 'number', label: 'Length' } },
    { key: 'unitArrowLength', default: 0.1 as const, group: 'arrows', control: { type: 'number', label: 'Unit length', step: 0.01 } },
    { key: 'maxArrowLength', default: 2 as const, group: 'arrows', control: { type: 'number', label: 'Max length', step: 0.1 } },
    { key: 'spaceBoundaryX', default: 5 as const, group: 'boundary', enginePath: 'world.box.x', auto: true },
    { key: 'spaceBoundaryY', default: 5 as const, group: 'boundary', enginePath: 'world.box.y', auto: true },
    { key: 'spaceBoundaryZ', default: 5 as const, group: 'boundary', enginePath: 'world.box.z', auto: true },
    { key: 'cutoffDistance', default: 10 as const, group: 'runtime', enginePath: 'runtime.cutoff', auto: true, control: { type: 'number', label: 'Cutoff' } },
    { key: 'massLowerBound', default: 16 as const, group: 'world' },
    { key: 'massUpperBound', default: 20 as const, group: 'world' },
    { key: 'availableCharges', default: [-3, -2, -1, 0, 1, 2, 3] as const, group: 'world' },
    { key: 'dt', default: 0.01 as const, group: 'runtime', enginePath: 'runtime.dt', auto: true, control: { type: 'number' } },
    { key: 'sunMass', default: 500 as const, group: 'world' },
    { key: 'targetTemperature', default: 100 as const, group: 'runtime', control: { type: 'number', label: 'Target temp.' } },
    { key: 'if_use_periodic_boundary_condition', default: true as const, group: 'boundary', enginePath: 'runtime.pbc', auto: true, control: { type: 'boolean', label: 'Use PBC' } },
    { key: 'if_apply_LJpotential', default: true as const, group: 'forces', enginePath: 'forces.lennardJones', auto: true, control: { type: 'boolean', label: 'LJ potential' } },
    { key: 'if_apply_gravitation', default: true as const, group: 'forces', enginePath: 'forces.gravity', auto: true, control: { type: 'boolean', label: 'Gravitation' } },
    { key: 'if_apply_coulombForce', default: true as const, group: 'forces', enginePath: 'forces.coulomb', auto: true, control: { type: 'boolean', label: 'Coulomb Force' } },
    { key: 'integrator', default: 'velocityVerlet' as const, group: 'advanced', enginePath: 'runtime.integrator', auto: true, control: { type: 'select', options: { velocityVerlet: 'Velocity Verlet', euler: 'Euler' }, label: 'Integrator' } },
    { key: 'neighborStrategy', default: 'cell' as const, group: 'advanced', enginePath: 'neighbor.strategy', auto: true, control: { type: 'select', options: { cell: 'Cell', naive: 'Naive' }, label: 'Neighbor list' } },
    { key: 'referenceFrameMode', default: 'sun' as const, group: 'visual', control: { type: 'select', options: { fixed: 'Fixed', sun: 'Sun', com: 'Center of Mass' }, label: 'Reference frame' } },
    { key: 'if_makeSun', default: true as const, group: 'world' },
    { key: 'if_showUniverseBoundary', default: true as const, group: 'visual', control: { type: 'boolean', label: 'Show universe boundary' } },
    { key: 'if_showTrajectory', default: true as const, group: 'trajectories', control: { type: 'boolean', label: 'Trace' } },
    { key: 'if_showArrows', default: true as const, group: 'arrows', control: { type: 'boolean', label: 'Show arrows' } },
    { key: 'if_showMapscale', default: true as const, group: 'arrows', control: { type: 'boolean', label: 'Show scales' } },
    { key: 'if_useFog', default: false as const, group: 'visual' },
    { key: 'if_limitArrowsMaxLength', default: true as const, group: 'arrows', control: { type: 'boolean', label: 'Limit length' } },
    { key: 'if_constant_temperature', default: false as const, group: 'runtime', control: { type: 'boolean', label: 'Constant T' } },
    { key: 'EPSILON', default: 1 as const, group: 'constants', enginePath: 'constants.epsilon', auto: true },
    { key: 'DELTA', default: 0.02 as const, group: 'constants', enginePath: 'constants.sigma', auto: true },
    { key: 'G', default: 0.08 as const, group: 'constants', enginePath: 'constants.G', auto: true },
    { key: 'K', default: 0.1 as const, group: 'constants', enginePath: 'constants.K', auto: true },
    { key: 'kB', default: 6.02 as const, group: 'constants', enginePath: 'constants.kB', auto: true },
    { key: 'ewaldAlpha', default: undefined, group: 'ewald', enginePath: 'runtime.ewaldAlpha', auto: true },
    { key: 'ewaldKMax', default: undefined, group: 'ewald', enginePath: 'runtime.ewaldKMax', auto: true }
]

export interface SettingsObject {
    particleCount: number
    maxTrajectoryLength: number
    unitArrowLength: number
    maxArrowLength: number
    spaceBoundaryX: number
    spaceBoundaryY: number
    spaceBoundaryZ: number
    cutoffDistance: number
    massLowerBound: number
    massUpperBound: number
    availableCharges: readonly number[]
    dt: number
    sunMass: number
    targetTemperature: number
    if_use_periodic_boundary_condition: boolean
    if_apply_LJpotential: boolean
    if_apply_gravitation: boolean
    if_apply_coulombForce: boolean
    integrator: 'velocityVerlet' | 'euler'
    neighborStrategy: 'naive' | 'cell'
    referenceFrameMode: 'fixed' | 'sun' | 'com'
    if_makeSun: boolean
    if_showUniverseBoundary: boolean
    if_showTrajectory: boolean
    if_showArrows: boolean
    if_showMapscale: boolean
    if_useFog: boolean
    if_limitArrowsMaxLength: boolean
    if_constant_temperature: boolean
    EPSILON: number
    DELTA: number
    G: number
    K: number
    kB: number
    ewaldAlpha: number | undefined
    ewaldKMax: number | undefined
    // Allow dynamic access for generic GUI / binding loops (not recommended for external use).
    [key: string]: unknown
}

export function buildSettings(): SettingsObject {
    const obj: Partial<SettingsObject> = {}
    const clone = typeof structuredClone === 'function'
        ? structuredClone
        : (<T>(v: T): T => {
            try { return JSON.parse(JSON.stringify(v)) } catch { return v }
        })
    for (const d of SETTINGS_SCHEMA) {
        // Assign with type assertion – schema is source of truth
        const value = clone(d.default)
        if (d.key === 'particleCount') {
            if (!Number.isInteger(value)) {
                throw new Error('particleCount must be an integer')
            }
        }
        (obj as Record<string, unknown>)[d.key] = value
    }
    return obj as SettingsObject
}

export function getAutoEngineBindings() {
    return SETTINGS_SCHEMA.filter(d => d.enginePath && d.auto).map(d => ({ key: d.key, path: d.enginePath! }))
}
