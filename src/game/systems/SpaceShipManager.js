import * as THREE from 'three';
import { Blocks } from '../core/Blocks.js';
import { Chair } from '../entities/furniture/Chair.js';
import { CrewMember } from '../entities/animals/CrewMember.js';

// Header
export class SpaceShipManager {
    constructor(game) {
        this.game = game;
        this.controlBlockPositions = [];
        this.blockQueue = [];

        // Orbital movement state
        this.orbitAngle = 0;
        this.orbitRadius = 2000; // Large orbit to encompass the whole world
        this.orbitHeight = 250;
        this.orbitSpeed = 0.05; // Radians per second (slow majestic orbit - full orbit in ~2 minutes)
        this.isOrbiting = false;

        // Ship parent group - move this to orbit all children smoothly
        this.shipGroup = new THREE.Group();
        game.scene.add(this.shipGroup);

        // Ship block tracking for orbital movement
        this.shipBlocks = [];
        this.currentX = 0;
        this.currentZ = 0;

        // Engine particle system
        this.engineParticles = null;
        this.particlePositions = [];
        this.particleVelocities = [];
        this.particleAges = [];
        this.maxParticles = 500;
    }

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
                                // Windows (using ENTERPRISE_SCREEN for orbital movement)
                                if (Math.abs(y) <= 1 && (x * x + z * z > (sRad - 2) * (sRad - 2)) && x % 5 !== 0) {
                                    place(x, localY, localZ, Blocks.ENTERPRISE_SCREEN);
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

        // Red Alert Light (use enterprise block so it orbits with ship)
        place(0, bY + 3, sZ, Blocks.ENTERPRISE_PANEL);

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
            // Access (use enterprise block for orbital movement)
            place(0, y, shaftZ + 1, Blocks.ENTERPRISE_FLOOR);
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
        console.log("PEEK");
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
        this.startX = startX;
        this.startY = startY;
        this.startZ = startZ;
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
                this.game.setBlock(b.x, b.y, b.z, b.block, true, true);

                // Track non-air blocks for orbital movement
                if (b.block !== Blocks.AIR) {
                    this.shipBlocks.push({ x: b.x, y: b.y, z: b.z, type: b.block });
                }
            }

