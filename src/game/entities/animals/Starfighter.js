import * as THREE from 'three';
import { Animal } from '../Animal.js';

/**
 * Starfighter - A responsive spaceship with arcade-style controls
 *
 * Controls:
 * - W/S: Pitch up/down (nose up/nose down)
 * - A/D: Turn left/right (yaw)
 * - Space: Boost (increase speed)
 * - Shift: Brake (decrease speed)
 *
 * The ship always moves forward in the direction it's facing.
 * Banking happens automatically when turning for visual effect.
 */
export class Starfighter extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 4.0;
        this.height = 1.5;
        this.depth = 6.0;
        this.speed = 40.0;
        this.gravity = 0;
        this.isRideable = true;

        // Camera settings
        this.preferFarCamera = true;
        this.cameraDistance = 15;
        this.cameraHeightOffset = 4;

        // Flight state - using quaternion for smooth rotation
        this.flightQuaternion = new THREE.Quaternion();
        this.targetQuaternion = new THREE.Quaternion();

        // Current orientation angles (for reference/debugging)
        this.pitch = 0;    // Nose up/down (-PI/2 to PI/2)
        // Initialize yaw from base rotation (set by Animal constructor or spawn system)
        // This ensures the ship faces the direction it was spawned in
        this.yaw = this.rotation;
        this.roll = 0;     // Visual bank angle

        // Initialize quaternion from initial yaw so ship starts facing correct direction
        this._initializeQuaternion();

        // Speed control
        this.currentSpeed = 15;  // Start at cruise speed
        this.minSpeed = 5;
        this.maxSpeed = 60;
        this.cruiseSpeed = 20;
        this.boostAccel = 30;   // Acceleration when boosting
        this.brakeDecel = 40;   // Deceleration when braking
        this.speedDecay = 0.98; // Natural speed decay toward cruise

        // Control responsiveness
        this.pitchSpeed = 2.0;   // Radians per second
        this.yawSpeed = 1.8;     // Radians per second
        this.rollSpeed = 3.0;    // Visual roll speed
        this.maxPitch = Math.PI * 2;  // Allow full loops (no pitch limit)
        this.autoLevelStrength = 0.5;    // How strongly ship auto-levels when not pitching

        // Engine effects
        this.engineGlows = [];
        this.trailParticles = [];
        this.boostIntensity = 0;

        // Landing state
        this.isLanded = false;

        // Laser weapon system
        this.lasers = [];
        this.laserCooldown = 0;
        this.laserFireRate = 0.15; // Seconds between shots
        this.laserSpeed = 200; // Blocks per second
        this.laserRange = 150; // Max distance before despawn

        this.createBody();

        // Flying vehicles don't need a blob shadow (it causes rendering issues)
        if (this.blobShadow) {
            this.mesh.remove(this.blobShadow);
            this.blobShadow = null;
        }
    }

    /**
     * Initialize quaternion from current yaw/pitch/roll angles.
     * Called after construction and when rotation is externally set.
     */
    _initializeQuaternion() {
        const euler = new THREE.Euler(this.pitch, this.yaw, this.roll, 'YXZ');
        this.flightQuaternion.setFromEuler(euler);
        this.targetQuaternion.copy(this.flightQuaternion);
    }

    /**
     * Set the ship's heading direction. Use this to orient the ship
     * after spawning to face a specific direction.
     * @param {number} yaw - Yaw angle in radians
     */
    setHeading(yaw) {
        this.yaw = yaw;
        this.rotation = yaw;
        this._initializeQuaternion();
        if (this.bodyGroup) {
            this.bodyGroup.quaternion.copy(this.flightQuaternion);
        }
        console.log(`[Starfighter] setHeading: yaw=${(yaw * 180 / Math.PI).toFixed(1)}°`);
    }

    createBody() {
        // Materials
        const hullMat = new THREE.MeshLambertMaterial({ color: 0x445566 });
        const accentMat = new THREE.MeshLambertMaterial({ color: 0x667788 });
        const darkMat = new THREE.MeshLambertMaterial({ color: 0x223344 });
        const cockpitMat = new THREE.MeshLambertMaterial({
            color: 0x66AAFF,
            transparent: true,
            opacity: 0.7
        });
        const engineGlowMat = new THREE.MeshBasicMaterial({
            color: 0x00DDFF,
            transparent: true,
            opacity: 0.8
        });
        const wingTipMat = new THREE.MeshBasicMaterial({ color: 0xFF3300 });

        this.bodyGroup = new THREE.Group();
        this.mesh.add(this.bodyGroup);

        // === MAIN FUSELAGE ===
        // Sleek pointed nose
        const noseGeo = new THREE.ConeGeometry(0.6, 2.5, 8);
        noseGeo.rotateX(-Math.PI / 2);
        const nose = new THREE.Mesh(noseGeo, hullMat);
        nose.position.set(0, 0, 3.5);
        this.bodyGroup.add(nose);

        // Main body
        const bodyGeo = new THREE.BoxGeometry(1.4, 0.8, 4);
        const body = new THREE.Mesh(bodyGeo, hullMat);
        body.position.set(0, 0, 0.5);
        this.bodyGroup.add(body);

        // Cockpit canopy
        const cockpitGeo = new THREE.SphereGeometry(0.6, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
        const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
        cockpit.position.set(0, 0.5, 1.5);
        cockpit.scale.set(1, 0.6, 1.5);
        this.bodyGroup.add(cockpit);

        // === WINGS ===
        const wingGeo = new THREE.BoxGeometry(5, 0.1, 2);

        // Left wing
        const leftWing = new THREE.Mesh(wingGeo, accentMat);
        leftWing.position.set(-2.5, 0, 0);
        leftWing.rotation.z = -0.05; // Slight dihedral
        this.bodyGroup.add(leftWing);

        // Right wing
        const rightWing = new THREE.Mesh(wingGeo, accentMat);
        rightWing.position.set(2.5, 0, 0);
        rightWing.rotation.z = 0.05;
        this.bodyGroup.add(rightWing);

        // Wing tips (red lights)
        const tipGeo = new THREE.SphereGeometry(0.15, 4, 4);
        const leftTip = new THREE.Mesh(tipGeo, wingTipMat);
        leftTip.position.set(-5, 0, 0);
        this.bodyGroup.add(leftTip);

        const rightTip = new THREE.Mesh(tipGeo, new THREE.MeshBasicMaterial({ color: 0x00FF00 }));
        rightTip.position.set(5, 0, 0);
        this.bodyGroup.add(rightTip);

        // === TAIL SECTION ===
        // Vertical stabilizer
        const vStabGeo = new THREE.BoxGeometry(0.1, 1.2, 1.5);
        const vStab = new THREE.Mesh(vStabGeo, darkMat);
        vStab.position.set(0, 0.6, -2);
        this.bodyGroup.add(vStab);

        // Horizontal stabilizers
        const hStabGeo = new THREE.BoxGeometry(2, 0.08, 0.8);
        const hStab = new THREE.Mesh(hStabGeo, darkMat);
        hStab.position.set(0, 0, -2.2);
        this.bodyGroup.add(hStab);

        // === ENGINES ===
        const engineHousingGeo = new THREE.CylinderGeometry(0.35, 0.4, 1.2, 8);
        engineHousingGeo.rotateX(Math.PI / 2);

        const enginePositions = [
            { x: -1.2, y: 0, z: -2.5 },
            { x: 1.2, y: 0, z: -2.5 }
        ];

        enginePositions.forEach(pos => {
            // Engine housing
            const housing = new THREE.Mesh(engineHousingGeo, darkMat);
            housing.position.set(pos.x, pos.y, pos.z);
            this.bodyGroup.add(housing);

            // Engine glow
            const glowGeo = new THREE.CircleGeometry(0.3, 8);
            const glow = new THREE.Mesh(glowGeo, engineGlowMat.clone());
            glow.position.set(pos.x, pos.y, pos.z - 0.7);
            glow.rotation.y = Math.PI;
            this.bodyGroup.add(glow);
            this.engineGlows.push(glow);
        });

        // === DETAILS ===
        // Intake vents on fuselage sides
        const ventGeo = new THREE.BoxGeometry(0.1, 0.3, 0.8);
        [-0.75, 0.75].forEach(x => {
            const vent = new THREE.Mesh(ventGeo, darkMat);
            vent.position.set(x, 0.2, 1);
            this.bodyGroup.add(vent);
        });

        // Hitbox for interaction (invisible)
        const hitBoxGeo = new THREE.BoxGeometry(10, 3, 8);
        const hitBoxMat = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0
        });
        const hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
        hitBox.visible = false; // Hide mesh, not material
        hitBox.position.set(0, 0.5, 0);
        this.mesh.add(hitBox);

        // Ensure frustum culling is disabled on all parts to prevent flickering
        this.mesh.frustumCulled = false;
        this.bodyGroup.frustumCulled = false;
        this.bodyGroup.traverse(child => {
            child.frustumCulled = false;
        });
    }

    updateAI(dt) {
        // When not ridden, hover in place
        if (!this.rider) {
            // Slow down
            this.currentSpeed *= 0.95;
            if (this.currentSpeed < 1) this.currentSpeed = 0;

            // Auto-level
            this.pitch *= 0.95;
            this.roll *= 0.95;

            // Gentle hover bob
            if (this.bodyGroup) {
                this.bodyGroup.position.y = Math.sin(Date.now() * 0.002) * 0.1;
            }

            // Keep above ground
            const groundY = this.game.getWorldHeight?.(this.position.x, this.position.z) ?? 0;
            if (this.position.y < groundY + 2) {
                this.position.y = groundY + 2;
                this.isLanded = true;
            }
        }

        // Update engine glow
        const glowIntensity = 0.3 + (this.currentSpeed / this.maxSpeed) * 0.7;
        this.engineGlows.forEach(glow => {
            glow.material.opacity = glowIntensity;
            glow.scale.setScalar(0.8 + Math.random() * 0.2 + this.boostIntensity * 0.5);
        });

        // Decay boost visual
        this.boostIntensity *= 0.9;
    }

    handleRiding(moveForward, moveRight, jump, rotationY, dt) {
        if (!this.rider) return;

        this.isLanded = false;

        const input = this.game.inputManager;
        const isBraking = input && (input.keys['ShiftLeft'] || input.keys['KeyX']);
        const isBoosting = input && input.keys['KeyE'];

        // === WEAPONS - Space fires lasers ===
        if (jump) {
            this.fireLasers();
        }

        // === SPEED CONTROL ===
        if (isBoosting) {
            // Boost (E key)
            this.currentSpeed += this.boostAccel * dt;
            this.boostIntensity = 1;
        } else if (isBraking) {
            // Brake (Shift)
            this.currentSpeed -= this.brakeDecel * dt;
        } else {
            // Drift toward cruise speed
            if (this.currentSpeed > this.cruiseSpeed) {
                this.currentSpeed -= (this.currentSpeed - this.cruiseSpeed) * dt * 0.5;
            } else if (this.currentSpeed < this.cruiseSpeed) {
                this.currentSpeed += (this.cruiseSpeed - this.currentSpeed) * dt * 0.5;
            }
        }
        this.currentSpeed = THREE.MathUtils.clamp(this.currentSpeed, this.minSpeed, this.maxSpeed);

        // === PITCH CONTROL (W/S) - Inverted flight style ===
        // W = pitch down (dive), S = pitch up (climb)
        // This matches traditional inverted flight controls (pull back to climb)
        if (moveForward > 0) {
            // W = pitch down (nose goes down)
            this.pitch += this.pitchSpeed * dt;
        } else if (moveForward < 0) {
            // S = pitch up (nose goes up)
            this.pitch -= this.pitchSpeed * dt;
        } else {
            // Auto-level pitch toward 0 when not pressing W/S
            // Only auto-level if we're not inverted (doing a loop)
            if (Math.abs(this.pitch) < Math.PI / 2) {
                this.pitch *= (1 - this.autoLevelStrength * dt);
            }
        }
        // Keep pitch in -PI to PI range for smooth loops
        if (this.pitch > Math.PI) this.pitch -= Math.PI * 2;
        if (this.pitch < -Math.PI) this.pitch += Math.PI * 2;

        // === YAW CONTROL (A/D) ===
        if (moveRight < 0) {
            // A = turn left
            this.yaw += this.yawSpeed * dt;
            this.roll = THREE.MathUtils.lerp(this.roll, -0.4, dt * 3); // Bank left
        } else if (moveRight > 0) {
            // D = turn right
            this.yaw -= this.yawSpeed * dt;
            this.roll = THREE.MathUtils.lerp(this.roll, 0.4, dt * 3); // Bank right
        } else {
            // Level out roll when not turning
            this.roll = THREE.MathUtils.lerp(this.roll, 0, dt * 3);
        }

        // Keep yaw in 0 to 2*PI range
        if (this.yaw < 0) this.yaw += Math.PI * 2;
        if (this.yaw > Math.PI * 2) this.yaw -= Math.PI * 2;

        // === BUILD ROTATION FROM EULER ANGLES ===
        // Order: Yaw -> Pitch -> Roll (YXZ)
        const euler = new THREE.Euler(this.pitch, this.yaw, this.roll, 'YXZ');
        this.targetQuaternion.setFromEuler(euler);

        // Smooth interpolation for responsive but not jerky movement
        this.flightQuaternion.slerp(this.targetQuaternion, dt * 8);

        // === CALCULATE MOVEMENT ===
        // Forward direction based on current rotation
        const forward = new THREE.Vector3(0, 0, 1);
        forward.applyQuaternion(this.flightQuaternion);

        // Set velocity
        this.velocity.copy(forward).multiplyScalar(this.currentSpeed);

        // Update entity rotation (for external systems)
        this.rotation = this.yaw;

        // === UPDATE VISUALS ===
        this.updateFlightVisuals();
    }

    updateFlightVisuals() {
        if (!this.bodyGroup) return;

        // Apply rotation to body group
        this.bodyGroup.quaternion.copy(this.flightQuaternion);

        // Engine glow based on speed
        const speedRatio = this.currentSpeed / this.maxSpeed;
        const glowColor = new THREE.Color();
        glowColor.setHSL(0.55 - speedRatio * 0.15, 1, 0.5 + speedRatio * 0.3);

        this.engineGlows.forEach(glow => {
            glow.material.color.copy(glowColor);
            glow.material.opacity = 0.5 + speedRatio * 0.5;
            glow.scale.setScalar(0.8 + speedRatio * 0.4 + this.boostIntensity * 0.3);
        });
    }

    /**
     * Fire lasers from wing cannons
     */
    fireLasers() {
        if (this.laserCooldown > 0) return;
        this.laserCooldown = this.laserFireRate;

        // Get forward direction from flight quaternion
        const forward = new THREE.Vector3(0, 0, 1);
        forward.applyQuaternion(this.flightQuaternion);

        // Wing cannon positions (left and right)
        const cannonOffsets = [
            new THREE.Vector3(-2.5, 0, 2),  // Left wing
            new THREE.Vector3(2.5, 0, 2)    // Right wing
        ];

        cannonOffsets.forEach(offset => {
            // Transform offset by ship rotation
            const worldOffset = offset.clone().applyQuaternion(this.flightQuaternion);
            const startPos = this.position.clone().add(worldOffset);

            // Create laser bolt
            const laserGeo = new THREE.BoxGeometry(0.15, 0.15, 2);
            const laserMat = new THREE.MeshBasicMaterial({
                color: 0xff0000,
                transparent: true,
                opacity: 0.9
            });
            const laser = new THREE.Mesh(laserGeo, laserMat);
            laser.position.copy(startPos);
            laser.quaternion.copy(this.flightQuaternion);

            // Add glow effect
            const glowGeo = new THREE.BoxGeometry(0.3, 0.3, 2.2);
            const glowMat = new THREE.MeshBasicMaterial({
                color: 0xff4400,
                transparent: true,
                opacity: 0.4
            });
            const glow = new THREE.Mesh(glowGeo, glowMat);
            laser.add(glow);

            this.game.scene.add(laser);

            // Track laser data
            this.lasers.push({
                mesh: laser,
                velocity: forward.clone().multiplyScalar(this.laserSpeed),
                startPos: startPos.clone(),
                distance: 0
            });
        });
    }

    /**
     * Update all active lasers
     */
    updateLasers(dt) {
        this.laserCooldown = Math.max(0, this.laserCooldown - dt);

        for (let i = this.lasers.length - 1; i >= 0; i--) {
            const laser = this.lasers[i];

            // Move laser
            const movement = laser.velocity.clone().multiplyScalar(dt);
            laser.mesh.position.add(movement);
            laser.distance += movement.length();

            // Check for block collision
            const hit = this.checkLaserCollision(laser);
            if (hit) {
                this.explodeBlock(hit.x, hit.y, hit.z);
                this.destroyLaser(i);
                continue;
            }

            // Remove if too far
            if (laser.distance > this.laserRange) {
                this.destroyLaser(i);
            }
        }
    }

    /**
     * Check if laser hit a block
     */
    checkLaserCollision(laser) {
        const pos = laser.mesh.position;
        const bx = Math.floor(pos.x);
        const by = Math.floor(pos.y);
        const bz = Math.floor(pos.z);

        // Check current block and nearby
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dz = -1; dz <= 1; dz++) {
                    const x = bx + dx;
                    const y = by + dy;
                    const z = bz + dz;
                    const block = this.game.getBlock(x, y, z);
                    if (block && block !== 'air' && block !== 'water') {
                        // Check actual distance to block center
                        const blockCenter = new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5);
                        if (pos.distanceTo(blockCenter) < 1.0) {
                            return { x, y, z };
                        }
                    }
                }
            }
        }
        return null;
    }

    /**
     * Destroy a block with explosion effect
     */
    explodeBlock(x, y, z) {
        // Remove the block
        this.game.setBlock(x, y, z, null);

        // Create explosion particles
        const particleCount = 12;
        const blockCenter = new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5);

        for (let i = 0; i < particleCount; i++) {
            const particleGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
            const particleMat = new THREE.MeshBasicMaterial({
                color: Math.random() > 0.5 ? 0xff6600 : 0xffaa00,
                transparent: true,
                opacity: 1
            });
            const particle = new THREE.Mesh(particleGeo, particleMat);
            particle.position.copy(blockCenter);

            // Random velocity outward
            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10 + 3,
                (Math.random() - 0.5) * 10
            );

            this.game.scene.add(particle);

            // Animate particle
            const startTime = Date.now();
            const duration = 500 + Math.random() * 300;

            const animateParticle = () => {
                const elapsed = Date.now() - startTime;
                if (elapsed > duration) {
                    this.game.scene.remove(particle);
                    particle.geometry.dispose();
                    particle.material.dispose();
                    return;
                }

                const dt = 0.016;
                particle.position.add(vel.clone().multiplyScalar(dt));
                vel.y -= 15 * dt; // Gravity
                particle.material.opacity = 1 - (elapsed / duration);
                particle.scale.multiplyScalar(0.97);

                requestAnimationFrame(animateParticle);
            };
            animateParticle();
        }

        // Flash effect
        const flashGeo = new THREE.SphereGeometry(1.5, 8, 8);
        const flashMat = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.8
        });
        const flash = new THREE.Mesh(flashGeo, flashMat);
        flash.position.copy(blockCenter);
        this.game.scene.add(flash);

        // Animate flash
        const flashStart = Date.now();
        const animateFlash = () => {
            const elapsed = Date.now() - flashStart;
            if (elapsed > 150) {
                this.game.scene.remove(flash);
                flash.geometry.dispose();
                flash.material.dispose();
                return;
            }
            flash.scale.multiplyScalar(1.1);
            flash.material.opacity = 0.8 * (1 - elapsed / 150);
            requestAnimationFrame(animateFlash);
        };
        animateFlash();
    }

    /**
     * Remove a laser from the scene
     */
    destroyLaser(index) {
        const laser = this.lasers[index];
        this.game.scene.remove(laser.mesh);
        laser.mesh.geometry.dispose();
        laser.mesh.material.dispose();
        this.lasers.splice(index, 1);
    }

    updatePhysics(dt) {
        // Apply velocity to position
        this.position.addScaledVector(this.velocity, dt);

        // Ground collision
        const groundY = this.game.getWorldHeight?.(this.position.x, this.position.z) ?? 0;
        const minHeight = groundY + 1.5;

        if (this.position.y < minHeight) {
            this.position.y = minHeight;
            // Bounce up slightly if diving into ground
            if (this.velocity.y < 0) {
                this.velocity.y = Math.abs(this.velocity.y) * 0.3;
                this.pitch = Math.max(this.pitch, 0.1); // Force nose up
            }
            this.isLanded = true;
        }

        // Sky limit
        if (this.position.y > 500) {
            this.position.y = 500;
            if (this.velocity.y > 0) {
                this.velocity.y = 0;
            }
        }
    }

    interact() {
        if (this.rider) return;

        // Mount the player
        if (this.game.player && !this.game.player.mount) {
            this.game.player.mountEntity(this);
            this.attachRider(this.game.player);
            this.game.uiManager?.addChatMessage('system',
                '🚀 Starfighter: W/S = pitch, A/D = turn, Space = FIRE, E = boost, Shift = brake');
        }
    }

    /**
     * Attach the rider's body to the ship so they rotate with it
     */
    attachRider(player) {
        if (!player.body || !this.bodyGroup) return;

        // Remove player body from scene and add to ship's bodyGroup
        this.game.scene.remove(player.body);
        this.bodyGroup.add(player.body);

        // Position player in cockpit (cockpit is at z=1.5, y=0.5)
        // Adjust for player body pivot point - raise Y so legs aren't under the ship
        player.body.position.set(0, 1.0, 1.2);
        player.body.rotation.set(0, 0, 0); // Face forward in ship's local space

        this._riderAttached = true;
        console.log('[Starfighter] Rider attached to cockpit');
    }

    /**
     * Detach the rider's body from the ship
     */
    detachRider(player) {
        if (!player.body || !this._riderAttached) return;

        // Remove from ship and add back to scene
        this.bodyGroup.remove(player.body);
        this.game.scene.add(player.body);

        // Reset body position to world space
        player.body.position.copy(this.position);
        player.body.position.y += 2;

        this._riderAttached = false;
        console.log('[Starfighter] Rider detached from cockpit');
    }

    /**
     * Override update to handle quaternion-based rotation properly.
     * The base Animal class sets mesh.rotation.y which conflicts with our bodyGroup quaternion.
     */
    update(dt) {
        // Call base class update
        super.update(dt);

        // Override: Don't use mesh.rotation.y for the Starfighter
        // Instead, keep mesh rotation at 0 and let bodyGroup.quaternion handle all rotation
        // The base class sets mesh.rotation.y = this.rotation, but we use bodyGroup quaternion
        this.mesh.rotation.y = 0;

        // Apply the flight quaternion to the body group for visual rotation
        if (this.bodyGroup) {
            this.bodyGroup.quaternion.copy(this.flightQuaternion);
        }

        // Force matrix update to prevent flickering from stale transforms
        this.mesh.updateMatrixWorld(true);

        // Update laser projectiles
        this.updateLasers(dt);
    }
}
