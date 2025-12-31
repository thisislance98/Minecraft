
import { Blocks } from '../core/Blocks.js';
import * as THREE from 'three';

export class SpaceShipManager {
    constructor(game) {
        this.game = game;
        this.controlBlockPositions = []; // Array of Vectors
    }

    /**
     * Spawns a Large Starship Enterprise at the given position.
     * @param {THREE.Vector3} centerPos
     */
    spawnShip(centerPos) {
        const startX = Math.floor(centerPos.x);
        const startY = Math.floor(centerPos.y + 40); // Higher up due to size
        const startZ = Math.floor(centerPos.z);

        console.log(`[SpaceShip] Queuing LARGE Enterprise spawn at ${startX}, ${startY}, ${startZ}`);
        this.game.uiManager.addChatMessage('system', `Assembling Galaxy Class Starship at ${startX}, ${startY}, ${startZ}`);

        // Queue for block placements to avoid freezing the main thread
        const blockQueue = [];

        const place = (x, y, z, block) => {
            blockQueue.push({ x: startX + x, y: startY + y, z: startZ + z, block });
        };

        const placeAir = (x, y, z) => {
            blockQueue.push({ x: startX + x, y: startY + y, z: startZ + z, block: Blocks.AIR });
        }

        // --- 1. Saucer Section ---
        // Center: (0, 15, -25)
        const sY = 15;
        const sZ = -25;
        const sRad = 32;
        const sThick = 6;

        for (let x = -sRad; x <= sRad; x++) {
            for (let z = -sRad; z <= sRad; z++) {
                if (x * x + z * z <= sRad * sRad) {
                    for (let y = -sThick; y <= sThick; y++) {
                        const dist = (x * x) / (sRad * sRad) + (y * y) / (sThick * sThick) + (z * z) / (sRad * sRad);

                        if (dist <= 1.0) {
                            const localY = sY + y;
                            const localZ = sZ + z;

                            // Turbolift Shaft Check (Vertical air column at X=0, Z=-5 relative to ship center? 
                            // Wait, sZ is -25. -5 is relative to 0? 
                            // Let's align Turbolift at x=0, z = sZ + 10 = -15.
                            // This is near the back of the bridge.

                            // Shuttle Bay Cutout (Rear of Saucer)
                            // Z > sZ + 15, abs(x) < 8, y within deck range
                            const isShuttleBay = (localZ > sZ + 15 && Math.abs(x) < 8 && y > -2 && y < 3);

                            // Robust Hull Logic: Compute distance for an "inner ellipsoid" 
                            // that is 1 block smaller in all dimensions.
                            // If we are OUTSIDE this inner ellipsoid (but inside the outer one), we are Hull.
                            const innerRad = sRad - 2; // Make walls 2 blocks thick to be safe and avoid "thin" spots
                            const innerThick = sThick - 1;

                            // Avoid divide by zero if something is tiny (unlikely here)
                            const innerDist = (x * x) / (innerRad * innerRad) + (y * y) / (innerThick * innerThick) + (z * z) / (innerRad * innerRad);
                            const isHull = innerDist > 1.0;

                            if (isHull && !isShuttleBay) {
                                // Windows
                                if (Math.abs(y) <= 1 && (x * x + z * z > (sRad - 2) * (sRad - 2)) && x % 5 !== 0) {
                                    place(x, localY, localZ, Blocks.GLASS);
                                } else {
                                    place(x, localY, localZ, Blocks.ENTERPRISE_HULL);
                                }
                            } else {
                                // Interior
                                if (isShuttleBay) {
                                    // Open Air/Forcefield
                                    if (localZ === sZ + sRad - 1) {
                                        // Field at very back? Or just air.
                                    }

                                    // Floor of shuttle bay
                                    if (y === -2) {
                                        place(x, localY, localZ, Blocks.ENTERPRISE_FLOOR);
                                    } else {
                                        placeAir(x, localY, localZ);
                                    }
                                }
                                else {
                                    // Interior - Hollow (Air Only) to reduce block count
                                    placeAir(x, localY, localZ);
                                }
                            }
                        }
                    }
                }
            }
        }

        // --- 2. Bridge ---
        // Top of Saucer
        const bY = sY + sThick;
        const bRad = 6;
        for (let x = -bRad; x <= bRad; x++) {
            for (let z = -bRad; z <= bRad; z++) {
                for (let y = 0; y <= 4; y++) {
                    if (x * x + z * z <= bRad * bRad) {
                        const localY = bY + y;
                        const localZ = sZ + z;
                        const r = Math.sqrt(x * x + z * z);

                        if (r > bRad - 1 || y === 4) {
                            // Walls/Ceiling
                            if (z < -3 && y === 2 && Math.abs(x) < 3) {
                                place(x, localY, localZ, Blocks.ENTERPRISE_SCREEN); // Viewscreen
                            } else if (Math.abs(x) >= bRad - 1.5 && y === 1) {
                                place(x, localY, localZ, Blocks.ENTERPRISE_PANEL); // Side Panels
                            } else {
                                place(x, localY, localZ, Blocks.ENTERPRISE_HULL);
                            }
                        } else {
                            if (y === 0) {
                                place(x, localY, localZ, Blocks.ENTERPRISE_FLOOR);
                            } else {
                                placeAir(x, localY, localZ);
                            }
                        }
                    }
                }
            }
        }

        // Bridge Furniture
        // Captain's Chair (Center)
        place(0, bY + 1, sZ, Blocks.ENTERPRISE_CHAIR);

        // Helm/Navigation Console (Front)
        const consoleZ = sZ - 2;
        place(0, bY + 1, consoleZ, Blocks.ENTERPRISE_CONSOLE);
        this.controlBlockPositions.push(new THREE.Vector3(startX, startY + bY + 1, startZ + consoleZ));

        // Red Alert Light
        place(0, bY + 3, sZ, Blocks.TORCH);

        // --- 3. Engineering Hull ---
        const eY = -15;
        const eZStart = -10;
        const eZEnd = 50;
        const eRad = 10;

        for (let z = eZStart; z <= eZEnd; z++) {
            let r = eRad;
            if (z > eZEnd - 15) r = eRad * (1 - (z - (eZEnd - 15)) / 18);
            if (r < 1) r = 1;

            for (let x = -Math.ceil(r); x <= Math.ceil(r); x++) {
                for (let y = -Math.ceil(r); y <= Math.ceil(r); y++) {
                    if (x * x + y * y <= r * r) {
                        const localY = eY + y;

                        // Check if we overlap with Neck (Don't overwrite neck air with hull)
                        // This simple check might be enough

                        if (x * x + y * y > (r - 1.5) * (r - 1.5)) {
                            place(x, localY, z, Blocks.ENTERPRISE_HULL);
                        } else {
                            // Interior - Hollow
                            placeAir(x, localY, z);
                        }
                    }
                }
            }
        }

        // Deflector Dish
        for (let x = -8; x <= 8; x++) {
            for (let y = -8; y <= 8; y++) {
                if (x * x + y * y <= 64) {
                    let depth = Math.floor((x * x + y * y) / 20);
                    if (x * x + y * y < 16) {
                        place(x, eY + y, eZStart + depth - 1, Blocks.ENTERPRISE_DISH);
                    } else {
                        place(x, eY + y, eZStart + depth - 1, Blocks.ENTERPRISE_DISH_RING);
                    }
                }
            }
        }

        // --- 4. Neck ---
        const neckWidth = 6;
        const neckStartZ = sZ + 10; // -15
        const neckEndZ = eZStart + 5; // -5
        const neckBottomY = eY + eRad - 2; // -7
        const neckTopY = sY - sThick + 2; // 9

        for (let y = neckBottomY; y <= neckTopY; y++) {
            let t = (y - neckBottomY) / (neckTopY - neckBottomY);
            let zCenter = neckEndZ + t * (neckStartZ - neckEndZ);

            for (let zOffset = -8; zOffset <= 8; zOffset++) {
                let z = Math.floor(zCenter + zOffset);
                for (let x = -neckWidth / 2; x <= neckWidth / 2; x++) {
                    if (x === -neckWidth / 2 || x === neckWidth / 2 || zOffset === -8 || zOffset === 8) {
                        place(x, y, z, Blocks.ENTERPRISE_HULL);
                    } else {
                        placeAir(x, y, z);
                    }
                }
            }
        }

        // --- 5. Turbolift Shaft & Connectivity ---
        const shaftZ = -12; // In the neck/saucer overlap
        const shaftTopY = bY; // Up to bridge level? No slightly back of bridge.
        const shaftBotY = eY - 5; // Bottom of Eng

        for (let y = shaftBotY; y <= bY + 1; y++) {
            // Shaft Air
            placeAir(0, y, shaftZ);
            // Ladder
            place(0, y, shaftZ + 1, Blocks.LADDER);
        }

        // Corridor from Shaft to Bridge (on Deck 1 / Bridge Level)
        for (let z = shaftZ; z >= sZ; z--) {
            placeAir(0, bY, z);
            placeAir(0, bY + 1, z);
            placeAir(0, bY + 2, z); // Headroom
            // Floor if needed
            place(0, bY - 1, z, Blocks.ENTERPRISE_FLOOR);
        }

        // --- 6. Pylons & Nacelles ---
        const pZStart = 15;
        const pZEnd = 25;
        const pYStart = eY + 5;
        const pYEnd = sY + 5;
        const pXStart = eRad - 2;
        const pXEnd = 25;

        // Pylons
        for (let t = 0; t <= 1; t += 0.05) {
            let y = Math.floor(pYStart + t * (pYEnd - pYStart));
            let xAbs = Math.floor(pXStart + t * (pXEnd - pXStart));
            for (let z = pZStart; z <= pZEnd; z++) {
                place(-xAbs, y, z, Blocks.ENTERPRISE_HULL);
                place(-xAbs - 1, y, z, Blocks.ENTERPRISE_HULL);
                place(-xAbs, y + 1, z, Blocks.ENTERPRISE_HULL);
                place(xAbs, y, z, Blocks.ENTERPRISE_HULL);
                place(xAbs + 1, y, z, Blocks.ENTERPRISE_HULL);
                place(xAbs, y + 1, z, Blocks.ENTERPRISE_HULL);
            }
        }

        // Nacelles
        const nLen = 60;
        const nRad = 5;
        const nZ = 15;
        [pXEnd, -pXEnd].forEach(nX => {
            for (let z = nZ - nLen / 2; z <= nZ + nLen / 2; z++) {
                for (let x = -nRad; x <= nRad; x++) {
                    for (let y = -nRad; y <= nRad; y++) {
                        if (x * x + y * y <= nRad * nRad) {
                            if (z < nZ - nLen / 2 + 5) {
                                place(nX + x, pYEnd + y, z, Blocks.ENTERPRISE_NACELLE_FRONT);
                            }
                            else if (Math.abs(x) > nRad - 2) {
                                place(nX + x, pYEnd + y, z, Blocks.ENTERPRISE_NACELLE_SIDE);
                            }
                            else {
                                place(nX + x, pYEnd + y, z, Blocks.ENTERPRISE_HULL);
                            }
                        }
                    }
                }
            }
        });

        // Initialize Async Processor
        this.processQueue(blockQueue);
    }

