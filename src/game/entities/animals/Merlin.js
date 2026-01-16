import * as THREE from 'three';
import { Animal } from '../Animal.js';
import { Pathfinder } from '../../ai/Pathfinder.js';

/**
 * Merlin - The AI Wizard companion that follows the player around.
 * 
 * A floating wizard entity that serves as the visual avatar for the AI assistant.
 * Features magical floating movement, follows the player, and displays speech bubbles.
 */
export class Merlin extends Animal {
    constructor(game, x = 0, y = 0, z = 0, seed = null) {
        super(game, x, y, z, seed);

        // Dimensions
        this.width = 0.6;
        this.height = 2.2;
        this.depth = 0.6;

        // Build visual mesh
        this.createBody();

        // Movement settings
        this.speed = 4.0; // Slightly faster than player walking
        this.followDistance = 5.0; // Stay 5 blocks behind player
        this.teleportDistance = 20.0; // Teleport if too far
        this.floatHeight = 0.3; // Hover this much above ground
        this.maxPathNodes = 200; // Reduced from 500 for performance

        // Animation state
        this.time = 0;
        this.bobSpeed = 2.0;
        this.bobHeight = 0.15;
        this.baseY = y;

        // AI state
        this.state = 'following';
        this.targetPosition = new THREE.Vector3(x, y, z);

        // Pathfinding
        this.pathfinder = new Pathfinder(game);
        this.currentPath = null;
        this.pathIndex = 0;
        this.repathTimer = 0;
        this.lastTargetBlockPos = null;

        // Speech bubble state
        this.currentSpeech = null;
        this.speechTimer = 0;

        // Particle effects
        this.particles = [];
        this.particleTimer = 0;
        this.activeAnimations = []; // Track animation frame IDs for cleanup

        // Don't use normal physics
        this.useFloatingPhysics = true;

        // Health (wizard is immortal essentially)
        this.health = 9999;
        this.maxHealth = 9999;
    }

    /**
     * Cleanup method to prevent memory leaks
     */
    dispose() {
        // Cancel all running particle animations
        this.activeAnimations.forEach(id => cancelAnimationFrame(id));
        this.activeAnimations = [];

        // Call parent dispose if it exists
        if (super.dispose) {
            super.dispose();
        }
    }

    createBody() {
        // Colors
        const robeColor = 0x2a1b6b;      // Deep purple-blue
        const robeAccent = 0x4a3a9b;     // Lighter purple
        const skinColor = 0xf0d6bc;      // Skin tone
        const beardColor = 0xd4d4d4;     // Silver-white beard
        const staffColor = 0x4a3222;     // Wood brown
        const gemColor = 0x00ffff;       // Cyan glowing gem
        const hatColor = 0x1a0d4e;       // Dark blue hat

        const robeMat = new THREE.MeshLambertMaterial({ color: robeColor });
        const robeAccentMat = new THREE.MeshLambertMaterial({ color: robeAccent });
        const skinMat = new THREE.MeshLambertMaterial({ color: skinColor });
        const beardMat = new THREE.MeshLambertMaterial({ color: beardColor });
        const staffMat = new THREE.MeshLambertMaterial({ color: staffColor });
        const gemMat = new THREE.MeshBasicMaterial({ color: gemColor }); // Emissive look
        const hatMat = new THREE.MeshLambertMaterial({ color: hatColor });

        // === BODY (Robe) ===
        const bodyGeo = new THREE.BoxGeometry(0.5, 1.0, 0.4);
        const body = new THREE.Mesh(bodyGeo, robeMat);
        body.position.set(0, 0.8, 0);
        this.mesh.add(body);

        // Robe bottom (wider, flowing)
        const robeBottomGeo = new THREE.BoxGeometry(0.65, 0.5, 0.5);
        const robeBottom = new THREE.Mesh(robeBottomGeo, robeMat);
        robeBottom.position.set(0, 0.25, 0);
        this.mesh.add(robeBottom);

        // Belt
        const beltGeo = new THREE.BoxGeometry(0.52, 0.1, 0.42);
        const beltMat = new THREE.MeshLambertMaterial({ color: 0xdaa520 }); // Gold
        const belt = new THREE.Mesh(beltGeo, beltMat);
        belt.position.set(0, 0.55, 0);
        this.mesh.add(belt);

        // === HEAD GROUP ===
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 1.6, 0);
        this.mesh.add(headGroup);
        this.headGroup = headGroup;

