import * as THREE from 'three';
import { SeededRandom } from '../../utils/SeededRandom.js';
import { Blocks } from '../core/Blocks.js';
import { AnimalClasses } from '../AnimalRegistry.js';
import { Config } from '../core/Config.js';

// Import spawn modules
import {
    BIOME_SPAWN_CONFIG,
    RARE_SPAWNS,
    HOSTILE_MOBS,
    WORLD_SPAWN_CONFIG,
    SPAWN_LIMITS,
    findGroundLevel,
    findGroundLevelForWorld,
    findTreeSpawnPosition,
    isAquatic,
    isUnderwater,
    AQUATIC_TYPES,
    UNDERWATER_TYPES
} from './spawn/index.js';
import { EntityRegistry } from './spawn/EntityRegistry.js';
import { CreatureFilterManager } from './spawn/CreatureFilterManager.js';

/**
 * SpawnManager handles all animal spawning logic.
 * Uses a config-driven approach for biome-specific spawns.
 *
 * Refactored to use modular spawn system:
 * - SpawnConfig: Configuration data
 * - SpawnPositionUtils: Position finding utilities
 * - EntityRegistry: Entity tracking
 * - CreatureFilterManager: Creature whitelist management
 */
export class SpawnManager {
    constructor(game) {
        this.game = game;

        // Sub-modules
        this.entityRegistry = new EntityRegistry();
        this.creatureFilter = new CreatureFilterManager(game, this.entityRegistry);

        // State
        this.spawnedChunks = new Set();
        this.isSpawningEnabled = true;
        this.waitingForInitialSync = !this.game.isOffline;
        this.isWorldReady = false;
        this.pendingSpawns = [];
        this.currentWorld = 'EARTH';
        this.lastCheckedPlayerY = 0;

        // Legacy compatibility - expose entities map
        this.entities = this.entityRegistry.getAllEntities();

        // Use imported configs
        this.biomeSpawnConfig = BIOME_SPAWN_CONFIG;
        this.rareSpawns = RARE_SPAWNS;
        this.hostileMobs = HOSTILE_MOBS;
        this.worldSpawnConfig = WORLD_SPAWN_CONFIG;

        // Legacy compatibility
        this.allowedAnimals = null;
        this.allowedCreatures = null;
    }

    // ============ Entity Persistence & Sync ============

    /**
     * Handle initial entities from server (persistence)
     */
    handleInitialEntities(entitiesList) {
        console.log(`[SpawnManager] Received entities:initial with ${entitiesList.length} entities`);
        this.hasReceivedInitialEntities = true;

        const persistenceEnabled = localStorage.getItem('settings_persistence') === 'true';
        if (!persistenceEnabled) {
            console.log('[SpawnManager] Persistence is OFF. Ignoring server entities.');
            this.markInitialSyncComplete();
            return;
        }

        if (entitiesList.length > 0) {
            this.hasLoadedPersistedEntities = true;
            console.log('[SpawnManager] Disabling chunk-based spawning (persisted entities exist)');
        }

        for (const entityData of entitiesList) {
            this.handleRemoteSpawn(entityData);
        }

        this.markInitialSyncComplete();
    }

    markInitialSyncComplete() {
        if (!this.waitingForInitialSync) return;
        this.waitingForInitialSync = false;
        console.log('[SpawnManager] Initial sync complete. Ready for spawning.');

        if (this._deferredKangarooSpawn) {
            this._deferredKangarooSpawn = false;
            this.spawnKangaroosNearPlayer();
        }

        if (this.isWorldReady) {
            this.processPendingSpawns();
        }
    }

    processPendingSpawns() {
        const toProcess = [...this.pendingSpawns];
        this.pendingSpawns = [];
        console.log(`[SpawnManager] Processing ${toProcess.length} pending spawns`);

        for (const req of toProcess) {
            const key = `${req.cx},${req.cz},${req.world}`;
            this.spawnedChunks.delete(key);
            this.spawnChunk(req.cx, req.cz);
        }
    }

    // ============ World Management ============

