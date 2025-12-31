/**
 * SurvivalGameManager - Handles the survival mini-game logic.
 * When activated, spawns hostile mobs with escalating frequency until the player dies.
 * Tracks survival time and maintains highscores.
 */
import { AnimalClasses } from '../AnimalRegistry.js';

export class SurvivalGameManager {
    constructor(game) {
        this.game = game;

        // Game state
        this.isActive = false;
        this.timer = 0;              // Seconds survived
        this.waveNumber = 1;
        this.spawnInterval = 3.0;    // Seconds between spawns (starts at 3)
        this.minInterval = 0.3;      // Fastest spawn rate
        this.spawnTimer = 0;
        this.waveIncreaseInterval = 10; // Seconds between wave increases

        // Hostile mob types to spawn
        this.hostileMobs = ['Zombie', 'Skeleton', 'Creeper'];

        // Highscores (load from localStorage)
        this.highscores = this.loadHighscores();

        // Arena center (where the game started)
        this.arenaCenter = null;
    }

    /**
     * Start the survival game
     */
    start() {
        if (this.isActive) return;

        this.isActive = true;
        this.timer = 0;
        this.waveNumber = 1;
        this.spawnInterval = 3.0;
        this.spawnTimer = 0;

        // Set arena center at player position
        this.arenaCenter = this.game.player.position.clone();

        // Set to night time for spooky atmosphere
        if (this.game.environment) {
            this.game.environment.setTimeOfDay(0.75); // 0.75 = midnight (sun below horizon)
            this.game.environment.freezeTime(true);   // Keep it night during survival
        }

        // Show UI
        if (this.game.uiManager) {
            this.game.uiManager.showSurvivalUI(true);
            this.game.uiManager.updateSurvivalUI(0, 1);
        }

        console.log('[SurvivalGame] Started! Survive as long as you can!');

        // Play start sound
        if (this.game.soundManager) {
            this.game.soundManager.playSound('click');
        }
    }

    /**
     * Update the survival game (called every frame)
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        if (!this.isActive) return;

        // Check if player died
        if (this.game.player.isDead) {
            this.end();
            return;
        }

        // Update timer
        this.timer += dt;

        // Update wave number every waveIncreaseInterval seconds
        const newWave = Math.floor(this.timer / this.waveIncreaseInterval) + 1;
        if (newWave !== this.waveNumber) {
            this.waveNumber = newWave;
            // Decrease spawn interval (faster spawns)
            this.spawnInterval = Math.max(this.minInterval, 3.0 - (this.waveNumber - 1) * 0.3);
            console.log(`[SurvivalGame] Wave ${this.waveNumber}! Spawn interval: ${this.spawnInterval.toFixed(2)}s`);
        }

        // Spawn timer
        this.spawnTimer += dt;
        if (this.spawnTimer >= this.spawnInterval) {
            this.spawnTimer = 0;
            this.spawnWave();
        }

        // Update UI
        if (this.game.uiManager) {
            this.game.uiManager.updateSurvivalUI(this.timer, this.waveNumber);
        }
    }

    /**
     * Spawn hostile mobs near the player
     */
    spawnWave() {
        const playerPos = this.game.player.position;

        // Number of mobs scales with wave
        const mobCount = Math.min(1 + Math.floor(this.waveNumber / 3), 5);

        for (let i = 0; i < mobCount; i++) {
            // Pick random mob type
            const mobType = this.hostileMobs[Math.floor(Math.random() * this.hostileMobs.length)];
            const MobClass = AnimalClasses[mobType];

            if (!MobClass) continue;

            // Spawn at random position around player (10-20 blocks away)
            const angle = Math.random() * Math.PI * 2;
            const distance = 10 + Math.random() * 10;
            const x = playerPos.x + Math.cos(angle) * distance;
            const z = playerPos.z + Math.sin(angle) * distance;
            const y = playerPos.y;

            // Use SpawnManager to create the mob
            this.game.spawnManager.createAnimal(MobClass, x, y, z, true, Math.random());
        }

        console.log(`[SurvivalGame] Spawned ${mobCount} mobs (Wave ${this.waveNumber})`);
    }

    /**
     * End the survival game
     */
    end() {
        if (!this.isActive) return;

        this.isActive = false;
        const finalTime = this.timer;

        console.log(`[SurvivalGame] Game Over! You survived ${this.formatTime(finalTime)}`);

        // Restore normal day/night cycle
        if (this.game.environment) {
            this.game.environment.setTimeOfDay(0.25); // Set back to noon
            this.game.environment.freezeTime(false);
        }

        // Save highscore
        this.saveHighscore(finalTime);

        // Show highscore board
        if (this.game.uiManager) {
            this.game.uiManager.showSurvivalUI(false);
            this.game.uiManager.showHighscoreBoard(this.highscores, finalTime);
        }
    }

    /**
     * Load highscores from localStorage
     */
    loadHighscores() {
        try {
            const saved = localStorage.getItem('survivalHighscores');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.warn('[SurvivalGame] Failed to load highscores:', e);
        }
        return [];
    }

    /**
     * Save a new highscore
     * @param {number} time - Survival time in seconds
     */
    saveHighscore(time) {
        const entry = {
            time: time,
            date: new Date().toISOString()
        };

        this.highscores.push(entry);

        // Sort by time (descending) and keep top 10
        this.highscores.sort((a, b) => b.time - a.time);
        this.highscores = this.highscores.slice(0, 10);

        // Save to localStorage
        try {
            localStorage.setItem('survivalHighscores', JSON.stringify(this.highscores));
        } catch (e) {
            console.warn('[SurvivalGame] Failed to save highscores:', e);
        }
    }

    /**
     * Format time as MM:SS
     * @param {number} seconds
     */
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}
