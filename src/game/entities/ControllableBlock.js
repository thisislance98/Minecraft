
import * as THREE from 'three';

/**
 * ControllableBlock - A block that players can control and fly around
 * Other blocks can be attached to build vehicles.
 *
 * Controls:
 * - E/Right-click to take/release control
 * - W/S to move forward/backward (block's local direction)
 * - A/D to rotate left/right
 * - Space to go up
 * - Shift to go down
 * - Mouse to look around (player can still look while controlling)
 * - Place blocks adjacent to attach them
 */
export class ControllableBlock {
    constructor(game, x, y, z, blockType = 'control_block') {
        this.game = game;
        this.blockType = blockType;
        this.position = new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5); // Center of block

        // Physics
        this.velocity = new THREE.Vector3();
        this.speed = 8.0;           // Movement speed
        this.rotationSpeed = 2.5;   // Rotation speed (radians per second)
        this.drag = 0.92;           // Velocity damping
        this.maxSpeed = 15.0;       // Maximum velocity

        // Block's facing direction (yaw angle in radians)
        this.yaw = 0;

        // Control state
        this.controller = null;     // Player controlling this block
        this.isControlled = false;

        // Attached blocks - stored as local offsets from the core block
        // Each entry: { offset: THREE.Vector3, blockType: string, mesh: THREE.Mesh }
        this.attachedBlocks = [];

        // Create the main container group (this rotates everything together)
        this.mesh = new THREE.Group();
        this.mesh.position.copy(this.position);

        // Create the core block mesh
        this.coreMesh = this.createBlockMesh(blockType);
        this.coreMesh.position.set(0, 0, 0); // At center of group
        this.mesh.add(this.coreMesh);

        // Store reference for raycasting on core mesh
        this.coreMesh.userData.entity = this;
        this.coreMesh.userData.entityType = 'controllableBlock';
        this.coreMesh.userData.isCore = true;

        // Forward indicator (arrow on top pointing forward)
        this.forwardIndicator = this.createForwardIndicator();
        this.mesh.add(this.forwardIndicator);

        // Glow effect when controlled
        this.glowMesh = this.createGlowMesh();
        this.glowMesh.visible = false;
        this.mesh.add(this.glowMesh);

        // Trail particles (optional visual flair)
        this.trailParticles = [];
        this.trailTimer = 0;

        // Entity tracking
        this.isDead = false;
        this.interactionRadius = 3.0;

        // Add to scene
        this.game.scene.add(this.mesh);

        // Register with game
        if (!this.game.controllableBlocks) {
            this.game.controllableBlocks = [];
        }
        this.game.controllableBlocks.push(this);

