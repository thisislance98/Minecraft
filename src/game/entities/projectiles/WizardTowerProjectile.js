
import * as THREE from 'three';
import { TargetedFloatingBlock } from '../TargetedFloatingBlock.js';

export class WizardTowerProjectile {
    constructor(game, position, velocity) {
        this.game = game;
        this.position = position.clone();
        this.velocity = velocity.clone();

        this.speed = 25.0;
        this.velocity.normalize().multiplyScalar(this.speed);

        this.lifeTime = 0;
        this.maxLifeTime = 5.0;
        this.hasExploded = false;

        this.mesh = this.createMesh();
        this.mesh.position.copy(this.position);
    }

    createMesh() {
        const group = new THREE.Group();
        const geometry = new THREE.SphereGeometry(0.3, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: 0x8A2BE2 }); // BlueViolet/Purple
        const sphere = new THREE.Mesh(geometry, material);
        group.add(sphere);
        return group;
    }

    update(dt) {
        this.lifeTime += dt;
        if (this.hasExploded) return false;
        if (this.lifeTime > this.maxLifeTime) return false;

        const moveStep = this.velocity.clone().multiplyScalar(dt);
        const nextPos = this.position.clone().add(moveStep);

        if (this.checkCollisions(nextPos)) {
            this.explode(this.position);
            return true;
        }

        this.position.copy(nextPos);
        this.mesh.position.copy(this.position);
        return true;
    }

    checkCollisions(nextPos) {
        const bx = Math.floor(nextPos.x);
        const by = Math.floor(nextPos.y);
        const bz = Math.floor(nextPos.z);
        const block = this.game.getBlock(bx, by, bz);
        if (block && block.type !== 'air' && block.type !== 'water') {
            return true;
        }
        return false;
    }

    explode(pos) {
        if (this.hasExploded) return;
        this.hasExploded = true;
        this.mesh.visible = false;

        console.log("Wizard Tower Projectile Impact!");

        // Center at integer coordinates
        const cx = Math.floor(pos.x);
        const cy = Math.floor(pos.y);
        const cz = Math.floor(pos.z);

        this.buildTower(cx, cy, cz);
    }

    buildTower(cx, cy, cz) {
        const blocks = [];

        // Dimensions
        const baseRadius = 5; // Bigger radius
        const shaftHeight = 18;
        const roomRadius = 7; // Even wider top room
        const roomHeight = 7;

        const blockMap = new Map();
        const addBlock = (x, y, z, type) => {
            blockMap.set(`${x},${y},${z}`, { x, y, z, type });
        };

        // --- SHAFT (Base to Top Room) ---
        for (let y = 0; y < shaftHeight; y++) {
            for (let x = -baseRadius; x <= baseRadius; x++) {
                for (let z = -baseRadius; z <= baseRadius; z++) {
                    const distSq = x * x + z * z;

                    if (distSq <= baseRadius * baseRadius + 1) { // Roundish
                        const isWall = distSq >= (baseRadius - 1) * (baseRadius - 1);

                        // Floor at bottom
                        if (y === 0) {
                            addBlock(x, y, z, 'stone');
                        }
                        // Walls
                        else if (isWall) {
                            // Windows in shaft
                            if (y % 6 === 3 && (Math.abs(x) <= 1 || Math.abs(z) <= 1)) {
                                addBlock(x, y, z, 'glass');
                            } else {
                                addBlock(x, y, z, 'stone_brick');
                            }
                        }
                    }
                }
            }
        }

        // --- ENTRANCE (Door) ---
        // Place door at +Z side
        // Door is 2 blocks high.
        addBlock(0, 1, baseRadius, 'door_closed');
        addBlock(0, 2, baseRadius, 'door_closed');

        // Clear entry
        addBlock(0, 1, baseRadius - 1, 'air');
        addBlock(0, 2, baseRadius - 1, 'air'); // Interior clearance

        // --- CONNECTED FLAT STAIRS ---
        // A wider, more standard staircase winding up.
        // Hugs the inner wall.
        // Radius of stairs approx baseRadius - 1.5
        // Needs a landing every now and then?
        // Or just a clean spiral with flat steps (slabs not available, use full blocks)

        let currentAngle = -Math.PI / 2; // Start near door (0,0, radius) is PI/2? 
        // Door is at (0, 0, baseRadius). Angle PI/2.
        // Start stairs at Angle PI (Back).

        const stairRadius = baseRadius - 2;
        const stepsPerCircle = Math.floor(2 * Math.PI * stairRadius); // Approx circumference
        // Simply: 1 block up for every N blocks lateral?

        // Continuous spiral
        for (let y = 1; y < shaftHeight; y++) {
            // For each Y level, we place a designated step or segment
            // To make it "flatter", maybe duplicate the step for a few blocks?
            // "Fat" stairs: 2x2 steps? or just long steps.

            // Let's do a step that is 2 blocks long before going up.
            // Angle increments

            // Logic: Calculate position for this height based on angle
            // But we want "connected".

            // Let's just do a dense spiral.
            // Angle increases by small amount per Y? 
            // If angle increases too fast, it's steep.
            // If angle increases slow, we need multiple blocks per Y. -> That's "flat" slope.
            // But we simulate by placing blocks at same Y around the circle.

            // Let's iterate angle instead of Y.

        }

        // Alternative Stair Loop
        let stairY = 1;
        let angle = Math.PI; // Start opposite door
        while (stairY < shaftHeight) {
            // Place a block at current angle/radius
            const sx = Math.round((baseRadius - 1.5) * Math.cos(angle));
            const sz = Math.round((baseRadius - 1.5) * Math.sin(angle));

            // Use 'planks' for stairs
            addBlock(sx, stairY, sz, 'planks');

            // Make it wider (inner rail)
            const sx2 = Math.round((baseRadius - 2.5) * Math.cos(angle));
            const sz2 = Math.round((baseRadius - 2.5) * Math.sin(angle));
            addBlock(sx2, stairY, sz2, 'planks');

            // Move along circle
            // Circumference C = 2 * PI * 3.5 ~= 22 blocks.
            // We want a slope of maybe 1/2 or 1/3 (rise/run).
            // So we step 2 or 3 times around before rising.

            // Increment angle
            angle += 0.4; // ~20 degrees

            // If we completed a "step" length, rise.
            // How to track step length?
            // Just rise every N iterations?
            // Let's rise based on angle progress.
            // 2PI / slope.

            // Let's just increment Y every 3 blocks placed?
            if (angle % 0.8 < 0.4) {
                // Rise
                stairY++;
            }
        }


        // --- TOP WIZARD ROOM ---
        const roomY = shaftHeight;

        // Floor Support (corbeling)
        // ...

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
                            addBlock(x, wy, z, 'planks');
                        }
                        // Walls
                        else if (isWall) {
                            // Large Windows
                            if (y >= 2 && y <= 4 && (Math.abs(x) <= 2 || Math.abs(z) <= 2)) {
                                addBlock(x, wy, z, 'glass');
                            } else {
                                addBlock(x, wy, z, 'stone_brick');
                            }
                        }
                        // Ceiling
                        else if (y === roomHeight - 1) {
                            // addBlock(x, wy, z, 'planks'); // Optional ceiling
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
                    addBlock(x, roofStart + y, z, 'planks');
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
                        addBlock(x, roomY + 1, z, 'bookshelf');
                        addBlock(x, roomY + 2, z, 'bookshelf');
                        addBlock(x, roomY + 3, z, 'bookshelf');
                    }
                }
            }
        }

        // Central Table
        addBlock(0, roomY + 1, 0, 'crafting_table');
        addBlock(0, roomY + 1, 1, 'gold_block');

        // Bed
        addBlock(4, roomY + 1, 0, 'bed');

        // Tapestry
        addBlock(-roomRadius + 2, roomY + 2, 0, 'tapestry');
        addBlock(-roomRadius + 2, roomY + 3, 0, 'tapestry');


        // --- FINALIZE BLOCKS ---
        const finalBlocks = Array.from(blockMap.values());

        // --- ANIMATION SPAWN ---
        if (this.game.targetedFloatingBlocks) {
            // Good
        } else {
            this.game.targetedFloatingBlocks = [];
        }

        finalBlocks.forEach((b, index) => {
            const targetPos = new THREE.Vector3(cx + b.x, cy + b.y, cz + b.z);

            // Start positions: rise from ground around the tower base
            const angle = Math.random() * Math.PI * 2;
            const r = 12 + Math.random() * 8; // Wider radius spawn
            const startX = cx + Math.cos(angle) * r;
            const startZ = cz + Math.sin(angle) * r;

            // Get terrain height there
            const startY = (this.game.worldGen ? this.game.worldGen.getTerrainHeight(startX, startZ) : cy) - 5;

            const startPos = new THREE.Vector3(startX, startY, startZ);

            const tfb = new TargetedFloatingBlock(this.game, startPos, targetPos, b.type);
            this.game.targetedFloatingBlocks.push(tfb);
            this.game.scene.add(tfb.mesh);
        });
    }
}
