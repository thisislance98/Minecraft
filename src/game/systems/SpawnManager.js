import * as THREE from 'three';
import { SeededRandom } from '../../utils/SeededRandom.js';
import { Blocks } from '../core/Blocks.js';
import { AnimalClasses } from '../AnimalRegistry.js';

/**
 * SpawnManager handles all animal spawning logic.
 * Uses a config-driven approach for biome-specific spawns.
 */
export class SpawnManager {
    constructor(game) {
        this.game = game;

        this.spawnedChunks = new Set();
        this.isSpawningEnabled = true;
        // Initialize Sync State
        // If offline, we are ready immediately. If online, wait for server.
        this.waitingForInitialSync = !this.game.isOffline;

        this.allowedAnimals = null; // null = all allowed. Set = filter.

        // Deferred spawning - wait until world is ready
        this.isWorldReady = false;
        this.pendingSpawns = []; // Queue of {cx, cz} to spawn when world is ready


        // Biome spawn configuration
        // Each entry: { type: 'ClassName', weight (0-1), packSize: [min, max] }
        this.biomeSpawnConfig = {
            OCEAN: [
                { type: 'Fish', weight: 0.5, packSize: [3, 7] },
                { type: 'Shark', weight: 0.1, packSize: [1, 2] },
                { type: 'Turtle', weight: 0.2, packSize: [1, 2] },
                { type: 'Dolphin', weight: 0.2, packSize: [3, 6] }
            ],
            BEACH: [
                { type: 'Turtle', weight: 0.3, packSize: [1, 2] },
                { type: 'Duck', weight: 0.3, packSize: [2, 4] },
                { type: 'Flamingo', weight: 0.3, packSize: [2, 5] }
            ],
            PLAINS: [
                { type: 'Horse', weight: 0.25, packSize: [3, 6] },
                { type: 'Pig', weight: 0.15, packSize: [2, 4] },
                { type: 'Chicken', weight: 0.15, packSize: [4, 7] },
                { type: 'Bunny', weight: 0.2, packSize: [2, 4] },
                { type: 'Fish', weight: 0.15, packSize: [3, 5] },
                { type: 'Duck', weight: 0.1, packSize: [2, 4] },
                { type: 'Sheep', weight: 0.2, packSize: [3, 5] },
                { type: 'Turkey', weight: 0.1, packSize: [2, 4] },
                { type: 'Mouse', weight: 0.15, packSize: [2, 4] },
                { type: 'Snake', weight: 0.1, packSize: [1, 3] },
                { type: 'Kangaroo', weight: 0.15, packSize: [2, 5] },
                { type: 'Cow', weight: 0.2, packSize: [2, 5] },
                { type: 'Fox', weight: 0.1, packSize: [1, 2] },
                { type: 'FireFox', weight: 0.05, packSize: [1, 1] },
                { type: 'Ladybug', weight: 0.15, packSize: [3, 6] },
                { type: 'Gymnast', weight: 0.05, packSize: [1, 2] },
                { type: 'Raccoon', weight: 0.08, packSize: [1, 2] },
                { type: 'WienerDog', weight: 0.15, packSize: [2, 3] },
                { type: 'GoldenRetriever', weight: 0.2, packSize: [1, 2] }
            ],
            FOREST: [
                { type: 'Wolf', weight: 0.05, packSize: [2, 4] },
                { type: 'Bear', weight: 0.05, packSize: [1, 2] },
                { type: 'Deer', weight: 0.05, packSize: [2, 4] },
                { type: 'Squirrel', weight: 0.05, packSize: [3, 5] },
                { type: 'Duck', weight: 0.05, packSize: [2, 4] },
                { type: 'Chicken', weight: 0.05, packSize: [4, 7] },
                { type: 'Pig', weight: 0.05, packSize: [2, 4] },
                { type: 'Bunny', weight: 0.05, packSize: [2, 4] },
                { type: 'Lion', weight: 0.05, packSize: [1, 2] },
                { type: 'Tiger', weight: 0.05, packSize: [1, 2] },
                { type: 'Elephant', weight: 0.05, packSize: [1, 2] },
                { type: 'Giraffe', weight: 0.05, packSize: [1, 2] },
                { type: 'Horse', weight: 0.05, packSize: [3, 5] },
                { type: 'Monkey', weight: 0.05, packSize: [3, 5] },
                { type: 'Frog', weight: 0.05, packSize: [2, 4] },
                { type: 'Reindeer', weight: 0.05, packSize: [2, 4] },
                { type: 'Turtle', weight: 0.05, packSize: [1, 2] },
                { type: 'Turkey', weight: 0.1, packSize: [2, 4] },
                { type: 'Mouse', weight: 0.05, packSize: [2, 4] },
                { type: 'Snake', weight: 0.08, packSize: [1, 2] },
                { type: 'Cow', weight: 0.08, packSize: [2, 4] },
                { type: 'Snail', weight: 0.1, packSize: [2, 4] },
                // Some fish for water patches
                { type: 'Fish', weight: 0.05, packSize: [2, 4] },
                { type: 'Fox', weight: 0.08, packSize: [1, 3] },
                { type: 'Ladybug', weight: 0.1, packSize: [2, 5] },
                { type: 'Toucan', weight: 0.08, packSize: [2, 4] },
                { type: 'Raccoon', weight: 0.08, packSize: [1, 3] },
                { type: 'GoldenRetriever', weight: 0.1, packSize: [1, 2] }
            ],
            JUNGLE: [
                { type: 'Monkey', weight: 0.3, packSize: [3, 6] },
                { type: 'Tiger', weight: 0.15, packSize: [1, 2] },
                { type: 'Frog', weight: 0.3, packSize: [2, 4] },
                { type: 'Fish', weight: 0.15, packSize: [3, 5] },
                { type: 'Turtle', weight: 0.1, packSize: [1, 2] },
                { type: 'Snake', weight: 0.2, packSize: [2, 4] },
                { type: 'Worm', weight: 0.25, packSize: [3, 6] },
                { type: 'Panda', weight: 0.15, packSize: [1, 2] },
                { type: 'Snail', weight: 0.15, packSize: [2, 5] },
                { type: 'Toucan', weight: 0.25, packSize: [3, 5] },
                { type: 'Flamingo', weight: 0.1, packSize: [2, 4] },
                { type: 'Mouse', weight: 0.1, packSize: [2, 3] }
            ],
            DESERT: [
                { type: 'Bunny', weight: 0.3, packSize: [1, 3] },
                { type: 'Snake', weight: 0.4, packSize: [1, 2] },
                { type: 'Kangaroo', weight: 0.3, packSize: [2, 4] },
                { type: 'Camel', weight: 0.35, packSize: [2, 4] },
                { type: 'FennecFox', weight: 0.25, packSize: [2, 4] },
                { type: 'Mouse', weight: 0.15, packSize: [1, 3] }
            ],
            SNOW: [
                { type: 'Reindeer', weight: 0.3, packSize: [3, 5] },
                { type: 'Bear', weight: 0.15, packSize: [1, 1] },
                { type: 'Wolf', weight: 0.25, packSize: [2, 4] },
                { type: 'Snowman', weight: 0.3, packSize: [1, 3] },
                { type: 'Penguin', weight: 0.4, packSize: [3, 8] },
                { type: 'SantaClaus', weight: 0.1, packSize: [1, 1] },
                { type: 'Snowflake', weight: 0.2, packSize: [1, 3] }
            ],
            MOUNTAIN: [
                { type: 'Reindeer', weight: 0.3, packSize: [2, 4] },
                { type: 'Sheep', weight: 0.4, packSize: [2, 4] },
                { type: 'Goat', weight: 0.3, packSize: [1, 3] },
                { type: 'SantaClaus', weight: 0.05, packSize: [1, 1] }
            ]
        };

        // Rare spawns (can occur in any biome)
        this.rareSpawns = [
            { type: 'Elephant', weight: 0.02, packSize: [1, 2] },
            { type: 'Giraffe', weight: 0.02, packSize: [1, 2] },
            { type: 'Lion', weight: 0.02, packSize: [1, 2], biomes: ['PLAINS', 'DESERT'] },
            { type: 'Pugasus', weight: 0.03, packSize: [1, 2] }, // Mythical chimera creature!
            { type: 'Pegasus', weight: 0.03, packSize: [1, 2], biomes: ['PLAINS', 'MOUNTAIN', 'SNOW'] },
            { type: 'Unicorn', weight: 0.02, packSize: [1, 2], biomes: ['PLAINS', 'FOREST'] },
            { type: 'MagicalCreature', weight: 0.03, packSize: [1, 2], biomes: ['PLAINS', 'FOREST', 'JUNGLE'] }, // Unicorn-fox-toucan hybrid!
            { type: 'TRex', weight: 0.02, packSize: [1, 1], biomes: ['JUNGLE', 'FOREST', 'PLAINS'] }, // HUGE T-REX
            { type: 'Dragon', weight: 0.02, packSize: [1, 1], biomes: ['MOUNTAIN', 'SNOW', 'PLAINS', 'DESERT'] }, // Flying Dragons
            { type: 'Lampost', weight: 0.04, packSize: [1, 1], biomes: ['PLAINS', 'FOREST', 'SNOW'] }, // Walking Lampost (Narnia vibes)
            { type: 'Pumpkin', weight: 0.05, packSize: [3, 5], biomes: ['FOREST', 'PLAINS'] }, // Flying Pumpkins
            { type: 'Lorax', weight: 0.1, packSize: [1, 1], biomes: ['FOREST'] }, // Speaks for the trees!
            { type: 'Snowflake', weight: 0.05, packSize: [1, 2], biomes: ['SNOW', 'MOUNTAIN'] },
            { type: 'Chimera', weight: 0.03, packSize: [1, 1], biomes: ['PLAINS', 'JUNGLE', 'FOREST'] },
            { type: 'WienerDog', weight: 0.05, packSize: [1, 2], biomes: ['PLAINS', 'FOREST', 'DESERT'] },
            { type: 'GoldenRetriever', weight: 0.05, packSize: [1, 2], biomes: ['PLAINS', 'FOREST'] },
            { type: 'DuneWorm', weight: 0.05, packSize: [1, 1], biomes: ['DESERT'] },
            // Interactive Plants (Avatar-like)
            { type: 'HelicopterPlant', weight: 0.15, packSize: [3, 6], biomes: ['PLAINS', 'FOREST', 'JUNGLE'] },
            { type: 'ShyPlant', weight: 0.15, packSize: [4, 8], biomes: ['PLAINS', 'FOREST', 'JUNGLE'] },
            { type: 'CrystalPlant', weight: 0.1, packSize: [2, 5], biomes: ['MOUNTAIN', 'SNOW', 'DESERT'] },
            // NEW Interactive Plants
            { type: 'HummingBlossom', weight: 0.12, packSize: [2, 4], biomes: ['PLAINS', 'FOREST', 'JUNGLE'] },
            { type: 'BouncePod', weight: 0.10, packSize: [2, 5], biomes: ['FOREST', 'JUNGLE'] },
            { type: 'MimicVine', weight: 0.10, packSize: [3, 6], biomes: ['JUNGLE', 'FOREST'] },
            { type: 'SporeCloud', weight: 0.12, packSize: [3, 5], biomes: ['PLAINS', 'FOREST', 'MOUNTAIN'] },
            { type: 'SnapTrap', weight: 0.08, packSize: [1, 3], biomes: ['JUNGLE', 'FOREST'] }
        ];

        // Hostile mobs (spawn always now for testing)
        this.hostileMobs = [
            { type: 'Zombie', weight: 0.4, packSize: [2, 4] },
            { type: 'Skeleton', weight: 0.25, packSize: [1, 3] },
            { type: 'Creeper', weight: 0.25, packSize: [1, 2] }
        ];

        // Entity Lookup (for updates)
        this.entities = new Map(); // id -> Animal
    }

