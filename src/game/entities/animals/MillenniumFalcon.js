import * as THREE from 'three';
import { Animal } from '../Animal.js';

// Airplane physics - based on R3F-takes-flight approach
// Uses axis-angle rotation with velocity-based controls
const FLIGHT_CONFIG = {
    // Movement
    BASE_SPEED: 0.4,       // Base forward speed (always moving forward)
    TURBO_MAX: 1.5,        // Max additional speed from throttle

    // Control velocities - how much rotation per frame when key held
    PITCH_ACCEL: 0.003,    // How fast pitch velocity builds up
    YAW_ACCEL: 0.003,      // How fast yaw velocity builds up (A/D turn)

    // Velocity limits
    MAX_PITCH_VEL: 0.04,   // Max pitch rotation per frame
    MAX_YAW_VEL: 0.04,     // Max yaw rotation per frame

    // Friction - velocities decay each frame (0.95 = 5% decay)
    VELOCITY_FRICTION: 0.95,

    // Throttle
    THROTTLE_ACCEL: 0.03,  // How fast throttle builds
    THROTTLE_DECAY: 0.97,  // How fast throttle decays when not pressing
};

/**
 * MillenniumFalcon - A rideable spaceship inspired by the iconic freighter
 * Features airplane-style flight controls with aerodynamics
 */
