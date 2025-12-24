import { Villager } from '../game/entities/animals/Villager.js';

export class StructureGenerator {

    constructor(game, worldGenerator) {
        this.game = game;
        this.worldGenerator = worldGenerator;
    }

    generateFeatures(cx, cy, cz) {
        const startX = cx * this.game.chunkSize;
        const startY = cy * this.game.chunkSize;
        const startZ = cz * this.game.chunkSize;

        for (let x = 0; x < this.game.chunkSize; x++) {
            for (let z = 0; z < this.game.chunkSize; z++) {
                const wx = startX + x;
                const wz = startZ + z;

                if (Math.random() < 0.01) {
                    const groundHeight = this.worldGenerator.getTerrainHeight(wx, wz);
                    const biome = this.worldGenerator.getBiome(wx, wz);

                    if (groundHeight >= startY && groundHeight < startY + this.game.chunkSize) {
                        const wy = groundHeight;
                        const blockBelow = this.game.getBlockWorld(wx, wy, wz);

                        // Valid ground check
                        if (blockBelow === 'grass' || (biome === 'SNOW' && blockBelow === 'snow') || (biome === 'DESERT' && blockBelow === 'sand')) {

                            // House Chance
                            // existing logic checks biome.
                            // Increased chance slightly for testing variety? No, keep it rare but varied.
                            if ((biome === 'PLAINS' || biome === 'FOREST' || biome === 'SNOW') && Math.random() < 0.1) {
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
                                // Tree logic
                                // Jack and the Beanstalk (Very Rare)
                                if ((biome === 'PLAINS' || biome === 'FOREST') && Math.random() < 0.005) {
                                    this.generateBeanstalk(wx, wy + 1, wz);
                                }
                                else if (biome === 'DESERT') {
                                    if (Math.random() < 0.2) this.generateCactus(wx, wy + 1, wz);
                                } else if (biome === 'JUNGLE') {
                                    this.generateJungleTree(wx, wy + 1, wz);
                                } else if (biome === 'FOREST') {
                                    if (Math.random() < 0.5) this.generateOakTree(wx, wy + 1, wz);
                                    else this.generateBirchTree(wx, wy + 1, wz);
                                } else if (biome === 'MOUNTAIN' || biome === 'SNOW') {
                                    if (Math.random() < 0.5) this.generatePineTree(wx, wy + 1, wz);
                                    else this.generateOakTree(wx, wy + 1, wz);
                                } else {
                                    // Plains
                                    if (Math.random() < 0.1) this.generateOakTree(wx, wy + 1, wz);
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
                wall: 'planks',
                corner: 'log',
                floor: 'planks',
                roof: 'wood',
                window: 'glass',
                biomes: ['PLAINS', 'FOREST']
            },
            {
                name: 'Birch Cottage',
                wall: 'birch_wood',
                corner: 'wood', // Contrast
                floor: 'planks', // Or birch planks if/when available
                roof: 'wood',
                window: 'glass',
                biomes: ['FOREST', 'PLAINS']
            },
            {
                name: 'Stone Keep',
                wall: 'stone',
                corner: 'stone',
                floor: 'planks',
                roof: 'stone', // Flat stone roof usually
                window: 'glass',
                biomes: ['MOUNTAIN', 'PLAINS'] // Stone can be anywhere
            },
            {
                name: 'Brick House',
                wall: 'brick',
                corner: 'brick',
                floor: 'planks',
                roof: 'wood',
                window: 'glass',
                biomes: ['PLAINS', 'FOREST']
            },
            {
                name: 'Snow Hut',
                wall: 'snow',
                corner: 'snow',
                floor: 'planks',
                roof: 'snow',
                window: 'glass',
                biomes: ['SNOW']
            }
        ];

        // Filter valid styles for this biome, or fallback to generic
        let validStyles = styles.filter(s => s.biomes.includes(biome));
        if (validStyles.length === 0) validStyles = styles.filter(s => s.name === 'Oak Cabin'); // Default fallback

        // Pick random style
        const style = validStyles[Math.floor(Math.random() * validStyles.length)];

        // Pick random shape
        // Classic: 5x5, Tall: 4x4 (tall), Wide: 7x5
        const shapes = [
            { w: 5, d: 5, h: 4, type: 'Classic' },
            { w: 5, d: 5, h: 4, type: 'Classic' }, // Weighted
            { w: 4, d: 4, h: 6, type: 'Tower' },
            { w: 7, d: 5, h: 4, type: 'Wide' },
            { w: 6, d: 6, h: 5, type: 'BigBox' }
        ];
        const shape = shapes[Math.floor(Math.random() * shapes.length)];

        const width = shape.w;
        const depth = shape.d;
        const height = shape.h;

        console.log(`Generating ${style.name} (${shape.type}) at ${x},${y},${z}`);

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
                        // Windows
                        else if (dy === 2 && !isCorner && Math.random() < 0.4) {
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
            this.game.setBlock(x + leftX, y + 1, z + backZ, 'crafting_table', true);
            this.game.setBlock(x + rightX, y + 1, z + backZ, 'bed', true);
            // Extra bed part? 'bed' is 1 block for now according to setBlock logic usually? 
            // Previous code did 2 blocks. Let's try to do 2 if space.
            if (rightX - 1 > leftX) {
                this.game.setBlock(x + rightX - 1, y + 1, z + backZ, 'bed', true);
            }
        }

        // Decor - Paintings (Inside!)
        // Place on side walls (x=1 or x=width-2)
        // Ensure not covering window?
        // We set blocks blindly, so painting might overwrite air? No, we set windows in 'Walls' loop.
        // We should place paintings on existing solid blocks ideally.
        // Let's place a painting on the back wall (interior side) at height 2 (eye level-ish)
        // Back wall is at dz = depth-1. Interior is at dz = depth-2.
        // Check if there's a window at the back? Random chance.
        // Just place it, it's safer than replacing the wall.
        if (width > 3) {
            const px = x + Math.floor(width / 2);
            const py = y + 2;
            const pz = z + depth - 2;
            // Check if occupied? 
            // If it's air, place painting.
            // Note: Painting block is a full block visualized as a painting? 
            // AssetManager says 'painting' hardness 0.1.
            // If we place it at [depth-2], it floats inside. 
            // If the user wants it "on the wall", usually that means a flat plane. 
            // But if our painting is a block, it stands on the floor or floats?
            // Assuming 1 block = 1 voxel. So placing it adjacent to the wall is correct for "inside".
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
        const height = 40 + Math.floor(Math.random() * 20); // 40-60 blocks tall
        console.log(`Generating Beanstalk at ${x},${y},${z} height: ${height}`);

        for (let i = 0; i < height; i++) {
            // Main Stalk
            this.game.setBlock(x, y + i, z, 'pine_leaves', true);

            // Spiral Leaves
            const angle = i * 0.5;
            const radius = 2;
            const lx = Math.round(x + Math.cos(angle) * radius);
            const lz = Math.round(z + Math.sin(angle) * radius);

            // Ensure we don't overwrite the stalk itself (though radius implies we are away)
            if (lx !== x || lz !== z) {
                this.game.setBlock(lx, y + i, lz, 'leaves', true);
            }
        }

        // Cloud/Pod at top
        const topY = y + height;
        for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -2; dz <= 2; dz++) {
                this.game.setBlock(x + dx, topY, z + dz, 'snow', true); // White "cloud"
            }
        }
    }

    generateOakTree(x, y, z) {
        const height = 4 + Math.floor(Math.random() * 3);

        // Trunk
        for (let i = 0; i < height; i++) {
            this.game.setBlock(x, y + i, z, 'log', true);
        }

        // Leaves
        for (let ly = y + height - 3; ly <= y + height; ly++) {
            let radius = 2;
            if (ly === y + height) radius = 1;

            for (let lx = x - radius; lx <= x + radius; lx++) {
                for (let lz = z - radius; lz <= z + radius; lz++) {
                    // Circle check-ish or just square
                    // Avoid overwriting trunk
                    if ((lx !== x || lz !== z || ly > y + height - 1) && Math.random() < 0.8) {
                        // Don't overwrite existing blocks unless air/weak
                        const current = this.game.getBlockWorld(lx, ly, lz);
                        if (!current || current === 'air') {
                            this.game.setBlock(lx, ly, lz, 'leaves', true);
                        }
                    }
                }
            }
        }
    }

    generateBirchTree(x, y, z) {
        const height = 5 + Math.floor(Math.random() * 3);

        // Trunk
        for (let i = 0; i < height; i++) {
            this.game.setBlock(x, y + i, z, 'birch_wood', true);
        }

        // Leaves - taller, thinner top
        for (let ly = y + height / 2; ly <= y + height; ly++) {
            // Tapered logic could be better, but simple is fine
            const radius = (ly > y + height - 2) ? 1 : 2;

            for (let lx = x - radius; lx <= x + radius; lx++) {
                for (let lz = z - radius; lz <= z + radius; lz++) {
                    if ((lx !== x || lz !== z) && Math.random() < 0.7) {
                        const current = this.game.getBlockWorld(lx, ly, lz);
                        if (!current || current === 'air') {
                            this.game.setBlock(lx, ly, lz, 'birch_leaves', true);
                        }
                    }
                }
            }
        }
        // Top cap
        this.game.setBlock(x, y + height + 1, z, 'birch_leaves', true);
    }

    generatePineTree(x, y, z) {
        const height = 6 + Math.floor(Math.random() * 5);

        // Trunk
        for (let i = 0; i < height; i++) {
            this.game.setBlock(x, y + i, z, 'pine_wood', true);
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
                        if (!current || current === 'air') {
                            this.game.setBlock(lx, ly, lz, 'pine_leaves', true);
                        }
                    }
                }
            }
        }
        // Top tip
        this.game.setBlock(x, y + height, z, 'pine_leaves', true);
    }

    generateJungleTree(x, y, z) {
        // Tall and big
        const height = 10 + Math.floor(Math.random() * 10);

        // Trunk (2x2 ?) No, 1x1 for now is safer for this voxel engine unless verified
        // Let's do 1x1 but tall with vines (leaves)

        for (let i = 0; i < height; i++) {
            this.game.setBlock(x, y + i, z, 'log', true);

            // Vines?
            if (Math.random() < 0.2 && i < height - 2) {
                // Direction
                const dir = Math.floor(Math.random() * 4);
                let vx = x, vz = z;
                if (dir === 0) vx++;
                else if (dir === 1) vx--;
                else if (dir === 2) vz++;
                else vz--;

                this.game.setBlock(vx, y + i, vz, 'leaves', true);
            }
        }

        // Bushy top
        const radius = 4;
        for (let ly = y + height - 4; ly <= y + height; ly++) {
            for (let lx = x - radius; lx <= x + radius; lx++) {
                for (let lz = z - radius; lz <= z + radius; lz++) {
                    const dist = Math.sqrt((lx - x) ** 2 + (lz - z) ** 2);
                    if (dist < radius + Math.random()) {
                        const current = this.game.getBlockWorld(lx, ly, lz);
                        if (!current || current === 'air') {
                            this.game.setBlock(lx, ly, lz, 'leaves', true);
                        }
                    }
                }
            }
        }
    }

    generateCactus(x, y, z) {
        // Simple column
        const height = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < height; i++) {
            this.game.setBlock(x, y + i, z, 'leaves', true); // Use leaves as green cactus fallback
        }
    }

