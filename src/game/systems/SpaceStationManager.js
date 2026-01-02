import * as THREE from 'three';
import { Blocks } from '../core/Blocks.js';
import { Chair } from '../entities/furniture/Chair.js';
import { CrewMember } from '../entities/animals/CrewMember.js';

/**
 * SpaceStationManager - Generates a rotating Ring Space Station
 * Design: Torus-shaped station orbiting opposite to the Enterprise
 */
export class SpaceStationManager {
    constructor(game) {
        this.game = game;
        this.controlBlockPositions = [];
        this.blockQueue = [];
    }

    /**
     * Spawn the ring station at the given center position
     * @param {THREE.Vector3} centerPos - World position to spawn at
     */
    spawnStation(centerPos) {
        const startX = Math.floor(centerPos.x);
        const startY = Math.floor(centerPos.y + 60); // Higher altitude for orbit
        const startZ = Math.floor(centerPos.z);

        console.log(`[SpaceStation] Queuing Ring Station spawn at ${startX}, ${startY}, ${startZ}`);
        this.game.uiManager.addChatMessage('system', `Assembling Ring Space Station at ${startX}, ${startY}, ${startZ}`);

        const blockQueue = [];

        const place = (x, y, z, block) => {
            blockQueue.push({ x: startX + x, y: startY + y, z: startZ + z, block });
        };

        const placeAir = (x, y, z) => {
            blockQueue.push({ x: startX + x, y: startY + y, z: startZ + z, block: Blocks.AIR });
        };

        // --- Ring Station Geometry ---
        // Main Ring (Torus): Major radius = 24, Minor radius = 6
        const majorRadius = 24;  // Distance from center to ring tube center
        const minorRadius = 6;   // Radius of the tube itself

        // Generate Torus shape
        for (let angle = 0; angle < Math.PI * 2; angle += 0.08) {
            const centerX = Math.cos(angle) * majorRadius;
            const centerZ = Math.sin(angle) * majorRadius;

            // Generate circular cross-section at this angle
            for (let tubeAngle = 0; tubeAngle < Math.PI * 2; tubeAngle += 0.3) {
                const localX = Math.cos(tubeAngle) * minorRadius;
                const localY = Math.sin(tubeAngle) * minorRadius;

                // Transform to world coords
                const wx = Math.floor(centerX + localX * Math.cos(angle));
                const wy = Math.floor(localY);
                const wz = Math.floor(centerZ + localX * Math.sin(angle));

                // Determine if this is hull or interior
                const distFromTubeCenter = Math.sqrt(localX * localX + localY * localY);

                if (distFromTubeCenter > minorRadius - 2) {
                    // Outer shell - HULL
                    // Windows periodically
                    if (Math.abs(localY) < 1 && Math.floor(angle * 10) % 3 === 0) {
                        place(wx, wy, wz, Blocks.STATION_WINDOW);
                    } else {
                        place(wx, wy, wz, Blocks.STATION_HULL);
                    }
                } else {
                    // Interior floor level
                    if (localY < -minorRadius + 3 && localY > -minorRadius + 1) {
                        place(wx, wy, wz, Blocks.STATION_FLOOR);
                    } else {
                        placeAir(wx, wy, wz);
                    }
                }
            }
        }

        // --- Central Hub (Spherical Core) ---
        const hubRadius = 10;
        for (let x = -hubRadius; x <= hubRadius; x++) {
            for (let y = -hubRadius; y <= hubRadius; y++) {
                for (let z = -hubRadius; z <= hubRadius; z++) {
                    const dist = Math.sqrt(x * x + y * y + z * z);
                    if (dist <= hubRadius) {
                        if (dist > hubRadius - 2) {
                            // Outer shell
                            place(x, y, z, Blocks.STATION_HULL);
                        } else if (y === -hubRadius + 3) {
                            // Floor
                            place(x, y, z, Blocks.STATION_FLOOR);
                        } else if (dist < 3) {
                            // Energy core at center
                            place(x, y, z, Blocks.STATION_CORE);
                        } else {
                            placeAir(x, y, z);
                        }
                    }
                }
            }
        }

        // --- Connecting Spokes (4 spokes from hub to ring) ---
        const spokeCount = 4;
        for (let i = 0; i < spokeCount; i++) {
            const angle = (i / spokeCount) * Math.PI * 2;
            const dirX = Math.cos(angle);
            const dirZ = Math.sin(angle);

            for (let d = hubRadius; d < majorRadius - minorRadius; d++) {
                const x = Math.floor(dirX * d);
                const z = Math.floor(dirZ * d);

                // Spoke corridor (3x3 tube)
                for (let sx = -1; sx <= 1; sx++) {
                    for (let sy = -1; sy <= 1; sy++) {
                        if (Math.abs(sx) === 1 || Math.abs(sy) === 1) {
                            place(x + sx, sy, z, Blocks.STATION_HULL);
                        } else {
                            placeAir(x + sx, sy, z);
                        }
                    }
                }
                // Floor in spoke
                place(x, -1, z, Blocks.STATION_FLOOR);
            }
        }

        // --- Control Room (in the hub) ---
        const controlY = -hubRadius + 4;

        // Control console
        place(0, controlY, -5, Blocks.STATION_CONSOLE);
        this.controlBlockPositions.push(new THREE.Vector3(startX, startY + controlY, startZ - 5));

        // Lights
        place(3, controlY + 3, 0, Blocks.STATION_LIGHT);
        place(-3, controlY + 3, 0, Blocks.STATION_LIGHT);
        place(0, controlY + 3, 3, Blocks.STATION_LIGHT);
        place(0, controlY + 3, -3, Blocks.STATION_LIGHT);

        // Initialize Async Processor
        this.startX = startX;
        this.startY = startY;
        this.startZ = startZ;
        this.hubFloorY = startY + controlY;
        this.processQueue(blockQueue);
    }

