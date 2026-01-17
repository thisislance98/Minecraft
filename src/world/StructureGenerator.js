import { Villager } from '../game/entities/animals/Villager.js';
// StaticLampost import removed
import { Blocks } from '../game/core/Blocks.js';
import { SeededRandom } from '../utils/SeededRandom.js';
import { Config } from '../game/core/Config.js';
import * as THREE from 'three';

export class StructureGenerator {

    // Book block types for varied bookshelves
    static BOOK_BLOCKS = [
        Blocks.BOOK_RED,
        Blocks.BOOK_BLUE,
        Blocks.BOOK_GREEN,
        Blocks.BOOK_BROWN,
        Blocks.BOOK_PURPLE,
        Blocks.BOOK_MIXED
    ];

    constructor(game, worldGenerator) {
        this.game = game;
        this.worldGenerator = worldGenerator;
        this.seed = 0;
        this.rng = new SeededRandom(0);
        // Cache of recent tree positions to prevent trees from spawning too close
        this.recentTreePositions = [];
        this.minTreeDistance = 8; // Minimum distance between trees
    }

    /**
     * Check if a tree can be placed at the given position (deterministic check)
     * Uses hash-based lookup of nearby positions to ensure trees don't spawn too close
     * This is deterministic so trees regenerate correctly when chunks reload
     */
    canPlaceTree(x, z) {
        // Check nearby positions in a grid pattern to see if any would generate a tree
        // We need to check positions that could conflict (within minTreeDistance)
        const checkDist = Math.ceil(this.minTreeDistance);

        for (let dx = -checkDist; dx <= checkDist; dx++) {
            for (let dz = -checkDist; dz <= checkDist; dz++) {
                if (dx === 0 && dz === 0) continue; // Skip self

                const nx = x + dx;
                const nz = z + dz;
                const dist = Math.sqrt(dx * dx + dz * dz);

                if (dist >= this.minTreeDistance) continue; // Too far to conflict

                // Check if position (nx, nz) would spawn a tree using the same deterministic logic
                const neighborHash = this.hashPosition(nx, nz, 1);
                const neighborRand = (neighborHash % 10000) / 10000;

                if (neighborRand < 0.01) {
                    // This neighbor position wants to spawn a tree
                    // Use a tiebreaker: lower hash wins (deterministic priority)
                    const myHash = this.hashPosition(x, z, 1);
                    if (neighborHash < myHash) {
                        return false; // Neighbor has priority, we can't place here
                    }
                }
            }
        }
        return true;
    }

    /**
     * Mark a tree as placed at the given position
     * No longer needed with deterministic canPlaceTree, kept for compatibility
     */
    markTreePlaced(x, z) {
        // No-op - deterministic placement doesn't need tracking
    }

    /**
     * Get a deterministic book block type based on position for visual variety
     */
    getRandomBookBlock(x = 0, y = 0, z = 0) {
        // Use position hash for deterministic book selection
        const hash = this.hashPosition(x, z, 500 + y);
        return StructureGenerator.BOOK_BLOCKS[hash % StructureGenerator.BOOK_BLOCKS.length];
    }

    setSeed(seed) {
        this.seed = seed;
        this.rng = new SeededRandom(seed);
    }

    getPositionRandom(x, z, salt = 0) {
        const hash = this.hashPosition(x, z, salt);
        const rng = new SeededRandom(hash);
        return rng.next();
    }

    getPositionRng(x, z, salt = 0) {
        const hash = this.hashPosition(x, z, salt);
        return new SeededRandom(hash);
    }

    hashPosition(x, z, salt = 0) {
        let hash = this.seed;
        hash = ((hash << 5) + hash) ^ (x * 73856093);
        hash = ((hash << 5) + hash) ^ (z * 83492791);
        hash = ((hash << 5) + hash) ^ (salt * 19349663);
        return Math.abs(hash) >>> 0;
    }

