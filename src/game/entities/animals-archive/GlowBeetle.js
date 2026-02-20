import * as THREE from 'three';
import { Animal } from '../Animal.js';

/**
 * GlowBeetle - A small glowing insectoid native to Crystal World
 * Crawls around and emits soft purple light
 */
export class GlowBeetle extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.6;
        this.height = 0.4;
        this.depth = 0.8;

        this.speed = 2.5;
        this.isPassive = true;

        this.glowPhase = Math.random() * Math.PI * 2;

        this.createBody();
    }

    createBody() {
        const shellMat = new THREE.MeshLambertMaterial({ color: 0x6633AA });
        const glowMat = new THREE.MeshLambertMaterial({
            color: 0xCC88FF,
            emissive: 0xAA66FF,
            emissiveIntensity: 0.6
        });
        const legMat = new THREE.MeshLambertMaterial({ color: 0x442266 });

        const bodyGroup = new THREE.Group();
        bodyGroup.position.set(0, 0.3, 0);
        this.mesh.add(bodyGroup);
        this.bodyGroup = bodyGroup;

        // Shell (back)
        const shellGeo = new THREE.BoxGeometry(0.5, 0.25, 0.7);
        const shell = new THREE.Mesh(shellGeo, shellMat);
        shell.position.set(0, 0.1, 0);
        bodyGroup.add(shell);

        // Glowing abdomen
        const abdomenGeo = new THREE.BoxGeometry(0.4, 0.2, 0.3);
        const abdomen = new THREE.Mesh(abdomenGeo, glowMat);
        abdomen.position.set(0, 0.05, 0.35);
        bodyGroup.add(abdomen);
        this.abdomen = abdomen;

        // Head
        const headGeo = new THREE.BoxGeometry(0.3, 0.2, 0.2);
        const head = new THREE.Mesh(headGeo, shellMat);
        head.position.set(0, 0.05, -0.4);
        bodyGroup.add(head);

        // Antennae
        const antennaGeo = new THREE.BoxGeometry(0.02, 0.02, 0.15);
        const leftAntenna = new THREE.Mesh(antennaGeo, legMat);
        leftAntenna.position.set(-0.1, 0.15, -0.5);
        leftAntenna.rotation.x = -0.5;
        bodyGroup.add(leftAntenna);

        const rightAntenna = new THREE.Mesh(antennaGeo, legMat);
        rightAntenna.position.set(0.1, 0.15, -0.5);
        rightAntenna.rotation.x = -0.5;
        bodyGroup.add(rightAntenna);

        // Legs (6 legs)
        this.legs = [];
        const legGeo = new THREE.BoxGeometry(0.04, 0.15, 0.04);
        const legPositions = [
            [-0.25, -0.1, -0.2],
            [-0.28, -0.1, 0],
            [-0.25, -0.1, 0.2],
            [0.25, -0.1, -0.2],
            [0.28, -0.1, 0],
            [0.25, -0.1, 0.2],
        ];

        legPositions.forEach((pos, i) => {
            const leg = new THREE.Mesh(legGeo, legMat);
            leg.position.set(pos[0], pos[1], pos[2]);
            leg.rotation.z = pos[0] > 0 ? 0.5 : -0.5;
            bodyGroup.add(leg);
            this.legs.push(leg);
        });
    }

    updateAnimation(dt) {
        this.glowPhase += dt * 3.0;

        // Pulse glow
        const glowIntensity = 0.4 + Math.sin(this.glowPhase) * 0.3;
        this.abdomen.material.emissiveIntensity = glowIntensity;

        // Leg movement when walking
        if (this.isMoving) {
            this.animTime += dt * this.legSwingSpeed * 2;
            for (let i = 0; i < this.legs.length; i++) {
                const phase = (i % 2 === 0) ? 0 : Math.PI;
                this.legs[i].rotation.x = Math.sin(this.animTime + phase) * 0.4;
            }
        }
    }
}
