import { Item } from './Item.js';
import * as THREE from 'three';

export class CaptureWandItem extends Item {
    constructor() {
        super('capture_wand', 'Capture Wand');
        this.maxStack = 1;
        this.isTool = true;
    }

    onUseDown(game, player) {
        // We need to raycast specifically for animals
        // PhysicsManager usually has a getHitAnimal helper?
        // Let's check RideWandItem logic: const hitAnimal = game.physicsManager.getHitAnimal();

        const hitAnimal = game.physicsManager.getHitAnimal();
        if (hitAnimal) {
            // "Capture" it!

            // 1. Identify Animal Type
            const animalClass = hitAnimal.constructor;
            const animalName = animalClass.name;
            const spawnEggId = `${animalName.toLowerCase()}_spawn_egg`;

            // 2. Add Spawn Egg to Inventory
            const Added = game.inventoryManager.addItem(spawnEggId, 1, 'item');

            if (Added) {
                // 3. Remove Animal from World
                // Mark dead/dying or just remove
                hitAnimal.isDead = true;
                if (hitAnimal.mesh && hitAnimal.mesh.parent) {
                    hitAnimal.mesh.parent.remove(hitAnimal.mesh);
                }

                // Also remove from game.animals array
                const index = game.animals.indexOf(hitAnimal);
                if (index > -1) {
                    game.animals.splice(index, 1);
                }

                // Trigger arm swing animation
                if (player.swingArm) {
                    player.swingArm();
                }
                console.log(`Captured ${animalName}!`);
                return true;
            } else {
                console.log("Inventory full, cannot capture!");
                // Maybe play a error sound
            }
        }

        return false;
    }

    onPrimaryDown(game, player) {
        return this.onUseDown(game, player);
    }
}
