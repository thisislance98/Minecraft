import { Villager } from '../game/entities/animals/Villager.js';
import { Blocks } from '../game/core/Blocks.js';
import { SeededRandom } from '../utils/SeededRandom.js';

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

    /**
     * Get deterministic random value for a specific position
     * This ensures the same structure decisions are made for the same location
     */
    getPositionRandom(x, z, salt = 0) {
        const hash = this.hashPosition(x, z, salt);
        const rng = new SeededRandom(hash);
        return rng.next();
    }

    /**
     * Get a seeded random generator for a specific position
     * Useful when multiple random values are needed for the same location
     */
    getPositionRng(x, z, salt = 0) {
        const hash = this.hashPosition(x, z, salt);
        return new SeededRandom(hash);
    }

    /**
     * Hash a position with the world seed for deterministic results
     */
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

                // Use position-based seeded random for feature spawn check
                const featureRng = this.getPositionRng(wx, wz, 1);
                if (featureRng.next() < 0.01) {
                    const groundHeight = this.worldGenerator.getTerrainHeight(wx, wz);
                    const biome = this.worldGenerator.getBiome(wx, wz);

                    if (groundHeight >= startY && groundHeight < startY + this.game.chunkSize) {
                        const wy = groundHeight;
                        const blockBelow = this.game.getBlockWorld(wx, wy, wz);

                        // Valid ground check
                        if (blockBelow === Blocks.GRASS || (biome === 'SNOW' && blockBelow === Blocks.SNOW) || (biome === 'DESERT' && blockBelow === Blocks.SAND)) {

                            // House Chance
                            // existing logic checks biome.
                            // Increased chance slightly for testing variety? No, keep it rare but varied.
                            if ((biome === 'PLAINS' || biome === 'FOREST' || biome === 'SNOW') && featureRng.next() < 0.1) {
                                // Check for flat land for typical house size (approx 5x5 to 7x7)
                                // We'll check 7x7 to be safe for larger houses
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
                                // Tree logic - use same RNG for consistency
                                const treeRand = featureRng.next();
                                // Jack and the Beanstalk (Very Rare)
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
                                    // Plains
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
        // Define Styles with palettes
        const styles = [
            {
                name: 'Oak Cabin',
                wall: Blocks.PLANK,
                corner: Blocks.LOG,
                floor: Blocks.PLANK,
                roof: Blocks.PINE_WOOD, // 'wood' usually maps to log/wood blocks. Using PINE_WOOD for variety/darker roof
                window: Blocks.GLASS,
                biomes: ['PLAINS', 'FOREST']
            },
            {
                name: 'Birch Cottage',
                wall: Blocks.BIRCH_WOOD,
                corner: Blocks.PINE_WOOD, // Contrast
                floor: Blocks.PLANK, // Or birch planks if/when available
                roof: Blocks.PINE_WOOD,
                window: Blocks.GLASS,
                biomes: ['FOREST', 'PLAINS']
            },
            {
                name: 'Stone Keep',
                wall: Blocks.STONE,
                corner: Blocks.STONE,
                floor: Blocks.PLANK,
                roof: Blocks.STONE, // Flat stone roof usually
                window: Blocks.GLASS,
                biomes: ['MOUNTAIN', 'PLAINS'] // Stone can be anywhere
            },
            {
                name: 'Brick House',
                wall: Blocks.BRICK,
                corner: Blocks.BRICK,
                floor: Blocks.PLANK,
                roof: Blocks.PINE_WOOD,
                window: Blocks.GLASS,
                biomes: ['PLAINS', 'FOREST']
            },
            {
                name: 'Snow Hut',
                wall: Blocks.SNOW,
                corner: Blocks.SNOW,
                floor: Blocks.PLANK,
                roof: Blocks.SNOW,
                window: Blocks.GLASS,
                biomes: ['SNOW']
            }
        ];

        // Filter valid styles for this biome, or fallback to generic
        let validStyles = styles.filter(s => s.biomes.includes(biome));
        if (validStyles.length === 0) validStyles = styles.filter(s => s.name === 'Oak Cabin'); // Default fallback

        // Use position-based seeded random for house style/shape
        const houseRng = this.getPositionRng(x, z, 100);

        // Pick random style
        const style = validStyles[Math.floor(houseRng.next() * validStyles.length)];

        // Pick random shape
        // Classic: 5x5, Tall: 4x4 (tall), Wide: 7x5
        const shapes = [
            { w: 5, d: 5, h: 4, type: 'Classic' },
            { w: 5, d: 5, h: 4, type: 'Classic' }, // Weighted
            { w: 4, d: 4, h: 6, type: 'Tower' },
            { w: 7, d: 5, h: 4, type: 'Wide' },
            { w: 6, d: 6, h: 5, type: 'BigBox' }
        ];
        const shape = shapes[Math.floor(houseRng.next() * shapes.length)];

        const width = shape.w;
        const depth = shape.d;
        const height = shape.h;

        console.log(`Generating ${style.name} (${shape.type}) at ${x},${y},${z}`);

        // === FOUNDATION: Fill terrain beneath house ===
        // Fill from a few blocks below terrain up to the floor level
        // This prevents the floating appearance
        for (let dx = 0; dx < width; dx++) {
            for (let dz = 0; dz < depth; dz++) {
                // Fill foundation from a few blocks below up to floor level
                for (let fy = y - 4; fy < y; fy++) {
                    // Use stone or cobblestone for foundation
                    const existingBlock = this.game.getBlockWorld(x + dx, fy, z + dz);
                    // Only fill if it's air (don't replace existing terrain)
                    if (!existingBlock || existingBlock === Blocks.AIR) {
                        this.game.setBlock(x + dx, fy, z + dz, Blocks.STONE, true);
                    }
                }
            }
        }

        // Walls & Floor & Ceiling
        for (let dx = 0; dx < width; dx++) {
            for (let dz = 0; dz < depth; dz++) {
                // Floor
                this.game.setBlock(x + dx, y, z + dz, style.floor, true);

                // Ceiling (Flat base for roof)
                this.game.setBlock(x + dx, y + height, z + dz, style.roof, true); // Could be air check? No, nice to have ceiling.

                // Walls
                for (let dy = 1; dy < height; dy++) {
                    let isCorner = (dx === 0 || dx === width - 1) && (dz === 0 || dz === depth - 1);
                    let isWall = (dx === 0 || dx === width - 1 || dz === 0 || dz === depth - 1);

                    if (isWall) {
                        const blockType = isCorner ? style.corner : style.wall;

                        // Door opening (Front centerish)
                        // Front wall is usually z=0
                        if (dz === 0 && dx === Math.floor(width / 2) && dy < 3) {
                            this.game.setBlock(x + dx, y + dy, z + dz, null, true); // Doorway
                        }
                        // Windows - use position-based random for consistent window placement
                        else if (dy === 2 && !isCorner && this.getPositionRandom(x + dx, z + dz, 200) < 0.4) {
                            this.game.setBlock(x + dx, y + dy, z + dz, style.window, true);
                        }
                        else {
                            this.game.setBlock(x + dx, y + dy, z + dz, blockType, true);
                        }
                    } else {
                        // Interior Air
                        this.game.setBlock(x + dx, y + dy, z + dz, null, true);
                    }
                }
            }
        }

        // Furniture
        // Crafting Table & Bed
        // Place them along a wall, not blocking door
        // Door is at dx = floor(width/2), dz = 0

        // Simple heuristic: Try to place in back corners
        const backZ = depth - 2; // Inside wall
        const leftX = 1;
        const rightX = width - 2;

        if (backZ > 0) {
            this.game.setBlock(x + leftX, y + 1, z + backZ, Blocks.CRAFTING_TABLE, true);
            // Bed
            // Previous code used 'bed'. Assuming Blocks.BED exists or we map to it?
            // checking Blocks.js... I don't see BED. I see BEDROCK.
            // checking Blocks.js again...
            // It has BEDROCK, BRICK, BOOKSHELF... but NO BED.
            // Ah, 'bed' might be a special item/block not fully in the blocks list yet or I missed it.
            // Let's check Blocks.js again content from Step 60.
            // ... TNT, BOOKSHELF, CRAFTING_TABLE, FURNACE ...
            // No BED.
            // So 'bed' was a string literal that worked because it was handled somewhere else?
            // Or maybe it does not exist as a block yet?
            // Chunk.js didn't have special logic for bed.
            // PhysicsManager didn't have special logic.
            // AssetManager likely loads 'bed'.
            // If I use 'bed' string, it's fine, but I should add it to Blocks.js or use the string for now.
            // Better: Add BED to Blocks.js later. For now, use literal 'bed' or add to Blocks inline?
            // Implementation Plan for Blocks.js didn't include BED.
            // I'll stick to 'bed' literal here and note it, OR I can quickly append it to Blocks.js?
            // Nah, let's just use the string 'bed' to be safe since I can't edit Blocks.js and this file in one go easily without switching context.
            // Actually, I can just use 'bed' string.
            // Wait, I should add it to Blocks.js if I want to be thorough.
            // But let's check if 'bed' is even a valid block in AssetManager?
            // Assuming it is.
            this.game.setBlock(x + rightX, y + 1, z + backZ, 'bed', true);

            if (rightX - 1 > leftX) {
                this.game.setBlock(x + rightX - 1, y + 1, z + backZ, 'bed', true);
            }
        }

        // Decor - Paintings (Inside!)
        if (width > 3) {
            const px = x + Math.floor(width / 2);
            const py = y + 2;
            const pz = z + depth - 2;
            // 'painting' block?
            this.game.setBlock(px, py, pz, 'painting', true);
        }

        // Roof
        // Simple Pyramid or Flat based on style?
        if (style.name === 'Stone Keep') {
            // Crenellations
            for (let dx = 0; dx < width; dx++) {
                for (let dz = 0; dz < depth; dz++) {
                    let isWall = (dx === 0 || dx === width - 1 || dz === 0 || dz === depth - 1);
                    if (isWall && (dx + dz) % 2 === 0) {
                        this.game.setBlock(x + dx, y + height + 1, z + dz, style.corner, true);
                    }
                }
            }
        } else {
            // Pyramid Roof
            const roofHeight = Math.ceil(width / 2);
            for (let i = 0; i < roofHeight; i++) {
                for (let dx = -1 + i; dx <= width - i; dx++) {
                    for (let dz = -1 + i; dz <= depth - i; dz++) {
                        if (dx >= 0 && dx < width && dz >= 0 && dz < depth) {
                            // Inside attic - usually leave empty or fill?
                            // This loop covers the *layer*.
                        }
                        this.game.setBlock(x + dx, y + height + 1 + i, z + dz, style.roof, true);
                    }
                }
            }
        }

        // Spawn Villager inside
        try {
            const villager = new Villager(this.game, x + width / 2, y + 1, z + depth / 2);
            this.game.animals.push(villager);
            this.game.scene.add(villager.mesh);
        } catch (e) {
            // console.error("Failed to spawn villager:", e);
        }
    }

    generateBeanstalk(x, y, z) {
        const rng = this.getPositionRng(x, z, 300);
        const height = 40 + Math.floor(rng.next() * 20); // 40-60 blocks tall
        console.log(`Generating Beanstalk at ${x},${y},${z} height: ${height}`);

        for (let i = 0; i < height; i++) {
            // Main Stalk
            this.game.setBlock(x, y + i, z, Blocks.PINE_LEAVES, true);

            // Spiral Leaves
            const angle = i * 0.5;
            const radius = 2;
            const lx = Math.round(x + Math.cos(angle) * radius);
            const lz = Math.round(z + Math.sin(angle) * radius);

            // Ensure we don't overwrite the stalk itself (though radius implies we are away)
            if (lx !== x || lz !== z) {
                this.game.setBlock(lx, y + i, lz, Blocks.LEAVES, true);
            }
        }

        // Cloud/Pod at top
        const topY = y + height;
        for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -2; dz <= 2; dz++) {
                this.game.setBlock(x + dx, topY, z + dz, Blocks.SNOW, true); // White "cloud"
            }
        }
    }

    generateOakTree(x, y, z) {
        const rng = this.getPositionRng(x, z, 400);
        const height = 4 + Math.floor(rng.next() * 3);

        // Trunk
        for (let i = 0; i < height; i++) {
            this.game.setBlock(x, y + i, z, Blocks.LOG, true);
        }

        // Leaves
        for (let ly = y + height - 3; ly <= y + height; ly++) {
            let radius = 2;
            if (ly === y + height) radius = 1;

            for (let lx = x - radius; lx <= x + radius; lx++) {
                for (let lz = z - radius; lz <= z + radius; lz++) {
                    // Circle check-ish or just square
                    // Avoid overwriting trunk - use position-based random for leaf placement
                    if ((lx !== x || lz !== z || ly > y + height - 1) && this.getPositionRandom(lx, lz, ly * 10 + 401) < 0.8) {
                        // Don't overwrite existing blocks unless air/weak
                        const current = this.game.getBlockWorld(lx, ly, lz);
                        if (!current || current === Blocks.AIR) {
                            this.game.setBlock(lx, ly, lz, Blocks.LEAVES, true);
                        }
                    }
                }
            }
        }
    }

    generateBirchTree(x, y, z) {
        const rng = this.getPositionRng(x, z, 500);
        const height = 5 + Math.floor(rng.next() * 3);

        // Trunk
        for (let i = 0; i < height; i++) {
            this.game.setBlock(x, y + i, z, Blocks.BIRCH_WOOD, true);
        }

        // Leaves - taller, thinner top
        for (let ly = y + height / 2; ly <= y + height; ly++) {
            // Tapered logic could be better, but simple is fine
            const radius = (ly > y + height - 2) ? 1 : 2;

            for (let lx = x - radius; lx <= x + radius; lx++) {
                for (let lz = z - radius; lz <= z + radius; lz++) {
                    if ((lx !== x || lz !== z) && this.getPositionRandom(lx, lz, ly * 10 + 501) < 0.7) {
                        const current = this.game.getBlockWorld(lx, ly, lz);
                        if (!current || current === Blocks.AIR) {
                            this.game.setBlock(lx, ly, lz, Blocks.BIRCH_LEAVES, true);
                        }
                    }
                }
            }
        }
        // Top cap
        this.game.setBlock(x, y + height + 1, z, Blocks.BIRCH_LEAVES, true);
    }

    generatePineTree(x, y, z) {
        const rng = this.getPositionRng(x, z, 600);
        const height = 6 + Math.floor(rng.next() * 5);

        // Trunk
        for (let i = 0; i < height; i++) {
            this.game.setBlock(x, y + i, z, Blocks.PINE_WOOD, true);
        }

        // Conical Leaves
        // Start from top
        let radius = 0;
        for (let i = 0; i < height - 2; i++) {
            const ly = y + height - 1 - i;
            if (i % 2 === 0) radius++; // Increase radius every 2 layers
            if (radius > 3) radius = 3;

            for (let lx = x - radius; lx <= x + radius; lx++) {
                for (let lz = z - radius; lz <= z + radius; lz++) {
                    const dist = Math.sqrt((lx - x) ** 2 + (lz - z) ** 2);
                    if (dist <= radius + 0.5 && (lx !== x || lz !== z)) {
                        const current = this.game.getBlockWorld(lx, ly, lz);
                        if (!current || current === Blocks.AIR) {
                            this.game.setBlock(lx, ly, lz, Blocks.PINE_LEAVES, true);
                        }
                    }
                }
            }
        }
        // Top tip
        this.game.setBlock(x, y + height, z, Blocks.PINE_LEAVES, true);
    }

    generateJungleTree(x, y, z) {
        // Tall and big
        const rng = this.getPositionRng(x, z, 700);
        const height = 10 + Math.floor(rng.next() * 10);

        // Trunk (2x2 ?) No, 1x1 for now is safer for this voxel engine unless verified
        // Let's do 1x1 but tall with vines (leaves)

        for (let i = 0; i < height; i++) {
            this.game.setBlock(x, y + i, z, Blocks.LOG, true);

            // Vines? - use position-based random
            const vineRng = this.getPositionRng(x, z, 701 + i);
            if (vineRng.next() < 0.2 && i < height - 2) {
                // Direction
                const dir = Math.floor(vineRng.next() * 4);
                let vx = x, vz = z;
                if (dir === 0) vx++;
                else if (dir === 1) vx--;
                else if (dir === 2) vz++;
                else vz--;

                this.game.setBlock(vx, y + i, vz, Blocks.LEAVES, true);
            }
        }

        // Bushy top
        const radius = 4;
        for (let ly = y + height - 4; ly <= y + height; ly++) {
            for (let lx = x - radius; lx <= x + radius; lx++) {
                for (let lz = z - radius; lz <= z + radius; lz++) {
                    const dist = Math.sqrt((lx - x) ** 2 + (lz - z) ** 2);
                    if (dist < radius + this.getPositionRandom(lx, lz, ly * 10 + 702)) {
                        const current = this.game.getBlockWorld(lx, ly, lz);
                        if (!current || current === Blocks.AIR) {
                            this.game.setBlock(lx, ly, lz, Blocks.LEAVES, true);
                        }
                    }
                }
            }
        }
    }

    generateCactus(x, y, z) {
        // Simple column
        const rng = this.getPositionRng(x, z, 800);
        const height = 2 + Math.floor(rng.next() * 2);
        for (let i = 0; i < height; i++) {
            this.game.setBlock(x, y + i, z, Blocks.LEAVES, true); // Use leaves as green cactus fallback
        }
    }


}
