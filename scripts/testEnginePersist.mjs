// Engine snapshot / hydrate integration test.
import { SimulationEngine } from '../built/engine/SimulationEngine.js'
import { fromSettings } from '../built/engine/config/types.js'
import { snapshot, hydrate } from '../built/engine/persistence/persist.js'
import { settings } from '../built/settings.js'

function fail(msg) { console.error('[engine-persist] FAIL:', msg); process.exit(1) }

// Ensure engine flag independent; we build config explicitly.
const cfg = fromSettings(settings)
const engine = new SimulationEngine(cfg)

// Seed with simple pattern for determinism.
const st = engine.getState()
for (let i = 0; i < st.N; i++) {
  const i3 = 3 * i
  st.positions[i3] = i * 0.1
  st.positions[i3 + 1] = 0
  st.positions[i3 + 2] = 0
  st.velocities[i3] = 0
  st.velocities[i3 + 1] = 0.01 * i
  st.velocities[i3 + 2] = 0
  st.masses[i] = 1
  st.charges[i] = 0
}

// Step a few times.
for (let s = 0; s < 5; s++) engine.step()

const snap = snapshot(engine)
if (snap.time <= 0) fail('Time not advanced')

// Hydrate new engine from snapshot; compare a few sample positions & velocities.
const engine2 = hydrate(snap)
const st2 = engine2.getState()

for (let i = 0; i < Math.min(5, st.N); i++) {
  const i3 = 3 * i
  const dx = Math.abs(st.positions[i3] - st2.positions[i3])
  const dy = Math.abs(st.velocities[i3 + 1] - st2.velocities[i3 + 1])
  if (dx > 1e-9 || dy > 1e-9) fail('Mismatch after hydrate at particle ' + i)
}

console.log('[engine-persist] PASS: snapshot/hydrate consistent (time=' + snap.time.toFixed(3) + ')')
