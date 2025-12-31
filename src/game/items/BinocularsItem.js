import { Item } from './Item.js';
import * as THREE from 'three';

export class BinocularsItem extends Item {
    constructor() {
        super();
        this.id = 'binoculars';
        this.name = 'Binoculars';
        this.type = 'tool';
        this.icon = '🔭';
    }

    /**
     * Cycles through zoom levels when used.
     * Zoom levels: Normal (75) -> Zoom 1 (30) -> Zoom 2 (10) -> Zoom 3 (4)
     */
    onUseDown(game, player) {
        const currentFOV = game.camera.fov;
        let nextFOV = 75;

        // Determine next zoom level based on current FOV
        // Using ranges to handle small floating point differences
        if (currentFOV > 60) {
            nextFOV = 30; // First zoom level
        } else if (currentFOV > 20) {
            nextFOV = 10; // Second zoom level
        } else if (currentFOV > 8) {
            nextFOV = 4; // Max zoom level
        } else {
            nextFOV = 75; // Reset to normal
        }

        game.camera.fov = nextFOV;
        game.camera.updateProjectionMatrix();

        // Optional: Play a sound effect if available
        if (game.soundManager && game.soundManager.sounds && game.soundManager.sounds.has('click')) {
            // game.soundManager.playSound('click');
        }

        return true;
    }
}
