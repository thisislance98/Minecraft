
import * as THREE from 'three';

export class SpinningBlock {
    constructor(game, x, y, z, blockType) {
        this.game = game;
        this.blockType = blockType;
        this.position = new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5);
        this.startY = this.position.y;
        
        this.spinVelocity = (Math.random() > 0.5 ? 1 : -1) * (5 + Math.random() * 10);
        this.lifeTime = 0;
        this.maxLifeTime = 10.0;
        this.isDead = false;

        this.mesh = this.createMesh(blockType);
        this.mesh.position.copy(this.position);
    }

    createMesh(type) {
        // Use game's block material logic
        const indices = this.game.blockMaterialIndices[type];
        const geometry = new THREE.BoxGeometry(0.9, 0.9, 0.9);
        let materials;

        if (indices && this.game.assetManager) {
            const allMaterials = this.game.assetManager.materialArray;
            materials = indices.map(idx => {
                const mat = allMaterials[idx].clone();
                mat.vertexColors = false;
                return mat;
            });
        } else {
            materials = new THREE.MeshLambertMaterial({ color: 0x00FFFF });
        }

        const mesh = new THREE.Mesh(geometry, materials);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    }

    update(dt) {
        this.lifeTime += dt;
        
        // Hovering effect
        this.mesh.position.y = this.startY + Math.sin(this.lifeTime * 2) * 0.2;
        
        // Spin
        this.mesh.rotation.y += this.spinVelocity * dt;
        this.mesh.rotation.x += this.spinVelocity * 0.3 * dt;

        if (this.lifeTime > this.maxLifeTime) {
            this.explode();
            this.isDead = true;
        }

        return !this.isDead;
    }

    explode() {
        const particleCount = 10;
        const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        const material = new THREE.MeshBasicMaterial({ color: 0x00FFFF });

        for (let i = 0; i < particleCount; i++) {
            const part = new THREE.Mesh(geometry, material);
            part.position.copy(this.mesh.position);
            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 5,
                (Math.random() - 0.5) * 5,
                (Math.random() - 0.5) * 5
            );
            this.game.scene.add(part);
            
            const start = performance.now();
            const anim = () => {
                const elapsed = (performance.now() - start) / 1000;
                if (elapsed > 1.0) {
                    this.game.scene.remove(part);
                    return;
                }
                part.position.add(vel.clone().multiplyScalar(0.016));
                part.scale.setScalar(1.0 - elapsed);
                requestAnimationFrame(anim);
            };
            anim();
        }
        this.game.scene.remove(this.mesh);
    }
}
