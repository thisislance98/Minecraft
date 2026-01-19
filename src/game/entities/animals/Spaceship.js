import * as THREE from 'three';
import { Animal } from '../Animal.js';

// Flight physics configuration - tuned for realistic airplane feel
const FLIGHT_CONFIG = {
    // Speed settings (blocks per second)
    MIN_SPEED: 12,        // Stall speed - below this, wings lose lift
    CRUISE_SPEED: 35,     // Comfortable cruising speed
    MAX_SPEED: 70,        // Maximum velocity (dive speed)
    MAX_THROTTLE: 1.0,    // Throttle cap

    // Aerodynamics
    LIFT_COEFFICIENT: 0.08,   // How much lift per unit airspeed squared
    DRAG_COEFFICIENT: 0.015,  // Parasitic drag (air resistance)
    INDUCED_DRAG: 0.02,       // Drag from generating lift (increases with AoA)
    THRUST_POWER: 25,         // Engine acceleration
    GRAVITY: 20,              // Gravity force (blocks/s²)

    // Control rates (radians per second) - control authority scales with airspeed
    PITCH_RATE: 2.0,       // Elevator authority
    ROLL_RATE: 3.0,        // Aileron authority
    YAW_RATE: 0.3,         // Rudder authority (weak - use bank to turn)

    // Aerodynamic limits
    MAX_AOA: Math.PI / 6,     // 30 degrees - beyond this, stall
    CRITICAL_AOA: Math.PI / 5, // 36 degrees - full stall, no lift

    // Stability derivatives (how plane wants to fly)
    PITCH_STABILITY: 1.2,  // Nose wants to return to level
    ROLL_STABILITY: 0.8,   // Wings want to level
    YAW_STABILITY: 0.5,    // Weathervane effect

    // Stall behavior
    STALL_SHAKE_INTENSITY: 0.15,
    STALL_ROLL_TENDENCY: 2.0,  // Wing drop during stall

    // Camera settings
    CAMERA_DISTANCE: 18,
    CAMERA_HEIGHT_OFFSET: 5
};

export class Spaceship extends Animal {
    // Expose config for external tuning if needed
    static CONFIG = FLIGHT_CONFIG;

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
        this.cameraDistance = FLIGHT_CONFIG.CAMERA_DISTANCE;
        this.cameraHeightOffset = FLIGHT_CONFIG.CAMERA_HEIGHT_OFFSET;

        // Airplane flight physics state
        this.throttle = 0;        // 0 to 1 - engine power
        this.angleOfAttack = 0;   // AoA - angle between velocity and nose
        this.pitch = 0;           // Nose up/down angle (radians) - airplane attitude
        this.roll = 0;            // Bank angle (radians)
        this.yaw = 0;             // Heading (radians)
        this.airspeed = 0;        // Forward speed through air (blocks/s)

        // Velocity in world space
        this.flightVelocity = new THREE.Vector3();

        // Stall state
        this.isStalling = false;
        this.stallTimer = 0;

        // Copy config values for easy access
        Object.assign(this, {
            maxThrottle: FLIGHT_CONFIG.MAX_THROTTLE,
            minSpeed: FLIGHT_CONFIG.MIN_SPEED,
            cruiseSpeed: FLIGHT_CONFIG.CRUISE_SPEED,
            maxSpeed: FLIGHT_CONFIG.MAX_SPEED,
            liftCoefficient: FLIGHT_CONFIG.LIFT_COEFFICIENT,
            dragCoefficient: FLIGHT_CONFIG.DRAG_COEFFICIENT,
            inducedDrag: FLIGHT_CONFIG.INDUCED_DRAG,
            thrustPower: FLIGHT_CONFIG.THRUST_POWER,
            gravity: FLIGHT_CONFIG.GRAVITY,
            pitchRate: FLIGHT_CONFIG.PITCH_RATE,
            rollRate: FLIGHT_CONFIG.ROLL_RATE,
            yawRate: FLIGHT_CONFIG.YAW_RATE,
            maxAoA: FLIGHT_CONFIG.MAX_AOA,
            criticalAoA: FLIGHT_CONFIG.CRITICAL_AOA,
            pitchStability: FLIGHT_CONFIG.PITCH_STABILITY,
            rollStability: FLIGHT_CONFIG.ROLL_STABILITY,
            yawStability: FLIGHT_CONFIG.YAW_STABILITY,
            stallShakeIntensity: FLIGHT_CONFIG.STALL_SHAKE_INTENSITY,
            stallRollTendency: FLIGHT_CONFIG.STALL_ROLL_TENDENCY
        });

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
            // When not ridden, plane glides/falls naturally
            this.throttle = 0;

