# MolacularDynamics.js
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
![ts](https://badgen.net/badge/-/TypeScript/blue?icon=typescript&label)
[![pre-commit](https://img.shields.io/badge/pre--commit-enabled-brightgreen?logo=pre-commit&logoColor=white)](https://github.com/pre-commit/pre-commit)
[![pre-commit.ci status](https://results.pre-commit.ci/badge/github/tslmy/md.js/main.svg)](https://results.pre-commit.ci/latest/github/tslmy/md.js/main)

A toy [molecular dynamics](https://en.wikipedia.org/wiki/Molecular_dynamics) simulator in the browser.

## Demo

![](https://media0.giphy.com/media/boyW0pDMJDWqyLv96Z/giphy.gif)

You may soon realize that some particles are opaque, while some are semi-transparent. The opaque particles are the "real" entities, while the semi-transparent ones are "images" of their opaque counterparts when PBCs are enabled. They serve for illustrative purposes only.

There is a particle lying at the center of the space that never moves. I call this **the "sun"**, and it may represent the nuclear of the molecule you are looking at. It appears fixed only because the camera moves along with it. To see how it may move in the space under the influence of its "satellites", turn off "Center the sun" under "Plotting" in the control pane. To kick it up a notch, you can even disable this "sun" and see just those smaller particles evolving into chaos.

As particles approach and leave each other, you'll see arrows sticking out of each. That's the combined force that the particles are feeling from all the other particles. Configurations for them are under "Arrows for forces and velocities" pane.


## Features

Simulates the interactions between several points of mass.

You can choose to apply a number of **forcefields**:
* [LJ potential](https://en.wikipedia.org/wiki/Lennard-Jones_potential)
* [Gravitation](https://en.wikipedia.org/wiki/Gravity)
* [Coulomb (electrostatic) force](https://en.wikipedia.org/wiki/Coulomb%27s_law)

[**Periodic boundary conditions** (PBCs)](https://en.wikipedia.org/wiki/Periodic_boundary_conditions) are also supported. You can customize the size of the "universe" in all 3 dimensions (deliminated with a grey wireframe box). You can also choose to disable PBCs, in which case you will almost immediately notice particles fleeing the boundary.

Disabled by default, you can choose to maintain the world at a **constant temperature**.

The simulation is very **tweakable** -- even basic physical constants (G, K, delta, epsilon, etc.) are tweakable, making this tool a great toy to fiddle with. See the screenshot below for parameters that you can turn in real time:

<img width="206" alt="image" src="https://user-images.githubusercontent.com/594058/191142550-9e44a37a-c0bf-4cad-b59b-2cdf1497315e.png">

### Controlling the camera

Drag long to rotate your camera. If you run this in a VR headset -- for example, a Google Cardboard, which I used years ago when I first added this feature -- just move your head.

Scroll to zoom. Use arrow keys to pan.

## Usage

Clone this repo. In a terminal, run `python -m http.server --directory .`. Go to `http://127.0.0.1:8000/`.

Run `index.html`. Best viewed on a smartphone with a Google Cardboard.

## Development

I'm migrating this to TypeScript. Run `tsc` to compile. It reads `tsconfig.json`, which specifies that it should compile things in `src/` to `built/`, with symbols exported in the ES2020 syntax. The `index.html` will then import those modules using the ES2020 syntax.

## Plan

- [ ] Start with a Three.js-based molecule viewer.
  Candidates include:
  - JSmol: https://sourceforge.net/projects/jsmol/
    - (It's not using WebGL.)
  - ngl: https://github.com/arose/ngl
  - GLmol: http://webglmol.osdn.jp/index-en.html
    - Perhaps the best choice up to now?
  - 3Dmol.js: http://bioinformatics.oxfordjournals.org/content/31/8/1322
    - 3Dmol.js is a fork of GLmol that boasts a serious boost in performance.
    - However, they shifted away from Three.js, so it's hard for me to get the VR support right.

- [ ] Migrate code for VR support.
- [ ] Migrate code for molecular dynamics.
- [x] Use a Javascript Package Manager, such as [yarn](https://yarnpkg.com/zh-Hans/docs/install).
