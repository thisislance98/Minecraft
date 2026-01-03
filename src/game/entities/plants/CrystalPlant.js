import * as THREE from 'three';
import { InteractivePlant } from './InteractivePlant.js';

export class CrystalPlant extends InteractivePlant {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);

        this.width = 0.8;
        this.height = 1.2;
        this.depth = 0.8;

        this.detectionRange = 5.0;

        this.createBody();

        this.baseColor = new THREE.Color(0x00bcd4); // Cyan
        this.activeColor = new THREE.Color(0xff00ff); // Magenta
        this.pulseTimer = 0;
    }

    createBody() {
        // Multiple jagged crystals
        this.crystals = [];
        const crystalMat = new THREE.MeshLambertMaterial({
            color: this.baseColor,
            emissive: 0x004455,
            emissiveIntensity: 0.2
        });

        const count = 5 + Math.floor(this.rng.next() * 3);

        for (let i = 0; i < count; i++) {
            const h = 0.5 + this.rng.next() * 0.7;
            const r = 0.1 + this.rng.next() * 0.1;
            const geo = new THREE.ConeGeometry(r, h, 4);
            const mesh = new THREE.Mesh(geo, crystalMat.clone()); // Clone to allow individual movement

            // Random tilt
            const angle = this.rng.next() * Math.PI * 2;
            const tilt = (Math.random() - 0.5) * 0.5;

            mesh.position.x = Math.sin(angle) * 0.2;
            mesh.position.z = Math.cos(angle) * 0.2;
            mesh.position.y = h / 2;

            mesh.rotation.x = tilt;
            mesh.rotation.z = tilt;
            mesh.rotation.y = angle;

            this.mesh.add(mesh);
            this.crystals.push(mesh);
        }
    }

    onUpdateActive(dt) {
        this.pulseTimer += dt * 5;

        // Pulse color
        const alpha = (Math.sin(this.pulseTimer) + 1) / 2; // 0 to 1
        const targetColor = this.activeColor;

        this.crystals.forEach(c => {
            c.material.color.lerpColors(this.baseColor, targetColor, alpha);
            c.material.emissiveIntensity = 0.5 + alpha * 0.5;
        });
    }

    updateAI(dt) {
        super.updateAI(dt);

        if (!this.isActive) {
            // Calm down
            this.crystals.forEach(c => {
                c.material.color.lerp(this.baseColor, dt);
                c.material.emissiveIntensity = THREE.MathUtils.lerp(c.material.emissiveIntensity, 0.2, dt);
            });
        }
    }
}