    /**
     * Handle initial entities from server (persistence)
     * @param {Array} entitiesList 
     */
    handleInitialEntities(entitiesList) {
        console.log(`[SpawnManager] Received entities:initial with ${entitiesList.length} entities`);

        // Mark that we've received the initial entities event from server
        this.hasReceivedInitialEntities = true;

        // Check persistence setting (Default: OFF)
        const persistenceEnabled = localStorage.getItem('settings_persistence') === 'true';

        if (!persistenceEnabled) {
            console.log('[SpawnManager] Persistence is OFF. Ignoring server entities and generating fresh creatures.');
            // Mark sync as complete immediately so we can start generating fresh chunks
            this.markInitialSyncComplete();
            return;
        }

        // If there are persisted entities, disable chunk-based spawning to prevent duplicates
        // When entities list is empty, allow normal chunk spawning for fresh worlds
        if (entitiesList.length > 0) {
            this.hasLoadedPersistedEntities = true;
            console.log('[SpawnManager] Disabling chunk-based spawning (persisted entities exist)');
        }

        for (const data of entitiesList) {
            this.handleRemoteSpawn(data);
        }

        // Mark sync as complete (even if list was empty)
        this.markInitialSyncComplete();
    }

    markInitialSyncComplete() {
        if (!this.waitingForInitialSync) return;

        console.log('[SpawnManager] Initial entity sync complete.');
        this.waitingForInitialSync = false;

        // If world is also ready, process the queue now
        if (this.isWorldReady) {
            this.processPendingSpawns();

            // Run deferred special spawns if they were attempted
            // (only if no persisted entities - those checks are inside the methods)
            if (this._deferredKangarooSpawn) {
                this._deferredKangarooSpawn = false;
                this.spawnKangaroosNearPlayer();
            }
            if (this._deferredPugasusSpawn) {
                this._deferredPugasusSpawn = false;
                this.spawnPugasusNearPlayer();
            }
            if (this._deferredSnowmenSpawn) {
                this._deferredSnowmenSpawn = false;
                this.spawnSnowmenNearPlayer();
            }
            if (this._deferredAvatarPlantsSpawn) {
                this._deferredAvatarPlantsSpawn = false;
                this.spawnAvatarPlantsNearPlayer();
            }
        }
    }

