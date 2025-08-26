import { buildSettings, SETTINGS_SCHEMA, type SettingsObject } from '../config/settingsSchema.js'

const settings: SettingsObject = buildSettings()

const originalSpaceBoundaryX = settings.spaceBoundaryX as number
const originalSpaceBoundaryY = settings.spaceBoundaryY as number
const originalSpaceBoundaryZ = settings.spaceBoundaryZ as number

const _defaultSettings = JSON.parse(JSON.stringify(settings))

function resetSettingsToDefaults(): void { Object.assign(settings, JSON.parse(JSON.stringify(_defaultSettings))) }
function getDefaultSettingsSnapshot() { return JSON.parse(JSON.stringify(_defaultSettings)) }

export { settings, originalSpaceBoundaryX, originalSpaceBoundaryY, originalSpaceBoundaryZ, resetSettingsToDefaults, getDefaultSettingsSnapshot, SETTINGS_SCHEMA }
