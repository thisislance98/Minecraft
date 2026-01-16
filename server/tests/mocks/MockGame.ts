/**
 * MockGame - Simulates game state for testing AI tools
 * This allows testing tool execution logic without a browser or real game
 */
export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

export interface Creature {
    type: string;
    position: Vector3;
    id: string;
}

export interface PlayerState {
    position: Vector3;
    rotation: { x: number; y: number };
    health: number;
    heldItem: string;
}

export interface SceneInfo {
    playerPosition: Vector3;
    playerRotation: { x: number; y: number };
    biome: string;
    timeOfDay: string;
    nearbyCreatures: Creature[];
    lookingAt: { type: string; position: Vector3 } | null;
}

/**
 * Mock game state that simulates the actual game for testing
 */
export class MockGame {
    player: PlayerState;
    creatures: Creature[] = [];
    blocks: Map<string, string> = new Map();
    biomes: Map<string, string>;
    private creatureIdCounter = 0;

    constructor() {
        this.player = {
            position: { x: 32, y: 80, z: 32 },
            rotation: { x: 0, y: 0 },
            health: 20,
            heldItem: 'pickaxe'
        };

        // Define biome locations (same as real game)
        this.biomes = new Map([
            ['spawn', 'plains'],
            ['desert', 'desert'],
            ['ocean', 'ocean'],
            ['forest', 'forest'],
            ['jungle', 'jungle'],
            ['mountain', 'mountain'],
            ['snow', 'snow'],
            ['plains', 'plains']
        ]);
    }

    /**
     * Get the biome at a given position
     */
    getBiomeAt(x: number, z: number): string {
        // Simplified biome detection based on position ranges
        if (x > 200) return 'desert';
        if (x < -200) return 'snow';
        if (z > 200) return 'ocean';
        if (z < -200) return 'jungle';
        return 'plains';
    }

    /**
     * Teleport player to a named location or coordinates
     */
    teleportPlayer(location: string): { success: boolean; message: string; position?: Vector3 } {
        // Check for named locations first
        const namedLocations: Record<string, Vector3> = {
            spawn: { x: 32, y: 80, z: 32 },
            desert: { x: 250, y: 65, z: 0 },
            ocean: { x: 0, y: 63, z: 250 },
            forest: { x: 100, y: 70, z: 100 },
            jungle: { x: 0, y: 70, z: -250 },
            mountain: { x: -100, y: 120, z: -100 },
            snow: { x: -250, y: 75, z: 0 },
            plains: { x: 0, y: 70, z: 0 }
        };

        const lowerLocation = location.toLowerCase();

        if (namedLocations[lowerLocation]) {
            this.player.position = { ...namedLocations[lowerLocation] };
            return {
                success: true,
                message: `Teleported to ${lowerLocation}`,
                position: this.player.position
            };
        }

        // Try parsing as coordinates
        const coordMatch = location.match(/(-?\d+),?\s*(-?\d+),?\s*(-?\d+)/);
        if (coordMatch) {
            const x = parseInt(coordMatch[1]);
            const y = parseInt(coordMatch[2]);
            const z = parseInt(coordMatch[3]);
            this.player.position = { x, y, z };
            return {
                success: true,
                message: `Teleported to coordinates (${x}, ${y}, ${z})`,
                position: this.player.position
            };
        }

        return {
            success: false,
            message: `Unknown location: ${location}`
        };
    }

    /**
     * Spawn a creature near the player
     */
    spawnCreature(creatureType: string, count: number = 1): {
        success: boolean;
        message: string;
        creatures?: Creature[];
        notFound?: boolean;
    } {
        const knownCreatures = [
            'pig', 'horse', 'chicken', 'bunny', 'wolf', 'bear', 'lion', 'tiger',
            'elephant', 'giraffe', 'deer', 'sheep', 'cow', 'zombie', 'skeleton',
            'creeper', 'enderman', 'unicorn', 'trex', 'owl', 'fox', 'panda',
            'dolphin', 'penguin', 'snowman', 'santaclaus', 'kangaroo', 'robot', 'cybertruck'
        ];

        const lowerType = creatureType.toLowerCase();

        // Check if creature is known
        if (!knownCreatures.includes(lowerType)) {
            return {
                success: false,
                message: `Creature "${creatureType}" not found`,
                notFound: true
            };
        }

        const spawnedCreatures: Creature[] = [];
        const clampedCount = Math.min(10, Math.max(1, count));

        for (let i = 0; i < clampedCount; i++) {
            const offsetX = (Math.random() - 0.5) * 10;
            const offsetZ = (Math.random() - 0.5) * 10;

            const creature: Creature = {
                type: creatureType,
                position: {
                    x: this.player.position.x + offsetX,
                    y: this.player.position.y,
                    z: this.player.position.z + offsetZ
                },
                id: `creature_${++this.creatureIdCounter}`
            };

            this.creatures.push(creature);
            spawnedCreatures.push(creature);
        }

        return {
            success: true,
            message: `Spawned ${clampedCount} ${creatureType}(s)`,
            creatures: spawnedCreatures
        };
    }

    /**
     * Get scene information
     */
    getSceneInfo(): SceneInfo {
        const biome = this.getBiomeAt(this.player.position.x, this.player.position.z);

        // Find nearby creatures (within 50 units)
        const nearbyCreatures = this.creatures.filter(c => {
            const dx = c.position.x - this.player.position.x;
            const dz = c.position.z - this.player.position.z;
            return Math.sqrt(dx * dx + dz * dz) < 50;
        });

        return {
            playerPosition: { ...this.player.position },
            playerRotation: { ...this.player.rotation },
            biome,
            timeOfDay: 'day',
            nearbyCreatures,
            lookingAt: null
        };
    }

    /**
     * Reset game state for testing
     */
    reset(): void {
        this.player = {
            position: { x: 32, y: 80, z: 32 },
            rotation: { x: 0, y: 0 },
            health: 20,
            heldItem: 'pickaxe'
        };
        this.creatures = [];
        this.blocks.clear();
        this.creatureIdCounter = 0;
    }
}
