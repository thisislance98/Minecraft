import { Villager } from '../game/entities/animals/Villager.js';
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
                    const biome = this.worldGenerator.getBiome(wx, wz);

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
                                if ((biome === 'PLAINS' || biome === 'FOREST') && treeRand < 0.005) {
                                    this.generateBeanstalk(wx, wy + 1, wz);
                                }
                                else if (biome === 'DESERT') {
                                    if (treeRand < 0.2) this.generateCactus(wx, wy + 1, wz);
                                } else if (biome === 'JUNGLE') {
                                    this.generateJungleTree(wx, wy + 1, wz);
                                } else if (biome === 'FOREST') {
                                    if (treeRand < 0.5) this.generateOakTree(wx, wy + 1, wz);
                                    else this.generateBirchTree(wx, wy + 1, wz);
                                } else if (biome === 'MOUNTAIN' || biome === 'SNOW') {
                                    if (treeRand < 0.5) this.generatePineTree(wx, wy + 1, wz);
                                    else this.generateOakTree(wx, wy + 1, wz);
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
}
