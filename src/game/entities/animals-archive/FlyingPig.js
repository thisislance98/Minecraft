import { Animal } from '../Animal.js';
import * as THREE from 'three';

export class FlyingPig extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.8;
        this.height = 0.8;
        this.depth = 1.2;
        this.speed = 3.0;
        this.createBody();
    }

    createBody() {
        const pinkMat = new THREE.MeshLambertMaterial({ color: 0xffc0cb });
        const wingMat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });

        // Body
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 1.2), pinkMat);
        body.position.y = 0.35;
        this.mesh.add(body);

        // Head
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), pinkMat);
        head.position.set(0, 0.4, 0.7);
        this.mesh.add(head);

        // Nose
        const noseMat = new THREE.MeshLambertMaterial({ color: 0xffb6c1 });
        const nose = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.1), noseMat);
        nose.position.set(0, 0.35, 1.05);
        this.mesh.add(nose);

        // Wings
        this.leftWing = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.4), wingMat);
        this.leftWing.position.set(0.6, 0.6, 0);
        this.mesh.add(this.leftWing);

        this.rightWing = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.4), wingMat);
        this.rightWing.position.set(-0.6, 0.6, 0);
        this.mesh.add(this.rightWing);
        
        // Legs
        const legGeo = new THREE.BoxGeometry(0.2, 0.4, 0.2);
        const legPositions = [
            [0.25, 0, 0.4], [-0.25, 0, 0.4],
            [0.25, 0, -0.4], [-0.25, 0, -0.4]
        ];
        legPositions.forEach(pos => {
            const leg = new THREE.Mesh(legGeo, pinkMat);
            leg.position.set(...pos);
            this.mesh.add(leg);
        });
    }

    updateAI(dt) {
        super.updateAI(dt);
        
        // Wing flapping animation
        const time = Date.now() * 0.01;
        if (this.leftWing && this.rightWing) {
            this.leftWing.rotation.z = Math.sin(time * 2) * 0.8;
            this.rightWing.rotation.z = -Math.sin(time * 2) * 0.8;
        }

        // Hovering effect
        if (this.velocity) {
            this.velocity.y += Math.sin(time) * 0.01 + 0.015;
            
            // Limit height or add a bit of lift
            if (this.y < 5) {
                this.velocity.y += 0.02;
            }
        }
    }
}
