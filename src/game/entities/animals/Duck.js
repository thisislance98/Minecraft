import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Duck extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.5;
        this.height = 0.6;
        this.depth = 0.6;
        this.speed = 2.5;
        this.createBody();
    }

    createBody() {
        // Mallard with detailed texture
        const textureLoader = new THREE.TextureLoader();

        // Load body texture
        const bodyTexture = textureLoader.load('textures/duck_body.png');
        const bodyColor = 0x8B4513;
        const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor, map: bodyTexture });

        // Load head texture
        const headTexture = textureLoader.load('textures/duck_head.png');
        const headColor = 0x006400;
        const headMat = new THREE.MeshLambertMaterial({ color: headColor, map: headTexture });

        // Load beak texture
        const beakTexture = textureLoader.load('textures/duck_beak.png');
        const beakColor = 0xFFD700;
        const beakMat = new THREE.MeshLambertMaterial({ color: beakColor, map: beakTexture });

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.4, 0.3, 0.6);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(0, 0.3, 0);
        this.mesh.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.2, 0.25, 0.2);
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.set(0, 0.6, 0.25);
        this.mesh.add(head);

        // Beak
        const beakGeo = new THREE.BoxGeometry(0.1, 0.05, 0.15);
        const beak = new THREE.Mesh(beakGeo, beakMat);
        beak.position.set(0, 0.58, 0.4);
        this.mesh.add(beak);

        // Wings
        const wingGeo = new THREE.BoxGeometry(0.1, 0.2, 0.4);
        const leftWing = new THREE.Mesh(wingGeo, bodyMat);
        leftWing.position.set(-0.22, 0.35, 0);
        this.mesh.add(leftWing);

        const rightWing = new THREE.Mesh(wingGeo, bodyMat);
        rightWing.position.set(0.22, 0.35, 0);
        this.mesh.add(rightWing);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.05, 0.2, 0.05);

        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.2, z); // Pivot at the top of the leg
            const leg = new THREE.Mesh(legGeo, beakMat);
            leg.position.set(0, -0.1, 0); // Offset leg relative to pivot
            pivot.add(leg);
            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.1, 0),
            makeLeg(0.1, 0)
        ];
    }

    updatePhysics(dt) {
        const pos = this.position;
        // Check for water
        const block = this.game.getBlock(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
        const blockBelow = this.game.getBlock(Math.floor(pos.x), Math.floor(pos.y - 0.5), Math.floor(pos.z));

        const inWater = (block && block.type === 'water');
        const onWater = (blockBelow && blockBelow.type === 'water');

        if (inWater || onWater) {
            const targetY = Math.floor(pos.y) + 0.8;

            if (inWater) {
                this.velocity.y += 15.0 * dt; // Buoyancy
            } else {
                if (pos.y > targetY) {
                    this.velocity.y -= 10.0 * dt;
                } else {
                    this.velocity.y += 5.0 * dt;
                }
            }

            this.velocity.y *= 0.8;

            if (this.state === 'walk') {
                this.position.x += this.moveDirection.x * this.speed * dt;
                this.position.z += this.moveDirection.z * this.speed * dt;
            }
            this.position.y += this.velocity.y * dt;

            // Simple collision to prevent going through walls while swimming
            if (this.checkSolid(pos.x, pos.y + 0.5, pos.z)) {
                this.velocity.x *= -1;
                this.velocity.z *= -1;
                this.moveDirection.x *= -1;
                this.moveDirection.z *= -1;
            }

        } else {
            super.updateWalkerPhysics(dt);
        }
    }
}
