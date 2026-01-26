import * as THREE from 'three';
import { PlayerModelFactory } from './PlayerModelFactory.js';
import { ItemFactory } from '../../entities/ItemFactory.js';

/**
 * PlayerSyncManager - Handles remote player mesh creation, updates, and interpolation
 */
export class PlayerSyncManager {
    constructor(game, socketManager) {
        this.game = game;
        this.socketManager = socketManager;

        // Player meshes and state
        this.playerMeshes = new Map();
        this.playerNames = new Map();
        this.pendingHeldItems = new Map();

        // Interpolation settings
        this.INTERPOLATION_DELAY = 100; // ms
    }

    getPlayerMesh(id) {
        return this.playerMeshes.get(id);
    }

    setPlayerName(id, name) {
        this.playerNames.set(id, name);
    }

    setPendingHeldItem(id, itemType) {
        this.pendingHeldItems.set(id, itemType);
    }

    /**
     * Update or create a player mesh
     */
    updatePlayerMesh(id, pos, rotY, name, isCrouching = false, health, maxHealth, shirtColor, isFlying = false) {
        let meshInfo = this.playerMeshes.get(id);

        if (!meshInfo || meshInfo instanceof THREE.Object3D) {
            if (meshInfo instanceof THREE.Object3D) {
                this.game.scene.remove(meshInfo);
            }

            // Get stored name from player:joined event if not provided
            const playerName = name || this.playerNames.get(id) || `Player_${id.substring(0, 4)}`;
            meshInfo = PlayerModelFactory.createCharacterModel(id, playerName, shirtColor);

            // Add to scene
            this.game.scene.add(meshInfo.group);

            // Init buffer
            meshInfo.buffer = [];

            this.playerMeshes.set(id, meshInfo);

            // Apply pending held item
            if (this.pendingHeldItems.has(id)) {
                this.updateRemoteHeldItem(id, this.pendingHeldItems.get(id));
                this.pendingHeldItems.delete(id);
            }

            // Initial position
            meshInfo.group.position.copy(pos);
            meshInfo.targetPosition.copy(pos);

            // Initial state pushed to buffer
            meshInfo.buffer.push({
                time: performance.now(),
                pos: new THREE.Vector3(pos.x, pos.y, pos.z),
                rotY: rotY !== undefined ? rotY : 0,
                isCrouching: isCrouching,
                isFlying: isFlying
            });

            // Check for pending voice stream
            const vcm = this.socketManager.voiceChatManager;
            const pendingStream = vcm.pendingStreams.get(id);
            if (pendingStream) {
                console.log(`[PlayerSyncManager] Found pending stream for ${id}, setting up spatial audio.`);
                vcm.setupSpatialAudio(id, pendingStream);
                vcm.pendingStreams.delete(id);
            }

            if (health !== undefined) {
                this.updateHealthBar(meshInfo, health, maxHealth);
            }

            // Apply initial flying state
            meshInfo.isFlying = isFlying;
            this.updateRemoteFlyingState(meshInfo, isFlying);
            return;
        }

        // Skip position updates if player is dying
        if (meshInfo.isDying) {
            if (health !== undefined) {
                this.updateHealthBar(meshInfo, health, maxHealth);
            }
            return;
        }

        // Push new state with current timestamp
        const state = {
            time: performance.now(),
            pos: new THREE.Vector3(pos.x, pos.y, pos.z),
            rotY: rotY !== undefined ? rotY : meshInfo.group.rotation.y,
            isCrouching: isCrouching,
            isFlying: isFlying
        };

        // Infer rotation from movement direction if not provided
        if (rotY === undefined) {
            const dx = pos.x - meshInfo.targetPosition.x;
            const dz = pos.z - meshInfo.targetPosition.z;
            if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
                state.rotY = Math.atan2(dx, dz) + Math.PI;
            }
        }

        meshInfo.buffer.push(state);

        // Keep buffer size limited
        if (meshInfo.buffer.length > 20) {
            meshInfo.buffer.shift();
        }

        meshInfo.targetPosition.copy(pos);
        if (rotY !== undefined) meshInfo.targetRotationY = rotY;
        meshInfo.isCrouching = isCrouching;

        // Update flying state if changed
        if (meshInfo.isFlying !== isFlying) {
            meshInfo.isFlying = isFlying;
            this.updateRemoteFlyingState(meshInfo, isFlying);
        }

