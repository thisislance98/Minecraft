import * as THREE from 'three';

export class Environment {
    constructor(scene, game) {
        this.scene = scene;
        this.game = game;

        // Time state
        this.time = 0.25; // 0.0 to 1.0 (0.25 is noon, 0.0 is sunrise, 0.5 is sunset)
        this.dayDuration = 600; // seconds

        // Lighting
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(this.ambientLight);

        this.sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 500;

        // Large shadow area for player
        const d = 100;
        this.sunLight.shadow.camera.left = -d;
        this.sunLight.shadow.camera.right = d;
        this.sunLight.shadow.camera.top = d;
        this.sunLight.shadow.camera.bottom = -d;

        this.scene.add(this.sunLight);

        // Sky
        this.skyColor = new THREE.Color(0x87CEEB); // Sky blue
        this.nightColor = new THREE.Color(0x00000C); // Very dark blue
    }

    updateDayNightCycle(dt, playerPos) {
        // Advance time
        this.time += dt / this.dayDuration;
        if (this.time > 1.0) this.time -= 1.0;

        // Calculate sun position
        // angle 0 = sunrise, PI/2 = noon, PI = sunset, 3PI/2 = midnight
        const angle = this.time * Math.PI * 2;

        const distance = 200;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;
        const z = Math.sin(angle * 0.5) * distance * 0.2; // slight tilt

        this.sunLight.position.set(
            playerPos.x + x,
            playerPos.y + y,
            playerPos.z + z
        );
        this.sunLight.target.position.copy(playerPos);
        this.sunLight.target.updateMatrixWorld();

        // Update intensity and colors
        const sunAboveHorizon = Math.max(0, Math.sin(angle));
        this.sunLight.intensity = sunAboveHorizon * 1.2;

        // Sky color interpolation
        const skyLerp = Math.max(0, Math.min(1, sunAboveHorizon * 2.0));
        this.game.renderer.setClearColor(this.nightColor.clone().lerp(this.skyColor, skyLerp));

        this.ambientLight.intensity = 0.2 + sunAboveHorizon * 0.5;
    }

    isNight() {
        // Night is when sun is below horizon
        const angle = this.time * Math.PI * 2;
        return Math.sin(angle) < 0;
    }

    setWeather(type) {
        this.currentWeather = type;
        // In the future, we can adjust fog, sky color, or lighting intensity based on weather type
        // For now, tracking the state is sufficient to prevent the crash
        if (type === 'storm') {
            this.sunLight.intensity = 0.5;
            this.ambientLight.intensity = 0.3;
        } else if (type === 'rain') {
            this.sunLight.intensity = 0.8;
            this.ambientLight.intensity = 0.5;
        } else {
            // restore defaults (approximate, refined in updateDayNightCycle usually but good to reset)
            // strict reset might be jerky if done mid-day, but updateDayNightCycle overwrites intensity anyway
            // so this is just for immediate feedback if any
        }
    }

    setTimeOfDay(t) {
        this.time = t;
    }
}
