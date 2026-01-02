import { Animal } from '../Animal.js';

export class BouncyBall extends Animal {
    constructor(game, x, y, z, seed) {
        super(game, x, y, z, seed);
        this.width = 0.5;
        this.height = 0.5;
        this.depth = 0.5;
        this.speed = 4.0;
        this.bounceForce = 0.4;
        this.createBody();
    }

    createBody() {
        const mat = new window.THREE.MeshLambertMaterial({ color: 0xff4444 });
        const geom = new window.THREE.SphereGeometry(0.3, 16, 16);
        const ball = new window.THREE.Mesh(geom, mat);
        this.mesh.add(ball);
    }

    updateAI(dt) {
        super.updateAI(dt);
        if (this.onGround) {
            this.velocity.y = this.bounceForce;
            // Add a little random horizontal kick when bouncing
            this.velocity.x += (Math.random() - 0.5) * 0.1;
            this.velocity.z += (Math.random() - 0.5) * 0.1;
        }
    }
}
