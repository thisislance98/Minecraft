import * as THREE from 'three';
import { Animal } from '../Animal.js';

/**
 * CrystalElemental - A floating crystalline creature native to Crystal World
 * Hovers and emits prismatic light effects
 */
export class CrystalElemental extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 1.5;
        this.height = 2.0;
        this.depth = 1.5;

        this.gravity = 5.0; // Low gravity for floating
        this.speed = 1.0;
        this.isPassive = true;

        this.glowPhase = Math.random() * Math.PI * 2;

        this.createBody();
    }

    createBody() {
        // Crystal core
        const crystalMat = new THREE.MeshLambertMaterial({
            color: 0xCC88FF,
            transparent: true,
            opacity: 0.8
        });
        const glowMat = new THREE.MeshLambertMaterial({
            color: 0xFFAAFF,
            emissive: 0x8844AA,
            emissiveIntensity: 0.5
        });

        const coreGroup = new THREE.Group();
        coreGroup.position.set(0, 1.5, 0);
        this.mesh.add(coreGroup);
        this.coreGroup = coreGroup;

        // Main crystal body - octahedron shape using boxes
        const mainGeo = new THREE.BoxGeometry(0.8, 1.2, 0.8);
        const mainCrystal = new THREE.Mesh(mainGeo, crystalMat);
        mainCrystal.rotation.y = Math.PI / 4;
        coreGroup.add(mainCrystal);

        // Inner glow core
        const innerCore = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.4), glowMat);
        coreGroup.add(innerCore);
        this.innerCore = innerCore;

        // Floating crystal shards orbiting
        this.shards = [];
        for (let i = 0; i < 4; i++) {
            const shardGeo = new THREE.BoxGeometry(0.2, 0.5, 0.2);
            const shard = new THREE.Mesh(shardGeo, crystalMat);
            const angle = (i / 4) * Math.PI * 2;
            shard.position.set(Math.cos(angle) * 0.8, 0, Math.sin(angle) * 0.8);
            shard.rotation.set(Math.random(), Math.random(), Math.random());
            coreGroup.add(shard);
            this.shards.push({ mesh: shard, angle: angle, height: 0 });
        }
    }

    updateAnimation(dt) {
        this.glowPhase += dt * 2.0;

        // Pulse the inner core
        const pulseScale = 1.0 + Math.sin(this.glowPhase) * 0.2;
        this.innerCore.scale.set(pulseScale, pulseScale, pulseScale);

        // Rotate shards around the core
        for (let i = 0; i < this.shards.length; i++) {
            const shard = this.shards[i];
            shard.angle += dt * 1.5;
            shard.height = Math.sin(this.glowPhase + i) * 0.3;
            shard.mesh.position.set(
                Math.cos(shard.angle) * 0.8,
                shard.height,
                Math.sin(shard.angle) * 0.8
            );
            shard.mesh.rotation.y += dt;
        }

        // Float up and down
        this.coreGroup.position.y = 1.5 + Math.sin(this.glowPhase * 0.5) * 0.2;
    }
}
