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
        this.yaw = 0;      // Heading (0 to 2*PI)
        this.roll = 0;     // Visual bank angle

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
        this.maxPitch = Math.PI * 0.45;  // Max pitch angle (81 degrees)
        this.autoLevelStrength = 0.5;    // How strongly ship auto-levels when not pitching

        // Engine effects
        this.engineGlows = [];
        this.trailParticles = [];
        this.boostIntensity = 0;

        // Landing state
        this.isLanded = false;

        this.createBody();
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
            visible: false,
            transparent: true,
            opacity: 0
        });
        const hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
        hitBox.position.set(0, 0.5, 0);
        this.mesh.add(hitBox);
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

        // === SPEED CONTROL ===
        if (jump) {
            // Boost (Space)
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

        // === PITCH CONTROL (W/S) ===
        // In Three.js with Euler XYZ and forward = +Z:
        // Negative pitch rotation = nose goes UP (climb)
        // Positive pitch rotation = nose goes DOWN (dive)
        if (moveForward > 0) {
            // W = pitch up (nose goes up) = negative X rotation
            this.pitch -= this.pitchSpeed * dt;
        } else if (moveForward < 0) {
            // S = pitch down (nose goes down) = positive X rotation
            this.pitch += this.pitchSpeed * dt;
        } else {
            // Auto-level pitch toward 0 when not pressing W/S
            this.pitch *= (1 - this.autoLevelStrength * dt);
        }
        this.pitch = THREE.MathUtils.clamp(this.pitch, -this.maxPitch, this.maxPitch);

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
            this.game.uiManager?.addChatMessage('system',
                '🚀 Starfighter controls: W/S = pitch, A/D = turn, Space = boost, Shift = brake');
        }
    }
}
