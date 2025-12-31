import * as THREE from 'three';
import { Furniture } from './Furniture.js';

export class Couch extends Furniture {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 2.0; // Two blocks wide
        this.height = 1.0;
        this.depth = 1.0;
        this.dropItem = 'couch';
    }

    createBody() {
        const woodMat = new THREE.MeshLambertMaterial({ color: 0x5C4033 });
        const fabricMat = new THREE.MeshLambertMaterial({ color: 0xAA3333 }); // Red Fabric

        // Base
        const baseGeo = new THREE.BoxGeometry(2.0, 0.4, 0.8);
        const base = new THREE.Mesh(baseGeo, fabricMat);
        base.position.y = 0.2;
        this.mesh.add(base);

        // Backrest
        const backGeo = new THREE.BoxGeometry(2.0, 0.6, 0.2);
        const back = new THREE.Mesh(backGeo, fabricMat);
        back.position.set(0, 0.7, -0.3);
        this.mesh.add(back);

        // Armrests
        const armGeo = new THREE.BoxGeometry(0.2, 0.4, 0.8);

        const leftArm = new THREE.Mesh(armGeo, fabricMat);
        leftArm.position.set(-0.9, 0.6, 0);
        this.mesh.add(leftArm);

        const rightArm = new THREE.Mesh(armGeo, fabricMat);
        rightArm.position.set(0.9, 0.6, 0);
        this.mesh.add(rightArm);

        // Feet (4)
        const footGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);

        const fl = new THREE.Mesh(footGeo, woodMat);
        fl.position.set(-0.9, 0.05, -0.35);
        this.mesh.add(fl);

        const fr = new THREE.Mesh(footGeo, woodMat);
        fr.position.set(0.9, 0.05, -0.35);
        this.mesh.add(fr);

        const bl = new THREE.Mesh(footGeo, woodMat);
        bl.position.set(-0.9, 0.05, 0.35);
        this.mesh.add(bl);

        const br = new THREE.Mesh(footGeo, woodMat);
        br.position.set(0.9, 0.05, 0.35);
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
