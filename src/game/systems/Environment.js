import * as THREE from 'three';

export class Environment {
    constructor(scene, game) {
        this.scene = scene;
        this.game = game;

        // Visual Improvements: Fog
        // Exp2 fog gives a nice thick atmosphere look
        this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.0025);

        // Time state
        this.time = 0.25; // 0.0 to 1.0 (0.0 is sunrise, 0.25 is noon, 0.5 is sunset)
        this.dayDuration = 1800; // seconds (30 minutes total cycle, 15m day / 15m night)

        // Lighting
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(this.ambientLight);

        this.sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 4096; // Increased resolution
        this.sunLight.shadow.mapSize.height = 4096;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 2500;

        // Large shadow area for player
        const d = 200; // Increased shadow distance
        this.sunLight.shadow.camera.left = -d;
        this.sunLight.shadow.camera.right = d;
        this.sunLight.shadow.camera.top = d;
        this.sunLight.shadow.camera.bottom = -d;

        this.sunLight.shadow.bias = -0.0001;
        this.sunLight.shadow.normalBias = 0.05;

        this.scene.add(this.sunLight);

        // Sky
        this.skyColor = new THREE.Color(0x87CEEB); // Sky blue
        this.nightColor = new THREE.Color(0x00000C); // Very dark blue

        // Visual Improvements: Sky Gradient
        this.createSkyGradient();

        // Visual Improvements: Sun
        this.createSun();

        // Visual Improvements: Moon
        this.createMoon();

        this.moonEnabled = true;
        this.shadowsEnabled = true;

        // World-specific environment state
        this.currentWorld = 'earth';

        // Alien world moons (multiple moons for crystal/lava worlds)
        this.alienMoons = [];

        // World color presets
        this.worldPresets = {
            earth: {
                skyColor: new THREE.Color(0x87CEEB),
                nightColor: new THREE.Color(0x00000C),
                fogColor: 0x87CEEB,
                fogDensity: 0.0025,
                ambientTint: 0xffffff
            },
            crystal: {
                skyColor: new THREE.Color(0x050510),     // Black sky with slight purple tint
                nightColor: new THREE.Color(0x020208),    // Deeper black night
                fogColor: 0x1A0A2E,                       // Dark purple fog
                fogDensity: 0.002,
                ambientTint: 0xDDAAFF,
                alwaysShowStars: true,                    // Stars always visible
                cloudColor: 0xAA66FF,                     // Purple clouds
                moons: [
                    { color: 0xCC88FF, size: 30, position: { x: 800, y: 1200, z: 400 } },    // Large purple moon
                    { color: 0x8866DD, size: 15, position: { x: -600, y: 900, z: -300 } }    // Small distant moon
                ]
            },
            lava: {
                skyColor: new THREE.Color(0x0A0505),     // Black sky with slight red tint
                nightColor: new THREE.Color(0x050202),    // Deeper black night
                fogColor: 0x1A0808,                       // Dark red fog
                fogDensity: 0.003,
                ambientTint: 0xFFAA88,
                alwaysShowStars: true,                    // Stars always visible
                cloudColor: 0xFF6633,                     // Orange/red clouds
                moons: [
                    { color: 0xFF6633, size: 40, position: { x: 500, y: 1000, z: 200 } },    // Large orange moon
                    { color: 0xDD4422, size: 20, position: { x: -400, y: 1100, z: -500 } },  // Medium red moon
                    { color: 0x883311, size: 12, position: { x: 700, y: 800, z: -400 } }     // Small dark moon
                ]
            },
            moon: {
                skyColor: new THREE.Color(0x000000),     // Black space
                nightColor: new THREE.Color(0x000000),
                fogColor: 0x000000,
                fogDensity: 0.0001,
                ambientTint: 0xCCCCCC,
                alwaysShowStars: true                     // Stars always visible in space
            },
            soccer: {
                skyColor: new THREE.Color(0x1E90FF),     // Dodger blue - stadium sky
                nightColor: new THREE.Color(0x0A1A3A),   // Dark blue night
                fogColor: 0x87CEEB,                       // Light sky blue fog
                fogDensity: 0.001,                        // Light fog for stadium feel
                ambientTint: 0xFFFFFF,                    // Bright stadium lights
                cloudColor: 0xFFFFFF                      // White clouds
            }
        };