    async processQueue(queue) {
        console.log(`[SpaceStation] Processing ${queue.length} blocks with time-slicing...`);
        const TIME_BUDGET_MS = 5;
        let index = 0;

        while (index < queue.length) {
            const start = performance.now();

            while (index < queue.length && performance.now() - start < TIME_BUDGET_MS) {
                const b = queue[index++];
                this.game.setBlock(b.x, b.y, b.z, b.block, true, true);
            }

            await new Promise(resolve => requestAnimationFrame(resolve));
        }

        this.game.updateChunks();
        console.log('[SpaceStation] Ring Station assembly complete.');
        this.game.soundManager.playSound('levelup');

        // Spawn Station Crew in Hub
        this.spawnCrew();
    }

    spawnCrew() {
        const floorY = this.hubFloorY;

        // Commander (Center)
        const cmdChair = new Chair(this.game, this.startX, floorY, this.startZ);
        this.game.entities.push(cmdChair);
        this.game.scene.add(cmdChair.mesh);

        const commander = new CrewMember(this.game, this.startX, floorY, this.startZ);
        commander.uniformColor = 0x00BFFF; // Cyan uniform
        commander.createBody();
        this.game.animals.push(commander);
        this.game.scene.add(commander.mesh);
        commander.sitDown(this.startX, floorY, this.startZ);

        // Science Officer (Left)
        const sciX = this.startX - 3;
        const sciChair = new Chair(this.game, sciX, floorY, this.startZ);
        this.game.entities.push(sciChair);
        this.game.scene.add(sciChair.mesh);

        const scientist = new CrewMember(this.game, sciX, floorY, this.startZ);
        scientist.uniformColor = 0x3B82F6; // Blue uniform
        scientist.createBody();
        this.game.animals.push(scientist);
        this.game.scene.add(scientist.mesh);
        scientist.sitDown(sciX, floorY, this.startZ);

        // Engineer (Right)
        const engX = this.startX + 3;
        const engChair = new Chair(this.game, engX, floorY, this.startZ);
        this.game.entities.push(engChair);
        this.game.scene.add(engChair.mesh);

        const engineer = new CrewMember(this.game, engX, floorY, this.startZ);
        engineer.uniformColor = 0xF59E0B; // Amber uniform
        engineer.createBody();
        this.game.animals.push(engineer);
        this.game.scene.add(engineer.mesh);
        engineer.sitDown(engX, floorY, this.startZ);

        // Standing Guard (Back)
        const guard = new CrewMember(this.game, this.startX, floorY + 1, this.startZ + 4);
        guard.uniformColor = 0x10B981; // Green uniform
        guard.createBody();
        this.game.animals.push(guard);
        this.game.scene.add(guard.mesh);
    }

    handleBlockInteraction(x, y, z) {
        const isControl = this.controlBlockPositions.some(pos =>
            Math.round(pos.x) === Math.round(x) &&
            Math.round(pos.y) === Math.round(y) &&
            Math.round(pos.z) === Math.round(z)
        );

        if (isControl) {
            console.log('[SpaceStation] Control block activated!');
            this.game.uiManager.addChatMessage('system', 'Station Control Online. Welcome aboard.');
            return true;
        }
        return false;
    }

    /**
     * Teleport to another location (station unique feature)
     */
    teleport() {
        this.game.uiManager.addChatMessage('system', 'Initiating teleport sequence...');
        this.game.soundManager.playSound('teleport');
        setTimeout(() => {
            const r = 1500;
            const x = (Math.random() - 0.5) * r;
            const z = (Math.random() - 0.5) * r;
            const y = this.game.worldGen.getTerrainHeight(x, z) + 100;
            this.game.player.position.set(x, y, z);
            this.game.uiManager.addChatMessage('system', 'Teleport complete.');
        }, 2000);
    }
}