    processPendingSpawns() {
        console.log(`[SpawnManager] Processing ${this.pendingSpawns.length} queued chunk spawns...`);

        const queue = [...this.pendingSpawns];
        this.pendingSpawns = []; // Clear queue

        for (const req of queue) {
            const key = `${req.cx},${req.cz} `;
            this.spawnedChunks.delete(key); // Allow re-run
            this.spawnChunk(req.cx, req.cz);
        }
    }

    /**
     * Handle remote entity spawn
     * @param {Object} data 
     */
    handleRemoteSpawn(data) {
        // If we already have this entity, just update it (or ignore)
        if (this.entities.has(data.id)) {
            // Already exists, maybe update?
            const entity = this.entities.get(data.id);
            entity.deserialize(data);
            return;
        }

        // Find Class
        // We stored "type": this.constructor.name (e.g. "Pig")
        const AnimalClass = this.findAnimalClass(data.type);

        if (AnimalClass) {
            console.log(`[SpawnManager] Spawning remote/persisted ${data.type} (${data.id})`);
            // Create, but don't re-add to game.animals if createAnimal does it?
            // createAnimal adds to game.animals.
            // But createAnimal generates an ID. We need to force the ID.

            // Refactored createAnimal to accept ID override or separate method?
            // Let's modify createAnimal slightly or duplicate logic?
            // Cleanest is to modify createAnimal to take an options object or similar, but for now just special path.

            // We can just call new AnimalClass and setup keys
            const animal = new AnimalClass(this.game, data.x, data.y, data.z, data.seed);
            animal.id = data.id; // FORCE ID
            animal.deserialize(data); // Apply saved state (health, etc)

            this.game.animals.push(animal);
            this.game.scene.add(animal.mesh);
            this.entities.set(animal.id, animal);
        } else {
            console.warn(`[SpawnManager] Unknown animal type: ${data.type}`);
        }
    }

