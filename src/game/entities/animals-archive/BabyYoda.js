import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class BabyYoda extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.height = 0.6;
        this.width = 0.4;
        this.depth = 0.4;
        this.speed = 2.0;
        this.createBody();
        this.floatPhase = 0;
    }

    createBody() {
        // Robe Material (Brown)
        const robeMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        // Skin Material (Green)
        const skinMat = new THREE.MeshLambertMaterial({ color: 0x90EE90 });
        // Eye Material (Black)
        const eyeMat = new THREE.MeshLambertMaterial({ color: 0x000000 });

        // Body (Robe)
        const bodyGeo = new THREE.CylinderGeometry(0.15, 0.2, 0.4, 8);
        const body = new THREE.Mesh(bodyGeo, robeMat);
        body.position.y = 0.2; 
        this.mesh.add(body);
        this.bodyMesh = body;

        // Collar (Thick part of robe)
        const collarGeo = new THREE.TorusGeometry(0.16, 0.04, 8, 16);
        const collar = new THREE.Mesh(collarGeo, robeMat);
        collar.rotation.x = Math.PI / 2;
        collar.position.y = 0.15;
        body.add(collar);

        // Head
        const headGeo = new THREE.SphereGeometry(0.15, 16, 16);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.y = 0.25; 
        body.add(head);

        // Ears (Large & Pointy)
        const earGeo = new THREE.ConeGeometry(0.04, 0.35, 8);
        
        const leftEar = new THREE.Mesh(earGeo, skinMat);
        leftEar.rotation.z = Math.PI / 2.2;
        leftEar.position.set(-0.2, 0, 0);
        head.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, skinMat);
        rightEar.rotation.z = -Math.PI / 2.2;
        rightEar.position.set(0.2, 0, 0);
        head.add(rightEar);

        // Eyes (Big Black Eyes)
        const eyeGeo = new THREE.SphereGeometry(0.04, 8, 8);
        
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.06, 0.02, 0.12);
        head.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.06, 0.02, 0.12);
        head.add(rightEye);
        
        // Reflection in eyes (Tiny white dot)
        const reflectGeo = new THREE.SphereGeometry(0.01, 4, 4);
        const reflectMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
        
        const leftReflect = new THREE.Mesh(reflectGeo, reflectMat);
        leftReflect.position.set(-0.01, 0.01, 0.035);
        leftEye.add(leftReflect);
        
        const rightReflect = new THREE.Mesh(reflectGeo, reflectMat);
        rightReflect.position.set(-0.01, 0.01, 0.035);
        rightEye.add(rightReflect);
    }

    updateAI(dt) {
        // Bobbing animation
        this.floatPhase += dt * 3;
        if (this.bodyMesh) {
             this.bodyMesh.position.y = 0.2 + Math.sin(this.floatPhase) * 0.03;
             // Slight tilt when moving
             if (this.isMoving) {
                 this.bodyMesh.rotation.z = Math.sin(this.floatPhase * 2) * 0.05;
             } else {
                 this.bodyMesh.rotation.z = 0;
             }
        }

        const player = this.game.player;
        if (!player) {
            super.updateAI(dt);
            return;
        }

        const followDistance = 2.5;
        const maxRange = 40.0;
        const distSq = this.position.distanceToSquared(player.position);

        if (distSq > maxRange * maxRange) {
            // Teleport if too far
            this.position.copy(player.position);
            this.position.x += (Math.random() - 0.5) * 4;
            this.position.z += (Math.random() - 0.5) * 4;
            return;
        }

        if (distSq > followDistance * followDistance) {
            // Move towards player
            const dir = new THREE.Vector3().subVectors(player.position, this.position);
            dir.normalize();
            this.moveDirection.copy(dir);
            this.rotation = Math.atan2(dir.x, dir.z);
            this.isMoving = true;
        } else {
            // Stop and look
            this.isMoving = false;
            const dx = player.position.x - this.position.x;
            const dz = player.position.z - this.position.z;
            this.rotation = Math.atan2(dx, dz);
        }
    }
}
