
import * as THREE from 'three';

export class TargetedFloatingBlock {
    constructor(game, startPos, targetPos, blockType) {
        this.game = game;
        this.blockType = blockType;
        this.position = startPos.clone();
        this.targetPos = targetPos.clone();

        // Settings
        this.speed = 10.0; // Units per second
        this.reached = false;

        this.mesh = this.createMesh(blockType);
        this.mesh.position.copy(this.position);
    }

    createMesh(type) {
        // Reuse mesh creation from FloatingBlock logic or simplified
        const indices = this.game.blockMaterialIndices[type];
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        let materials;

        if (indices && this.game.assetManager) {
            const allMaterials = this.game.assetManager.materialArray;
            materials = indices.map(idx => {
                const mat = allMaterials[idx].clone();
                mat.vertexColors = false;
                return mat;
            });
        } else {
            materials = new THREE.MeshLambertMaterial({ color: 0x888888 }); // Grey fallback
        }

        const mesh = new THREE.Mesh(geometry, materials);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    }

    update(dt) {
        if (this.reached) return false;

        const dist = this.position.distanceTo(this.targetPos);

        // Check if close enough to snap
        if (dist < 0.1) {
            this.placeBlock();
            return false;
        }

        // Move towards target
        const direction = new THREE.Vector3().subVectors(this.targetPos, this.position).normalize();
        const moveStep = direction.multiplyScalar(this.speed * dt);

        // Don't overshoot
        if (moveStep.length() > dist) {
            this.placeBlock();
            return false;
        }

        this.position.add(moveStep);
        this.mesh.position.copy(this.position);

        return true;
    }

    placeBlock() {
        this.reached = true;
        // Snap to grid
        const x = Math.round(this.targetPos.x);
        const y = Math.round(this.targetPos.y);
        const z = Math.round(this.targetPos.z);

        this.game.setBlock(x, y, z, this.blockType);

        // Remove mesh
        if (this.mesh.parent) {
            this.mesh.parent.remove(this.mesh);
        }

        // Effect
        this.game.soundManager.playSound('click'); // Or thud
    }
}
