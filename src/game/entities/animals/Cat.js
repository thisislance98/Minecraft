import * as THREE from 'three';
import { Animal } from '../Animal.js';
import { Mouse } from './Mouse.js';
import { BirdManager } from './Birds.js';

export class Cat extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.5;
        this.height = 0.5;
        this.depth = 0.9;
        this.speed = 3.5;
        this.createBody();
        this.attackTimer = 0;
        this.meowTimer = Math.random() * 10 + 5;
    }

    createBody() {
        // Cat: Ginger/Orange tabby with white paws
        const gingerColor = 0xe67e22;
        const darkGinger = 0xd35400;
        const whiteColor = 0xffffff;
        const eyeColor = 0x2ecc71; // Green eyes
        const noseColor = 0xff9999; // Pink nose

        const mat = new THREE.MeshLambertMaterial({ color: gingerColor });
        const darkMat = new THREE.MeshLambertMaterial({ color: darkGinger });
        const whiteMat = new THREE.MeshLambertMaterial({ color: whiteColor });
        const eyeMat = new THREE.MeshLambertMaterial({ color: eyeColor });
        const noseMat = new THREE.MeshLambertMaterial({ color: noseColor });

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.4, 0.35, 0.8);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.4, 0);
        this.mesh.add(body);

        // Tabby stripes (simple boxes)
        const stripeGeo = new THREE.BoxGeometry(0.42, 0.05, 0.1);
        for (let i = -0.3; i <= 0.3; i += 0.2) {
            const stripe = new THREE.Mesh(stripeGeo, darkMat);
            stripe.position.set(0, 0.5, i);
            this.mesh.add(stripe);
        }

        // Head
        const headGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 0.6, 0.5);
        this.mesh.add(head);

        // Ears
        const earGeo = new THREE.BoxGeometry(0.1, 0.15, 0.05);
        const leftEar = new THREE.Mesh(earGeo, mat);
        leftEar.position.set(-0.12, 0.8, 0.45);
        leftEar.rotation.x = -0.2;
        this.mesh.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, mat);
        rightEar.position.set(0.12, 0.8, 0.45);
        rightEar.rotation.x = -0.2;
        this.mesh.add(rightEar);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.05);
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.1, 0.65, 0.66);
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.1, 0.65, 0.66);
        this.mesh.add(rightEye);

        // Nose
        const noseGeo = new THREE.BoxGeometry(0.06, 0.04, 0.05);
        const nose = new THREE.Mesh(noseGeo, noseMat);
        nose.position.set(0, 0.58, 0.68);
        this.mesh.add(nose);

        // Tail
        const tailGeo = new THREE.BoxGeometry(0.1, 0.1, 0.5);
        const tail = new THREE.Mesh(tailGeo, mat);
        tail.position.set(0, 0.5, -0.6);
        tail.rotation.x = 0.5;
        this.mesh.add(tail);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.12, 0.3, 0.12);
        const sockGeo = new THREE.BoxGeometry(0.13, 0.1, 0.13);

        const makeLeg = (x, z) => {
            const leg = new THREE.Mesh(legGeo, mat);
            leg.position.set(x, 0.15, z);
            this.mesh.add(leg);

            const sock = new THREE.Mesh(sockGeo, whiteMat);
            sock.position.set(x, 0.05, z);
            this.mesh.add(sock);

            return leg;
        };

        this.legParts = [
            makeLeg(-0.12, 0.25),
            makeLeg(0.12, 0.25),
            makeLeg(-0.12, -0.25),
            makeLeg(0.12, -0.25)
        ];
    }

    updateAI(dt) {
        // Cats hunt mice and birds
        const detectionRange = 12.0;
        const attackRange = 1.0;
        let target = null;
        let nearestDist = detectionRange * detectionRange;

        if (this.game.animals) {
            for (const animal of this.game.animals) {
                if ((animal instanceof Mouse || animal instanceof BirdManager) && !animal.isDead) {
                    const distSq = this.position.distanceToSquared(animal.position);
                    if (distSq < nearestDist) {
                        nearestDist = distSq;
                        target = animal;
                    }
                }
            }
        }

        if (target) {
            this.state = 'pounce';
            const dir = new THREE.Vector3().subVectors(target.position, this.position);
            const dist = dir.length();

            if (dist < attackRange) {
                if (this.attackTimer <= 0) {
                    target.takeDamage(10);
                    this.attackTimer = 1.0;
                    this.jump(); // Cats pounce!
                }
            } else {
                dir.normalize();
                this.moveDirection.copy(dir);
                this.rotation = Math.atan2(dir.x, dir.z);
                this.isMoving = true;
                this.speed = 5.0; // Run faster when chasing
            }
        } else {
            this.speed = 3.5;
            super.updateAI(dt);
        }

        if (this.attackTimer > 0) this.attackTimer -= dt;

        // Random meowing (visual/logic only for now as we don't have sound API in tool)
        this.meowTimer -= dt;
        if (this.meowTimer <= 0) {
            this.meowTimer = Math.random() * 15 + 10;
            // Potentially add a "Meow!" text bubble or jump
            this.jump();
        }
    }
}
