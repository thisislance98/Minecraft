import * as THREE from 'three';
import { SeededRandom } from '../../utils/SeededRandom.js';
import {
    Pig, Horse, Chicken, Bunny, Frog, Wolf, Elephant, Lion, Bear, Tiger,
    Deer, Giraffe, Fish, Turtle, Duck, Squirrel, Monkey, Reindeer, Sheep,
    Goat, Turkey, Mouse, Snake, Zombie, Skeleton, Enderman, Creeper, Kangaroo, Pugasus, Cow, Snowman, Owl, SantaClaus, Unicorn,
    Panda, Camel, Snail, Fox, FennecFox,
    Ladybug, Toucan, Gymnast, MagicalCreature, Raccoon, Shark, TRex, Lampost, Pumpkin, Lorax, Penguin, Dolphin, Snowflake
} from '../AnimalRegistry.js';
/**
 * SpawnManager handles all animal spawning logic.
 * Uses a config-driven approach for biome-specific spawns.
 */
export class SpawnManager {
    constructor(game) {
        this.game = game;
        this.game = game;
        this.spawnedChunks = new Set();
        this.isSpawningEnabled = true;
        this.allowedAnimals = new Set(); // If empty, all allowed. If not empty, only those in set.
        // Actually, better to default to ALL allowed.
        // Let's use a flag or assume if it's in the set it's allowed.
        // DebugPanel initializes it with all keys.
        // So let's initialize it empty and say "empty means all"? Or just logic in DebugPanel?
        // Let's make it robust:
        this.allowedAnimals = null; // null = all allowed. Set = filter.


        // Biome spawn configuration
        // Each entry: { class, weight (0-1), packSize: [min, max] }
        this.biomeSpawnConfig = {
            OCEAN: [
                { class: Fish, weight: 0.5, packSize: [3, 7] },
                { class: Shark, weight: 0.1, packSize: [1, 2] },
                { class: Turtle, weight: 0.2, packSize: [1, 2] },
                { class: Dolphin, weight: 0.2, packSize: [3, 6] }
            ],
            BEACH: [
                { class: Turtle, weight: 0.3, packSize: [1, 2] },
                { class: Duck, weight: 0.3, packSize: [2, 4] }
            ],
            PLAINS: [
                { class: Horse, weight: 0.25, packSize: [3, 6] },
                { class: Pig, weight: 0.15, packSize: [2, 4] },
                { class: Chicken, weight: 0.15, packSize: [4, 7] },
                { class: Bunny, weight: 0.2, packSize: [2, 4] },
                { class: Fish, weight: 0.15, packSize: [3, 5] },
                { class: Duck, weight: 0.1, packSize: [2, 4] },
                { class: Duck, weight: 0.1, packSize: [2, 4] },
                { class: Sheep, weight: 0.2, packSize: [3, 5] },
                { class: Turkey, weight: 0.1, packSize: [2, 4] },
                { class: Mouse, weight: 0.15, packSize: [2, 4] },
                { class: Snake, weight: 0.1, packSize: [1, 3] },
                { class: Kangaroo, weight: 0.15, packSize: [2, 5] },
                { class: Cow, weight: 0.2, packSize: [2, 5] },
                { class: Fox, weight: 0.1, packSize: [1, 2] },
                { class: Ladybug, weight: 0.15, packSize: [3, 6] },
                { class: Gymnast, weight: 0.05, packSize: [1, 2] },
                { class: Raccoon, weight: 0.08, packSize: [1, 2] }
            ],
            FOREST: [
                { class: Wolf, weight: 0.05, packSize: [2, 4] },
                { class: Bear, weight: 0.05, packSize: [1, 2] },
                { class: Deer, weight: 0.05, packSize: [2, 4] },
                { class: Squirrel, weight: 0.05, packSize: [3, 5] },
                { class: Duck, weight: 0.05, packSize: [2, 4] },
                { class: Chicken, weight: 0.05, packSize: [4, 7] },
                { class: Pig, weight: 0.05, packSize: [2, 4] },
                { class: Bunny, weight: 0.05, packSize: [2, 4] },
                { class: Lion, weight: 0.05, packSize: [1, 2] },
                { class: Tiger, weight: 0.05, packSize: [1, 2] },
                { class: Elephant, weight: 0.05, packSize: [1, 2] },
                { class: Giraffe, weight: 0.05, packSize: [1, 2] },
                { class: Horse, weight: 0.05, packSize: [3, 5] },
                { class: Monkey, weight: 0.05, packSize: [3, 5] },
                { class: Frog, weight: 0.05, packSize: [2, 4] },
                { class: Reindeer, weight: 0.05, packSize: [2, 4] },
                { class: Turtle, weight: 0.05, packSize: [1, 2] },
                { class: Turkey, weight: 0.1, packSize: [2, 4] },
                { class: Mouse, weight: 0.05, packSize: [2, 4] },
                { class: Snake, weight: 0.08, packSize: [1, 2] },
                { class: Cow, weight: 0.08, packSize: [2, 4] },
                { class: Snail, weight: 0.1, packSize: [2, 4] },
                // Some fish for water patches
                { class: Fish, weight: 0.05, packSize: [2, 4] },
                { class: Fox, weight: 0.08, packSize: [1, 3] },
                { class: Ladybug, weight: 0.1, packSize: [2, 5] },
                { class: Toucan, weight: 0.08, packSize: [2, 4] },
                { class: Raccoon, weight: 0.08, packSize: [1, 3] }
            ],
            JUNGLE: [
                { class: Monkey, weight: 0.3, packSize: [3, 6] },
                { class: Tiger, weight: 0.15, packSize: [1, 2] },
                { class: Frog, weight: 0.3, packSize: [2, 4] },
                { class: Fish, weight: 0.15, packSize: [3, 5] },
                { class: Turtle, weight: 0.1, packSize: [1, 2] },
                { class: Snake, weight: 0.2, packSize: [2, 4] },
                { class: Panda, weight: 0.15, packSize: [1, 2] },
                { class: Snail, weight: 0.15, packSize: [2, 5] },
                { class: Toucan, weight: 0.25, packSize: [3, 5] }
            ],
            DESERT: [
                { class: Bunny, weight: 0.3, packSize: [1, 3] },
                { class: Snake, weight: 0.4, packSize: [1, 2] },
                { class: Kangaroo, weight: 0.3, packSize: [2, 4] },
                { class: Camel, weight: 0.35, packSize: [2, 4] },
                { class: FennecFox, weight: 0.25, packSize: [2, 4] }
            ],
            SNOW: [
                { class: Reindeer, weight: 0.3, packSize: [3, 5] },
                { class: Bear, weight: 0.15, packSize: [1, 1] },
                { class: Wolf, weight: 0.25, packSize: [2, 4] },
                { class: Snowman, weight: 0.3, packSize: [1, 3] },
                { class: Penguin, weight: 0.4, packSize: [3, 8] },
                { class: SantaClaus, weight: 0.1, packSize: [1, 1] },
                { class: Snowflake, weight: 0.2, packSize: [1, 3] }
            ],
            MOUNTAIN: [
                { class: Reindeer, weight: 0.3, packSize: [2, 4] },
                { class: Sheep, weight: 0.4, packSize: [2, 4] },
                { class: Sheep, weight: 0.4, packSize: [2, 4] },
                { class: Goat, weight: 0.3, packSize: [1, 3] },
                { class: SantaClaus, weight: 0.05, packSize: [1, 1] }
            ]
        };

        // Rare spawns (can occur in any biome)
        this.rareSpawns = [
            { class: Elephant, weight: 0.02, packSize: [1, 2] },
            { class: Giraffe, weight: 0.02, packSize: [1, 2] },
            { class: Lion, weight: 0.02, packSize: [1, 2], biomes: ['PLAINS', 'DESERT'] },
            { class: Lion, weight: 0.02, packSize: [1, 2], biomes: ['PLAINS', 'DESERT'] },
            { class: Pugasus, weight: 0.03, packSize: [1, 2] }, // Mythical chimera creature!
            { class: Unicorn, weight: 0.02, packSize: [1, 2], biomes: ['PLAINS', 'FOREST'] },
            { class: MagicalCreature, weight: 0.03, packSize: [1, 2], biomes: ['PLAINS', 'FOREST', 'JUNGLE'] }, // Unicorn-fox-toucan hybrid!
            { class: TRex, weight: 0.02, packSize: [1, 1], biomes: ['JUNGLE', 'FOREST', 'PLAINS'] }, // HUGE T-REX
            { class: Lampost, weight: 0.04, packSize: [1, 1], biomes: ['PLAINS', 'FOREST', 'SNOW'] }, // Walking Lampost (Narnia vibes)
            { class: Pumpkin, weight: 0.05, packSize: [3, 5], biomes: ['FOREST', 'PLAINS'] }, // Flying Pumpkins
            { class: Lorax, weight: 0.1, packSize: [1, 1], biomes: ['FOREST'] }, // Speaks for the trees!
            { class: Snowflake, weight: 0.05, packSize: [1, 2], biomes: ['SNOW', 'MOUNTAIN'] }
        ];

        // Hostile mobs (spawn always now for testing)
        this.hostileMobs = [
            { class: Zombie, weight: 0.4, packSize: [2, 4] },
            { class: Skeleton, weight: 0.25, packSize: [1, 3] },
            { class: Creeper, weight: 0.25, packSize: [1, 2] },
            { class: Enderman, weight: 0.1, packSize: [1, 1] }
        ];
    }

