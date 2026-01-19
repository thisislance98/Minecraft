import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Spaceship extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 3.0;
        this.height = 2.0;
        this.depth = 3.0;
        this.speed = 50.0;
        this.gravity = 0;
        this.thrusters = [];

        // Make this rideable
        this.isRideable = true;

        // Use far follow camera by default
        this.preferFarCamera = true;
        this.cameraDistance = 15;
        this.cameraHeightOffset = 6;

        // Airplane flight physics
        this.throttle = 0; // 0 to 1
        this.pitch = 0; // Nose up/down angle (radians)
        this.roll = 0; // Bank angle (radians)
        this.yaw = 0; // Heading (radians)
        this.airspeed = 0; // Forward speed through air
        this.verticalSpeed = 0;

        // Airplane flight constants - tuned for fun, intuitive flight
        this.maxThrottle = 1.0;
        this.minSpeed = 15; // Stall speed - below this, plane descends
        this.cruiseSpeed = 40; // Comfortable cruising speed
        this.maxSpeed = 80;
        this.dragCoefficient = 0.01; // Air resistance
        this.pitchRate = 1.5; // Radians per second - how fast you can pitch
        this.rollRate = 2.5; // Radians per second - how fast you can roll
        this.yawFromRoll = 1.0; // How much banking turns the plane
        this.thrustPower = 30; // Engine acceleration
        this.stallAngle = Math.PI / 4; // 45 degrees - max pitch angle

        // Stability - plane auto-levels when no input
        this.pitchStability = 0.5; // Returns to level pitch
        this.rollStability = 2.0; // Returns to wings-level

        // Gravity when not ridden (for landing)
        this.gravityForce = 15;

        this.createBody();
    }

    createBody() {
        // Materials
        const hullMat = new THREE.MeshLambertMaterial({ color: 0x445566 });
        const trimMat = new THREE.MeshLambertMaterial({ color: 0x6688aa });
        const glassMat = new THREE.MeshLambertMaterial({ 
            color: 0x88ccff, 
            transparent: true, 
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        const glowMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });

        this.bodyGroup = new THREE.Group();
        this.mesh.add(this.bodyGroup);

        // Main Disc Hull
        const mainHull = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 0.6, 12), hullMat);
        mainHull.position.y = 0.5;
        this.bodyGroup.add(mainHull);

        // Top Dome (Cockpit)
        const cockpit = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2), glassMat);
        cockpit.position.y = 0.7;
        this.bodyGroup.add(cockpit);

        // Bottom Plate
        const bottomPlate = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 1.5, 0.3, 12), trimMat);
        bottomPlate.position.y = 0.1;
        this.bodyGroup.add(bottomPlate);

        // Engine Thrusters
        this.thrusters = [];
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.2, 8), glowMat);
            thruster.position.set(Math.cos(angle) * 1.6, 0, Math.sin(angle) * 1.6);
            this.bodyGroup.add(thruster);
            this.thrusters.push(thruster);
        }

        // Interior visual
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.6), trimMat);
        seat.position.y = 0.5;
        this.bodyGroup.add(seat);
    }

    updateAI(dt) {
        if (!this.rider) {
            // Reset flight state when not ridden
            this.throttle = 0;
            this.airspeed *= 0.95; // Slow down
            this.verticalSpeed *= 0.95;

            // Gradually level out
            this.pitch = THREE.MathUtils.lerp(this.pitch, 0, dt * 2);
            this.roll = THREE.MathUtils.lerp(this.roll, 0, dt * 2);

            // Apply gravity when not ridden
            const groundY = this.game.getWorldHeight ?
                this.game.getWorldHeight(this.position.x, this.position.z) : 0;

            if (this.position.y > groundY + 0.5) {
                this.velocity.y -= this.gravityForce * 0.3 * dt; // Gentle descent
            } else {
                this.velocity.y = 0;
                this.position.y = groundY + 0.5;
                this.airspeed = 0;
            }

            this.velocity.x *= 0.95;
            this.velocity.z *= 0.95;

            // Idle hover bob
            if (this.bodyGroup && this.position.y <= groundY + 0.6) {
                this.bodyGroup.position.y = Math.sin(Date.now() * 0.002) * 0.05;
                this.bodyGroup.rotation.x = 0;
                this.bodyGroup.rotation.z = 0;
            }
        }

        // Update body group to reflect pitch/roll
        if (this.bodyGroup && this.rider) {
            // Already handled in handleRiding
        }
    }

    handleRiding(moveForward, moveRight, jump, rotationY, dt) {
        if (!this.rider) return;

        const input = this.game.inputManager;

        // === THROTTLE CONTROL ===
        // W increases throttle, S decreases (smooth ramping)
        if (moveForward > 0) {
            this.throttle = Math.min(this.maxThrottle, this.throttle + dt * 0.6);
        } else if (moveForward < 0) {
            this.throttle = Math.max(0, this.throttle - dt * 0.8);
        } else {
            // Throttle holds position when no input (realistic)
        }

        // === PITCH CONTROL (elevator) ===
        // Space = pull back (nose up → climb), Shift = push forward (nose down → descend)
        const isCrouching = input && (input.keys['ShiftLeft'] || input.keys['KeyX']);
        const pitchInput = jump ? 1 : (isCrouching ? -1 : 0);

        if (pitchInput !== 0) {
            // Pitch works even at low speeds (minimum 30% authority)
            const speedAuthority = Math.max(0.3, Math.min(1.0, this.airspeed / this.cruiseSpeed));
            this.pitch += pitchInput * this.pitchRate * speedAuthority * dt;
            this.pitch = THREE.MathUtils.clamp(this.pitch, -this.stallAngle * 0.8, this.stallAngle);
        } else {
            // Pitch stability - gently returns to level (trim)
            this.pitch = THREE.MathUtils.lerp(this.pitch, 0, this.pitchStability * dt);
        }

        // === ROLL CONTROL (ailerons) ===
        // A = roll left, D = roll right
        const maxBank = Math.PI / 2.5; // 72 degrees max bank
        if (moveRight !== 0) {
            const speedAuthority = Math.min(1.0, this.airspeed / this.cruiseSpeed);
            this.roll -= moveRight * this.rollRate * speedAuthority * dt;
            this.roll = THREE.MathUtils.clamp(this.roll, -maxBank, maxBank);
        } else {
            // Roll stability - wings want to level out
            this.roll = THREE.MathUtils.lerp(this.roll, 0, this.rollStability * dt);
        }

        // === AIRSPEED PHYSICS ===

        // Thrust from throttle
        const thrust = this.throttle * this.thrustPower;

        // Drag proportional to speed (simplified)
        const drag = this.airspeed * this.dragCoefficient * 2;

        // Update airspeed
        this.airspeed += (thrust - drag) * dt;
        this.airspeed = THREE.MathUtils.clamp(this.airspeed, 0, this.maxSpeed);

        // === SIMPLIFIED AIRPLANE PHYSICS ===
        // Design: Plane flies LEVEL by default when throttle is applied
        // Pitch up (Space) = climb, Pitch down (Shift) = descend
        // This is more intuitive for a game than realistic physics

        // Calculate how much the plane should climb/descend based on pitch
        // At level pitch (0), vertical speed tends toward 0 (level flight)
        // Higher multiplier = more responsive climb/descend
        const targetVerticalSpeed = Math.sin(this.pitch) * this.airspeed * 1.8;

        // When banking, the plane loses some lift and descends slightly
        // This encourages pulling back during turns (realistic behavior)
        const bankLiftLoss = (1 - Math.cos(this.roll)) * 8;

        // Stall behavior - below stall speed, plane loses lift and descends
        let stallEffect = 0;
        if (this.airspeed < this.minSpeed && this.airspeed > 0) {
            const stallSeverity = 1 - (this.airspeed / this.minSpeed);
            stallEffect = -stallSeverity * 20; // Descend when stalling
        }

        // Calculate target vertical speed
        const desiredVerticalSpeed = targetVerticalSpeed - bankLiftLoss + stallEffect;

        // Smoothly adjust vertical speed toward target (feels like air resistance)
        const verticalResponse = 3.0; // How quickly vertical speed changes
        this.verticalSpeed = THREE.MathUtils.lerp(this.verticalSpeed, desiredVerticalSpeed, verticalResponse * dt);

        // Clamp vertical speed
        this.verticalSpeed = THREE.MathUtils.clamp(this.verticalSpeed, -40, 40);

        // === TURN PHYSICS ===
        // Banking causes turn - this is how real planes turn!
        // Steeper bank = tighter turn, but needs more back pressure to maintain altitude
        const turnRate = Math.sin(this.roll) * this.yawFromRoll * (this.airspeed / this.cruiseSpeed);
        this.yaw += turnRate * dt;

        // Update visual rotation to match yaw
        this.rotation = this.yaw;

        // === CALCULATE FINAL VELOCITY ===
        const forwardDir = new THREE.Vector3(
            -Math.sin(this.yaw),
            0,
            -Math.cos(this.yaw)
        );

        this.velocity.set(
            forwardDir.x * this.airspeed,
            this.verticalSpeed,
            forwardDir.z * this.airspeed
        );

        // === VISUAL EFFECTS ===

        // Thruster glow based on throttle
        this.thrusters.forEach(t => {
            const scale = 1 + this.throttle * 0.8;
            t.scale.set(scale, scale * 1.5, scale);
            if (t.material) {
                const intensity = 0.5 + this.throttle * 0.5;
                t.material.color.setRGB(0, intensity, intensity);
            }
        });

        // Apply pitch and roll to body group (visual rotation)
        if (this.bodyGroup) {
            this.bodyGroup.rotation.z = this.roll;
            this.bodyGroup.rotation.x = -this.pitch;

            // Reset position offset
            this.bodyGroup.position.x = 0;
            this.bodyGroup.position.z = 0;
        }

        // Stall warning - shake and buffet when approaching stall
        const stallProximity = this.airspeed / this.minSpeed;
        if (stallProximity < 1.3 && stallProximity > 0.3) {
            const shakeIntensity = (1.3 - stallProximity) * 0.3;
            if (this.bodyGroup) {
                this.bodyGroup.position.x = (Math.random() - 0.5) * shakeIntensity;
                this.bodyGroup.position.z = (Math.random() - 0.5) * shakeIntensity;
            }
        }

        // High pitch angle buffet
        const pitchAngle = Math.abs(this.pitch);
        if (pitchAngle > this.stallAngle * 0.6) {
            const buffetIntensity = (pitchAngle - this.stallAngle * 0.6) / (this.stallAngle * 0.4) * 0.15;
            if (this.bodyGroup) {
                this.bodyGroup.position.x += (Math.random() - 0.5) * buffetIntensity;
                this.bodyGroup.position.z += (Math.random() - 0.5) * buffetIntensity;
            }
        }
    }

    updatePhysics(dt) {
        this.position.addScaledVector(this.velocity, dt);

        let groundY = this.game.getWorldHeight ? this.game.getWorldHeight(this.position.x, this.position.z) : 0;
        const minHeight = groundY + 0.5;
        if (this.position.y < minHeight) {
            this.position.y = minHeight;
            if (this.velocity.y < 0) this.velocity.y = 0;
        }
    }
}
