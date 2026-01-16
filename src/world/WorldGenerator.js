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

        // Apply config settings
        this.terrainGenerator.setRiversEnabled(Config.GENERATION.ENABLE_RIVERS);

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

    // Optimized version when height is already computed - avoids redundant noise calculations
    getBiomeWithHeight(x, z, height) {
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

        // Crystal World Generation
        if (cy >= Config.WORLD.CRYSTAL_WORLD_Y_START && cy < Config.WORLD.CRYSTAL_WORLD_Y_START + Config.WORLD.CRYSTAL_WORLD_HEIGHT) {
            return this.generateCrystalWorldChunk(chunk, cx, cy, cz);
        }

        // Lava World Generation
        if (cy >= Config.WORLD.LAVA_WORLD_Y_START && cy < Config.WORLD.LAVA_WORLD_Y_START + Config.WORLD.LAVA_WORLD_HEIGHT) {
            return this.generateLavaWorldChunk(chunk, cx, cy, cz);
        }

        const startX = cx * this.game.chunkSize;
        const startY = cy * this.game.chunkSize;
        const startZ = cz * this.game.chunkSize;

        for (let x = 0; x < this.game.chunkSize; x++) {
            for (let z = 0; z < this.game.chunkSize; z++) {
                const wx = startX + x;
                const wz = startZ + z;

                // 2D Terrain Height (Cached in TerrainGenerator)
                const groundHeight = this.getTerrainHeight(wx, wz);
                const biome = this.getBiomeWithHeight(wx, wz, groundHeight);

                // OPTIMIZATION: Check if this column is entirely above groundwork once
                const columnIsUnderground = startY <= groundHeight;

                for (let y = 0; y < this.game.chunkSize; y++) {
                    const wy = startY + y;

                    // Bedrock (Always first)
                    if (wy === 0) {
                        this.game.setBlock(wx, wy, wz, Blocks.BEDROCK, true, true);
                        continue;
                    }

                    // Caves: Only check if we are below ground level
                    // Swap order: check wy < groundHeight BEFORE expensive 3D noise isCave
                    if (wy < groundHeight && wy > 0 && this.isCave(wx, wy, wz)) {
                        this.game.setBlock(wx, wy, wz, null, true, true); // Air
                        continue;
                    }

                    // Terrain Generation
                    if (wy <= groundHeight) {
                        let type = Blocks.STONE;

                        // Ore Generation
                        const oreHash = this.getPositionHash(wx, wy, wz);
                        const oreRand = (oreHash % 10000) / 10000;

                        if (wy < 8 && oreRand < Config.GENERATION.ORE_DIAMOND) type = Blocks.DIAMOND_ORE;
                        else if (wy < 15 && oreRand < Config.GENERATION.ORE_GOLD) type = Blocks.GOLD_ORE;
                        else if (wy < this.seaLevel && oreRand < Config.GENERATION.ORE_IRON) type = Blocks.IRON_ORE;
                        else if (oreRand < Config.GENERATION.ORE_COAL) type = Blocks.COAL_ORE;

                        // Surface/Sub-surface layers
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
                    } else if (wy <= this.seaLevel) {
                        // Water
                        this.game.setBlock(wx, wy, wz, Blocks.WATER, true, true);
                    }
                }
            }
        }

        // Structure Generation (Trees, etc.)
        this.generateFeatures(cx, cy, cz);

        // Generate village near spawn (spawn is at 32, 80, 32 = chunk 2, 5, 2)
        // Trigger when we generate a nearby chunk
        if (!this.spawnVillageGenerated && cx === 3 && cz === 3) {
            this.spawnVillageGenerated = true;
            // Place village at least 20 blocks from spawn so player doesn't spawn inside it
            const minVillageDistance = 20;
            const villageX = Config.PLAYER.SPAWN_POINT.x + minVillageDistance;
            const villageZ = Config.PLAYER.SPAWN_POINT.z + minVillageDistance;
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

    generateCrystalWorldChunk(chunk, cx, cy, cz) {
        const startX = cx * this.game.chunkSize;
        const startY = cy * this.game.chunkSize;
        const startZ = cz * this.game.chunkSize;

        // Base height of Crystal World surface
        const crystalBaseY = Config.WORLD.CRYSTAL_WORLD_Y_START * this.game.chunkSize + 32;

        for (let x = 0; x < this.game.chunkSize; x++) {
            for (let z = 0; z < this.game.chunkSize; z++) {
                const wx = startX + x;
                const wz = startZ + z;

                // Crystal terrain with spiky formations
                const baseNoise = this.noise.get2D(wx, wz, 0.015, 1);
                const detailNoise = this.noise.get2D(wx, wz, 0.06, 1);
                const spireNoise = this.noise.get2D(wx + 2000, wz + 2000, 0.08, 1);

                let height = crystalBaseY + baseNoise * 20 + detailNoise * 5;

                // Crystal spire formations
                if (spireNoise > 0.5) {
                    const spireHeight = (spireNoise - 0.5) * 30;
                    height += spireHeight;
                }

                for (let y = 0; y < this.game.chunkSize; y++) {
                    const wy = startY + y;

                    if (wy <= height) {
                        // Surface layer
                        if (wy > height - 2) {
                            // Crystal spires glow at tips
                            if (spireNoise > 0.6 && wy > height - 1) {
                                this.game.setBlock(wx, wy, wz, Blocks.CRYSTAL_GLOW, true, true);
                            } else {
                                this.game.setBlock(wx, wy, wz, Blocks.CRYSTAL_GROUND, true, true);
                            }
                        } else if (wy > height - 6) {
                            this.game.setBlock(wx, wy, wz, Blocks.CRYSTAL_STONE, true, true);
                        } else {
                            this.game.setBlock(wx, wy, wz, Blocks.STONE, true, true);
                        }
                    }
                }

                // Add crystal shard decorations
                const shardNoise = this.noise.get2D(wx + 500, wz + 500, 0.1, 1);
                if (shardNoise > 0.7 && height > crystalBaseY + 5) {
                    const shardHeight = Math.floor((shardNoise - 0.7) * 10) + 1;
                    for (let s = 1; s <= shardHeight; s++) {
                        const wy = Math.floor(height) + s;
                        if (wy >= startY && wy < startY + this.game.chunkSize) {
                            this.game.setBlock(wx, wy, wz, Blocks.CRYSTAL_SHARD, true, true);
                        }
                    }
                }
            }
        }

        chunk.isGenerated = true;
        return chunk;
    }

    generateLavaWorldChunk(chunk, cx, cy, cz) {
        const startX = cx * this.game.chunkSize;
        const startY = cy * this.game.chunkSize;
        const startZ = cz * this.game.chunkSize;

        // Base height of Lava World surface
        const lavaBaseY = Config.WORLD.LAVA_WORLD_Y_START * this.game.chunkSize + 32;
        const lavaLevelY = lavaBaseY - 5; // Lava lakes below this level

        for (let x = 0; x < this.game.chunkSize; x++) {
            for (let z = 0; z < this.game.chunkSize; z++) {
                const wx = startX + x;
                const wz = startZ + z;

                // Volcanic terrain with craters
                const baseNoise = this.noise.get2D(wx, wz, 0.02, 1);
                const detailNoise = this.noise.get2D(wx, wz, 0.05, 1);
                const craterNoise = this.noise.get2D(wx + 3000, wz + 3000, 0.015, 1);

                let height = lavaBaseY + baseNoise * 18 + detailNoise * 4;

                // Crater logic - dig down into lava lakes  
                if (craterNoise > 0.55) {
                    const depth = (craterNoise - 0.55) * 35;
                    height -= depth;

                    // Crater rim
                    if (craterNoise < 0.6) {
                        height += 3;
                    }
                }

                for (let y = 0; y < this.game.chunkSize; y++) {
                    const wy = startY + y;

                    if (wy <= height) {
                        // Surface layer
                        if (wy > height - 2) {
                            // Ember blocks near lava level
                            if (height < lavaLevelY + 3) {
                                this.game.setBlock(wx, wy, wz, Blocks.EMBER_BLOCK, true, true);
                            } else {
                                this.game.setBlock(wx, wy, wz, Blocks.OBSIDITE_GROUND, true, true);
                            }
                        } else if (wy > height - 8) {
                            this.game.setBlock(wx, wy, wz, Blocks.MAGMA_STONE, true, true);
                        } else {
                            this.game.setBlock(wx, wy, wz, Blocks.COOLED_LAVA, true, true);
                        }
                    } else if (wy <= lavaLevelY && height < lavaLevelY) {
                        // Fill with lava (use fire for visual effect)
                        this.game.setBlock(wx, wy, wz, Blocks.FIRE, true, true);
                    }
                }

                // Add fire plants on safe surfaces
                const plantNoise = this.noise.get2D(wx + 700, wz + 700, 0.12, 1);
                if (plantNoise > 0.75 && height > lavaLevelY + 3) {
                    const plantY = Math.floor(height) + 1;
                    if (plantY >= startY && plantY < startY + this.game.chunkSize) {
                        this.game.setBlock(wx, plantY, wz, Blocks.FIRE_PLANT, true, true);
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