    /**
     * Spawn animals in a chunk area around the given center.
     * @param {number} centerCX - Center chunk X
     * @param {number} centerCZ - Center chunk Z
     * @param {number} chunkRange - Number of chunks in each direction
     */
    spawnAnimalsInArea(centerCX, centerCZ, chunkRange) {
        // Initial spawn
        for (let cx = centerCX - chunkRange; cx <= centerCX + chunkRange; cx++) {
            for (let cz = centerCZ - chunkRange; cz <= centerCZ + chunkRange; cz++) {
                this.spawnChunk(cx, cz);
            }
        }
    }

    spawnChunk(cx, cz) {
        const key = `${cx},${cz} `;
        if (this.spawnedChunks.has(key)) return;
        this.spawnedChunks.add(key);

        // Global toggle
        if (!this.isSpawningEnabled) return;

        // Cap max entities
        if (this.game.animals.length > 200) return;

        // Create deterministic RNG for this chunk
        const chunkRng = SeededRandom.fromSeeds(this.game.worldSeed, cx, cz, 1);

        // 25% chance per chunk to spawn something (increased from 20%)
        if (chunkRng.next() > 0.25) return;

        const chunkSize = this.game.chunkSize;
        const worldGen = this.game.worldGen;

        // Pick a random block in this chunk (deterministic)
        const bx = cx * chunkSize + Math.floor(chunkRng.next() * chunkSize);
        const bz = cz * chunkSize + Math.floor(chunkRng.next() * chunkSize);
        const biome = worldGen.getBiome(bx, bz);

        console.log(`Spawning attempt in chunk ${cx}, ${cz} (Biome: ${biome})`);

        // Spawn biome-specific animals
        const config = this.biomeSpawnConfig[biome];
        if (config) {
            this.trySpawnFromConfig(config, bx, bz, biome, chunkRng);
        }

        // Rare spawns
        for (const rare of this.rareSpawns) {
            if (rare.biomes && !rare.biomes.includes(biome)) continue;
            if (chunkRng.next() < rare.weight) {
                this.spawnPack(rare.class, rare.packSize, bx, bz, chunkRng);
            }
        }

        // Hostile mob spawns
        this.trySpawnHostile(bx, bz, chunkRng);
    }

