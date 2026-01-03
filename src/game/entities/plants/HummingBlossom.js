import * as THREE from 'three';
import { InteractivePlant } from './InteractivePlant.js';

/**
 * HummingBlossom - Musical proximity plant.
 * Has 5-7 bell-shaped flowers that each play a unique note when player approaches.
 */
export class HummingBlossom extends InteractivePlant {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);

        this.width = 1.2;
        this.height = 1.0;
        this.depth = 1.2;

        this.detectionRange = 5.0;

        // Musical state
        this.flowers = [];
        this.flowerCount = 5 + Math.floor(this.rng.next() * 3); // 5-7 flowers
        this.lastPlayedFlower = -1;
        this.noteCooldown = 0;

        // Audio context (lazy init)
        this.audioContext = null;

        // Note frequencies (pentatonic scale - always sounds nice)
        this.notes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33]; // C4-D5 pentatonic

        this.createBody();
    }

    createBody() {
        // Colors for flowers (rainbow-ish)
        const colors = [0xff6b6b, 0xffa500, 0xffeb3b, 0x4caf50, 0x2196f3, 0x9c27b0, 0xff69b4];

        // Central stem cluster
        const stemMat = new THREE.MeshLambertMaterial({ color: 0x4caf50 });

        for (let i = 0; i < this.flowerCount; i++) {
            const flowerGroup = new THREE.Group();

            // Position flowers in a cluster
            const angle = (i / this.flowerCount) * Math.PI * 2;
            const radius = 0.2 + this.rng.next() * 0.3;
            const height = 0.4 + this.rng.next() * 0.6;

            flowerGroup.position.set(
                Math.cos(angle) * radius,
                0,
                Math.sin(angle) * radius
            );

            // Stem
            const stemGeo = new THREE.CylinderGeometry(0.03, 0.04, height, 6);
            const stem = new THREE.Mesh(stemGeo, stemMat);
            stem.position.y = height / 2;
            flowerGroup.add(stem);

            // Bell-shaped flower head
            const bellGeo = new THREE.ConeGeometry(0.15, 0.2, 8);
            bellGeo.rotateX(Math.PI); // Flip upside down for bell shape
            const bellMat = new THREE.MeshLambertMaterial({
                color: colors[i % colors.length],
                emissive: colors[i % colors.length],
                emissiveIntensity: 0
            });
            const bell = new THREE.Mesh(bellGeo, bellMat);
            bell.position.y = height + 0.1;
            flowerGroup.add(bell);

            // Store reference with state
            this.flowers.push({
                group: flowerGroup,
                bell: bell,
                material: bellMat,
                baseY: height + 0.1,
                swayPhase: this.rng.next() * Math.PI * 2,
                isGlowing: false,
                glowTimer: 0,
                noteIndex: i % this.notes.length
            });

            this.mesh.add(flowerGroup);
        }
    }

    initAudio() {
        if (this.audioContext) return;
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('[HummingBlossom] Audio not available');
        }
    }

    playNote(flowerIndex) {
        if (!this.audioContext) this.initAudio();
        if (!this.audioContext) return;

        const flower = this.flowers[flowerIndex];
        if (!flower) return;

        try {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.type = 'sine';
            osc.frequency.value = this.notes[flower.noteIndex];

            gain.gain.setValueAtTime(0.15, this.audioContext.currentTime);
            gain.gain.exponentialDecayTo = 0.01;
            gain.gain.setTargetAtTime(0.001, this.audioContext.currentTime + 0.2, 0.1);

            osc.connect(gain);
            gain.connect(this.audioContext.destination);

            osc.start();
            osc.stop(this.audioContext.currentTime + 0.4);

            // Start glow
            flower.isGlowing = true;
            flower.glowTimer = 0.5;
        } catch (e) {
            // Audio failed, just continue
        }
    }

    onActivate(player) {
        // When player enters range, start playing notes
    }

    onDeactivate() {
        // Reset glow on all flowers
        for (const flower of this.flowers) {
            flower.isGlowing = false;
            flower.material.emissiveIntensity = 0;
        }
    }

    onUpdateActive(dt) {
        const player = this.game.player;
        if (!player) return;

        const dist = this.position.distanceTo(player.position);

        // Play notes based on proximity zones
        this.noteCooldown -= dt;

        if (this.noteCooldown <= 0 && dist < this.detectionRange) {
            // Determine which flower to play based on player angle
            const toPlayer = new THREE.Vector3().subVectors(player.position, this.position);
            const angle = Math.atan2(toPlayer.x, toPlayer.z);
            const normalizedAngle = (angle + Math.PI) / (Math.PI * 2);
            const flowerIndex = Math.floor(normalizedAngle * this.flowerCount) % this.flowerCount;

            // Play if different flower or enough time passed
            if (flowerIndex !== this.lastPlayedFlower || this.noteCooldown < -0.5) {
                this.playNote(flowerIndex);
                this.lastPlayedFlower = flowerIndex;
                this.noteCooldown = 0.3; // Minimum time between notes
            }
        }
    }

    updatePhysics(dt) {
        // Animate flowers - gentle sway and glow
        const time = performance.now() / 1000;

        for (const flower of this.flowers) {
            // Gentle sway
            const swayAmount = 0.05;
            flower.bell.position.y = flower.baseY + Math.sin(time * 2 + flower.swayPhase) * swayAmount;
            flower.bell.rotation.x = Math.sin(time * 1.5 + flower.swayPhase) * 0.1;

            // Glow animation
            if (flower.isGlowing) {
                flower.glowTimer -= dt;
                flower.material.emissiveIntensity = Math.max(0, flower.glowTimer * 1.5);
                if (flower.glowTimer <= 0) {
                    flower.isGlowing = false;
                }
            }
        }

        this.mesh.position.copy(this.position);
    }
}
