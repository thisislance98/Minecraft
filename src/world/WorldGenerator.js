import { NoiseGenerator } from '../utils/NoiseGenerator.js';
import { BiomeManager } from './BiomeManager.js';
import { TerrainGenerator } from './TerrainGenerator.js';
import { StructureGenerator } from './StructureGenerator.js';
import { Config } from '../game/core/Config.js';

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
                        this.game.setBlock(wx, wy, wz, 'bedrock', true);
                        continue;
                    }

                    // Caves
                    if (this.isCave(wx, wy, wz) && wy < groundHeight && wy > 0) {
                        this.game.setBlock(wx, wy, wz, null, true); // Air
                        continue;
                    }

                    // Terrain
                    if (wy <= groundHeight) {
                        let type = 'stone';

                        // Ore Generation
                        if (type === 'stone') {
                            const depth = groundHeight - wy;
                            const rand = Math.random();

                            // Coal: Common, anywhere under ground
                            if (rand < 0.03) { // 3% chance
                                type = 'coal_ore';
                            }
                            // Iron: Uncommon, below sea level or deep
                            else if (wy < this.seaLevel && rand < 0.06) { // +3% chance (exclusive from above if structure changes, but here simple if-else chain)
                                type = 'iron_ore';
                            }
                            // Gold: Rare, deep
                            else if (wy < 15 && rand < 0.08) { // +2% chance
                                type = 'gold_ore';
                            }
                            // Diamond: Very Rare, very deep
                            else if (wy < 8 && rand < 0.09) { // +1% chance
                                type = 'diamond_ore';
                            }
                            // Make it explicit priority to avoid higher probability overwriting
                            // Let's rewrite for clarity and priority (rarest first)

                            const oreRand = Math.random();
                            if (wy < 8 && oreRand < Config.GENERATION.ORE_DIAMOND) { // Diamond
                                type = 'diamond_ore';
                            } else if (wy < 15 && oreRand < Config.GENERATION.ORE_GOLD) { // Gold
                                type = 'gold_ore';
                            } else if (wy < this.seaLevel && oreRand < Config.GENERATION.ORE_IRON) { // Iron
                                type = 'iron_ore';
                            } else if (oreRand < Config.GENERATION.ORE_COAL) { // Coal
                                type = 'coal_ore';
                            }
                        }

                        // Dirt/Grass layers
                        if (wy === groundHeight) {
                            if (biome === 'DESERT') type = 'sand';
                            else if (biome === 'SNOW') type = 'snow';
                            else if (groundHeight < this.seaLevel + 2 && biome !== 'MOUNTAIN') type = 'sand'; // Beach
                            else type = 'grass';
                        } else if (wy > groundHeight - 4) {
                            if (biome === 'DESERT') type = 'sand';
                            else type = 'dirt';
                        }

                        this.game.setBlock(wx, wy, wz, type, true);
                    } else {
                        // Water
                        if (wy <= this.seaLevel) {
                            this.game.setBlock(wx, wy, wz, 'water', true);
                        }
                    }
                }
            }
        }

        // Structure Generation (Trees, etc.)
        this.generateFeatures(cx, cy, cz);

        chunk.isGenerated = true;
        return chunk;
    }

    generateFeatures(cx, cy, cz) {
        this.structureGenerator.generateFeatures(cx, cy, cz);
    }

    setSeed(seed) {
        console.log('WorldGenerator: Setting seed to', seed);
        this.noise = new NoiseGenerator(seed);
        // We might need to propagate seed to other generators if they use their own noise
        // But currently StructureGenerator uses this.worldGen.noise
        // TerrainGenerator uses biomeManager...
        // BiomeManager uses its own noise?
        // Let's check BiomeManager...
        this.biomeManager.setSeed(seed);
    }
}