        if (health !== undefined) {
            this.updateHealthBar(meshInfo, health, maxHealth);

            // Trigger death animation when health reaches 0
            if (health <= 0 && !meshInfo.isDying) {
                console.log(`[PlayerSyncManager] Player ${id} died, starting death animation`);
                this.handleRemoteDeath(id);
            }
        }
    }

    /**
     * Update health bar for a player mesh
     */
    updateHealthBar(meshInfo, health, maxHealth) {
        if (!meshInfo || !meshInfo.healthBar) return;
        PlayerModelFactory.updateHealthBar(meshInfo.healthBar, health, maxHealth);
    }

    /**
     * Update remote player's flying state
     */
    updateRemoteFlyingState(meshInfo, isFlying) {
        if (!meshInfo) return;

        if (isFlying) {
            // Show riding broom
            if (meshInfo.ridingBroom) meshInfo.ridingBroom.visible = true;
            // Hide held broom
            if (meshInfo.heldBroom) meshInfo.heldBroom.visible = false;
            // Set sitting pose
            if (meshInfo.leftLeg) meshInfo.leftLeg.rotation.x = Math.PI / 2;
            if (meshInfo.rightLeg) meshInfo.rightLeg.rotation.x = Math.PI / 2;
            if (meshInfo.rightArm) meshInfo.rightArm.rotation.x = Math.PI / 3;
        } else {
            // Hide riding broom
            if (meshInfo.ridingBroom) meshInfo.ridingBroom.visible = false;
        }
    }

    /**
     * Update the held item visual for a remote player
     */
    updateRemoteHeldItem(id, itemType) {
        const meshInfo = this.playerMeshes.get(id);
        if (!meshInfo || !meshInfo.toolAttachment) return;

        // Clear existing children
        while (meshInfo.toolAttachment.children.length > 0) {
            meshInfo.toolAttachment.remove(meshInfo.toolAttachment.children[0]);
        }

        if (!itemType) return;

        let itemMesh = null;

        switch (itemType) {
            case 'pickaxe': itemMesh = ItemFactory.createPickaxe(); break;
            case 'sword': itemMesh = ItemFactory.createSword(); break;
            case 'bow': itemMesh = ItemFactory.createBow(); break;
            case 'wand': itemMesh = ItemFactory.createWand(0xFF00FF); break;
            case 'levitation_wand': itemMesh = ItemFactory.createWand(0xFFFF00); break;
            case 'shrink_wand': itemMesh = ItemFactory.createWand(0x00FFFF); break;
            case 'growth_wand': itemMesh = ItemFactory.createWand(0x00FF00); break;
            case 'ride_wand': itemMesh = ItemFactory.createWand(0x8B4513); break;
            case 'wizard_tower_wand': itemMesh = ItemFactory.createWand(0x8A2BE2); break;
            case 'capture_wand': itemMesh = ItemFactory.createWand(0xFFA500); break;
            case 'apple': itemMesh = ItemFactory.createFood('apple'); break;
            case 'bread': itemMesh = ItemFactory.createFood('bread'); break;
            case 'chocolate_bar': itemMesh = ItemFactory.createFood('chocolate_bar'); break;
            case 'chair': itemMesh = ItemFactory.createFurniture('chair'); break;
            case 'table': itemMesh = ItemFactory.createFurniture('table'); break;
            case 'couch': itemMesh = ItemFactory.createFurniture('couch'); break;
            case 'binoculars': itemMesh = ItemFactory.createBinoculars(); break;
            default: break;
        }

        if (itemMesh) {
            meshInfo.toolAttachment.add(itemMesh);
        }
    }

    /**
     * Handle player color change
     */
    handlePlayerColor(id, shirtColor) {
        const meshInfo = this.playerMeshes.get(id);
        if (meshInfo && meshInfo.shirtMaterial) {
            meshInfo.shirtMaterial.color.setHex(shirtColor);
        }
    }

    /**
     * Handle remote player death
     */
    handleRemoteDeath(id) {
        const meshInfo = this.playerMeshes.get(id);
        if (!meshInfo || meshInfo.isDying) return;

        meshInfo.isDying = true;

        // Play death animation (spin and fall)
        const duration = 1500;
        const startTime = performance.now();
        const startY = meshInfo.group.position.y;

        const animate = () => {
            if (!meshInfo.isDying) return;

            const elapsed = performance.now() - startTime;
            const progress = Math.min(1, elapsed / duration);

            // Spin
            meshInfo.group.rotation.y += 0.3;

            // Fall down
            meshInfo.group.position.y = startY - (progress * 1.5);

            // Fade out
            meshInfo.group.traverse((child) => {
                if (child.material) {
                    child.material.transparent = true;
                    child.material.opacity = 1 - progress;
                }
            });

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Reset after death animation
                setTimeout(() => {
                    meshInfo.isDying = false;
                    meshInfo.group.position.y = startY;
                    meshInfo.group.rotation.y = 0;
                    meshInfo.group.traverse((child) => {
                        if (child.material) {
                            child.material.opacity = 1;
                        }
                    });
                }, 1000);
            }
        };

        animate();
    }

    /**
     * Show damage indicator on a player
     */
    showDamageIndicator(playerId, amount) {
        const meshInfo = this.playerMeshes.get(playerId);
        if (!meshInfo || !meshInfo.group) return;

        // Store original colors
        if (!meshInfo.originalColors) {
            meshInfo.originalColors = new Map();
            meshInfo.group.traverse((child) => {
                if (child.isMesh && child.material && child.material.color) {
                    meshInfo.originalColors.set(child.uuid, child.material.color.getHex());
                }
            });
        }

        // Set all meshes to red
        meshInfo.group.traverse((child) => {
            if (child.isMesh && child.material && child.material.color) {
                child.material.color.setHex(0xFF0000);
            }
        });

        // Clear existing timeout
        if (meshInfo.flashTimeout) {
            clearTimeout(meshInfo.flashTimeout);
        }

        // Reset colors after delay
        meshInfo.flashTimeout = setTimeout(() => {
            if (!meshInfo.group) return;

            meshInfo.group.traverse((child) => {
                if (child.isMesh && child.material && child.material.color) {
                    const originalColor = meshInfo.originalColors?.get(child.uuid);
                    if (originalColor !== undefined) {
                        child.material.color.setHex(originalColor);
                    }
                }
            });
            meshInfo.flashTimeout = null;
        }, 500);
    }

    /**
     * Remove a player mesh when they disconnect
     */
    removePlayer(id) {
        const meshInfo = this.playerMeshes.get(id);
        if (meshInfo) {
            if (meshInfo.group) {
                this.game.scene.remove(meshInfo.group);
            }
            this.playerMeshes.delete(id);
        }
        this.playerNames.delete(id);
        this.pendingHeldItems.delete(id);
    }

    /**
     * Update all player meshes (interpolation and animation)
     */
    update(dt) {
        const now = performance.now();
        const renderTime = now - this.INTERPOLATION_DELAY;

        for (const [id, meshInfo] of this.playerMeshes) {
            if (!meshInfo.buffer || meshInfo.buffer.length < 2) continue;
            if (meshInfo.isDying) continue;

            // Find the two states to interpolate between
            let state0 = null;
            let state1 = null;

            for (let i = 0; i < meshInfo.buffer.length - 1; i++) {
                if (meshInfo.buffer[i].time <= renderTime && meshInfo.buffer[i + 1].time >= renderTime) {
                    state0 = meshInfo.buffer[i];
                    state1 = meshInfo.buffer[i + 1];
                    break;
                }
            }

            // Fallback to latest states
            if (!state0 || !state1) {
                state0 = meshInfo.buffer[meshInfo.buffer.length - 2];
                state1 = meshInfo.buffer[meshInfo.buffer.length - 1];
            }

            // Interpolate
            const timeDiff = state1.time - state0.time;
            const t = timeDiff > 0 ? Math.max(0, Math.min(1, (renderTime - state0.time) / timeDiff)) : 1;

            // Position
            meshInfo.group.position.lerpVectors(state0.pos, state1.pos, t);

            // Rotation (smooth)
            const targetRotY = state1.rotY;
            let angleDiff = targetRotY - meshInfo.group.rotation.y;
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            meshInfo.group.rotation.y += angleDiff * Math.min(1, dt * 10);

            // Walking animation
            const moveSpeed = state0.pos.distanceTo(state1.pos) / (timeDiff / 1000 || 1);
            if (moveSpeed > 0.5 && !meshInfo.isFlying) {
                meshInfo.animTime += dt * 8;
                const swing = Math.sin(meshInfo.animTime) * 0.5;

                if (meshInfo.rightLegGroup) meshInfo.rightLegGroup.rotation.x = swing;
                if (meshInfo.leftLegGroup) meshInfo.leftLegGroup.rotation.x = -swing;
                if (meshInfo.rightArmGroup) meshInfo.rightArmGroup.rotation.x = -swing * 0.5;
                if (meshInfo.leftArmGroup) meshInfo.leftArmGroup.rotation.x = swing * 0.5;
            } else if (!meshInfo.isFlying) {
                // Reset limbs when standing
                if (meshInfo.rightLegGroup) meshInfo.rightLegGroup.rotation.x *= 0.9;
                if (meshInfo.leftLegGroup) meshInfo.leftLegGroup.rotation.x *= 0.9;
                if (meshInfo.rightArmGroup) meshInfo.rightArmGroup.rotation.x *= 0.9;
                if (meshInfo.leftArmGroup) meshInfo.leftArmGroup.rotation.x *= 0.9;
            }
        }
    }

    /**
     * Clean up all player meshes
     */
    cleanup() {
        for (const [id, meshInfo] of this.playerMeshes) {
            if (meshInfo.group) {
                this.game.scene.remove(meshInfo.group);
            }
        }
        this.playerMeshes.clear();
        this.playerNames.clear();
        this.pendingHeldItems.clear();
    }
}