    generateCastle(cx, cy, cz) {
        console.log(`Generating Castle at ${cx},${cy},${cz}`);
        const width = 31;
        const depth = 31;
        const height = 12;

        const startX = cx - Math.floor(width / 2);
        const startZ = cz - Math.floor(depth / 2);
        const startY = cy;

        // Clear area / Foundation
        for (let x = 0; x < width; x++) {
            for (let z = 0; z < depth; z++) {
                for (let y = -2; y < height + 8; y++) {
                    const wx = startX + x;
                    const wy = startY + y;
                    const wz = startZ + z;

                    if (y < 0) {
                        this.game.setBlock(wx, wy, wz, 'stone', true); // Foundation
                    } else if (y < height) {
                        this.game.setBlock(wx, wy, wz, 'air', true); // Clear space
                    }
                }
            }
        }

        // Walls (Outer Keep)
        const wallHeight = 8;
        this.buildWalls(startX, startY, startZ, width, depth, wallHeight, 'stone');

        // Towers at corners
        const towerSize = 5;
        const towerHeight = 12;
        this.buildTower(startX, startY, startZ, towerSize, towerHeight, 'stone'); // FL
        this.buildTower(startX + width - towerSize, startY, startZ, towerSize, towerHeight, 'stone'); // FR
        this.buildTower(startX, startY, startZ + depth - towerSize, towerSize, towerHeight, 'stone'); // BL
        this.buildTower(startX + width - towerSize, startY, startZ + depth - towerSize, towerSize, towerHeight, 'stone'); // BR

        // Central Keep
        const keepSize = 13;
        const keepHeight = 16;
        const keepX = startX + Math.floor((width - keepSize) / 2);
        const keepZ = startZ + Math.floor((depth - keepSize) / 2);
        this.buildKeep(keepX, startY, keepZ, keepSize, keepHeight, 'stone');

        // Courtyard Decor
        this.decorateCourtyard(startX + towerSize, startY, startZ + towerSize, width - 2 * towerSize, depth - 2 * towerSize);

        // Entrance (Main Gate)
        this.buildGate(startX + Math.floor(width / 2), startY, startZ, 'stone');
    }

