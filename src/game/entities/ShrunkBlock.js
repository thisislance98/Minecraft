import * as THREE from 'three';

export class ShrunkBlock {
    constructor(game, x, y, z, blockType, initialScale = 0.7) {
        this.game = game;
        this.blockType = blockType;
        this.position = new THREE.Vector3(x, y, z);
        this.velocity = new THREE.Vector3(0, 0, 0);

        this.isDead = false;
        this.scale = initialScale;

        this.mesh = this.createMesh(blockType);
        this.updateScale();

        this.mesh.position.copy(this.position);

        // Ensure it sits on the ground correctly
        // Center of box is at 0.5 height relative to scale
        // block is 1x1x1 scaled by this.scale.
        // so height is this.scale.
        // We want the bottom to be where the block bottom was?
        // If we replaced a block at y=5 (integer), its center was 5.5.
        // So we spawned at 5.5.
        // We want our center to be at 5 + scale/2.

        // Gravity will handle settling.
    }

    createMesh(type) {
        // Get materials
        const indices = this.game.blockMaterialIndices[type];

        // Fallback or default
        const geometry = new THREE.BoxGeometry(1, 1, 1);

        // Add vertex colors (white) to support materials requiring vertex colors
        const count = geometry.attributes.position.count;
        const colors = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            colors[i * 3] = 1;
            colors[i * 3 + 1] = 1;
            colors[i * 3 + 2] = 1;
        }
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

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

    updateScale() {
        this.mesh.scale.setScalar(this.scale);
    }

    shrink(factor = 0.7) {
        this.scale *= factor;
        this.updateScale();

        // If too small, destroy it?
        if (this.scale < 0.1) {
            this.isDead = true;
        }
    }

    update(deltaTime) {
        // Physics
        // Apply Gravity
        this.velocity.y -= this.game.gravity;

        // Move
        this.position.add(this.velocity);

        // Collision with world
        const radius = this.scale * 0.5;

        // Check block below
        // We probe the bottom center point
        const bottomY = this.position.y - radius;

        const blockX = Math.floor(this.position.x);
        const blockY = Math.floor(bottomY);
        const blockZ = Math.floor(this.position.z);

        const block = this.game.getBlock(blockX, blockY, blockZ);

        if (block && block.type !== 'air' && block.type !== 'water' && !this.isPassable(block.type)) {
            // Landed
            // Snap to top of block
            // Block top is blockY + 1
            const targetY = blockY + 1 + radius;

            // Simple correction
            if (this.position.y < targetY) {
                this.position.y = targetY;
                this.velocity.y = 0;
                this.velocity.x = 0;
                this.velocity.z = 0;
            }
        }

        this.mesh.position.copy(this.position);

        return !this.isDead;
    }

    isPassable(type) {
        const passables = ['water', 'air', 'long_grass', 'flower_red', 'flower_yellow', 'mushroom_red', 'mushroom_brown', 'dead_bush', 'fern'];
        return passables.includes(type);
    }
}
