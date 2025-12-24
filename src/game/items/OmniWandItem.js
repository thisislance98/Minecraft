
import { Item } from './Item.js';
import * as THREE from 'three';

export class OmniWandItem extends Item {
    constructor() {
        super('omni_wand', 'Omni Wand');
        this.maxStack = 1;

        // Default spells
        this.spells = [
            { name: "Fireball", type: "projectile", effects: [{ type: "damage", amount: 10 }, { type: "fire", duration: 5000 }] },
            { name: "Levitate", type: "projectile", effects: [{ type: "levitate", duration: 10000 }] },
            { name: "Tornado", type: "projectile", effects: [{ type: "tornado" }] }
        ];
        this.currentSpellIndex = 0;
    }

    get currentSpell() {
        if (this.spells.length === 0) return null;
        return this.spells[this.currentSpellIndex];
    }

    onUseDown(game, player) {
        if (!this.currentSpell) {
            game.uiManager.addChatMessage("system", "No spell selected! Press 'K' to create one.");
            return false;
        }

        const spell = this.currentSpell;
        const camDir = new THREE.Vector3();
        game.camera.getWorldDirection(camDir);

        // Position slightly in front of player
        game.spellSystem.execute(spell, player, camDir);

        // Visual feedback (swing?)
        return true; // Handled
    }

    addSpell(spell) {
        this.spells.push(spell);
        this.currentSpellIndex = this.spells.length - 1; // Select new spell
        // Should update UI if currently selected?
        // We don't have reference to game here except passed in methods.
        // We might need to store game reference or pass it. 
        // Actually onSelect gives us game. We can store it?
        // Let's rely on call sites to update UI for now, or just assume if we are adding spell, we might be in a UI that handles it.
        // But for cycleSpell, it's called from InputManager.
    }

    onSelect(game, player) {
        this.game = game; // Store for updates
        game.uiManager.toggleSpellSelector(true);
        game.uiManager.updateSpellSelector(this.spells, this.currentSpellIndex);
    }

    onDeselect(game, player) {
        game.uiManager.toggleSpellSelector(false);
        this.game = null;
    }

    cycleSpell() {
        if (this.spells.length === 0) return;
        this.currentSpellIndex = (this.currentSpellIndex + 1) % this.spells.length;

        if (this.game) {
            this.game.uiManager.updateSpellSelector(this.spells, this.currentSpellIndex);
        }
        return this.currentSpell;
    }
}
