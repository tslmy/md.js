import { describe, it, expect, beforeEach } from 'vitest'
import { StabilityMonitor } from '../built/core/simulation/stabilityMonitor.js'

// Define Diagnostics type locally since it's not exported from built
interface Diagnostics {
  time: number
  kinetic: number
  potential: number
  total: number
  temperature: number
  maxSpeed: number
  maxForceMag: number
}

describe('StabilityMonitor', () => {
  let monitor: StabilityMonitor

  beforeEach(() => {
    monitor = new StabilityMonitor()
  })

  const createDiagnostics = (overrides: Partial<Diagnostics> = {}): Diagnostics => ({
    time: 0,
    kinetic: 100,
    potential: -50,
    total: 50,
    temperature: 100,
    maxSpeed: 10,
    maxForceMag: 20,
    ...overrides
  })

  const defaultConfig = {
    thermostatEnabled: false,
    targetTemperature: 100,
    dt: 0.01
  }

  describe('Critical detection', () => {
    it('detects NaN temperature as critical immediately', () => {
      const diag = createDiagnostics({ temperature: NaN })
      const result = monitor.check(diag, defaultConfig)

      expect(result).toBeTruthy()
      expect(result?.level).toBe('critical')
      expect(result?.message).toContain('NaN')
    })

    it('detects Infinity maxSpeed as critical immediately', () => {
      const diag = createDiagnostics({ maxSpeed: Infinity })
      const result = monitor.check(diag, defaultConfig)

      expect(result).toBeTruthy()
      expect(result?.level).toBe('critical')
    })

    it('detects Infinity maxForceMag as critical immediately', () => {
      const diag = createDiagnostics({ maxForceMag: Infinity })
      const result = monitor.check(diag, defaultConfig)

      expect(result).toBeTruthy()
      expect(result?.level).toBe('critical')
    })
  })

  describe('Severe detection', () => {
    it('does not trigger on first high speed violation', () => {
      const diag = createDiagnostics({ maxSpeed: 600 })
      const result = monitor.check(diag, defaultConfig)

      expect(result).toBeNull()
    })

    it('triggers severe after 3 consecutive high speed frames', () => {
      const diag = createDiagnostics({ maxSpeed: 600 })

      expect(monitor.check(diag, defaultConfig)).toBeNull()
      expect(monitor.check(diag, defaultConfig)).toBeNull()

      const result = monitor.check(diag, defaultConfig)
      expect(result).toBeTruthy()
      expect(result?.level).toBe('severe')
      expect(result?.message).toContain('fast')
    })

    it('triggers severe after 3 consecutive high force frames', () => {
      const diag = createDiagnostics({ maxForceMag: 6000 })

      expect(monitor.check(diag, defaultConfig)).toBeNull()
      expect(monitor.check(diag, defaultConfig)).toBeNull()

      const result = monitor.check(diag, defaultConfig)
      expect(result).toBeTruthy()
      expect(result?.level).toBe('severe')
      expect(result?.message).toContain('large')
    })

    it('resets counter when violation stops', () => {
      const highSpeed = createDiagnostics({ maxSpeed: 600 })
      const normalSpeed = createDiagnostics({ maxSpeed: 10 })

      monitor.check(highSpeed, defaultConfig)
      monitor.check(highSpeed, defaultConfig)
      monitor.check(normalSpeed, defaultConfig) // Counter resets
      monitor.check(highSpeed, defaultConfig)
      monitor.check(highSpeed, defaultConfig)

      const result = monitor.check(highSpeed, defaultConfig)
      expect(result).toBeTruthy() // Should trigger after 3 more
      expect(result?.level).toBe('severe')
    })
  })

  describe('Warning detection - energy drift', () => {
    it('does not warn on first frame (no previous energy)', () => {
      const diag = createDiagnostics({ total: 1000 })
      const result = monitor.check(diag, defaultConfig)

      expect(result).toBeNull()
    })

    it('does not warn when thermostat is enabled', () => {
      const config = { ...defaultConfig, thermostatEnabled: true }

      // Simulate large energy drift
      for (let i = 0; i < 25; i++) {
        const diag = createDiagnostics({ total: 50 + i * 10 }) // Growing energy
        monitor.check(diag, config)
      }

      // Should not warn because thermostat changes energy intentionally
      const diag = createDiagnostics({ total: 300 })
      const result = monitor.check(diag, config)

      // Might warn about temp, but not energy drift
      if (result) {
        expect(result.message).not.toContain('Energy drift')
      }
    })

    it('triggers warning after 20 frames of energy drift', () => {
      // Simulate continuous energy growth (unstable integration)
      // Start from frame 1 (frame 0 sets baseline with no drift check)
      for (let i = 1; i <= 21; i++) {
        // Energy grows by 6% each frame (exceeds 5% threshold)
        const energy = 100 * Math.pow(1.06, i)
        const result = monitor.check(createDiagnostics({ total: energy }), defaultConfig)

        if (i <= 20) {
          expect(result).toBeNull() // Should not trigger before 21st check (20 violations after baseline)
        } else {
          // 21st frame should trigger (20 consecutive violations)
          expect(result).toBeTruthy()
          expect(result?.level).toBe('warning')
          expect(result?.message).toContain('Energy drift')
        }
      }
    })
  })

  describe('Warning detection - temperature explosion', () => {
    it('triggers warning when temperature exceeds 5x target with thermostat', () => {
      const config = { ...defaultConfig, thermostatEnabled: true, targetTemperature: 100 }

      // Temp = 600, target = 100, ratio = 6 > 5
      const diag = createDiagnostics({ temperature: 600 })

      // First 19 frames should not warn
      for (let i = 0; i < 19; i++) {
        expect(monitor.check(diag, config)).toBeNull()
      }

      // 20th frame should warn
      const result = monitor.check(diag, config)
      expect(result).toBeTruthy()
      expect(result?.level).toBe('warning')
      expect(result?.message).toContain('Temperature')
    })

    it('does not warn about temperature when thermostat is off', () => {
      const config = { ...defaultConfig, thermostatEnabled: false }

      // Very high temperature
      const diag = createDiagnostics({ temperature: 1000 })

      for (let i = 0; i < 25; i++) {
        const result = monitor.check(diag, config)
        if (result) {
          expect(result.message).not.toContain('Temperature')
        }
      }
    })
  })

  describe('Reset functionality', () => {
    it('resets all counters and state', () => {
      const highSpeed = createDiagnostics({ maxSpeed: 600 })

      // Build up severe counter
      monitor.check(highSpeed, defaultConfig)
      monitor.check(highSpeed, defaultConfig)

      // Reset
      monitor.reset()

      // Should need 3 more frames to trigger
      expect(monitor.check(highSpeed, defaultConfig)).toBeNull()
      expect(monitor.check(highSpeed, defaultConfig)).toBeNull()

      const result = monitor.check(highSpeed, defaultConfig)
      expect(result).toBeTruthy()
    })
  })

  describe('Suggestions', () => {
    it('provides actionable suggestions for critical failures', () => {
      const diag = createDiagnostics({ maxSpeed: NaN })
      const result = monitor.check(diag, defaultConfig)

      expect(result?.suggestions).toBeTruthy()
      expect(result?.suggestions.length).toBeGreaterThan(0)
      expect(result?.suggestions.some(s => s.toLowerCase().includes('reload'))).toBe(true)
    })

    it('provides actionable suggestions for severe instability', () => {
      const diag = createDiagnostics({ maxSpeed: 700 })

      // Trigger severe
      monitor.check(diag, defaultConfig)
      monitor.check(diag, defaultConfig)
      const result = monitor.check(diag, defaultConfig)

      expect(result?.suggestions).toBeTruthy()
      expect(result?.suggestions.some(s => s.toLowerCase().includes('timestep') || s.toLowerCase().includes('dt'))).toBe(true)
    })
  })
})
