/**
 * ItemScript - Makes a game object an inventory item
 */
import { validateIcon } from '../core/IconValidator.js';

export const ItemScript = {
    type: 'ItemScript',

    // Config
    icon: null,           // Required: SVG string
    category: 'misc',     // tool | block | food | material | misc
    stackable: true,
    maxStack: 64,

    Start() {
        if (!this.icon) {
            console.warn(`[ItemScript] No icon provided for ${this.gameObject.name}`);
            return;
        }

        const validation = validateIcon(this.icon);
        if (!validation.valid) {
            console.warn(`[ItemScript] Icon validation warnings for ${this.gameObject.name}:`, validation.errors);
        }

        // Non-stackable items (tools) have maxStack 1
        if (!this.stackable || this.category === 'tool') {
            this.maxStack = 1;
        }
    },

    OnUse(player) {
        // Override in custom scripts for item-specific behavior
        return undefined;
    }
};

export default ItemScript;
