import * as THREE from 'three';

export class Arrow {
    constructor(game, position, velocity, owner = null) {
        this.game = game;
        this.owner = owner; // The entity that fired this arrow (player or animal)
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

        // Apply gravity (scaled by dt for proper physics)
        const gravity = this.game.gravity * 20; // Realistic arc
        this.velocity.y -= gravity * dt;

        // Apply air drag for realistic slowdown
        const drag = 0.99;
        this.velocity.multiplyScalar(drag);

        // Calculate movement for this frame
        const movement = this.velocity.clone().multiplyScalar(dt * 60); // Scale to ~60fps baseline
        const nextPos = this.position.clone().add(movement);

        // --- Entity Collision (Sweep Test for Tunneling Prevention) ---
        // We do this BEFORE block collision so we can hit mobs standing in front of walls
        const hitRadius = 1.0; // Generous hit radius
        const segment = new THREE.Line3(this.position, nextPos);
        const closestPoint = new THREE.Vector3();

        // Check Player (skip if player fired this arrow)
        const player = this.game.player;
        if (this.owner !== player) {
            const playerPos = player.position.clone();
            playerPos.y += player.height / 2;

            segment.closestPointToPoint(playerPos, true, closestPoint);
            if (closestPoint.distanceTo(playerPos) < (player.width + 0.5)) {
                console.log('Arrow hit player!');
                player.takeDamage(1);
                // Knockback
                const dir = this.velocity.clone().normalize();
                player.knockback(dir, 0.2);

                this.isStuck = true;
                return false; // Destroy arrow
            }
        }

        // Check Entities (Animals) - Precise Raycast
        const raycaster = new THREE.Raycaster(this.position, this.velocity.clone().normalize(), 0, movement.length() + 0.1);
        const animalMeshes = this.game.animals
            .filter(a => !a.isDead && a !== this.owner)
            .map(a => a.mesh);

        const intersects = raycaster.intersectObjects(animalMeshes, true); // Recursive check

        if (intersects.length > 0) {
            // Find which animal was hit
            const hitObject = intersects[0].object;
            const hitPoint = intersects[0].point;

            // Helper to find parent animal from mesh part
            const findAnimal = (obj) => {
                let curr = obj;
                while (curr) {
                    const animal = this.game.animals.find(a => a.mesh === curr);
                    if (animal) return animal;
                    curr = curr.parent;
                }
                return null;
            };

            const animal = findAnimal(hitObject);

            if (animal) {
                console.log(`Arrow hit ${animal.constructor.name}!`);
                animal.takeDamage(1, this.owner);
                this.isStuck = true;

                // Stick to the hit point
                this.position.copy(hitPoint);
                this.mesh.position.copy(this.position);

                // Parent the arrow to the hit object so it moves with it?
                // For now, simpler stick logic (just stops):
                // Ideally we'd attach it, but that requires more complex scene graph manipulation.
                // Just stopping it at the exact hit point is a huge improvement over "hit air nearby".

                return false; // Destroy arrow logic handled by isStuck in next frame usually, but here we return false to 'destroy' or stop updating position? 
                // Wait, original logic was: this.isStuck = true; return false;
                // 'return false' in update() usually means "remove me from projectiles list".
                // But if isStuck is true, we want to render it?
                // Original: if (this.isStuck) return true (keep alive to show it stuck).
                // But inside collision: this.isStuck = true; return false; -> This REMOVES it immediately.
                // That implies arrows disappear on hit in the current logic?
                // Line 100 in original: this.isStuck = true; return false; 
                // Yes, existing arrows disappear on player hit.
                // Let's keep existing behavior of "disappear on entity hit" OR fix it to stick.
                // The user request didn't explicitly ask for sticking, just "hit".
                // However, seeing "isStuck" suggests the intent was visual sticking.
                // If I return `true`, it stays in the scene.
                // Let's return `true` so we can see where it hit! 

                return true;
            }
        }

        // --- Block Collision ---
        if (this.checkBlockCollision(nextPos)) {
            this.isStuck = true;
            // Keep arrow at collision point (prevents entering block)
            // Ideally we'd raycast to find exact intersection, but stopping at last valid pos is okay for now
            this.mesh.position.copy(this.position);
            return true;
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