    getCurrentWorld() {
        if (!this.game.player) return 'EARTH';

        const playerY = this.game.player.position.y;
        const chunkSize = this.game.chunkSize || Config.WORLD.CHUNK_SIZE;
        const chunkY = Math.floor(playerY / chunkSize);

        const crystalStart = Config.WORLD.CRYSTAL_WORLD_Y_START;
        const crystalEnd = crystalStart + Config.WORLD.CRYSTAL_WORLD_HEIGHT;
        const lavaStart = Config.WORLD.LAVA_WORLD_Y_START;
        const lavaEnd = lavaStart + Config.WORLD.LAVA_WORLD_HEIGHT;
        const moonStart = Config.WORLD.MOON_CHUNK_Y_START;
        const moonEnd = moonStart + Config.WORLD.MOON_CHUNK_HEIGHT;

        if (chunkY >= lavaStart && chunkY < lavaEnd) return 'LAVA_WORLD';
        if (chunkY >= crystalStart && chunkY < crystalEnd) return 'CRYSTAL_WORLD';
        if (chunkY >= moonStart && chunkY < moonEnd) return 'MOON';
        return 'EARTH';
    }

    checkWorldChange() {
        if (!this.game.player || !this.isWorldReady || this.waitingForInitialSync) return;

        const newWorld = this.getCurrentWorld();
        if (newWorld !== this.currentWorld) {
            console.log(`[SpawnManager] World changed from ${this.currentWorld} to ${newWorld}`);
            this.currentWorld = newWorld;

            if (newWorld !== 'EARTH' && newWorld !== 'MOON') {
                this.spawnCreaturesForCurrentWorld();
            }
        }
    }

    spawnCreaturesForCurrentWorld() {
        const world = this.currentWorld;
        if (world === 'EARTH' || world === 'MOON') return;

        const player = this.game.player;
        if (!player) return;

        const chunkSize = this.game.chunkSize || Config.WORLD.CHUNK_SIZE;
        const playerCX = Math.floor(player.position.x / chunkSize);
        const playerCZ = Math.floor(player.position.z / chunkSize);
        const spawnRange = 4;

        console.log(`[SpawnManager] Spawning ${world} creatures around player`);

        for (let cx = playerCX - spawnRange; cx <= playerCX + spawnRange; cx++) {
            for (let cz = playerCZ - spawnRange; cz <= playerCZ + spawnRange; cz++) {
                this.spawnChunkForWorld(cx, cz, world);
            }
        }
    }

    // ============ Remote Entity Handling ============

    handleRemoteSpawn(data) {
        if (this.entityRegistry.has(data.id)) {
            const entity = this.entityRegistry.get(data.id);
            entity.deserialize(data, false);
            return;
        }

        const AnimalClass = this.entityRegistry.findAnimalClass(data.type);
        if (AnimalClass) {
            console.log(`[SpawnManager] Spawning remote/persisted ${data.type} (${data.id})`);
            const animal = new AnimalClass(this.game, data.x, data.y, data.z, data.seed);
            animal.id = data.id;
            animal.deserialize(data, false);
            this.game.animals.push(animal);
            this.game.scene.add(animal.mesh);
            this.entityRegistry.register(animal.id, animal);
        } else {
            console.warn(`[SpawnManager] Unknown animal type: ${data.type}`);
        }
    }

    findAnimalClass(typeName) {
        return this.entityRegistry.findAnimalClass(typeName);
    }

    handleRemoteUpdate(data) {
        const entity = this.entityRegistry.get(data.id);
        if (entity) {
            entity.deserialize(data, true);
        }
    }

    // ============ Entity Lifecycle ============

    clearAllEntities() {
        console.log(`[SpawnManager] Clearing all ${this.entityRegistry.size} entities`);

        for (const [id, entity] of this.entityRegistry.getAllEntities()) {
            if (entity.mesh) this.game.scene.remove(entity.mesh);
            if (entity.dispose) entity.dispose();
        }

        if (this.game.animals) this.game.animals.length = 0;

        this.entityRegistry.clear();
        this.spawnedChunks.clear();
        this.pendingSpawns = [];
        this.hasLoadedPersistedEntities = false;
        this.hasReceivedInitialEntities = false;

        console.log('[SpawnManager] All entities cleared');
    }

    // ============ Chunk Spawning ============

