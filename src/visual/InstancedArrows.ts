import { InstancedMesh, Matrix4, Vector3, Quaternion, Color, CylinderGeometry, ConeGeometry, MeshBasicMaterial, Scene, Material } from 'three'

/**
 * Batched arrow renderer using instanced meshes (cone for head + cylinder for shaft) per particle.
 * Reduces draw calls vs. one ArrowHelper per particle.
 * API: call update(i, origin, dir, length, color) each frame (or skip if hidden). Then call commit().
 */
export class InstancedArrows {
  private readonly shaft: InstancedMesh
  private readonly head: InstancedMesh
  private readonly tmpMat = new Matrix4()
  private readonly up = new Vector3(0, 1, 0)
  private readonly dir = new Vector3()
  private readonly quat = new Quaternion()
  private readonly scale = new Vector3()
  private readonly color = new Color()
  // Using simple material color (per-type) for clarity & older Three.js compatibility.
  private lengths: Float32Array
  private visible = true

  constructor(count: number, params: { shaftRadius?: number; headRadius?: number; headLengthRatio?: number; color?: number }) {
    const shaftRadius = params.shaftRadius ?? 0.02
    const headRadius = params.headRadius ?? 0.05
    // headLengthRatio reserved for future shape tuning (currently fixed proportion logic)
    const baseColor = params.color ?? 0xffffff

    const shaftGeo = new CylinderGeometry(shaftRadius, shaftRadius, 1, 6, 1, true)
    shaftGeo.translate(0, 0.5, 0) // base at origin, extend +Y
    const headGeo = new ConeGeometry(headRadius, 1, 8)
    headGeo.translate(0, 0.5, 0)

    const shaftMat = new MeshBasicMaterial({ color: baseColor })
    const headMat = new MeshBasicMaterial({ color: baseColor })

    this.shaft = new InstancedMesh(shaftGeo, shaftMat, count)
    this.head = new InstancedMesh(headGeo, headMat, count)

    // Initialize transforms
    this.lengths = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      this.shaft.setMatrixAt(i, new Matrix4())
      this.head.setMatrixAt(i, new Matrix4())
    }
    this.shaft.instanceMatrix.needsUpdate = true
    this.head.instanceMatrix.needsUpdate = true
  }

  setVisible(v: boolean) { this.visible = v; this.shaft.visible = v; this.head.visible = v }

  /** Update one arrow. dir is any vector (0 handled as hidden tiny arrow). */
  update(index: number, origin: Vector3, dir: Vector3, length: number): void {
    if (index >= this.lengths.length) return
    let len = length
    if (!isFinite(len) || len < 1e-6) len = 1e-6
    this.lengths[index] = len

    this.dir.copy(dir)
    if (this.dir.lengthSq() === 0) this.dir.set(1, 0, 0) // arbitrary
    this.dir.normalize()
    this.quat.setFromUnitVectors(this.up, this.dir)

    // Partition length between shaft & head
    const headPortion = Math.min(0.25 * len, len)
    const shaftLength = Math.max(len - headPortion, 1e-6)
    const headLength = headPortion

    // shaft transform
    this.scale.set(1, shaftLength, 1)
    this.tmpMat.compose(origin, this.quat, this.scale)
    this.shaft.setMatrixAt(index, this.tmpMat)

    // head origin at end of shaft (+Y local axis)
    const headOrigin = new Vector3(0, shaftLength, 0).applyQuaternion(this.quat).add(origin)
    this.scale.set(1, headLength, 1)
    this.tmpMat.compose(headOrigin, this.quat, this.scale)
    this.head.setMatrixAt(index, this.tmpMat)

  }

  commit(): void {
    this.shaft.instanceMatrix.needsUpdate = true
    this.head.instanceMatrix.needsUpdate = true
  }

  addTo(scene: Scene) { scene.add(this.shaft); scene.add(this.head) }

  dispose(): void {
    this.shaft.geometry.dispose(); (this.shaft.material as Material).dispose()
    this.head.geometry.dispose(); (this.head.material as Material).dispose()
  }
}
