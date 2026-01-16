// Example territory module - demonstrates the API

// Define custom creatures for this territory
const creatures = {
    'magic_butterfly': {
        model: {
            base: 'butterfly',
            scale: 1.5,
            color: '#ff00ff',
            particles: 'sparkle'
        },
        behavior: {
            speed: 0.8,
            pattern: 'spiral'
        }
    }
};

// Define custom items
const items = {
    'speed_boots': {
        icon: '👟',
        onUse: (player) => {
            api.sendMessage(player, 'Speed boost activated!');
            // TODO: Apply speed effect
        }
    }
};

// Called when a player enters this territory
function onPlayerEnter(player) {
    api.sendMessage(player, 'Welcome to the Magic Garden! 🦋');
    api.playSound('chime', player.position.x, player.position.y, player.position.z);

    // Spawn a butterfly to greet them
    const spawnPos = {
        x: player.position.x + 2,
        y: player.position.y + 2,
        z: player.position.z
    };
    api.spawnCreature('magic_butterfly', spawnPos.x, spawnPos.y, spawnPos.z);
}

// Called when a player leaves this territory
function onPlayerLeave(player) {
    api.sendMessage(player, 'Thanks for visiting! Come back soon!');
}

// Called every frame while territory is active
function onUpdate(deltaTime) {
    const info = api.getTerritoryInfo();

    // Randomly spawn butterflies
    if (api.random() < 0.001) { // 0.1% chance per frame
        const x = api.randomInt(info.bounds.minX, info.bounds.maxX);
        const z = api.randomInt(info.bounds.minZ, info.bounds.maxZ);
        api.spawnCreature('magic_butterfly', x, 50, z);
    }

    // Create ambient particles
    if (info.inhabitants.length > 0) {
        for (let i = 0; i < 3; i++) {
            const x = api.randomInt(info.bounds.minX, info.bounds.maxX);
            const z = api.randomInt(info.bounds.minZ, info.bounds.maxZ);
            api.createParticles('sparkle', x, 45, z, 5);
        }
    }
}

// Export is handled by the wrapper
