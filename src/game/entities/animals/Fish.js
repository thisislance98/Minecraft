import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Fish extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.4;
        this.height = 0.3;
        this.depth = 0.6;
        this.speed = 2.0;
        this.health = 2;
        this.maxHealth = 2;

        // Fish-specific properties
        this.gravity = 0;
        this.avoidsWater = false;
        this.isAquatic = true;
        this.swimSpeed = 2.5;
        this.time = 0;

        // Swimming AI state
        this.swimTarget = new THREE.Vector3(x, y, z);
        this.swimRadius = 12;
        this.baseY = y;

        // Flee from player
        this.fleeOnProximity = true;
        this.fleeRange = 5;

        // Pick a random fish color variant
        const colorVariants = [
            { body: 0xFF6B35, belly: 0xFFB347, fin: 0xFF4500, stripe: 0xFFD700 },  // Orange clownfish
            { body: 0x4169E1, belly: 0x87CEEB, fin: 0x1E90FF, stripe: 0x00BFFF },  // Blue fish
            { body: 0x32CD32, belly: 0x98FB98, fin: 0x228B22, stripe: 0x7CFC00 },  // Green fish
            { body: 0xFF1493, belly: 0xFFB6C1, fin: 0xC71585, stripe: 0xFF69B4 },  // Pink tropical
            { body: 0xFFD700, belly: 0xFFF8DC, fin: 0xDAA520, stripe: 0xFFA500 },  // Goldfish
            { body: 0x8A2BE2, belly: 0xD8BFD8, fin: 0x9400D3, stripe: 0xBA55D3 },  // Purple fish
        ];
        this.colors = colorVariants[Math.floor(this.rng.next() * colorVariants.length)];

        this.createBody();

        // Vary fish size slightly
        const scale = 0.6 + this.rng.next() * 0.4;
        this.mesh.scale.set(scale, scale, scale);

        this.state = 'walk'; // Use walk state for swimming
    }

    createBody() {
        const body = new THREE.Group();

        const matBody = new THREE.MeshStandardMaterial({ color: this.colors.body, roughness: 0.4, metalness: 0.2 });
        const matBelly = new THREE.MeshStandardMaterial({ color: this.colors.belly, roughness: 0.4, metalness: 0.1 });
        const matFin = new THREE.MeshStandardMaterial({ color: this.colors.fin, roughness: 0.5, metalness: 0.1 });
        const matStripe = new THREE.MeshStandardMaterial({ color: this.colors.stripe, roughness: 0.4, metalness: 0.2 });

        // Main body
        const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 0.5), matBody);
        bodyMesh.castShadow = true;
        body.add(bodyMesh);

        // Belly (lighter underside)
        const bellyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.4), matBelly);
        bellyMesh.position.y = -0.12;
        body.add(bellyMesh);

        // Stripes
        for (let i = -1; i <= 1; i += 2) {
            const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.08), matStripe);
            stripe.position.set(0, 0.02, i * 0.12);
            body.add(stripe);
        }

        // Eyes
        const matEye = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
        const matPupil = new THREE.MeshStandardMaterial({ color: 0x111111 });
        for (let side = -1; side <= 1; side += 2) {
            const eye = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.08), matEye);
            eye.position.set(side * 0.13, 0.06, 0.18);
            body.add(eye);

            const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.05), matPupil);
            pupil.position.set(side * 0.15, 0.06, 0.2);
            body.add(pupil);
        }

        // Mouth
        const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.04), matPupil);
        mouth.position.set(0, -0.06, 0.26);
        body.add(mouth);

        // Tail fin
        this.tailFin = new THREE.Group();
        const tailTop = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.15, 0.12), matFin);
        tailTop.position.set(0, 0.05, 0);
        tailTop.rotation.x = -0.3;
        this.tailFin.add(tailTop);

        const tailBottom = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.15, 0.12), matFin);
        tailBottom.position.set(0, -0.05, 0);
        tailBottom.rotation.x = 0.3;
        this.tailFin.add(tailBottom);

        this.tailFin.position.set(0, 0, -0.3);
        body.add(this.tailFin);

        // Dorsal fin (top)
        this.dorsalFin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.2), matFin);
        this.dorsalFin.position.set(0, 0.2, -0.02);
        body.add(this.dorsalFin);

        // Side fins (pectoral)
        this.leftFin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.1), matFin);
        this.leftFin.position.set(-0.15, -0.05, 0.08);
        this.leftFin.rotation.z = 0.3;
        body.add(this.leftFin);

        this.rightFin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.1), matFin);
        this.rightFin.position.set(0.15, -0.05, 0.08);
        this.rightFin.rotation.z = -0.3;
        body.add(this.rightFin);

        this.bodyGroup = body;
        this.mesh.add(body);
    }

    updatePhysics(dt) {
        // Check for water
        const pos = this.position;
        const block = this.game.getBlock(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
        const inWater = block && block.type === 'water';

        if (inWater) {
            // Smooth swimming in water
            this.velocity.x *= 0.9;
            this.velocity.y *= 0.9;
            this.velocity.z *= 0.9;

            if (this.state === 'walk') {
                const speed = 2.0;
                this.velocity.x += this.moveDirection.x * speed * dt;
                this.velocity.y += this.moveDirection.y * speed * dt;
                this.velocity.z += this.moveDirection.z * speed * dt;
            }

            this.position.add(this.velocity.clone().multiplyScalar(dt));

            // Collision check - bounce off solid blocks
            if (this.checkBodyCollision(this.position.x, this.position.y, this.position.z)) {
                this.position.sub(this.velocity.clone().multiplyScalar(dt));
                this.rotation = this.rng.next() * Math.PI * 2;
                this.moveDirection.set(Math.sin(this.rotation), (this.rng.next() - 0.5), Math.cos(this.rotation));
            }

            this.onGround = false;
        } else {
            // Out of water - flop around
            this.velocity.y -= 30.0 * dt;
            super.updateWalkerPhysics(dt);

            // Flop randomly
            if (this.onGround && this.rng.next() < 0.05) {
                this.velocity.y = 5;
                this.velocity.x = (this.rng.next() - 0.5) * 5;
                this.velocity.z = (this.rng.next() - 0.5) * 5;
            }
        }

        // Sync mesh
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.rotation;
    }

    updateAI(dt) {
        super.updateAI(dt);
        // Add vertical movement component for 3D swimming
        if (Math.abs(this.moveDirection.y) < 0.01 && this.state === 'walk') {
            this.moveDirection.y = (this.rng.next() - 0.5) * 0.5;
        }

        // Flee from player when nearby
        if (this.game.player) {
            const playerDist = this.position.distanceTo(this.game.player.position);
            if (playerDist < this.fleeRange) {
                const awayX = this.position.x - this.game.player.position.x;
                const awayZ = this.position.z - this.game.player.position.z;
                const awayLen = Math.sqrt(awayX * awayX + awayZ * awayZ);
                if (awayLen > 0.1) {
                    this.moveDirection.x = awayX / awayLen;
                    this.moveDirection.z = awayZ / awayLen;
                    this.rotation = Math.atan2(awayX, awayZ);
                }
            }
        }
    }

    update(dt) {
        if (!this.mesh) return;
        super.update(dt);
        this.time += dt;

        // Tail swish animation
        if (this.tailFin) {
            this.tailFin.rotation.y = Math.sin(this.time * 8) * 0.4;
        }

        // Dorsal fin gentle wave
        if (this.dorsalFin) {
            this.dorsalFin.rotation.z = Math.sin(this.time * 3) * 0.1;
        }

        // Side fins flap
        if (this.leftFin) {
            this.leftFin.rotation.z = 0.3 + Math.sin(this.time * 5) * 0.2;
        }
        if (this.rightFin) {
            this.rightFin.rotation.z = -0.3 - Math.sin(this.time * 5) * 0.2;
        }

        // Gentle body sway
        if (this.bodyGroup) {
            this.bodyGroup.rotation.z = Math.sin(this.time * 4) * 0.05;
        }
    }

    checkBodyCollision(x, y, z) {
        const cos = Math.abs(Math.cos(this.rotation));
        const sin = Math.abs(Math.sin(this.rotation));
        const effW = (this.width * cos + this.depth * sin) * this.collisionScale;
        const effD = (this.width * sin + this.depth * cos) * this.collisionScale;
        const hw = effW / 2;
        const hd = effD / 2;

        const startBX = Math.floor(x - hw);
        const endBX = Math.floor(x + hw);
        const startBY = Math.floor(y);
        const endBY = Math.floor(y + this.height - 0.01);
        const startBZ = Math.floor(z - hd);
        const endBZ = Math.floor(z + hd);

        for (let bx = startBX; bx <= endBX; bx++) {
            for (let by = startBY; by <= endBY; by++) {
                for (let bz = startBZ; bz <= endBZ; bz++) {
                    const block = this.game.getBlock(bx, by, bz);
                    if (block && block.type !== 'water') {
                        return true;
                    }
                }
            }
        }
        return false;
    }
}
