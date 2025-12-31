import * as THREE from 'three';
import { FallingTree } from '../entities/animals/FallingTree.js';
import { ShipEntity } from '../entities/ShipEntity.js';
import { Blocks } from '../core/Blocks.js';

/**
 * PhysicsManager handles raycasting, block interaction, and entity collision detection.
 */
export class PhysicsManager {
    constructor(game) {
        this.game = game;

        // Raycaster for interactions
        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = 6;

        // Highlight box for block selection
        this.highlightBox = this.createHighlightBox();
        this.game.scene.add(this.highlightBox);

        // Breaking progress
        this.breakingBlock = null; // {x, y, z}
        this.breakProgress = 0;
        this.baseBreakSpeed = 0.25; // Progress per swing (250ms interval)
        this.swingHitApplied = false;

        // Crack Overlay
        this.breakOverlay = this.createBreakOverlay();
        this.game.scene.add(this.breakOverlay);
    }

    createHighlightBox() {
        const geometry = new THREE.BoxGeometry(1.01, 1.01, 1.01);
        const edges = new THREE.EdgesGeometry(geometry);
        const material = new THREE.LineBasicMaterial({
            color: 0x000000,
            linewidth: 2,
            transparent: true,
            opacity: 0.5
        });
        const box = new THREE.LineSegments(edges, material);
        box.visible = false;
        return box;
    }

