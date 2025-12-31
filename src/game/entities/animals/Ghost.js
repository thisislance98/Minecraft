import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Ghost extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.8;
        this.height = 1.2;
        this.depth = 0.8;
        this.speed = 1.5;
        this.gravity = 0; // Floating
        
        this.createBody();
    }

    createBody() {
        // Clear default body
        while(this.mesh.children.length > 0){ 
            this.mesh.remove(this.mesh.children[0]); 
        }

        const ghostGroup = new THREE.Group();

        // Main body (semi-transparent white)
        const bodyMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xffffff, 
            transparent: true, 
            opacity: 0.6 
        });

        const bodyGeo = new THREE.BoxGeometry(0.7, 1.0, 0.7);
        const body = new THREE.Mesh(bodyGeo, bodyMaterial);
        body.position.y = 0.6;
        ghostGroup.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const head = new THREE.Mesh(headGeo, bodyMaterial);
        head.position.y = 1.3;
        ghostGroup.add(head);

        // Eyes (black)
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const eyeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);

        const leftEye = new THREE.Mesh(eyeGeo, eyeMaterial);
        leftEye.position.set(0.15, 1.35, 0.25);
        ghostGroup.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMaterial);
        rightEye.position.set(-0.15, 1.35, 0.25);
        ghostGroup.add(rightEye);

        // Tail bits at the bottom
        for (let i = 0; i < 4; i++) {
            const tailGeo = new THREE.BoxGeometry(0.15, 0.3, 0.15);
            const tail = new THREE.Mesh(tailGeo, bodyMaterial);
            tail.position.set(
                (Math.random() - 0.5) * 0.5,
                0.1,
                (Math.random() - 0.5) * 0.5
            );
            ghostGroup.add(tail);
        }

        this.mesh.add(ghostGroup);
        this.ghostGroup = ghostGroup;
    }

    updateAI(dt) {
        super.updateAI(dt);
        
        // Custom floating movement
        // Add a gentle bobbing motion
        const time = Date.now() * 0.002;
        this.velocity.y = Math.sin(time) * 0.1;
        
        // Occasionally "teleport" slightly or change transparency for ghost effect
        if (Math.random() < 0.01) {
            this.mesh.children.forEach(child => {
                if (child.material) {
                    child.material.opacity = 0.3 + Math.random() * 0.4;
                }
            });
        }
    }

    updateAnimation(dt) {
        // Ghosts don't walk, they glide.
        // We override updateAnimation to prevent leg swinging
        const time = Date.now() * 0.002;
        this.ghostGroup.position.y = Math.sin(time) * 0.1;
    }
}