export class MillenniumFalcon extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 6.0;
        this.height = 2.0;
        this.depth = 8.0;
        this.speed = 60.0;
        this.gravity = 0;
        this.isRideable = true;

        // Engine effects
        this.engineGlows = [];
        this.engineParticles = [];

        // Landing gear state
        this.isLanded = true;
        this.landingGearY = 0;

        // Flight state using axis-angle rotation (like R3F-takes-flight)
        this.throttle = 0;           // 0 to 1

        // Local coordinate axes (define plane orientation)
        this.xAxis = new THREE.Vector3(1, 0, 0);  // Right
        this.yAxis = new THREE.Vector3(0, 1, 0);  // Up
        this.zAxis = new THREE.Vector3(0, 0, 1);  // Forward (plane flies along -Z)

        // Control velocities (build up with input, decay with friction)
        this.pitchVelocity = 0;
        this.yawVelocity = 0;

        // Copy config
        this.baseSpeed = FLIGHT_CONFIG.BASE_SPEED;
        this.turboMax = FLIGHT_CONFIG.TURBO_MAX;
        this.pitchAccel = FLIGHT_CONFIG.PITCH_ACCEL;
        this.yawAccel = FLIGHT_CONFIG.YAW_ACCEL;
        this.maxPitchVel = FLIGHT_CONFIG.MAX_PITCH_VEL;
        this.maxYawVel = FLIGHT_CONFIG.MAX_YAW_VEL;
        this.velocityFriction = FLIGHT_CONFIG.VELOCITY_FRICTION;
        this.throttleAccel = FLIGHT_CONFIG.THROTTLE_ACCEL;
        this.throttleDecay = FLIGHT_CONFIG.THROTTLE_DECAY;

        this.createBody();
    }

    createBody() {
        // Materials
        const hullMat = new THREE.MeshLambertMaterial({ color: 0x8899AA }); // Grey-blue hull
        const darkHullMat = new THREE.MeshLambertMaterial({ color: 0x556677 }); // Darker panels
        const accentMat = new THREE.MeshLambertMaterial({ color: 0x334455 }); // Dark accents
        const glassMat = new THREE.MeshLambertMaterial({
            color: 0x88CCFF,
            transparent: true,
            opacity: 0.6
        });
        const engineGlowMat = new THREE.MeshBasicMaterial({
            color: 0x00AAFF,
            transparent: true,
            opacity: 0.8
        });
        const lightMat = new THREE.MeshBasicMaterial({ color: 0xFFFFAA });

        this.bodyGroup = new THREE.Group();
        this.mesh.add(this.bodyGroup);

        // === MAIN HULL - Disc shape ===
        // The Falcon has a distinctive saucer shape
        const mainHullGeo = new THREE.CylinderGeometry(4, 4.5, 1.2, 16);
        const mainHull = new THREE.Mesh(mainHullGeo, hullMat);
        mainHull.position.set(0, 0.6, 0);
        this.bodyGroup.add(mainHull);

        // Top dome details
        const topDomeGeo = new THREE.CylinderGeometry(3, 3.5, 0.4, 16);
        const topDome = new THREE.Mesh(topDomeGeo, darkHullMat);
        topDome.position.set(0, 1.4, 0);
        this.bodyGroup.add(topDome);

        // === COCKPIT - Off-center to the right ===
        const cockpitGroup = new THREE.Group();
        cockpitGroup.position.set(2.5, 0.8, 3.5);

        // Cockpit tube
        const cockpitTubeGeo = new THREE.CylinderGeometry(0.8, 1.0, 1.5, 8);
        cockpitTubeGeo.rotateX(Math.PI / 2);
        const cockpitTube = new THREE.Mesh(cockpitTubeGeo, hullMat);
        cockpitGroup.add(cockpitTube);

        // Cockpit window
        const cockpitWindowGeo = new THREE.SphereGeometry(0.7, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const cockpitWindow = new THREE.Mesh(cockpitWindowGeo, glassMat);
        cockpitWindow.rotation.x = -Math.PI / 2;
        cockpitWindow.position.z = 0.8;
        cockpitGroup.add(cockpitWindow);

        this.bodyGroup.add(cockpitGroup);

        // === MANDIBLES - Front forks ===
        const mandibleMat = hullMat;

        // Left mandible
        const leftMandibleGeo = new THREE.BoxGeometry(1.2, 0.8, 4);
        const leftMandible = new THREE.Mesh(leftMandibleGeo, mandibleMat);
        leftMandible.position.set(-1.8, 0.4, 4);
        this.bodyGroup.add(leftMandible);

        // Right mandible
        const rightMandible = new THREE.Mesh(leftMandibleGeo, mandibleMat);
        rightMandible.position.set(1.8, 0.4, 4);
        this.bodyGroup.add(rightMandible);

        // Mandible connectors (front plate)
        const frontPlateGeo = new THREE.BoxGeometry(2.4, 0.6, 0.5);
        const frontPlate = new THREE.Mesh(frontPlateGeo, darkHullMat);
        frontPlate.position.set(0, 0.4, 6);
        this.bodyGroup.add(frontPlate);

        // === REAR SECTION ===
        // Engine block
        const rearBlockGeo = new THREE.BoxGeometry(3, 1.5, 2);
        const rearBlock = new THREE.Mesh(rearBlockGeo, darkHullMat);
        rearBlock.position.set(0, 0.75, -4);
        this.bodyGroup.add(rearBlock);

        // === ENGINE EXHAUSTS ===
        // Three main engines at the rear
        const enginePositions = [
            { x: -1, y: 0.75, z: -5 },
            { x: 0, y: 0.75, z: -5 },
            { x: 1, y: 0.75, z: -5 }
        ];

        enginePositions.forEach(pos => {
            // Engine housing
            const engineHousingGeo = new THREE.CylinderGeometry(0.4, 0.5, 0.8, 8);
            engineHousingGeo.rotateX(Math.PI / 2);
            const engineHousing = new THREE.Mesh(engineHousingGeo, accentMat);
            engineHousing.position.set(pos.x, pos.y, pos.z);
            this.bodyGroup.add(engineHousing);

            // Engine glow
            const engineGlowGeo = new THREE.CircleGeometry(0.35, 8);
            const engineGlow = new THREE.Mesh(engineGlowGeo, engineGlowMat);
            engineGlow.position.set(pos.x, pos.y, pos.z - 0.5);
            engineGlow.rotation.y = Math.PI;
            this.bodyGroup.add(engineGlow);
            this.engineGlows.push(engineGlow);
        });

        // === RADAR DISH ===
        const radarGroup = new THREE.Group();
        radarGroup.position.set(0, 1.8, 0);

        const dishGeo = new THREE.CylinderGeometry(0.8, 0.3, 0.3, 12);
        const dish = new THREE.Mesh(dishGeo, hullMat);
        radarGroup.add(dish);

        const antennaGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 4);
        const antenna = new THREE.Mesh(antennaGeo, accentMat);
        antenna.position.y = 0.4;
        radarGroup.add(antenna);

        this.radarDish = radarGroup;
        this.bodyGroup.add(radarGroup);

        // === LANDING GEAR (3 struts) ===
        this.landingGear = new THREE.Group();
        const strutGeo = new THREE.CylinderGeometry(0.1, 0.15, 0.8, 6);
        const footGeo = new THREE.CylinderGeometry(0.3, 0.35, 0.1, 8);

        const strutPositions = [
            { x: 0, z: 3 },      // Front
            { x: -2.5, z: -2 }, // Rear left
            { x: 2.5, z: -2 }   // Rear right
        ];

        strutPositions.forEach(pos => {
            const strut = new THREE.Mesh(strutGeo, accentMat);
            strut.position.set(pos.x, -0.4, pos.z);
            this.landingGear.add(strut);

            const foot = new THREE.Mesh(footGeo, accentMat);
            foot.position.set(pos.x, -0.85, pos.z);
            this.landingGear.add(foot);
        });

        this.bodyGroup.add(this.landingGear);

        // === HULL DETAILS ===
        // Panel lines and greebles
        const panelGeo = new THREE.BoxGeometry(1, 0.05, 1);
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const r = 3;
            const panel = new THREE.Mesh(panelGeo, darkHullMat);
            panel.position.set(
                Math.cos(angle) * r,
                1.25,
                Math.sin(angle) * r
            );
            panel.rotation.y = angle;
            this.bodyGroup.add(panel);
        }

        // === LIGHTS ===
        // Running lights
        const lightGeo = new THREE.SphereGeometry(0.1, 4, 4);
        const lightPositions = [
            { x: -4.2, y: 0.6, z: 0 },  // Port
            { x: 4.2, y: 0.6, z: 0 },   // Starboard
            { x: 0, y: 0.6, z: 6.2 },   // Front
        ];

        lightPositions.forEach(pos => {
            const light = new THREE.Mesh(lightGeo, lightMat);
            light.position.set(pos.x, pos.y, pos.z);
            this.bodyGroup.add(light);
        });

        // Hitbox for easier mounting (invisible)
        const hitBoxGeo = new THREE.BoxGeometry(10, 4, 14);
        const hitBoxMat = new THREE.MeshBasicMaterial({
            visible: true,
            transparent: true,
            opacity: 0.0,
            depthWrite: false
        });
        const hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
        hitBox.position.set(0, 1, 0);
        this.mesh.add(hitBox);
    }

    updateAI(dt) {
        // Radar dish rotation
        if (this.radarDish) {
            this.radarDish.rotation.y += dt * 0.5;
        }

        // When not ridden, slowly decay velocities
        if (!this.rider) {
            this.throttle *= 0.98;
            this.pitchVelocity *= 0.9;
            this.yawVelocity *= 0.9;

            const groundY = this.game.getWorldHeight ?
                this.game.getWorldHeight(this.position.x, this.position.z) : 0;

            if (this.position.y <= groundY + 1.5) {
                this.position.y = groundY + 1.5;
                this.velocity.set(0, 0, 0);
                this.isLanded = true;

                // Idle hover bob when landed
                if (this.bodyGroup) {
                    this.bodyGroup.position.y = Math.sin(Date.now() * 0.001) * 0.05;
                }
            }
        }

        // Engine glow intensity
        const glowIntensity = 0.3 + this.throttle * 0.7;
        this.engineGlows.forEach(glow => {
            glow.material.opacity = glowIntensity;
            glow.scale.setScalar(0.9 + Math.random() * 0.2 + this.throttle * 0.3);
        });
    }

    handleRiding(moveForward, moveRight, jump, rotationY, dt) {
        if (!this.rider) return;

        this.isLanded = false;

        const input = this.game.inputManager;
        const isCrouching = input && (input.keys['ShiftLeft'] || input.keys['KeyX']);

        // === THROTTLE ===
        // Space = increase throttle, Shift = decrease
        if (jump) {
            this.throttle = Math.min(1.0, this.throttle + this.throttleAccel);
        } else if (isCrouching) {
            this.throttle = Math.max(0, this.throttle - this.throttleAccel * 2);
        } else {
            // Throttle slowly decays
            this.throttle *= this.throttleDecay;
        }

        // === CONTROL INPUTS ===
        // W/S = pitch (W = nose up, S = nose down)
        // A/D = yaw/turn (A = turn left, D = turn right)

        // Add to velocities based on input
        if (moveForward > 0) {
            // W pressed - pitch up (nose goes up)
            this.pitchVelocity -= this.pitchAccel;
        } else if (moveForward < 0) {
            // S pressed - pitch down (nose goes down)
            this.pitchVelocity += this.pitchAccel;
        }

        if (moveRight > 0) {
            // D pressed - turn right (yaw)
            this.yawVelocity -= this.yawAccel;
        } else if (moveRight < 0) {
            // A pressed - turn left (yaw)
            this.yawVelocity += this.yawAccel;
        }

        // Apply friction to velocities
        this.pitchVelocity *= this.velocityFriction;
        this.yawVelocity *= this.velocityFriction;

        // Clamp velocities
        this.pitchVelocity = THREE.MathUtils.clamp(this.pitchVelocity, -this.maxPitchVel, this.maxPitchVel);
        this.yawVelocity = THREE.MathUtils.clamp(this.yawVelocity, -this.maxYawVel, this.maxYawVel);

        // Update flight
        this.updateFlight();
        this.updateFlightVisuals();
    }

    /**
     * Axis-angle based flight (like R3F-takes-flight)
     * Rotates the local coordinate axes based on control velocities,
     * then moves the plane along its forward axis.
     */
    updateFlight() {
        // === ROTATE LOCAL AXES ===

        // Yaw rotation: rotate X and Z axes around the Y axis
        if (Math.abs(this.yawVelocity) > 0.0001) {
            this.rotateAxisAroundAxis(this.xAxis, this.yAxis, this.yawVelocity);
            this.rotateAxisAroundAxis(this.zAxis, this.yAxis, this.yawVelocity);
        }

        // Pitch rotation: rotate Y and Z axes around the X axis
        if (Math.abs(this.pitchVelocity) > 0.0001) {
            this.rotateAxisAroundAxis(this.yAxis, this.xAxis, this.pitchVelocity);
            this.rotateAxisAroundAxis(this.zAxis, this.xAxis, this.pitchVelocity);
        }

        // Normalize axes to prevent drift
        this.xAxis.normalize();
        this.yAxis.normalize();
        this.zAxis.normalize();

        // === MOVEMENT ===
        // Plane always moves forward along its -Z axis
        const speed = this.baseSpeed + this.throttle * this.turboMax;
        const moveDir = this.zAxis.clone().multiplyScalar(-speed);

        // Set velocity (position is updated in updatePhysics)
        this.velocity.copy(moveDir);

        // === UPDATE MESH ROTATION ===
        // Build rotation matrix from local axes
        const matrix = new THREE.Matrix4();
        matrix.makeBasis(this.xAxis, this.yAxis, this.zAxis.clone().negate());

        // Extract euler angles for the mesh
        const euler = new THREE.Euler().setFromRotationMatrix(matrix, 'YXZ');
        this.rotation = euler.y; // Update entity rotation (used for mesh.rotation.y)
    }

    /**
     * Rotate one axis around another using Rodrigues' rotation formula
     */
    rotateAxisAroundAxis(axisToRotate, rotationAxis, angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        // Rodrigues' formula: v' = v*cos(θ) + (k×v)*sin(θ) + k*(k·v)*(1-cos(θ))
        const k = rotationAxis;
        const v = axisToRotate;

        const kCrossV = new THREE.Vector3().crossVectors(k, v);
        const kDotV = k.dot(v);

        axisToRotate.set(
            v.x * cos + kCrossV.x * sin + k.x * kDotV * (1 - cos),
            v.y * cos + kCrossV.y * sin + k.y * kDotV * (1 - cos),
            v.z * cos + kCrossV.z * sin + k.z * kDotV * (1 - cos)
        );
    }

    updateFlightVisuals() {
        // Engine glow based on throttle
        this.engineGlows.forEach(glow => {
            glow.material.opacity = 0.4 + this.throttle * 0.6;
            glow.scale.setScalar(1 + this.throttle * 0.5);
        });

        // Apply rotation to body group
        if (this.bodyGroup) {
            // Build rotation from axes
            const matrix = new THREE.Matrix4();
            matrix.makeBasis(this.xAxis, this.yAxis, this.zAxis.clone().negate());
            this.bodyGroup.setRotationFromMatrix(matrix);
        }

        // Radar dish spins faster with throttle
        if (this.radarDish) {
            this.radarDish.rotation.y += 0.02 * (1 + this.throttle * 3);
        }

        // Retract landing gear when throttle is up
        if (this.landingGear) {
            const targetGearY = this.throttle > 0.3 ? 1.0 : 0;
            this.landingGearY = THREE.MathUtils.lerp(this.landingGearY, targetGearY, 0.1);
            this.landingGear.position.y = this.landingGearY;
            this.landingGear.visible = this.landingGearY < 0.9;
        }
    }

    updatePhysics(dt) {
        // Apply velocity
        this.position.addScaledVector(this.velocity, dt);

        // Ground collision
        let groundY = this.game.getWorldHeight ?
            this.game.getWorldHeight(this.position.x, this.position.z) : 0;

        const minHeight = groundY + 1.5;
        if (this.position.y < minHeight) {
            this.position.y = minHeight;
            this.velocity.y = Math.max(0, this.velocity.y);
            this.isLanded = true;
        }

        // Sky limit
        if (this.position.y > 500) {
            this.position.y = 500;
        }
    }

    /**
     * Called when player interacts with the ship
     */
    interact() {
        if (this.rider) {
            // Already has a rider, do nothing
            return;
        }

        // Mount the player
        if (this.game.player && !this.game.player.mount) {
            this.game.player.mountEntity(this);
            this.game.uiManager?.addChatMessage('system', '✈️ Airplane controls: W/S pitch, A/D roll, Space throttle up, Shift throttle down');
        }
    }
}
