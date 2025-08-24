/**
 * Helper functions for drawing shapes with THREE.js.
 */

import { Scene, Mesh, BoxGeometry, MeshBasicMaterial, BufferAttribute, BufferGeometry, Color, Line, LineBasicMaterial, Vector3 } from 'three'

export function drawBox(
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

/**
 * This function creates a line object that represents the trajectory of a particle.
 * See <http://stackoverflow.com/questions/31399856/drawing-a-line-with-three-js-dynamically>.
 *
 * @param color - The color of the trajectory line.
 * @param position - The starting position of the trajectory.
 * @param maxLen - The maximum length of the trajectory.
 * @returns A line object representing the trajectory.
 */
export function makeTrajectory(color: Color, position: Vector3, maxLen: number): Line {
  const geom = new BufferGeometry()
  const pts = new Float32Array(maxLen * 3)
  const cols = new Float32Array(maxLen * 3)
  geom.setAttribute('position', new BufferAttribute(pts, 3))
  geom.setAttribute('color', new BufferAttribute(cols, 3))
  const white = new Color('#FFFFFF')
  for (let i = 0; i < maxLen; i++) {
    const t = (maxLen - i) / maxLen
    const c = color.clone().lerp(white, t); (geom.attributes.color as BufferAttribute).setXYZ(i, c.r, c.g, c.b); (geom.attributes.position as BufferAttribute).setXYZ(i, position.x, position.y, position.z)
  }
  return new Line(geom, new LineBasicMaterial({ linewidth: 1, vertexColors: true }))
}
