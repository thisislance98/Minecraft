import * as THREE from 'three';
import { Blocks } from '../core/Blocks.js';

export class Vehicle {
    constructor(game, x, y, z, blocks) {
        this.game = game;
        this.position = new THREE.Vector3(x, y, z);
        this.blocks = blocks; // Array of {x, y, z, type} relative to center

        // Physics
        this.velocity = new THREE.Vector3();
        this.angularVelocity = new THREE.Vector3();
        this.rotation = new THREE.Quaternion();
        this.mass = blocks.length * 10; // Simple mass calc

        // Control
        this.driver = null;
        this.seats = []; // Array of relative positions
        this.thrusters = []; // Array of {pos, direction}

        // Visuals
        this.mesh = new THREE.Group();
        this.mesh.position.copy(this.position);
        this.constructMesh();

        this.game.scene.add(this.mesh);

        // Add to game entities (need to ensure Game/EntityManager supports this generic list)
        // For now, we'll need to manually hook update() until a proper registry exists
        if (!this.game.vehicles) this.game.vehicles = [];
        this.game.vehicles.push(this);

        this.isDead = false;
    }

    constructMesh() {
        const geometry = new THREE.BoxGeometry(1, 1, 1);

        for (const block of this.blocks) {
            // Material
            let material;
            const matIndices = this.game.assetManager.blockMaterialIndices[block.type];
            if (matIndices) {
                material = matIndices.map(idx => this.game.assetManager.materialArray[idx]);
            } else {
                material = new THREE.MeshBasicMaterial({ color: 0xCCCCCC });
            }

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(block.x, block.y, block.z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.mesh.add(mesh);

            // Register components
            if (block.type === Blocks.VEHICLE_SEAT) {
                this.seats.push(new THREE.Vector3(block.x, block.y + 0.5, block.z));
            }
            if (block.type === Blocks.THRUSTER) {
                // Assume thrusters push "forward" relative to their placement? 
                // Or just generic "This vehicle has thrust"
                // Let's assume standard layout: Facing -Z is forward
                this.thrusters.push({
                    pos: new THREE.Vector3(block.x, block.y, block.z),
                    force: 20.0
                });
            }
        }
    }

    update(dt) {
        if (this.isDead) return;

        // 1. Control Physics
        if (this.driver) {
            this.handleInput(dt);
        }

        // 2. Apply Physics
        // Gravity (reduced for "hover" feel or normal?)
        this.velocity.y -= 9.8 * dt * 0.5;

        // Drag
        this.velocity.multiplyScalar(0.98);
        this.angularVelocity.multiplyScalar(0.95);

        // Move
        this.position.add(this.velocity.clone().multiplyScalar(dt));

        // Collision (Ground only for now)
        // Simple raycast down or heightmap check?
        // Let's check center point for now against terrain height
        const chunk = this.game.worldToChunk(this.position.x, this.position.y, this.position.z);
        // We really need block-level collision.
        // Quick hack: Check if center block is inside a solid block
        const bx = Math.floor(this.position.x);
        const by = Math.floor(this.position.y);
        const bz = Math.floor(this.position.z);
        const block = this.game.getBlock(bx, by, bz);

        if (block && block !== Blocks.AIR && block !== Blocks.WATER) {
            // Bounce / Stop
            this.position.y = Math.floor(this.position.y) + 1.0;
            this.velocity.y = Math.max(0, -this.velocity.y * 0.5);
            this.velocity.x *= 0.5;
            this.velocity.z *= 0.5;
        }

        // Update Mesh
        this.mesh.position.copy(this.position);

        // Sync Driver
        if (this.driver) {
            this.updateDriverPosition();
        }
    }

    handleInput(dt) {
        const input = this.game.inputManager; // Need access to keys
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.mesh.quaternion);
        const up = new THREE.Vector3(0, 1, 0);

        // W/S - Forward/Back
        if (input.keys['w']) {
            this.velocity.add(forward.clone().multiplyScalar(10 * dt));
        }
        if (input.keys['s']) {
            this.velocity.add(forward.clone().multiplyScalar(-5 * dt));
        }

        // Space/Shift - Up/Down
        if (input.keys[' ']) {
            this.velocity.y += 15 * dt;
        }
        if (input.keys['Shift']) {
            // Dismount if held? Or Down?
            // For now, let's use 'Shift' as Down/Brake, need separate key for dismount?
            // Or 'E' to interact/dismount?
            this.velocity.y -= 10 * dt;
        }

        // A/D - Turn (Yaw)
        if (input.keys['a']) {
            this.mesh.rotation.y += 2.0 * dt;
        }
        if (input.keys['d']) {
            this.mesh.rotation.y -= 2.0 * dt;
        }
    }