        // Head
        const headGeo = new THREE.BoxGeometry(0.45, 0.45, 0.4);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.set(0, 0.22, 0);
        headGroup.add(head);

        // === WIZARD HAT ===
        // Hat brim
        const brimGeo = new THREE.BoxGeometry(0.7, 0.08, 0.7);
        const brim = new THREE.Mesh(brimGeo, hatMat);
        brim.position.set(0, 0.48, 0);
        headGroup.add(brim);

        // Hat cone (multiple segments for tapered look)
        const hatBase = new THREE.BoxGeometry(0.45, 0.25, 0.45);
        const hatBaseMesh = new THREE.Mesh(hatBase, hatMat);
        hatBaseMesh.position.set(0, 0.65, 0);
        headGroup.add(hatBaseMesh);

        const hatMid = new THREE.BoxGeometry(0.35, 0.25, 0.35);
        const hatMidMesh = new THREE.Mesh(hatMid, hatMat);
        hatMidMesh.position.set(0, 0.9, 0);
        headGroup.add(hatMidMesh);

        const hatTop = new THREE.BoxGeometry(0.25, 0.3, 0.25);
        const hatTopMesh = new THREE.Mesh(hatTop, hatMat);
        hatTopMesh.position.set(0, 1.15, 0);
        hatTopMesh.rotation.z = 0.2; // Slight tilt for whimsy
        headGroup.add(hatTopMesh);

        // Star decorations on hat
        const starMat = new THREE.MeshBasicMaterial({ color: 0xffdd44 });
        const starGeo = new THREE.BoxGeometry(0.08, 0.08, 0.02);

        const star1 = new THREE.Mesh(starGeo, starMat);
        star1.position.set(0.15, 0.75, 0.18);
        headGroup.add(star1);

        const star2 = new THREE.Mesh(starGeo, starMat);
        star2.position.set(-0.1, 0.95, 0.15);
        headGroup.add(star2);

