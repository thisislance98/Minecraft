import { Item } from './Item.js';
import * as THREE from 'three';

export class SpawnEggItem extends Item {
    constructor(AnimalClass) {
        const animalName = AnimalClass.name;
        // ID: pig_spawn_egg, Name: Pig Spawn Egg
        super(`${animalName.toLowerCase()}_spawn_egg`, `${animalName} Spawn Egg`);

        this.AnimalClass = AnimalClass;
        this.maxStack = 64;
    }

    onUseDown(game, player) {
        // Raycast to find spot
        const raycaster = new THREE.Raycaster();
        const center = new THREE.Vector2(0, 0);
        raycaster.setFromCamera(center, game.camera);

        const intersects = raycaster.intersectObjects(game.scene.children, true);

        // Filter out player and held item (if any)
        // Also we want to hit the world/terrain/blocks

        // Simple logic: verify distance and spawn
        for (let i = 0; i < intersects.length; i++) {
            const hit = intersects[i];

            // Ignore player or self
            if (hit.object.isPlayer || hit.object === player.mesh) continue;

            if (hit.distance < 100) {
                // Spawn the animal
                // Position: hit point + slight up
                const pos = hit.point;
                // Add a bit of height so it doesn't get stuck in floor, but don't snap to terrain height (ground)
                // Pass false for snapToGround to use exact coordinates
                game.spawnManager.createAnimal(this.AnimalClass, pos.x, pos.y + 0.1, pos.z, false);

                // Show particle effect?

                // Consume 1 item
                return true; // Return true to deplete count (handled by listener or ItemManager?) -> Game usually handles depletion if true is returned
            }
        }

        return false;
    }
}
