import * as THREE from 'three';

export class Arrow {
    constructor(game, position, velocity) {
        this.game = game;
        this.position = position.clone();
        this.velocity = velocity.clone();

        this.width = 0.1;
        this.height = 0.1;
        this.depth = 0.5; // Length

        this.isStuck = false;
        this.lifeTime = 0;
        this.maxLifeTime = 120; // Disappear after 120 seconds if stuck? or just 60

        this.mesh = this.createMesh();
        this.mesh.position.copy(this.position);
        this.updateRotation();
    }

    createMesh() {
        const group = new THREE.Group();

        // Shaft
        const shaftGeo = new THREE.BoxGeometry(0.05, 0.05, 0.5);
        const shaftMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // Brown wood
        const shaft = new THREE.Mesh(shaftGeo, shaftMat);
        group.add(shaft);

        // Head (Tip)
        const headGeo = new THREE.BoxGeometry(0.08, 0.08, 0.1);
        const headMat = new THREE.MeshLambertMaterial({ color: 0x808080 }); // Grey stone/iron
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.z = 0.3;
        group.add(head);

        // Fletching (Feathers)
        const featherGeo = new THREE.BoxGeometry(0.02, 0.15, 0.15);
        const featherMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF }); // White
        const feather = new THREE.Mesh(featherGeo, featherMat);
        feather.position.z = -0.25;
        group.add(feather);

        return group;
    }

    updateRotation() {
        // Look in direction of velocity
        if (this.velocity.lengthSq() > 0.001) {
            const lookAt = this.position.clone().add(this.velocity);
            this.mesh.lookAt(lookAt);
        }
    }

    update(dt) {
        this.lifeTime += dt;

        if (this.isStuck) {
            // Fade out or remove after time
            if (this.lifeTime > 60) {
                return false; // Signal to remove
            }
            return true;
        }

        // Apply gravity
        this.velocity.y -= this.game.gravity * 2; // Heavier feel

        // Move
        const nextPos = this.position.clone().add(this.velocity);

        // Check collisions (Blocks) - Simple raycast from current to next
        const dir = this.velocity.clone().normalize();
        const dist = this.velocity.length(); // speed per frame essentially

        // Raycast for precision
        this.game.raycaster.set(this.position, dir);
        this.game.raycaster.far = dist;

        // Check block collision manually or via raycaster if meshes exist.
        // Since we have voxel data, direct check is better/faster for blocks.
        if (this.checkBlockCollision(nextPos)) {
            this.isStuck = true;
            return true;
        }

        // Check Player
        const player = this.game.player;
        const playerPos = player.position.clone();
        playerPos.y += player.height / 2;
        if (this.position.distanceTo(playerPos) < (player.width + 0.5)) {
            console.log('Arrow hit player!');
            player.takeDamage(1);
            const dir = this.velocity.clone().normalize();
            player.knockback(dir, 0.2);
            this.isStuck = true;
            return false;
        }

        // Check Entities (Animals)
        for (const animal of this.game.animals) {
            if (animal.isDead) continue;

            // Simple AABB or Distance check
            // Hitbox approx center
            const animalPos = animal.position.clone();
            animalPos.y += animal.height / 2;

            if (this.position.distanceTo(animalPos) < (animal.width + 0.5)) {
                // Check more precise bounds if needed, but distance is okay for now
                console.log('Arrow hit animal!');
                animal.takeDamage(1, this.game.player);
                this.isStuck = true; // Arrow stops on hit? Or goes through? Let's stick/despawn
                return false; // Remove arrow on hit for simplicity
            }
        }

        this.position.copy(nextPos);
        this.mesh.position.copy(this.position);
        this.updateRotation();

        return true; // Keep alive
    }

    checkBlockCollision(nextPos) {
        // Simple point check first
        if (this.game.getBlock(Math.floor(nextPos.x), Math.floor(nextPos.y), Math.floor(nextPos.z))) {
            return true;
        }
        return false;
    }
}