    trySpawnHostile(bx, bz, rng) {
        // Only 10% chance for a hostile pack per successful spawn event
        if (rng.next() > 0.1) return;

        const roll = rng.next();
        let cumulative = 0;

        for (const entry of this.hostileMobs) {
            // Check allowed list
            if (this.allowedAnimals && !this.allowedAnimals.has(entry.class.name)) {
                continue;
            }

            cumulative += entry.weight;
            if (roll < cumulative) {
                this.spawnPack(entry.class, entry.packSize, bx, bz, rng);
                break;
            }
        }
    }

    trySpawnFromConfig(config, bx, bz, biome, rng) {
        const roll = rng.next();
        let cumulative = 0;

        for (const entry of config) {
            // Check allowed list
            if (this.allowedAnimals && !this.allowedAnimals.has(entry.class.name)) {
                continue;
            }

            cumulative += entry.weight;
            if (roll < cumulative) {
                this.spawnPack(entry.class, entry.packSize, bx, bz, rng);
                break;
            }
        }
    }

    spawnPack(AnimalClass, packSizeRange, baseX, baseZ, rng) {
        const [minSize, maxSize] = packSizeRange;
        const count = minSize + Math.floor(rng.next() * (maxSize - minSize + 1));
        const worldGen = this.game.worldGen;

        for (let i = 0; i < count; i++) {
            const x = baseX + (rng.next() - 0.5) * 10;
            const z = baseZ + (rng.next() - 0.5) * 10;
            const terrainY = worldGen.getTerrainHeight(x, z);

            // Aquatic check
            const isAquatic = (AnimalClass === Fish || AnimalClass === Turtle || AnimalClass === Duck || AnimalClass === Shark || AnimalClass === Dolphin);

            if (AnimalClass === Fish || AnimalClass === Shark || AnimalClass === Dolphin) {
                // Fish spawn underwater
                if (terrainY < worldGen.seaLevel) {
                    const waterY = worldGen.seaLevel - 1 - rng.next() * (worldGen.seaLevel - terrainY);
                    this.createAnimal(AnimalClass, x, waterY, z);
                }
            } else if (AnimalClass === Monkey || AnimalClass === Squirrel) {
                // Monkeys and Squirrels spawn in trees - find actual tree blocks
                const treePos = this.findTreeSpawnPosition(x, z, terrainY);
                if (treePos) {
                    this.createAnimal(AnimalClass, treePos.x, treePos.y, treePos.z);
                }

            } else if (isAquatic && terrainY < worldGen.seaLevel) {
                // Spawning at surface for ducks/turtles if in valid water column
                this.createAnimal(AnimalClass, x, worldGen.seaLevel, z);
            } else {
                // Standard land animal
                const y = terrainY + 1;
                // If it's a land animal (not aquatic), don't spawn in water
                if (!isAquatic && y <= worldGen.seaLevel + 1) continue;
                this.createAnimal(AnimalClass, x, y, z);
            }
        }
    }

