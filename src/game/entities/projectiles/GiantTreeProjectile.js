
import * as THREE from 'three';
import { Blocks } from '../../core/Blocks.js';

export class GiantTreeProjectile {
    constructor(game, position, velocity) {
        this.game = game;
        this.position = position.clone();
        this.velocity = velocity.clone();
        this.radius = 0.2;
        this.isDead = false;

        const geometry = new THREE.SphereGeometry(this.radius, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: 0x228B22 }); // Forest Green
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.game.scene.add(this.mesh);
    }

    update(deltaTime) {
        if (this.isDead) return;

        // Gravity
        this.velocity.y -= 9.8 * deltaTime;

        const nextPos = this.position.clone().add(this.velocity.clone().multiplyScalar(deltaTime));

        // Collision detection with world
        const block = this.game.getBlockWorld(nextPos.x, nextPos.y, nextPos.z);
        if (block && block !== Blocks.AIR) {
            this.onImpact(nextPos);
            this.isDead = true;
            return;
        }

        this.position.copy(nextPos);
        this.mesh.position.copy(this.position);

        // Max life
        if (this.position.y < -10 || this.position.length() > 2000) {
            this.isDead = true;
        }
    }

    onImpact(pos) {
        const x = Math.floor(pos.x);
        const y = Math.floor(pos.y);
        const z = Math.floor(pos.z);

        this.generateGiantTree(x, y, z);
        
        // Cleanup
        this.game.scene.remove(this.mesh);
        if (this.game.projectiles) {
            const index = this.game.projectiles.indexOf(this);
            if (index > -1) this.game.projectiles.splice(index, 1);
        }
    }

    generateGiantTree(x, y, z) {
        console.log(`Generating Giant Tree at ${x}, ${y}, ${z}`);
        
        const height = 15 + Math.floor(Math.random() * 10);
        const trunkRadius = 2 + Math.floor(Math.random() * 2);

        // Build Trunk
        for (let dy = 0; dy < height; dy++) {
            for (let dx = -trunkRadius; dx <= trunkRadius; dx++) {
                for (let dz = -trunkRadius; dz <= trunkRadius; dz++) {
                    // Make it round-ish
                    if (dx * dx + dz * dz <= trunkRadius * trunkRadius) {
                        this.game.setBlock(x + dx, y + dy, z + dz, Blocks.LOG, true, true);
                    }
                }
            }
        }

        // Build Canopy
        const canopyStartHeight = Math.floor(height * 0.6);
        const canopyRadius = trunkRadius + 4;

        for (let dy = canopyStartHeight; dy < height + 5; dy++) {
            const relativeY = dy - canopyStartHeight;
            const currentRadius = canopyRadius * (1 - relativeY / (height + 5 - canopyStartHeight + 2));
            
            for (let dx = -Math.ceil(currentRadius); dx <= Math.ceil(currentRadius); dx++) {
                for (let dz = -Math.ceil(currentRadius); dz <= Math.ceil(currentRadius); dz++) {
                    if (dx * dx + dz * dz <= currentRadius * currentRadius) {
                        const wx = x + dx;
                        const wy = y + dy;
                        const wz = z + dz;
                        
                        // Only place leaves if there's air
                        const existing = this.game.getBlockWorld(wx, wy, wz);
                        if (!existing || existing === Blocks.AIR) {
                            this.game.setBlock(wx, wy, wz, Blocks.LEAVES, true, true);
                        }
                    }
                }
            }
        }
        
        // Add some roots
        for (let dx = -trunkRadius - 2; dx <= trunkRadius + 2; dx++) {
            for (let dz = -trunkRadius - 2; dz <= trunkRadius + 2; dz++) {
                if (Math.random() < 0.3) {
                    const rootHeight = 1 + Math.floor(Math.random() * 3);
                    for (let dy = -2; dy < rootHeight; dy++) {
                        this.game.setBlock(x + dx, y + dy, z + dz, Blocks.LOG, true, true);
                    }
                }
            }
        }
    }
}