    spawnAnimalsInArea(centerCX, centerCZ, chunkRange) {
        for (let cx = centerCX - chunkRange; cx <= centerCX + chunkRange; cx++) {
            for (let cz = centerCZ - chunkRange; cz <= centerCZ + chunkRange; cz++) {
                this.spawnChunk(cx, cz);
            }
        }
    }

    spawnChunk(cx, cz) {
        const currentWorld = this.getCurrentWorld();
        const key = `${cx},${cz},${currentWorld}`;

        if (this.spawnedChunks.has(key)) return;
        this.spawnedChunks.add(key);

        if (!this.isSpawningEnabled) return;
        if (this.hasLoadedPersistedEntities) return;

        if (!this.isWorldReady || this.waitingForInitialSync) {
            this.pendingSpawns.push({ cx, cz, world: currentWorld });
            return;
        }

        if (this.game.animals.length > SPAWN_LIMITS.MAX_ANIMALS) return;

        const worldSeed = currentWorld === 'EARTH' ? 1 :
                          currentWorld === 'CRYSTAL_WORLD' ? 100 :
                          currentWorld === 'LAVA_WORLD' ? 200 : 1;
        const chunkRng = SeededRandom.fromSeeds(this.game.worldSeed, cx, cz, worldSeed);

        if (chunkRng.next() > 0.40) return;

        const chunkSize = this.game.chunkSize;
        const worldGen = this.game.worldGen;
        const bx = cx * chunkSize + Math.floor(chunkRng.next() * chunkSize);
        const bz = cz * chunkSize + Math.floor(chunkRng.next() * chunkSize);

        if (currentWorld !== 'EARTH' && currentWorld !== 'MOON' && this.worldSpawnConfig[currentWorld]) {
            this.trySpawnFromConfigForWorld(this.worldSpawnConfig[currentWorld], bx, bz, currentWorld, chunkRng);
            return;
        }

        const biome = worldGen.getBiome(bx, bz);
        const config = this.biomeSpawnConfig[biome];
        if (config) {
            this.trySpawnFromConfig(config, bx, bz, biome, chunkRng);
        }

        for (const rare of this.rareSpawns) {
            if (rare.biomes && !rare.biomes.includes(biome)) continue;
            if (chunkRng.next() < rare.weight) {
                const AnimalClass = AnimalClasses[rare.type];
                if (AnimalClass) {
                    this.spawnPack(AnimalClass, rare.packSize, bx, bz, chunkRng);
                }
            }
        }

        this.trySpawnHostile(bx, bz, chunkRng);
    }

    spawnChunkForWorld(cx, cz, world) {
        const key = `${cx},${cz},${world}`;
        if (this.spawnedChunks.has(key)) return;
        this.spawnedChunks.add(key);

        if (!this.isSpawningEnabled) return;
        if (this.hasLoadedPersistedEntities) return;
        if (this.game.animals.length > SPAWN_LIMITS.MAX_ANIMALS) return;

        const worldSeed = world === 'CRYSTAL_WORLD' ? 100 : world === 'LAVA_WORLD' ? 200 : 1;
        const chunkRng = SeededRandom.fromSeeds(this.game.worldSeed, cx, cz, worldSeed);

        if (chunkRng.next() > 0.60) return;

        const chunkSize = this.game.chunkSize;
        const bx = cx * chunkSize + Math.floor(chunkRng.next() * chunkSize);
        const bz = cz * chunkSize + Math.floor(chunkRng.next() * chunkSize);

        if (this.worldSpawnConfig[world]) {
            this.trySpawnFromConfigForWorld(this.worldSpawnConfig[world], bx, bz, world, chunkRng);
        }
    }

    setWorldReady() {
        if (this.isWorldReady) return;
        this.isWorldReady = true;
        console.log(`[SpawnManager] World ready! Processing ${this.pendingSpawns.length} queued spawns...`);

        if (!this.waitingForInitialSync) {
            this.processPendingSpawns();
        }
    }

    // ============ Spawn Logic ============