        // === FACE ===
        // Eyes
        const eyeMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
        const pupilMat = new THREE.MeshLambertMaterial({ color: 0x3366cc }); // Blue eyes
        const eyeGeo = new THREE.BoxGeometry(0.1, 0.08, 0.04);
        const pupilGeo = new THREE.BoxGeometry(0.05, 0.05, 0.02);

        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.12, 0.28, 0.21);
        headGroup.add(leftEye);

        const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
        leftPupil.position.set(-0.12, 0.28, 0.25);
        headGroup.add(leftPupil);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.12, 0.28, 0.21);
        headGroup.add(rightEye);

        const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
        rightPupil.position.set(0.12, 0.28, 0.25);
        headGroup.add(rightPupil);

        // Bushy eyebrows
        const browMat = new THREE.MeshLambertMaterial({ color: beardColor });
        const browGeo = new THREE.BoxGeometry(0.14, 0.06, 0.05);

        const leftBrow = new THREE.Mesh(browGeo, browMat);
        leftBrow.position.set(-0.12, 0.35, 0.2);
        leftBrow.rotation.z = 0.15;
        headGroup.add(leftBrow);

        const rightBrow = new THREE.Mesh(browGeo, browMat);
        rightBrow.position.set(0.12, 0.35, 0.2);
        rightBrow.rotation.z = -0.15;
        headGroup.add(rightBrow);

        // Nose
        const noseGeo = new THREE.BoxGeometry(0.08, 0.12, 0.1);
        const nose = new THREE.Mesh(noseGeo, skinMat);
        nose.position.set(0, 0.18, 0.22);
        headGroup.add(nose);

        // === BEARD ===
        // Main beard
        const beardGeo = new THREE.BoxGeometry(0.35, 0.5, 0.15);
        const beard = new THREE.Mesh(beardGeo, beardMat);
        beard.position.set(0, -0.1, 0.15);
        headGroup.add(beard);

        // Beard extension (longer)
        const beardExtGeo = new THREE.BoxGeometry(0.25, 0.4, 0.12);
        const beardExt = new THREE.Mesh(beardExtGeo, beardMat);
        beardExt.position.set(0, -0.45, 0.12);
        headGroup.add(beardExt);

        // Mustache
        const mustacheGeo = new THREE.BoxGeometry(0.3, 0.08, 0.08);
        const mustache = new THREE.Mesh(mustacheGeo, beardMat);
        mustache.position.set(0, 0.08, 0.22);
        headGroup.add(mustache);

        // === ARMS ===
        const armGeo = new THREE.BoxGeometry(0.15, 0.6, 0.15);

        // Left arm
        const leftArmPivot = new THREE.Group();
        leftArmPivot.position.set(-0.33, 1.2, 0);
        const leftArm = new THREE.Mesh(armGeo, robeAccentMat);
        leftArm.position.set(0, -0.3, 0);
        leftArmPivot.add(leftArm);
        this.mesh.add(leftArmPivot);

        // Right arm (holding staff)
        const rightArmPivot = new THREE.Group();
        rightArmPivot.position.set(0.33, 1.2, 0);
        rightArmPivot.rotation.x = -0.3; // Arm forward for staff
        const rightArm = new THREE.Mesh(armGeo, robeAccentMat);
        rightArm.position.set(0, -0.3, 0);
        rightArmPivot.add(rightArm);
        this.mesh.add(rightArmPivot);

        this.armParts = [leftArmPivot, rightArmPivot];

        // === STAFF ===
        const staffGroup = new THREE.Group();
        staffGroup.position.set(0, -0.5, 0.15);

        // Staff pole
        const poleGeo = new THREE.BoxGeometry(0.08, 1.8, 0.08);
        const pole = new THREE.Mesh(poleGeo, staffMat);
        pole.position.set(0, 0.3, 0);
        staffGroup.add(pole);

        // Staff head (ornate)
        const headOrnamentGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
        const headOrnament = new THREE.Mesh(headOrnamentGeo, staffMat);
        headOrnament.position.set(0, 1.25, 0);
        staffGroup.add(headOrnament);

        // Glowing gem
        const gemGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
        const gem = new THREE.Mesh(gemGeo, gemMat);
        gem.position.set(0, 1.4, 0);
        staffGroup.add(gem);
        this.staffGem = gem;

        // Add point light at gem
        const gemLight = new THREE.PointLight(0x00ffff, 0.5, 5);
        gemLight.position.copy(gem.position);
        staffGroup.add(gemLight);
        this.gemLight = gemLight;

        rightArmPivot.add(staffGroup);
        this.staffGroup = staffGroup;

        // Empty leg parts (wizard floats, no walking animation)
        this.legParts = [];
    }

    updateAI(dt) {
        const player = this.game?.player;
        if (!player) return;

        const playerPos = player.position.clone();
        const myPos = this.position.clone();

        // Calculate horizontal distance
        const dx = playerPos.x - myPos.x;
        const dz = playerPos.z - myPos.z;
        const horizontalDist = Math.sqrt(dx * dx + dz * dz);

        // Teleport if too far - DISABLED: Merlin no longer follows
        // if (horizontalDist > this.teleportDistance) {
        //     this.teleportToPlayer();
        //     return;
        // }

        // Look at player (rotate head group)
        if (this.headGroup) {
            const lookAngle = Math.atan2(dx, dz);
            // Only rotate head, not body, for a more natural look
            const relativeAngle = lookAngle - this.rotation;
            // Clamp head rotation
            const clampedAngle = Math.max(-0.8, Math.min(0.8, relativeAngle));
            this.headGroup.rotation.y = clampedAngle;
        }

        // Face the player but don't follow - Merlin stays in place
        this.rotation = Math.atan2(dx, dz);
        this.state = 'idle';
        this.isMoving = false;
        return;

        // Following behavior (disabled)
        if (horizontalDist > this.followDistance + 1.0) {
            // Need to move closer
            this.state = 'following';

            // Calculate target position behind player
            const playerDir = new THREE.Vector3();
            this.game.camera.getWorldDirection(playerDir);
            playerDir.y = 0;
            playerDir.normalize();

            // Position behind player at follow distance
            const targetX = playerPos.x - playerDir.x * this.followDistance;
            const targetZ = playerPos.z - playerDir.z * this.followDistance;

            this.targetPosition.set(targetX, playerPos.y + this.floatHeight, targetZ);

            // Pathfinding logic
            this.repathTimer -= dt;

            // Check if target moved significantly or timer expired
            const targetBlockPos = new THREE.Vector3(
                Math.floor(this.targetPosition.x),
                Math.floor(this.targetPosition.y),
                Math.floor(this.targetPosition.z)
            );

            let needsRepath = this.repathTimer <= 0;
            if (this.lastTargetBlockPos && targetBlockPos.distanceTo(this.lastTargetBlockPos) > 2) {
                needsRepath = true;
            }

            if (needsRepath) {
                // Adaptive repath interval: slower when close, faster when far
                const distToTarget = horizontalDist - this.followDistance;
                this.repathTimer = distToTarget > 10 ? 0.5 : 1.0; // 1s when close, 0.5s when far

                this.lastTargetBlockPos = targetBlockPos.clone();

                // Check line of sight first for simple cases
                const hasLineOfSight = !this.isPathBlocked(this.position, this.targetPosition);

                if (hasLineOfSight && horizontalDist < 15) {
                    // Direct path is clear - no need for expensive pathfinding
                    this.currentPath = [this.targetPosition.clone()];
                    this.pathIndex = 0;
                } else {
                    // Need pathfinding
                    const path = this.pathfinder.findPath(this.position, this.targetPosition, this.maxPathNodes);
                    if (path && path.length > 0) {
                        this.currentPath = path;
                        this.pathIndex = 0;
                    } else {
                        // No path found, try direct movement (may clip but better than stuck)
                        this.currentPath = null;
                    }
                }
            }

            // Follow path if we have one
            if (this.currentPath && this.pathIndex < this.currentPath.length) {
                const targetVec = this.currentPath[this.pathIndex];

                // Horizontal distance to next waypoint
                const wpDx = targetVec.x - this.position.x;
                const wpDz = targetVec.z - this.position.z;
                const wpDistSq = wpDx * wpDx + wpDz * wpDz;

                // Move towards waypoint
                const angle = Math.atan2(wpDx, wpDz);
                this.rotation = angle;
                this.moveDirection.set(Math.sin(angle), 0, Math.cos(angle));
                this.isMoving = true;

                // Check if we've reached the waypoint
                if (wpDistSq < 0.5) {
                    this.pathIndex++;
                }
            } else {
                // No path - try direct movement as fallback
                const toTarget = new THREE.Vector3(
                    this.targetPosition.x - this.position.x,
                    0,
                    this.targetPosition.z - this.position.z
                );
                const dist = toTarget.length();

                if (dist > 0.5) {
                    toTarget.normalize();
                    this.moveDirection.copy(toTarget);
                    this.isMoving = true;
                    this.rotation = Math.atan2(toTarget.x, toTarget.z);
                } else {
                    this.isMoving = false;
                }
            }
        } else if (horizontalDist < this.followDistance - 1.5) {
            // Too close, stop and wait
            this.state = 'idle';
            this.isMoving = false;
            this.currentPath = null;

            // Face the player
            this.rotation = Math.atan2(dx, dz);
        } else {
            // At correct distance
            this.state = 'idle';
            this.isMoving = false;
            this.currentPath = null;

            // Face the player
            this.rotation = Math.atan2(dx, dz);
        }
    }

    updatePhysics(dt) {
        // Override standard physics - Merlin floats!
        if (!this.game?.player) return;

        const player = this.game.player;

        // Target Y is player's Y + float height
        const targetY = player.position.y + this.floatHeight;

        // Smooth vertical movement
        this.position.y += (targetY - this.position.y) * 3.0 * dt;

        // Horizontal movement with collision detection
        if (this.isMoving && this.moveDirection.lengthSq() > 0) {
            const moveSpeed = this.speed * dt;
            const newX = this.position.x + this.moveDirection.x * moveSpeed;
            const newZ = this.position.z + this.moveDirection.z * moveSpeed;

            // Check collision for X movement
            if (!this.isBlockedAt(newX, this.position.y, this.position.z)) {
                this.position.x = newX;
            }

            // Check collision for Z movement
            if (!this.isBlockedAt(this.position.x, this.position.y, newZ)) {
                this.position.z = newZ;
            }
        }
    }

    /**
     * Simple line-of-sight check to avoid expensive pathfinding when unnecessary
     */
    isPathBlocked(from, to) {
        if (!this.game?.world) return false;

        // Sample along the line at 1-block intervals
        const dist = from.distanceTo(to);
        const steps = Math.ceil(dist);
        const dx = (to.x - from.x) / steps;
        const dz = (to.z - from.z) / steps;

        for (let i = 1; i < steps; i++) {
            const checkX = Math.floor(from.x + dx * i);
            const checkY = Math.floor(from.y);
            const checkZ = Math.floor(from.z + dz * i);

            const block = this.game.world.getBlock(checkX, checkY, checkZ);
            if (block && block !== 0 && block !== 8 && block !== 9) {
                return true; // Path is blocked
            }
        }

        return false; // Line of sight is clear
    }

    /**
     * Check if a position is blocked by a solid block
     */
    isBlockedAt(x, y, z) {
        if (!this.game?.world) return false;

        // Check a few points on Merlin's body (center and edges)
        const checkPoints = [
            { x: 0, z: 0 },         // Center
            { x: -0.25, z: -0.25 }, // Corners
            { x: 0.25, z: -0.25 },
            { x: -0.25, z: 0.25 },
            { x: 0.25, z: 0.25 },
        ];

        for (const offset of checkPoints) {
            const checkX = Math.floor(x + offset.x);
            const checkZ = Math.floor(z + offset.z);

            // Check at body height and head height
            for (let yOff = 0; yOff < 2; yOff++) {
                const checkY = Math.floor(y + yOff);
                const block = this.game.world.getBlock(checkX, checkY, checkZ);

                // Block is solid if it exists and isn't air/water
                if (block && block !== 0 && block !== 8 && block !== 9) {
                    return true;
                }
            }
        }

        return false;
    }

    update(dt) {
        // Animation time
        this.time += dt;

        // CRITICAL: Prevent frustum culling - ensures Merlin stays visible
        // This mirrors the safety code in Animal.update() which we don't call
        this.mesh.frustumCulled = false;
        this.mesh.traverse(c => {
            c.frustumCulled = false;
            c.visible = true;
        });

        // Custom update instead of calling super
        if (this.isDying) {
            this.updateDeath(dt);
            return;
        }

        // AI
        this.updateAI(dt);

        // Floating physics
        this.updatePhysics(dt);

        // Bobbing animation
        const bobOffset = Math.sin(this.time * this.bobSpeed) * this.bobHeight;
        this.mesh.position.y = bobOffset;

        // Staff gem pulsing
        if (this.staffGem) {
            const pulse = 0.8 + Math.sin(this.time * 3) * 0.2;
            this.staffGem.scale.setScalar(pulse);
        }
        if (this.gemLight) {
            this.gemLight.intensity = 0.3 + Math.sin(this.time * 3) * 0.2;
        }

        // Gentle body sway
        this.mesh.rotation.z = Math.sin(this.time * 1.5) * 0.02;

        // Sync mesh position
        this.mesh.position.x = this.position.x;
        this.mesh.position.z = this.position.z;
        this.mesh.position.y += this.position.y;

        this.mesh.rotation.y = this.rotation;

        // Speech timer
        if (this.speechTimer > 0) {
            this.speechTimer -= dt;
            if (this.speechTimer <= 0) {
                this.hideSpeechBubble();
            }
        }
    }

    teleportToPlayer() {
        const player = this.game?.player;
        if (!player) return;

        // Get player's facing direction
        const dir = new THREE.Vector3();
        this.game.camera.getWorldDirection(dir);
        dir.y = 0;
        dir.normalize();

        // Teleport behind player
        this.position.x = player.position.x - dir.x * this.followDistance;
        this.position.y = player.position.y + this.floatHeight;
        this.position.z = player.position.z - dir.z * this.followDistance;

        // Visual teleport effect (particles)
        this.spawnTeleportParticles();

        console.log('[Merlin] Teleported to player');
    }

    spawnTeleportParticles() {
        // Simple particle burst effect
        if (!this.game?.scene) return;

        const particleMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8 });
        const particleGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);

        for (let i = 0; i < 10; i++) {
            const particle = new THREE.Mesh(particleGeo, particleMat.clone());
            particle.position.copy(this.position);
            particle.position.x += (Math.random() - 0.5) * 2;
            particle.position.y += Math.random() * 2;
            particle.position.z += (Math.random() - 0.5) * 2;

            this.game.scene.add(particle);

            // Animate and remove
            const startY = particle.position.y;
            const startTime = this.time;
            const duration = 1.0;
            let animationId = null;

            const animateParticle = () => {
                const elapsed = this.time - startTime;
                if (elapsed > duration || !this.game) {
                    // Clean up
                    this.game?.scene.remove(particle);
                    particle.geometry.dispose();
                    particle.material.dispose();

                    // Remove from tracking array
                    const index = this.activeAnimations.indexOf(animationId);
                    if (index > -1) {
                        this.activeAnimations.splice(index, 1);
                    }
                    return;
                }

                const progress = elapsed / duration;
                particle.position.y = startY + progress * 2;
                particle.material.opacity = 1 - progress;
                particle.scale.setScalar(1 - progress * 0.5);

                animationId = requestAnimationFrame(animateParticle);
                if (!this.activeAnimations.includes(animationId)) {
                    this.activeAnimations.push(animationId);
                }
            };

            animationId = requestAnimationFrame(animateParticle);
            this.activeAnimations.push(animationId);
        }
    }

    /**
     * Show a speech bubble above Merlin
     * @param {string} text - Text to display
     * @param {number} duration - How long to show (seconds)
     */
    showSpeechBubble(text, duration = 5) {
        this.currentSpeech = text;
        this.speechTimer = duration;

        // Use UIManager if available
        if (this.game?.uiManager) {
            this.game.uiManager.showMerlinSpeech?.(this, text);
        }

        console.log(`[Merlin] Says: "${text}"`);
    }

    hideSpeechBubble() {
        this.currentSpeech = null;

        if (this.game?.uiManager) {
            this.game.uiManager.hideMerlinSpeech?.();
        }
    }

    /**
     * Called when player interacts with Merlin
     */
    interact(player) {
        // Open chat panel with Merlin
        if (this.game?.uiManager) {
            this.game.uiManager.toggleChatPanel(true);
            this.game.uiManager.setChatMode?.('ai');
        }

        this.showSpeechBubble("How can I help you today?", 3);
        return true;
    }

    // Prevent death
    takeDamage(amount, attacker) {
        // Merlin is immune to damage
        this.showSpeechBubble("*magical shield*", 2);
        return;
    }
}
