import { InstancedMesh, Matrix4, Quaternion, Vector3, InstancedBufferAttribute, SphereGeometry, MeshPhongMaterial, Color, Scene, Material } from 'three'

/**
 * Glossy instanced spheres with per-instance color using a custom InstancedBufferAttribute (three r144 safe).
 * Avoids relying on setColorAt()/instanceColor which showed black due to material+version quirks.
 */
export class InstancedSpheres {
    private readonly mesh: InstancedMesh
    private readonly tmpMat = new Matrix4()
    private readonly tmpQuat = new Quaternion()
    private readonly tmpScale = new Vector3()
    private readonly count: number
    private readonly colors: Float32Array
    private readonly colorAttr: InstancedBufferAttribute

    constructor(count: number, params: { baseRadius?: number; opacity?: number; transparent?: boolean; depthWrite?: boolean } = {}) {
        this.count = count
        const baseRadius = params.baseRadius ?? 0.1
        const opacity = params.opacity ?? 1
        const transparent = params.transparent ?? (opacity < 1)
        // If semi-transparent, default to disabling depthWrite to reduce halo artifacts of blending ordering
        const depthWrite = params.depthWrite ?? !transparent

        const geo = new SphereGeometry(1, 24, 18)
        // Allocate custom per-instance color attribute.
        this.colors = new Float32Array(count * 3)
        this.colorAttr = new InstancedBufferAttribute(this.colors, 3)
        // (name must match attribute we inject into shader below)
        geo.setAttribute('instanceColor', this.colorAttr)

        const mat = new MeshPhongMaterial({ color: 0xffffff, shininess: 40, opacity, transparent, depthWrite })
        mat.onBeforeCompile = (shader) => {
            // Inject instanceColor varying
            shader.vertexShader = shader.vertexShader
                .replace('#include <common>', '#include <common>\nattribute vec3 instanceColor;\nvarying vec3 vInstanceColor;')
                .replace('#include <begin_vertex>', '#include <begin_vertex>\n vInstanceColor = instanceColor;')
            shader.fragmentShader = shader.fragmentShader
                .replace('#include <common>', '#include <common>\nvarying vec3 vInstanceColor;')
                .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse * vInstanceColor, opacity );')
        }

        this.mesh = new InstancedMesh(geo, mat, count)
        for (let i = 0; i < count; i++) {
            this.tmpScale.set(baseRadius, baseRadius, baseRadius)
            this.tmpMat.compose(new Vector3(0, -9999, 0), this.tmpQuat, this.tmpScale)
            this.mesh.setMatrixAt(i, this.tmpMat)
            // default white (will be overridden)
            const j = 3 * i
            this.colors[j] = 1; this.colors[j + 1] = 1; this.colors[j + 2] = 1
        }
        this.mesh.instanceMatrix.needsUpdate = true
        this.colorAttr.needsUpdate = true
    }

    update(index: number, position: Vector3, radius: number, color: Color): void {
        if (index >= this.count) return
        const r = (isFinite(radius) && radius > 1e-4) ? radius : 1e-4
        this.tmpScale.set(r, r, r)
        this.tmpMat.compose(position, this.tmpQuat, this.tmpScale)
        this.mesh.setMatrixAt(index, this.tmpMat)
        const j = 3 * index
        this.colors[j] = color.r
        this.colors[j + 1] = color.g
        this.colors[j + 2] = color.b
    }

    commit(): void {
        this.mesh.instanceMatrix.needsUpdate = true
        this.colorAttr.needsUpdate = true
    }

    setVisible(v: boolean): void { this.mesh.visible = v }
    addTo(scene: Scene): void { scene.add(this.mesh) }
    dispose(): void { this.mesh.geometry.dispose(); (this.mesh.material as Material).dispose() }
}
