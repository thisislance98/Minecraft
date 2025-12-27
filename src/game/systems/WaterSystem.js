/**
 * WaterSystem - Handles water flow propagation
 * 
 * Water mechanics:
 * - Source blocks (level 0) are placed by players
 * - Water flows to adjacent air blocks at same or lower height
 * - Flow level increases with distance (0-7, stops at 7)
 * - Water prioritizes flowing downward
 */
export class WaterSystem {
    constructor(game) {
        this.game = game;

        // Track water sources and their flow levels
        // Key: "x,y,z", Value: { level: 0-7, isSource: boolean }
        this.waterBlocks = new Map();

        // Blocks that can be replaced by water
        this.replaceableBlocks = new Set([
            null, 'air', 'long_grass', 'flower_red', 'flower_yellow',
            'mushroom_red', 'mushroom_brown', 'dead_bush', 'fern', 'flower_blue'
        ]);

        // Throttle updates for performance
        this.updateInterval = 2.0; // seconds
        this.timeSinceUpdate = 0;

        // Queue for water blocks to process
        this.updateQueue = [];
        this.enabled = true;
    }

    /**
     * Get block key string
     */
    getKey(x, y, z) {
        return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    }

    /**
     * Parse key back to coordinates
     */
    parseKey(key) {
        const [x, y, z] = key.split(',').map(Number);
        return { x, y, z };
    }

    /**
     * Place a water source block
     */
    placeWaterSource(x, y, z) {
        x = Math.floor(x);
        y = Math.floor(y);
        z = Math.floor(z);

        const key = this.getKey(x, y, z);

        // Check if position is valid (air or replaceable)
        const existingBlock = this.game.getBlock(x, y, z);
        const existingType = existingBlock?.type || null;

        if (!this.replaceableBlocks.has(existingType) && existingType !== 'water') {
            return false;
        }

        // Place water block in world
        this.game.setBlock(x, y, z, 'water', false, true); // skipBroadcast - water flow is deterministic

        // Track as source
        this.waterBlocks.set(key, { level: 0, isSource: true });

        // Queue for spreading
        this.updateQueue.push({ x, y, z, level: 0 });

        return true;
    }

    /**
     * Check if water can flow to a position
     */
    canFlowTo(x, y, z) {
        const block = this.game.getBlock(x, y, z);
        const blockType = block?.type || null;

        // Can flow into air or replaceable blocks
        if (this.replaceableBlocks.has(blockType)) {
            return true;
        }

        // Can flow into water with higher level (to create flow path)
        if (blockType === 'water') {
            const key = this.getKey(x, y, z);
            const existing = this.waterBlocks.get(key);
            return existing && !existing.isSource; // Can update non-source water
        }

        return false;
    }

    /**
     * Spread water from a block
     */
    spreadFrom(x, y, z, level) {
        // Don't spread if at max level
        if (level >= 7) return;

        const nextLevel = level + 1;

        // First, try to flow down (priority)
        const belowY = y - 1;
        if (belowY >= 0) {
            if (this.canFlowTo(x, belowY, z)) {
                const key = this.getKey(x, belowY, z);
                const existing = this.waterBlocks.get(key);

                // Downward flow resets level to 1 (or updates if better path)
                if (!existing || existing.level > 1) {
                    this.game.setBlock(x, belowY, z, 'water', false, true); // skipBroadcast
                    this.waterBlocks.set(key, { level: 1, isSource: false });
                    this.updateQueue.push({ x, y: belowY, z, level: 1 });
                }
            }
        }

        // Spread horizontally (N, S, E, W)
        const horizontalDirs = [
            { dx: 1, dz: 0 },
            { dx: -1, dz: 0 },
            { dx: 0, dz: 1 },
            { dx: 0, dz: -1 }
        ];

        for (const { dx, dz } of horizontalDirs) {
            const nx = x + dx;
            const nz = z + dz;

            if (this.canFlowTo(nx, y, nz)) {
                const key = this.getKey(nx, y, nz);
                const existing = this.waterBlocks.get(key);

                // Only update if this path is shorter
                if (!existing || existing.level > nextLevel) {
                    this.game.setBlock(nx, y, nz, 'water', false, true); // skipBroadcast
                    this.waterBlocks.set(key, { level: nextLevel, isSource: false });
                    this.updateQueue.push({ x: nx, y, z: nz, level: nextLevel });
                }
            }
        }
    }

    /**
     * Main update loop - called from game animate()
     */
    update(deltaTime) {
        if (!this.enabled) return;

        this.timeSinceUpdate += deltaTime;

        if (this.timeSinceUpdate < this.updateInterval) {
            return;
        }

        this.timeSinceUpdate = 0;

        // Process queued updates (limit per tick for performance)
        const maxUpdatesPerTick = 50;
        let processed = 0;

        while (this.updateQueue.length > 0 && processed < maxUpdatesPerTick) {
            const { x, y, z, level } = this.updateQueue.shift();
            this.spreadFrom(x, y, z, level);
            processed++;
        }
    }

    /**
     * Remove water source and recalculate flow
     */
    removeWaterSource(x, y, z) {
        x = Math.floor(x);
        y = Math.floor(y);
        z = Math.floor(z);

        const key = this.getKey(x, y, z);
        const waterBlock = this.waterBlocks.get(key);

        if (waterBlock && waterBlock.isSource) {
            this.waterBlocks.delete(key);
            this.game.setBlock(x, y, z, null, false, true); // skipBroadcast

            // TODO: Recalculate dependent water blocks
            // For simplicity, non-source blocks will dry up over time
            // or when a source is removed
        }
    }

    /**
     * Check if a position has water
     */
    hasWater(x, y, z) {
        const key = this.getKey(x, y, z);
        return this.waterBlocks.has(key);
    }

    /**
     * Get water level at position (0 = source, 7 = max spread)
     */
    getWaterLevel(x, y, z) {
        const key = this.getKey(x, y, z);
        const water = this.waterBlocks.get(key);
        return water ? water.level : -1;
    }
}
