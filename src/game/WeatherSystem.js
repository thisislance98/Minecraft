import * as THREE from 'three';

export class WeatherSystem {
    constructor(game) {
        this.game = game;
        this.scene = game.scene;

        // Weather State
        this.currentWeather = 'clear'; // 'clear', 'rain', 'storm'
        this.weatherTimer = 0;
        this.weatherDuration = 300; // Seconds until next weather check/change

        // Rain
        this.rainCount = 15000;
        this.rainGeometry = null;
        this.rainMaterial = null;
        this.rainSystem = null;
        this.rainVelocities = null;

        // Lightning
        this.lightningTimer = 0;
        this.nextLightningTime = 0;
        this.flashIntensity = 0;

        this.initRain();
    }

    initRain() {
        this.rainGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.rainCount * 3);
        this.rainVelocities = new Float32Array(this.rainCount);

        for (let i = 0; i < this.rainCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 100; // x
            positions[i * 3 + 1] = (Math.random() - 0.5) * 80; // y
            positions[i * 3 + 2] = (Math.random() - 0.5) * 100; // z
            this.rainVelocities[i] = 0.5 + Math.random() * 0.5; // velocity y
        }

        this.rainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        this.rainMaterial = new THREE.PointsMaterial({
            color: 0xaaaaaa,
            size: 0.1,
            transparent: true,
            opacity: 0.6
        });

        this.rainSystem = new THREE.Points(this.rainGeometry, this.rainMaterial);
        this.rainSystem.visible = false;
        this.scene.add(this.rainSystem);
    }

    setWeather(type) {
        if (this.currentWeather === type) return;

        console.log(`Weather changing to: ${type}`);
        this.currentWeather = type;

        if (type === 'clear') {
            this.rainSystem.visible = false;
        } else {
            this.rainSystem.visible = true;
            // Storm has more rain density or speed? For now just same visual
            // In storm we can add wind effect later
        }

        // Notify environment to update lighting target
        if (this.game.environment) {
            this.game.environment.setWeather(type);
        }
    }

    update(deltaTime, playerPosition) {
        this.weatherTimer += deltaTime;
        if (this.weatherTimer > this.weatherDuration) {
            this.weatherTimer = 0;
            this.cycleWeather();
        }

        // Lightning Logic
        if (this.currentWeather === 'storm') {
            this.updateLightning(deltaTime, playerPosition);
        } else {
            this.flashIntensity = Math.max(0, this.flashIntensity - deltaTime * 5);
        }

        // Rain Logic
        if (this.currentWeather !== 'clear') {
            this.updateRain(deltaTime, playerPosition);
        }
    }

    cycleWeather() {
        const r = Math.random();
        // 60% Clear, 30% Rain, 10% Storm
        if (r < 0.6) {
            this.setWeather('clear');
        } else if (r < 0.9) {
            this.setWeather('rain');
        } else {
            this.setWeather('storm');
        }
    }

    updateRain(deltaTime, playerPosition) {
        const positions = this.rainSystem.geometry.attributes.position.array;

        // Move rain with player but wrap around
        this.rainSystem.position.x = playerPosition.x;
        this.rainSystem.position.z = playerPosition.z;
        this.rainSystem.position.y = playerPosition.y;

        for (let i = 0; i < this.rainCount; i++) {
            // Drop down
            // We simulate movement by modifying the points relative to the system position
            // Actually it's cheaper to just animate y in the buffer and wrap it

            let y = positions[i * 3 + 1];
            y -= this.rainVelocities[i] * 50 * deltaTime; // Speed scale

            if (y < -40) {
                y = 40;
                // Randomize x/z again slightly effectively
                // But for cheapness we just reset Y
            }
            positions[i * 3 + 1] = y;
        }

        this.rainSystem.geometry.attributes.position.needsUpdate = true;
    }

    updateLightning(deltaTime, playerPosition) {
        this.lightningTimer += deltaTime;

        // Flash decay
        if (this.flashIntensity > 0) {
            this.flashIntensity -= deltaTime * 2.0; // Fade out speed
            if (this.flashIntensity < 0) this.flashIntensity = 0;
        }

        // Trigger new lightning
        if (this.lightningTimer > this.nextLightningTime) {
            this.triggerLightning(playerPosition);
            this.lightningTimer = 0;
            this.nextLightningTime = Math.random() * 10 + 2; // Random interval 2-12s
        }
    }

    triggerLightning(playerPosition) {
        console.log("Lightning Strike!");

        // Visual flash (handled by Environment reading this.flashIntensity)
        this.flashIntensity = 1.0;

        // Create a visual bolt (Optional, simple line for now)
        this.createLightningBolt(playerPosition);
    }

    createLightningBolt(playerPosition) {
        // Random position around player
        const angle = Math.random() * Math.PI * 2;
        const radius = 20 + Math.random() * 60;
        const x = playerPosition.x + Math.cos(angle) * radius;
        const z = playerPosition.z + Math.sin(angle) * radius;

        const startY = playerPosition.y + 40;
        const endY = this.game.worldGen ? this.game.worldGen.getTerrainHeight(x, z) : 0;

        const points = [];
        points.push(new THREE.Vector3(x, startY, z));

        // Jagged line
        let currentY = startY;
        let currentX = x;
        let currentZ = z;

        while (currentY > endY) {
            currentY -= (Math.random() * 5 + 2);
            currentX += (Math.random() - 0.5) * 5;
            currentZ += (Math.random() - 0.5) * 5;
            points.push(new THREE.Vector3(currentX, currentY, currentZ));
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0xFFFFFF });
        const bolt = new THREE.Line(geometry, material);

        this.scene.add(bolt);

        // Remove after a short time
        setTimeout(() => {
            this.scene.remove(bolt);
            geometry.dispose();
            material.dispose();
        }, 150); // 150ms flash
    }
}
