import { NoiseGenerator } from '../utils/NoiseGenerator.js';
import { BiomeManager } from './BiomeManager.js';
import { TerrainGenerator } from './TerrainGenerator.js';
import { StructureGenerator } from './StructureGenerator.js';
import { Config } from '../game/core/Config.js';
import { Blocks } from '../game/core/Blocks.js';

export class WorldGenerator {
    constructor(game) {
        this.game = game;
        // Keep noise for structure generation (trees, etc)
        this.noise = new NoiseGenerator();
        this.seaLevel = Config.WORLD.SEA_LEVEL; // Global water level

        // Components
        this.biomeManager = new BiomeManager();
        this.terrainGenerator = new TerrainGenerator(this.biomeManager);
        this.structureGenerator = new StructureGenerator(game, this);

        // Village near spawn tracking
        this.spawnVillageGenerated = false;
    }

    getTemperature(x, z) {
        return this.biomeManager.getTemperature(x, z);
    }

    getHumidity(x, z) {
        return this.biomeManager.getHumidity(x, z);
    }

    getBiome(x, z) {
        const height = this.getTerrainHeight(x, z);
        return this.biomeManager.getBiome(x, z, height);
    }

    getTerrainHeight(x, z) {
        return this.terrainGenerator.getTerrainHeight(x, z);
    }

    isCave(x, y, z) {
        return this.terrainGenerator.isCave(x, y, z);
    }

    // --- Chunk Generation ---

    generateChunk(cx, cy, cz) {
        const chunk = this.game.getOrCreateChunk(cx, cy, cz);
        if (chunk.isGenerated) return chunk;

        // Void (Below Bedrock)
        if (cy < 0) {
            chunk.isGenerated = true;
            return chunk; // Empty
        }

        // Moon Generation
        if (cy >= Config.WORLD.MOON_CHUNK_Y_START && cy < Config.WORLD.MOON_CHUNK_Y_START + Config.WORLD.MOON_CHUNK_HEIGHT) {
            return this.generateMoonChunk(chunk, cx, cy, cz);
        }

        const startX = cx * this.game.chunkSize;
        const startY = cy * this.game.chunkSize;
        const startZ = cz * this.game.chunkSize;

        for (let x = 0; x < this.game.chunkSize; x++) {
            for (let z = 0; z < this.game.chunkSize; z++) {
                const wx = startX + x;
                const wz = startZ + z;

                // 2D Terrain Height
                const groundHeight = this.getTerrainHeight(wx, wz);
                const biome = this.getBiome(wx, wz);

                for (let y = 0; y < this.game.chunkSize; y++) {
                    const wy = startY + y;

                    // Bedrock
                    if (wy === 0) {
                        this.game.setBlock(wx, wy, wz, Blocks.BEDROCK, true, true);
                        continue;
                    }

                    // Caves
                    if (this.isCave(wx, wy, wz) && wy < groundHeight && wy > 0) {
                        this.game.setBlock(wx, wy, wz, null, true, true); // Air
                        continue;
                    }

                    // Terrain
                    if (wy <= groundHeight) {
                        let type = Blocks.STONE;

                        // Ore Generation - use position-based seeded random for determinism
                        if (type === Blocks.STONE) {
                            const depth = groundHeight - wy;
                            // Create deterministic random based on position and world seed
                            const oreHash = this.getPositionHash(wx, wy, wz);
                            const oreRand = (oreHash % 10000) / 10000;

                            // Coal: Common, anywhere under ground
                            // Iron: Uncommon, below sea level or deep
                            // Gold: Rare, deep
                            // Diamond: Very Rare, very deep
                            // Make it explicit priority to avoid higher probability overwriting
                            // Let's rewrite for clarity and priority (rarest first)

                            if (wy < 8 && oreRand < Config.GENERATION.ORE_DIAMOND) { // Diamond
                                type = Blocks.DIAMOND_ORE;
                            } else if (wy < 15 && oreRand < Config.GENERATION.ORE_GOLD) { // Gold
                                type = Blocks.GOLD_ORE;
                            } else if (wy < this.seaLevel && oreRand < Config.GENERATION.ORE_IRON) { // Iron
                                type = Blocks.IRON_ORE;
                            } else if (oreRand < Config.GENERATION.ORE_COAL) { // Coal
                                type = Blocks.COAL_ORE;
                            }
                        }

                        // Dirt/Grass layers
                        if (wy === groundHeight) {
                            if (biome === 'DESERT') type = Blocks.SAND;
                            else if (biome === 'SNOW') type = Blocks.SNOW;
                            else if (groundHeight < this.seaLevel + 2 && biome !== 'MOUNTAIN') type = Blocks.SAND; // Beach
                            else type = Blocks.GRASS;
                        } else if (wy > groundHeight - 4) {
                            if (biome === 'DESERT') type = Blocks.SAND;
                            else type = Blocks.DIRT;
                        }

                        this.game.setBlock(wx, wy, wz, type, true, true);
                    } else {
                        // Water
                        if (wy <= this.seaLevel) {
                            this.game.setBlock(wx, wy, wz, Blocks.WATER, true, true);
                        }
                    }
                }
            }
        }

        // Structure Generation (Trees, etc.)
        this.generateFeatures(cx, cy, cz);

        // Generate village near spawn (spawn is at 32, 80, 32 = chunk 2, 5, 2)
        // Trigger when we generate the spawn chunk
        if (!this.spawnVillageGenerated && cx === 2 && cz === 2) {
            this.spawnVillageGenerated = true;
            // Place village slightly offset from spawn so player spawns near (not inside) village
            const villageX = Config.PLAYER.SPAWN_POINT.x + 15;
            const villageZ = Config.PLAYER.SPAWN_POINT.z + 15;
            const villageY = this.getTerrainHeight(villageX, villageZ);
            // Defer to ensure terrain is ready
            setTimeout(() => {
                this.structureGenerator.generateVillage(villageX, villageY, villageZ);
            }, 100);
        }

        chunk.isGenerated = true;
        return chunk;
    }

