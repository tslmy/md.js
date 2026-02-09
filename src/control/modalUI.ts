import { SETTINGS_SCHEMA, type SettingsObject, type SettingDescriptor } from './settingsSchema.js'
import { PRESETS } from './presets.js'

export function buildModalHTML(settings: SettingsObject): string {
  return `
    <div class="modal fade" id="configModal" tabindex="-1" aria-labelledby="configModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="configModalLabel">Simulation Configuration</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            ${buildTabNavigation()}
            <div class="tab-content" id="configTabContent">
              ${buildPresetsTab()}
              ${buildWorldTab(settings)}
              ${buildForcesTab(settings)}
              ${buildRuntimeTab(settings)}
              ${buildVisualTab(settings)}
              ${buildAdvancedTab(settings)}
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" id="applyConfigBtn">Apply</button>
          </div>
        </div>
      </div>
    </div>
  `
}

function buildTabNavigation(): string {
  const tabs = [
    { id: 'presets', label: 'Presets', active: true },
    { id: 'world', label: 'World', active: false },
    { id: 'forces', label: 'Forces', active: false },
    { id: 'runtime', label: 'Runtime', active: false },
    { id: 'visual', label: 'Visual', active: false },
    { id: 'advanced', label: 'Advanced', active: false }
  ]

  return `
    <ul class="nav nav-tabs" role="tablist">
      ${tabs.map(tab => `
        <li class="nav-item" role="presentation">
          <button class="nav-link ${tab.active ? 'active' : ''}"
                  id="${tab.id}-tab"
                  data-bs-toggle="tab"
                  data-bs-target="#${tab.id}"
                  type="button"
                  role="tab">
            ${tab.label}
          </button>
        </li>
      `).join('')}
    </ul>
  `
}

