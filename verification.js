() => {
    const game = window.__VOXEL_GAME__;
    const villager = new game.AnimalClasses.Villager(game, 0, 0, 0);
    const horse = new game.AnimalClasses.Horse(game, 0, 0, 0);
    if (villager.isRideable !== false) {
        return { success: false, message: 'Villager.isRideable should be false (' + villager.isRideable + ')' };
    }
    // Check if horse isRideable is undefined (default true) or explicitly true
    if (horse.isRideable === false) {
        return { success: false, message: 'Horse.isRideable should be true (was ' + horse.isRideable + ')' };
    }

    // Attempt to mount villager
    game.player.mountEntity(villager);
    if (game.player.mount === villager) {
        return { success: false, message: 'Player mounted villager when should not' };
    }

    // Attempt to mount horse
    game.player.mountEntity(horse);
    if (game.player.mount !== horse) {
        return { success: false, message: 'Player failed to mount horse' };
    }

    return { success: true, message: 'Correctly prevented riding villager whilst allowing horse' };
}