            // Apply aerodynamics even when not ridden
            this.updateAerodynamics(dt, 0, 0, 0);

            // Gradually level out (auto-trim)
            this.pitch = THREE.MathUtils.lerp(this.pitch, 0, dt * 1.5);
            this.roll = THREE.MathUtils.lerp(this.roll, 0, dt * 1.5);

            // Ground collision
            const groundY = this.game.getWorldHeight ?
                this.game.getWorldHeight(this.position.x, this.position.z) : 0;

            if (this.position.y <= groundY + 0.5) {
                this.position.y = groundY + 0.5;
                this.flightVelocity.y = Math.max(0, this.flightVelocity.y);
                this.airspeed *= 0.95; // Ground friction

                // Idle animation on ground
                if (this.bodyGroup) {
                    this.bodyGroup.position.y = Math.sin(Date.now() * 0.002) * 0.03;
                    this.bodyGroup.rotation.x = 0;
                    this.bodyGroup.rotation.z = 0;
                }
            }
        }
    }

    handleRiding(moveForward, moveRight, jump, rotationY, dt) {
        if (!this.rider) return;

        const input = this.game.inputManager;
        const isCrouching = input && (input.keys['ShiftLeft'] || input.keys['KeyX']);

        // === THROTTLE CONTROL ===
        // Space = increase throttle (go faster)
        // Shift = decrease throttle (go slower)
        if (jump) {
            this.throttle = Math.min(this.maxThrottle, this.throttle + dt * 0.5);
        } else if (isCrouching) {
            this.throttle = Math.max(0, this.throttle - dt * 0.7);
        }
        // Throttle holds position when no input (like a real plane)

        // === CONTROL INPUTS ===
        // W = pitch up (pull back), S = pitch down (push forward)
        // A/D = roll left/right (ailerons)
        const pitchInput = moveForward; // W = pitch up, S = pitch down
        const rollInput = -moveRight;   // A = roll left, D = roll right

        // Apply aerodynamic simulation
        this.updateAerodynamics(dt, pitchInput, rollInput, 0);

        // === VISUAL EFFECTS ===
        this.updateVisuals();
    }

    /**
     * Core aerodynamics simulation
     * Models lift, drag, gravity, and control surfaces
     */
    updateAerodynamics(dt, pitchInput, rollInput, yawInput) {
        // === CONTROL AUTHORITY ===
        // Control surfaces only work with airflow - less authority at low speeds
        const dynamicPressure = 0.5 * this.airspeed * this.airspeed;
        const controlAuthority = Math.min(1.0, this.airspeed / this.cruiseSpeed);
        const minAuthority = 0.15; // Some authority even at low speed

        // === PITCH (Elevator) ===
        if (pitchInput !== 0) {
            const authority = Math.max(minAuthority, controlAuthority);
            this.pitch += pitchInput * this.pitchRate * authority * dt;
        } else {
            // Pitch stability - nose wants to return toward horizon
            this.pitch = THREE.MathUtils.lerp(this.pitch, 0, this.pitchStability * controlAuthority * dt);
        }
        // Clamp pitch to prevent crazy angles
        this.pitch = THREE.MathUtils.clamp(this.pitch, -Math.PI / 3, Math.PI / 3);

        // === ROLL (Ailerons) ===
        const maxBank = Math.PI * 0.6; // ~108 degrees - allows inverted flight
        if (rollInput !== 0) {
            const authority = Math.max(minAuthority, controlAuthority);
            this.roll += rollInput * this.rollRate * authority * dt;
        } else {
            // Roll stability - wings want to level
            this.roll = THREE.MathUtils.lerp(this.roll, 0, this.rollStability * controlAuthority * dt);
        }
        this.roll = THREE.MathUtils.clamp(this.roll, -maxBank, maxBank);

        // === ANGLE OF ATTACK ===
        // AoA is the angle between where we're pointing and where we're going
        // Simplified: pitch angle relative to flight path
        if (this.airspeed > 1) {
            const flightPathAngle = Math.atan2(this.flightVelocity.y, this.airspeed);
            this.angleOfAttack = this.pitch - flightPathAngle;
        } else {
            this.angleOfAttack = this.pitch;
        }

        // === STALL DETECTION ===
        const aoaMagnitude = Math.abs(this.angleOfAttack);
        const speedStall = this.airspeed < this.minSpeed;
        const aoaStall = aoaMagnitude > this.maxAoA;
        this.isStalling = speedStall || aoaStall;

        if (this.isStalling) {
            this.stallTimer += dt;
        } else {
            this.stallTimer = Math.max(0, this.stallTimer - dt * 2);
        }

        // === LIFT CALCULATION ===
        // Lift = Cl * dynamicPressure, where Cl depends on AoA
        let liftCoeff = this.liftCoefficient;

        if (aoaMagnitude < this.maxAoA) {
            // Normal flight - lift increases with AoA (simplified)
            liftCoeff *= (1 + Math.sin(this.angleOfAttack) * 3);
        } else if (aoaMagnitude < this.criticalAoA) {
            // Approaching stall - lift starts decreasing
            const stallProgress = (aoaMagnitude - this.maxAoA) / (this.criticalAoA - this.maxAoA);
            liftCoeff *= (1 - stallProgress * 0.5);
        } else {
            // Full stall - massive lift loss
            liftCoeff *= 0.3;
        }

        // Speed stall - not enough airspeed for lift
        if (speedStall && this.airspeed > 0) {
            const speedRatio = this.airspeed / this.minSpeed;
            liftCoeff *= speedRatio * speedRatio; // Lift drops off rapidly
        }

        // Calculate lift force (perpendicular to velocity, in plane's "up" direction)
        const lift = liftCoeff * dynamicPressure;

        // Lift is reduced when banking (need to pull harder in turns!)
        const bankFactor = Math.cos(this.roll);
        const effectiveLift = lift * Math.abs(bankFactor);

        // === DRAG CALCULATION ===
        // Total drag = parasitic drag + induced drag
        const parasiticDrag = this.dragCoefficient * dynamicPressure;

        // Induced drag increases with lift (and AoA)
        const inducedDragForce = this.inducedDrag * lift * Math.abs(Math.sin(this.angleOfAttack));

        const totalDrag = parasiticDrag + inducedDragForce;

        // === THRUST ===
        const thrust = this.throttle * this.thrustPower;

        // === TURN PHYSICS ===
        // Banking creates a horizontal lift component that turns the plane
        // Steeper bank = tighter turn, but requires back pressure to maintain altitude
        const turnAccel = Math.sin(this.roll) * lift * 0.05;
        const turnRate = turnAccel / Math.max(10, this.airspeed); // Tighter turns at low speed
        this.yaw += turnRate * dt;

        // Update visual heading
        this.rotation = this.yaw;

        // === CALCULATE FORCES IN WORLD SPACE ===

        // Forward direction (where nose is pointing horizontally)
        const forwardDir = new THREE.Vector3(
            -Math.sin(this.yaw),
            0,
            -Math.cos(this.yaw)
        );

        // 3D nose direction (accounts for pitch)
        const noseDir = new THREE.Vector3(
            -Math.sin(this.yaw) * Math.cos(this.pitch),
            Math.sin(this.pitch),
            -Math.cos(this.yaw) * Math.cos(this.pitch)
        );

        // === UPDATE VELOCITY ===

        // Thrust acts along nose direction
        this.flightVelocity.addScaledVector(noseDir, thrust * dt);

        // Drag opposes velocity
        if (this.airspeed > 0.1) {
            const dragDir = this.flightVelocity.clone().normalize().negate();
            this.flightVelocity.addScaledVector(dragDir, totalDrag * dt);
        }

        // Lift acts perpendicular to velocity, in the "up" direction of the plane
        // For simplicity: lift reduces descent / increases climb based on pitch and AoA
        const liftForce = effectiveLift - this.gravity;
        this.flightVelocity.y += liftForce * dt;

        // === STALL EFFECTS ===
        if (this.isStalling && this.stallTimer > 0.5) {
            // Wing drop - plane tends to roll when stalled
            const wingDrop = (Math.random() - 0.5) * this.stallRollTendency * dt;
            this.roll += wingDrop;

            // Nose drop - plane pitches down to regain airspeed
            this.pitch = THREE.MathUtils.lerp(this.pitch, -0.3, dt * 0.5);
        }

        // === UPDATE AIRSPEED ===
        // Airspeed is the magnitude of horizontal velocity + component of vertical
        const horizontalSpeed = Math.sqrt(
            this.flightVelocity.x * this.flightVelocity.x +
            this.flightVelocity.z * this.flightVelocity.z
        );
        this.airspeed = Math.sqrt(horizontalSpeed * horizontalSpeed + this.flightVelocity.y * this.flightVelocity.y);
        this.airspeed = Math.min(this.airspeed, this.maxSpeed);

        // === APPLY TO ENTITY VELOCITY ===
        this.velocity.copy(this.flightVelocity);
    }

    updateVisuals() {
        // Thruster glow based on throttle
        this.thrusters.forEach(t => {
            const scale = 1 + this.throttle * 0.8;
            t.scale.set(scale, scale * 1.5, scale);
            if (t.material) {
                const intensity = 0.5 + this.throttle * 0.5;
                t.material.color.setRGB(0, intensity, intensity);
            }
        });

        // Apply pitch and roll to body group
        if (this.bodyGroup) {
            this.bodyGroup.rotation.z = this.roll;
            this.bodyGroup.rotation.x = -this.pitch;

            // Reset position for stall shake
            this.bodyGroup.position.x = 0;
            this.bodyGroup.position.z = 0;
            this.bodyGroup.position.y = 0;

            // Stall warning - buffeting and shake
            if (this.isStalling || this.airspeed < this.minSpeed * 1.2) {
                const intensity = this.isStalling ? this.stallShakeIntensity : this.stallShakeIntensity * 0.5;
                this.bodyGroup.position.x = (Math.random() - 0.5) * intensity;
                this.bodyGroup.position.z = (Math.random() - 0.5) * intensity;
            }

            // High AoA buffet
            if (Math.abs(this.angleOfAttack) > this.maxAoA * 0.7) {
                const buffet = (Math.abs(this.angleOfAttack) - this.maxAoA * 0.7) / (this.maxAoA * 0.3);
                this.bodyGroup.position.x += (Math.random() - 0.5) * buffet * 0.1;
                this.bodyGroup.position.y += (Math.random() - 0.5) * buffet * 0.05;
            }
        }
    }

    updatePhysics(dt) {
        const oldY = this.position.y;
        this.position.addScaledVector(this.velocity, dt);

        // Debug: Log flight status periodically
        if (this.rider && Math.floor(Date.now() / 2000) !== Math.floor((Date.now() - dt * 1000) / 2000)) {
            const status = this.isStalling ? ' [STALL]' : '';
            console.log(`[Airplane] Alt: ${this.position.y.toFixed(0)}, Speed: ${this.airspeed.toFixed(1)}, Throttle: ${(this.throttle * 100).toFixed(0)}%, AoA: ${(this.angleOfAttack * 180 / Math.PI).toFixed(1)}°${status}`);
        }

        // Ground collision
        let groundY = this.game.getWorldHeight ? this.game.getWorldHeight(this.position.x, this.position.z) : 0;
        const minHeight = groundY + 0.5;

        if (this.position.y < minHeight) {
            this.position.y = minHeight;

            // Ground impact - stop vertical velocity, reduce horizontal
            if (this.flightVelocity.y < -5) {
                // Hard landing
                console.log(`[Airplane] Hard landing! Impact velocity: ${this.flightVelocity.y.toFixed(1)}`);
            }

            this.flightVelocity.y = Math.max(0, this.flightVelocity.y);
            this.velocity.y = Math.max(0, this.velocity.y);

            // Ground friction when on ground
            if (this.airspeed < this.minSpeed) {
                this.flightVelocity.x *= 0.98;
                this.flightVelocity.z *= 0.98;
                this.velocity.x *= 0.98;
                this.velocity.z *= 0.98;
            }
        }

        // Altitude limit (atmosphere ends)
        const maxAltitude = 500;
        if (this.position.y > maxAltitude) {
            this.position.y = maxAltitude;
            if (this.flightVelocity.y > 0) {
                this.flightVelocity.y *= 0.9;
            }
        }
    }
}
