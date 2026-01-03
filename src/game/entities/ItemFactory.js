
import * as THREE from 'three';

/**
 * Factory for creating item 3D models (tools, weapons, etc.)
 * Used by both Player (local interactive) and SocketManager (remote visualization)
 */
export class ItemFactory {

    static createPickaxe() {
        const handleColor = 0x5C4033; // Dark wood
        const headColor = 0x00CED1;   // Diamond mostly

        // Create handle - player grips at top, handle extends downward
        const handleGeom = new THREE.BoxGeometry(0.04, 0.6, 0.04);
        const handleMat = new THREE.MeshLambertMaterial({ color: handleColor });
        const handle = new THREE.Mesh(handleGeom, handleMat);
        handle.position.y = -0.3; // Half the handle length down

        // Create pickaxe head at the bottom of the handle
        const headGeom = new THREE.BoxGeometry(0.4, 0.04, 0.04);
        const headMat = new THREE.MeshLambertMaterial({ color: headColor });
        const head = new THREE.Mesh(headGeom, headMat);
        head.position.y = -0.55; // At the end of the handle

        const group = new THREE.Group();
        group.add(handle);
        group.add(head);

        // Adjust orientation for "holding"
        // Player toolAttachment rotates this, but standard orientation:
        // Handle vertical, head horizontal
        return group;
    }

    static createSword() {
        const handleColor = 0x5C4033; // Dark wood
        const guardColor = 0x8B4513;  // Brownish guard
        const bladeColor = 0xE6E6E6;  // Iron/Steel color

        const group = new THREE.Group();

        // Handle
        const handleGeom = new THREE.BoxGeometry(0.04, 0.2, 0.04);
        const handleMat = new THREE.MeshLambertMaterial({ color: handleColor });
        const handle = new THREE.Mesh(handleGeom, handleMat);
        handle.position.y = -0.1;
        group.add(handle);

        // Guard
        const guardGeom = new THREE.BoxGeometry(0.15, 0.04, 0.06);
        const guardMat = new THREE.MeshLambertMaterial({ color: guardColor });
        const guard = new THREE.Mesh(guardGeom, guardMat);
        guard.position.y = -0.2;
        group.add(guard);

        // Blade
        const bladeGeom = new THREE.BoxGeometry(0.08, 0.6, 0.02);
        const bladeMat = new THREE.MeshLambertMaterial({ color: bladeColor });
        const blade = new THREE.Mesh(bladeGeom, bladeMat);
        blade.position.y = -0.5;
        group.add(blade);

        return group;
    }

    static createWand(tipColor = 0xFF00FF) {
        const group = new THREE.Group();

        // Handle (Stick)
        const handleGeo = new THREE.BoxGeometry(0.04, 0.4, 0.04);
        const handleMat = new THREE.MeshLambertMaterial({ color: 0x5C4033 }); // Wood
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.position.y = -0.2;
        group.add(handle);

        // Tip (Gem)
        const tipGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
        const tipMat = new THREE.MeshBasicMaterial({ color: tipColor });
        const tip = new THREE.Mesh(tipGeo, tipMat);
        tip.position.y = -0.42;
        group.add(tip);

        return group;
    }

