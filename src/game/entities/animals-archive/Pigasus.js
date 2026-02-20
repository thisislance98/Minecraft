import { Animal } from '../Animal.js';

export class Pigasus extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        // Use window.THREE for safety
        this.width = 1.0;
        this.height = 1.0;
        this.depth = 1.2;
        this.speed = 3.0;
        this.wingAngle = 0;
        this.floatPhase = Math.random() * Math.PI * 2;
        
        if (window.THREE) {
            this.targetDir = new window.THREE.Vector3(1, 0, 0);
        } else {
             console.error('Pigasus: window.THREE is undefined!');
        }
        
        this.createBody();
    }

    createBody() {
        if (!window.THREE) return;
        const THREE = window.THREE;

        const pinkMat = new THREE.MeshLambertMaterial({ color: 0xF0ACBC });
        const darkPinkMat = new THREE.MeshLambertMaterial({ color: 0xE09CA0 });
        const whiteMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x000000 });

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.8, 0.7, 1.1);
        const body = new THREE.Mesh(bodyGeo, pinkMat);
        body.position.y = 1.0;
        this.mesh.add(body);

        // Head
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 1.2, 0.7);
        const headGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
        const head = new THREE.Mesh(headGeo, pinkMat);
        headGroup.add(head);

        // Snout
        const snoutGeo = new THREE.BoxGeometry(0.3, 0.2, 0.15);
        const snout = new THREE.Mesh(snoutGeo, darkPinkMat);
        snout.position.set(0, -0.1, 0.35);
        headGroup.add(snout);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.12, 0.12, 0.05);
        const pupilGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);

        const leftEye = new THREE.Mesh(eyeGeo, whiteMat);
        leftEye.position.set(-0.2, 0.1, 0.3);
        headGroup.add(leftEye);
        const leftPupil = new THREE.Mesh(pupilGeo, blackMat);
        leftPupil.position.set(-0.2, 0.1, 0.33);
        headGroup.add(leftPupil);

        const rightEye = new THREE.Mesh(eyeGeo, whiteMat);
        rightEye.position.set(0.2, 0.1, 0.3);
        headGroup.add(rightEye);
        const rightPupil = new THREE.Mesh(pupilGeo, blackMat);
        rightPupil.position.set(0.2, 0.1, 0.33);
        headGroup.add(rightPupil);

        this.mesh.add(headGroup);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.2, 0.4, 0.2);
        const legPositions = [
            [-0.3, 0.2, 0.4], [0.3, 0.2, 0.4],
            [-0.3, 0.2, -0.4], [0.3, 0.2, -0.4]
        ];
        this.legs = [];
        legPositions.forEach(pos => {
            const leg = new THREE.Mesh(legGeo, pinkMat);
            leg.position.set(...pos);
            this.mesh.add(leg);
            this.legs.push(leg);
        });

        // Wings
        this.wings = [];
        const wingGeo = new THREE.BoxGeometry(1.2, 0.1, 0.6);
        
        // Left Wing
        const leftWingGroup = new THREE.Group();
        leftWingGroup.position.set(-0.4, 1.4, 0);
        const leftWing = new THREE.Mesh(wingGeo, whiteMat);
        leftWing.position.set(-0.6, 0, 0); // Offset so it rotates from body
        leftWingGroup.add(leftWing);
        this.mesh.add(leftWingGroup);
        this.wings.push(leftWingGroup);

        // Right Wing
        const rightWingGroup = new THREE.Group();
        rightWingGroup.position.set(0.4, 1.4, 0);
        const rightWing = new THREE.Mesh(wingGeo, whiteMat);
        rightWing.position.set(0.6, 0, 0); // Offset so it rotates from body
        rightWingGroup.add(rightWing);
        this.mesh.add(rightWingGroup);
        this.wings.push(rightWingGroup);
    }

    updatePhysics(dt) {
        if (this.isMoving) {
            this.position.addScaledVector(this.moveDirection, this.speed * dt);
        }
        this.floatPhase += dt * 2;
        this.position.y += Math.sin(this.floatPhase) * 0.02;
    }

    updateAI(dt) {
        if (!this.wings) return;
        
        this.wingAngle += dt * 10;
        const flap = Math.sin(this.wingAngle) * 0.5;
        if (this.wings[0]) this.wings[0].rotation.z = flap;
        if (this.wings[1]) this.wings[1].rotation.z = -flap;

        if (this.legs) {
            this.legs.forEach((leg, i) => {
                leg.rotation.x = Math.sin(this.wingAngle * 0.5 + i) * 0.2;
            });
        }

        if (Math.random() < 0.02) {
            this.targetDir.set(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 2
            ).normalize();
            
            this.moveDirection.copy(this.targetDir);
            this.rotation = Math.atan2(this.targetDir.x, this.targetDir.z);
            this.isMoving = true;
        }
        super.updateAI(dt);
    }
}
