import * as THREE from 'three';

export class Drop {
    constructor(game, x, y, z, blockType) {
        this.game = game;
        this.blockType = blockType;
        this.position = new THREE.Vector3(x, y, z);

        // Random small velocity for pop effect
        this.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.1,
            0.2, // Pop up
            (Math.random() - 0.5) * 0.1
        );

        this.isDead = false;

        // Creation time for magnet delay (don't specificly need exact time, just age)
        this.age = 0;
        this.pickupDelay = 0.5; // Seconds before it can be picked up

        this.mesh = this.createMesh(blockType);

        // Set scale to be tiny
        this.mesh.scale.set(0.25, 0.25, 0.25);
        this.mesh.position.copy(this.position);

        // Add to scene
        // We will manage adding/removing in logic or here? 
        // Better to let manager add, but for simplicity let's do it here like other entities often do.
        // But VoxelGame usually adds mesh. 
        // I will let VoxelGame add it.

        // Random rotation axis
        this.rotationSpeed = new THREE.Vector3(
            Math.random() * 2,
            Math.random() * 2,
            Math.random() * 2
        );

        this.levitationTimer = 0;
        this.isGrounded = false;
    }

    createMesh(type) {
        // Get materials
        const indices = this.game.blockMaterialIndices[type];

        // Fallback if not found (e.g. unknown block)
        if (!indices) {
            return new THREE.Mesh(
                new THREE.BoxGeometry(1, 1, 1),
                new THREE.MeshLambertMaterial({ color: 0xFF00FF }) // Error pink
            );
        }

        const allMaterials = this.game.assetManager.materialArray;
        // Clone materials and disable vertexColors - block materials use vertex colors
        // for chunk-based lighting, but BoxGeometry doesn't have them, causing black rendering
        const materials = indices.map(idx => {
            const original = allMaterials[idx];
            const cloned = original.clone();
            cloned.vertexColors = false;
            return cloned;
        });

        // Use BoxGeometry
        const geometry = new THREE.BoxGeometry(1, 1, 1);

        // Create mesh with multi-materials
        const mesh = new THREE.Mesh(geometry, materials);

        // Enable shadows
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        return mesh;
    }

    update(deltaTime) {
        this.age += deltaTime;
        if (this.levitationTimer > 0) this.levitationTimer -= deltaTime;

        // Physics Loop
        // 1. Gravity
        if (this.levitationTimer > 0) {
            this.velocity.y += this.game.gravity * 2.5 * deltaTime; // Strong lift
            if (this.velocity.y > 3.0) this.velocity.y = 3.0;
            this.isGrounded = false;
        } else if (!this.isGrounded) {
            this.velocity.y -= this.game.gravity * 2;
        }

        // 2. Move (Simple collision)
        // Scale velocity by deltaTime to ensure consistent movement regardless of frame rate
        // Multiply by 60 to normalize for ~60fps baseline
        const scaledVelocity = this.velocity.clone().multiplyScalar(deltaTime * 60);
        this.position.add(scaledVelocity);

        // Check collision with ground
        // We can just check the center point against opacity/solid block
        const blockX = Math.floor(this.position.x);
        const blockY = Math.floor(this.position.y);
        const blockZ = Math.floor(this.position.z);

        const block = this.game.getBlock(blockX, blockY, blockZ);

        // Simple ground check: if inside a solid block, push up or stop
        // Actually we want to check below.
        // If we are INSIDE a block, we should pop out or stop falling.
        if (block && block.type !== 'water' && block.type !== 'air' && !this.isPassable(block.type)) {
            // Hit ground/solid
            this.position.y = Math.floor(this.position.y) + 1 + 0.125; // Sit on top (0.25 height / 2)
            this.velocity.y = 0;
            this.velocity.x *= 0.8; // Friction
            this.velocity.z *= 0.8;
            this.isGrounded = true;
        } else if (this.isGrounded) {
            // Check if we should still be grounded (block below us)
            const blockBelow = this.game.getBlock(blockX, blockY - 1, blockZ);
            if (!blockBelow || blockBelow.type === 'air' || this.isPassable(blockBelow.type)) {
                this.isGrounded = false; // Start falling again
            }
            // Apply friction while grounded
            this.velocity.x *= 0.8;
            this.velocity.z *= 0.8;
        }

        // Magnet effect to player
        const playerPos = this.game.player.position.clone();
        // Target is player's center/feet
        playerPos.y += 0.5;

        const dist = this.position.distanceTo(playerPos);

        if (dist < 3.0 && this.age > this.pickupDelay) {
            // Attract
            const dir = playerPos.sub(this.position).normalize();
            const strength = (3.0 - dist) * 0.02;
            this.velocity.add(dir.multiplyScalar(strength));
        }

        // Pickup
        if (dist < 1.0 && this.age > this.pickupDelay) {
            this.collect();
        }

        // Rotate visuals
        this.mesh.rotation.x += this.rotationSpeed.x * deltaTime;
        this.mesh.rotation.y += this.rotationSpeed.y * deltaTime;

        // Sync mesh position
        // Sync mesh position and add visual bobbing
        this.mesh.position.copy(this.position);
        // Visual Improvements: Bobbing animation
        // 0.15 height amplitude, 3.0 speed frequency
        this.mesh.position.y += Math.sin(this.age * 3.0) * 0.15;

        return !this.isDead;
    }

    startLevitation(duration) {
        this.levitationTimer = duration;
        this.velocity.y = 5.0; // Initial pop
    }

    isPassable(type) {
        const passables = ['water', 'air', 'long_grass', 'flower_red', 'flower_yellow', 'mushroom_red', 'mushroom_brown', 'dead_bush', 'fern'];
        return passables.includes(type);
    }

    collect() {
        if (this.isDead) return;

        // Add to inventory
        // Determine item type (block vs resource)
        // Similar to Player.collectBlock logic
        const itemToGive = this.resolveItemDrop(this.blockType);

        // Try to add
        const added = this.game.inventoryManager.addItem(itemToGive.item, itemToGive.count, itemToGive.type);

        if (added) {
            this.isDead = true;
            // Play sound?
            // this.game.playSound('pickup');
        }
    }

    resolveItemDrop(blockType) {
        // Logic from Player.js
        let item = blockType;
        let count = 1;
        let type = 'block';

        if (blockType === 'coal_ore') { item = 'coal'; type = 'resource'; }
        else if (blockType === 'iron_ore') { item = 'iron_ingot'; type = 'resource'; }
        else if (blockType === 'gold_ore') { item = 'gold_ingot'; type = 'resource'; }
        else if (blockType === 'diamond_ore') { item = 'diamond'; type = 'resource'; }
        else if (blockType === 'stone') { item = 'cobblestone'; type = 'block'; }
        else if (blockType.includes('leaves')) {
            // Leaves might not drop anything or drop distinct items
            // For now, let's just make leaves drop saplings or sticks occasionally,
            // but if we are dropping an entity, we must decide NOW.
            // If we want random chance, we do it here.
            // But usually the drop entity IS the item.
            // So 'leaves' drop entity is weird if it turns into a stick later.
            // WE SHOULD RESOLVE THIS AT SPAWN TIME.
            // But for now, let's keep it simple: Leaves drop leaves block (shears style) or nothing?
            // Minecraft: leaves decay or break into apples/saplings.
            // If we drop a "leaf block" it looks weird if we pick up a stick.
            // Let's handle this in spawn logic in VoxelGame.
        }

        return { item, count, type };
    }
}
