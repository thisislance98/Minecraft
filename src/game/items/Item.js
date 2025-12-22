
export class Item {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.maxStack = 64;
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
}