    /**
     * Find a valid tree position for tree-dwelling animals
     */
    findTreeSpawnPosition(baseX, baseZ, terrainY) {
        const searchRadius = 12;

        // Search in a spiral pattern for tree blocks
        for (let radius = 0; radius <= searchRadius; radius += 2) {
            for (let dx = -radius; dx <= radius; dx += 2) {
                for (let dz = -radius; dz <= radius; dz += 2) {
                    const x = Math.floor(baseX + dx);
                    const z = Math.floor(baseZ + dz);

                    // Search upward from terrain for tree blocks
                    for (let dy = 3; dy <= 20; dy++) {
                        const y = Math.floor(terrainY + dy);
                        const block = this.game.getBlock(x, y, z);

                        if (block && (block.type.includes('leaves') || block.type.includes('wood') || block.type.includes('log'))) {
                            // Check if there's space above for the animal
                            const aboveBlock = this.game.getBlock(x, y + 1, z);
                            if (!aboveBlock || aboveBlock.type.includes('leaves')) {
                                return { x: x + 0.5, y: y + 1, z: z + 0.5 };
                            }
                        }
                    }
                }
            }
        }
        return null; // No tree found, don't spawn
    }

    createAnimal(AnimalClass, x, y, z) {
        const animal = new AnimalClass(this.game, x, y, z);
        this.game.animals.push(animal);
        this.game.scene.add(animal.mesh);
    }

