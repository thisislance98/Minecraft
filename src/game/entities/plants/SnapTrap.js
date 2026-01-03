import * as THREE from 'three';
import { InteractivePlant } from './InteractivePlant.js';

/**
 * SnapTrap - Magnetic venus flytrap that harmlessly catches the player.
 * Pulls player toward center, closes on them briefly, then releases.
 */
export class SnapTrap extends InteractivePlant {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);

        this.width = 1.5;
        this.height = 1.5;
        this.depth = 1.5;

        this.detectionRange = 4.0;
        this.pullRange = 3.0;
        this.catchRange = 1.0;

        // State
        this.state = 'open'; // open, pulling, closing, holding, opening
        this.stateTimer = 0;

        // Jaw angles
        this.jawAngle = 0.8; // Open angle (radians)
        this.targetJawAngle = 0.8;

        // Magnetic force
        this.pullStrength = 5.0;

        // Caught player reference
        this.caughtPlayer = null;

        this.createBody();
    }

    createBody() {
        // Stem
        const stemGeo = new THREE.CylinderGeometry(0.1, 0.15, 0.5, 8);
        const stemMat = new THREE.MeshLambertMaterial({ color: 0x558b2f });
        const stem = new THREE.Mesh(stemGeo, stemMat);
        stem.position.y = 0.25;
        this.mesh.add(stem);

        // Trap head group
        this.trapHead = new THREE.Group();
        this.trapHead.position.y = 0.5;

        // Base of trap (hinge area)
        const baseMat = new THREE.MeshLambertMaterial({ color: 0x7cb342 });
        const base = new THREE.Mesh(
            new THREE.SphereGeometry(0.2, 8, 6),
            baseMat
        );
        this.trapHead.add(base);

        // Upper jaw
        this.upperJaw = new THREE.Group();
        this.upperJaw.position.y = 0.1;

        const upperJawMat = new THREE.MeshLambertMaterial({ color: 0xff5252 }); // Red
        const upperJawGeo = new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const upperJawMesh = new THREE.Mesh(upperJawGeo, upperJawMat);
        upperJawMesh.rotation.x = Math.PI;
        this.upperJaw.add(upperJawMesh);

        // Teeth on upper jaw
        this.addTeeth(this.upperJaw, true);

        // Inner pink surface
        const innerMat = new THREE.MeshLambertMaterial({ color: 0xffcdd2 });
        const innerGeo = new THREE.CircleGeometry(0.45, 12);
        const inner = new THREE.Mesh(innerGeo, innerMat);
        inner.rotation.x = Math.PI / 2;
        inner.position.y = -0.05;
        this.upperJaw.add(inner);

        this.trapHead.add(this.upperJaw);

        // Lower jaw
        this.lowerJaw = new THREE.Group();
        this.lowerJaw.position.y = -0.1;

        const lowerJawMesh = new THREE.Mesh(upperJawGeo.clone(), upperJawMat);
        this.lowerJaw.add(lowerJawMesh);

        // Teeth on lower jaw
        this.addTeeth(this.lowerJaw, false);

        // Inner surface
        const lowerInner = new THREE.Mesh(innerGeo.clone(), innerMat);
        lowerInner.rotation.x = -Math.PI / 2;
        lowerInner.position.y = 0.05;
        this.lowerJaw.add(lowerInner);

        this.trapHead.add(this.lowerJaw);

        // Glowing lure in center
        const lureMat = new THREE.MeshBasicMaterial({
            color: 0xffeb3b,
            transparent: true,
            opacity: 0.8
        });
        this.lure = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 8, 6),
            lureMat
        );
        this.trapHead.add(this.lure);

        this.mesh.add(this.trapHead);

        // Set initial jaw positions
        this.updateJawPositions();
    }

    addTeeth(jaw, isUpper) {
        const teethMat = new THREE.MeshLambertMaterial({ color: 0xf5f5dc }); // Ivory
        const toothCount = 8;

        for (let i = 0; i < toothCount; i++) {
            const angle = (i / toothCount) * Math.PI * 2;
            const toothGeo = new THREE.ConeGeometry(0.04, 0.15, 4);
            const tooth = new THREE.Mesh(toothGeo, teethMat);

            tooth.position.set(
                Math.cos(angle) * 0.4,
                isUpper ? -0.05 : 0.05,
                Math.sin(angle) * 0.4
            );
            tooth.rotation.x = isUpper ? 0 : Math.PI;

            jaw.add(tooth);
        }
    }

    updateJawPositions() {
        // Rotate jaws around their hinge
        this.upperJaw.rotation.x = -this.jawAngle;
        this.lowerJaw.rotation.x = this.jawAngle;
    }

    onActivate(player) {
        if (this.state === 'open') {
            this.state = 'pulling';
        }
    }

    onDeactivate() {
        if (this.state === 'pulling') {
            this.state = 'open';
            this.targetJawAngle = 0.8;
        }
    }

    onUpdateActive(dt) {
        const player = this.game.player;
        if (!player) return;

        const dist = this.position.distanceTo(player.position);

        switch (this.state) {
            case 'open':
                // Just waiting
                break;

            case 'pulling':
                // Apply magnetic pull toward center
                if (dist < this.pullRange && dist > this.catchRange) {
                    const toTrap = new THREE.Vector3()
                        .subVectors(this.position, player.position);
                    toTrap.y = 0; // Only horizontal pull
                    toTrap.normalize();

                    // Apply force to player velocity
                    const pullForce = this.pullStrength * (1 - dist / this.pullRange);
                    player.velocity.x += toTrap.x * pullForce * dt;
                    player.velocity.z += toTrap.z * pullForce * dt;
                }

                // Check if caught
                if (dist < this.catchRange) {
                    this.state = 'closing';
                    this.stateTimer = 0;
                    this.caughtPlayer = player;
                }
                break;

            case 'closing':
                // Jaws closing animation handled in updatePhysics
                break;

            case 'holding':
                // Keep player in place
                if (this.caughtPlayer) {
                    this.caughtPlayer.velocity.set(0, 0, 0);
                    // Slight wobble position
                    this.caughtPlayer.position.x = this.position.x;
                    this.caughtPlayer.position.z = this.position.z;
                }
                break;

            case 'opening':
                // Release animation handled in updatePhysics
                break;
        }
    }

    updatePhysics(dt) {
        const time = performance.now() / 1000;

        switch (this.state) {
            case 'open':
            case 'pulling':
                this.targetJawAngle = 0.8;
                // Lure pulsing
                this.lure.scale.setScalar(1 + Math.sin(time * 4) * 0.2);
                break;

            case 'closing':
                this.stateTimer += dt;
                this.targetJawAngle = 0.1; // Almost closed

                if (this.stateTimer > 0.3 && this.jawAngle < 0.15) {
                    this.state = 'holding';
                    this.stateTimer = 0;

                    // Play sound
                    if (this.game.audioManager?.playBite) {
                        this.game.audioManager.playBite();
                    }

                    // Show message
                    if (this.game.uiManager) {
                        this.game.uiManager.addChatMessage('system', '🌿 *Gulp*... Gotcha!');
                    }
                }
                break;

            case 'holding':
                this.stateTimer += dt;
                this.targetJawAngle = 0.05;

                // Wobble while holding
                this.trapHead.rotation.z = Math.sin(time * 8) * 0.1;

                // Release after 2 seconds
                if (this.stateTimer > 2.0) {
                    this.state = 'opening';
                    this.stateTimer = 0;

                    if (this.game.uiManager) {
                        this.game.uiManager.addChatMessage('system', '🌿 *Pop!* Released!');
                    }
                }
                break;

            case 'opening':
                this.stateTimer += dt;
                this.targetJawAngle = 0.8;
                this.trapHead.rotation.z = 0;

                // Release player with small upward boost
                if (this.caughtPlayer && this.stateTimer < 0.1) {
                    this.caughtPlayer.velocity.y = 5;
                    this.caughtPlayer.position.y += 0.5;
                    this.caughtPlayer = null;
                }

                if (this.stateTimer > 0.5) {
                    this.state = 'open';
                }
                break;
        }

        // Lerp jaw angle
        this.jawAngle = THREE.MathUtils.lerp(
            this.jawAngle,
            this.targetJawAngle,
            dt * 10
        );
        this.updateJawPositions();

        // Head sway
        if (this.state === 'open' || this.state === 'pulling') {
            this.trapHead.rotation.y += dt * 0.2;
            this.trapHead.position.y = 0.5 + Math.sin(time * 1.5) * 0.05;
        }

        this.mesh.position.copy(this.position);
    }
}
