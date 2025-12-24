
import * as THREE from 'three';
import { TargetedFloatingBlock } from '../TargetedFloatingBlock.js';

export class GiantProjectile {
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
        const material = new THREE.MeshBasicMaterial({ color: 0x888888 }); // Grey Stone Color
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
            return true; // Keep alive for a frame to process explosion if needed, but usually return false or handle in manager
            // Actually projectile manager removes if false. 
            // We set hasExploded = true.
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

        console.log("Giant Projectile Impact!");

        // Center at integer coordinates
        const cx = Math.floor(pos.x);
        const cy = Math.floor(pos.y);
        const cz = Math.floor(pos.z);

        this.buildGiant(cx, cy, cz);
    }

    buildGiant(cx, cy, cz) {
        // Schematic (Relative offsets)
        // Simple Giant with Hammer
        // Material: Stone, Cobblestone, Iron Block (Hammer)

        const blocks = [];

        // --- LEGS ---
        // Left Leg
        blocks.push({ x: -1, y: 0, z: 0, type: 'stone' });
        blocks.push({ x: -1, y: 1, z: 0, type: 'stone' });
        blocks.push({ x: -1, y: 2, z: 0, type: 'stone' });

        // Right Leg
        blocks.push({ x: 1, y: 0, z: 0, type: 'stone' });
        blocks.push({ x: 1, y: 1, z: 0, type: 'stone' });
        blocks.push({ x: 1, y: 2, z: 0, type: 'stone' });

        // --- TORSO ---
        for (let y = 3; y <= 6; y++) {
            for (let x = -1; x <= 1; x++) {
                blocks.push({ x: x, y: y, z: 0, type: 'stone' });
            }
        }
        // Chest muscle/bulk
        blocks.push({ x: 0, y: 5, z: 1, type: 'stone' });

        // --- ARMS ---
        // Left Arm (Down)
        blocks.push({ x: -2, y: 6, z: 0, type: 'stone' });
        blocks.push({ x: -2, y: 5, z: 0, type: 'stone' });
        blocks.push({ x: -2, y: 4, z: 0, type: 'stone' });

        // Right Arm (Raised holding hammer) 
        blocks.push({ x: 2, y: 6, z: 0, type: 'stone' });
        blocks.push({ x: 2, y: 7, z: 0, type: 'stone' });
        blocks.push({ x: 3, y: 8, z: 0, type: 'stone' }); // Outwards

        // --- HEAD ---
        blocks.push({ x: 0, y: 7, z: 0, type: 'stone' });
        blocks.push({ x: 0, y: 8, z: 0, type: 'stone' });
        // Eyes
        // We can't do sub-block eyes easily without custom blocks, but we can set head.

        // --- HAMMER ---
        // Handle
        blocks.push({ x: 3, y: 9, z: 0, type: 'log' });
        blocks.push({ x: 3, y: 10, z: 0, type: 'log' });
        blocks.push({ x: 3, y: 11, z: 0, type: 'log' });

        // Head
        // Big block around 3,12,0
        for (let hx = 2; hx <= 4; hx++) {
            for (let hz = -1; hz <= 1; hz++) {
                for (let hy = 12; hy <= 13; hy++) {
                    blocks.push({ x: hx, y: hy, z: hz, type: 'stone_brick' }); // Or cobblestone
                }
            }
        }

        // --- SPAWN ANIMATION ---
        // Spawn Floating Blocks from ground up to target
        blocks.forEach((b, index) => {
            const targetPos = new THREE.Vector3(cx + b.x, cy + b.y, cz + b.z);

            // Random start pos near ground/impact
            const startX = cx + (Math.random() - 0.5) * 10;
            const startZ = cz + (Math.random() - 0.5) * 10;
            const startY = cy - 2; // From below ground? Or just on ground.

            // Let's make them rise from the earth around the point
            const startPos = new THREE.Vector3(startX, Math.max(cy, this.game.worldGen.getTerrainHeight(startX, startZ)), startZ);

            // Delay spawn? 
            // We can't easily delay inside this loop without a manager inside Projectile or Game.
            // But we can set the speed and distance such that they arrive.
            // Or just spawn all TargetedFloatingBlocks now.

            // VoxelGame needs a list for these.
            if (this.game.targetedFloatingBlocks) {
                const tfb = new TargetedFloatingBlock(this.game, startPos, targetPos, b.type);
                this.game.targetedFloatingBlocks.push(tfb);
                this.game.scene.add(tfb.mesh);
            } else {
                // Initializing list if missing (monkeypatching VoxelGame via instance)
                this.game.targetedFloatingBlocks = [];
                const tfb = new TargetedFloatingBlock(this.game, startPos, targetPos, b.type);
                this.game.targetedFloatingBlocks.push(tfb);
                this.game.scene.add(tfb.mesh);
            }
        });
    }
}
