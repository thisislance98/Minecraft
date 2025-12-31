
import * as THREE from 'three';
import { Animal } from '../Animal.js';
import { Blocks } from '../../core/Blocks.js';

export class ChristmasTree extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);

        // Hostile settings
        this.isHostile = true;
        this.detectionRange = 20.0;
        this.attackRange = 2.0; // Close enough for presents
        this.damage = 0; // Don't hurt, just kidnap
        this.speed = 3.5; // Slightly faster than normal

        // Dimensions
        this.width = 1.0;
        this.height = 3.0; // Tall tree
        this.depth = 1.0;

        // Stats
        this.health = 50; // Tough tree
    }

    createBody() {
        // Main Group
        // this.mesh is already a Group

        // 1. Trunk
        const trunkGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.8, 8);
        const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // Brown
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 0.4;
        this.mesh.add(trunk);

        // 2. Leaves (Cones)
        const leafMat = new THREE.MeshLambertMaterial({ color: 0x006400 }); // Dark Green

        // Bottom Tier
        const cone1 = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.5, 8), leafMat);
        cone1.position.y = 1.2;
        this.mesh.add(cone1);

        // Middle Tier
        const cone2 = new THREE.Mesh(new THREE.ConeGeometry(1.0, 1.2, 8), leafMat);
        cone2.position.y = 1.8;
        this.mesh.add(cone2);

        // Top Tier
        const cone3 = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.0, 8), leafMat);
        cone3.position.y = 2.4;
        this.mesh.add(cone3);

        // 3. Star on Top
        const starGeo = new THREE.OctahedronGeometry(0.3);
        const starMat = new THREE.MeshLambertMaterial({ color: 0xFFD700, emissive: 0x222200 }); // Gold
        const star = new THREE.Mesh(starGeo, starMat);
        star.position.y = 3.0;
        this.mesh.add(star);

        // 4. Presents (The "Grabbers")
        const presentGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);

        // Red Present
        const p1 = new THREE.Mesh(presentGeo, new THREE.MeshLambertMaterial({ color: 0xFF0000 }));
        p1.position.set(0.6, 0.2, 0.0);
        this.mesh.add(p1);

        // Blue Present
        const p2 = new THREE.Mesh(presentGeo, new THREE.MeshLambertMaterial({ color: 0x0000FF }));
        p2.position.set(-0.5, 0.2, 0.5);
        p2.rotation.y = 0.5;
        this.mesh.add(p2);

        // Gold Present
        const p3 = new THREE.Mesh(presentGeo, new THREE.MeshLambertMaterial({ color: 0xFFD700 }));
        p3.position.set(0.0, 0.2, -0.6);
        p3.rotation.y = -0.5;
        this.mesh.add(p3);

        // Animation parts (just for bobbing)
        this.bodyParts = [cone1, cone2, cone3];
    }

    attackPlayer(player) {
        // Override standard attack to trigger Escape Room
        if (this.game.escapeRoomManager && !this.game.escapeRoomManager.isActive) {
            console.log('[ChristmasTree] Presents are grabbing the player!');

            // Visual/Audio effect
            if (this.game.uiManager) {
                this.game.uiManager.addChatMessage('system', 'The Presents under the tree GRABBED YOU!');
                this.game.soundManager.playSound('teleport'); // Assuming teleport sound exists, or similar
            }

            // Start Escape Room Logic
            // Pass player position as center
            this.game.escapeRoomManager.start(player.position);

            // Teleport player slightly to center to ensure they are trapped inside
            // The Escape Room spawns AROUND the center, so player needs to be AT center.
            // But we should lift them up slightly so they don't clip into floor if terrain is uneven?
            // EscapeRoomManager spawns floor at y=0 relative to center (relative to player pos).

            // Despawn self or flee?
            // Let's despawn to avoid being stuck inside with the player
            this.health = 0;
            this.startDeath();
        }
    }

    updateAnimation(dt) {
        super.updateAnimation(dt);

        // Bobble the tree parts while walking
        if (this.isMoving) {
            this.animTime += dt * 10;
            const bob = Math.sin(this.animTime) * 0.05;

            // Wiggle rotation
            this.mesh.rotation.z = Math.sin(this.animTime * 0.5) * 0.05;
        } else {
            this.mesh.rotation.z = 0;
        }
    }
}
