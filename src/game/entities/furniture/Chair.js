import * as THREE from 'three';
import { Furniture } from './Furniture.js';

export class Chair extends Furniture {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.6;
        this.height = 1.0;
        this.depth = 0.6;
        this.dropItem = 'chair';

        // Adjust center
        this.mesh.position.y += 0;
    }

    createBody() {
        const material = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // Saddle Brown wood

        // Seat
        const seatGeo = new THREE.BoxGeometry(0.6, 0.1, 0.6);
        const seat = new THREE.Mesh(seatGeo, material);
        seat.position.y = 0.5;
        this.mesh.add(seat);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.1, 0.5, 0.1);

        const fl = new THREE.Mesh(legGeo, material);
        fl.position.set(-0.2, 0.25, -0.2);
        this.mesh.add(fl);

        const fr = new THREE.Mesh(legGeo, material);
        fr.position.set(0.2, 0.25, -0.2);
        this.mesh.add(fr);

        const bl = new THREE.Mesh(legGeo, material);
        bl.position.set(-0.2, 0.25, 0.2);
        this.mesh.add(bl);

        const br = new THREE.Mesh(legGeo, material);
        br.position.set(0.2, 0.25, 0.2);
        this.mesh.add(br);

        // Backrest
        const backGeo = new THREE.BoxGeometry(0.6, 0.6, 0.1);
        const back = new THREE.Mesh(backGeo, material);
        back.position.set(0, 0.85, -0.25);
        this.mesh.add(back);

        // Cast shadows
        this.mesh.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
    }
}
