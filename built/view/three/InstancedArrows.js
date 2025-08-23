import * as THREE from 'three';
/**
 * Batched arrow renderer using instanced meshes (cone for head + cylinder for shaft) per particle.
 * Reduces draw calls vs. one ArrowHelper per particle.
 * API: call update(i, origin, dir, length, color) each frame (or skip if hidden). Then call commit().
 */
export class InstancedArrows {
    constructor(count, params) {
        this.tmpMat = new THREE.Matrix4();
        this.up = new THREE.Vector3(0, 1, 0);
        this.dir = new THREE.Vector3();
        this.quat = new THREE.Quaternion();
        this.scale = new THREE.Vector3();
        this.color = new THREE.Color();
        this.visible = true;
        const shaftRadius = params.shaftRadius ?? 0.02;
        const headRadius = params.headRadius ?? 0.05;
        // headLengthRatio reserved for future shape tuning (currently fixed proportion logic)
        const baseColor = params.color ?? 0xffffff;
        const shaftGeo = new THREE.CylinderGeometry(shaftRadius, shaftRadius, 1, 6, 1, true);
        shaftGeo.translate(0, 0.5, 0); // base at origin, extend +Y
        const headGeo = new THREE.ConeGeometry(headRadius, 1, 8);
        headGeo.translate(0, 0.5, 0);
        const shaftMat = new THREE.MeshBasicMaterial({ color: baseColor });
        const headMat = new THREE.MeshBasicMaterial({ color: baseColor });
        this.shaft = new THREE.InstancedMesh(shaftGeo, shaftMat, count);
        this.head = new THREE.InstancedMesh(headGeo, headMat, count);
        // Initialize transforms
        this.lengths = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            this.shaft.setMatrixAt(i, new THREE.Matrix4());
            this.head.setMatrixAt(i, new THREE.Matrix4());
        }
        this.shaft.instanceMatrix.needsUpdate = true;
        this.head.instanceMatrix.needsUpdate = true;
    }
    setVisible(v) { this.visible = v; this.shaft.visible = v; this.head.visible = v; }
    /** Update one arrow. dir is any vector (0 handled as hidden tiny arrow). */
    update(index, origin, dir, length) {
        if (index >= this.lengths.length)
            return;
        let len = length;
        if (!isFinite(len) || len < 1e-6)
            len = 1e-6;
        this.lengths[index] = len;
        this.dir.copy(dir);
        if (this.dir.lengthSq() === 0)
            this.dir.set(1, 0, 0); // arbitrary
        this.dir.normalize();
        this.quat.setFromUnitVectors(this.up, this.dir);
        // Partition length between shaft & head
        const headPortion = Math.min(0.25 * len, len);
        const shaftLength = Math.max(len - headPortion, 1e-6);
        const headLength = headPortion;
        // shaft transform
        this.scale.set(1, shaftLength, 1);
        this.tmpMat.compose(origin, this.quat, this.scale);
        this.shaft.setMatrixAt(index, this.tmpMat);
        // head origin at end of shaft (+Y local axis)
        const headOrigin = new THREE.Vector3(0, shaftLength, 0).applyQuaternion(this.quat).add(origin);
        this.scale.set(1, headLength, 1);
        this.tmpMat.compose(headOrigin, this.quat, this.scale);
        this.head.setMatrixAt(index, this.tmpMat);
    }
    commit() {
        this.shaft.instanceMatrix.needsUpdate = true;
        this.head.instanceMatrix.needsUpdate = true;
    }
    addTo(scene) { scene.add(this.shaft); scene.add(this.head); }
    dispose() {
        this.shaft.geometry.dispose();
        this.shaft.material.dispose();
        this.head.geometry.dispose();
        this.head.material.dispose();
    }
}
//# sourceMappingURL=InstancedArrows.js.map
