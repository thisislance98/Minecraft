import * as THREE from 'three';

export class FallingTree {
    constructor(game, x, y, z, blocks, fallDirection) {
        this.game = game;
        this.origin = new THREE.Vector3(x, y, z);
        this.blocks = blocks; // Array of {x,y,z,type, matIndex} (relative to x,y,z or absolute?)
        // Let's assume blocks are absolute world coordinates for now, and we'll convert to local.

        this.fallDirection = fallDirection.clone().normalize();
        this.fallDirection.y = 0; // Ensure horizontal fall

        this.angle = 0;
        this.angularVelocity = 0;
        this.gravity = 5.0; // Angle acceleration
        this.isDead = false;

        this.mesh = new THREE.Group();
        this.mesh.position.copy(this.origin);

        // Pivot point is at the bottom center of the tree
        // The mesh group will rotate around this pivot

        this.constructMesh();

        this.game.scene.add(this.mesh);

        // Timer for cleanup
        this.timeAlive = 0;
        this.maxLife = 5.0; // Seconds before self-delete if it doesn't hit ground (failsafe)

        // Rotation axis: Perpendicular to fall direction
        this.axis = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), this.fallDirection).normalize();
    }

    constructMesh() {
        // Create meshes for each block relative to origin
        const geometry = new THREE.BoxGeometry(1, 1, 1);

        for (const block of this.blocks) {
            // Get material from AssetManager
            let material;
            const matIndices = this.game.assetManager.blockMaterialIndices[block.type];
            if (matIndices) {
                // If it's an array, we need a multimedia material. 
                // For simplicity in this entity, let's just use the side texture or creating a multi-material mesh is fine too.
                // AssetManager.materialArray contains the actual materials.
                material = matIndices.map(idx => this.game.assetManager.materialArray[idx]);
            } else {
                material = new THREE.MeshBasicMaterial({ color: 0x8B4513 }); // Fallback
            }

            const mesh = new THREE.Mesh(geometry, material);

            // Calculate relative position
            // Important: pivot is at (x + 0.5, y, z + 0.5) roughly? 
            // If origin is the block coordinate (integer), then the center of that block is +0.5, +0.5, +0.5.
            // We want the pivot to be at the bottom center of the base block: (x+0.5, y, z+0.5).

            const relX = block.x - this.origin.x;
            const relY = block.y - this.origin.y; // This should be >= 0
            const relZ = block.z - this.origin.z;

            mesh.position.set(relX, relY + 0.5, relZ); // +0.5 because box origin is center
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            this.mesh.add(mesh);
        }

        // Adjust group position to center of block
        this.mesh.position.x += 0.5;
        this.mesh.position.z += 0.5;
        // y is essentially ground level
    }

    update(deltaTime) {
        if (this.isDead) return;

        this.timeAlive += deltaTime;

        // Accelerate fall
        this.angularVelocity += this.gravity * deltaTime;
        this.angle += this.angularVelocity * deltaTime;

        // Apply rotation
        this.mesh.setRotationFromAxisAngle(this.axis, this.angle);

        // Check for ground collision or "Full Fall"
        if (this.angle > Math.PI / 2) {
            this.crush();
            this.die();
        }

        // Optional: Raycast directly ahead to check for terrain collision?
        // For now, simple angle check is enough for "Falling Over".
    }

    crush() {
        // Deal damage to entities in the fall zone
        // We can approximate by checking a bounding box of the fallen tree

        // Or simpler: iterate all animals and check if they are within distance of the trunk line
        // Tree Line: Origin -> Origin + Height * Direction

        // Estimate height
        let height = 0;
        this.blocks.forEach(b => height = Math.max(height, b.y - this.origin.y));

        const endPoint = this.origin.clone().add(new THREE.Vector3(0.5, 0, 0.5)); // Center
        const tipPoint = endPoint.clone().add(this.fallDirection.clone().multiplyScalar(height));

        const line = new THREE.Line3(endPoint, tipPoint);
        const radius = 2.0; // Width of crush zone

        for (const animal of this.game.animals) {
            const closest = new THREE.Vector3();
            line.closestPointToPoint(animal.position, true, closest);
            const dist = animal.position.distanceTo(closest);

            if (dist < radius) {
                animal.takeDamage(100, this.game.player); // Massive damage
                console.log("Tree crushed an animal!");
            }
        }

        // Also check player
        const playerPos = this.game.player.position;
        const closestP = new THREE.Vector3();
        line.closestPointToPoint(playerPos, true, closestP);
        if (playerPos.distanceTo(closestP) < radius) {
            // Crush player? Maybe just damage
            // this.game.player.takeDamage(20); 
            console.log("Tree crushed player!");
        }
    }

    die() {
        this.isDead = true;
        this.game.scene.remove(this.mesh);

        // Optional: Spawn drops/items
        // For visual flair we could spawn "broken particles" or just drop wood items.
        // Let's assume the blocks were harvested when tree was felled? 
        // Or wait to drop them now?
        // The prompt says "crushes whatever it falls on", doesn't specify if we get the wood.
        // Usually breaking the tree gives wood. 
        // Let's just cleanup for now.
    }
}