        // Initial update to ensure lights and sky are not dark on frame 0
        // Must be called AFTER worldPresets and currentWorld are initialized
        this.updateDayNightCycle(0, new THREE.Vector3(0, 0, 0));
    }

    /**
     * Set the current world and update environment visuals
     * @param {string} worldName - 'earth', 'crystal', 'lava', or 'moon'
     */
    setWorld(worldName) {
        if (!this.worldPresets[worldName]) {
            console.warn(`[Environment] Unknown world: ${worldName}`);
            return;
        }

        console.log(`[Environment] Switching to ${worldName} world`);
        this.currentWorld = worldName;

        const preset = this.worldPresets[worldName];

        // Update sky colors - these will be blended in updateDayNightCycle
        this.skyColor.copy(preset.skyColor);
        this.nightColor.copy(preset.nightColor);

        // Update fog
        this.scene.fog.color.setHex(preset.fogColor);
        this.scene.fog.density = preset.fogDensity;

        // Update ambient light tint
        this.ambientLight.color.setHex(preset.ambientTint);

        // Handle alien world moons
        if (preset.moons) {
            this.createAlienMoons(preset.moons);
            // Hide Earth's moon in alien worlds
            if (this.moonMesh) this.moonMesh.visible = false;
        } else {
            this.clearAlienMoons();
            // Restore Earth's moon visibility
            if (this.moonMesh && this.moonEnabled) this.moonMesh.visible = true;
        }

        // Update cloud visibility and color based on world
        if (this.clouds) {
            // Show clouds on worlds that have cloudColor defined, or on Earth
            const hasClouds = worldName === 'earth' || preset.cloudColor;
            this.clouds.visible = hasClouds;

            // Update cloud material color for alien worlds
            if (this.cloudMaterial && preset.cloudColor) {
                this.cloudMaterial.color.setHex(preset.cloudColor);
            }
        }
    }

    /**
     * Detect which world the player is in based on Y position and update environment
     * World boundaries (in blocks, chunk Y * 16):
     * - Earth: Y < 640 (chunk Y < 40)
     * - Moon: Y 640-767 (chunk Y 40-47)
     * - Crystal: Y 800-927 (chunk Y 50-57)
     * - Lava: Y 960-1087 (chunk Y 60-67)
     */
    detectWorldFromPosition(playerPos) {
        const chunkY = Math.floor(playerPos.y / 16);
        let detectedWorld = 'earth';

        // Check world boundaries based on Config values
        // Moon: chunks 40-47
        if (chunkY >= 40 && chunkY < 48) {
            detectedWorld = 'moon';
        }
        // Crystal World: chunks 50-57
        else if (chunkY >= 50 && chunkY < 58) {
            detectedWorld = 'crystal';
        }
        // Lava World: chunks 60-67
        else if (chunkY >= 60 && chunkY < 68) {
            detectedWorld = 'lava';
        }
        // Soccer World: chunks 70-77
        else if (chunkY >= 70 && chunkY < 78) {
            detectedWorld = 'soccer';
        }

        // Only switch if different from current world
        if (detectedWorld !== this.currentWorld) {
            this.setWorld(detectedWorld);
        }
    }

    toggleShadows(enabled) {
        this.shadowsEnabled = enabled;
        // Force update immediately
        if (!enabled) {
            if (this.sunLight) this.sunLight.castShadow = false;
            if (this.moonLight) this.moonLight.castShadow = false;
        }
    }

    toggleMoon(enabled) {
        this.moonEnabled = enabled;
        if (!enabled) {
            if (this.moonMesh) this.moonMesh.visible = false;
            if (this.moonLight) {
                this.moonLight.visible = false;
                this.moonLight.castShadow = false;
            }
        }
    }

    updateDayNightCycle(dt, playerPos) {
        // Advance time (unless frozen)
        if (!this.timeFrozen) {
            this.time += dt / this.dayDuration;
            if (this.time > 1.0) this.time -= 1.0;
        }

        // Auto-detect world based on player Y position (chunk coordinates)
        this.detectWorldFromPosition(playerPos);

        // Calculate sun position
        // angle 0 = sunrise, PI/2 = noon, PI = sunset, 3PI/2 = midnight
        const angle = this.time * Math.PI * 2;

        const distance = 1500;
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

        if (this.sunMesh) {
            this.sunMesh.position.copy(this.sunLight.position);
        }

        // Update shadow camera far plane based on altitude to ensure ground is shadowed
        // Base far is 500. If player is at Y=600, light is at ~800. Ground at 30. Dist ~770.
        this.sunLight.shadow.camera.far = 2500 + Math.max(0, playerPos.y * 1.5);
        this.sunLight.shadow.camera.updateProjectionMatrix();

        // Update Skybox position to follow player
        if (this.skyMesh) {
            this.skyMesh.position.copy(playerPos);
        }
        if (this.starField) {
            this.starField.position.copy(playerPos);
        }
        if (this.shootingStarGroup) {
            this.shootingStarGroup.position.copy(playerPos);
        }

        // Update intensity and colors
        const sunAboveHorizon = Math.max(0, Math.sin(angle));
        this.sunLight.intensity = sunAboveHorizon * 1.2;

        // PERFORMANCE FIX: Only cast shadows when sun is actually up AND shadows are globally enabled
        // This prevents double shadow-map rendering when both Moon and Sun are in the scene (one underground)
        const isSunUp = sunAboveHorizon > 0.01;
        this.sunLight.castShadow = isSunUp && this.shadowsEnabled;
        this.sunLight.visible = isSunUp;

        // Moon Logic
        if (this.moonMesh) {
            if (!this.moonEnabled) {
                this.moonMesh.visible = false;
                if (this.moonLight) {
                    this.moonLight.visible = false;
                    this.moonLight.castShadow = false;
                }
            } else {
                this.moonMesh.visible = true;

                // Moon is opposite to sun
                const moonAngle = angle + Math.PI;
                const moonX = Math.cos(moonAngle) * distance;
                const moonY = Math.sin(moonAngle) * distance;
                const moonZ = Math.sin(moonAngle * 0.5) * distance * 0.2;

                // Fixed Moon Position at Y=1000 (0, 1000, 0)
                this.moonMesh.position.set(0, 1000, 0);
                this.moonMesh.lookAt(playerPos);

                // Update Moon Light
                // Moon light is active when sun is down
                const moonAboveHorizon = Math.max(0, Math.sin(moonAngle));
                if (this.moonLight) {
                    this.moonLight.position.copy(this.moonMesh.position);
                    this.moonLight.target.position.copy(playerPos);
                    this.moonLight.target.updateMatrixWorld();

                    // Max moon intensity 0.2, fade in/out near horizon
                    this.moonLight.intensity = moonAboveHorizon * 0.2;

                    // PERFORMANCE FIX: Only cast shadows when moon is up AND shadows are globally enabled
                    const isMoonUp = moonAboveHorizon > 0.01;
                    this.moonLight.castShadow = isMoonUp && this.shadowsEnabled;
                    this.moonLight.visible = isMoonUp;
                }
            }
        }

        // Calculate space transition factor
        // Only apply space transition on Earth - alien worlds have their own sky colors
        const playerY = playerPos.y;
        const spaceStart = 200;
        const spaceFull = 600;
        let spaceFactor = 0;

        // Space transition only applies on Earth world
        if (this.currentWorld === 'earth' && playerY > spaceStart) {
            spaceFactor = Math.min(1, Math.max(0, (playerY - spaceStart) / (spaceFull - spaceStart)));
        }

        // Sky color interpolation
        const skyLerp = Math.max(0, Math.min(1, sunAboveHorizon * 2.0));
        const atmosphericSkyColor = this.nightColor.clone().lerp(this.skyColor, skyLerp);

        // Blend towards black space color based on altitude
        const spaceColor = new THREE.Color(0x000000);
        const currentSkyColor = atmosphericSkyColor.clone().lerp(spaceColor, spaceFactor);

        this.game.renderer.setClearColor(currentSkyColor);

        this.ambientLight.intensity = (0.1 + sunAboveHorizon * 0.3) * (1.0 - spaceFactor * 0.3); // Slightly dimmer in space

        // Visual Improvements: Fog
        // Underwater fog overrides everything
        const waterLevel = 30; // Approximate water level
        const isUnderwater = this.game.player && this.game.player.position.y < waterLevel && this.isPlayerInWater();

        if (isUnderwater) {
            this.scene.fog.color.setHex(0x1a5276);
            this.scene.fog.density = 0.08;
        } else {
            // Update Fog Color to match sky
            this.scene.fog.color.copy(currentSkyColor);

            // Fade out fog FASTER as we go to space to avoid "flashlight" effect on ground
            // At spaceStart (200), we want distinct visibility improvement.
            // At 400 we want almost no fog on the ground.

            const baseDensity = 0.0025;
            // Use squared falloff for rapid clearing
            const fogFactor = Math.max(0, 1.0 - spaceFactor * 1.5);
            this.scene.fog.density = baseDensity * (fogFactor * fogFactor);
        }

        // Update Sky Shader uniforms
        if (this.skyMesh) {
            this.skyMesh.material.uniforms.topColor.value.copy(currentSkyColor);
            // Horizon is slightly lighter/desaturated version of top, but in space it should just be black
            const baseHorizon = currentSkyColor.clone().offsetHSL(0.0, -0.1, 0.2);
            // If in space, horizon also becomes black
            const horizonColor = baseHorizon.lerp(spaceColor, spaceFactor);

            this.skyMesh.material.uniforms.bottomColor.value.copy(horizonColor);
            this.skyMesh.material.uniforms.offset.value = 33;
            this.skyMesh.material.uniforms.exponent.value = 0.6;
        }

        // Update star visibility based on night OR space OR alien world
        if (this.starField) {
            // Check if current world always shows stars (alien worlds)
            const preset = this.worldPresets[this.currentWorld];
            const alwaysShowStars = preset && preset.alwaysShowStars;

            // Stars are visible at night (1.0) or in space (1.0) or in alien worlds (1.0)
            const nightOpacity = this.isNight() ? 1.0 : 0.0;

            let targetOpacity = nightOpacity;

            // In space, show stars even during day
            if (spaceFactor > 0) {
                targetOpacity = Math.max(targetOpacity, spaceFactor);
            }

            // In alien worlds with black sky, always show stars
            if (alwaysShowStars) {
                targetOpacity = 1.0;
            }

            this.starField.material.opacity = targetOpacity;
            this.starField.visible = targetOpacity > 0.01;
        }

        // Update cloud positions
        this.updateClouds(dt, playerPos);

        // Update shooting stars
        this.updateShootingStars(dt);

        // Update alien world moons
        this.updateAlienMoons(playerPos);
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
        if (this.timeFrozen) return;
        this.time = t;
    }

    freezeTime(freeze) {
        this.timeFrozen = freeze;
    }

    isPlayerInWater() {
        const pos = this.game.player.position;
        const block = this.game.getBlock(Math.floor(pos.x), Math.floor(pos.y + 1), Math.floor(pos.z));
        return block && block.type === 'water';
    }

    createSkyGradient() {
        const vertexShader = `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
            }
        `;

        const fragmentShader = `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform float offset;
            uniform float exponent;
            varying vec3 vWorldPosition;
            void main() {
                float h = normalize( vWorldPosition + offset ).y;
                gl_FragColor = vec4( mix( bottomColor, topColor, max( pow( max( h , 0.0), exponent ), 0.0 ) ), 1.0 );
            }
        `;

        const uniforms = {
            topColor: { value: new THREE.Color(0x0077ff) },
            bottomColor: { value: new THREE.Color(0xffffff) },
            offset: { value: 33 },
            exponent: { value: 0.6 }
        };

        const skyGeo = new THREE.SphereGeometry(2000, 32, 15);
        const skyMat = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            side: THREE.BackSide
        });

        this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(this.skyMesh);

        // Visual Improvements: Starfield
        this.createStarfield();
    }

    createStarfield() {
        const starCount = 1000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(starCount * 3);

        for (let i = 0; i < starCount; i++) {
            // Random position on a sphere
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const radius = 1900;

            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = radius * Math.cos(phi);
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 2,
            sizeAttenuation: false,
            transparent: true,
            opacity: 0
        });

        this.starField = new THREE.Points(geometry, material);
        this.starField.visible = true;
        this.scene.add(this.starField);

        // Visual Improvements: Shooting Stars
        this.createShootingStars();

        // Visual Improvements: Clouds
        this.createClouds();
    }

    createShootingStars() {
        this.shootingStars = [];
        this.shootingStarGroup = new THREE.Group();
        this.shootingStarGroup.visible = false;
        this.scene.add(this.shootingStarGroup);

        // Time tracking for spawning
        this.shootingStarTimer = 0;
        this.shootingStarInterval = 3 + Math.random() * 5; // 3-8 seconds between stars

        // Create a pool of shooting stars (max 3 at once)
        const maxShootingStars = 3;

        for (let i = 0; i < maxShootingStars; i++) {
            // Create line geometry for shooting star trail
            const trailLength = 20;
            const positions = new Float32Array(trailLength * 3);
            const colors = new Float32Array(trailLength * 3);

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

            const material = new THREE.LineBasicMaterial({
                vertexColors: true,
                transparent: true,
                opacity: 0.9,
                blending: THREE.AdditiveBlending
            });

            const line = new THREE.Line(geometry, material);
            line.visible = false;

            const star = {
                mesh: line,
                active: false,
                position: new THREE.Vector3(),
                velocity: new THREE.Vector3(),
                trailPositions: [],
                trailLength: trailLength,
                life: 0,
                maxLife: 0
            };

            this.shootingStars.push(star);
            this.shootingStarGroup.add(line);
        }
    }

    spawnShootingStar() {
        // Find an inactive shooting star
        const star = this.shootingStars.find(s => !s.active);
        if (!star) return;

        // Random starting position on the sky dome (upper hemisphere only)
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.4 + 0.1; // Keep in upper sky
        const radius = 1800;

        star.position.set(
            radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.cos(phi), // Upper sky
            radius * Math.sin(phi) * Math.sin(theta)
        );

        // Random direction (generally downward arc)
        const speed = 300 + Math.random() * 200;
        const dirTheta = theta + Math.PI * 0.3 + Math.random() * 0.4;
        const dirPhi = phi + Math.PI * 0.2 + Math.random() * 0.2;

        star.velocity.set(
            Math.sin(dirPhi) * Math.cos(dirTheta) * speed,
            -Math.abs(Math.cos(dirPhi)) * speed * 0.5, // Always go somewhat downward
            Math.sin(dirPhi) * Math.sin(dirTheta) * speed
        );

        // Initialize trail
        star.trailPositions = [];
        for (let i = 0; i < star.trailLength; i++) {
            star.trailPositions.push(star.position.clone());
        }

        star.life = 0;
        star.maxLife = 1.5 + Math.random() * 1.0; // 1.5-2.5 seconds
        star.active = true;
        star.mesh.visible = true;
    }

    updateShootingStars(dt) {
        if (!this.shootingStarGroup) return;

        const isNight = this.isNight();
        this.shootingStarGroup.visible = isNight;

        if (!isNight) return;

        // Spawn new shooting stars periodically
        this.shootingStarTimer += dt;
        if (this.shootingStarTimer >= this.shootingStarInterval) {
            this.shootingStarTimer = 0;
            this.shootingStarInterval = 3 + Math.random() * 5;
            this.spawnShootingStar();
        }

        // Update active shooting stars
        for (const star of this.shootingStars) {
            if (!star.active) continue;

            star.life += dt;

            if (star.life >= star.maxLife) {
                star.active = false;
                star.mesh.visible = false;
                continue;
            }

            // Move the star
            star.position.add(star.velocity.clone().multiplyScalar(dt));

            // Update trail (shift positions and add new head)
            star.trailPositions.pop();
            star.trailPositions.unshift(star.position.clone());

            // Update geometry
            const positions = star.mesh.geometry.attributes.position.array;
            const colors = star.mesh.geometry.attributes.color.array;

            for (let i = 0; i < star.trailLength; i++) {
                const pos = star.trailPositions[i];
                positions[i * 3] = pos.x;
                positions[i * 3 + 1] = pos.y;
                positions[i * 3 + 2] = pos.z;

                // Fade trail from bright white/yellow to dark
                const t = i / star.trailLength;
                const fadeOut = star.life / star.maxLife;
                const alpha = (1 - t) * (1 - fadeOut * 0.8);

                // Color: white head fading to golden yellow tail
                colors[i * 3] = 1.0 * alpha;     // R
                colors[i * 3 + 1] = (1.0 - t * 0.3) * alpha; // G
                colors[i * 3 + 2] = (1.0 - t * 0.7) * alpha; // B
            }

            star.mesh.geometry.attributes.position.needsUpdate = true;
            star.mesh.geometry.attributes.color.needsUpdate = true;
        }
    }

    createClouds() {
        this.clouds = new THREE.Group();
        const cloudCount = 20;

        // Cloud material (semi-transparent, will be tinted based on day/night)
        this.cloudMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.9
        });

        // Blocky cloud geometry (4x1x4 blocks, Minecraft style)
        const blockSize = 4;

        for (let i = 0; i < cloudCount; i++) {
            const cloudGroup = new THREE.Group();

            // Create a random blocky cloud shape (5-10 blocks)
            const cloudWidth = 3 + Math.floor(Math.random() * 5);
            const cloudDepth = 2 + Math.floor(Math.random() * 3);

            for (let x = 0; x < cloudWidth; x++) {
                for (let z = 0; z < cloudDepth; z++) {
                    // Random chance to skip for irregular shape
                    if (Math.random() < 0.3) continue;

                    const blockGeo = new THREE.BoxGeometry(blockSize, blockSize * 0.5, blockSize);
                    const block = new THREE.Mesh(blockGeo, this.cloudMaterial);
                    block.position.set(x * blockSize, 0, z * blockSize);
                    cloudGroup.add(block);
                }
            }

            // Position cloud in a ring around origin
            const angle = (i / cloudCount) * Math.PI * 2 + Math.random() * 0.5;
            const radius = 50 + Math.random() * 100;
            const height = 60 + Math.random() * 20;

            cloudGroup.position.set(
                Math.cos(angle) * radius,
                height,
                Math.sin(angle) * radius
            );

            // Store for animation
            cloudGroup.userData.driftSpeed = 0.3 + Math.random() * 0.5;
            cloudGroup.userData.angle = angle;
            cloudGroup.userData.radius = radius;

            this.clouds.add(cloudGroup);
        }

        this.scene.add(this.clouds);
    }

    createSun() {
        const sunGeo = new THREE.SphereGeometry(60, 32, 32);
        const sunMat = new THREE.MeshBasicMaterial({
            color: 0xffffaa, // Warm yellow
            fog: false // Sun shouldn't be affected by fog
        });
        this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
        this.scene.add(this.sunMesh);
    }

    createMoon() {
        // Create Moon Mesh
        const moonGeo = new THREE.SphereGeometry(20, 32, 32);
        const moonMat = new THREE.MeshBasicMaterial({ color: 0xdddddd });
        this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
        this.scene.add(this.moonMesh);

        // Create Moon Light (Cold/Blueish night light)
        this.moonLight = new THREE.DirectionalLight(0x6666ff, 0.2);
        this.moonLight.castShadow = true;
        this.moonLight.shadow.mapSize.width = 2048; // Increased resolution
        this.moonLight.shadow.mapSize.height = 2048;
        this.moonLight.shadow.camera.near = 0.5;
        this.moonLight.shadow.camera.far = 3500;

        const d = 200; // Increased shadow distance
        this.moonLight.shadow.camera.left = -d;
        this.moonLight.shadow.camera.right = d;
        this.moonLight.shadow.camera.top = d;
        this.moonLight.shadow.camera.bottom = -d;

        this.moonLight.shadow.bias = -0.0001;
        this.moonLight.shadow.normalBias = 0.05;

        this.scene.add(this.moonLight);
        this.scene.add(this.moonLight.target); // Important for direction
    }

    createAlienMoons(moonConfigs) {
        // Remove existing alien moons
        this.clearAlienMoons();

        if (!moonConfigs || moonConfigs.length === 0) return;

        for (const config of moonConfigs) {
            const moonGeo = new THREE.SphereGeometry(config.size, 32, 32);
            const moonMat = new THREE.MeshBasicMaterial({
                color: config.color,
                fog: false
            });
            const moonMesh = new THREE.Mesh(moonGeo, moonMat);
            moonMesh.position.set(config.position.x, config.position.y, config.position.z);

            // Add a subtle glow effect
            const glowGeo = new THREE.SphereGeometry(config.size * 1.3, 32, 32);
            const glowMat = new THREE.MeshBasicMaterial({
                color: config.color,
                transparent: true,
                opacity: 0.15,
                fog: false
            });
            const glowMesh = new THREE.Mesh(glowGeo, glowMat);
            moonMesh.add(glowMesh);

            this.scene.add(moonMesh);
            this.alienMoons.push({
                mesh: moonMesh,
                basePosition: { ...config.position },
                color: config.color
            });
        }
    }

    clearAlienMoons() {
        for (const moon of this.alienMoons) {
            this.scene.remove(moon.mesh);
            moon.mesh.geometry.dispose();
            moon.mesh.material.dispose();
        }
        this.alienMoons = [];
    }

    updateAlienMoons(playerPos) {
        // Update alien moon positions relative to player (they follow the player like the sky)
        for (const moon of this.alienMoons) {
            moon.mesh.position.set(
                playerPos.x + moon.basePosition.x,
                playerPos.y + moon.basePosition.y,
                playerPos.z + moon.basePosition.z
            );
        }
    }

    updateClouds(dt, playerPos) {
        if (!this.clouds) return;

        // Update cloud color based on day/night cycle (only on Earth)
        if (this.cloudMaterial) {
            const preset = this.worldPresets[this.currentWorld];

            if (preset.cloudColor) {
                // Alien worlds use their preset cloud color with slight day/night variation
                const angle = this.time * Math.PI * 2;
                const sunAboveHorizon = Math.max(0, Math.sin(angle));
                const skyLerp = Math.max(0, Math.min(1, sunAboveHorizon * 2.0));

                const baseColor = new THREE.Color(preset.cloudColor);
                const nightColor = baseColor.clone().multiplyScalar(0.4); // Darker at night
                this.cloudMaterial.color.copy(nightColor.clone().lerp(baseColor, skyLerp));
            } else {
                // Earth clouds: white during day, grey at night
                const angle = this.time * Math.PI * 2;
                const sunAboveHorizon = Math.max(0, Math.sin(angle));
                const skyLerp = Math.max(0, Math.min(1, sunAboveHorizon * 2.0));

                const nightCloudColor = new THREE.Color(0x333344);
                const dayCloudColor = new THREE.Color(0xffffff);
                this.cloudMaterial.color.copy(nightCloudColor.clone().lerp(dayCloudColor, skyLerp));
            }
        }

        // Drift clouds slowly in +X direction (like wind blowing)
        for (const cloud of this.clouds.children) {
            cloud.position.x += cloud.userData.driftSpeed * dt;

            // Wrap around when too far (cloud recycling)
            if (cloud.position.x > playerPos.x + 500) {
                cloud.position.x = playerPos.x - 500;
            }
        }
    }
}
