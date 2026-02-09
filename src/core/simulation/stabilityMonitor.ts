import type { Diagnostics } from './diagnostics.js'

/**
 * Multi-tier numerical stability detection for molecular dynamics simulations.
 *
 * Monitors diagnostic values (forces, velocities, energy, temperature) to detect
 * integration instabilities and provide actionable feedback to users.
 *
 * Detection tiers:
 *  - CRITICAL: NaN/Infinity (immediate catastrophic failure)
 *  - SEVERE: Extremely large forces/velocities (likely instability after 3 frames)
 *  - WARNING: Energy drift or temperature anomalies (possible instability after 20 frames)
 */

export type StabilityLevel = 'stable' | 'warning' | 'severe' | 'critical'

export interface StabilityResult {
  level: StabilityLevel
  message: string
  diagnostics: Diagnostics
  suggestions: string[]
}

interface MonitorState {
  severeFrames: number
  warningFrames: number
  lastEnergy?: number
}

interface StabilityConfig {
  thermostatEnabled: boolean
  targetTemperature: number
  dt: number
}

/**
 * Stateful monitor that tracks consecutive violations across frames.
 * Call check() every frame with fresh diagnostics to detect instabilities.
 */
export class StabilityMonitor {
  private state: MonitorState = { severeFrames: 0, warningFrames: 0 }

  // Thresholds (configurable in future)
  private readonly SEVERE_SPEED_THRESHOLD = 500
  private readonly SEVERE_FORCE_THRESHOLD = 5000
  private readonly WARNING_ENERGY_DRIFT = 0.05 // 5% per step
  private readonly WARNING_TEMP_RATIO = 5 // 5x target temperature
  private readonly SEVERE_CONSECUTIVE_FRAMES = 3
  private readonly WARNING_CONSECUTIVE_FRAMES = 20

  /**
   * Check current diagnostics for instability.
   * Returns StabilityResult if instability detected, null if stable.
   */
  check(diagnostics: Diagnostics, config: StabilityConfig): StabilityResult | null {
    // Tier 1: CRITICAL (immediate)
    const criticalResult = this.checkCritical(diagnostics, config)
    if (criticalResult) {
      return criticalResult
    }

    // Tier 2: SEVERE (after consecutive frames)
    const severeViolation = this.checkSevere(diagnostics)
    if (severeViolation) {
      this.state.severeFrames++
      if (this.state.severeFrames >= this.SEVERE_CONSECUTIVE_FRAMES) {
        return this.buildSevereResult(diagnostics, config)
      }
    } else {
      this.state.severeFrames = 0
    }

    // Tier 3: WARNING (after more consecutive frames)
    const warningResult = this.checkWarning(diagnostics, config)
    if (warningResult) {
      this.state.warningFrames++
      if (this.state.warningFrames >= this.WARNING_CONSECUTIVE_FRAMES) {
        return warningResult
      }
    } else {
      this.state.warningFrames = 0
    }

    // Update tracking
    this.state.lastEnergy = diagnostics.total

    return null // Stable
  }

  /**
   * Reset internal state (counters and tracking).
   * Call when simulation is reset or major config changes occur.
   */
  reset(): void {
    this.state = { severeFrames: 0, warningFrames: 0 }
  }

  // ============ Private detection methods ============

  private checkCritical(diagnostics: Diagnostics, config: StabilityConfig): StabilityResult | null {
    const hasNaN = isNaN(diagnostics.temperature) ||
                   isNaN(diagnostics.maxSpeed) ||
                   isNaN(diagnostics.maxForceMag) ||
                   isNaN(diagnostics.total)

    const hasInfinity = !isFinite(diagnostics.maxSpeed) ||
                        !isFinite(diagnostics.maxForceMag) ||
                        !isFinite(diagnostics.total)

    if (hasNaN || hasInfinity) {
      return {
        level: 'critical',
        message: 'Simulation crashed (NaN/Infinity detected)',
        diagnostics,
        suggestions: [
          'Reload page and try a different preset',
          'Reduce particle count significantly',
          'Increase DELTA (softer Lennard-Jones potential)',
          'Decrease force constants (EPSILON, K, G)',
          `Reduce timestep dt (current: ${config.dt})`
        ]
      }
    }

    return null
  }

  private checkSevere(diagnostics: Diagnostics): boolean {
    return diagnostics.maxSpeed > this.SEVERE_SPEED_THRESHOLD ||
           diagnostics.maxForceMag > this.SEVERE_FORCE_THRESHOLD
  }

  private buildSevereResult(diagnostics: Diagnostics, config: StabilityConfig): StabilityResult {
    const speedViolation = diagnostics.maxSpeed > this.SEVERE_SPEED_THRESHOLD
    const forceViolation = diagnostics.maxForceMag > this.SEVERE_FORCE_THRESHOLD

    let message = 'Extreme values detected: '
    if (speedViolation && forceViolation) {
      message += 'particles moving too fast AND forces too large'
    } else if (speedViolation) {
      message += 'particles moving unrealistically fast'
    } else {
      message += 'forces extremely large (close particle encounters)'
    }

    return {
      level: 'severe',
      message,
      diagnostics,
      suggestions: [
        `Reduce timestep dt significantly (current: ${config.dt}, try: ${(config.dt * 0.5).toFixed(4)})`,
        'Use fewer particles (reduces collision probability)',
        'Increase box size (lowers particle density)',
        'Weaken force constants (EPSILON, K, G)',
        'Increase DELTA for softer LJ potential'
      ]
    }
  }

  private checkWarning(diagnostics: Diagnostics, config: StabilityConfig): StabilityResult | null {
    // Energy drift (only when thermostat OFF)
    if (!config.thermostatEnabled && this.state.lastEnergy !== undefined) {
      const dE = Math.abs(diagnostics.total - this.state.lastEnergy)
      const relChange = dE / Math.abs(this.state.lastEnergy || 1)

      if (relChange > this.WARNING_ENERGY_DRIFT) {
        return {
          level: 'warning',
          message: `Energy drift detected: ${(relChange * 100).toFixed(1)}% per step`,
          diagnostics,
          suggestions: [
            `Reduce timestep dt (current: ${config.dt})`,
            'Check if force constants are too strong',
            'Verify using Velocity Verlet integrator (more stable than Euler)',
            'Consider enabling constant temperature mode'
          ]
        }
      }
    }

    // Temperature explosion (only when thermostat ON)
    if (config.thermostatEnabled) {
      const ratio = diagnostics.temperature / config.targetTemperature

      if (ratio > this.WARNING_TEMP_RATIO) {
        return {
          level: 'warning',
          message: `Temperature ${ratio.toFixed(1)}× target (thermostat unable to cool)`,
          diagnostics,
          suggestions: [
            'Thermostat cannot keep up with energy input',
            'Reduce force constants (EPSILON, K, G)',
            `Lower target temperature (current: ${config.targetTemperature})`,
            'Increase timestep slightly (paradoxically can help thermostat)'
          ]
        }
      }
    }

    return null
  }
}
