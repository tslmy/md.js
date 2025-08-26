import { buildSettings, SETTINGS_SCHEMA, type SettingsObject } from '../config/settingsSchema.js'

// Mutable singleton settings object (GUI mutates in place)
const settings: SettingsObject = buildSettings()

// Central post-load normalization (fallbacks for optional numeric tuning params etc.)
export function normalizeSettings(s: SettingsObject): void {
	// Provide heuristic defaults for Ewald parameters if absent/invalid
	const Lmin = Math.min(
		Number(s.spaceBoundaryX) || Infinity,
		Number(s.spaceBoundaryY) || Infinity,
		Number(s.spaceBoundaryZ) || Infinity
	)
	if (!Number.isFinite(Lmin) || Lmin <= 0) return
	if (typeof s.ewaldAlpha !== 'number' || !Number.isFinite(s.ewaldAlpha) || s.ewaldAlpha <= 0) s.ewaldAlpha = 5 / Lmin
	if (typeof s.ewaldKMax !== 'number' || !Number.isFinite(s.ewaldKMax) || s.ewaldKMax <= 0) s.ewaldKMax = 6
}

// Reset by rebuilding from schema (avoids maintaining a deep cloned copy + keeps new schema additions)
function resetSettingsToDefaults(): void { Object.assign(settings, buildSettings()) }
function getDefaultSettingsSnapshot() { return buildSettings() }

export { settings, resetSettingsToDefaults, getDefaultSettingsSnapshot, SETTINGS_SCHEMA }
