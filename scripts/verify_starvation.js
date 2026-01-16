async () => {
    const game = window.__VOXEL_GAME__;
    if (!game) return { success: false, message: 'Game not found' };

    console.log('Verifying Starvation Logic...');

    const player = game.player;
    if (!player) return { success: false, message: 'Player not found' };

    // Set Hunger to 0
    player.hunger = 0;
    console.log('Set Hunger to 0');

    // Reset health to max
    player.health = 20;

    // Starvation damage applies every 4 seconds. 
    // We wait 5 seconds to be sure.
    console.log('Waiting 5 seconds for starvation...');

    await new Promise(resolve => setTimeout(resolve, 5000));

    const finalHealth = game.player.health; // Re-read health
    console.log(`Final Health: ${finalHealth}`);

    if (finalHealth < 20) {
        return { success: false, message: `FAIL: Player took damage! Health: ${finalHealth}/20` };
    } else {
        return { success: true, message: `PASS: Health remained at ${finalHealth}/20` };
    }
}
