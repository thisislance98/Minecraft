
import { Item } from './Item.js';
import * as THREE from 'three';

export class AntigravityGuideItem extends Item {
    constructor() {
        super('antigravity_guide', 'Antigravity Guide');
        this.maxStack = 1;
    }

    /**
     * @param {import('../VoxelGame.jsx').VoxelGame} game
     * @param {import('../entities/Player.js').Player} player
     */
    onUseDown(game, player) {
        // Open the tutorial modal
        if (game.uiManager) {
            game.uiManager.showTutorialModal();
            return true;
        }
        return false;
    }

    getMesh() {
        const geometry = new THREE.BoxGeometry(0.3, 0.4, 0.1);
        const material = new THREE.MeshStandardMaterial({ color: 0x4287f5 }); // Blue book
        return new THREE.Mesh(geometry, material);
    }
}
