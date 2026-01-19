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
        this.oceansEnabled = true; // Whether to generate ocean water at sea level

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

        // Soccer World Generation
        if (cy >= Config.WORLD.SOCCER_WORLD_Y_START && cy < Config.WORLD.SOCCER_WORLD_Y_START + Config.WORLD.SOCCER_WORLD_HEIGHT) {
            return this.generateSoccerWorldChunk(chunk, cx, cy, cz);
        }

        // Space between worlds - generate empty chunks (no terrain)
        // This prevents Earth terrain from appearing between Moon and Crystal World, etc.
        if (cy >= Config.WORLD.MOON_CHUNK_Y_START) {
            // Any chunk above moon level that isn't assigned to a specific world is empty space
            chunk.isGenerated = true;
            return chunk;
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
                    } else if (wy <= this.seaLevel && this.oceansEnabled) {
                        // Water (only if oceans are enabled)
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
            // Place village center at least 150 blocks from spawn so player doesn't spawn near it
            // (village houses spread 24-36 blocks from center, so 150 ensures significant distance)
            const minVillageDistance = 150;
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

        // Moon sphere parameters
        // Center of the moon sphere - centered at X=0, Z=0
        const moonCenterX = 0;
        const moonCenterZ = 0;
        // Moon center Y is in the middle of the moon chunk range
        const moonCenterY = Config.WORLD.MOON_CHUNK_Y_START * this.game.chunkSize + (Config.WORLD.MOON_CHUNK_HEIGHT * this.game.chunkSize) / 2;

        // Moon radius - fits within the chunk range with some margin
        // 8 chunks tall = 128 blocks, so radius of ~56 blocks gives good spherical shape
        const moonRadius = 56;
        const moonRadiusSq = moonRadius * moonRadius;

        for (let x = 0; x < this.game.chunkSize; x++) {
            for (let z = 0; z < this.game.chunkSize; z++) {
                const wx = startX + x;
                const wz = startZ + z;

                for (let y = 0; y < this.game.chunkSize; y++) {
                    const wy = startY + y;

                    // Calculate distance from moon center
                    const dx = wx - moonCenterX;
                    const dy = wy - moonCenterY;
                    const dz = wz - moonCenterZ;
                    const distSq = dx * dx + dy * dy + dz * dz;
                    const dist = Math.sqrt(distSq);

                    // Only place blocks inside the sphere
                    if (dist <= moonRadius) {
                        // Calculate surface variation using 3D noise for crater-like surface
                        // Use spherical coordinates for better crater distribution
                        const theta = Math.atan2(dz, dx);
                        const phi = Math.acos(dy / (dist + 0.001)); // +0.001 to avoid division by zero

                        // Map to 2D coordinates for noise sampling
                        const noiseX = theta * 50;  // Scale for noise frequency
                        const noiseZ = phi * 50;

                        const baseNoise = this.noise.get2D(noiseX, noiseZ, 0.02, 1);
                        const detailNoise = this.noise.get2D(noiseX, noiseZ, 0.05, 1);

                        // Surface variation - craters dig into the sphere
                        let surfaceOffset = baseNoise * 8 + detailNoise * 2;

                        // Crater Logic - dig deeper craters
                        const craterNoise = this.noise.get2D(noiseX + 1000, noiseZ + 1000, 0.01, 1);
                        if (craterNoise > 0.6) {
                            const depth = (craterNoise - 0.6) * 25; // Crater depth
                            surfaceOffset -= depth;

                            // Crater rim
                            if (craterNoise < 0.65) {
                                surfaceOffset += 2;
                            }
                        }

                        // Check if this voxel is inside the moon surface (with variation)
                        const effectiveRadius = moonRadius + surfaceOffset;
                        if (dist <= effectiveRadius) {
                            // Surface detection for different block types (if desired)
                            const depthFromSurface = effectiveRadius - dist;

                            // All moon blocks are stone (moon rock)
                            this.game.setBlock(wx, wy, wz, Blocks.STONE, true, true);
                        }
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

    /**
     * Generate Soccer World - Rocket League style arena
     * A flat green field with walls, goals, and field markings
     */
    generateSoccerWorldChunk(chunk, cx, cy, cz) {
        const startX = cx * this.game.chunkSize;
        const startY = cy * this.game.chunkSize;
        const startZ = cz * this.game.chunkSize;

        // Base height of Soccer World surface
        const soccerBaseY = Config.WORLD.SOCCER_WORLD_Y_START * this.game.chunkSize + 32;

        // Arena dimensions (Rocket League style - large!)
        const arenaHalfLengthX = 80;  // 160 blocks long (X axis)
        const arenaHalfWidthZ = 50;   // 100 blocks wide (Z axis)
        const wallHeight = 15;         // Height of arena walls
        const goalWidth = 20;          // Goal opening width
        const goalDepth = 8;           // How far back the goal goes
        const goalHeight = 10;         // Goal height

        for (let x = 0; x < this.game.chunkSize; x++) {
            for (let z = 0; z < this.game.chunkSize; z++) {
                const wx = startX + x;
                const wz = startZ + z;

                // Check if we're within the arena bounds
                const inArenaX = Math.abs(wx) <= arenaHalfLengthX + goalDepth;
                const inArenaZ = Math.abs(wz) <= arenaHalfWidthZ;

                // Check if we're in the goal area
                const inGoalAreaX = Math.abs(wx) > arenaHalfLengthX && Math.abs(wx) <= arenaHalfLengthX + goalDepth;
                const inGoalZ = Math.abs(wz) <= goalWidth / 2;
                const inGoal = inGoalAreaX && inGoalZ;

                // Check if we're on the main field
                const onField = Math.abs(wx) <= arenaHalfLengthX && Math.abs(wz) <= arenaHalfWidthZ;

                for (let y = 0; y < this.game.chunkSize; y++) {
                    const wy = startY + y;

                    // Floor layer
                    if (wy === soccerBaseY) {
                        if (onField || inGoal) {
                            // Check for field markings
                            const isLineBlock = this.isSoccerFieldLine(wx, wz, arenaHalfLengthX, arenaHalfWidthZ);
                            if (isLineBlock) {
                                this.game.setBlock(wx, wy, wz, Blocks.SOCCER_LINE, true, true);
                            } else {
                                this.game.setBlock(wx, wy, wz, Blocks.SOCCER_FIELD, true, true);
                            }
                        }
                    }
                    // Below floor - solid foundation
                    else if (wy < soccerBaseY && wy > soccerBaseY - 3) {
                        if (onField || inGoal) {
                            this.game.setBlock(wx, wy, wz, Blocks.SOCCER_FIELD, true, true);
                        }
                    }
                    // Walls
                    else if (wy > soccerBaseY && wy <= soccerBaseY + wallHeight) {
                        // Side walls (Z boundaries)
                        if (Math.abs(wz) === arenaHalfWidthZ && Math.abs(wx) <= arenaHalfLengthX) {
                            this.game.setBlock(wx, wy, wz, Blocks.SOCCER_WALL, true, true);
                        }
                        // End walls (X boundaries) - with goal openings
                        if (Math.abs(wx) === arenaHalfLengthX && Math.abs(wz) < arenaHalfWidthZ) {
                            // Check if this is the goal opening
                            if (Math.abs(wz) <= goalWidth / 2 && wy <= soccerBaseY + goalHeight) {
                                // Don't place wall here - goal opening
                            } else {
                                this.game.setBlock(wx, wy, wz, Blocks.SOCCER_WALL, true, true);
                            }
                        }
                        // Corner pillars (rounded corners)
                        const cornerDist = Math.sqrt(
                            Math.pow(Math.abs(wx) - arenaHalfLengthX, 2) +
                            Math.pow(Math.abs(wz) - arenaHalfWidthZ, 2)
                        );
                        if (cornerDist <= 8 && Math.abs(wx) >= arenaHalfLengthX - 8 && Math.abs(wz) >= arenaHalfWidthZ - 8) {
                            if (Math.abs(wx) > arenaHalfLengthX || Math.abs(wz) > arenaHalfWidthZ) {
                                // Outside the straight walls - fill corner
                                this.game.setBlock(wx, wy, wz, Blocks.SOCCER_WALL, true, true);
                            }
                        }

                        // Goal structures
                        if (inGoal) {
                            // Goal frame (posts and crossbar)
                            const isGoalPost = Math.abs(wz) >= goalWidth / 2 - 1 && Math.abs(wz) <= goalWidth / 2;
                            const isCrossbar = wy === soccerBaseY + goalHeight && Math.abs(wz) <= goalWidth / 2;
                            const isBackWall = Math.abs(wx) === arenaHalfLengthX + goalDepth;

                            if (isGoalPost || isCrossbar) {
                                this.game.setBlock(wx, wy, wz, Blocks.SOCCER_GOAL_FRAME, true, true);
                            } else if (isBackWall && wy <= soccerBaseY + goalHeight) {
                                // Back of goal net
                                this.game.setBlock(wx, wy, wz, Blocks.SOCCER_GOAL_NET, true, true);
                            }
                        }
                    }
                }
            }
        }

        chunk.isGenerated = true;
        return chunk;
    }

    /**
     * Check if a position should have a field line marking
     */
    isSoccerFieldLine(wx, wz, arenaHalfLengthX, arenaHalfWidthZ) {
        // Center line
        if (Math.abs(wx) <= 1) return true;

        // Center circle (radius ~15 blocks)
        const centerDist = Math.sqrt(wx * wx + wz * wz);
        if (centerDist >= 14 && centerDist <= 16) return true;

        // Center spot
        if (Math.abs(wx) <= 1 && Math.abs(wz) <= 1) return true;

        // Penalty areas (large boxes near goals)
        const penaltyAreaLength = 25;
        const penaltyAreaWidth = 35;
        if (Math.abs(wx) >= arenaHalfLengthX - penaltyAreaLength && Math.abs(wx) <= arenaHalfLengthX - penaltyAreaLength + 1) {
            if (Math.abs(wz) <= penaltyAreaWidth / 2) return true;
        }
        if (Math.abs(wx) >= arenaHalfLengthX - penaltyAreaLength && Math.abs(wz) >= penaltyAreaWidth / 2 - 1 && Math.abs(wz) <= penaltyAreaWidth / 2) {
            return true;
        }

        // Goal area (smaller box)
        const goalAreaLength = 10;
        const goalAreaWidth = 18;
        if (Math.abs(wx) >= arenaHalfLengthX - goalAreaLength && Math.abs(wx) <= arenaHalfLengthX - goalAreaLength + 1) {
            if (Math.abs(wz) <= goalAreaWidth / 2) return true;
        }
        if (Math.abs(wx) >= arenaHalfLengthX - goalAreaLength && Math.abs(wz) >= goalAreaWidth / 2 - 1 && Math.abs(wz) <= goalAreaWidth / 2) {
            return true;
        }

        // Penalty spots
        const penaltySpotDist = 18;
        if (Math.abs(Math.abs(wx) - (arenaHalfLengthX - penaltySpotDist)) <= 1 && Math.abs(wz) <= 1) {
            return true;
        }

        // Field boundary lines
        if (Math.abs(wx) >= arenaHalfLengthX - 1 && Math.abs(wz) <= arenaHalfWidthZ) return true;
        if (Math.abs(wz) >= arenaHalfWidthZ - 1 && Math.abs(wx) <= arenaHalfLengthX) return true;

        return false;
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
     * Enable or disable rivers in terrain generation
     * @param {boolean} enabled - Whether rivers should be generated
     */
    setRiversEnabled(enabled) {
        console.log('WorldGenerator: Setting rivers enabled to', enabled);
        this.terrainGenerator.setRiversEnabled(enabled);
    }

    /**
     * Enable or disable ocean water generation at sea level
     * @param {boolean} enabled - Whether oceans should be generated
     */
    setOceansEnabled(enabled) {
        console.log('WorldGenerator: Setting oceans enabled to', enabled);
        this.oceansEnabled = enabled;
    }

    /**
     * Set the sea level for terrain generation
     * @param {number} level - The sea level (affects ocean/water generation)
     */
    setSeaLevel(level) {
        console.log('WorldGenerator: Setting sea level to', level);
        this.seaLevel = level;
        this.terrainGenerator.seaLevel = level;
    }

    /**
     * Clear all terrain caches (needed when landscape settings change)
     */
    clearTerrainCache() {
        console.log('WorldGenerator: Clearing terrain cache');
        this.terrainGenerator.clearCache();
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
