import { buildModalHTML } from './modalUI.js'
import { getPresetById, requiresReload } from './presets.js'
import { SETTINGS_SCHEMA, type SettingsObject } from './settingsSchema.js'
import { saveSettingsToLocal } from './persist.js'
import { clearEngineSnapshotInLocal } from '../engine/persist.js'
import { clearVisualDataInLocal } from '../visual/persist.js'

const FIRST_VISIT_KEY = 'mdJsModalShown'

interface BootstrapModal {
  show: () => void
  hide: () => void
}

export class ConfigModal {
  private modalElement: HTMLElement | null = null
  private bsModal: BootstrapModal | null = null
  private selectedPresetId: string | null = null

  constructor(private settings: SettingsObject) {}

  /** Initialize modal: inject HTML, create Bootstrap instance, attach listeners, check first visit */
  initialize(): void {
    try {
      const container = document.getElementById('configModalContainer')
      if (!container) {
        console.warn('[ConfigModal] Container element not found')
        return
      }

      // Generate and inject HTML
      container.innerHTML = buildModalHTML(this.settings)
      this.modalElement = document.getElementById('configModal')

      if (!this.modalElement) {
        console.error('[ConfigModal] Failed to create modal element')
        return
      }

      // Initialize Bootstrap modal instance
      const Bootstrap = (window as { bootstrap?: { Modal: new (el: HTMLElement, opts: { backdrop: string; keyboard: boolean }) => BootstrapModal } }).bootstrap
      if (!Bootstrap?.Modal) {
        console.error('[ConfigModal] Bootstrap not loaded')
        return
      }

      this.bsModal = new Bootstrap.Modal(this.modalElement, {
        backdrop: 'static',
        keyboard: true
      })

      // Attach event listeners
      this.attachEventListeners()

      // Check first visit and show modal after short delay
      if (this.checkFirstVisit()) {
        setTimeout(() => this.show(), 500)
      }
    } catch (e) {
      console.error('[ConfigModal] Error during initialization:', e)
      throw e
    }
  }

  /** Show the modal */
  show(): void {
    if (!this.bsModal) {
      console.error('[ConfigModal] Modal not initialized, cannot show')
      return
    }
    this.bsModal.show()
  }

  /** Hide the modal */
  hide(): void {
    this.bsModal?.hide()
  }

  /** Check if this is user's first visit (returns true if first visit) */
  private checkFirstVisit(): boolean {
    const shown = localStorage.getItem(FIRST_VISIT_KEY)
    if (!shown) {
      localStorage.setItem(FIRST_VISIT_KEY, 'true')
      return true
    }
    return false
  }

  /** Reset first visit flag (for dev/testing) */
  private resetFirstVisit(): void {
    localStorage.removeItem(FIRST_VISIT_KEY)
    alert('First visit flag cleared. The welcome modal will show on next page load.')
  }

  /** Attach all event listeners after DOM injection */
  private attachEventListeners(): void {
    if (!this.modalElement) return

    // Preset card clicks
    const presetCards = this.modalElement.querySelectorAll('.preset-card')
    presetCards.forEach(card => {
      card.addEventListener('click', (e) => {
        const presetId = (e.currentTarget as HTMLElement).dataset.presetId
        if (presetId) this.selectPreset(presetId)
      })
    })

    // Apply button
    const applyBtn = document.getElementById('applyConfigBtn')
    applyBtn?.addEventListener('click', () => this.applyConfiguration())

    // Reset first visit button
    const resetBtn = document.getElementById('resetFirstVisitBtn')
    resetBtn?.addEventListener('click', () => this.resetFirstVisit())

    // Modal trigger button (outside modal)
    const triggerBtn = document.getElementById('configModalTrigger')
    triggerBtn?.addEventListener('click', () => this.show())
  }