    async processQueue(queue) {
        console.log(`[SpaceShip] Processing ${queue.length} blocks with time-slicing...`);
        // Use a time budget per frame (e.g., 5ms) to ensure 60fps
        const TIME_BUDGET_MS = 5;
        let index = 0;

        while (index < queue.length) {
            const start = performance.now();

            // Process as many as possible within the budget
            while (index < queue.length && performance.now() - start < TIME_BUDGET_MS) {
                const b = queue[index++];
                this.game.setBlock(b.x, b.y, b.z, b.block, true, true); // Skip mesh/broadcast for speed
            }

            // Batch update mesh/network occasionally or at end of frame
            // For now, let's just let the loop continue. 
            // We need to yield.

            // Force mesh update for potential chunks we touched every few frames? 
            // Or just rely on the fact that we yield?
            // SpaceShipManager typically spans many chunks.
            // Let's yield to next frame.
            await new Promise(resolve => requestAnimationFrame(resolve));
        }

        // Final cleanup / update
        this.game.updateChunks();
        console.log('[SpaceShip] Enterprise Refit complete.');
        this.game.soundManager.playSound('levelup');
    }

    handleBlockInteraction(x, y, z) {
        const isControl = this.controlBlockPositions.some(pos =>
            Math.round(pos.x) === Math.round(x) &&
            Math.round(pos.y) === Math.round(y) &&
            Math.round(pos.z) === Math.round(z)
        );

        if (isControl) {
            console.log('[SpaceShip] Control block activated!');
            this.game.uiManager.showSpaceShipControls(true);
            return true;
        }
        return false;
    }

    launchShip() {
        this.game.uiManager.addChatMessage('system', 'Captain, impulse engines at full power.');
        this.game.soundManager.playSound('rumble');
        setTimeout(() => {
            this.game.player.position.y += 3000;
            this.game.uiManager.addChatMessage('system', 'Entering High Orbit.');
        }, 3000);
    }

    hyperDrive() {
        this.game.uiManager.addChatMessage('system', 'Warp 9 Engaged!');
        const r = 2000;
        const x = (Math.random() - 0.5) * r;
        const z = (Math.random() - 0.5) * r;
        const y = this.game.worldGen.getTerrainHeight(x, z) + 150;
        this.game.player.position.set(x, y, z);
    }
}


