import * as THREE from 'three';
import { Furniture } from './Furniture.js';

export class GameConsole extends Furniture {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.5;
        this.height = 1.0;
        this.depth = 0.5;
        this.dropItem = 'xbox';
    }

    createBody() {
        // Main console body (Series X style)
        const bodyGeo = new THREE.BoxGeometry(0.5, 0.9, 0.5);
        const bodyMat = new THREE.MeshPhongMaterial({ color: 0x1a1a1a });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.45;
        this.mesh.add(body);

        // Green glowing top vents
        const topGeo = new THREE.BoxGeometry(0.48, 0.05, 0.48);
        const topMat = new THREE.MeshPhongMaterial({ 
            color: 0x107c10, // Xbox green
            emissive: 0x107c10,
            emissiveIntensity: 0.5
        });
        const top = new THREE.Mesh(topGeo, topMat);
        top.position.y = 0.9;
        this.mesh.add(top);

        // Power button
        const buttonGeo = new THREE.CircleGeometry(0.03, 16);
        const buttonMat = new THREE.MeshPhongMaterial({ 
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 1.0
        });
        const button = new THREE.Mesh(buttonGeo, buttonMat);
        button.position.set(0, 0.75, 0.251);
        this.mesh.add(button);

        // Disk slot
        const slotGeo = new THREE.PlaneGeometry(0.2, 0.01);
        const slotMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const slot = new THREE.Mesh(slotGeo, slotMat);
        slot.position.set(-0.1, 0.2, 0.251);
        this.mesh.add(slot);

        // Cast shadows
        this.mesh.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
    }
}