    generateFeatures(cx, cy, cz) {
        const startX = cx * this.game.chunkSize;
        const startY = cy * this.game.chunkSize;
        const startZ = cz * this.game.chunkSize;

        for (let x = 0; x < this.game.chunkSize; x++) {
            for (let z = 0; z < this.game.chunkSize; z++) {
                const wx = startX + x;
                const wz = startZ + z;

                // OPTIMIZATION: Use a simple hash instead of creating a NEW SeededRandom object for every column
                const hash = this.hashPosition(wx, wz, 1);
                const rand = (hash % 10000) / 10000;

                if (rand < 0.01) {
                    const groundHeight = this.worldGenerator.getTerrainHeight(wx, wz);
                    const biome = this.worldGenerator.getBiomeWithHeight(wx, wz, groundHeight);

                    // Reuse a local RNG for feature-specific checks to keep them deterministic but fast
                    const featureRngValue = (hash % 12345) / 12345;
                    if (groundHeight >= startY && groundHeight < startY + this.game.chunkSize) {
                        const wy = groundHeight;
                        const blockBelow = this.game.getBlockWorld(wx, wy, wz);

                        if (blockBelow === Blocks.GRASS || (biome === 'SNOW' && blockBelow === Blocks.SNOW) || (biome === 'DESERT' && blockBelow === Blocks.SAND)) {
                            // Check distance from spawn point - houses must be at least 100 blocks away
                            const spawnX = Config.PLAYER.SPAWN_POINT.x;
                            const spawnZ = Config.PLAYER.SPAWN_POINT.z;
                            const distFromSpawn = Math.sqrt((wx - spawnX) ** 2 + (wz - spawnZ) ** 2);
                            const minHouseDistanceFromSpawn = 100;

                            // Secondary roll for houses
                            const houseRand = ((hash >> 2) % 10000) / 10000;
                            if ((biome === 'PLAINS' || biome === 'FOREST' || biome === 'SNOW') && houseRand < 0.1 && distFromSpawn >= minHouseDistanceFromSpawn) {
                                let isFlat = true;
                                const h0 = wy;
                                const checkSize = 7;
                                for (let hx = 0; hx < checkSize; hx++) {
                                    for (let hz = 0; hz < checkSize; hz++) {
                                        if (this.worldGenerator.getTerrainHeight(wx + hx, wz + hz) !== h0) {
                                            isFlat = false;
                                            break;
                                        }
                                    }
                                    if (!isFlat) break;
                                }

                                if (isFlat) {
                                    this.generateHouse(wx, wy + 1, wz, biome);
                                }
                            } else {
                                const treeRand = ((hash >> 4) % 10000) / 10000;
                                // Check if tree can be placed (not too close to other trees)
                                if (!this.canPlaceTree(wx, wz)) {
                                    continue; // Skip - too close to another tree
                                }
                                if (biome === 'DESERT') {
                                    if (treeRand < 0.2) {
                                        this.generateCactus(wx, wy + 1, wz);
                                        this.markTreePlaced(wx, wz);
                                    } else if (treeRand < 0.205) {
                                        this.generatePalmTree(wx, wy + 1, wz);
                                        this.markTreePlaced(wx, wz);
                                    }
                                } else if (biome === 'JUNGLE') {
                                    this.generateJungleTree(wx, wy + 1, wz);
                                    this.markTreePlaced(wx, wz);
                                } else if (biome === 'FOREST') {
                                    // Forest Variety: Oak (40%), Birch (30%), Pine (15%), Dark Oak (10%), Willow (5%)
                                    if (treeRand < 0.40) this.generateOakTree(wx, wy + 1, wz);
                                    else if (treeRand < 0.70) this.generateBirchTree(wx, wy + 1, wz);
                                    else if (treeRand < 0.85) this.generatePineTree(wx, wy + 1, wz);
                                    else if (treeRand < 0.95) this.generateDarkOakTree(wx, wy + 1, wz);
                                    else this.generateWillowTree(wx, wy + 1, wz);
                                    this.markTreePlaced(wx, wz);
                                } else if (biome === 'MOUNTAIN' || biome === 'SNOW') {
                                    if (treeRand < 0.5) this.generatePineTree(wx, wy + 1, wz);
                                    else this.generateOakTree(wx, wy + 1, wz);
                                    this.markTreePlaced(wx, wz);
                                } else if (biome === 'PLAINS') {
                                    if (treeRand < 0.05) {
                                        this.generateOakTree(wx, wy + 1, wz);
                                        this.markTreePlaced(wx, wz);
                                    } else if (treeRand < 0.07) {
                                        this.generateAcaciaTree(wx, wy + 1, wz);
                                        this.markTreePlaced(wx, wz);
                                    } else if (treeRand < 0.075) {
                                        this.generateBeanstalk(wx, wy + 1, wz);
                                        this.markTreePlaced(wx, wz);
                                    }
                                } else {
                                    if (treeRand < 0.1) {
                                        this.generateOakTree(wx, wy + 1, wz);
                                        this.markTreePlaced(wx, wz);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    generateHouse(x, y, z, biome) {
        const styles = [
            { name: 'Oak Cabin', wall: Blocks.PLANK, corner: Blocks.LOG, floor: Blocks.PLANK, roof: Blocks.PINE_WOOD, window: Blocks.GLASS, biomes: ['PLAINS', 'FOREST'] },
            { name: 'Birch Cottage', wall: Blocks.BIRCH_WOOD, corner: Blocks.PINE_WOOD, floor: Blocks.PLANK, roof: Blocks.PINE_WOOD, window: Blocks.GLASS, biomes: ['FOREST', 'PLAINS'] },
            { name: 'Stone Keep', wall: Blocks.STONE, corner: Blocks.STONE, floor: Blocks.PLANK, roof: Blocks.STONE, window: Blocks.GLASS, biomes: ['MOUNTAIN', 'PLAINS'] },
            { name: 'Brick House', wall: Blocks.BRICK, corner: Blocks.BRICK, floor: Blocks.PLANK, roof: Blocks.PINE_WOOD, window: Blocks.GLASS, biomes: ['PLAINS', 'FOREST'] },
            { name: 'Snow Hut', wall: Blocks.SNOW, corner: Blocks.SNOW, floor: Blocks.PLANK, roof: Blocks.SNOW, window: Blocks.GLASS, biomes: ['SNOW'] }
        ];

        let validStyles = styles.filter(s => s.biomes.includes(biome));
        if (validStyles.length === 0) validStyles = styles.filter(s => s.name === 'Oak Cabin');

        const houseRng = this.getPositionRng(x, z, 100);
        const style = validStyles[Math.floor(houseRng.next() * validStyles.length)];

        const shapes = [
            { w: 5, d: 5, h: 4, type: 'Classic' },
            { w: 4, d: 4, h: 6, type: 'Tower' },
            { w: 7, d: 5, h: 4, type: 'Wide' },
            { w: 6, d: 6, h: 5, type: 'BigBox' }
        ];
        const shape = shapes[Math.floor(houseRng.next() * shapes.length)];

        const width = shape.w;
        const depth = shape.d;
        const height = shape.h;

        // Foundation removed - houses now sit naturally on landscape

        for (let dx = 0; dx < width; dx++) {
            for (let dz = 0; dz < depth; dz++) {
                this.game.setBlock(x + dx, y, z + dz, style.floor, true, true);
                this.game.setBlock(x + dx, y + height, z + dz, style.roof, true, true);

                for (let dy = 1; dy < height; dy++) {
                    let isCorner = (dx === 0 || dx === width - 1) && (dz === 0 || dz === depth - 1);
                    let isWall = (dx === 0 || dx === width - 1 || dz === 0 || dz === depth - 1);

                    if (isWall) {
                        let block = style.wall;
                        if (isCorner) block = style.corner;
                        if (dx === Math.floor(width / 2) && dz === 0 && dy < 3) block = null;
                        if (dy === 2 && !isCorner) {
                            if ((dx === 0 || dx === width - 1) && dz % 2 === 0) block = style.window;
                            if ((dz === 0 || dz === depth - 1) && dx % 2 === 0) block = style.window;
                        }
                        if (block) this.game.setBlock(x + dx, y + dy, z + dz, block, true, true);
                    }
                }
            }
        }

        setTimeout(() => {
            const v = new Villager(this.game);
            const vx = x + width / 2;
            const vz = z + depth / 2;
            const groundY = this.findGroundForVillager(vx, y + 1, vz);
            v.position.set(vx, groundY, vz);
            v.mesh.position.copy(v.position);
            this.game.animals.push(v);
            this.game.scene.add(v.mesh);
        }, 500);
    }

    generateHotel(x, y, z) {
        const width = 15;
        const depth = 12;
        const floors = 3;
        const floorHeight = 5;
        const wallBlock = Blocks.BRICK;
        const floorBlock = Blocks.PLANK;
        const windowBlock = Blocks.GLASS;
        const cornerBlock = Blocks.STONE;

        console.log(`Generating Hotel at ${x},${y},${z}`);

        // Foundation
        for (let dx = -1; dx < width + 1; dx++) {
            for (let dz = -1; dz < depth + 1; dz++) {
                for (let fy = y - 4; fy < y; fy++) {
                    this.game.setBlock(x + dx, fy, z + dz, Blocks.STONE, true, true);
                }
            }
        }

        for (let f = 0; f < floors; f++) {
            const fy = y + f * floorHeight;

            // Floor
            for (let dx = 0; dx < width; dx++) {
                for (let dz = 0; dz < depth; dz++) {
                    this.game.setBlock(x + dx, fy, z + dz, floorBlock, true, true);
                }
            }

            // Walls
            for (let h = 1; h < floorHeight; h++) {
                const wy = fy + h;
                for (let dx = 0; dx < width; dx++) {
                    for (let dz = 0; dz < depth; dz++) {
                        const isEdgeX = dx === 0 || dx === width - 1;
                        const isEdgeZ = dz === 0 || dz === depth - 1;
                        const isCorner = isEdgeX && isEdgeZ;

                        if (isEdgeX || isEdgeZ) {
                            let block = wallBlock;
                            if (isCorner) block = cornerBlock;

                            // Windows
                            const isWindowPos = (dx % 3 === 1 || dz % 3 === 1) && h >= 2 && h <= 3;
                            if (isWindowPos && !isCorner) {
                                block = windowBlock;
                            }

                            // Entrance on ground floor
                            if (f === 0 && h < 4 && dz === 0 && dx >= Math.floor(width / 2) - 1 && dx <= Math.floor(width / 2) + 1) {
                                block = null; // Doorway
                            }

                            if (block) {
                                this.game.setBlock(x + dx, wy, z + dz, block, true, true);
                            }
                        }
                    }
                }
            }
        }

        // Roof
        const roofY = y + floors * floorHeight;
        for (let dx = -1; dx < width + 1; dx++) {
            for (let dz = -1; dz < depth + 1; dz++) {
                this.game.setBlock(x + dx, roofY, z + dz, Blocks.STONE, true, true);
            }
        }

        // Sign "HOTEL"
        const signY = roofY + 1;
        const centerX = x + Math.floor(width / 2);
        for (let i = 0; i < 5; i++) {
            this.game.setBlock(centerX - 2 + i, signY, z, Blocks.GOLD_BLOCK, true, true);
        }

        // Interior: Simple Stairs
        for (let f = 0; f < floors - 1; f++) {
            const fy = y + f * floorHeight;
            for (let h = 0; h < floorHeight; h++) {
                this.game.setBlock(x + width - 2, fy + h, z + 2 + h, Blocks.PLANK, true, true);
                this.game.setBlock(x + width - 2, fy + h + 1, z + 2 + h, null, true, true);
                this.game.setBlock(x + width - 2, fy + h + 2, z + 2 + h, null, true, true);
            }
        }

        // Add a few villagers as guests
        for (let i = 0; i < 3; i++) {
            const guestIndex = i;
            setTimeout(() => {
                const v = new Villager(this.game);
                const vx = x + 2 + guestIndex * 3;
                const vz = z + 2;
                const groundY = this.findGroundForVillager(vx, y + 1, vz);
                v.position.set(vx, groundY, vz);
                v.mesh.position.copy(v.position);
                this.game.animals.push(v);
                this.game.scene.add(v.mesh);
            }, 500 + guestIndex * 100);
        }
    }

    generateOakTree(x, y, z) {
        for (let i = 0; i < 5; i++) this.game.setBlock(x, y + i, z, Blocks.LOG, true, true);
        for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -2; dz <= 2; dz++) {
                for (let dy = 3; dy <= 5; dy++) {
                    if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy - 4) < 4) {
                        if (this.game.getBlockWorld(x + dx, y + dy, z + dz) === null) {
                            this.game.setBlock(x + dx, y + dy, z + dz, Blocks.LEAVES, true, true);
                        }
                    }
                }
            }
        }
    }

    generateBirchTree(x, y, z) {
        for (let i = 0; i < 6; i++) this.game.setBlock(x, y + i, z, Blocks.BIRCH_WOOD, true, true);
        for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -2; dz <= 2; dz++) {
                for (let dy = 4; dy <= 6; dy++) {
                    if (Math.abs(dx) + Math.abs(dz) < 3) {
                        if (this.game.getBlockWorld(x + dx, y + dy, z + dz) === null) {
                            this.game.setBlock(x + dx, y + dy, z + dz, Blocks.BIRCH_LEAVES, true, true);
                        }
                    }
                }
            }
        }
    }

    generatePineTree(x, y, z) {
        const rng = this.getPositionRng(x, z, 100); // Seeded random for this tree
        const height = 7 + Math.floor(rng.next() * 3);
        for (let i = 0; i < height; i++) this.game.setBlock(x, y + i, z, Blocks.PINE_WOOD, true, true);
        for (let dy = 2; dy < height + 2; dy++) {
            const radius = Math.floor((height + 2 - dy) / 2);
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    if (dx * dx + dz * dz <= radius * radius + 1) {
                        if (this.game.getBlockWorld(x + dx, y + dy, z + dz) === null) {
                            this.game.setBlock(x + dx, y + dy, z + dz, Blocks.PINE_LEAVES, true, true);
                        }
                    }
                }
            }
        }
    }

    generateCactus(x, y, z) {
        const rng = this.getPositionRng(x, z, 101); // Seeded random for this cactus
        const h = 2 + Math.floor(rng.next() * 3);
        for (let i = 0; i < h; i++) this.game.setBlock(x, y + i, z, Blocks.CACTUS, true, true);
    }

    generateJungleTree(x, y, z) {
        const rng = this.getPositionRng(x, z, 102); // Seeded random for this tree
        const height = 12 + Math.floor(rng.next() * 8);
        for (let i = 0; i < height; i++) {
            this.game.setBlock(x, y + i, z, Blocks.LOG, true, true);
            this.game.setBlock(x + 1, y + i, z, Blocks.LOG, true, true);
            this.game.setBlock(x, y + i, z + 1, Blocks.LOG, true, true);
            this.game.setBlock(x + 1, y + i, z + 1, Blocks.LOG, true, true);
        }
        for (let dy = height - 5; dy <= height + 2; dy++) {
            const r = 4 - (dy - (height - 5)) / 2;
            for (let dx = -r; dx <= r + 1; dx++) {
                for (let dz = -r; dz <= r + 1; dz++) {
                    if (this.game.getBlockWorld(x + dx, y + dy, z + dz) === null) {
                        this.game.setBlock(x + dx, y + dy, z + dz, Blocks.LEAVES, true, true);
                    }
                }
            }
        }
    }

    generateAcaciaTree(x, y, z) {
        // Savanna tree: Diagonal branching trunk, flat top
        const rng = this.getPositionRng(x, z, 103); // Seeded random for this tree
        const height = 6 + Math.floor(rng.next() * 3);

        // Base trunk
        for (let i = 0; i < Math.floor(height / 2); i++) {
            this.game.setBlock(x, y + i, z, Blocks.ACACIA_WOOD, true, true);
        }

        // Branches (Diagonal)
        const branchY = y + Math.floor(height / 2);
        const branchHeight = height - Math.floor(height / 2);

        // Branch 1
        for (let i = 0; i < branchHeight; i++) {
            this.game.setBlock(x + i, branchY + i, z, Blocks.ACACIA_WOOD, true, true);
        }
        // Branch 2 (Opposite)
        for (let i = 0; i < branchHeight; i++) {
            this.game.setBlock(x - i, branchY + i, z, Blocks.ACACIA_WOOD, true, true);
        }

        // Canopy (Flat)
        const canopyY = branchY + branchHeight;
        for (let dx = -3; dx <= 3; dx++) {
            for (let dz = -3; dz <= 3; dz++) {
                // Circular-ish flat top
                if (dx * dx + dz * dz <= 10) {
                    this.game.setBlock(x + dx, canopyY, z + dz, Blocks.ACACIA_LEAVES, true, true);
                    // Second shorter layer on top center
                    if (dx * dx + dz * dz <= 4) {
                        this.game.setBlock(x + dx, canopyY + 1, z + dz, Blocks.ACACIA_LEAVES, true, true);
                    }
                }
            }
        }
        // Also add leaves at branch ends
        for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -2; dz <= 2; dz++) {
                this.game.setBlock(x + (branchHeight - 1) + dx, branchY + (branchHeight - 1), z + dz, Blocks.ACACIA_LEAVES, true, true);
                this.game.setBlock(x - (branchHeight - 1) + dx, branchY + (branchHeight - 1), z + dz, Blocks.ACACIA_LEAVES, true, true);
            }
        }
    }

    generatePalmTree(x, y, z) {
        // Desert/Tropical: Tall thin/curved trunk, top leaves only
        const rng = this.getPositionRng(x, z, 104); // Seeded random for this tree
        const height = 8 + Math.floor(rng.next() * 5);

        // Trunk (Using Jungle Wood or similar if available, else Log)
        let cx = x;
        let cz = z;

        for (let i = 0; i < height; i++) {
            this.game.setBlock(Math.floor(cx), y + i, Math.floor(cz), Blocks.LOG, true, true);
            // Slight curve (deterministic)
            if (i > 3 && i % 3 === 0) cx += (rng.next() > 0.5 ? 1 : -1) * 0.5;
        }

        const topY = y + height;
        const topX = Math.floor(cx);
        const topZ = Math.floor(cz);

        // Palm Fronds (Cross pattern)
        for (let i = 1; i <= 3; i++) {
            this.game.setBlock(topX + i, topY, topZ, Blocks.LEAVES, true, true);
            this.game.setBlock(topX - i, topY, topZ, Blocks.LEAVES, true, true);
            this.game.setBlock(topX, topY, topZ + i, Blocks.LEAVES, true, true);
            this.game.setBlock(topX, topY, topZ - i, Blocks.LEAVES, true, true);

            // Droop at ends
            if (i === 3) {
                this.game.setBlock(topX + i, topY - 1, topZ, Blocks.LEAVES, true, true);
                this.game.setBlock(topX - i, topY - 1, topZ, Blocks.LEAVES, true, true);
                this.game.setBlock(topX, topY - 1, topZ + i, Blocks.LEAVES, true, true);
                this.game.setBlock(topX, topY - 1, topZ - i, Blocks.LEAVES, true, true);
            }
        }
        this.game.setBlock(topX, topY + 1, topZ, Blocks.LEAVES, true, true); // Top cap
    }

    generateWillowTree(x, y, z) {
        // Swamp/Forest: Wide canopy, hanging leaves
        const rng = this.getPositionRng(x, z, 105); // Seeded random for this tree
        const height = 6 + Math.floor(rng.next() * 3);

        // Trunk
        for (let i = 0; i < height - 2; i++) {
            this.game.setBlock(x, y + i, z, Blocks.WILLOW_WOOD, true, true);
        }

        // Wide Canopy
        const radius = 3;
        const canopyY = y + height - 2;

        for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
                for (let dy = 0; dy <= 2; dy++) {
                    const distSq = dx * dx + dz * dz + dy * dy;
                    if (distSq <= radius * radius + 1) {
                        this.game.setBlock(x + dx, canopyY + dy, z + dz, Blocks.WILLOW_LEAVES, true, true);
                    }
                }

                // Vines / Hanging Leaves (deterministic per position)
                if (Math.abs(dx) === radius || Math.abs(dz) === radius) {
                    // Use position-based hash for vine placement
                    const vineHash = this.hashPosition(x + dx, z + dz, 200);
                    if ((vineHash % 100) / 100 < 0.6) {
                        const hangLen = 2 + ((vineHash >> 8) % 3);
                        for (let h = 1; h <= hangLen; h++) {
                            // Don't replace log trunk
                            if (canopyY - h > y) {
                                this.game.setBlock(x + dx, canopyY - h, z + dz, Blocks.WILLOW_LEAVES, true, true);
                            }
                        }
                    }
                }
            }
        }
    }

    generateBeanstalk(wx, wy, wz) {
        const height = 100;
        for (let i = 0; i < height; i++) {
            this.game.setBlock(wx, wy + i, wz, Blocks.LEAVES, true, true);
            if (i % 5 === 0) {
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dz = -1; dz <= 1; dz++) {
                        // Deterministic leaf placement based on position
                        const leafHash = this.hashPosition(wx + dx, wz + dz, 300 + i);
                        if ((leafHash % 100) / 100 < 0.3) {
                            this.game.setBlock(wx + dx, wy + i, wz + dz, Blocks.LEAVES, true, true);
                        }
                    }
                }
            }
        }
        for (let dx = -5; dx <= 5; dx++) {
            for (let dz = -5; dz <= 5; dz++) {
                if (dx * dx + dz * dz < 25) {
                    this.game.setBlock(wx + dx, wy + height, wz + dz, Blocks.GRASS, true, true);
                    // Deterministic house placement based on position
                    const houseHash = this.hashPosition(wx + dx, wz + dz, 400);
                    if ((houseHash % 100) / 100 < 0.1) {
                        this.generateHouse(wx + dx, wy + height + 1, wz + dz, 'PLAINS');
                    }
                }
            }
        }
    }

    generateDarkOakTree(x, y, z) {
        // Dark Forest: 2x2 Trunk, large mushroom top
        const rng = this.getPositionRng(x, z, 106); // Seeded random for this tree
        const height = 6 + Math.floor(rng.next() * 3); // 6-8 blocks tall

        // 2x2 Trunk
        for (let i = 0; i < height - 1; i++) {
            this.game.setBlock(x, y + i, z, Blocks.DARK_OAK_WOOD, true, true);
            this.game.setBlock(x + 1, y + i, z, Blocks.DARK_OAK_WOOD, true, true);
            this.game.setBlock(x, y + i, z + 1, Blocks.DARK_OAK_WOOD, true, true);
            this.game.setBlock(x + 1, y + i, z + 1, Blocks.DARK_OAK_WOOD, true, true);
        }

        // Canopy
        const canopyY = y + height - 2;
        const width = 4 + Math.floor(rng.next() * 2); // 4-5 radius

        for (let dy = 0; dy <= 3; dy++) {
            const r = width - Math.floor(dy / 1.5);
            for (let dx = -r; dx <= r + 1; dx++) {
                for (let dz = -r; dz <= r + 1; dz++) {
                    const dist = Math.sqrt(dx * dx + dz * dz);
                    if (dist <= r + 0.5) {
                        if (this.game.getBlockWorld(x + dx, canopyY + dy, z + dz) === null) {
                            this.game.setBlock(x + dx, canopyY + dy, z + dz, Blocks.DARK_OAK_LEAVES, true, true);
                        }
                    }
                }
            }
        }
    }

    /**
     * Generate a redesigned village with distinct house types, plaza, and more villagers
     */
    generateVillage(centerX, centerY, centerZ) {
        console.log(`[StructureGenerator] Generating redesigned village at ${centerX}, ${centerY}, ${centerZ}`);

        const villageRng = this.getPositionRng(centerX, centerZ, 999);
        const minDistanceFromSpawn = 100;
        const spawnX = Config.PLAYER.SPAWN_POINT.x;
        const spawnZ = Config.PLAYER.SPAWN_POINT.z;

        // Check if village center is too close to spawn
        const centerDistFromSpawn = Math.sqrt((centerX - spawnX) ** 2 + (centerZ - spawnZ) ** 2);
        if (centerDistFromSpawn < minDistanceFromSpawn) {
            console.log(`[StructureGenerator] Village center too close to spawn, skipping wizard tower`);
        } else {
            // Generate Wizard Tower in the center (Replaces Plaza)
            this.generateWizardTower(centerX, centerY, centerZ);
        }

        // Generate market stalls (only if far enough from spawn)
        if (Math.sqrt((centerX - 8 - spawnX) ** 2 + (centerZ - spawnZ) ** 2) >= minDistanceFromSpawn) {
            this.generateMarketStall(centerX - 8, centerY, centerZ);
        }
        if (Math.sqrt((centerX + 8 - spawnX) ** 2 + (centerZ - spawnZ) ** 2) >= minDistanceFromSpawn) {
            this.generateMarketStall(centerX + 8, centerY, centerZ);
        }

        // House types to use
        const houseTypes = ['cottage', 'farmhouse', 'tudor', 'library'];

        // Generate 6-8 houses in a circle
        const houseCount = 6 + Math.floor(villageRng.next() * 3);
        const radius = 28;

        for (let i = 0; i < houseCount; i++) {
            const angle = (i / houseCount) * Math.PI * 2 + villageRng.next() * 0.2;
            const dist = radius + villageRng.next() * 8 - 4;
            const hx = Math.floor(centerX + Math.cos(angle) * dist);
            const hz = Math.floor(centerZ + Math.sin(angle) * dist);
            const hy = this.worldGenerator.getTerrainHeight(hx, hz);

            // Skip houses too close to spawn point
            const distFromSpawn = Math.sqrt((hx - spawnX) ** 2 + (hz - spawnZ) ** 2);
            if (distFromSpawn < minDistanceFromSpawn) {
                continue;
            }

            if (Math.abs(hy - centerY) < 6) {
                const houseType = houseTypes[i % houseTypes.length];

                switch (houseType) {
                    case 'cottage':
                        this.generateCottage(hx, hy + 1, hz);
                        break;
                    case 'farmhouse':
                        this.generateFarmhouse(hx, hy + 1, hz);
                        break;
                    case 'tudor':
                        this.generateTudorHouse(hx, hy + 1, hz);
                        break;
                    case 'library':
                        this.generateLibrary(hx, hy + 1, hz);
                        break;
                }

                // Path to center
                this.generatePath(centerX, centerY, centerZ, hx, hy, hz);
            }
        }

        // Add extra villagers wandering in plaza
        console.log(`[Village] Scheduling 6 plaza villagers at ${centerX}, ${centerY}, ${centerZ}`);
        const structGen = this;
        // Use deterministic villager placement based on village center
        const villagerRng = this.getPositionRng(centerX, centerZ, 888);
        const villagerDistances = [];
        for (let i = 0; i < 6; i++) {
            villagerDistances.push(9 + villagerRng.next() * 6);
        }
        setTimeout(() => {
            console.log(`[Village] Spawning 6 plaza villagers now...`);
            for (let i = 0; i < 6; i++) {
                try {
                    const v = new Villager(structGen.game);
                    const angle = (i / 6) * Math.PI * 2;
                    // Move villagers further out so they don't spawn inside the wizard tower (radius 5)
                    const dist = villagerDistances[i];
                    const vx = centerX + Math.cos(angle) * dist;
                    const vz = centerZ + Math.sin(angle) * dist;
                    const groundY = structGen.findGroundForVillager(vx, centerY + 1, vz);
                    v.position.set(vx, groundY, vz);
                    v.mesh.position.copy(v.position);
                    structGen.game.animals.push(v);
                    structGen.game.scene.add(v.mesh);
                    console.log(`[Village] Spawned plaza villager ${i + 1} at (${vx.toFixed(1)}, ${groundY.toFixed(1)}, ${vz.toFixed(1)})`);
                } catch (e) {
                    console.error(`[Village] ERROR spawning plaza villager ${i}:`, e);
                }
            }
            console.log(`[Village] Total animals in game: ${structGen.game.animals.length}`);
        }, 1500);
    }

    /**
     * Central plaza with fountain
     */
    generatePlaza(x, y, z) {
        // Large stone plaza (11x11)
        for (let dx = -5; dx <= 5; dx++) {
            for (let dz = -5; dz <= 5; dz++) {
                this.game.setBlock(x + dx, y, z + dz, Blocks.POLISHED_STONE, true, true);
            }
        }

        // Central fountain (5x5)
        // Outer rim
        for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -2; dz <= 2; dz++) {
                if (Math.abs(dx) === 2 || Math.abs(dz) === 2) {
                    this.game.setBlock(x + dx, y + 1, z + dz, Blocks.STONE_BRICK, true, true);
                }
            }
        }

        // Water pool
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                this.game.setBlock(x + dx, y, z + dz, Blocks.WATER, true, true);
            }
        }

        // Central pillar with water spray effect
        this.game.setBlock(x, y + 1, z, Blocks.STONE_BRICK, true, true);
        this.game.setBlock(x, y + 2, z, Blocks.STONE_BRICK, true, true);
        this.game.setBlock(x, y + 3, z, Blocks.WATER, true, true);

        // Flower gardens in corners
        const flowerTypes = [Blocks.FLOWER_RED, Blocks.FLOWER_YELLOW, Blocks.FLOWER_BLUE];
        const corners = [[-4, -4], [4, -4], [-4, 4], [4, 4]];
        corners.forEach(([cx, cz], i) => {
            this.game.setBlock(x + cx, y, z + cz, Blocks.GRASS, true, true);
            this.game.setBlock(x + cx, y + 1, z + cz, flowerTypes[i % 3], true, true);
        });
    }

    /**
     * Lamp post with glowstone
     */
    /**
     * Lamp post with glowstone - REPLACED with Static Entity
     */
    // Lamp post generation removed
    generateLampPost(x, y, z) {
        // Removed at user request
    }

    /**
     * Market stall
     */
    generateMarketStall(x, y, z) {
        // Counter (3x2)
        for (let dx = 0; dx < 3; dx++) {
            this.game.setBlock(x + dx, y + 1, z, Blocks.PLANK, true, true);
            this.game.setBlock(x + dx, y + 1, z + 1, Blocks.PLANK, true, true);
        }

        // Awning posts
        this.game.setBlock(x, y + 2, z, Blocks.FENCE, true, true);
        this.game.setBlock(x + 2, y + 2, z, Blocks.FENCE, true, true);
        this.game.setBlock(x, y + 3, z, Blocks.FENCE, true, true);
        this.game.setBlock(x + 2, y + 3, z, Blocks.FENCE, true, true);

        // Awning (colored roof)
        for (let dx = -1; dx <= 3; dx++) {
            this.game.setBlock(x + dx, y + 4, z - 1, Blocks.TERRACOTTA, true, true);
            this.game.setBlock(x + dx, y + 4, z, Blocks.TERRACOTTA, true, true);
        }
    }

    /**
     * Cottage - Small cozy house with peaked roof
     */
    generateCottage(x, y, z) {
        const w = 5, d = 5, h = 4;

        // Foundation
        for (let dx = -1; dx < w + 1; dx++) {
            for (let dz = -1; dz < d + 1; dz++) {
                this.game.setBlock(x + dx, y - 1, z + dz, Blocks.COBBLESTONE, true, true);
            }
        }

        // Floor
        for (let dx = 0; dx < w; dx++) {
            for (let dz = 0; dz < d; dz++) {
                this.game.setBlock(x + dx, y, z + dz, Blocks.PLANK, true, true);
            }
        }

        // Walls (white plaster with log corners)
        for (let dy = 1; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                for (let dz = 0; dz < d; dz++) {
                    const isCorner = (dx === 0 || dx === w - 1) && (dz === 0 || dz === d - 1);
                    const isWall = dx === 0 || dx === w - 1 || dz === 0 || dz === d - 1;
                    const isDoor = dx === Math.floor(w / 2) && dz === 0 && dy < 3;
                    const isWindow = dy === 2 && !isCorner && isWall;

                    if (isDoor) continue;

                    if (isCorner) {
                        this.game.setBlock(x + dx, y + dy, z + dz, Blocks.LOG, true, true);
                    } else if (isWindow) {
                        this.game.setBlock(x + dx, y + dy, z + dz, Blocks.GLASS, true, true);
                    } else if (isWall) {
                        this.game.setBlock(x + dx, y + dy, z + dz, Blocks.WHITE_PLASTER, true, true);
                    }
                }
            }
        }

        // Peaked roof with tiles
        for (let layer = 0; layer <= 2; layer++) {
            for (let dx = -1 + layer; dx < w + 1 - layer; dx++) {
                this.game.setBlock(x + dx, y + h + layer, z - 1, Blocks.ROOF_TILES, true, true);
                this.game.setBlock(x + dx, y + h + layer, z + d, Blocks.ROOF_TILES, true, true);
            }
            for (let dz = 0; dz < d; dz++) {
                this.game.setBlock(x - 1 + layer, y + h + layer, z + dz, Blocks.ROOF_TILES, true, true);
                this.game.setBlock(x + w - layer, y + h + layer, z + dz, Blocks.ROOF_TILES, true, true);
            }
        }
        // Roof cap
        for (let dz = 0; dz < d; dz++) {
            this.game.setBlock(x + Math.floor(w / 2), y + h + 3, z + dz, Blocks.ROOF_TILES, true, true);
        }

        // Chimney
        for (let dy = h; dy < h + 5; dy++) {
            this.game.setBlock(x + w - 1, y + dy, z + d - 1, Blocks.CHIMNEY_BRICK, true, true);
        }

        // 2 Villagers
        const cottageStructGen = this;
        const cottageY = y;
        setTimeout(() => {
            for (let i = 0; i < 2; i++) {
                const v = new Villager(cottageStructGen.game);
                const vx = x + w / 2 + i - 0.5;
                const vz = z + d / 2;
                const groundY = cottageStructGen.findGroundForVillager(vx, cottageY + 1, vz);
                v.position.set(vx, groundY, vz);
                v.mesh.position.copy(v.position);
                cottageStructGen.game.animals.push(v);
                cottageStructGen.game.scene.add(v.mesh);
            }
        }, 600);
    }

    /**
     * Farmhouse - Large rustic house with porch
     */
    generateFarmhouse(x, y, z) {
        const w = 8, d = 6, h = 4;

        // Foundation
        for (let dx = -1; dx < w + 1; dx++) {
            for (let dz = -2; dz < d + 1; dz++) {
                this.game.setBlock(x + dx, y - 1, z + dz, Blocks.COBBLESTONE, true, true);
            }
        }

        // Floor
        for (let dx = 0; dx < w; dx++) {
            for (let dz = 0; dz < d; dz++) {
                this.game.setBlock(x + dx, y, z + dz, Blocks.PLANK, true, true);
            }
        }

        // Porch floor
        for (let dx = 0; dx < w; dx++) {
            this.game.setBlock(x + dx, y, z - 1, Blocks.PLANK, true, true);
        }

        // Walls (log and plank)
        for (let dy = 1; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                for (let dz = 0; dz < d; dz++) {
                    const isCorner = (dx === 0 || dx === w - 1) && (dz === 0 || dz === d - 1);
                    const isWall = dx === 0 || dx === w - 1 || dz === 0 || dz === d - 1;
                    const isDoor = dx >= 3 && dx <= 4 && dz === 0 && dy < 3;
                    const isWindow = dy === 2 && !isCorner && isWall;

                    if (isDoor) continue;

                    if (isCorner) {
                        this.game.setBlock(x + dx, y + dy, z + dz, Blocks.LOG, true, true);
                    } else if (isWindow) {
                        this.game.setBlock(x + dx, y + dy, z + dz, Blocks.GLASS, true, true);
                    } else if (isWall) {
                        this.game.setBlock(x + dx, y + dy, z + dz, Blocks.PLANK, true, true);
                    }
                }
            }
        }

        // Porch posts and roof
        this.game.setBlock(x, y + 1, z - 1, Blocks.FENCE, true, true);
        this.game.setBlock(x, y + 2, z - 1, Blocks.FENCE, true, true);
        this.game.setBlock(x + w - 1, y + 1, z - 1, Blocks.FENCE, true, true);
        this.game.setBlock(x + w - 1, y + 2, z - 1, Blocks.FENCE, true, true);
        for (let dx = 0; dx < w; dx++) {
            this.game.setBlock(x + dx, y + 3, z - 1, Blocks.PLANK, true, true);
        }

        // Thatch roof
        for (let layer = 0; layer <= 3; layer++) {
            for (let dx = -1; dx < w + 1; dx++) {
                this.game.setBlock(x + dx, y + h + layer, z - 1 + layer, Blocks.THATCH, true, true);
                this.game.setBlock(x + dx, y + h + layer, z + d - layer, Blocks.THATCH, true, true);
            }
        }

        // Fence around property
        for (let dx = -2; dx < w + 2; dx++) {
            this.game.setBlock(x + dx, y, z + d + 2, Blocks.FENCE, true, true);
        }
        for (let dz = -1; dz < d + 3; dz++) {
            this.game.setBlock(x - 2, y, z + dz, Blocks.FENCE, true, true);
            this.game.setBlock(x + w + 1, y, z + dz, Blocks.FENCE, true, true);
        }

        // 3 Villagers (farmers)
        const farmStructGen = this;
        const farmY = y;
        setTimeout(() => {
            for (let i = 0; i < 3; i++) {
                const vx = x + 2 + i * 2;
                const vz = z + d / 2;
                const groundY = farmStructGen.findGroundForVillager(vx, farmY + 1, vz);
                const v = new Villager(farmStructGen.game, vx, groundY, vz, null, 'FARMER');
                v.mesh.position.copy(v.position);
                farmStructGen.game.animals.push(v);
                farmStructGen.game.scene.add(v.mesh);
            }
        }, 600);
    }

    /**
     * Tudor House - Medieval half-timber style
     */
    generateTudorHouse(x, y, z) {
        const w = 6, d = 6, h = 5;

        // Foundation
        for (let dx = -1; dx < w + 1; dx++) {
            for (let dz = -1; dz < d + 1; dz++) {
                this.game.setBlock(x + dx, y - 1, z + dz, Blocks.COBBLESTONE, true, true);
            }
        }

        // Two floors
        for (let floor = 0; floor < 2; floor++) {
            const floorY = y + floor * 3;

            // Floor
            for (let dx = 0; dx < w; dx++) {
                for (let dz = 0; dz < d; dz++) {
                    this.game.setBlock(x + dx, floorY, z + dz, Blocks.DARK_PLANKS, true, true);
                }
            }

            // Walls with half-timber pattern
            for (let dy = 1; dy <= 3; dy++) {
                for (let dx = 0; dx < w; dx++) {
                    for (let dz = 0; dz < d; dz++) {
                        const isCorner = (dx === 0 || dx === w - 1) && (dz === 0 || dz === d - 1);
                        const isWall = dx === 0 || dx === w - 1 || dz === 0 || dz === d - 1;
                        const isDoor = floor === 0 && dx === Math.floor(w / 2) && dz === 0 && dy < 3;
                        const isWindow = dy === 2 && !isCorner && isWall;

                        if (isDoor) continue;
                        if (!isWall) continue;

                        if (isCorner || dy === 1 || dy === 3) {
                            this.game.setBlock(x + dx, floorY + dy, z + dz, Blocks.DARK_OAK_WOOD, true, true);
                        } else if (isWindow) {
                            this.game.setBlock(x + dx, floorY + dy, z + dz, Blocks.GLASS, true, true);
                        } else {
                            this.game.setBlock(x + dx, floorY + dy, z + dz, Blocks.WHITE_PLASTER, true, true);
                        }
                    }
                }
            }
        }

        // Shingle roof
        for (let layer = 0; layer <= 3; layer++) {
            for (let dx = -1 + layer; dx < w + 1 - layer; dx++) {
                for (let dz = -1; dz < d + 1; dz++) {
                    if (layer < 3 || (dx >= 2 && dx < w - 2)) {
                        this.game.setBlock(x + dx, y + h + 1 + layer, z + dz, Blocks.SHINGLES, true, true);
                    }
                }
            }
        }

        // 2 Villagers
        const tudorStructGen = this;
        const tudorY = y;
        setTimeout(() => {
            for (let i = 0; i < 2; i++) {
                const v = new Villager(tudorStructGen.game);
                const vx = x + w / 2 + i - 0.5;
                const vz = z + d / 2;
                const groundY = tudorStructGen.findGroundForVillager(vx, tudorY + 1, vz);
                v.position.set(vx, groundY, vz);
                v.mesh.position.copy(v.position);
                tudorStructGen.game.animals.push(v);
                tudorStructGen.game.scene.add(v.mesh);
            }
        }, 600);
    }

    /**
     * Library - Tall stone building with large windows
     */
    generateLibrary(x, y, z) {
        const w = 7, d = 8, h = 6;

        // Foundation
        for (let dx = -1; dx < w + 1; dx++) {
            for (let dz = -1; dz < d + 1; dz++) {
                this.game.setBlock(x + dx, y - 1, z + dz, Blocks.STONE_BRICK, true, true);
            }
        }

        // Polished stone floor
        for (let dx = 0; dx < w; dx++) {
            for (let dz = 0; dz < d; dz++) {
                this.game.setBlock(x + dx, y, z + dz, Blocks.POLISHED_STONE, true, true);
            }
        }

        // Stone brick walls with large windows
        for (let dy = 1; dy <= h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                for (let dz = 0; dz < d; dz++) {
                    const isWall = dx === 0 || dx === w - 1 || dz === 0 || dz === d - 1;
                    const isDoor = dx >= 2 && dx <= 4 && dz === 0 && dy < 4;
                    const isWindow = dy >= 2 && dy <= 4 && !isDoor && isWall;

                    if (isDoor) continue;
                    if (!isWall) continue;

                    if (isWindow && (dx % 2 === 1 || dz % 2 === 1)) {
                        this.game.setBlock(x + dx, y + dy, z + dz, Blocks.GLASS, true, true);
                    } else {
                        this.game.setBlock(x + dx, y + dy, z + dz, Blocks.STONE_BRICK, true, true);
                    }
                }
            }
        }

        // Bookshelves inside - using varied book blocks
        for (let dz = 1; dz < d - 1; dz++) {
            this.game.setBlock(x + 1, y + 1, z + dz, this.getRandomBookBlock(x + 1, y + 1, z + dz), true, true);
            this.game.setBlock(x + 1, y + 2, z + dz, this.getRandomBookBlock(x + 1, y + 2, z + dz), true, true);
            this.game.setBlock(x + w - 2, y + 1, z + dz, this.getRandomBookBlock(x + w - 2, y + 1, z + dz), true, true);
            this.game.setBlock(x + w - 2, y + 2, z + dz, this.getRandomBookBlock(x + w - 2, y + 2, z + dz), true, true);
        }

        // Flat roof with parapet
        for (let dx = 0; dx < w; dx++) {
            for (let dz = 0; dz < d; dz++) {
                this.game.setBlock(x + dx, y + h + 1, z + dz, Blocks.STONE_BRICK, true, true);
            }
        }
        for (let dx = 0; dx < w; dx++) {
            this.game.setBlock(x + dx, y + h + 2, z, Blocks.STONE_BRICK, true, true);
            this.game.setBlock(x + dx, y + h + 2, z + d - 1, Blocks.STONE_BRICK, true, true);
        }
        for (let dz = 0; dz < d; dz++) {
            this.game.setBlock(x, y + h + 2, z + dz, Blocks.STONE_BRICK, true, true);
            this.game.setBlock(x + w - 1, y + h + 2, z + dz, Blocks.STONE_BRICK, true, true);
        }

        // 2 Librarian villagers
        const libStructGen = this;
        const libY = y;
        setTimeout(() => {
            for (let i = 0; i < 2; i++) {
                const vx = x + w / 2 + i;
                const vz = z + d / 2;
                const groundY = libStructGen.findGroundForVillager(vx, libY + 1, vz);
                const v = new Villager(libStructGen.game, vx, groundY, vz, null, 'LIBRARIAN');
                v.mesh.position.copy(v.position);
                libStructGen.game.animals.push(v);
                libStructGen.game.scene.add(v.mesh);
            }
        }, 600);
    }

    /**
     * Generate a cobblestone path between two points
     */
    generatePath(x1, y1, z1, x2, y2, z2) {
        const dx = x2 - x1;
        const dz = z2 - z1;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const steps = Math.ceil(dist);

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const px = Math.floor(x1 + dx * t);
            const pz = Math.floor(z1 + dz * t);
            const py = this.worldGenerator.getTerrainHeight(px, pz);

            // Main path (2 blocks wide)
            this.game.setBlock(px, py, pz, Blocks.COBBLESTONE, true, true);
            this.game.setBlock(px + 1, py, pz, Blocks.COBBLESTONE, true, true);
        }
    }
    generateWizardTower(cx, cy, cz) {
        console.log(`Generating Wizard Tower at ${cx}, ${cy}, ${cz}`);

        // Dimensions
        const baseRadius = 5; // Bigger radius
        const shaftHeight = 18;
        const roomRadius = 7; // Even wider top room
        const roomHeight = 7;
        const totalHeight = shaftHeight + roomHeight;

        // Floor heights for interior rooms
        const entranceFloorY = 0;   // Ground floor
        const alchemyFloorY = 6;    // Second floor
        const observatoryFloorY = 12; // Third floor

        // --- SHAFT (Base to Top Room) with Interior Rooms ---
        for (let y = 0; y < shaftHeight; y++) {
            for (let x = -baseRadius; x <= baseRadius; x++) {
                for (let z = -baseRadius; z <= baseRadius; z++) {
                    const distSq = x * x + z * z;

                    if (distSq <= baseRadius * baseRadius + 1) { // Roundish
                        const isWall = distSq >= (baseRadius - 1) * (baseRadius - 1);
                        const isStairArea = distSq >= (baseRadius - 3) * (baseRadius - 3) && distSq < (baseRadius - 1) * (baseRadius - 1);

                        // Floor at bottom (Entrance Hall)
                        if (y === entranceFloorY) {
                            this.game.setBlock(cx + x, cy + y, cz + z, Blocks.STONE, true, true);
                        }
                        // Alchemy Lab floor
                        else if (y === alchemyFloorY) {
                            // Leave stair opening
                            if (!isStairArea) {
                                this.game.setBlock(cx + x, cy + y, cz + z, Blocks.PLANK, true, true);
                            }
                        }
                        // Observatory floor
                        else if (y === observatoryFloorY) {
                            // Leave stair opening
                            if (!isStairArea) {
                                this.game.setBlock(cx + x, cy + y, cz + z, Blocks.POLISHED_STONE, true, true);
                            }
                        }
                        // Walls
                        else if (isWall) {
                            // Windows in shaft
                            if (y % 6 === 3 && (Math.abs(x) <= 1 || Math.abs(z) <= 1)) {
                                this.game.setBlock(cx + x, cy + y, cz + z, Blocks.GLASS, true, true);
                            } else {
                                this.game.setBlock(cx + x, cy + y, cz + z, Blocks.STONE_BRICK, true, true);
                            }
                        }
                    }
                }
            }
        }

        // --- ENTRANCE HALL DECORATIONS (Y+1 to Y+5) ---
        // Carpet/rug pattern in center
        for (let x = -2; x <= 2; x++) {
            for (let z = -2; z <= 2; z++) {
                if (Math.abs(x) + Math.abs(z) <= 3) {
                    this.game.setBlock(cx + x, cy + 1, cz + z, Blocks.TERRACOTTA, true, true);
                }
            }
        }
        // Glowstone torches on walls
        this.game.setBlock(cx + 3, cy + 3, cz, Blocks.GLOWSTONE, true, true);
        this.game.setBlock(cx - 3, cy + 3, cz, Blocks.GLOWSTONE, true, true);
        this.game.setBlock(cx, cy + 3, cz - 3, Blocks.GLOWSTONE, true, true);

        // --- ALCHEMY LAB DECORATIONS (Y+6 to Y+11) ---
        // Central cauldron area
        this.game.setBlock(cx, cy + alchemyFloorY + 1, cz, Blocks.FURNACE, true, true);
        // Brewing stands nearby
        this.game.setBlock(cx + 2, cy + alchemyFloorY + 1, cz, Blocks.CRAFTING_TABLE, true, true);
        this.game.setBlock(cx - 2, cy + alchemyFloorY + 1, cz, Blocks.CRAFTING_TABLE, true, true);
        // Potion storage shelves along walls - using varied book blocks
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2) {
            const shelfX = Math.round(3 * Math.cos(angle));
            const shelfZ = Math.round(3 * Math.sin(angle));
            if (Math.abs(shelfX) > 1 || Math.abs(shelfZ) > 1) {
                const bx = cx + shelfX, by1 = cy + alchemyFloorY + 1, by2 = cy + alchemyFloorY + 2, bz = cz + shelfZ;
                this.game.setBlock(bx, by1, bz, this.getRandomBookBlock(bx, by1, bz), true, true);
                this.game.setBlock(bx, by2, bz, this.getRandomBookBlock(bx, by2, bz), true, true);
            }
        }
        // Glowstone lighting
        this.game.setBlock(cx, cy + alchemyFloorY + 5, cz, Blocks.GLOWSTONE, true, true);

        // --- OBSERVATORY DECORATIONS (Y+12 to Y+17) ---
        // Central telescope structure
        this.game.setBlock(cx, cy + observatoryFloorY + 1, cz, Blocks.GOLD_BLOCK, true, true);
        this.game.setBlock(cx, cy + observatoryFloorY + 2, cz, Blocks.GOLD_BLOCK, true, true);
        this.game.setBlock(cx, cy + observatoryFloorY + 3, cz, Blocks.GLASS, true, true);
        // Star map floor pattern
        for (let x = -2; x <= 2; x++) {
            for (let z = -2; z <= 2; z++) {
                if ((x + z) % 2 === 0 && (x !== 0 || z !== 0)) {
                    this.game.setBlock(cx + x, cy + observatoryFloorY, cz + z, Blocks.OBSIDIAN, true, true);
                }
            }
        }
        // Glowstone constellation ceiling
        const constellationPattern = [
            [-2, -2], [0, -3], [2, -1],
            [-3, 1], [1, 2], [3, 0], [-1, 3]
        ];
        for (const [dx, dz] of constellationPattern) {
            this.game.setBlock(cx + dx, cy + observatoryFloorY + 5, cz + dz, Blocks.GLOWSTONE, true, true);
        }

        // --- ENTRANCE (Door) ---
        // Place door at +Z side
        // Door is 2 blocks high.
        this.game.setBlock(cx, cy + 1, cz + baseRadius, Blocks.DOOR_CLOSED, true, true);
        this.game.setBlock(cx, cy + 2, cz + baseRadius, Blocks.DOOR_CLOSED, true, true);

        // Clear entry
        this.game.setBlock(cx, cy + 1, cz + baseRadius - 1, null, true, true);
        this.game.setBlock(cx, cy + 2, cz + baseRadius - 1, null, true, true); // Interior clearance

        // --- STAIRS ---
        let stairY = 1;
        let angle = Math.PI; // Start opposite door
        while (stairY < shaftHeight) {
            // Place a block at current angle/radius
            const sx = Math.round((baseRadius - 1.5) * Math.cos(angle));
            const sz = Math.round((baseRadius - 1.5) * Math.sin(angle));

            // Use 'planks' for stairs
            this.game.setBlock(cx + sx, cy + stairY, cz + sz, Blocks.PLANK, true, true);

            // Make it wider (inner rail)
            const sx2 = Math.round((baseRadius - 2.5) * Math.cos(angle));
            const sz2 = Math.round((baseRadius - 2.5) * Math.sin(angle));
            this.game.setBlock(cx + sx2, cy + stairY, cz + sz2, Blocks.PLANK, true, true);

            // Increment angle
            angle += 0.4; // ~20 degrees

            // Let's just increment Y every 3 blocks placed?
            if (angle % 0.8 < 0.4) {
                // Rise
                stairY++;
            }
        }


        // --- TOP WIZARD ROOM ---
        const roomY = cy + shaftHeight;

        // Main Room
        for (let y = 0; y < roomHeight; y++) {
            const wy = roomY + y;
            for (let x = -roomRadius; x <= roomRadius; x++) {
                for (let z = -roomRadius; z <= roomRadius; z++) {
                    const distSq = x * x + z * z;

                    if (distSq <= roomRadius * roomRadius + 1) {
                        const isWall = distSq >= (roomRadius - 1) * (roomRadius - 1);

                        // Floor
                        if (y === 0) {
                            this.game.setBlock(cx + x, wy, cz + z, Blocks.PLANK, true, true);
                        }
                        // Walls
                        else if (isWall) {
                            // Large Windows
                            if (y >= 2 && y <= 4 && (Math.abs(x) <= 2 || Math.abs(z) <= 2)) {
                                this.game.setBlock(cx + x, wy, cz + z, Blocks.GLASS, true, true);
                            } else {
                                this.game.setBlock(cx + x, wy, cz + z, Blocks.STONE_BRICK, true, true);
                            }
                        }
                        // Ceiling
                        else if (y === roomHeight - 1) {
                            // this.game.setBlock(cx + x, wy, cz + z, Blocks.PLANK, true, true); // Optional ceiling
                        }
                    }
                }
            }
        }

        // --- ROOF ---
        const roofStart = roomY + roomHeight;
        const roofH = 9;
        for (let y = 0; y < roofH; y++) {
            const r = roomRadius - Math.floor(y * (roomRadius / (roofH - 1)));
            for (let x = -r; x <= r; x++) {
                for (let z = -r; z <= r; z++) {
                    this.game.setBlock(cx + x, roofStart + y, cz + z, Blocks.dark_oak_plank, true, true);
                }
            }
        }

        // --- DECOR ---
        // Bookshelves lining the non-window walls
        for (let x = -roomRadius + 1; x <= roomRadius - 1; x++) {
            for (let z = -roomRadius + 1; z <= roomRadius - 1; z++) {
                const distSq = x * x + z * z;
                const isNearWall = distSq >= (roomRadius - 2) * (roomRadius - 2);

                if (isNearWall) {
                    if (Math.abs(x) > 3 && Math.abs(z) > 3) {
                        const bx = cx + x, bz = cz + z;
                        this.game.setBlock(bx, roomY + 1, bz, this.getRandomBookBlock(bx, roomY + 1, bz), true, true);
                        this.game.setBlock(bx, roomY + 2, bz, this.getRandomBookBlock(bx, roomY + 2, bz), true, true);
                        this.game.setBlock(bx, roomY + 3, bz, this.getRandomBookBlock(bx, roomY + 3, bz), true, true);
                    }
                }
            }
        }

        // Central Table
        this.game.setBlock(cx, roomY + 1, cz, Blocks.CRAFTING_TABLE, true, true);
        this.game.setBlock(cx, roomY + 1, cz + 1, Blocks.GOLD_BLOCK, true, true);

        // Bed
        this.game.setBlock(cx + 4, roomY + 1, cz, Blocks.BED, true, true);

    }

    /**
     * Find valid ground level for spawning a villager
     * Searches downward from the expected Y position to find solid ground
     * @param {number} x - World X coordinate
     * @param {number} expectedY - Expected Y position (typically y + 1 of structure floor)
     * @param {number} z - World Z coordinate
     * @returns {number} - Ground Y position to spawn at
     */
    findGroundForVillager(x, expectedY, z) {
        const checkX = Math.floor(x);
        const checkZ = Math.floor(z);
        const startY = Math.floor(expectedY);

        // Search downward from expected position to find solid ground
        for (let y = startY; y >= startY - 10; y--) {
            const block = this.game.getBlock(checkX, y, checkZ);
            if (block && block.type !== 'water') {
                // Found solid ground - spawn one block above
                const blockAbove = this.game.getBlock(checkX, y + 1, checkZ);
                if (!blockAbove || blockAbove.type === 'water') {
                    return y + 1;
                }
            }
        }

        // If no ground found below, search upward (might be inside a structure)
        for (let y = startY + 1; y <= startY + 5; y++) {
            const block = this.game.getBlock(checkX, y, checkZ);
            if (block && block.type !== 'water') {
                const blockAbove = this.game.getBlock(checkX, y + 1, checkZ);
                if (!blockAbove || blockAbove.type === 'water') {
                    return y + 1;
                }
            }
        }

        // Fallback to terrain height if no blocks found
        if (this.worldGenerator) {
            return this.worldGenerator.getTerrainHeight(x, z) + 1;
        }

        // Ultimate fallback - use expected position
        return expectedY;
    }
}
