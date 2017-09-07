# MD.js

A JavaScript molecular dynamics simulator.

Now in 3D.

## Usage

Run `index.html`, or simply visit <https://tslmy.github.io/md.js>. Best viewed on a smartphone with a Google Cardboard.

##Development

Please remember to `yarn` this project.

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

