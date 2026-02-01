/**
 * EntityScript - Makes a game object a spawnable entity/creature
 */

export const EntityScript = {
    type: 'EntityScript',

    // Config - entity is just a marker, other scripts add behavior
    spawnable: true,

    Start() {
        // Entity is now spawnable via VoxelWorld.spawn()
        console.log(`[EntityScript] ${this.gameObject.name} is now spawnable`);
    }
};

export default EntityScript;
