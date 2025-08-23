function dump(state) {
    // Utility to download a JSON snapshot of the simulation state.
    const textToSave = JSON.stringify(state, null, '\t');
    const hiddenElement = document.createElement('a');
    hiddenElement.href = 'data:attachment/text,' + encodeURI(textToSave);
    hiddenElement.target = '_blank';
    const now = new Date();
    hiddenElement.download = now.toUTCString() + '.json';
    hiddenElement.click();
}
// local storage functions:
function save(name, obj) {
    localStorage.setItem(name, JSON.stringify(obj));
}
function saveState(state) {
    save('mdJsState', state);
}
function clearState() {
    localStorage.removeItem('mdJsState');
    window.onbeforeunload = null;
    location.reload();
}
// Mutable current saved state snapshot; updated in loadState().
let _previousState = {
    particleCount: 0,
    particleColors: [],
    particlePositions: [],
    particleForces: [],
    particleVelocities: [],
    particleMasses: [],
    particleCharges: [],
    time: 0,
    lastSnapshotTime: 0
};
// Create the vertices and add them to the particles geometry
function loadState() {
    console.log('Loading mdJsState...');
    const previousStateLoadedAsString = localStorage.getItem('mdJsState');
    if (previousStateLoadedAsString == null) {
        console.log('Variable is not defined in the local storage.');
        return false;
    }
    let parsed;
    try {
        parsed = JSON.parse(previousStateLoadedAsString);
    }
    catch (e) {
        console.log('Failed to parse stored state.', e);
        return false;
    }
    const candidate = parsed;
    if (typeof candidate.particleCount !== 'number' ||
        !Array.isArray(candidate.particleColors) ||
        !Array.isArray(candidate.particlePositions) ||
        !Array.isArray(candidate.particleForces) ||
        !Array.isArray(candidate.particleVelocities) ||
        !Array.isArray(candidate.particleMasses) ||
        !Array.isArray(candidate.particleCharges) ||
        typeof candidate.time !== 'number' ||
        typeof candidate.lastSnapshotTime !== 'number') {
        console.log('Stored object missing required fields.');
        return false;
    }
    _previousState = candidate;
    console.log('Successfully loaded:', _previousState);
    return true;
}
function previousState() { return _previousState; }
export { dump, clearState, loadState, saveState, previousState };
//# sourceMappingURL=stateStorage.js.map
