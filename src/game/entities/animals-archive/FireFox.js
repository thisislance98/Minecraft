import * as THREE from 'three';
import { Animal } from '../Animal.js';
import { Blocks } from '../../core/Blocks.js';

export class FireFox extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.5;
        this.height = 0.6;
        this.depth = 1.2;
        this.speed = 5.5; // Faster than normal fox
        this.createBody();
        this.fireTimer = 0;
    }

    createBody() {
        // FireFox: Bright orange, red, and yellow accents
        const furColor = 0xFF4500; // OrangeRed
        const secondaryColor = 0xFF8C00; // DarkOrange
        const flameColor = 0xFFFF00; // Yellow
        const blackColor = 0x1A1A1A;

        const mat = new THREE.MeshLambertMaterial({ color: furColor });
        const secondMat = new THREE.MeshLambertMaterial({ color: secondaryColor });
        const flameMat = new THREE.MeshLambertMaterial({ color: flameColor });
        const blackMat = new THREE.MeshLambertMaterial({ color: blackColor });

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.5, 0.45, 1.0);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.5, 0);
        this.mesh.add(body);

        // Underbelly (darker orange)
        const bellyGeo = new THREE.BoxGeometry(0.4, 0.2, 0.6);
        const belly = new THREE.Mesh(bellyGeo, secondMat);
        belly.position.set(0, 0.35, 0);
        this.mesh.add(belly);

        // Neck/Chest
        const chestGeo = new THREE.BoxGeometry(0.48, 0.4, 0.3);
        const chest = new THREE.Mesh(chestGeo, mat);
        chest.position.set(0, 0.55, 0.4);
        this.mesh.add(chest);

        // Chest flame marking
        const bibGeo = new THREE.BoxGeometry(0.35, 0.3, 0.08);
        const bib = new THREE.Mesh(bibGeo, flameMat);
        bib.position.set(0, 0.45, 0.55);
        this.mesh.add(bib);

        // Head
        const headGeo = new THREE.BoxGeometry(0.4, 0.35, 0.45);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 0.75, 0.65);
        this.mesh.add(head);

        // Snout
        const snoutGeo = new THREE.BoxGeometry(0.2, 0.18, 0.35);
        const snout = new THREE.Mesh(snoutGeo, mat);
        snout.position.set(0, 0.68, 0.95);
        this.mesh.add(snout);

        // Nose
        const noseGeo = new THREE.BoxGeometry(0.1, 0.08, 0.05);
        const nose = new THREE.Mesh(noseGeo, blackMat);
        nose.position.set(0, 0.72, 1.14);
        this.mesh.add(nose);

        // Ears
        const earGeo = new THREE.BoxGeometry(0.12, 0.25, 0.08);
        const leftEar = new THREE.Mesh(earGeo, mat);
        leftEar.position.set(-0.12, 1.0, 0.6);
        leftEar.rotation.z = 0.15;
        this.mesh.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, mat);
        rightEar.position.set(0.12, 1.0, 0.6);
        rightEar.rotation.z = -0.15;
        this.mesh.add(rightEar);

        // Eyes (Glowy yellow)
        const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.05);
        const leftEye = new THREE.Mesh(eyeGeo, flameMat);
        leftEye.position.set(-0.12, 0.8, 0.88);
        this.mesh.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, flameMat);
        rightEye.position.set(0.12, 0.8, 0.88);
        this.mesh.add(rightEye);

        // Tail (Fluffy, looking like a flame)
        const tailGeo = new THREE.BoxGeometry(0.25, 0.25, 0.8);
        const tail = new THREE.Mesh(tailGeo, secondMat);
        tail.position.set(0, 0.6, -0.7);
        tail.rotation.x = 0.4;
        this.mesh.add(tail);

        // Tail tip (Yellow flame)
        const tailTipGeo = new THREE.BoxGeometry(0.2, 0.2, 0.3);
        const tailTip = new THREE.Mesh(tailTipGeo, flameMat);
        tailTip.position.set(0, 0.8, -1.1);
        tailTip.rotation.x = 0.4;
        this.mesh.add(tailTip);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.15, 0.4, 0.15);
        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.4, z);
            const leg = new THREE.Mesh(legGeo, mat);
            leg.position.set(0, -0.2, 0);
            pivot.add(leg);
            this.mesh.add(pivot);
            return pivot;
        };

        this.legParts = [
            makeLeg(-0.15, 0.35),
            makeLeg(0.15, 0.35),
            makeLeg(-0.15, -0.35),
            makeLeg(0.15, -0.35)
        ];
    }

    updateAI(dt) {
        super.updateAI(dt);

        // Leave a trail of fire
        this.fireTimer -= dt;
        if (this.fireTimer <= 0 && this.isMoving) {
            const bx = Math.floor(this.position.x);
            const by = Math.floor(this.position.y);
            const bz = Math.floor(this.position.z);

            // Check if the block at current position is air
            const currentBlock = this.game.getBlock(bx, by, bz);
            const type = (currentBlock && typeof currentBlock === 'object') ? currentBlock.type : currentBlock;
            
            if (!type || type === Blocks.AIR) {
                // Check if the block below is solid
                const belowBlock = this.game.getBlock(bx, by - 1, bz);
                const belowType = (belowBlock && typeof belowBlock === 'object') ? belowBlock.type : belowBlock;

                if (belowType && belowType !== Blocks.AIR && belowType !== Blocks.WATER && belowType !== Blocks.FIRE) {
                    this.game.setBlock(bx, by, bz, Blocks.FIRE);
                }
            }
            
            this.fireTimer = 0.3; // Place fire every 0.3 seconds while moving
        }
    }
}
