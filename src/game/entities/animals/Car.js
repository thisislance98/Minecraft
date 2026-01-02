
import { Animal } from '../Animal.js';

export class Car extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 2.0;
        this.height = 1.0;
        this.depth = 1.2;
        this.speed = 5.0; // Faster than a cow
        this.createBody();
    }

    createBody() {
        const bodyColor = 0xcc0000; // Red
        const wheelColor = 0x333333; // Dark gray
        const windowColor = 0x88ccff; // Light blue

        // Main body
        const bodyGeom = new window.THREE.BoxGeometry(2, 0.6, 1.2);
        const bodyMat = new window.THREE.MeshLambertMaterial({ color: bodyColor });
        const bodyMesh = new window.THREE.Mesh(bodyGeom, bodyMat);
        bodyMesh.position.y = 0.4;
        this.mesh.add(bodyMesh);

        // Cabin
        const cabinGeom = new window.THREE.BoxGeometry(1, 0.5, 1);
        const cabinMat = new window.THREE.MeshLambertMaterial({ color: bodyColor });
        const cabinMesh = new window.THREE.Mesh(cabinGeom, cabinMat);
        cabinMesh.position.set(-0.2, 0.9, 0);
        this.mesh.add(cabinMesh);

        // Windshield
        const winGeom = new window.THREE.BoxGeometry(0.1, 0.4, 0.9);
        const winMat = new window.THREE.MeshLambertMaterial({ color: windowColor, transparent: true, opacity: 0.7 });
        const winMesh = new window.THREE.Mesh(winGeom, winMat);
        winMesh.position.set(0.31, 0.9, 0);
        this.mesh.add(winMesh);

        // Wheels
        const wheelGeom = new window.THREE.BoxGeometry(0.4, 0.4, 0.2);
        const wheelMat = new window.THREE.MeshLambertMaterial({ color: wheelColor });

        const wheelPositions = [
            [0.6, 0.2, 0.55],
            [0.6, 0.2, -0.55],
            [-0.6, 0.2, 0.55],
            [-0.6, 0.2, -0.55]
        ];

        wheelPositions.forEach(pos => {
            const wheel = new window.THREE.Mesh(wheelGeom, wheelMat);
            wheel.position.set(...pos);
            this.mesh.add(wheel);
        });
    }

    updateAI(dt) {
        // Car behavior: mostly moves forward if it moves at all
        super.updateAI(dt);
    }
}
