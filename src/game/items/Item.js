
export class Item {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.maxStack = 64;
        this.isTool = false;
    }

    /**
     * Called when the user presses the 'Use' button (Right Click)
     * @returns {boolean} true if the action was handled, false otherwise
     */
    onUseDown(game, player) {
        return false;
    }

    /**
     * Called when the user releases the 'Use' button (Right Click)
     * @returns {boolean} true if the action was handled, false otherwise
     */
    onUseUp(game, player) {
        return false;
    }

    /**
     * Called when the user presses the 'Primary' button (Left Click)
     * @returns {boolean} true if the action was handled, false otherwise
     */
    onPrimaryDown(game, player) {
        return false;
    }

    /**
     * Returns a 3D mesh representation of this item for the UI preview or dropping.
     * @returns {THREE.Object3D}
     */
    getMesh() {
        // Default: A simple box representing a generic item
        // Subclasses should override this
        const geometry = new window.THREE.BoxGeometry(0.5, 0.5, 0.5);
        const material = new window.THREE.MeshStandardMaterial({ color: 0x888888 });
        return new window.THREE.Mesh(geometry, material);
    }
}
