'use strict'

import * as THREE from 'three'

function drawBox(
  spaceBoundaryX: number,
  spaceBoundaryY: number,
  spaceBoundaryZ: number,
  scene: THREE.Scene
): THREE.Mesh {
  const boxGeometry = new THREE.BoxGeometry(
    2 * spaceBoundaryX,
    2 * spaceBoundaryY,
    2 * spaceBoundaryZ
  )
  const boxMaterial = new THREE.MeshBasicMaterial({
    color: 0xaaaaaa,
    wireframe: true,
    opacity: 0.8
  })
  // add this object to the scene
  const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial)
  scene.add(boxMesh)
  return boxMesh
}

export { drawBox }
