import * as THREE from 'three';

/**
 * TreasureHuntManager - A mini-game where players search for hidden treasure chests.
 * Features proximity-based compass, difficulty levels, particle effects, timer, and highscores.
 *
 * Keybind: G to toggle (start difficulty select or cancel active hunt)
 */
export class TreasureHuntManager {
    constructor(game) {
        this.game = game;

        // Game state
        this.isActive = false;
        this.difficulty = null;
        this.elapsedTime = 0;
        this.foundCount = 0;
        this.totalCount = 0;
        this.treasures = [];

        // Proximity state
        this.proximityLevel = 'none'; // none, cold, warm, hot, burning
        this.nearestDistance = Infinity;
        this.nearestTreasure = null;

        // Animation state
        this.animTime = 0;

        // Difficulty settings
        this.difficultySettings = {
            easy:   { count: 3, radius: 40, label: 'Easy' },
            medium: { count: 5, radius: 60, label: 'Medium' },
            hard:   { count: 8, radius: 80, label: 'Hard' }
        };

        // Highscores from localStorage
        this.highscores = this.loadHighscores();
    }

    /**
     * Toggle the treasure hunt: show difficulty select if inactive, cancel if active
     */
    toggle() {
        if (this.isActive) {
            this.end(false);
        } else {
            // Show difficulty selection modal
            if (this.game.uiManager) {
                this.game.uiManager.showTreasureHuntDifficultySelect((difficulty) => {
                    this.start(difficulty);
                });
            }
        }
    }

    /**
     * Start a treasure hunt with the given difficulty
     */
    start(difficulty) {
        if (this.isActive) return;

        const settings = this.difficultySettings[difficulty];
        if (!settings) {
            console.warn('[TreasureHunt] Unknown difficulty:', difficulty);
            return;
        }

        this.isActive = true;
        this.difficulty = difficulty;
        this.elapsedTime = 0;
        this.foundCount = 0;
        this.totalCount = settings.count;
        this.treasures = [];
        this.proximityLevel = 'none';
        this.nearestDistance = Infinity;
        this.nearestTreasure = null;
        this.animTime = 0;

        // Generate treasure positions and create meshes
        this.generateTreasures(settings);

        // Show HUD
        if (this.game.uiManager) {
            this.game.uiManager.showTreasureHuntUI(true);
        }

        // Play start sound
        if (this.game.soundManager) {
            this.game.soundManager.playSound('levelup');
        }

        if (this.game.uiManager) {
            this.game.uiManager.showNotification(
                `Treasure Hunt started! Find ${this.totalCount} chests (${settings.label})`,
                'info', 4000
            );
        }

        console.log(`[TreasureHunt] Started ${difficulty} hunt: ${settings.count} chests in ${settings.radius} block radius`);
    }

    /**
     * Generate treasure chest positions around the player
     */
    generateTreasures(settings) {
        const player = this.game.player;
        if (!player) return;

        const centerX = player.position.x;
        const centerZ = player.position.z;
        const { count, radius } = settings;
        const minSpacing = 15;
        const positions = [];

        // Try random placement first
        for (let i = 0; i < count; i++) {
            let placed = false;
            for (let attempt = 0; attempt < 30; attempt++) {
                const angle = Math.random() * Math.PI * 2;
                // Distance: between 20% and 100% of radius to avoid spawning too close
                const dist = (0.2 + Math.random() * 0.8) * radius;
                const x = centerX + Math.cos(angle) * dist;
                const z = centerZ + Math.sin(angle) * dist;

                // Get terrain height
                let y = 10;
                if (this.game.worldGen && this.game.worldGen.getTerrainHeight) {
                    y = this.game.worldGen.getTerrainHeight(x, z);
                }

                // Validate: not underwater (check block at position)
                const blockBelow = this.game.getBlockWorld ? this.game.getBlockWorld(Math.floor(x), Math.floor(y), Math.floor(z)) : null;
                if (blockBelow === 4) continue; // water block

                // Validate: minimum spacing
                let tooClose = false;
                for (const pos of positions) {
                    const dx = pos.x - x;
                    const dz = pos.z - z;
                    if (Math.sqrt(dx * dx + dz * dz) < minSpacing) {
                        tooClose = true;
                        break;
                    }
                }
                if (tooClose) continue;

                positions.push({ x, y: y + 0.5, z });
                placed = true;
                break;
            }

            // Fallback: evenly-spaced ring
            if (!placed) {
                const angle = (i / count) * Math.PI * 2;
                const dist = radius * 0.6;
                const x = centerX + Math.cos(angle) * dist;
                const z = centerZ + Math.sin(angle) * dist;
                let y = 10;
                if (this.game.worldGen && this.game.worldGen.getTerrainHeight) {
                    y = this.game.worldGen.getTerrainHeight(x, z);
                }
                positions.push({ x, y: y + 0.5, z });
            }
        }

        // Create chest meshes for each position
        for (const pos of positions) {
            const treasure = {
                position: new THREE.Vector3(pos.x, pos.y, pos.z),
                found: false,
                mesh: this.createChest(pos),
                baseY: pos.y
            };
            this.treasures.push(treasure);
        }
    }

