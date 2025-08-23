interface SavedState {
  particleCount: number
  particleColors: number[]
  particlePositions: number[]
  particleForces: Array<{ x: number, y: number, z: number }>
  particleVelocities: Array<{ x: number, y: number, z: number }>
  particleMasses: number[]
  particleCharges: number[]
  time: number
  lastSnapshotTime: number
}

function dump(state: unknown): void {
  // Utility to download a JSON snapshot of the simulation state.
  const textToSave = JSON.stringify(state, null, '\t')
  const hiddenElement = document.createElement('a')
  hiddenElement.href = 'data:attachment/text,' + encodeURI(textToSave)
  hiddenElement.target = '_blank'
  const now = new Date()
  hiddenElement.download = now.toUTCString() + '.json'
  hiddenElement.click()
}

// local storage functions:
function save(name: string, obj: unknown): void {
  localStorage.setItem(name, JSON.stringify(obj))
}

function saveState(state: SavedState): void {
  save('mdJsState', state)
}

function clearState(): void {
  localStorage.removeItem('mdJsState')
  window.onbeforeunload = null
  location.reload()
}

// Mutable current saved state snapshot; updated in loadState().
let _previousState: SavedState = {
  particleCount: 0,
  particleColors: [],
  particlePositions: [],
  particleForces: [],
  particleVelocities: [],
  particleMasses: [],
  particleCharges: [],
  time: 0,
  lastSnapshotTime: 0
}

// Create the vertices and add them to the particles geometry
function loadState(): boolean {
  console.log('Loading mdJsState...')
  const previousStateLoadedAsString = localStorage.getItem('mdJsState')
  if (previousStateLoadedAsString == null) {
    console.log('Variable is not defined in the local storage.')
    return false
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(previousStateLoadedAsString)
  } catch (e) {
    console.log('Failed to parse stored state.', e)
    return false
  }
  const candidate = parsed as Partial<SavedState>
  if (
    typeof candidate.particleCount !== 'number' ||
    !Array.isArray(candidate.particleColors) ||
    !Array.isArray(candidate.particlePositions) ||
    !Array.isArray(candidate.particleForces) ||
    !Array.isArray(candidate.particleVelocities) ||
    !Array.isArray(candidate.particleMasses) ||
    !Array.isArray(candidate.particleCharges) ||
    typeof candidate.time !== 'number' ||
    typeof candidate.lastSnapshotTime !== 'number'
  ) {
    console.log('Stored object missing required fields.')
    return false
  }
  _previousState = candidate as SavedState
  console.log('Successfully loaded:', _previousState)
  return true
}
function previousState(): SavedState { return _previousState }
export { dump, clearState, loadState, saveState, previousState }
