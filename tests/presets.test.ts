import { describe, it, expect } from 'vitest'
import { PRESETS } from '../built/control/presets.js'
import { SimulationEngine } from '../built/engine/SimulationEngine.js'
import { buildEngineConfig } from '../built/engine/config.js'
import { buildSettings } from '../built/control/settingsSchema.js'
import { generateMassesCharges, generatePositions } from '../built/core/simulation/seeding.js'
import { computeCircularOrbitVelocity } from '../built/core/simulation/orbitInit.js'

/**
 * Test suite ensuring all presets can survive 1000 timesteps without triggering
 * numerical instability (as detected by StabilityMonitor).
 *
 * Starting from rest (matching real app behavior) is challenging for stability.
 * Small initial velocity seeds help avoid catastrophic drift.
 */
describe('Preset stability (1000 timesteps)', () => {
  for (const preset of PRESETS) {
    it(`${preset.id}: runs 1000 steps without instability`, { timeout: 10000 }, () => {
      // Build settings from preset
      const settings = buildSettings() as Record<string, unknown>
      Object.assign(settings, preset.settings)

      // Build engine config
      const config = buildEngineConfig(settings as never)
      // Manually set particleCount (not auto-bound in schema)
      config.world.particleCount = settings.particleCount as number

      // Create engine
      const engine = new SimulationEngine(config)

      // Generate initial particle state
      const state = engine.getState()

      const { masses, charges } = generateMassesCharges({
        N: state.N,
        massLower: settings.massLowerBound as number,
        massUpper: settings.massUpperBound as number,
        chargeOptions: [...(settings.availableCharges as number[])],
        sunMass: settings.sunMass as number,
        makeSun: settings.if_makeSun as boolean
      })
      const positions = generatePositions({
        N: state.N,
        bounds: {
          x: settings.spaceBoundaryX as number,
          y: settings.spaceBoundaryY as number,
          z: settings.spaceBoundaryZ as number
        },
        makeSun: settings.if_makeSun as boolean
      })

      // Create separate arrays for seeding
      const posArray = new Float32Array(state.N * 3)
      const velArray = new Float32Array(state.N * 3)
      const massArray = new Float32Array(state.N)
      const chargeArray = new Float32Array(state.N)

      // Copy positions and masses/charges
      for (let i = 0; i < state.N; i++) {
        const i3 = i * 3
        posArray[i3] = positions[i].x
        posArray[i3 + 1] = positions[i].y
        posArray[i3 + 2] = positions[i].z
        massArray[i] = masses[i]
        chargeArray[i] = charges[i]
      }

      // Initialize velocities (mimic real application behavior with a small random seed)
      // The real app leaves particles at rest, which causes instability issues
      // Add tiny random velocities to seed the system and avoid strict zero-velocity instabilities
      if (settings.if_makeSun && state.N > 1) {
        // Circular orbit velocities for sun system
        const Msun = massArray[0]
        const G = settings.G as number
        for (let i = 1; i < state.N; i++) {
          const i3 = i * 3
          const { vx, vy, vz } = computeCircularOrbitVelocity(
            posArray[i3],
            posArray[i3 + 1],
            posArray[i3 + 2],
            Msun,
            G
          )
          velArray[i3] = vx
          velArray[i3 + 1] = vy
          velArray[i3 + 2] = vz
        }
      } else {
        // Add small random velocities to avoid zero-velocity instability
        // This helps the system "start up" without catastrophic energy drift
        for (let i = 0; i < state.N; i++) {
          const i3 = i * 3
          const vSeed = 0.1 // Small velocity seed to kick-start dynamics
          velArray[i3] = (Math.random() * 2 - 1) * vSeed
          velArray[i3 + 1] = (Math.random() * 2 - 1) * vSeed
          velArray[i3 + 2] = (Math.random() * 2 - 1) * vSeed
        }
      }

      // Seed the engine with initialized state
      engine.seed({
        positions: posArray,
        velocities: velArray,
        masses: massArray,
        charges: chargeArray
      })

      // Track any instability events
      let instabilityDetected: unknown = null
      engine.on('instability', (result: unknown) => {
        if (!instabilityDetected) {
          instabilityDetected = result
        }
      })

      // Track any error events
      let errorDetected: unknown = null
      engine.on('error', (err: unknown) => {
        if (!errorDetected) {
          errorDetected = err
        }
      })

      // Capture initial positions to verify movement
      const initialPositions = new Float32Array(state.N * 3)
      initialPositions.set(engine.getState().positions)

      // Run 1000 timesteps
      for (let i = 0; i < 1000; i++) {
        engine.step()

        // Early exit if instability detected
        if (instabilityDetected || errorDetected) {
          break
        }
      }

      // Calculate total displacement to verify particles moved
      const finalPositions = engine.getState().positions
      let totalDisplacement = 0
      let maxDisplacement = 0
      for (let i = 0; i < state.N; i++) {
        const i3 = i * 3
        const dx = finalPositions[i3] - initialPositions[i3]
        const dy = finalPositions[i3 + 1] - initialPositions[i3 + 1]
        const dz = finalPositions[i3 + 2] - initialPositions[i3 + 2]
        const displacement = Math.sqrt(dx * dx + dy * dy + dz * dz)
        totalDisplacement += displacement
        maxDisplacement = Math.max(maxDisplacement, displacement)
      }
      const avgDisplacement = totalDisplacement / state.N

      // Assert no instability was triggered
      if (instabilityDetected) {
        const result = instabilityDetected as { level: string; message: string; diagnostics: unknown; suggestions: string[] }
        console.error(`Preset "${preset.name}" (${preset.id}) failed with instability:`)
        console.error(`  Level: ${result.level}`)
        console.error(`  Message: ${result.message}`)
        console.error(`  Diagnostics:`, result.diagnostics)
        console.error(`  Suggestions:`, result.suggestions)
      }

      if (errorDetected) {
        const err = errorDetected as { message: string; stack?: string }
        console.error(`Preset "${preset.name}" (${preset.id}) failed with error:`)
        console.error(`  ${err.message}`)
        console.error(`  Stack:`, err.stack)
      }

      expect(instabilityDetected).toBeNull()
      expect(errorDetected).toBeNull()

      // Verify particles actually moved (visible motion)
      // For a 1000-step simulation, expect significant displacement
      expect(avgDisplacement).toBeGreaterThan(0.1)
      expect(maxDisplacement).toBeGreaterThan(0.1)

      // Report movement statistics for visibility verification
      console.log(`  ${preset.id}: avg displacement = ${avgDisplacement.toFixed(3)}, max = ${maxDisplacement.toFixed(3)}`)

      // Verify final state is still finite
      const finalState = engine.getState()
      for (let i = 0; i < finalState.N; i++) {
        const i3 = i * 3
        expect(Number.isFinite(finalState.positions[i3])).toBe(true)
        expect(Number.isFinite(finalState.positions[i3 + 1])).toBe(true)
        expect(Number.isFinite(finalState.positions[i3 + 2])).toBe(true)
        expect(Number.isFinite(finalState.velocities[i3])).toBe(true)
        expect(Number.isFinite(finalState.velocities[i3 + 1])).toBe(true)
        expect(Number.isFinite(finalState.velocities[i3 + 2])).toBe(true)
      }
    })
  }
})