    /**
     * Create a 3D treasure chest mesh
     */
    createChest(position) {
        const group = new THREE.Group();

        // Chest body (brown box)
        const bodyGeo = new THREE.BoxGeometry(0.8, 0.5, 0.6);
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.25;
        group.add(body);

        // Chest lid (slightly larger, lighter brown)
        const lidGeo = new THREE.BoxGeometry(0.85, 0.2, 0.65);
        const lidMat = new THREE.MeshLambertMaterial({ color: 0xA0522D });
        const lid = new THREE.Mesh(lidGeo, lidMat);
        lid.position.y = 0.6;
        group.add(lid);

        // Gold latch (front center)
        const latchGeo = new THREE.BoxGeometry(0.15, 0.1, 0.05);
        const latchMat = new THREE.MeshLambertMaterial({ color: 0xFFD700 });
        const latch = new THREE.Mesh(latchGeo, latchMat);
        latch.position.set(0, 0.5, 0.33);
        group.add(latch);

        // Glow sphere above chest
        const glowGeo = new THREE.SphereGeometry(0.15, 8, 8);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0xFFD700,
            transparent: true,
            opacity: 0.6
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.y = 1.0;
        group.add(glow);

        // Store glow reference for animation
        group.userData.glowMesh = glow;
        group.userData.glowMat = glowMat;

        group.position.set(position.x, position.y, position.z);

        if (this.game.scene) {
            this.game.scene.add(group);
        }

        return group;
    }

    /**
     * Main update loop - called every frame
     */
    update(dt) {
        if (!this.isActive) return;

        // Increment timer
        this.elapsedTime += dt;

        // Animation time
        this.animTime += dt;

        // Update proximity to nearest chest
        this.updateProximity();

        // Check if player is close enough to collect
        this.checkCollection();

        // Visual effects (particles near chests)
        this.updateVisualEffects(dt);

        // Chest bobbing/rotation animation
        this.updateChestAnimation(dt);

        // Push UI update
        this.pushUIUpdate();
    }

    /**
     * Calculate proximity to nearest unfound chest
     */
    updateProximity() {
        const player = this.game.player;
        if (!player) return;

        let nearest = null;
        let nearestDist = Infinity;

        for (const t of this.treasures) {
            if (t.found) continue;
            const dx = player.position.x - t.position.x;
            const dz = player.position.z - t.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = t;
            }
        }

        this.nearestDistance = nearestDist;
        this.nearestTreasure = nearest;

        // Determine proximity level
        let newLevel = 'none';
        if (nearestDist <= 3) newLevel = 'burning';
        else if (nearestDist <= 8) newLevel = 'hot';
        else if (nearestDist <= 20) newLevel = 'warm';
        else if (nearestDist <= 40) newLevel = 'cold';

        // Play sound on level change
        if (newLevel !== this.proximityLevel && newLevel !== 'none') {
            if (this.game.soundManager) {
                this.game.soundManager.playSound('click');
            }
        }

