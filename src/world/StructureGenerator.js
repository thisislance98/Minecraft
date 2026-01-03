import { Villager } from '../game/entities/animals/Villager.js';
import { StaticLampost } from '../game/entities/animals/StaticLampost.js';
import { Blocks } from '../game/core/Blocks.js';
import { SeededRandom } from '../utils/SeededRandom.js';
import * as THREE from 'three';

export class StructureGenerator {

    constructor(game, worldGenerator) {
        this.game = game;
        this.worldGenerator = worldGenerator;
        this.seed = 0;
        this.rng = new SeededRandom(0);
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

                const featureRng = this.getPositionRng(wx, wz, 1);
                if (featureRng.next() < 0.01) {
                    const groundHeight = this.worldGenerator.getTerrainHeight(wx, wz);
                    // Use optimized biome lookup - reuse the height we just computed
                    const biome = this.worldGenerator.getBiomeWithHeight(wx, wz, groundHeight);

                    if (groundHeight >= startY && groundHeight < startY + this.game.chunkSize) {
                        const wy = groundHeight;
                        const blockBelow = this.game.getBlockWorld(wx, wy, wz);

                        if (blockBelow === Blocks.GRASS || (biome === 'SNOW' && blockBelow === Blocks.SNOW) || (biome === 'DESERT' && blockBelow === Blocks.SAND)) {
                            if ((biome === 'PLAINS' || biome === 'FOREST' || biome === 'SNOW') && featureRng.next() < 0.1) {
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
                                const treeRand = featureRng.next();
                                if (biome === 'DESERT') {
                                    if (treeRand < 0.2) this.generateCactus(wx, wy + 1, wz);
                                    else if (treeRand < 0.205) this.generatePalmTree(wx, wy + 1, wz); // Rare Oasis Palm
                                } else if (biome === 'JUNGLE') {
                                    this.generateJungleTree(wx, wy + 1, wz);
                                } else if (biome === 'FOREST') {
                                    // Forest Variety: Oak (40%), Birch (30%), Pine (15%), Dark Oak (10%), Willow (5%)
                                    if (treeRand < 0.40) this.generateOakTree(wx, wy + 1, wz);
                                    else if (treeRand < 0.70) this.generateBirchTree(wx, wy + 1, wz);
                                    else if (treeRand < 0.85) this.generatePineTree(wx, wy + 1, wz);
                                    else if (treeRand < 0.95) this.generateDarkOakTree(wx, wy + 1, wz);
                                    else this.generateWillowTree(wx, wy + 1, wz);
                                } else if (biome === 'MOUNTAIN' || biome === 'SNOW') {
                                    if (treeRand < 0.5) this.generatePineTree(wx, wy + 1, wz);
                                    else this.generateOakTree(wx, wy + 1, wz);
                                } else if (biome === 'PLAINS') {
                                    if (treeRand < 0.05) this.generateOakTree(wx, wy + 1, wz);
                                    else if (treeRand < 0.07) this.generateAcaciaTree(wx, wy + 1, wz); // Rare Acacia
                                    else if (treeRand < 0.075) this.generateBeanstalk(wx, wy + 1, wz); // Very Rare Beanstalk
                                } else {
                                    if (treeRand < 0.1) this.generateOakTree(wx, wy + 1, wz);
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

        for (let dx = 0; dx < width; dx++) {
            for (let dz = 0; dz < depth; dz++) {
                for (let fy = y - 4; fy < y; fy++) {
                    const existingBlock = this.game.getBlockWorld(x + dx, fy, z + dz);
                    if (!existingBlock || existingBlock === Blocks.AIR) {
                        this.game.setBlock(x + dx, fy, z + dz, Blocks.STONE, true, true);
                    }
                }
            }
        }

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
            v.position.set(x + width / 2, y + 1, z + depth / 2);
            this.game.animals.push(v);
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
            setTimeout(() => {
                const v = new Villager(this.game);
                v.position.set(x + 2 + i * 3, y + 1, z + 2);
                this.game.animals.push(v);
            }, 500 + i * 100);
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
        const height = 7 + Math.floor(Math.random() * 3);
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
        const h = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < h; i++) this.game.setBlock(x, y + i, z, Blocks.CACTUS, true, true);
    }

    generateJungleTree(x, y, z) {
        const height = 12 + Math.floor(Math.random() * 8);
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
        const height = 6 + Math.floor(Math.random() * 3);

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
        const height = 8 + Math.floor(Math.random() * 5);

        // Trunk (Using Jungle Wood or similar if available, else Log)
        let cx = x;
        let cz = z;

        for (let i = 0; i < height; i++) {
            this.game.setBlock(Math.floor(cx), y + i, Math.floor(cz), Blocks.LOG, true, true);
            // Slight curve
            if (i > 3 && i % 3 === 0) cx += (Math.random() > 0.5 ? 1 : -1) * 0.5;
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
        const height = 6 + Math.floor(Math.random() * 3);

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

                // Vines / Hanging Leaves
                if (Math.abs(dx) === radius || Math.abs(dz) === radius) {
                    if (Math.random() < 0.6) {
                        const hangLen = 2 + Math.floor(Math.random() * 3);
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
                        if (Math.random() < 0.3) this.game.setBlock(wx + dx, wy + i, wz + dz, Blocks.LEAVES, true, true);
                    }
                }
            }
        }
        for (let dx = -5; dx <= 5; dx++) {
            for (let dz = -5; dz <= 5; dz++) {
                if (dx * dx + dz * dz < 25) {
                    this.game.setBlock(wx + dx, wy + height, wz + dz, Blocks.GRASS, true, true);
                    if (Math.random() < 0.1) this.generateHouse(wx + dx, wy + height + 1, wz + dz, 'PLAINS');
                }
            }
        }
    }

    generateDarkOakTree(x, y, z) {
        // Dark Forest: 2x2 Trunk, large mushroom top
        const height = 6 + Math.floor(Math.random() * 3); // 6-8 blocks tall

        // 2x2 Trunk
        for (let i = 0; i < height - 1; i++) {
            this.game.setBlock(x, y + i, z, Blocks.DARK_OAK_WOOD, true, true);
            this.game.setBlock(x + 1, y + i, z, Blocks.DARK_OAK_WOOD, true, true);
            this.game.setBlock(x, y + i, z + 1, Blocks.DARK_OAK_WOOD, true, true);
            this.game.setBlock(x + 1, y + i, z + 1, Blocks.DARK_OAK_WOOD, true, true);
        }

        // Canopy
        const canopyY = y + height - 2;
        const width = 4 + Math.floor(Math.random() * 2); // 4-5 radius

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

        // Generate central plaza with fountain
        this.generatePlaza(centerX, centerY, centerZ);

        // Generate 4 lamp posts around plaza
        this.generateLampPost(centerX - 6, centerY, centerZ - 6);
        this.generateLampPost(centerX + 6, centerY, centerZ - 6);
        this.generateLampPost(centerX - 6, centerY, centerZ + 6);
        this.generateLampPost(centerX + 6, centerY, centerZ + 6);

        // Generate market stalls
        this.generateMarketStall(centerX - 8, centerY, centerZ);
        this.generateMarketStall(centerX + 8, centerY, centerZ);

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
        setTimeout(() => {
            console.log(`[Village] Spawning 6 plaza villagers now...`);
            for (let i = 0; i < 6; i++) {
                try {
                    const v = new Villager(this.game);
                    const angle = (i / 6) * Math.PI * 2;
                    const dist = 3 + Math.random() * 8;
                    const vx = centerX + Math.cos(angle) * dist;
                    const vz = centerZ + Math.sin(angle) * dist;
                    v.position.set(vx, centerY + 1, vz);
                    this.game.animals.push(v);
                    this.game.scene.add(v.mesh);
                    console.log(`[Village] Spawned plaza villager ${i + 1} at (${vx.toFixed(1)}, ${centerY + 1}, ${vz.toFixed(1)})`);
                } catch (e) {
                    console.error(`[Village] ERROR spawning plaza villager ${i}:`, e);
                }
            }
            console.log(`[Village] Total animals in game: ${this.game.animals.length}`);
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
    generateLampPost(x, y, z) {
        // Find valid ground for the entity
        // We spawned blocks at x, y+dy, z.
        // Entity origin is at feet.
        // x,y,z passed here is usually ground level?
        // Let's check call sites: generateVillage calls it at centerY.
        // generateVillage passes centerY which is often ground level.

        setTimeout(() => {
            const lamp = new StaticLampost(this.game, x, y + 1, z);
            this.game.animals.push(lamp);
            this.game.scene.add(lamp.mesh);
        }, 1000); // Delay slightly to ensure world is ready?
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
        setTimeout(() => {
            for (let i = 0; i < 2; i++) {
                const v = new Villager(this.game);
                v.position.set(x + w / 2 + i - 0.5, y + 1, z + d / 2);
                this.game.animals.push(v);
                this.game.scene.add(v.mesh);
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
        setTimeout(() => {
            for (let i = 0; i < 3; i++) {
                const v = new Villager(this.game, x + 2 + i * 2, y + 1, z + d / 2, null, 'FARMER');
                this.game.animals.push(v);
                this.game.scene.add(v.mesh);
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
        setTimeout(() => {
            for (let i = 0; i < 2; i++) {
                const v = new Villager(this.game);
                v.position.set(x + w / 2 + i - 0.5, y + 1, z + d / 2);
                this.game.animals.push(v);
                this.game.scene.add(v.mesh);
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

        // Bookshelves inside
        for (let dz = 1; dz < d - 1; dz++) {
            this.game.setBlock(x + 1, y + 1, z + dz, Blocks.BOOKSHELF, true, true);
            this.game.setBlock(x + 1, y + 2, z + dz, Blocks.BOOKSHELF, true, true);
            this.game.setBlock(x + w - 2, y + 1, z + dz, Blocks.BOOKSHELF, true, true);
            this.game.setBlock(x + w - 2, y + 2, z + dz, Blocks.BOOKSHELF, true, true);
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
        setTimeout(() => {
            for (let i = 0; i < 2; i++) {
                const v = new Villager(this.game, x + w / 2 + i, y + 1, z + d / 2, null, 'LIBRARIAN');
                this.game.animals.push(v);
                this.game.scene.add(v.mesh);
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
}
