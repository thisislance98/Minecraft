import * as THREE from 'three';
import { Blocks } from '../core/Blocks.js';

export class ShipEntity {
    constructor(game, origin, blocks) {
        this.game = game;
        this.origin = origin.clone(); // World position of the "center" or pivot
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.isDead = false;

        this.blocks = blocks; // Array of {relX, relY, relZ, type, dir}

        // Determine total thrust
        this.thrustParams = new THREE.Vector3(0, 0, 0);
        let thrusterCount = 0;

        for (const block of this.blocks) {
            if (block.type === 'thruster') {
                thrusterCount++;
                // Dir: 0:R, 1:L, 2:T, 3:B, 4:F, 5:Bk
                // Force is OPPOSITE to face. e.g. Face Right -> Force Left.
                // My logic in ThrusterItem:
                /*
                   Normal (0,1,0) = UP. Dir = 2.
                   Exhaust faces UP.
                   Thrust should be DOWN.
                */
                // Let's verify mapping:
                // 0: Right (+X), 1: Left (-X), 2: Top (+Y), 3: Bottom (-Y), 4: Front (+Z), 5: Back (-Z)

                const force = 5.0; // Force per thruster
                switch (block.dir) {
                    case 0: this.thrustParams.x -= force; break; // Exhaust Right -> Push Left
                    case 1: this.thrustParams.x += force; break; // Exhaust Left -> Push Right
                    case 2: this.thrustParams.y -= force; break;
                    case 3: this.thrustParams.y += force; break;
                    case 4: this.thrustParams.z -= force; break;
                    case 5: this.thrustParams.z += force; break;
                }
            }
        }

        this.mesh = new THREE.Group();
        this.mesh.position.copy(this.origin);
        this.game.scene.add(this.mesh);

        this.constructMesh();
    }

    constructMesh() {
        // Create meshes
        const geometry = new THREE.BoxGeometry(1, 1, 1);

        for (const block of this.blocks) {
            let materials = this.game.blockMaterialIndices[block.type];
            if (!materials) {
                materials = new THREE.MeshBasicMaterial({ color: 0xFF00FF });
            } else {
                if (block.type === 'thruster') {
                    // Apply rotation logic similar to Chunk.js
                    // Default: [Body, Body, Body, Body, Body, Exhaust]
                    // Copy default array
                    const baseMats = materials;
                    const body = this.game.assetManager.materialArray[baseMats[0]];
                    const exhaust = this.game.assetManager.materialArray[baseMats[5]];

                    const rotated = [body, body, body, body, body, body];
                    rotated[block.dir] = exhaust;

                    materials = rotated;
                } else if (Array.isArray(materials)) {
                    materials = materials.map(i => this.game.assetManager.materialArray[i]);
                } else {
                    materials = this.game.assetManager.materialArray[materials];
                }
            }

            const mesh = new THREE.Mesh(geometry, materials);
            mesh.position.set(block.relX + 0.5, block.relY + 0.5, block.relZ + 0.5);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.mesh.add(mesh);
        }
    }

    update(dt) {
        if (this.isDead) return false;

        // Apply Velocity
        this.velocity.add(this.thrustParams.clone().multiplyScalar(dt));

        // Apply Drag
        this.velocity.multiplyScalar(0.98);

        // Move
        this.mesh.position.add(this.velocity.clone().multiplyScalar(dt));

        // Collision Check (Simple voxel check)
        // Check a few points or the center?
        // Let's check the center block for now
        const worldPos = this.mesh.position.clone();

        // If we hit a block, stop? Or explode?
        // Let's just stop if we hit something thick.
        if (this.game.getBlock(Math.floor(worldPos.x), Math.floor(worldPos.y), Math.floor(worldPos.z))) {
            // Check self interaction? 
            // We removed origin blocks, so getting a block means hitting world.
            // Bounce or stop
            this.velocity.set(0, 0, 0);
            // Optionally convert back to blocks?
            // "it should also move some of the blocks it's connected to" -> implied it stays an entity or re-solidifies?
            // "hit a hotkey to make it thrust" -> implies controllable? 
            // If it's a "Ship", maybe it stays an entity.
        }

        // Lifetime bounds
        if (this.mesh.position.y < -100 || this.mesh.position.y > 500) {
            return false; // Despawn
        }

        return true;
    }
}
