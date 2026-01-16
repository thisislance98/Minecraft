import * as THREE from 'three';
import { Animal } from './Animals.js';

export class Reindeer extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.7;
        this.height = 1.3;
        this.depth = 1.0;
        this.speed = 4.5;

        // Flight parameters
        this.isFlying = false;
        this.flightSpeed = 10.0;
        this.minHeight = 20;
        this.maxHeight = 60;
        this.flightTimer = 0;
        this.targetHeight = y + 30;

        this.createBody();
        this.mesh.scale.set(0.9, 0.9, 0.9);

        // Randomly decide if this one can fly immediately or waits
        this.state = 'walk';
    }

    createBody() {
        // Reindeer: Darker Brown than Deer
        const bodyColor = 0x5D4037; // Dark Brown
        const mat = new THREE.MeshLambertMaterial({ color: bodyColor });
        const lightMat = new THREE.MeshLambertMaterial({ color: 0xD7CCC8 }); // Light Tan for belly/details
        const darkMat = new THREE.MeshLambertMaterial({ color: 0x3E2723 }); // Dark for hooves/eyes
        const antlerMat = new THREE.MeshLambertMaterial({ color: 0x8D6E63 }); // Darker bone color
        const redNoseMat = new THREE.MeshLambertMaterial({ color: 0xFF0000 }); // Rudolph red

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.7, 0.6, 1.0);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 1.0, 0);
        this.mesh.add(body);

        // Chest/Neck base (slightly thicker)
        const chestGeo = new THREE.BoxGeometry(0.72, 0.65, 0.5);
        const chest = new THREE.Mesh(chestGeo, mat);
        chest.position.set(0, 1.02, 0.3);
        this.mesh.add(chest);

        // Neck
        const neckGeo = new THREE.BoxGeometry(0.35, 0.7, 0.35);
        const neck = new THREE.Mesh(neckGeo, mat);
        neck.position.set(0, 1.45, 0.6);
        neck.rotation.x = Math.PI / 8; // Angled forward
        this.mesh.add(neck);

        // Head
        const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.7);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 1.85, 0.85);
        this.mesh.add(head);

        // Ears
        const earGeo = new THREE.BoxGeometry(0.25, 0.15, 0.05);

        const leftEar = new THREE.Mesh(earGeo, mat);
        leftEar.position.set(-0.3, 2.0, 0.7);
        leftEar.rotation.z = 0.3;
        leftEar.rotation.y = -0.3;
        this.mesh.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, mat);
        rightEar.position.set(0.3, 2.0, 0.7);
        rightEar.rotation.z = -0.3;
        rightEar.rotation.y = 0.3;
        this.mesh.add(rightEar);

        // Antlers (Large and branching)
        const antlerStemGeo = new THREE.BoxGeometry(0.06, 0.7, 0.06);
        const antlerBranchGeo = new THREE.BoxGeometry(0.05, 0.4, 0.05);

        const makeAntler = (xDir) => {
            const group = new THREE.Group();
            group.position.set(xDir * 0.15, 2.05, 0.8);

            // Main stem - Curved back slightly
            const stem = new THREE.Mesh(antlerStemGeo, antlerMat);
            stem.rotation.z = xDir * 0.4;
            stem.rotation.x = -0.4; // Curve back more
            group.add(stem);

            // Branch 1 (Forward low)
            const b1 = new THREE.Mesh(antlerBranchGeo, antlerMat);
            b1.position.set(xDir * 0.1, 0.2, 0.1);
            b1.rotation.x = Math.PI / 3;
            group.add(b1);

            // Branch 2 (Upish middle)
            const b2 = new THREE.Mesh(antlerBranchGeo, antlerMat);
            b2.position.set(xDir * 0.2, 0.4, -0.1);
            b2.rotation.z = xDir * 0.6;
            group.add(b2);

            // Branch 3 (Back tip)
            const b3 = new THREE.Mesh(antlerBranchGeo, antlerMat);
            b3.position.set(xDir * 0.1, 0.6, -0.2);
            b3.rotation.x = -Math.PI / 4;
            group.add(b3);

            this.mesh.add(group);
        };

        makeAntler(1);
        makeAntler(-1);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);

        const leftEye = new THREE.Mesh(eyeGeo, darkMat);
        leftEye.position.set(-0.21, 1.9, 0.9);
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, darkMat);
        rightEye.position.set(0.21, 1.9, 0.9);
        this.mesh.add(rightEye);

        // Red Nose
        const noseGeo = new THREE.BoxGeometry(0.15, 0.12, 0.08);
        const nose = new THREE.Mesh(noseGeo, redNoseMat);
        nose.position.set(0, 1.75, 1.21);
        this.mesh.add(nose);
        this.nose = nose; // Store reference to flash it if we want

        // Tail
        const tailGeo = new THREE.BoxGeometry(0.15, 0.2, 0.1);
        const tail = new THREE.Mesh(tailGeo, lightMat);
        tail.position.set(0, 1.1, -0.5);
        tail.rotation.x = 0.5;
        this.mesh.add(tail);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.2, 0.9, 0.2);

        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.9, z);

            const leg = new THREE.Mesh(legGeo, mat);
            leg.position.set(0, -0.45, 0);
            pivot.add(leg);

            // Hoof
            const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.2), darkMat);
            hoof.position.set(0, -0.9, 0);
            pivot.add(hoof);

            this.mesh.add(pivot);
            return pivot;
        };

        // Store legs specifically for flight animation
        this.leftFront = makeLeg(-0.2, 0.35);
        this.rightFront = makeLeg(0.2, 0.35);
        this.leftBack = makeLeg(-0.2, -0.35);
        this.rightBack = makeLeg(0.2, -0.35);

        this.legParts = [this.leftFront, this.rightFront, this.leftBack, this.rightBack];
    }

    updateAI(dt) {
        if (this.isFlying) {
            this.updateFlightAI(dt);
        } else {
            this.updateGroundAI(dt);
        }
    }

    updateGroundAI(dt) {
        // Standard wander
        super.updateAI(dt);

        // Chance to take off
        if (Math.random() < 0.005) { // Small chance each frame
            this.takeOff();
        }
    }

    takeOff() {
        this.isFlying = true;
        this.velocity.y = 5.0; // Jump up
        this.state = 'fly';
        this.flightTimer = 30 + Math.random() * 60; // Fly for 30-90 seconds
        console.log("Reindeer taking off!");
    }

    land() {
        this.isFlying = false;
        this.state = 'idle';
        this.velocity.y = 0;
        this.onGround = true; // Assimilate back to ground physics
        console.log("Reindeer landing!");
    }

    updateFlightAI(dt) {
        this.flightTimer -= dt;

        // If timer up, try to land
        if (this.flightTimer <= 0) {
            // Find ground
            const groundY = this.game.worldGen.getTerrainHeight(this.position.x, this.position.z);
            const distToGround = this.position.y - groundY;

            if (distToGround < 2.0) {
                this.land();
                return;
            } else {
                // Dive down
                this.velocity.y = -5.0;
            }
        } else {
            // Fly around
            const targetY = this.game.player.position.y + 20; // Fly above player

            // Height regulation
            if (this.position.y < targetY) {
                this.velocity.y += 5.0 * dt;
            } else if (this.position.y > targetY + 10) {
                this.velocity.y -= 5.0 * dt;
            }

            // Move forward
            const speed = this.flightSpeed;

            // Steer vaguely towards player or wander
            // For now, keep momentum and steer slowly
            if (!this.moveDirection.lengthSq()) {
                this.moveDirection.set(1, 0, 0);
            }

            // Sometimes change direction
            if (Math.random() < 0.02) {
                const angle = (Math.random() - 0.5) * 2.0;
                this.moveDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
            }

            this.rotation = Math.atan2(this.moveDirection.x, this.moveDirection.z);
        }
    }

    updatePhysics(dt) {
        if (this.isFlying) {
            this.updateFlightPhysics(dt);
        } else {
            super.updatePhysics(dt);
        }
    }

    updateFlightPhysics(dt) {
        // Simple flight physics
        const pos = this.position;

        // Apply velocity
        const moveVec = this.moveDirection.clone().multiplyScalar(this.flightSpeed * dt);

        pos.add(moveVec);
        pos.y += this.velocity.y * dt;

        // Friction/Damping on Y
        this.velocity.y *= 0.95;

        // Bounds check
        if (pos.y > 100) pos.y = 100;

        // Ground collision (force land or crash)
        const groundHeight = this.game.worldGen.getTerrainHeight(pos.x, pos.z);
        if (pos.y < groundHeight) {
            pos.y = groundHeight;
            this.velocity.y = 0;
            if (this.flightTimer <= 0) {
                this.land();
            } else {
                // Bounce up if not trying to land
                this.velocity.y = 5.0;
            }
        }
    }

    updateAnimation(dt) {
        if (this.isFlying) {
            this.animTime += dt * 5;

            // "Gallop" in air
            const legAngle = Math.sin(this.animTime) * 0.5;

            // Front legs reach forward together
            this.leftFront.rotation.x = -1.0 + legAngle;
            this.rightFront.rotation.x = -1.0 + legAngle;

            // Back legs kick back
            this.leftBack.rotation.x = 1.0 + legAngle;
            this.rightBack.rotation.x = 1.0 + legAngle;

            // Nose flash?
            if (this.nose) {
                const flash = Math.sin(this.animTime * 5) * 0.5 + 0.5;
                this.nose.material.color.setHSL(0, 1, 0.5 + flash * 0.5); // Pulse brightness
            }
        } else {
            super.updateAnimation(dt);
            // Reset nose color
            if (this.nose) this.nose.material.color.setHex(0xFF0000);
        }
    }
}
