//===============options and settings:
var particleCount = 5;
var maxTrajectoryLength = 500;
var originalSpaceBoundaryX = 5;
var originalSpaceBoundaryY = 5;
var originalSpaceBoundaryZ = 5;
var spaceBoundaryX = originalSpaceBoundaryX;
var spaceBoundaryY = originalSpaceBoundaryY;
var spaceBoundaryZ = originalSpaceBoundaryZ;
var dt = 0.01;
var availableCharges = [-3, -2, -1, 0, 1, 2, 3];
var d_min = 0.02;
var sunMass = 500;
//toggles for functions:
var if_use_periodic_boundary_condition = true;
var if_override_particleCount_setting_with_lastState = true;
var if_apply_LJpotential = true;
var if_apply_gravitation = true;
var if_apply_coulombForce = true;
var if_ReferenceFrame_movesWithSun = true;
var if_makeSun = true;
var if_showUniverseBoundary = true;
var if_showTrajectory = true;
var if_showArrows = false;
var if_useFog = false;
var if_proportionate_arrows_with_vectors = false;
//physical constants -- be the god!
var EPSILON = 1;
var DELTA = 0.02;
var G = 0.08;
var K = 0.1;
var max_arrow_length = 2;
function initializeGuiControls() {
    //Enable the GUI Controls powered by "dat.gui.min.js":
    var gui = new dat.GUI();
        var guiFolderParameters = gui.addFolder("Parameters");    //toggles for parameters:
            guiFolderParameters.add(this, "particleCount");
            guiFolderParameters.add(this, "maxTrajectoryLength").onChange(function(value) {
                
            });
            guiFolderParameters.add(this, "spaceBoundaryX").onChange(function(value) { if (boxMesh) boxMesh.scale.x = spaceBoundaryX / originalSpaceBoundaryX; });
            guiFolderParameters.add(this, "spaceBoundaryY").onChange(function(value) { if (boxMesh) boxMesh.scale.y = spaceBoundaryY / originalSpaceBoundaryY; });
            guiFolderParameters.add(this, "spaceBoundaryZ").onChange(function(value) { if (boxMesh) boxMesh.scale.z = spaceBoundaryZ / originalSpaceBoundaryZ; });
            guiFolderParameters.add(this, "dt");
            guiFolderParameters.open();
        var guiFolderFunctions = gui.addFolder("Functions");    //toggles for functions:
            guiFolderFunctions.add(this, "if_use_periodic_boundary_condition").name("Use PBC");
            //guiFolderFunctions.add(this, "if_override_particleCount_setting_with_lastState").name("");
            guiFolderFunctions.add(this, "if_apply_LJpotential").name("LJ potential");
            guiFolderFunctions.add(this, "if_apply_gravitation").name("Gravitation");
            guiFolderFunctions.add(this, "if_apply_coulombForce").name("Coulomb Force");
            guiFolderFunctions.add(this, "if_ReferenceFrame_movesWithSun").name("Center the sun");
            //guiFolderFunctions.add(this, "if_makeSun");
            //guiFolderFunctions.add(this, "if_showUniverseBoundary");
            guiFolderFunctions.add(this, "if_showTrajectory").name("Trajectories");
            guiFolderFunctions.add(this, "if_showArrows").name("Arrows");
            //guiFolderFunctions.add(this, "if_useFog");
            guiFolderFunctions.add(this, "if_proportionate_arrows_with_vectors").name("Proportionate arrows with vectors");
            guiFolderFunctions.open();
        var guiFolderConstants = gui.addFolder("Physical Constants");//physical constants -- be the god!
            guiFolderConstants.add(this, "EPSILON");
            guiFolderConstants.add(this, "DELTA");
            guiFolderConstants.add(this, "G");
            guiFolderConstants.add(this, "K");
            guiFolderConstants.add(this, "max_arrow_length").name("Max arrow length");
        var guiFolderCommands = gui.addFolder("Commands");//controls, buttons
            guiFolderCommands.add(this, "clearState");
            guiFolderCommands.open();
    gui.remember(this);
}
//====================================