    findAnimalClass(typeName) {
        return AnimalClasses[typeName];
    }

    handleRemoteUpdate(data) {
        const entity = this.entities.get(data.id);
        if (entity) {
            entity.deserialize(data);
        }
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

        // Skip chunk-based spawning if persisted entities were loaded
        if (this.hasLoadedPersistedEntities) return;

        // --- DEFERRED SPAWNING LOGIC START ---
        // If world is not ready OR we are waiting for server sync, queue it
        if (!this.isWorldReady || this.waitingForInitialSync) {
            // console.log(`[SpawnManager] Queuing spawn for chunk ${cx}, ${cz} (Ready: ${this.isWorldReady}, Sync: ${!this.waitingForInitialSync})`);
            this.pendingSpawns.push({ cx, cz });
            return;
        }
        // --- DEFERRED SPAWNING LOGIC END ---

        // Cap max entities (Reduced from 200 for performance)
        if (this.game.animals.length > 50) return;

        // Create deterministic RNG for this chunk
        const chunkRng = SeededRandom.fromSeeds(this.game.worldSeed, cx, cz, 1);

        // 25% chance per chunk to spawn something (increased from 20%)
        if (chunkRng.next() > 0.25) return;

        const chunkSize = this.game.chunkSize;
        const worldGen = this.game.worldGen;

        // Pick a random block in this chunk (deterministic)
        const bx = cx * chunkSize + Math.floor(chunkRng.next() * chunkSize);
        const bz = cz * chunkSize + Math.floor(chunkRng.next() * chunkSize);

        // --- GROUND CHECK FIX ---
        // Ensure the column is actually loaded before we try to spawn
        // We need to check if we can find ground here
        // If not, we should probably SKIP spawning here rather than fallback to terrain height
        // Because terrain height might put them in the air if the chunk mesh isn't there
        // But biome calculation relies on 2D noise which is always available.
        const biome = worldGen.getBiome(bx, bz);

        // console.log(`Spawning attempt in chunk ${cx}, ${cz} (Biome: ${biome})`);

        // Spawn biome-specific animals
        const config = this.biomeSpawnConfig[biome];
        if (config) {
            this.trySpawnFromConfig(config, bx, bz, biome, chunkRng);
        }

        // Rare spawns
        for (const rare of this.rareSpawns) {
            if (rare.biomes && !rare.biomes.includes(biome)) continue;
            if (chunkRng.next() < rare.weight) {
                const AnimalClass = AnimalClasses[rare.type];
                if (AnimalClass) {
                    this.spawnPack(AnimalClass, rare.packSize, bx, bz, chunkRng);
                }
            }
        }

        // Hostile mob spawns
        this.trySpawnHostile(bx, bz, chunkRng);
    }

