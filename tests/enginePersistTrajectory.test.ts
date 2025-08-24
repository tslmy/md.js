import { describe, it, expect } from 'vitest'
import { SimulationEngine } from '../built/engine/SimulationEngine.js'
import { fromSettings } from '../built/engine/config/types.js'
import { snapshot, hydrate } from '../built/engine/persistence/persist.js'
import { settings } from '../built/settings.js'

describe('engine snapshot remains visualization-free (trajectories excluded)', () => {
    it('does not contain trajectory arrays', () => {
        const cfg = fromSettings(settings)
        const engine = new SimulationEngine(cfg)
        // step a bit to change time
        for (let s = 0; s < 3; s++) engine.step()
        const N = engine.getState().N
        const snap = snapshot(engine)
        expect((snap as unknown as { trajectories?: unknown }).trajectories).toBeUndefined()
        // Hydrate engine (core ignores trajectories) and ensure normal fields remain intact
        const engine2 = hydrate(snap)
        expect(engine2.getState().N).toBe(N)
    })
})
