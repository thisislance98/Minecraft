import { Item } from './Item.js';
import { PhysicsBall } from '../entities/projectiles/PhysicsBall.js';
import * as THREE from 'three';

export class PhysicsBallItem extends Item {
    constructor() {
        super();
        this.id = 'physics_ball';
        this.name = 'Physics Ball';
        this.type = 'tool';
        this.icon = '⚽'; // Simple icon
    }

    onUseDown(game, player) {
        // Cooldown check?
        const now = performance.now();
        if (this.lastFire && now - this.lastFire < 500) return false;
        this.lastFire = now;

        // Spawn ball
        // Start position: Player eye position + forward offset
        const direction = new THREE.Vector3();
        player.camera.getWorldDirection(direction);

        const spawnPos = player.position.clone();
        spawnPos.y += 1.6; // Eye height
        spawnPos.add(direction.clone().multiplyScalar(0.5)); // Just in front

        // Velocity: Direction * Speed
        const speed = 15.0; // Fast throw
        const velocity = direction.clone().multiplyScalar(speed);

        // Add player velocity for momentum conservation?
        // simple addition:
        velocity.add(player.velocity);

        // Spawn
        const ball = new PhysicsBall(game, spawnPos.x, spawnPos.y, spawnPos.z, velocity);

        // Ensure game has a list for general entities/projectiles
        // VoxelGame.js has 'projectiles' array
        game.projectiles.push(ball);

        // Sound
        // game.soundManager.playSound('throw'); 

        // Trigger animation
        player.swingArm();

        return true;
    }
}
