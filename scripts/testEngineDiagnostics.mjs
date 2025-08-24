// Engine diagnostics emission test.
import { SimulationEngine } from '../built/engine/SimulationEngine.js'
import { legacySettingsToEngineConfig } from '../built/engine/config/types.js'
import { settings } from '../built/settings.js'

function fail(msg) { console.error('[engine-diagnostics] FAIL:', msg); process.exit(1) }

const cfg = legacySettingsToEngineConfig(settings)
cfg.world.particleCount = 4
const engine = new SimulationEngine(cfg)
const st = engine.getState()
// Simple deterministic init
for (let i = 0; i < st.N; i++) {
  const i3 = 3 * i
  st.positions[i3] = i * 0.2
  st.positions[i3+1] = 0
  st.positions[i3+2] = 0
  st.velocities[i3] = 0
  st.velocities[i3+1] = 0.01
  st.velocities[i3+2] = 0
  st.masses[i] = 1
  st.charges[i] = 0
}

let gotDiag = null
engine.on('diagnostics', d => { if (!gotDiag) gotDiag = d })
for (let s = 0; s < 3; s++) engine.step()
if (!gotDiag) fail('No diagnostics emitted')
if (!Number.isFinite(gotDiag.kinetic) || gotDiag.kinetic <= 0) fail('Invalid kinetic energy')
if (!Number.isFinite(gotDiag.temperature)) fail('Invalid temperature')
if (!('maxSpeed' in gotDiag)) fail('Missing maxSpeed')
console.log('[engine-diagnostics] PASS: diagnostic snapshot OK (KE=' + gotDiag.kinetic.toFixed(3) + ')')