    createBreakOverlay() {
        const geometry = new THREE.BoxGeometry(1.005, 1.005, 1.005);
        // We'll update the material on the fly
        const material = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0.8,
            polygonOffset: true,
            polygonOffsetFactor: -1, // Ensure it's rendered in front of the block
            visible: false
        });
        const mesh = new THREE.Mesh(geometry, material);
        return mesh;
    }

    update() {
        this.updateHighlight();
        this.updateBreakOverlay();
        this.checkSwingImpact();
    }

    checkSwingImpact() {
        // Impact occurs when the arm swing is COMPLETE (after full up/down motion)
        // Player sets 'swingCompleted' to true at end of animation cycle
        if (this.game.player.swingCompleted && !this.swingHitApplied) {
            this.applySwingImpact();
            this.swingHitApplied = true;
            // Reset flag after handling
            this.game.player.swingCompleted = false;
        }
    }

    updateHighlight() {
        if (this.game.inventoryOpen || (this.game.agent && this.game.agent.isChatOpen)) {
            this.highlightBox.visible = false;
            return;
        }

        const target = this.getTargetBlock();
        if (target) {
            // Suppress highlight for water
            const blockType = this.game.getBlockWorld(target.x, target.y, target.z);
            if (blockType === Blocks.WATER) {
                this.highlightBox.visible = false;
                return;
            }

            this.highlightBox.position.set(
                target.x + 0.5,
                target.y + 0.5,
                target.z + 0.5
            );
            this.highlightBox.visible = true;
        } else {
            this.highlightBox.visible = false;
        }
    }

    updateBreakOverlay() {
        if (this.breakingBlock && this.breakProgress > 0) {
            // Calculate stage (0-9)
            const stage = Math.min(9, Math.floor(this.breakProgress * 10));

            const blockType = this.game.getBlockWorld(this.breakingBlock.x, this.breakingBlock.y, this.breakingBlock.z);

            // Suppress cracks for water
            if (blockType === Blocks.WATER) {
                this.breakOverlay.visible = false;
                return;
            }


            this.breakOverlay.position.set(
                this.breakingBlock.x + 0.5,
                this.breakingBlock.y + 0.5,
                this.breakingBlock.z + 0.5
            );

            const materialIdx = this.game.assetManager.breakMaterials[stage];
            const material = this.game.assetManager.materialArray[materialIdx];

            if (material) {
                this.breakOverlay.material = material;
                this.breakOverlay.material.polygonOffset = true;
                this.breakOverlay.material.polygonOffsetFactor = -1;
                this.breakOverlay.material.visible = true;
                this.breakOverlay.visible = true;
            }
        } else {
            this.breakOverlay.visible = false;
        }
    }

    /**
     * Get the block targeted by the player's crosshair
     */
    getTargetBlock() {
        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.game.camera);

        // Optimization: Only check chunks near the player
        const playerChunk = this.game.worldToChunk(
            this.game.camera.position.x,
            this.game.camera.position.y,
            this.game.camera.position.z
        );

        const checkRadius = 2; // Only check chunks within 2 units radius
        const chunkMeshes = [];

        for (const chunk of this.game.chunks.values()) {
            if (chunk.mesh && chunk.mesh.visible) {
                // Distance check
                if (Math.abs(chunk.cx - playerChunk.cx) <= checkRadius &&
                    Math.abs(chunk.cz - playerChunk.cz) <= checkRadius) {
                    chunkMeshes.push(chunk.mesh);
                }
            }
        }

        // We could optimize this by only checking chunks in front of player
        const intersects = this.raycaster.intersectObjects(chunkMeshes);

        if (intersects.length > 0) {
            const hit = intersects[0];
            const point = hit.point;
            const normal = hit.face.normal;

            // Calculate which block was hit by moving slightly into the block
            const blockX = Math.floor(point.x - normal.x * 0.01);
            const blockY = Math.floor(point.y - normal.y * 0.01);
            const blockZ = Math.floor(point.z - normal.z * 0.01);

            // Verify there's actually a block there
            if (this.game.getBlock(blockX, blockY, blockZ)) {
                return {
                    x: blockX,
                    y: blockY,
                    z: blockZ,
                    normal: { x: Math.round(normal.x), y: Math.round(normal.y), z: Math.round(normal.z) }
                };
            }
        }

        return null;
    }

    /**
     * Check if ray hits an animal
     */
    getHitAnimal() {
        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.game.camera);
        // Shorter range for melee
        const originalFar = this.raycaster.far;
        this.raycaster.far = 4.0;

        const animalMeshes = this.game.animals
            .filter(a => !a.isDead && !a.isDying) // Don't hit dead things
            .map(a => a.mesh);

        const intersects = this.raycaster.intersectObjects(animalMeshes, true); // Recursive true for groups

        // Reset far
        this.raycaster.far = originalFar;

        if (intersects.length > 0) {
            // Find which animal owns this mesh
            const hitObject = intersects[0].object;
            const hitRoot = this.findRootMesh(hitObject, animalMeshes);
            if (hitRoot) {
                return this.game.animals.find(a => a.mesh === hitRoot);
            }
        }

        return null;
    }

    findRootMesh(obj, roots) {
        let curr = obj;
        while (curr) {
            if (roots.includes(curr)) return curr;
            curr = curr.parent;
        }
        return null;
    }

    /**
     * Handle Left Click (Trigger Animation)
     */
    breakBlock() {
        // Prevent restarting animation if already mining (fixes infinite reset)
        if (this.game.player.isMining) return;

        // Trigger animation
        this.game.player.swingArm();
        this.swingHitApplied = false;
    }

    /**
     * The actual impact logic (damage/break) called from update()
     */
    applySwingImpact() {
        // 1. Check for entity hits (Animals)
        const hitAnimal = this.getHitAnimal();
        if (hitAnimal) {
            // Calculate knockback direction (from player to animal)
            const direction = new THREE.Vector3()
                .subVectors(hitAnimal.position, this.game.player.position)
                .normalize();

            // Flatten direction (mostly horizontal knockback)
            direction.y = 0.2; // Slight lift
            direction.normalize();

            const damage = this.game.player.getHeldItemDamage();
            hitAnimal.takeDamage(damage, this.game.player);
            hitAnimal.knockback(direction, 15);

            // Reset break progress if attacking
            this.breakingBlock = null;
            this.breakProgress = 0;
            return;
        }

        // 2. Break Block if no entity hit
        const target = this.getTargetBlock();
        if (target) {
            const blockType = this.game.getBlockWorld(target.x, target.y, target.z);
            if (!blockType || blockType === Blocks.WATER) return;

            const properties = this.game.assetManager.blockProperties[blockType] || { hardness: 1.0 };
            const hardness = properties.hardness;

            // Bedrock check
            if (hardness < 0) return;

            // Check if we are still breaking the same block
            if (!this.breakingBlock ||
                this.breakingBlock.x !== target.x ||
                this.breakingBlock.y !== target.y ||
                this.breakingBlock.z !== target.z) {
                this.breakingBlock = { x: target.x, y: target.y, z: target.z };
                this.breakProgress = 0;
            }

            // Calculate damage
            const efficiency = this.game.player.getHeldItemEfficiency(blockType);
            const damage = (this.baseBreakSpeed / hardness) * efficiency;

            this.breakProgress += damage;

            // Visual feedback: Update highlight box color/opacity
            if (this.highlightBox) {
                // User requested: don't show any damage on the first swing.
                if (this.breakProgress > damage + 0.01) {
                    // Flash or darken based on progress - made more subtle
                    this.highlightBox.material.color.setHSL(0, 0, 1.0 - this.breakProgress * 0.4);
                    this.highlightBox.material.opacity = 0.5 + this.breakProgress * 0.2;
                } else {
                    // First swing: keep it neutral
                    this.highlightBox.material.color.set(0x000000);
                    this.highlightBox.material.opacity = 0.5;
                }
            }

            if (this.breakProgress >= 1.0) {
                // Standard break - always break single block only
                this.game.spawnDrop(target.x, target.y, target.z, blockType);
                this.game.setBlock(target.x, target.y, target.z, null);
                this.game.updateBlockCount();

                // Reset progress
                this.breakingBlock = null;
                this.breakProgress = 0;

                if (this.highlightBox) {
                    this.highlightBox.material.color.set(0x000000);
                    this.highlightBox.material.opacity = 0.5;
                }
            }
        } else {
            // Clear progress if looking at air
            this.breakingBlock = null;
            this.breakProgress = 0;
            if (this.highlightBox) {
                this.highlightBox.material.color.set(0x000000);
                this.highlightBox.material.opacity = 0.5;
            }
        }
    }

    checkAndFellTree(x, y, z, logType) {
        // 1. Verify base: Block below should NOT be a log (it should be dirt/grass/etc)
        const below = this.game.getBlockWorld(x, y - 1, z);
        const logTypes = [Blocks.LOG, Blocks.PINE_WOOD, Blocks.BIRCH_WOOD];
        if (below && logTypes.includes(below)) {
            // Not the base, just break normal block
            this.game.setBlock(x, y, z, null);
            this.game.updateBlockCount();
            return;
        }

        // 2. Perform BFS to find connected logs/leaves
        const treeBlocks = [];
        const queue = [{ x, y, z, type: logType }];
        const visited = new Set();
        const key = (nx, ny, nz) => `${nx},${ny},${nz}`;

        visited.add(key(x, y, z));

        // Limits to prevent freezing on massive accidental structures
        const MAX_BLOCKS = 200;

        // Leaf types to include if connected
        const leafTypes = [Blocks.LEAVES, Blocks.PINE_LEAVES, Blocks.BIRCH_LEAVES];

        let foundLeaves = false;

        while (queue.length > 0 && treeBlocks.length < MAX_BLOCKS) {
            const current = queue.shift();
            treeBlocks.push(current);

            if (leafTypes.includes(current.type)) {
                foundLeaves = true;
            }

            // Search neighbors
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) { // Check up/down/diagonal
                    for (let dz = -1; dz <= 1; dz++) {
                        if (dx === 0 && dy === 0 && dz === 0) continue;

                        const nx = current.x + dx;
                        const ny = current.y + dy;
                        const nz = current.z + dz;

                        // Only go UP or LEVEL, never go below original cut
                        if (ny < y) continue;

                        const nKey = key(nx, ny, nz);
                        if (visited.has(nKey)) continue;

                        const nType = this.game.getBlockWorld(nx, ny, nz);
                        if (!nType) continue;

                        // Logic:
                        // Logs connect to Logs
                        // Logs connect to Leaves
                        // Leaves connect to Leaves (strict radius? or just loose flood fill?)
                        // To avoid grabbing the whole forest, we should be careful.
                        // Standard: Logs connect to any log. Logs connect to leaves. Leaves connect to leaves.

                        let isValid = false;
                        if (logTypes.includes(nType)) {
                            // Only follow matching log type? Or any log? 
                            // Usually trees don't mix logs.
                            if (nType === logType) isValid = true;
                        } else if (leafTypes.includes(nType)) {
                            isValid = true;
                        }

                        if (isValid) {
                            visited.add(nKey);
                            queue.push({ x: nx, y: ny, z: nz, type: nType });
                        }
                    }
                }
            }
        }

        // 3. Fall Logic
        // Determine fall direction (Player forward vector)
        if (treeBlocks.length > 3 && foundLeaves) { // Minimum size to count as tree
            // Remove blocks from world
            for (const b of treeBlocks) {
                this.game.setBlock(b.x, b.y, b.z, null, true, true); // skipBroadcast - tree felling is local physics
                // Note: setBlock updates mesh immediately unless optimized.
                // We should probably optimize this batch update later, but for now simple loop is fine.
            }
            this.game.updateChunks();

            // Calculate fall info
            const playerDir = new THREE.Vector3();
            this.game.camera.getWorldDirection(playerDir);
            playerDir.y = 0; // Horizontal fall

            // Create falling entity
            const fallingTree = new FallingTree(this.game, x, y, z, treeBlocks, playerDir);

            // Register for updates? It needs to be in a list that gets updated.
            // game.animals? Or special projectiles list?
            // FallingTree is not an Animal subclass.
            // Let's add it to game.projectiles or create game.effects
            // Or just hook into animate loop via a manager.
            // For now, let's force push it into 'projectiles' since they have update() called.
            this.game.projectiles.push(fallingTree);

        } else {
            // Not a valid tree (just a stump or pile), just break the single block
            this.game.spawnDrop(x, y, z, logType);
            this.game.setBlock(x, y, z, null);
            this.game.updateBlockCount();
        }
    }

    /**
     * Handle Right Click (Place Block)
     */
    placeBlock() {
        // Trigger animation
        this.game.player.swingArm();

        // Check Inventory
        const slot = this.game.inventoryManager.getSelectedItem();
        // Check if we have a valid block to place
        if (!slot || !slot.item || slot.count <= 0 || slot.type !== 'block') return;

        const blockType = slot.item;

        const target = this.getTargetBlock();
        if (target) {
            const newX = target.x + target.normal.x;
            const newY = target.y + target.normal.y;
            const newZ = target.z + target.normal.z;

            // Don't place inside player
            const player = this.game.player;
            const playerBox = {
                minX: player.position.x - player.width / 2,
                maxX: player.position.x + player.width / 2,
                minY: player.position.y,
                maxY: player.position.y + player.height,
                minZ: player.position.z - player.width / 2,
                maxZ: player.position.z + player.width / 2
            };

            const blockBox = {
                minX: newX, maxX: newX + 1,
                minY: newY, maxY: newY + 1,
                minZ: newZ, maxZ: newZ + 1
            };

            const collision = !(playerBox.maxX < blockBox.minX || playerBox.minX > blockBox.maxX ||
                playerBox.maxY < blockBox.minY || playerBox.minY > blockBox.maxY ||
                playerBox.maxZ < blockBox.minZ || playerBox.minZ > blockBox.maxZ);

            if (!collision && !this.game.getBlock(newX, newY, newZ)) {
                this.game.setBlock(newX, newY, newZ, blockType);
                this.game.updateBlockCount();

                // Consume Item
                this.game.inventoryManager.useSelected();

                // Update UI immediately
                if (this.game.inventory) {
                    this.game.inventory.renderHotbar();
                }

                // Update Game State (held item visibility, etc.)
                // re-selecting the current slot will refresh the game.selectedBlock and player hand
                this.game.selectSlot(this.game.inventoryManager.selectedSlot);
            }
        }
    }

    /**
     * Activate Thruster Logic
     */
    activateThruster() {
        const target = this.getTargetBlock();
        if (!target) return;

        // Must click a thruster to activate the ship?
        // Or click any block connected to a thruster?
        // Let's require clicking the thruster or a connected block.
        // Simplifying: Click ANY block. If it connects to a thruster, launch.

        // Flood fill
        const startNode = { x: target.x, y: target.y, z: target.z };
        const queue = [startNode];
        const visited = new Set();
        const blocks = []; // {x, y, z, type, dir}
        const key = (x, y, z) => `${x},${y},${z}`;

        visited.add(key(target.x, target.y, target.z));

        let hasThruster = false;

        // Safety limit
        const MAX_BLOCKS = 500;

        while (queue.length > 0 && blocks.length < MAX_BLOCKS) {
            const node = queue.shift();
            const type = this.game.getBlock(node.x, node.y, node.z);

            if (type && type !== Blocks.AIR && type !== Blocks.WATER && type !== Blocks.BEDROCK) {
                const blockData = {
                    x: node.x, y: node.y, z: node.z,
                    type: type,
                    dir: type === Blocks.THRUSTER ? this.game.getThrusterData(node.x, node.y, node.z) : 0
                };
                blocks.push(blockData);

                if (type === Blocks.THRUSTER) hasThruster = true;

                // Neighbors
                const neighbors = [
                    { x: node.x + 1, y: node.y, z: node.z },
                    { x: node.x - 1, y: node.y, z: node.z },
                    { x: node.x, y: node.y + 1, z: node.z },
                    { x: node.x, y: node.y - 1, z: node.z },
                    { x: node.x, y: node.y, z: node.z + 1 },
                    { x: node.x, y: node.y, z: node.z - 1 }
                ];

                for (const n of neighbors) {
                    const k = key(n.x, n.y, n.z);
                    if (!visited.has(k)) {
                        const nType = this.game.getBlock(n.x, n.y, n.z);
                        if (nType && nType !== Blocks.AIR && nType !== Blocks.WATER && nType !== Blocks.BEDROCK) {
                            visited.add(k);
                            queue.push(n);
                        }
                    }
                }
            }
        }

        if (!hasThruster) {
            this.game.uiManager.addChatMessage('system', "No connected thrusters found.");
            return;
        }

        if (blocks.length === 0) return;

        // Identify pivot (center of mass approximations or just first block)
        // Let's use the clicked block as origin? Or center?
        // Using startNode as origin.
        const origin = new THREE.Vector3(target.x, target.y, target.z);

        // Convert to relative coordinate blocks
        const relBlocks = blocks.map(b => ({
            relX: b.x - origin.x,
            relY: b.y - origin.y,
            relZ: b.z - origin.z,
            type: b.type,
            dir: b.dir
        }));

        // Create Ship
        const ship = new ShipEntity(this.game, origin, relBlocks);
        this.game.ships.push(ship);

        // Remove blocks from world
        // Sort logic? No need.
        for (const b of blocks) {
            this.game.setBlock(b.x, b.y, b.z, Blocks.AIR);
        }
    }
}
