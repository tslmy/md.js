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
      particleCount: 20,
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
      particleCount: 15,
      if_makeSun: false,
      massLowerBound: 16,
      massUpperBound: 20,
      availableCharges: [0],
      if_apply_gravitation: false,
      if_apply_LJpotential: true,
      if_apply_coulombForce: false,
      if_use_periodic_boundary_condition: true,
      spaceBoundaryX: 8,
      spaceBoundaryY: 8,
      spaceBoundaryZ: 8,
      EPSILON: 0.5,
      DELTA: 0.5,
      targetTemperature: 100,
      if_constant_temperature: false,
      dt: 0.01,
      cutoffDistance: 3,
      referenceFrameMode: 'com',
      if_showTrajectory: true,
      if_showArrows: false,
      if_showUniverseBoundary: true
    }
  },
  {
    id: 'charged-particles',
    name: 'Charged Particles',
    description: 'Electrostatic interactions between charged particles (Coulomb force)',
    requiresReload: true,
    settings: {
      particleCount: 12,
      if_makeSun: false,
      massLowerBound: 16,
      massUpperBound: 20,
      availableCharges: [-2, -1, 1, 2],
      if_apply_gravitation: false,
      if_apply_LJpotential: false,
      if_apply_coulombForce: true,
      if_use_periodic_boundary_condition: true,
      spaceBoundaryX: 8,
      spaceBoundaryY: 8,
      spaceBoundaryZ: 8,
      K: 0.05,
      targetTemperature: 50,
      if_constant_temperature: false,
      dt: 0.01,
      cutoffDistance: 8,
      referenceFrameMode: 'com',
      if_showTrajectory: true,
      if_showArrows: false,
      if_showUniverseBoundary: true
    }
  },
  {
    id: 'plasma',
    name: 'Plasma',
    description: 'High-temperature ionized gas with Coulomb, LJ, and thermal effects',
    requiresReload: true,
    settings: {
      particleCount: 15,
      if_makeSun: false,
      massLowerBound: 16,
      massUpperBound: 20,
      availableCharges: [-1, 0, 1],
      if_apply_gravitation: false,
      if_apply_LJpotential: true,
      if_apply_coulombForce: true,
      if_use_periodic_boundary_condition: true,
      spaceBoundaryX: 8,
      spaceBoundaryY: 8,
      spaceBoundaryZ: 8,
      EPSILON: 0.3,
      DELTA: 0.5,
      K: 0.03,
      targetTemperature: 150,
      if_constant_temperature: true,
      dt: 0.01,
      cutoffDistance: 4,
      referenceFrameMode: 'com',
      if_showTrajectory: false,
      if_showArrows: false,
      if_showUniverseBoundary: true
    }
  },
  {
    id: 'crystal-formation',
    name: 'Crystal Formation',
    description: 'Low-temperature Lennard-Jones system forming crystalline structures',
    requiresReload: true,
    settings: {
      particleCount: 20,
      if_makeSun: false,
      massLowerBound: 18,
      massUpperBound: 18,
      availableCharges: [0],
      if_apply_gravitation: false,
      if_apply_LJpotential: true,
      if_apply_coulombForce: false,
      if_use_periodic_boundary_condition: true,
      spaceBoundaryX: 10,
      spaceBoundaryY: 10,
      spaceBoundaryZ: 10,
      EPSILON: 0.8,
      DELTA: 0.6,
      targetTemperature: 30,
      if_constant_temperature: true,
      dt: 0.01,
      cutoffDistance: 4,
      referenceFrameMode: 'com',
      if_showTrajectory: false,
      if_showArrows: false,
      if_showUniverseBoundary: true
    }
  },
  {
    id: 'free-expansion',
    name: 'Free Expansion',
    description: 'Particles drifting freely with minimal interactions',
    requiresReload: true,
    settings: {
      particleCount: 15,
      if_makeSun: false,
      massLowerBound: 16,
      massUpperBound: 20,
      availableCharges: [0],
      if_apply_gravitation: false,
      if_apply_LJpotential: true,
      if_apply_coulombForce: false,
      if_use_periodic_boundary_condition: false,
      spaceBoundaryX: 15,
      spaceBoundaryY: 15,
      spaceBoundaryZ: 15,
      EPSILON: 0.2,
      DELTA: 0.5,
      targetTemperature: 100,
      if_constant_temperature: false,
      dt: 0.01,
      cutoffDistance: 3,
      referenceFrameMode: 'com',
      if_showTrajectory: true,
      if_showArrows: false,
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
