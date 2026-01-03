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
        try {
            this.lifeTime += dt;

            if (this.isStuck) {
                // Fade out or remove after time
                if (this.lifeTime > 60) {
                    return false; // Signal to remove
                }
                return true;
            }

            // Apply gravity (scaled by dt for proper physics)
            const gravity = (this.game.gravity || 0.0032) * 20; // Realistic arc, with fallback
            this.velocity.y -= gravity * dt;

            // Apply air drag for realistic slowdown
            const drag = 0.99;
            this.velocity.multiplyScalar(drag);

            // Calculate movement for this frame
            const movement = this.velocity.clone().multiplyScalar(dt * 60); // Scale to ~60fps baseline
            const nextPos = this.position.clone().add(movement);

            // Guard: If velocity is too small, skip entity collision (arrow nearly stopped)
            const velocityLength = this.velocity.length();
            if (velocityLength < 0.001) {
                // Arrow has essentially stopped - stick it
                this.isStuck = true;
                return true;
            }

            // --- Entity Collision (Sweep Test for Tunneling Prevention) ---
            const segment = new THREE.Line3(this.position, nextPos);
            const closestPoint = new THREE.Vector3();

            // Check Player (skip if player fired this arrow)
            const player = this.game.player;
            if (this.owner !== player && player) {
                const playerPos = player.position.clone();
                playerPos.y += (player.height || 1.8) / 2;

                segment.closestPointToPoint(playerPos, true, closestPoint);
                if (closestPoint.distanceTo(playerPos) < ((player.width || 0.6) + 0.5)) {
                    console.log('Arrow hit player!');
                    if (player.takeDamage) player.takeDamage(1);
                    if (player.takeDamage) player.takeDamage(1);
                    console.log('Arrow hit player!');

                    // Check intersections with animals
                    this.isStuck = true;
                    return false; // Destroy arrow
                }
            }

            // Check Entities (Animals) - Precise Raycast
            // Guard against undefined/null meshes
            const animalMeshes = (this.game.animals || [])
                .filter(a => a && !a.isDead && a !== this.owner && a.mesh)
                .map(a => a.mesh);

            // Only raycast if we have valid targets
            if (animalMeshes.length > 0) {
                const raycaster = new THREE.Raycaster(this.position, this.velocity.clone().normalize(), 0, movement.length() + 0.1);
                raycaster.camera = this.game.camera; // Required for Sprite intersection
                const intersects = raycaster.intersectObjects(animalMeshes, true);

                if (intersects.length > 0) {
                    const hitObject = intersects[0].object;
                    const hitPoint = intersects[0].point;

                    // Helper to find parent animal from mesh part
                    const findAnimal = (obj) => {
                        let curr = obj;
                        while (curr) {
                            const animal = (this.game.animals || []).find(a => a.mesh === curr);
                            if (animal) return animal;
                            curr = curr.parent;
                        }
                        return null;
                    };

                    const animal = findAnimal(hitObject);

                    if (animal) {
                        console.log(`Arrow hit ${animal.constructor.name}!`);
                        if (animal.takeDamage) animal.takeDamage(1, this.owner);
                        this.isStuck = true;

                        // Stick to the hit point
                        this.position.copy(hitPoint);
                        this.mesh.position.copy(this.position);

                        return true; // Stay visible at hit location
                    }
                }
            }

            // Check Remote Players
            const socketManager = this.game.socketManager;
            if (socketManager && socketManager.playerMeshes) {
                const remoteMeshes = [];
                socketManager.playerMeshes.forEach((meshInfo) => {
                    if (meshInfo.group) remoteMeshes.push(meshInfo.group);
                });

                if (remoteMeshes.length > 0) {
                    const raycaster = new THREE.Raycaster(this.position, this.velocity.clone().normalize(), 0, movement.length() + 0.1);
                    const intersects = raycaster.intersectObjects(remoteMeshes, true);

                    if (intersects.length > 0) {
                        const hitObject = intersects[0].object;
                        const hitPoint = intersects[0].point;

                        // Find player ID
                        let playerId = null;
                        let curr = hitObject;
                        while (curr) {
                            if (curr.userData && curr.userData.playerId) {
                                playerId = curr.userData.playerId;
                                break;
                            }
                            curr = curr.parent;
                            if (curr === this.game.scene) break;
                        }

                        if (playerId) {
                            console.log(`Arrow hit remote player ${playerId}!`);
                            // Send damage
                            socketManager.sendDamage(playerId, 4); // Arrow damage

                            this.isStuck = true;
                            this.position.copy(hitPoint);
                            this.mesh.position.copy(this.position);
                            return true;
                        }
                    }
                }
            }

            // --- Block Collision ---
            if (this.checkBlockCollision(nextPos)) {
                this.isStuck = true;
                this.mesh.position.copy(this.position);
                return true;
            }

            this.position.copy(nextPos);
            this.mesh.position.copy(this.position);
            this.updateRotation();

            return true; // Keep alive
        } catch (error) {
            console.error('[Arrow] Update error:', error);
            return false; // Remove on error
        }
    }

    checkBlockCollision(nextPos) {
        // Simple point check first
        const block = this.game.getBlock(Math.floor(nextPos.x), Math.floor(nextPos.y), Math.floor(nextPos.z));
        if (block) {
            return true;
        }
        return false;
    }
}
