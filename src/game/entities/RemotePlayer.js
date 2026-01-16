import * as THREE from 'three';

export class RemotePlayer {
    constructor(game, id) {
        this.game = game;
        this.id = id;
        this.position = new THREE.Vector3(0, 0, 0);

        // Create simple box represention
        const geometry = new THREE.BoxGeometry(0.6, 1.8, 0.6);
        const material = new THREE.MeshLambertMaterial({ color: 0xff0000 }); // Red for visibility
        this.mesh = new THREE.Mesh(geometry, material);

        // Offset so position is at feet
        this.mesh.position.y = 0.9;

        this.group = new THREE.Group();
        this.group.add(this.mesh);

        this.game.scene.add(this.group);
        console.log(`[RemotePlayer] Created 3D box for ${id}`);
    }

    updatePosition(pos) {
        this.position.copy(pos);
        this.group.position.copy(pos);
    }

    remove() {
        if (this.group) {
            this.game.scene.remove(this.group);
        }
    }
}