    trySpawnHostile(bx, bz, rng) {
        if (this.game.environment && !this.game.environment.isNight()) return;
        if (rng.next() > 0.1) return;

        const roll = rng.next();
        let cumulative = 0;

        for (const entry of this.hostileMobs) {
            if (this.allowedAnimals && !this.allowedAnimals.has(entry.type)) continue;
            if (!this.isCreatureAllowed(entry.type)) continue;

            cumulative += entry.weight;
            if (roll < cumulative) {
                const AnimalClass = AnimalClasses[entry.type];
                if (AnimalClass) this.spawnPack(AnimalClass, entry.packSize, bx, bz, rng);
                break;
            }
        }
    }

    trySpawnFromConfig(config, bx, bz, biome, rng) {
        const roll = rng.next();
        let cumulative = 0;

        for (const entry of config) {
            if (this.allowedAnimals && !this.allowedAnimals.has(entry.type)) continue;
            if (!this.isCreatureAllowed(entry.type)) continue;

            cumulative += entry.weight;
            if (roll < cumulative) {
                const AnimalClass = AnimalClasses[entry.type];
                if (AnimalClass) this.spawnPack(AnimalClass, entry.packSize, bx, bz, rng);
                break;
            }
        }
    }

    trySpawnFromConfigForWorld(config, bx, bz, world, rng) {
        const roll = rng.next();
        let cumulative = 0;

        for (const entry of config) {
            if (this.allowedAnimals && !this.allowedAnimals.has(entry.type)) continue;
            if (!this.isCreatureAllowed(entry.type)) continue;

            cumulative += entry.weight;
            if (roll < cumulative) {
                const AnimalClass = AnimalClasses[entry.type];
                if (AnimalClass) this.spawnPackForWorld(AnimalClass, entry.packSize, bx, bz, world, rng);
                break;
            }
        }
    }

