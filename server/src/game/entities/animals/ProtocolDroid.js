class ProtocolDroid extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.6;
        this.height = 1.8;
        this.depth = 0.6;
        this.followDistance = 2.5;
        this.speed = 3.0;
        this.createBody();
    }

    createBody() {
        const goldMat = new window.THREE.MeshLambertMaterial({ color: 0xD4AF37 });
        const silverMat = new window.THREE.MeshLambertMaterial({ color: 0xC0C0C0 });
        const eyeMat = new window.THREE.MeshLambertMaterial({ color: 0xFFFF00, emissive: 0xFFFF00, emissiveIntensity: 0.5 });
        const blackMat = new window.THREE.MeshLambertMaterial({ color: 0x111111 });

        // Main Group offset
        this.bodyGroup = new window.THREE.Group();
        this.bodyGroup.position.y = 0.9; // Center of 1.8m height
        this.mesh.add(this.bodyGroup);

        // Torso
        const torso = new window.THREE.Mesh(new window.THREE.BoxGeometry(0.5, 0.7, 0.3), goldMat);
        torso.position.y = 0.1;
        this.bodyGroup.add(torso);

        // Chest detail (circular port)
        const chestDetail = new window.THREE.Mesh(new window.THREE.CylinderGeometry(0.1, 0.1, 0.05, 16), blackMat);
        chestDetail.rotation.x = Math.PI / 2;
        chestDetail.position.set(0, 0.2, 0.16);
        this.bodyGroup.add(chestDetail);

        // Head
        const head = new window.THREE.Mesh(new window.THREE.SphereGeometry(0.25, 16, 16), goldMat);
        head.position.y = 0.6;
        this.bodyGroup.add(head);

        // Eyes
        const leftEye = new window.THREE.Mesh(new window.THREE.SphereGeometry(0.06, 8, 8), eyeMat);
        leftEye.position.set(-0.1, 0.65, 0.2);
        this.bodyGroup.add(leftEye);

        const rightEye = new window.THREE.Mesh(new window.THREE.SphereGeometry(0.06, 8, 8), eyeMat);
        rightEye.position.set(0.1, 0.65, 0.2);
        this.bodyGroup.add(rightEye);

        // Arms (Pivots at shoulders)
        this.leftArm = new window.THREE.Group();
        this.leftArm.position.set(-0.35, 0.4, 0);
        const leftArmMesh = new window.THREE.Mesh(new window.THREE.BoxGeometry(0.12, 0.7, 0.12), goldMat);
        leftArmMesh.position.y = -0.3; // Hang down
        this.leftArm.add(leftArmMesh);
        this.bodyGroup.add(this.leftArm);

        this.rightArm = new window.THREE.Group();
        this.rightArm.position.set(0.35, 0.4, 0);
        const rightArmMesh = new window.THREE.Mesh(new window.THREE.BoxGeometry(0.12, 0.7, 0.12), goldMat);
        rightArmMesh.position.y = -0.3;
        this.rightArm.add(rightArmMesh);
        this.bodyGroup.add(this.rightArm);

        // Legs (Pivots at hips)
        this.leftLeg = new window.THREE.Group();
        this.leftLeg.position.set(-0.15, -0.25, 0);
        const leftLegMesh = new window.THREE.Mesh(new window.THREE.BoxGeometry(0.15, 0.8, 0.15), goldMat);
        leftLegMesh.position.y = -0.4;
        this.leftLeg.add(leftLegMesh);
        this.bodyGroup.add(this.leftLeg);

        // Right Leg (Silver for the classic look)
        this.rightLeg = new window.THREE.Group();
        this.rightLeg.position.set(0.15, -0.25, 0);
        const rightLegMesh = new window.THREE.Mesh(new window.THREE.BoxGeometry(0.15, 0.8, 0.15), silverMat);
        rightLegMesh.position.y = -0.4;
        this.rightLeg.add(rightLegMesh);
        this.bodyGroup.add(this.rightLeg);
    }

    updateAI(dt) {
        // Follow Player Logic
        const player = this.game.player;
        if (player) {
            const dx = player.position.x - this.position.x;
            const dz = player.position.z - this.position.z;
            const distSq = dx * dx + dz * dz;
            const followDistSq = this.followDistance * this.followDistance;

            if (distSq > 1000) { // Teleport if too far
                this.position.copy(player.position);
            } else if (distSq > followDistSq) {
                const angle = Math.atan2(dx, dz);
                this.rotation = angle;
                this.moveDirection.set(Math.sin(angle), 0, Math.cos(angle));
                this.isMoving = true;
                console.log('[BEHAVIOR] moving');
            } else {
                this.isMoving = false;
                this.rotation = Math.atan2(dx, dz); // Face player when stopped
                console.log('[BEHAVIOR] following');
            }
        }

        // Animation
        if (this.isMoving) {
            this.time += dt * 10;
            // Stiff robotic walk
            this.leftLeg.rotation.x = Math.sin(this.time) * 0.5;
            this.rightLeg.rotation.x = Math.sin(this.time + Math.PI) * 0.5;
            this.leftArm.rotation.x = Math.sin(this.time + Math.PI) * 0.3; // Opposite to leg
            this.rightArm.rotation.x = Math.sin(this.time) * 0.3;
        } else {
            // Reset to standing
            this.leftLeg.rotation.x = 0;
            this.rightLeg.rotation.x = 0;
            this.leftArm.rotation.x = 0;
            this.rightArm.rotation.x = 0;
        }

        super.updateAI(dt);
    }
}