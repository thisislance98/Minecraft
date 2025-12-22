import * as THREE from 'three';

/**
 * Environment - Handles lighting, sky objects, and day/night cycle
 */
export class Environment {
    constructor(scene, game) {
        this.scene = scene;
        this.game = game;

        // Day/Night Cycle
        this.dayTime = 0.2; // 0 to 1
        this.dayDuration = 600; // Seconds for a full day (10 minutes)

        // Underground lighting
        this.undergroundFactor = 0; // 0 = surface, 1 = deep underground
        this.targetUndergroundFactor = 0;

        this.setupLighting();
        this.createSkyObjects();
        this.createClouds();
    }

    /**
     * Calculate how "underground" the player is by checking for blocks above
     * Returns a value from 0 (fully exposed to sky) to 1 (deep underground)
     */
    calculateUndergroundFactor(playerPosition) {
        if (!this.game) return 0;

        const px = Math.floor(playerPosition.x);
        const py = Math.floor(playerPosition.y) + 2; // Start checking from above head
        const pz = Math.floor(playerPosition.z);

        // Check for blocks above the player up to a certain height
        let blocksAbove = 0;
        const maxCheckHeight = 20;

        for (let y = py; y < py + maxCheckHeight; y++) {
            const block = this.game.getBlock(px, y, pz);
            if (block && block.type !== 'water' && block.type !== 'glass') {
                blocksAbove++;
            }
        }

        // Also check adjacent columns to be more accurate
        const adjacentOffsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dx, dz] of adjacentOffsets) {
            for (let y = py; y < py + maxCheckHeight; y++) {
                const block = this.game.getBlock(px + dx, y, pz + dz);
                if (block && block.type !== 'water' && block.type !== 'glass') {
                    blocksAbove++;
                }
            }
        }

        // Normalize: if there are many blocks above, we're underground
        // 5 columns * maxCheckHeight = full check
        const maxPossibleBlocks = 5 * maxCheckHeight;
        const factor = Math.min(1, blocksAbove / (maxPossibleBlocks * 0.3)); // 30% coverage = fully dark

        return factor;
    }

    setupLighting() {
        // Ambient light
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(this.ambientLight);

        // Directional light (sun)
        this.sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
        this.sunLight.castShadow = true;

        // Shadow properties
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        const d = 50;
        this.sunLight.shadow.camera.left = -d;
        this.sunLight.shadow.camera.right = d;
        this.sunLight.shadow.camera.top = d;
        this.sunLight.shadow.camera.bottom = -d;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 200;

        this.scene.add(this.sunLight);

        // Sun Mesh
        // Sun Mesh (Square/Box)
        // Sun Mesh (Square Billboard)
        const sunGeometry = new THREE.PlaneGeometry(20, 20);
        const sunMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFD700,
            side: THREE.DoubleSide
        });
        this.sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
        this.scene.add(this.sunMesh);

        // Moon Mesh
        const moonGeometry = new THREE.SphereGeometry(6, 32, 32);
        const moonMaterial = new THREE.MeshBasicMaterial({ color: 0xDDDDDD });
        this.moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
        this.scene.add(this.moonMesh);

        // Hemisphere light for sky color
        this.hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x8B6914, 0.3);
        this.scene.add(this.hemiLight);
    }

    createSkyObjects() {
        // Starfield
        const starsGeometry = new THREE.BufferGeometry();
        const starsCount = 1000;
        const starPositions = new Float32Array(starsCount * 3);

        for (let i = 0; i < starsCount * 3; i++) {
            starPositions[i] = (Math.random() - 0.5) * 600; // Wide spread
        }

        starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        const starsMaterial = new THREE.PointsMaterial({ color: 0xFFFFFF, size: 0.5, transparent: true });
        this.stars = new THREE.Points(starsGeometry, starsMaterial);
        this.scene.add(this.stars);
    }

    updateDayNightCycle(deltaTime, playerPosition) {
        this.dayTime += deltaTime / this.dayDuration;
        if (this.dayTime >= 1) this.dayTime = 0;

        // Throttled underground check (expensive due to block lookups)
        // Run every 0.2 seconds (approx 12 frames)
        if (!this.lightingTimer) this.lightingTimer = 0;
        this.lightingTimer += deltaTime;

        if (this.lightingTimer > 0.2) {
            this.lightingTimer = 0;
            // Calculate underground factor (how covered by blocks the player is)
            this.targetUndergroundFactor = this.calculateUndergroundFactor(playerPosition);
        }

        // Smooth transition for underground lighting
        const lerpSpeed = 3.0; // How fast the lighting changes
        this.undergroundFactor += (this.targetUndergroundFactor - this.undergroundFactor) * Math.min(1, deltaTime * lerpSpeed);

        // Calculate angle (0 = sunrise, 0.25 = noon, 0.5 = sunset, 0.75 = midnight)
        const angle = this.dayTime * Math.PI * 2;
        const radius = 100;

        // Positioning relative to player so it follows them
        const centerX = playerPosition.x;
        const centerZ = playerPosition.z;

        // Move Sun
        this.sunMesh.position.x = centerX + Math.cos(angle) * radius;
        this.sunMesh.position.y = Math.sin(angle) * radius;
        this.sunMesh.position.z = centerZ; // Keep it simple on one axis for now

        // Billboard sun to face player
        this.sunMesh.lookAt(this.game.camera.position);

        this.sunLight.position.copy(this.sunMesh.position);

        // Move Moon (Opposite to sun)
        this.moonMesh.position.x = centerX + Math.cos(angle + Math.PI) * radius;
        this.moonMesh.position.y = Math.sin(angle + Math.PI) * radius;
        this.moonMesh.position.z = centerZ;

        // Move stars with player but keep high
        this.stars.position.x = playerPosition.x;
        this.stars.position.z = playerPosition.z;
        this.stars.position.y = 50; // High up
        this.stars.rotation.z += deltaTime * 0.01; // Slowly rotate stars

        // Colors and Intensities
        const sunHeight = Math.sin(angle);

        // Calculate base light intensities from day/night cycle
        let baseSunIntensity, baseAmbientIntensity;

        if (sunHeight > 0.1) {
            // Day
            baseSunIntensity = 0.8;
            baseAmbientIntensity = 0.5;
            this.stars.visible = false;
        } else if (sunHeight > -0.1) {
            // Sunrise/Sunset
            const t = (sunHeight + 0.1) / 0.2; // 0 to 1 transition
            baseSunIntensity = Math.max(0, t * 0.8);
            baseAmbientIntensity = 0.2 + t * 0.3;
            this.stars.visible = true;
            this.stars.material.opacity = 1 - t;
        } else {
            // Night
            baseSunIntensity = 0;
            baseAmbientIntensity = 0.2; // Moonlight
            this.stars.visible = true;
            this.stars.material.opacity = 0.8;
        }

        // Apply underground darkness factor
        // When fully underground, reduce ambient to very low (cave darkness)
        const undergroundMultiplier = 1 - (this.undergroundFactor * 0.85); // Keep minimum 15% light

        this.sunLight.intensity = baseSunIntensity * undergroundMultiplier;

        // Add flash to ambient
        let flashAdd = 0;
        if (this.game.weatherSystem) {
            flashAdd = this.game.weatherSystem.flashIntensity * 0.5;
        }

        this.ambientLight.intensity = (baseAmbientIntensity + flashAdd) * undergroundMultiplier;
        this.hemiLight.intensity = (0.3 + flashAdd * 0.5) * undergroundMultiplier;

        // Dynamic Sky Color
        this.updateSkyColor(sunHeight);

        this.updateClouds(deltaTime);
    }

    updateSkyColor(sunHeight) {
        let skyColor = new THREE.Color();

        // Check for weather overrides
        let weatherDarkness = 0;
        if (this.game.weatherSystem) {
            if (this.game.weatherSystem.currentWeather === 'rain') weatherDarkness = 0.5;
            if (this.game.weatherSystem.currentWeather === 'storm') weatherDarkness = 0.8;
        }

        if (sunHeight > 0.1) {
            // Day
            skyColor.setHex(0x87CEEB); // Sky Blue
        } else if (sunHeight > -0.1) {
            // Sunset / Sunrise
            // Transition directly between Blue and Dark Blue
            const dayColor = new THREE.Color(0x87CEEB);
            const nightColor = new THREE.Color(0x000011);

            // t is 0 (night side) to 1 (day side)
            const t = (sunHeight + 0.1) / 0.2; // 0 to 1 transition
            skyColor.copy(nightColor).lerp(dayColor, t);
        } else {
            // Night
            skyColor.setHex(0x000011);
        }

        // Apply weather darkness
        if (weatherDarkness > 0) {
            const gray = new THREE.Color(0x444455);
            skyColor.lerp(gray, weatherDarkness);
        }

        // Apply Lightning Flash
        if (this.game.weatherSystem && this.game.weatherSystem.flashIntensity > 0) {
            const flash = new THREE.Color(0xFFFFFF);
            skyColor.lerp(flash, this.game.weatherSystem.flashIntensity * 0.8);
        }

        this.game.renderer.setClearColor(skyColor);

        // Also update fog if it exists (good practice for depth)
        if (this.scene.fog) {
            this.scene.fog.color.copy(skyColor);

            // Adjust fog density for storms
            if (this.game.weatherSystem && this.game.weatherSystem.currentWeather !== 'clear') {
                this.scene.fog.near = 10;
                this.scene.fog.far = 40;
            } else {
                this.scene.fog.near = 20;
                this.scene.fog.far = 80;
            }
        } else {
            // Initialize fog if it doesn't exist, matching render distance somewhat
            // Render distance 4 chunks * 16 = 64 blocks. Fog should start earlier.
            this.scene.fog = new THREE.Fog(skyColor, 20, 80);
        }
    }

    createClouds() {
        const cloudCount = 30;
        const blocksPerCloud = 25;
        const cloudArea = 500;
        const cloudHeight = 80;

        const geometry = new THREE.BoxGeometry(4, 2, 4);
        const material = new THREE.MeshBasicMaterial({
            color: 0xFFFFFF,
            transparent: true,
            opacity: 0.8
        });

        this.clouds = new THREE.InstancedMesh(geometry, material, cloudCount * blocksPerCloud);
        this.clouds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        const dummy = new THREE.Object3D();
        let instanceIndex = 0;

        for (let i = 0; i < cloudCount; i++) {
            // Cloud cluster center
            const cx = (Math.random() - 0.5) * cloudArea;
            const cz = (Math.random() - 0.5) * cloudArea;
            const cy = cloudHeight + (Math.random() - 0.5) * 10;

            for (let j = 0; j < blocksPerCloud; j++) {
                dummy.position.set(
                    cx + (Math.random() - 0.5) * 20,
                    cy + (Math.random() - 0.5) * 5,
                    cz + (Math.random() - 0.5) * 20
                );

                // Random scale variation
                const scale = 1 + Math.random();
                dummy.scale.set(scale, scale * 0.5, scale);

                dummy.updateMatrix();
                this.clouds.setMatrixAt(instanceIndex++, dummy.matrix);
            }
        }

        this.clouds.castShadow = false; // Clouds don't cast shadows for performance/style
        this.clouds.receiveShadow = false;

        this.scene.add(this.clouds);
        this.cloudOffset = 0;
    }

    /**
     * Check if it's currently night time
     * @returns {boolean} - True if night, false if day
     */
    isNight() {
        const angle = this.dayTime * Math.PI * 2;
        const sunHeight = Math.sin(angle);
        return sunHeight < 0;
    }

    updateClouds(deltaTime) {
        if (!this.clouds) return;

        // Simple wind movement
        const windSpeed = 2.0;
        this.clouds.position.x += deltaTime * windSpeed;

        // Reset if too far (simple wrapping loop for visual continuity)
        // Note: For a truly infinite world, you'd want the clouds to follow the player 
        // with modulo offset, but for this experiment, simple looping is fine.
        if (this.clouds.position.x > 300) {
            this.clouds.position.x = -300;
        }
    }
}
