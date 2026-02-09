import type { SettingsObject } from './settingsSchema.js'

export interface Preset {
  id: string
  name: string
  description: string
  settings: Partial<SettingsObject>
  /** Whether this preset requires a full reload to apply properly */
  requiresReload: boolean
}

export const PRESETS: Preset[] = [
  {
    id: 'solar-system',
    name: 'Solar System',
    description: 'Central massive sun with orbiting particles demonstrating Newtonian gravity',
    requiresReload: true,
    settings: {
      particleCount: 50,
      if_makeSun: true,
      sunMass: 500,
      massLowerBound: 16,
      massUpperBound: 20,
      availableCharges: [0],
      if_apply_gravitation: true,
      if_apply_LJpotential: false,
      if_apply_coulombForce: false,
      if_use_periodic_boundary_condition: false,
      spaceBoundaryX: 10,
      spaceBoundaryY: 10,
      spaceBoundaryZ: 10,
      G: 0.08,
      dt: 0.005,
      cutoffDistance: 10,
      targetTemperature: 50,
      if_constant_temperature: false,
      referenceFrameMode: 'sun',
      if_showTrajectory: true,
      if_showArrows: true,
      if_showUniverseBoundary: true
    }
  },
  {
    id: 'gas-cloud',
    name: 'Gas Cloud',
    description: 'Molecular gas simulation with Lennard-Jones potential and thermal motion',
    requiresReload: true,
    settings: {
      particleCount: 100,
      if_makeSun: false,
      massLowerBound: 16,
      massUpperBound: 20,
      availableCharges: [0],
      if_apply_gravitation: false,
      if_apply_LJpotential: true,
      if_apply_coulombForce: false,
      if_use_periodic_boundary_condition: true,
      spaceBoundaryX: 5,
      spaceBoundaryY: 5,
      spaceBoundaryZ: 5,
      EPSILON: 1,
      DELTA: 0.02,
      targetTemperature: 100,
      if_constant_temperature: false,
      dt: 0.005,
      cutoffDistance: 2.5,
      referenceFrameMode: 'com',
      if_showTrajectory: true,
      if_showArrows: true,
      if_showUniverseBoundary: true
    }
  },
  {
    id: 'charged-particles',
    name: 'Charged Particles',
    description: 'Electrostatic interactions between charged particles (Coulomb force)',
    requiresReload: true,
    settings: {
      particleCount: 30,
      if_makeSun: false,
      massLowerBound: 16,
      massUpperBound: 20,
      availableCharges: [-3, -2, -1, 1, 2, 3],
      if_apply_gravitation: false,
      if_apply_LJpotential: false,
      if_apply_coulombForce: true,
      if_use_periodic_boundary_condition: true,
      spaceBoundaryX: 5,
      spaceBoundaryY: 5,
      spaceBoundaryZ: 5,
      K: 0.1,
      targetTemperature: 50,
      if_constant_temperature: false,
      dt: 0.005,
      cutoffDistance: 5,
      referenceFrameMode: 'com',
      if_showTrajectory: true,
      if_showArrows: true,
      if_showUniverseBoundary: true
    }
  },
  {
    id: 'plasma',
    name: 'Plasma',
    description: 'High-temperature ionized gas with Coulomb, LJ, and thermal effects',
    requiresReload: true,
    settings: {
      particleCount: 80,
      if_makeSun: false,
      massLowerBound: 16,
      massUpperBound: 20,
      availableCharges: [-2, -1, 0, 1, 2],
      if_apply_gravitation: false,
      if_apply_LJpotential: true,
      if_apply_coulombForce: true,
      if_use_periodic_boundary_condition: true,
      spaceBoundaryX: 5,
      spaceBoundaryY: 5,
      spaceBoundaryZ: 5,
      EPSILON: 0.5,
      DELTA: 0.02,
      K: 0.08,
      targetTemperature: 200,
      if_constant_temperature: true,
      dt: 0.003,
      cutoffDistance: 2.5,
      referenceFrameMode: 'com',
      if_showTrajectory: false,
      if_showArrows: true,
      if_showUniverseBoundary: true
    }
  },
  {
    id: 'crystal-formation',
    name: 'Crystal Formation',
    description: 'Low-temperature Lennard-Jones system forming crystalline structures',
    requiresReload: true,
    settings: {
      particleCount: 125,
      if_makeSun: false,
      massLowerBound: 18,
      massUpperBound: 18,
      availableCharges: [0],
      if_apply_gravitation: false,
      if_apply_LJpotential: true,
      if_apply_coulombForce: false,
      if_use_periodic_boundary_condition: true,
      spaceBoundaryX: 6,
      spaceBoundaryY: 6,
      spaceBoundaryZ: 6,
      EPSILON: 1.5,
      DELTA: 0.03,
      targetTemperature: 20,
      if_constant_temperature: true,
      dt: 0.002,
      cutoffDistance: 3,
      referenceFrameMode: 'com',
      if_showTrajectory: false,
      if_showArrows: false,
      if_showUniverseBoundary: true
    }
  },
  {
    id: 'free-expansion',
    name: 'Free Expansion',
    description: 'Particles expanding freely into space without periodic boundaries',
    requiresReload: true,
    settings: {
      particleCount: 50,
      if_makeSun: false,
      massLowerBound: 16,
      massUpperBound: 20,
      availableCharges: [0],
      if_apply_gravitation: false,
      if_apply_LJpotential: false,
      if_apply_coulombForce: false,
      if_use_periodic_boundary_condition: false,
      spaceBoundaryX: 20,
      spaceBoundaryY: 20,
      spaceBoundaryZ: 20,
      targetTemperature: 100,
      if_constant_temperature: false,
      dt: 0.005,
      cutoffDistance: 10,
      referenceFrameMode: 'com',
      if_showTrajectory: true,
      if_showArrows: true,
      if_showUniverseBoundary: true
    }
  }
]

export function applyPreset(presetId: string, target: SettingsObject): boolean {
  const preset = PRESETS.find(p => p.id === presetId)
  if (!preset) return false
  Object.assign(target, preset.settings)
  return true
}

export function getPresetById(id: string): Preset | undefined {
  return PRESETS.find(p => p.id === id)
}

/** Check if settings changes require reload (particle count, sun, mass/charge distribution) */
export function requiresReload(changes: Partial<SettingsObject>): boolean {
  const reloadKeys: Array<keyof SettingsObject> = [
    'particleCount', 'if_makeSun', 'sunMass',
    'massLowerBound', 'massUpperBound', 'availableCharges'
  ]
  return reloadKeys.some(k => k in changes)
}
