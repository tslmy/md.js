# MD.js
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

A JavaScript [molecular dynamics](https://en.wikipedia.org/wiki/Molecular_dynamics) simulator.

Now in 3D.

## Screenshots

![](https://media0.giphy.com/media/boyW0pDMJDWqyLv96Z/giphy.gif)

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
