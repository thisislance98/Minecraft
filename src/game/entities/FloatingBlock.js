
import * as THREE from 'three';

export class FloatingBlock {
    constructor(game, x, y, z, blockType) {
        this.game = game;
        this.blockType = blockType;
        this.position = new THREE.Vector3(x, y, z);
        this.startY = y;
        this.targetY = y + 5.0; // Float up 5 blocks
        this.floatSpeed = 2.0;
        this.wobbleSpeed = 2.0;
        this.wobbleHeight = 0.5;
        this.time = 0;

        this.isDead = false;

        this.mesh = this.createMesh(blockType);
        this.mesh.position.copy(this.position);
    }

    createMesh(type) {
        // Get materials
        const indices = this.game.blockMaterialIndices[type];

        // Fallback or default
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        let materials;

        if (indices && this.game.assetManager) {
            const allMaterials = this.game.assetManager.materialArray;
            materials = indices.map(idx => allMaterials[idx]);
        } else {
            materials = new THREE.MeshLambertMaterial({ color: 0x888888 });
        }

        const mesh = new THREE.Mesh(geometry, materials);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    }

    update(deltaTime) {
        this.time += deltaTime;

        // Rise logic
        if (this.position.y < this.targetY) {
            this.position.y += this.floatSpeed * deltaTime;
        } else {
            // Wobble around targetY
            this.position.y = this.targetY + Math.sin(this.time * this.wobbleSpeed) * this.wobbleHeight;
        }

        // Slight rotation for effect
        this.mesh.rotation.y += deltaTime * 0.5;
        this.mesh.rotation.z = Math.sin(this.time * 0.5) * 0.1;

        this.mesh.position.copy(this.position);

        return !this.isDead;
    }
}
