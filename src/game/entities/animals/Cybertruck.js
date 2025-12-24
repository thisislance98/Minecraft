import * as THREE from 'three';
import { Animal } from '../Animal.js';

export class Cybertruck extends Animal {
    constructor(game, x, y, z) {
        super(game, x, y, z);
        this.width = 1.0;
        this.height = 1.0;
        this.depth = 2.0;

        // Stats
        this.speed = 6.0; // Very fast
        this.health = 50; // Tough
        this.damage = 8;  // Hits hard
        this.isHostile = true;
        this.attackRange = 2.5; // Slightly larger range due to size
        this.detectionRange = 24.0;

        this.createBody();
        // Scale up to be vehicle sized
        this.mesh.scale.set(1.5, 1.5, 1.5);
    }

    createBody() {
        // Cybertruck-esque materials
        const metalColor = 0xC0C0C0; // Silver/Steel
        const windowColor = 0x111111; // Dark tint
        const tireColor = 0x181818;   // Dark rubber
        const lightColor = 0xFFFFFF;  // Headlights
        const tailLightColor = 0xFF0000; // Taillights

        const bodyMat = new THREE.MeshLambertMaterial({ color: metalColor });
        const windowMat = new THREE.MeshLambertMaterial({ color: windowColor });
        const tireMat = new THREE.MeshLambertMaterial({ color: tireColor });
        const lightMat = new THREE.MeshBasicMaterial({ color: lightColor });
        const tailLightMat = new THREE.MeshBasicMaterial({ color: tailLightColor });

        // Main Group
        const group = new THREE.Group();
        // Lift slightly so wheels touch ground at 0
        group.position.set(0, 0.4, 0);
        this.mesh.add(group);

        // -- CHASSIS --
        const chassisGeo = new THREE.BoxGeometry(1.0, 0.4, 2.2);
        const chassis = new THREE.Mesh(chassisGeo, bodyMat);
        chassis.position.set(0, 0.2, 0);
        group.add(chassis);

        // -- UPPER BODY (The Wedge) --
        // We'll mimic the angular roof with a scaled box
        // Ideally we'd use custom geometry, but boxes work for "Voxel/Low Poly" style

        // Roof / Cabin
        const cabinGeo = new THREE.BoxGeometry(0.95, 0.5, 1.2);
        const cabin = new THREE.Mesh(cabinGeo, bodyMat);
        cabin.position.set(0, 0.65, 0.2);
        // No easy rotation for perfect wedge without gaps using just boxes, 
        // so we just make it look blocky-industrial.
        group.add(cabin);

        // Windows (Glued on sides)
        const sideWindowGeo = new THREE.BoxGeometry(1.0, 0.3, 0.8);
        const sideWindow = new THREE.Mesh(sideWindowGeo, windowMat);
        sideWindow.position.set(0, 0.7, 0.2);
        sideWindow.scale.set(0.96, 0.9, 1.0); // Slightly smaller w/h implies frame? 
        // Actually just make it slightly wider than cabin to stick out?
        // Or create separate meshes. Let's just add small boxes for windows.

        // Front Windshield
        const windshieldGeo = new THREE.BoxGeometry(0.9, 0.3, 0.1);
        const windshield = new THREE.Mesh(windshieldGeo, windowMat);
        windshield.position.set(0, 0.7, 0.81);
        windshield.rotation.x = -0.5; // Sloped back
        group.add(windshield);

        // -- WHEELS --
        // Boxy wheels
        const wheelGeo = new THREE.BoxGeometry(0.2, 0.5, 0.5);
        const wheelY = 0.0; // Relative to group (0.4 off ground) is center? 
        // Group is at 0.4y. Wheel radius ~0.25 (0.5 dia). Center at 0.0 means bottom at -0.25. 
        // Global bottom = 0.4 - 0.25 = 0.15. Close enough.

        const wheelX = 0.55;
        const wheelZFront = 0.7;
        const wheelZBack = -0.7;

        const fl = new THREE.Mesh(wheelGeo, tireMat);
        fl.position.set(-wheelX, wheelY, wheelZFront);
        group.add(fl);

        const fr = new THREE.Mesh(wheelGeo, tireMat);
        fr.position.set(wheelX, wheelY, wheelZFront);
        group.add(fr);

        const bl = new THREE.Mesh(wheelGeo, tireMat);
        bl.position.set(-wheelX, wheelY, wheelZBack);
        group.add(bl);

        const br = new THREE.Mesh(wheelGeo, tireMat);
        br.position.set(wheelX, wheelY, wheelZBack);
        group.add(br);

        // -- LIGHTS --
        // Front Lightbar
        const headlightGeo = new THREE.BoxGeometry(0.9, 0.05, 0.05);
        const headlight = new THREE.Mesh(headlightGeo, lightMat);
        headlight.position.set(0, 0.4, 1.11);
        group.add(headlight);

        // Rear Lightbar
        const taillightGeo = new THREE.BoxGeometry(0.9, 0.05, 0.05);
        const taillight = new THREE.Mesh(taillightGeo, tailLightMat);
        taillight.position.set(0, 0.4, -1.11);
        group.add(taillight);
    }

    updateAI(dt) {
        super.updateAI(dt);

        // Custom behavior: Engine idle sound or particle exhaust?
        // For now, let's just emit smoke particles if moving
        if (this.isMoving && Math.random() < 0.1) {
            // Access particle system if available, or just ignore for now
            // Game usually has this.game.particleSystem...
            // Let's not crash if it doesn't exist
        }
    }
}