    /**
     * Spawn kangaroos near the player's starting position
     */
    spawnKangaroosNearPlayer() {
        const player = this.game.player;
        const worldGen = this.game.worldGen;

        // Create deterministic RNG for initial spawns
        const rng = SeededRandom.fromSeeds(this.game.worldSeed, 1001);
        const count = 3 + Math.floor(rng.next() * 3); // 3-5 kangaroos

        console.log(`Spawning ${count} kangaroos near player spawn`);

        for (let i = 0; i < count; i++) {
            // Random position 10-25 blocks away from player
            const angle = rng.next() * Math.PI * 2;
            const distance = 10 + rng.next() * 15;
            const x = player.position.x + Math.cos(angle) * distance;
            const z = player.position.z + Math.sin(angle) * distance;
            const terrainY = worldGen.getTerrainHeight(x, z);
            const y = terrainY + 1;

            // Only spawn on valid land (above sea level)
            if (y > worldGen.seaLevel + 1) {
                this.createAnimal(Kangaroo, x, y, z);
            }
        }
    }

    /**
     * Spawn Pugasus creatures near the player's starting position
     * These mythical chimera creatures greet the player!
     */
    spawnPugasusNearPlayer() {
        const player = this.game.player;
        const worldGen = this.game.worldGen;

        // Create deterministic RNG for initial spawns
        const rng = SeededRandom.fromSeeds(this.game.worldSeed, 1002);
        const count = 2 + Math.floor(rng.next() * 2); // 2-3 Pugasus

        console.log(`Spawning ${count} Pugasus near player spawn`);

        for (let i = 0; i < count; i++) {
            // Random position 8-20 blocks away from player
            const angle = rng.next() * Math.PI * 2;
            const distance = 8 + rng.next() * 12;
            const x = player.position.x + Math.cos(angle) * distance;
            const z = player.position.z + Math.sin(angle) * distance;
            const terrainY = worldGen.getTerrainHeight(x, z);
            const y = terrainY + 1;

            // Only spawn on valid land (above sea level)
            if (y > worldGen.seaLevel + 1) {
                this.createAnimal(Pugasus, x, y, z);
            }
        }
    }

    /**
     * Spawn friendly Snowmen near the player's starting position
     * These festive friends walk around and talk with speech bubbles!
     */
    spawnSnowmenNearPlayer() {
        const player = this.game.player;
        const worldGen = this.game.worldGen;

        // Create deterministic RNG for initial spawns
        const rng = SeededRandom.fromSeeds(this.game.worldSeed, 1003);
        const count = 2 + Math.floor(rng.next() * 2); // 2-3 Snowmen

        console.log(`Spawning ${count} Snowmen near player spawn`);

        for (let i = 0; i < count; i++) {
            // Random position 6-15 blocks away from player
            const angle = rng.next() * Math.PI * 2;
            const distance = 6 + rng.next() * 9;
            const x = player.position.x + Math.cos(angle) * distance;
            const z = player.position.z + Math.sin(angle) * distance;
            const terrainY = worldGen.getTerrainHeight(x, z);
            const y = terrainY + 1;

            // Only spawn on valid land (above sea level)
            if (y > worldGen.seaLevel + 1) {
                this.createAnimal(Snowman, x, y, z);
            }
        }
    }

    /**
     * Spawn entities in front of the player (Debug function)
     * @param {Class} EntityClass - Class to spawn
     * @param {number} count - How many
     */
    spawnEntitiesInFrontOfPlayer(EntityClass, count) {
        if (!EntityClass) return;

        const player = this.game.player;
        const dist = 5;

        // Get direction player is facing
        const dir = new THREE.Vector3();
        this.game.camera.getWorldDirection(dir);
        dir.y = 0; // Keep flat
        dir.normalize();

        // Center point
        const cx = player.position.x + dir.x * dist;
        const cz = player.position.z + dir.z * dist;
        const cy = this.game.player.position.y;

        // Use Math.random() for debug spawns - these are player-triggered, not world-gen
        for (let i = 0; i < count; i++) {
            // Spread slightly
            const ox = (Math.random() - 0.5) * (count > 1 ? 4 : 0);
            const oz = (Math.random() - 0.5) * (count > 1 ? 4 : 0);

            // Adjust Y to terrain if needed, or drop from sky
            // Let's spawn slightly above player level or terrain level
            const tx = cx + ox;
            const tz = cz + oz;
            const terrainH = this.game.worldGen.getTerrainHeight(tx, tz);
            const spawnY = Math.max(cy, terrainH + 1);

            this.createAnimal(EntityClass, tx, spawnY, tz);
        }
        console.log(`Debug spawned ${count} ${EntityClass.name}`);
    }
}