function buildPresetsTab(): string {
  return `
    <div class="tab-pane fade show active" id="presets" role="tabpanel">
      <div class="container-fluid mt-3">
        <p class="text-muted">Choose a preset configuration to get started quickly:</p>
        <div class="row g-3">
          ${PRESETS.map(preset => `
            <div class="col-md-6 col-lg-4">
              <div class="card h-100 preset-card" data-preset-id="${preset.id}" style="cursor: pointer; transition: all 0.2s;">
                <div class="card-body">
                  <h5 class="card-title">${preset.name}</h5>
                  <p class="card-text">${preset.description}</p>
                  <div class="text-center mt-3">
                    <div class="bg-light rounded" style="height: 120px; display: flex; align-items: center; justify-content: center;">
                      <span class="text-muted">Preview placeholder</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `
}

function buildWorldTab(settings: SettingsObject): string {
  const worldSettings = SETTINGS_SCHEMA.filter(d => d.group === 'world')

  return `
    <div class="tab-pane fade" id="world" role="tabpanel">
      <div class="container-fluid mt-3">
        <p class="text-muted">Particle population & initial mass/charge distribution.</p>
        <form id="worldForm">
          ${worldSettings.map(d => buildFormGroup(d, settings)).join('')}
        </form>
      </div>
    </div>
  `
}

function buildForcesTab(settings: SettingsObject): string {
  const forcesSettings = SETTINGS_SCHEMA.filter(d => d.group === 'forces' || d.group === 'constants')

  // Map force keys to their visualization images
  // Images from Wikimedia Commons - see assets/forces/CREDITS.md for full attribution
  // Licensed under CC BY-SA 3.0 / GFDL
  const forceVisualizations: Record<string, string> = {
    if_apply_LJpotential: 'assets/forces/lennard-jones.png', // Graph from Wikimedia Commons
    if_apply_gravitation: 'assets/forces/gravity.gif', // Animation by User:Lookang, CC BY-SA 3.0
    if_apply_coulombForce: 'assets/forces/coulomb.svg' // Field plot by User:Geek3, CC BY-SA 3.0
  }

  return `
    <div class="tab-pane fade" id="forces" role="tabpanel">
      <div class="container-fluid mt-3">
        <p class="text-muted">Enable or disable force contributions and adjust physical constants.</p>
        <form id="forcesForm">
          <h6 class="mt-3 mb-2">Force Fields</h6>
          ${forcesSettings.filter(d => d.group === 'forces').map(d => {
            const imageSrc = forceVisualizations[d.key]
            if (imageSrc) {
              return buildForceFieldWithImage(d, settings, imageSrc)
            }
            return buildFormGroup(d, settings)
          }).join('')}

          <h6 class="mt-4 mb-2">Physical Constants</h6>
          ${forcesSettings.filter(d => d.group === 'constants').map(d => buildFormGroup(d, settings)).join('')}

          <div class="mt-4 pt-3 border-top">
            <p class="text-muted small mb-0">
              Force field visualizations from <a href="https://commons.wikimedia.org" target="_blank" rel="noopener">Wikimedia Commons</a>,
              licensed under <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC BY-SA 3.0</a>.
              Credits: User:Lookang, User:Geek3. See <code>assets/forces/CREDITS.md</code> for details.
            </p>
          </div>
        </form>
      </div>
    </div>
  `
}

function buildRuntimeTab(settings: SettingsObject): string {
  const runtimeSettings = SETTINGS_SCHEMA.filter(d =>
    d.group === 'runtime' || d.group === 'boundary' || d.group === 'ewald'
  )

  return `
    <div class="tab-pane fade" id="runtime" role="tabpanel">
      <div class="container-fluid mt-3">
        <p class="text-muted">Timestep, cutoff, boundary conditions, and performance tuning.</p>
        <form id="runtimeForm">
          <h6 class="mt-3 mb-2">Integration</h6>
          ${runtimeSettings.filter(d => d.group === 'runtime').map(d => buildFormGroup(d, settings)).join('')}

          <h6 class="mt-4 mb-2">Boundary Conditions</h6>
          ${runtimeSettings.filter(d => d.group === 'boundary').map(d => buildFormGroup(d, settings)).join('')}

          <h6 class="mt-4 mb-2">Ewald Parameters (Advanced)</h6>
          <p class="text-muted small">Leave empty for automatic tuning.</p>
          ${runtimeSettings.filter(d => d.group === 'ewald').map(d => buildFormGroup(d, settings)).join('')}
        </form>
      </div>
    </div>
  `
}

function buildVisualTab(settings: SettingsObject): string {
  const visualSettings = SETTINGS_SCHEMA.filter(d =>
    d.group === 'visual' || d.group === 'arrows' || d.group === 'trajectories' || d.group === 'ui'
  )

  return `
    <div class="tab-pane fade" id="visual" role="tabpanel">
      <div class="container-fluid mt-3">
        <p class="text-muted">Camera, display options, and visual aids.</p>
        <form id="visualForm">
          <h6 class="mt-3 mb-2">Display</h6>
          ${visualSettings.filter(d => d.group === 'visual').map(d => buildFormGroup(d, settings)).join('')}

          <h6 class="mt-4 mb-2">Trajectories</h6>
          ${visualSettings.filter(d => d.group === 'trajectories').map(d => buildFormGroup(d, settings)).join('')}

          <h6 class="mt-4 mb-2">Arrows & Indicators</h6>
          ${visualSettings.filter(d => d.group === 'arrows').map(d => buildFormGroup(d, settings)).join('')}
        </form>
      </div>
    </div>
  `
}

function buildAdvancedTab(settings: SettingsObject): string {
  const advancedSettings = SETTINGS_SCHEMA.filter(d => d.group === 'advanced')

  return `
    <div class="tab-pane fade" id="advanced" role="tabpanel">
      <div class="container-fluid mt-3">
        <p class="text-muted">Lower-level engine and algorithm configuration.</p>
        <form id="advancedForm">
          ${advancedSettings.map(d => buildFormGroup(d, settings)).join('')}

          <hr class="my-4">
          <h6 class="mb-2">Debug & Development</h6>
          <button type="button" class="btn btn-sm btn-outline-secondary" id="resetFirstVisitBtn">
            Reset "First Visit" Flag
          </button>
          <p class="text-muted small mt-2">
            Clear the flag to make the welcome modal show again on next page load.
          </p>
        </form>
      </div>
    </div>
  `
}

function buildForceFieldWithImage(descriptor: SettingDescriptor, settings: SettingsObject, imageSrc: string): string {
  const value = settings[descriptor.key as keyof SettingsObject]
  const label = descriptor.control?.label ?? descriptor.key
  const checked = value as boolean

  // Force field descriptions
  const descriptions: Record<string, string> = {
    if_apply_LJpotential: 'Molecular attraction and repulsion between neutral atoms',
    if_apply_gravitation: 'Universal attraction between masses (F ∝ m₁m₂/r²)',
    if_apply_coulombForce: 'Electrostatic force between charged particles (F ∝ q₁q₂/r²)'
  }
  const description = descriptions[descriptor.key] || ''

  return `
    <div class="mb-4">
      <div class="force-field-card">
        <div class="form-check mb-2">
          <input class="form-check-input" type="checkbox" id="${descriptor.key}" name="${descriptor.key}" ${checked ? 'checked' : ''}>
          <label class="form-check-label fw-semibold" for="${descriptor.key}">${label}</label>
        </div>
        ${description ? `<p class="text-muted small mb-2">${description}</p>` : ''}
        <img src="${imageSrc}" alt="${label} visualization" class="force-field-gif img-fluid" />
      </div>
    </div>
  `
}

function buildFormGroup(descriptor: SettingDescriptor, settings: SettingsObject): string {
  const value = settings[descriptor.key as keyof SettingsObject]
  const label = descriptor.control?.label || descriptor.key

  switch (descriptor.control?.type) {
    case 'boolean':
      return buildCheckbox(descriptor.key, label, value as boolean)
    case 'select':
      return buildSelect(descriptor.key, label, value as string, descriptor.control.options!)
    case 'number':
      return buildNumberInput(descriptor.key, label, value as number, descriptor.control)
    default:
      if (Array.isArray(value)) {
        return buildArrayInput(descriptor.key, label, value)
      }
      return buildTextInput(descriptor.key, label, String(value))
  }
}

function buildCheckbox(key: string, label: string, checked: boolean): string {
  return `
    <div class="form-check mb-3">
      <input class="form-check-input" type="checkbox" id="${key}" name="${key}" ${checked ? 'checked' : ''}>
      <label class="form-check-label" for="${key}">${label}</label>
    </div>
  `
}

function buildSelect(key: string, label: string, value: string, options: Record<string, string>): string {
  return `
    <div class="mb-3">
      <label for="${key}" class="form-label">${label}</label>
      <select class="form-select" id="${key}" name="${key}">
        ${Object.entries(options).map(([val, lbl]) => `
          <option value="${val}" ${value === val ? 'selected' : ''}>${lbl}</option>
        `).join('')}
      </select>
    </div>
  `
}

function buildNumberInput(key: string, label: string, value: number, control: SettingDescriptor['control']): string {
  const min = control?.min !== undefined ? `min="${control.min}"` : ''
  const max = control?.max !== undefined ? `max="${control.max}"` : ''
  const step = control?.step !== undefined ? `step="${control.step}"` : 'step="any"'

  // Physical constant descriptions
  const constantDescriptions: Record<string, string> = {
    EPSILON: 'ε - Depth of Lennard-Jones potential well (energy scale)',
    DELTA: 'σ - Distance at which LJ potential is zero (length scale)',
    G: 'Gravitational constant (strength of gravity)',
    K: 'Coulomb constant (strength of electrostatic force)',
    kB: 'Boltzmann constant (thermal energy scale)'
  }
  const description = constantDescriptions[key]

  return `
    <div class="mb-3">
      <label for="${key}" class="form-label">${label}</label>
      ${description ? `<div class="form-text text-muted small mb-1">${description}</div>` : ''}
      <input type="number" class="form-control" id="${key}" name="${key}"
             value="${value}" ${min} ${max} ${step}>
    </div>
  `
}

function buildTextInput(key: string, label: string, value: string): string {
  return `
    <div class="mb-3">
      <label for="${key}" class="form-label">${label}</label>
      <input type="text" class="form-control" id="${key}" name="${key}" value="${value}">
    </div>
  `
}

function buildArrayInput(key: string, label: string, value: unknown[]): string {
  const strValue = JSON.stringify(value)
  return `
    <div class="mb-3">
      <label for="${key}" class="form-label">${label}</label>
      <input type="text" class="form-control" id="${key}" name="${key}"
             value='${strValue}' placeholder="JSON array, e.g., [1, 2, 3]">
      <div class="form-text">Enter as JSON array</div>
    </div>
  `
}