    /**
     * Mark world as ready and process queued spawns
     */
    setWorldReady() {
        if (this.isWorldReady) return;
        this.isWorldReady = true;

        console.log(`[SpawnManager] World ready! Processing ${this.pendingSpawns.length} queued chunk spawns...`);

        // Sort queue by distance to player? Optional but nice.
        // For now just process all.
        // Note: processing specific chunks might still fail if their neighbors aren't generated?
        // But by "World Ready" we assume initial area is largely done.

        // Process queue

        // Only process queue if we are ALSO synced (or offline)
        if (!this.waitingForInitialSync) {
            this.processPendingSpawns();
        } else {
            console.log('[SpawnManager] World ready, but waiting for initial sync before processing queue.');
        }
    }

    trySpawnHostile(bx, bz, rng) {
        // Only spawn hostile mobs at night
        if (this.game.environment && !this.game.environment.isNight()) return;

        // Only 10% chance for a hostile pack per successful spawn event
        if (rng.next() > 0.1) return;

        const roll = rng.next();
        let cumulative = 0;

        for (const entry of this.hostileMobs) {
            // Check allowed list
            if (this.allowedAnimals && !this.allowedAnimals.has(entry.type)) {
                continue;
            }

            cumulative += entry.weight;
            if (roll < cumulative) {
                const AnimalClass = AnimalClasses[entry.type];
                if (AnimalClass) {
                    this.spawnPack(AnimalClass, entry.packSize, bx, bz, rng);
                }
                break;
            }
        }
    }

    trySpawnFromConfig(config, bx, bz, biome, rng) {
        const roll = rng.next();
        let cumulative = 0;

        for (const entry of config) {
            // Check allowed list
            if (this.allowedAnimals && !this.allowedAnimals.has(entry.type)) {
                continue;
            }

            cumulative += entry.weight;
            if (roll < cumulative) {
                const AnimalClass = AnimalClasses[entry.type];
                if (AnimalClass) {
                    this.spawnPack(AnimalClass, entry.packSize, bx, bz, rng);
                }
                break;
            }
        }
    }

