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

/** Build a new single-particle trajectory line object and add it to the scene.
 *
 * @param i - The index of the particle.
 * @param positions - The positions buffer.
 * @param colors - The colors array.
 * @param scene - The THREE.js scene.
 * @param maxTrajectoryLength - The maximum length of the trajectory.
 * @returns A line object representing the trajectory.
 */
export function newTrajectory(i: number, positions: Float32Array, colors: Color[], scene: Scene, maxLen: number): Line {
  const i3 = 3 * i
  // Current position of the i-th particle.
  const position = new Vector3(positions[i3], positions[i3 + 1], positions[i3 + 2])
  // The color of the i-th particle. The trajectory will be colored based on this.
  const color = colors[i] || new Color(0xffffff)
  /*
   * This function creates a line object that represents the trajectory of a particle.
   * See <http://stackoverflow.com/questions/31399856/drawing-a-line-with-three-js-dynamically>.
   */
  const geom = new BufferGeometry()
  const pts = new Float32Array(maxLen * 3)
  const cols = new Float32Array(maxLen * 3)
  geom.setAttribute('position', new BufferAttribute(pts, 3))
  geom.setAttribute('color', new BufferAttribute(cols, 3))
  // The trajectory should fade to white as it extends away from the particle.
  // This makes the trajectory appear as if it is getting erased.
  const white = new Color('#FFFFFF')
  for (let i = 0; i < maxLen; i++) {
    const t = (maxLen - i) / maxLen
    const c = color.clone().lerp(white, t); (geom.attributes.color as BufferAttribute).setXYZ(i, c.r, c.g, c.b); (geom.attributes.position as BufferAttribute).setXYZ(i, position.x, position.y, position.z)
  }
  const line = new Line(geom, new LineBasicMaterial({ linewidth: 1, vertexColors: true }))
  scene.add(line)
  return line
}