    spawnPackForWorld(AnimalClass, packSizeRange, baseX, baseZ, world, rng) {
        const [minSize, maxSize] = packSizeRange;
        const count = minSize + Math.floor(rng.next() * (maxSize - minSize + 1));
        const chunkSize = this.game.chunkSize || Config.WORLD.CHUNK_SIZE;

        let worldYBase = 0;
        if (world === 'CRYSTAL_WORLD') worldYBase = Config.WORLD.CRYSTAL_WORLD_Y_START * chunkSize;
        else if (world === 'LAVA_WORLD') worldYBase = Config.WORLD.LAVA_WORLD_Y_START * chunkSize;
        else if (world === 'MOON') worldYBase = Config.WORLD.MOON_CHUNK_Y_START * chunkSize;

        for (let i = 0; i < count; i++) {
            const childSeed = rng.next();
            const x = baseX + (rng.next() - 0.5) * 10;
            const z = baseZ + (rng.next() - 0.5) * 10;
            const spawnY = findGroundLevelForWorld(this.game, x, z, worldYBase, world);

            if (spawnY !== null) {
                this.createAnimal(AnimalClass, x, spawnY, z, false, childSeed);
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

            if (isUnderwater(AnimalClass.name)) {
                if (terrainY < worldGen.seaLevel) {
                    const waterY = worldGen.seaLevel - 1 - rng.next() * (worldGen.seaLevel - terrainY);
                    this.createAnimal(AnimalClass, x, waterY, z, false, childSeed);
                }
            } else if (AnimalClass.name === 'Starfish') {
                if (terrainY < worldGen.seaLevel) {
                    this.createAnimal(AnimalClass, x, terrainY + 1, z, false, childSeed);
                }
            } else if (['Duck', 'Flamingo', 'Turtle'].includes(AnimalClass.name)) {
                const y = Math.max(terrainY + 1, worldGen.seaLevel);
                this.createAnimal(AnimalClass, x, y, z, true, childSeed);
            } else if (['Squirrel', 'Monkey', 'Owl', 'Toucan'].includes(AnimalClass.name)) {
                const treePos = findTreeSpawnPosition(this.game, baseX, baseZ, terrainY);
                if (treePos) {
                    this.createAnimal(AnimalClass, treePos.x, treePos.y, treePos.z, false, childSeed);
                }
            } else {
                const y = terrainY + 1;
                if (y > worldGen.seaLevel) {
                    const blockAtSpawn = this.game.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
                    if (blockAtSpawn && blockAtSpawn.type === 'water') continue;
                    const blockBelow = this.game.getBlock(Math.floor(x), Math.floor(y) - 1, Math.floor(z));
                    if (blockBelow && blockBelow.type === 'water') continue;
                }
                this.createAnimal(AnimalClass, x, y, z, true, childSeed);
            }
        }
    }

    // ============ Position Utilities (delegated) ============

    findGroundLevel(x, y, z) {
        return findGroundLevel(this.game, x, y, z);
    }

    findGroundLevelForWorld(x, z, worldYBase, world) {
        return findGroundLevelForWorld(this.game, x, z, worldYBase, world);
    }

    findTreeSpawnPosition(baseX, baseZ, terrainY) {
        return findTreeSpawnPosition(this.game, baseX, baseZ, terrainY);
    }

    // ============ Entity Creation ============

    createAnimal(AnimalClass, x, y, z, snapToGround = true, seed = null) {
        let spawnY = y;

        if (snapToGround) {
            const groundY = findGroundLevel(this.game, x, y, z);
            const terrainY = this.game.worldGen.getTerrainHeight(x, z);

            if (groundY === null) {
                console.warn(`[SpawnManager] Failed to find ground for ${AnimalClass.name} at ${x.toFixed(1)}, ${z.toFixed(1)}`);
                return;
            }

            if (Math.abs(groundY - terrainY) > 3) {
                console.log(`[SpawnManager] ${AnimalClass.name} ground adjusted: terrain=${terrainY.toFixed(1)} -> actual=${groundY}`);
            }
            spawnY = groundY;
        }

        const animal = new AnimalClass(this.game, x, spawnY, z, seed);
        this.game.animals.push(animal);
        this.game.scene.add(animal.mesh);
        this.entityRegistry.register(animal.id, animal);
    }

    // ============ Special Initial Spawns ============

    spawnKangaroosNearPlayer() {
        if (this.waitingForInitialSync) {
            this._deferredKangarooSpawn = true;
            return;
        }
        if (this.hasLoadedPersistedEntities) return;

        const player = this.game.player;
        const worldGen = this.game.worldGen;
        const rng = SeededRandom.fromSeeds(this.game.worldSeed, 1001);
        const count = 1 + Math.floor(rng.next() * 2);

        for (let i = 0; i < count; i++) {
            const angle = rng.next() * Math.PI * 2;
            const distance = 10 + rng.next() * 15;
            const x = player.position.x + Math.cos(angle) * distance;
            const z = player.position.z + Math.sin(angle) * distance;
            const y = worldGen.getTerrainHeight(x, z) + 1;

            if (y > worldGen.seaLevel + 1 && AnimalClasses.Kangaroo) {
                this.createAnimal(AnimalClasses.Kangaroo, x, y, z, true, rng.next());
            }
        }
    }

    spawnPugasusNearPlayer() {
        if (this.waitingForInitialSync || this.hasLoadedPersistedEntities) return;

        const player = this.game.player;
        const worldGen = this.game.worldGen;
        const rng = SeededRandom.fromSeeds(this.game.worldSeed, 1002);
        const count = 1;

        for (let i = 0; i < count; i++) {
            const angle = rng.next() * Math.PI * 2;
            const distance = 8 + rng.next() * 10;
            const x = player.position.x + Math.cos(angle) * distance;
            const z = player.position.z + Math.sin(angle) * distance;
            const y = worldGen.getTerrainHeight(x, z) + 1;

            if (y > worldGen.seaLevel + 1 && AnimalClasses.Pugasus) {
                this.createAnimal(AnimalClasses.Pugasus, x, y, z, true, rng.next());
            }
        }
    }

    spawnSnowmenNearPlayer() {
        if (this.waitingForInitialSync || this.hasLoadedPersistedEntities) return;

        const player = this.game.player;
        const worldGen = this.game.worldGen;
        const biome = worldGen.getBiome(player.position.x, player.position.z);
        if (biome !== 'SNOW') return;

        const rng = SeededRandom.fromSeeds(this.game.worldSeed, 1003);
        const count = 2 + Math.floor(rng.next() * 2);

        for (let i = 0; i < count; i++) {
            const angle = rng.next() * Math.PI * 2;
            const distance = 10 + rng.next() * 15;
            const x = player.position.x + Math.cos(angle) * distance;
            const z = player.position.z + Math.sin(angle) * distance;
            const y = worldGen.getTerrainHeight(x, z) + 1;

            if (y > worldGen.seaLevel + 1 && AnimalClasses.Snowman) {
                this.createAnimal(AnimalClasses.Snowman, x, y, z, true, rng.next());
            }
        }
    }

    spawnAvatarPlantsNearPlayer() {
        if (this.waitingForInitialSync || this.hasLoadedPersistedEntities) return;

        const player = this.game.player;
        const worldGen = this.game.worldGen;
        const biome = worldGen.getBiome(player.position.x, player.position.z);
        if (!['PLAINS', 'FOREST', 'JUNGLE'].includes(biome)) return;

        const rng = SeededRandom.fromSeeds(this.game.worldSeed, 1004);
        const plantTypes = ['HelicopterPlant', 'ShyPlant', 'HummingBlossom', 'SporeCloud'];

        for (const plantType of plantTypes) {
            if (!AnimalClasses[plantType]) continue;
            const count = 2 + Math.floor(rng.next() * 3);

            for (let i = 0; i < count; i++) {
                const angle = rng.next() * Math.PI * 2;
                const distance = 15 + rng.next() * 25;
                const x = player.position.x + Math.cos(angle) * distance;
                const z = player.position.z + Math.sin(angle) * distance;
                const y = worldGen.getTerrainHeight(x, z) + 1;

                if (y > worldGen.seaLevel + 1) {
                    this.createAnimal(AnimalClasses[plantType], x, y, z, true, rng.next());
                }
            }
        }
    }

    // ============ Debug Functions ============

    /**
     * Spawn a controllable block in front of the player
     * @param {string} blockType - Block type for visual (default: 'control_block')
     * @returns {ControllableBlock} The spawned block
     */
    spawnControllableBlockInFrontOfPlayer(blockType = 'control_block') {
        const player = this.game.player;
        if (!player) return null;

        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), player.rotation.y);
        forward.y = 0;
        forward.normalize();