        this.proximityLevel = newLevel;
    }

    /**
     * Check if player is close enough to collect a chest
     */
    checkCollection() {
        const player = this.game.player;
        if (!player) return;

        for (const t of this.treasures) {
            if (t.found) continue;
            const dx = player.position.x - t.position.x;
            const dy = player.position.y - t.position.y;
            const dz = player.position.z - t.position.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist < 2.0) {
                this.collectTreasure(t);
                break; // Collect one per frame
            }
        }
    }

    /**
     * Collect a treasure chest
     */
    collectTreasure(treasure) {
        treasure.found = true;
        this.foundCount++;

        // Remove mesh from scene
        if (treasure.mesh && this.game.scene) {
            this.game.scene.remove(treasure.mesh);
            // Dispose geometry and materials
            treasure.mesh.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        }

        // Spawn particle burst
        this.spawnCollectParticles(treasure.position);

        // Play sound
        if (this.game.soundManager) {
            this.game.soundManager.playSound('levelup');
        }

        // Give reward
        if (this.game.inventoryManager) {
            this.game.inventoryManager.addItem('diamond', 1, 'item');
        }

        // Show notification
        if (this.game.uiManager) {
            this.game.uiManager.showNotification(
                `Treasure found! (${this.foundCount}/${this.totalCount})`,
                'success', 3000
            );
        }

        // Check win condition
        if (this.foundCount >= this.totalCount) {
            // Small delay so player sees the last notification
            setTimeout(() => this.end(true), 500);
        }
    }

    /**
     * Spawn gold particle burst at collection point
     */
    spawnCollectParticles(position) {
        if (!this.game.worldParticleSystem) return;

        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2;
            const speed = 2 + Math.random() * 3;
            const vx = Math.cos(angle) * speed;
            const vz = Math.sin(angle) * speed;
            const vy = 3 + Math.random() * 4;

            this.game.worldParticleSystem.spawn({
                position: new THREE.Vector3(position.x, position.y + 0.5, position.z),
                velocity: new THREE.Vector3(vx, vy, vz),
                color: 0xFFD700,
                life: 1.5
            });
        }
    }

    /**
     * Spawn ambient particles near chests when player is close
     */
    updateVisualEffects(dt) {
        if (!this.game.worldParticleSystem) return;
        const player = this.game.player;
        if (!player) return;

        for (const t of this.treasures) {
            if (t.found) continue;
            const dx = player.position.x - t.position.x;
            const dz = player.position.z - t.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < 8) {
                // Spawn occasional gold sparkle
                if (Math.random() < 0.15) {
                    const ox = (Math.random() - 0.5) * 1.2;
                    const oz = (Math.random() - 0.5) * 1.2;
                    this.game.worldParticleSystem.spawn({
                        position: new THREE.Vector3(
                            t.position.x + ox,
                            t.position.y + 0.5 + Math.random() * 0.5,
                            t.position.z + oz
                        ),
                        velocity: new THREE.Vector3(
                            (Math.random() - 0.5) * 0.3,
                            0.5 + Math.random() * 0.5,
                            (Math.random() - 0.5) * 0.3
                        ),
                        color: 0xFFD700,
                        life: 1.0
                    });
                }
            }
        }
    }

    /**
     * Animate chest bobbing, rotation, and glow
     */
    updateChestAnimation(dt) {
        for (const t of this.treasures) {
            if (t.found || !t.mesh) continue;

            // Gentle Y bobbing
            t.mesh.position.y = t.baseY + Math.sin(this.animTime * 2) * 0.1;

            // Slow rotation
            t.mesh.rotation.y += dt * 0.5;

            // Glow pulse
            const glowMat = t.mesh.userData.glowMat;
            if (glowMat) {
                glowMat.opacity = 0.4 + Math.sin(this.animTime * 3) * 0.3;
            }
        }
    }

    /**
     * Calculate compass angle to nearest unfound chest (relative to camera forward)
     */
    getCompassAngle() {
        if (!this.nearestTreasure || !this.game.camera) return 0;

        const player = this.game.player;
        if (!player) return 0;

        // Direction to treasure (XZ plane)
        const dx = this.nearestTreasure.position.x - player.position.x;
        const dz = this.nearestTreasure.position.z - player.position.z;
        const targetAngle = Math.atan2(dx, dz);

        // Camera forward direction
        const camDir = new THREE.Vector3();
        this.game.camera.getWorldDirection(camDir);
        const cameraAngle = Math.atan2(camDir.x, camDir.z);

        // Relative angle
        return targetAngle - cameraAngle;
    }

    /**
     * Push UI data to the HUD
     */
    pushUIUpdate() {
        if (!this.game.uiManager) return;

        const data = {
            time: this.elapsedTime,
            found: this.foundCount,
            total: this.totalCount,
            proximityLevel: this.proximityLevel,
            proximityPercent: this.getProximityPercent(),
            compassAngle: this.getCompassAngle(),
            distance: this.nearestDistance,
            difficulty: this.difficulty
        };

        this.game.uiManager.updateTreasureHuntUI(data);
    }

    /**
     * Get proximity as 0-100 percentage
     */
    getProximityPercent() {
        if (this.nearestDistance >= 40) return 0;
        if (this.nearestDistance <= 1) return 100;
        // Inverse linear: closer = higher
        return Math.round(((40 - this.nearestDistance) / 39) * 100);
    }

    /**
     * End the treasure hunt
     */
    end(completed) {
        if (!this.isActive) return;

        if (completed) {
            // Save highscore
            this.saveHighscore(this.difficulty, this.elapsedTime);

            // Show completion screen
            if (this.game.uiManager) {
                const scores = this.getHighscores(this.difficulty);
                this.game.uiManager.showTreasureHuntComplete(
                    this.elapsedTime,
                    this.difficulty,
                    scores
                );
            }

            // Celebration particles
            this.spawnCelebrationParticles();

            if (this.game.soundManager) {
                this.game.soundManager.playSound('levelup');
            }

            console.log(`[TreasureHunt] Completed ${this.difficulty} in ${this.elapsedTime.toFixed(1)}s`);
        } else {
            if (this.game.uiManager) {
                this.game.uiManager.showNotification('Treasure Hunt cancelled', 'info', 2000);
            }
            console.log('[TreasureHunt] Cancelled');
        }

        // Cleanup all chest meshes
        for (const t of this.treasures) {
            if (t.mesh && this.game.scene) {
                this.game.scene.remove(t.mesh);
                t.mesh.traverse((child) => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                });
            }
        }

        this.treasures = [];
        this.isActive = false;
        this.proximityLevel = 'none';
        this.nearestTreasure = null;

        // Hide HUD
        if (this.game.uiManager) {
            this.game.uiManager.showTreasureHuntUI(false);
        }
    }

    /**
     * Spawn celebration particles at player position
     */
    spawnCelebrationParticles() {
        if (!this.game.worldParticleSystem || !this.game.player) return;
        const pos = this.game.player.position;

        for (let burst = 0; burst < 3; burst++) {
            setTimeout(() => {
                for (let i = 0; i < 30; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 2 + Math.random() * 4;
                    const vx = Math.cos(angle) * speed;
                    const vz = Math.sin(angle) * speed;
                    const vy = 4 + Math.random() * 5;
                    const colors = [0xFFD700, 0xFFA500, 0xFF6347, 0x00FF7F, 0x00BFFF];
                    const color = colors[Math.floor(Math.random() * colors.length)];

                    this.game.worldParticleSystem.spawn({
                        position: new THREE.Vector3(
                            pos.x + (Math.random() - 0.5) * 2,
                            pos.y + 1,
                            pos.z + (Math.random() - 0.5) * 2
                        ),
                        velocity: new THREE.Vector3(vx, vy, vz),
                        color,
                        life: 2.0
                    });
                }
            }, burst * 300);
        }
    }

    // ============ Highscore Persistence ============

    loadHighscores() {
        try {
            const data = localStorage.getItem('treasureHuntHighscores');
            return data ? JSON.parse(data) : { easy: [], medium: [], hard: [] };
        } catch {
            return { easy: [], medium: [], hard: [] };
        }
    }

    saveHighscore(difficulty, time) {
        if (!this.highscores[difficulty]) {
            this.highscores[difficulty] = [];
        }

        this.highscores[difficulty].push({
            time,
            date: new Date().toISOString()
        });

        // Sort by time ascending, keep top 10
        this.highscores[difficulty].sort((a, b) => a.time - b.time);
        this.highscores[difficulty] = this.highscores[difficulty].slice(0, 10);

        try {
            localStorage.setItem('treasureHuntHighscores', JSON.stringify(this.highscores));
        } catch (e) {
            console.warn('[TreasureHunt] Failed to save highscores:', e);
        }
    }

    getHighscores(difficulty) {
        return (this.highscores[difficulty] || []).slice(0, 5);
    }
}
