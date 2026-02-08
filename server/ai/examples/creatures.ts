/**
 * Creature Examples for Few-Shot AI
 * These are simplified, working examples that the AI can reference
 */

export const creatureExamples = [
    {
        name: "SimpleBunny",
        description: "A simple hopping bunny - passive animal that flees from players",
        keywords: ["bunny", "rabbit", "hop", "passive", "cute", "small", "flee"],
        code: `class SimpleBunny extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.4;
        this.height = 0.6;
        this.depth = 0.6;
        this.speed = 3.0;
        this.jumpForce = 15;
        this.canHop = true; // Makes it hop instead of walk
        this.fleeOnProximity = true; // Runs from players
        this.fleeRange = 8.0;
        this.createBody();
    }

    createBody() {
        const furColor = 0xE0E0E0; // Light gray
        const mat = new THREE.MeshLambertMaterial({ color: furColor });
        const blackMat = new THREE.MeshLambertMaterial({ color: 0x000000 });

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.4, 0.4, 0.5);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.3, 0);
        this.mesh.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.set(0, 0.5, 0.3);
        this.mesh.add(head);

        // Long Ears
        const earGeo = new THREE.BoxGeometry(0.08, 0.4, 0.05);
        const leftEar = new THREE.Mesh(earGeo, mat);
        leftEar.position.set(-0.08, 0.8, 0.3);
        this.mesh.add(leftEar);
        const rightEar = new THREE.Mesh(earGeo, mat);
        rightEar.position.set(0.08, 0.8, 0.3);
        this.mesh.add(rightEar);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
        const leftEye = new THREE.Mesh(eyeGeo, blackMat);
        leftEye.position.set(-0.1, 0.55, 0.4);
        this.mesh.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, blackMat);
        rightEye.position.set(0.1, 0.55, 0.4);
        this.mesh.add(rightEye);

        // Fluffy Tail
        const tailGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const tail = new THREE.Mesh(tailGeo, mat);
        tail.position.set(0, 0.35, -0.25);
        this.mesh.add(tail);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.1, 0.2, 0.1);
        const makeLeg = (x, z) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.2, z);
            const leg = new THREE.Mesh(legGeo, mat);
            leg.position.set(0, -0.1, 0);
            pivot.add(leg);
            this.mesh.add(pivot);
            return pivot;
        };
        this.legParts = [makeLeg(-0.15, 0.15), makeLeg(0.15, 0.15), makeLeg(-0.15, -0.15), makeLeg(0.15, -0.15)];
    }
}`
    },
    {
        name: "SimpleRobot",
        description: "A hostile robot that chases and attacks players",
        keywords: ["robot", "hostile", "enemy", "mechanical", "attack", "chase", "monster"],
        code: `class SimpleRobot extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.8;
        this.height = 1.8;
        this.depth = 0.8;
        this.speed = 1.5;
        this.health = 20;
        this.maxHealth = 20;
        this.damage = 3;
        this.isHostile = true;
        this.detectionRange = 15.0;
        this.attackRange = 2.0;
        this.createBody();
    }

    createBody() {
        const metalMat = new THREE.MeshLambertMaterial({ color: 0xCCCCCC });
        const darkMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xFF0000 }); // Glowing red

        // Torso
        const torsoGeo = new THREE.BoxGeometry(0.6, 0.8, 0.4);
        const torso = new THREE.Mesh(torsoGeo, metalMat);
        torso.position.y = 1.1;
        this.mesh.add(torso);

        // Head
        const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const head = new THREE.Mesh(headGeo, metalMat);
        head.position.set(0, 1.7, 0);
        this.mesh.add(head);

        // Glowing visor eyes
        const visorGeo = new THREE.BoxGeometry(0.3, 0.1, 0.05);
        const visor = new THREE.Mesh(visorGeo, eyeMat);
        visor.position.set(0, 1.7, 0.2);
        this.mesh.add(visor);

        // Antenna
        const antGeo = new THREE.BoxGeometry(0.02, 0.3, 0.02);
        const antenna = new THREE.Mesh(antGeo, darkMat);
        antenna.position.set(0, 2.05, 0);
        this.mesh.add(antenna);

        // Arms
        const armGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
        const leftArm = new THREE.Group();
        leftArm.position.set(-0.45, 1.3, 0);
        const leftArmMesh = new THREE.Mesh(armGeo, metalMat);
        leftArmMesh.position.y = -0.3;
        leftArm.add(leftArmMesh);
        this.mesh.add(leftArm);

        const rightArm = new THREE.Group();
        rightArm.position.set(0.45, 1.3, 0);
        const rightArmMesh = new THREE.Mesh(armGeo, metalMat);
        rightArmMesh.position.y = -0.3;
        rightArm.add(rightArmMesh);
        this.mesh.add(rightArm);
        this.armParts = [leftArm, rightArm];

        // Legs
        const legGeo = new THREE.BoxGeometry(0.25, 0.7, 0.25);
        const makeLeg = (x) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, 0.7, 0);
            const leg = new THREE.Mesh(legGeo, darkMat);
            leg.position.y = -0.35;
            pivot.add(leg);
            this.mesh.add(pivot);
            return pivot;
        };
        this.legParts = [makeLeg(-0.2), makeLeg(0.2)];
    }
}`
    },
    {
        name: "FlyingCreature",
        description: "A flying creature that hovers and moves through the air",
        keywords: ["fly", "flying", "bird", "dragon", "hover", "air", "wings", "float"],
        code: `class FlyingCreature extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 1.0;
        this.height = 0.6;
        this.depth = 1.0;
        this.speed = 5.0;
        this.gravity = 0; // Ignore gravity - we fly!
        this.flyingHeight = 10;
        this.wingFlapTimer = 0;
        this.createBody();
    }

    createBody() {
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0x4488FF });
        const wingMat = new THREE.MeshLambertMaterial({ color: 0x2266CC, side: THREE.DoubleSide });
        const eyeMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.6, 0.4, 0.8);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        this.mesh.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const head = new THREE.Mesh(headGeo, bodyMat);
        head.position.set(0, 0.15, 0.5);
        this.mesh.add(head);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.05);
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.1, 0.2, 0.65);
        this.mesh.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.1, 0.2, 0.65);
        this.mesh.add(rightEye);

        // Wings
        const wingGeo = new THREE.BoxGeometry(1.0, 0.05, 0.4);
        this.leftWing = new THREE.Group();
        this.leftWing.position.set(-0.3, 0, 0);
        const leftWingMesh = new THREE.Mesh(wingGeo, wingMat);
        leftWingMesh.position.set(-0.5, 0, 0);
        this.leftWing.add(leftWingMesh);
        this.mesh.add(this.leftWing);

        this.rightWing = new THREE.Group();
        this.rightWing.position.set(0.3, 0, 0);
        const rightWingMesh = new THREE.Mesh(wingGeo, wingMat);
        rightWingMesh.position.set(0.5, 0, 0);
        this.rightWing.add(rightWingMesh);
        this.mesh.add(this.rightWing);

        // Tail
        const tailGeo = new THREE.BoxGeometry(0.15, 0.1, 0.4);
        const tail = new THREE.Mesh(tailGeo, bodyMat);
        tail.position.set(0, 0, -0.6);
        this.mesh.add(tail);
    }

    update(dt) {
        // Wing flapping animation
        this.wingFlapTimer += dt * 5;
        const flapAngle = Math.sin(this.wingFlapTimer) * 0.5;
        this.leftWing.rotation.z = flapAngle;
        this.rightWing.rotation.z = -flapAngle;

        // Maintain flying height
        const groundY = this.game.worldGen ? this.game.worldGen.getTerrainHeight(this.position.x, this.position.z) : 0;
        const targetY = groundY + this.flyingHeight;
        this.position.y += (targetY - this.position.y) * dt * 2;

        // Random movement
        if (!this.moveTimer || this.moveTimer <= 0) {
            this.moveTimer = 2 + Math.random() * 3;
            const angle = Math.random() * Math.PI * 2;
            this.moveDirection.set(Math.sin(angle), 0, Math.cos(angle));
            this.rotation = angle;
        }
        this.moveTimer -= dt;

        this.position.x += this.moveDirection.x * this.speed * dt;
        this.position.z += this.moveDirection.z * this.speed * dt;

        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.rotation;
    }
}`
    },
    {
        name: "SlimeCreature",
        description: "A bouncy slime creature - simple spherical hopping monster",
        keywords: ["slime", "blob", "bounce", "jelly", "simple", "sphere", "goo"],
        code: `class SlimeCreature extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.8;
        this.height = 0.8;
        this.depth = 0.8;
        this.speed = 2.0;
        this.jumpForce = 8;
        this.canHop = true;
        this.health = 10;
        this.maxHealth = 10;
        this.squishTimer = 0;
        this.createBody();
    }

    createBody() {
        // Semi-transparent green slime
        const slimeMat = new THREE.MeshLambertMaterial({
            color: 0x44FF44,
            transparent: true,
            opacity: 0.7
        });
        const coreMat = new THREE.MeshLambertMaterial({ color: 0x22AA22 });
        const eyeMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
        const pupilMat = new THREE.MeshLambertMaterial({ color: 0x000000 });

        // Main body - sphere-like using box (Minecraft style)
        const bodyGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        const body = new THREE.Mesh(bodyGeo, slimeMat);
        body.position.y = 0.4;
        this.mesh.add(body);
        this.bodyMesh = body;

        // Inner core
        const coreGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.y = 0.4;
        this.mesh.add(core);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.15, 0.15, 0.05);
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.15, 0.55, 0.4);
        this.mesh.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.15, 0.55, 0.4);
        this.mesh.add(rightEye);

        // Pupils
        const pupilGeo = new THREE.BoxGeometry(0.08, 0.08, 0.05);
        const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
        leftPupil.position.set(-0.15, 0.55, 0.43);
        this.mesh.add(leftPupil);
        const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
        rightPupil.position.set(0.15, 0.55, 0.43);
        this.mesh.add(rightPupil);
    }

    update(dt) {
        super.update(dt);

        // Squish animation when landing
        if (this.onGround) {
            this.squishTimer += dt * 10;
            const squish = 1 + Math.sin(this.squishTimer) * 0.1;
            this.bodyMesh.scale.set(squish, 1/squish, squish);
        }
    }
}`
    }
];

export function findBestCreatureExamples(userRequest: string, count: number = 2): typeof creatureExamples {
    const request = userRequest.toLowerCase();

    // Score each example based on keyword matches
    const scored = creatureExamples.map(example => {
        let score = 0;
        for (const keyword of example.keywords) {
            if (request.includes(keyword)) {
                score += 10;
            }
        }
        // Also check description
        const descWords = example.description.toLowerCase().split(/\s+/);
        for (const word of descWords) {
            if (request.includes(word) && word.length > 3) {
                score += 2;
            }
        }
        return { example, score };
    });

    // Sort by score and return top matches
    scored.sort((a, b) => b.score - a.score);

    // If no good matches, return first two as defaults
    if (scored[0].score === 0) {
        return [creatureExamples[0], creatureExamples[3]]; // Bunny and Slime as defaults
    }

    return scored.slice(0, count).map(s => s.example);
}
