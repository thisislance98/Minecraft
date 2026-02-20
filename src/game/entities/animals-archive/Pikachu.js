
import * as THREE from 'three';
import { Animal } from '../../Animal.js';

export class Pikachu extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 0.6;
        this.height = 0.8;
        this.depth = 0.6;
        this.type = 'Pikachu';
        
        console.log('Pikachu constructor called');
        this.createBody();
    }

    createBody() {
        console.log('Pikachu createBody called');
        const yellow = 0xFFEE00;
        const black = 0x000000;
        const red = 0xFF0000;
        const brown = 0x8B4513;

        const yellowMat = new THREE.MeshLambertMaterial({ color: yellow });
        const blackMat = new THREE.MeshLambertMaterial({ color: black });
        const redMat = new THREE.MeshLambertMaterial({ color: red });
        const brownMat = new THREE.MeshLambertMaterial({ color: brown });

        // Head
        const headGroup = new THREE.Group();
        headGroup.position.y = 0.6;
        
        const headGeo = new THREE.BoxGeometry(0.5, 0.45, 0.4);
        const head = new THREE.Mesh(headGeo, yellowMat);
        headGroup.add(head);

        // Ears (Left)
        const earL = new THREE.Group();
        earL.position.set(-0.2, 0.2, 0);
        earL.rotation.z = 0.3;
        
        const earBaseL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.05), yellowMat);
        earBaseL.position.y = 0.15;
        earL.add(earBaseL);
        
        const earTipL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.05), blackMat);
        earTipL.position.y = 0.35;
        earL.add(earTipL);
        headGroup.add(earL);

        // Ears (Right)
        const earR = new THREE.Group();
        earR.position.set(0.2, 0.2, 0);
        earR.rotation.z = -0.3;
        
        const earBaseR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.05), yellowMat);
        earBaseR.position.y = 0.15;
        earR.add(earBaseR);
        
        const earTipR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.05), blackMat);
        earTipR.position.y = 0.35;
        earR.add(earTipR);
        headGroup.add(earR);

        // Cheeks
        const cheekGeo = new THREE.BoxGeometry(0.1, 0.1, 0.02);
        const cheekL = new THREE.Mesh(cheekGeo, redMat);
        cheekL.position.set(-0.2, -0.1, 0.21);
        headGroup.add(cheekL);
        
        const cheekR = new THREE.Mesh(cheekGeo, redMat);
        cheekR.position.set(0.2, -0.1, 0.21);
        headGroup.add(cheekR);

        // Eyes (Standard)
        const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.02);
        const eyeMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-0.12, 0.05, 0.21);
        const whiteDot = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03), new THREE.MeshLambertMaterial({ color: 0xFFFFFF }));
        whiteDot.position.set(-0.02, 0.02, 0.02);
        eyeL.add(whiteDot);
        headGroup.add(eyeL);

        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(0.12, 0.05, 0.21);
        const whiteDotR = whiteDot.clone();
        eyeR.add(whiteDotR);
        headGroup.add(eyeR);

        this.mesh.add(headGroup);

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.45, 0.5, 0.35);
        const body = new THREE.Mesh(bodyGeo, yellowMat);
        body.position.y = 0.25;
        this.mesh.add(body);
        
        // Brown stripes on back
        const stripe1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.02), brownMat);
        stripe1.position.set(0, 0.35, -0.18);
        this.mesh.add(stripe1);
        const stripe2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.02), brownMat);
        stripe2.position.set(0, 0.20, -0.18);
        this.mesh.add(stripe2);

        // Tail (Lightning Bolt)
        const tailGroup = new THREE.Group();
        tailGroup.position.set(0, 0.2, -0.18);
        
        const tailSeg1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.05), brownMat); // Brown base
        tailSeg1.position.set(0, 0.1, 0);
        tailSeg1.rotation.z = 0.4;
        tailGroup.add(tailSeg1);
        
        const tailSeg2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.05), yellowMat);
        tailSeg2.position.set(-0.1, 0.3, 0);
        tailSeg2.rotation.z = -0.4;
        tailGroup.add(tailSeg2);
        
        const tailSeg3 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.05), yellowMat);
        tailSeg3.position.set(0, 0.55, 0);
        tailSeg3.rotation.z = 0.4;
        tailGroup.add(tailSeg3);

        this.mesh.add(tailGroup);
        this.tail = tailGroup; // Save for animation

        // Legs (Stubby)
        const legGeo = new THREE.BoxGeometry(0.12, 0.15, 0.15);
        const legFL = new THREE.Mesh(legGeo, yellowMat);
        legFL.position.set(-0.15, 0.075, 0.1);
        this.mesh.add(legFL);
        
        const legFR = new THREE.Mesh(legGeo, yellowMat);
        legFR.position.set(0.15, 0.075, 0.1);
        this.mesh.add(legFR);
        
        const legBL = new THREE.Mesh(legGeo, yellowMat);
        legBL.position.set(-0.15, 0.075, -0.1);
        this.mesh.add(legBL);
        
        const legBR = new THREE.Mesh(legGeo, yellowMat);
        legBR.position.set(0.15, 0.075, -0.1);
        this.mesh.add(legBR);
    }

    updateAI(dt) {
        // Follow Player logic
        const player = this.game.player;
        if (player) {
            const followDistance = 2.5;
            const maxRange = 30.0;
            const distSq = this.position.distanceToSquared(player.position);

            if (distSq > maxRange * maxRange) {
                // Teleport
                this.position.copy(player.position);
                this.position.x += (Math.random() - 0.5) * 4;
                this.position.z += (Math.random() - 0.5) * 4;
            } else if (distSq > followDistance * followDistance) {
                // Move
                const dir = new THREE.Vector3().subVectors(player.position, this.position);
                dir.normalize();
                this.moveDirection.copy(dir);
                this.rotation = Math.atan2(dir.x, dir.z);
                this.isMoving = true;
                
                // Hop occasionally when moving
                if (this.onGround && Math.random() < 0.05) {
                    this.velocity.y = 5.0;
                }
            } else {
                // Idle
                this.isMoving = false;
                const dx = player.position.x - this.position.x;
                const dz = player.position.z - this.position.z;
                this.rotation = Math.atan2(dx, dz);
                
                // Random idle hop
                if (this.onGround && Math.random() < 0.01) {
                    this.velocity.y = 4.0;
                }
            }
        }
        
        super.updateAI(dt);
    }
}
