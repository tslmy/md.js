'use strict'

import { Scene, Mesh, BoxGeometry, MeshBasicMaterial } from 'three'

function drawBox(
  spaceBoundaryX: number,
  spaceBoundaryY: number,
  spaceBoundaryZ: number,
  scene: Scene
): Mesh {
  const boxGeometry = new BoxGeometry(
    2 * spaceBoundaryX,
    2 * spaceBoundaryY,
    2 * spaceBoundaryZ
  )
  const boxMaterial = new MeshBasicMaterial({
    color: 0xaaaaaa,
    wireframe: true,
    opacity: 0.8
  })
  // add this object to the scene
  const boxMesh = new Mesh(boxGeometry, boxMaterial)
  scene.add(boxMesh)
  return boxMesh
}

export { drawBox }