        console.log(`[ControllableBlock] Created at (${x}, ${y}, ${z}) type: ${blockType}`);
    }

    createBlockMesh(blockType) {
        const geometry = new THREE.BoxGeometry(1, 1, 1);

        // Get materials from asset manager
        let materials;
        const indices = this.game.blockMaterialIndices?.[blockType] ||
                       this.game.assetManager?.blockMaterialIndices?.[blockType];

        if (indices && this.game.assetManager) {
            const allMaterials = this.game.assetManager.materialArray;
            materials = indices.map(idx => {
                const mat = allMaterials[idx].clone();
                mat.vertexColors = false;
                return mat;
            });
        } else {
            // Fallback: bright cyan to stand out
            materials = new THREE.MeshLambertMaterial({ color: 0x00FFFF });
        }

        const mesh = new THREE.Mesh(geometry, materials);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        return mesh;
    }

    createForwardIndicator() {
        // Create an arrow pointing in the -Z direction (forward)
        const group = new THREE.Group();

        // Arrow body (flat rectangle on top of block)
        const bodyGeom = new THREE.BoxGeometry(0.1, 0.02, 0.4);
        const arrowMat = new THREE.MeshBasicMaterial({
            color: 0x00FF00,
            transparent: true,
            opacity: 0.9
        });
        const body = new THREE.Mesh(bodyGeom, arrowMat);
        body.position.set(0, 0.52, -0.1); // On top, slightly forward
        group.add(body);

        // Arrow head (triangle/cone pointing forward)
        const headGeom = new THREE.ConeGeometry(0.15, 0.2, 4);
        const head = new THREE.Mesh(headGeom, arrowMat);
        head.rotation.x = -Math.PI / 2; // Point forward (-Z)
        head.position.set(0, 0.52, -0.4);
        group.add(head);

        // Small side indicators to make it clearer
        const sideGeom = new THREE.BoxGeometry(0.3, 0.02, 0.05);
        const leftSide = new THREE.Mesh(sideGeom, arrowMat);
        leftSide.position.set(0, 0.52, 0.2);
        group.add(leftSide);

        return group;
    }

    createGlowMesh() {
        // Wireframe box around the entire structure
        const geometry = new THREE.BoxGeometry(1.1, 1.1, 1.1);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00FF00,
            wireframe: true,
            transparent: true,
            opacity: 0.8
        });
        return new THREE.Mesh(geometry, material);
    }

    /**
     * Attach a block at the given local offset
     * @param {THREE.Vector3} localOffset - Offset from core block (e.g., (1,0,0) for right)
     * @param {string} blockType - Type of block to attach
     * @returns {boolean} Success
     */
    attachBlock(localOffset, blockType) {
        // Check if there's already a block at this offset
        const existing = this.attachedBlocks.find(b =>
            b.offset.x === localOffset.x &&
            b.offset.y === localOffset.y &&
            b.offset.z === localOffset.z
        );
        if (existing) {
            console.log('[ControllableBlock] Block already exists at offset', localOffset);
            return false;
        }

        // Create the block mesh
        const blockMesh = this.createBlockMesh(blockType);
        blockMesh.position.copy(localOffset);

        // Store reference for raycasting
        blockMesh.userData.entity = this;
        blockMesh.userData.entityType = 'controllableBlock';
        blockMesh.userData.isAttached = true;
        blockMesh.userData.localOffset = localOffset.clone();

        // Add to group
        this.mesh.add(blockMesh);

        // Track it
        this.attachedBlocks.push({
            offset: localOffset.clone(),
            blockType: blockType,
            mesh: blockMesh
        });

        // Update the glow mesh to encompass all blocks
        this.updateGlowMesh();

        console.log(`[ControllableBlock] Attached ${blockType} at offset (${localOffset.x}, ${localOffset.y}, ${localOffset.z}). Total blocks: ${this.attachedBlocks.length + 1}`);
        return true;
    }

    /**
     * Check if a world position is adjacent to any block in this structure
     * Returns the local offset where a new block would be placed, or null
     */
    getAttachmentOffset(worldX, worldY, worldZ) {
        // Convert world position to local space
        const worldPos = new THREE.Vector3(worldX + 0.5, worldY + 0.5, worldZ + 0.5);
        const localPos = this.mesh.worldToLocal(worldPos.clone());

        // Round to nearest integer offset
        const checkOffset = new THREE.Vector3(
            Math.round(localPos.x),
            Math.round(localPos.y),
            Math.round(localPos.z)
        );

        // Check if this offset is adjacent to core (0,0,0) or any attached block
        const allOffsets = [
            new THREE.Vector3(0, 0, 0), // Core
            ...this.attachedBlocks.map(b => b.offset)
        ];

        for (const existingOffset of allOffsets) {
            const dx = Math.abs(checkOffset.x - existingOffset.x);
            const dy = Math.abs(checkOffset.y - existingOffset.y);
            const dz = Math.abs(checkOffset.z - existingOffset.z);

            // Adjacent means exactly 1 block away in one axis only
            const isAdjacent = (dx + dy + dz === 1);

            if (isAdjacent) {
                // Make sure this spot isn't already occupied
                const isOccupied = checkOffset.equals(new THREE.Vector3(0, 0, 0)) ||
                    this.attachedBlocks.some(b => b.offset.equals(checkOffset));

                if (!isOccupied) {
                    return checkOffset;
                }
            }
        }

        return null;
    }

    /**
     * Check if a world position is part of this controllable block structure
     */
    containsWorldPosition(worldX, worldY, worldZ) {
        const worldPos = new THREE.Vector3(worldX + 0.5, worldY + 0.5, worldZ + 0.5);
        const localPos = this.mesh.worldToLocal(worldPos.clone());

        const checkOffset = new THREE.Vector3(
            Math.round(localPos.x),
            Math.round(localPos.y),
            Math.round(localPos.z)
        );

        // Check core
        if (checkOffset.x === 0 && checkOffset.y === 0 && checkOffset.z === 0) {
            return true;
        }

        // Check attached blocks
        return this.attachedBlocks.some(b => b.offset.equals(checkOffset));
    }

    updateGlowMesh() {
        // Calculate bounding box of all blocks
        let minX = 0, maxX = 0, minY = 0, maxY = 0, minZ = 0, maxZ = 0;

        for (const block of this.attachedBlocks) {
            minX = Math.min(minX, block.offset.x);
            maxX = Math.max(maxX, block.offset.x);
            minY = Math.min(minY, block.offset.y);
            maxY = Math.max(maxY, block.offset.y);
            minZ = Math.min(minZ, block.offset.z);
            maxZ = Math.max(maxZ, block.offset.z);
        }

        const sizeX = maxX - minX + 1.2;
        const sizeY = maxY - minY + 1.2;
        const sizeZ = maxZ - minZ + 1.2;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const centerZ = (minZ + maxZ) / 2;

        // Update glow mesh geometry
        this.glowMesh.geometry.dispose();
        this.glowMesh.geometry = new THREE.BoxGeometry(sizeX, sizeY, sizeZ);
        this.glowMesh.position.set(centerX, centerY, centerZ);
    }

    /**
     * Called when player interacts (E key or right-click)
     */
    interact(player) {
        if (!player) return;

        if (this.isControlled && this.controller === player) {
            this.releaseControl();
            return;
        }

        if (this.isControlled && this.controller !== player) {
            console.log('[ControllableBlock] Already controlled by another player');
            return;
        }

        this.takeControl(player);
    }

    takeControl(player) {
        this.controller = player;
        this.isControlled = true;
        this.glowMesh.visible = true;
        player.controlledBlock = this;

        console.log('[ControllableBlock] Player took control');
        this.glowMesh.material.color.setHex(0x00FF00);
    }

    releaseControl() {
        if (this.controller) {
            this.controller.controlledBlock = null;
        }
        this.controller = null;
        this.isControlled = false;
        this.glowMesh.visible = false;

        console.log('[ControllableBlock] Control released');
    }

    update(deltaTime) {
        if (this.isDead) return false;

        if (this.isControlled && this.controller) {
            this.handleInput(deltaTime);
        }

        // Apply drag
        this.velocity.multiplyScalar(this.drag);

        // Clamp velocity
        if (this.velocity.length() > this.maxSpeed) {
            this.velocity.normalize().multiplyScalar(this.maxSpeed);
        }

        // Move
        const movement = this.velocity.clone().multiplyScalar(deltaTime);
        const nextPos = this.position.clone().add(movement);

        if (!this.checkCollision(nextPos)) {
            this.position.copy(nextPos);
        } else {
            this.velocity.multiplyScalar(0.3);
        }

        // Update mesh position and rotation
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.yaw;

        // Glow animation
        if (this.isControlled) {
            const pulse = Math.sin(Date.now() * 0.005) * 0.2 + 0.8;
            this.glowMesh.material.opacity = pulse;
        }

        // Trail particles when moving fast
        if (this.isControlled && this.velocity.length() > 2) {
            this.trailTimer += deltaTime;
            if (this.trailTimer > 0.05) {
                this.spawnTrailParticle();
                this.trailTimer = 0;
            }
        }

        this.updateTrailParticles(deltaTime);

        return true;
    }

    handleInput(deltaTime) {
        const input = this.game.inputManager;
        if (!input) return;

        // Get the block's local forward direction based on its yaw
        const forward = new THREE.Vector3(
            -Math.sin(this.yaw),
            0,
            -Math.cos(this.yaw)
        );

        const accel = this.speed * deltaTime * 10;

        // Forward/Backward (W/S)
        if (input.keys['KeyW'] || input.actions['FORWARD']) {
            this.velocity.add(forward.clone().multiplyScalar(accel));
        }
        if (input.keys['KeyS'] || input.actions['BACKWARD']) {
            this.velocity.add(forward.clone().multiplyScalar(-accel));
        }

        // Rotate (A/D)
        if (input.keys['KeyA'] || input.actions['LEFT']) {
            this.yaw += this.rotationSpeed * deltaTime;
        }
        if (input.keys['KeyD'] || input.actions['RIGHT']) {
            this.yaw -= this.rotationSpeed * deltaTime;
        }

        // Up/Down (Space/Shift)
        if (input.keys['Space'] || input.actions['JUMP']) {
            this.velocity.y += accel;
        }
        if (input.keys['ShiftLeft'] || input.actions['SNEAK']) {
            this.velocity.y -= accel;
        }
    }

    checkCollision(pos) {
        // Check all blocks in the structure
        const allOffsets = [
            new THREE.Vector3(0, 0, 0),
            ...this.attachedBlocks.map(b => b.offset)
        ];

        for (const offset of allOffsets) {
            // Transform offset by rotation
            const rotatedOffset = offset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
            const blockWorldPos = pos.clone().add(rotatedOffset);

            // Check corners of this block
            const checkPoints = [
                blockWorldPos,
                blockWorldPos.clone().add(new THREE.Vector3(0.4, 0, 0)),
                blockWorldPos.clone().add(new THREE.Vector3(-0.4, 0, 0)),
                blockWorldPos.clone().add(new THREE.Vector3(0, 0, 0.4)),
                blockWorldPos.clone().add(new THREE.Vector3(0, 0, -0.4)),
                blockWorldPos.clone().add(new THREE.Vector3(0, 0.4, 0)),
                blockWorldPos.clone().add(new THREE.Vector3(0, -0.4, 0)),
            ];

            for (const point of checkPoints) {
                const bx = Math.floor(point.x);
                const by = Math.floor(point.y);
                const bz = Math.floor(point.z);

                const block = this.game.getBlock(bx, by, bz);
                if (block && block.type !== 'air' && block.type !== 'water') {
                    return true;
                }
            }
        }

        return false;
    }

    spawnTrailParticle() {
        const geometry = new THREE.BoxGeometry(0.15, 0.15, 0.15);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00FFFF,
            transparent: true,
            opacity: 0.6
        });
        const particle = new THREE.Mesh(geometry, material);

        particle.position.copy(this.position);
        particle.position.x += (Math.random() - 0.5) * 0.3;
        particle.position.y += (Math.random() - 0.5) * 0.3;
        particle.position.z += (Math.random() - 0.5) * 0.3;

        this.game.scene.add(particle);

        this.trailParticles.push({
            mesh: particle,
            life: 0.5,
            maxLife: 0.5
        });
    }

    updateTrailParticles(deltaTime) {
        for (let i = this.trailParticles.length - 1; i >= 0; i--) {
            const p = this.trailParticles[i];
            p.life -= deltaTime;

            const lifeRatio = Math.max(0, p.life / p.maxLife);
            p.mesh.material.opacity = lifeRatio * 0.6;
            p.mesh.scale.setScalar(lifeRatio);

            if (p.life <= 0) {
                this.game.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
                this.trailParticles.splice(i, 1);
            }
        }
    }

    /**
     * Destroy this controllable block
     */
    destroy() {
        this.isDead = true;
        this.releaseControl();

        // Cleanup trail particles
        for (const p of this.trailParticles) {
            this.game.scene.remove(p.mesh);
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
        }
        this.trailParticles = [];

        // Cleanup attached block meshes
        for (const block of this.attachedBlocks) {
            if (block.mesh.geometry) block.mesh.geometry.dispose();
            if (Array.isArray(block.mesh.material)) {
                block.mesh.material.forEach(m => m.dispose());
            } else if (block.mesh.material) {
                block.mesh.material.dispose();
            }
        }
        this.attachedBlocks = [];

        // Remove main group
        this.game.scene.remove(this.mesh);

        // Cleanup core mesh
        if (this.coreMesh.geometry) this.coreMesh.geometry.dispose();
        if (Array.isArray(this.coreMesh.material)) {
            this.coreMesh.material.forEach(m => m.dispose());
        } else if (this.coreMesh.material) {
            this.coreMesh.material.dispose();
        }

        console.log('[ControllableBlock] Destroyed');
    }
}
