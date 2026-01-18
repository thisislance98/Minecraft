import * as THREE from 'three';
import { Animal } from '../Animal.js';

/**
 * MillenniumFalcon - A rideable spaceship inspired by the iconic freighter
 * Features broom-like flight controls and planetary travel capability
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
        // Radar dish rotation when idle
        if (this.radarDish && !this.rider) {
            this.radarDish.rotation.y += dt * 0.5;
        }

        // Hover bob when landed
        if (this.bodyGroup && !this.rider) {
            this.bodyGroup.position.y = Math.sin(Date.now() * 0.001) * 0.05;
        }

        // When not ridden, apply gentle descent
        if (!this.rider) {
            this.velocity.multiplyScalar(0.95);

            const groundY = this.game.getWorldHeight ?
                this.game.getWorldHeight(this.position.x, this.position.z) : 0;

            if (this.position.y > groundY + 1.5) {
                this.velocity.y -= 3 * dt; // Gentle descent
            } else {
                this.velocity.y = 0;
                this.position.y = groundY + 1.5;
                this.isLanded = true;
            }
        }

        // Engine glow intensity based on movement
        const speed = this.velocity.length();
        const glowIntensity = 0.3 + Math.min(0.7, speed / 60);
        this.engineGlows.forEach(glow => {
            glow.material.opacity = glowIntensity;
            // Flicker effect
            glow.scale.setScalar(0.9 + Math.random() * 0.2);
        });
    }

    handleRiding(moveForward, moveRight, jump, rotationY, dt) {
        if (!this.rider) return;

        this.isLanded = false;

        // Sync rotation with camera (ship faces where player looks)
        this.rotation = rotationY + Math.PI;

        // Get camera pitch for vertical aiming
        const cameraPitch = this.game.camera.rotation.x;

        // Flight mechanics - broom-like controls
        const maxSpeed = 80.0;
        const responsiveness = 3.0;

        // Calculate look direction (includes vertical component)
        const lookDir = new THREE.Vector3(0, 0, -1);
        lookDir.applyEuler(new THREE.Euler(cameraPitch, rotationY, 0, 'YXZ'));

        // Calculate right direction (horizontal only)
        const rightDir = new THREE.Vector3(1, 0, 0);
        rightDir.applyEuler(new THREE.Euler(0, rotationY, 0, 'YXZ'));

        const targetVel = new THREE.Vector3(0, 0, 0);

        // Forward/backward movement follows look direction
        if (moveForward !== 0) {
            targetVel.addScaledVector(lookDir, moveForward * maxSpeed);
        }

        // Strafe left/right
        if (moveRight !== 0) {
            targetVel.addScaledVector(rightDir, moveRight * maxSpeed * 0.7);
        }

        // Vertical controls
        const input = this.game.inputManager;
        const isCrouching = input && (input.keys['ShiftLeft'] || input.keys['KeyX']);

        if (jump) {
            targetVel.y += 25;
        } else if (isCrouching) {
            targetVel.y -= 25;
        }

        // Smooth velocity interpolation
        this.velocity.lerp(targetVel, dt * responsiveness);

        // Visual effects based on movement
        const speedFactor = this.velocity.length() / maxSpeed;

        // Engine glow intensity
        this.engineGlows.forEach(glow => {
            glow.material.opacity = 0.4 + speedFactor * 0.6;
            glow.scale.setScalar(1 + speedFactor * 0.5);
        });

        // Ship tilt based on movement
        if (this.bodyGroup) {
            // Roll when strafing
            this.bodyGroup.rotation.z = -moveRight * 0.2;
            // Pitch based on vertical velocity
            this.bodyGroup.rotation.x = -this.velocity.y * 0.015;
        }

        // Radar dish spins faster when moving
        if (this.radarDish) {
            this.radarDish.rotation.y += dt * (1 + speedFactor * 3);
        }

        // Retract landing gear when flying fast
        if (this.landingGear) {
            const targetGearY = speedFactor > 0.3 ? 1.0 : 0;
            this.landingGearY = THREE.MathUtils.lerp(this.landingGearY, targetGearY, dt * 3);
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
            if (this.velocity.y < 0) this.velocity.y = 0;
            this.isLanded = true;
        }

        // Sky limit
        if (this.position.y > 500) {
            this.position.y = 500;
            if (this.velocity.y > 0) this.velocity.y = 0;
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
            this.game.uiManager?.addChatMessage('system', '🚀 Welcome aboard! WASD to fly, Space/Shift for altitude.');
        }
    }
}
