import { Schema, MapSchema, type } from '@colyseus/schema';

/**
 * Player state schema
 * Automatically synced to all clients
 */
export class PlayerState extends Schema {
    @type('string')
    id: string = '';

    @type('string')
    name: string = 'Player';

    @type('number')
    x: number = 32;

    @type('number')
    y: number = 80;

    @type('number')
    z: number = 32;

    @type('number')
    rotationX: number = 0;

    @type('number')
    rotationY: number = 0;

    @type('string')
    animation: string = 'idle';

    @type('string')
    heldItem: string = '';

    @type('boolean')
    connected: boolean = true;
}

/**
 * Block change schema
 * Tracks all block modifications
 */
export class BlockChange extends Schema {
    @type('number')
    x: number = 0;

    @type('number')
    y: number = 0;

    @type('number')
    z: number = 0;

    @type('string')
    blockType: string = '';

    @type('number')
    timestamp: number = 0;
}

/**
 * Game state schema
 * Root state for the game room
 */
export class GameState extends Schema {
    @type('number')
    worldSeed: number = Math.floor(Math.random() * 1000000);

    @type({ map: PlayerState })
    players = new MapSchema<PlayerState>();

    @type([BlockChange])
    blockChanges = new Array<BlockChange>();

    @type('number')
    maxBlockHistory: number = 1000; // Keep last 1000 block changes

    /**
     * Add a block change to history
     */
    addBlockChange(x: number, y: number, z: number, blockType: string) {
        const change = new BlockChange();
        change.x = x;
        change.y = y;
        change.z = z;
        change.blockType = blockType;
        change.timestamp = Date.now();

        this.blockChanges.push(change);

        // Limit history size
        if (this.blockChanges.length > this.maxBlockHistory) {
            this.blockChanges.shift();
        }
    }
}
