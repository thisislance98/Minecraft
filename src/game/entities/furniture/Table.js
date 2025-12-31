import * as THREE from 'three';
import { Furniture } from './Furniture.js';

export class Table extends Furniture {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 1.0;
        this.height = 1.0;
        this.depth = 1.0;
        this.dropItem = 'table';
    }

    createBody() {
        const material = new THREE.MeshLambertMaterial({ color: 0x5C4033 }); // Dark wood

        // Table Top
        const topGeo = new THREE.BoxGeometry(1.2, 0.1, 1.2); // Slightly larger than block
        const top = new THREE.Mesh(topGeo, material);
        top.position.y = 0.9;
        this.mesh.add(top);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.15, 0.9, 0.15);

        const dist = 0.45;

        const fl = new THREE.Mesh(legGeo, material);
        fl.position.set(-dist, 0.45, -dist);
        this.mesh.add(fl);

        const fr = new THREE.Mesh(legGeo, material);
        fr.position.set(dist, 0.45, -dist);
        this.mesh.add(fr);

        const bl = new THREE.Mesh(legGeo, material);
        bl.position.set(-dist, 0.45, dist);
        this.mesh.add(bl);

        const br = new THREE.Mesh(legGeo, material);
        br.position.set(dist, 0.45, dist);
        this.mesh.add(br);

        // Cast shadows
        this.mesh.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
    }
}
