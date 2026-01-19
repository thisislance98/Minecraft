class Pig extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.8;
        this.height = 0.9;
        this.depth = 1.1;
        this.speed = 2.0;
        this.time = 0;
        this.createBody();
    }

    createBody() {
        const skinColor = 0xF0ACBC; // Pink
        const mat = new window.THREE.MeshLambertMaterial({ color: skinColor });
        const whiteMat = new window.THREE.MeshLambertMaterial({ color: 0xFFFFFF });
        const blackMat = new window.THREE.MeshLambertMaterial({ color: 0x000000 });
        const hoofMat = new window.THREE.MeshLambertMaterial({ color: 0x5C3A21 }); // Dark brown
        
        // BODY - Main rectangle
        const bodyGeo = new window.THREE.BoxGeometry(0.8, 0.7, 1.1);
        const body = new window.THREE.Mesh(bodyGeo, mat);
        body.position.set(0, 0.6, 0); // Raised to leg height
        this.mesh.add(body);
        
        // HEAD - Positioned in front of body
        const headGeo = new window.THREE.BoxGeometry(0.6, 0.6, 0.6);
        const head = new window.THREE.Mesh(headGeo, mat);
        head.position.set(0, 0.9, 0.8); // Forward of body
        this.mesh.add(head);
        
        // SNOUT
        const snoutGeo = new window.THREE.BoxGeometry(0.3, 0.2, 0.1);
        const snout = new window.THREE.Mesh(snoutGeo, mat);
        snout.position.set(0, 0.8, 1.15);
        this.mesh.add(snout);
        
        // EYES - White background with black pupil
        const eyeGeo = new window.THREE.BoxGeometry(0.12, 0.12, 0.05);
        const pupilGeo = new window.THREE.BoxGeometry(0.06, 0.06, 0.06);
        
        const leftEye = new window.THREE.Mesh(eyeGeo, whiteMat);
        leftEye.position.set(-0.2, 1.0, 1.1);
        this.mesh.add(leftEye);
        
        const leftPupil = new window.THREE.Mesh(pupilGeo, blackMat);
        leftPupil.position.set(-0.2, 1.0, 1.12); // Slightly in front
        this.mesh.add(leftPupil);
        
        const rightEye = new window.THREE.Mesh(eyeGeo, whiteMat);
        rightEye.position.set(0.2, 1.0, 1.1);
        this.mesh.add(rightEye);
        
        const rightPupil = new window.THREE.Mesh(pupilGeo, blackMat);
        rightPupil.position.set(0.2, 1.0, 1.12); // Slightly in front
        this.mesh.add(rightPupil);
        
        // LEGS - Use Groups for animation
        const makeLeg = (x, z) => {
            const pivot = new window.THREE.Group();
            pivot.position.set(x, 0.4, z);
            
            const legGeo = new window.THREE.BoxGeometry(0.25, 0.3, 0.25);
            const legMesh = new window.THREE.Mesh(legGeo, mat);
            legMesh.position.set(0, -0.15, 0);
            pivot.add(legMesh);
            
            const hoofGeo = new window.THREE.BoxGeometry(0.25, 0.1, 0.25);
            const hoofMesh = new window.THREE.Mesh(hoofGeo, hoofMat);
            hoofMesh.position.set(0, -0.35, 0);
            pivot.add(hoofMesh);
            
            this.mesh.add(pivot);
            return pivot;
        };
        
        this.legParts = [
            makeLeg(-0.25, 0.4),  // Front Left
            makeLeg(0.25, 0.4),   // Front Right
            makeLeg(-0.25, -0.4), // Back Left
            makeLeg(0.25, -0.4)   // Back Right
        ];
    }

    updateAI(dt) {
        this.time += dt;
        super.updateAI(dt);
        
        // Simple leg animation
        if (this.isMoving) {
            const speed = 10;
            const t = this.time * speed;
            this.legParts[0].rotation.x = Math.sin(t) * 0.5;
            this.legParts[1].rotation.x = Math.cos(t) * 0.5;
            this.legParts[2].rotation.x = Math.cos(t) * 0.5;
            this.legParts[3].rotation.x = Math.sin(t) * 0.5;
        } else {
            // Reset legs when stopped
            for (const leg of this.legParts) {
                leg.rotation.x = 0;
            }
        }
    }
}