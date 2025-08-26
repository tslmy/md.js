import { buildSettings, SETTINGS_SCHEMA, type SettingsObject } from '../config/settingsSchema.js'

// Mutable singleton settings object (GUI mutates in place)
const settings: SettingsObject = buildSettings()

// Reset by rebuilding from schema (avoids maintaining a deep cloned copy + keeps new schema additions)
function resetSettingsToDefaults(): void { Object.assign(settings, buildSettings()) }
function getDefaultSettingsSnapshot() { return buildSettings() }

export { settings, resetSettingsToDefaults, getDefaultSettingsSnapshot, SETTINGS_SCHEMA }
