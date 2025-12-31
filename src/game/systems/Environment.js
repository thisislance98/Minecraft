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

        // Visual Improvements: Sky Gradient
        this.createSkyGradient();

        // Initial update to ensure lights and sky are not dark on frame 0
        this.updateDayNightCycle(0, new THREE.Vector3(0, 0, 0));
    }

    updateDayNightCycle(dt, playerPos) {
        // Advance time (unless frozen)
        if (!this.timeFrozen) {
            this.time += dt / this.dayDuration;
            if (this.time > 1.0) this.time -= 1.0;
        }

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

        // Visual Improvements: Update Fog Color to match sky
        const currentSkyColor = this.nightColor.clone().lerp(this.skyColor, skyLerp);
        this.scene.fog.color.copy(currentSkyColor);
        // Also update renderer clear color just in case (though sky sphere covers it)
        this.game.renderer.setClearColor(currentSkyColor);

        // Update Sky Shader uniforms
        if (this.skyMesh) {
            this.skyMesh.material.uniforms.topColor.value.copy(currentSkyColor);
            // Horizon is slightly lighter/desaturated version of top
            const horizonColor = currentSkyColor.clone().offsetHSL(0.0, -0.1, 0.2);
            this.skyMesh.material.uniforms.bottomColor.value.copy(horizonColor);
            this.skyMesh.material.uniforms.offset.value = 33;
            this.skyMesh.material.uniforms.exponent.value = 0.6;

            // Update star visibility based on night
            if (this.starField) {
                this.starField.visible = this.isNight();
            }
        }

        // Visual Improvements: Underwater Fog
        if (this.game.player) {
            const playerY = this.game.player.position.y;
            const waterLevel = 30; // Approximate water level
            const isUnderwater = playerY < waterLevel && this.isPlayerInWater();

            if (isUnderwater) {
                this.scene.fog.color.setHex(0x1a5276);
                this.scene.fog.density = 0.08;
            } else {
                this.scene.fog.density = 0.0025;
            }
        }

        // Update cloud positions
        this.updateClouds(dt, playerPos);

        // Update shooting stars
        this.updateShootingStars(dt);
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

        const skyGeo = new THREE.SphereGeometry(800, 32, 15);
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
            const radius = 700;

            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = radius * Math.cos(phi);
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 2,
            sizeAttenuation: false
        });

        this.starField = new THREE.Points(geometry, material);
        this.starField.visible = false; // Start hidden
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
        const radius = 650;

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

    updateClouds(dt, playerPos) {
        if (!this.clouds) return;

        // Update cloud color based on day/night cycle
        if (this.cloudMaterial) {
            const angle = this.time * Math.PI * 2;
            const sunAboveHorizon = Math.max(0, Math.sin(angle));
            const skyLerp = Math.max(0, Math.min(1, sunAboveHorizon * 2.0));

            // Clouds go from dark grey at night to white during day
            const nightCloudColor = new THREE.Color(0x333344);
            const dayCloudColor = new THREE.Color(0xffffff);
            this.cloudMaterial.color.copy(nightCloudColor.clone().lerp(dayCloudColor, skyLerp));
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