    generateMoonChunk(chunk, cx, cy, cz) {
        const startX = cx * this.game.chunkSize;
        const startY = cy * this.game.chunkSize;
        const startZ = cz * this.game.chunkSize;

        // Base height of Moon surface relative to global Y=0
        const moonBaseY = Config.WORLD.MOON_CHUNK_Y_START * this.game.chunkSize + 32;

        for (let x = 0; x < this.game.chunkSize; x++) {
            for (let z = 0; z < this.game.chunkSize; z++) {
                const wx = startX + x;
                const wz = startZ + z;

                // Moon Terrain Noise
                // Craters and dunes
                const baseNoise = this.noise.get2D(wx, wz, 0.02, 1);
                const detailNoise = this.noise.get2D(wx, wz, 0.05, 1);

                let height = moonBaseY + baseNoise * 15 + detailNoise * 3;

                // Crater Logic (Simple)
                // Use a different noise freq to dig "craters"
                const craterNoise = this.noise.get2D(wx + 1000, wz + 1000, 0.01, 1);
                if (craterNoise > 0.6) {
                    const depth = (craterNoise - 0.6) * 40; // Dig deep
                    height -= depth;

                    // Rim
                    if (craterNoise < 0.65) {
                        height += 2;
                    }
                }

                for (let y = 0; y < this.game.chunkSize; y++) {
                    const wy = startY + y;

                    if (wy <= height) {
                        this.game.setBlock(wx, wy, wz, Blocks.STONE, true, true);
                    }
                }
            }
        }

        chunk.isGenerated = true;
        return chunk;
    }

    generateFeatures(cx, cy, cz) {
        this.structureGenerator.generateFeatures(cx, cy, cz);
    }

    setSeed(seed) {
        console.log('WorldGenerator: Setting seed to', seed);
        this.seed = seed;
        this.noise = new NoiseGenerator(seed);
        // Propagate seed to all sub-generators for deterministic world generation
        this.biomeManager.setSeed(seed);
        this.terrainGenerator.setSeed(seed);
        this.structureGenerator.setSeed(seed);
    }

    /**
     * Generate a deterministic hash from world position and seed
     * Used for ore generation and other position-based random features
     */
    getPositionHash(x, y, z) {
        const seed = this.seed || 0;
        // Simple hash combining position and seed
        let hash = seed;
        hash = ((hash << 5) + hash) ^ (x * 73856093);
        hash = ((hash << 5) + hash) ^ (y * 19349663);
        hash = ((hash << 5) + hash) ^ (z * 83492791);
        return Math.abs(hash) >>> 0; // Ensure positive 32-bit integer
    }
}