    buildWalls(x, y, z, width, depth, height, material) {
        for (let i = 0; i < width; i++) {
            for (let j = 0; j < depth; j++) {
                if (i === 0 || i === width - 1 || j === 0 || j === depth - 1) {
                    for (let h = 0; h < height; h++) {
                        this.game.setBlock(x + i, y + h, z + j, material, true);
                    }
                    // Crenellations
                    if ((i + j) % 2 === 0) {
                        this.game.setBlock(x + i, y + height, z + j, material, true);
                    }
                } else {
                    // Courtyard floor
                    if (width > 10) { // Only force floor for large areas
                        this.game.setBlock(x + i, y, z + j, 'stone', true);
                    }
                }
            }
        }
    }

    buildTower(x, y, z, size, height, material) {
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                // Walls
                if (i === 0 || i === size - 1 || j === 0 || j === size - 1) {
                    const isCorner = (i === 0 || i === size - 1) && (j === 0 || j === size - 1);
                    const blockType = isCorner ? 'log' : material;

                    for (let h = 0; h < height; h++) {
                        this.game.setBlock(x + i, y + h, z + j, blockType, true);
                    }
                    // Battlement
                    if ((i + j) % 2 === 0) {
                        this.game.setBlock(x + i, y + height, z + j, blockType, true);
                    }
                } else {
                    // Floor at top
                    this.game.setBlock(x + i, y + height - 1, z + j, 'wood', true);
                }
            }
        }
    }

    buildKeep(x, y, z, size, height, material) {
        // Walls & Floors
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                for (let h = 0; h <= height; h++) {
                    const wx = x + i;
                    const wy = y + h;
                    const wz = z + j;

                    // Walls
                    if (i === 0 || i === size - 1 || j === 0 || j === size - 1) {
                        // Check if this is a window position
                        const isWindowZone = h > 2 && h < height - 2 && (h % 4) === 2 && (i > 2 && i < size - 2 || j > 2 && j < size - 2);
                        // Check if this is the center column (no windows here)
                        const isCenterColumn = (i === Math.floor(size / 2) || j === Math.floor(size / 2));
                        const isCorner = (i === 0 || i === size - 1) && (j === 0 || j === size - 1);

                        if (isCorner) {
                            this.game.setBlock(wx, wy, wz, 'log', true);
                        } else if (isWindowZone && !isCenterColumn && Math.random() < 0.3) {
                            this.game.setBlock(wx, wy, wz, 'glass', true);
                        } else {
                            this.game.setBlock(wx, wy, wz, material, true);
                        }
                    }
                    // Floors
                    else if (h === 0 || h === 5 || h === 10 || h === height) {
                        this.game.setBlock(wx, wy, wz, 'wood', true);
                    }
                    // Interior Air
                    else {
                        this.game.setBlock(wx, wy, wz, 'air', true);
                    }
                }
            }
        }

        // Crenellations
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                if (i === 0 || i === size - 1 || j === 0 || j === size - 1) {
                    if ((i + j) % 2 === 0) {
                        this.game.setBlock(x + i, y + height + 1, z + j, material, true);
                    }
                }
            }
        }

        // Furnish Interior
        // Ground Floor: Great Hall
        this.furnishGreatHall(x + 1, y + 1, z + 1, size - 2, 4);

        // 2nd Floor: Library / Study
        this.furnishLibrary(x + 1, y + 6, z + 1, size - 2, 4);

        // 3rd Floor: Bedroom / Treasury
        this.furnishBedroom(x + 1, y + 11, z + 1, size - 2, 4);

        // Entrance
        this.game.setBlock(x + Math.floor(size / 2), y + 1, z, 'air', true);
        this.game.setBlock(x + Math.floor(size / 2), y + 2, z, 'air', true);
    }

    furnishGreatHall(x, y, z, size, height) {
        // Long table
        const midX = Math.floor(size / 2);
        for (let j = 2; j < size - 2; j++) {
            this.game.setBlock(x + midX, y, z + j, 'wood', true); // Table
            // Chairs?
            if (j % 2 === 0) {
                // this.game.setBlock(x + midX - 1, y, z + j, 'wood', true); // Chair
                // this.game.setBlock(x + midX + 1, y, z + j, 'wood', true); // Chair
            }
        }

        // Tapestries on walls
        for (let i = 1; i < size - 1; i++) {
            if (i === midX) continue; // Door path
            this.game.setBlock(x + i, y + 1, z, 'tapestry', true); // Back wall? No z is front relative to loop?
            // Actually passed x,y,z is corner. 
            // Logic is simplified. Just place some randomly on walls.
        }
    }

    furnishLibrary(x, y, z, size, height) {
        // Bookshelves lining walls
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                if (i === 0 || i === size - 1 || j === 0 || j === size - 1) {
                    if (Math.random() < 0.7) {
                        this.game.setBlock(x + i, y, z + j, 'bookshelf', true);
                        this.game.setBlock(x + i, y + 1, z + j, 'bookshelf', true);
                    }
                }
            }
        }
    }

    furnishBedroom(x, y, z, size, height) {
        // Bed
        this.game.setBlock(x + 1, y, z + 1, 'bed', true);
        this.game.setBlock(x + 2, y, z + 1, 'bed', true); // Double bed logic

        // Gold / Treasury
        this.game.setBlock(x + size - 2, y, z + size - 2, 'gold_block', true);
        this.game.setBlock(x + size - 2, y + 1, z + size - 2, 'gold_block', true);

        // Painting
        this.game.setBlock(x + Math.floor(size / 2), y + 1, z + size - 1, 'painting', true);
    }

    decorateCourtyard(x, y, z, w, d) {
        // Random features
        for (let i = 0; i < w; i++) {
            for (let j = 0; j < d; j++) {
                if (Math.random() < 0.05) {
                    this.game.setBlock(x + i, y, z + j, 'flower_red', true);
                }
            }
        }
    }

    buildGate(x, y, z, material) {
        // Simple opening
        for (let i = -1; i <= 1; i++) {
            for (let h = 0; h < 3; h++) {
                this.game.setBlock(x + i, y + h, z, 'air', true);
            }
        }
        // Portcullis? Iron bars eventually.
    }
}

