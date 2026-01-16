import { Item } from './Item.js';
import { Blocks } from '../core/Blocks.js';
import * as THREE from 'three';

export class ThrusterItem extends Item {
    constructor() {
        super('thruster', 'Thruster');
        this.maxStack = 64;
    }

    onUseDown(game, player) {
        // Trigger animation
        player.swingArm();

        // Raycast to find spot
        const raycaster = new THREE.Raycaster();
        const center = new THREE.Vector2(0, 0);
        raycaster.setFromCamera(center, game.camera);

        // Limit reach
        raycaster.far = 8;

        const intersects = raycaster.intersectObjects(game.scene.children, true);

        let target = null;
        let normal = null;

        // Find first valid block hit
        for (const hit of intersects) {
            if (hit.object.userData.isChunk) {
                // It's a chunk, so it's a block
                target = hit.point.clone().sub(hit.face.normal.clone().multiplyScalar(0.1)).floor();
                normal = hit.face.normal;
                break;
            } else if (hit.object.isPlayer || hit.object === player.mesh) {
                continue;
            } else {
                // Hit an entity? behave like placing against a solid?
                // For now, only place against blocks
            }
        }

        if (target && normal) {
            const newX = target.x + normal.x;
            const newY = target.y + normal.y;
            const newZ = target.z + normal.z;

            // Collision check with player
            const playerBox = {
                minX: player.position.x - player.width / 2,
                maxX: player.position.x + player.width / 2,
                minY: player.position.y,
                maxY: player.position.y + player.height,
                minZ: player.position.z - player.width / 2,
                maxZ: player.position.z + player.width / 2
            };

            const blockBox = {
                minX: newX, maxX: newX + 1,
                minY: newY, maxY: newY + 1,
                minZ: newZ, maxZ: newZ + 1
            };

            const collision = !(playerBox.maxX < blockBox.minX || playerBox.minX > blockBox.maxX ||
                playerBox.maxY < blockBox.minY || playerBox.minY > blockBox.maxY ||
                playerBox.maxZ < blockBox.minZ || playerBox.minZ > blockBox.maxZ);

            if (!collision && !game.getBlock(newX, newY, newZ)) {
                // Determine direction based on placement
                // We want the thruster to exhaust AWAY from the face we clicked?
                // Or face the player?
                // Usually: Placed on a face -> exhaust points OUT from that face.
                // e.g. Place on floor (Top face) -> Exhaust points UP.
                // e.g. Place on wall (Side face) -> Exhaust points OUT.

                // Normal is correct. Normal (0,1,0) = UP.
                // We need to map normal to an index.
                /*
                   Directions:
                   0: Right (+X)
                   1: Left (-X)
                   2: Top (+Y)
                   3: Bottom (-Y)
                   4: Front (+Z)
                   5: Back (-Z)
                */
                let dir = 0;
                if (normal.x > 0.5) dir = 0;
                else if (normal.x < -0.5) dir = 1;
                else if (normal.y > 0.5) dir = 2;
                else if (normal.y < -0.5) dir = 3;
                else if (normal.z > 0.5) dir = 4;
                else if (normal.z < -0.5) dir = 5;

                // Place Block
                game.setBlock(newX, newY, newZ, Blocks.THRUSTER);

                // Set Metadata
                if (game.setThrusterData) {
                    game.setThrusterData(newX, newY, newZ, dir);
                }

                game.updateBlockCount();

                // Consume Item
                return true; // Return true to consume
            }
        }
        return false;
    }
}