    spawnPack(AnimalClass, packSizeRange, baseX, baseZ, rng) {
        const [minSize, maxSize] = packSizeRange;
        const count = minSize + Math.floor(rng.next() * (maxSize - minSize + 1));
        const worldGen = this.game.worldGen;

        for (let i = 0; i < count; i++) {
            const childSeed = rng.next();
            const x = baseX + (rng.next() - 0.5) * 10;
            const z = baseZ + (rng.next() - 0.5) * 10;
            const terrainY = worldGen.getTerrainHeight(x, z);

            // Aquatic check
            const isAquatic = ['Fish', 'Turtle', 'Duck', 'Shark', 'Dolphin'].includes(AnimalClass.name);

            if (['Fish', 'Shark', 'Dolphin'].includes(AnimalClass.name)) {
                // Fish spawn underwater
                if (terrainY < worldGen.seaLevel) {
                    const waterY = worldGen.seaLevel - 1 - rng.next() * (worldGen.seaLevel - terrainY);
                    this.createAnimal(AnimalClass, x, waterY, z, false, childSeed);
                }
            } else if (['Monkey', 'Squirrel'].includes(AnimalClass.name)) {
                // Monkeys and Squirrels spawn in trees - find actual tree blocks
                const treePos = this.findTreeSpawnPosition(x, z, terrainY);
                if (treePos) {
                    this.createAnimal(AnimalClass, treePos.x, treePos.y, treePos.z, false, childSeed);
                }

            } else if (isAquatic && terrainY < worldGen.seaLevel) {
                // Spawning at surface for ducks/turtles if in valid water column
                this.createAnimal(AnimalClass, x, worldGen.seaLevel, z, false, childSeed);
            } else {
                // Standard land animal
                const y = terrainY + 1;
                // If it's a land animal (not aquatic), don't spawn in or on water
                if (!isAquatic) {
                    // Skip if below or at sea level (underwater or on water surface)
                    if (y <= worldGen.seaLevel + 1) continue;
                    // Also check if there's water at the spawn position
                    const blockAtSpawn = this.game.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
                    if (blockAtSpawn && blockAtSpawn.type === 'water') continue;
                    const blockBelow = this.game.getBlock(Math.floor(x), Math.floor(y) - 1, Math.floor(z));
                    if (blockBelow && blockBelow.type === 'water') continue;
                }
                this.createAnimal(AnimalClass, x, y, z, true, childSeed);
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

    createAnimal(AnimalClass, x, y, z, snapToGround = true, seed = null) {
        let spawnY = y;

        if (snapToGround) {
            // Find actual ground level by checking blocks, not just terrain height
            // This prevents spawning in mid-air when chunks aren't loaded yet
            const groundY = this.findGroundLevel(x, y, z);

            // DEBUG: Log spawn diagnostics
            const terrainY = this.game.worldGen.getTerrainHeight(x, z);
            const chunkKey = this.game.worldToChunk(x, y, z).cx + ',' + this.game.worldToChunk(x, y, z).cy + ',' + this.game.worldToChunk(x, y, z).cz;
            const hasChunk = this.game.chunks.has(chunkKey);

            if (groundY === null) {
                // No valid ground found, skip spawning this animal
                console.warn(`[SpawnManager] Failed to find ground for ${AnimalClass.name} at ${x.toFixed(1)}, ${z.toFixed(1)}`);
                return;
            }

            // Only log significant ground/terrain deviations (debugging purposes)
            // if (Math.abs(groundY - terrainY) > 5) {
            //     console.log(`[SpawnManager] HIGH DEV ${AnimalClass.name} at ${x.toFixed(2)},${z.toFixed(2)}. Terrain:${terrainY} Ground:${groundY}`);
            // }

            spawnY = groundY;
        }

        const animal = new AnimalClass(this.game, x, spawnY, z, seed);
        // Verbose spawn logging removed - was spamming console

        // If this is a LOCALLY generated animal (via chunk gen or debug), 
        // we might check if it conflicts with a persisted entity?
        // Or just let it be. But we should register it in this.entities
        // And if it's NEW (not loaded from DB), we should tell the server?
        // "Chunk Gen" animals are deterministic. 
        // If we load persisted entities, we might get duplicates if we also generate them.
        // STRATEGY: 
        // 1. Entities loaded from server are added to `this.entities` map.
        // 2. When generating chunk, check if ID already exists in `this.entities`.
        // 3. If exists, SKIP generation (use persisted version).

        if (this.entities.has(animal.id)) {
            // Already exists (loaded from persistence), so don't spawn this "fresh" one.
            // But we need to make sure the persisted one is actually shown/active?
            // If it's loaded, it's in the list.
            return;
        }

        // Set initial visibility based on game flags
        const isVillager = AnimalClass.name === 'Villager';
        const isSpaceship = AnimalClass.name === 'Spaceship';
        if (isVillager) {
            animal.mesh.visible = this.game.villagersVisible !== undefined ? this.game.villagersVisible : true;
        } else if (isSpaceship) {
            animal.mesh.visible = this.game.spaceshipsVisible !== undefined ? this.game.spaceshipsVisible : true;
        } else {
            animal.mesh.visible = this.game.creaturesVisible !== undefined ? this.game.creaturesVisible : true;
        }

        this.game.animals.push(animal);
        this.game.scene.add(animal.mesh);
        this.entities.set(animal.id, animal);

        // Log successful spawn
        console.log(`[SpawnManager] Spawned ${AnimalClass.name} at (${x.toFixed(1)}, ${spawnY.toFixed(1)}, ${z.toFixed(1)}), visible=${animal.mesh.visible}, total=${this.game.animals.length}`);

        return animal; // Return the animal so callers can send entity:spawn for manual spawns

        // Notify server that we spawned this (if it's not a remote echo)
        // But wait, chunk gen happens on ALL clients. We don't want everyone to send "spawn".
        // Deterministic spawns don't need "spawn" messages if everyone does it.
        // BUT, persistence means we want to modify them. 
        // If I move a deterministic pig, I save it. 
        // Next time I join, I get the saved pig. 
        // My chunk gen tries to make a NEW pig at start pos.
        // `if (this.entities.has(animal.id))` prevents that new pig.

        // Manual spawns (e.g. debug, or item) ARE NOT deterministic based on chunk (usually).
        // If `seed` is random.
        // How do we distinguish?
        // Let's assume ONLY explicit user actions trigger `entity:spawn` network event.
        // Chunk gen does NOT trigger network event (everyone does it).

        // For persistence:
        // When we modify a deterministic animal, we send `entity:update`.
        // Server saves it.
        // Next load, we get `entities:initial`. We spawn it.
        // Chunk gen runs, sees ID exists, skips.
        // Perfect.
    }

    /**
     * Find valid ground level by checking actual blocks
     * @param {number} x - World X coordinate
     * @param {number} y - Expected Y coordinate (hint)
     * @param {number} z - World Z coordinate
     * @returns {number|null} - Ground Y position (top of solid block + 1), or null if no ground
     */
    findGroundLevel(x, y, z) {
        const checkX = Math.floor(x);
        const checkZ = Math.floor(z);

        // Start from expected Y and search up and down
        const startY = Math.floor(y);
        const searchRange = 10;

        // First, search downward for solid ground
        for (let checkY = startY; checkY >= startY - searchRange; checkY--) {
            const block = this.game.getBlock(checkX, checkY, checkZ);
            if (block && block.type !== 'water') {
                // Ignore Leaves and Logs
                if (block.type === Blocks.LEAVES || block.type === Blocks.PINE_LEAVES || block.type === Blocks.BIRCH_LEAVES ||
                    block.type === Blocks.LOG || block.type === Blocks.PINE_LOG || block.type === Blocks.BIRCH_LOG ||
                    block.type === Blocks.PINE_WOOD || block.type === Blocks.BIRCH_WOOD) { // Check log variants too
                    continue;
                }

                // Found solid ground - spawn one block above it
                // Also verify there's air above to stand in (NOT water - land animals shouldn't spawn on water)
                const blockAbove = this.game.getBlock(checkX, checkY + 1, checkZ);
                if (!blockAbove) {
                    return checkY + 1;
                }
            }
        }

        // If nothing found below, search upward (might be underground)
        for (let checkY = startY + 1; checkY <= startY + searchRange; checkY++) {
            const block = this.game.getBlock(checkX, checkY, checkZ);
            if (block && block.type !== 'water') {
                // Ignore Leaves and Logs
                if (block.type === Blocks.LEAVES || block.type === Blocks.PINE_LEAVES || block.type === Blocks.BIRCH_LEAVES ||
                    block.type === Blocks.LOG || block.type === Blocks.PINE_LOG || block.type === Blocks.BIRCH_LOG ||
                    block.type === Blocks.PINE_WOOD || block.type === Blocks.BIRCH_WOOD) {
                    continue;
                }

                const blockAbove = this.game.getBlock(checkX, checkY + 1, checkZ);
                if (!blockAbove) {
                    return checkY + 1;
                }
            }
        }

        // No valid ground found (chunk probably not loaded)
        // FALLBACK: Use terrain height from noise function instead of failing
        // This allows spawns even when chunk blocks aren't loaded yet
        const terrainY = this.game.worldGen.getTerrainHeight(x, z);
        if (terrainY > this.game.worldGen.seaLevel) {
            console.log(`[SpawnManager] Using terrain fallback for spawn at ${x.toFixed(1)}, ${z.toFixed(1)}, Y=${Math.floor(terrainY) + 1}`);
            return Math.floor(terrainY) + 1;
        }
        console.warn(`[SpawnManager] No valid ground at ${x.toFixed(1)}, ${z.toFixed(1)} (seaLevel=${this.game.worldGen.seaLevel})`);
        return null;
    }

    /**
     * Spawn kangaroos near the player's starting position
     */
    spawnKangaroosNearPlayer() {
        // Skip if we're waiting for initial sync OR if persisted entities were loaded
        if (this.waitingForInitialSync) {
            console.log('[SpawnManager] Deferring kangaroo spawn (waiting for initial sync)');
            this._deferredKangarooSpawn = true;
            return;
        }
        if (this.hasLoadedPersistedEntities) {
            console.log('[SpawnManager] Skipping kangaroo spawn (persisted entities exist)');
            return;
        }

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
                if (AnimalClasses.Kangaroo) {
                    this.createAnimal(AnimalClasses.Kangaroo, x, y, z, true, rng.next());
                }
            }
        }
    }

    /**
     * Spawn Pugasus creatures near the player's starting position
     * These mythical chimera creatures greet the player!
     */
    spawnPugasusNearPlayer() {
        // Skip if we're waiting for initial sync OR if persisted entities were loaded
        if (this.waitingForInitialSync) {
            console.log('[SpawnManager] Deferring Pugasus spawn (waiting for initial sync)');
            this._deferredPugasusSpawn = true;
            return;
        }
        if (this.hasLoadedPersistedEntities) {
            console.log('[SpawnManager] Skipping Pugasus spawn (persisted entities exist)');
            return;
        }

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
                if (AnimalClasses.Pugasus) {
                    this.createAnimal(AnimalClasses.Pugasus, x, y, z, true, rng.next());
                }
            }
        }
    }

    /**
     * Spawn friendly Snowmen near the player's starting position
     * These festive friends walk around and talk with speech bubbles!
     */
    spawnSnowmenNearPlayer() {
        // Skip if we're waiting for initial sync OR if persisted entities were loaded
        if (this.waitingForInitialSync) {
            console.log('[SpawnManager] Deferring Snowmen spawn (waiting for initial sync)');
            this._deferredSnowmenSpawn = true;
            return;
        }
        if (this.hasLoadedPersistedEntities) {
            console.log('[SpawnManager] Skipping Snowmen spawn (persisted entities exist)');
            return;
        }

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
                if (AnimalClasses.Snowman) {
                    this.createAnimal(AnimalClasses.Snowman, x, y, z, true, rng.next());
                }
            }
        }
    }



    /**
     * Spawn a cluster of Avatar-like plants near the player.
     */
    spawnAvatarPlantsNearPlayer() {
        if (this.waitingForInitialSync) {
            this._deferredAvatarPlantsSpawn = true;
            return;
        }
        // Even if persistence exists, we might want to force these once? 
        // Or respect persistence. Let's respect persistence to avoid spam on re-load.
        if (this.hasLoadedPersistedEntities) {
            return;
        }

        const player = this.game.player;
        const worldGen = this.game.worldGen;
        const rng = SeededRandom.fromSeeds(this.game.worldSeed, 2025);

        console.log('[SpawnManager] Spawning Avatar-like plants near player...');

        const plantTypes = ['HelicopterPlant', 'ShyPlant', 'CrystalPlant'];

        for (const type of plantTypes) {
            const count = 3 + Math.floor(rng.next() * 3);
            const AngleOffset = rng.next() * Math.PI * 2;

            for (let i = 0; i < count; i++) {
                // Spawn in a ring 5-15m away
                const angle = AngleOffset + (i / count) * 0.5;
                const dist = 5 + rng.next() * 10;

                const x = player.position.x + Math.cos(angle) * dist;
                const z = player.position.z + Math.sin(angle) * dist;
                const terrainY = worldGen.getTerrainHeight(x, z);

                const AnimalClass = AnimalClasses[type];
                if (AnimalClass) {
                    this.createAnimal(AnimalClass, x, terrainY + 1, z, true, rng.next());
                }
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
        let targetPos = null;
        let snapToGround = true;

        // Use the reliable getTargetBlock from PhysicsManager
        const target = this.game.physicsManager.getTargetBlock();
        if (target) {
            // Place on top of the block (like placing blocks)
            targetPos = new THREE.Vector3(
                target.x + target.normal.x + 0.5,
                target.y + target.normal.y,
                target.z + target.normal.z + 0.5
            );
            snapToGround = false; // Exact position
        }

        if (!targetPos) {
            // Fallback: in front of player
            const dir = new THREE.Vector3();
            this.game.camera.getWorldDirection(dir);
            dir.y = 0;
            dir.normalize();

            targetPos = new THREE.Vector3(
                player.position.x + dir.x * 5,
                player.position.y,
                player.position.z + dir.z * 5
            );
            snapToGround = true;
        }

        // Use SeededRandom for debug spawns so they also get seeds
        const rng = new SeededRandom(Math.random() * 0xFFFFFF);
        const createdAnimals = [];

        for (let i = 0; i < count; i++) {
            const ox = (rng.next() - 0.5) * (count > 1 ? 4 : 0);
            const oz = (rng.next() - 0.5) * (count > 1 ? 4 : 0);

            let animal = this.createAnimal(EntityClass, targetPos.x + ox, targetPos.y, targetPos.z + oz, snapToGround, rng.next());

            // Retry without snapToGround if failed (ensure spawn happens)
            if (!animal && snapToGround) {
                console.log(`[SpawnManager] Ground check failed for ${EntityClass.name}, forcing air spawn.`);
                animal = this.createAnimal(EntityClass, targetPos.x + ox, targetPos.y, targetPos.z + oz, false, rng.next());
            }

            if (animal) {
                createdAnimals.push(animal);
                if (this.game.socketManager) {
                    this.game.socketManager.sendEntitySpawn(animal.serialize());
                }
            }
        }
        console.log(`Debug spawned ${count} ${EntityClass.name} at ${targetPos.x.toFixed(1)}, ${targetPos.y.toFixed(1)}, ${targetPos.z.toFixed(1)}`);

        return createdAnimals;
    }
}