  /** Handle preset selection: highlight card and apply settings to form */
  private selectPreset(presetId: string): void {
    this.selectedPresetId = presetId

    // Visual feedback: highlight selected card
    const cards = this.modalElement?.querySelectorAll('.preset-card')
    cards?.forEach(card => {
      if ((card as HTMLElement).dataset.presetId === presetId) {
        card.classList.add('border-primary', 'border-3')
      } else {
        card.classList.remove('border-primary', 'border-3')
      }
    })

    // Apply preset settings to form inputs (preview)
    const preset = getPresetById(presetId)
    if (preset) {
      this.populateFormFromSettings(preset.settings as Partial<SettingsObject>)
    }
  }

  /** Populate form inputs with settings values */
  private populateFormFromSettings(partialSettings: Partial<SettingsObject>): void {
    if (!this.modalElement) return

    for (const [key, value] of Object.entries(partialSettings)) {
      const input = this.modalElement.querySelector(`[name="${key}"]`) as HTMLInputElement | HTMLSelectElement
      if (!input) continue

      if (input.type === 'checkbox') {
        (input as HTMLInputElement).checked = Boolean(value)
      } else if (Array.isArray(value)) {
        input.value = JSON.stringify(value)
      } else {
        input.value = String(value)
      }
    }
  }

  /** Collect form values and apply to settings object, then trigger reload if needed */
  private applyConfiguration(): void {
    if (!this.modalElement) return

    const changes: Partial<SettingsObject> = {}
    let hadErrors = false

    // If a preset was selected, apply it directly instead of collecting form values
    if (this.selectedPresetId) {
      const preset = getPresetById(this.selectedPresetId)
      if (preset) {
        Object.assign(this.settings, preset.settings)
        saveSettingsToLocal()
        this.hide()
        this.triggerReload()
        return
      }
    }

    // Otherwise collect all form inputs
    const inputs = this.modalElement.querySelectorAll('input, select')
    inputs.forEach(input => {
      const name = (input as HTMLInputElement).name
      if (!name) return

      const descriptor = SETTINGS_SCHEMA.find(d => d.key === name)
      if (!descriptor) return

      let value: string | number | boolean | unknown[] | unknown
      if ((input as HTMLInputElement).type === 'checkbox') {
        value = (input as HTMLInputElement).checked
      } else if ((input as HTMLInputElement).type === 'number') {
        const parsed = parseFloat((input as HTMLInputElement).value)
        if (Number.isNaN(parsed)) {
          console.warn(`[ConfigModal] Invalid number for ${name}, using default`)
          value = descriptor.default
          hadErrors = true
        } else {
          value = parsed
        }
      } else if (descriptor.key === 'availableCharges') {
        // Special handling for array inputs
        try {
          value = JSON.parse((input as HTMLInputElement).value)
          if (!Array.isArray(value)) {
            console.warn(`[ConfigModal] Invalid array for ${name}, using default`)
            value = descriptor.default
            hadErrors = true
          }
        } catch (e) {
          console.warn(`[ConfigModal] Failed to parse array for ${name}:`, e)
          value = descriptor.default
          hadErrors = true
        }
      } else if (descriptor.control?.type === 'select') {
        // Keep select values as-is (already canonical)
        value = (input as HTMLInputElement).value
      } else {
        // Text inputs - keep as string
        value = (input as HTMLInputElement).value
      }

      changes[name as keyof SettingsObject] = value as (typeof changes)[keyof SettingsObject]
    })

    if (hadErrors) {
      console.warn('[ConfigModal] Some settings had errors, defaults applied')
    }

    // Apply changes to settings object
    Object.assign(this.settings, changes)

    // Persist settings
    saveSettingsToLocal()

    // Check if reload required
    const needsReload = requiresReload(changes)

    // Close modal immediately
    this.hide()

    // Trigger reload if needed
    if (needsReload) {
      this.triggerReload()
    }
  }

  private triggerReload(): void {
    clearVisualDataInLocal()
    clearEngineSnapshotInLocal()

    // Prevent saving discarded state
    try { window.onbeforeunload = null } catch (e) {
      console.warn('[ConfigModal] Failed to clear onbeforeunload:', e)
    }

    // Wait for modal animation to complete before reloading
    setTimeout(() => location.reload(), 300)
  }
}