            await new Promise(resolve => requestAnimationFrame(resolve));
        }

        // Final cleanup / update
        this.game.updateChunks();
        console.log('[SpaceShip] Enterprise Refit complete.');
        this.game.soundManager.playSound('levelup');

        // Initialize orbital state
        this.currentX = this.startX;
        this.currentZ = this.startZ;
        this.orbitAngle = Math.atan2(this.startZ, this.startX);
        this.orbitRadius = Math.sqrt(this.startX * this.startX + this.startZ * this.startZ) || 300;
        this.isOrbiting = true;
        console.log(`[SpaceShip] Orbital movement active. ${this.shipBlocks.length} blocks tracked.`);

        // Spawn Crew in Saucer Section (Main Control Room)
        // Saucer is centered at sY=15, sZ=-25, radius=32
        // We'll use the forward section of the saucer interior
        const saucerFloorY = this.startY + 14; // Interior floor level
        const saucerCenterZ = this.startZ - 25; // Center Z of saucer

        // Control room area: front of saucer, Z around -35 to -40
        const controlZ = saucerCenterZ - 10; // Forward in saucer

        // 1. Captain (Center)
        const capChair = new Chair(this.game, this.startX, saucerFloorY, controlZ);
        this.game.entities.push(capChair);
        this.shipGroup.add(capChair.mesh);

        const captain = new CrewMember(this.game, this.startX, saucerFloorY, controlZ);
        captain.uniformColor = 0xFFD700; // Gold
        captain.createBody();
        this.game.animals.push(captain);
        this.shipGroup.add(captain.mesh);
        captain.sitDown(this.startX, saucerFloorY, controlZ);

        // 2. Helm (Left Front)
        const helmX = this.startX - 4;
        const helmZ = controlZ - 3;
        const helmChair = new Chair(this.game, helmX, saucerFloorY, helmZ);
        helmChair.mesh.rotation.y = Math.PI / 6;
        this.game.entities.push(helmChair);
        this.shipGroup.add(helmChair.mesh);

        const helm = new CrewMember(this.game, helmX, saucerFloorY, helmZ);
        helm.uniformColor = 0xFF0000; // Red
        helm.createBody();
        this.game.animals.push(helm);
        this.shipGroup.add(helm.mesh);
        helm.sitDown(helmX, saucerFloorY, helmZ);
        helm.mesh.rotation.y = Math.PI / 6;

        // 3. Ops (Right Front)
        const opsX = this.startX + 4;
        const opsZ = controlZ - 3;
        const opsChair = new Chair(this.game, opsX, saucerFloorY, opsZ);
        opsChair.mesh.rotation.y = -Math.PI / 6;
        this.game.entities.push(opsChair);
        this.shipGroup.add(opsChair.mesh);

        const ops = new CrewMember(this.game, opsX, saucerFloorY, opsZ);
        ops.uniformColor = 0xFFD700; // Gold
        ops.createBody();
        this.game.animals.push(ops);
        this.shipGroup.add(ops.mesh);
        ops.sitDown(opsX, saucerFloorY, opsZ);
        ops.mesh.rotation.y = -Math.PI / 6;

        // 4. Tactical (Standing Back)
        const tacZ = controlZ + 5;
        const tactical = new CrewMember(this.game, this.startX, saucerFloorY + 1, tacZ);
        tactical.uniformColor = 0xFFD700; // Gold
        tactical.createBody();
        this.game.animals.push(tactical);
        this.shipGroup.add(tactical.mesh);

        // Add a control console in saucer section
        const consoleWorldX = this.startX;
        const consoleWorldY = this.startY + 14 + 1;
        const consoleWorldZ = this.startZ - 25 - 12; // Forward of crew
        this.game.setBlock(consoleWorldX, consoleWorldY, consoleWorldZ, Blocks.ENTERPRISE_CONSOLE);
        this.controlBlockPositions.push(new THREE.Vector3(consoleWorldX, consoleWorldY, consoleWorldZ));
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

    createEngineParticles() {
        // Create particle geometry
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.maxParticles * 3);
        const colors = new Float32Array(this.maxParticles * 3);
        const sizes = new Float32Array(this.maxParticles);

        for (let i = 0; i < this.maxParticles; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = -1000; // Start off-screen
            positions[i * 3 + 2] = 0;

            // Blue-white color for warp trail
            colors[i * 3] = 0.5 + Math.random() * 0.5;     // R
            colors[i * 3 + 1] = 0.7 + Math.random() * 0.3; // G
            colors[i * 3 + 2] = 1.0;                        // B

            sizes[i] = 1 + Math.random() * 2;

            this.particlePositions.push(new THREE.Vector3(0, -1000, 0));
            this.particleVelocities.push(new THREE.Vector3(0, 0, 0));
            this.particleAges.push(-1); // -1 = inactive
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const material = new THREE.PointsMaterial({
            size: 2,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.engineParticles = new THREE.Points(geometry, material);
        this.game.scene.add(this.engineParticles);
    }

    update(dt) {
        if (!this.isOrbiting) return;

        // Update orbit angle
        this.orbitAngle += this.orbitSpeed * dt;

        // Calculate orbital position
        const x = Math.cos(this.orbitAngle) * this.orbitRadius;
        const z = Math.sin(this.orbitAngle) * this.orbitRadius;

        // Move the entire ship group smoothly (this moves all children)
        this.shipGroup.position.x = x;
        this.shipGroup.position.z = z;
        this.shipGroup.position.y = this.orbitHeight;

        // Rotate to face direction of travel
        this.shipGroup.rotation.y = this.orbitAngle + Math.PI / 2;

        // Update tracked position
        this.currentX = x;
        this.currentZ = z;
    }

    updateEngineParticles(dt, shipX, shipZ) {
        if (!this.engineParticles) {
            this.createEngineParticles();
        }

        const positions = this.engineParticles.geometry.attributes.position.array;
        const sizes = this.engineParticles.geometry.attributes.size.array;

        // Nacelle positions relative to ship center (from spawnShip: pXEnd=25, pYEnd=sY+5=20, nZ=15)
        const nacelle1X = shipX + 25;
        const nacelle2X = shipX - 25;
        const nacelleY = this.orbitHeight + 20;
        const nacelleZ = shipZ + 45; // Back of nacelles

        // Direction ship is moving (tangent to orbit)
        const trailDirX = -Math.sin(this.orbitAngle);
        const trailDirZ = Math.cos(this.orbitAngle);

        // Update existing particles
        for (let i = 0; i < this.maxParticles; i++) {
            if (this.particleAges[i] >= 0) {
                this.particleAges[i] += dt;

                // Fade out and shrink over time
                if (this.particleAges[i] > 3) {
                    this.particleAges[i] = -1;
                    positions[i * 3 + 1] = -1000;
                } else {
                    // Move particle along trail
                    positions[i * 3] += this.particleVelocities[i].x * dt;
                    positions[i * 3 + 1] += this.particleVelocities[i].y * dt;
                    positions[i * 3 + 2] += this.particleVelocities[i].z * dt;

                    // Shrink over time
                    sizes[i] = Math.max(0.5, 2 - this.particleAges[i] * 0.5);
                }
            }
        }

        // Spawn new particles from each nacelle
        const spawnRate = 10; // particles per frame
        for (let n = 0; n < spawnRate; n++) {
            // Find inactive particle
            for (let i = 0; i < this.maxParticles; i++) {
                if (this.particleAges[i] < 0) {
                    // Spawn from random nacelle
                    const nacelleX = Math.random() < 0.5 ? nacelle1X : nacelle2X;

                    positions[i * 3] = nacelleX + (Math.random() - 0.5) * 3;
                    positions[i * 3 + 1] = nacelleY + (Math.random() - 0.5) * 3;
                    positions[i * 3 + 2] = nacelleZ + (Math.random() - 0.5) * 3;

                    // Velocity: trail behind the ship
                    this.particleVelocities[i].set(
                        trailDirX * 30 + (Math.random() - 0.5) * 5,
                        (Math.random() - 0.5) * 2,
                        trailDirZ * 30 + (Math.random() - 0.5) * 5
                    );

                    this.particleAges[i] = 0;
                    sizes[i] = 1.5 + Math.random();
                    break;
                }
            }
        }

        this.engineParticles.geometry.attributes.position.needsUpdate = true;
        this.engineParticles.geometry.attributes.size.needsUpdate = true;
    }
}


