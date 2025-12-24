
import * as THREE from 'three';

export class FloatingBlock {
    constructor(game, x, y, z, blockType) {
        this.game = game;
        this.blockType = blockType;
        this.position = new THREE.Vector3(x, y, z);
        this.startY = y;
        this.maxHeight = y + 100.0; // Float up 100 blocks before exploding
        this.floatSpeed = 4.0; // Faster ascent
        this.wobbleSpeed = 3.0;
        this.wobbleAmplitude = 0.3; // Horizontal wobble
        this.time = 0;

        this.isDead = false;

        this.mesh = this.createMesh(blockType);
        this.mesh.position.copy(this.position);
    }

    createMesh(type) {
        // Get materials
        const indices = this.game.blockMaterialIndices[type];

        // Fallback or default
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        let materials;

        if (indices && this.game.assetManager) {
            const allMaterials = this.game.assetManager.materialArray;
            materials = indices.map(idx => {
                const mat = allMaterials[idx].clone();
                mat.vertexColors = false; // Disable vertex colors as BoxGeometry doesn't have them
                return mat;
            });
        } else {
            // Fallback: Use a visible debug color (matches TextureGenerator's fallback)
            console.warn(`FloatingBlock: No material found for block type '${type}', using fallback`);
            materials = new THREE.MeshLambertMaterial({ color: 0xFF00FF }); // Magenta to match texture fallback
        }

        const mesh = new THREE.Mesh(geometry, materials);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    }

    update(deltaTime) {
        this.time += deltaTime;

        // Continuous rise with acceleration
        const heightProgress = (this.position.y - this.startY) / (this.maxHeight - this.startY);
        const speed = this.floatSpeed * (1 + heightProgress * 2); // Accelerate as it rises
        const deltaY = speed * deltaTime;
        this.position.y += deltaY;

        // Lift entities standing on this block
        this.liftEntitiesOnTop(deltaY);

        // Horizontal wobble while rising
        const wobbleX = Math.sin(this.time * this.wobbleSpeed) * this.wobbleAmplitude;
        const wobbleZ = Math.cos(this.time * this.wobbleSpeed * 0.7) * this.wobbleAmplitude;
        this.mesh.position.set(
            this.position.x + wobbleX,
            this.position.y,
            this.position.z + wobbleZ
        );

        // No rotation - blocks maintain their original orientation

        // Explode when reaching max height
        if (this.position.y >= this.maxHeight) {
            this.explode();
            this.isDead = true;
        }

        return !this.isDead;
    }

    /**
     * Lift entities (player and animals) that are standing on top of this floating block
     */
    liftEntitiesOnTop(deltaY) {
        const blockTop = this.position.y + 1; // Top of the 1x1x1 block
        const blockX = this.position.x;
        const blockZ = this.position.z;

        // Check if entity is standing on this block:
        // - Entity's X and Z position must be within the block bounds (0.5 units from center)
        // - Entity's Y position (feet) must be very close to the top of the block
        const isOnBlock = (entity) => {
            if (!entity || !entity.position) return false;

            const entityFeet = entity.position.y;
            const entityWidth = entity.width || 0.6; // Default width if not defined
            const halfWidth = entityWidth / 2;

            // Check horizontal bounds (entity center within block + some tolerance for entity width)
            const inX = entity.position.x >= blockX - 0.5 - halfWidth &&
                entity.position.x <= blockX + 0.5 + halfWidth;
            const inZ = entity.position.z >= blockZ - 0.5 - halfWidth &&
                entity.position.z <= blockZ + 0.5 + halfWidth;

            // Check if entity's feet are on or just above the block top (within 0.3 units)
            const onTop = entityFeet >= blockTop - 0.3 && entityFeet <= blockTop + 0.5;

            return inX && inZ && onTop;
        };

        // Lift the player
        if (this.game.player && isOnBlock(this.game.player)) {
            this.game.player.position.y += deltaY;
            // Prevent falling
            if (this.game.player.velocity.y < 0) {
                this.game.player.velocity.y = 0;
            }
        }

        // Lift animals
        if (this.game.animals) {
            for (const animal of this.game.animals) {
                if (isOnBlock(animal)) {
                    animal.position.y += deltaY;
                    animal.onGround = true; // Keep them grounded on the block
                    // Prevent falling
                    if (animal.velocity.y < 0) {
                        animal.velocity.y = 0;
                    }
                }
            }
        }
    }

    explode() {
        // Create explosion particles
        const particleCount = 20;
        const colors = [0xff6600, 0xff9900, 0xffcc00, 0xff3300, 0xffff00]; // Fiery colors

        for (let i = 0; i < particleCount; i++) {
            const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
            const material = new THREE.MeshBasicMaterial({
                color: colors[Math.floor(Math.random() * colors.length)],
                transparent: true,
                opacity: 1.0
            });
            const particle = new THREE.Mesh(geometry, material);
            particle.position.copy(this.mesh.position);

            // Random velocity
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10
            );

            this.game.scene.add(particle);

            // Animate particle
            const startTime = performance.now();
            const animate = () => {
                const elapsed = (performance.now() - startTime) / 1000;
                if (elapsed > 2.0) {
                    this.game.scene.remove(particle);
                    geometry.dispose();
                    material.dispose();
                    return;
                }

                particle.position.add(velocity.clone().multiplyScalar(0.016));
                velocity.y -= 9.8 * 0.016; // Gravity
                material.opacity = 1.0 - (elapsed / 2.0);
                particle.scale.setScalar(1.0 - (elapsed / 2.0));

                requestAnimationFrame(animate);
            };
            animate();
        }

        // Remove the main mesh
        this.game.scene.remove(this.mesh);
    }
}
