
() => {
    const game = window.__VOXEL_GAME__;
    if (!game || !game.socketManager) return { success: false, message: 'Game or SocketManager not found' };

    const socketManager = game.socketManager;

    console.log('Verifying Health Bar Position...');

    // Create a dummy character
    // We can use the method directly. It adds to scene but that's fine for verification, we can remove it.
    const id = 'test_dummy_' + Date.now();
    const meshInfo = socketManager.createCharacterModel(id, 'TestPlayer');
    const group = meshInfo.group;

    // Find nametag and health bar
    // Name tag has name
    let nameLabel = null;
    let healthBar = meshInfo.healthBar;

    if (!healthBar) return { success: false, message: 'Health Bar not created' };

    group.children.forEach(child => {
        if (child.userData && child.userData.name === 'TestPlayer') {
            nameLabel = child;
        }
    });

    if (!nameLabel) return { success: false, message: 'Name Label not found' };

    const nameY = nameLabel.position.y;
    const healthY = healthBar.position.y;

    console.log(`Name Y: ${nameY}, Health Y: ${healthY}`);

    // Cleanup
    game.scene.remove(group);

    // Verify: Name should be ABOVE Health
    // Y increases upwards
    if (nameY > healthY) {
        return { success: true, message: `Name (${nameY}) is above Health (${healthY})` };
    } else {
        return { success: false, message: `Name (${nameY}) is NOT above Health (${healthY})` };
    }
}