    updateDriverPosition() {
        if (!this.driver || this.seats.length === 0) return;

        // Use first seat
        const seatOffset = this.seats[0].clone();
        seatOffset.applyQuaternion(this.mesh.quaternion);
        const seatPos = this.position.clone().add(seatOffset);

        this.driver.position.copy(seatPos);
        this.driver.velocity.set(0, 0, 0); // Lock velocity
    }

    mount(player) {
        if (this.driver) return; // Already occupied
        this.driver = player;
        player.isDriving = true; // Flag for InputManager to ignore standard move
        player.vehicle = this;

        console.log("Player mounted vehicle");
    }

    dismount() {
        if (!this.driver) return;
        const player = this.driver;
        player.isDriving = false;
        player.vehicle = null;

        // Offset player slightly so they don't clip
        player.position.y += 1.0;
        player.velocity.y = 5.0; // Jump off

        this.driver = null;
        console.log("Player dismounted");
    }

    /**
     * Static method to assemble a vehicle from a Helm block.
     * @param {Game} game 
     * @param {number} x World X of Helm
     * @param {number} y World Y of Helm
     * @param {number} z World Z of Helm
     */
    static assemble(game, x, y, z) {
        console.log(`Assembling vehicle at ${x}, ${y}, ${z}`);

        // BFS to find connected blocks
        const touched = new Set();
        const queue = [{ x, y, z }];
        const blocks = [];
        const key = (a, b, c) => `${a},${b},${c}`;

        touched.add(key(x, y, z));

        // center of the vehicle (Helm position)
        const origin = new THREE.Vector3(x, y, z);

        let minX = x, minY = y, minZ = z;
        let maxX = x, maxY = y, maxZ = z;

        // Limit size
        let count = 0;
        const MAX_BLOCKS = 100;

        const validBlocks = [
            Blocks.VEHICLE_HELM,
            Blocks.VEHICLE_SEAT,
            Blocks.THRUSTER,
            Blocks.PLANKS,
            Blocks.IRON_BARS,
            Blocks.GLASS
        ]; // Allow some structure blocks

        while (queue.length > 0 && count < MAX_BLOCKS) {
            const curr = queue.shift();
            const type = game.getBlockWorld(curr.x, curr.y, curr.z);

            // Record block relative to helm
            // Actually, we should probably center the vehicle better later, 
            // but Helm-centric is easiest for now.
            blocks.push({
                x: curr.x - x,
                y: curr.y - y,
                z: curr.z - z,
                type: type
            });

            // Remove from world
            game.setBlock(curr.x, curr.y, curr.z, Blocks.AIR);

            count++;

            // Neighbors
            const dirs = [
                { x: 1, y: 0, z: 0 }, {- 1, 0, 0},
        { 0, 1, 0 }, { 0, -1, 0 },
        { 0, 0, 1 }, { 0, 0, -1 }
            ];

        for (const d of dirs) {
            const nx = curr.x + d.x;
            const ny = curr.y + d.y;
            const nz = curr.z + d.z;
            const k = key(nx, ny, nz);

            if (!touched.has(k)) {
                const nType = game.getBlockWorld(nx, ny, nz);
                if (nType && nType !== Blocks.AIR && nType !== Blocks.WATER) {
                    // Logic: Is this a vehicle part?
                    // For now allow any solid block essentialy? 
                    // Or strict list? Strict list is safer.
                    if (validBlocks.includes(nType) ||
                        nType === Blocks.LOG ||
                        nType === Blocks.WOOD) {
                        touched.add(k);
                        queue.push({ x: nx, y: ny, z: nz });
                    }
                }
            }
        }
    }
        
        game.updateChunks();

    // Spawn Entity
    const v = new Vehicle(game, x + 0.5, y + 0.5, z + 0.5, blocks);
        return v;
    }
}
