import * as THREE from 'three';
import { InteractivePlant } from './InteractivePlant.js';

export class ShyPlant extends InteractivePlant {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);

        this.width = 1.0;
        this.height = 1.0;
        this.depth = 1.0;

        this.detectionRange = 3.5;
        this.originalScale = 1.0;
        this.hidingScale = 0.2;

        this.createBody();
    }

    createBody() {
        // A flower that looks open
        this.flowerGroup = new THREE.Group();

        // Stem
        const stem = new THREE.Mesh(
            new THREE.CylinderGeometry(0.1, 0.1, 0.8),
            new THREE.MeshLambertMaterial({ color: 0x4caf50 })
        );
        stem.position.y = 0.4;
        this.flowerGroup.add(stem);

        // Petals (arranged in a circle)
        const petalGeo = new THREE.SphereGeometry(0.3, 8, 8);
        petalGeo.scale(1, 0.2, 1);
        const petalMat = new THREE.MeshLambertMaterial({ color: 0xe91e63 }); // Pink

        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const petal = new THREE.Mesh(petalGeo, petalMat);
            petal.position.set(Math.cos(angle) * 0.4, 0.8, Math.sin(angle) * 0.4);
            petal.rotation.x = 0.5; // Tilted out
            petal.rotation.y = -angle;
            this.flowerGroup.add(petal);
        }

        // Center
        const center = new THREE.Mesh(
            new THREE.SphereGeometry(0.25),
            new THREE.MeshLambertMaterial({ color: 0xffeb3b })
        );
        center.position.y = 0.85;
        this.flowerGroup.add(center);

        this.mesh.add(this.flowerGroup);
    }

    onActivate(player) {
        // Shrink triggers
    }

    onDeactivate() {
        // Grow triggers
    }

    onUpdateActive(dt) {
        // While active (player near), skrink towards hidingScale
        this.animateScale(dt, this.hidingScale);
    }

    updateAI(dt) {
        super.updateAI(dt);

        // If not active (player far), grow back
        if (!this.isActive) {
            this.animateScale(dt, this.originalScale);
        }
    }

    animateScale(dt, target) {
        const speed = 2.0;
        const current = this.mesh.scale.y;

        if (Math.abs(current - target) > 0.01) {
            let newScale = current;
            if (current < target) {
                newScale += dt * speed;
                if (newScale > target) newScale = target;
            } else {
                newScale -= dt * speed;
                if (newScale < target) newScale = target;
            }

            this.mesh.scale.setScalar(newScale);
            // Also sink slightly?
            // this.mesh.position.y = this.position.y - (1 - newScale) * 0.5;
        }
    }
}
