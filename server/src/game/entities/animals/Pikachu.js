class Pikachu extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.6;
        this.height = 0.8;
        this.depth = 0.8;
        this.speed = 4.5; // Fast little guy
        this.followDistance = 2.5;
        this.jumpHeight = 1.2;
        this.time = 0;
        this.createBody();
    }

    createBody() {
        // Materials
        const yellowMat = new window.THREE.MeshLambertMaterial({ color: 0xFFDD00 }); // Vibrant yellow
        const redMat = new window.THREE.MeshLambertMaterial({ color: 0xFF0000 });
        const blackMat = new window.THREE.MeshLambertMaterial({ color: 0x111111 });
        const whiteMat = new window.THREE.MeshLambertMaterial({ color: 0xFFFFFF });
        const brownMat = new window.THREE.MeshLambertMaterial({ color: 0x8B4513 }); // Tail base

        // --- BODY ---
        const bodyGeo = new window.THREE.BoxGeometry(0.5, 0.6, 0.4);
        this.bodyMesh = new window.THREE.Mesh(bodyGeo, yellowMat);
        this.bodyMesh.position.y = 0.4;
        this.mesh.add(this.bodyMesh);

        // --- HEAD ---
        const headGroup = new window.THREE.Group();
        headGroup.position.set(0, 0.5, 0); 
        this.bodyMesh.add(headGroup);

        const headGeo = new window.THREE.BoxGeometry(0.55, 0.5, 0.45);
        const head = new window.THREE.Mesh(headGeo, yellowMat);
        headGroup.add(head);

        // --- FACE ---
        const eyeGeo = new window.THREE.BoxGeometry(0.08, 0.08, 0.05);
        const pupilGeo = new window.THREE.BoxGeometry(0.04, 0.04, 0.06);

        const leftEye = new window.THREE.Mesh(eyeGeo, blackMat);
        leftEye.position.set(-0.15, 0.05, 0.22);
        head.add(leftEye);
        const leftPupil = new window.THREE.Mesh(pupilGeo, whiteMat);
        leftPupil.position.set(-0.13, 0.07, 0.23); 
        head.add(leftPupil);

        const rightEye = new window.THREE.Mesh(eyeGeo, blackMat);
        rightEye.position.set(0.15, 0.05, 0.22);
        head.add(rightEye);
        const rightPupil = new window.THREE.Mesh(pupilGeo, whiteMat);
        rightPupil.position.set(0.13, 0.07, 0.23);
        head.add(rightPupil);

        const cheekGeo = new window.THREE.CylinderGeometry(0.08, 0.08, 0.05, 12);
        const leftCheek = new window.THREE.Mesh(cheekGeo, redMat);
        leftCheek.rotation.x = Math.PI / 2;
        leftCheek.position.set(-0.2, -0.1, 0.21);
        head.add(leftCheek);

        const rightCheek = new window.THREE.Mesh(cheekGeo, redMat);
        rightCheek.rotation.x = Math.PI / 2;
        rightCheek.position.set(0.2, -0.1, 0.21);
        head.add(rightCheek);

        const nose = new window.THREE.Mesh(new window.THREE.BoxGeometry(0.02, 0.02, 0.02), blackMat);
        nose.position.set(0, 0.0, 0.23);
        head.add(nose);

        // --- EARS ---
        const earGeo = new window.THREE.ConeGeometry(0.06, 0.5, 8);
        const tipGeo = new window.THREE.ConeGeometry(0.061, 0.15, 8); 

        const leftEar = new window.THREE.Mesh(earGeo, yellowMat);
        leftEar.position.set(-0.2, 0.4, 0);
        leftEar.rotation.z = Math.PI / 6; 
        head.add(leftEar);
        const leftTip = new window.THREE.Mesh(tipGeo, blackMat);
        leftTip.position.y = 0.175;
        leftEar.add(leftTip);

        const rightEar = new window.THREE.Mesh(earGeo, yellowMat);
        rightEar.position.set(0.2, 0.4, 0);
        rightEar.rotation.z = -Math.PI / 6; 
        head.add(rightEar);
        const rightTip = new window.THREE.Mesh(tipGeo, blackMat);
        rightTip.position.y = 0.175;
        rightEar.add(rightTip);

        // --- TAIL ---
        this.tailGroup = new window.THREE.Group();
        this.tailGroup.position.set(0, -0.2, -0.2);
        this.bodyMesh.add(this.tailGroup);

        const seg1 = new window.THREE.Mesh(new window.THREE.BoxGeometry(0.05, 0.3, 0.05), brownMat);
        seg1.rotation.z = Math.PI / 4;
        seg1.position.y = 0.1;
        this.tailGroup.add(seg1);

        const seg2 = new window.THREE.Mesh(new window.THREE.BoxGeometry(0.08, 0.3, 0.05), yellowMat);
        seg2.rotation.z = -Math.PI / 4;
        seg2.position.set(0.1, 0.3, 0);
        this.tailGroup.add(seg2);
        
        const seg3 = new window.THREE.Mesh(new window.THREE.BoxGeometry(0.12, 0.3, 0.05), yellowMat);
        seg3.rotation.z = Math.PI / 4;
        seg3.position.set(0.0, 0.5, 0);
        this.tailGroup.add(seg3);

        // --- LEGS ---
        const legGeo = new window.THREE.BoxGeometry(0.12, 0.15, 0.15);
        const makeLeg = (x, z) => {
            const leg = new window.THREE.Mesh(legGeo, yellowMat);
            leg.position.set(x, -0.3, z); 
            this.bodyMesh.add(leg);
            return leg;
        };
        this.legs = [
            makeLeg(-0.15, 0.1), makeLeg(0.15, 0.1),
            makeLeg(-0.15, -0.1), makeLeg(0.15, -0.1)
        ];
    }

    updateAI(dt) {
        this.time += dt; // Increment animation timer

        const player = this.game.player;
        if (player) {
            const distSq = this.position.distanceToSquared(player.position);
            const maxRange = 30.0;

            if (distSq > maxRange * maxRange) {
                this.position.copy(player.position);
                this.position.x += (Math.random() - 0.5) * 4;
                this.position.z += (Math.random() - 0.5) * 4;
            } else if (distSq > this.followDistance * this.followDistance) {
                const dir = new window.THREE.Vector3().subVectors(player.position, this.position);
                dir.normalize();
                this.moveDirection.copy(dir);
                this.rotation = Math.atan2(dir.x, dir.z);
                this.isMoving = true;
            } else {
                this.isMoving = false;
                const dx = player.position.x - this.position.x;
                const dz = player.position.z - this.position.z;
                this.rotation = Math.atan2(dx, dz);
                this.tailGroup.rotation.z = Math.sin(this.time * 10) * 0.2;
            }
        } else {
            super.updateAI(dt);
        }

        if (this.isMoving) {
            const speed = 15;
            this.legs[0].rotation.x = Math.sin(this.time * speed) * 0.5;
            this.legs[1].rotation.x = Math.cos(this.time * speed) * 0.5;
            this.legs[2].rotation.x = Math.cos(this.time * speed) * 0.5;
            this.legs[3].rotation.x = Math.sin(this.time * speed) * 0.5;
            this.tailGroup.rotation.z = Math.sin(this.time * 20) * 0.3;
        }
    }
}