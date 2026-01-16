import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Rocketship extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 1.0;
        this.height = 2.0;
        this.depth = 1.0;
        this.speed = 5.0; // Fast!

        this.createBody();
        this.mesh.scale.set(1.5, 1.5, 1.5);

        // Rocket behavior states
        this.isFlying = true; // Always flying
        this.targetPos = new THREE.Vector3(x, y + 10, z);
        this.hoverHeight = 15;
        this.changeTargetTimer = 0;
    }

    createBody() {
        // Materials
        const matBody = new THREE.MeshLambertMaterial({ color: 0xEEEEEE }); // White/Silver
        const matNose = new THREE.MeshLambertMaterial({ color: 0xFF0000 }); // Red Nose
        const matFins = new THREE.MeshLambertMaterial({ color: 0xCC0000 }); // Darker Red Fins
        const matWindow = new THREE.MeshLambertMaterial({ color: 0x00AAFF, emissive: 0x001133 }); // Blue Window
        const matEngine = new THREE.MeshLambertMaterial({ color: 0x333333 }); // Grey Engine
        const matFlame = new THREE.MeshLambertMaterial({ color: 0xFFAA00, emissive: 0xFF4400 }); // Flame

        this.rocketGroup = new THREE.Group();
        // Rotate so it points UP by default, but we might want it to tilt forward when moving?
        // Actually simpler if "up" is local Y.
        this.mesh.add(this.rocketGroup);

        // Fuselage
        const bodyGeo = new THREE.CylinderGeometry(0.5, 0.5, 2.0, 16);
        const body = new THREE.Mesh(bodyGeo, matBody);
        body.position.set(0, 1.0, 0);
        this.rocketGroup.add(body);

        // Nose Cone
        const noseGeo = new THREE.ConeGeometry(0.5, 0.8, 16);
        const nose = new THREE.Mesh(noseGeo, matNose);
        nose.position.set(0, 2.4, 0);
        this.rocketGroup.add(nose);

        // Fins (4)
        const finGeo = new THREE.BoxGeometry(0.1, 0.8, 0.5);
        for (let i = 0; i < 4; i++) {
            const fin = new THREE.Mesh(finGeo, matFins);
            const angle = (i / 4) * Math.PI * 2;
            fin.position.set(Math.sin(angle) * 0.45, 0.4, Math.cos(angle) * 0.45);
            fin.rotation.y = -angle; // Rotate to face outward
            this.rocketGroup.add(fin);
        }

        // Window (Porthole)
        const windowGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 16);
        const windowMesh = new THREE.Mesh(windowGeo, matWindow);
        windowMesh.rotation.x = Math.PI / 2;
        windowMesh.position.set(0, 1.5, 0.45);
        this.rocketGroup.add(windowMesh);

        // Engine Nozzle
        const engineGeo = new THREE.CylinderGeometry(0.4, 0.3, 0.4, 16);
        const engine = new THREE.Mesh(engineGeo, matEngine);
        engine.position.set(0, -0.2, 0);
        this.rocketGroup.add(engine);

        // Flame (Animated part)
        const flameGeo = new THREE.ConeGeometry(0.25, 0.8, 8);
        this.flame = new THREE.Mesh(flameGeo, matFlame);
        this.flame.position.set(0, -0.8, 0);
        this.flame.rotation.x = Math.PI; // Point down
        this.rocketGroup.add(this.flame);
    }

    updateAI(dt) {
        this.changeTargetTimer -= dt;

        if (this.changeTargetTimer <= 0) {
            this.changeTargetTimer = 3 + Math.random() * 5;

            // Pick a random point in the sky
            // Near current position but random offset
            const range = 30;
            const dx = (Math.random() - 0.5) * range;
            const dz = (Math.random() - 0.5) * range;
            const dy = (Math.random() - 0.5) * 10; // Variation in height

            // Determine base height based on terrain?
            // For now just stay high
            const targetX = this.position.x + dx;
            const targetZ = this.position.z + dz;
            let targetY = this.position.y + dy;

            // Clamp height
            if (targetY < 10) targetY = 10;
            if (targetY > 40) targetY = 40;

            this.targetPos.set(targetX, targetY, targetZ);
        }
    }

    updatePhysics(dt) {
        // Move towards target
        const dir = new THREE.Vector3().subVectors(this.targetPos, this.position);
        const dist = dir.length();

        if (dist > 0.5) {
            dir.normalize();

            // Accel
            const moveSpeed = this.speed * dt;
            this.position.addScaledVector(dir, moveSpeed);

            // Rotate to face direction of movement (with some tilt?)
            // If moving horizontally, tilt forward?
            // "Forward" for rocket is usually Y up, but if it flies like a plane it might be Z forward.
            // Let's keep it vertical but tilt slightly towards movement

            // Calculate tilt
            // We want the TOP of the rocket (Y+) to point somewhat towards target?
            // Or just stay upright and Bob? 
            // Let's make it tilt in direction of movement

            // Current "Up" is (0,1,0). We want to blend that with movement dir.
            // But usually rockets fly "nose first". If we want it to fly nose first:
            // The nose is Y+. So we want local Y+ to align with `dir`.

            const targetQuaternion = new THREE.Quaternion();
            const up = new THREE.Vector3(0, 1, 0);

            // Minimal tilt logic:
            // Just tilt slightly based on horizontal velocity
            const tiltX = dir.z * -0.5; // Tilt forward/back
            const tiltZ = dir.x * 0.5;  // Tilt left/right

            this.mesh.rotation.x = tiltX;
            this.mesh.rotation.z = tiltZ;
            this.mesh.rotation.y = 0; // Don't spin Y unless we want to face?
        }

        // Bobbing
        this.position.y += Math.sin(Date.now() / 500) * 0.02;

        this.onGround = false;
        this.velocity.set(0, 0, 0); // Clear velocity for base class
    }

    updateAnimation(dt) {
        // Flicker flame
        if (this.flame) {
            const scale = 0.8 + Math.random() * 0.4;
            this.flame.scale.set(scale, scale, scale);
            this.flame.visible = true;
        }
    }
}
