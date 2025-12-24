import * as THREE from 'three';

export class WrenchProjectile {
    constructor(game, position, velocity, thrower) {
        this.game = game;
        this.position = position.clone();
        this.velocity = velocity.clone();
        this.thrower = thrower; // Who threw it (to avoid self-hit)

        this.width = 0.3;
        this.height = 0.3;
        this.depth = 0.3;

        this.isStuck = false;
        this.lifeTime = 0;
        this.maxLifeTime = 10; // Disappear after 10 seconds

        this.damage = 4; // Damage dealt

        this.mesh = this.createMesh();
        this.mesh.position.copy(this.position);

        // Random rotation axis for tumbling
        this.rotationAxis = new THREE.Vector3(1, 0, 0); // Spin forward
    }

    createMesh() {
        const group = new THREE.Group();

        const metalMat = new THREE.MeshLambertMaterial({ color: 0xAAAAAA }); // Light grey metal

        // Handle
        const handleGeo = new THREE.BoxGeometry(0.1, 0.05, 0.6);
        const handle = new THREE.Mesh(handleGeo, metalMat);
        group.add(handle);

        // Head (C-shape)
        // Main block
        const headBaseGeo = new THREE.BoxGeometry(0.25, 0.05, 0.15);
        const headBase = new THREE.Mesh(headBaseGeo, metalMat);
        headBase.position.z = 0.3;
        group.add(headBase);

        // Prongs
        const prongGeo = new THREE.BoxGeometry(0.08, 0.05, 0.15);

        const leftProng = new THREE.Mesh(prongGeo, metalMat);
        leftProng.position.set(-0.12, 0, 0.4);
        leftProng.rotation.y = 0.2;
        group.add(leftProng);

        const rightProng = new THREE.Mesh(prongGeo, metalMat);
        rightProng.position.set(0.12, 0, 0.4);
        rightProng.rotation.y = -0.2;
        group.add(rightProng);

        // Make it bigger overall
        group.scale.set(1.5, 1.5, 1.5);

        return group;
    }

    update(dt) {
        this.lifeTime += dt;

        if (this.lifeTime > this.maxLifeTime) {
            return false; // Remove
        }

        if (this.isStuck) {
            return true; // Just sit there
        }

        // Apply gravity
        this.velocity.y -= this.game.gravity * dt;

        // Move
        const nextPos = this.position.clone().add(
            this.velocity.clone().multiplyScalar(dt)
        );

        // Spin
        this.mesh.rotateOnAxis(this.rotationAxis, 15 * dt);

        // Check Collisions
        if (this.checkCollisions(nextPos)) {
            // Hit something
            return false; // Remove immediately on impact? Or stick? Let's remove for now.
        }

        this.position.copy(nextPos);
        this.mesh.position.copy(this.position);

        return true;
    }

    checkCollisions(nextPos) {
        // Block Collision
        if (this.game.getBlock(Math.floor(nextPos.x), Math.floor(nextPos.y), Math.floor(nextPos.z))) {
            return true; // Hit wall
        }

        // Ground check
        if (nextPos.y < 0) return true;

        // Entity Collision
        // Check Player
        const player = this.game.player;
        if (player !== this.thrower) {
            const playerPos = player.position.clone();
            playerPos.y += player.height / 2;
            if (this.position.distanceTo(playerPos) < 1.0) {
                console.log('Wrench hit player!');
                player.takeDamage(this.damage);
                const knockDir = this.velocity.clone().normalize();
                knockDir.y = 0.2;
                player.knockback(knockDir, 0.5);
                return true;
            }
        }

        // Check Animals
        for (const animal of this.game.animals) {
            if (animal === this.thrower || animal.isDead) continue;

            const animalPos = animal.position.clone();
            animalPos.y += animal.height / 2;

            if (this.position.distanceTo(animalPos) < (animal.width + 0.5)) {
                animal.takeDamage(this.damage, this.thrower);
                return true;
            }
        }

        return false;
    }
}
