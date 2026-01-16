import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class DragonBoss extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 4.0;
        this.height = 4.0;
        this.depth = 12.0;
        this.speed = 3.5;
        this.isHostile = true;
        this.attackRange = 10.0;
        this.damage = 40;
        this.maxHealth = 500;
        this.health = 500;

        this.fireCooldown = 0;
        this.wingTimer = 0;

        this.createBody();
    }

    createBody() {
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0x880000 });
        const bellyMat = new THREE.MeshLambertMaterial({ color: 0xccaa44 });
        const hornMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
        const wingMat = new THREE.MeshLambertMaterial({ color: 0x660000, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });

        // Main Body
        const body = new THREE.Mesh(new THREE.BoxGeometry(3, 2.5, 6), bodyMat);
        body.position.y = 1.25;
        this.mesh.add(body);

        // Neck
        const neck = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 3), bodyMat);
        neck.position.set(0, 2.5, 4);
        neck.rotation.x = -Math.PI / 4;
        this.mesh.add(neck);

        // Head
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 3.5, 5.5);
        this.mesh.add(headGroup);

        const head = new THREE.Mesh(new THREE.BoxGeometry(2, 1.8, 3), bodyMat);
        headGroup.add(head);

        const snout = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 1.5), bodyMat);
        snout.position.z = 1.8;
        snout.position.y = -0.3;
        headGroup.add(snout);

        // Horns
        const lHorn = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.5, 0.3), hornMat);
        lHorn.position.set(0.6, 1.2, -0.5);
        lHorn.rotation.x = -Math.PI / 4;
        headGroup.add(lHorn);

        const rHorn = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.5, 0.3), hornMat);
        rHorn.position.set(-0.6, 1.2, -0.5);
        rHorn.rotation.x = -Math.PI / 4;
        headGroup.add(rHorn);

        // Wings
        this.leftWing = new THREE.Mesh(new THREE.BoxGeometry(8, 0.2, 4), wingMat);
        this.leftWing.position.set(5.5, 2.5, 0);
        this.mesh.add(this.leftWing);

        this.rightWing = new THREE.Mesh(new THREE.BoxGeometry(8, 0.2, 4), wingMat);
        this.rightWing.position.set(-5.5, 2.5, 0);
        this.mesh.add(this.rightWing);

        // Tail
        const tail = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 6), bodyMat);
        tail.position.set(0, 1, -5);
        tail.rotation.x = -0.2;
        this.mesh.add(tail);

        // Legs
        const legGeo = new THREE.BoxGeometry(1, 2, 1);
        for (let x of [-1.2, 1.2]) {
            for (let z of [-2, 2]) {
                const leg = new THREE.Mesh(legGeo, bodyMat);
                leg.position.set(x, 0, z);
                this.mesh.add(leg);
            }
        }

        this.headGroup = headGroup;
    }

    updateAI(dt) {
        super.updateAI(dt);

        this.wingTimer += dt * 5;
        this.leftWing.rotation.z = Math.sin(this.wingTimer) * 0.5;
        this.rightWing.rotation.z = -Math.sin(this.wingTimer) * 0.5;

        if (this.fireCooldown > 0) {
            this.fireCooldown -= dt;
        }

        const dist = this.game.player.position.distanceTo(this.mesh.position);
        if (this.isHostile && dist < this.attackRange && this.fireCooldown <= 0) {
            this.breatheFire();
        }
    }

    breatheFire() {
        this.fireCooldown = 3.0; // Seconds between fire breaths

        // Visual effect: burst of fire particles
        for (let i = 0; i < 20; i++) {
            const fire = new THREE.Mesh(
                new THREE.BoxGeometry(0.5, 0.5, 0.5),
                new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.8 })
            );

            // Start at head
            const startPos = new THREE.Vector3();
            this.headGroup.getWorldPosition(startPos);
            fire.position.copy(startPos);

            // Project forward
            const direction = new THREE.Vector3(0, 0, 1);
            direction.applyQuaternion(this.mesh.quaternion);

            const spread = 0.5;
            const velocity = direction.clone().multiplyScalar(10 + Math.random() * 10);
            velocity.x += (Math.random() - 0.5) * spread * 10;
            velocity.y += (Math.random() - 0.5) * spread * 10;
            velocity.z += (Math.random() - 0.5) * spread * 10;

            this.game.scene.add(fire);

            // Simple particle animation
            let life = 1.0;
            const interval = setInterval(() => {
                fire.position.add(velocity.clone().multiplyScalar(0.05));
                life -= 0.05;
                fire.scale.multiplyScalar(0.95);
                if (life <= 0) {
                    this.game.scene.remove(fire);
                    fire.geometry.dispose();
                    fire.material.dispose();
                    clearInterval(interval);
                }
            }, 50);
        }

        // Damage logic (simplified: check if player is in front and close)
        const toPlayer = this.game.player.position.clone().sub(this.mesh.position);
        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
        const dot = toPlayer.normalize().dot(forward);

        if (dot > 0.7 && this.game.player.position.distanceTo(this.mesh.position) < 12) {
            this.game.player.takeDamage(this.damage, 'Dragon');
        }
    }
}
