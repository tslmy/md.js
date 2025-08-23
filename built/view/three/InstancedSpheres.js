import * as THREE from 'three';
/**
 * Instanced spheres renderer (simple replacement for point sprites).
 * - Uses MeshBasicMaterial (no lighting needed) for performance & predictable flat color.
 * - Per-particle color via setColorAt (supported in r144) with material.vertexColors=true.
 * - Scale encodes (optional) mass if provided.
 */
export class InstancedSpheres {
    constructor(count, baseRadius, colors, masses) {
        this.tmpMatrix = new THREE.Matrix4();
        this.tmpPosition = new THREE.Vector3();
        this.tmpQuat = new THREE.Quaternion(); // identity
        this.tmpScale = new THREE.Vector3(1, 1, 1);
        this.color = new THREE.Color();
        this.needsCommit = false;
        const geo = new THREE.SphereGeometry(1, 12, 10);
        const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
        this.mesh = new THREE.InstancedMesh(geo, mat, count);
        this.tmpQuat.identity();
        // Pre-seed transforms (will be updated each frame)
        const avgMass = masses?.length ? averageFinite(masses) : 1;
        for (let i = 0; i < count; i++) {
            const rScale = masses ? Math.cbrt((masses[i] || avgMass) / avgMass) : 1;
            this.tmpScale.setScalar(baseRadius * rScale);
            this.tmpPosition.set(0, 0, 0);
            this.tmpMatrix.compose(this.tmpPosition, this.tmpQuat, this.tmpScale);
            this.mesh.setMatrixAt(i, this.tmpMatrix);
            const c = colors[i] || new THREE.Color(1, 1, 1);
            this.mesh.setColorAt(i, c);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        if (this.mesh.instanceColor)
            this.mesh.instanceColor.needsUpdate = true;
    }
    update(i, x, y, z, scaleScalar) {
        this.tmpPosition.set(x, y, z);
        if (scaleScalar != null)
            this.tmpScale.setScalar(scaleScalar);
        this.tmpMatrix.compose(this.tmpPosition, this.tmpQuat, this.tmpScale);
        this.mesh.setMatrixAt(i, this.tmpMatrix);
        this.needsCommit = true;
    }
    commit() {
        if (!this.needsCommit)
            return;
        this.mesh.instanceMatrix.needsUpdate = true;
        this.needsCommit = false;
    }
    setVisible(v) { this.mesh.visible = v; }
    addTo(scene) { scene.add(this.mesh); }
    dispose() {
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}
function averageFinite(arr) {
    let sum = 0, n = 0;
    for (const v of arr) {
        if (isFinite(v)) {
            sum += v;
            n++;
        }
    }
    return n ? sum / n : 1;
}
//# sourceMappingURL=InstancedSpheres.js.map
