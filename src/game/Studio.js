import * as THREE from 'three';
import { Sheep } from './entities/animals/Sheep.js';

class Studio {
  constructor(game) {
    this.game = game;
    window.studio = this;
  }

  spawnSheepInFrontOfPlayer() {
    const player = this.game.player;
    if (!player) {
      console.log("Player not found.");
      return;
    }

    const forward = new THREE.Vector3();
    player.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const spawnPosition = player.position.clone().add(forward.multiplyScalar(3));

    const groundY = this.game.world.getHighestSolidBlock(Math.floor(spawnPosition.x), Math.floor(spawnPosition.z));
    if (groundY !== null) {
      spawnPosition.y = groundY + 1;
    } else {
      spawnPosition.y = player.position.y;
    }

    const sheep = new Sheep({ position: spawnPosition });
    this.game.entityManager.add(sheep);
    console.log(`Spawned a sheep at ${spawnPosition.x.toFixed(2)}, ${spawnPosition.y.toFixed(2)}, ${spawnPosition.z.toFixed(2)}`);
  }
}

export default Studio;
