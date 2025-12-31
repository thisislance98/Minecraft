import { Item } from './Item.js';

export class FurnitureItem extends Item {
    constructor(id, name, FurnitureClass) {
        super(id, name);
        this.FurnitureClass = FurnitureClass;
        this.maxStack = 64;
    }

    onUseDown(game, player) {
        // Use the reliable getTargetBlock from PhysicsManager (same as block placement)
        const target = game.physicsManager.getTargetBlock();

        if (target) {
            // Place on top of the targeted block (like placing a block ON it)
            const finalX = target.x + target.normal.x + 0.5;
            const finalY = target.y + target.normal.y;
            const finalZ = target.z + target.normal.z + 0.5;

            // Rotation: snap to cardinal direction, facing player
            const playerRot = player.rotation.y;
            const snappedRot = Math.round(playerRot / (Math.PI / 2)) * (Math.PI / 2);

            console.log(`[FurnitureItem] Placing at ${finalX}, ${finalY}, ${finalZ}`);

            const furniture = game.spawnManager.createAnimal(this.FurnitureClass, finalX, finalY, finalZ, false);

            if (furniture) {
                furniture.rotation = snappedRot + Math.PI;
                furniture.mesh.rotation.y = furniture.rotation;

                // Consume item
                return true;
            }
        }

        return false;
    }
}
