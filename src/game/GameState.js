/**
 * GameState centralizes the state of the game.
 * This includes flags, selection state, and debug settings.
 * It helps decouple logic that otherwise relies on VoxelGame properties.
 */
export class GameState {
    constructor(game) {
        this.game = game;

        // Interactive State
        this.flags = {
            inventoryOpen: false,
            paused: false,
            isPointerLocked: false,
            isTimeStopped: false
        };

        // Timers for time-based effects
        this.timers = {
            timeStop: 0
        };

        // Selection State
        this.selection = {
            slot: 0,
            block: 'grass' // Default block
        };

        // Debug Flags (Moved from VoxelGame)
        this.debug = {
            animals: true,
            chunks: true,
            environment: true,
            particles: true
        };
    }
}
