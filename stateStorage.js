function dump (state) {
  // TODO. Not used yet.
  const textToSave = JSON.stringify(state, null, '\t')
  const hiddenElement = document.createElement('a')
  hiddenElement.href = 'data:attachment/text,' + encodeURI(textToSave)
  hiddenElement.target = '_blank'
  hiddenElement.download = strftime('%A %l:%M%P %e %b %Y') + '.json'
  hiddenElement.click()
}

// local storage functions:
function save (name, obj) {
  localStorage.setItem(name, JSON.stringify(obj))
}

function saveState (state) {
  save('mdJsState', state)
}

function clearState () {
  localStorage.removeItem('mdJsState')
  window.onbeforeunload = null
  location.reload()
}

let previousState = {
  particleCount: null,
  particleColors: null,
  particlePositions: null,
  particleForces: null,
  particleVelocities: null,
  particleMasses: null,
  particleCharges: null,
  time: null,
  lastSnapshotTime: null
}

// Create the vertices and add them to the particles geometry
function loadState () {
  console.log('Loading mdJsState...')
  const previousStateLoadedAsString = localStorage.getItem('mdJsState')
  if (previousStateLoadedAsString === undefined) {
    console.log('Variable is not defined in the local storage.')
    return false
  }
  const previousStateLoaded = JSON.parse(previousStateLoadedAsString)
  if (previousStateLoaded == null) {
    console.log('Failed.')
    return false
  }
  previousState = previousStateLoaded
  console.log('Successfully loaded.')
  return true
}
export { dump, clearState, loadState, saveState, previousState }
