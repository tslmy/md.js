function dump(name, obj) {
  const textToSave = JSON.stringify(
    {
      particleCount: particleCount,
      particleColors: particleColors,
      particlePositions: particlePositions,
      particleForces: particleForces,
      particleVelocities: particleVelocities,
      particleMasses: particleMasses,
      particleCharges: particleCharges,
      time: time,
      lastSnapshotTime: lastSnapshotTime,
    },
    null,
    "\t"
  );
  const hiddenElement = document.createElement("a");
  hiddenElement.href = "data:attachment/text," + encodeURI(textToSave);
  hiddenElement.target = "_blank";
  hiddenElement.download = strftime("%A %l:%M%P %e %b %Y") + ".json";
  hiddenElement.click();
}

// local storage functions:
function save(name, obj) {
  localStorage.setItem(name, JSON.stringify(obj));
}

function saveState() {
  save("particleCount", particleCount);
  save("particleColors", particleColors);
  save("particlePositions", particlePositions);
  save("particleForces", particleForces);
  save("particleVelocities", particleVelocities);
  save("particleMasses", particleMasses);
  save("particleCharges", particleCharges);
  save("time", time);
  save("lastSnapshotTime", lastSnapshotTime);
  /* console.log('particleColors', particleColors);
    console.log('particlePositions', particlePositions);
    console.log('particleForces', particleForces);
    console.log('particleVelocities', particleVelocities);
    console.log('particleMasses', particleMasses);
    console.log('particleCharges', particleCharges);
    console.log('time', time);
    console.log('lastSnapshotTime', lastSnapshotTime);*/
}

function clearState() {
  localStorage.removeItem("particleColors");
  localStorage.removeItem("particlePositions");
  localStorage.removeItem("particleForces");
  localStorage.removeItem("particleVelocities");
  localStorage.removeItem("particleMasses");
  localStorage.removeItem("particleCharges");
  localStorage.removeItem("time");
  localStorage.removeItem("lastSnapshotTime");
  window.onbeforeunload = null;
  location.reload();
}
// Create the vertices and add them to the particles geometry
function loadState() {
  console.log("Loading particleCount...");
  previous_particleCount = JSON.parse(localStorage.getItem("particleCount"));
  if (previous_particleCount == null) {
    console.log("Failed.");
    return false;
  }
  console.log("Loading particleColors...");
  previous_particleColors = JSON.parse(localStorage.getItem("particleColors"));
  if (previous_particleColors == null) {
    console.log("Failed.");
    return false;
  }
  console.log("Loading particlePositions...");
  previous_particlePositions = JSON.parse(
    localStorage.getItem("particlePositions")
  );
  if (previous_particlePositions == null) {
    console.log("Failed.");
    return false;
  }
  console.log("Loading particleForces...");
  previous_particleForces = JSON.parse(localStorage.getItem("particleForces"));
  if (previous_particleForces == null) {
    console.log("Failed.");
    return false;
  }
  console.log("Loading particleVelocities...");
  previous_particleVelocities = JSON.parse(
    localStorage.getItem("particleVelocities")
  );
  if (previous_particleVelocities == null) {
    console.log("Failed.");
    return false;
  }
  console.log("Loading particleMasses...");
  previous_particleMasses = JSON.parse(localStorage.getItem("particleMasses"));
  if (previous_particleMasses == null) {
    console.log("Failed.");
    return false;
  }
  console.log("Loading particleCharges...");
  previous_particleCharges = JSON.parse(
    localStorage.getItem("particleCharges")
  );
  if (previous_particleCharges == null) {
    console.log("Failed.");
    return false;
  }
  console.log("Loading time...");
  previous_time = JSON.parse(localStorage.getItem("time"));
  if (previous_time == null) {
    console.log("Failed.");
    return false;
  }
  console.log("Loading lastSnapshotTime...");
  previous_lastSnapshotTime = JSON.parse(
    localStorage.getItem("lastSnapshotTime")
  );
  if (previous_lastSnapshotTime == null) {
    console.log("Failed.");
    return false;
  }
  console.log("Successfully loaded all variables.");
  return true;
}
