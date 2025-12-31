import { Item } from './Item.js';
import * as THREE from 'three';

/**
 * WaterBucketItem - Places water source blocks
 */
export class WaterBucketItem extends Item {
    constructor() {
        super('water_bucket', 'Water Bucket');
        this.maxStack = 16;
        this.isTool = true;
    }

    onUseDown(game, player) {
        // Raycast to find the block we're looking at
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), game.camera);

        const intersects = raycaster.intersectObjects(game.scene.children, true);

        for (const intersect of intersects) {
            // Skip non-chunk meshes
            if (!intersect.object.userData?.isChunk) continue;

            // Get the position adjacent to the hit face (where water should go)
            const hitPoint = intersect.point;
            const normal = intersect.face.normal;

            // Calculate block position (offset slightly into the adjacent space)
            const waterX = Math.floor(hitPoint.x + normal.x * 0.5);
            const waterY = Math.floor(hitPoint.y + normal.y * 0.5);
            const waterZ = Math.floor(hitPoint.z + normal.z * 0.5);

            // Place water source via water system
            if (game.waterSystem) {
                const placed = game.waterSystem.placeWaterSource(waterX, waterY, waterZ);
                if (placed) {
                    // Optional: Consume bucket (uncomment to make consumable)
                    // game.inventory.useSelected();
                    return true;
                }
            }

            break;
        }

        return false;
    }
}
