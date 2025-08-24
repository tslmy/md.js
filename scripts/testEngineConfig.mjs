// Test engine config patching (forces toggling & integrator switch).
import { SimulationEngine } from '../built/engine/SimulationEngine.js'
import { legacySettingsToEngineConfig } from '../built/engine/config/types.js'
import { settings } from '../built/settings.js'

function fail(msg) { console.error('[engine-config] FAIL:', msg); process.exit(1) }

const cfg = legacySettingsToEngineConfig(settings)
cfg.world.particleCount = 3
cfg.forces.gravity = false
cfg.forces.coulomb = false

const engine = new SimulationEngine(cfg)
// Capture reference to initial forces length
let count0 = engine.getForces().length
// Toggle on gravity via updateConfig
engine.updateConfig({ forces: { gravity: true } })
const count1 = engine.getForces().length
if (count1 !== count0 + 1) fail('Gravity force not added after patch')
// Switch integrator to Euler and ensure step still advances time
engine.updateConfig({ runtime: { integrator: 'euler' } })
const t0 = engine.getState().time
engine.step()
if (engine.getState().time <= t0) fail('Time did not advance with Euler integrator')
console.log('[engine-config] PASS: config patching works (forces + integrator)')
