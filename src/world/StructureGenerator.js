import { Villager } from '../game/animals/Villager.js';

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

                            // House Chance (Rare)
                            // The outer loop does `if (Math.random() < 0.01)`
                            // So we are already rare.
                            // existing logic checks biome.
                            if ((biome === 'PLAINS' || biome === 'FOREST' || biome === 'SNOW') && Math.random() < 0.1) {
                                // Check for flat land for 5x5 house
                                let isFlat = true;
                                const h0 = wy;
                                for (let hx = 0; hx < 5; hx++) {
                                    for (let hz = 0; hz < 5; hz++) {
                                        if (this.worldGenerator.getTerrainHeight(wx + hx, wz + hz) !== h0) {
                                            isFlat = false;
                                            break;
                                        }
                                    }
                                    if (!isFlat) break;
                                }

                                if (isFlat) {
                                    this.generateHouse(wx, wy + 1, wz);
                                }
                            } else {
                                // Tree logic
                                // Jack and the Beanstalk (Very Rare)
                                // TEMPORARY: High percent for testing (0.5 instead of 0.005)
                                if ((biome === 'PLAINS' || biome === 'FOREST') && Math.random() < 0.5) {
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


    placeTree(x, y, z, biome) {
        this.generateOakTree(x, y, z);
    }

    generateCactus(x, y, z) {
        const height = 2 + Math.floor(Math.random() * 3);
        try {
            for (let i = 0; i < height; i++) {
                this.game.setBlock(x, y + i, z, 'pine_leaves', true); // Visual proxy
            }
        } catch (e) {
            // Ignore boundary errors during generation
        }
    }

    generateJungleTree(x, y, z) {
        const height = 8 + Math.floor(Math.random() * 11); // 8-18 blocks tall
        for (let i = 0; i < height; i++) {
            this.game.setBlock(x, y + i, z, 'wood', true);
        }
        // Scale canopy based on height
        const canopyRadius = height > 12 ? 3 : 2;
        for (let dx = -canopyRadius; dx <= canopyRadius; dx++) {
            for (let dz = -canopyRadius; dz <= canopyRadius; dz++) {
                if (Math.abs(dx) === canopyRadius && Math.abs(dz) === canopyRadius) continue;
                this.game.setBlock(x + dx, y + height, z + dz, 'leaves', true);
                this.game.setBlock(x + dx, y + height + 1, z + dz, 'leaves', true);
            }
        }
    }

    generateOakTree(x, y, z) {
        const height = 4 + Math.floor(Math.random() * 5); // 4-8 blocks tall
        for (let i = 0; i < height; i++) {
            this.game.setBlock(x, y + i, z, 'wood', true);
        }
        const leafStart = height - 2;
        for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -2; dz <= 2; dz++) {
                for (let dy = leafStart; dy <= height; dy++) {
                    if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
                    if (dy === height && (Math.abs(dx) > 1 || Math.abs(dz) > 1)) continue;
                    if (!(dx === 0 && dz === 0)) {
                        this.game.setBlock(x + dx, y + dy, z + dz, 'leaves', true);
                    }
                }
            }
        }
        this.game.setBlock(x, y + height, z, 'leaves', true);
        this.game.setBlock(x, y + height + 1, z, 'leaves', true);
    }

    generateBirchTree(x, y, z) {
        const height = 5 + Math.floor(Math.random() * 5); // 5-9 blocks tall
        for (let i = 0; i < height; i++) {
            this.game.setBlock(x, y + i, z, 'birch_wood', true);
        }
        for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -2; dz <= 2; dz++) {
                for (let dy = height - 2; dy <= height; dy++) {
                    if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
                    if (!(dx === 0 && dz === 0)) {
                        this.game.setBlock(x + dx, y + dy, z + dz, 'birch_leaves', true);
                    }
                }
            }
        }
        this.game.setBlock(x, y + height, z, 'birch_leaves', true);
        this.game.setBlock(x, y + height + 1, z, 'birch_leaves', true);
    }

    generatePineTree(x, y, z) {
        const height = 6 + Math.floor(Math.random() * 9); // 6-14 blocks tall
        for (let i = 0; i < height; i++) {
            this.game.setBlock(x, y + i, z, 'pine_wood', true);
        }
        // Scale radius based on height
        let maxRadius = height > 10 ? 3 : 2;
        let radius = maxRadius;
        const leafStart = Math.floor(height * 0.4);
        for (let dy = leafStart; dy < height + 2; dy++) {
            if (dy > height - 2) radius = 1;
            else if (dy > height - 4) radius = Math.max(1, maxRadius - 1);
            else radius = maxRadius;
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    if (dx * dx + dz * dz <= radius * radius + 0.5) {
                        if (dy >= height && dx === 0 && dz === 0) continue;
                        if (this.game.getBlock(x + dx, y + dy, z + dz) === null) {
                            this.game.setBlock(x + dx, y + dy, z + dz, 'pine_leaves', true);
                        }
                    }
                }
            }
        }
        this.game.setBlock(x, y + height + 2, z, 'pine_leaves', true);
    }
    generateHouse(x, y, z) {
        // Simple 5x5 wooden house
        const width = 5;
        const depth = 5;
        const height = 4;

        // Walls & Floor & Ceiling
        for (let dx = 0; dx < width; dx++) {
            for (let dz = 0; dz < depth; dz++) {
                // Floor - Use planks for nice flooring
                this.game.setBlock(x + dx, y, z + dz, 'planks', true);

                // Ceiling (Roof base)
                this.game.setBlock(x + dx, y + height, z + dz, 'wood', true);

                // Walls
                for (let dy = 1; dy < height; dy++) {
                    let isWall = (dx === 0 || dx === width - 1 || dz === 0 || dz === depth - 1);
                    if (isWall) {
                        // Door opening
                        if (dx === 2 && dz === 0 && dy < 3) {
                            // Doorway (air)
                            this.game.setBlock(x + dx, y + dy, z + dz, null, true);
                        } else {
                            // Windows
                            if (dy === 2 && ((dx === 0 || dx === width - 1) && dz === 2)) {
                                this.game.setBlock(x + dx, y + dy, z + dz, 'glass', true); // Use glass for windows instead of just holes
                            } else {
                                // Add paintings on the back wall
                                if (dz === depth - 1 && dy === 2 && (dx === 1 || dx === 3)) {
                                    this.game.setBlock(x + dx, y + dy, z + dz, 'painting', true);
                                } else {
                                    this.game.setBlock(x + dx, y + dy, z + dz, 'wood', true);
                                }
                            }
                        }
                    } else {
                        // Interior Air
                        this.game.setBlock(x + dx, y + dy, z + dz, null, true);
                    }
                }
            }
        }

        // Furniture inside
        // Crafting Table
        this.game.setBlock(x + 1, y + 1, z + 3, 'crafting_table', true);

        // Bed (2 blocks)
        this.game.setBlock(x + 3, y + 1, z + 3, 'bed', true);
        this.game.setBlock(x + 3, y + 1, z + 2, 'bed', true);

        // Simple Table (wood block)
        this.game.setBlock(x + 1, y + 1, z + 1, 'wood', true);

        // Roof (Simple Pyramid)
        const roofHeight = 2; // Additional height
        for (let i = 0; i <= roofHeight; i++) {
            for (let dx = -1 + i; dx <= width - i; dx++) {
                for (let dz = -1 + i; dz <= depth - i; dz++) {
                    // Roof layer
                    this.game.setBlock(x + dx, y + height + 1 + i, z + dz, 'wood', true);
                }
            }
        }

        // Spawn Villager inside
        console.log(`Generated House at ${x},${y},${z}. Spawning Villager.`);
        try {
            const villager = new Villager(this.game, x + 2.5, y + 1, z + 2.5);
            this.game.animals.push(villager);
            this.game.scene.add(villager.mesh);
        } catch (e) {
            console.error("Failed to spawn villager:", e);
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
}

