/**
 * Simple toast notification system using Bootstrap 5.
 * Provides user-facing alerts for simulation instability with duplicate prevention.
 */

export type ToastType = 'critical' | 'severe' | 'warning' | 'info'

export interface ToastOptions {
  type: ToastType
  title: string
  message: string
  details?: string
  suggestions?: string[]
  persistent?: boolean
}

interface BootstrapToastOptions {
  autohide?: boolean
  delay?: number
}

interface BootstrapToastInstance {
  show: () => void
}

type BootstrapToastConstructor = new (
  element: Element,
  options?: BootstrapToastOptions
) => BootstrapToastInstance

declare global {
  interface Window {
    bootstrap?: {
      Toast?: BootstrapToastConstructor
    }
  }
}

// Track which toasts have been shown to prevent duplicates
const shownToasts = new Set<string>()

/**
 * Show a toast notification in the UI.
 * Uses duplicate prevention: same type+title combination will only show once until cleared.
 */
export function showToast(options: ToastOptions): void {
  const key = `${options.type}-${options.title}`

  // Prevent duplicate toasts
  if (shownToasts.has(key)) {
    console.log(`[Toast] Skipping duplicate: ${key}`)
    return
  }

  shownToasts.add(key)
  console.log(`[Toast] Showing: ${key}`)

  const container = document.getElementById('toast-container')
  if (!container) {
    console.error('[Toast] Container #toast-container not found in DOM')
    return
  }

  // Create toast element
  const toastEl = document.createElement('div')
  toastEl.className = `toast toast-${options.type}`
  toastEl.setAttribute('role', 'alert')
  toastEl.setAttribute('aria-live', 'assertive')
  toastEl.setAttribute('aria-atomic', 'true')

  // Build header
  const header = document.createElement('div')
  header.className = 'toast-header'
  header.innerHTML = `
    <strong class="me-auto">${escapeHtml(options.title)}</strong>
    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
  `

  // Build body
  const body = document.createElement('div')
  body.className = 'toast-body'

  // Message
  const messageDiv = document.createElement('div')
  messageDiv.textContent = options.message
  body.appendChild(messageDiv)

  // Details (diagnostic values)
  if (options.details) {
    const detailsDiv = document.createElement('div')
    detailsDiv.className = 'toast-details'
    detailsDiv.textContent = options.details
    body.appendChild(detailsDiv)
  }

  // Suggestions
  if (options.suggestions && options.suggestions.length > 0) {
    const suggestionsDiv = document.createElement('div')
    suggestionsDiv.className = 'toast-suggestions'
    const suggestionList = document.createElement('ul')
    suggestionList.className = 'mb-0 ps-3'

    const strong = document.createElement('strong')
    strong.textContent = 'Suggestions:'
    suggestionsDiv.appendChild(strong)

    options.suggestions.forEach(suggestion => {
      const li = document.createElement('li')
      li.textContent = `→ ${suggestion}`
      suggestionList.appendChild(li)
    })

    suggestionsDiv.appendChild(suggestionList)
    body.appendChild(suggestionsDiv)
  }

  toastEl.appendChild(header)
  toastEl.appendChild(body)
  container.appendChild(toastEl)

  // Initialize Bootstrap toast
  const Toast = window.bootstrap?.Toast
  if (!Toast) {
    console.error('[Toast] Bootstrap Toast not available')
    return
  }

  const bsToast = new Toast(toastEl, {
    autohide: !options.persistent,
    delay: 5000
  })

  // Remove from shownToasts when dismissed so it can show again after reload
  toastEl.addEventListener('hidden.bs.toast', () => {
    shownToasts.delete(key)
    toastEl.remove()
    console.log(`[Toast] Dismissed and cleared flag: ${key}`)
  })

  bsToast.show()
}

/**
 * Clear all toast flags, allowing them to be shown again.
 * Call this when simulation resets/reloads.
 */
export function clearToastFlags(): void {
  shownToasts.clear()
  console.log('[Toast] Cleared all flags')
}

/**
 * Basic HTML escaping to prevent XSS (though we control all inputs)
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
