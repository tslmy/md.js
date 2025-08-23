import * as THREE from 'three'

/**
 * Instanced spheres renderer (simple replacement for point sprites).
 * - Uses MeshBasicMaterial (no lighting needed) for performance & predictable flat color.
 * - Per-particle color via setColorAt (supported in r144) with material.vertexColors=true.
 * - Scale encodes (optional) mass if provided.
 */
export class InstancedSpheres {
  private readonly mesh: THREE.InstancedMesh
  private readonly tmpMatrix = new THREE.Matrix4()
  private readonly tmpPosition = new THREE.Vector3()
  private readonly tmpQuat = new THREE.Quaternion() // identity
  private readonly tmpScale = new THREE.Vector3(1, 1, 1)
  private readonly color = new THREE.Color()
  private needsCommit = false

  constructor(count: number, baseRadius: number, colors: THREE.Color[], masses?: Float32Array) {
    const geo = new THREE.SphereGeometry(1, 12, 10)
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true })
    this.mesh = new THREE.InstancedMesh(geo, mat, count)
    this.tmpQuat.identity()

    // Pre-seed transforms (will be updated each frame)
  const avgMass = masses?.length ? averageFinite(masses) : 1
    for (let i = 0; i < count; i++) {
      const rScale = masses ? Math.cbrt((masses[i] || avgMass) / avgMass) : 1
      this.tmpScale.setScalar(baseRadius * rScale)
      this.tmpPosition.set(0, 0, 0)
      this.tmpMatrix.compose(this.tmpPosition, this.tmpQuat, this.tmpScale)
      this.mesh.setMatrixAt(i, this.tmpMatrix)
      const c = colors[i] || new THREE.Color(1, 1, 1)
      this.mesh.setColorAt(i, c)
    }
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }

  update(i: number, x: number, y: number, z: number, scaleScalar?: number): void {
    this.tmpPosition.set(x, y, z)
    if (scaleScalar != null) this.tmpScale.setScalar(scaleScalar)
    this.tmpMatrix.compose(this.tmpPosition, this.tmpQuat, this.tmpScale)
    this.mesh.setMatrixAt(i, this.tmpMatrix)
    this.needsCommit = true
  }

  commit(): void {
    if (!this.needsCommit) return
    this.mesh.instanceMatrix.needsUpdate = true
    this.needsCommit = false
  }

  setVisible(v: boolean): void { this.mesh.visible = v }

  addTo(scene: THREE.Scene): void { scene.add(this.mesh) }

  dispose(): void {
    this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose()
  }
}

function averageFinite(arr: Float32Array): number {
  let sum = 0, n = 0
  for (const v of arr) { if (isFinite(v)) { sum += v; n++ } }
  return n ? sum / n : 1
}