    static createBow() {
        const group = new THREE.Group();
        const woodMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });

        // Center handle
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.15, 0.05), woodMat);
        handle.position.y = -0.3;
        group.add(handle);

        // Upper Limb
        const upper = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.25, 0.04), woodMat);
        upper.position.set(0, -0.15, -0.08);
        upper.rotation.x = -0.4;
        group.add(upper);

        // Lower Limb
        const lower = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.25, 0.04), woodMat);
        lower.position.set(0, -0.45, -0.08);
        lower.rotation.x = 0.4;
        group.add(lower);

        // Bowstring
        const stringMat = new THREE.LineBasicMaterial({ color: 0xDDDDDD });
        const stringGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, -0.05, -0.18),
            new THREE.Vector3(0, -0.55, -0.18)
        ]);
        const string = new THREE.Line(stringGeo, stringMat);
        group.add(string);

        return group;
    }

    static createFood(type) {
        const group = new THREE.Group();

        if (type === 'apple') {
            const appleSkin = new THREE.MeshLambertMaterial({ color: 0xFF0000 });
            const appleStem = new THREE.MeshLambertMaterial({ color: 0x5C4033 });

            const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), appleSkin);
            group.add(body);

            const stem = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.04), appleStem);
            stem.position.y = 0.16;
            group.add(stem);

            // Standard hold adjustment
            group.position.set(0, -0.35, -0.15);
        } else if (type === 'bread') {
            const breadCrust = new THREE.MeshLambertMaterial({ color: 0xD2691E });
            const loaf = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.5), breadCrust);
            group.add(loaf);
            // Standard hold adjustment
            group.position.set(0, -0.35, -0.15);
            group.rotation.y = Math.PI / 2;
        } else if (type === 'chocolate_bar') {
            const chocoColor = 0x5c3317;
            const wrapperColor = 0xC0C0C0;
            const bar = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.05, 0.4), new THREE.MeshLambertMaterial({ color: chocoColor }));
            group.add(bar);
            const wrap = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.2), new THREE.MeshLambertMaterial({ color: wrapperColor }));
            wrap.position.z = 0.1;
            group.add(wrap);

            group.position.set(0, -0.35, -0.15);
            group.rotation.y = Math.PI / 2;
        }

        return group;
    }

    static createFurniture(type) {
        const group = new THREE.Group();
        const woodMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });

        if (type === 'chair') {
            const seat = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.3), woodMat);
            group.add(seat);

            const legGeo = new THREE.BoxGeometry(0.05, 0.25, 0.05);
            [[-0.1, -0.15, -0.1], [0.1, -0.15, -0.1], [-0.1, -0.15, 0.1], [0.1, -0.15, 0.1]].forEach(pos => {
                const leg = new THREE.Mesh(legGeo, woodMat);
                leg.position.set(...pos);
                group.add(leg);
            });

            const back = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.05), woodMat);
            back.position.set(0, 0.15, -0.12);
            group.add(back);

            group.position.set(0, -0.5, 0);
            group.scale.set(0.8, 0.8, 0.8);
        } else if (type === 'table') {
            const tableMat = new THREE.MeshLambertMaterial({ color: 0x5C4033 });
            const top = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.4), tableMat);
            top.position.y = 0.1;
            group.add(top);

            const tLegGeo = new THREE.BoxGeometry(0.05, 0.3, 0.05);
            [[-0.15, -0.05, -0.15], [0.15, -0.05, -0.15], [-0.15, -0.05, 0.15], [0.15, -0.05, 0.15]].forEach(pos => {
                const leg = new THREE.Mesh(tLegGeo, tableMat);
                leg.position.set(...pos);
                group.add(leg);
            });

            group.position.set(0, -0.5, 0);
            group.scale.set(0.8, 0.8, 0.8);
        } else if (type === 'couch') {
            const fabricMat = new THREE.MeshLambertMaterial({ color: 0xAA3333 });
            const cBase = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.25), fabricMat);
            group.add(cBase);

            const cBack = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.25, 0.05), fabricMat);
            cBack.position.set(0, 0.2, -0.1);
            group.add(cBack);

            const cLeft = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.25), fabricMat);
            cLeft.position.set(-0.25, 0.1, 0);
            group.add(cLeft);

            const cRight = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.25), fabricMat);
            cRight.position.set(0.25, 0.1, 0);
            group.add(cRight);

            group.position.set(0, -0.5, 0);
            group.scale.set(0.6, 0.6, 0.6);
        }

        return group;
    }

    static createBinoculars() {
        const group = new THREE.Group();
        const material = new THREE.MeshLambertMaterial({ color: 0x333333 });

        const leftTube = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.2, 8), material);
        leftTube.rotation.x = Math.PI / 2;
        leftTube.position.set(-0.06, 0, 0);
        group.add(leftTube);

        const rightTube = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.2, 8), material);
        rightTube.rotation.x = Math.PI / 2;
        rightTube.position.set(0.06, 0, 0);
        group.add(rightTube);

        const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.02), material);
        group.add(bridge);

        group.position.set(0, -0.3, 0);
        return group;
    }
}