        const distance = 5;
        const x = Math.floor(player.position.x + forward.x * distance);
        const y = Math.floor(player.position.y);
        const z = Math.floor(player.position.z + forward.z * distance);

        const cb = this.game.spawnControllableBlock(x, y, z, blockType);
        console.log(`[SpawnManager] Spawned controllable block at (${x}, ${y}, ${z})`);
        return cb;
    }

    spawnEntitiesInFrontOfPlayer(typeName, count = 3, spread = 5, distance = 8) {
        const player = this.game.player;
        if (!player) return [];

        const AnimalClass = AnimalClasses[typeName];
        if (!AnimalClass) {
            console.warn(`[SpawnManager] Unknown entity type: ${typeName}`);
            return [];
        }

        const worldGen = this.game.worldGen;
        const rng = SeededRandom.fromSeeds(Date.now(), count, spread);

        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(player.camera.quaternion);
        forward.y = 0;
        forward.normalize();

        const spawnX = player.position.x + forward.x * distance;
        const spawnZ = player.position.z + forward.z * distance;
        const createdAnimals = [];

        for (let i = 0; i < count; i++) {
            const offsetX = (rng.next() - 0.5) * spread;
            const offsetZ = (rng.next() - 0.5) * spread;
            const x = spawnX + offsetX;
            const z = spawnZ + offsetZ;
            const terrainY = worldGen.getTerrainHeight(x, z);
            const y = terrainY + 1;

            const animal = new AnimalClass(this.game, x, y, z, rng.next());
            this.game.animals.push(animal);
            this.game.scene.add(animal.mesh);
            this.entityRegistry.register(animal.id, animal);
            createdAnimals.push(animal);
        }

        return createdAnimals;
    }

    // ============ Creature Filtering (delegated) ============

    setAllowedCreatures(creatureList) {
        this.creatureFilter.setAllowedCreatures(creatureList);
        this.allowedCreatures = this.creatureFilter.getAllowedCreatures();
    }

    despawnDisallowedCreatures() {
        this.creatureFilter.despawnDisallowedCreatures();
    }

    isCreatureAllowed(creatureType) {
        return this.creatureFilter.isCreatureAllowed(creatureType);
    }
}
